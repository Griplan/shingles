"""Real HTTP regression on synthetic geometry; no image or secret logging."""
import json,hashlib,time,copy
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
examples=json.loads((ROOT/'docs/validation-records/v6.5-main-body-hand/evidence/hand-matching-examples.json').read_text())
sm=json.loads((ROOT/'data/atlas/sole-v1/manifest.json').read_text());bb=(ROOT/'data/body/sole-v1.json').read_bytes()
si=dict(template_id=sm['templateId'],template_version=sm['templateVersion'],geometry_id=sm['geometryId'],region_set_id=sm['regionSetId'],atlas_id=sm['atlasId'],atlas_version=sm['atlasVersion'],atlas_content_sha256=sm['contentSHA256'],body_content_sha256=hashlib.sha256(bb).hexdigest(),coordinate_system='normalized_2d_top_left')
results=[]
for base in ['http://127.0.0.1:8000','http://212.64.26.206/dermatome-test']:
 client=httpx.Client(base_url=base,trust_env=False,timeout=20);headers={};report={'endpoint':base,'checks':[]}
 def check(name,method,path,expected,**kw):
  t=time.perf_counter();r=client.request(method,path,**kw);report['checks'].append({'name':name,'status':r.status_code,'expected':expected,'elapsed_ms':round((time.perf_counter()-t)*1000,2)})
  assert r.status_code==expected,(name,r.status_code,r.text[:200]);return r
 try:
  check('health','GET','/api/v1/health',200)
  if '212.64.' in base:
   check('anonymous_ready_rejected','GET','/api/v1/ready',401)
   check('anonymous_match_rejected','POST','/api/v1/evaluate',401,json={})
   r=check('bounded_test_session','POST','/api/v1/access/session',200,json={});headers={'authorization':'Bearer '+r.json()['access_token']}
  r=check('ready_current_identity','GET','/api/v1/ready',200,headers=headers);assert r.json()['identity']==examples[0]['request']['identity'];report['identity']=r.json()['identity']
  for ex in examples:
   q=ex['request'];r=check(ex['name'],'POST','/api/v1/evaluate',200,headers=headers,json=q);data=r.json();assert data==ex['response'],ex['name']
  for view,xy,label in [('sole-left',(.35,.21),'L5'),('sole-left',(.55,.65),'S1'),('sole-right',(.65,.21),'L5'),('sole-right',(.45,.65),'S1')]:
   x,y=xy;q={'request_id':'version-sole-smoke','annotation_revision':1,'identity':si,'lesions':[{'id':'synthetic-sole','view':view,'vertices':[{'x':x-.005,'y':y-.005},{'x':x+.005,'y':y-.005},{'x':x+.005,'y':y+.005},{'x':x-.005,'y':y+.005}]}]}
   r=check(view+'-'+label,'POST','/api/v1/evaluate',200,headers=headers,json=q);assert [c['label'] for c in r.json()['lesions'][0]['candidates']]==[label]
  q=copy.deepcopy(examples[0]['request']);q['identity']['atlas_version']='goran-2022-commons-template4-preview.2';r=check('old_version_still_rejected','POST','/api/v1/evaluate',409,headers=headers,json=q);assert r.json()['error']['code']=='VERSION_MISMATCH'
  q=copy.deepcopy(examples[0]['request']);q['lesions'][0]['view']='palm-left';r=check('retired_palm_rejected','POST','/api/v1/evaluate',410,headers=headers,json=q);assert r.json()['error']['code']=='VIEW_RETIRED'
 finally:
  if headers:check('test_session_revoked','DELETE','/api/v1/access/session',204,headers=headers)
  client.close();results.append(report)
  (OUT/'smoke.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'status':'PASSED','endpoints':len(results),'checks':sum(len(r['checks']) for r in results),'real_phone':'NOT_RUN'}))
