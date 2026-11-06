# V6.1 独立手掌视图与参考匹配接入说明

日期：2026-11-04。总进度以 [task.md](../task.md) 的追加交付记录为准。

**已实现左右手掌展示、人工圈选、独立会话和匹配技术接入。完整掌侧脊神经皮节边界未取得，因此真实皮节匹配仍为 BLOCKED，不能称为 V6.1 全部验收通过。** 没有把典型感觉检查点或外周神经分布补画成面积区域。微信原生与手机交互为 NOT_RUN；下面静态图不是小程序截图。

![左右掌面静态资源预览](../data/sources/palm-v1/palm-comparison.png)

## 入口与范围

从首页进入人体模型，点击紧凑的“特殊部位”，选择“左手掌”或“右手掌”。只开放这两个入口。手掌页面支持逐点圈选、撤销、取消草稿、闭合、多片标注、选择删除、完成标注、返回修改、放大与复位。两侧分别显示已完成片数；返回全身跳回原选择页，不清空之前的 front/back 会话或改变正背面选择。

本地标注仅保存在本次小程序运行的内存中；关闭或重启不保证保留。没有新建数据库或迁移历史数据。当前“计算参考区域”被数据准入状态禁用，并直接说明边界尚未就绪；“参考图谱”没有伪造的 C6/C7/C8 按钮。标签由实际数据生成。

## 为什么局部视图独立

既有 BodyView、全身会话、V5 放置均明确绑定 front/back。手掌采用独立注册表与模板，而不扩大原有 BodyView 的含义：

| 项目 | 值 |
|---|---|
| viewId | `palm-left`、`palm-right` |
| templateId / version | `commons-palm-v1` / `1.1.0` |
| geometryId / regionSetId | `commons-palm-outline-v2` / `commons-palm-ui-v2` |
| 逻辑画布 | 440 × 700，左上原点、X 向右、Y 向下 |
| 资源 | 本地 SVG 编辑源；880 × 1400 透明 PNG 运行资源 |
| 图谱身份 | `palm-dermatomes-v1` / `palm-dermatomes-preview.2` |
| 实际医学标签 / 区域实例 | **0 / 0** |
| 状态 | `blocked_missing_boundaries`；`medicalReviewStatus=pending`；`mappingEnabled=false` |

使用现有归一化公式、视口和命中/包含算法。`normalized_2d_top_left` 与 `body_template_normalized_v1` 表示坐标规则，具体空间还必须由模板及 view 联合确定。相同的 (x,y) 在左掌、右掌、全身并不代表同一位置，也不等于照片空间 `photo_oriented_normalized_v1`。

TypeScript 新增 PalmView / SurfaceView，通用标注、图谱、匹配类型以泛型扩展，默认仍为 BodyView。全身 AnnotationSession 的 front/back 结构保持不变。

## 真实展示素材与左右规则

采用 Wikimedia Commons [Gray1237.svg](https://commons.wikimedia.org/wiki/File:Gray1237.svg)，Rhcastilhos 矢量化，源于 Henry Vandyke Carter / Gray’s Anatomy plate 1237。文件页面的 PD-self 公共领域声明及任意用途后备授权允许修改、商业使用和派生分发；保留作者和修改记录便于追溯。该授权只用于展示手部，**不证明皮节分区可用**。

保留原 `path1881` 外轮廓及原掌纹路径，去掉骨骼、动脉、引线和文字；在原图 y=610 截取腕部，用真实截线封闭展示范围；平移到 440×700 画布，不改手指比例。SVG 曲线按 0.12 原图单位容差采样，每侧 366 个闭环坐标，前后端共用此轮廓，不能点入指缝。采样不是神经边界数字化。

手指朝上，掌面朝向观察者：左手掌拇指在屏幕左侧，右手掌拇指在屏幕右侧。左掌基础图经 `x'=440-x, y'=y` 得到右掌；归一化为 `x'=1-x`，环方向随镜像校正。原始 Gray1237.png 图注明确为左手掌，未镜像 SVG 与之相符。上一轮把该原图误认成右掌，已在1.1.0修正；原1.0.0坐标身份不能复用。修正依据与旧资源留档见[左右更正记录](validation-records/v6.1-side-fix/report.md)。

指定的 Hand pointing down 是两指下指手势；Hand parts 有指甲，是手背；均实际看图后排除。原文件、生成脚本、许可及修改记录见 [来源目录](../data/sources/palm-v1/) 和 [调查记录](validation-records/v6.1-sources.md)。静态几何检查有 22 个人工选取的显示参考点；这不是医学审核。

## 医学图谱调查与阻塞

| 资料 | 核实结论 | 本次处理 |
|---|---|---|
| [PMC10982913](https://pmc.ncbi.nlm.nih.gov/articles/PMC10982913/) | CC BY-NC-ND 4.0 | 不能把限制商业/演绎的图用于本商业项目的数字化边界 |
| [PMC12097171](https://pmc.ncbi.nlm.nih.gov/articles/PMC12097171/) | 正文 CC BY 4.0；表格及 Figure 1 图注描述感觉测试点，原图访问受限，未宣称看过原图 | 未核实完整掌侧面积边界和第三方改编图独立许可，不能数字化为可用图谱 |
| [NBK535401](https://www.ncbi.nlm.nih.gov/books/NBK535401/) | 检查点概念可参考；正文/附图许可分别记录 | 不能从拇指、中指、小指点外推整个掌面 |
| [NBK551638](https://www.ncbi.nlm.nih.gov/books/NBK551638/) | 内侧前臂皮神经条目 | 不属于所需完整掌侧脊神经皮节边界来源 |
| 当前 Goran 原始图谱 | 前掌局部有来源原有合并标签 C6–C8、C8/T1；不能拆成独立 C6/C7/C8 | 保留原全身图谱，不从低分辨掌部或合并区域推导新边界 |

具体许可证据、图像查看过程和原标签查核见来源记录及 `data/atlas/palm-v1/sources.json`。当前掌侧文件 `regions:[]`，registration 没有控制点，也没有皮节配准结果。没有平均三分、矩形占位、强行加 T1 或填满空白。

继续真实面积匹配所缺的最少资料是：**允许商业派生的掌侧脊神经皮节边界原图/矢量源、可核实的朝向与标签含义，以及对数字化和配准范围的医学审核。** 获得后需从来源边界配准到当前掌面，保留来源不确定/未覆盖部分，再单独通过准入检查。

## 标注与匹配数据流

1. `getPalmModel(view)` 从独立注册表返回冻结的展示、轮廓与图谱身份。
2. 手掌 Canvas 复用 `fitViewport / focusViewport / canvasToNormalized`、V2 `drawLesions` 与 P6 `pointInBody`；仅缓存显示图片，一次最多一个待绘制帧。
3. `editManualView()` 是从原 V2 状态操作抽出的共用纯函数，继续执行原最大顶点/片数、闭合、重复、自交、全区域人体包含校验。顶点在手指上但跨指缝的多边形仍拒绝。
4. PalmSessionStore 是左右手掌各自的权威内存状态；完成片区保存 view、ID、basis、atlasIdentity、source=manual、ring 与完整 MultiPolygon。不会写入全身 singleton。触摸携带会话 ID 和 revision；异步容器位置查询前后及页面接收均核对，避免旧点写入新草稿。
5. 匹配请求仍走现有 `/api/v1/evaluate`、同一网络/环境/鉴权封装；携带完整几何和模板/图谱/内容哈希。独立匹配状态对改标注、换版本、取消、退出、迟到响应执行失效保护。
6. 后端固定图谱注册表选择 Goran 或 palm 加载器。Palm 加载器检查固定资源哈希、来源、模板、左右、完整包含；不允许用户传路径。当前合法掌侧请求返回 **409 ATLAS_NOT_READY**；版本错误 409、损坏数据 503。不能把空图谱返回成 200 “全部未覆盖”。
7. 将来只有真实已核验边界就绪后，才调用现有 Shapely 交集/标注面积与 P6 每请求每视图图谱并集复用。没有更改匹配公式、并集去重、接触零面积、组合标签语义。
8. 结果层复用原候选区域核对、比例文案、紧凑侧边标签和病灶轮廓。显示全部/单标签/恢复全部按真实 region IDs 绘图，孔洞反向绕序保留。当前仅通过明确合成的技术数据验证此路径，未称为真实皮节高亮。

`data/body/palm-resource.json` 为展示轮廓来源；`scripts/sync_palm.py` 生成 `data/body/palm-v1.json` 与 `miniprogram/data/palm.generated.ts`，写入固定来源和导出 SHA。使用 `--check` 检测漂移。神经图谱另有四个固定文件的组合哈希。原全身 geometry/template/atlas 导出未改。

## AI 范围与兼容

V5 placement/session/确认导入仍强绑定 BodyView 和当前全身模板。把它泛化到局部视图需要另一轮状态、边界、来源、匹配链路验证，故本轮 **未实现手掌 AI 放置**，手掌页不显示误导入口。原照片分割、全身放置、结果失效、手动全身标注和服务器访问限制保持。

后端 View 接受四个明确值；每次请求仍绑定单一模板，掌与全身混用被拒绝。既有 front/back 请求与默认类型兼容，旧图谱与照片数据没有迁移。正式 release 的参考计算门禁未放开。

## 验证与证据

实际命令、最终数量和失败修正见 [验收记录](validation-records/v6.1/report.md)。包括全前端、后端与 AI 回归、手掌来源参考点/镜像、原图谱副本和人体导出检查。合成区域只存在测试代码，使用 `SYNTHETIC` 标签，不会进入正式图谱。

真实微信操作未完成：工具可读旧 Shingles 首页，但当前控件点击失效，截图与可操作窗口不一致；见 [真实尝试](validation-records/v6.1/wechat-attempt.json)。没有上传体验版或部署云端，现有体验版不会自动获得本地新代码。

待后续可操作环境核验：入口→左掌取点闭合→多片→放大/复位→完成/修改→切换右掌→返回全身原会话；重点看窄指缝、不同屏幕的触摸和图层对齐。真实匹配与标签操作还必须等可靠边界资料，不以技术测试替代。

## 文件范围与下一步

新增两页与 palm-canvas、palm 类型/注册表/会话/匹配状态、共用 manual-annotation 操作、palm 后端加载器、真实素材及派生脚本、空而明确阻塞的医学图谱、测试和此说明。现有 select 仅加入口；types/渲染/响应校验作最小泛型兼容；后端 matcher 只让来源许可随数据集输出，原几何计算及 P6 优化不变。

先取得可用掌侧边界并做配准审核，再恢复真实匹配验收；AI 局部放置单列后续授权任务。手背、足底、腋下、大腿内侧、会阴本轮均未实现，也没有虚假入口或医学数据。
