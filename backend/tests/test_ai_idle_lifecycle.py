"""Idle deadlines, active-worker protection, disk reclamation and restart."""
from app.services.ai_sessions import AISessions, AIError
import pytest


def test_default_idle_ttl_is_five_minutes(tmp_path, monkeypatch):
    monkeypatch.delenv("AI_IDLE_SECONDS", raising=False)
    service = AISessions(tmp_path)
    created = service.create()
    assert service.ttl == 300
    assert created["expires_at"] - service.sessions[created["session_id"]]["last_activity_at"] == pytest.approx(300)
    service.close()


def test_activity_slides_idle_deadline_and_sweep_reclaims_without_request(tmp_path):
    now=[100.0]
    service=AISessions(tmp_path,clock=lambda:now[0],ttl=10)
    s=service.create();sid=s['session_id'];token=s['session_token']
    now[0]=109
    assert service.get(sid,token)['expires_at']==119
    now[0]=115;service.sweep()
    assert sid in service.sessions
    now[0]=120;service.sweep()
    assert sid not in service.sessions and not (service.root/sid).exists()
    service.delete(sid,token)  # Repeated deletion is safe.
    service.close()


def test_inflight_session_survives_sweep_delete_prevents_late_publish(tmp_path):
    now=[0.0];service=AISessions(tmp_path,clock=lambda:now[0],ttl=2)
    s=service.create();sid=s['session_id'];token=s['session_token']
    service.active_sessions.add(sid);now[0]=10;service.sweep()
    assert sid in service.sessions
    service.delete(sid,token)
    assert not (service.root/sid).exists()
    with pytest.raises(AIError):service.get(sid,token)
    service.active_sessions.discard(sid);service.close()


def test_idle_state_restored_with_last_activity_and_stopped_cleanup(tmp_path,monkeypatch):
    monkeypatch.setenv('DERMATOME_ENV','controlled')
    now=[100.0];service=AISessions(tmp_path,clock=lambda:now[0],ttl=10)
    s=service.create();now[0]=109;service.get(s['session_id'],s['session_token']);service.close()
    now[0]=115;restored=AISessions(tmp_path,clock=lambda:now[0],ttl=10)
    assert s['session_id'] in restored.sessions
    restored.close()
    from deployment.cleanup import cleanup
    cleanup(restored.root,now=120)
    assert not (restored.root/s['session_id']).exists()


def test_stopped_cleanup_uses_five_minute_fallback_for_unreadable_state(tmp_path):
    from deployment.cleanup import cleanup

    root = tmp_path / "v5-ai-sessions"
    root.mkdir()
    stale = root / ("a" * 32)
    stale.mkdir()
    (stale / "upload.bin").write_bytes(b"temporary")
    import os
    os.utime(stale, (100, 100))

    cleanup(root, now=399)
    assert stale.exists()
    cleanup(root, now=400)
    assert not stale.exists()


def test_controlled_capacity_is_released_by_delete_and_idle_sweep(tmp_path, monkeypatch):
    monkeypatch.setenv("DERMATOME_ENV", "controlled")
    now = [100.0]
    service = AISessions(tmp_path, clock=lambda: now[0], ttl=10)
    first = service.create(owner_id="a")
    second = service.create(owner_id="b")
    with pytest.raises(AIError) as capacity:
        service.create(owner_id="a")
    assert capacity.value.code == "AI_CAPACITY"

    sid = first["session_id"]
    (service.root / sid / "photo.png").write_bytes(b"synthetic placeholder")
    service.delete(sid, first["session_token"])
    assert not (service.root / sid).exists()
    now[0] = 106
    third = service.create(owner_id="a")
    now[0] = 111
    service.sweep()
    assert not (service.root / second["session_id"]).exists()
    assert third["session_id"] in service.sessions
    assert service.create(owner_id="b")
    service.close()
