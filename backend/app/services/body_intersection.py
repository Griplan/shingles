"""Exact one-shot clipping of an editable lesion against the complete body surface."""
import json

from shapely.errors import ShapelyError
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape

from app.schemas.evaluate import BodyIntersectionRequest, BodyIntersectionResponse, MultiPolygonGeometry
from app.services.atlas_service import BODY_FILE, valid_geometry
from app.utils.geometry import EvaluationError

EPSILON = 1e-12


def _polygon_parts(value) -> list[Polygon]:
    if value.is_empty:
        return []
    if isinstance(value, Polygon):
        return [value]
    if isinstance(value, MultiPolygon):
        return list(value.geoms)
    if isinstance(value, GeometryCollection):
        return [part for item in value.geoms for part in _polygon_parts(item)]
    return []


def _multi(value) -> MultiPolygonGeometry | None:
    parts = [part for part in _polygon_parts(value) if part.area > EPSILON]
    if not parts:
        return None
    merged = MultiPolygon(parts) if len(parts) > 1 else parts[0]
    raw = mapping(merged)
    raw_polygons = [raw["coordinates"]] if raw["type"] == "Polygon" else raw["coordinates"]
    polygons = [
        [
            [{"x": x, "y": y} for x, y in ring]
            for ring in polygon
        ]
        for polygon in raw_polygons
    ]
    return MultiPolygonGeometry(
        type="MultiPolygon",
        coordinateSpace="body_template_normalized_v1",
        coordinates=polygons,
    )

def _raw_geometry(value: MultiPolygonGeometry) -> dict:
    coordinates = [
        [
            [[point.x, point.y] for point in ring]
            for ring in polygon
        ]
        for polygon in value.coordinates
    ]
    return {
        "type": "MultiPolygon",
        "coordinateSpace": value.coordinateSpace,
        "coordinates": coordinates,
    }


def clip_to_body(payload: BodyIntersectionRequest) -> BodyIntersectionResponse:
    try:
        body_blob = BODY_FILE.read_bytes()
        body_data = json.loads(body_blob)
        if body_data.get("coordinateSystem") != "normalized_2d_top_left":
            raise ValueError("body coordinate system")
        binding = body_data["views"][payload.view]
        expected = (
            payload.template_id,
            payload.template_version,
            payload.geometry_id,
            payload.region_set_id,
        )
        actual = (
            binding["templateId"],
            binding["templateVersion"],
            binding["geometryId"],
            binding["regionSetId"],
        )
        if actual != expected:
            raise EvaluationError(
                "VERSION_MISMATCH",
                "人体版本不一致，请同步更新前后端",
                409,
            )
        body = valid_geometry(binding["geometry"])
        lesion = valid_geometry(_raw_geometry(payload.geometry))
        if not lesion.is_valid:
            raise ValueError("invalid lesion")
        intersection = lesion.intersection(body)
        outside = lesion.difference(body)
        source_area = lesion.area
        intersection_area = intersection.area
        outside_area = outside.area
        ratio = outside_area / source_area if source_area > 0 else 1.0
        geometry = _multi(intersection)
        if geometry is None:
            status = "outside"
        elif ratio <= EPSILON:
            status = "inside"
            geometry = _multi(lesion)
        else:
            status = "partial"
        return BodyIntersectionResponse(
            method="body_intersection_v1",
            status=status,
            source_area=source_area,
            intersection_area=intersection_area,
            outside_area=outside_area,
            outside_area_ratio=max(0.0, min(1.0, ratio)),
            geometry=geometry,
        )
    except EvaluationError:
        raise
    except (OSError, ValueError, KeyError, TypeError, AttributeError, ShapelyError) as exc:
        raise EvaluationError(
            "INVALID_ANNOTATION",
            "标注轮廓或人体数据无效，不能执行人体交集",
            422,
        ) from exc
