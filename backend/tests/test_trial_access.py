import io
import json
from concurrent.futures import ThreadPoolExecutor
import hashlib
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.trial_access import TrialAccess
from app.services.ai_sessions import AIError

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(app,'middleware_stack',None)
    monkeypatch.delenv('ENABLE_PUBLIC_TEST_ACCESS',raising=False)
    monkeypatch.setenv('DERMATOME_ENV','controlled')
    monkeypatch.setenv('API_ACCESS_SHA256',hashlib.sha256(b'synthetic-operator-key').hexdigest())
    monkeypatch.setenv('ENABLE_AI_SEGMENTATION','1');monkeypatch.setenv('ENABLE_REFERENCE_MATCHING','1')
    monkeypatch.setenv('AI_TEMP_ROOT',str(tmp_path))
    with TestClient(app) as c:yield c

def login(client):
    invitation=app.state.trial_access.issue()['invitation']
    response=client.post('/api/v1/access/exchange',json={'invitation':invitation})
    assert response.status_code==200,response.text
    return {'authorization':'Bearer '+response.json()['access_token']},response.json()

def test_invitation_exchange_identity_is_server_issued_and_replay_rejected(client):
    code=app.state.trial_access.issue()['invitation']
    r=client.post('/api/v1/access/exchange',json={'invitation':code,'envVersion':'trial'})
    assert r.status_code==422
    r=client.post('/api/v1/access/exchange',json={'invitation':code})
    assert r.status_code==200 and 'no-store' in r.headers['cache-control']
    token=r.json()['access_token'];assert r.json()['expires_at']>0
    h={'authorization':'Bearer '+token}
    assert client.get('/api/v1/ready',headers=h).status_code==200
    assert client.post('/api/v1/access/exchange',json={'invitation':code}).status_code==401
    assert client.post('/api/v1/evaluate',json={'envVersion':'trial'}).status_code==401
    assert client.get('/api/v1/ready',headers=[(b'authorization',b'Bearer \xff')]).status_code==401
    raw=(app.state.trial_access.root/'state.json').read_text();assert code not in raw and token not in raw

def test_invitation_atomic_single_use_and_access_survives_service_restart(tmp_path):
    clock=[100.0];a=TrialAccess(tmp_path,clock=lambda:clock[0]);b=TrialAccess(tmp_path,clock=lambda:clock[0])
    invitation=a.issue()['invitation']
    def consume(service):
        try:return service.exchange(invitation)
        except AIError as e:return e.code
    with ThreadPoolExecutor(2) as executor:results=list(executor.map(consume,[a,b]))
    successes=[r for r in results if isinstance(r,dict)]
    assert len(successes)==1 and 'INVITATION_INVALID' in results
    token=successes[0]['access_token'];principal=a.verify(token)
    assert b.verify(token)==principal
    clock[0]+=3601;assert b.verify(token) is None
    code=a.issue()['invitation'];clock[0]+=601
    with pytest.raises(AIError,match=''):a.exchange(code)

def test_revoke_and_server_expiry(client):
    h,result=login(client)
    assert client.delete('/api/v1/access/session',headers=h).status_code==204
    assert client.get('/api/v1/ready',headers=h).status_code==401
    h,result=login(client);app.state.trial_access.clock=lambda:result['expires_at']+1
    assert client.get('/api/v1/ready',headers=h).status_code==401

def test_every_photo_action_is_bound_to_the_authorized_principal(client):
    a,_=login(client);b,_=login(client)
    created=client.post('/api/v1/ai/sessions',headers=a).json();url='/api/v1/ai/sessions/'+created['session_id']
    ah={**a,'x-ai-session-key':created['session_token']};bh={**b,'x-ai-session-key':created['session_token']}
    image=io.BytesIO();Image.new('RGB',(24,32)).save(image,'PNG')
    assert client.post(url+'/photo',headers=ah,files={'file':('synthetic.png',image.getvalue())}).status_code==200
    assert client.get(url+'/assets/photo.png',headers=bh).status_code==410
    assert client.delete(url,headers=bh).status_code==410
    assert client.post(url+'/photo',headers=bh,files={'file':('synthetic.png',image.getvalue())}).status_code==410
    for action in ['segment','edit','confirm']:
        # A valid schema must reach the per-photo owner check.
        photo=app.state.ai_sessions.sessions[created['session_id']]['photo_id']
        payload={'photo_id':photo,'request_id':'test','prompt_revision':1,'prompts':{'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':.1,'yMin':.1,'xMax':.9,'yMax':.9}}} if action=='segment' else {'photo_id':photo,'result_id':'r','candidate_id':'candidate-0','prompt_revision':1,'edit_revision':0}
        if action=='edit':payload.update(edit_revision=1,coordinate_space='photo_oriented_normalized_v1',strokes=[])
        assert client.post(url+'/'+action,headers=bh,json=payload).status_code==410
    assert client.get(url+'/assets/photo.png',headers=a).status_code==410
    assert client.get(url+'/assets/photo.png',headers=ah).status_code==200
    assert client.delete(url,headers=ah).status_code==204

def test_invitation_body_origin_and_request_rate(client):
    assert client.post('/api/v1/access/exchange',content=b'x'*4097).status_code==413
    assert client.post('/api/v1/access/exchange',headers={'origin':'https://untrusted.invalid'},json={'invitation':'x'*43}).status_code==403
    responses=[client.post('/api/v1/access/exchange',json={'invitation':'x'*43}) for _ in range(11)]
    assert responses[-1].status_code==429
    assert responses[-1].json()['error']['code']=='RATE_LIMITED'

def test_trial_service_capacity_is_bounded(tmp_path):
    s=TrialAccess(tmp_path)
    for _ in range(8):s.issue()
    with pytest.raises(AIError) as e:s.issue()
    assert e.value.status==429

def test_public_test_requires_explicit_server_switch_and_does_not_accept_client_identity(client,monkeypatch):
    assert client.post('/api/v1/access/session',json={}).status_code==403
    monkeypatch.setenv('ENABLE_PUBLIC_TEST_ACCESS','1')
    assert client.post('/api/v1/access/session',json={'envVersion':'trial'}).status_code==422
    r=client.post('/api/v1/access/session',json={})
    assert r.status_code==200 and 'no-store' in r.headers['cache-control']
    data=r.json();assert data['access_kind']=='public_test'
    h={'authorization':'Bearer '+data['access_token']}
    assert client.get('/api/v1/ready').status_code==401
    assert client.get('/api/v1/ready',headers=h).status_code==200
    assert data['access_token'] not in (app.state.trial_access.root/'state.json').read_text()
    assert client.delete('/api/v1/access/session',headers=h).status_code==204
    assert client.get('/api/v1/ready',headers=h).status_code==401

def test_public_sessions_keep_distinct_photo_owners(client,monkeypatch):
    monkeypatch.setenv('ENABLE_PUBLIC_TEST_ACCESS','1')
    a,b=[{'authorization':'Bearer '+client.post('/api/v1/access/session',json={}).json()['access_token']} for _ in range(2)]
    s=client.post('/api/v1/ai/sessions',headers=a).json();url='/api/v1/ai/sessions/'+s['session_id']
    ah={**a,'x-ai-session-key':s['session_token']};bh={**b,'x-ai-session-key':s['session_token']}
    image=io.BytesIO();Image.new('RGB',(24,32)).save(image,'PNG')
    assert client.post(url+'/photo',headers=ah,files={'file':('synthetic.png',image.getvalue())}).status_code==200
    assert client.get(url+'/assets/photo.png',headers=bh).status_code==410
    assert client.delete(url,headers=bh).status_code==410
    assert client.get(url+'/assets/photo.png',headers=ah).status_code==200
    assert client.delete(url,headers=ah).status_code==204

def test_public_session_body_origin_and_opening_rate_are_bounded(client,monkeypatch):
    monkeypatch.setenv('ENABLE_PUBLIC_TEST_ACCESS','1')
    assert client.post('/api/v1/access/session',content=b'x'*4097).status_code==413
    assert client.post('/api/v1/access/session',headers={'origin':'https://untrusted.invalid'},json={}).status_code==403
    responses=[client.post('/api/v1/access/session',json={}) for _ in range(11)]
    assert responses[-1].status_code==429
    assert responses[-1].json()['error']['code']=='RATE_LIMITED'

def test_public_test_capacity_expiry_and_production_rejection(tmp_path,monkeypatch):
    monkeypatch.setenv('DERMATOME_ENV','controlled');monkeypatch.setenv('ENABLE_PUBLIC_TEST_ACCESS','1')
    clock=[100.0];s=TrialAccess(tmp_path,clock=lambda:clock[0])
    sessions=[s.public_session() for _ in range(16)]
    assert len({r['access_token'] for r in sessions})==16
    with pytest.raises(AIError) as e:s.public_session()
    assert e.value.status==429
    restored=TrialAccess(tmp_path,clock=lambda:clock[0]);assert restored.verify(sessions[0]['access_token'])
    clock[0]+=3601;assert restored.verify(sessions[0]['access_token']) is None
    assert restored.public_session()['access_kind']=='public_test'
    monkeypatch.setenv('DERMATOME_ENV','production')
    with pytest.raises(AIError) as e:restored.public_session()
    assert e.value.code=='PUBLIC_TEST_DISABLED'
