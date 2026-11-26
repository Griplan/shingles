# 第二阶段整改清单（待确认）

日期 2026-11-24。按**独立整改事项**计数，同一界面状态或共享消息的多个落点列在同一行。仅阶段一已实施。文件路径均相对项目根目录，行号对应本次检查。账号后台实际显示与送审包功能未核实。

| 编号 | 所在页面 | 原文案 | 文件路径及行号 | 用户是否可见 | 误解风险 | 建议替换文案 | 处理建议 |
|---|---|---|---|---|---|---|---|
| R01 | 首页与全局默认标题 | 人体病灶辅助定位 | `miniprogram/pages/index/index.wxml:4`、`miniprogram/app.json:29` | 首页可见，默认标题在未覆盖时生效 | 中：容易误读为专业定位服务 | 人体区域标注与参考匹配 | 建议修改 |
| R02 | 全身正背面入口 | AI 辅助标注；上传局部皮肤照片辅助识别范围 | `miniprogram/pages/select/select.wxml:122–123` | 在线能力开放时 | 中：泛称 AI 和识别，未说明输出 | 图片辅助标注；圈选照片中的目标，自动提取轮廓 | 建议修改 |
| R03 | 全身页操作失败、保留的旧入口 | AI页面未能打开；暂无已确认标注，请先手动标注或使用AI辅助标注；神经匹配页面未能打开 | `miniprogram/pages/select/select.ts:137,143,156` | 第一处失败可见，后两处当前无常规入口绑定 | 低：入口称谓不一致 | 图片辅助标注页面未能打开；请先完成标注；参考匹配页面未能打开 | 建议修改 |
| R04 | 首页隐私摘要 | AI辅助入口会在您同意后上传照片至配置后端；临时会话30分钟失效 | `miniprogram/pages/index/index.wxml:22`；`backend/app/services/ai_limits.py:12`、`backend/app/services/ai_sessions.py:54` | 首页可见 | 中：30 分钟与默认空闲 120 秒冲突 | 经同意后，照片上传至项目后端进行自动化图像分割；退出或放置页就绪后请求删除，闲置会话由服务端自动回收 | 建议修改 |
| R05 | 首页操作说明 | 选择人体部位，进入标注页沿范围边缘逐点圈选 | `miniprogram/pages/index/index.wxml:5` | 是 | 低：暗示必须先选部位 | 进入人体示意图，沿要标注的范围边缘逐点圈选 | 建议精简 |
| R06 | 手动标注宽屏提示 | 匹配参考神经节段；沿病灶边缘顺次轻触 | `miniprogram/packages/clinical/pages/annotate/annotate.wxml:332` | 条件显示 | 低：统一参考区域及标注术语 | 计算参考区域；沿目标范围边缘依次轻触 | 建议精简 |
| R07 | 全身结果与无结果提示 | AI 辅助标注 · 人工确认位置；确认 AI 放置范围；当前图谱未覆盖这片标注，不代表没有感觉神经 | `miniprogram/packages/clinical/pages/annotate/annotate.wxml:258,294,399,414` | 结果及说明按条件显示 | 中：易把工具结果和人体神经状况连在一起 | 轮廓经人工确认位置；确认图片轮廓的放置位置；当前参考图谱未覆盖这片标注。保留医学审核待完成和非诊断提示 | 建议修改 |
| R08 | 结果页与编辑区按钮 | 调整 AI 标注 N 位置；AI标注 N | `miniprogram/packages/clinical/pages/annotate/annotate.ts:96,102` | 有图片标注时 | 低：动态标签称谓不一致 | 调整图片标注 N 的位置；图片标注 N | 建议修改 |
| R09 | 放置页导航与错误 | 确认病灶位置；当前版本暂未开放AI人体放置 | `miniprogram/packages/clinical/pages/placement/placement.json:1`、`placement.ts:58`（同目录） | 是／功能受限时 | 中：可能被理解为自动确认疾病位置 | 确认轮廓位置；当前版本未开放图片轮廓放置，请使用手动标注 | 建议修改 |
| R10 | 放置页面板和无障碍标签 | 橙色：待放置病灶；拖动病灶调整位置；放大病灶范围；病灶范围将在这里自动就绪；可移动的病灶范围 | `miniprogram/packages/clinical/pages/placement/placement.wxml:59,61,74,132`、`miniprogram/packages/clinical/components/placement-overlay/placement-overlay.wxml:1` | 是，含屏幕阅读器 | 低：描述的是轮廓 | 橙色：待放置轮廓；拖动轮廓调整位置；放大轮廓范围；等待轮廓显示；可移动的标注轮廓 | 建议修改 |
| R11 | 放置加载与重试 | 准备／自动恢复／重新绘制病灶范围；人体轮廓或病灶范围加载失败／超时；病灶范围暂时无法显示 | `miniprogram/packages/clinical/pages/placement/placement.ts:20–21,179,190–202` | 等待及错误时，179 为内部比较 | 低：轮廓显示的技术状态用词不一 | 对应换为“标注轮廓”，保持错误提示和恢复逻辑一致 | 建议修改 |
| R12 | 放置越界及返回弹窗 | 病灶完全位于人体外；使用有效人体交集？；保留人体内的病灶部分；已确认的识别范围 | `miniprogram/packages/clinical/pages/placement/placement.ts:264,271,316` | 条件显示 | 低：几何术语或识别语义含混 | 标注轮廓完全位于人体外；仅保留人体内的范围？；已确认的照片轮廓 | 建议修改 |
| R13 | 放置与标注共享错误 | 没有可调整的AI标注；原AI标注已变化；照片分析（会话）已过期；缺少有效的AI确认来源；识别范围；病灶轮廓／片区／坐标校验失败 | `miniprogram/packages/clinical/state/placement-session.ts:39,66,78,95,98,116`、`miniprogram/state/annotation-session.ts:129–141`、`miniprogram/utils/placement-geometry.ts:177–286,323–334,388–435`、`miniprogram/packages/clinical/state/matching-session.ts:29` | 条件可见；阶段一仅适配当前页面显示 | 低：术语不统一 | 图片标注、照片处理会话已过期、请重新确认照片轮廓、标注轮廓校验失败。保留具体原因和错误码 | 建议修改 |
| R14 | 脚底、腋下、会阴标题和取点提示 | 局部病灶标注；部位名＋病灶标注；沿病灶边缘 | `miniprogram/packages/special/pages/local-surface/local-surface.json:1`、`local-surface.ts:48`、`local-surface.wxml:15,172`（同目录） | 是 | 低：手工标注称谓不统一 | 局部区域标注；部位名＋区域标注；沿目标范围边缘依次轻触 | 建议修改 |
| R15 | 特殊部位人工模式 | AI 照片分割与自动放置未开放；本视图不提供照片上传或 AI 自动分割 | `miniprogram/packages/special/pages/local-surface/local-surface.wxml:137,226` | 条件显示 | 中：“自动放置”暗示项目其他视图会自动确定人体位置 | 此视图仅支持手动标注，不提供照片上传或自动提取轮廓 | 建议修改 |
| R16 | 特殊部位结果提示 | 几何覆盖为参考对应，不是诊断概率；未覆盖不代表没有感觉神经 | `miniprogram/packages/special/pages/local-surface/local-surface.wxml:171` | 结果态 | 低：可更直接说明空结果含义 | 覆盖比例表示标注与图谱在示意图上的重叠面积比例。未覆盖表示当前图谱没有匹配，不能用于诊断 | 建议精简 |
| R17 | 开发图谱预览 | 眼周或鼻部皮疹、视力变化时，应及时就医 | `miniprogram/packages/clinical/pages/atlas-debug/atlas-debug.wxml:54` | 仅受控开发预览相应分组 | 中：单条健康提醒可能被误读为功能提供医疗指导 | 核实展示目的。保留非诊断限制及预览权限，医学提醒的保留和位置由用户与平台确认 | 需要用户确认 |
| R18 | 工程描述及 API 文档 | 智络智绘：人体病灶标注与参考神经分区交互；带状疱疹神经皮节辅助定位系统 | `miniprogram/project.config.json:2`、`backend/app/main.py:48` | 工程配置／OpenAPI 元数据，非小程序页面 | 中：API 标题突出具体疾病与辅助定位 | 智络智绘：人体区域标注与参考图谱几何匹配 | 建议修改 |
| R19 | 共享图片提示源 | AI服务暂时不可用，请确认已启动；AI正在处理；AI处理超时；识别范围明显大于圈选范围；临时分析已满；照片或识别结果已变化 | `miniprogram/services/ai.ts:6–17,47`、`miniprogram/packages/clinical/state/ai-session.ts:3–8,75–80,105,122,143`、`backend/app/services/ai_sessions.py:107–108,164,193–198,250,265,287–301` | 条件可见，经阶段一页面适配，API 客户端仍可读原文 | 低：服务文案和网页术语不一致 | 图片处理服务暂不可用；轮廓提取超时；提取范围明显大于圈选；临时照片会话已满；照片或候选轮廓已变化 | 建议修改 |
| R20 | 评估及人体裁剪 API | 病灶片区或孔洞无效；病灶片区重叠或拓扑无效；病灶轮廓或人体数据无效 | `backend/app/utils/geometry.py:43,47`、`backend/app/services/body_intersection.py:118`、`miniprogram/services/api.ts:11–25` | API 客户端可见，小程序按错误码映射，未映射分支需验证 | 低：异常描述指向标注数据 | 标注片区或孔洞无效；标注片区重叠或拓扑无效；标注轮廓或人体数据无效 | 建议修改 |
| R21 | 使用说明与对外材料 | AI 辅助标注、从相册上传、确认识别范围等上一版按钮名 | `docs/deliverables/user-guide.md:3,17–27`、`docs/deliverables/images/README.md` | 仓库文档，转交后可见 | 低：阶段一后文档与界面不同步 | 后续按最终按钮和发布范围更新说明与截图。技术报告继续准确写 MobileSAM | 建议修改 |
| K01 | 首页、全身和特殊部位说明 | 不提供临床确诊；图谱医学审核待完成；比例不是诊断概率；来源和许可 | `miniprogram/pages/index/index.wxml:15,22`、`miniprogram/packages/clinical/pages/annotate/annotate.wxml:399,414–434`、`miniprogram/packages/special/pages/local-surface/local-surface.wxml:225–244`、`backend/app/services/dermatome_matcher.py:62` | 是，部分在说明抽屉 | 保留：边界与署名 | 保留原义，百分比只表达面积关系 | 建议保留 |
| K02 | 图片辅助标注与隐私 | 自动化图像分割；用户确认；服务器处理、临时保留、删除和 HTTP 测试限制 | `miniprogram/packages/clinical/pages/ai-annotate/ai-annotate.ts:15–16`、`ai-annotate.wxml:111,247–251` | 是 | 保留：自动化与个人信息告知 | 保留。如平台要求额外标识，按确认后方案增加 | 建议保留 |
| K03 | 腋下、会阴及足底 | 模拟区域／人为模拟分区；未审核；脚底参考区域及出处 | `miniprogram/packages/special/pages/special-parts/special-parts.wxml:8–32`、`miniprogram/packages/special/pages/local-surface/local-surface.wxml:58,143,191,225–244` | 是 | 保留：区分模拟图谱和来源参考图谱 | 明确模拟性质、医学审核状态和非诊断边界 | 建议保留 |
| K04 | 开发信息、代码命名与素材 | MobileSAM、Shapely、ai-session、ai-annotate、坐标调试、神经图谱测试、人体方位文字 | `ai/inference/mobile_sam.py:10–15`、`miniprogram/config/environment.ts:5–8`、`miniprogram/pages/index/index.wxml:19`、`miniprogram/pages/select/select.wxml:129–154`、`miniprogram/packages/special/assets/perineum/perineum-overview.png` | 内部命名不可见，调试受控，示意文字可见 | 保留：如实公开技术和素材来源 | 保留用途与权限；配图继续采用中性示意 | 建议保留 |
| P01 | 送审版本及后台类目 | 审核提示“深度合成-AI问答”，并要求显著标识 | 用户提供的驳回原文；`miniprogram/config/environment.ts:5–8` | 后台审核记录 | 待核实：对交互式分割产物是否有专门类目、显式／隐式标识或备案要求 | 以实际输入、输出和合成示例说明，请平台指出判定页面与适用要求；核实送审包与体验、正式门禁是否一致 | 需要平台确认 |
| P02 | 送审版本及后台医疗类目 | 审核提示“医疗服务-医疗机构” | 用户提供的驳回原文；匹配实现见 `backend/app/api/routes/evaluate.py:16–35` | 后台审核记录 | 待核实：参考图谱展示、说明或其他账号材料是否被判定为医疗／保健信息服务 | 请平台指出触发页面、具体功能和主体及资质要求 | 需要平台确认 |
| P03 | 平台资料、隐私指引及用户协议 | 已配置的小程序名称、简介、类目、隐私指引、用户协议与送审材料未知 | `miniprogram/project.config.json:2` 是工程描述；`docs/privacy.md` 为仓库文档 | 账号端状态未知 | 待核实：仓库无法证明线上平台声明与处理一致 | 核对后台实际资料、照片权限与目的、服务器传输和保存、删除方式、实际发布版本能力，确保与对审核员和普通用户的交付一致 | 需要用户确认 |
| P04 | 测试与正式照片通道 | 体验态使用受控公网 HTTP 测试配置，正式版在线能力关闭 | `miniprogram/config/servers.ts:2–11`、`miniprogram/config/environment.ts:5–8` | 体验条件可见，配置本身非用户文案 | 待核实：测试图限制与发布边界需与平台资料一致，正式照片业务须另行核对安全传输与授权 | 保留真实限制，若希望正式开放，另行确定 HTTPS、隐私授权、处理说明与发布范围 | 需要用户确认 |

**合计：21 项待审描述或术语问题，按高 0、中 8、低 13 计。另有 4 项保留、4 项待核实。** “高”只计本次代码中足以直接暗示 AI 问答、诊断、咨询或治疗的描述。平台已给出的两项类目要求单独列入 P01–P02，其审核优先级不受文案统计影响。

第二阶段已获批准并完成相应源码整改，本文保留第一阶段核查记录。现行结果见[完成清单](phase-2-completion.md)与[正式版专项核查](release-verification.md)。
