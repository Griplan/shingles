# V5.4 开发与验收报告

日期：2026-11-01（Asia/Shanghai）。进度唯一来源：[task.md](../../../task.md)。本报告记录证据，不另维护开发台账。

## 1. 完成情况

V5.4.1～V5.4.3 实现完成：统一正式几何和稳定标注 ID、既有 evaluate 接口兼容扩展、确认后自动计算及原 V4 结果联动。V5.4.4 的自动回归、真实本机模型/HTTP 和微信开发工具核心流程完成；真机及并发压力等未执行项见第 10 节。V5.5 未实施。

开工发现的实际缺口：V5.3 已保存完整人体 MultiPolygon，但 V4 客户端主动禁止 AI 标注，后端只接收简单 vertices，不能无损表达孔洞。因此扩展原接口的输入，不另建匹配服务。原公式、图谱和人体素材保持不变。

## 2. 实际操作流程

选择背面上背部 → AI 辅助标注 → 从相册上传公开测试照片 → 拖框松手自动 MobileSAM 分割 → 换个结果并人工确认 → 放置到人体 → 拖动、大小和方向滑杆 → **确认位置并计算** → V2 保存 → 同一个 `/api/v1/evaluate` → 自动出现全部参考区域和两侧标签。点击标签只显示该区域，“显示全部”恢复全部，均不重新请求。

结果页“调整 AI 标注 1 位置”打开独立草稿；再次确认后替换原 ID 的几何并重新计算。放弃返回保留原正式标注和原结果。原有人工三点闭合、完成、计算正常，与 AI 标注可在同一请求中按正背面分别计算。

## 3. 数据统一与安全边界

`annotationSession` 仍是唯一正式人体标注源。AI 的 `geometry` 保存 `body_template_normalized_v1` MultiPolygon，包含所有外环和孔洞；`source.kind=ai_assisted`、原照片确认快照和最终 transform 保留。照片 `photo_oriented_normalized_v1` 不被改写。

匹配请求白名单仅发送 id、view、source 枚举及完整 geometry（或旧人工 vertices）。不发送照片、Mask、提示、临时令牌、服务器路径或照片变换。模板/图谱版本和内容摘要仍必检。Schema 拒绝同时提交两种几何、照片坐标、未知字段和非法数据；单标注最多 20000 点、单请求 40000 点、2 MiB 正文限制，超限明确报错，不自动删点。

确认先完整重验几何与人体包含关系，再原子写入。重试只读已保存几何；编辑采用原 placementId 比较替换，保留稳定 annotation ID。新几何摘要使旧结果失效，旧请求不能覆盖新请求。照片服务清理不影响已确认人体几何继续匹配，也不延长临时照片期限。

## 4. 神经匹配与复杂几何

继续使用 `area(L ∩ D) / area(L)`；来源不参与任何权重。保留同面并集去重、正背面隔离、真实多候选、组合标签和面部类型、未覆盖范围。没有最近节段补齐、凸包、静默修复或裁切。

自动测试和真实 HTTP 均验证：完全相同人体几何的 manual/ai_assisted 响应一致。孔洞面积排除，多个片区保持独立，小片不丢失；单个 MultiPolygon 的非法重叠明确拒绝，不与不同标注之间的合法并集混淆。

## 5. 页面与性能

确认按钮有在途保护；失败保留已保存标注和重试入口。成功进入原 annotate 结果模式，默认显示全部，保留棕色病灶轮廓和参考图谱填充。一次性显示交接只传当前 viewport/view，保持人体 CSS 比例和中心解剖位置；两页侧栏宽度不同，可见边缘范围不同，不改变正式坐标。

继续复用 V5.3 缓存贴片、独立覆盖层和单帧调度。编辑时只从背景显示层隐藏当前编辑目标，避免旧位置重影；正式数据直到再次确认才替换，其他标注仍显示。实际微信发现该重影后修复，最新代码已重新编译并实际拖动验证。

本轮性能回归是平台适配器计时，不是 GPU/FPS：2000 点、5 片 5 孔、375 宽，120 个拖动事件/30 帧机会共 1.038 ms，0 次全顶点变换，2 次 setData；滑杆移动同样无逐帧完整变换。结束完整校验约 208 ms，确认阶段 235.178 ms。真实 HTTP 流程同步确认阶段 108.961 ms，包含几何校验和提交，不称为纯变换时间。原生首次两次匹配往返 125/135 ms，人工共存计算 170 ms；断线恢复后重试 105 ms。这些是有限次数实测，不能作为稳定性能保证。没有单独测后端 CPU 时间、桥接延迟、动画帧率或闪白持续时间；不通过相减推算。

## 6. 自动化命令与结果

环境：Apple M4、16 GiB、macOS，Node 24.11.1、TypeScript 5.9.3、Python 3.12.14，既有独立环境和 CPU MobileSAM，无新增依赖。

| 实际执行命令/方式 | 最终结果与证据 |
| --- | --- |
| `npm test --prefix miniprogram` | **275 PASSED / 0 FAILED**；重影修复后重新运行，[frontend-ghost-fix.txt](frontend-ghost-fix.txt)，1207.651 ms。包括既有 V1～V5.3 全部用例及本轮 11 项新增测试 |
| `npm run typecheck --prefix miniprogram` | PASSED，[typecheck-ghost-fix.txt](typecheck-ghost-fix.txt) |
| `backend/.venv/bin/python -m pytest backend/tests -q` | **61 PASSED**，10.47 s，1 条既有 Starlette 弃用警告；[backend-final.txt](backend-final.txt) |
| `ai/.venv/bin/python -m pytest ai/tests -q` | **78 PASSED**，1.98 s，7 条既有依赖警告；[ai-regression.txt](ai-regression.txt) |
| `backend/.venv/bin/python scripts/check_placement_geometry.py` | **1341** 例与独立 Shapely validity/covers 一致；[placement-oracle.txt](placement-oracle.txt) |
| `python3 scripts/check_project.py` | PASSED，7 页/组件/路径检查；脚本历史输出仍称 V5.3，不冒充原生验证；[project-check.txt](project-check.txt) |
| 微信 wcc/wcsc 编译全部 WXML/WXSS | exit 0，实际命令见 [native-compilers.json](native-compilers.json) |
| 临时 tsc 编译后 `node scripts/profile_placement.cjs <build> docs/validation-records/v5.4/placement-performance.json` | 8 组通过：100/500/2000 点，单片/5 片 5 孔，320/375/430 宽，拖动/滑杆/全身/确认；[placement-performance.json](placement-performance.json) |
| `node scripts/test_placement_http.cjs docs/validation-records/v5.4/http` | PASSED，真实 MobileSAM/HTTP + 生产页面逻辑的平台适配器；[real-http-first.txt](real-http-first.txt)、[real-page-http.json](http/real-page-http.json) |

前两次全前端测试失败日志保留：第一次 2 个旧用例仍要求“禁止 AI 计算”，第二次 1 个测试 fixture 缺少平台信息；按本轮授权更新预期、补 fixture，未删除旧测试。`frontend-first.txt`、`frontend-second.txt` 和后续 `frontend-final.txt` 均保留。最终重影修复只涉及前端显示过滤和断言，后端/AI/独立几何检查没有无理由重复执行。

## 7. 真实 HTTP 结果

输入仅 **1 张**既有公开测试照片：[CDC PHIL 21505](https://wwwn.cdc.gov/phil/Details.aspx?pid=21505)，CDC / K.L. Herrmann。许可与来源沿用 [sources.json](../../../ai/experiments/sources.json)，不增加患者样本，也无专家参考标注。图片不传第三方；模型和匹配均在本机。

两次实际推理耗时 1.923297 s / 0.546735 s，均 3 个候选。明确选择 candidate-1 后 **5 片、4 孔、941 点**完整进入人体坐标，70%/25°，原正面 manual 保留。背面初次 5 候选，编辑后 4 候选；正面 10 候选不变。HTTP 往返 132.964/128.805 ms。标签/全部无新请求；重试/重复确认不重复保存；同 ID 编辑替换；原照片清理返回 410 后仍能匹配，相同几何 manual/AI 响应完全一致。

这是实际模型/接口联调，但 wx/Canvas 是测试适配器，不能当成微信截图。该脚本与下面原生框选不同，片数不可混用。

## 8. 真实微信证据

微信开发工具 Stable 2.01.2510290、基础库 3.17.4、iPhone 12/13 Pro Max 模拟器。用户恢复前台并手动完整编译后，工具实际点击、拖动、滑杆完成主流程。后续重影修复再由工具完整编译并重新上传复测。未更改开发工具既有安全设置。

| 原生操作/核验 | 结果与证据 |
| --- | --- |
| 背面上背部、上传、真实拖框、换候选、确认 | PASSED；[01-segmentation.jpg](native/01-segmentation.jpg) 是换候选前的真实预览，不能当成最终 candidate-1 计数证据 |
| 拖动、72% 大小、28° 旋转、确认位置并计算 | PASSED；[02-placement-adjusted.jpg](native/02-placement-adjusted.jpg)、[first-state.txt](native/first-state.txt)：**8 片、5 孔、1015 点**，1 请求，5 个候选实例，照片未发送，viewport 衔接一致 |
| 自动全部、两侧标签、T3 单区、显示全部 | PASSED；[03-automatic-all.jpg](native/03-automatic-all.jpg)、[04-single-region.jpg](native/04-single-region.jpg)，切换不请求 |
| 编辑前保留旧正式数据/结果，确认后替换 | PASSED；[draft-state.txt](native/draft-state.txt)、[edited-state.txt](native/edited-state.txt)、[05-edited-result.jpg](native/05-edited-result.jpg)；同 ID、仍 1 组、源照片不变，新几何等于请求几何，新位置显示 T5～T8 的实际候选实例，无旧填充残留 |
| 正背面切换，人工三点闭合、完成、双击计算 | PASSED；[manual-state.txt](native/manual-state.txt)：累计只增加 1 请求，同一载荷含 front manual 与 back ai_assisted，正面 4 候选 |
| 最新代码：真实关闭测试后端后双击确认，再恢复重试 | PASSED；[06-network-failure.jpg](native/06-network-failure.jpg)、[retry-state.txt](native/retry-state.txt)：1 次连接失败、1 次成功，两次 lesions 一致，仍 1 组，自动 6 候选，无重新分割 |
| 最新代码：编辑拖动无旧位置重影 | PASSED；[07-edit-without-ghost.jpg](native/07-edit-without-ghost.jpg)、[edit-layer-state.txt](native/edit-layer-state.txt) |
| 放弃编辑，返回并重新进入 | PASSED；[cancel-state.txt](native/cancel-state.txt)：正式几何逐字一致，原结果模式/6 候选仍在；[08-final-result.jpg](native/08-final-result.jpg) |
| 图谱未覆盖位置 | PASSED；先只读现有 body 与 atlas 求差确认手部未配置，然后实际将同组贴片缩到 17%、全身视图拖到背面手部，点击确认。页面 **0 候选、0 填充、覆盖 0%**，保留 1 组正式标注；[09-uncovered.jpg](native/09-uncovered.jpg)、[uncovered-state.txt](native/uncovered-state.txt)。没有添加最近节段或更改图谱 |

上述控制台仅安装临时请求计时包装和读取状态，不注入预测、几何、响应或替换业务方法；包装已恢复。实际截图为原始工具截图，无重新绘制。台账区分实际工具手势与自动化事件适配，不称真机触摸验收。

## 9. 实际问题与修复记录

1. 新增模块热更新时旧页面曾报 `placement-navigation.js not defined`；源文件存在，完整编译后恢复，不能用热更新缓存状态代替干净构建。
2. 旧人体标注在编辑背景和动态层重复显示，移动后产生重影。只过滤当前草稿的显示背景目标，正式会话不变；单元断言和最新微信复测通过。
3. 本机网络在受限执行环境中初次访问失败，改用获准的本机网络执行后真实 HTTP 通过；不是业务假成功。
4. 原生测试控制台两条只读诊断写错字段（`leftLabels`、`placementTransform`），产生诊断 TypeError；已改为实际字段重新记录成功结果。故不将整个验收日志描述为 Errors 0。断线实验另有预期连接失败，平台弃用/worker 警告保留，不伪装清零。
5. 本次断线实验仅停止本轮自己的测试服务，随后已恢复，健康检查成功。正式照片/患者资料未使用；未提交、未推送 Git。

## 10. 限制、风险与 NOT_RUN

- 真机、相机、不同实际手机屏幕、弱网持续压力、快速连续返回的竞态压力、20,000 点最坏原生性能：**NOT_RUN**。320/430 宽是坐标与 Canvas 适配器测试，不是实际多设备验收。
- 迟到 A/B、版本错误、无效几何、上传/会话失效、页隐藏等已有自动化覆盖；未逐项在原生注入每种失败。原生验证覆盖真实断线和正常返回重入，不能宣称全部压力分支通过。
- 仍跨原有两条路由，保持 CSS 比例和中心位置，周边可见范围因侧栏而不同；没有录制逐帧视频证明绝无闪白。复杂几何最终检查仍耗时，保留 V5.3 原生 0.58～0.65 s 收尾历史，不称全部卡顿消失。
- 只有一张公开实验照片重复使用，没有医学准确率、专家分割真值或临床定位验证。位置和大小由用户确定；AI 形状质量、人工放置误差和图谱医学审核独立于工程测试。
- 图谱医审仍 pending，正式医学映射未启用；仍限开发测试。真机部署需要合法 HTTPS 与可信后端，不接受真实患者上传。V2 是运行内会话，重编译/关闭可能清空。

## 11. 文件变更与验收结论

新增：`placement-navigation.ts`、前端 2 个 AI 匹配集成测试、后端 `test_ai_matching_integration.py`、`docs/v5-ai-integration.md` 和本证据目录。

修改：后端 evaluate Schema/几何适配/main 大小限制/路由说明/matcher 输入读取；前端 evaluate 类型、annotation/placement/matching 会话、coordinate 的显示视口衔接、body-canvas、placement 和 annotate 的 TS/WXML；旧 placement-session 测试、真实 HTTP 联调脚本；README、task 和 architecture/api/validation/AI/placement 文档。相对开工 766 文件指纹，本轮修改 24 个既有源码/测试/文档，新增 5 个源码/测试/设计文件及验证目录；105 个受保护源码/固定数据文件未变，0 个基线文件缺失。完整分类清单与保护检查见 [changes.json](changes.json)、[protection-check.json](protection-check.json)。

结论：**V5.4 工程实现和自动化回归完成，微信开发工具主流程及上述异常分支通过，可交付用户验收；不等同全部设备、极端性能或临床验收。** 核心标准已证明：人工确认后的 AI 人体几何进入同一 V4 服务，自动高亮，与相同人工来源几何等价。

## 12. V5.5 准备情况

已有完整人体几何、稳定 ID、来源快照、修订/迟到保护和统一结果入口，可供下一阶段复用。V5.5 **TODO**；候选待办为真机/弱网/大几何验收与当前限制处理，须由用户确定下一阶段范围，本轮不实施。
