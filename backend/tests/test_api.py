"""验证 V0 业务入口明确返回未实现，不输出伪造结果。"""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_atlas_is_not_implemented() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/atlas")

    assert response.status_code == 501
    assert response.json() == {
        "error": {
            "code": "NOT_IMPLEMENTED",
            "message": "图谱查询尚未实现；V0 不提供可用于医学映射的图谱。",
        }
    }


@pytest.mark.parametrize("payload", [{}, [], "placeholder", 1, True, None])
def test_evaluate_default_disabled_before_parsing(payload, monkeypatch):
    monkeypatch.delenv('DERMATOME_ENV',raising=False)
    monkeypatch.delenv('ENABLE_REFERENCE_MATCHING',raising=False)
    with TestClient(app) as client:
        response=client.post('/api/v1/evaluate',json=payload)
    assert response.status_code==403
    assert response.json()['error']['code']=='MATCHING_DISABLED'


def test_openapi_declares_v4_request_and_real_response():
    with TestClient(app) as client:
        operation=client.get('/openapi.json').json()['paths']['/api/v1/evaluate']['post']
    assert operation['requestBody']['content']['application/json']['schema']['$ref'].endswith('EvaluateRequest')
    assert operation['responses']['200']['content']['application/json']['schema']['$ref'].endswith('EvaluateResponse')
