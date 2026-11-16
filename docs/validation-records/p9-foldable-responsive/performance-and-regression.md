# 性能与回归

环境：macOS 15.6.1 arm64、Node 24.11.1、项目既有 Python 虚拟环境、微信开发者工具 Stable 2.01.2510290。执行日期 2026-11-10。

- `npm --prefix miniprogram run typecheck`、`npm --prefix miniprogram test`：通过，384 项。
- `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 PYTHONPATH=backend:. ai/.venv/bin/python -m pytest -q backend/tests ai/tests`：通过，322 项，7 条既有依赖警告。
- 微信工具内置 `wcc`、`wcsc`、`python3 scripts/check_project.py`、`python3 scripts/sync_atlas.py --check`、`python3 scripts/check_miniprogram_packages.py`、`git diff --check`：通过。见[包体和引用审计](evidence/package-audit.json)。
- 原有回归覆盖正背面、人体手部、人工标注、全身匹配、脚底、腋下、会阴、照片框选和 Mask、AI 放置、高频本地预览、多片和孔洞。新增测试覆盖人体折叠矩阵、照片换尺寸后重绘和过期手势、局部重测/卸载、放置参数回滚、结果在 resize 后保持且无新增请求。

[本机配对微基准](evidence/resize-microbenchmark.json)：同一 Canvas JS 记录器，交替比较旧版与 P9 主体画布，8 对重复；每次 1000 组，组内连续触发 5 个 resize，尺寸在 360×540 和 440×610 之间切换。待执行回调从 5000 降至 1000；测量次数两组均为 1000，图片均加载 2 张。JS 耗时中位数由 135.68 ms 增至 180.30 ms（约多 0.045 ms/组）；本地记录器未体现桥接成本或 GPU 绘图。P6 既有性能回归通过，不能据此宣称整体交互提速或真机无回退。

首轮回归捕获视口交接高度被 onShow 重算、旧测试对新 DPR 预算与 resize 取消语义不适用；修复并添加对应断言。矩阵首跑的测试点不在最窄焦点视口内，改用聚焦区域内部固定点，未放宽误差阈值。
