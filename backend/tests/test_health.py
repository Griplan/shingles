"""验证 V0 健康检查的真实 HTTP 契约。"""

from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_exact_v0_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "project": "dermatome-mapper",
        "version": "v0",
    }
