"""Temporary deployment guard; can stop only the newly added B units."""
import json,pathlib,subprocess,time,urllib.request
root=pathlib.Path('/srv/dermatome-mapper/logs/p4-20261101')
base=json.loads((root/'initial-state.json').read_text())
def show():
    raw=subprocess.check_output(['systemctl','show','acupuncture','-p','MainPID','-p','NRestarts','-p','ActiveEnterTimestamp'],text=True)
    return dict(x.split('=',1) for x in raw.splitlines())
startvm=base['vm']
with (root/'deployment-watch.jsonl').open('a',buffering=1) as out:
    while True:
        r={'time':time.time()};bad=[]
        try:
            state=show()
            if any(state[k]!=base['a'][k] for k in state):bad.append('A_identity_changed')
            for path in ['health','ready']:
                with urllib.request.urlopen('http://127.0.0.1:8000/'+path,timeout=3) as f:
                    r[path]=f.status
                    if f.status!=200:bad.append('A_'+path)
            vm={x.split()[0]:int(x.split()[1]) for x in pathlib.Path('/proc/vmstat').read_text().splitlines() if x.split()[0] in startvm}
            r['vm']=vm
            r['swap_out_pages_since_start']=vm['pswpout']-startvm['pswpout']
            if vm['oom_kill']>startvm['oom_kill'] or vm['pswpin']>startvm['pswpin'] or vm['pswpout']-startvm['pswpout']>256:bad.append('swap_pressure_or_OOM')
            mem={x.split(':')[0]:int(x.split()[1])*1024 for x in pathlib.Path('/proc/meminfo').read_text().splitlines()}
            r['available']=mem['MemAvailable']
            r['swap_used']=mem['SwapTotal']-mem['SwapFree']
            if r['available']<1024**3:bad.append('low_available_memory')
            if r['swap_used']>1024*1024:bad.append('swap_allocation_over_1MiB')
            pressure=pathlib.Path('/proc/pressure/memory').read_text().splitlines()[0]
            if float(pressure.split('avg10=')[1].split()[0])>.5:bad.append('sustained_memory_pressure')
            c=pathlib.Path('/sys/fs/cgroup/system.slice/dermatome.service')
            if c.exists():
                r['b_memory']=int((c/'memory.current').read_text());r['b_peak']=int((c/'memory.peak').read_text())
                if r['b_memory']>int((c/'memory.max').read_text())*.90:bad.append('B_near_memory_limit')
        except Exception as e:bad.append(type(e).__name__)
        r['stop_reasons']=bad;out.write(json.dumps(r)+'\n')
        if bad:
            subprocess.run(['systemctl','stop','dermatome.service','dermatome-deploy-install.service'],check=False)
            raise SystemExit(1)
        time.sleep(2)
