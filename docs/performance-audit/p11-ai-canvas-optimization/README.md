# P11 AI 照片框选 Canvas 性能优化

日期：2026-11-10

## 结论

照片框选的高频路径已从“每次 `touchmove` 查询 Canvas、完整重绘并更新页面数据”改为：

1. 画布节点和尺寸在页面生命周期内缓存；
2. client 坐标的画布位置在一个手势内只查询一次；
3. 多次移动事件合并到单个 Canvas `requestAnimationFrame`；
4. 高频拖动不再调用 `setData`；
5. 图片、Mask、提示框和画笔仍由同一个完整帧原子提交；
6. `touchEnd` 始终使用最后一次有效事件坐标生成最终框选。

本轮只优化前端照片 Canvas。MobileSAM、FastAPI、图片上传限制、人体模板、医学图谱、V4 匹配公式和服务器配置均未修改。

## 优化前调用链

修改前，client 坐标的 `touchmove` 大致执行：

```text
touchMove
→ queueTouch
→ point
→ createSelectorQuery().boundingClientRect()
→ redraw
→ createSelectorQuery().fields({node,size})
→ clearRect
→ drawImage(photo)
→ drawImage(mask)
→ 重画提示框/画笔
→ setData({error:""})
→ renderstate
```

因此 120 次移动会重复执行约 122 次画布矩形查询、120 次节点/尺寸查询、120 次完整重绘和 120 次 `setData`。原因不是图片变换本身，而是高频事件直接进入完整测量和绘制路径，且没有手势级缓存或帧合并。

## 修改位置

生产代码仅修改：

- `miniprogram/packages/clinical/components/photo-canvas/photo-canvas.ts`

主要改动：

- 在组件运行时状态中缓存 Canvas 节点、尺寸和 client 矩形；
- `pageLifetimes.resize/hide/show`、`layoutRevision`、图片源变化、Canvas 节点变化和手势结束时使相关缓存失效；
- `queueRedraw()` 使用 Canvas `requestAnimationFrame` 合并待绘制更新，Canvas 节点尚未取得时使用 16 ms 单次定时器回退；
- `touchmove` 只更新内部手势状态并安排一帧，不再直接同步重绘；
- 普通拖动路径只在错误文本实际变化时调用 `setData`；
- 保留按事件顺序提交的输入队列、过期手势检查和完整最终几何校验。

专项测试：

- `tests/miniprogram/photo-canvas.test.cjs`

证据脚本：

- `docs/performance-audit/p11-ai-canvas-optimization/scripts/profile_photo_canvas.cjs`
- `docs/performance-audit/p11-ai-canvas-optimization/scripts/compare_coordinates.cjs`

## 同条件对照

环境：Node 24.11.1、生产编译后的组件 JS、确定性 wx/Canvas 适配器。数据为 320/375/430 px 三种宽度各 3 次的中位数。表中是命令计数，不是手机原生栅格化或帧率。

| 120 次 client 框选移动 | 优化前 | 优化后 |
|---|---:|---:|
| Canvas 节点/尺寸查询 | 120 | 0（手势前已有缓存） |
| 画布矩形查询 | 122 | 1 |
| 完整绘制帧 | 120 | 1 |
| `drawImage` | 240 | 2 |
| `setData` | 120 | 0 |
| `renderstate` | 240 | 1 |
| JS 适配器阶段中位耗时 | 0.425 ms | 0.328 ms |

120 次画笔移动同样由 121 次节点查询、122 次矩形查询、121 次完整帧和 121 次 `setData` 降为 0、1、1、0；`drawImage` 从 242 次降为 2 次。

“快速拖动并立即松手”的 120 次移动也只产生 1 次矩形查询、1 个合并绘制帧和 1 个最终 `prompt`。

完整计数见：

- [优化前](evidence/before.json)
- [优化后](evidence/after.json)

候选 Mask 直接切换 10 次不再重复查询 Canvas 或调用 `setData`。该路径不是本轮主要瓶颈，且其亚毫秒 JS 计时受调度噪声影响，因此不把候选切换耗时变化作为性能收益。

## 坐标与绘制正确性

冻结的优化前构建与优化后构建在相同条件下比较了 48 组最终框选：

- 320、375、430 px 三种画布宽度；
- 横图和竖图；
- 上、下、左、右四个拖动方向；
- client 与 Canvas native 两种触摸坐标；
- 每组 120 次中间移动；
- 快速移动后立即松手。

结果：48/48 通过，所有框选顶点的最大绝对差为 `0`。证据见 [coordinate-equivalence.json](evidence/coordinate-equivalence.json)。

专项测试还覆盖：

- 无效小框不会提交；
- 重复 `touchEnd` 不会重复提交；
- resize/hide/show 后缓存失效并重新测量；
- 页面位置变化后，新手势重新读取当前画布位置，不复用上一手势的矩形；
- resize 期间未完成手势被取消，不提交旧矩形；
- 图片替换、禁用和页面卸载会丢弃旧手势；
- 前景点、背景点、画笔、照片和 Mask 继续使用同一显示矩形；
- Mask 加载期间不清空当前照片，完整帧到齐后才原子提交；
- 多片、孔洞、AI 确认、人体放置和神经匹配回归通过。

## 回归结果

2026-11-10 实际执行：

| 检查 | 结果 |
|---|---|
| TypeScript `tsc --noEmit` | PASS |
| 小程序前端测试 | 388/388 PASS |
| 后端与 AI 测试 | 322/322 PASS，7 条既有 MobileSAM/timm 警告 |
| 微信 WXML `wcc` | PASS；photo-canvas 38,869 bytes，AI 页面 53,792 bytes |
| 微信 WXSS `wcsc` | PASS；photo-canvas 314 bytes，AI 页面 3,063 bytes |
| 项目结构、图谱和分包引用 | PASS |
| 保守分包体积 | 主包 856,284 bytes；clinical 1,387,188 bytes；special 756,519 bytes |
| `git diff --check` | PASS |

微信开发者工具中 Shingles 项目页面可见且人体页面正常显示，但本轮自动点击“编译”返回 `noWindowsAvailable`，因此微信 GUI 编译与页面交互本轮标记为 `NOT_RUN`。微信自带 WXML/WXSS 静态编译已通过。

## 折叠屏与未验证项

P9 的布局变化会通过 `resize`、`layoutRevision` 和页面显示/隐藏路径清空尺寸及手势缓存。专项测试确认：resize 后重新测量，手势级矩形不会跨布局复用，未完成框选不会提交。

以下仍需真机确认：

- `touchmove` 到屏幕的实际输入延迟；
- Android/iOS 原生 Canvas 栅格化耗时；
- 普通手机、折叠屏外屏和内屏的 FPS/长任务；
- 滚动、系统手势冲突和长时间运行的内存表现。

本轮没有真机访问能力，也没有把 Node 计数或亚毫秒适配器耗时换算成 FPS。

## 回滚

生产行为回滚只需恢复
`miniprogram/packages/clinical/components/photo-canvas/photo-canvas.ts`
到 P11 前版本；本改动不涉及图谱、会话、标注或数据迁移。当前工作区还包含其他未提交任务，回滚时必须只处理该组件和 P11 测试/文档，不能对整个仓库执行 reset/clean。
