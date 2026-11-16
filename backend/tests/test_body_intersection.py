import json

from shapely.geometry import box, shape

from app.services.atlas_service import BODY_FILE
from test_evaluate_api import client


def binding(view="front"):
    data = json.loads(BODY_FILE.read_bytes())["views"][view]
    return data


def geometry(value):
    outer = [{"x": x, "y": y} for x, y in value.exterior.coords]
    holes = [
        [{"x": x, "y": y} for x, y in ring.coords]
        for ring in value.interiors
    ]
    return {
        "type": "MultiPolygon",
        "coordinateSpace": "body_template_normalized_v1",
        "coordinates": [[outer, *holes]],
    }


def payload(value, view="front"):
    data = binding(view)
    return {
        "view": view,
        "template_id": data["templateId"],
        "template_version": data["templateVersion"],
        "geometry_id": data["geometryId"],
        "region_set_id": data["regionSetId"],
        "geometry": geometry(value),
    }


def test_exact_body_intersection_distinguishes_inside_partial_and_outside(client):
    body = shape(binding()["geometry"])
    point = body.representative_point()
    inside = box(point.x - 0.002, point.y - 0.002, point.x + 0.002, point.y + 0.002).difference(
        box(point.x - 0.0005, point.y - 0.0005, point.x + 0.0005, point.y + 0.0005)
    )
    response = client.post("/api/v1/evaluate/body-intersection", json=payload(inside))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "inside"
    assert result["outside_area_ratio"] == 0
    assert len(result["geometry"]["coordinates"][0]) == 2

    partial = client.post(
        "/api/v1/evaluate/body-intersection",
        json=payload(box(0.01, 0.01, 0.99, 0.99)),
    )
    assert partial.status_code == 200, partial.text
    data = partial.json()
    assert data["status"] == "partial"
    assert 0 < data["outside_area_ratio"] < 1
    assert data["intersection_area"] > 0
    assert data["geometry"]["coordinates"]

    outside = client.post(
        "/api/v1/evaluate/body-intersection",
        json=payload(box(0.005, 0.005, 0.02, 0.02)),
    )
    assert outside.status_code == 200, outside.text
    assert outside.json()["status"] == "outside"
    assert outside.json()["geometry"] is None


def test_body_intersection_rejects_stale_binding_without_echoing_geometry(client):
    body = shape(binding()["geometry"])
    point = body.representative_point()
    request = payload(box(point.x - 0.002, point.y - 0.002, point.x + 0.002, point.y + 0.002))
    request["template_version"] = "stale"
    response = client.post("/api/v1/evaluate/body-intersection", json=request)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "VERSION_MISMATCH"
    assert str(point.x) not in response.text


def test_body_intersection_rejects_invalid_self_intersection_without_success_shape(client):
    body = shape(binding()["geometry"])
    point = body.representative_point()
    ring = [
        {"x": point.x - 0.002, "y": point.y - 0.002},
        {"x": point.x + 0.002, "y": point.y + 0.002},
        {"x": point.x - 0.002, "y": point.y + 0.002},
        {"x": point.x + 0.002, "y": point.y - 0.002},
        {"x": point.x - 0.002, "y": point.y - 0.002},
    ]
    request = payload(box(0, 0, 0.01, 0.01))
    request["geometry"]["coordinates"] = [[ring]]
    response = client.post("/api/v1/evaluate/body-intersection", json=request)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_ANNOTATION"
    assert "geometry" not in response.json()


def test_body_intersection_rejects_more_than_twenty_thousand_vertices(client):
    request = payload(box(0.4, 0.4, 0.6, 0.6))
    ring = [
        {"x": 0.4, "y": 0.4},
        {"x": 0.41, "y": 0.4},
        {"x": 0.41, "y": 0.41},
        {"x": 0.4, "y": 0.41},
        {"x": 0.4, "y": 0.4},
    ]
    request["geometry"]["coordinates"] = [[ring] * 4001]
    response = client.post("/api/v1/evaluate/body-intersection", json=request)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"
    assert "geometry" not in response.json()
