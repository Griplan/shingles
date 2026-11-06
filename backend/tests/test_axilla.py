"""V6.6 actual display + fail-closed API. No synthetic T1/T2/T3 atlas."""
import hashlib,json,sys,shutil
from pathlib import Path
import pytest
from shapely.geometry import shape,Point,box
from shapely.affinity import scale
from app.schemas.evaluate import EvaluateRequest,Identity
from app.services import axilla_atlas_service as axilla
from app.services.atlas_service import load_dataset
from app.utils.geometry import EvaluationError
from test_evaluate_api import client,payload
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from build_axilla import build,SOURCE,SHA

def identity():
    m=json.loads((axilla.ATLAS_DIR/'manifest.json').read_text())
    return Identity(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=m['regionSetId'],atlas_id=m['atlasId'],atlas_version=m['atlasVersion'],atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256(axilla.BODY_FILE.read_bytes()).hexdigest(),coordinate_system='normalized_2d_top_left')

def request(view='axilla-right'):
    rings=[box(.50,.50,.70,.70).exterior,box(.55,.55,.60,.60).exterior]
    coords=[[[{'x':x,'y':y} for x,y in r.coords] for r in rings],[[{'x':x,'y':y} for x,y in box(.4,.2,.45,.25).exterior.coords]]]
    if view=='axilla-left':
        coords=[[[{'x':1-p['x'],'y':p['y']} for p in ring] for ring in polygon] for polygon in coords]
    return EvaluateRequest(request_id='V66_SYNTHETIC_MARKS',annotation_revision=1,identity=identity(),lesions=[{'id':'demo','view':view,'geometry':{'type':'MultiPolygon','coordinateSpace':'body_template_normalized_v1','coordinates':coords}}])

def test_generated_identity_source_and_exports_reproduce():
    assert hashlib.sha256((ROOT/SOURCE).read_bytes()).hexdigest()==SHA
    for file,expected in build().items():assert (ROOT/file).read_text()==expected,file

def test_actual_display_skin_valid_mirrored_and_blank_is_not_skin():
    data=json.loads(axilla.BODY_FILE.read_text())['views'];right=shape(data['axilla-right']['geometry']);left=shape(data['axilla-left']['geometry'])
    assert right.is_valid and left.is_valid and right.area>0
    assert left.symmetric_difference(scale(right,xfact=-1,yfact=1,origin=(.5,0))).area<1e-12
    for x,y in [(.55,.4566666667),(.6655,.375),(.466,.4683333333),(.382,.235),(.7075,.655)]:
        assert right.contains(Point(x,y)) and left.contains(Point(1-x,y))
    assert not right.covers(Point(.05,.8))

@pytest.mark.parametrize('view',['axilla-left','axilla-right'])
def test_real_api_returns_not_ready_never_empty_success(client,view):
    q=request(view);r=client.post('/api/v1/evaluate',json=q.model_dump(mode='json'))
    assert r.status_code==409,r.text
    assert r.json()['error']['code']=='ATLAS_NOT_READY' and 'candidates' not in r.json()
    assert len(q.lesions[0].geometry.coordinates)==2 and len(q.lesions[0].geometry.coordinates[0])==2

@pytest.mark.parametrize('field',['atlas_version','template_version','geometry_id','atlas_content_sha256','body_content_sha256'])
def test_stale_identity_remains_distinct_from_unready(field):
    q=identity().model_copy(update={field:'0'*64 if field.endswith('sha256') else 'old'})
    with pytest.raises(EvaluationError) as e:load_dataset(q)
    assert e.value.code=='VERSION_MISMATCH'

def test_no_neural_geometry_license_or_registration_is_fabricated():
    m=json.loads((axilla.ATLAS_DIR/'manifest.json').read_text());s=json.loads((axilla.ATLAS_DIR/'sources.json').read_text());r=json.loads((axilla.ATLAS_DIR/'registration.json').read_text())
    assert m['medicalReviewStatus']=='pending' and m['mappingEnabled'] is False
    assert m['sourceLicenseStatus']=='unconfigured' and s['sources']==[]
    assert s['displaySource']['license']=='CC0 1.0' and r['method'] is None and r['registeredRegionCount']==0
    for v in axilla.VIEWS:assert json.loads((axilla.ATLAS_DIR/(v+'.json')).read_text())['regions']==[]

@pytest.mark.parametrize('change',['identity','broken-json','fake-ready'])
def test_corrupt_or_artificially_enabled_manifest_fails_closed(tmp_path,monkeypatch,change):
    target=tmp_path/'atlas';shutil.copytree(axilla.ATLAS_DIR,target);monkeypatch.setattr(axilla,'ATLAS_DIR',target)
    q=identity();file=target/'manifest.json';m=json.loads(file.read_text())
    if change=='identity':m['templateId']='wrong'
    if change=='fake-ready':m.update(technicalValidationStatus='passed_offline_geometry',sourceLicenseStatus='verified')
    file.write_text('{' if change=='broken-json' else json.dumps(m))
    with pytest.raises(EvaluationError) as e:load_dataset(q)
    assert e.value.code=='ATLAS_UNAVAILABLE'

@pytest.mark.parametrize('view',['axilla-left','axilla-right'])
def test_axilla_coordinates_cannot_use_full_body_or_sole_identity(client,view):
    from test_sole_matching import request as sole_request
    for p in [payload(),sole_request().model_dump(mode='json')]:
        p['lesions'][0]['view']=view;r=client.post('/api/v1/evaluate',json=p)
        assert r.status_code==409 and r.json()['error']['code']=='VIEW_UNSUPPORTED',r.text

def test_production_still_denies_preview(client,monkeypatch):
    monkeypatch.setenv('DERMATOME_ENV','production')
    assert client.post('/api/v1/evaluate',json=request().model_dump(mode='json')).status_code==403
