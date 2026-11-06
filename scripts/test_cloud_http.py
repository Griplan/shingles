"""Low-load controlled-cloud acceptance. Only the public CDC 21505 fixture is sent.
Credential/session capabilities remain under ignored private-data, never in evidence.
Run with ai/.venv/bin/python; an explicit SSH tunnel must already be open.
"""
import io,json,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import httpx
import numpy as np
from PIL import Image
from shapely.geometry import shape
from shapely import contains_xy
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/validation-records/tencent-deployment-20261101/cloud-http';OUT.mkdir(exist_ok=True)
SECRET=ROOT/'private-data/cloud-access.json'
key=json.loads(SECRET.read_text())['access_key'];AUTH={'x-test-access-key':key}
base='http://127.0.0.1:18001/api/v1'
report={'kind':'real cloud API through SSH, not public HTTPS or native UI','checks':{},'sample':'CDC PHIL 21505, public educational fixture','medical_accuracy':'NOT_MEASURED'}
def request(method,path,headers=None,**kwargs):
    return httpx.request(method,base+path,headers=AUTH if headers is None else headers,timeout=60,trust_env=False,**kwargs)
def check(name,r,status):
    report['checks'][name]={'status':r.status_code,'expected':status}
    assert r.status_code==status,(name,r.status_code,r.text[:200])
check('health',request('GET','/health',headers={}),200)
check('authentication',request('GET','/ready',headers={}),401)
check('ready',request('GET','/ready'),200)
report['identity']=request('GET','/ready').json()['identity']
for name in ['/docs','/redoc','/openapi.json']:
    r=httpx.get('http://127.0.0.1:18001'+name,headers=AUTH,trust_env=False);check('private'+name,r,404)
check('cors',request('POST','/ai/sessions',headers={**AUTH,'origin':'https://untrusted.invalid'}),403)
s=request('POST','/ai/sessions',json={}).json();sid=s['session_id'];prefix='/ai/sessions/'+sid;h={**AUTH,'x-ai-session-key':s['session_token']}
check('corrupt_image',request('POST',prefix+'/photo',headers=h,files={'file':('bad.jpg',b'garbage','image/jpeg')}),422)
f=io.BytesIO();Image.new('RGB',(2000,1600)).save(f,'PNG')
check('pixel_limit',request('POST',prefix+'/photo',headers=h,files={'file':('large.png',f.getvalue())}),422)
check('request_limit',request('POST',prefix+'/photo',headers=h,content=b'x'*(10*1024*1024+65537)),413)
f=io.BytesIO();im=Image.new('RGB',(32,24));ex=im.getexif();ex[274]=6;im.save(f,'JPEG',exif=ex)
r=request('POST',prefix+'/photo',headers=h,files={'file':('exif.jpg',f.getvalue())});check('exif',r,200);assert (r.json()['image']['width'],r.json()['image']['height'])==(24,32)
check('delete_exif',request('DELETE',prefix,headers=h),204)
s=request('POST','/ai/sessions',json={}).json();sid=s['session_id'];prefix='/ai/sessions/'+sid;h={**AUTH,'x-ai-session-key':s['session_token']}
r=request('POST',prefix+'/photo',headers=h,files={'file':('public-CDC21505.jpg',(ROOT/'ai/experiments/inputs/cdc-21505.jpg').read_bytes())});check('public_upload',r,200);photo=r.json()
payload={'photo_id':photo['photo_id'],'request_id':'cloud-acceptance','prompt_revision':1,'strategy':'context_crop','prompts':{'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':215/700,'yMin':245/460,'xMax':495/700,'yMax':385/460}}}
with ThreadPoolExecutor(2) as executor:
    start=time.perf_counter();first=executor.submit(request,'POST',prefix+'/segment',headers=h,json=payload)
    time.sleep(.3);busy=request('POST',prefix+'/segment',headers=h,json={**payload,'request_id':'busy-check'})
    check('single_inference',busy,429)
    r=first.result();elapsed=time.perf_counter()-start
check('inference',r,200);result=r.json();report['inference_seconds']=elapsed
report['candidates']=result['candidates'];ok=next(c for c in result['candidates'] if c['status']=='ok')
confirmed=request('POST',prefix+'/confirm',headers=h,json={'photo_id':photo['photo_id'],'result_id':result['result_id'],'candidate_id':ok['candidate_id'],'prompt_revision':1,'edit_revision':0});check('confirm',confirmed,200);confirm=confirmed.json()
assert confirm['confirmed_by_user'] and confirm['coordinate_space']=='photo_oriented_normalized_v1'
mask=request('GET',prefix+'/assets/'+confirm['mask_asset'],headers=h,params={'result_id':result['result_id']});check('mask',mask,200)
Image.open(io.BytesIO(mask.content)).save(OUT/'mask.png')
alpha=request('GET',prefix+'/assets/'+ok['candidate_id']+'-alpha.png',headers=h,params={'result_id':result['result_id']});check('alpha',alpha,200);(OUT/'alpha.png').write_bytes(alpha.content)
photo_image=request('GET',prefix+'/assets/photo.png',headers=h);check('photo',photo_image,200)
original=Image.open(io.BytesIO(photo_image.content)).convert('RGBA');original.save(OUT/'public-original.png');Image.alpha_composite(original,Image.open(io.BytesIO(alpha.content)).convert('RGBA')).convert('RGB').save(OUT/'overlay.jpg')
binary=np.array(Image.open(io.BytesIO(mask.content)))==255;height,width=binary.shape
g=shape(confirm['geometry']);assert g.is_valid
xx,yy=np.meshgrid((np.arange(width)+.5)/width,(np.arange(height)+.5)/height)
assert np.array_equal(contains_xy(g,xx,yy),binary),'Independent mask/polygon pixel-center mismatch'
report['mask_polygon']={'equal':True,'width':width,'height':height,'polygons':len(confirm['geometry']['coordinates']),'holes':sum(len(p)-1 for p in confirm['geometry']['coordinates'])}
report['model']=confirm['model'];assert report['model']['threads']==1 and report['model']['device']=='cpu'
check('foreign_session',request('GET',prefix+'/assets/photo.png',headers={**AUTH,'x-ai-session-key':'foreign'}),410)
# Retain just this disposable, unexpired public fixture for the stop/start test.
private=ROOT/'private-data/cloud-stop-session.json';private.write_text(json.dumps({'session':s,'photo':photo,'result':result,'confirmed':confirm,'payload':payload}));private.chmod(0o600)
report['ready_after']=request('GET','/ready').json()
(OUT/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'status':'PASSED','checks':len(report['checks']),'inference_seconds':elapsed,'model_threads':report['model']['threads'],'mask_polygon_equal':True}))
