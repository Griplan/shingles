from fastapi.testclient import TestClient

from app.main import app
from app.services.production_access import PREFIX, ProductionIdentity

OWNER_A = "test-openid-owner-a"
OWNER_B = "test-openid-owner-b"
LOGIN = PREFIX + "/api/v1/access/wechat"
SESSIONS = "/api/v1/ai/sessions"


def test_formal_login_scope_expiry_and_key_separation(monkeypatch, tmp_path):
    monkeypatch.setenv("DERMATOME_ENV", "controlled")
    monkeypatch.setenv("ENABLE_AI_SEGMENTATION", "1")
    monkeypatch.setenv("ENABLE_PUBLIC_TEST_ACCESS", "1")
    monkeypatch.setenv("API_ACCESS_SHA256", "a" * 64)
    monkeypatch.setenv("AI_TEMP_ROOT", str(tmp_path))
    now = [1000]
    received = []

    def exchange(appid, secret, code):
        received.append((appid, code))
        return {"owner-code-A": OWNER_A, "owner-code-B": OWNER_B}.get(code, "not-listed")

    identity = ProductionIdentity("wx1234567890abcdef", "synthetic", b"a" * 32,
                                  [OWNER_A, OWNER_B], exchange, lambda: now[0])
    monkeypatch.setattr(ProductionIdentity, "from_environment", classmethod(lambda cls: identity))
    with TestClient(app) as client:
        test_session = client.post("/api/v1/access/session", json={})
        assert test_session.status_code == 200
        legacy = {"authorization": "Bearer " + test_session.json()["access_token"]}
        assert client.post(PREFIX + SESSIONS, headers=legacy).status_code == 401
        invitation = app.state.trial_access.issue()["invitation"]
        invited = client.post("/api/v1/access/exchange", json={"invitation": invitation})
        assert invited.status_code == 200
        assert invited.json()["access_kind"] == "invited_trial"
        invited_headers = {"authorization": "Bearer " + invited.json()["access_token"]}
        assert client.post(PREFIX + SESSIONS, headers=invited_headers).status_code == 401
        assert client.post(PREFIX + SESSIONS, headers={"x-test-access-key": "test"}).status_code == 401
        assert client.post(LOGIN, json={"code": "other-code"}).status_code == 403
        assert client.post(LOGIN, json={"code": "owner-code-A", "openid": OWNER_A}).status_code == 422
        assert client.post(LOGIN, content=b"x" * 2049).status_code == 413

        def login(code):
            response = client.post(LOGIN, json={"code": code})
            assert response.status_code == 200, response.text
            assert response.headers["cache-control"] == "no-store"
            body = response.json()
            assert body["expires_at"] == now[0] + 900
            assert OWNER_A not in body["access_token"] and OWNER_B not in body["access_token"]
            return {"authorization": "Bearer " + body["access_token"]}

        a, b = login("owner-code-A"), login("owner-code-B")
        assert client.post(SESSIONS, headers=a).status_code == 401
        assert client.post("/api/v1/access/wechat", json={"code": "owner-code-A"}, headers=legacy).status_code == 404
        assert client.get(PREFIX + "/api/v1/ready", headers=a).status_code == 404
        wrong_app = ProductionIdentity("wx0000000000000000", "synthetic", b"a" * 32,
                                       [OWNER_A], exchange, lambda: now[0])
        wrong_key = ProductionIdentity(identity.appid, "synthetic", b"b" * 32,
                                       [OWNER_A], exchange, lambda: now[0])
        assert wrong_app.verify(a["authorization"].encode()) is None
        assert wrong_key.verify(a["authorization"].encode()) is None
        token = a["authorization"]
        tampered = token[:-4] + ("a" if token[-4] != "a" else "b") + token[-3:]
        assert client.post(PREFIX + SESSIONS, headers={"authorization": tampered}).status_code == 401
        created = client.post(PREFIX + SESSIONS, headers=a)
        assert created.status_code == 200, created.text
        entry = created.json()
        sid, key = entry["session_id"], entry["session_token"]
        url = f"{PREFIX}{SESSIONS}/{sid}"
        foreign = {**b, "x-ai-session-key": key}
        owned = {**a, "x-ai-session-key": key}
        active = app.state.ai_sessions.sessions[sid]["last_activity_at"]
        assert client.get(url + "/assets/photo.png", headers=foreign).status_code == 410
        assert client.delete(url, headers=foreign).status_code == 410
        assert app.state.ai_sessions.sessions[sid]["last_activity_at"] == active
        now[0] += 901
        assert client.delete(url, headers=owned).status_code == 401
        refreshed = {**login("owner-code-A"), "x-ai-session-key": key}
        assert client.delete(url, headers=refreshed).status_code == 204
        assert client.delete(url, headers=refreshed).status_code == 204
        assert not (app.state.ai_sessions.root / sid).exists()
        assert sid not in app.state.ai_sessions.sessions
        assert ("wx1234567890abcdef", "owner-code-A") in received


def test_formal_namespace_fails_closed_without_server_configuration(monkeypatch):
    monkeypatch.setenv("DERMATOME_ENV", "controlled")
    monkeypatch.delenv("ENABLE_PRODUCTION_ACCESS", raising=False)
    with TestClient(app) as client:
        assert client.post(LOGIN, json={"code": "owner-code-A"}).status_code == 503
        assert client.post(PREFIX + SESSIONS).status_code == 503
        assert client.get(PREFIX + "/docs").status_code == 404
        assert client.get("/api/v1/health").status_code == 200


def test_formal_environment_defaults_to_all_verified_wechat_users(monkeypatch):
    monkeypatch.setenv("ENABLE_PRODUCTION_ACCESS", "1")
    monkeypatch.setenv("DERMATOME_WECHAT_APP_ID", "wx1234567890abcdef")
    monkeypatch.setenv("DERMATOME_WECHAT_APP_SECRET", "a" * 32)
    monkeypatch.setenv("DERMATOME_PRODUCTION_SIGNING_KEY", "b" * 64)
    monkeypatch.delenv("DERMATOME_WECHAT_ALLOWED_OPENIDS", raising=False)

    identity = ProductionIdentity.from_environment()
    assert identity is not None
    assert identity.allowed is None
    identity.exchange = lambda appid, secret, code: {
        "code-a": "ordinary-user-openid-a",
        "code-b": "ordinary-user-openid-b",
    }.get(code)
    first = identity.login("code-a")
    second = identity.login("code-b")
    assert first and second
    owner_a = identity.verify(("Bearer " + first["access_token"]).encode())
    owner_b = identity.verify(("Bearer " + second["access_token"]).encode())
    assert owner_a and owner_b and owner_a != owner_b
    assert identity.login("unknown-code") is None


def test_optional_allowlist_still_restricts_controlled_preview(monkeypatch):
    monkeypatch.setenv("ENABLE_PRODUCTION_ACCESS", "1")
    monkeypatch.setenv("DERMATOME_WECHAT_APP_ID", "wx1234567890abcdef")
    monkeypatch.setenv("DERMATOME_WECHAT_APP_SECRET", "a" * 32)
    monkeypatch.setenv("DERMATOME_PRODUCTION_SIGNING_KEY", "b" * 64)
    monkeypatch.setenv("DERMATOME_WECHAT_ALLOWED_OPENIDS", OWNER_A + " " + OWNER_B)
    identity = ProductionIdentity.from_environment()
    assert identity is not None
    identity.exchange = lambda appid, secret, code: code
    assert identity.allowed == frozenset({OWNER_A, OWNER_B})
    assert identity.login(OWNER_A)
    assert identity.login("ordinary-user-openid-1234") is None
