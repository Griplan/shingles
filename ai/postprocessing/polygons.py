import numpy as np
from shapely import box, unary_union
from shapely.geometry import MultiPolygon
from shapely.geometry.polygon import orient
from shapely.errors import GEOSException

from ai.errors import SegmentationError

MAX_RUNS = 100_000


def mask_to_polygons(mask: np.ndarray, simplify_px: float = 0.0) -> dict:
    """Union pixel *cells*, not contour pixel centers: even one pixel has area.

    Four-neighbour connectivity; corner-touching cells remain separate components.
    Default zero simplification is lossless. Any requested simplification must be
    geometrically equal to the exact union, otherwise fall back with a warning.
    This deliberately favors fidelity over V2's current 128-vertex restriction.
    """
    if (not isinstance(mask, np.ndarray) or mask.ndim != 2 or mask.dtype != np.bool_
            or not mask.size or mask.size > 12_000_000):
        raise SegmentationError("INVALID_MASK", "Expected a bounded nonempty 2D boolean array.")
    if type(simplify_px) not in (int, float) or not np.isfinite(simplify_px) or simplify_px < 0:
        raise SegmentationError("INVALID_SIMPLIFICATION", "Simplification must be a finite nonnegative pixel tolerance.")
    if not mask.any():
        return {"status": "empty_mask", "geometry": None, "pixel_area": 0, "error": None}
    h, w = mask.shape
    runs = []
    try:
        for y, row in enumerate(mask):
            changes = np.flatnonzero(np.diff(np.pad(row.astype(np.int8), (1, 1))))
            if len(runs) + len(changes) // 2 > MAX_RUNS:
                raise SegmentationError("CONTOUR_LIMIT", "Mask too fragmented; original mask retained.")
            runs.extend(box(int(a), y, int(b), y + 1) for a, b in changes.reshape(-1, 2))
        exact = unary_union(runs)
        if not exact.is_valid or exact.geom_type not in {"Polygon", "MultiPolygon"}:
            raise SegmentationError("CONTOUR_FAILED", "Pixel union is not valid polygonal geometry.")
        if exact.area != int(mask.sum()):
            raise SegmentationError("CONTOUR_FAILED", "Pixel area was not preserved.")
        simplified = exact.simplify(simplify_px, preserve_topology=True)
        fallback = not simplified.is_valid or not simplified.equals(exact)
        final = exact if fallback else simplified
        parts = list(final.geoms) if isinstance(final, MultiPolygon) else [final]
        parts.sort(key=lambda g: (g.bounds[1], g.bounds[0]))
        coordinates = []
        for part in parts:
            part = orient(part, sign=1)
            coordinates.append([[[x / w, y / h] for x, y in ring.coords]
                                for ring in [part.exterior, *part.interiors]])
        return {
            "status": "ok", "coordinate_space": "photo_oriented_normalized_v1",
            "geometry": {"type": "MultiPolygon", "coordinates": coordinates},
            "pixel_area": int(mask.sum()), "component_count": len(parts),
            "hole_count": sum(len(p.interiors) for p in parts),
            "vertex_count": sum(len(r) for p in coordinates for r in p),
            "simplification": {"requested_px": simplify_px, "lossless_only": True,
                               "fallback_to_exact": fallback},
            "connectivity": 4, "error": None,
        }
    except MemoryError:
        raise SegmentationError("OUT_OF_MEMORY", "Insufficient memory converting mask.") from None
    except GEOSException:
        raise SegmentationError("CONTOUR_FAILED", "Geometry conversion failed; original mask retained.") from None
