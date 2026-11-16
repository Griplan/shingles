# V5.3 病灶放置拖动性能本地审查（2026-11-12）

## 结论

本轮定位到两个前端原因：

1. `placement-overlay` 在每次 `touchmove` 都向页面派发 `placementdrag`。页面随后读取放置草稿、调用 `PlacementSessionStore.update(false)`、增加草稿 revision，再通过 `previewTransform` 把新变换送回 Canvas 组件。虽然这一版本已经不在移动阶段遍历全部 MultiPolygon，但每帧仍需经过微信组件事件桥、会话读取、对象冻结和页面/组件调用链。
2. `touchend` 与前面的移动事件共用 Promise 队列。真实设备上组件事件桥明显慢于 Node，移动事件积压时，结束事件会延后；页面因此长时间保持 `dragging=true`。同时“确认位置并计算”还要求当前 revision 的 Canvas 帧返回 `overlayReady=true`。结束事件未及时完成或新帧未及时确认时，按钮会持续禁用。

修复后，移动阶段只维护 `translationX/translationY` 形成的临时 `PlacementTransform`，由 Canvas 组件直接使用缓存贴片和 RAF 合并绘制。组件只在开始时通知页面一次、松手时通知一次；页面只在松手后执行一次正式几何变换、一次完整人体边界校验和一次状态同步。

## 修改

- `miniprogram/packages/clinical/components/placement-overlay/placement-overlay.ts`
  - 保存拖动起始变换。
  - `touchmove` 在组件内部更新本地变换并调用 `queueDraw()`。
  - 不再为每次移动派发 `placementdrag`。
  - `touchend` 使用最后触点生成最终变换，只派发一次结束事件。
  - 取消拖动会丢弃本地预览，不修改正式草稿。
- `miniprogram/packages/clinical/pages/placement/placement.ts`
  - 结束事件优先消费组件给出的最终变换。
  - 松手时先清除 `dragging`，再执行一次完整更新。
  - 保留旧 `move` 事件的兼容处理，但当前组件不再发送该事件。

没有修改 MobileSAM、后端、人体模板、神经图谱、V4 匹配公式、照片上传或 V2 正式数据结构。

## 同环境对照

输入为 2000 顶点、5 片、5 孔、375 px 宽；每个版本运行 3 次。计时来自生产 TS 编译后的 Node/wx/Canvas 命令适配器，不包含微信原生组件桥、GPU、栅格化和真机 FPS。

| 指标（120 次移动） | 修复前中位数 | 修复后中位数 |
|---|---:|---:|
| 跨组件 `placementdrag` 事件 | 121 | 1 |
| 页面 `onDrag` JS 合计 | 0.552 ms | 0.002 ms |
| 页面 `setData` | 2 | 1 |
| 整个移动阶段 wall time | 1.117 ms | 0.501 ms |
| 松手后完整校验 | 32.340 ms | 32.503 ms |
| 进入放置页初始化 | 57.196 ms | 55.046 ms |

松手后的完整人体边界校验保持不变，这是按钮启用前必须保留的正确性检查。移动阶段不再承担它。

## 正确性和交互验证

- TypeScript：PASSED。
- 前端自动化：`391/391 PASSED`。
- 新增验证覆盖：
  - 120 次移动只合并为 1 个绘制帧。
  - 移动阶段只发布开始事件，不逐次跨组件通知页面。
  - 最终坐标使用最后一次触摸位置。
  - 松手后只生成一次正式人体几何并执行一次完整校验。
  - `dragging=false`、`valid=true` 后，收到当前 revision 的 `overlayReady=true` 即可满足原生按钮启用条件。
  - 缓存贴片、MultiPolygon、孔洞、照片坐标与人体坐标契约不变。
- 微信自带 `wcc`：PASSED，44,639 bytes。
- 微信自带 `wcsc`：PASSED，1,648 bytes。
- 项目结构、图谱一致性和分包体积：PASSED。
- `git diff --check`：PASSED。

## 尚未验证

- 微信开发者工具原生拖动延迟和真机 FPS：`NOT_RUN`。本轮两次 Computer Use 初始化均超时，不能把 Node 计时或静态编译写成原生性能通过。
- Android/iOS 真机长手势、低端机、折叠屏和触控采样率：`NOT_RUN`。
- 真实患者数据未使用；测试均为合成几何或公开/本地测试夹具。

## 回滚

仅回退本轮两个前端文件和对应测试即可。不得使用整库 reset 或 clean，因为工作区包含大量此前未提交的 V6.7、P8/P9/P10/P11 和分包改动。
