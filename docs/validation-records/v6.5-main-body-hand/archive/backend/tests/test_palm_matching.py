"""V6.1 synthetic fixtures test geometry plumbing, never medical palm borders."""
import hashlib
import json

import pytest
from pydantic import ValidationError
from shapely.geometry import box, mapping, Polygon, MultiPolygon

from app.schemas.evaluate import EvaluateRequest, Identity
from app.services import palm_atlas_service as palms
from app.services.atlas_service import load_dataset
from app.services.dermatome_matcher import evaluate
from app.utils.geometry import EvaluationError
from test_evaluate_api import client, payload


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def palm_identity(atlas_dir, body_file):
    m=json.loads((atlas_dir/'manifest.json').read_text())
    return Identity(template_id=m['templateId'], template_version=m['templateVersion'],
                    geometry_id=m['geometryId'], region_set_id=m['regionSetId'],
                    atlas_id=m['atlasId'], atlas_version=m['atlasVersion'],
                    atlas_content_sha256=m['contentSHA256'],
                    body_content_sha256=hashlib.sha256(body_file.read_bytes()).hexdigest(),
                    coordinate_system='normalized_2d_top_left')


def rehash(atlas_dir):
    manifest=json.loads((atlas_dir/'manifest.json').read_text())
    manifest['contentSHA256']=palms.content_hash({n:(atlas_dir/n).read_bytes() for n in palms.INPUTS})
    write(atlas_dir/'manifest.json',manifest)


def region(identifier, label, geom, view='palm-left'):
    return {'id':identifier,'labelId':label,'sourceLabel':label,'view':view,'side':palms.VIEWS[view],
            'atlasVersion':palms.ATLAS_VERSION,'partitionType':'spinal_dermatome',
            **{k:palms.BASIS[k] for k in ('templateId','templateVersion','geometryId')},
            'medicalReviewStatus':'pending','sourceRefs':['SYNTHETIC_ONLY'],
            'geometry':mapping(geom)}


@pytest.fixture
def palm_files(tmp_path,monkeypatch):
    atlas_dir=tmp_path/'palm';atlas_dir.mkdir();body_file=tmp_path/'body.json'
    resource=tmp_path/'resource.json';write(resource,{'synthetic':True,'purpose':'test source only'})
    body={'coordinateSystem':'normalized_2d_top_left',**palms.BASIS,
          'sourceSHA256':{palms.RESOURCE_KEY:hashlib.sha256(resource.read_bytes()).hexdigest()},
          'views':{v:{'side':side,'geometry':mapping(box(0,0,1,1))} for v,side in palms.VIEWS.items()}}
    write(body_file,body)
    rr=[region('A-1','TEST_A',box(.1,.1,.4,.5)),region('A-2','TEST_A',box(.6,.1,.8,.3)),
        region('B-1','TEST_B',box(.4,.1,.7,.5)),region('RIGHT','TEST_RIGHT',box(.1,.1,.7,.5),'palm-right')]
    for view in palms.VIEWS:write(atlas_dir/(view+'.json'),{'view':view,'atlasVersion':palms.ATLAS_VERSION,'regions':[r for r in rr if r['view']==view]})
    write(atlas_dir/'sources.json',{'boundarySystem':'spinal_dermatome','boundaryLicenseStatus':'verified',
          'sources':[{'id':'SYNTHETIC_ONLY','purpose':'dermatome_boundaries','licenseStatus':'verified',
                      'url':'https://example.invalid/synthetic-test-fixture','license':'CC0-1.0',
                      'author':'Generated test fixture, not medical','boundaryEvidence':'Synthetic geometry only'}]})
    write(atlas_dir/'registration.json',{'geometryId':palms.BASIS['geometryId'],'status':'passed_offline_geometry'})
    write(atlas_dir/'manifest.json',{'atlasId':palms.ATLAS_ID,'atlasVersion':palms.ATLAS_VERSION,**palms.BASIS,
          'contentSHA256':'0'*64,'sourceTitle':'SYNTHETIC ONLY','sourceUrl':'https://example.invalid/',
          'attribution':'Generated tests','license':'CC0-1.0','sourceLicenseStatus':'verified',
          'medicalReviewStatus':'pending','mappingEnabled':False,'technicalValidationStatus':'passed_offline_geometry',
          'coverageNote':'Synthetic geometry tests, no clinical data'})
    rehash(atlas_dir)
    monkeypatch.setattr(palms,'ATLAS_DIR',atlas_dir);monkeypatch.setattr(palms,'BODY_FILE',body_file)
    monkeypatch.setattr(palms,'RESOURCE_FILE',resource)
    return atlas_dir,body_file


def req(files, shapes):
    return EvaluateRequest(request_id='SYNTHETIC_PALM',annotation_revision=1,identity=palm_identity(*files),
        lesions=[{'id':str(i),'view':view,'vertices':[{'x':x,'y':y} for x,y in poly.exterior.coords]} for i,(view,poly) in enumerate(shapes)])


def test_registered_palm_coordinates_reuse_same_matching_engine(palm_files):
    q=req(palm_files,[('palm-left',box(.2,.2,.3,.3)),('palm-right',box(.2,.2,.3,.3))])
    r=evaluate(q,load_dataset(q.identity))
    assert [p.view for p in r.views]==['palm-left','palm-right']
    assert r.lesions[0].candidates[0].label=='TEST_A'
    assert r.lesions[1].candidates[0].label=='TEST_RIGHT'
    assert r.lesions[0].candidates[0].side=='left' and r.lesions[1].candidates[0].side=='right'
    assert r.source.license=='CC0-1.0' and r.source.preview and r.source.medical_review_status=='pending'


@pytest.mark.parametrize('geom,labels,ratio',[
    (box(.2,.2,.3,.3),['TEST_A'],1),
    (box(.3,.2,.5,.4),['TEST_A','TEST_B'],1),
    (box(.8,.1,.9,.3),[],0), # only boundary contact with A-2
    (box(.1,.8,.2,.9),[],0),
])
def test_known_geometric_coverage_and_no_nearest_fallback(palm_files,geom,labels,ratio):
    q=req(palm_files,[('palm-left',geom)]);r=evaluate(q,load_dataset(q.identity)).lesions[0]
    assert sorted(c.label for c in r.candidates)==sorted(labels)
    assert r.covered_ratio==pytest.approx(ratio)
    assert r.covered_ratio+r.uncovered_ratio==pytest.approx(1)


def test_same_label_multiparts_and_overlapping_annotations_are_unioned(palm_files):
    q=req(palm_files,[('palm-left',box(.1,.1,.4,.4)),('palm-left',box(.2,.2,.4,.4)),('palm-left',box(.6,.1,.8,.3))])
    r=evaluate(q,load_dataset(q.identity))
    assert len(r.lesions)==3 and len(r.views)==1
    assert r.views[0].annotation_area==pytest.approx(.13)
    a=next(c for c in r.views[0].candidates if c.label=='TEST_A')
    assert a.region_ids==['A-1','A-2'] and a.lesion_coverage_ratio==pytest.approx(1)


def test_exact_multipolygon_and_hole_semantics_supported_without_ai_claim(palm_files):
    q=req(palm_files,[('palm-left',box(.1,.1,.4,.4))]).model_dump(exclude_none=True)
    outer=box(.1,.1,.4,.4);hole=box(.2,.2,.3,.3);island=box(.6,.1,.7,.2)
    shape=MultiPolygon([Polygon(outer.exterior.coords,[hole.exterior.coords]),island])
    q['lesions'][0].pop('vertices');q['lesions'][0]['geometry']={'type':'MultiPolygon','coordinateSpace':'body_template_normalized_v1',
        'coordinates':[[[{'x':x,'y':y} for x,y in ring.coords] for ring in [part.exterior,*part.interiors]] for part in shape.geoms]}
    request=EvaluateRequest.model_validate(q);r=evaluate(request,load_dataset(request.identity))
    assert r.lesions[0].annotation_area==pytest.approx(.09)
    assert r.lesions[0].covered_ratio==pytest.approx(1)


def test_p6_full_union_shared_per_palm_view(palm_files,monkeypatch):
    from app.services import dermatome_matcher as matcher
    original=matcher.coverage;received=[]
    def capture(*args,**kwargs):received.append((args[1],args[4]));return original(*args,**kwargs)
    monkeypatch.setattr(matcher,'coverage',capture)
    q=req(palm_files,[('palm-left',box(.2,.2,.3,.3))]*5+[('palm-right',box(.2,.2,.3,.3))])
    matcher.evaluate(q,load_dataset(q.identity))
    left=[v for view,v in received if view=='palm-left'];right=[v for view,v in received if view=='palm-right']
    assert len(left)==6 and len(right)==2
    assert all(v is left[0] for v in left) and all(v is right[0] for v in right)
    assert left[0] is not right[0]


@pytest.mark.parametrize('view',['front','back'])
def test_full_body_views_cannot_enter_palm_dataset(palm_files,view):
    q=req(palm_files,[(view,box(.2,.2,.3,.3))])
    with pytest.raises(EvaluationError) as error:evaluate(q,load_dataset(q.identity))
    assert error.value.code=='VIEW_UNSUPPORTED'


def test_palm_cannot_enter_existing_full_body_dataset(client):
    data=payload();data['lesions'][0]['view']='palm-left'
    response=client.post('/api/v1/evaluate',json=data)
    assert response.status_code==409 and response.json()['error']['code']=='VIEW_UNSUPPORTED'


@pytest.mark.parametrize('field,value',[
    ('template_id','OLD'),('template_version','0'),('geometry_id','BODY'),('region_set_id','OLD'),
    ('atlas_version','OLD'),('atlas_content_sha256','0'*64),('body_content_sha256','0'*64)])
def test_identity_mismatches_are_rejected(palm_files,field,value):
    identity=palm_identity(*palm_files).model_dump();identity[field]=value
    with pytest.raises(EvaluationError) as error:load_dataset(Identity(**identity))
    assert error.value.code=='VERSION_MISMATCH' and error.value.status==409


@pytest.mark.parametrize('mutation', ['side','peripheral','source','outside','self_intersection'])
def test_ready_data_requires_correct_side_spinal_source_and_valid_surface(palm_files,mutation):
    atlas,body=palm_files;p=atlas/'palm-left.json';d=json.loads(p.read_text());r=d['regions'][0]
    if mutation=='side':r['side']='right'
    elif mutation=='peripheral':r['partitionType']='median_nerve'
    elif mutation=='source':r['sourceRefs']=['UNVERIFIED']
    elif mutation=='outside':r['geometry']=mapping(box(-.1,.1,.2,.2))
    else:r['geometry']={'type':'Polygon','coordinates':[[[.1,.1],[.4,.4],[.1,.4],[.4,.1],[.1,.1]]]}
    write(p,d);rehash(atlas)
    with pytest.raises(EvaluationError) as error:load_dataset(palm_identity(atlas,body))
    assert error.value.code=='ATLAS_UNAVAILABLE' and error.value.status==503


def test_entire_lesion_is_checked_against_palm_surface_not_only_vertices(palm_files):
    atlas,body_file=palm_files;d=json.loads(body_file.read_text());d['views']['palm-left']['geometry']=mapping(Polygon(box(0,0,1,1).exterior.coords,[box(.45,.65,.55,.75).exterior.coords]))
    write(body_file,d)
    q=req(palm_files,[('palm-left',box(.3,.6,.7,.8))])
    with pytest.raises(EvaluationError) as error:evaluate(q,load_dataset(q.identity))
    assert error.value.code=='INVALID_ANNOTATION'


def test_blocked_atlas_returns_explicit_error_not_successful_uncovered(client,palm_files):
    atlas,body=palm_files;manifest=json.loads((atlas/'manifest.json').read_text())
    manifest.update(technicalValidationStatus='blocked_missing_boundaries',sourceLicenseStatus='UNKNOWN')
    write(atlas/'manifest.json',manifest)
    q=req(palm_files,[('palm-left',box(.2,.2,.3,.3))])
    response=client.post('/api/v1/evaluate',json=q.model_dump(mode='json'))
    assert response.status_code==409 and response.json()['error']['code']=='ATLAS_NOT_READY'
    assert 'candidates' not in response.text and 'covered_ratio' not in response.text


def test_marking_empty_regions_ready_still_cannot_match(palm_files):
    atlas,body=palm_files;p=atlas/'palm-left.json';d=json.loads(p.read_text());d['regions']=[];write(p,d);rehash(atlas)
    with pytest.raises(EvaluationError) as error:load_dataset(palm_identity(atlas,body))
    assert error.value.code=='ATLAS_NOT_READY'


def test_data_is_revalidated_each_request_without_cross_view_or_version_cache(palm_files):
    atlas,body=palm_files;original=palm_identity(atlas,body);first=load_dataset(original)
    assert first.bodies.keys()=={'palm-left','palm-right'}
    p=atlas/'palm-left.json';d=json.loads(p.read_text());d['regions'][0]['labelId']='TEST_CHANGED';write(p,d)
    with pytest.raises(EvaluationError) as error:load_dataset(original)
    assert error.value.code=='ATLAS_UNAVAILABLE'
    rehash(atlas)
    with pytest.raises(EvaluationError) as error:load_dataset(original)
    assert error.value.code=='VERSION_MISMATCH'
    assert load_dataset(palm_identity(atlas,body)).regions[0]['labelId']=='TEST_CHANGED'
    assert first.regions[0]['labelId']=='TEST_A'


def test_palm_http_success_and_release_gate(client,palm_files,monkeypatch):
    q=req(palm_files,[('palm-left',box(.2,.2,.3,.3))]).model_dump(mode='json')
    response=client.post('/api/v1/evaluate',json=q)
    assert response.status_code==200 and response.json()['views'][0]['view']=='palm-left'
    monkeypatch.setenv('DERMATOME_ENV','production')
    assert client.post('/api/v1/evaluate',json=q).status_code==403


def test_other_special_views_and_photo_space_still_rejected(palm_files):
    q=req(palm_files,[('palm-left',box(.2,.2,.3,.3))]).model_dump()
    q['lesions'][0]['view']='sole-left'
    # V6.4 is a valid independent view, but still cannot use the palm atlas.
    typed=EvaluateRequest.model_validate(q)
    with pytest.raises(EvaluationError) as error:evaluate(typed,load_dataset(typed.identity))
    assert error.value.code=='VIEW_UNSUPPORTED'
    q['lesions'][0]['view']='armpit'
    with pytest.raises(ValidationError):EvaluateRequest.model_validate(q)

    q=req(palm_files,[('palm-left',box(.2,.2,.3,.3))]).model_dump()
    q['lesions'][0].pop('vertices')
    q['lesions'][0]['geometry']={'type':'Polygon','coordinateSpace':'photo_oriented_normalized_v1',
        'coordinates':[[{'x':x,'y':y} for x,y in box(.2,.2,.3,.3).exterior.coords]]}
    with pytest.raises(ValidationError):EvaluateRequest.model_validate(q)


@pytest.mark.parametrize('field', ['sourceTitle','sourceUrl','attribution','license','coverageNote'])
def test_malformed_source_metadata_does_not_fall_through_to_matcher(palm_files,field):
    atlas,body=palm_files;p=atlas/'manifest.json';m=json.loads(p.read_text());del m[field];write(p,m)
    with pytest.raises(EvaluationError) as error:load_dataset(palm_identity(atlas,body))
    assert error.value.code=='ATLAS_UNAVAILABLE'


@pytest.mark.parametrize('mutation', ['peripheral','unverified','display-only','missing-registration'])
def test_boundary_sources_must_be_independent_of_display_resource_permission(palm_files,mutation):
    atlas,body=palm_files;p=atlas/'sources.json';s=json.loads(p.read_text())
    if mutation=='peripheral':s['boundarySystem']='median_ulnar_radial'
    elif mutation=='unverified':s['boundaryLicenseStatus']='UNKNOWN'
    elif mutation=='display-only':s['sources'][0]['purpose']='display_outline'
    else:
        write(atlas/'registration.json',{'geometryId':palms.BASIS['geometryId'],'status':'unverified'})
    write(p,s);rehash(atlas)
    with pytest.raises(EvaluationError) as error:load_dataset(palm_identity(atlas,body))
    assert error.value.code=='ATLAS_UNAVAILABLE'



def test_resource_change_or_arbitrary_path_cannot_reuse_stale_export(palm_files):
    atlas,body=palm_files;identity=palm_identity(atlas,body)
    assert load_dataset(identity).bodies
    palms.RESOURCE_FILE.write_text('{"synthetic":true,"changed":true}')
    with pytest.raises(EvaluationError) as error:load_dataset(identity)
    assert error.value.code=='ATLAS_UNAVAILABLE'
    d=json.loads(body.read_text());d['sourceSHA256']={'../../private-source':hashlib.sha256(palms.RESOURCE_FILE.read_bytes()).hexdigest()};write(body,d)
    with pytest.raises(EvaluationError) as error:load_dataset(palm_identity(atlas,body))
    assert error.value.code=='ATLAS_UNAVAILABLE'


def test_official_source_derived_palm_preview_uses_real_regions_and_keeps_medical_gate(client):
    identity=palm_identity(palms.ATLAS_DIR,palms.BODY_FILE)
    q=EvaluateRequest(request_id='PALM_READINESS',annotation_revision=1,identity=identity,
        lesions=[{'id':'SYNTHETIC_REFERENCE_POINT','view':'palm-right',
                  'vertices':[{'x':.55,'y':.2},{'x':.57,'y':.2},{'x':.56,'y':.22}]}])
    response=client.post('/api/v1/evaluate',json=q.model_dump(mode='json'))
    assert response.status_code==200,response.text
    body=response.json()
    assert [c['label'] for c in body['lesions'][0]['candidates']]==['C7']
    assert body['source']['preview'] is True
    assert body['source']['medical_review_status']=='pending'
    assert body['source']['license']=='CC BY 4.0'
    for view in palms.VIEWS:
        regions=json.loads((palms.ATLAS_DIR/(view+'.json')).read_text())['regions']
        assert [r['labelId'] for r in regions]==['C6','C7','C8']



def test_reversed_palm_v1_identity_is_rejected_after_side_correction(client):
    old=palm_identity(palms.ATLAS_DIR,palms.BODY_FILE).model_copy(update={
        'template_version':'1.0.0','geometry_id':'commons-palm-outline-v1',
        'region_set_id':'commons-palm-ui-v1','atlas_version':'palm-dermatomes-preview.1'})
    q=EvaluateRequest(request_id='OLD_REVERSED_HAND',annotation_revision=1,identity=old,
        lesions=[{'id':'SYNTHETIC','view':'palm-left','vertices':[
            {'x':.5,'y':.6},{'x':.6,'y':.6},{'x':.55,'y':.7}]}])
    response=client.post('/api/v1/evaluate',json=q.model_dump(mode='json'))
    assert response.status_code==409 and response.json()['error']['code']=='VERSION_MISMATCH'
