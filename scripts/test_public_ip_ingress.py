"""Low-load checks for the one authorized public prefix; no patient/admin secrets."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,time,io
import httpx
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/validation-records/p4.1-public-ip-20261102'
BASE='http://212.64.26.206/dermatome-test/api/v1'
checks={}
def call(name,method,path,expected,**kw):
    time.sleep(.22)
    r=httpx.request(method,BASE+path,timeout=15,trust_env=False,**kw)
    checks[name]={'expected':expected,'actual':r.status_code}
    assert r.status_code==expected,(name,r.status_code)
    return r
created=None;auth=None
try:
    call('minimal_public_health','GET','/health',200)
    call('anonymous_evaluate','POST','/evaluate',401,json={})
    call('anonymous_photo_creation','POST','/ai/sessions',401,json={})
    call('synthetic_legacy_header_rejected','GET','/ready',401,headers={'x-test-access-key':'SYNTHETIC_NOT_AN_ADMIN_KEY'})
    call('origin_rejected','GET','/ready',403,headers={'origin':'https://synthetic.example.test'})
    call('exchange_body_bound','POST','/access/exchange',413,content=b'X'*4097)
    invite=json.loads((ROOT/'private-data/p41-extra-invitation.json').read_text())['invitation']
    exchange=call('invitation_exchange','POST','/access/exchange',200,json={'invitation':invite}).json()
    auth={'authorization':'Bearer '+exchange['access_token']}
    ready=call('authenticated_ready','GET','/ready',200,headers=auth).json()
    created=call('session','POST','/ai/sessions',200,headers=auth,json={}).json()
    prefix='/ai/sessions/'+created['session_id'];headers={**auth,'x-ai-session-key':created['session_token']}
    call('non_image_rejected','POST',prefix+'/photo',422,headers=headers,files={'file':('fake.jpg',b'NOT_AN_IMAGE','image/jpeg')})
    buf=io.BytesIO();Image.new('RGB',(2001,1500),(180,130,110)).save(buf,'PNG')
    call('over_3mp_rejected','POST',prefix+'/photo',422,headers=headers,files={'file':('synthetic.png',buf.getvalue(),'image/png')})
    call('backend_upload_size_bound','POST',prefix+'/photo',413,headers=headers,files={'file':('synthetic.bin',b'X'*(10*1024*1024+1),'image/png')})
    call('nginx_body_size_bound','POST',prefix+'/photo',413,headers=headers,content=b'X'*(11*1024*1024+1))
    call('cancel','DELETE',prefix,204,headers=headers);created=None
    call('revoke','DELETE','/access/session',204,headers=auth);auth=None
    time.sleep(3)
    # 20 tiny health GETs at most 4 simultaneous; no inference or pressure test.
    def health(_):return httpx.get(BASE+'/health',timeout=10,trust_env=False).status_code
    with ThreadPoolExecutor(max_workers=4) as pool:codes=list(pool.map(health,range(20)))
    assert 200 in codes and 429 in codes,codes
    checks['public_ingress_rate_limit']={'requests':20,'max_parallel':4,'statuses':{str(s):codes.count(s) for s in set(codes)}}
    report={'status':'PASSED','endpoint':BASE,'transport':'HTTP unencrypted; public/synthetic inputs only','phone':'NOT_RUN','checks':checks,'readiness':ready,'temporary_data_deleted':True,'legacy_header_note':'Synthetic rejection alone does not prove stripping. Deployed Nginx configuration explicitly removes X-Test-Access-Key; real admin key is never sent publicly.'}
    (OUT/'public-ingress-security.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':'PASSED','checks':len(checks),'rate_statuses':checks['public_ingress_rate_limit']['statuses']}))
finally:
    if created:httpx.delete(BASE+'/ai/sessions/'+created['session_id'],headers={**auth,'x-ai-session-key':created['session_token']},timeout=15,trust_env=False)
    if auth:httpx.delete(BASE+'/access/session',headers=auth,timeout=15,trust_env=False)
