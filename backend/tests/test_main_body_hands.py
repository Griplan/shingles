"""V6.5 source geometry/technical registration tests, NOT clinical validation."""
import copy,hashlib,json,sys
from pathlib import Path
import pytest
from shapely.geometry import shape,box,Polygon,MultiPolygon,Point
from shapely.ops import unary_union
from app.schemas.evaluate import EvaluateRequest,Identity
from app.services.atlas_service import load_dataset,ATLAS_DIR,BODY_FILE,Dataset
from app.services.dermatome_matcher import evaluate,coverage
from app.utils.geometry import EvaluationError
from test_evaluate_api import client,identity,payload
ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT/'docs/validation-records/v6.5-main-body-hand/evidence'
REFS=json.loads((EVIDENCE/'reference-points.json').read_text())

@pytest.mark.parametrize('ref',REFS,ids=lambda r:r['id'])
def test_original_ink_reference_locations(client,ref):
    x,y=ref['normalized'];q=payload(x,y,ref['view']);eps=.12
    q['lesions'][0]['vertices']=[{'x':a/400,'y':b/900} for a,b in box(ref['logical'][0]-eps,ref['logical'][1]-eps,ref['logical'][0]+eps,ref['logical'][1]+eps).exterior.coords]
    r=client.post('/api/v1/evaluate',json=q)
    if not ref['expectedSkin']:
        assert r.status_code==422,r.text
        assert r.json()['error']['code']=='INVALID_ANNOTATION'
    else:
        assert r.status_code==200,r.text
        c=r.json()['lesions'][0]
        if ref['status']=='B':
            assert 0<c['uncovered_ratio']<.1
            assert {v['label'] for v in c['candidates']} <= {'C6-C8','C8/T1'}
            return
        assert c['covered_ratio']>.99
        assert {v['label'] for v in c['candidates']}=={ref['expectedLabel']}
        assert all(v['side']==ref['side'] and v['view']==ref['view'] for v in c['candidates'])

@pytest.mark.parametrize('view',['front','back'])
def test_parent_geometry_unchanged_new_hands_in_own_view(view):
    old=json.loads((ROOT/f'data/atlas/goran-2022-preview-v2/{view}.json').read_text())['regions']
    new=json.loads((ATLAS_DIR/(view+'.json')).read_text())['regions'];byid={r['id']:r for r in new}
    for r in old:
        after=byid[r['id']]
        for field in ['geometry','labelId','partitionType','side','view','sourceRefs','sourcePathIndices','labelPoint']:assert r[field]==after[field]
    hand=[r for r in new if '-hand-' in r['id']];assert len(hand)==(10 if view=='front' else 12)
    assert {r['labelId'] for r in hand}==({'C5','C6-C8','C8/T1'} if view=='front' else {'C7','C6-C8','C8/T1','T1/T2'})
    body=shape(json.loads(BODY_FILE.read_text())['views'][view]['geometry'])
    for r in hand:
        g=shape(r['geometry']);assert g.is_valid and g.area>0
        assert g.difference(body).area<1e-12
        assert r['medicalReviewStatus']=='pending' and r['sourceLicense']=='CC BY-SA 4.0'
        assert 'servier' not in json.dumps(r).lower()
    # Original parent micro-overlap remains historical; new geometry cannot add a large overlap.
    assert sum(shape(r['geometry']).area for r in hand)-unary_union([shape(r['geometry']) for r in hand]).area<1e-11

@pytest.mark.parametrize('view',['front','back'])
def test_body_revision_changes_only_documented_hand_gaps(view):
    a=shape(json.loads((ROOT/'data/body/commons-template4.json').read_text())['views'][view]['geometry'])
    b=shape(json.loads(BODY_FILE.read_text())['views'][view]['geometry'])
    assert b.difference(a).area<1e-12
    allowed=unary_union([box(0,439/900,108/400,560/900),box(292/400,439/900,1,560/900)])
    assert a.symmetric_difference(b).difference(allowed).area==0
    assert a.area>b.area

@pytest.mark.parametrize('view',['front','back'])
def test_multi_islands_holes_cross_region_and_uncovered(view):
    d=load_dataset(Identity(**identity()));r=next(r for r in d.regions if '-hand-' in r['id'] and r['view']==view and r['labelId']=='C6-C8' and r['shape'].area>.001)
    p=r['shape'].representative_point();dist=p.distance(r['shape'].boundary)/8
    outer=box(p.x-dist,p.y-dist,p.x+dist,p.y+dist);inner=box(p.x-dist/3,p.y-dist/3,p.x+dist/3,p.y+dist/3)
    part=outer.difference(inner);second=box(p.x+dist*2,p.y-dist/3,p.x+dist*3,p.y+dist/3)
    geom=MultiPolygon([part,second]);q=payload(p.x,p.y,view);q['lesions'][0].pop('vertices')
    q['lesions'][0]['geometry']={'type':'MultiPolygon','coordinateSpace':'body_template_normalized_v1','coordinates':[[[{'x':x,'y':y} for x,y in ring.coords] for ring in [p.exterior,*p.interiors]] for p in geom.geoms]}
    result=evaluate(EvaluateRequest.model_validate(q),d);assert result.lesions[0].annotation_area==pytest.approx(geom.area)
    assert result.lesions[0].candidates[0].label=='C6-C8'
    h=json.loads((ATLAS_DIR/'hand-registration.json').read_text())['hands'][view+'-left'];blank=shape(h['uncoveredGeometry'])
    # Generated engineering gap fixture, NOT an independently labelled clinical point.
    p=blank.representative_point();eps=p.distance(blank.boundary)/5;q=payload(p.x,p.y,view)
    q['lesions'][0].pop('vertices')
    q['lesions'][0]['geometry']={'type':'Polygon','coordinateSpace':'body_template_normalized_v1','coordinates':[[{'x':x,'y':y} for x,y in box(p.x-eps,p.y-eps,p.x+eps,p.y+eps).exterior.coords]]}
    c=evaluate(EvaluateRequest.model_validate(q),d).lesions[0];assert c.uncovered_ratio==pytest.approx(1) and not c.candidates

@pytest.mark.parametrize('v',['palm-left','palm-right'])
def test_retired_view_rejected_explicitly_never_migrated(client,v):
    q=payload();q['lesions'][0]['view']=v;original=copy.deepcopy(q)
    r=client.post('/api/v1/evaluate',json=q);assert r.status_code==410 and r.json()['error']['code']=='VIEW_RETIRED';assert q==original
    q=payload();q['identity']['atlas_id']='palm-dermatomes-v1'
    r=client.post('/api/v1/evaluate',json=q);assert r.status_code==410 and r.json()['error']['code']=='VIEW_RETIRED'

def test_previous_atlas_body_identity_rejected_without_touching_geometry(client):
    q=payload();q['identity']['atlas_version']='goran-2022-commons-template4-preview.2';before=copy.deepcopy(q['lesions'])
    r=client.post('/api/v1/evaluate',json=q);assert r.status_code==409 and r.json()['error']['code']=='VERSION_MISMATCH';assert q['lesions']==before

def test_real_paths_provenance_reproducible_and_shared_package():
    sys.path.insert(0,str(ROOT/'scripts'));from prepare_hand_atlas import build
    files,report=build()
    for name,text in files.items():
        if name.endswith('/manifest.json'):continue # packager adds checksum
        assert (ROOT/name).read_text()==text,name
    assert len(report['hands'])==4
    assert all(len(h['landmarks'])==11 for h in report['hands'].values())
