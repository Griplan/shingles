"""Verify the public B entry with synthetic, non-medical geometry."""

from __future__ import annotations

import copy
import hashlib
import json
import time
from pathlib import Path

import httpx
from shapely.geometry import MultiPolygon, Point, mapping


ROOT = Path.cwd()
OUT = ROOT / "docs/validation-records/v6.7-perineum/deployment-v6.7"
BASE = "http://212.64.26.206/dermatome-test"
rows: list[dict] = []


def check(client, name, method, path, status=200, **kwargs):
    started = time.perf_counter()
    response = client.request(method, path, **kwargs)
    row = {
        "name": name,
        "status": response.status_code,
        "expected": status,
        "ms": round((time.perf_counter() - started) * 1000, 2),
    }
    rows.append(row)
    if response.status_code != status:
        try:
            row["error"] = response.json().get("error")
        except ValueError:
            row["body"] = response.text[:500]
        raise AssertionError(row)
    time.sleep(0.3)
    return response


def identity(folder, body):
    manifest = json.loads(
        (ROOT / "data/atlas" / folder / "manifest.json").read_text()
    )
    body_blob = (ROOT / "data/body" / body).read_bytes()
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


def request_for(geometry, view, atlas_identity, request_id):
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


perineum_identity = identity("perineum-schematic-v1", "perineum-v1.json")
requests = [
    (
        "perineum_s2",
        request_for(
            Point(0.14, 0.20).buffer(0.0015),
            "perineum-overview",
            perineum_identity,
            "PERINEUM_S2",
        ),
        {"S2"},
    ),
    (
        "perineum_undefined",
        request_for(
            Point(0.50, 0.325).buffer(0.0015),
            "perineum-overview",
            perineum_identity,
            "PERINEUM_UNDEFINED",
        ),
        {"UNDEFINED"},
    ),
]

with httpx.Client(base_url=BASE, trust_env=False, timeout=35) as client:
    check(client, "health", "GET", "/api/v1/health")
    check(
        client,
        "anonymous_match_rejected",
        "POST",
        "/api/v1/evaluate",
        401,
        json=requests[0][1],
    )
    token = check(
        client,
        "automatic_test_session",
        "POST",
        "/api/v1/access/session",
        json={},
    ).json()["access_token"]
    headers = {"authorization": "Bearer " + token}
    ready = check(
        client, "authenticated_ready", "GET", "/api/v1/ready", headers=headers
    ).json()
    for name, payload, expected in requests:
        result = check(
            client, name, "POST", "/api/v1/evaluate", headers=headers, json=payload
        ).json()
        labels = {
            candidate["label"]
            for view in result["views"]
            for candidate in view["candidates"]
        }
        assert labels == expected, (name, labels)
        source = result["source"]
        assert source["atlas_type"] == "SCHEMATIC"
        assert source["review_status"] == "NOT_MEDICALLY_VALIDATED"
        assert source["intended_use"] == "INTERACTIVE_SIMULATION"
        assert source["source_type"] == "ARTIFICIALLY_CONSTRUCTED"
        assert source["medical_review_status"] == "pending"
        rows[-1]["labels"] = sorted(labels)

    stale = copy.deepcopy(requests[0][1])
    stale["request_id"] = "STALE_PERINEUM"
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
    check(client, "session_cleanup", "DELETE", "/api/v1/access/session", 204, headers=headers)

(OUT / "smoke.json").write_text(
    json.dumps(
        {
            "endpoint": BASE,
            "checks": rows,
            "ready": ready,
            "transport": "HTTP; synthetic data only",
        },
        indent=2,
    )
    + "\n"
)
print("PASS:", len(rows), "public checks")
