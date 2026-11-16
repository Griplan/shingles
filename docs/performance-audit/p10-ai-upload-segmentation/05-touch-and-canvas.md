# 05 框选触摸与 Canvas

## 真实代码路径

`miniprogram/packages/clinical/components/photo-canvas/photo-canvas.ts` 中：

- `touchMove → queueTouch("move") → redraw()`；
- `redraw()` 每次执行 `createSelectorQuery().fields({node:true,size:true})`；
- client 坐标的 `point()` 每次执行 `boundingClientRect()`；
- 重绘会清空 Canvas，重新绘制照片和 Mask，再绘制框/点/笔刷；
- 每次重绘执行 `setData({error:""})` 并触发 `renderstate`；
- 当前没有 `requestAnimationFrame` 合并拖动重绘。

放置页不同：它缓存 Canvas 节点和手势起点矩形，用 `requestAnimationFrame` 合并绘制，拖动中只传平移量。P6/P5 的放置优化仍保留。

## 命令计数

使用生产 JS 和确定性 Canvas 适配器，320/375/430 px 三宽度各重复 3 次。每 120 次框选 client 坐标移动的计数一致：

| 命令 | 次数 |
| --- | ---: |
| `boundingClientRect` 查询 | 122 |
| Canvas 节点/尺寸查询 | 120 |
| `getContext` | 120 |
| `clearRect` | 120 |
| `drawImage` | 240 |
| `strokeRect` | 120 |
| `setData` | 120 |
| `renderstate` | 240 |

笔刷移动也会在每次事件后重绘，120 次移动产生 121 次 Canvas 测量、清屏、照片/Mask 绘制和 `setData`。

这些计数证明存在重复工作，不代表 Node 的毫秒数就是微信原生延迟。适配器的 JS wall time 只有约 0.3–2.9 ms/120 次，不能据此宣称手机 120 次移动没有卡顿。

## 用户实际感受尚需真机确认

仍未测量：

- `touchmove` 到屏幕像素更新的延迟；
- Canvas raster、GPU、bridge 和主线程阻塞；
- Android/iOS 原生 FPS 与掉帧；
- 页面滚动、安全区和折叠形态下的触摸竞争；
- 候选 Mask 首次解码与绘制对单帧时长的影响。

因此结论是“结构上存在高频重复查询/重绘，实际手机帧稳定性为 `NOT_MEASURED`”，而不是“已测出固定掉帧数”。

## 最小优化方向

1. 缓存 Canvas node、context、内容尺寸和手势开始时的 bounding rect。
2. 在 resize、页面 show、节点替换、滚动或 `layoutRevision` 变化时显式失效缓存。
3. 用一个待绘制帧合并多次移动；保留事件顺序、过期序列和 `touchcancel` 保护。
4. 把照片/Mask 静态层与动态框层分开；拖动只重画动态层。
5. 避免每次移动 `setData`；状态只在语义变化时提交。

这些是待验证方案，本轮没有修改交互代码。
