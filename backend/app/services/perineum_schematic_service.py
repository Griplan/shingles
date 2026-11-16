"""Neutral perineum overview with an explicitly artificial schematic atlas."""
import sys

from shapely.ops import unary_union

from app.services import perineum_atlas_service as base
from app.services.local_atlas_service import load_local_dataset
from app.services.access import feature_enabled
from app.utils.geometry import EvaluationError

ROOT = base.ROOT
ATLAS_ID = "perineum-schematic-v1"
ATLAS_VERSION = "perineum-schematic.1"
ATLAS_DIR = ROOT / "data/atlas/perineum-schematic-v1"
BODY_FILE = base.BODY_FILE
RESOURCE_KEY = base.RESOURCE_KEY
RESOURCE_FILE = base.RESOURCE_FILE
VIEWS = base.VIEWS
INPUTS = base.INPUTS
BASIS = base.BASIS
content_hash = base.content_hash
SCHEMATIC = True
CONTAINMENT_ROUNDOFF = 1e-12
CONTAINMENT_DISTANCE_ROUNDOFF = 1e-10
META = {
    "atlasType": "SCHEMATIC",
    "reviewStatus": "NOT_MEDICALLY_VALIDATED",
    "intendedUse": "INTERACTIVE_SIMULATION",
    "sourceType": "ARTIFICIALLY_CONSTRUCTED",
}
LABELS = {"S2", "S3", "S4", "S5", "UNDEFINED"}


def validate_source_region(region, registration):
    if (
        any(region.get(key) != value or registration.get(key) != value for key, value in META.items())
        or region["partitionType"] != "schematic_region"
        or region["labelId"] not in LABELS
        or region["displayName"]
        != ("模拟未定区" if region["labelId"] == "UNDEFINED" else "模拟 " + region["labelId"])
        or region["sourcePathId"] is not None
        or region["sourceFile"] != "scripts/build_perineum_schematic.py"
        or region["viewId"] != region["view"]
        or region["atlasId"] != ATLAS_ID
        or region["side"] != "unspecified"
    ):
        raise ValueError("invalid perineum schematic origin/label")


def load_perineum_schematic_dataset(identity):
    if not feature_enabled("ENABLE_REFERENCE_MATCHING"):
        raise EvaluationError(
            "MATCHING_DISABLED", "当前环境未启用交互模拟", 403
        )
    dataset = load_local_dataset(identity, sys.modules[__name__])
    if any(dataset.manifest.get(key) != value for key, value in META.items()):
        raise EvaluationError("ATLAS_UNAVAILABLE", "模拟状态缺失", 503)
    view = "perineum-overview"
    shapes = [region["shape"] for region in dataset.regions if region["view"] == view]
    labels = {region["labelId"] for region in dataset.regions if region["view"] == view}
    union = unary_union(shapes)
    body = dataset.bodies[view]
    overlap = sum(
        shapes[index].intersection(shapes[other]).area
        for index in range(len(shapes))
        for other in range(index + 1, len(shapes))
    )
    if (
        labels != LABELS
        or len(shapes) != len(LABELS)
        or body.difference(union).area > 1e-12
        or union.difference(body).area > 1e-12
        or overlap > 1e-12
    ):
        raise EvaluationError(
            "ATLAS_UNAVAILABLE", "会阴模拟分区覆盖或邻接校验失败", 503
        )
    return dataset
