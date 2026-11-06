"""Real HTTP authorization checks through an admin SSH tunnel, not phone/HTTPS QA."""
from pathlib import Path
import io,json,time,hashlib,subprocess,os
import httpx
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];out=ROOT/os.getenv('DERMATOME_EVIDENCE','docs/validation-records/p4-wechat-trial-20261101')
origin=os.getenv('DERMATOME_TEST_BASE','http://127.0.0.1:18001')
assert origin in ('http://127.0.0.1:18001','http://212.64.26.206/dermatome-test')
base=origin+'/api/v1';checks={}
def call(name,method,path,status,**kw):
    time.sleep(.15) # Respect the actual public per-IP ingress budget.
    r=httpx.request(method,base+path,timeout=15,trust_env=False,**kw);checks[name]={'actual':r.status_code,'expected':status}
    assert r.status_code==status,(name,r.status_code);return r
invites=json.loads((ROOT/os.getenv('DERMATOME_INVITATIONS','private-data/p4-security-invitations.json')).read_text())
sessions=[]
for i,invite in enumerate(invites):
    data=call('exchange_'+str(i),'POST','/access/exchange',200,json={'invitation':invite['invitation']}).json()
    sessions.append({'authorization':'Bearer '+data['access_token']})
    call('replay_'+str(i),'POST','/access/exchange',401,json={'invitation':invite['invitation']})
a,b=sessions
call('anonymous_cannot_spoof_trial','POST','/evaluate',401,json={'envVersion':'trial'})
call('authorized_ready','GET','/ready',200,headers=a)
s=call('photo_session','POST','/ai/sessions',200,headers=a,json={}).json();prefix='/ai/sessions/'+s['session_id']
ah={**a,'x-ai-session-key':s['session_token']};bh={**b,'x-ai-session-key':s['session_token']}
blob=io.BytesIO();Image.new('RGB',(32,24),(180,130,110)).save(blob,'PNG')
photo=call('synthetic_upload','POST',prefix+'/photo',200,headers=ah,files={'file':('synthetic.png',blob.getvalue())}).json()
call('foreign_read_even_with_photo_capability','GET',prefix+'/assets/photo.png',410,headers=bh)
call('foreign_delete','DELETE',prefix,410,headers=bh)
call('foreign_upload','POST',prefix+'/photo',410,headers=bh,files={'file':('synthetic.png',blob.getvalue())})
call('anonymous_with_photo_key','GET',prefix+'/assets/photo.png',401,headers={'x-ai-session-key':s['session_token']})
payload={'photo_id':photo['photo_id'],'request_id':'owner-check','prompt_revision':1,'prompts':{'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':.1,'yMin':.1,'xMax':.9,'yMax':.9}}}
call('foreign_segment','POST',prefix+'/segment',410,headers=bh,json=payload)
confirm={'photo_id':photo['photo_id'],'result_id':'not-a-real-result','candidate_id':'candidate-0','prompt_revision':1,'edit_revision':0}
call('foreign_confirm','POST',prefix+'/confirm',410,headers=bh,json=confirm)
call('foreign_edit','POST',prefix+'/edit',410,headers=bh,json={**confirm,'edit_revision':1,'coordinate_space':'photo_oriented_normalized_v1','strokes':[]})
call('owner_photo_unchanged','GET',prefix+'/assets/photo.png',200,headers=ah)
call('owner_delete','DELETE',prefix,204,headers=ah)
call('deleted_photo_gone','GET',prefix+'/assets/photo.png',410,headers=ah)
# Expire ONLY this disposable access session as an administrator; no server clock change.
digest=hashlib.sha256(a['authorization'][7:].encode()).hexdigest()
script="from app.services.trial_access import TrialAccess\nimport time\na=TrialAccess()\nwith a.transaction() as state: state['sessions']['"+digest+"']['expires_at']=time.time()-1\n"
ssh=['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','acupuncture-server',
 'sudo -n -u dermatome env AI_TEMP_ROOT=/srv/dermatome-mapper/runtime/uploads PYTHONPATH=/srv/dermatome-mapper:/srv/dermatome-mapper/backend /srv/dermatome-mapper/.venv/bin/python -']
subprocess.run(ssh,input=script,text=True,check=True,timeout=15,capture_output=True)
call('operator_expired_own_disposable_access','GET','/ready',401,headers=a)
call('revoke_other_own_test_access','DELETE','/access/session',204,headers=b)
call('revoked_access_denied','GET','/ready',401,headers=b)
report={'status':'PASSED','kind':'real cloud HTTP, not HTTPS/phone','endpoint':origin,'checks':checks,'image':'synthetic 32x24 PNG','expiry_test':'operator set ONLY own disposable token expiry into past; no clock or service configuration change'}
(out/'cloud-access-security.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'PASSED','checks':len(checks),'temporary_photo_deleted':True,'test_accesses_invalidated':True}))
