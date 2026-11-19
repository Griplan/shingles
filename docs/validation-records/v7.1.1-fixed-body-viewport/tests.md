# 测试记录

日期：2026-11-17。环境：macOS，项目本地工作区。

| 检查 | 结果 | 证据 |
|---|---|---|
| `npm --prefix miniprogram run typecheck` | PASS | `evidence/typecheck.txt` |
| `npm --prefix miniprogram test` | PASS，410/410 | `evidence/miniprogram-tests.txt` |
| `python3 scripts/check_project.py` | PASS | `evidence/project-check.txt` |
| `python3 scripts/sync_atlas.py --check` | PASS | `evidence/atlas-check.txt` |
| `python3 scripts/check_miniprogram_packages.py` | PASS | `evidence/package-check.txt` |
| 微信原生 `wcc` 编译四个 WXML | exit 0，86,201 bytes | `evidence/native-compilers.json`、`evidence/wcc.txt` |
| 微信原生 `wcsc` 编译四个 WXSS | exit 0，4,638 bytes | `evidence/native-compilers.json`、`evidence/wcsc.txt` |
| `git diff --check` | PASS | 本轮最终命令 |

## 专项自动化覆盖

- 三页 `disableScroll` 与固定高度工作台。
- 稳定提示条固定占位。
- 人工标注和放置控制区使用原生纵向 `scroll-view`。
- Canvas 使用 `catchtouchmove`。
- Canvas shell 无 240px 最小高度覆盖父工作区。
- 六种窗口尺寸的缩放锚点稳定性。
- 六种窗口尺寸的平移正向/反向坐标一致性。
- 高频 Canvas 平移边界查询与绘制合并。
- 人工标注、只读手势、正背面、区域选择和弹层隔离继续由既有 Canvas 回归覆盖。
- AI 照片框选 P11 查询合并和坐标一致性继续由既有测试覆盖。
- AI 病灶贴片拖动、缩放、旋转、确认前后几何一致性继续由放置回归覆盖。

## 微信编译

编译输入：

- `pages/select/select.wxml`
- `components/body-canvas/body-canvas.wxml`
- `packages/clinical/pages/annotate/annotate.wxml`
- `packages/clinical/pages/placement/placement.wxml`

同一组页面对应的 WXSS 使用微信工具自带的 `wcsc` 编译。

## 未执行

- 微信开发者工具本轮连续滚动、手势和视觉截图：`NOT_RUN`。读取开发者工具窗口时超时。
- Android/iOS 真机：`NOT_RUN`。
- 物理折叠屏：`NOT_RUN`。
- 体验版上传：`NOT_RUN`。
