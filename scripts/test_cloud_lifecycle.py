"""Exercise only dermatome.service. Original A is observed, never controlled."""
import json,subprocess,time,hashlib,sys
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/validation-records/tencent-deployment-20261101'
key=json.loads((ROOT/'private-data/cloud-access.json').read_text())['access_key']
state=json.loads((ROOT/'private-data/cloud-stop-session.json').read_text())
h={'x-test-access-key':key,'x-ai-session-key':state['session']['session_token']};base='http://127.0.0.1:18001/api/v1';prefix='/ai/sessions/'+state['session']['session_id']
ssh=['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ControlMaster=no','-o','ControlPath=none','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','acupuncture-server']
def remote(command):return subprocess.check_output(ssh+[command],text=True,timeout=70)
def snapshot(name):
 r=json.loads(remote('python3 /srv/dermatome-mapper/deployment/snapshot.py'));(OUT/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n');return r
def original_ok(r,baseline):
 assert all(r[n]['status']==200 for n in ['health','ready','https_health','https_ready'])
 assert all(r['a'][k]==baseline['a'][k] for k in ['MainPID','NRestarts','ActiveEnterTimestamp'])
 assert r['hashes']==baseline['hashes']
def req(method,path,**kwargs):return httpx.request(method,base+path,headers=h,timeout=60,trust_env=False,**kwargs)
def wait_ready():
 for _ in range(30):
  try:
   r=req('GET','/ready')
   if r.status_code==200:return r.json()
  except httpx.HTTPError:pass
  time.sleep(.3)
 raise AssertionError('B not ready after start')
report={}
if '--resume-after-stop' in sys.argv:
 initial=json.loads((OUT/'before-stop.json').read_text());stopped=json.loads((OUT/'stopped-state.json').read_text())
else:
 initial=snapshot('before-stop');original_ok(initial,initial)
 remote('sudo -n systemctl stop dermatome.service')
 stopped=snapshot('stopped-state')
original_ok(stopped,initial)
assert stopped['b']['MainPID']=='0' and stopped['b']['ActiveState']=='inactive'
assert ':8001' not in stopped['ports']
try:
 stopped_response=req('GET','/health')
 assert stopped_response.status_code in (502,503,504),stopped_response.status_code
 report['stopped_request']={'http_status':stopped_response.status_code,'meaning':'SSH/local transport reports unavailable; not a B success response'}
except httpx.HTTPError:report['stopped_request']='connection failure; frontend preserves annotation and shows unavailable'
# Only inspect the private public-test session's files; never list other user sessions.
sid=state['session']['session_id'];assert len(sid)==32 and all(c in '0123456789abcdef' for c in sid)
script="import pathlib,json; p=pathlib.Path('/srv/dermatome-mapper/runtime/uploads/v5-ai-sessions')/'"+sid+"'; s=json.loads((p/'session.json').read_text()); print(json.dumps({'retained':p.is_dir(),'expires_at':s['expires_at'],'confirmed':bool(s['confirmed'])}))"
report['stopped_session']=json.loads(remote("sudo -n python3 -c "+__import__('shlex').quote(script)))
remote('sudo -n systemctl start dermatome.service');report['ready_before_reload']=wait_ready();assert report['ready_before_reload']['ai_model_loaded'] is False
mask=req('GET',prefix+'/assets/'+state['confirmed']['mask_asset'],params={'result_id':state['result']['result_id']});assert mask.status_code==200
assert hashlib.sha256(mask.content).hexdigest()==state['confirmed']['mask_sha256'];report['unexpired_mask_retained']=True
for action,revision in [('start',2),('restart',3)]:
 if action=='restart':remote('sudo -n systemctl restart dermatome.service');wait_ready()
 start=time.perf_counter();r=req('POST',prefix+'/segment',json={**state['payload'],'prompt_revision':revision,'request_id':'after-'+action})
 assert r.status_code==200,(action,r.status_code)
 report[action]={'real_inference':True,'seconds':time.perf_counter()-start,'candidates':len(r.json()['candidates'])}
 ready=wait_ready();assert ready['ai_model_loaded']
 report[action]['model_loaded']=True
report['cleanup_status']=req('DELETE',prefix).status_code;assert report['cleanup_status']==204
assert req('GET',prefix+'/assets/photo.png').status_code==410
final=snapshot('after-restart');original_ok(final,initial)
report['before_cgroup_bytes']=int(initial['b']['MemoryCurrent']);report['before_rss']=initial['b_process']['VmRSS'];report['stopped_pid']=0
report['available_before']=initial['memory'];report['available_after_stop']=stopped['memory']
report['a_unchanged']=True;report['protected_hashes_equal']=True;report['status']='PASSED'
(OUT/'lifecycle-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'status':'PASSED','before_cgroup_MiB':report['before_cgroup_bytes']/1024**2,'mask_retained':True,'start_and_restart_inference':True,'original_unchanged':True}))
