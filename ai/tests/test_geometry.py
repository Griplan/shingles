"""Synthetic pixel geometry only; no medical accuracy assertions."""
import numpy as np
import pytest
from shapely.geometry import shape, Point
from shapely.affinity import scale

from ai.errors import SegmentationError
from ai.postprocessing.polygons import mask_to_polygons


def geometry(mask, tolerance=0):
    result = mask_to_polygons(mask, tolerance)
    g = scale(shape(result["geometry"]), mask.shape[1], mask.shape[0], origin=(0, 0))
    assert g.is_valid
    assert g.area == pytest.approx(mask.sum())
    for y in range(mask.shape[0]):
        for x in range(mask.shape[1]):
            assert g.contains(Point(x + .5, y + .5)) == bool(mask[y, x])
    for polygon in result["geometry"]["coordinates"]:
        for ring in polygon:
            assert ring[0] == ring[-1]
            assert all(0 <= c <= 1 for p in ring for c in p)
    return result, g


def test_single_pixel_at_image_edge_and_entire_mask():
    mask = np.zeros((8, 12), bool)
    mask[-1, -1] = True
    result, g = geometry(mask)
    assert g.bounds == (11, 7, 12, 8)
    assert result["component_count"] == 1
    result, g = geometry(np.ones((8, 12), bool))
    assert g.bounds == (0, 0, 12, 8)


def test_disconnected_hole_and_island_are_not_hull():
    mask = np.zeros((12, 16), bool)
    mask[1:10, 1:10] = True
    mask[3:8, 3:8] = False
    mask[5, 5] = True
    mask[9:12, 14:16] = True
    result, _ = geometry(mask)
    assert result["component_count"] == 3
    assert result["hole_count"] == 1
    assert result["pixel_area"] == 63


def test_corner_touch_remains_two_components():
    result, _ = geometry(np.eye(3, dtype=bool))
    assert result["component_count"] == 3


def test_lossy_simplification_falls_back_instead_of_dropping_small_parts():
    mask = np.eye(8, dtype=bool)
    mask[0, :4] = True
    result, _ = geometry(mask, 20)
    assert result["simplification"]["fallback_to_exact"]
    assert result["component_count"] == 7


@pytest.mark.parametrize("seed", range(10))
def test_seeded_fragmented_masks_exact_pixel_reconstruction(seed):
    geometry(np.random.default_rng(seed).random((12, 16)) > .6, .25)


def test_empty_mask_explicit_state():
    result = mask_to_polygons(np.zeros((8, 8), bool))
    assert result["status"] == "empty_mask" and result["geometry"] is None


@pytest.mark.parametrize("mask", [np.zeros((4, 4), np.uint8), np.ones((2, 2, 2), bool), np.zeros((0, 1), bool)])
def test_invalid_masks(mask):
    with pytest.raises(SegmentationError, match="2D boolean"):
        mask_to_polygons(mask)


def test_fragmentation_limit_is_failure(monkeypatch):
    monkeypatch.setattr("ai.postprocessing.polygons.MAX_RUNS", 1)
    with pytest.raises(SegmentationError) as e:
        mask_to_polygons(np.eye(3, dtype=bool))
    assert e.value.code == "CONTOUR_LIMIT"


@pytest.mark.parametrize("value", [-1, float("nan"), True])
def test_invalid_simplification(value):
    with pytest.raises(SegmentationError):
        mask_to_polygons(np.ones((8, 8), bool), value)
