"""Public HTTP verification using synthetic geometry; no secrets or photos logged."""
import json,hashlib,copy,time
from pathlib import Path
import httpx
from shapely.geometry import shape,MultiPolygon,Point,mapping
ROOT=Path.cwd();OUT=ROOT/'docs/validation-records/v6.6-axilla/backend-sync';base='http://212.64.26.206/dermatome-test'
rows=[];headers={}
def check(client,name,method,path,status=200,**kw):
 t=time.perf_counter();r=client.request(method,path,**kw);row=dict(name=name,status=r.status_code,expected=status,ms=round((time.perf_counter()-t)*1000,2));rows.append(row)
 if r.status_code!=status:row['error']=r.json().get('error');raise AssertionError(row)
 return r
cases=json.loads((ROOT/'docs/validation-records/v6.6-axilla/provisional-matching/evidence/real-api-examples.json').read_text())
def identity(folder,body):
 m=json.loads((ROOT/'data/atlas'/folder/'manifest.json').read_text());b=(ROOT/'data/body'/body).read_bytes()
 return dict(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=m['regionSetId'],atlas_id=m['atlasId'],atlas_version=m['atlasVersion'],atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256(b).hexdigest(),coordinate_system='normalized_2d_top_left')
def polygon_request(geom,view,ident):
 mp=geom if geom.geom_type=='MultiPolygon' else MultiPolygon([geom]);coords=[[[dict(x=x,y=y) for x,y in ring] for ring in poly] for poly in mapping(mp)['coordinates']]
 return dict(request_id='cloud-v662-synthetic',annotation_revision=1,identity=ident,lesions=[dict(id='synthetic',view=view,geometry=dict(type='MultiPolygon',coordinateSpace='body_template_normalized_v1',coordinates=coords))])
with httpx.Client(base_url=base,trust_env=False,timeout=30) as c:
 try:
  check(c,'health','GET','/api/v1/health')
  check(c,'anonymous_match_rejected','POST','/api/v1/evaluate',401,json=cases[0]['request'])
  token=check(c,'bounded_test_session','POST','/api/v1/access/session',json={}).json()['access_token'];headers={'authorization':'Bearer '+token}
  ready=check(c,'authenticated_ready','GET','/api/v1/ready',headers=headers).json();assert ready['identity']['atlas_version']=='goran-2022-commons-template4-preview.3'
  for ex in cases:
   r=check(c,'axilla_'+ex['request']['lesions'][0]['view'],'POST','/api/v1/evaluate',json=ex['request'],headers=headers).json()
   assert r==ex['response'];rows[-1]['labels']=[x['label'] for x in r['views'][0]['candidates']];rows[-1]['atlas_status']=r['source']['atlas_status']
  for side in ['left','right']:
   view='axilla-'+side;regs=json.loads((ROOT/'data/atlas/axilla-goran-provisional-v1'/(view+'.json')).read_text())['regions'];ident=cases[0]['request']['identity']
   for reg in regs:
    p=shape(reg['geometry']).representative_point();q=polygon_request(p.buffer(.0005),view,ident)
    r=check(c,view+'-'+reg['labelId'],'POST','/api/v1/evaluate',headers=headers,json=q).json();assert [x['label'] for x in r['views'][0]['candidates']]==[reg['labelId']]
   q=polygon_request(Point(.55 if side=='right' else .45,.60).buffer(.003),view,ident)
   r=check(c,view+'-uncovered','POST','/api/v1/evaluate',headers=headers,json=q).json();assert r['views'][0]['candidates']==[] and r['views'][0]['uncovered_ratio']>.999999
   q['identity']=identity('axilla-v1','axilla-v1.json');r=check(c,view+'-old-atlas-blocked','POST','/api/v1/evaluate',409,headers=headers,json=q).json();assert r['error']['code']=='ATLAS_NOT_READY'
  hand=json.loads((ROOT/'docs/validation-records/v6.5-main-body-hand/evidence/hand-matching-examples.json').read_text())
  for ex in hand:
   r=check(c,ex['name'],'POST','/api/v1/evaluate',headers=headers,json=ex['request']).json();assert r==ex['response']
  si=identity('sole-v1','sole-v1.json')
  for view,x,label in [('sole-left',.35,'L5'),('sole-right',.65,'L5')]:
   r=check(c,view,'POST','/api/v1/evaluate',headers=headers,json=polygon_request(Point(x,.21).buffer(.002),view,si)).json();assert [m['label'] for m in r['views'][0]['candidates']]==[label]
  q=copy.deepcopy(cases[0]['request']);q['identity']['atlas_version']='old';r=check(c,'stale_version_rejected','POST','/api/v1/evaluate',409,headers=headers,json=q).json();assert r['error']['code']=='VERSION_MISMATCH'
 finally:
  if headers:check(c,'test_session_revoked','DELETE','/api/v1/access/session',204,headers=headers)
  (OUT/'smoke.json').write_text(json.dumps(dict(endpoint=base,checks=rows,realPhone='NOT_RUN',input='synthetic geometry only'),ensure_ascii=False,indent=2))
print('PASSED',len(rows),'public HTTP checks; no credential logged')
