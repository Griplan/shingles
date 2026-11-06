# 系统架构

**V1、V2已获用户验收；V3为独立图谱配准预览。** 保留V1.6区域、V1.5交互、Commons素材和原坐标规范；医学匹配、结果高亮及AI仍为后续设计。进度与真实验证记录以 [task.md](../task.md) 为准。历史设计不作当前实现声明，V3边界见[V3说明](v3-atlas.md)。

当前V3数据流：合法同套原始SVG → 离线逐标签提取/分段配准 → data/atlas版本目录 → 确定性生成小程序副本 → 独立atlas-debug页 → 现有body-canvas的atlas覆盖层。atlas-view仅筛选图谱及计算查看范围；atlas-render复用原CSS视口绘制真实MultiPolygon、孔洞和可关闭标签。focusBounds只调现有focusViewport，不当填充几何。新增props默认null，V1/V2无图谱；页面不导入annotation-session、不发送请求，入口与页面动作均检查集中开发环境保护。旧V3匹配规划移至后续待授权任务，后端接口未变。

## 1. 模块关系

采用微信原生小程序 + 单体 FastAPI + 本地版本化图谱文件。AI 为未来可选模块，后端核心不导入 AI 或依赖权重、GPU、外部模型服务才能启动。

```text
微信原生小程序
  index → select                      V1 人体浏览
  select → annotate                    V2 标注/管理/同页复核
  result                               V0/V5 业务占位
  services/api.ts                       HTTP 请求边界
  body-canvas → coordinate             V1 Canvas / 纯坐标变换
  assets/body + data/body-regions      V1.3 本地PNG / 源图轮廓 / UI区域
  annotation-session / lesion-render   V2 权威内存 / 同视口标注层
  医学候选高亮                          规划 V5
                    │ HTTP / JSON
                    ▼
FastAPI app.main
  /api/v1/health                       V0 健康检查
  /api/v1/atlas, /evaluate              V0 HTTP 501
                    │ 以下业务依赖均为规划
                    ▼
  业务 Schema → atlas_service → dermatome_matcher
                    │                  │
                    ▼                  ▼
  data/atlas/<version>/            utils/geometry
  manifest + front + back         Shapely 几何运算
  [V0 已有空结构]                 [规划 V3]

ai/（可选 V7）→ 分割建议 → 人工确认及独立配准 → 标准标注
```

V0 atlas/evaluate 不调用图谱、几何或 AI 服务，不读取或验证业务 payload，也不返回候选；当前图谱只供静态结构检查，不能医学映射。

## 2. 小程序职责

| 模块 | 职责 | 当前状态边界 |
| --- | --- | --- |
| pages/index | 项目说明和入口 | 静态内容及导航 |
| pages/select | 正背面、overview/focused、选择、弹层和调试开关 | V1.5 统一选择入口，无 Canvas 绘图逻辑 |
| pages/annotate | 导航、确认、工具栏、编辑/复核 | V2，只读会话快照，动作交唯一会话模块 |
| pages/result | 候选、解释和返回修改 | 业务占位，无结果生成 |
| components/body-canvas | Canvas 初始化、测量、绘图、视口和异常 | V1.3 图片加载/缓存；render.ts 绘制本地PNG与高亮 |
| components/region-picker | 当前视图的两列选项与候选确认 | V1.5 只发送choose/close，不维护独立区域定义 |
| components/lesion-editor | 点击、撤销、闭合 | 保留位置，不编辑 |
| components/segment-overlay | 区域与候选高亮 | 保留位置，不高亮 |
| services/api.ts | 未来 HTTP 请求边界 | 仅职责占位，尚未发起请求 |
| utils/coordinate.ts | 归一化转换、适配、区域视口和复位 | V1 已实现纯函数，无 wx 依赖 |
| utils/body-hit-test.ts | 人体源轮廓过滤、粗区域多边形命中 | V1.5 纯函数，区分唯一/体外/未配置/歧义 |
| types/dermatome.ts | 当前 API 与前端 UI 类型 | V0 health/error 不变；新增 V1 展示类型 |

前端负责交互和展示，后端独立验证未来输入。正背面状态隔离，切换图谱或背景版本后不得默默复用不兼容标注。屏幕像素只用于显示，不能作为原始存储。

## 3. 后端职责与依赖方向

- `app/main.py`：应用创建、路由挂载，不承载匹配逻辑。
- `api/routes/`：协议入口；V0 health 可用，atlas/evaluate 501；未来将校验后的请求交给服务并映射错误。
- `schemas/`：未来 Pydantic 标注和结果契约，V0 无可用业务 Schema。
- `services/atlas_service.py`：未来加载图谱并检查版本、来源、许可、审核、背景和启用条件。
- `services/dermatome_matcher.py`：未来组织匹配、候选排序、多病灶和解释。
- `utils/geometry.py`：未来独立几何运算，不依赖 HTTP 或医学标签，可用合成数据测试。
- `tests/`：基础服务测试；未来合成几何夹具仅放 `tests/fixtures/`，明确 synthetic。

依赖方向为路由 → Schema/服务 → 图谱数据或几何工具；几何工具不反向依赖路由。不提前创建仓储、插件框架、接口基类等无需求抽象。Shapely 依赖已列入技术选型不表示交集算法已经实现。

## 4. 数据与版本

`data/atlas/v1/` 是空结构：regions 为空，来源/许可 not_acquired，审核 not_started，validation_status 为 unverified，mapping_enabled 为 false。数据 v1、API `/api/v1` 与应用 V0 是独立版本概念。

来源登记在 `data/references.md`，规范见 [atlas-spec.md](atlas-spec.md)。未来背景与区域必须绑定同一画布、方向和版本；不能替换背景后继续使用旧边界。V0 不引入数据库，未来 V2 标注先保留当前前端会话，业务传输只使用所需版本、视图和几何信息。

## 5. 后续业务数据流（未实现）

1. 前端获取指定版本/视图图谱，按背景和坐标约定显示。
2. 用户标注，统一将点击逆变换为完整图谱归一化坐标。
3. 提交图谱版本、视图和病灶多边形；后端检查格式、有限数、范围、几何及图谱准入。
4. 计算交集与候选；明确多病灶策略、分母和排序，保留无匹配与多候选。
5. 前端在同版同视图高亮并解释几何量与医学限制，允许修改标注。

多病灶合并、同分排序、容差和资源限制须在 V3/V4 定义与测试，当前无医学阈值。接口草案见 [api.md](api.md)。

## 6. AI 与运行边界

AI 将来可建议照片 Mask，但不能直接提供标准图谱位置。照片分割与解剖配准是独立问题；经人工确认及验证过的坐标转换后才能进入统一规则通道。AI 环境和权重独立，关闭 AI 后人工路径仍应运行，详见 [ai/README.md](../ai/README.md)。

V0 本地虚拟环境运行后端，微信工具导入小程序。HTTPS、请求域名、目标网络和真实部署留待相应版本验证，本地回环健康检查不代表真机或生产部署通过。错误不能回退为假医学结果；日志与数据处理遵循 [privacy.md](privacy.md)。当前不引入登录、数据库、缓存、容器、微服务、云服务或 3D 引擎。

## 7. V1.2 Canvas 与模型配置（历史实现，当前差异见第8节）

select管理view、区域、放大和debugEnabled；区域按钮负责选择，Canvas点击只在调试开启时探测坐标，不触发区域选择。切换view清空选择/缩放/调试点，关闭调试清空点；区域切换保留同视图标准点以便检查重投影。调试面板位于操作区下方，画布大小独立。

body-models.ts是当前模板入口：id/version/geometryId/view/逻辑尺寸/visual/区域集标识/regions/hitOutline。neutral-v3.ts是视觉路径、阴影、配色，body-regions.ts是UI数据；validateBodyModel检查资源尺寸/视图/几何及区域绑定。withBodyVisual允许几何完全相同的样式替换，改变outline则拒绝。V1的model.ts仅保留历史，运行绘图器不再直接导入固定资源。

coordinate.ts仅依赖LogicalModel尺寸，完全不依赖wx或人体资产。body-path.ts从模型同一outline自适应细分命中轮廓，body-debug.ts将Canvas本地或client触点转换并区分有效人体/轮廓外/模型外；不是医学匹配。背景、人体/阴影、UI高亮、细节、调试十字按顺序绘制；没有预建医学层、病灶层或空编辑器。

组件自身selector query取得Canvas节点/CSS尺寸，getWindowInfo取得DPR；物理宽高round(CSS×DPR)，每次setTransform(DPR,0,0,DPR,0,0)，之后应用统一ViewportTransform。ready/show/resize/observer按需重绘，hide/detach使旧查询失效，无全局监听或持续动画。

原生touchstart/move/end/cancel仅在调试开启时工作，移动超过8 CSS px或多点不采样。每次有效tap重新query rect，避免滚动前缓存偏移；测量与当前viewport尺寸不一致时提示重试并重新绘图，不使用过期变换。generation和probeSequence隔离换面/缩放/关闭/隐藏/卸载及连续点击的异步回调。

组件WeakMap最多保存一个DebugPoint：modelId/modelVersion/view/normalized。不进入病灶数据、storage或API。十字在模型绘制后用normalizedToCanvas重投影，长度7 CSS px；视口外不显示，不移动原点。

事件：debugprobe提供status/view/modelId/modelVersion、点击时screen/canvas和有效normalized；viewportchange提供实际visualId、view/模板版本、viewport、DPR、物理尺寸和当前markerCanvas。page拒绝错版/错视图或关闭后的调试事件。screen是页面可见区域CSS坐标，不能称作设备物理屏幕坐标。

测试位于根目录tests/miniprogram，使用Node及明确Canvas替身；真机/微信渲染另记task.md，不能互相替代。

V1.2的BODY_LANDMARKS记录插画肩、肘、腕、髋、膝、踝等设计位置，前后共享同一骨架与连续轮廓；details/shadows各自重绘。命中轮廓仍从新visual.outline生成，不保留第二份人工命中边界。regionSet为neutral-body-v3-ui-regions-1，16个区域保留名称和左右约定，重新适配几何。旧neutral-v2.ts与body-regions-v2.ts只用于历史比较，不进入当前绘图配置；旧点不能跨版本重投影。

坐标公式回归与anatomy-registration配准分别执行：后者核对实际轮廓截面、关节线、左右参考点与UI多边形，以及三尺寸的投影/探测/放大复位。这些是工程校准，不能验证人体医学准确性或神经皮节分布。

## 8. V1.3 外部素材绘制与绑定

当前body-models.ts引用commons-v1.ts，模板commons-neutral-v1/4.0.0；sourcePath指向可编辑SVG，imagePath指向实际运行PNG。只加载本地1200×2700图片，逻辑画布仍400×900，DPR和归一化公式不变。旧路径分支供历史资源复现，新模板缺图片则抛错，不能回退旧人体。

组件在取得Canvas节点后createImage，按节点/图片路径缓存两面。尚未加载时viewport=null，不对空画布探测坐标；onload验证尺寸再重绘并发布真实viewportchange。onerror明确提示并可重试；视图、可见性、实例及缓存条目身份过滤旧回调。hide/show、detach、重测尺寸与输入generation逻辑保留。SVG转换只在离线脚本执行，不引入运行解码库。

人体边缘来自相同源SVG栅格的外轮廓：3×分辨率，alpha阈值24，3×3闭运算弥合散线微隙，外部漫水取内部，跟踪边缘并0.3逻辑单位简化。生成路径仅用于命中和高亮clip，显示仍是原线稿PNG。前后同缩放/垂直框、水平各自居中；前后独立轮廓，保留源图差异。完整出处/变换/哈希见assets/body/commons-cc0/manifest.json及NOTICE.md。

body-regions.ts重新配准16个UI区域及focus bounds；旧v3表保存在body-regions-v3.ts，旧模型文件不修改。关键工程点按视图独立记录，后枕与下颌不混用。不能用整体仿射变换证明旧坐标有效，也不迁移旧调试点。commons-registration测试独立解码实际PNG透明度，与命中密集比较，并核对区域、左右与多尺寸重投影；公式测试、源图配准与微信触控验证分开记录。未来医学图谱须绑定新模板版本，正式atlas JSON未改变。


## 9. V1.5 选择、弹层与事件优先级

页面只管理overview（全身选择）和focused（局部预览）。初始无选择；唯一命中与列表选择都调用applySelection，只更新区域、高亮、名称并回overview。zoomIn在有效选择后显式设置zoomRegion进入focused；返回全身清zoomRegion、保留选择。更换部位打开列表，取消保留原mode/selection/focus；换面清空选择、缩放、候选和调试读数。

事件链：touchstart/move/end → readTouch → 点击时重新测量Canvas rect → probeTouch调用统一逆变换及源轮廓过滤 → hitTestRegion → regionprobe → 页面applySelection/候选列表。坐标与body-debug/body-path原函数不变；新增hit-test只将归一化多边形换成同一逻辑单位进行点包含，不另写屏幕逆变换。bounds仅快速筛选与focus用途，最终仍要求源人体轮廓及多边形命中。沿用0.25逻辑单位边缘容差，收集全部命中并按ID稳定输出，不按数组先后决定区域。无医学优先级依据时返回ambiguous，用户从候选确认。unconfigured和outside-body分别提示，不吸附。

body-canvas只报告regionprobe（status/regionIds/view/modelId/modelVersion），正常选区不保存标准点。调试分支只报告原debugprobe，单个DebugPoint仍绑定标准坐标、view和模板版本；focused普通点击忽略。优先级为弹层或素材说明阻止Canvas → 调试探测 → overview选区 → focused只读。页面与组件都拒绝过期、错面、错版事件。8 CSS px拖动阈值、多指/取消过滤、generation/probeSequence异步失效机制继续共用。

body-canvas新增interactionBlocked与layoutRevision属性；页面onShow/onResize及开发面板入口触发布局修订，组件ready/show/resize/属性更新重新测量并绘制。有效轻触仍重新取rect，滚动后不复用旧top；尺寸不符时提示重试并刷新视口。DPR仅设置物理画布，触点仍是CSS单位。底栏参与正常文档流，矮屏使用最小画布高度和纵向滚动，不覆盖脚部。

region-picker接收当前模型regions或实际命中候选数组，不含硬编码人体部位。遮罩关闭、内部阻止冒泡，只有scroll-view内容可滚动，安全区留白。实际微信模拟器曾发现原生Canvas绘制层盖住弹层：打开弹层/素材说明时仅hidden Canvas，保留外壳尺寸、节点缓存、模板、选择、视口目标和标准调试点，暂停隐藏节点测量；关闭后重新测量重绘。这是原生绘制层兼容处理，不改变坐标规范或人体资源。控件使用可访问button语义的view避免辅助原生按钮固有宽度在窄屏撑破两列；主操作仍使用原生button。

这些都是粗粒度UI几何，正式atlas和医学映射状态不变。自动替身、实际微信操作与像素误差测量分别记录，不能相互代替。


## 10. V1.6 区域几何与局部视野

BodyRegion.outline就是regionGeometry，闭合边隐式连接首尾，选中填色/细实线与body-hit-test最终点包含读取同一不可变数组。BodyRegion.bounds就是focusBounds，在区域初始化时由全部顶点的包围盒加x±0.015/y±0.012留白计算并限于[0,1]；可作快速预筛，但不能作最终命中或填色。BodyModelConfig.hitOutline与visual.outline是同源bodyOutline，分别门控有效人体与裁切绘制，不能代替胸臂内部边界。坐标公式未改。

原错误是四点胸部/上背梯形与上肢多边形有面积重叠，不是误用bounds绘图，也没有证据表明PNG整体坐标变换错位。V1.6在同一400×900源逻辑画布人工校准；肩外侧纳入对应上肢，胸/上背保留躯干两侧。独立前后肩臂seam、颈根、腰线及侧缘数组由相邻区域复用；下腹/下肢亦统一到产品骨盆分界y450，头颈接线消除原带状重叠。详细约定与版本影响见[body-regions.md](body-regions.md)。

人体模板commons-neutral-v1/4.0.0与geometryId不变，只修订regionSetId为commons-blank-cc0-v1-ui-regions-2。body-regions-v15.ts保留原区域1历史快照，不参与当前模型。未来若持久化依赖粗区域几何，须绑定regionSetId，不能仅凭同ID或人体模板版本重解释旧数据；当前选择/调试均会话内，不存在需自动迁移的已保存标注。正式医学图谱、HTTP API及后端不变。

高亮20%透明填色，1 CSS px圆角实线，描边除以viewport.scale；裁切与状态恢复沿用save/restore。没有Path2D、DOM或曲线命中分叉，也不新增页面或区域编辑器。独立Shapely整体验证与源图参考点/绘图命令测试分开执行，真实微信显示与触摸验证另行记账。


## 11. V1交付基线与V2规划边界

用户接受与技术验证分开，收尾/未验事项仍由task记账；不再改人体或布局。当前annotate四文件和路由已存在但业务占位，lesion-editor只有.gitkeep；App({})无统一会话，body-canvas没有病灶层/annotationpoint，pointInOutline也不是完整多边形校验器。

[V2集中计划](v2-plan.md)拟采用唯一内存会话、已有annotate页及同一个Canvas/ViewportTransform，显式隔离选择/草稿/调试/只读输入；入口粗区仅导航和初始focus，不裁切病灶。会话/类型/标注图层/整片校验均是待实现任务，不能称作当前架构已具备。V2不调用评估，不借result占位页展示假节段；完整包含校验与真实触点是相应阶段门槛。未来V4接口适配另定，本轮不改API或后端。

## 12. V2 实际架构（2026-10-23）

前节V2规划和前面的占位描述保留为历史，当前实际关系如下：select有效入口 → annotationSession.open → 路由sessionId → annotate.read/dispatch → body-canvas只读显示。复核也在annotate，不进入result、不调用评估。

`state/annotation-session.ts`的导出单例为唯一权威内存，所有动作原子更新revision；失败保持原快照，返回的点/数组递归冻结。类构造器供独立测试，运行时仅一个实例。会话绑定templateId/templateVersion/geometryId/regionSetId；每面completed/draft/selectedId/focusRegionId独立，最多一份活动草稿。页面setData和Canvas props只是派生快照，不维护第二个可独立变更的数组。

Canvas新增interactionMode(select/draw/readonly)和annotation层。优先级为blocked → debug → draw → select/readonly。V1 focused普通点击继续忽略，V2 focused允许绘制。touch继续readTouch、新rect、probeTouch和原逆变换；V2再用严格人体点检查发annotationpoint(sessionId/revision/basis/view/status/normalized)。页面、会话、组件generation/sequence共同拒绝迟到、错版、错面、滑动、多指及重复end。

render恢复CSS空间后调用lesion-render，再画调试十字。人体与标注共享同一个实际viewport，标注只调用原normalizedToCanvas；DPR仍只用于物理Canvas绝对变换。完成填充→选中强调→开放草稿/顶点→调试，线宽和3.2 CSS px顶点半径固定。不以人体clip掩盖非法填充。

annotation-geometry为纯TypeScript：有限/范围/点数/重复/回折/非相邻接触/自交/退化后，以所有人体边界交点切分每条标注边，验证每一个拓扑区间，含最后闭合边；不是固定步长采样。边完整包含后另排除被包围的完整人体孔洞。支持有效、不相交的简单人体部分及其孔洞；当前源图每面一个无孔简单外环，由独立Shapely审核前提并对照covers。未来有孔/多部分的模板必须如实供给BodyGeometry并审核，不能复用单外环适配来抹去孔洞。

归一化长度数值误差1e-12、面积退化1e-10，均不等于8 CSS px手势阈值或旧0.25逻辑单位触摸判断。无吸附/重排/裁切/凸包；completed显式闭合，草稿开放。每片128点/每面20片，重叠保留独立对象，不计算医学统计。

原生确认期间隐藏Canvas并阻止输入。确认捕获revision/页面生命周期序号，隐藏或卸载后回调失效。数据逐操作同步，onUnload不做“最后保存”。运行内返回可恢复，进程终止/重启/编译不保证恢复；无storage、网络或患者身份字段。实际验证见task及证据。

## 13. V4 实际架构（2026-10-26）

本节更新V2“结果页占位/不调用接口”的历史结论。V2会话仍唯一权威。annotate复核 → result(sessionId) → matchingSession不可变快照 → API service → FastAPI边界 → 规范图谱loader → Shapely纯matcher → 已校验响应 → 同一body-canvas。图谱先画、人工标注后画，沿用原归一化/视口/DPR公式，无另一套Canvas或前端面积算法。

matchingSession的几何key包含会话ID、模板身份、图谱/人体校验、每片ID/view/ring。排除显示revision、缩放、当前查看面与选中状态；修改/新增/删除/清空/换版导致response与overlay失效。递增请求序号与返回时重新核对key共同阻止迟到响应；退出页面停止接收结果。首次进入自动请求，失效或错误时显式重新计算/重试。未完成草稿由V2处理，匹配拒绝草稿，不静默省略。

后端不依赖HTTP的evaluate核心同样由stdin CLI调用。固定注册表禁止任意路径输入；每次校验规范JSON及人体同源导出，无缓存陈旧风险。网关在JSON解析前执行环境闸门与实际字节上限。前后端独立环境守卫；图谱mappingEnabled=false与medicalReviewStatus=pending不变。细节见[V4](v4-matching.md)。

## 14. V4 交互精简与结果联动（2026-10-26）

annotate有效闭合立即以lesion-render单次半透明填充显示原多边形。复核的“计算”只导航一次；result首个onShow在非ready、非loading时调用既有matchingSession.calculate，包含编辑后的stale状态。ready修订直接复用，返回入口显示“查看结果”。页面隐藏/卸载仍取消接收迟到响应；无新API字段、无新会话存储。

结果展示由matching-presentation将当前面/当前scope响应candidate.region_ids精确映射到ATLAS_REGIONS；同时校验view/侧别/type/label，缺少任意片区则清除全部高亮并报错。默认selected为空时取全部候选实例的去重集合，选择时取单个候选的完整几何，原MultiPolygon、孔洞和颜色不改。result成功只画病灶轮廓；等待/失败保留病灶填充。两种填充职责独立，图谱不是病灶本身。

标签保留响应原序，布局副本按几何纵向范围中点排序（不是连线锚点或命中位置）。正面人体左侧位于屏幕右侧，背面同侧；未知侧别独立分组。复用body-canvas实际viewport投影文字高度，防碰撞后空间不足时使用固定44px行与独立滚动，不删除低覆盖候选。不绘制连线，因此不存在错误内部锚点或侧栏滚动后残留连线。

点击标签不跳动视野；“放大当前”才使用原atlasFocusBounds。再次点当前标签与“显示全部”调用同一方法并回到全身；“全身”仅清focus而保留选择。切视图/统计scope默认全量并清focus。显示操作不请求后端、不改变标注几何。详细约束及验证见[v4-interaction.md](v4-interaction.md)。

## 15. V4 连续操作与渲染生命周期（2026-10-26～27）

前两节为历史。当前annotate承载编辑、复核、计算与结果，保持同一个body-canvas节点。result只保留旧链接到annotate的兼容redirect，没有第二套画布。onLoad/onShow不自动计算；显式计算使用既有matchingSession，ready缓存直接显示。V2 review不再清focus，review允许展示focus动作；同面scope/单区/全部/编辑保持视口，仅显式全身或放大改变。

页面一次准备有效响应的实例、标签、侧别、scope、覆盖信息与病灶显示方式；changedPatch避免把未变化几何重复送入setData。viewportchange提交实际视口布局，sceneready核对sceneId/view后显示标签。固定容器与预留侧栏避免结果挤压人体。说明通过interactionBlocked隐藏原生像素层，节点/缓存保留；弹层关闭恢复同场景，不泄漏触摸到画点。

body-canvas Runtime在WeakMap持有节点、缓存ctx、measurement、模板/view/path图片、原视口及OverlayTransition；初次、show/resize或layoutRevision变更测量，属性变化复用测量。加载完成前不清屏，每帧同步drawBody完成全栈图层。只改透明度，微信Canvas帧调度可取消；无能力/减少动态直接终态。跨view/会话/响应/scope不延用错误实例；同结果选择从现有透明度接续。generation/serial阻止过期帧；隐藏、销毁、输入阻塞清理回调或禁止交互，无无限循环和每帧setData。

matching-presentation缓存不可变候选映射；atlas-render缓存区域在最近viewport的投影点。缓存不修改原geometry、region_ids或比例。API service计量networkMs，页面另计请求与校验总时长/准备时长，组件计首帧、首个非零覆盖帧、完成帧/过渡时长及资源/上下文/测量次数。指标是阶段计时，不能相加推导FPS。完整[实现说明](v4-experience.md)与[分层证据](validation-records/v4-experience/report.md)。

## 16. V5.1 可选照片分割（2026-10-27）

AI现为独立Python模块，依赖位于ai/.venv，不导入核心FastAPI或小程序。输入本地照片和照片像素提示，统一EXIF后由固定MobileSAM推理，生成原尺寸Mask、透明层和照片归一化MultiPolygon。像素格并集保留多片/孔洞；失败不返回假成功。结果待人工确认，不含人体view/template或节段。本轮无HTTP接口、照片上传及配准；[数据契约、真实实验和后续边界](v5-ai-segmentation.md)取代历史“AI仅V7占位”的当前描述，历史记录仍保留。

## 17. V5.2 可选临时照片服务（2026-10-27）

本节覆盖上节无HTTP的历史状态。select保留原手动流程并新增ai-annotate；入口只传部位/view上下文，不创建或改写V2会话。AIPhotoFlow以照片代次、提示revision、request_id和预览serial拒绝旧上传、旧推理、旧图片加载及旧确认。确认中锁住候选切换；新照片/提示会清除旧结果。照片页退出清理会话；不持久化、不调用evaluate、不根据部位生成神经标签。

photo-canvas独立原生Canvas 2D。方向统一后的照片和透明Mask共用一个等比contain矩形，留白不接收提示，DPR仅影响backing store。触摸局部CSS坐标除以照片显示尺寸后归一化，服务端乘已定向原尺寸再交给V5.1。Mask返回原尺寸，显示无需猜测模型内部resize。加载完成回报经nextTick提交，避免父子observer递归更新；旧source/mask回报不得启用确认。

FastAPI仅启动轻量可选适配器。门禁/实际字节上限在解析前，AI依赖在需要时导入；无Torch也能启动核心。生命周期管理临时会话与30秒扫除任务；首次推理加载缓存模型，全局一工作槽避免Predictor并发污染，忙时429而不无限排队。45秒超时后使请求失效；不能强杀正在运行的PyTorch线程，但线程完成后不得发布旧结果、不得复活已删除会话。

上传→EXIF统一/去元数据→原尺寸PNG→提示推理→真实Mask/alpha/原V5.1 MultiPolygon→候选摘要→用户选择→完整确认快照。预览仅用alpha，几何只在确认响应返回。Mask不裁到框内、不删碎片或填洞。超过8MiB轮廓记录时明确失败，不有损截断。照片坐标与人体类型分开，V5.3才设计人工变换及版本绑定。安全限制见[隐私增量](privacy.md#9-v52-临时照片的实际生命周期)；完整契约见[API](api.md)。

### V5.2 极简前端（2026-10-28）

ai-annotate按上传/圈选/处理中/结果/精调/确认切换控件；原生photo-canvas的有效touchend交给AIPhotoFlow.selectBox自动推理。归一化与屏幕最小框双重门槛、同框去重、一在途加最新待处理项；reset/cancel/replace清队列，旧请求只能结束不能发布。精调点不自动推理，保留显式重新识别；所有路径最终进入原confirmed-photo-segmentation-v1。

候选在切换下载期间保留已画画面并锁定确认；photo-canvas直到原图/新alpha均就绪才clear并同步完成一帧。原图/alpha始终共用contain矩形；showPrompts只控制框/点装饰，不改Mask。渲染确认仍nextTick、核对source/mask，不让旧画面确认新候选。后台接口、令牌、TTL、模型、几何导出未改。[变更和验证](validation-records/v5.2-simple/report.md)。

## 18. V5.3 照片轮廓人工放置（2026-10-31）

前节“V5.3后续设计”按本轮授权推进。数据方向为 `AIPhotoFlow.confirmed`（只读照片坐标）→ 运行内交接ID和放置草稿 → 同一现有人体视口上的贴片编辑 → 完整几何/人体包含校验 → `annotationSession` 原子追加。页面和Canvas只持有派生显示数据；V2单例继续是正式人体标注唯一权威，不新增病例数据库或第二套正式集合。

放置使用独立 `placementTransform`，先将照片归一化顶点乘方向统一后的照片尺寸，再围绕共同锚点等比缩放、旋转、平移到人体逻辑空间，最后归一化。全部片区及孔洞执行同一个相似变换。画布缩放、复位、DPR和尺寸只影响现有viewport显示；主体资源及视口公式不变。有限的画布外草稿仍可预览并提示，但最终必须通过完整人体面包含检查。

人体底图与已存标注复用body-canvas，拖动草稿使用独立透明贴片层；显示与输入职责分开，编辑贴片不会触发V1粗部位选择或V2加点。人体底图仅在聚焦/布局等需要时重绘；源照片几何先准备一次，拖动不重新解析Mask或发送请求。页面退场、换源、TTL和控制器lease拒绝旧回调；未确认离开需要明确处理当前草稿。

原V2手工简单环保留兼容。AI正式标注增加完整MultiPolygon和来源/放置信息，绘制及选择必须尊重多个外环与孔环，不能用首环代表整体。原匹配缓存依赖几何身份而失效；V4当前简单环请求入口明确阻止AI放置几何进入，直至V5.4完成无损契约适配，后端算法及神经图谱本轮不改。

上一AI页由navigateTo保留，继续管理原图片、Mask和30分钟临时期限；返回照片可重新确认。放置草稿只引用当前有效源，原页换图/清理/过期会令未提交草稿失效；正式保存的人体几何独立于原文件期限，在本次V2运行内继续可读。详细合同、限制及验证见[V5.3说明](v5-placement.md)，唯一状态以task.md为准。

## 19. V5.4 统一人体几何匹配（2026-11-01）

本节覆盖上一阶段“AI 放置不能匹配”的历史边界。V2 CompletedPolygon 的完整 geometry 经白名单适配进入原 evaluate；后端同一 matcher 仅替换输入几何读取器，使 Polygon/MultiPolygon/孔洞与旧 vertices 都进入原 Shapely 交集/并集公式。来源枚举不影响计算。模板/图谱/内容摘要与正背隔离不变。

placement 页原子提交后进入复核并调用既有 matchingSession，失败重试不再提交。成功的一次性显示交接保留实际 viewport 到 annotate，复用 V4 全量覆盖、侧栏、单区和过渡；显示交接不保存业务几何。重新编辑仅改变独立草稿，确认时以原 placementId 比较替换并保持 annotation ID。完整 geometry 与新 placementId 纳入匹配摘要；旧响应不能覆盖新正式几何。原照片过期不影响正式人体匹配，不上传照片到 evaluate。详见 [V5.4](v5-ai-integration.md)。

### V5 分割质量专项增量（2026-11-01）

`ai/inference/local_regions.py`仅包装既有缓存MobileSAM，负责局部提示/整数回填；`ai/postprocessing/quality.py`只解释与排序候选；`brush.py`只重放用户照片像素操作。临时服务保留原预测+每候选最新修订；`/edit`更新真实Mask、alpha和既有多边形输出。小程序只提交完整笔画历史并等待同照片/候选/修订的真实预览，不用显示涂层代替几何。

最终确认仍是photo_oriented_normalized_v1，附可追溯correction元信息。原V5.3独立相似变换与V2唯一人体会话、V5.4只发送body geometry的接口边界均不变；原始照片/笔画不进入神经匹配。具体限额/重试在[API](api.md)，实验而非临床保证在[专项记录](validation-records/v5-oversegmentation/report.md)。

## 2026-11-01 独立受控云端部署

现有腾讯云增加独立`/srv/dermatome-mapper`、root只读代码/模型/venv、低权限dermatome用户、runtime/logs、`dermatome.service`回环8001，单worker/模型缓存/单推理/1线程，1CPU/1536MiB硬限制。原acupuncture/8000/Nginx完全保留。受控访问门在解析体前校验摘要凭据和限频，AI仍有会话能力令牌；照片不作静态文件公开。

仅controlled模式对临时会话原子快照，保存令牌摘要和照片空间原始结果，停启不删除有效数据；取消或TTL清理。停止主服务时独立cleanup timer继续清理过期照片，不加载模型。V2正式标注仍以小程序annotationSession为权威；人体/图谱/匹配公式和医审状态不变。

小程序受控测试模式只在develop/devtools允许，凭据由用户输入仅留内存，明确通过本机18001 SSH通道；不改默认本机8000和真机HTTPS门禁。暂无授权新域名，未改Nginx。当前部署与真实性边界见[部署报告](tencent-cloud-deployment.md)，后续独立域名/微信平台配置另行实施。

## P4 体验版能力与短时邀请访问（2026-11-01）

environment.ts统一develop/trial/release/unknown能力。trial业务开放、调试隐藏，release/unknown在线能力关闭；body/manual原离线能力保留。servers.ts区分trial/release HTTPS地址，无有效授权主机时失败，不回退HTTP或本机。原api.ts保留develop模拟器配置。当前无B域名，trialBaseUrl有意为空，尚不具备手机连接条件。

trial-access前端只在内存管理1小时Bearer，用一次性邀请开通；所有网络封装复用它，迟到的401/开通回复不能破坏新会话。服务端TrialAccess用私有原子摘要状态与文件锁，支持SSH管理员一次性签发、消费、防重放、固定失效与撤销；AI会话增加owner_id并同时校验照片能力令牌。不是微信身份认证，无数据库/外部AI/新模型。人体、MultiPolygon、V2权威会话与V4结果身份不改。

当前后端已独立更新，真实trial测试替身→云端HTTP通过；HTTPS与手机未验证。原针灸服务/证书/路由保持不变。实现、安全边界与人工准备见[wechat-trial-integration.md](wechat-trial-integration.md)。

## V6.1 独立手掌视图（2026-11-04）

全身 BodyView 与 AnnotationSession 的 front/back 不变。新增 PalmView、SurfaceView 和类型默认参数；palm-models 注册表提供 commons-palm-v1/1.1.0、440×700、独立皮肤轮廓及图谱身份。PalmSessionStore 分开拥有左右掌数据，不写全身权威会话，不改变既有全身统计。

人工动作复用从 V2 提取的 editManualView；完整包含、自交、数量限制仍由原几何函数执行。手掌 Canvas 复用坐标、触摸读取、病灶绘制及 P6 冻结轮廓索引；异步取点用 session/revision/view/layout 防旧草稿回写。匹配复用原 API/响应核对、标签布局与 Shapely/P6 数学，只有图谱加载按固定身份分派。当前掌侧边界 BLOCKED，前端不能发计算，后端 409 ATLAS_NOT_READY；非成功的空匹配。

V5 AI 放置仍以全身模板为目标，没有扩展手掌 AI，也没有改变照片空间、变换、鉴权或正式发布门禁。源文件、配准缺口与验收见 [局部视图说明](v6-special-body-views.md)。本地代码完成不代表云端或微信已更新。
