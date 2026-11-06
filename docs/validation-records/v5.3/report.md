# V5.3 人体放置：实施与验证记录（2026-10-31）

唯一阶段进度见根 [task.md](../../../task.md)。本记录区分生产代码测试、真实本机模型HTTP适配测试和原生微信操作；不把静态图、Node事件或过去V5.2截图记为本轮原生验收。

最新结果已追加到本文末尾的2026-11-01收尾记录：248项前端通过及原生主要流程截图。10月31日编写时的pending/242项结论按历史保留，不作为最新验收范围。

## 实施内容

照片确认页增加“放置到人体”，通过运行内草稿ID进入“确认病灶位置”。继承当前正/背面及粗部位，初始聚焦；在人体上叠加半透明橙红色贴片，以单指拖动或可见移动柄移动整组，用10%～400%大小滑杆、-180°～180°方向滑杆及重置调整。全身/部位切换只改变显示视口。最终“确认位置”后固定范围，并可进入原V2标注页查看；不调用V4。

原照片确认对象不变。先将照片归一化坐标乘方向统一后的原图宽高，围绕所有片区的统一像素中心做相似变换，再进入400×900人体逻辑坐标并归一化。所有片区、孔洞、顶点顺序及相对位置保留；不使用凸包、连接线或静默简化。具体公式和字段见 [V5.3说明](../../v5-placement.md)。

准备源几何时显式限制总顶点20000、片区1024和每片环数4096，超限保留原结果并明确失败。拖动只更新本地草稿，不向后端请求；触摸结束及确认均做完整几何/人体包含校验，不用人体包围盒或只看顶点。跨手臂与躯干、腿间空白、人体孔洞及真正越界都阻止确认；不裁切或自动移动位置。

V2保留schemaVersion1及旧手工ring，新增可选完整geometry和ai_assisted来源。一个贴片是一个正式标注对象，内部可含多个Polygon/孔洞。提交重验source身份/期限、模板/view、会话token/revision、重算几何和完整人体包含，然后一次原子追加；重复确认幂等，旧手工标注不覆盖。渲染和命中使用完整geometry。旧V4传输只支持简单环，因此含AI几何的会话在传输入口明确阻止计算，避免遗漏片区/孔洞；匹配算法和图谱未改。

navigateTo保留源照片页及30分钟TTL。自定义返回提供继续/放弃；平台不能覆盖所有原生返回手势时保留当前运行内草稿，并在照片页给继续入口和范围说明。source更换/失效和控制器lease阻止旧回调；AI文件过期或删除不清掉已保存人体几何。原图/Mask引用仍受原期限约束，不是永久照片档案。

## 实际自动化与独立审核

| 命令或方式 | 实际结果 | 日志 |
| --- | --- | --- |
| `npm test --prefix miniprogram` | 当前最新记录 **242 PASSED，0 FAILED**；后续新增回归以最终日志/根台账为准 | frontend-after-review.txt / frontend-display-review.txt |
| `npm run typecheck --prefix miniprogram` | PASSED | typecheck.txt |
| `backend/.venv/bin/python -m pytest backend/tests -q` | **47 PASSED**，1条既有warning | backend.txt |
| `ai/.venv/bin/python -m pytest ai/tests -q` | **78 PASSED**，7条现有模型/库warning | ai-regression.txt |
| `backend/.venv/bin/python scripts/check_project.py` | PASSED，7页/组件注册/Canvas配置 | project-check.txt |
| 微信自带wcc/wcsc编译全部页面及组件 | 两项exit0；不是原生交互测试 | native-compilers.json |
| `backend/.venv/bin/python scripts/check_placement_geometry.py` | **1341例**与独立Shapely validity/covers一致 | placement-shapely-final.txt |
| `node scripts/test_placement_http.cjs docs/validation-records/v5.3` | PASSED，生产页面/组件经wx适配器调用本机真实MobileSAM，再保存到V2 | real-page-http.json / real-placement-http-first.txt |
| 开工指纹与保护核对 | baseline655文件；115个受保护文件未变，无缺失 | protection-check.json |

前端覆盖独立手算0/90/180度、不同照片/人体比例、组合变换/面积比、多片/小片/孔洞、非法参数、完整包含与真实正背空隙；会话覆盖草稿不提交、原子失败、旧manual保留、重复确认、错版/错面/旧修订、TTL/lease/旧回调、V4结果失效和请求阻止；组件覆盖拖动顺序、取消、控制柄及视口切换，页面覆盖滑杆和确认状态。既有V1～V5.2测试保留。

独立Shapely审核使用四种合成人体加当前实际正背轮廓，固定seed20261031，每人体220个生成例及21个手工例。1337例首轮通过后，新增孔洞两点接壳与洞链桥接外壳的反例，1340例首轮有2处差异：旧实现误接受内域不连通的Polygon。修复采用环—唯一接触点二部图环检测；单点接壳和三个洞共享单点仍合法，最终1341例全部一致。首轮成功、后续失败、最终成功日志全部保留，不覆盖历史。

## 真实模型HTTP链路

输入实际只有既有合法公开CDC PHIL21505一张700×460测试图。生产AI页/照片画布经平台适配器发真实HTTP：框选自动分析0.787338秒、精调后0.991007秒，每轮3个真实候选；显式选择candidate-1确认，返回5片、4孔、941点及Mask指纹。它没有专家参考标注，不能给出医学准确率。

随后使用生产放置页面、贴片组件和会话模块，在背面上背部初始化，模拟拖动，调整为70%与25°，回全身检查变换不变，重复点确认，再进入生产V2页恢复。同一权威会话保留正面原manual对象1个，追加背面AI对象1个，完整5片4孔941点。调整阶段后端请求增量0；两次位置确认后仅1个正式AI对象；source JSON不变。删除临时照片后素材读取410，而正式body对象仍保留。这是有真实模型的工程HTTP适配验证，**不是微信触摸或真实患者验收**，人体拖动阶段也没有调用V4。

补充纯几何计时使用该公开样本的历史几何，不是新推理/有效会话：prepare11.496ms、transform0.265ms、完整人体包含校验101.822ms，5片4孔941点，见geometry-public-performance.txt。仅本机单次值，不外推手机FPS或20000点上限压力表现。

## 原生微信范围

截至本记录编写：工具能读取已有开发窗口，但反复切到另一项目，已请用户将Shingles置于前台。**V5.3新流程原生操作目前NOT_RUN，待补记**。开发工具首页可见或wcc/wcsc通过，都不能外推为照片→人体拖动→V2保存已原生通过；旧V5.2协作截图也不复用为本轮证据。

原生待测步骤：背面部位→真实AI分割并确认→放置页→拖动/大小/角度→全身/聚焦→越界拒绝→有效确认→V2恢复→重入→手工标注回归，以及取消/返回。真机、相机、多屏、GUI故障/竞态压力、连续录像和临床定位效果仍NOT_RUN。若后续完成，追加操作者、实际步骤及原始截图，不改写前述等待/失败事实。

## 文件变更

本轮精确变更文件清单见 [changes.json](changes.json)，保护统计统一见 [protection-check.json](protection-check.json)：baseline655，115个受保护文件未变，无缺失。根开工指纹位于本机 `/private/tmp/dermatome-v53-baseline.json`，不把Git全部未跟踪文件误算为本轮改动。

- 新增生产：`types/placement.ts`、`utils/placement-geometry.ts`、`state/placement-session.ts`、`components/placement-overlay/`四文件、`pages/placement/`四文件。
- 修改生产：`app.json`注册页面；`types/annotation.ts`和`state/annotation-session.ts`扩展原子AI写入；`utils/annotation-geometry.ts`导出既有几何助手，`utils/coordinate.ts`补充有限越界草稿投影；`lesion-render.ts`完整多片/孔洞绘制；`state/matching-session.ts`阻止不兼容V4请求；`pages/ai-annotate`的TS/WXML增加交接入口；`pages/annotate`的TS/WXML显示已保存AI范围及计算限制。
- 新增测试/工具：`placement-geometry.test.cjs`、`placement-session.test.cjs`、`placement-overlay.test.cjs`、`placement-flow.test.cjs`；`check_placement_geometry.py`独立审核，`test_placement_http.cjs`真实链路。`check_project.py`加入新路由/组件静态检查。
- 文档：新增`docs/v5-placement.md`及本验证目录；更新README、architecture、atlas-spec、validation、v5-ai-segmentation和唯一台账task。

MobileSAM、权重、原后端/匹配算法、正式人体素材与模板比例、神经图谱及医学审核状态未改。没有新框架、数据库、付费API、训练、Git提交或推送；V5.4～V5.5保持后续范围。

## 2026-11-01 最终增量与实际微信

最终前端命令 `npm test --prefix miniprogram` **248 PASSED、0 FAILED**，日志 `frontend-acceptance-final.txt`；基线203保留、新增45项。最终类型与结构见 `typecheck-final.txt`、`project-check-final.txt`。后端47和AI78的本轮回归结果仍见上表，没有重复计数。新增placement-navigation五项检查AI取消/换图/手动返回/到期先释放未保存草稿、V2返回跳过AI中间页；另增退出弹框文字长度/继续与放弃保护测试。

最终真实模型联调执行 `node scripts/test_placement_http.cjs docs/validation-records/v5.3/final-http`：PASSED；完整结果在 `final-http/real-page-http.json` 和 `real-placement-http-final.txt`。同一CDC源照片再次执行，不算新医学样本；两轮HTTP耗时0.761202s和0.679637s。完整5片4孔941点、背面70%/25°、零放置请求、原手工标注保留、重复确认幂等、全身变换不变、V2恢复及删除原照片后人体数据保留均再次通过。

原生环境为Shingles项目、微信Stable2.01.2510290/base3.17.4、选择器显示iPhone12/13 Pro Max。用户将该项目置前台后，以下操作由工具在真实UI完成，未通过setData、伪造结果或直接调用页面方法冒充触摸：

| 原生操作 | 实际结果与证据 |
| --- | --- |
| 选背面上背部、上传既有公开CDC21505、拖框松手自动识别、显式确认 | PASSED；wechat-ai-result.png |
| 进入放置页，看到对应背面及橙色真实轮廓 | PASSED；wechat-placement-initial.png |
| 按移动柄拖动整个贴片 | PASSED；wechat-placement-dragged.png；移动后位置确实变化，初次观察曾捕获尚在拖动的中间帧，不把它当终态 |
| 实际滑杆点击缩小为71%、旋转25° | PASSED；wechat-placement-adjusted.png。AX setValue未形成有效滑杆操作，后改实际点击；GUI数值与HTTP70%不同 |
| 回全身再聚焦，贴片仍在背部同一相对位置 | PASSED；wechat-placement-full.png |
| 移出人体有效范围，再移回 | PASSED；出现“部分病灶范围超出人体，请调整位置或大小。”并禁确认；移回后恢复；wechat-placement-outside.png |
| 双击确认位置、查看原V2页 | PASSED；位置已确认文案、仅1组AI对象；wechat-placement-confirmed.png / wechat-v2-restored.png |
| 原V2新增人工三点并闭合，完成标注、全身查看 | PASSED；AI标注1与区域2共存，背面2组；wechat-v2-manual-and-ai.png / wechat-v2-full.png |
| 原生返回原AI照片页 | PASSED，确认范围/放置入口仍保留；未以此声称完整的部位选择后重入验收 |
| 修复退出提示后完整重新编译、重新上传/识别、再次进入未提交放置 | PASSED；退出框确实出现“继续调整 / 放弃返回”，并测试继续调整；wechat-exit-dialog-fixed.png |

原生提示与HTTP实验不同，未采集GUI精确顶点/孔洞计数，不把941点/5片4孔套到GUI截图。用户选择人体部位只作导航；分割范围中仍可能包含正常皮肤，原生工程保存成功不是临床效果验收。

实际失败与修复：自定义退出按钮最初没有提示，控制台通过只记录静态文案/页面布尔状态的临时诊断确认 `showModal:fail confirmText length should not larger than 4 Chinese characters`。5字“放弃并返回”改4字“放弃返回”；仅文件热更新仍运行旧页面缓存，完整编译后弹框成功。诊断包装仅用于记录调用失败，没有改变候选/位置/会话；编译前恢复原wx.showModal，完整编译重建运行时。初次失败摘要在 `native-exit-failure.txt`。

审查还修复：切视口需当前viewportKey的真实覆盖帧ready；隐藏/resize打断拖动时补最终校验；删除已保存AI对象后不能误显示旧confirmed状态；V2返回按真实栈找选择页；照片清理同时释放未确认几何。旧失败/中间日志均保留。

原生补充NOT_RUN：最终“放弃返回”的离开分支、保存后返回部位再重入的完整路径、系统滑动返回恢复、GUI断网/TTL/过期回调压力、重置按钮真机触摸；自动化已覆盖对应状态，不能替代设备结果。工具末尾再次切到其他项目，任意坐标点击返回noWindowsAvailable，因此停止对错误窗口的操作。真机、相机、多屏、连续录屏/FPS、20000点最大负载、医学专家验收仍NOT_RUN。当前主流程有真实证据，未宣称所有原生/设备验收全部通过。
