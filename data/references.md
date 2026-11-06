# 图谱来源登记

当前没有已启用或医学审核通过的神经皮节图谱。以下先保留 V0 来源状态，再追加 V1 原创展示资源与真实候选资料检索。

V3已采用Goran_tek-en的同套2022年[正面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg)与[背面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg)SVG。具体文件许可均为[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，不能套用CC0或Servier许可。已实际检查原图/标签，来源、原始URL、指纹、访问日期、作者与信息贡献者、署名及改动见[来源记录](atlas/goran-2022-preview-v1/sources.json)和[NOTICE](atlas/goran-2022-preview-v1/NOTICE.md)。派生图谱和生成副本同许可，保留署名、许可链接与修改说明；现有人体CC0和独立软件代码许可不因此改变。

Servier网页许可/条款已核对，但因自动访问限制未下载或宣称看过其原图。Dermatoms.svg原件实际检查后因半面/渐变合并路径未采用；没有混入其边界。Lee等2008年论文仅作为图谱差异摘要参考，未复制论文图像。详细来源变化及采用范围见[V3说明](../docs/v3-atlas.md)。新开发图谱医学审核pending、匹配禁用，旧V0空图谱及下列历史记录不变。

## V0 来源状态（历史）

V0 尚未获得医学参考图谱、背景人体图片或可再分发许可，当时没有登记医学参考文献。

`atlas/v1/` 仅为空数据结构：`unverified`、`mapping_enabled: false`，正背面均为空。`v1` 是数据目录版本，不表示已发布或已验证，也不等于应用开发版本 V1。

后续每项来源须登记：来源标题与作者/机构、可核对的链接或出版信息、版本/访问日期、许可及是否允许衍生和再分发、背景图片与描摹数据的关系、适用身体区域和视图、整理人员、审核人员/日期/记录及已知差异。缺失字段应写明未取得，不得虚构。

正式启用条件和数据格式见 [图谱规范](../docs/atlas-spec.md)。人工几何测试数据必须放在 `backend/tests/fixtures/`，并明确标记 synthetic；不能作为本登记中的医学来源。

`examples/` 为未来非患者、已脱敏或合成接口示例预留，目前为空。不得在此保存真实患者图像或身份信息。

## 2026-10-17 V1 原创展示模型

已使用本项目原创 `neutral-body-v1`，源文件为 `miniprogram/assets/body/model.ts`，400×900 逻辑画布。没有外部来源 URL、第三方图片或皮节描摹；外部许可不适用，项目整体对外再分发许可尚未设置（UNKNOWN）。作者/创建说明及限制见 [展示资源说明](../miniprogram/assets/body/README.md)。这是普通人体 UI 示意，不是医学解剖或皮节图。

## 2026-10-17 候选医学资料检索

获取日期均为 2026-10-17；下列仅登记可核对的网页/资料信息，没有下载纳入项目、生成皮节坐标或进行医学审核。UNKNOWN 表示本轮没有获得足够证据，不能用常识补填。

| 候选来源与作者/机构 | 使用许可与证据 | 正面 / 背面 / 编号 | 数字化适用性与审核 |
| --- | --- | --- | --- |
| [Dermatoms.svg](https://commons.wikimedia.org/wiki/File:Dermatoms.svg)，Ralf Stephan，资源日期 2005-12-16 | 文件说明页 Licensing 明确作者将作品置于 public domain；登记的是该文件的声明，不能推广到其他版本或页面正文 | 正面 UNKNOWN；背面 UNKNOWN；标签清晰度 UNKNOWN，本轮未逐图审查 | SVG 可作为矢量候选，但临床依据、标签及边界须逐项核验；需要医学审核，尚未采用 |
| [ASIA ISNCSCI Worksheet Permissions](https://asia-spinalinjury.org/international-standards-neurological-classification-sci-isncsci-worksheet/)，American Spinal Injury Association；对应 [REV 04/26 PDF](https://asia-spinalinjury.org/wp-content/uploads/2026/07/ASIA-ISCOS-Worksheet-Both-Sides_4_2026.pdf) | 官方许可页与 PDF 标明 CC BY-NC-ND 4.0；商业或衍生使用需另行许可，本项目未获额外许可 | 正面 UNKNOWN；背面 UNKNOWN（未完成逐图审核）；PDF 文本可检索皮节编号及手掌/手背标记 | 是神经分类检查表及关键感觉点资料，不能直接当作已授权的连续皮节 Polygon；需确认授权与医学适用性，尚未采用 |
| [An evidence-based approach to human dermatomes](https://pubmed.ncbi.nlm.nih.gov/18470936/)，M W L Lee、R W McPhee、M D Stringer；Clinical Anatomy，2008，21(5):363–373；DOI 10.1002/ca.20636 | PubMed 记录与摘要可核对；图像复制、修改及再分发许可 UNKNOWN，未取得全文图像授权 | 正面 UNKNOWN；背面 UNKNOWN；编号 UNKNOWN（本轮仅查阅摘要） | 可作为比较不同图谱证据的文献线索；实际图、数字化与许可尚待确认，需医学审核 |

检索限制：微信官方开发文档部分 URL 无法直接读取，Canvas 实现另核对[官方 Canvas 2D 示例](https://github.com/wechat-miniprogram/miniprogram-demo/blob/master/miniprogram/packageComponent/pages/canvas/canvas-2d/canvas-2d.js)和已安装的官方 API 类型。NCBI Bookshelf/PMC 部分正文请求返回浏览器验证页；没有绕过验证或把搜索摘要当作已获完整图像。上述可访问来源的许可事实逐项记录，未凭印象填入通用开源许可。

结论：找到候选资料，但没有获得本项目可直接启用的、已数字化且审核通过的医学皮节图谱。`data/atlas/v1/` 三份 JSON 保持原样：空区域、unverified、mapping_enabled=false。V2 可先沿原创模型做交互；V3 医学映射仍受来源确认、授权、配准与医学审核阻塞。

## V1.1 原创资源与技术依据（2026-10-18）

当前资源更新为neutral-body-v2 / 2.0.0，本地原创Canvas路径，无第三方人体素材、无外部来源URL；项目整体分发许可仍未指定。来源和新旧几何参数见[资源说明](../miniprogram/assets/body/README.md)。上文neutral-body-v1登记保留为V1历史，不代表新几何可复用旧标注。医学候选、正式空图谱和未审核状态均未改变，本轮未新增任何医学边界。

输入基准核对已安装官方miniprogram-api-typings 5.2.3：TouchCanvasDetail.x/y是Canvas本地坐标，TouchDetail.clientX/Y是页面可显示区域坐标；NodesRef.rect查询与client同基准。参考[微信官方类型声明](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.event.d.ts)及[官方查询API声明](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)。本轮以本地已安装官方类型核对坐标语义，Web检索同时可访问官方仓库；不依据第三方博客推断。

## V1.2 原创比例重绘（2026-10-22）

当前展示改为neutral-body-v3 / 3.0.0，源文件miniprogram/assets/body/neutral-v3.ts，本地原创、AI辅助编写，无第三方素材或外部来源URL；项目整体分发许可仍未指定。以用户提供的头身/裆/膝高度比例作插画设计参考，未引入新的医学文献或皮节边界。BODY_LANDMARKS只用于技术配准与参考图，不是医学图谱。旧v2路径和区域表留存，不迁移旧点；正式空图谱、许可与医学审核状态不变。来源、变化及限制见[资源说明](../miniprogram/assets/body/README.md)。

## V1.3 已采用的 Commons 展示素材（2026-10-22）

[Human body with blank labels.svg](https://commons.wikimedia.org/wiki/File:Human_body_with_blank_labels.svg)，Šlomo，2015-11-18，CC0 1.0。实际查看预览、文件Licensing与两级衍生来源页；CC0允许免费修改、商用和打包分发，无强制署名/同许可要求。保留作者链Digital Nomad（Michael W Harris）、Cdang及[许可和变换记录](../miniprogram/assets/body/commons-cc0/NOTICE.md)。本地原文件SHA-256固定为486cdc8a89fbfe0ff0a4bb4104efc19bb5c708337c37768be6f9120c4837753a。

当前小程序已实际采用独立正背面去标签派生PNG，模板commons-neutral-v1/4.0.0。原路径保留，只去空标签/引线、统一尺度及加中性底色；不是翻转正面、重画人体或改用上轮BY-SA候选。16粗UI区域和命中轮廓随图重建。属于普通表面示意，未获医学审核，不含正式神经皮节数据；CC0不等于医学准确性保证。data/atlas三文件原字节不变，仍禁止医学映射。以上追加不改变各历史版本的原来源记录。

## V3.1 同源图谱增量（2026-10-24）

采用 Goran_tek-en，2022-09-24 的 [正面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg) 与 [背面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg) 原始 SVG；文件页作者及 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可重新核对。原件 SHA1、作者署名、修改/再分发要求保存在 [sources](atlas/goran-2022-preview-v2/sources.json) 和 [NOTICE](atlas/goran-2022-preview-v2/NOTICE.md)。未引入第三方几何图谱；整理为本项目工程数字化，医学审核人、日期、结论均未取得，状态 pending。

实际查看原图文字、引线及矢量：正面主图路径 13/14/16 对应 V1/V2/V3，36/37/38/41 对应足部 L4/S1/S1/L5。面部用眼鼻口颌参考点局部配准，足部左右独立配准；[逐路径依据](../docs/validation-records/v3.1-atlas/source-audit.md)、[控制点](atlas/goran-2022-preview-v2/local-registration.json)。背面源 V1 头皮确实存在但本轮不映射；背面源足底和当前目标足跟不对应，保留未配置。衍生图谱及其包内副本继续 BY-SA 4.0，不将人体 CC0 许可误用到图谱。

[Cleveland Clinic](https://my.clevelandclinic.org/health/body/21581-trigeminal-nerve) 用于核对三叉神经眼支、上颌支、下颌支概念；[NHS](https://www.nhs.uk/conditions/shingles/) 用于静态眼周/鼻部皮疹、视力变化就医提示。访问日 2026-10-24。没有复制其插图，网页图片复制/改编许可未作为已取得授权，也没有采用其几何边界。两者不是本项目医学审核证据。

## V6.1 独立掌侧素材与边界调查（2026-11-04）

展示采用 [Gray1237.svg](https://commons.wikimedia.org/wiki/File:Gray1237.svg)，Rhcastilhos（据 Carter / Gray 1237图），具体PD-self和任意用途后备授权已核验；保留原外缘/掌纹、去骨骼血管文字、截取腕口并镜像另一掌。合法授权与修改记录见 [来源NOTICE](sources/palm-v1/NOTICE.md)、[结构化来源](sources/palm-v1/sources.json)。手部底图公有领域不表示皮节边界可用。

[PMC10982913](https://pmc.ncbi.nlm.nih.gov/articles/PMC10982913/)、[PMC12097171](https://pmc.ncbi.nlm.nih.gov/articles/PMC12097171/)、[NBK535401](https://www.ncbi.nlm.nih.gov/books/NBK535401/)、[NBK551638](https://www.ncbi.nlm.nih.gov/books/NBK551638/)和既有Goran真实源图均已调查；不合适的商业派生许可、仅有测试点、资料属于其他神经体系、合并标签不能拆分等限制详见[调查记录](../docs/validation-records/v6.1-sources.md)。其中PMC12097171原图访问挑战未解决，仅核查正文、表格与图注，不宣称原图已查看。

本轮掌侧脊神经皮节几何0实例，仍BLOCKED；没有医学配准控制点或审核人，不根据参考点虚构掌面C6/C7/C8区域。

### V6.1 新来源接入，取代上方边界阻塞结论（2026-11-04）

采用 [Servier Medical Art Dermatomes](https://smart.servier.com/smart_image/dermatomes/)，机构Servier Medical Art / Les Laboratoires Servier；官方[署名说明](https://smart.servier.com/how-to-cite-servier-medical-art/)和[应用许可说明](https://smart.servier.com/using-smart-images-what-you-can-do/)明确CC BY 4.0、商业修改及移动应用使用。已实际查看官网PNG和第26页PPTX可编辑曲线。当前3标签6实例，保留medicalReviewStatus=pending。原文件、曲线ID、修改说明和哈希见 [来源NOTICE](sources/servier-palm-v1/NOTICE.md)，复现/配准限制见 [续查报告](../docs/validation-records/v6.1-recheck/report.md)。此前各资料被排除的结论不因此撤销。
