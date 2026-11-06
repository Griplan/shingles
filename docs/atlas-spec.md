# 标准人体图谱规范

正式医学图谱仍是 **V0 空结构**，尚无审核通过且已启用的数据，不能医学映射。另有独立的V3来源派生开发预览，不改变V0正式准入状态。V1.3 另有Commons CC0中性人体展示图片，不是正式图谱或医学审核通过的解剖背景。data/atlas/v1 的 v1 是数据版本，不代表开发 V1 已完成或图谱已发布。

V3数据契约与复现见[V3说明](v3-atlas.md)：独立atlasVersion绑定当前templateId/version/geometryId，labelId与区域实例ID分开，分区类型区分独立脊神经、源图组合脊神经标签及 trigeminal_sensory 三叉感觉分区。MultiPolygon保留多片/孔洞，归一化闭环首尾显式相等、外环正面积孔洞反向。源SVG的evenodd填充先转换为有效面再用于Canvas默认nonzero绘制。side沿人体解剖学定义，正背分别配准，显式中线仅适用于当前模板。来源许可verified、技术结果和医学审核pending分开；mappingEnabled=false不能用于病灶匹配。当前唯一源在data/atlas/goran-2022-preview-v2，父版 goran-2022-preview-v1 十文件原样归档；新增 displayName、registrationRefs 为兼容可选字段。局部配准和复现见[V3.1说明](v3.1-atlas.md)。当前目录，由sync_atlas.py生成包内副本并校验SHA，不手工双重维护。

## 1. V0 结构

manifest.json 记录版本、坐标、来源、许可、验证、视图和审核；front.json/back.json 是对应视图空区域集合。当前 manifest：

```json
{
  "atlas_version": "v1",
  "coordinate_system": {
    "type": "normalized_2d",
    "origin": "top_left",
    "x_range": [0, 1],
    "y_range": [0, 1],
    "x_direction": "right",
    "y_direction": "down",
    "laterality": "anatomical"
  },
  "source": {"status": "not_acquired", "references": []},
  "license": {"status": "not_acquired", "identifier": null},
  "validation_status": "unverified",
  "mapping_enabled": false,
  "views": {
    "front": {"file": "front.json", "background_image": null},
    "back": {"file": "back.json", "background_image": null}
  },
  "medical_review": {
    "status": "not_started",
    "reviewer": null,
    "reviewed_at": null,
    "record": null
  }
}
```

正面文件：

```json
{"atlas_version": "v1", "view": "front", "regions": []}
```

背面结构相同，view 必须为 back。三份版本一致，manifest 所指文件与视图匹配。空值及未取得状态必须如实保留，不能填虚构引用、许可或审核人。

V0 `scripts/check_atlas.py` 只校验初始化结构与禁用状态，不是完整医学图谱校验器；真实数据接入时要扩展契约和测试。

## 2. 坐标与左右侧

- 标准图谱**完整画布**左上角为原点，x 向右、y 向下，x、y ∈ [0,1] 且有限。
- 标注与区域共用标准画布，不以屏幕像素、局部裁剪框或当前放大区域为存储基准。
- front/back 坐标空间独立，同坐标不能跨视图复用，不能通过翻转正面皮节代替背面。
- 左右指人体解剖学左右。标准未镜像正面人体左侧显示于画面右侧，标准背面人体左侧显示于画面左侧；接入来源仍须核实实际方向，不靠文件名假定。
- 视图、图谱版本与背景版本必须随标注关联，不能无依据推导医学标签或边界。

## 3. Polygon 草案（未来，未实现 Schema）

文档工作名称为 `AtlasRegionDraft`，建议包含稳定区域标识、来自审核资料的节段标签、解剖学侧别与 polygon 外环；字段将在 V3/V4 与两端类型和接口一起冻结，当前没有此代码 Schema。

首期建议采用**无孔简单多边形**：polygon 为 [x,y] 点对数组，首尾重复显式闭合，至少 3 个不同顶点，闭合数组至少 4 点。不支持孔、多环或隐含 MultiPolygon；同节段不连续部分可用不同 region 表示，并在业务版本明确聚合规则，不能跨越无关区域强行连线。多病灶为多个独立多边形。

纯几何数组示意（不是医学区域，不能写入正式图谱）：

```json
[[0.1, 0.1], [0.3, 0.1], [0.3, 0.3], [0.1, 0.3], [0.1, 0.1]]
```

实际合成夹具仅放 `backend/tests/fixtures/`，标 synthetic，使用非医学区域名。V0 的 regions 保持空。

后续合法性规则：数值有限且在 [0,1]；拒绝布尔值冒充数值、点数不足、未闭合、自交、回折重叠、退化直线、零面积、除首尾外的连续重复点与不支持结构。不擅自自动修复为不同形状。环方向不携带医学含义，是否规范化在契约中说明。面积容差、点数/体积限制须实现时明确并测试。

来源图谱可能有重叠，不能无依据强制切成互斥分区。仅点/线接触的交集面积为零；是否列为相邻候选属于单独待验证规则，不能伪装正面积重叠或编造临床判断。

## 4. V1.2 显示坐标与模板绑定（历史，当前绑定见4.3）

当前展示模型为 neutral-body-v3 / 3.0.0（旧v1/v2资源及v2区域表保留历史），逻辑画布 400×900；完整画布左上角原点，x 向右、y 向下，归一化坐标不随视口变化。front/back 独立，禁止直接跨视图复用点和区域。当前所有区域都是 UI 示意，数据在 miniprogram/data/body-regions.ts，与医学 JSON 隔离。

coordinate.ts 的纯函数为 fitViewport / focusViewport / resetViewport / normalizedToCanvas / canvasToNormalized。ViewportTransform 保存 logicalWidth/Height、viewportWidth/Height、scale、offsetX/Y、zoom、padding。实际缩放比例统一用于 x/y，padding 默认 16 CSS px：

```text
usableW = containerWidth - 2 * padding
usableH = containerHeight - 2 * padding
baseScale = min(usableW / logicalWidth, usableH / logicalHeight)
scale = min(usableW / (logicalWidth * target.width), usableH / (logicalHeight * target.height))
offsetX = containerWidth / 2 - (target.x + target.width / 2) * logicalWidth * scale
offsetY = containerHeight / 2 - (target.y + target.height / 2) * logicalHeight * scale
zoom = scale / baseScale
px = offsetX + x * logicalWidth * scale
py = offsetY + y * logicalHeight * scale
x = (px - offsetX) / (logicalWidth * scale)
y = (py - offsetY) / (logicalHeight * scale)
```

全身 target 为 (0,0,1,1)，局部 target 为所选区域 bounds。缩放只改变变换对象，原点、归一化点与 UI 元数据不变。复位重新按原容器计算全身，不对模型顶点做反复乘除。

逆变换输入必须是 Canvas 本地 CSS 像素；留白、可见 Canvas 范围外、非有限数返回 null。不对真实越界点击吸附，唯一数值修正是 1e-12 内的浮点舍入。非法容器/模型尺寸、留白、区域、正向标准点或损坏视口抛 RangeError；逆变换遇无效视口返回 null，防止 NaN/Infinity 进入后续数据。

DPR 只控制物理分辨率和绘图上下文，不进入上述公式。未来 V2 若输入事件为页面坐标，须先根据滚动和当前 Canvas 显示矩形转换为本地 CSS 坐标，不能将 client/page/物理像素直接混用。V1.1仅有单点坐标调试，无病灶点集或持久化。CanvasTouch的本地x/y直接作为CSS像素，clientX/Y减去点击时重新取得的rect.left/top；屏幕坐标指页面可显示区域，不含导航条。

原创示意模型的 ID/视图必须与未来标注关联。要接入真实皮节，必须验证医学边界与展示模型的方向、比例、画布和配准；不能按高度分条、直接拉伸或把 UI 区域改名为医学皮节。data/atlas/v1 的 background_image 继续为 null，医学启用仍被禁止。

### 4.1 轮廓命中、调试与兼容

归一化范围合法只表示在逻辑画布内，不保证命中人体。将有效逆变换结果乘逻辑尺寸，交给与visual.outline同源的细分轮廓判断。贝塞尔控制点至弦阈值0.2逻辑单位，边缘判断容差0.25逻辑单位；容差仅影响命中，不修改坐标。画布内轮廓外和模型范围外分别提示，不吸附边缘。

DebugPoint只含modelId/modelVersion/view/normalized，最多一个；换面/关闭清理，缩放与复位保留标准点并重投影，视口外隐藏。点击时Canvas位置与当前十字位置分别显示，避免把重新投影后的显示变化误认为标准坐标变化。调试点不写入任何病灶、图谱、storage或后端。

BodyModelConfig将visual和regionSet绑定geometryId及尺寸/视图；资源sourcePath追溯本地TS模块，不是图片URL。withBodyVisual要求outline、view、geometryId和尺寸相同，故仅样式变化可复用坐标。更改几何须新模板版本并同步区域，未来医学图谱与标注同样必须绑定模板。旧v1/v2与新v3同为400×900但几何不兼容；无自动迁移。变化参数详见资源说明，不改当前空医学manifest。

### 4.2 V1.2 配准与设计参考

当前regionSetId为neutral-body-v3-ui-regions-1，regionGeometryId为neutral-body-v3。胸腹/背部边界、颈部和四肢范围随新路径更新，头部范围因头高保留而复核后沿用；不是无检查地复制旧坐标。旧body-regions-v2.ts为原样存档。当前hitOutline来自新轮廓，前后同骨架但解剖学左右与视图仍独立。

BODY_LANDMARKS是本地插画设计参考：肩(277,195)、肘(315,334)、腕(344,451)、髋(246,432)、膝(230,650)、踝(229,825)，另一侧镜像；裆(200,474)、头顶(200,30)、下颌(200,138)。它们用于检查关节次序、轮廓包含、UI区域归属及放大视口，不进入医学JSON，也不代表医学神经皮节边界。测试通过只证明与声明的设计位置配准，不能证明与患者真实解剖或正式图谱一致。

### 4.3 V1.3 Commons 新背景（历史区集，现行见4.4）

当前模板为`commons-neutral-v1/4.0.0`，geometryId=`commons-blank-cc0-v1`，regionSetId=`commons-blank-cc0-v1-ui-regions-1`。400×900逻辑尺寸及上述归一化公式不变。imagePath加载本地PNG，sourcePath追溯可编辑SVG，manifest记录原文件哈希、许可、处理组、等比变换和派生资源哈希；许可见[来源说明](../miniprogram/assets/body/commons-cc0/NOTICE.md)。

16个粗UI区域、局部bounds和人体命中/高亮边缘已针对新图片重建，前后轮廓独立；后者来自同一源图栅格，不是旧贝塞尔或矩形命中。栅格闭运算3×3像素、简化0.3逻辑单位另有误差带；独立PNG采样测试排除≤1逻辑单位的边缘带，不能将通过表述为边缘无限精确或医学审核。

同一缩放只解决源图的画布定位；旧v1/v2/v3点不能依靠同画布尺寸直接迁移。未来病灶/正式皮节须携带模板id/version、view、来源/审核与配准信息。当前没有病灶存储；正式医学manifest仍空、unverified、mapping_enabled=false，未生成或挪用皮节边界。

### 4.4 V1收尾基线与V2规划引用（2026-10-22）

V1交付基线保留commons-neutral-v1/4.0.0、commons-blank-cc0-v1和400×900；当前粗区域配置为commons-blank-cc0-v1-ui-regions-2（V1.6修订），取代上节历史区域1，见[身体区域约定](body-regions.md)。归一化公式、正背独立/解剖左右及正式医学图谱状态不变，不因用户接受V1而变更审核。

[V2计划](v2-plan.md)仅定义待实施的本地病灶结构：草稿开放，完成环末点显式重复首点，与第3节未来闭环草案一致；V1 UI outline隐式闭合不是病灶Schema。点必须结合模板与view解释，regionSet用于粗导航上下文，不能冒充atlas_version。完整病灶边/填充包含校验还未实现，不能用现有单点轮廓判断代替。本轮未修改类型、公式、接口或医学数据。

## 5. 来源、许可与医学审核

真实来源登记在 [data/references.md](../data/references.md)：可核对标题/作者/机构、版本/日期、出版或获取信息、许可及衍生/再分发范围、适用身体区域与视图。不能把合成图片或无出处资料当成已验证皮节依据。

审核记录须包括审核人/角色、日期、版本、范围、对照来源、差异/争议、处置、结论与限制。医学审核不能由 JSON 或几何单测代替。

未来准入流程（V0 未执行）：取得来源与许可 → 固定背景/方向/画布并记录整理方法 → 技术校验 → 适当人员逐区域医学审核 → 将审核与技术证据绑定同一数据快照 → 满足全部条件后按正式契约启用。

来源缺失、许可不明、空图谱、背景不一致、审核未完成任一项均阻止医学映射。真实发布状态枚举待接入时确定，不能单改 verified 字符串或 mapping_enabled 开关就视为审核完成。

## 6. 背景绑定与版本管理

未来每版须绑定背景路径、建议 SHA-256 内容标识、原始宽高、方向、来源/许可、裁剪和留白说明；这些扩展尚未进入 V0 manifest，当前 background_image 为 null。

背景替换、裁剪/比例/镜像改变、边界修改或审核范围变化需新数据版本和变更记录，重新检查影响范围。已启用历史快照不得静默覆盖。旧标注继续引用旧版或经过明确验证的迁移，不能假定跨版本等价。

即使准入通过，二维图谱不能消除个体差异与相邻重叠，输出仍仅是辅助候选，几何比例不是医学置信度。

## 7. V2本地标注数据（2026-10-23，非医学图谱/API）

实际类型见miniprogram/types/annotation.ts。schemaVersion1会话包含sessionId、basis(templateId/templateVersion/geometryId/regionSetId)、currentView、phase、revision和两面状态；basis为commons-neutral-v1/4.0.0、commons-blank-cc0-v1、commons-blank-cc0-v1-ui-regions-2。每片有唯一id/view/ring/navigation.entryRegionId。该入口仅表示来源导航，不能解释为实际身体覆盖或医学标签。

草稿vertices开放、不重复首点；完成ring显式重复首点，至少4项。点为{x,y}有限归一化数，基于完整400×900逻辑画布；无屏幕、DPR、聚焦框相对值。UI outline仍沿用隐式闭环，不能将其与completed格式混用。每片一个无孔简单环，不连续范围各存独立对象；多个对象可重叠、不自动合并、无面积统计。人体有效几何的孔洞支持与病灶环本身带孔是不同概念。

当前无持久化/后端适配/atlas_version；错模板、几何或区域版本保留旧会话、拒绝静默使用，没有自动迁移。后续V3/V4必须重新校验完成环、保留模板/view绑定、落实重叠去重策略，并在合格正式图谱到位后绑定真实atlas版本。不能把UI区域2或template4.0.0当作医学图谱版本。上文2026-10-22“当前无病灶存储”为当时记录；现在仅有运行内存标注，医学JSON和审核状态未变。

## V4 计算身份与数据边界（更新此前禁止一切匹配的历史范围）

mappingEnabled=false继续禁止正式医学映射。V4只允许独立开发测试开关下的参考几何匹配，返回preview与pending，不改变准入状态。

匹配唯一源仍为 `goran-2022-preview-v2`，请求绑定模板、几何、UI区域修订、图谱版本及七输入SHA256。后端每次读取并检查，无静默旧版本回退。前端高亮只能引用身份一致的包内实际region IDs。同标签候选按分区类型、标签、解剖侧别、视图分组，组内实例先并集；组合标签不拆分。

`data/body/commons-template4.json`由`scripts/sync_matching_body.py`从现有V2模型hitOutline导出，闭环只重复起点。独立SHA及源代码SHA约束两端同源。归一化和人体/图谱几何未改变，不升级模板版本。`--check`重新导出比较；人体有效范围与医学覆盖是不同职责。完整比例和错误规则见[API](api.md)。

## V5.3 照片与人体坐标的显式桥接（2026-10-31）

上文V2“每片只有一个无孔环”为历史基线。V5.3对AI辅助来源增加完整人体MultiPolygon兼容结构，不能把照片 `photo_oriented_normalized_v1` 顶点直接当成人体坐标。原 `confirmed-photo-segmentation-v1` 保持不变；先依据方向统一后的照片宽高进入统一像素度量空间，再通过共同中心的平移/等比缩放/旋转进入当前人体逻辑画布，最后输出 `body_template_normalized_v1`。多片/孔洞无损保留，原照片几何不原地修改。

目标身份仍为现行templateId/templateVersion/geometryId/regionSetId加view；body坐标依据完整逻辑画布，不依据focusBounds、CSS像素、DPR或局部区域。放置变换属于人工确认的来源记录，不含atlasVersion或医学标签。所选粗部位只作导航，初始大小无物理尺寸含义；正背/人体解剖左右规则不变。

确认前校验整个填充面在同源真实人体轮廓之内，包含所有边、片区与孔洞语义，不能用顶点判断、body包围盒或显示clip替代。超范围保持草稿和原AI结果，提示用户调整；不裁切、不吸附、不使用扩大容差隐藏跨背景。视口变化不修改已确认body几何。

当前V4接口仍接收旧简单环；含AI完整几何的会话在传输入口明确阻止，避免只发送第一片或填掉洞。V5.4再适配统一人体几何的接口和匹配；本轮没有修改医学图谱、模板几何或审核状态，也不升级人体模板版本。具体结构与生命周期见[V5.3说明](v5-placement.md)。

## V6.1 掌侧独立模板与准入（2026-11-04）

新增 palm-left/palm-right，仅表示独立掌侧画布。commons-palm-v1/1.1.0、commons-palm-outline-v2、commons-palm-ui-v2；归一化必须连同模板和view解释，不能混入现有front/back统计。原Gray掌图为左掌，五指向上时拇指在屏幕左；右掌对称变换x'=1-x；展示镜像不等于取得医学边界。

`data/body/palm-resource.json` 提供真实皮肤轮廓；`scripts/sync_palm.py` 生成后端palm-v1.json、包内palm.generated.ts及SHA绑定。轮廓为完整闭合面，指缝留空。人体素材授权与神经图谱许可分开。

`data/atlas/palm-v1/` 独立配置 manifest、两视图、sources、registration，当前preview.3含3标签/6区域，technicalValidationStatus=passed_offline_geometry，sourceLicenseStatus=verified，medicalReviewStatus=pending，mappingEnabled=false。Servier CC BY 4.0原始曲线经6个掌部/指蹼/腕口控制点配准，支持参考预览；这不是医学审核。旧preview.2的空图谱仍不得执行面积匹配或返回200空候选。感觉测试点、外周神经区域、合并标签均不可自动补成独立C6/C7/C8边界。

后续有来源的区域需分别核对朝向、脊神经皮节体系、商业派生许可、来源标签、完整Polygon/MultiPolygon、孔洞、模板绑定、手掌内包含和实际配准；准备好后才进入参考预览准入，不能自动提升医审状态。源研究与未配置原因见 [V6.1说明](v6-special-body-views.md) 和 [来源核验](validation-records/v6.1-sources.md)。原全身图谱及医审状态未更改。

最新原始文件、配准复现、失败草稿及16个来源参考位置见 [V6.1续查](validation-records/v6.1-recheck/report.md)。人体模板保持1.1.0，只升级图谱为preview.3；不得静默重解释旧图谱会话。


## V6.4 Goran 独立足底参考图谱

`data/atlas/sole-v1`：atlasId `goran-sole-v1`，atlasVersion `goran-sole-preview.1`；templateId `goran-sole-v1` / `1.0.0`，geometryId `goran-plantar-outline-v1`，regionSetId `goran-sole-ui-v1`。viewId 为 `sole-left`、`sole-right`；320×640逻辑画布、640×1280 PNG，左上原点、归一化0～1。与全身/手掌/照片均不是同一坐标空间；禁止直接面积合计或跨视图坐标迁移。

四个实际区域实例：每侧 L5、S1。`geometry` 即 polygonGeometry（MultiPolygon，首环外缘、后续孔洞）；同时记录 viewId/template/atlas 身份、dermatomeLabel、side、sourceFile、sourceElementId（无XML id时为稳定元素路由）、sourceSVGId、路径SHA256、sourceLicense、registrationMethod、medicalReviewStatus。左右实取原图各自路径部分，旋转180°且等比5.6，非镜像、非全身足跟配准。

来源 Goran_tek-en / CC BY-SA 4.0，`root/9/1/43`→L5、`root/9/1/44`→S1。保留原绘制顺序、源孔洞和原图细缝，不补邻接 L4/S2，不扩展至所有脚部隐面。医学审核 pending / mappingEnabled=false；可在现有受控参考计算门禁下验证几何，不能解释为正式医学准入。[提取记录](validation-records/v6.4/原路径提取与覆盖范围.md)。

`build_sole_atlas.py` 默认只读重现校验；显式 `--write` 才生成足底数据及包内副本。不会写全身或手掌数据。原曲线采样0.02 SVG单位、无形状简化；精度和皮肤裁切损失均公开记录。

## V6.5 当前绑定与主人体手部（2026-11-05）

当前本地图谱为 `goran-2022-commons-template4-preview.3`（目录 `data/atlas/goran-2022-preview-v3`），人体模板 `commons-neutral-v1 / 4.0.1`、有效轮廓 `commons-blank-cc0-hands-v2`，粗区域配置仍为 `commons-blank-cc0-v1-ui-regions-2`。原PNG/SVG与400×900、归一化坐标规则不变；版本修订仅说明源SVG指缝有效性修正。旧 `preview.2`、旧轮廓及原114区几何保留；新增22个真实Goran手部路径实例，正面掌侧、背面手背分别配准，保留C6–8、C8/T1组合标签及真实腕部过渡，不将它们拆成独立医学边界。

完整来源/许可、配准方法、细缝/隐面未覆盖与误差限制见 [V6.5报告](validation-records/v6.5-main-body-hand/report.md)。图谱仍为开发参考，`medicalReviewStatus=pending`、`mappingEnabled=false`；技术验证不是医学审定。历史段落中的旧模板、手部排除和独立掌功能描述不代表当前运行配置。

独立palm-left/right不再注册或加载；特殊部位只保留sole-left/right。共享模块改名 `local-surface`，仅脚底使用，不改变V6.4模板、几何、会话与匹配公式。原Gray/Servier资料、历史图谱、许可与归档仍保留，不作运行时fallback。旧独立掌坐标不可转存front/back。现有会话版本冲突保持原数据并明确拒绝，不自动迁移；当前没有病例持久化或数据库迁移。

前后端必须同步当前版本/哈希；旧计算结果失效，旧服务器会返回409。没有在本轮部署或上传。微信/真机交互NOT_RUN；本地数据与自动测试证据见 [测试记录](validation-records/v6.5-main-body-hand/tests.md)。唯一进度以 [task.md](../task.md) 为准。

## V6.6 腋下身份与未就绪边界

新增独立axilla-left/right，模板commons-axilla-v1/1.0.0，geometry=cc0-raised-axilla-outline-v1，regionSet=commons-axilla-ui-v1，400×360。前后面/脚底坐标不迁移；源照片仅供显示描摹，照片归一化不能直接作为人体点。

图谱axilla-reference-v1/axilla-unconfigured.1位于data/atlas/axilla-v1；两个regions均空。technicalValidationStatus=blocked_missing_boundary_evidence，sourceLicenseStatus=unconfigured，medicalReviewStatus=pending，mappingEnabled=false。显示源CC0和皮节边界许可UNKNOWN分开，不能用图片可商用替代医学来源。

Goran T1/T2/T3/T1/T2的9个源元素重新核对原文件、元素路径、d摘要和矩阵，仅保存original_svg_user_units审计数据；无有效跨姿态配准，不写入运行regions。图谱未配置不可返回“无相交100%”的成功结果；前后端均拦截。不能将未知皮肤归最近T2。来源、左右、未覆盖和误差限制见[V6.6配准记录](validation-records/v6.6-axilla/registration.md)。

### V6.6.2 试验性腋下分支

独立 `axilla-goran-provisional-v1 / goran-axilla-provisional.1` 以PROVISIONAL/HIGH/UNREVIEWED_PROVISIONAL记录近似配准。目标全部为B类变换结果，A源几何单独保存，C延伸0区域。原空腋下图谱与已有全身/足底保持原版本；医学审核pending、正式mappingEnabled=false。技术就绪只允许受控参考模拟，不表示医审通过。每个实例保留sourcePathId、sourcePathSHA256、配准点/矩阵及不确定性。详见[配准记录](validation-records/v6.6-axilla/provisional-matching/source-to-target-mapping.md)。

### V6.6.3 人工交互图谱

axilla-schematic-v1独立分支以schematic_region区分原脊神经/组合标签类别，sourceType=ARTIFICIALLY_CONSTRUCTED。来源系统schematic_skin_partition、purpose=artificial_partition_design，不能伪称dermatome边界证据；medicalReviewStatus保持pending、正式mappingEnabled=false。SCHEMATIC状态及非医学用途必须贯穿区域、加载器、API和UI。原Goran、provisional及审核资料保留，不原地升级或覆盖。详见[设计与覆盖](validation-records/v6.6-axilla/full-simulation/report.md)。
