# V7.0 完整人体自由标注与 AI 病灶全身放置

日期：2026-11-16
状态：本地工程实现与自动验证完成；微信开发者工具入口已加载，完整触摸流程和真机验收仍为 `NOT_RUN`。

## 结果

V7.0 已把主流程改为“完整人体 → 手动标注或 AI 辅助标注 → 自由放置 → 最终几何神经匹配”。应用入口现在是 `pages/select/select`，正背面完整人体可直接进入标注。旧粗粒度人体区域保留为可选快捷定位和初始聚焦提示，不再作为标注、放置或匹配的边界。

人工标注直接以完整人体导出轮廓校验。一个 Polygon 可以跨越旧的腹部、腹股沟和大腿等 UI 分区，只要完整填充区域位于有效人体皮肤内。浏览模式支持单指平移、双指缩放；标注模式的单点取点与浏览手势保持分离。

AI 流程不再要求先选部位。照片处理、MobileSAM、候选选择、分割确认、临时照片会话释放以及放置草稿均复用现有 V5 实现。放置页面可以从无 `regionId` 状态开始，切换正面或背面，自由拖动、等比例缩放和旋转整个 MultiPolygon。多个片区和孔洞作为同一组共同变换。

最终确认区分三种状态：完全位于人体内、部分越界、完全越界。部分越界只在确认时请求一次后端精确交集，经用户明确确认后，交集成为 V2 保存和 V4 匹配使用的有效几何；原始变换结果仍独立保留，继续调整会清除旧裁剪状态。完全越界不能保存。

神经匹配使用最终保存的人体几何，不按入口 `regionId` 过滤。匹配仍调用原 V4 Shapely 公式和现有图谱；没有修改图谱边界、MobileSAM、图片上限或特殊部位数据。

## 自动验证

- TypeScript：`PASS`。
- 小程序前端：`404/404 PASS`。
- 后端与 AI：`330/330 PASS`，7 条既有 MobileSAM/timm 依赖警告；新增门禁与 2 万顶点限制后，相关 37 项定向测试也全部通过。
- 微信内置 `wcc`：`PASS`，相关 WXML 编译输出 104,152 bytes。
- 微信内置 `wcsc`：`PASS`，相关 WXSS 编译输出 4,276 bytes。
- 项目结构、图谱导出、分包引用/体积及 `git diff --check`：`PASS`。
- 保守本地包体：主包 884,919 bytes，clinical 1,403,785 bytes，special 756,519 bytes。

## 微信与运行状态

微信开发者工具已重新编译并显示 `Errors: 0`，工具栏显示 2 条警告；刷新后模拟器 AX 状态加载了 `pages/select/select`，可读到“完整人体标注”“自由标注（无需选择部位）”“手动标注”“AI 辅助标注”。截图服务仍保留旧的渲染帧，因此没有把该截图当作完整触摸流程证据。自动点击嵌套 WebView 中的“手动标注”返回 `invalid element ID`，本轮未在模拟器完成取点、闭合、AI 放置和结果高亮。

Android/iOS 真机、相册上传、MobileSAM 真机推理、折叠屏连续手势和最终结果视觉验收均为 `NOT_RUN`。静态编译和自动测试不能替代真机验收。

## 修改文件

主流程与交互：

- `miniprogram/app.json`
- `miniprogram/pages/select/select.ts`
- `miniprogram/pages/select/select.wxml`
- `miniprogram/pages/select/select.wxss`
- `miniprogram/components/body-canvas/body-canvas.ts`
- `miniprogram/packages/clinical/pages/annotate/annotate.ts`
- `miniprogram/packages/clinical/pages/annotate/annotate.wxml`
- `miniprogram/packages/clinical/pages/ai-annotate/ai-annotate.ts`
- `miniprogram/packages/clinical/pages/placement/placement.ts`
- `miniprogram/packages/clinical/pages/placement/placement.wxml`

数据与坐标：

- `miniprogram/state/annotation-session.ts`
- `miniprogram/types/annotation.ts`
- `miniprogram/types/evaluate.ts`
- `miniprogram/packages/clinical/state/placement-session.ts`
- `miniprogram/utils/coordinate.ts`
- `miniprogram/utils/placement-geometry.ts`
- `miniprogram/services/api.ts`

后端：

- `backend/app/main.py`
- `backend/app/schemas/evaluate.py`
- `backend/app/api/routes/evaluate.py`
- `backend/app/services/body_intersection.py`

测试与工程检查：

- `backend/tests/test_api.py`
- `backend/tests/test_evaluate_api.py`
- `backend/tests/test_body_intersection.py`
- `tests/miniprogram/ai-matching-flow.test.cjs`
- `tests/miniprogram/annotation-flow.test.cjs`
- `tests/miniprogram/annotation-session.test.cjs`
- `tests/miniprogram/canvas.test.cjs`
- `tests/miniprogram/coordinate.test.cjs`
- `tests/miniprogram/placement-session.test.cjs`
- `scripts/check_project.py`
- `scripts/check_miniprogram_packages.py`
- `miniprogram/project.config.json`

## 边界与回滚

本轮没有部署腾讯云、上传体验版、提交或推送 Git。工作区保留此前 V6.7、P8、P9、P10 和 P11 的未提交修改。

回滚应只恢复本轮列出的 V7.0 文件和新增专项文档，不得使用整库 `reset` 或 `clean`。新增的最终交集接口意味着云端即使只继续使用原 `/evaluate`，新客户端遇到部分越界时仍需要同步后端的 `/evaluate/body-intersection`；完全位于人体内的普通流程不依赖该新路径。
