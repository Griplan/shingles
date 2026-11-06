"""Engineering simulation tests; not clinical ground truth."""
import hashlib,json,copy
from pathlib import Path
import pytest
from shapely.geometry import shape,box,Point,MultiPolygon,mapping
from shapely.ops import unary_union
from app.schemas.evaluate import Identity
from app.services import axilla_provisional_service as service
from app.services.atlas_service import load_dataset
from test_evaluate_api import client
ROOT=Path(__file__).resolve().parents[2]

def identity():
 m=json.loads((service.ATLAS_DIR/'manifest.json').read_text())
 return dict(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=m['regionSetId'],atlas_id=m['atlasId'],atlas_version=m['atlasVersion'],atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256(service.BODY_FILE.read_bytes()).hexdigest(),coordinate_system='normalized_2d_top_left')
def dataset():return load_dataset(Identity(**identity()))
def payload(g,view):
 mp=g if g.geom_type=='MultiPolygon' else MultiPolygon([g])
 coords=[[[dict(x=x,y=y) for x,y in ring] for ring in poly] for poly in mapping(mp)['coordinates']]
 return dict(request_id='SYNTHETIC_PROVISIONAL',annotation_revision=1,identity=identity(),lesions=[dict(id='SYNTHETIC',view=view,geometry=dict(type='MultiPolygon',coordinateSpace='body_template_normalized_v1',coordinates=coords))])

@pytest.mark.parametrize('view',['axilla-left','axilla-right'])
def test_simulation_labels_multi_holes_uncovered_and_identity(client,view):
 d=dataset();rr=[r for r in d.regions if r['view']==view];assert len(rr)==2
 assert {r['labelId'] for r in rr}=={'T1','T2'}
 for r in rr:
  assert d.bodies[view].covers(r['shape']) and r['shape'].is_valid
  p=r['shape'].representative_point();g=p.buffer(.0005)
  response=client.post('/api/v1/evaluate',json=payload(g,view));assert response.status_code==200,response.text
  out=response.json();assert out['source']['atlas_status']=='PROVISIONAL'
  assert {c['label'] for c in out['views'][0]['candidates']}=={r['labelId']}
  assert out['views'][0]['candidates'][0]['region_ids']==[r['id']]
 # Multi-component patch with genuine interior hole, both labels.
 parts=[]
 for r in rr:
  p=r['shape'].representative_point();parts.append(p.buffer(.001).difference(p.buffer(.0003)))
 request=payload(unary_union(parts),view);out=client.post('/api/v1/evaluate',json=request).json()
 assert len(out['views'][0]['candidates'])==2
 assert abs(out['views'][0]['covered_ratio']-1)<1e-8
 # Marking same shape twice must not double union area.
 request['lesions'].append({**request['lesions'][0],'id':'SYNTHETIC_DUPLICATE'})
 both=client.post('/api/v1/evaluate',json=request).json()
 assert both['views'][0]['annotation_area']==pytest.approx(out['views'][0]['annotation_area'])
 p=Point(.55 if view.endswith('right') else .45,.60)
 response=client.post('/api/v1/evaluate',json=payload(p.buffer(.003),view));assert response.status_code==200,response.text
 assert response.json()['views'][0]['uncovered_ratio']==pytest.approx(1)
 q=payload(parts[0],view);q['identity']['atlas_version']='stale'
 assert client.post('/api/v1/evaluate',json=q).json()['error']['code']=='VERSION_MISMATCH'

@pytest.mark.parametrize('view',['axilla-left','axilla-right'])
def test_cross_region_and_exact_boundary_contact(client,view):
 rr=[r for r in dataset().regions if r['view']==view]
 assert rr[0]['shape'].intersection(rr[1]['shape']).area<1e-12
 shared=rr[0]['shape'].boundary.intersection(rr[1]['shape'].boundary)
 assert not shared.is_empty
 # Whole region touches its neighbour but has no area in it.
 out=client.post('/api/v1/evaluate',json=payload(rr[0]['shape'],view));assert out.status_code==200,out.text
 assert len(out.json()['views'][0]['candidates'])==1
 p=shared.interpolate(.5,normalized=True);g=p.buffer(.002)
 out=client.post('/api/v1/evaluate',json=payload(g,view));assert out.status_code==200,out.text
 assert {c['label'] for c in out.json()['views'][0]['candidates']}=={'T1','T2'}

def test_original_blocked_identity_still_unready(client):
 from test_axilla import request
 r=client.post('/api/v1/evaluate',json=request().model_dump(mode='json'))
 assert r.status_code==409 and r.json()['error']['code']=='ATLAS_NOT_READY'

def test_release_and_unknown_deny(client,monkeypatch):
 for env in ['production','unknown']:
  monkeypatch.setenv('DERMATOME_ENV',env)
  response=client.post('/api/v1/evaluate',json=payload(Point(.5,.3).buffer(.001),'axilla-right'))
  assert response.status_code==403

def test_provenance_transform_and_source_hashes(client):
 # No extra dependency needed in service: source identity checked offline here.
 import xml.etree.ElementTree as ET
 m=json.loads((service.ATLAS_DIR/'registration.json').read_text())
 blob=(ROOT/'docs/research/v3-atlas/goran-front.original.svg').read_bytes()
 assert hashlib.sha1(blob).hexdigest()=='d20be473843591779be22c102e193d8c1407861d'
 root=ET.fromstring(blob)
 for r in dataset().regions:
  e=root
  for i in r['sourcePathId'].split('/')[1:]:e=list(e)[int(i)]
  assert hashlib.sha256(e.get('d').encode()).hexdigest()==r['sourcePathSHA256']
  assert r['derivationClass']=='B' and r['uncertaintyLevel']=='HIGH'
  service.validate_source_region(r,m)
  bad={**r,'geometry':mapping(r['shape'].buffer(.01))}
  with pytest.raises(ValueError):service.validate_source_region(bad,m)
