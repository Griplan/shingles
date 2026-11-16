# V6.7 测试记录

## 环境

- 日期：2026-11-07
- Python：3.12
- 后端与 AI 测试环境：`ai/.venv`，包含 FastAPI、Shapely、Pillow、PyTorch 和 MobileSAM 测试依赖
- 前端：Node.js + TypeScript 5.9.3
- 微信静态编译器：`/Applications/wechatwebdevtools.app/Contents/Resources/package.nw/node_modules/wcc-exec/`

## 通过项

| 检查 | 命令 | 结果 | 证据 |
| --- | --- | --- | --- |
| 前端全量 | `cd miniprogram && npm test` | 359 passed，0 failed | `evidence/frontend-tests.log` |
| TypeScript | `cd miniprogram && npm run typecheck` | exit 0 | `evidence/typecheck.log` |
| 后端与 AI | `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 ai/.venv/bin/python -m pytest -q backend/tests ai/tests` | 322 passed，7 warnings | `evidence/backend-ai-tests.log` |
| 图谱复现 | `ai/.venv/bin/python scripts/build_perineum_schematic.py` | 14 exports reproducible | `evidence/reproducibility.log` |
| 预览渲染 | `DERMATOME_SHARP_MODULE=... node scripts/render_perineum.cjs` | exit 0 | `evidence/render.log` |
| WXML 编译 | 微信自带 `wcc`，编译 special-parts、local-surface、local-surface-canvas | exit 0；分别 40,720 / 53,643 / 39,762 bytes | `evidence/wcc.log` |
| WXSS 编译 | 微信自带 `wcsc`，编译对应三个样式文件 | exit 0；分别 862 / 3,241 / 414 bytes | `evidence/wcsc.log` |
| 微信原生流程 | 微信开发者工具 iPhone 5、iPhone X、iPhone 14 Pro Max | PASSED；真实取点、闭合、复核、后端匹配和高亮 | `evidence/wechat-runtime.md`、六张微信截图 |
| 腋下只读复现 | `ai/.venv/bin/python scripts/build_axilla.py` | 10 artifacts，0 dermatome regions | `evidence/axilla-reproduction.log` |
| 足底只读复现 | `ai/.venv/bin/python scripts/build_sole_atlas.py` | PASSED | `evidence/sole-reproduction.log` |
| 全身图谱检查 | `ai/.venv/bin/python scripts/check_preview_atlas.py` | PASSED，正面64区、背面72区 | `evidence/wholebody-atlas.log` |
| 工程结构检查 | `ai/.venv/bin/python scripts/check_project.py` | PASSED | `evidence/project-check.log` |

7 条 Python 警告均为既有 MobileSAM/timm 注册和弃用提示，不是本轮新增失败。

## 首次环境失败与修正

首次在 `backend/.venv` 直接执行全量 Pytest 时，测试收集因该环境未安装 Pillow 而失败：

```text
ModuleNotFoundError: No module named 'PIL'
2 errors during collection
```

该失败发生在测试收集阶段，不是业务测试失败。随后使用仓库既有、包含 AI 依赖的 `ai/.venv`，通过全部 322 项测试。

首次生成器和渲染命令还因工作目录错误及未指定已有 `sharp` 模块路径而失败。改用项目根目录和实际缓存的 `sharp` 路径后通过。

## 测试覆盖

- 单视图注册、模板版本、逻辑画布和素材存在性。
- 肛门孔洞和 5 个参考点。
- 会阴会话与脚底、腋下、全身会话隔离。
- 多片、撤销、删除、复核、缩放复位。
- 模拟状态字段完整性。
- 单片、多片、孔洞、重复并集、跨区、共享边界。
- 人体外、自交、版本不一致和发布环境拒绝。
- 特殊部位入口，且退役手掌入口未恢复。
- 会阴 Canvas 读屏标签不再继承“右脚足底”，并覆盖所有现用局部模板。
- V1–V6.6 原有前端、后端和 AI 回归。

## 微信原生实测

| 模拟器 | 实际结果 |
| --- | --- |
| iPhone 5，320 × 568 | 3 点闭合后匹配 S2、未定区、S4、S5；覆盖 >99.99% |
| iPhone X，375 × 812 | 3 点闭合后匹配 S2、未定区、S4；覆盖 100% |
| iPhone 14 Pro Max，430 × 932 | 3 点闭合后匹配 S2、未定区、S4；覆盖 100% |
| iPhone 12/13 Pro Max，428 × 926 | 全部区域、S2 单区、恢复全部、放大和复位均通过 |

首轮使用旧 `127.0.0.1:8000` 进程时收到 422。改用当前测试后端后请求成功。微信控制台仍有框架弃用、WXSS 选择器和 SharedArrayBuffer 警告，没有影响本轮功能。

## NOT_RUN

- 手机体验版、腾讯云部署和线上接口联调。
- 手机真机及不同物理设备的触摸和视觉复测。
- 医学专业审核和临床验证。

微信模拟器已经完成原生运行验收，但不能替代手机真机、体验版或临床验证。
