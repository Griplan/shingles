"""Read-only whitelist: run over existing SSH stdin; no environment or credentials."""
import json, pathlib, subprocess, time, urllib.request, datetime

def command(args):
 p=subprocess.run(args,text=True,capture_output=True,timeout=10);return p.stdout.strip() if p.returncode==0 else {'unavailable':p.returncode}
def read(p):
 try:return pathlib.Path(p).read_text().strip()
 except OSError:return 'UNAVAILABLE'
def health(port,path):
 try:
  t=time.perf_counter()
  with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}',timeout=5) as r:return {'status':r.status,'ms':(time.perf_counter()-t)*1000}
 except Exception as e:return {'error_type':type(e).__name__}
def snapshot():
 out={'monotonic':time.monotonic(),'memory':{},'load':read('/proc/loadavg').split()[:3], 'services':{},'network':{}}
 for line in read('/proc/meminfo').splitlines():
  k,v=line.split(':',1)
  if k in ['MemTotal','MemAvailable','SwapTotal','SwapFree']:out['memory'][k]=v.strip()
 for line in read('/proc/net/dev').splitlines()[2:]:
  name,values=line.split(':');vals=values.split()
  if name.strip()!='lo':out['network'][name.strip()]={'rx_bytes':int(vals[0]),'tx_bytes':int(vals[8])}
 for unit in ['acupuncture.service','dermatome.service','nginx.service']:
  props='MainPID,NRestarts,MemoryCurrent,CPUUsageNSec,CPUQuotaPerSecUSec,MemoryHigh,MemoryMax,MemorySwapMax,ActiveState,ControlGroup,TasksCurrent'
  raw=command(['systemctl','show',unit,'--property='+props]);d=dict(s.split('=',1) for s in raw.splitlines())
  pid=d['MainPID'];cg='/sys/fs/cgroup'+d.pop('ControlGroup');d['process']={}
  for line in read('/proc/'+pid+'/status').splitlines():
   if ':' not in line:continue
   k,v=line.split(':',1)
   if k in ['VmRSS','VmHWM','VmSwap','Threads']:d['process'][k]=v.strip()
  d['children']=read(f'/proc/{pid}/task/{pid}/children').split()
  for k in ['cpu.stat','memory.events','memory.current','memory.peak','memory.pressure','cpu.max']:
   d[k]=read(cg+'/'+k)
  out['services'][unit]=d
 out['a_health']=health(8000,'/health');out['a_ready']=health(8000,'/ready');out['b_health']=health(8001,'/api/v1/health')
 return out
out={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'read-only','cpu':command(['lscpu','-J']),'os':read('/etc/os-release'),'disk':command(['df','-B1','/']),'ports':command(['ss','-lnt']),'samples':[snapshot()]}
time.sleep(3);out['samples'].append(snapshot());print(json.dumps(out,indent=2))
