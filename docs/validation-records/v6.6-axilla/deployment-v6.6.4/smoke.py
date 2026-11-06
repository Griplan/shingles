"""Public V6.6.4 HTTP verification using synthetic geometry only."""

import copy
import hashlib
import json
import time
from pathlib import Path

import httpx
from shapely.geometry import MultiPolygon, Point, mapping, shape


ROOT = Path.cwd()
OUT = ROOT / "docs/validation-records/v6.6-axilla/deployment-v6.6.4"
BASE = "http://212.64.26.206/dermatome-test"
rows = []
headers = {}


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
    time.sleep(0.25)
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


def polygon_request(geometry, view, atlas_identity, request_id):
    multipolygon = (
        geometry
        if geometry.geom_type == "MultiPolygon"
        else MultiPolygon([geometry])
    )
    coordinates = [
        [
            [{"x": x, "y": y} for x, y in ring]
            for ring in polygon
        ]
        for polygon in mapping(multipolygon)["coordinates"]
    ]
    return {
        "request_id": request_id,
        "annotation_revision": 1,
        "identity": atlas_identity,
        "lesions": [
            {
                "id": "synthetic",
                "view": view,
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinateSpace": "body_template_normalized_v1",
                    "coordinates": coordinates,
                },
            }
        ],
    }


examples = json.loads(
    (
        ROOT
        / "docs/validation-records/v6.6-axilla/full-simulation/evidence/api-examples.json"
    ).read_text()
)

with httpx.Client(base_url=BASE, trust_env=False, timeout=30) as client:
    try:
        check(client, "health", "GET", "/api/v1/health")
        check(
            client,
            "anonymous_match_rejected",
            "POST",
            "/api/v1/evaluate",
            401,
            json=examples[0]["request"],
        )
        token = check(
            client,
            "bounded_test_session",
            "POST",
            "/api/v1/access/session",
            json={},
        ).json()["access_token"]
        headers = {"authorization": "Bearer " + token}
        ready = check(
            client,
            "authenticated_ready",
            "GET",
            "/api/v1/ready",
            headers=headers,
        ).json()
        assert (
            ready["identity"]["atlas_version"]
            == "goran-2022-commons-template4-preview.3"
        )

        for example in examples:
            response = check(
                client,
                example["request"]["request_id"],
                "POST",
                "/api/v1/evaluate",
                headers=headers,
                json=example["request"],
            ).json()
            assert response == example["response"]
            assert response["source"]["atlas_type"] == "SCHEMATIC"
            assert response["source"]["review_status"] == "NOT_MEDICALLY_VALIDATED"
            assert response["source"]["intended_use"] == "INTERACTIVE_SIMULATION"
            assert response["source"]["source_type"] == "ARTIFICIALLY_CONSTRUCTED"
            assert response["source"]["medical_review_status"] == "pending"
            assert response["source"]["disclaimer"]
            labels = {
                candidate["label"]
                for view in response["views"]
                for candidate in view["candidates"]
            }
            assert labels == {"T1", "T2", "T3"}
            rows[-1]["labels"] = sorted(labels)
            rows[-1]["coverage"] = [
                view["covered_ratio"] for view in response["views"]
            ]
            rows[-1]["atlas_type"] = response["source"]["atlas_type"]

        schematic_identity = examples[0]["request"]["identity"]
        for example in examples:
            request = example["request"]
            expected = example["response"]["lesions"]
            for lesion, expected_lesion in zip(request["lesions"], expected):
                single = {
                    **request,
                    "request_id": lesion["id"] + "-single",
                    "lesions": [lesion],
                }
                response = check(
                    client,
                    single["request_id"],
                    "POST",
                    "/api/v1/evaluate",
                    headers=headers,
                    json=single,
                ).json()
                labels = [candidate["label"] for candidate in response["lesions"][0]["candidates"]]
                assert labels == [
                    candidate["label"]
                    for candidate in expected_lesion["candidates"]
                ]
                rows[-1]["labels"] = labels

        for side in ["left", "right"]:
            view = "axilla-" + side
            regions = json.loads(
                (
                    ROOT
                    / "data/atlas/axilla-schematic-v1"
                    / (view + ".json")
                ).read_text()
            )["regions"]
            for region in regions:
                point = shape(region["geometry"]).representative_point()
                request = polygon_request(
                    point.buffer(0.0005),
                    view,
                    schematic_identity,
                    view + "-" + region["labelId"],
                )
                response = check(
                    client,
                    request["request_id"],
                    "POST",
                    "/api/v1/evaluate",
                    headers=headers,
                    json=request,
                ).json()
                assert [
                    candidate["label"]
                    for candidate in response["views"][0]["candidates"]
                ] == [region["labelId"]]

        hand_examples = json.loads(
            (
                ROOT
                / "docs/validation-records/v6.5-main-body-hand/evidence/hand-matching-examples.json"
            ).read_text()
        )
        for example in hand_examples:
            response = check(
                client,
                example["name"],
                "POST",
                "/api/v1/evaluate",
                headers=headers,
                json=example["request"],
            ).json()
            assert response == example["response"]

        sole_identity = identity("sole-v1", "sole-v1.json")
        for view, x, label in [
            ("sole-left", 0.35, "L5"),
            ("sole-right", 0.65, "L5"),
        ]:
            response = check(
                client,
                view,
                "POST",
                "/api/v1/evaluate",
                headers=headers,
                json=polygon_request(
                    Point(x, 0.21).buffer(0.002),
                    view,
                    sole_identity,
                    view,
                ),
            ).json()
            assert [
                match["label"] for match in response["views"][0]["candidates"]
            ] == [label]

        stale = copy.deepcopy(examples[0]["request"])
        stale["identity"]["atlas_version"] = "old"
        response = check(
            client,
            "stale_schematic_version_rejected",
            "POST",
            "/api/v1/evaluate",
            409,
            headers=headers,
            json=stale,
        ).json()
        assert response["error"]["code"] == "VERSION_MISMATCH"
    finally:
        if headers:
            check(
                client,
                "test_session_revoked",
                "DELETE",
                "/api/v1/access/session",
                204,
                headers=headers,
            )
        (OUT / "smoke.json").write_text(
            json.dumps(
                {
                    "endpoint": BASE,
                    "checks": rows,
                    "realPhone": "NOT_RUN",
                    "input": "synthetic geometry only",
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        )

print(f"PASSED {len(rows)} public HTTP checks; no credential logged")
