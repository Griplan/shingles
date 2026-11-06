import json
from pathlib import Path
import pytest
from shapely.geometry import Polygon,box,MultiPolygon
from app.services.dermatome_matcher import coverage,candidates_for,evaluate,area_tolerance
from app.services.atlas_service import Dataset
from app.schemas.evaluate import EvaluateRequest,Identity
from app.utils.geometry import annotation_polygon,EvaluationError

FIXTURE=json.loads((Path(__file__).parent/'fixtures/synthetic-matching.json').read_text())
IDENTITY=Identity(template_id='TEST_BODY',template_version='1',geometry_id='TEST_GEOMETRY',region_set_id='TEST_REGIONS',atlas_id='TEST_ATLAS',atlas_version='1',atlas_content_sha256='a'*64,body_content_sha256='b'*64,coordinate_system='normalized_2d_top_left')
MANIFEST={'sourceTitle':'Synthetic test only','sourceUrl':'','attribution':'Not a medical source','coverageNote':'Synthetic'}
def region(name,geom,side='left',view='front',kind='spinal_dermatome',rid=None):
 return {'id':rid or name,'labelId':name,'sourceLabel':name,'side':side,'view':view,'partitionType':kind,'shape':geom}
def request(polys):
 return EvaluateRequest(request_id='TEST_REQUEST',annotation_revision=1,identity=IDENTITY,lesions=[{'id':rid,'view':view,'vertices':[{'x':x,'y':y} for x,y in poly.exterior.coords]} for rid,view,poly in polys])
def dataset(regions):return Dataset(IDENTITY,MANIFEST,tuple(regions),{'front':box(0,0,1,1),'back':box(0,0,1,1)})

def test_contained_small_lesion_is_full_not_iou():
 r=coverage(box(.2,.2,.3,.3),'front',['L'],candidates_for([region('TEST_A',box(0,0,1,1))],'front'))
 assert r.candidates[0].lesion_coverage_ratio==1 and r.covered_ratio==1

@pytest.mark.parametrize('name,expected',[('nonoverlap',(0.6,0.3)),('overlap',(0.6,0.5))])
def test_hand_computable_partial_and_union(name,expected):
 regions=[region(k,Polygon(v)) for k,v in FIXTURE[name].items()]
 r=coverage(Polygon(FIXTURE['lesion']),'front',['L'],candidates_for(regions,'front'))
 assert [c.lesion_coverage_ratio for c in r.candidates]==pytest.approx(expected)
 assert r.covered_ratio==pytest.approx(.9) and r.uncovered_ratio==pytest.approx(.1) and r.coverage_status=='partial'

def test_boundary_contact_is_not_candidate_and_no_nearest_fallback():
 r=coverage(box(.5,0,1,1),'front',['L'],candidates_for([region('TEST_A',box(0,0,.5,1))],'front'))
 assert not r.candidates and r.covered_ratio==0 and r.uncovered_ratio==1 and r.coverage_status=='none'

def test_overlapping_lesions_union_per_view_only():
 q=request([('L1','front',box(0,0,.6,1)),('L2','front',box(.4,0,1,1)),('L3','back',box(0,0,.5,1))])
 before=q.model_dump_json();r=evaluate(q,dataset([region('TEST_A',box(0,0,.5,1))]))
 assert len(r.lesions)==3 and len(r.views)==2 and q.model_dump_json()==before
 front=next(v for v in r.views if v.view=='front');back=next(v for v in r.views if v.view=='back')
 assert front.annotation_area==1 and front.covered_ratio==.5
 assert back.annotation_area==.5 and back.covered_ratio==0

def test_multiparts_holes_and_same_candidate_union():
 hole=Polygon([(0,0),(1,0),(1,1),(0,1)],holes=[[(.2,.2),(.8,.2),(.8,.8),(.2,.8)]])
 r=coverage(box(0,0,1,1),'front',['L'],candidates_for([region('TEST_A',hole,rid='A1'),region('TEST_A',box(0,0,.1,.1),rid='A2')],'front'))
 assert len(r.candidates)==1 and r.covered_ratio==pytest.approx(.64) and r.candidates[0].region_ids==['A1','A2']
 multi=MultiPolygon([box(0,0,.1,.1),box(.9,.9,1,1)])
 assert coverage(box(.2,.2,.8,.8),'front',['L'],candidates_for([region('TEST_B',multi)],'front')).coverage_status=='none'

def test_identity_types_sides_views_composite_not_split_and_stable_ties():
 rr=[region('TEST_A/TEST_B',box(0,0,1,1),side=s,kind=k,rid=s+k) for s in ('left','right') for k in ('trigeminal_sensory','spinal_dermatome_composite')]
 rr.append(region('TEST_BACK',box(0,0,1,1),view='back'))
 a=coverage(box(0,0,1,1),'front',['L'],candidates_for(rr,'front'))
 b=coverage(box(0,0,1,1),'front',['L'],candidates_for(rr[::-1],'front'))
 assert a==b and len(a.candidates)==4 and {c.label for c in a.candidates}=={'TEST_A/TEST_B'}

def test_tiny_intersections_are_retained_above_declared_numeric_tolerance():
 l=box(0,0,1,1);r=coverage(l,'front',['L'],candidates_for([region('TEST_TINY',box(0,0,1e-10,1))],'front'))
 assert r.candidates[0].lesion_coverage_ratio==pytest.approx(1e-10) and area_tolerance(1)==1e-12

@pytest.mark.parametrize('pts',[
 [(0,0),(1,1),(0,1),(1,0)],[(0,0),(.5,.5),(1,1)],[(0,0),(1,0),(1,1),(1,0)],[(0,0),(1,0),(1,1),(0,1)]])
def test_invalid_shapes_and_whole_polygon_body_constraint(pts):
 from app.schemas.evaluate import Point
 with pytest.raises(EvaluationError):annotation_polygon([Point(x=x,y=y) for x,y in pts],box(0,0,.8,.8))

def test_body_hole_or_between_limbs_not_just_vertices():
 from app.schemas.evaluate import Point
 body=Polygon([(0,0),(1,0),(1,1),(0,1)],holes=[[(.4,.4),(.6,.4),(.6,.6),(.4,.6)]])
 with pytest.raises(EvaluationError):annotation_polygon([Point(x=x,y=y) for x,y in box(.2,.2,.8,.8).exterior.coords],body)

def test_duplicate_ids_and_per_view_limits():
 with pytest.raises(EvaluationError,match='ID'):evaluate(request([('L','front',box(.1,.1,.2,.2))]*2),dataset([]))
 with pytest.raises(EvaluationError,match='20'):evaluate(request([(str(i),'front',box(.1,.1,.2,.2)) for i in range(21)]),dataset([]))
