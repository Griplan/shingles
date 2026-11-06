"""Artificial partition geometry and API tests. No clinical truth labels."""
import json,hashlib
from pathlib import Path
import pytest
from shapely.geometry import shape,Point,MultiPolygon,box
from shapely.ops import unary_union
from shapely.affinity import scale
from app.services.atlas_service import load_dataset
from app.schemas.evaluate import Identity
from test_evaluate_api import client
from test_axilla_provisional import payload as original_payload
R=Path(__file__).resolve().parents[2];D=R/'data/atlas/axilla-schematic-v1'
def identity():
 m=json.loads((D/'manifest.json').read_text());return dict(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=m['regionSetId'],atlas_id=m['atlasId'],atlas_version=m['atlasVersion'],atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256((R/'data/body/axilla-v1.json').read_bytes()).hexdigest(),coordinate_system='normalized_2d_top_left')
def dataset():return load_dataset(Identity(**identity()))
def payload(g,v):
 p=original_payload(g,v);p['identity']=identity();return p
@pytest.mark.parametrize('view',['axilla-left','axilla-right'])
def test_entire_surface_geometry_grid_and_overlap(client,view):
 d=dataset();skin=d.bodies[view];rr=[r for r in d.regions if r['view']==view];union=unary_union([r['shape'] for r in rr])
 assert len(rr)==3 and skin.difference(union).area<1e-12 and union.difference(skin).area<1e-12
 for r in rr:
  assert r['shape'].is_valid and not any(p.interiors for p in r['shape'].geoms)
  assert r['sourceType']=='ARTIFICIALLY_CONSTRUCTED' and r['sourcePathId'] is None
 for i,a in enumerate(rr):
  for b in rr[i+1:]:assert a['shape'].intersection(b['shape']).area<1e-12
 count=0
 for x in range(101):
  for y in range(101):
   p=Point(x/100,y/100)
   if skin.covers(p):assert union.buffer(1e-12).covers(p);count+=1
 assert count>4000
 # Entire skin, including contour edge, must match the union, not its bounding box.
 response=client.post('/api/v1/evaluate',json=payload(skin,view));assert response.status_code==200,response.text
 result=response.json();assert result['views'][0]['covered_ratio']==pytest.approx(1)
 assert len(result['views'][0]['candidates'])==3
 assert result['source']['atlas_type']=='SCHEMATIC' and result['source']['review_status']=='NOT_MEDICALLY_VALIDATED'
 assert result['source']['intended_use']=='INTERACTIVE_SIMULATION' and result['source']['source_type']=='ARTIFICIALLY_CONSTRUCTED'
 assert '不能代替就医' in result['source']['disclaimer']

@pytest.mark.parametrize('view',['axilla-left','axilla-right'])
def test_manual_observation_locations_and_holes(client,view):
 # Source-photo observation positions; expected SCHEMATIC symbols from design, not dermatomes.
 refs=[(.55,.4566666667,'T2'),(.6655,.375,'T1'),(.466,.4683333333,'T2'),(.382,.235,'T1'),(.7075,.655,'T3')]
 for x,y,label in refs:
  if view.endswith('left'):x=1-x
  p=Point(x,y);g=p.buffer(.001).difference(p.buffer(.0003))
  response=client.post('/api/v1/evaluate',json=payload(g,view));assert response.status_code==200,response.text
  result=response.json();assert [c['label'] for c in result['views'][0]['candidates']]==[label]
  assert result['views'][0]['candidates'][0]['display_name']=='模拟 '+label
 # separated parts across full layout and duplicate union de-duplication
 g=unary_union([Point(.382 if view.endswith('right') else .618,.235).buffer(.002),Point(.7075 if view.endswith('right') else .2925,.655).buffer(.002)])
 q=payload(g,view);q['lesions'].append({**q['lesions'][0],'id':'second'})
 result=client.post('/api/v1/evaluate',json=q).json();assert len(result['views'][0]['candidates'])==2
 assert result['views'][0]['annotation_area']==pytest.approx(g.area)

@pytest.mark.parametrize('view',['axilla-left','axilla-right'])
def test_boundary_only_contact_stale_and_external_rejected(client,view):
 r=next(r for r in dataset().regions if r['view']==view and r['labelId']=='T1')
 response=client.post('/api/v1/evaluate',json=payload(r['shape'].intersection(box(.4,.20,.60,.48) if view.endswith('right') else box(.4,.20,.60,.48)),view));assert response.status_code==200,response.text
 assert [c['label'] for c in response.json()['views'][0]['candidates']]==['T1']
 q=payload(Point(.01,.01).buffer(.003),view);assert client.post('/api/v1/evaluate',json=q).status_code==422
 q=payload(r['shape'].intersection(box(.4,.20,.60,.48) if view.endswith('right') else box(.4,.20,.60,.48)),view);q['identity']['atlas_version']='stale';assert client.post('/api/v1/evaluate',json=q).json()['error']['code']=='VERSION_MISMATCH'

def test_left_geometry_actually_mirrored(client):
 d=dataset()
 for label in ['T1','T2','T3']:
  rr={r['view']:r['shape'] for r in d.regions if r['labelId']==label}
  assert scale(rr['axilla-right'],-1,1,origin=(.5,0)).symmetric_difference(rr['axilla-left']).area<1e-12

def test_production_and_unknown_closed(client,monkeypatch):
 q=payload(Point(.55,.45).buffer(.002),'axilla-right')
 for env in ['production','unknown']:
  monkeypatch.setenv('DERMATOME_ENV',env);assert client.post('/api/v1/evaluate',json=q).status_code==403
