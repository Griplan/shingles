# V7.1.1 人体 Canvas 固定工作区与滚动、缩放稳定性优化

日期：2026-11-17

## 结论

本轮把完整人体、人工标注结果和 AI 病灶放置从普通文档流中的可变区域改为固定工作台：

- 页面外层不再滚动。
- 人体 Canvas 只占中间受控的弹性工作区。
- 标注与放置的控制区使用原生 `scroll-view` 独立滚动。
- Canvas 内部触摸移动不再冒泡为页面滚动。
- 缩放和平移只更新 Canvas 内部 viewport，不改变页面布局或保存的归一化病灶坐标。
- Canvas 组件不再设置会突破父容器高度约束的 240px 最小高度。

本地自动回归通过。微信开发者工具和 Android/iOS 真机连续手势仍为 `NOT_RUN`，不能用静态编译或 Node 测试替代。

## 真实原因

1. 人体由 `body-canvas` 自定义组件使用 Canvas 2D 绘制，底图为本地 PNG，不是普通 `<image>` 标签。
2. 首页、标注页和放置页原先处于页面普通文档流。结果内容增多时页面高度改变，正常上下滚动会移动整个人体工作区。
3. Canvas 原触摸移动使用冒泡事件。人体平移或双指缩放时，触摸移动还可能继续传递给页面滚动。
4. 标注页部分提示和范围筛选条件出现或消失，会改变人体上方或下方高度。
5. 放置页加载提示原先参与文档流，初始化时可能让工作区发生位移。
6. Canvas 组件自身保留 240px 最小高度，而放置工作区最低为 220px，极端尺寸下内部画布可能大于外层裁剪区。

## 实施内容

### 固定页面工作台

- `pages/select/select`：页面和设备视图固定为 `100vh`，人体工作区使用 `flex:1 1 0; min-height:0`，提示条固定保留 32px。
- `packages/clinical/pages/annotate/annotate`：页面改为纵向 flex 工作台；人体结果区固定高度，结果和控制区独立滚动。
- `packages/clinical/pages/placement/placement`：页面改为纵向 flex 工作台；人体贴片区固定并裁剪，控制区独立滚动。
- 三个页面均设置 `disableScroll: true`，普通页面文档不再随内容滚动。

### 滚动与手势隔离

- `body-canvas` 的 `touchmove` 从 `bindtouchmove` 改为 `catchtouchmove`。
- 人体工作区内的平移、双指缩放、标注触摸只在 Canvas 内处理，不再带动外层页面。
- 标注结果、神经标签和放置控制区仍可独立滑动。
- 页面 `disableScroll` 只关闭文档滚动，没有禁用结果区或操作区的原生 `scroll-view`。

### 缩放稳定与性能

- 继续使用现有 `panViewport`、`zoomViewportAt` 和 `normalizedToCanvas`/`canvasToNormalized`。
- 手势起始时读取一次 Canvas 边界，同一次手势内复用。
- 高频移动通过现有帧合并机制只安排必要绘制。
- Canvas 容器宽高在缩放期间保持不变。
- 普通滚动不调用 Canvas 尺寸测量，也不执行 auto-fit。
- 仅页面首次布局、真实 resize、页面重新显示或明确的视图变化触发重测。

## 修改文件

- `miniprogram/components/body-canvas/body-canvas.wxml`
- `miniprogram/components/body-canvas/body-canvas.wxss`
- `miniprogram/pages/select/select.json`
- `miniprogram/pages/select/select.wxml`
- `miniprogram/pages/select/select.wxss`
- `miniprogram/packages/clinical/pages/annotate/annotate.json`
- `miniprogram/packages/clinical/pages/annotate/annotate.wxml`
- `miniprogram/packages/clinical/pages/annotate/annotate.wxss`
- `miniprogram/packages/clinical/pages/placement/placement.json`
- `miniprogram/packages/clinical/pages/placement/placement.wxml`
- `miniprogram/packages/clinical/pages/placement/placement.wxss`
- `tests/miniprogram/canvas.test.cjs`
- `tests/miniprogram/fixed-body-viewport.test.cjs`

## 测试结果

- TypeScript：PASS。
- 小程序前端：410/410 PASS，0 failed。
- 项目结构检查：PASS。
- 图谱无损检查：PASS。
- 主包、临床分包、特殊部位分包边界检查：PASS。
- 微信 WXML 编译器：exit 0，输出 86,201 bytes。
- 微信 WXSS 编译器：exit 0，输出 4,638 bytes。
- 固定工作区专项覆盖六种视口：360×780、390×844、430×932、720×760、800×720、900×800。
- 连续 20 次缩放的中心坐标误差小于 `1e-10`。
- 平移后正向和反向坐标映射误差小于 `1e-10`。
- 连续 20 次 Canvas 平移只查询一次边界并完成一次正式绘制，未产生区域点击或标注点。
- 保守本地分包体积：main 884,740 bytes；clinical 1,407,135 bytes；special 756,628 bytes。

## 未验证

- 微信开发者工具本轮连续手势和固定工作区视觉截图：`NOT_RUN`。自动工具读取开发者工具窗口超时。
- Android/iOS 真机滚动、双指缩放、长按拖动、触摸延迟和 FPS：`NOT_RUN`。
- 物理折叠屏展开、合上及连续 resize：`NOT_RUN`。
- 微信体验版未上传；腾讯云和后端未修改。

## 风险与边界

- 本机 Node 坐标测试证明数学变换和静态布局约束，不证明手机原生渲染帧率。
- 页面固定后，主要靠独立 `scroll-view` 展示长结果；仍需在低版本微信和真机确认滚动区域触摸优先级。
- 未修改人体素材、图谱几何、神经匹配公式、MobileSAM、上传限制、照片会话删除机制或已保存标注。
