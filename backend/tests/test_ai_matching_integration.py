"""Synthetic geometry expectations; real atlas checks are engineering, not clinical."""
import copy
import pytest
from shapely.geometry import Polygon, MultiPolygon, box
from app.schemas.evaluate import EvaluateRequest
from pydantic import ValidationError
from app.services.dermatome_matcher import evaluate
from app.utils.geometry import annotation_geometry, EvaluationError
from test_matching import IDENTITY, dataset, region
from test_evaluate_api import client, payload

def geometry(shape):
    parts = list(shape.geoms) if shape.geom_type == 'MultiPolygon' else [shape]
    rings = [[list(p.exterior.coords), *[list(r.coords) for r in p.interiors]] for p in parts]
    coordinates = [[ [{'x': x, 'y': y} for x, y in ring] for ring in poly] for poly in rings]
    return {'type': 'MultiPolygon', 'coordinateSpace': 'body_template_normalized_v1', 'coordinates': coordinates}

def request(shape, source='ai_assisted', view='front'):
    return EvaluateRequest(request_id='SYNTHETIC', annotation_revision=3, identity=IDENTITY,
        lesions=[{'id': 'L', 'view': view, 'source': source, 'geometry': geometry(shape)}])

@pytest.mark.parametrize('shape', [
    box(.1,.1,.2,.2), MultiPolygon([box(.1,.1,.2,.2),box(.7,.7,.8,.8)]),
    Polygon(box(.1,.1,.9,.9).exterior.coords, [box(.3,.3,.6,.6).exterior.coords]),
    MultiPolygon([box(.1,.1,.2,.2),box(.8,.8,.800001,.800001)])])
def test_same_body_geometry_manual_ai_are_identical(shape):
    data=dataset([region('SYNTHETIC_A',box(0,0,.5,1)),region('SYNTHETIC_B',box(.5,0,1,.9))])
    manual=request(shape,'manual'); ai=request(shape)
    before=ai.model_dump_json()
    assert evaluate(manual,data).model_dump()==evaluate(ai,data).model_dump()
    assert ai.model_dump_json()==before
    converted=annotation_geometry(ai.lesions[0],data.bodies['front'])
    assert converted.equals_exact(shape if shape.geom_type=='MultiPolygon' else MultiPolygon([shape]),0)

def test_hole_is_excluded_and_multiple_pieces_count_once():
    shape=MultiPolygon([Polygon(box(.1,.1,.4,.4).exterior.coords,[box(.2,.2,.3,.3).exterior.coords]),box(.6,.6,.8,.8)])
    data=dataset([region('ONLY_HOLE',box(.2,.2,.3,.3)),region('PATCH',box(.6,.6,.8,.8))])
    result=evaluate(request(shape),data).lesions[0]
    assert result.annotation_area==pytest.approx(.12)
    assert [c.label for c in result.candidates]==['PATCH']
    assert result.covered_ratio==pytest.approx(1/3)
    assert result.uncovered_ratio==pytest.approx(2/3)

def test_overlapping_annotations_union_without_source_weight_or_duplicate_http():
    q=request(box(.1,.1,.6,.6)).model_dump(exclude_none=True)
    q['lesions'].append({'id':'OTHER','view':'front','source':'manual','geometry':geometry(box(.4,.1,.9,.6))})
    q['lesions'].append({'id':'BACK','view':'back','source':'ai_assisted','geometry':geometry(box(.1,.1,.2,.2))})
    r=evaluate(EvaluateRequest(**q),dataset([region('ALL',box(0,0,1,1))]))
    front=next(v for v in r.views if v.view=='front');back=next(v for v in r.views if v.view=='back')
    assert front.annotation_area==pytest.approx(.4) and front.covered_ratio==1
    assert back.coverage_status=='none' and back.candidates==[]

@pytest.mark.parametrize('shape,status,count',[(box(.1,.1,.2,.2),'full',1),
    (box(.4,.1,.6,.2),'full',2),(box(.4,.4,.6,.8),'partial',2),(box(.1,.8,.2,.9),'none',0)])
def test_coverage_cases_are_actual_intersections(shape,status,count):
    r=evaluate(request(shape),dataset([region('A',box(0,0,.5,.6)),region('B',box(.5,0,1,.6))])).lesions[0]
    assert r.coverage_status==status and len(r.candidates)==count
    assert r.covered_ratio+r.uncovered_ratio==pytest.approx(1)

def test_invalid_multi_is_not_repaired_and_whole_body_boundary_is_checked():
    q=request(MultiPolygon([box(.1,.1,.6,.6),box(.4,.4,.9,.9)]))
    with pytest.raises(EvaluationError):annotation_geometry(q.lesions[0],box(0,0,1,1))
    body=Polygon(box(0,0,1,1).exterior.coords,[box(.4,.4,.6,.6).exterior.coords])
    with pytest.raises(EvaluationError):annotation_geometry(request(box(.2,.2,.8,.8)).lesions[0],body)
    # A lesion hole genuinely excludes the body hole; no clipping is needed.
    valid=Polygon(box(.2,.2,.8,.8).exterior.coords,[box(.3,.3,.7,.7).exterior.coords])
    assert annotation_geometry(request(valid).lesions[0],body).is_valid

def test_wire_contract_and_existing_atlas(client):
    p=payload();ring=p['lesions'][0].pop('vertices')
    p['lesions'][0].update(source='ai_assisted',geometry={'type':'MultiPolygon','coordinateSpace':'body_template_normalized_v1','coordinates':[[ring]]})
    result=client.post('/api/v1/evaluate',json=p)
    assert result.status_code==200
    p['lesions'][0]['source']='manual'
    assert client.post('/api/v1/evaluate',json=p).json()==result.json()
    assert result.json()['lesions'][0]['candidates'][0]['partition_type']=='trigeminal_sensory'
    for mutate in [lambda l:l.update(vertices=ring),lambda l:l['geometry'].update(coordinateSpace='photo_oriented_normalized_v1'),
                   lambda l:l.update(photo_id='PRIVATE'),lambda l:l['geometry'].update(coordinates=[]),
                   lambda l:l['geometry']['coordinates'][0][0][0].update(x=True)]:
        wrong=copy.deepcopy(p);mutate(wrong['lesions'][0]);response=client.post('/api/v1/evaluate',json=wrong)
        assert response.status_code==422 and 'PRIVATE' not in response.text
    p['lesions'][0]['geometry']={'type':'Polygon','coordinateSpace':'body_template_normalized_v1','coordinates':[ring]}
    assert client.post('/api/v1/evaluate',json=p).json()==result.json()

def test_nonclosed_and_outside_geometry_rejected_without_echo(client):
    for shape in [box(0,0,.2,.2),box(.487,.095,.489,.097)]:
        p=payload();p['lesions']=[{'id':'L','view':'front','geometry':geometry(shape)}]
        if shape.bounds[0]>.4:p['lesions'][0]['geometry']['coordinates'][0][0].pop()
        assert client.post('/api/v1/evaluate',json=p).status_code==422

def test_complexity_limits_reject_instead_of_simplifying():
    # Schema budget only; repeated synthetic vertices intentionally avoid costly shape creation.
    q=request(box(.1,.1,.2,.2)).model_dump(exclude_none=True)
    ring=q['lesions'][0]['geometry']['coordinates'][0][0]
    q['lesions'][0]['geometry']['coordinates']=[[ring*4000]]
    assert EvaluateRequest(**q).lesions[0].vertex_count()==20000
    q['lesions'].append({**copy.deepcopy(q['lesions'][0]),'id':'SECOND'})
    assert len(EvaluateRequest(**q).lesions)==2
    q['lesions'].append({'id':'THIRD','view':'front','geometry':geometry(box(.3,.3,.4,.4))})
    with pytest.raises(ValidationError):EvaluateRequest(**q)
    q['lesions']=q['lesions'][:1];q['lesions'][0]['geometry']['coordinates'].append([ring])
    with pytest.raises(ValidationError):EvaluateRequest(**q)
