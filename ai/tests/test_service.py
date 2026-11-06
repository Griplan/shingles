"""Synthetic model doubles exercise transport/lifecycle; real-model evidence is separate."""
import io
import threading
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_sessions import AISessions, AIError
from app.schemas.ai import SegmentRequest

class SyntheticModel:
    metadata={'name':'synthetic-test-double','version':'test'}
    def __init__(self): self.calls=[]; self.wait=None
    def predict(self,rgb,prompts):
        self.calls.append((rgb.shape,prompts))
        if self.wait: self.wait[0].set();self.wait[1].wait(5)
        h,w=rgb.shape[:2];m=np.zeros((3,h,w),bool)
        m[0,1:8,1:8]=True;m[0,3:5,3:5]=False;m[0,-1,-1]=True
        m[1]=True
        return m,np.array([.5,.99,0.]),{},{}

def png(exif=False):
    im=Image.new('RGB',(32,24),(160,130,110));out=io.BytesIO()
    if exif:
        e=im.getexif();e[274]=6;im.save(out,'JPEG',exif=e)
    else: im.save(out,'PNG')
    return out.getvalue()

@pytest.fixture
def service(tmp_path):
    model=SyntheticModel();s=AISessions(tmp_path,model_factory=lambda:model)
    yield s,model
    s.close()

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('DERMATOME_ENV','test');monkeypatch.setenv('ENABLE_AI_SEGMENTATION','1');monkeypatch.setenv('AI_TEMP_ROOT',str(tmp_path))
    with TestClient(app,raise_server_exceptions=False) as c:
        app.state.ai_sessions.model_factory=SyntheticModel
        yield c

def start(c,photo=None):
    s=c.post('/api/v1/ai/sessions').json();url='/api/v1/ai/sessions/'+s['session_id'];header={'x-ai-session-key':s['session_token']}
    r=c.post(url+'/photo',headers=header,files={'file':('untrusted.exe',photo or png(),'text/plain')});assert r.status_code==200,r.text
    return url,header,r.json()

def payload(photo,revision=1):
    return dict(photo_id=photo['photo_id'],request_id='test-request',prompt_revision=revision,prompts={
        'coordinate_space':'photo_oriented_normalized_v1','points':[{'x':.2,'y':.3,'label':1},{'x':.9,'y':.8,'label':0}],
        'box':{'xMin':.1,'yMin':.1,'xMax':.6,'yMax':.7}})

def test_upload_exif_private_and_delete(client):
    url,h,p=start(client,png(True));assert (p['image']['width'],p['image']['height'])==(24,32)
    assert p['image']['exif_orientation']==6 and p['image']['orientation_applied']
    r=client.get(url+'/assets/photo.png',headers=h);assert r.status_code==200 and 'no-store' in r.headers['cache-control']
    im=Image.open(io.BytesIO(r.content));assert im.size==(24,32) and not im.getexif()
    assert client.get(url+'/assets/photo.png').status_code==410
    assert client.get(url+'/assets/photo.png',headers={'x-ai-session-key':'foreign'}).status_code==410
    assert client.delete(url,headers=h).status_code==204
    assert client.get(url+'/assets/photo.png',headers=h).status_code==410
    assert not list(app.state.ai_sessions.root.glob('[0-9a-f]'*32))

@pytest.mark.parametrize('blob',[b'garbage',b'<svg xmlns="http://www.w3.org/2000/svg"/>',b'GIF89a',b'\xff\xd8'])
def test_reject_corrupt_or_unsupported(client,blob):
    s=client.post('/api/v1/ai/sessions').json();r=client.post('/api/v1/ai/sessions/'+s['session_id']+'/photo',headers={'x-ai-session-key':s['session_token']},files={'file':('fake.jpg',blob,'image/jpeg')})
    assert r.status_code==422 and 'error' in r.json()

def test_actual_bytes_limit(client):
    s=client.post('/api/v1/ai/sessions').json();r=client.post('/api/v1/ai/sessions/'+s['session_id']+'/photo',headers={'x-ai-session-key':s['session_token']},content=b'x'*(20*1024*1024+65537))
    assert r.status_code==413

def test_candidates_confirm_exact_geometry_model_cached(client):
    url,h,p=start(client);r=client.post(url+'/segment',headers=h,json=payload(p));assert r.status_code==200,r.text
    out=r.json();assert len(out['candidates'])==3
    assert 'LARGE_MASK' in out['candidates'][1]['warnings'] and 'OUTSIDE_BOX' in out['candidates'][1]['warnings']
    assert out['candidates'][2]['status']=='empty_mask' and out['candidates'][0]['hole_count']==1 and out['candidates'][0]['component_count']==2
    s=app.state.ai_sessions;model=s.model
    assert model.calls[0][1]['points']==[[6.4,7.199999999999999,1],[28.8,19.200000000000003,0]]
    assert s.sessions[p['session_id']]['confirmed'] is None
    confirm=dict(photo_id=p['photo_id'],result_id=out['result_id'],candidate_id='candidate-0',prompt_revision=1)
    c=client.post(url+'/confirm',headers=h,json=confirm);assert c.status_code==200,c.text
    result=c.json();assert result['confirmed_by_user'] and result['coordinate_space']=='photo_oriented_normalized_v1'
    assert result['geometry']==s.sessions[p['session_id']]['result']['record']['candidates'][0]['geometry']
    assert len(result['geometry']['coordinates'])==2 and len(result['geometry']['coordinates'][0])==2
    assert client.get(url+'/assets/'+result['mask_asset'],params={'result_id':out['result_id']},headers=h).status_code==200
    confirm['candidate_id']='candidate-2';assert client.post(url+'/confirm',headers=h,json=confirm).status_code==422
    assert client.post(url+'/segment',headers=h,json=payload(p,2)).status_code==200 and s.model is model and len(model.calls)==2
    confirm['candidate_id']='candidate-0';assert client.post(url+'/confirm',headers=h,json=confirm).status_code==409
    assert client.get(url+'/assets/candidate-0-alpha.png',params={'result_id':out['result_id']},headers=h).status_code==404

@pytest.mark.parametrize('change',[{'box':{'xMin':.8,'yMin':.2,'xMax':.2,'yMax':.5}}, {'box':None,'points':[]},
 {'points':[{'x':1,'y':.4,'label':1}]},{'points':[{'x':-.1,'y':.5,'label':0}]},{'coordinate_space':'body_normalized'},
 {'points':[{'x':.2,'y':.3,'label':True}]}])
def test_invalid_prompt_contract(client,change):
    url,h,p=start(client);q=payload(p);q['prompts'].update(change)
    assert client.post(url+'/segment',headers=h,json=q).status_code==422

def test_failure_explicit_and_manual_health_still_available(client):
    def fail(): raise ImportError('private/path')
    app.state.ai_sessions.model_factory=fail
    url,h,p=start(client);r=client.post(url+'/segment',headers=h,json=payload(p))
    assert r.status_code==503 and 'private/path' not in r.text
    assert client.get('/api/v1/health').status_code==200

def test_ttl_and_restart_cleanup(tmp_path):
    now=[0];s=AISessions(tmp_path,clock=lambda:now[0],ttl=10);c=s.create();s.upload(c['session_id'],c['session_token'],png())
    now[0]=11;s.sweep();assert not s.sessions and not (s.root/c['session_id']).exists();s.close()
    stale=tmp_path/'v5-ai-sessions'/('a'*32);stale.mkdir();(stale/'photo.png').write_bytes(png())
    s=AISessions(tmp_path);assert not stale.exists();s.close()

def test_cancel_during_prediction_does_not_recreate_files(service):
    s,m=service;c=s.create();p=s.upload(c['session_id'],c['session_token'],png());started,finish=threading.Event(),threading.Event();m.wait=(started,finish)
    with ThreadPoolExecutor() as pool:
        future=pool.submit(s.segment,c['session_id'],c['session_token'],SegmentRequest(**payload(p)))
        assert started.wait(5);s.delete(c['session_id'],c['session_token']);finish.set()
        with pytest.raises(AIError) as e:future.result()
        assert e.value.code=='AI_SESSION_GONE'
    assert not (s.root/c['session_id']).exists()

def test_timeout_invalidates_only_request_and_late_result(service):
    s,m=service;c=s.create();p=s.upload(c['session_id'],c['session_token'],png());started,finish=threading.Event(),threading.Event();m.wait=(started,finish)
    with ThreadPoolExecutor() as pool:
        f=pool.submit(s.segment,c['session_id'],c['session_token'],SegmentRequest(**payload(p)))
        assert started.wait(5)
        s.invalidate(c['session_id'],c['session_token'],'different');assert s.sessions[c['session_id']]['operation']
        s.invalidate(c['session_id'],c['session_token'],'test-request');finish.set()
        with pytest.raises(AIError) as e:f.result()
        assert e.value.code=='STALE_RESULT' and s.sessions[c['session_id']]['result'] is None

def test_http_timeout(client,monkeypatch):
    import time
    import app.api.routes.ai as routes
    monkeypatch.setattr(routes,'TIMEOUT',.01)
    def slow(*args):time.sleep(.05)
    monkeypatch.setattr(app.state.ai_sessions,'segment',slow)
    url,h,p=start(client);r=client.post(url+'/segment',headers=h,json=payload(p));assert r.status_code==504

def test_production_disabled_before_upload(client,monkeypatch):
    monkeypatch.setenv('DERMATOME_ENV','production');assert client.post('/api/v1/ai/sessions',content=b'garbage').status_code==403

def test_single_owner(service):
    s,_=service
    with pytest.raises(BlockingIOError):AISessions(s.root.parent)

def test_fragmented_similar_masks_are_warned_without_edit(service):
    s,m=service;c=s.create();p=s.upload(c['session_id'],c['session_token'],png())
    def predict(rgb,prompts):
        h,w=rgb.shape[:2];mask=np.zeros((h,w),bool);mask[::2,::2]=True
        return np.stack([mask,mask,np.zeros_like(mask)]),np.array([.9,.8,0]),{},{}
    m.predict=predict
    r=s.segment(c['session_id'],c['session_token'],SegmentRequest(**payload(p)))
    assert 'FRAGMENTED' in r['candidates'][0]['warnings'] and 'SIMILAR_CANDIDATES' in r['candidates'][0]['warnings']
    raw=Image.open(io.BytesIO(s.asset(c['session_id'],c['session_token'],'candidate-0-mask.png',r['result_id'])))
    assert np.count_nonzero(raw)==192

def test_wrong_photo_and_older_revision_rejected(client):
    url,h,p=start(client);q=payload(p);q['photo_id']='f'*32
    assert client.post(url+'/segment',headers=h,json=q).status_code==409
    assert client.post(url+'/segment',headers=h,json=payload(p,5)).status_code==200
    assert client.post(url+'/segment',headers=h,json=payload(p,4)).status_code==409

def test_oriented_prepared_input_does_not_apply_upload_cap_twice(service):
    from ai.preprocessing.image import PreparedImage
    from ai.segmentation import segment_image
    s,m=service
    rgb=np.zeros((8,10,3),np.uint8)
    result=segment_image(PreparedImage(rgb,{'width':10,'height':8}),{'coordinate_space':'photo_oriented_pixels_v1','box':[0,0,10,8]},model=m)
    assert result.masks[0].shape==(8,10)
