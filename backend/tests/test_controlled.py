import hashlib
import io
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_sessions import AISessions, AIError

KEY='synthetic-test-credential-0123456789abc'
@pytest.fixture
def controlled(tmp_path,monkeypatch):
    monkeypatch.setattr(app,'middleware_stack',None)
    monkeypatch.setenv('DERMATOME_ENV','controlled')
    monkeypatch.setenv('API_ACCESS_SHA256',hashlib.sha256(KEY.encode()).hexdigest())
    monkeypatch.setenv('ENABLE_AI_SEGMENTATION','1')
    monkeypatch.setenv('ENABLE_REFERENCE_MATCHING','1')
    monkeypatch.setenv('AI_TEMP_ROOT',str(tmp_path))
    with TestClient(app) as c: yield c,{'x-test-access-key':KEY},tmp_path

def test_controlled_auth_schema_and_origin(controlled):
    c,h,_=controlled
    assert c.get('/api/v1/health').status_code==200
    assert c.get('/api/v1/ready').status_code==401
    assert c.post('/api/v1/evaluate',json={}).status_code==401
    for path in ['/docs','/openapi.json','/redoc']:
        assert c.get(path,headers=h).status_code==404
    assert c.post('/api/v1/ai/sessions',headers={**h,'origin':'https://untrusted.invalid'}).status_code==403
    r=c.get('/api/v1/ready',headers=h)
    assert r.status_code==200,r.text
    assert r.json()['medical_review']=='pending' and r.json()['ai_model_loaded'] is False
    assert 'no-store' in r.headers['cache-control']

def test_controlled_fail_closed_missing_hash(controlled,monkeypatch):
    c,h,_=controlled;monkeypatch.delenv('API_ACCESS_SHA256')
    assert c.post('/api/v1/ai/sessions',headers=h).status_code==401

def test_controlled_rate_limit(controlled):
    c,h,_=controlled
    responses=[c.post('/api/v1/ai/sessions',headers=h) for _ in range(9)]
    assert [r.status_code for r in responses[:2]]==[200,200]
    assert responses[-1].status_code==429
    assert responses[-1].json()['error']['code']=='RATE_LIMITED'
    assert responses[-1].headers['retry-after']=='60'

def test_controlled_pixels_and_private_session_restart(controlled):
    c,h,root=controlled
    s=c.post('/api/v1/ai/sessions',headers=h).json()
    url='/api/v1/ai/sessions/'+s['session_id'];auth={**h,'x-ai-session-key':s['session_token']}
    out=io.BytesIO();Image.new('RGB',(2000,1600)).save(out,'PNG')
    assert c.post(url+'/photo',headers=auth,files={'file':('large.png',out.getvalue())}).status_code==422
    out=io.BytesIO();Image.new('RGB',(32,24)).save(out,'PNG')
    assert c.post(url+'/photo',headers=auth,files={'file':('small.png',out.getvalue())}).status_code==200
    original=c.get(url+'/assets/photo.png',headers=auth).content
    old=app.state.ai_sessions;old.close()
    restored=AISessions(root)
    app.state.ai_sessions=restored
    assert restored.asset(s['session_id'],s['session_token'],'photo.png')==original
    with pytest.raises(AIError):restored.get(s['session_id'],'foreign')
    restored.delete(s['session_id'],s['session_token'])
    assert not (restored.root/s['session_id']).exists()

def test_controlled_actual_upload_bytes(controlled):
    c,h,_=controlled
    # Rejected by the ASGI boundary, before multipart decode.
    r=c.post('/api/v1/ai/sessions/nonexistent/photo',headers=h,content=b'x'*(10*1024*1024+65537))
    assert r.status_code==413

def test_controlled_expiry_and_cleanup_respects_lock(controlled):
    c,h,root=controlled
    service=app.state.ai_sessions
    s=service.create();sid=s['session_id']
    service.sessions[sid]['expires_at']=0;service._persist(sid,service.sessions[sid])
    from importlib.util import spec_from_file_location,module_from_spec
    from pathlib import Path
    spec=spec_from_file_location('cloud_cleanup',Path(__file__).resolve().parents[2]/'deployment/cleanup.py')
    module=module_from_spec(spec);spec.loader.exec_module(module)
    module.cleanup(service.root,now=1)
    assert (service.root/sid).exists(),'Cannot delete an active service owned directory'
    service.close()
    module.cleanup(service.root,now=1)
    assert not (service.root/sid).exists()
    valid=service.root/('a'*32);valid.mkdir();(valid/'session.json').write_text('{"expires_at": 20}')
    outside=root/'outside';outside.mkdir();link=service.root/('b'*32);link.symlink_to(outside,target_is_directory=True)
    module.cleanup(service.root,now=10)
    assert valid.exists() and outside.exists() and link.is_symlink()
    # Prevent fixture shutdown from attempting a second close of the same instance.
    app.state.ai_sessions=None

def test_controlled_invalidation_is_durable(controlled):
    _,_,root=controlled;service=app.state.ai_sessions
    created=service.create();sid=created['session_id'];s=service.sessions[sid]
    s.update(request_id='late',result={'synthetic':'not a mask'},confirmed={'synthetic':True})
    service._persist(sid,s);service.invalidate(sid,created['session_token'],'late')
    service.close();restored=AISessions(root);app.state.ai_sessions=restored
    assert restored.get(sid,created['session_token'])['result'] is None
    assert restored.get(sid,created['session_token'])['confirmed'] is None


def test_controlled_authenticated_request_rate(controlled):
    c,h,_=controlled
    responses=[c.get('/api/v1/nonexistent',headers=h) for _ in range(121)]
    assert responses[0].status_code==404
    assert responses[-1].status_code==429
    assert responses[-1].json()['error']['code']=='RATE_LIMITED'
