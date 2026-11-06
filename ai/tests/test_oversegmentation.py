"""Synthetic pixel/transport contracts, NOT clinical segmentation accuracy."""
import io
import hashlib
import numpy as np
import pytest
from PIL import Image
from shapely.geometry import shape
from shapely import contains_xy
from ai.errors import SegmentationError
from ai.inference.local_regions import predict_regions
from ai.postprocessing.brush import apply_strokes
from ai.postprocessing.quality import inspect_candidates
from ai.postprocessing.polygons import mask_to_polygons
from test_service import client, service, start, payload

class PixelModel:
    """Foreground exactly follows an encoded red channel, independent of ROI."""
    def __init__(self): self.calls=[]
    def predict(self,rgb,p):
        self.calls.append((rgb.copy(),p))
        return (rgb[:,:,0]>0)[None],np.array([.99]),{'inference_seconds':.01},{}

def raster(geometry,h,w):
    g=shape(geometry);yy,xx=np.mgrid[:h,:w]
    return contains_xy(g,(xx+.5)/w,(yy+.5)/h)

def test_context_offsets_preserve_holes_islands_and_original_prompt():
    rgb=np.zeros((100,160,3),np.uint8);rgb[20:35,20:35,0]=255;rgb[25:30,25:30,0]=0;rgb[33,39,0]=255
    rgb[60:75,120:135,0]=255;rgb[64:69,124:129,0]=0
    p={'points':[[22,22,1],[130,70,1],[80,90,0]],'box':[18,18,42,38],'additional_boxes':[[118,58,138,78]]}
    model=PixelModel();m,_,_,x,raw=predict_regions(model,rgb,p,'context_crop')
    assert len(model.calls)==2 and len(raw)==2 and x['mask_mapping']=='integer_offset_no_resize'
    assert np.array_equal(m[0],rgb[:,:,0]>0)
    assert p['points'][0]==[22,22,1] and model.calls[0][1]['points'][0]==[20,20,1]
    converted=mask_to_polygons(m[0]);assert converted['component_count']==3 and converted['hole_count']==2
    assert np.array_equal(raster(converted['geometry'],100,160),m[0])
    assert not m[0,18,18]  # a crop/box is never substituted for a prediction

@pytest.mark.parametrize('box',[[0,0,12,12],[148,88,160,100]])
def test_crop_photo_edges_and_foreground_outside_box_are_mapped_exactly(box):
    rgb=np.zeros((100,160,3),np.uint8);rgb[49:52,79:82,0]=255;rgb[0,0,0]=255;rgb[-1,-1,0]=255
    p={'points':[[80,50,1]],'box':box};model=PixelModel();m,_,_,x,_=predict_regions(model,rgb,p,'context_crop')
    assert m[0,50,80] and x['regions'][0]['prompts_local']['points']
    x0,y0,x1,y1=x['regions'][0]['crop_xyxy'];expected=np.zeros((100,160),bool);expected[y0:y1,x0:x1]=rgb[y0:y1,x0:x1,0]>0
    assert np.array_equal(m[0],expected)

def test_point_only_fallback_and_multiple_boxes_reject_full_image():
    rgb=np.zeros((32,48,3),np.uint8);p={'points':[[2,3,1]],'box':None};model=PixelModel()
    _,_,_,x,_=predict_regions(model,rgb,p,'context_crop');assert x['strategy']=='full_image' and model.calls[0][0].shape==rgb.shape
    with pytest.raises(SegmentationError):predict_regions(model,rgb,{'points':[],'box':[1,1,5,5],'additional_boxes':[[8,8,12,12]]},'full_image')

def test_quality_deprioritizes_prompt_violations_not_model_score_and_keeps_masks():
    small=np.zeros((40,40),bool);small[10:20,10:20]=True;masks=[np.ones((40,40),bool),small,small.copy()];before=[m.copy() for m in masks]
    candidates=[{'candidate_id':f'candidate-{i}','status':'ok','component_count':1,'model_score':score} for i,score in enumerate([.999,.5,.4])]
    order=inspect_candidates(candidates,masks,{'points':[[15,15,1],[30,30,0]],'box':[9,9,21,21]})
    assert order[0]=='candidate-1';assert candidates[0]['quality']['background_excluded']==[False]
    assert {'LARGE_MASK','OUTSIDE_BOX','BACKGROUND_INCLUDED','BOX_AREA_EXCESS'}<=set(candidates[0]['quality']['warnings'])
    assert 'SIMILAR_CANDIDATES' in candidates[1]['quality']['warnings']
    assert all(np.array_equal(a,b) for a,b in zip(masks,before))

def stroke(mode='add',radius=.1,points=None):return {'mode':mode,'radius':radius,'points':points or [{'x':.25,'y':.5}]}

def test_brush_uses_pixel_metric_preserves_original_and_replays_undo():
    original=np.zeros((20,40),bool);original[0,0]=True;original[-1,-1]=True;before=original.copy()
    strokes=[stroke(points=[{'x':.25,'y':.5},{'x':.75,'y':.5}]),stroke('erase',.05,[{'x':.5,'y':.5}])]
    added=apply_strokes(original,strokes[:1]);edited=apply_strokes(original,strokes)
    yy,xx=np.mgrid[:20,:40];dx=np.maximum(np.maximum(10-(xx+.5),0),(xx+.5)-30)
    expected=((yy+.5-10)**2+dx**2<=4)|original
    assert np.array_equal(added,expected) and not edited[10,20]
    assert np.array_equal(original,before) and np.array_equal(apply_strokes(original,[]),before)
    assert np.array_equal(apply_strokes(original,strokes[:1]),added)
    c=mask_to_polygons(edited);assert c['component_count']==3 and c['hole_count']==1
    assert np.array_equal(raster(c['geometry'],20,40),edited)

@pytest.mark.parametrize('bad',[None,[None],[stroke(radius=0)],[stroke(radius=float('nan'))],[stroke(points=[{'x':2,'y':.5}])],[stroke(points=[{'x':True,'y':.5}])],[stroke()]*33])
def test_invalid_brush_is_explicit(bad):
    with pytest.raises(SegmentationError):apply_strokes(np.zeros((20,40),bool),bad)

def test_brush_touching_border_and_one_pixel_component_survive():
    raw=np.zeros((100,200),bool);raw[50,100]=True
    edited=apply_strokes(raw,[stroke(points=[{'x':0,'y':0}])]);assert edited[0,0] and edited[50,100]
    c=mask_to_polygons(edited);assert c['component_count']==2 and np.array_equal(raster(c['geometry'],100,200),edited)

def test_edit_confirm_undo_exact_masks_private_assets_and_no_extra_inference(client):
    url,h,p=start(client);result=client.post(url+'/segment',headers=h,json=payload(p)).json()
    base=dict(photo_id=p['photo_id'],result_id=result['result_id'],candidate_id='candidate-0',prompt_revision=1)
    asset=lambda name,headers=h:client.get(url+'/assets/'+name,headers=headers,params={'result_id':result['result_id']})
    original=asset('candidate-0-mask.png').content;raw=np.asarray(Image.open(io.BytesIO(original)))==255
    strokes=[stroke(points=[{'x':.5,'y':.5}])]
    request={**base,'edit_revision':1,'coordinate_space':'photo_oriented_normalized_v1','strokes':strokes}
    r=client.post(url+'/edit',headers=h,json=request);assert r.status_code==200,r.text
    assert client.post(url+'/edit',headers=h,json=request).json()==r.json()  # retry idempotent
    assert client.post(url+'/edit',headers=h,json={**request,'strokes':[]}).status_code==409
    assert client.post(url+'/confirm',headers=h,json=base).status_code==409
    confirmed=client.post(url+'/confirm',headers=h,json={**base,'edit_revision':1}).json()
    edited=np.asarray(Image.open(io.BytesIO(asset(confirmed['mask_asset']).content)))==255
    assert np.array_equal(edited,apply_strokes(raw,strokes)) and np.array_equal(raster(confirmed['geometry'],24,32),edited)
    assert confirmed['correction']['original_mask_sha256']==hashlib.sha256(original).hexdigest()
    assert asset('candidate-0-mask.png').content==original
    assert asset(confirmed['mask_asset'],{'x-ai-session-key':'foreign'}).status_code==410
    assert client.post(url+'/edit',headers=h,json={**request,'edit_revision':2,'strokes':[]}).status_code==200
    assert asset('candidate-0-edit-1-mask.png').status_code==404
    assert asset('candidate-0-edit-2-mask.png').content==original
    from app.main import app
    assert len(app.state.ai_sessions.model.calls)==1
    assert client.delete(url,headers=h).status_code==204
    assert asset('candidate-0-mask.png').status_code==410

@pytest.mark.parametrize('change',[{'coordinate_space':'body_normalized'},{'edit_revision':0},{'strokes':[stroke(radius=2)]},{'strokes':[stroke(points=[{'x':-1,'y':.5}])]}])
def test_edit_invalid_contract(client,change):
    url,h,p=start(client);r=client.post(url+'/segment',headers=h,json=payload(p)).json()
    q=dict(photo_id=p['photo_id'],result_id=r['result_id'],candidate_id='candidate-0',prompt_revision=1,edit_revision=1,coordinate_space='photo_oriented_normalized_v1',strokes=[stroke()]);q.update(change)
    assert client.post(url+'/edit',headers=h,json=q).status_code==422

def test_crop_edge_is_reported_without_shrinking_prediction():
    from ai.segmentation import segment_image
    from ai.preprocessing.image import PreparedImage
    rgb=np.full((100,100,3),255,np.uint8)
    model=PixelModel();model.metadata={'name':'synthetic'}
    r=segment_image(PreparedImage(rgb,{'width':100,'height':100}),{'coordinate_space':'photo_oriented_pixels_v1','box':[40,40,60,60],'points':[]},model=model,strategy='context_crop')
    assert 'CROP_EDGE' in r.record['candidates'][0]['quality']['warnings']
    assert r.masks[0].sum()==52*52

def test_empty_edit_refuses_confirmation_and_restore_keeps_raw(client):
    url,h,p=start(client);r=client.post(url+'/segment',headers=h,json=payload(p)).json()
    q=dict(photo_id=p['photo_id'],result_id=r['result_id'],candidate_id='candidate-0',prompt_revision=1,edit_revision=1)
    strokes=[stroke('erase',.1,[{'x':x/32,'y':y/24} for x in range(0,11)]) for y in (0,3,6,9)]
    strokes.append(stroke('erase',.1,[{'x':1,'y':1}]))
    edited=client.post(url+'/edit',headers=h,json={**q,'coordinate_space':'photo_oriented_normalized_v1','strokes':strokes});assert edited.status_code==200,edited.text
    assert edited.json()['candidate']['status']=='empty_mask'
    assert client.post(url+'/confirm',headers=h,json=q).status_code==422
    assert client.post(url+'/edit',headers=h,json={**q,'coordinate_space':'photo_oriented_normalized_v1','edit_revision':2,'strokes':[]}).status_code==200
    assert client.post(url+'/confirm',headers=h,json={**q,'edit_revision':2}).status_code==200

def test_deleted_session_during_brush_does_not_recreate_files(service,monkeypatch):
    from test_service import png
    from app.schemas.ai import SegmentRequest,EditRequest
    from app.services.ai_sessions import AIError
    from concurrent.futures import ThreadPoolExecutor
    import threading
    import ai.postprocessing.brush as brush_module
    s,_=service;c=s.create();p=s.upload(c['session_id'],c['session_token'],png());r=s.segment(c['session_id'],c['session_token'],SegmentRequest(**payload(p)))
    entered=threading.Event();release=threading.Event();actual=brush_module.apply_strokes
    def delayed(*args):entered.set();release.wait(3);return actual(*args)
    monkeypatch.setattr(brush_module,'apply_strokes',delayed)
    q=EditRequest(coordinate_space='photo_oriented_normalized_v1',photo_id=p['photo_id'],result_id=r['result_id'],candidate_id='candidate-0',prompt_revision=1,edit_revision=1,strokes=[stroke()])
    with ThreadPoolExecutor() as pool:
        future=pool.submit(s.edit,c['session_id'],c['session_token'],q);assert entered.wait(3);s.delete(c['session_id'],c['session_token']);release.set()
        with pytest.raises(AIError):future.result()
    assert not (s.root/c['session_id']).exists()

def test_normalized_roundtrip_does_not_move_integer_crop_edges_by_a_pixel():
    rgb=np.zeros((460,700,3),np.uint8);rgb[250:300,220:450,0]=255;box=[215,245,495,385]
    m1,_,_,t1,_=predict_regions(PixelModel(),rgb,{'box':box,'points':[]},'context_crop')
    converted=[v/d*d for v,d in zip(box,[700,460,700,460])]
    m2,_,_,t2,_=predict_regions(PixelModel(),rgb,{'box':converted,'points':[]},'context_crop')
    assert t1['regions'][0]['crop_xyxy']==t2['regions'][0]['crop_xyxy'] and np.array_equal(m1,m2)
