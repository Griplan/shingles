#!/usr/bin/env python3
"""Audit the miniprogram package layout without uploading or modifying sources."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
MINIPROGRAM = ROOT / "miniprogram"
APP_CONFIG = MINIPROGRAM / "app.json"
PROJECT_CONFIG = MINIPROGRAM / "project.config.json"
TSC = MINIPROGRAM / "node_modules" / "typescript" / "bin" / "tsc"
LIMIT_BYTES = 2 * 1024 * 1024
IMPORT_RE = re.compile(
    r"""(?:\bfrom\s*|\brequire\s*\(\s*)["']([^"']+)["']""",
    re.MULTILINE,
)
ABSOLUTE_RESOURCE_RE = re.compile(
    r"""(?:imagePath|sourcePath)\s*:\s*["'](/[^"']+)["']"""
)
STATIC_IMAGE_RE = re.compile(r"""<image\b[^>]*\bsrc=["'](/[^"'{}]+)["']""")


@dataclass(frozen=True)
class PackageFile:
    path: str
    size: int
    package: str


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def ignored(path: str, rules: list[dict[str, str]]) -> bool:
    for rule in rules:
        value = rule["value"].strip("/")
        kind = rule["type"]
        if kind == "file" and path == value:
            return True
        if kind == "folder" and (path == value or path.startswith(value + "/")):
            return True
        if kind == "suffix" and path.endswith(value):
            return True
        if kind == "prefix" and path.startswith(value):
            return True
        if kind == "glob" and fnmatch.fnmatch(path, value):
            return True
    return False


def package_for(path: str, subpackages: list[dict[str, Any]]) -> str:
    for subpackage in subpackages:
        root = subpackage["root"].strip("/") + "/"
        if path.startswith(root):
            return subpackage.get("name") or subpackage["root"]
    return "main"


def resolve_import(source: Path, specifier: str) -> Path | None:
    if not specifier.startswith("."):
        return None
    base = (source.parent / specifier).resolve()
    candidates = [
        base,
        base.with_suffix(".ts"),
        base.with_suffix(".js"),
        base.with_suffix(".json"),
        base / "index.ts",
        base / "index.js",
    ]
    return next((candidate for candidate in candidates if candidate.is_file()), None)


def boundary_errors(subpackages: list[dict[str, Any]]) -> list[str]:
    roots: dict[str, Path] = {
        item.get("name") or item["root"]: (MINIPROGRAM / item["root"]).resolve()
        for item in subpackages
    }
    errors: list[str] = []

    def owning_package(path: Path) -> str:
        resolved = path.resolve()
        for name, root in roots.items():
            if resolved == root or root in resolved.parents:
                return name
        return "main"

    for source in MINIPROGRAM.rglob("*"):
        if not source.is_file() or "node_modules" in source.parts:
            continue
        source_package = owning_package(source)
        relative = source.relative_to(MINIPROGRAM).as_posix()

        if source.suffix == ".ts":
            text = source.read_text(encoding="utf-8")
            for specifier in IMPORT_RE.findall(text):
                target = resolve_import(source, specifier)
                if target is None:
                    continue
                target_package = owning_package(target)
                if target_package != "main" and target_package != source_package:
                    errors.append(
                        f"{relative}: {source_package} imports {target_package} module "
                        f"{target.relative_to(MINIPROGRAM).as_posix()}"
                    )

            for resource in ABSOLUTE_RESOURCE_RE.findall(text):
                if Path(resource).suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
                    continue
                if not (MINIPROGRAM / resource.lstrip("/")).is_file():
                    errors.append(f"{relative}: missing runtime resource {resource}")

        if source.suffix == ".json":
            try:
                config = json.loads(source.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            for component in config.get("usingComponents", {}).values():
                if not isinstance(component, str) or not component.startswith("/"):
                    continue
                target = MINIPROGRAM / component.lstrip("/")
                if not target.with_suffix(".json").is_file():
                    errors.append(f"{relative}: missing component {component}")
                target_package = owning_package(target)
                if target_package != "main" and target_package != source_package:
                    errors.append(
                        f"{relative}: {source_package} uses {target_package} component {component}"
                    )

        if source.suffix == ".wxml":
            text = source.read_text(encoding="utf-8")
            for resource in STATIC_IMAGE_RE.findall(text):
                if not (MINIPROGRAM / resource.lstrip("/")).is_file():
                    errors.append(f"{relative}: missing image resource {resource}")

    return sorted(set(errors))


def emit_typescript(output: Path) -> None:
    if not TSC.is_file():
        raise SystemExit(f"TypeScript compiler not found: {TSC}")
    command = [
        "node",
        str(TSC),
        "--project",
        str(MINIPROGRAM / "tsconfig.json"),
        "--noEmit",
        "false",
        "--outDir",
        str(output),
    ]
    result = subprocess.run(command, cwd=MINIPROGRAM, text=True, capture_output=True)
    if result.returncode:
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="")
        raise SystemExit(result.returncode)


def collect(subpackages: list[dict[str, Any]], rules: list[dict[str, str]]) -> list[PackageFile]:
    files: dict[str, PackageFile] = {}
    with tempfile.TemporaryDirectory(prefix="dermatome-package-audit-") as temp:
        compiled_root = Path(temp)
        emit_typescript(compiled_root)
        for source in MINIPROGRAM.rglob("*"):
            if not source.is_file():
                continue
            relative = source.relative_to(MINIPROGRAM).as_posix()
            if relative.startswith("node_modules/") or ignored(relative, rules):
                continue
            if relative.endswith(".ts"):
                emitted = compiled_root / (relative[:-3] + ".js")
                if emitted.is_file():
                    files[relative[:-3] + ".js"] = PackageFile(
                        relative[:-3] + ".js",
                        emitted.stat().st_size,
                        package_for(relative, subpackages),
                    )
                continue
            files[relative] = PackageFile(
                relative,
                source.stat().st_size,
                package_for(relative, subpackages),
            )
    return sorted(files.values(), key=lambda item: (-item.size, item.path))


def summarize(files: list[PackageFile], packages: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for package in packages:
        package_files = [item for item in files if item.package == package]
        total = sum(item.size for item in package_files)
        result[package] = {
            "bytes": total,
            "mib": round(total / (1024 * 1024), 3),
            "limit_bytes": LIMIT_BYTES,
            "remaining_bytes": LIMIT_BYTES - total,
            "remaining_mib": round((LIMIT_BYTES - total) / (1024 * 1024), 3),
            "file_count": len(package_files),
            "passes_limit": total < LIMIT_BYTES,
            "largest_files": [
                {"path": item.path, "bytes": item.size, "mib": round(item.size / (1024 * 1024), 3)}
                for item in package_files[:20]
            ],
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-output", type=Path, help="Write the complete audit to this path.")
    parser.add_argument("--top", type=int, default=20, help="Number of largest files to print.")
    args = parser.parse_args()

    app = load_json(APP_CONFIG)
    project = load_json(PROJECT_CONFIG)
    subpackages = app.get("subPackages", app.get("subpackages", []))
    rules = project.get("packOptions", {}).get("ignore", [])
    files = collect(subpackages, rules)
    errors = boundary_errors(subpackages)
    packages = ["main", *[item.get("name") or item["root"] for item in subpackages]]
    report = {
        "method": (
            "Conservative local estimate: TypeScript is emitted without minification; "
            "WXML/WXSS/JSON/runtime assets are included after project.config packOptions "
            "ignore rules. WeChat upload-time minification can only reduce this estimate."
        ),
        "limit_bytes": LIMIT_BYTES,
        "packages": summarize(files, packages),
        "total_bytes": sum(item.size for item in files),
        "total_files": len(files),
        "largest_files": [
            {
                "path": item.path,
                "package": item.package,
                "bytes": item.size,
                "mib": round(item.size / (1024 * 1024), 3),
            }
            for item in files[: args.top]
        ],
        "boundary_errors": errors,
    }

    print("Package sizes (conservative local estimate before WeChat minification)")
    for package in packages:
        data = report["packages"][package]
        status = "PASS" if data["passes_limit"] else "FAIL"
        print(
            f"{status:4} {package:12} {data['bytes']:>9} bytes  "
            f"{data['mib']:.3f} MiB  remaining {data['remaining_bytes']} bytes"
        )
    print("\nLargest files")
    for item in report["largest_files"]:
        print(f"{item['bytes']:>9}  {item['package']:8}  {item['path']}")
    if errors:
        print("\nBoundary errors")
        for error in errors:
            print(f"ERROR {error}")
    else:
        print("\nBoundary check: PASS")

    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"\nJSON report: {args.json_output}")
    if errors or not all(data["passes_limit"] for data in report["packages"].values()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
