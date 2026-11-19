"""Public, synthetic-data smoke for the deployed backend delta."""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import httpx
from shapely.geometry import MultiPolygon, Point, mapping


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = "http://212.64.26.206/dermatome-test"
rows: list[dict] = []


def check(client: httpx.Client, name: str, method: str, path: str, expected: int = 200, **kwargs):
    started = time.perf_counter()
    response = client.request(method, path, **kwargs)
    row = {
        "name": name,
        "status": response.status_code,
        "expected": expected,
        "ms": round((time.perf_counter() - started) * 1000, 2),
    }
    rows.append(row)
    if response.status_code != expected:
        try:
            row["error"] = response.json().get("error")
        except ValueError:
            row["body"] = response.text[:300]
        raise AssertionError(row)
    time.sleep(0.3)
    return response


def identity(folder: str, body_name: str) -> dict:
    manifest = json.loads(
        (ROOT / "data/atlas" / folder / "manifest.json").read_text()
    )
    body_blob = (ROOT / "data/body" / body_name).read_bytes()
    return {
        "template_id": manifest["templateId"],
        "template_version": manifest["templateVersion"],
        "geometry_id": manifest["geometryId"],
        "region_set_id": manifest["regionSetId"],
        "atlas_id": manifest["atlasId"],
        "atlas_version": manifest["atlasVersion"],
        "atlas_content_sha256": manifest["contentSHA256"],
        "body_content_sha256": hashlib.sha256(body_blob).hexdigest(),
        "coordinate_system": "normalized_2d_top_left",
    }


def evaluate_payload(geometry, view: str, atlas_identity: dict, request_id: str) -> dict:
    if geometry.geom_type == "Polygon":
        geometry = MultiPolygon([geometry])
    coordinates = [
        [[{"x": x, "y": y} for x, y in ring] for ring in polygon]
        for polygon in mapping(geometry)["coordinates"]
    ]
    return {
        "request_id": request_id,
        "annotation_revision": 1,
        "identity": atlas_identity,
        "lesions": [
            {
                "id": "SYNTHETIC_" + request_id,
                "view": view,
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinateSpace": "body_template_normalized_v1",
                    "coordinates": coordinates,
                },
            }
        ],
    }


with httpx.Client(base_url=BASE, trust_env=False, timeout=35) as client:
    check(client, "health", "GET", "/api/v1/health")
    check(client, "anonymous_ready_rejected", "GET", "/api/v1/ready", 401)
    token = check(
        client,
        "automatic_test_access",
        "POST",
        "/api/v1/access/session",
        json={},
    ).json()["access_token"]
    headers = {"authorization": "Bearer " + token}
    try:
        ready = check(
            client, "authenticated_ready", "GET", "/api/v1/ready", headers=headers
        ).json()
        assert ready["status"] == "ready"
        assert ready["medical_review"] == "pending"
        assert ready["diagnosis_enabled"] is False
        rows[-1]["ai_model_loaded"] = ready["ai_model_loaded"]

        body = json.loads(
            (ROOT / "data/body/commons-template4-hands-v2.json").read_text()
        )["views"]["front"]
        ring = [
            {"x": 0.48, "y": 0.30},
            {"x": 0.52, "y": 0.30},
            {"x": 0.52, "y": 0.34},
            {"x": 0.48, "y": 0.34},
            {"x": 0.48, "y": 0.30},
        ]
        intersection_payload = {
            "view": "front",
            "template_id": body["templateId"],
            "template_version": body["templateVersion"],
            "geometry_id": body["geometryId"],
            "region_set_id": body["regionSetId"],
            "geometry": {
                "type": "MultiPolygon",
                "coordinateSpace": "body_template_normalized_v1",
                "coordinates": [[ring]],
            },
        }
        intersection = check(
            client,
            "body_intersection_inside",
            "POST",
            "/api/v1/evaluate/body-intersection",
            headers=headers,
            json=intersection_payload,
        ).json()
        assert intersection["method"] == "body_intersection_v1"
        assert intersection["status"] == "inside"
        assert intersection["geometry"] is not None
        rows[-1]["result_status"] = intersection["status"]

        perineum_identity = identity("perineum-schematic-v1", "perineum-v1.json")
        perineum_requests = [
            (
                "perineum_s2",
                evaluate_payload(
                    Point(0.14, 0.20).buffer(0.0015),
                    "perineum-overview",
                    perineum_identity,
                    "BACKEND_CURRENT_PERINEUM_S2",
                ),
                {"S2"},
            ),
            (
                "perineum_undefined",
                evaluate_payload(
                    Point(0.50, 0.325).buffer(0.0015),
                    "perineum-overview",
                    perineum_identity,
                    "BACKEND_CURRENT_PERINEUM_UNDEFINED",
                ),
                {"UNDEFINED"},
            ),
        ]
        for name, payload, expected_labels in perineum_requests:
            result = check(
                client,
                name,
                "POST",
                "/api/v1/evaluate",
                headers=headers,
                json=payload,
            ).json()
            labels = {
                candidate["label"]
                for view in result["views"]
                for candidate in view["candidates"]
            }
            assert labels == expected_labels, (name, labels)
            assert result["source"]["atlas_type"] == "SCHEMATIC"
            assert result["source"]["review_status"] == "NOT_MEDICALLY_VALIDATED"
            rows[-1]["labels"] = sorted(labels)

        stale = json.loads(json.dumps(perineum_requests[0][1]))
        stale["request_id"] = "BACKEND_CURRENT_STALE"
        stale["identity"]["atlas_version"] = "stale"
        rejected = check(
            client,
            "stale_version_rejected",
            "POST",
            "/api/v1/evaluate",
            409,
            headers=headers,
            json=stale,
        ).json()
        assert rejected["error"]["code"] == "VERSION_MISMATCH"

        created = check(
            client,
            "ai_session_create",
            "POST",
            "/api/v1/ai/sessions",
            headers=headers,
            json={},
        ).json()
        sid = created["session_id"]
        session_key = created["session_token"]
        try:
            check(
                client,
                "ai_session_delete",
                "DELETE",
                f"/api/v1/ai/sessions/{sid}",
                204,
                headers={**headers, "x-ai-session-key": session_key},
            )
        finally:
            # A second DELETE verifies an already-removed session remains harmless.
            check(
                client,
                "ai_session_repeat_delete",
                "DELETE",
                f"/api/v1/ai/sessions/{sid}",
                204,
                headers={**headers, "x-ai-session-key": session_key},
            )
    finally:
        check(
            client,
            "access_revoke",
            "DELETE",
            "/api/v1/access/session",
            204,
            headers=headers,
        )

report = {
    "endpoint": BASE,
    "transport": "HTTP; public/synthetic data only",
    "checks": rows,
    "passed": len(rows),
    "failed": 0,
}
(OUT / "public-smoke.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n"
)
print(f"PASS: {len(rows)} public backend checks")
