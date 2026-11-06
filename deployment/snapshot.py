"""Read-only deployment evidence: no secrets, patient paths or request bodies."""
import subprocess,json,pathlib,hashlib,urllib.request,time

def cmd(*args):return subprocess.run(args,capture_output=True,text=True,timeout=15).stdout.strip()
def props(unit):
    return dict(x.split('=',1) for x in cmd('systemctl','show',unit,'-p','MainPID','-p','NRestarts','-p','ActiveState','-p','ActiveEnterTimestamp','-p','MemoryCurrent','-p','CPUUsageNSec','-p','ControlGroup').splitlines() if '=' in x)
files=[pathlib.Path('/etc/systemd/system/acupuncture.service'),pathlib.Path('/etc/nginx/nginx.conf'),*pathlib.Path('/etc/nginx/sites-enabled').glob('*'),pathlib.Path('/srv/acupuncture/backend/main.py'),pathlib.Path('/srv/acupuncture/.venv/pyvenv.cfg')]
r={'time':cmd('date','-Is'),'a':props('acupuncture'),'nginx':props('nginx'),'b':props('dermatome'),'memory':cmd('free','-b'),'disk':cmd('df','-B1','/srv'),'ports':cmd('ss','-lnt'),'vm':{x.split()[0]:int(x.split()[1]) for x in pathlib.Path('/proc/vmstat').read_text().splitlines() if x.split()[0] in ['pswpin','pswpout','oom_kill']},'hashes':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
for name,url in [('health','http://127.0.0.1:8000/health'),('ready','http://127.0.0.1:8000/ready'),('https_health','https://acupuncture.yandunshuati.online/health'),('https_ready','https://acupuncture.yandunshuati.online/ready')]:
    start=time.perf_counter()
    try:
        with urllib.request.urlopen(url,timeout=8) as f:r[name]={'status':f.status,'body':json.loads(f.read()),'ms':1000*(time.perf_counter()-start)}
    except Exception as e:r[name]={'error':type(e).__name__}
pid=r['b'].get('MainPID','0')
if pid!='0':
    r['b_process']={line.split(':')[0]:line.split(':')[1].strip() for line in pathlib.Path('/proc',pid,'status').read_text().splitlines() if line.startswith(('VmRSS:','VmHWM:','Threads:'))}
    group=pathlib.Path('/sys/fs/cgroup'+r['b']['ControlGroup'])
    r['b_limits']={f:(group/f).read_text().strip() for f in ['memory.max','memory.high','memory.current','memory.peak','memory.swap.current','memory.events','cpu.max','cpu.stat']}
print(json.dumps(r))
