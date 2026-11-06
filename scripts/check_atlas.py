"""检查 V0 空图谱的 JSON/元数据约束；不实现几何或医学验证。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

DEFAULT_ATLAS = Path(__file__).resolve().parents[1] / "data" / "atlas" / "v1"


def read_object(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path.name}: 顶层必须是 JSON 对象")
    return value


def check_v0_atlas(directory: Path) -> list[str]:
    """只接受本轮获准的未验证空图谱，不宣称具备医学验证能力。"""
    manifest = read_object(directory / "manifest.json")
    expected_manifest = {
        "atlas_version": "v1",
        "coordinate_system": {
            "type": "normalized_2d",
            "origin": "top_left",
            "x_range": [0, 1],
            "y_range": [0, 1],
            "x_direction": "right",
            "y_direction": "down",
            "laterality": "anatomical",
        },
        "source": {"status": "not_acquired", "references": []},
        "license": {"status": "not_acquired", "identifier": None},
        "validation_status": "unverified",
        "mapping_enabled": False,
        "views": {
            "front": {"file": "front.json", "background_image": None},
            "back": {"file": "back.json", "background_image": None},
        },
        "medical_review": {
            "status": "not_started",
            "reviewer": None,
            "reviewed_at": None,
            "record": None,
        },
    }
    errors = []
    for field, expected in expected_manifest.items():
        if field not in manifest or manifest[field] != expected:
            errors.append(f"manifest.json: {field} 不符合 V0 未验证空图谱约束")
    # JSON 的 false 不能用数值 0 代替。
    if manifest.get("mapping_enabled") is not False:
        errors.append("manifest.json: mapping_enabled 必须是布尔 false")
    for view in ("front", "back"):
        payload = read_object(directory / f"{view}.json")
        expected_view = {"atlas_version": "v1", "view": view, "regions": []}
        if payload != expected_view:
            errors.append(f"{view}.json: 必须为正确版本/视图且 regions 为空的 V0 结构")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas-dir", type=Path, default=DEFAULT_ATLAS)
    args = parser.parse_args()
    try:
        errors = check_v0_atlas(args.atlas_dir)
    except (OSError, ValueError) as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f"FAILED: {error}", file=sys.stderr)
        return 1
    print("PASSED: V0 图谱 JSON/元数据符合约束；正背面为空、未验证、不可用于医学映射。")
    print("此检查不验证多边形几何、来源真实性或医学准确性。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
