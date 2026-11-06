"""Real public-IP test sessions without invitations. Synthetic photo only."""
from pathlib import Path
import json,io,time
import httpx
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/validation-records/p4.2-no-invitation-20261102'
BASE='http://212.64.26.206/dermatome-test/api/v1'
checks={};sessions=[];photo=None

def call(name,method,path,status,**kw):
    time.sleep(.2)
    r=httpx.request(method,BASE+path,trust_env=False,timeout=20,**kw)
    checks[name]={'expected':status,'actual':r.status_code}
    assert r.status_code==status,(name,r.status_code)
    return r
try:
    call('anonymous_health','GET','/health',200)
    call('direct_ready_still_rejected','GET','/ready',401)
    call('direct_evaluate_still_rejected','POST','/evaluate',401,json={})
    call('spoofed_debug_not_identity','POST','/access/session',422,json={'envVersion':'trial','debug':True})
    call('origin_rejected','POST','/access/session',403,headers={'origin':'https://untrusted.invalid'},json={})
    call('session_body_limit','POST','/access/session',413,content=b'x'*4097)
    for i in range(2):
        value=call('automatic_session_'+str(i),'POST','/access/session',200,json={}).json()
        assert value['access_kind']=='public_test' and value['token_type']=='Bearer'
        sessions.append({'authorization':'Bearer '+value['access_token']})
    a,b=sessions;assert a!=b
    call('valid_ready','GET','/ready',200,headers=a)
    photo=call('create_photo','POST','/ai/sessions',200,headers=a,json={}).json()
    prefix='/ai/sessions/'+photo['session_id'];ah={**a,'x-ai-session-key':photo['session_token']};bh={**b,'x-ai-session-key':photo['session_token']}
    call('invalid_file_rejected','POST',prefix+'/photo',422,headers=ah,files={'file':('fake.jpg',b'NOT_IMAGE','image/jpeg')})
    image=io.BytesIO();Image.new('RGB',(2001,1500),(170,130,100)).save(image,'PNG')
    call('over_3mp_rejected','POST',prefix+'/photo',422,headers=ah,files={'file':('synthetic.png',image.getvalue(),'image/png')})
    call('over_10mib_rejected','POST',prefix+'/photo',413,headers=ah,files={'file':('synthetic.png',b'x'*(10*1024*1024+1),'image/png')})
    image=io.BytesIO();Image.new('RGB',(32,24),(170,130,100)).save(image,'PNG')
    call('legal_synthetic_photo','POST',prefix+'/photo',200,headers=ah,files={'file':('synthetic.png',image.getvalue(),'image/png')})
    call('other_guest_read_denied','GET',prefix+'/assets/photo.png',410,headers=bh)
    call('other_guest_delete_denied','DELETE',prefix,410,headers=bh)
    call('owner_read','GET',prefix+'/assets/photo.png',200,headers=ah)
    call('cancel_photo','DELETE',prefix,204,headers=ah);photo=None
    call('deleted_photo_gone','GET',prefix+'/assets/photo.png',410,headers=ah)
    for i,h in enumerate(sessions):
        call('revoke_'+str(i),'DELETE','/access/session',204,headers=h)
        call('revoked_denied_'+str(i),'GET','/ready',401,headers=h)
    sessions=[]
    report={'status':'PASSED','endpoint':BASE,'input':'synthetic images/bytes only','invitations_or_operator_key_used':False,'checks':checks,'phone':'NOT_RUN','isolation_not_identity':'Any internet client can request bounded public-test access. Tokens protect per-photo ownership, not eligibility.'}
    (OUT/'public-test-access.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':'PASSED','checks':len(checks),'invitations_used':0,'test_sessions_revoked':True}))
finally:
    if photo:httpx.delete(BASE+'/ai/sessions/'+photo['session_id'],headers={**sessions[0],'x-ai-session-key':photo['session_token']},trust_env=False,timeout=15)
    for h in sessions:httpx.delete(BASE+'/access/session',headers=h,trust_env=False,timeout=15)
