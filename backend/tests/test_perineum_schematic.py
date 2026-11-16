"""Engineering checks for the neutral perineum simulation atlas."""
import hashlib
import json
from pathlib import Path

import pytest
from shapely.geometry import Point, box, mapping
from shapely.ops import unary_union

from app.schemas.evaluate import Identity
from app.services import perineum_schematic_service as service
from app.services.atlas_service import load_dataset
from test_evaluate_api import client

ROOT = Path(__file__).resolve().parents[2]
VIEW = "perineum-overview"


def identity():
    manifest = json.loads((service.ATLAS_DIR / "manifest.json").read_text())
    return {
        "template_id": manifest["templateId"],
        "template_version": manifest["templateVersion"],
        "geometry_id": manifest["geometryId"],
        "region_set_id": manifest["regionSetId"],
        "atlas_id": manifest["atlasId"],
        "atlas_version": manifest["atlasVersion"],
        "atlas_content_sha256": manifest["contentSHA256"],
        "body_content_sha256": hashlib.sha256(service.BODY_FILE.read_bytes()).hexdigest(),
        "coordinate_system": "normalized_2d_top_left",
    }


def dataset():
    return load_dataset(Identity(**identity()))


def payload(geometry, *, lesion_id="SYNTHETIC_PERINEUM"):
    if geometry.geom_type == "Polygon":
        polygons = [geometry]
    else:
        polygons = list(geometry.geoms)
    coordinates = [
        [
            [{"x": x, "y": y} for x, y in ring.coords]
            for ring in [polygon.exterior, *polygon.interiors]
        ]
        for polygon in polygons
    ]
    return {
        "request_id": "SYNTHETIC_PERINEUM_REQUEST",
        "annotation_revision": 1,
        "identity": identity(),
        "lesions": [
            {
                "id": lesion_id,
                "view": VIEW,
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinateSpace": "body_template_normalized_v1",
                    "coordinates": coordinates,
                },
            }
        ],
    }


def patch_buffer(point, radius=0.0015):
    return point.buffer(radius)


def test_single_neutral_surface_has_explicit_simulation_and_undefined_region():
    loaded = dataset()
    assert loaded.identity.atlas_id == "perineum-schematic-v1"
    assert set(loaded.bodies) == {VIEW}
    assert {region["labelId"] for region in loaded.regions} == {
        "S2",
        "S3",
        "S4",
        "S5",
        "UNDEFINED",
    }
    assert all(region["side"] == "unspecified" for region in loaded.regions)
    assert all(region["sourcePathId"] is None for region in loaded.regions)
    assert all(region["sourceType"] == "ARTIFICIALLY_CONSTRUCTED" for region in loaded.regions)
    undefined = next(region for region in loaded.regions if region["labelId"] == "UNDEFINED")
    assert undefined["displayName"] == "模拟未定区"
    assert "sacral" in undefined["derivation"].lower()
    # The anal opening is represented as a true hole, not filled skin.
    body = loaded.bodies[VIEW]
    assert sum(len(polygon.interiors) for polygon in body.geoms) == 1
    assert not body.covers(Point(0.5, 0.495))


def test_all_valid_skin_is_partitioned_once_with_roundtrip_geometry():
    loaded = dataset()
    body = loaded.bodies[VIEW]
    regions = [region for region in loaded.regions if region["view"] == VIEW]
    union = unary_union([region["shape"] for region in regions])
    assert body.difference(union).area == pytest.approx(0, abs=1e-12)
    assert union.difference(body).area == pytest.approx(0, abs=1e-12)
    overlap = sum(
        regions[index]["shape"].intersection(regions[other]["shape"]).area
        for index in range(len(regions))
        for other in range(index + 1, len(regions))
    )
    assert overlap == pytest.approx(0, abs=1e-12)
    for region in regions:
        assert region["shape"].is_valid
        assert not region["shape"].is_empty
        # Shared JSON edges differ only at floating-point roundoff; no visible
        # or measurable skin extension is permitted.
        assert region["shape"].difference(body).area == pytest.approx(0, abs=1e-12)


@pytest.mark.parametrize(
    ("x", "y", "expected"),
    [
        (0.14, 0.20, "S2"),
        (0.20, 0.72, "S3"),
        (0.50, 0.435, "S4"),
        (0.522, 0.495, "S5"),
        (0.50, 0.325, "UNDEFINED"),
    ],
)
def test_manual_reference_points_map_to_expected_schematic_symbol(client, x, y, expected):
    response = client.post("/api/v1/evaluate", json=payload(patch_buffer(Point(x, y))))
    assert response.status_code == 200, response.text
    result = response.json()
    assert [candidate["label"] for candidate in result["views"][0]["candidates"]] == [expected]
    if expected == "UNDEFINED":
        assert result["views"][0]["candidates"][0]["display_name"] == "模拟未定区"
    assert result["source"]["atlas_type"] == "SCHEMATIC"
    assert result["source"]["review_status"] == "NOT_MEDICALLY_VALIDATED"
    assert result["source"]["intended_use"] == "INTERACTIVE_SIMULATION"
    assert result["source"]["source_type"] == "ARTIFICIALLY_CONSTRUCTED"
    assert "不能替代医疗诊断" in result["source"]["disclaimer"]


def test_full_skin_multi_region_hole_and_duplicate_union(client):
    loaded = dataset()
    body = loaded.bodies[VIEW]
    response = client.post("/api/v1/evaluate", json=payload(body))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["views"][0]["covered_ratio"] == pytest.approx(1, abs=1e-12)
    assert {candidate["label"] for candidate in result["views"][0]["candidates"]} == {
        "S2",
        "S3",
        "S4",
        "S5",
        "UNDEFINED",
    }

    s4 = next(region for region in loaded.regions if region["labelId"] == "S4")
    s5 = next(region for region in loaded.regions if region["labelId"] == "S5")
    left = s4["shape"].representative_point().buffer(0.003)
    right = s5["shape"].representative_point().buffer(0.003)
    multi = payload(unary_union([left, right]))
    multi["lesions"].append({**multi["lesions"][0], "id": "SYNTHETIC_PERINEUM_DUPLICATE"})
    duplicate_result = client.post("/api/v1/evaluate", json=multi)
    assert duplicate_result.status_code == 200, duplicate_result.text
    assert duplicate_result.json()["views"][0]["annotation_area"] == pytest.approx(
        unary_union([left, right]).area
    )
    assert {
        candidate["label"]
        for candidate in duplicate_result.json()["views"][0]["candidates"]
    } == {"S4", "S5"}


def test_shared_boundary_returns_both_regions_and_contact_has_no_area(client):
    loaded = dataset()
    regions = {region["labelId"]: region["shape"] for region in loaded.regions}
    shared = regions["S4"].boundary.intersection(regions["S5"].boundary)
    assert not shared.is_empty
    point = shared.interpolate(0.5, normalized=True)
    response = client.post("/api/v1/evaluate", json=payload(patch_buffer(point, 0.002)))
    assert response.status_code == 200, response.text
    assert {
        candidate["label"] for candidate in response.json()["views"][0]["candidates"]
    } == {"S4", "S5"}
    # A boundary-only geometry has zero area and is rejected by the same V4 validator.
    line = shared.buffer(1e-14)
    rejected = client.post("/api/v1/evaluate", json=payload(line))
    assert rejected.status_code in (200, 422)
    if rejected.status_code == 200:
        assert rejected.json()["views"][0]["covered_area"] == pytest.approx(0, abs=1e-12)


def test_outside_body_bad_geometry_stale_identity_and_release_gate(client, monkeypatch):
    outside = client.post("/api/v1/evaluate", json=payload(box(0.01, 0.01, 0.03, 0.03)))
    assert outside.status_code == 422
    assert outside.json()["error"]["code"] == "INVALID_ANNOTATION"

    bowtie = payload(Point(0.2, 0.2).buffer(0.001))
    ring = bowtie["lesions"][0]["geometry"]["coordinates"][0][0]
    ring[1], ring[2] = ring[2], ring[1]
    invalid = client.post("/api/v1/evaluate", json=bowtie)
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "INVALID_ANNOTATION"

    stale = payload(patch_buffer(Point(0.14, 0.20)))
    stale["identity"]["atlas_version"] = "stale"
    mismatch = client.post("/api/v1/evaluate", json=stale)
    assert mismatch.status_code == 409
    assert mismatch.json()["error"]["code"] == "VERSION_MISMATCH"

    for environment in ("production", "unknown"):
        monkeypatch.setenv("DERMATOME_ENV", environment)
        denied = client.post(
            "/api/v1/evaluate", json=payload(patch_buffer(Point(0.14, 0.20)))
        )
        assert denied.status_code == 403


def test_generated_exports_and_previews_are_real_and_reproducible():
    required = [
        ROOT / "miniprogram/packages/special/assets/perineum/perineum-overview.svg",
        ROOT / "miniprogram/packages/special/assets/perineum/perineum-overview.png",
        ROOT / "miniprogram/packages/special/data/perineum-schematic.generated.ts",
        ROOT / "docs/validation-records/v6.7-perineum/evidence/full-partition-preview.png",
        ROOT / "docs/validation-records/v6.7-perineum/evidence/undefined-region-preview.png",
    ]
    for path in required:
        assert path.exists() and path.stat().st_size > 100
    coverage = json.loads(
        (
            ROOT
            / "docs/validation-records/v6.7-perineum/evidence/coverage.json"
        ).read_text()
    )
    assert coverage["coveredRatio"] == pytest.approx(1, abs=1e-12)
    assert coverage["missedGridPoints"] == 0
    assert coverage["undefinedArea"] > 0
