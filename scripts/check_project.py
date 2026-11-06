"""静态检查 V0～V6.1 文件、JSON 和页面配置，不代替微信开发者工具编译。"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = (
    "README.md", "task.md", "AGENTS.md", ".gitignore",
    "miniprogram/types/annotation.ts", "miniprogram/state/annotation-session.ts",
    "miniprogram/utils/annotation-geometry.ts", "miniprogram/components/body-canvas/lesion-render.ts",
    "tests/miniprogram/annotation-geometry.test.cjs", "tests/miniprogram/annotation-session.test.cjs",
    "tests/miniprogram/annotation-flow.test.cjs", "backend/tests/fixtures/synthetic-annotation-geometry.json",
    "docs/requirements.md", "docs/architecture.md", "docs/api.md",
    "docs/atlas-spec.md", "docs/validation.md", "docs/privacy.md",
    "miniprogram/app.ts", "miniprogram/app.json", "miniprogram/app.wxss",
    "miniprogram/project.config.json", "miniprogram/tsconfig.json",
    "miniprogram/package.json", "miniprogram/package-lock.json", "miniprogram/services/api.ts",
    "miniprogram/utils/coordinate.ts", "miniprogram/types/dermatome.ts",
    "miniprogram/data/body-regions.ts", "miniprogram/assets/body/model.ts",
    "miniprogram/data/body-models.ts", "miniprogram/assets/body/neutral-v2.ts",
    "miniprogram/assets/body/neutral-v3.ts", "miniprogram/data/body-regions-v2.ts",
    "miniprogram/data/body-regions-v3.ts", "miniprogram/assets/body/commons-v1.ts",
    "miniprogram/assets/body/commons-cc0/source.svg", "miniprogram/assets/body/commons-cc0/manifest.json",
    "miniprogram/assets/body/commons-cc0/front.svg", "miniprogram/assets/body/commons-cc0/back.svg",
    "miniprogram/assets/body/commons-cc0/front.png", "miniprogram/assets/body/commons-cc0/back.png",
    "miniprogram/assets/body/commons-cc0/geometry.generated.ts", "miniprogram/assets/body/commons-cc0/NOTICE.md",
    "scripts/prepare_commons_body.py", "scripts/prepare_commons_body.cjs", "scripts/preview_body.cjs",
    "tests/miniprogram/commons-registration.test.cjs", "tests/miniprogram/fixtures/v3-model.cjs",
    "miniprogram/utils/body-path.ts", "miniprogram/utils/body-debug.ts",
    "miniprogram/utils/body-hit-test.ts", "tests/miniprogram/region-hit.test.cjs",
    "tests/miniprogram/selection.test.cjs", "backend/tests/fixtures/synthetic-ui-hit.json",
    "miniprogram/data/body-regions-v15.ts", "scripts/check_body_regions.py", "scripts/preview_regions.cjs",
    "tests/miniprogram/region-refinement.test.cjs", "tests/miniprogram/fixtures/commons-region-references.json",
    "tests/miniprogram/helpers/png-alpha.cjs", "docs/body-regions.md",
    "miniprogram/components/region-picker/region-picker.ts",
    "miniprogram/components/region-picker/region-picker.json",
    "miniprogram/components/region-picker/region-picker.wxml",
    "miniprogram/components/region-picker/region-picker.wxss",
    "miniprogram/components/body-canvas/body-canvas.ts",
    "miniprogram/components/body-canvas/body-canvas.json",
    "miniprogram/components/body-canvas/body-canvas.wxml",
    "miniprogram/components/body-canvas/body-canvas.wxss",
    "miniprogram/components/body-canvas/render.ts",
    "scripts/test_miniprogram.cjs", "tests/miniprogram/coordinate.test.cjs",
    "tests/miniprogram/canvas.test.cjs",
    "tests/miniprogram/body-debug.test.cjs",
    "tests/miniprogram/anatomy-registration.test.cjs",
    "backend/app/__init__.py", "backend/app/main.py",
    "backend/app/api/__init__.py", "backend/app/api/routes/__init__.py",
    "backend/app/api/routes/health.py", "backend/app/api/routes/atlas.py",
    "backend/app/api/routes/evaluate.py", "backend/app/schemas/__init__.py",
    "backend/app/schemas/evaluate.py", "backend/app/services/__init__.py",
    "backend/app/services/atlas_service.py", "backend/app/services/dermatome_matcher.py",
    "backend/app/utils/__init__.py", "backend/app/utils/geometry.py",
    "backend/tests/test_health.py", "backend/tests/test_api.py", "backend/pyproject.toml",
    "data/atlas/v1/manifest.json", "data/atlas/v1/front.json", "data/atlas/v1/back.json",
    "data/references.md", "ai/README.md", "scripts/check_atlas.py",
)
REQUIRED_DIRECTORIES = (
    "miniprogram/components/body-canvas", "miniprogram/components/lesion-editor",
    "miniprogram/components/segment-overlay", "miniprogram/assets/body",
    "data/examples", "ai/experiments", "ai/inference", "ai/models",
)


def main() -> int:
    errors: list[str] = []
    for relative in REQUIRED_FILES:
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"必要文件不存在或为空：{relative}")
    for relative in REQUIRED_DIRECTORIES:
        path = ROOT / relative
        if not path.is_dir() or not any(path.iterdir()):
            errors.append(f"目录不存在或缺少 .gitkeep 等保留文件：{relative}")
    expected_pages = [f"pages/{name}/{name}" for name in ("index", "select", "annotate", "result", "atlas-debug", "ai-annotate", "placement", "special-parts", "local-surface")]
    try:
        app = json.loads((ROOT / "miniprogram/app.json").read_text(encoding="utf-8"))
        if app.get("pages") != expected_pages:
            errors.append("app.json 页面注册或首页顺序不符合现有页面与独立脚底页面约定")
        for page in expected_pages:
            for extension in ("ts", "json", "wxml", "wxss"):
                if not (ROOT / "miniprogram" / f"{page}.{extension}").is_file():
                    errors.append(f"缺少页面文件：{page}.{extension}")
            markup = (ROOT / "miniprogram" / f"{page}.wxml").read_text(encoding="utf-8")
            targets = re.findall(r'<navigator\b[^>]*\burl="([^"]+)"', markup)
            # V4 uses a guarded return handler to preserve the annotation session.
            source = (ROOT / "miniprogram" / f"{page}.ts").read_text(encoding="utf-8")
            guarded_return = (page == "pages/result/result" and 'bindtap="backToEdit"' in markup
                              and 'backToEdit()' in source and 'wx.navigateBack(' in source
                              and '/pages/annotate/annotate?sessionId=' in source)
            compatibility_redirect = (page == "pages/result/result" and 'wx.redirectTo(' in source
                                      and '/pages/annotate/annotate?sessionId=' in source)
            ai_return = page == "pages/ai-annotate/ai-annotate" and 'bindtap="backManual"' in markup and "wx.navigateBack(" in source
            placement_return = page == "pages/placement/placement" and 'bindtap="backPhoto"' in markup and 'wx.navigateBack(' in source
            local_return = page in ("pages/special-parts/special-parts", "pages/local-surface/local-surface") and 'bindtap="returnBody"' in markup and 'wx.navigateBack(' in source
            if not targets and not guarded_return and not compatibility_redirect and not ai_return and not placement_return and not local_return:
                errors.append(f"页面缺少基本导航：{page}")
            for target in targets:
                if target.lstrip("/") not in expected_pages:
                    errors.append(f"未注册的导航目标：{page} → {target}")
        json_paths = list((ROOT / "miniprogram").glob("*.json"))
        json_paths += list((ROOT / "miniprogram/pages").rglob("*.json"))
        json_paths += list((ROOT / "miniprogram/components").rglob("*.json"))
        json_paths += list((ROOT / "data/atlas/v1").glob("*.json"))
        for path in json_paths:
            json.loads(path.read_text(encoding="utf-8"))
        select_config = json.loads((ROOT / "miniprogram/pages/select/select.json").read_text(encoding="utf-8"))
        component = select_config.get("usingComponents", {}).get("body-canvas")
        if component != "/components/body-canvas/body-canvas":
            errors.append("select 页面未注册已有 body-canvas 组件")
        if select_config.get("usingComponents", {}).get("region-picker") != "/components/region-picker/region-picker":
            errors.append("select 页面未注册底部区域选择组件")
        annotate_config = json.loads((ROOT / "miniprogram/pages/annotate/annotate.json").read_text(encoding="utf-8"))
        if annotate_config.get("usingComponents", {}).get("body-canvas") != "/components/body-canvas/body-canvas":
            errors.append("annotate 页面未复用 body-canvas")
        local_config = json.loads((ROOT / "miniprogram/pages/local-surface/local-surface.json").read_text())
        if local_config.get("usingComponents", {}).get("local-surface-canvas") != "/components/local-surface-canvas/local-surface-canvas":
            errors.append("局部页面缺少局部视图 Canvas")
        for extension in ("ts", "json", "wxml", "wxss"):
            if not (ROOT / "miniprogram/components/local-surface-canvas" / f"local-surface-canvas.{extension}").is_file():
                errors.append(f"缺少局部组件文件：{extension}")
        canvas_markup = (ROOT / "miniprogram/components/body-canvas/body-canvas.wxml").read_text(encoding="utf-8")
        if not re.search(r'<canvas\b[^>]*\btype="2d"', canvas_markup):
            errors.append("body-canvas 必须使用 type=2d 的原生 Canvas")
    except (OSError, ValueError, AttributeError) as exc:
        errors.append(f"JSON/路径检查失败：{exc}")
    if errors:
        for error in errors:
            print(f"FAILED: {error}", file=sys.stderr)
        return 1
    print("PASSED: V0～V6.1 必要文件、目录、JSON、九页导航、组件注册及 Canvas 2D 配置完整。")
    print("此检查不代表 WXML/WXSS 编译、页面导航交互或真机验证通过。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
