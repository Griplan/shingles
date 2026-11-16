"""Build the neutral perineum overview and artificial schematic atlas.

This is an interactive simulation asset, not clinical dermatome geometry.
The drawing is project-original vector artwork. The Wikimedia CC0 page listed
in sources.json was reviewed as a general visual reference only; no pixels or
paths from that work are embedded here.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 400, 560
VIEW = "perineum-overview"
ATLAS_ID = "perineum-schematic-v1"
ATLAS_VERSION = "perineum-schematic.1"
TEMPLATE_ID = "neutral-perineum-overview-v1"
TEMPLATE_VERSION = "1.0.0"
GEOMETRY_ID = "neutral-perineum-skin-v1"
REGION_SET_ID = "neutral-perineum-ui-v1"
ATLAS_DIR = ROOT / "data/atlas/perineum-schematic-v1"
BODY_FILE = ROOT / "data/body/perineum-v1.json"
RESOURCE_FILE = ROOT / "data/body/perineum-resource.json"
ASSET_SVG = ROOT / "miniprogram/packages/special/assets/perineum/perineum-overview.svg"
ASSET_PNG = ROOT / "miniprogram/packages/special/assets/perineum/perineum-overview.png"
MODEL_TS = ROOT / "miniprogram/packages/special/data/perineum-schematic.generated.ts"
EVIDENCE = ROOT / "docs/validation-records/v6.7-perineum/evidence"
INPUTS = ["perineum-overview.json", "sources.json", "registration.json"]

NOTE = (
    "本区域采用人为构建的神经皮节示意分区，边界未经医学审核，仅供交互模拟与科普参考，"
    "不用于判断实际受累神经，不能替代医疗诊断和正规就医。"
)
META = {
    "atlasType": "SCHEMATIC",
    "reviewStatus": "NOT_MEDICALLY_VALIDATED",
    "intendedUse": "INTERACTIVE_SIMULATION",
    "sourceType": "ARTIFICIALLY_CONSTRUCTED",
}
BASIS = {
    "templateId": TEMPLATE_ID,
    "templateVersion": TEMPLATE_VERSION,
    "geometryId": GEOMETRY_ID,
    "regionSetId": REGION_SET_ID,
}
SOURCE_PAGE = "https://commons.wikimedia.org/wiki/File:Perineum.png"


def dump(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def cubic(p0, p1, p2, p3, steps: int = 28):
    result = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        result.append(
            (
                u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
            )
        )
    return result


def ellipse(cx: float, cy: float, rx: float, ry: float, count: int = 128) -> Polygon:
    return Polygon(
        [
            (cx + rx * math.cos(2 * math.pi * i / count), cy + ry * math.sin(2 * math.pi * i / count))
            for i in range(count)
        ]
    )


def geometry_multipolygon(value) -> MultiPolygon:
    value = unary_union(value)
    polygons = [value] if value.geom_type == "Polygon" else list(value.geoms)
    return MultiPolygon([orient(polygon, sign=1.0) for polygon in polygons if polygon.area > 0])


def geo_json(value) -> dict:
    return json.loads(json.dumps(mapping(geometry_multipolygon(value)), ensure_ascii=False))


def ring_path(ring) -> str:
    coordinates = list(ring.coords)
    return "M" + " L".join(
        f"{x * WIDTH:.12g},{y * HEIGHT:.12g}" for x, y in coordinates
    ) + " Z"


def svg_path(value) -> str:
    geometry = geometry_multipolygon(value)
    return " ".join(
        ring_path(ring)
        for polygon in geometry.geoms
        for ring in [polygon.exterior, *polygon.interiors]
    )


def build_skin():
    # One neutral pelvic overview: anterior marker above, posterior/anal region
    # centrally, and medial thighs below. No sex-specific external anatomy.
    curves = [
        ((0.500, 0.055), (0.360, 0.030), (0.180, 0.055), (0.110, 0.130)),
        ((0.110, 0.130), (0.040, 0.200), (0.060, 0.310), (0.090, 0.390)),
        ((0.090, 0.390), (0.140, 0.500), (0.150, 0.610), (0.150, 0.710)),
        ((0.150, 0.710), (0.150, 0.800), (0.170, 0.900), (0.210, 0.960)),
        ((0.210, 0.960), (0.240, 0.995), (0.310, 0.995), (0.340, 0.950)),
        ((0.340, 0.950), (0.370, 0.900), (0.380, 0.820), (0.400, 0.760)),
        ((0.400, 0.760), (0.430, 0.690), (0.460, 0.640), (0.490, 0.600)),
        ((0.490, 0.600), (0.496, 0.590), (0.504, 0.590), (0.510, 0.600)),
        ((0.510, 0.600), (0.540, 0.640), (0.570, 0.690), (0.600, 0.760)),
        ((0.600, 0.760), (0.620, 0.820), (0.630, 0.900), (0.660, 0.950)),
        ((0.660, 0.950), (0.690, 0.995), (0.760, 0.995), (0.790, 0.960)),
        ((0.790, 0.960), (0.830, 0.900), (0.850, 0.800), (0.850, 0.710)),
        ((0.850, 0.710), (0.850, 0.610), (0.860, 0.500), (0.910, 0.390)),
        ((0.910, 0.390), (0.940, 0.310), (0.960, 0.200), (0.890, 0.130)),
        ((0.890, 0.130), (0.820, 0.055), (0.640, 0.030), (0.500, 0.055)),
    ]
    points = []
    for curve in curves:
        sampled = cubic(*curve)
        points.extend(sampled[:-1])
    outer = Polygon(points)
    anal_opening = ellipse(0.500, 0.495, 0.010, 0.015, 72)
    skin = outer.difference(anal_opening)
    assert outer.is_valid and skin.is_valid and not skin.is_empty
    assert len(skin.interiors) == 1
    return outer, anal_opening, skin


def build_partition(skin):
    central_band = skin.intersection(ellipse(0.500, 0.455, 0.170, 0.205))
    anterior_undefined = central_band.intersection(ellipse(0.500, 0.325, 0.105, 0.080))
    perineal_core = central_band.difference(anterior_undefined)
    immediate_anal_ring = skin.intersection(
        ellipse(0.500, 0.495, 0.038, 0.052).difference(ellipse(0.500, 0.495, 0.016, 0.022))
    )
    s5 = perineal_core.intersection(immediate_anal_ring)
    s4 = perineal_core.difference(s5)

    outside_central = skin.difference(central_band)
    upper_divider = []
    for index in range(161):
        x = -0.10 + 1.20 * index / 160
        y = 0.410 + 0.055 * ((x - 0.50) / 0.60) ** 2
        upper_divider.append((x, y))
    upper_mask = Polygon(
        [(-0.10, -0.10), (1.10, -0.10), *reversed(upper_divider)]
    )
    s2 = outside_central.intersection(upper_mask)
    s3 = skin.difference(unary_union([anterior_undefined, s4, s5, s2]))

    regions = {
        "S2": s2,
        "S3": s3,
        "S4": s4,
        "S5": s5,
        "UNDEFINED": anterior_undefined,
    }
    for label, geometry in regions.items():
        assert geometry.is_valid and not geometry.is_empty and geometry.area > 0, label
        assert geometry.difference(skin).area < 1e-12, label
    for index, (label, geometry) in enumerate(regions.items()):
        for other_label, other in list(regions.items())[index + 1 :]:
            assert geometry.intersection(other).area < 1e-12, (label, other_label)
    assert skin.difference(unary_union(list(regions.values()))).area < 1e-12
    return regions


def model_svg(skin, anal_opening, regions: dict, *, atlas_overlay=False, undefined_only=False) -> str:
    colors = {
        "S2": "#98c3bb",
        "S3": "#d7bc8a",
        "S4": "#b8a5cf",
        "S5": "#d68f82",
        "UNDEFINED": "#d9d9d9",
    }
    overlay = ""
    if atlas_overlay or undefined_only:
        for label, geometry in regions.items():
            if undefined_only and label != "UNDEFINED":
                continue
            opacity = ".48" if label != "UNDEFINED" else ".72"
            overlay += (
                f'<path d="{svg_path(geometry)}" fill="{colors[label]}" fill-opacity="{opacity}" '
                f'stroke="#52665f" stroke-width=".45" fill-rule="evenodd"/>'
            )
            if atlas_overlay:
                point = geometry.representative_point()
                text = "模拟未定区" if label == "UNDEFINED" else f"模拟 {label}"
                overlay += (
                    f'<text x="{point.x * WIDTH:.2f}" y="{point.y * HEIGHT:.2f}" '
                    'text-anchor="middle" font-family="sans-serif" font-size="12" '
                    f'font-weight="600" fill="#304b42">{text}</text>'
                )
    guide = (
        '<g fill="none" stroke="#a58c80" stroke-width="1.15" stroke-linecap="round" opacity=".65">'
        '<path d="M132 112 C154 178 160 250 154 322 C149 392 157 464 174 516"/>'
        '<path d="M268 112 C246 178 240 250 246 322 C251 392 243 464 226 516"/>'
        '<path d="M168 226 C183 236 217 236 232 226"/>'
        '<path d="M168 400 C183 390 217 390 232 400"/>'
        "</g>"
    )
    title = "会阴区域中性示意；模拟分区非临床神经皮节定位" if atlas_overlay else "会阴区域中性示意图"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" '
        f'viewBox="0 0 {WIDTH} {HEIGHT}"><title>{title}</title>'
        "<defs>"
        '<linearGradient id="skin" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#f8e7dc"/><stop offset=".55" stop-color="#edcfc1"/>'
        '<stop offset="1" stop-color="#e8c2b3"/></linearGradient>'
        f'<clipPath id="skin-clip"><path d="{svg_path(skin)}" fill-rule="evenodd"/></clipPath>'
        "</defs>"
        f'<path d="{svg_path(skin)}" fill="url(#skin)" stroke="#8f756b" stroke-width="1.35" fill-rule="evenodd"/>'
        f'<g clip-path="url(#skin-clip)">{guide}</g>'
        f'<path d="{ring_path(anal_opening.exterior)}" fill="#8b6258" fill-opacity=".72" '
        'stroke="#745147" stroke-width=".8"/>'
        f"{overlay}"
        '<g font-family="sans-serif" fill="#6c786f">'
        '<text x="200" y="20" text-anchor="middle" font-size="12">前侧</text>'
        '<text x="200" y="548" text-anchor="middle" font-size="12">后侧 · 肛门区居中</text>'
        '<text x="22" y="280" text-anchor="middle" font-size="12" transform="rotate(-90 22 280)">解剖左</text>'
        '<text x="378" y="280" text-anchor="middle" font-size="12" transform="rotate(90 378 280)">解剖右</text>'
        "</g>"
        '<g font-family="sans-serif" fill="#8b6a5f">'
        '<text x="302" y="126" font-size="11">内侧大腿参考</text>'
        '<text x="302" y="142" font-size="11">非独立皮节</text>'
        "</g>"
        "</svg>"
    )


def preview_svg(skin, anal_opening, regions, *, mode: str, lesion=None, matched_labels=()) -> str:
    base = model_svg(skin, anal_opening, regions, atlas_overlay=mode == "atlas", undefined_only=mode == "undefined")
    if lesion is None:
        return base
    overlays = []
    for label in matched_labels:
        geometry = regions[label]
        overlays.append(
            f'<path d="{svg_path(geometry)}" fill="#57a987" fill-opacity=".30" '
            'stroke="#2c765b" stroke-width=".5" fill-rule="evenodd"/>'
        )
    overlays.append(
        f'<path d="{svg_path(lesion)}" fill="none" stroke="#8b4f35" stroke-width="2" '
        'fill-rule="evenodd"/>'
    )
    return base.replace("</svg>", "".join(overlays) + "</svg>")


def build() -> dict[str, str]:
    outer, anal_opening, skin = build_skin()
    regions = build_partition(skin)
    view_json = geo_json(skin)
    model_body = []
    for polygon in geometry_multipolygon(skin).geoms:
        model_body.append(
            {
                "outer": [{"x": x, "y": y} for x, y in polygon.exterior.coords],
                "holes": [
                    [{"x": x, "y": y} for x, y in interior.coords]
                    for interior in polygon.interiors
                ],
            }
        )

    region_docs = []
    colors = {
        "S2": "#98c3bb",
        "S3": "#d7bc8a",
        "S4": "#b8a5cf",
        "S5": "#d68f82",
        "UNDEFINED": "#d9d9d9",
    }
    display_names = {
        "S2": "模拟 S2",
        "S3": "模拟 S3",
        "S4": "模拟 S4",
        "S5": "模拟 S5",
        "UNDEFINED": "模拟未定区",
    }
    for label, geometry in regions.items():
        point = geometry.representative_point()
        geometry_json = geo_json(geometry)
        region_docs.append(
            {
                "id": f"{VIEW}-schematic-{label.lower()}",
                "view": VIEW,
                "viewId": VIEW,
                "side": "unspecified",
                **BASIS,
                **META,
                "atlasId": ATLAS_ID,
                "atlasVersion": ATLAS_VERSION,
                "partitionType": "schematic_region",
                "labelId": label,
                "sourceLabel": "模拟未定区" if label == "UNDEFINED" else label,
                "dermatomeLabel": label,
                "displayName": display_names[label],
                "color": colors[label],
                "geometry": geometry_json,
                "polygonGeometry": geometry_json,
                "labelPoint": {"x": point.x, "y": point.y},
                "sourceRefs": ["project-artificial-perineum-design-v1"],
                "sourcePathIndices": [],
                "sourceFile": "scripts/build_perineum_schematic.py",
                "sourcePathId": None,
                "registrationMethod": "artificial_curved_partition_clip_neutral_skin",
                "medicalReviewStatus": "pending",
                "productionStatus": "registered_development_preview",
                "derivation": (
                    "Artificial interactive schematic; no extracted dermatome boundary. "
                    "UNDEFINED is not assigned to a sacral label."
                ),
            }
        )

    files: dict[str, str] = {}
    files["data/atlas/perineum-schematic-v1/perineum-overview.json"] = (
        json.dumps(
            {
                "view": VIEW,
                "atlasVersion": ATLAS_VERSION,
                **META,
                "regions": region_docs,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    source = {
        "id": "project-artificial-perineum-design-v1",
        "purpose": "artificial_partition_design",
        "licenseStatus": "verified",
        "license": "CC0-1.0",
        "author": "dermatome-mapper project",
        "url": "docs/validation-records/v6.7-perineum/region-design.md",
        "boundaryEvidence": (
            "Project-original neutral schematic partition. S2-S5 are simulation "
            "symbols; UNDEFINED remains explicit. No clinical boundary extraction."
        ),
    }
    visual_reference = {
        "id": "commons-perineum-cc0-visual-reference",
        "purpose": "neutral_layout_visual_reference",
        "licenseStatus": "verified",
        "license": "CC0 1.0",
        "author": "Omega658",
        "url": SOURCE_PAGE,
        "boundaryEvidence": "General layout reference only; no pixels or vector paths copied.",
    }
    files["data/atlas/perineum-schematic-v1/sources.json"] = (
        json.dumps(
            {
                **META,
                "boundarySystem": "schematic_skin_partition",
                "boundaryLicenseStatus": "verified",
                "sources": [source, visual_reference],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    reference_points = {
        "S2": {"x": 0.14, "y": 0.20, "meaning": "upper lateral simulated zone"},
        "S3": {"x": 0.20, "y": 0.72, "meaning": "medial-thigh reference simulated zone"},
        "S4": {"x": 0.50, "y": 0.435, "meaning": "central perineal simulated zone"},
        "S5": {"x": 0.522, "y": 0.495, "meaning": "immediate perianal simulated ring"},
        "UNDEFINED": {"x": 0.50, "y": 0.325, "meaning": "neutral central surface left undefined"},
    }
    registration = {
        **BASIS,
        **META,
        "status": "passed_offline_geometry",
        "method": "artificial_curved_partition_clip_neutral_skin",
        "segmentsPerCurve": 28,
        "ellipseSegments": 128,
        "sourceMedicalBoundary": None,
        "labelsAreSimulationSymbols": True,
        "anatomicalOrientation": "posterior_inferior_overview_anterior_marker_top",
        "representedSkin": "neutral pelvic overview with medial-thigh context",
        "analOpening": geo_json(anal_opening),
        "undefinedRegion": "central anterior/urogenital surface is explicitly UNDEFINED",
        "referencePoints": reference_points,
        "medicalReviewStatus": "pending",
        "limitations": [
            "S2-S5 polygons are artificial simulation zones.",
            "No sex-specific external genital anatomy is drawn.",
            "The model is not a full circumference or 3D reconstruction.",
            "Pudendal nerve territory is not substituted for dermatome geometry.",
        ],
    }
    files["data/atlas/perineum-schematic-v1/registration.json"] = (
        json.dumps(registration, ensure_ascii=False, indent=2) + "\n"
    )

    content_hash = hashlib.sha256()
    for name in INPUTS:
        content_hash.update(name.encode() + b"\0")
        content_hash.update(files[f"data/atlas/perineum-schematic-v1/{name}"].encode())
        content_hash.update(b"\0")

    manifest = {
        **BASIS,
        **META,
        "atlasId": ATLAS_ID,
        "atlasVersion": ATLAS_VERSION,
        "contentSHA256": content_hash.hexdigest(),
        "mappingEnabled": False,
        "medicalReviewStatus": "pending",
        "technicalValidationStatus": "passed_offline_geometry",
        "sourceLicenseStatus": "verified",
        "sourceTitle": "会阴区域人工模拟分区 · SCHEMATIC",
        "sourceUrl": "docs/validation-records/v6.7-perineum/report.md",
        "attribution": (
            "项目原创中性会阴区域矢量示意（CC0-1.0）；仅参考 Wikimedia Commons "
            "Perineum.png（Omega658，CC0）的通用观察范围，不复制照片像素或路径。"
        ),
        "license": "CC0-1.0",
        "coverageNote": NOTE,
    }
    files["data/atlas/perineum-schematic-v1/manifest.json"] = (
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    )

    resource = {
        **BASIS,
        "logicalWidth": WIDTH,
        "logicalHeight": HEIGHT,
        "coordinateSystem": "normalized_2d_top_left",
        "source": {
            "title": "中性会阴区域示意图",
            "url": SOURCE_PAGE,
            "author": "dermatome-mapper project",
            "license": "CC0 1.0",
            "attribution": manifest["attribution"],
        },
        "views": {
            VIEW: {
                "anatomicalSide": "unspecified",
                "body": view_json,
                "imagePath": "/assets/perineum/perineum-overview.png",
                "svgPath": "/assets/perineum/perineum-overview.svg",
                "orientation": "posterior_inferior_overview_anterior_marker_top",
            }
        },
    }
    resource_text = json.dumps(resource, ensure_ascii=False, indent=2) + "\n"
    files["data/body/perineum-resource.json"] = resource_text
    body = {
        **BASIS,
        "coordinateSystem": "normalized_2d_top_left",
        "sourceSHA256": {
            "data/body/perineum-resource.json": hashlib.sha256(resource_text.encode()).hexdigest()
        },
        "views": {
            VIEW: {
                "side": "unspecified",
                "geometry": view_json,
            }
        },
    }
    body_text = json.dumps(body, ensure_ascii=False, indent=2) + "\n"
    files["data/body/perineum-v1.json"] = body_text

    identity = {
        "template_id": TEMPLATE_ID,
        "template_version": TEMPLATE_VERSION,
        "geometry_id": GEOMETRY_ID,
        "region_set_id": REGION_SET_ID,
        "atlas_id": ATLAS_ID,
        "atlas_version": ATLAS_VERSION,
        "atlas_content_sha256": content_hash.hexdigest(),
        "body_content_sha256": hashlib.sha256(body_text.encode()).hexdigest(),
        "coordinate_system": "normalized_2d_top_left",
    }
    model = {
        "id": TEMPLATE_ID,
        "version": TEMPLATE_VERSION,
        "geometryId": GEOMETRY_ID,
        "regionSetId": REGION_SET_ID,
        "view": VIEW,
        "name": "会阴区域",
        "logicalWidth": WIDTH,
        "logicalHeight": HEIGHT,
        "imagePath": "/packages/special/assets/perineum/perineum-overview.png",
        "sourcePath": "/packages/special/assets/perineum/perineum-overview.svg",
        "aiPhotoSupported": False,
        "body": model_body,
        "resource": resource["source"],
        "atlas": {
            **META,
            "identity": identity,
            "regions": region_docs,
            "technicalReady": True,
            "blockedReason": "",
            "sourceTitle": manifest["sourceTitle"],
            "sourceUrl": manifest["sourceUrl"],
            "attribution": manifest["attribution"],
            "medicalReviewStatus": "pending",
            "coverageNote": NOTE,
        },
    }
    files["miniprogram/packages/special/data/perineum-schematic.generated.ts"] = (
        "// GENERATED neutral perineum schematic; NOT clinical dermatome geometry.\n"
        'import {LocalSurfaceModel} from "../../../types/local-surface";\n'
        'import {PerineumView} from "../../../types/dermatome";\n'
        f"export const PERINEUM_SCHEMATIC_MODELS:Readonly<Record<PerineumView,LocalSurfaceModel>>="
        f"{json.dumps({VIEW: model}, ensure_ascii=False, separators=(',', ':'))};\n"
    )

    # The rendered atlas JSON is the source of truth for coverage reporting.
    roundtrip_body = shape(view_json)
    roundtrip_regions = {r["labelId"]: shape(r["geometry"]) for r in region_docs}
    union = unary_union(list(roundtrip_regions.values()))
    overlap = sum(
        roundtrip_regions[a].intersection(roundtrip_regions[b]).area
        for index, a in enumerate(roundtrip_regions)
        for b in list(roundtrip_regions)[index + 1 :]
    )
    grid_points = 0
    missed = 0
    for x_index in range(401):
        for y_index in range(561):
            point = (x_index / 400, y_index / 560)
            if roundtrip_body.covers(__import__("shapely.geometry", fromlist=["Point"]).Point(point)):
                grid_points += 1
                if not union.covers(__import__("shapely.geometry", fromlist=["Point"]).Point(point)):
                    missed += 1
    coverage = {
        "view": VIEW,
        "skinArea": roundtrip_body.area,
        "unionArea": union.area,
        "coveredArea": union.intersection(roundtrip_body).area,
        "missingArea": roundtrip_body.difference(union).area,
        "outsideArea": union.difference(roundtrip_body).area,
        "overlapArea": overlap,
        "coveredRatio": min(1.0, union.intersection(roundtrip_body).area / roundtrip_body.area),
        "undefinedArea": roundtrip_regions["UNDEFINED"].area,
        "undefinedRatio": roundtrip_regions["UNDEFINED"].area / roundtrip_body.area,
        "skinGridPoints": grid_points,
        "missedGridPoints": missed,
        "gridSpacing": {"x": 1 / 400, "y": 1 / 560},
        "regionAreas": {
            label: {
                "area": geometry.area,
                "parts": len(geometry.geoms) if geometry.geom_type == "MultiPolygon" else 1,
            }
            for label, geometry in roundtrip_regions.items()
        },
    }
    files["docs/validation-records/v6.7-perineum/evidence/coverage.json"] = (
        json.dumps(coverage, ensure_ascii=False, indent=2) + "\n"
    )

    files["miniprogram/packages/special/assets/perineum/perineum-overview.svg"] = model_svg(
        skin, anal_opening, regions
    )
    files["docs/validation-records/v6.7-perineum/evidence/model-preview.svg"] = model_svg(
        skin, anal_opening, regions
    )
    files["docs/validation-records/v6.7-perineum/evidence/full-partition-preview.svg"] = preview_svg(
        skin, anal_opening, regions, mode="atlas"
    )
    files["docs/validation-records/v6.7-perineum/evidence/undefined-region-preview.svg"] = preview_svg(
        skin, anal_opening, regions, mode="undefined"
    )
    lesion = ellipse(0.500, 0.475, 0.046, 0.066).difference(anal_opening)
    files["docs/validation-records/v6.7-perineum/evidence/sample-match-preview.svg"] = preview_svg(
        skin,
        anal_opening,
        regions,
        mode="atlas",
        lesion=lesion,
        matched_labels=("S4", "S5"),
    )
    files["docs/validation-records/v6.7-perineum/evidence/valid-skin-preview.svg"] = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">'
        "<title>有效皮肤轮廓；模拟示意，非临床神经皮节定位</title>"
        '<rect width="400" height="560" fill="#faf8f4"/>'
        f'<path d="{svg_path(skin)}" fill="#dfece6" stroke="#376b58" stroke-width="1.4" fill-rule="evenodd"/>'
        '<text x="200" y="24" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#40584f">有效可标注皮肤（肛门开口为孔洞）</text>'
        '<text x="200" y="548" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#8b6a5f">模拟示意，非临床神经皮节定位</text>'
        "</svg>"
    )
    return files


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    outputs = build()
    if args.write:
        for name, text in outputs.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
        print(f"WROTE {len(outputs)} files")
    else:
        stale = [name for name, text in outputs.items() if not (ROOT / name).exists() or (ROOT / name).read_text() != text]
        if stale:
            raise SystemExit("Stale perineum exports: " + ", ".join(stale))
        print(f"PASS: {len(outputs)} perineum exports are reproducible")
