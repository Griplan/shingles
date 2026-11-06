# V5.4 AI 辅助标注与参考图谱匹配

本节覆盖 V5.3 历史“AI 不进入 evaluate”的阶段限制。唯一进度以 [task.md](../task.md) 为准；[本轮验证记录](validation-records/v5.4/report.md)区分自动化、真实 HTTP 和微信实际操作。

## 完整数据流

照片上传 → 真实 MobileSAM 提示分割 → 用户确认照片范围 → V5.3 草稿平移/等比缩放/旋转 → **确认位置并计算** → 完整几何与人体包含校验 → V2 原子提交 → 既有 `POST /api/v1/evaluate` → 既有 annotate 结果视图。

AI 仅提供形状。位置、大小和方向由用户确定；参考匹配仍为 `area(L ∩ D) / area(L)`，不使用照片外观、模型分数或入口部位增加任何节段。无覆盖是合法结果，不寻找最近区域。医审状态、图谱来源及许可不变。

## 正式数据与接口

`annotationSession` 是唯一正式人体标注源。会话 basis 绑定 `templateId/templateVersion/geometryId/regionSetId`，每个 CompletedPolygon 有稳定 `id/view`。人工简单标注继续使用 `ring`；AI 标注使用 `geometry:{type:MultiPolygon,coordinateSpace:body_template_normalized_v1,coordinates}`，每个片区第一环为外环，其余为孔洞，环由 `{x,y}` 构成并显式闭合。兼容 `ring` 只是第一外环，不能代替完整 geometry。

照片原始 `photo_oriented_normalized_v1`、模型、提示、Mask 引用和 placementTransform 存在 source 内的运行时确认快照中，保持不可变。`lesionForMatching()` 仅发送 id、view、source 枚举及完整 geometry 或旧 vertices；不发送 source.photo、图片、Mask、令牌、提示或变换。服务端接受 Polygon/MultiPolygon 和原 vertices 二选一，拒绝照片坐标、未知字段和非法拓扑，既不修复也不裁剪。详见 [API 增量](api.md#v54-evaluate-完整人体几何增量2026-11-01)。

相邻/重叠的**不同标注**按原 V4 同面并集去重；单个 MultiPolygon 内非法重叠仍拒绝，不能用自动合并掩盖无效数据。多片、小片及孔洞保留。源类型仅作为记录，不参与权重；返回的历史 method 名 `manual_annotation_reference_geometry` 为旧客户端兼容保留，现表示人工确认的人体几何，不表示输入只能是手画。

## 提交、重试与编辑

- 第一次确认从原照片轮廓和最终变换重算一次正式人体几何，执行原完整拓扑/人体面包含检查，再原子写入；完整人体检查包含边和内部，不能仅检测顶点。
- 同一 placementId 重复确认幂等。计算失败后正式标注保留；“重试计算”只读已保存几何，不追加或重新推理。按钮在途锁防重复请求。
- 结果页“调整 AI 标注 N 位置”打开独立草稿。多组时先用现有标注 scope 选择目标；管理状态可选中对应 AI 标注。编辑草稿不改正式几何，不使原有效结果变成草稿结果。
- 编辑确认使用 expected 原 placementId 比较替换，保持 annotation ID、数组位置及其他人工/AI 标注不变。新 placementId 与完整人体几何进入匹配摘要，旧结果立即失效；同 ID 的过期编辑不能覆盖新版本。
- 编辑期间显示背景只隐藏当前编辑目标，动态贴片显示新草稿，避免移动后留下旧位置重影；正式会话不变，其他标注继续显示，确认后背景恢复一份正式几何。
- 页面隐藏取消当前请求接收；request_id、独立 geometryRevision、会话/模板/图谱内容摘要共同阻止迟到响应。标签、全部、放大、全身不请求后端。
- 复核显式清除两面的空手动占位草稿，保留非空草稿的拒绝/明确处理规则，不为进入 AI 流程吞掉手动画点。
- 原照片清理后，正式人体几何仍能匹配。重新放置可用已保存的只读照片轮廓和变换，不下载或复活照片文件，也不延长临时服务 TTL；重新分割原照片仍须遵守 V5.2 有效期。

## 结果与显示衔接

成功后直接进入既有 annotate 结果模式，默认 selected 为空，自动显示全部实际候选实例及侧栏标签；病灶以棕色完整轮廓区分图谱填充。沿用候选原意、面部分区类型和组合标签，不另建结果列表或算法。

`placement-navigation` 仅保存一次显示交接（会话/响应 ID、view、viewport），不是第二份业务状态。结果页核对当前响应后消费；`reframeViewport` 保持人体 CSS 比例与画布中心对应的解剖位置，只适配新容器尺寸。局部/全身状态随 V2 focus 保留。两页侧栏宽度不同，边缘可见范围可能不同；主动“全身/放大/换面”才清除保留相机。图片仍为同一本地资源，各 Canvas 的 Image 对象按既有节点缓存，不跨节点强行共享；跨路由首次解码与视觉闪动须由实际微信验收确认。

V4 OverlayTransition、取消机制、sceneId 与标签同步继续沿用。V5.3 缓存贴片及每帧局部变换不变，拖动/滑杆不调用匹配，不每帧处理完整顶点。确认后匹配不加载 MobileSAM。

## 运行与限制

开发本机使用原后端环境，需同时启用 `DERMATOME_ENV=development`、`ENABLE_AI_SEGMENTATION=1`、`ENABLE_REFERENCE_MATCHING=1`。已有 AI 环境、权重和配置复用，不需要新依赖或数据库。真机仍需可信 HTTPS 后端与合法域名，当前不是面向真实患者的生产部署。

V2 仅在本次运行内暂存；重编译/退出进程可能清空。复杂几何仍有最终检查耗时；过大输入明确拒绝而非删点。分割质量、人工位置误差和图谱医学审核是独立问题，工程测试不构成临床验证。V5.5 保持 TODO，等待审查后另行明确范围。
