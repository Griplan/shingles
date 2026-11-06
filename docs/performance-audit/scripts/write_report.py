from pathlib import Path
import json,statistics
ROOT=Path(__file__).resolve().parents[3];D=ROOT/'docs/performance-audit';E=D/'evidence';S=json.loads((E/'summary.json').read_text())
def write(name,text): (D/name).write_text(text.strip()+'\n')
def fmt(s):return f"{s['median_ms']:.2f}（{s['min_ms']:.2f}–{s['max_ms']:.2f}，n={s['n']}）"
def placement(n,m,stage,w=375,exit=False):return S['placement'][f'{n}/{m}/{w}/{exit}/{stage}']
def table(headers,rows):return '| '+' | '.join(headers)+' |\n|'+'|'.join(['---']*len(headers))+'|\n'+'\n'.join('| '+' | '.join(map(str,r))+' |' for r in rows)
summaryrows=[['区域命中 / 聚焦',f"{S['frontend']['REGION_HIT_TEST']['median_ms']:.3f} / {S['frontend']['REGION_FOCUS']['median_ms']:.3f}",'Node 纯函数，100次；非触屏延迟'],['2000顶点多片：松手',fmt(placement(2000,True,'drag-end-validation')),'Node 同步完整几何检查'],['2000顶点多片：确认保存',fmt(placement(2000,True,'confirm')),'Node 真实保存；隔离网络'],['拖动中退出页面',fmt(placement(2000,True,'exit-during-drag',exit=True)),'Node onHide 仍同步完成校验'],['本机单片 / 5片匹配',f"{S['backend']['1']['total']['median_ms']:.2f} / {S['backend']['5']['total']['median_ms']:.2f}",'M4 CPU，分别10次'],['云端单片匹配','332.33 / 208.30 / 216.56','实际公网HTTP，3次，非手机'],['本机模型加载',fmt(S['ai']['load']),'3个新进程；不清磁盘缓存'],['本机 AI 热请求',fmt(S['ai']['warm']),'M4 CPU/4线程，9次'],['云端 AI 请求','3217.47 / 3199.26','实际预训练模型，2次串行'],['照片上传 / Mask下载','149.01 / 12.58','公网HTTP各1次，非纯网络时间'],['手机首屏、FPS、原生画布、完整业务总延迟','NOT_MEASURED / NOT_RUN','工具报 noWindowsAvailable，无真机数据']]
write('阅读指南.md',f'''# P5 全链路性能审计

审计日期：2026-11-03。唯一进度台账：[task.md](../../task.md)。本轮只增加独立测量与文档；没有实施优化或改变生产限制。

已证实的主要耗时来自三处：**人体放置结束后的同步完整几何检查、匹配过程中重复构造整图并集、同一照片与裁片重复提示时重跑图像编码器**。连续移动的贴片已有位图缓存与单帧合并，不能再把“每次拖动重算全部顶点”当作当前原因。

这些是本机与云端可复现的计算热点，不等于已证实手机掉帧的完整原因。真实微信性能面板无法操作，真机 FPS、图片解码、渲染层通信及端到端展示延迟未测量。没有宣称60 FPS或任何优化倍数。

## 关键耗时

单位毫秒，括号为范围；样本少于20次不报告P95。不同设备的数字不能相减或拼接成一次用户流程。

{table(['操作','实测耗时','证据层级'],summaryrows)}

## 报告导航

1. [全链路调用与测量边界](01-全链路调用与测量边界.md)：A～I真实调用图、计时和证据口径。
2. [前端交互与数据更新](02-前端交互与数据更新.md)：点击、手工标注、放置、setData。
3. [画布渲染与资源缓存](03-画布渲染与资源缓存.md)：初始化、图片、图谱、照片交互与动画。
4. [AI推理与图像处理](04-AI推理与图像处理.md)：冷/热、编码/解码、后处理与上传。
5. [后端网络与云端资源](05-后端网络与云端资源.md)：Shapely、公网请求、资源保护。
6. [内存与页面生命周期](06-内存与页面生命周期.md)：重入、取消、缓存与限制。
7. [瓶颈清单与证据分级](07-瓶颈清单与证据分级.md)：A确认/B可疑/C理论、P0/P1/P2。
8. [最小优化实施计划](08-最小优化实施计划.md)：前三项、风险、回归与回滚。
9. [测量方法与复现记录](09-测量方法与复现记录.md)：脚本、命令、失败记录、未验证项目。

## 交付与限制

前端测试 **298通过**；后端和AI测试 **180通过、7条既有依赖警告**；TypeScript通过。[原始证据索引](evidence/summary.json)。161个受保护的业务/数据/资源文件哈希均未变化。没有改模型权重、人体、图谱、匹配公式、业务页面、生产配置或服务启动状态，没有提交或推送Git。

云端测试仅3次合成单片匹配、2次公开授权图片推理，串行且每次前检查原服务健康。本轮临时照片与访问会话已删除/撤销204。既有公网HTTP入口仍按原配置运行；未新开入口，未读取或输出密钥、患者数据。

**下一轮优先做几何校验的等价加速和后端整图并集复用；同图编码缓存需同时完成隔离、容量和失效设计。** 手机帧数据补齐后再决定图谱静态层/渲染架构调整。
''')
write('01-全链路调用与测量边界.md','''# 全链路调用与测量边界

## 实际调用关系

```mermaid
flowchart TD
  A[首页 index] --> B[选择 select / body-canvas]
  B --> C[手工 annotate / annotationSession]
  B --> D[AI ai-annotate / AIPhotoFlow]
  D --> E[photoTransport: 创建会话 上传 下载定向照片]
  E --> F[框选完成 / selectBox / runSegment]
  F --> G[FastAPI AI route / asyncio.to_thread]
  G --> H[AISessions 单推理锁 / 常驻 MobileSAM]
  H --> I[裁片 图像编码 提示解码 原图Mask 多边形 PNG]
  I --> J[候选下载 人工确认]
  J --> K[placementSession.open / 人体放置页]
  K --> L[placement-overlay / 位图仿射预览]
  L --> M[松手或滑杆结束 / 完整几何校验]
  M --> N[confirmPosition / V2原子保存]
  C --> O[matchingSession.calculate]
  N --> O
  O --> P[wx.request / evaluate]
  P --> Q[Nginx / FastAPI线程池 / load_dataset]
  Q --> R[annotation_geometry / candidates_for / coverage]
  R --> S[响应校验 / presentation / placeLabels]
  S --> T[body-canvas / drawAtlas / OverlayTransition]
```

## A～I路径逐项状态

| 路径 | 当前实际行为 | 已测部分 | 仍未测部分 |
|---|---|---|---|
| A 启动 | app.json七路由；body-canvas ready→节点测量→两张图片缓存→fitViewport→drawBody | Node首次模块require、19次组件创建 | 微信JS注入、页面首屏、PNG解码、首个完整像素帧 |
| B 选部位 | touchEnd重新获取位置→probeTouch→hitTestRegion→focusViewport | 100次命中/聚焦；正反切换190次命令路径 | 触屏到高亮的原生响应 |
| C 手工标注 | dispatch add只检查点在人体内/重复/上限；close完整校验；syncSession差分setData | 10/100合法加点；500/2000隔离绘制及明确拒绝超限 | 原生桥接和实际绘制 |
| D 图谱 | atlas.generated静态模块；drawAtlas的WeakMap缓存最近视口投影；仍每帧逐路径提交 | 114实例/29756顶点；全部单区380次；动画19次命令批次 | GPU栅格、动画掉帧 |
| E 匹配 | snapshotKey→冻结快照→request→同步路由线程池→dataset→evaluate→checkedResponse→标签→Canvas | 本机20请求分段、云端3次完整HTTP；本地标签映射30次 | 单次生产请求内部分段、微信首绘/动画完成 |
| F AI | 上传时服务器解码/EXIF→PNG→客户端下载→框选→服务串行锁→局部模型→Mask/轮廓→下载候选 | 本机3次加载12次真实推理；云端2次；照片组件计数9组 | 手机读取/显示、纯网络往返、生产内部阶段、云端冷加载 |
| G 放置 | 原始照片不可变；一次位图；移动仅参数；complete再变换及验证 | 10场景×3次、320/375/430宽、单片/多片含孔 | 原生离屏兼容性、真实手势帧率 |
| H 确认并匹配 | commitPlacement重新准备来源/变换/校验后保存；refresh版本；最多一次calculate；成功导航 | 隔离真实commit；既有V5.4回归测试 | 本轮手机完整确认→结果耗时 |
| I 连续切换 | WeakMap生命周期，body/placement取消动画；已保存V2数据有意保留 | 10次body重建/GC；拖动中退出；298项前端回归 | 手机完整业务循环与长期Native内存 |

## 计时和追踪规则

新增脚本使用 `performance.now()` 或 `time.perf_counter()`，仅写阶段数值、次数、字节数、traceId、运行环境。不输出图片、标注顶点、令牌或身份。事件按操作汇总；不在每个touchmove打印日志。独立脚本不被小程序或服务导入，产品详细埋点默认关闭。

Node phase的wall_ms是测量器调用真实函数和模拟异步队列的墙钟时间，不是用户手势持续时间。RAF提供虚拟16ms调度机会，但绘制耗时用真实单调时钟；绝不能把虚拟帧间隔换算为实测FPS。Proxy绘图计数的开销也包含在Node结果里。

后端阶段 `REQUEST_JSON_PARSE / PYDANTIC_VALIDATE / ATLAS_LOAD / MATCH_BACKEND / RESPONSE_SERIALIZE` 为同一本机进程计时。嵌套的 `coverage.unary_union` 已包含在MATCH_BACKEND里，不能重复相加。AI模块hooks同理。

公网客户端的MATCH_HTTP、AI_SEGMENT_HTTP包括网络、代理、服务等待、运算及传输，不能命名为纯网络。云端响应目前不返回分段Server-Timing；已有Nginx未配置request_time/upstream_response_time。没有跨主机绝对时间相减，也未将本机后端耗时从云端HTTP时间扣除。

原有产品 `services/api.ts`、`body-canvas.ts`、`annotate.ts` 的少量开发指标使用Date.now且粒度粗，本轮不拿它们作为高精度帧数据。建议下一轮统一单调计时并用request_id串联；当前云端证据中的traceId是客户端记录标识，不能声称已实现服务端完整分布式追踪。
''')
rows=[]
for n in [10,100,500,2000]:
 for m in ([False] if n==10 else [False,True]):rows.append([n,'五片/五孔' if m else '单片',fmt(placement(n,m,'drag-end-validation')),fmt(placement(n,m,'confirm'))])
write('02-前端交互与数据更新.md',f'''# 前端交互与数据更新

## 人体放置的真实热点

{table(['总顶点','结构','松手总计 ms','确认保存总计 ms'],rows)}

每格3次、375×500 CSS、DPR2、全新会话。正式数据允许AI最多20000顶点，本轮最高2000，并未扩大上限。额外320/430宽2000多片确认中位数均约232ms；全身/聚焦切换后几何深比较相同。详见 [isolated-1](evidence/placement-isolated-1.json)、[isolated-2](evidence/placement-isolated-2.json)、[isolated-3](evidence/placement-isolated-3.json)。

2000多片连续60事件/60绘制机会合计中位数0.90ms；120事件/30机会合计1.05ms。**这些是快速循环的JS命令耗时，绝非用户拖动60帧只耗时0.9ms，更非原生FPS。** 各活动阶段完整变换/校验调用为0，cache.create为0；事件合并后30次绘制；松手才各调用一次变换/校验。

`placement.ts:66 finishAdjustment / :73 update / :102 confirmPosition` → `placement-session.ts:85 update / :100 confirm` → `annotation-session.ts:91 commitPlacement` → `placement-geometry.ts:226 validatePlacementGeometry`。定位以源码实际函数名为准；[CPU采样](evidence/placement-sampling-summary.json)热点集中于 `annotation-geometry.ts:30 locatePoint / :40 pointInBody`，完整包含性检查对每条边的端点和分段内点重复遍历人体轮廓。并非每帧生成新Mask，也不是网络导致该段延迟。

完整校验不可删除。来源拓扑、完整边包含、人体孔洞、对照几何及版本校验必须继续执行。可以评估预构建人体边索引和点定位加速、已验证只读来源的拓扑凭据，最终写入仍必须针对最终位置重新验证。

## setData实测

| 场景 | 次数 / 数据量 | 解释 |
|---|---|---|
| 2000多片初始化 | 5次 / 98088 bytes | 首次需要prepared几何；不是每帧发送 |
| 60次拖动，含开始状态 | 2次 / 80 bytes | 后续位置走组件本地参数 |
| 缩放/旋转120事件 | 每阶段1次 / 49 bytes | 快速循环小于100ms标签节流周期；不能外推真实长拖动每秒次数 |
| 松手 | 3次 / 595 bytes | 几何保留在store；页面同步标量状态 |
| 确认保存2000多片 | 4次 / 190067 bytes | 包含layer正式标注及只读来源；是低频大传输，原生桥接时间未知 |
| 手工10点＋闭合 | 11次 / 16219 bytes，总最大单次2124 | 每点更新session和layer |
| 手工100点＋闭合 | 101次 / 582948 bytes，最大10824 | 两份展示字段都含增大的草稿数据 |

计数来自实际页面函数的setData适配器，字节为JSON UTF-8估算，不是微信传输协议字节/桥接耗时。最初 `placement-1/2/3` 测试沿用了历史脚本的累计会话，包含先前已保存标注，确认时累计传输612833 bytes；这些初始记录保留，但最终表使用 `placement-isolated-*`，不能把前者当成单贴片开销。

## 手工和区域选择

合法人工上限128：10/100顶点各3次完整纯函数/会话测试；真实页面10/100各一次，并测量每次加点。500/2000只进入独立drawLesions及上限拒绝检查，不让正式页面突破限制。未发现每次加点都跑完整多边形校验：add路径只是点在人体内、重复点和上限判断，close才完整验证。

区域命中100次中位数约0.050ms，聚焦视口约0.001ms；不是当前本机CPU热点。页面加点110次中位数约0.090ms，无法据此证明慢手机桥接流畅。

结果 `presentation` 按候选数组身份+图谱+视图WeakMap缓存。30次映射首个约0.176ms，热调用中位数约0.0005ms；标签布局约0.0015ms。没有证据支持重写标签算法。`syncSession` 仍JSON.stringify比较每个patch属性；大量已保存AI来源可能扩大序列化，属于后续需真机验证的B项。

确认链路无重复Mask→Polygon；照片Mask只在AI端产生轮廓，人体端对保留的照片轮廓做相似变换。确认时一次原子commit、一次完整最终校验和版本失效；网络被明确隔离，未把本表当作“确认并计算”的端到端耗时。
''')
write('03-画布渲染与资源缓存.md','''# 画布渲染与资源缓存

## 人体和图谱

当前人体逻辑400×900，正反PNG各1200×2700，背景版本未变化。单组件ready时各创建一张正背图：9个尺寸/重复场景均测到 **1次节点测量、1次getContext、宽高各写1次、2次图片加载**。10次正背切换和20次全部/单区切换不重建Canvas或重复加载。保存/恢复绘图状态计数配对，hide后待执行帧0。原有 `profile_canvas_workflow.cjs` 也通过无clear-before-ready检查。

实际图谱：正面54实例/63片/15孔/18051顶点；背面60实例/71片/2孔/11705顶点。见 [summary](evidence/summary.json)。静态 `atlas.generated` 模块只在require首次解析；Node首次约7.83ms，不代表微信注入或下载时间。`atlas-render.ts:10 project` 缓存最近视口的投影顶点；切换视口会更新缓存，但透明度帧复用，不能说每帧重新解析整个JSON。

`drawAtlas` 仍然每帧用beginPath/moveTo/lineTo/fill/stroke提交全部当前及淡出几何。虚拟调度200ms全图→单区转场产生14次完整画布绘制、14次背景drawImage及 **255853次lineTo**；对应JS命令批次中位数约9.27ms（19场景）。这证明有重复绘图命令，**没有证明GPU或手机已经掉帧**，也不是14个真实帧的测试。

全部/单区380次命令提交中位数0.558ms；前后面190次0.091ms。计数器有自身开销；缺原生栅格和桥接，不能据此推荐立即更换Canvas架构。先补微信Performance的长任务与帧轨迹，再决定同视口静态背景或透明度层缓存。医学几何、孔洞和标签实例必须全部保留。

## 放置贴片

`components/placement-overlay/preview.ts` 将不可变照片轮廓预生成透明离屏图，保留原始完整几何。拖动/滑杆活动期通过context仿射drawImage，一次待绘制RAF；无API、无轮廓提取、无复杂人体背景重绘。比例结束时才回到精确路径绘制。离屏不可用有矢量回退，本轮Node能走缓存，但微信设备真实回退频率UNKNOWN。

缓存不是无限大：当前边长约束和留白将贴片像素面限制在最多约2048²；RGBA理论上界16MiB。两张1200×2700人体位图纯像素约24.72MiB，尚未计入Canvas backing store、平台副本/纹理。**这是尺寸推导，不是原生内存测量**。不同组件各自拥有缓存，重入会再次加载两张背景；不能用Node小图片对象模拟证明原生解码或资源释放。

## 照片框选/画笔：不同于已优化的人体贴片

[photo_profile.cjs](scripts/photo_profile.cjs) 运行原 `photo-canvas.ts`，3宽×3次。120次client坐标移动：

| 操作 | bounds查询 | 节点尺寸查询 | getContext调用 | 照片/Mask drawImage | setData | 完成提示 |
|---|---:|---:|---:|---:|---:|---:|
| 框选 | 122 | 120 | 120 | 240 | 120 | prompt 1次 |
| 擦除画笔 | 122 | 121 | 121 | 242 | 121 | stroke 1次 |

单场景Node命令循环只有数毫秒，不能量化真实微信异步查询代价。但**重复查询及全照片绘制已被计数证实**：`redraw`每次fields查询、getContext、全照片＋当前Mask绘制、重复setData空error、ready事件；无RAF合并。getContext反复调用不等于创建120个Canvas。宽高未重复写，图片未每帧解码，既有防错位和新Mask加载期间保留旧完整画面仍有效。

10次候选切换创建10张Mask图片，缓存只保留照片和当前Mask；服务层也按候选下载当前alpha。这是节省内存的选择，不能未经容量分析改成无界缓存。后续可按result_id/candidate_id/edit_revision保留最多3个临时文件，失效/退出时释放；实际收益仍需原生网络/解码测量。

## 动画与测量限制

OverlayTransition.start先cancel旧任务，从现有透明度接续；hide/detached取消。测试没有残留或递增RAF证据。200ms是产品配置时长，不是观测到的动画完成时间。既有Date.now指标低分辨率、可能受墙钟调整影响，本轮只作静态审查，不作为高精度测量依据。真实FPS、帧掉落、原生长任务、Canvas耗时：**NOT_MEASURED**。
''')
write('04-AI推理与图像处理.md',f'''# AI推理与图像处理

## 环境和固定输入

复用本地MobileSAM vit_t，源码commit `f706ad9c4eb7f219c00d9050e46328518ffb65d2`、Apache-2.0，40,728,226字节权重，SHA256以[ai-local.json](evidence/ai-local.json)的实测metadata为准。没有安装第二模型、重新下载/训练或修改模型。

本机Apple M4/macOS arm64、Python3.12.14、Torch2.5.1、CPU4线程；非MPS。固定已有公开CDC PHIL21505（700×460），来源/许可见[原AI报告](../v5-ai-segmentation.md)，单一测试图不代表医学泛化或准确率。日志不存照片、Mask、病灶顶点。3个独立进程各加载一次，首次＋3次同照片同框请求；总计3次加载/12次真实推理。首进程之外OS文件缓存未清，不称为磁盘冷缓存测试。

通过真实AISessions临时目录运行，启用相同持久化写入逻辑，目录退出即清。公开样本700×460远低于云端3MP上限，不能外推最大图像内存或推理耗时。

## 本机分段（毫秒）

{table(['阶段','中位数（范围/样本）','范围'],[['模型加载',fmt(S['ai']['load']),'含导入、校验、权重加载、eval'],['首轮请求，模型已加载',fmt(S['ai']['first']),'每个进程1次；冷用户等待还要加该进程load'],['同图同裁片后续请求',fmt(S['ai']['warm']),'真实服务segment，9次'],['图像set_image/编码',fmt(S['ai']['encode_seconds']),'模型已有计时，含resize/preprocess/encoder'],['提示/Mask解码',fmt(S['ai']['decode_seconds']),'模型已有计时，含回原尺寸'],['Mask到轮廓＋质量检查',fmt(S['ai']['polygon_seconds']),'包含3候选，不删片/填洞']])}

首进程Torch hooks细分：图像编码器409–488ms、提示编码器0.09–1.53ms、Mask解码器22.94–26.47ms；该范围仅4次首进程观测，不混作所有12次统计。编码器耗时明显占主导。`set_image`调用每次1，重复同一裁片仍重新编码。

输入文件读取约亚毫秒；首进程上传处理（方向处理、RGB、校验及定向PNG写入）29.28ms。实际segmentation接收PreparedImage，因此不二次跑EXIF，但每次服务segment仍读取定向PNG并转RGB。`_publish`首进程16.03–17.88ms，含3张Mask和3张透明PNG写盘、record JSON和session持久化；内部 `_persist`被包含，不能相加。详情见三个ai-local JSON。

## 冷/热模型、排队和重复编码

`AISessions.segment:136` 的worker Lock非阻塞；忙立即429 AI_BUSY，**没有服务端等待队列**。前端AIPhotoFlow保留一个最新提示ticket，旧响应不能覆盖新照片；不是任意排队。HTTP任务通过asyncio.to_thread隔离，超时45秒会使结果失效，但不能中止正在执行的PyTorch线程，worker会在真正返回后释放。60秒客户端timeout不表示45秒后CPU已经停止。

`MobileSAM.predict`每次set_image，finally reset_image；`local_regions.predict_regions`每个局部框依次调用，最多4框。同图同crop可安全复用的embedding目前没有缓存。模型本身常驻，只首次factory加载；本轮未发现每次请求重载40MB权重。

缓存建议只针对完全相同的校正RGB指纹、crop像素边界、预处理版本、模型版本和设备；前景点改变导致crop扩大时必须失效。单用户会话/有限条目、退出或TTL清理、串行predictor保护不可省略。不能缓存坐标已变的Mask冒充新的推理，也不能放宽人机确认。

## 云端和网络

云端同一常驻进程的两次真实请求分别3217.47/3199.26ms，均200且3候选；没有重启服务制造冷启动。第一请求前未采集ai_model_loaded字段，严格记作“当前进程请求”，第二次为热模型。云端模型加载耗时与编码/解码细分 **NOT_MEASURED**。本机M4的约0.5秒不能替代云端约3.2秒。

公网照片上传149.01ms、alpha下载12.58ms，各1次；其中包含服务处理、网络、代理，不是独立网络RTT。小程序实际上传成功后还会下载统一方向的photo.png再显示，此段未在本轮云探针测量，手机首次照片显示链路不能只按149ms报告。

12次本地推理全部完成，云端2次全部完成；没有专家Mask、不评价病灶识别准确率。进程RSS/高水位见原始记录：各时点高水位约746–922MiB，包含Torch导入、分配缓存及中间张量；不是38.84MiB权重所代表的内存，也不代表云端峰值。没有长时压测或最大图片测试。
''')
write('05-后端网络与云端资源.md',f'''# 后端网络与云端资源

## 本机FastAPI核心路径

同步evaluate路由由FastAPI同步工作线程执行；不因用了框架而消除CPU成本。每请求调用load_dataset，重新读7个图谱输入、manifest、人体导出和2份来源代码并校验哈希，再构造116个图谱/人体几何。没有STRtree或版本缓存。这里的校验承担版本/来源保护，不能为性能直接移除。

{table(['本机阶段','单片，n=10','5个标注对象，n=10'],[[k,fmt(S['backend']['1'][k]),fmt(S['backend']['5'][k])] for k in ['PYDANTIC_VALIDATE','ATLAS_LOAD','MATCH_BACKEND','RESPONSE_SERIALIZE','total','coverage_union']])}

测试5个标注对象有意使用同一合成小三角形，验证重复覆盖/并集成本；不是5个临床病例或5片独立诊断。`coverage_union`为MATCH_BACKEND的嵌套阶段，不能再加到总计。

关键根因：`dermatome_matcher.py:26 coverage`中每次 `unary_union([g for _,g in candidates])`重新并合整个视图图谱。单片调用2次（单片＋汇总），5片调用6次；累计中位42.94/129.21ms。候选分组中54次小union合计仅约0.75ms，不能把所有union统称同样昂贵。[cProfile](evidence/backend-cprofile-detailed.txt)支持这一判断。

建议优先在一次evaluate中按view只计算一次整图并集，显式传给coverage；这是复用同样几何中间结果，不能改变比例、容差、候选排序。跨请求dataset缓存需额外版本/哈希失效设计，风险高于请求内复用。Pydantic和JSON不应成为当前首要优化目标。

## 真实公网请求

[cloud-http.json](evidence/cloud-http.json)：3个串行单片合成匹配332.33/208.30/216.56ms（响应4720bytes）；2个串行真实分割3217.47/3199.26ms（各2207bytes），照片上传149.01ms，Mask下载3636bytes/12.58ms。合法临时会话，不记录token；本次照片删除和访问撤销均204。每项之前检查针灸health/ready，不并发推理。

当前HTTP公网测试入口只用于既有公开授权样本，不上传患者图片。两次AI、三次匹配不是压力测试，不能推断多人吞吐或手机移动网络表现。没有从云端HTTP减去本机CPU耗时来猜网络时间。

Nginx只读检查未发现显式log_format中的request_time/upstream_response_time；未输出完整配置或访问日志，也未添加生产埋点。Nginx/上传读解码/生产Pydantic等独立耗时仍未知。后续可经单独任务添加安全Server-Timing或汇总直方图，但不打印原请求内容。

## 腾讯云本轮状态

重新SSH核对：Ubuntu24.04.4 LTS，AMD EPYC 7K62，4逻辑CPU，x86_64；内存3812564KiB≈3.64GiB，磁盘约39.26GiB，剩余约28.36GiB。观察开始load三值0.00。检查快照见[baseline](evidence/server-baseline.json)和[after](evidence/server-after.json)。

| 项目 | 智枢智教 | 智络智绘 |
|---|---|---|
| 状态/PID前后 | active / 3480408未变 | active / 3980765未变 |
| 后端端口 | 127.0.0.1:8000 | 127.0.0.1:8001 |
| 进程RSS末次 | 269.53MiB | 662.02MiB |
| cgroup memory.current | 151.70MiB | 546.97MiB |
| 重启计数 | 0→0 | 0→0 |
| CPU限制 | infinity | cpu.max=100000 100000，即1核配额 |
| 内存限制 | infinity | High1280MiB / Max1536MiB / SwapMax0 |

RSS包含进程映射页，cgroup记账方式不同，二者不能直接相减或当作冲突；峰值777093120bytes是B服务启动以来memory.peak，不是本轮采样瞬时峰值。B MainPID无子进程、3线程，支持当前单服务进程；没有为了性能启动多个模型worker。

165.79秒观察窗：主机available约2.22GiB，swap使用524KiB前后不变；A/B memory.events中high/max/oom/oom_kill增量0，B memory.pressure为0。B总CPU约增加7.43秒，nr_throttled增加8，throttled_usec增加8848（8.848ms）。这些窗口包含背景活动，不能全部归因于测试请求。

**目前证据不支持“CPUQuota严重节流导致3秒推理”或“内存不足导致当前卡顿”。** 单核配额是容量约束，但本次总限流增量很小；没有解除它的理由。不能据此证明未来大图、多用户或与针灸视觉同时运行绝对安全。保持原服务优先、单推理和上传限制。

/proc/net/dev在每轮快照取两次，间隔约3秒，可计算接口吞吐；大部分为SSH和背景流量，未同步包级跟踪，不能换算业务网络瓶颈。原服务各次health/ready均200（首次误用路径得到HTTPError，修正后记录保留）；本轮无服务重启、部署、配额/防火墙/Nginx变更。
''')
write('06-内存与页面生命周期.md','''# 内存与页面生命周期

## 本轮检查结果

body-canvas WeakMap持有节点、图片和动画；show要求测量，hide使generation/probeSequence失效、取消transition并清显示实例；detached释放pending解析和runtime。placement-overlay取消RAF/回退timer、手势序列、preview.dispose；页面清interval、标签timer、owner并使旧回调失效。

10次新body组件进入/切换/动画/退出，GC后Node heap 13.85→13.89MB，期间回落，RSS111.12→112.48MB（十进制）；没有与次数线性增长的证据。仍不能称“无内存泄漏”：适配器图片是小对象、不含真实PNG/Canvas/GPU内存，V2正式标注保留是正常业务内存。

AI原始确认轮廓在V2来源中保留，正式人体几何另存，这为回编辑和可追溯所需；随着保存对象数增长内存/序列化自然增长。最初累计会话的性能记录保留了这一放大效应，最终隔离样本另建，不将有意保留标注误判为泄漏。

## 发现的退出停顿

2000顶点五片五孔在拖动中退出，`placement.ts onHide/onUnload → finishAdjustment → complete update → validatePlacementGeometry`：3次207.43/209.45/212.01ms。完成后队列中RAF为0，未发现后台残留循环；**停止不流畅可能是退出前同步验算，不是动画泄漏**。该因果限于Node函数执行，手机返回体验仍需实测。

可评估离开时保存变换参数与“待验”状态，返回后再校验；若最终确认必须先执行完整校验，且历史会话/失效保护不可绕过。本轮没有改变退出语义。此优化需单独验证失效来源、重新进入、直接关闭和请求迟到。

## 照片页与资源

photo-canvas无body/placement那样的visible状态与hide回调，redraw依靠serial/detached防止旧图覆盖。AI页面onUnload会删除流程映射、清定时器、取消临时会话；服务器TTL最终兜底。隐藏而未销毁的照片页完成异步绘制是否有实质成本属于B项，未观测到无限循环，不能宣称泄漏。

候选图片缓存只有原图＋当前alpha；services.ai的downloads集合通过forget/unlink删除临时文件。老请求返回由generation/revision/result_id隔离；不代表已经物理取消服务器CPU运算。取消/超时后worker是否仍占用到完成，需要按真实请求时长分析；本轮没有故意触发45秒超时或生产忙碌注入。

## 真实设备补测

- 同一公开图，记录进入AI→确认→放置→计算→返回，连续10轮；标注保存数固定，避免业务保留造成假泄漏。
- 微信Performance/内存工具记录JS heap、Native、Canvas节点、图片纹理、长任务和回收点；至少冷启动1轮和热循环，标明手机型号/系统/基础库/网络。
- 隐藏/退出中途快速返回，确认0旧帧/旧Mask覆盖、无重复API；不要记录令牌或照片内容。
- 原生Canvas/图片资源峰值、手机RSS、长时间趋势：本轮NOT_MEASURED。手机完整循环NOT_RUN。
''')
write('07-瓶颈清单与证据分级.md','''# 瓶颈清单与证据分级

A＝当前实现的耗时/重复工作已实测确认；B＝实现和计数支持，但用户可感知的因果还需原生测量；C＝理论方向。A不自动等于手机根因已全部证明。优先级按当前可复现影响，不凑数量。

## P0

本轮未复现崩溃、重复请求失控、不可恢复UI阻塞、持续泄漏、OOM或原针灸服务异常。**没有已确认的P0事故。** 大顶点同步任务值得尽快处理，但不能把2千顶点Node结果外推成所有手机必然失去响应。

## P1-01：放置结束与确认同步校验（A）

- 现象/路径：2000顶点多片含孔，连续移动后松手/结束滑杆/确认，或移动中退出。
- 环境/频率：M4 Node24、生产JS＋wx适配器，375宽，3/3次；额外320/430宽一致趋势。
- 实测：松手206.92–212.94ms；确认233.40–239.73ms；退出207.43–212.01ms。
- 位置：`pages/placement/placement.ts finishAdjustment/update/confirmPosition`；`utils/placement-geometry.ts validatePlacementGeometry:226`；`utils/annotation-geometry.ts locatePoint:30/pointInBody:40`。
- 根因：每个边区间见证点都进行完整人体多边形点定位，CPU采样同样集中在此；来源/人体拓扑也在最终提交重复检查。
- 排除：活动帧几何变换/包含校验0次、位图重建0次、网络0次；未发现多个RAF。
- 证据：[三轮隔离](evidence/placement-isolated-1.json)、[汇总](evidence/summary.json)、[CPU采样](evidence/placement-sampling-summary.json)。高置信计算热点；实际手机停顿时长未知。
- 建议：等价加速人体边/点索引和避免不必要的原始拓扑重复分析；最终位置完整校验保留。风险：跨空白、孔洞/边界容差判断改变。必须与现有Shapely oracle和完整几何测试对照。

## P1-02：每个coverage重建整图并集（A）

- 现象：标注片数增加时计算等待增长；本机1片73ms左右、5对象165ms左右，非网络。
- 路径/频率：`evaluate→coverage`；固定合成三角形1/5对象各10次，全部复现。
- 位置：`backend/app/services/dermatome_matcher.py:26`，同视图相同候选集合重复union。
- 实测：1对象2次、5对象6次整图union，中位42.94/129.21ms；5对象MATCH_BACKEND中位137.81ms。
- 排除：Pydantic约0.02ms、响应序列化约0.02–0.04ms，并非主耗时；不需先重写所有匹配逻辑。
- 证据：[分段计时](evidence/backend-local-detailed.json)、[cProfile](evidence/backend-cprofile-detailed.txt)。高置信重复计算。
- 建议：一次evaluate每view只构造一次并集，传给所有coverage。风险：正反面和不同版本缓存混用。先请求内复用，再考虑跨请求缓存；逐字段响应等价和全部覆盖/未覆盖校验不得减少。

## P1-03：同照片/同裁片重复提示仍重跑编码（A，收益待测）

- 现象：细化提示仍需要接近完整首次推理的等待。
- 路径/频率：`MobileSAM.predict→set_image→image_encoder`，3进程共9次重复提示全部出现；云端2次约3.20秒。
- 位置：`ai/inference/mobile_sam.py:69 predict`及finally reset_image；`ai/inference/local_regions.py:17 predict_regions`。
- 实测：M4热请求512.84–588.61ms；编码409.11–482.88ms，解码24.46–28.81ms。云端内部阶段未测，不套M4比例。
- 排除：模型实例每进程只加载一次；没有无界排队，忙时429。
- 证据：三个ai-local JSON与cloud-http。高置信重复编码；缓存实际加速比例尚未实测。
- 建议：有限、会话隔离、严格键的image embedding复用。风险：更换照片/crop/设备后复用过期特征、泄漏跨用户数据、统一predictor状态竞争、内存峰值增加。

## P1-04：照片框选与笔刷每事件查询和整图绘制（A计数、B卡顿）

- 现象：照片页拖框/修正可能不跟手；不是人体贴片同一实现。
- 路径：`components/photo-canvas/photo-canvas.ts:25 redraw / :77 queueTouch`；120事件×3宽×3重复。
- 实测：每120次移动120次尺寸查询、120次getContext、240次图片绘制、120次setData；client触摸还122次bounds查询。Node快速循环几毫秒，不包含桥接等待。
- 证据：[photo.json](evidence/photo.json)。重复动作确认；尚未取得微信长任务/掉帧，不能定为已证实渲染瓶颈。
- 建议：节点/context稳定缓存、一次待绘制RAF合并、滚动/resize/布局修订失效，保留触摸有序队列和12px最小框。风险：坐标漂移、touchcancel回归、最后一个触摸遗漏。

## P1-05：每请求图谱读取、来源校验与构造（A）

- 路径：`backend/app/services/atlas_service.py:39 load_dataset`；20次请求均完整执行。
- 实测：单片组中位26.66ms、5片组26.33ms；构造116几何；CPU采样说明校验/shape构造而非只有磁盘读取。
- 排除：前端静态图谱不每次JSON解析；不要把两端混淆。
- 建议：版本＋内容指纹的只读snapshot缓存、失败关闭、原子替换；优先排在请求内union复用之后。风险：静默忽略图谱变更、哈希过期或医审状态变化；不可简单全局永久缓存。

## P2与待验证项

| 编号 | 证据级别 | 观察与限制 | 建议/风险 |
|---|---|---|---|
| P2-01 图谱透明度逐帧路径提交 | A计数/B掉帧 | 虚拟14绘制批次255853 lineTo；约9.27ms JS总命令，GPU未知 | 先原生Performance，再决定路径/图层缓存；不能删医学几何 |
| P2-02 低频大setData | A字节/B桥接 | 单2000贴片确认190067字节；手工100点累计582948字节 | 测原生桥接和syncSession；页面只传必要显示字段，store保留完整来源 |
| P2-03 候选重下载/重解码 | A实现/B时延 | 切换10次创建10张alpha对象；真实下载只测1次12.58ms | 有界候选文件缓存，revision/TTL失效；避免用常驻大纹理换未知收益 |
| P2-04 Date.now开发指标 | A实现 | 非单调、低分辨率，前后端缺统一阶段追踪 | 默认关闭的单调汇总trace；不记录患者载荷 |
| C-01 云端增加CPU/内存 | C | 本窗口限流仅增8.848ms、OOM0 | 当前无足够理由调生产配额，先同架构隔离基准 |
| C-02 全面更换Canvas/模型 | C | 未定位到模型错误或原生栅格硬瓶颈 | 本轮不推荐，成本及保真风险明显 |

未发现证据的问题：人体背景每次拖动重新加载、贴片活动期逐顶点完整变换、每次滑杆重生成位图、确认重复提交同一AI对象、每个手工点完整多边形验证、图谱切换重复解析所有JSON。不同路径的缓存/热点必须分别讨论。
''')
write('08-最小优化实施计划.md','''# 最小优化实施计划

**本页为下一轮方案，本轮没有落地优化，不承诺固定加速比例或帧率。** 按一项一轮、同环境/同数据配对比较推进；保护基线161文件和当前测试证据可用于回退核验。

## 最值得先实施的三项

### 1. 人体完整包含校验的等价加速

修改对象：`utils/placement-geometry.ts`、`annotation-geometry.ts`中的人体边检索/点定位，必要时放置生命周期调用；不碰相似变换规则或最终提交约束。

原因/影响：2000顶点松手、滑杆结束、确认和退出均约0.2秒同步工作。CPU采样已具备实施证据。先缓存当前不可变body的边界结构和索引，对精确相交候选做空间粗筛；每条边区间和人体孔洞仍按原规则完整验证。研究源拓扑只读凭据，不能把“上次位置合法”当本次合法。

风险：粗筛漏边、共线/接触、人体孔洞、非等距照片坐标混用、失效body版本。若拆分异步校验，须有revision校验和未验证禁确认，不允许旧结果通过新变换。

补测/验收：10/100/500/2000单多片、孔洞、边界接触、跨躯干与手臂空白、越界、20k安全上限拒绝、复位/三屏、退出重入；现有geometry oracle逐场景相同。配对至少20轮核心单场景，记录事件→下一绘制/松手→可确认P50/P95及主线程长任务；几何JSON和V2保存必须相同。手机再测实际改善。

回滚：独立提交/改动集，移除索引层回到原完整函数；新增缓存不改变持久化数据格式；保留原函数作为实验对照后再评估删除。

### 2. 请求内复用相同图谱并集

修改对象：`backend/app/services/dermatome_matcher.py evaluate/coverage`。先按view一次union并显式传递，不改图谱、公式、容差或候选分组。后续再单独评估atlas_service版本快照缓存。

原因/影响：单片重复2次、5片6次并集；重复计算约43/129ms。请求内复用风险低于跨请求cache，有明确测试入口。

风险：将不同view/candidate集误用为同一个，改变空图/面积一致性保护。不能跨版本无条件复用。

补测/验收：原180项Python测试＋AI/手工同几何一致、多标注重叠去重、正背面、无覆盖、微小片、孔洞、版本拒绝；旧/新响应去掉request_id后逐字段等价（浮点按原严格容差）。同机同1/5/20对象各至少20次分段计时，检查union调用由N+1变为每view1，不凭均值掩盖尾延迟。安全云端仅串行单请求确认原A健康。

回滚：恢复coverage参数/旧调用，数据格式不变，无缓存迁移；跨请求缓存独立开关关闭即可恢复每请求验证，不能和本项一起做成大改。

### 3. 相同照片裁片的有限embedding复用

修改对象：AI推理适配层与AISessions生命周期；模型结构、权重、归一化/裁片回贴和轮廓算法保持。

原因/影响：9次热提示图像编码仍409–483ms，而解码24–29ms（M4），有优化空间但云端收益待同架构验证；照片/crop改变时不应命中。

缓存键：校正RGB指纹、整数crop边界、模型权重/预处理版本、device/dtype；会话隔离，最多当前会话少量局部框。前景点令裁片扩大、换图、模型/策略变化、TTL/删除必须清除或miss。保持单推理锁，不在全局predictor中混用用户状态。

风险：隐私隔离、过期特征、PyTorch设备内存、多个局部框的缓存膨胀。2核/4GB容量不能按权重大小估计，现有1.5GiB限制不得随意解除。

补测/验收：相同crop不同点与无缓存输出逐像素一致；变更crop/图/方向/用户、撤销、超时、删除命中数正确；MultiPolygon/孔洞与原Mask像素一致。隔离Linux CPU测冷、热及3MP峰值RSS；保留busy429、用户确认和45秒失效。测完才报告收益。

回滚：配置关闭embedding cache，走原predict/set_image/reset_image；无需改用户数据或模型权重。

## 紧随其后的前端小优化

照片photo-canvas借鉴已有placement的单帧调度和节点生命周期，但不复制复杂业务。修改仅节点/context缓存、稳定尺寸复用、待绘制合并、避免重复空error setData；保持client坐标读取准确，滚动/resize触发失效。先原生采样证明收益，运行photo-canvas、AI自动框选、过期响应、触摸cancel测试。回滚为原redraw路径，保留原始Mask/几何。

图谱静态层、候选图片多级缓存、广泛重构setData、提高服务CPU配额，均排在数据补齐之后。不要用减少片区/删孔、缩小图片、提高平滑或延长动画来制造“变快”。

## 手机验收表（下一轮）

记录手机型号/系统/微信基础库/网络、构建版本、输入公开样本指纹与顶点规模；每场景保持相同数据。打开性能面板→启动→正背面10次→全部/单区20次→10/100手工点→AI同框提示→多片贴片60秒拖动/滑杆→松手/确认→返回重入10轮。记录每段trace、长任务、帧、内存；Wi-Fi与移动网络分组。掩去照片与凭据，不将录屏时间刻度当精确函数计时。

通过标准先看正确性（形状、孔洞、坐标、过期保护、人工确认、结果一致），再看同设备配对耗时与长任务/帧改进，不能预填20%或60 FPS。本轮在审计报告交付后停止。
''')
write('09-测量方法与复现记录.md','''# 测量方法与复现记录

## 环境与证据

本机macOS15.6.1/arm64、Apple M4、16GB，Node24.11.1；Python3.12.14，Torch2.5.1 CPU4线程，Shapely2.1.2、Pydantic版本见backend-local-detailed JSON。测试编译到`/tmp/dermatome-p5-build`，不覆盖小程序源文件；无新依赖安装。云端环境以本轮server-baseline/after为准，不引用旧M4或旧云端记录当新测量。

| 证据 | 场景/规模 | 有效状态 |
|---|---|---|
| placement-isolated-1/2/3.json | 每轮10场景；10/100/500/2000顶点，单片/5片5孔，三宽，退出 | PASSED；正式报告依据 |
| placement-1/2/3.json | 最初累计V2标注会话9场景 | 保留；不是全新单贴片基线 |
| placement.cpuprofile / sampling-summary | 独立CPU采样全10场景 | PASSED；采样运行不与无采样耗时混合 |
| frontend-final.json | 区域100次；手工10/100各3次纯函数和各1次真实页面；500/2000隔离；19个body场景 | PASSED；初始化19，正背面190，全部/单区380，虚拟动画19 |
| photo.json | 320/375/430各3次；120事件拖框/笔刷、10候选切换 | PASSED；合成图片尺寸对象，不含原生解码 |
| backend-local-detailed.json | 合成单片/5个重叠标注对象各10请求 | PASSED；分段+嵌套union |
| ai-local / ai-local-2 / ai-local-3.json | 公开CDC21505；3新进程、12次实际模型推理 | PASSED；非医学质量评估 |
| cloud-http.json | 3次合成匹配、2次实际AI，全部串行 | PASSED；照片与访问204清理 |
| server-baseline / server-after | 两项服务、cgroup/网络/内存前后双快照 | PASSED；低负载观测，不代表峰值容量 |
| nginx-timing-capability.json | 只读提取耗时日志配置布尔值 | PASSED；Nginx分段耗时NOT_MEASURED |
| core-before / core-after-check | 161业务/数据/图片文件哈希 | 0改变 |

`summary.json`包含阶段均值、中位数、范围；同场景少于20个样本时P95=null。多个尺寸/冷热混合的汇总仅用于观察，不作为稳定尾延迟SLA。前端循环高频调用样本足够时可输出经验P95，但未含桥接、系统调度和原生渲染。

## 临时埋点清单与关闭方式

所有新增工具位于本目录scripts，没有生产import、开关默认无运行入口。删除整个performance-audit目录或不调用脚本即可停止；task.md仅保留报告链接。没有修改任何现有TS/Python业务函数。

| 文件 | 埋点/职责 | 原位修改 |
|---|---|---|
| placement_profile.cjs | 沿用既有profile_placement框架；内存包装变换/校验；setData字节；全新store；禁网络确认；退出断言 | 无，脚本进程退出恢复 |
| frontend_profile.cjs | 真页面/组件/纯函数调用、命令计数、虚拟动画时钟、三屏和重入 | 无，Date.now替换只在隔离计数器内且finally恢复；真实耗时performance.now |
| photo_profile.cjs | 实际photo组件触摸/绘制计数 | 无 |
| profile_backend.py | perf_counter阶段、函数包装、cProfile | 无 |
| profile_ai.py | 模型现有计时、Torch forward hooks、AISessions临时持久化目录 | 无，hooks结束移除，照片/Mask临时文件清理 |
| server_snapshot.py | SSH stdin只读白名单、3秒资源快照 | 服务器不落脚本文件 |
| nginx_timing_check.py | sudo -n nginx -T仅在内存检查日志字段，输出布尔 | 不改配置、不读访问日志 |
| cloud_probe.py | 明确3匹配/2AI串行，A健康守卫，finally清理本次数据 | 仅正常API创建本轮测试会话并删除 |
| summarize.py / write_report.py | 汇总测量与生成中文报告 | 仅本轮审计产物 |

原有技能要求的instrumentation changelog在此表；新增行数见[evidence/instrumentation-manifest.json](evidence/instrumentation-manifest.json)。没有需从业务源码撤回的临时埋点。

## 已实际执行的本地命令

从仓库根目录运行；重新审计应使用新输出目录/备份本轮证据，避免覆盖历史记录。以下为本轮实际命令，不自动触发云压测。

```sh
miniprogram/node_modules/.bin/tsc --project miniprogram/tsconfig.json --noEmit false --outDir /tmp/dermatome-p5-build
node --expose-gc docs/performance-audit/scripts/placement_profile.cjs /tmp/dermatome-p5-build docs/performance-audit/evidence/placement-isolated-1.json
node --expose-gc docs/performance-audit/scripts/frontend_profile.cjs /tmp/dermatome-p5-build docs/performance-audit/evidence/frontend-final.json
node docs/performance-audit/scripts/photo_profile.cjs /tmp/dermatome-p5-build docs/performance-audit/evidence/photo.json
ai/.venv/bin/python docs/performance-audit/scripts/profile_backend.py
ai/.venv/bin/python docs/performance-audit/scripts/profile_ai.py
node scripts/profile_canvas_workflow.cjs
npm --prefix miniprogram run typecheck
npm --prefix miniprogram test
PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests ai/tests -q
python3 docs/performance-audit/scripts/summarize.py
python3 docs/performance-audit/scripts/write_report.py
```

placement另两轮输出isolated-2/3；CPU采样使用`node --cpu-prof --cpu-prof-dir=docs/performance-audit/evidence --cpu-prof-name=placement.cpuprofile`；AI额外输出ai-local-2/3。回归结果：TS通过；298/298前端，180/180 Python，7条既有timm/MobileSAM注册警告。独立计数和深比较断言通过。没有新临床测试或性能优化对照版，因此没有“优化前后提速倍数”。

云端命令：已有`acupuncture-server` SSH别名，BatchMode/StrictHostKeyChecking/UpdateHostKeys=no/ForwardAgent=no，只读脚本经stdin。cloud_probe仅在本轮用户授权下执行；不会从本地复现脚本自动再次调用生产。HTTP地址从现有项目确认，不创建隧道/域名/公开端口。

## 真实失败与修正记录

- 初次受限SSH报Operation not permitted；按本轮授权经工具批准只读访问成功。不是服务器故障，未放宽服务器规则。
- server-before误将A健康路径写为`/api/v1/health`、`/api/v1/ready`，HTTPError；依据部署文档改为`/health`、`/ready`，baseline/after均200。确认A正常后才执行业务请求。初始文件保留。
- placement-1.log首次隔离网络使用release环境，放置门禁阻止onLoad，transform空；改为develop＋仅测量器覆盖canMatchReference=false。没有改产品门禁。成功日志为placement-1-retry，最终使用isolated序列。
- frontend-final-run.log误调用不存在的store.clear；改用测量器全新AnnotationSessionStore，frontend-retry通过。初始frontend.json的画布setter缺getter会误报宽高重复写，不能用于结论，最终frontend-final.json已修复适配器并断言只写一次。
- photo-run.log测量器对象闭括号语法错误；修正后photo-retry通过，9场景真实组件计数。
- 少量文件发现命令因旧路径/空glob失败，不作为业务失败；按rg发现实际文件继续读取。

## 微信与手机状态

本轮cua读取到Shingles窗口（Stable2.01.2510290），能看到旧首页截图，但AX还包含历史上传弹窗，状态不完全一致。点击调试面板返回`Computer Use server error -10005: noWindowsAvailable`。没有继续宣称采集成功，也没有把旧上传成功/截图当成本次测试。

微信Performance记录、原生启动/渲染/解码/setData桥接/帧数据：NOT_MEASURED。手机完整A～I流程、Wi-Fi与移动网络对照：NOT_RUN。本轮不需要重新上传版本，因为产品代码完全未改。后续按优化计划的手机验收表采集，不能用单元测试替代。
''')
