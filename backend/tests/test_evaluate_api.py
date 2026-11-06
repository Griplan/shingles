import hashlib,json
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import box
from app.main import app,MAX_REQUEST_BYTES
from app.services import atlas_service as service
from app.services.atlas_service import load_dataset
from app.schemas.evaluate import Identity

@pytest.fixture
def client(monkeypatch):
 monkeypatch.setenv('DERMATOME_ENV','test');monkeypatch.setenv('ENABLE_REFERENCE_MATCHING','1')
 with TestClient(app,raise_server_exceptions=False) as c:yield c

def identity():
 m=json.loads((service.ATLAS_DIR/'manifest.json').read_bytes());b=json.loads(service.BODY_FILE.read_bytes())
 return {'template_id':m['templateId'],'template_version':m['templateVersion'],'geometry_id':m['geometryId'],'region_set_id':b['views']['front']['regionSetId'],
 'atlas_id':service.ATLAS_ID,'atlas_version':m['atlasVersion'],'atlas_content_sha256':m['contentSHA256'],
 'body_content_sha256':hashlib.sha256(service.BODY_FILE.read_bytes()).hexdigest(),'coordinate_system':'normalized_2d_top_left'}

def payload(x=.4875,y=.0967,view='front'):
 return {'request_id':'TEST_REQUEST','annotation_revision':1,'identity':identity(),'lesions':[{'id':'TEST_MARK','view':view,'vertices':[{'x':a,'y':b} for a,b in box(x-.001,y-.001,x+.001,y+.001).exterior.coords]}]}

def test_actual_face_and_unconfigured_hair(client):
 r=client.post('/api/v1/evaluate',json=payload()).json()
 assert r['lesions'][0]['candidates'][0]['display_name']=='三叉神经眼支 V1'
 assert r['lesions'][0]['candidates'][0]['side']=='right'
 assert r['source']['medical_review_status']=='pending' and r['source']['preview'] is True
 r=client.post('/api/v1/evaluate',json=payload(.5,.05)).json()
 assert r['lesions'][0]['coverage_status']=='none' and r['lesions'][0]['uncovered_ratio']==1

@pytest.mark.parametrize('field,value,code,status',[
 ('template_id','OLD','VERSION_MISMATCH',409),('template_version','3','VERSION_MISMATCH',409),
 ('atlas_version','old','VERSION_MISMATCH',409),('atlas_id','../../etc/passwd','ATLAS_NOT_FOUND',404),
 ('atlas_content_sha256','0'*64,'VERSION_MISMATCH',409),('body_content_sha256','0'*64,'VERSION_MISMATCH',409)])
def test_identity_conflicts(client,field,value,code,status):
 p=payload();p['identity'][field]=value;r=client.post('/api/v1/evaluate',json=p)
 assert r.status_code==status and r.json()['error']['code']==code

@pytest.mark.parametrize('value',[True,'0.5',None,-.1,1.1])
def test_invalid_coordinates(client,value):
 p=payload();p['lesions'][0]['vertices'][0]['x']=value;r=client.post('/api/v1/evaluate',json=p)
 assert r.status_code==422 and 'vertices' not in r.text

@pytest.mark.parametrize('raw',['NaN','Infinity','-Infinity'])
def test_nonfinite_json(client,raw):
 text=json.dumps(payload()).replace('0.4865',raw,1)
 # Explicitly replace a known field without relying on serialization rounding.
 p=payload();p['lesions'][0]['vertices'][0]['x']='NONFINITE';text=json.dumps(p).replace('"NONFINITE"',raw)
 assert client.post('/api/v1/evaluate',content=text,headers={'content-type':'application/json'}).status_code==422

def test_invalid_duplicate_limits_and_view(client):
 p=payload();p['lesions']*=2;assert client.post('/api/v1/evaluate',json=p).json()['error']['code']=='INVALID_ANNOTATION'
 p=payload();p['lesions'][0]['view']='side';assert client.post('/api/v1/evaluate',json=p).json()['error']['code']=='VIEW_UNSUPPORTED'
 p=payload();p['lesions'][0]['vertices']*=40;assert client.post('/api/v1/evaluate',json=p).status_code==422
 assert client.post('/api/v1/evaluate',content=b'x'*(MAX_REQUEST_BYTES+1)).status_code==413
 assert client.post('/api/v1/evaluate',content='bad json').status_code==422

def test_corruption_not_cached_or_fallback(client,monkeypatch,tmp_path):
 import shutil
 copy=tmp_path/'atlas';shutil.copytree(service.ATLAS_DIR,copy);monkeypatch.setattr(service,'ATLAS_DIR',copy)
 p=payload();assert client.post('/api/v1/evaluate',json=p).status_code==200
 (copy/'front.json').write_text('{}')
 assert client.post('/api/v1/evaluate',json=p).status_code==503
 (copy/'front.json').unlink();assert client.post('/api/v1/evaluate',json=p).status_code==503

@pytest.mark.parametrize('env,flag',[('production','1'),('unknown','1'),('development','0'),('test','')])
def test_server_gate_cannot_be_bypassed(client,monkeypatch,env,flag):
 monkeypatch.setenv('DERMATOME_ENV',env);monkeypatch.setenv('ENABLE_REFERENCE_MATCHING',flag)
 assert client.post('/api/v1/evaluate?debug=true',json=payload()).status_code==403

def test_real_atlas_each_region_smoke_is_geometric_not_clinical(client):
 dataset=load_dataset(Identity(**identity()))
 # These interior points are algorithmically selected for engineering smoke only.
 for region in dataset.regions:
  p=region['shape'].representative_point();small=box(p.x-1e-5,p.y-1e-5,p.x+1e-5,p.y+1e-5)
  if not dataset.bodies[region['view']].covers(small):continue
  data=payload(p.x,p.y,region['view']);data['lesions'][0]['vertices']=[{'x':x,'y':y} for x,y in small.exterior.coords]
  response=client.post('/api/v1/evaluate',json=data)
  assert response.status_code==200,response.text
  assert any(region['id'] in c['region_ids'] for c in response.json()['lesions'][0]['candidates'])

def test_manual_reference_locations(client):
 from pathlib import Path
 points=json.loads((Path(__file__).parent/'fixtures/atlas-matching-reference-points.json').read_text())
 for c in points['cases']:
  r=client.post('/api/v1/evaluate',json=payload(c['x']/400,c['y']/900,c['view']))
  assert r.status_code==200,(c['name'],r.json())
  coverage=r.json()['lesions'][0]
  if c['label'] is None:assert coverage['coverage_status']=='none',c['name']
  else:assert any(m['label']==c['label'] and m['side']==c['side'] for m in coverage['candidates']),(c['name'],coverage['candidates'])

def test_invalid_body_export_and_internal_error(client,monkeypatch,tmp_path):
 source=service.BODY_FILE;broken=tmp_path/'body.json';broken.write_text('{}');monkeypatch.setattr(service,'BODY_FILE',broken)
 monkeypatch.setattr(service,'BODY_FILE',source);p=payload();monkeypatch.setattr(service,'BODY_FILE',broken)
 assert client.post('/api/v1/evaluate',json=p).json()['error']['code']=='ATLAS_UNAVAILABLE'
 monkeypatch.setattr(service,'BODY_FILE',source)
 from app.api.routes import evaluate as route
 def fail(_identity):raise RuntimeError('private geometry must not leak')
 monkeypatch.setattr(route,'load_dataset',fail)
 r=client.post('/api/v1/evaluate',json=p)
 assert r.status_code==500 and r.json()['error']['code']=='INTERNAL_ERROR' and 'private' not in r.text
