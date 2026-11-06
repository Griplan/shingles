# API 约定

## 当前 V4 契约（2026-10-26）

以下契约取代后文V0 evaluate占位及后续草案；历史保留供追溯。health仍200并保留version:v0，GET atlas仍501。实际请求Schema为`backend/app/schemas/evaluate.py`，前端为`miniprogram/types/evaluate.ts`。

### POST /api/v1/evaluate

仅当服务进程`DERMATOME_ENV=development|test`且`ENABLE_REFERENCE_MATCHING=1`时可用；其他情况在解析正文前403。前端另仅允许微信develop。没有query/debug绕过。

请求字段：

| 字段 | 规则 |
| --- | --- |
| request_id | 1–160字符的关联标识 |
| annotation_revision | 非负整数，独立几何修订，不采用显示revision |
| identity | template_id、template_version、geometry_id、region_set_id、atlas_id、atlas_version、atlas_content_sha256、body_content_sha256、coordinate_system |
| lesions | 1–40片，独立id/view/vertices；每面最多20片 |
| vertices | `{x:number,y:number}`数组；每片3–128个不同有效点，可额外重复首点表达闭合，输入上限129项 |

未知字段拒绝；数值必须有限且[0,1]，布尔/字符串不当坐标。原点左上，正背独立。整请求实际字节上限512KiB（含未声明Content-Length的正文），15秒前端超时。每片独立检查重复点、自交、面积>1e-10及完整人体covers；不修复、不裁切、不吸附。首尾在每轴1e-12内视为同一闭合点，这是唯一等价格式归一化。人体包含按导出轮廓严格拓扑检查，不借图谱覆盖充当人体约束；极贴边的前端数值容差与后端严格包含不同，拒绝时须返回编辑，不能静默移动点。

完整可复现的**合成请求和实际计算响应**见[请求](validation-records/v4/synthetic-request.json)与[响应](validation-records/v4/synthetic-response.json)，不可用真实患者数据代替共享测试文件。

200响应：

- `request_id`、`annotation_revision`、实际`identity`原样关联；method=`manual_annotation_reference_geometry`，area_unit=`normalized_template_area`。
- `source`含title/url/attribution/license/medical_review_status=`pending`/preview=`true`/coverage_note；`warnings`明确二维、未覆盖与医学边界。
- `lesions[]`每片独立；`views[]`每视图先对病灶取并集，不跨视图相加。
- 每项：view、lesion_ids、annotation_area、covered_area、uncovered_area、covered_ratio、uncovered_ratio、coverage_status(full/partial/none)、candidates。
- 每候选：candidate_id、region_ids、partition_type、label、source_label、display_name、side、view、intersection_area、lesion_coverage_ratio。

候选键=(分区类型,label,解剖侧别,view)，ID为该键规范JSON的SHA256；同键实例先并集，`region_ids`保留全部关联实例。源组合标签不拆分，类型不混淆，排序按覆盖比例降序再按类型/标签/侧别/ID稳定排序。没有top-k、最近邻补猜或入口UI区域过滤。

令L为单片或当前视图病灶并集，R为候选并集，A为本视图所有有效图谱区域并集：

- 候选比例=`area(L∩R)/area(L)`，不是IoU或医学置信度。
- 总覆盖=`area(L∩A)/area(L)`；未覆盖=`area(L−A)/area(L)`。
- 候选允许重叠，比例之和可以>100%；总覆盖不能累加候选。不把已覆盖部分重新归一化为100%。
- 候选实质面积阈值`max(1e-18, area(L)*1e-12)`仅排除浮点级接触；同阈值区分full/partial/none。返回数值不截断/舍入，守恒误差超`max(1e-16, area(L)*1e-10)`报错。真实小交集保留；前端极小正数显示`<0.01%`，接近1但未等于1显示`>99.99%`。
- 不能相加正背二维面积作为全身皮肤面积，不换算cm²。无覆盖200，空candidates，说明当前图谱不能解释该位置。

统一业务错误：`{"error":{"code":"VERSION_MISMATCH","message":"人体、图谱或内容校验不一致，请同步更新后重试"}}`。不含坐标/堆栈。

| HTTP | code | 含义 |
| --- | --- | --- |
| 403 | MATCHING_DISABLED | 服务环境未允许 |
| 404 | ATLAS_NOT_FOUND | 未配置的图谱标识 |
| 409 | VERSION_MISMATCH | 模板、几何、UI修订、图谱版本/校验不一致 |
| 422 | INVALID_INPUT | 字段/类型/范围/总数量/JSON错误 |
| 422 | INVALID_ANNOTATION | 重复ID、无效多边形或跨人体 |
| 422 | LIMIT_EXCEEDED | 单面超过20片 |
| 422/409 | VIEW_UNSUPPORTED | Schema不支持的视图/加载数据不支持该面 |
| 413 | PAYLOAD_TOO_LARGE | 实际正文超限 |
| 503 | ATLAS_UNAVAILABLE | 文件缺失、损坏、同源导出失效、几何非法或校验失败 |
| 500 | COMPUTATION_ERROR / INTERNAL_ERROR | 面积守恒异常/其他服务错误 |

默认框架404/405不在上述业务信封承诺内。不存在的路径不表示图谱不存在。测试替身仅位于测试，正常客户端没有离线假结果。网络失败保留标注，重试用当前有效快照。`config/api.ts`区分模拟器loopback与显式真机地址。

---


API 前缀为 `/api/v1`，JSON 字段使用 snake_case。接口 v1、健康检查返回的应用阶段 v0、图谱数据版本 v1 是独立概念。

## 1. V0 历史契约（evaluate已由V4取代）

| 方法与路径 | 请求 | 当前响应 |
| --- | --- | --- |
| `GET /api/v1/health` | 无参数、无请求体 | HTTP 200，健康信息 |
| `GET /api/v1/atlas` | 无业务参数契约 | HTTP 501，明确未实现 |
| `POST /api/v1/evaluate` | 不定义、读取或验证业务 payload | HTTP 501，明确未实现 |

V0 不提供登录、照片上传、候选匹配或结果保存。evaluate 可在无请求体或任意正文下返回 501，这不表示输入合法；当前 OpenAPI 不声明其业务请求 Schema。

### GET /api/v1/health

HTTP 200、JSON：

```json
{"status": "ok", "project": "dermatome-mapper", "version": "v0"}
```

仅表示应用能响应健康请求，不证明图谱可用、业务集成、真机联通或医学能力。

### GET /api/v1/atlas

HTTP 501、JSON：

```json
{
  "error": {
    "code": "NOT_IMPLEMENTED",
    "message": "图谱查询尚未实现；V0 不提供可用于医学映射的图谱。"
  }
}
```

### POST /api/v1/evaluate

HTTP 501、JSON：

```json
{
  "error": {
    "code": "NOT_IMPLEMENTED",
    "message": "标注评估尚未实现；V0 不执行皮节匹配或生成候选结果。"
  }
}
```

客户端应依据状态码和 error.code 判断，不能依赖自然语言文案。501 错误对象位于顶层 error，不嵌套在 detail 中，不含假节段或比例。

### 当前错误格式范围

上述 error.code/message 仅是两个占位接口显式响应。V0 没有全局统一异常处理或业务校验；不存在的路由、错误方法、未来框架参数校验或未处理异常可能仍使用 FastAPI/Starlette 默认响应。不能宣称所有错误均遵循 error 对象，或已经提供自定义 422。

### 本地调用

按 README 安装依赖并启动服务后运行：

```bash
curl -i http://127.0.0.1:8000/api/v1/health
curl -i http://127.0.0.1:8000/api/v1/atlas
curl -i -X POST http://127.0.0.1:8000/api/v1/evaluate
```

契约预期为 200、501、501，真实测试证据见 [task.md](../task.md)。手机的 127.0.0.1 不是开发电脑；真机网络和请求域名配置须在联调阶段实际验证。

## 2. 后续业务草案（V3/V4，尚未实现）

以下字段、状态和工作名称仅用于设计，不是 V0 可调用 Schema。获准开发时需同时冻结 Pydantic、TypeScript、OpenAPI、本文和测试。

### 图谱查询

建议使用 atlas_version、view（front/back）选择图谱，响应含版本、视图、坐标约定、来源/许可/验证摘要、背景绑定与区域。是否允许查询禁用图谱的元信息需另行定义；查询元信息不意味着可以评估。

医学映射必须检查完整准入条件，不能仅依赖文件存在或单一 mapping_enabled 标记。详见 [atlas-spec.md](atlas-spec.md)。

### 标注评估

最小请求建议为图谱版本、视图和病灶多边形列表，每个多边形遵循归一化闭合外环约定。不加入姓名、证件、电话、照片或持久化病例编号。文档工作名称可为 `EvaluateRequestDraft` / `EvaluateResponseDraft`，**当前代码没有这些业务 Schema**。

响应建议包含使用的版本和视图、候选节段、可解释几何量、候选/无匹配状态及医学提示。多个候选应表达不确定性，不输出唯一确定诊断。

几何量建议明确区分“交集面积 / 病灶面积”的病灶覆盖比例与“交集面积 / 区域面积”的区域覆盖比例。多病灶可考虑先对同视图病灶求并集避免重复计数，但策略尚未实现，必须在 V3 确认并测试。图谱区域可能互相重叠，候选覆盖比例之和不保证等于 1。所有比例都是几何量，不是诊断概率。

### 错误与结果分类草案

| 情形 | 建议状态/码 | 语义 |
| --- | --- | --- |
| 结构、类型、范围非法 | 422 / INVALID_INPUT | 缺字段、非有限数、越界；需要与框架校验统一后才成立 |
| 标注几何非法 | 422 / INVALID_ANNOTATION | 自交、零面积、点数不足、不闭合 |
| 图谱/视图不存在 | 404 / ATLAS_NOT_FOUND | 不默默回退其他版本 |
| 图谱未验证、许可不足、空或禁用 | 409 / ATLAS_NOT_READY | 阻止映射，不能伪装为无匹配 |
| 合法输入无匹配 | 200 / no_match 业务状态 | 空候选和解释，不是内部错误 |
| 多个候选 | 200 / candidates 业务状态 | 多候选及解释，不是异常或唯一诊断 |
| 未预期服务异常 | 500 / INTERNAL_ERROR | 不回显敏感载荷、堆栈或身份信息 |

以上业务码 **V0 均未实现**。未来错误可沿用 error.code/message，是否附字段定位信息由真实需求决定。载荷/点数上限、超时、浮点容差和排序规则均待实际实现与测试，不宣称当前已有防护。

## 3. 接口维护规则

收到 501 时展示功能尚未实现，不解析为成功结果。修改字段时同步两端类型、文档与测试，破坏性变更明确版本策略。标注须绑定视图、图谱及背景版本，不把旧标注静默用于新图谱；错误响应和日志不能包含完整敏感输入。

## V5.1 照片分割数据契约（2026-10-27，非HTTP接口）

本轮只有独立Python/CLI入口`ai.segmentation.segment_image`。无新增FastAPI路径，不修改evaluate请求；evaluate不接收照片、照片轮廓或Mask。结果使用`photo-segmentation-v1`与`photo_oriented_normalized_v1`，字段/错误/候选确认语义见[V5.1报告第4节](v5-ai-segmentation.md)。V5.2的上传、提示推理、确认、删除仅为接口设计方向，尚未实现。后续必须先人工定位与模板绑定，不能直接将相同[0,1]数值当人体标注提交。

## V5.2 临时照片分割接口（2026-10-27）

本节覆盖上一节“无HTTP”的历史状态，原V4接口不改。所有路径前缀 `/api/v1/ai/sessions`。仅development/test且 `ENABLE_AI_SEGMENTATION=1` 开启，默认/production在解析请求前403。缺AI依赖/独占目录不可用返回503，核心health/evaluate仍可用。

| 方法/后缀 | 请求 | 返回 |
| --- | --- | --- |
| POST 空后缀 | 无载荷 | `session_id, session_token, expires_at, development_only:true` |
| POST `/{sid}/photo` | multipart唯一字段 `file` | `session_id, photo_id, image, expires_at`；一个会话一张照片 |
| POST `/{sid}/segment` | 下述提示JSON | `session_id, photo_id, result_id, request_id, prompt_revision, coordinate_space, status, candidates, expires_at` |
| GET `/{sid}/assets/photo.png` | 无 | 已统一方向、剥离元数据的PNG |
| GET `/{sid}/assets/candidate-N-alpha.png?result_id=…` | N=0/1/2 | 同尺寸透明Mask，用于原照片叠加 |
| GET `/{sid}/assets/candidate-N-mask.png?result_id=…` | 同上 | 同尺寸0/255原始二值Mask PNG |
| POST `/{sid}/confirm` | `photo_id, result_id, candidate_id, prompt_revision` | 下述 `confirmed-photo-segmentation-v1` |
| DELETE `/{sid}` | 无 | 204并删除临时派生数据；已失效410，前端按已清理处理 |

除创建以外，所有请求必须携带 `x-ai-session-key: <session_token>`；令牌不得放URL。每次更换照片创建新会话并删除旧会话，不复用照片ID。返回和素材均 `Cache-Control: no-store`，只允许表内文件名，绝不返回服务器真实路径。时间字段为UTC Unix秒。默认30分钟固定有效期，不因推理延长。

`image`包括：方向处理前 `stored_width/stored_height`、处理后 `width/height`、`exif_orientation`、`orientation_applied`、`orientation_policy:"exif_transpose_before_prompts"`、`alpha_background:"white"`、`metadata_stripped:true`、`oriented_rgb_sha256`。前端必须显示服务器返回的已定向照片再给提示，不将本地可能有EXIF的预览作为坐标基准。

提示示例（坐标为示例而非医学位置）：

```json
{
  "photo_id": "<upload返回的32位ID>",
  "request_id": "p-example-2",
  "prompt_revision": 2,
  "prompts": {
    "coordinate_space": "photo_oriented_normalized_v1",
    "points": [{"x": 0.45, "y": 0.5, "label": 1}, {"x": 0.7, "y": 0.7, "label": 0}],
    "box": {"xMin": 0.3, "yMin": 0.3, "xMax": 0.6, "yMax": 0.6}
  }
}
```

box可为null，points可为空；必须有框或至少一个前景点。label严格0/1，最多64点；点x/y在[0,1)像素域，框边缘在[0,1]且有正面积。只接受有限数字，拒绝额外字段；request_id为最长80的字母数字/下划线/连字符。修订0～1,000,000。服务拒绝旧修订，前端还核对照片代次、请求ID及当前修订，避免照片A的迟到结果覆盖B。

候选返回 `candidate_id, status, area_ratio, outside_box_ratio, component_count, hole_count, warnings`。status为 `ok / empty_mask / contour_failed`；整体分割状态沿用V5.1，任何候选都不是已确认结果。area_ratio>0.65提示 `LARGE_MASK`，超框面积/Mask面积>0.25提示 `OUTSIDE_BOX`，片数>100提示 `FRAGMENTED`，候选两两IoU>0.95提示 `SIMILAR_CANDIDATES`；空/轮廓失败另有相应警告。阈值仅用于操作提醒，绝非医学判断；不裁Mask、不删小片、不自动选最高分，不在UI显示模型分数。

确认返回完整字段：

```text
schema_version = confirmed-photo-segmentation-v1
session_id, photo_id, result_id, candidate_id, prompt_revision
coordinate_space = photo_oriented_normalized_v1
confirmed_by_user = true, confirmed_at, expires_at
image = 上述原图方向/尺寸/像素指纹
model = MobileSAM名称/variant/包版本/source_commit/license/权重SHA和字节数/device/dtype/torch/threads/load_seconds
prompts = 本轮原始归一化点/框
geometry = {type: MultiPolygon, coordinates: [polygon[ring[[x,y],…]],…]}
mask_asset = candidate-N-mask.png
mask_sha256 = 原尺寸Mask PNG文件SHA256
```

每个polygon的首环为外环，后续环为孔洞，均显式闭合；保留单像素及多个互不相连片区。归一化基于已定向照片像素格边界。既有V5.1 `simplify=0`、精确保留形状；详尽转换元信息仍在临时原始record中。空/失败候选不能确认。确认响应不含人体模板、神经标签或V4评价；V5.3需先定义人工变换及模板绑定。部位/view只是前端导航上下文，不是照片推理结果。

| 失败 | HTTP / 代表业务码 |
| --- | --- |
| 门禁未开 | 403 / AI_DISABLED |
| 缺依赖、模型失败、OOM | 503 / AI_UNAVAILABLE、模型原错误码、OUT_OF_MEMORY |
| 无效文件/提示/候选或几何过复杂 | 422 / INVALID_IMAGE、INVALID_INPUT、INVALID_CANDIDATE、RESULT_TOO_COMPLEX |
| 文件/请求字节超限 | 413 / IMAGE_TOO_LARGE（图片内在解码上限由V5.1错误返回422） |
| 照片/修订/结果过时 | 409 / PHOTO_MISMATCH、STALE_RESULT、PHOTO_EXISTS |
| 无效令牌、会话不存在或到期 | 410 / AI_SESSION_GONE，响应不区分原因 |
| 过期/非法素材引用 | 404 / ASSET_NOT_FOUND |
| 推理/会话容量繁忙 | 429 / AI_BUSY、AI_CAPACITY |
| 45秒服务超时 | 504 / AI_TIMEOUT；前端60秒网络超时也明确报错 |
| 未预期异常 | 500 / INTERNAL_ERROR，无内部路径或输入回显 |

限制：JPEG/PNG/WebP单帧，20MiB、12M像素、单边8192、最小8；实际请求体文件额外只容许64KiB multipart开销，其他写请求16KiB。结果record>8MiB明确失败，不截断。最多8会话、2个在途写请求、全局1个推理槽、单worker；不作为生产限流保证。超时线程不强杀但结果失效，取消/到期后不得再发布。清理及异常退出细节见[privacy.md](privacy.md)。实测、替身测试与NOT_RUN分开见[验证报告](validation-records/v5.2/report.md)。

## V5.4 evaluate 完整人体几何增量（2026-11-01）

仍使用 `POST /api/v1/evaluate`，门禁、identity、返回结构与覆盖公式不变。旧 `lesions[].vertices` 保持兼容；每组新增可选 `source: manual | ai_assisted`（默认 manual，仅元数据），以及与 vertices **二选一**的 geometry：

```json
{"id":"annotation-id","view":"back","source":"ai_assisted","geometry":{"type":"MultiPolygon","coordinateSpace":"body_template_normalized_v1","coordinates":[[[{"x":0.49,"y":0.30},{"x":0.51,"y":0.30},{"x":0.51,"y":0.32},{"x":0.49,"y":0.30}]]]}}
```

以上只演示结构，不是医学边界。Polygon.coordinates 为环数组；MultiPolygon.coordinates 为片区/环数组。每片第一环为外环，后续为孔洞，至少4点且显式闭合；各点范围0～1、有限、非布尔值。最多1024片、每片4096环、每组总20000点（含闭合点），全请求40000点。仍最多40组/每面20组。evaluate 实际请求体上限从512KiB增至2MiB，以容纳既有复杂放置几何；字节和点数限制都生效，超限明确报错、不简化。

422 INVALID_INPUT 拒绝两种表示同时提供/均缺少、照片坐标空间、未知字段、非法数字和复杂度超限；422 INVALID_ANNOTATION 拒绝未闭合、重复点、自交、非法孔洞/多片内部重叠和任何人体外部分。不同正式标注允许重叠，同视图汇总按原并集去重。413 PAYLOAD_TOO_LARGE 不回显载荷。几何无效时不调用修复/缓冲/凸包/裁切。版本与图谱错误继续沿用原业务码。

小程序只传 id/view/source 与最终人体 geometry 或旧 vertices；不发送原照片、Mask、模型分数、提示、source.photo 或 placementTransform。AI 与人工相同几何的候选、覆盖与未覆盖结果必须相同。method 的旧值 `manual_annotation_reference_geometry` 为响应兼容保留，其含义为“人工确认的人体几何参考对应”。AI 临时照片接口完全不变。

## V5 过度分割专项接口增量（2026-11-01）

原V5.2开发/测试门禁、私有会话令牌、30分钟TTL、删除清理、模型缓存与照片坐标不变。以下增量覆盖此前“AI接口完全不变”的历史描述，不修改evaluate。

- `POST /api/v1/ai/sessions/{sid}/segment` 新增 `strategy: context_crop | full_image`，默认context_crop；`prompts.additional_boxes`最多3个，与原box组成最多4处。只有点而无框时记录full_image回退；多框+full_image拒绝。原图定向归一化提示合同不变，局部Mask回填为同一原尺寸。
- 每候选增加 `display_priority`、`edit_revision`（初始0）、`quality`。quality含mask_to_box_ratio、outside_box_ratio、foreground_contained、background_excluded、candidate_differences、prompt_penalty、policy。原area/component/hole/warnings保留；评分只留服务实验记录，不作确认依据。新增警告 BOX_AREA_EXCESS、FOREGROUND_MISSED、BACKGROUND_INCLUDED、SIMILAR_CANDIDATES、CROP_EDGE，均不裁剪或删除预测。
- `POST /api/v1/ai/sessions/{sid}/edit`：

```json
{"photo_id":"current-photo","result_id":"current-result","candidate_id":"candidate-0","prompt_revision":1,"edit_revision":1,"coordinate_space":"photo_oriented_normalized_v1","strokes":[{"mode":"erase","radius":0.02,"points":[{"x":0.3,"y":0.4},{"x":0.4,"y":0.5}]}]}
```

以上是格式示例，不是医学轮廓。points使用定向照片归一化坐标[0,1]；radius为原图短边的比例[.001,.1]。strokes为从**原始AI候选**开始的全部历史（可空，表示恢复），mode只允许add/erase。最多32笔、每笔1～256点、合计4096点，请求上限256KiB；其他非上传AI写请求仍16KiB。修正计算工作量上限50M像素窗口、结果JSON8MiB。超限422 BRUSH_LIMIT/INVALID_BRUSH/RESULT_TOO_COMPLEX，失败保留之前范围，不抽稀/丢孔洞。

返回session_id/photo_id/result_id/prompt_revision/coordinate_space/candidate；candidate含新edit_revision、状态/面积/全部几何数量及质量提示，几何在确认时返回。空修正返回empty_mask，不能确认；轮廓转换失败为明确错误。使用 `assets/candidate-N-edit-R-alpha.png?result_id=...` 查看，mask.png同理；原candidate-N-mask/alpha.png始终保持原预测，旧修正版文件在成功替换后清理（404），不作无限修订存档。

修订必须递增；同修订+相同历史幂等重试，冲突/旧修订409 STALE_RESULT。沿用全局单处理槽429 AI_BUSY、45秒服务超时504 AI_TIMEOUT、依赖缺失/OOM503；超时线程未必立刻退出，客户端禁止确认待定修订，可同版本重试核实，或提交更高版本恢复。会话取消/TTL后410，线程不能重新发布文件。令牌仍仅在x-ai-session-key请求头，图片Cache-Control no-store/private。

- `POST .../confirm` 增加可选 `edit_revision`（兼容旧调用默认0）。服务必须与该候选最新修订一致，否则409；返回原confirmed-photo-segmentation-v1，并包含最新Mask引用/SHA和对应完整Polygon/MultiPolygon。
- 确认结果增加可空 `correction`：edit_revision、stroke_count、strokes、coordinate_space、original_mask_asset、original_mask_sha256、policy=user_brush_pixel_centers_v1。原照片尺寸/提示/模型/结果ID保留。V5.3原样保存source.photo，独立变换完整geometry；V5.4仅发送最终人体geometry，不发送照片/笔画/Mask。

默认预览不是确认；局部分析未覆盖区不代表健康。实际规则/原生验证/限制见[专项报告](validation-records/v5-oversegmentation/report.md)。

## 2026-11-01 受控云端部署补充

旧development/test门禁继续有效，默认production仍关闭参考匹配/AI；新增显式`DERMATOME_ENV=controlled`，同时要求64位API_ACCESS_SHA256与功能开关。除GET `/api/v1/health`外，所有API先校验`x-test-access-key`；AI临时接口还要原有`x-ai-session-key`。令牌不能进URL、小程序包或日志。无授权401 ACCESS_DENIED，Origin跨站403 ORIGIN_DENIED，限频429 RATE_LIMITED；一分钟全局120认证请求、新会话8次，另有2临时会话和原AI_BUSY单推理锁。受保护响应no-store，不开放CORS。

新增GET `/api/v1/ready`：受控凭据保护，返回`status, identity, ai_model_loaded, ai_device, medical_review:pending, diagnosis_enabled:false`。identity仍为既有模板/图谱/内容SHA与归一化坐标契约；模型惰性加载，false不是医学判断。图谱损坏/服务未就绪503；GET `/atlas`历史501不改。controlled对docs/redoc/openapi.json均404，不对外暴露调试Schema。

受控上传收紧到10MiB文件/额外64KiB multipart、3,000,000解码像素，不改变照片坐标/EXIF规则；超限413/422。dev/test原20MiB/12MP不变。confirmed-photo-segmentation-v1、照片/人体坐标类型和evaluate契约不改，不启用正式医学审核状态。

受控模式私有快照保留未过期临时会话跨stop/start/restart（固定30分钟失效不延长）；取消删除、超时失效也写入快照。运行服务30秒扫除，停止时独立timer每5分钟扫除过期文件。不能把保留快照解释为病例长期存档。客户端收到502/503或断连时明确不可用并保留V2标注。

当前只提供服务器回环与SSH通道，暂无新HTTPS域名；微信原生完整云端/真机联调NOT_RUN。部署证据与操作见[tencent-cloud-deployment.md](tencent-cloud-deployment.md)。

## P4 受控体验授权（2026-11-01）

不接受envVersion作为身份。保留管理员x-test-access-key仅用于原开发/SSH联调；新增管理员单独签发的一次性邀请换取1小时Bearer会话。该机制验证邀请资格，不验证微信openid；不在客户端嵌入AppSecret或共享服务密钥。

- `POST /api/v1/access/exchange`：`{invitation:string}`，≤4KiB实际体积、每分钟≤10次；邀请10分钟一次性，成功返回`access_token, token_type:Bearer, expires_at, access_kind:invited_trial`。无效/已用/过期401 INVITATION_INVALID，容量/频率429。
- `DELETE /api/v1/access/session`：Authorization: Bearer，204并撤销当前会话；再次访问401 TRIAL_ACCESS_REQUIRED。
- 其余受保护API可使用Bearer，照片仍需x-ai-session-key且必须属于当前principal，否则统一410。owner在创建时由服务器授权信息写入，不能由客户端指定。token只存摘要、跨重启保留未过期授权；日志/URL不带token，响应no-store。

请求/上传/下载均支持此会话，原Mask/坐标/确认/evaluate契约不变，医审状态不变。正式production门禁仍保留。错误ACCESS_UNAVAILABLE 503表示受控授权服务暂不可用；图像限额/单推理/过期清理继续沿用。最多8个待用邀请、16个授权会话，暂不提供公开注册或完整患者账户系统。

真实云端HTTP与环境矩阵通过；手机HTTPS/微信后台/体验版上传/真机均未通过（暂无域名）。详见[体验版接入报告](wechat-trial-integration.md)。

## P4.1 公网IP测试入口（2026-11-02追加）

用户授权的临时调试 base 为 `http://212.64.26.206/dermatome-test`。客户端统一追加 `/api/v1/...`；独立 Nginx 将该前缀剥离后转发原 127.0.0.1:8001，接口与几何契约不变。只接受现有一次性邀请/Bearer，公网清除旧管理员鉴权头，照片继续 owner+photo key。原正式域名与服务不变。HTTP 的邀请码/令牌/图片不加密，仅公开或合成数据；release 禁用。真实公网接口已通过，未上传/真机未验收。详见 [P4.1说明](wechat-public-ip-test.md)。

## P4.2 免邀请码测试会话（2026-11-02追加）

用户已取消邀请码交互。新增 `POST /api/v1/access/session`，空JSON `{}`；仅DERMATOME_ENV=controlled且ENABLE_PUBLIC_TEST_ACCESS=1可用，默认关闭。返回 `access_token:string, token_type:Bearer, expires_at:number, access_kind:public_test`，固定1小时、随机principal、摘要存储；只用于隔离，不证明微信身份/开发调试状态，其他客户端同样可申请。拒绝多余字段，Origin403，实际请求体>4KiB413，共享开通10次/分钟和最多16有效会话429。开关未启用403 PUBLIC_TEST_DISABLED，状态服务错误503 ACCESS_UNAVAILABLE。

小程序develop手机/trial静默调用，单次在途/仅内存/过期后再建；不再显示邀请码或开通入口。DELETE同路径仍撤销当前自动会话，其他API继续Bearer/照片owner+key。旧exchange保留回退兼容；不影响几何数据契约。HTTP公开/合成测试限制、全局资源约束和独立入口关闭机制见[免邀请码说明](wechat-public-test-access.md)。release/未知保持关闭。

## V6.1 独立掌侧视图兼容扩展（2026-11-04）

本节补充现行 `/api/v1/evaluate`，取代上文仅支持 `front/back` 的视图范围描述；其他字段、几何公式、测试环境/鉴权/上传门禁保持原约定。

- `lesions[].view`、响应 `lesions[].view` / `views[].view` / `candidates[].view` 接受 `front`、`back`、`palm-left`、`palm-right`。其他视图仍返回 `422 VIEW_UNSUPPORTED`。
- `palm-left/right` 分别表示左、右手的掌侧二维画布。其归一化原点/范围规则仍为左上角 `[0,1]²`，但所属模板完全独立；不能把这些数值解释为全身正面/背面坐标。
- 请求仍只包含一份完整 `identity`。全身请求继续绑定原 `goran-2022` 图谱和人体身份；手掌请求绑定 `palm-dermatomes-v1`、`palm-dermatomes-preview.2`、`commons-palm-v1 / 1.1.0`、`commons-palm-outline-v2`、`commons-palm-ui-v2`。允许同一手掌模板请求中包含左右掌侧，分别计算/汇总，不能混入 `front/back`。不同模板需要独立请求，不把四个视图面积合计。
- `atlas_content_sha256` 来自固定顺序的 `palm-left.json`、`palm-right.json`、`sources.json`、`registration.json`：每项 `filename + NUL + raw bytes + NUL` 依次SHA256；`body_content_sha256` 来自 `data/body/palm-v1.json` 原始字节。客户端必须使用生成副本中的真实摘要，不使用固定占位摘要。
- 原手工 `vertices` 契约、Polygon/MultiPolygon及孔洞、原图空间拒绝、顶点预算与会话修订保持。后端几何契约可表达掌侧多片与孔洞，不代表本轮前端已经支持 AI 手掌放置；本轮人工入口优先，AI 放置仍沿用既有全身流程。

手掌固定注册表与全身加载器隔离。每次请求检查模板/版本/内容摘要、左右侧、局部有效皮肤、来源、`spinal_dermatome` 分区类型及预览状态；路径不来自请求值，无跨请求图谱缓存。`palm-left` 区域必须 `side=left`，`palm-right` 必须 `side=right`；不得将正中/尺/桡神经分布作为同名替代。完整图谱并集保持 P6 的“每请求每视图一次”，逐片与重叠去重汇总共用同一集合，交集/标注面积及候选排序不变。响应 `source.license` 取对应图谱的明确许可，旧全身来源仍为 CC BY-SA 4.0。

手掌资料缺失时的状态必须和“有效图谱下的未覆盖”区分：

| 情况 | HTTP / error.code | 含义 |
| --- | --- | --- |
| 尚无可核实的掌侧皮节边界、来源许可未确认或技术配准未通过 | `409 ATLAS_NOT_READY` | 保留标注，阻止计算；不返回伪造的成功/零覆盖 |
| 客户端模板、图谱版本或摘要不同 | `409 VERSION_MISMATCH` | 明确要求数据同步，不回退全身图谱 |
| 给全身图谱传手掌视图，或给已准备好的手掌图谱传全身视图 | `409 VIEW_UNSUPPORTED` | 坐标空间不能互换 |
| 固定数据缺失、文件损坏、内容哈希不一致、区域自交/越出皮肤、侧别或分区类型错误 | `503 ATLAS_UNAVAILABLE` | 无替代分区，无自动修复/裁切 |
| 已配置且通过技术检查的图谱，当前病灶没有交集 | `200 coverage_status=none` | 只表示这个有效图谱没有覆盖，不代表缺少感觉神经 |

本轮权威手掌数据初始为 `regions=[]`、`technicalValidationStatus=blocked_missing_boundaries`、`sourceLicenseStatus=UNKNOWN`、`medicalReviewStatus=pending`、`mappingEnabled=false`。源码与合成测试可验证接口兼容及算法能力，**不能将合成测试区域或空图谱说成真实掌侧匹配已可用**。最终实际数据状态以 `data/atlas/palm-v1/manifest.json` 和 V6.1 来源记录为准；获取展示手掌素材的合法许可不会自动解除皮节边界的阻塞。

手掌有效皮肤导出另外固定校验 `sourceSHA256`，只允许键 `data/body/palm-resource.json`，并重新读取该固定来源文件验证摘要。来源轮廓变化但未重新导出时返回 `503 ATLAS_UNAVAILABLE`；客户端和本地配置均不能用任意文件路径替代这个来源。左右手掌资源方向、原始许可及配准结论记录在独立素材记录，不从单个感觉检查点生成后端区域。
