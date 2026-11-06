"""Restart only B and verify invited access + oriented public photo survive."""
import json,hashlib,time,subprocess
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'docs/validation-records/p4-wechat-trial-20261101';base='http://127.0.0.1:18001/api/v1'
ssh=['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','acupuncture-server']
def remote(cmd):return subprocess.check_output(ssh+[cmd],text=True,timeout=70)
def snap(name):
    r=json.loads(remote('python3 /srv/dermatome-mapper/deployment/snapshot.py'));(out/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n');return r
def a_ok(r,old):
    assert all(r[n]['status']==200 for n in ['health','ready','https_health','https_ready'])
    assert r['hashes']==old['hashes']
    assert all(r['a'][k]==old['a'][k] for k in ['MainPID','NRestarts','ActiveEnterTimestamp'])
code=json.loads((ROOT/'private-data/p4-restart-invitation.json').read_text())['invitation']
r=httpx.post(base+'/access/exchange',json={'invitation':code},timeout=15,trust_env=False);assert r.status_code==200
h={'authorization':'Bearer '+r.json()['access_token']}
def call(method,path,**kw):return httpx.request(method,base+path,headers=h,timeout=60,trust_env=False,**kw)
s=call('POST','/ai/sessions',json={}).json();prefix='/ai/sessions/'+s['session_id'];h['x-ai-session-key']=s['session_token']
p=call('POST',prefix+'/photo',files={'file':('CDC21505.jpg',(ROOT/'ai/experiments/inputs/cdc-21505.jpg').read_bytes())});assert p.status_code==200
before_bytes=call('GET',prefix+'/assets/photo.png').content
initial=snap('before-trial-stop');remote('sudo -n systemctl stop dermatome.service')
stopped=snap('trial-stopped');a_ok(stopped,initial);assert stopped['b']['MainPID']=='0' and ':8001' not in stopped['ports']
report={}
try:
    unavailable=call('GET','/health');assert unavailable.status_code in [502,503,504];report['stopped_response']=unavailable.status_code
except httpx.HTTPError:report['stopped_response']='connection failure'
remote('sudo -n systemctl start dermatome.service')
for i in range(30):
    try:
        ready=call('GET','/ready')
        if ready.status_code==200:break
    except httpx.HTTPError:pass
    if i==29:raise AssertionError('B did not recover')
    time.sleep(.3)
assert call('GET',prefix+'/assets/photo.png').content==before_bytes
report['bearer_and_photo_survive_restart']=True
payload={'photo_id':p.json()['photo_id'],'request_id':'p4-after-restart','prompt_revision':1,'prompts':{'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':215/700,'yMin':245/460,'xMax':495/700,'yMax':385/460}}}
start=time.perf_counter();seg=call('POST',prefix+'/segment',json=payload);assert seg.status_code==200
report['real_inference_seconds']=time.perf_counter()-start;report['real_candidates']=len(seg.json()['candidates'])
assert call('DELETE',prefix).status_code==204;assert call('GET',prefix+'/assets/photo.png').status_code==410
assert call('DELETE','/access/session').status_code==204;assert call('GET','/ready').status_code==401
final=snap('after-trial-restart');a_ok(final,initial)
report.update(status='PASSED',original_a_unchanged=True,temporary_photo_deleted=True,access_revoked=True,kind='real cloud loopback via SSH; not phone or HTTPS')
(out/'trial-restart-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
