"""Temporary-test controller: limits apply to every child; only own unit may be stopped."""
import os,sys,json,time,pathlib,subprocess,urllib.request,datetime
ROOT=pathlib.Path('/srv/dermatome-preflight-20261101-p0')
stage=sys.argv[1];assert stage in ('install','load','A','B','C')
unit='dermatome-p0-'+stage.lower()+'-20261101.service'
MEM_MAX=1536*1024**2;MEM_STOP=int(MEM_MAX*.90)
def props(name):
 p=subprocess.run(['systemctl','show',name,'-p','MainPID','-p','NRestarts','-p','ExecMainStartTimestamp','-p','ActiveState','-p','SubState','-p','Result','-p','ExecMainStatus','-p','ControlGroup'],capture_output=True,text=True,timeout=5)
 return dict(l.split('=',1) for l in p.stdout.splitlines() if '=' in l)
def host():
 mem={k:int(v.split()[0]) for k,v in (l.split(':',1) for l in open('/proc/meminfo')) if k in ('MemAvailable','SwapTotal','SwapFree')}
 return {'available_bytes':mem['MemAvailable']*1024,'swap_used_bytes':(mem['SwapTotal']-mem['SwapFree'])*1024,'load':os.getloadavg(),'swap_io_pages':{k:int(v) for k,v in (l.split() for l in open('/proc/vmstat')) if k in ('pswpin','pswpout')}}
def health():
 checks=[]
 for path in ('/health','/ready'):
  start=time.monotonic()
  try:
   with urllib.request.urlopen('http://127.0.0.1:8000'+path,timeout=2) as r:
    data=json.load(r);checks.append({'path':path,'status':r.status,'ms':round((time.monotonic()-start)*1000,3),'ready':{k:v for k,v in data.items() if isinstance(v,bool)}})
  except Exception as e:checks.append({'path':path,'error':type(e).__name__})
 return checks
before=props('acupuncture.service');before_host=host();checks=health()
report={'stage':stage,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'before':{'service':before,'host':before_host,'health':checks},'swap_baseline_policy':'<=1MiB static usage allowed only after zero observed swap I/O; test swap always zero','limits':{'memory_max':MEM_MAX,'memory_high':1280*1024**2,'swap_max':0,'cpu_quota_percent':100,'nice':15,'runtime_seconds':900 if stage=='install' else 90},'samples':[],'stop_reason':None}
if before.get('ActiveState')!='active' or any(c.get('status')!=200 for c in checks) or before_host['available_bytes']<2200*1024**2 or before_host['swap_used_bytes']>1024**2 or before_host['load'][0]>=2:
 report['stop_reason']='PRECHECK_UNSAFE';(ROOT/'logs'/f'{stage}-monitor.json').write_text(json.dumps(report,indent=2));print(json.dumps({'stage':stage,'stop_reason':report['stop_reason']}));sys.exit(2)
if stage=='install':command=[str(ROOT/'.venv/bin/python'),'-B',str(ROOT/'scripts/install.py')]
else:command=[str(ROOT/'.venv/bin/python'),'-B',str(ROOT/'scripts/runner.py'),stage]
command=['/usr/bin/time','-v','-o',str(ROOT/'logs'/f'{stage}-time.txt'),*command]
args=['systemd-run','--quiet','--collect','--unit='+unit,'-p','User=ubuntu','-p','Group=ubuntu','-p','WorkingDirectory='+str(ROOT),'-p','MemoryMax=1536M','-p','MemoryHigh=1280M','-p','MemorySwapMax=0','-p','CPUQuota=100%','-p','Nice=15','-p','IOWeight=10','-p','TasksMax=64','-p','RuntimeMaxSec='+str(report['limits']['runtime_seconds']),'-p','KillMode=control-group','-p','OOMPolicy=stop','-p','RemainAfterExit=yes','-p','StandardOutput=append:'+str(ROOT/'logs'/f'{stage}.txt'),'-p','StandardError=append:'+str(ROOT/'logs'/f'{stage}.txt')]
for v in ['PYTHONDONTWRITEBYTECODE=1','PYTHONUNBUFFERED=1','OMP_NUM_THREADS=1','MKL_NUM_THREADS=1','OPENBLAS_NUM_THREADS=1','NUMEXPR_NUM_THREADS=1','PIP_DISABLE_PIP_VERSION_CHECK=1','PIP_NO_CACHE_DIR=1','HF_HUB_OFFLINE=1','TORCH_HOME='+str(ROOT/'model/.torch-cache'),'HF_HOME='+str(ROOT/'model/.hf-cache')]:args+=['--setenv='+v]
launched=False;cg=None;start=time.monotonic();maxmem=0;maxrss=0;maxcpu=0;minavail=before_host['available_bytes'];health_samples=[];last_health=0;last_cpu=None;sustained=0
try:
 p=subprocess.run([*args,*command],capture_output=True,text=True,timeout=8)
 if p.returncode:raise RuntimeError('TRANSIENT_UNIT_START_FAILED:'+p.stderr[:200])
 launched=True
 while True:
  state=props(unit);name=state.get('ControlGroup','');cg=pathlib.Path('/sys/fs/cgroup'+name) if name else cg
  sample={'elapsed_s':round(time.monotonic()-start,3),'state':state.get('SubState'),**host()}
  if cg and cg.exists():
   for key in ['memory.current','memory.peak','memory.swap.current','memory.events','cpu.stat','cpu.max','memory.max','memory.swap.max']:
    p=cg/key
    if p.exists():sample[key]=p.read_text().strip()
   if sample.get('memory.max')!=str(MEM_MAX) or sample.get('cpu.max')!='100000 100000' or sample.get('memory.swap.max')!='0':report['stop_reason']='LIMIT_NOT_ENFORCED'
   memory=int(sample.get('memory.current',0));maxmem=max(maxmem,int(sample.get('memory.peak',memory)))
   cpu=dict(l.split() for l in sample.get('cpu.stat','').splitlines());usec=int(cpu.get('usage_usec',0));now=time.monotonic()
   if last_cpu:
    pc=(usec-last_cpu[0])/(now-last_cpu[1])/10000;sample['test_cpu_one_core_pct']=round(pc,2);maxcpu=max(maxcpu,pc)
    sustained=sustained+(now-last_cpu[1]) if pc>90 else 0
   last_cpu=usec,now
   rss=0
   for pid in (cg/'cgroup.procs').read_text().split():
    try:
     fields=dict(l.split(':',1) for l in open('/proc/'+pid+'/status') if ':' in l);rss+=int(fields.get('VmRSS','0').split()[0])*1024
    except (FileNotFoundError,ProcessLookupError):pass
   maxrss=max(maxrss,rss);sample['tree_rss_bytes']=rss
   if memory>=MEM_STOP:report['stop_reason']='MEMORY_NEAR_LIMIT'
   if int(sample.get('memory.swap.current',0)):report['stop_reason']='TEST_SWAP_USAGE'
   if any(int(l.split()[1]) for l in sample.get('memory.events','').splitlines() if l.split()[0] in ('oom','oom_kill')):report['stop_reason']='CGROUP_OOM'
   if stage!='install' and sustained>20:report['stop_reason']='SUSTAINED_CPU_OVER_20S'
  minavail=min(minavail,sample['available_bytes'])
  if sample['available_bytes']<1024**3:report['stop_reason']='HOST_MEMAVAILABLE_BELOW_1G'
  if sample['swap_used_bytes']>before_host['swap_used_bytes']+1024**2:report['stop_reason']='HOST_SWAP_GROWTH'
  if any(sample['swap_io_pages'][k]>before_host['swap_io_pages'][k] for k in ('pswpin','pswpout')):report['stop_reason']='HOST_SWAP_IO_STARTED'
  if sample['load'][0]>=3:report['stop_reason']='HOST_HIGH_LOAD'
  if time.monotonic()-last_health>=2:
   hs=health();current=props('acupuncture.service');health_samples.append({'elapsed_s':sample['elapsed_s'],'checks':hs,'mainpid':current.get('MainPID'),'restarts':current.get('NRestarts')});last_health=time.monotonic()
   if any(x.get('status')!=200 or any(v is False for v in x.get('ready',{}).values()) for x in hs):report['stop_reason']='PRODUCTION_HEALTH_FAILED'
   if any(current.get(k)!=before.get(k) for k in ('MainPID','NRestarts','ExecMainStartTimestamp','ActiveState')):report['stop_reason']='PRODUCTION_SERVICE_CHANGED'
  report['samples'].append(sample)
  if report['stop_reason'] or state.get('SubState') in ('exited','failed','dead') or state.get('ActiveState') in ('inactive','failed'):break
  if time.monotonic()-start>report['limits']['runtime_seconds']+10:report['stop_reason']='CONTROLLER_TIMEOUT';break
  time.sleep(.5)
 report['unit_result']=props(unit)
except Exception as e:report['stop_reason']=type(e).__name__+':'+str(e)[:180]
finally:
 if launched:subprocess.run(['systemctl','stop',unit],capture_output=True,timeout=10)
 report['after']={'service':props('acupuncture.service'),'host':host(),'health':health(),'test_unit':props(unit)}
 report['health_samples']=health_samples
 report['summary']={'max_cgroup_memory_peak_bytes':maxmem,'max_sampled_process_tree_rss_bytes':maxrss,'max_sampled_cpu_one_core_pct':round(maxcpu,2),'min_host_available_bytes':minavail,'elapsed_seconds':round(time.monotonic()-start,3),'health_check_rounds':len(health_samples)}
 (ROOT/'logs'/f'{stage}-monitor.json').write_text(json.dumps(report,indent=2))
 print(json.dumps({'stage':stage,'stop_reason':report['stop_reason'],'unit_result':report.get('unit_result'),**report['summary']}),flush=True)
