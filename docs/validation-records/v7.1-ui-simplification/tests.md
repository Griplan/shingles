# V7.1 测试记录

环境：macOS，仓库既有 Node/TypeScript、Python 3.12 虚拟环境、微信开发者工具 Stable 2.01.2510290。

| 检查 | 结果 |
|---|---|
| `npm --prefix miniprogram run typecheck` | PASS |
| `npm --prefix miniprogram test` | 406/406 PASS |
| `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 ENABLE_AI_SEGMENTATION=1 PYTHONPATH=backend:. ai/.venv/bin/python -m pytest backend/tests ai/tests -q` | 330/330 PASS，7 条既有依赖警告 |
| `python3 scripts/check_project.py` | PASS |
| `python3 scripts/sync_atlas.py --check` | PASS |
| `python3 scripts/check_miniprogram_packages.py` | PASS |
| `git diff --check` | PASS |
| 微信 `wcc` | PASS；输出 125,206 bytes |
| 微信 `wcsc` | PASS；输出 4,731 bytes |
| 微信开发者工具重新编译 | PASS；Errors 0 |
| 微信模拟器正背面切换 | PASS |

分包保守体积：

| 包 | bytes | MiB | 2 MiB 余量 |
|---|---:|---:|---:|
| 主包 | 884,614 | 0.844 | 1,212,538 |
| clinical | 1,405,795 | 1.341 | 691,357 |
| special | 756,628 | 0.722 | 1,340,524 |

这里使用微信上传前的保守本地估算。微信实际压缩包会另行计算，本轮没有上传新体验版。

## 新增与调整测试

- 新增 `tests/miniprogram/v7.1-ui-simplification.test.cjs`。
- `annotation-flow` 验证完成标注后自动匹配及已确认页面重新打开。
- `matching-presentation` 验证单片/多片范围和空结果。
- `placement-session` 验证正背面切换与结果状态不破坏放置草稿。
- 原 P9 折叠尺寸、P11 Canvas 帧合并、人体坐标、匹配失效、AI 上传/放置/确认和特殊部位回归继续通过。

## 未验证

- Android/iOS 真机、物理折叠屏、不同系统字体下的像素级控件间距。
- 手机真机完整 AI 相册、拍摄、MobileSAM 与特殊部位连续手势。
- 真机长时拖动 FPS、触摸延迟、内存和发热。

静态编译、模拟器与 Node 测试不能替代以上真机验收。
