# 人体渲染与布局审计

## 渲染方式

完整人体使用原生微信自定义组件 `body-canvas`：

- 组件节点为 `<canvas type="2d">`。
- `body-canvas.ts` 通过 Canvas 节点取得 2D context。
- 人体正背面底图由 `getBodyModel(view)` 返回本地 PNG 路径。
- PNG 先通过 Canvas 节点的 `createImage()` 异步加载，再由 `drawBody()` 绘制。
- 人体区域、标注 Polygon、神经高亮、调试十字和 AI 放置贴片都叠加在同一个 Canvas 场景或覆盖组件中。
- 页面没有用普通 `<image>` 单独承载人体，也没有用水平翻转生成背面。

## 坐标层级

1. 人体模板逻辑坐标：固定宽高，作为几何基准。
2. Canvas CSS viewport：由实测容器宽高、DPR、`scale`、`offsetX`、`offsetY` 和 `zoom` 构成。
3. Canvas 物理像素：只由 DPR 缩放 backing store，不参与点击归一化。
4. 持久化标注：人体模板归一化坐标，不随 viewport 改变。

## 原页面问题

- 首页：人体所在 `.model-stage` 是页面 flex 子项，但页面根节点仍可随内容改变高度。
- 标注页：在人体上方存在状态和范围控件；部分控件按状态出现，工作区会重新分配高度。
- 放置页：人体、加载提示、滑块和按钮同处普通文档流；提示或错误文字可推动画布。
- Canvas 组件：`.canvas-shell` 固定 `min-height:240px`，与放置页 220px 工作区下限不一致。
- 手势：`touchmove` 使用冒泡绑定，Canvas 手势可能继续带动页面滚动。

## 当前边界

- 三个核心页面固定为设备视口高度。
- 标题、正背面切换和稳定提示保持固定占位。
- 人体 Canvas 只在剩余受控工作区中伸缩。
- 结果筛选、神经标签和放置控制可独立滚动。
- Canvas 容器裁剪内部绘制，超出工作区的内容不会撑开页面。
- `body-canvas` host 与 `.canvas-shell` 都取消最小高度，完整服从父容器。

## 测量时机

Canvas 尺寸查询只在以下情况需要发生：

- 页面首次完成布局。
- 页面隐藏后重新显示。
- 原生组件 `resize`。
- 明确的 layout revision。
- Canvas 节点或图片缓存失效后的重试。

普通文档滚动已经关闭；结果区滚动不会触发人体 Canvas 重测或 auto-fit。
