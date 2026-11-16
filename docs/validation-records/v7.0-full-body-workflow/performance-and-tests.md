# 性能与测试

## 性能约束

V7.0 复用现有 P6、P9 和 P11 机制：

- 拖放过程中只更新标量变换和缓存贴片，不逐帧生成 MultiPolygon；
- 不在 `touchmove` 中调用 Shapely 或图谱求交；
- Canvas 绘制按单帧合并，避免累积动画循环；
- 页面 resize、折叠屏重排和换面会使旧尺寸缓存失效；
- 照片只在进入放置前处理一次，交换正背面不重新运行 MobileSAM；
- 后端照片在放置首帧稳定后异步释放，图片 DELETE 不阻塞本地放置。

最终确认最多执行一次正式相似变换、一次本地完整人体校验，并在部分越界时执行一次后端精确交集。最终 V2 保存和 V4 匹配各只发生一次。

## 执行结果

| 检查 | 结果 |
| --- | --- |
| `npm --prefix miniprogram run typecheck` | PASS |
| `npm --prefix miniprogram test` | 404/404 PASS |
| 后端与 AI 完整 pytest | 330/330 PASS，7 条既有依赖警告 |
| 新增门禁、请求上限、人体交集定向测试 | 37/37 PASS |
| `/private/tmp/dermatome-v70-wxml.js` | 104,152 bytes，exit 0 |
| `/private/tmp/dermatome-v70-wxss.js` | 4,276 bytes，exit 0 |
| `python3 scripts/check_project.py` | PASS |
| `python3 scripts/sync_atlas.py --check` | PASS |
| `python3 scripts/check_miniprogram_packages.py` | PASS |
| `git diff --check` | PASS |

保守本地包体：

| 包 | bytes | MiB | 2 MiB 余量 |
| --- | ---: | ---: | ---: |
| main | 884,919 | 0.844 | 1,212,233 |
| clinical | 1,403,785 | 1.339 | 693,367 |
| special | 756,519 | 0.721 | 1,340,633 |

这些是微信压缩前的保守估计，不是上传包最终字节数。

## 微信状态

微信开发者工具已重新编译，状态显示 `Errors: 0`、2 条警告。刷新后模拟器 AX 状态确认入口为 `pages/select/select`，并显示“完整人体标注”“手动标注”“AI 辅助标注”和“自由标注（无需选择部位）”。截图层仍保留旧帧；自动点击嵌套 WebView 元素时返回 `invalid element ID`。

因此：

- WXML/WXSS 原生编译：`PASS`；
- 微信开发者工具页面加载：`PASS`；
- 模拟器完整手动跨区标注：`NOT_RUN`；
- 模拟器 AI 上传到最终匹配：`NOT_RUN`；
- Android/iOS 真机和折叠屏：`NOT_RUN`。

## 回归保护

全身、正背面、手部合成区域、脚底、腋下、会阴、AI 候选、照片释放、P6/P9/P11 和分包边界测试全部包含在前端 404 项回归中。未修改 MobileSAM、原始图谱几何、V4 数值公式、图片安全上限或特殊部位模拟边界。

本轮没有部署腾讯云、上传体验版、提交或推送 Git。
