# V5.2 极简交互验证 · 2026-10-28

本轮仅前端页面、照片画布、请求编排和照片框防误触。唯一阶段状态见根task.md；V5.3未实施。环境沿用本机Python3.12.14、Node24.11.1、TS5.9.3、微信Stable2.01.2510290/base3.17.4。旧服务127.0.0.1:8000复用，无模型/依赖/后端改动。

## 交互改动

- 上传后默认框选，只提示“请框住需要识别的皮疹区域。”；相册/拍照保留，已有照片时合并为更换照片菜单。
- 移除主流程的“AI分割”和三个编号候选按钮；默认隐藏前景、背景、撤销、重置。真实覆盖层仍需点击“确认识别范围”。“换个结果”只循环源序可用候选，不按分数、不重新请求。
- “精细调整”低调入口保留两类提示、撤销及重新识别，回到同一确认流程。失败可重新圈选/返回手动；异常保护、用途说明和临时清理不删除。
- 框归一化宽高各≥0.02、面积≥0.0016，显示边长各≥12 CSS px；这是交互门槛而非医学判断。只在touchend提交，重复同框忽略，在途时仅排队最新框；重置/取消/换图失效旧请求。
- 原照片不因分析而卸载；覆盖图切换下载时保留上一帧但禁确认，所有资源就绪后同步提交完整帧。无复杂动画。

## 实际执行

| 命令/方式 | 结果 | 证据 |
| --- | --- | --- |
| `npm test --prefix miniprogram` | 198 PASSED（原184+新增14），失败测试修正记录保留 | frontend-fixed.txt |
| `npm run typecheck --prefix miniprogram` | PASSED | typecheck-final.txt |
| `backend/.venv/bin/python -m pytest backend/tests -q` | 47 PASSED，1条既有弃用warning | backend.txt |
| `backend/.venv/bin/python scripts/check_project.py` | 六页/组件配置PASSED | project-check.txt |
| 微信自带wcc/wcsc编译页面和组件 | 两项exit0，准确命令在JSON | native-compile-final.json |
| `node scripts/test_ai_simple_http.cjs` | PASSED，生产页+组件+传输经适配器请求真实MobileSAM | real-page-http.txt / real-page-http.json |

新增测试检查有效框一次/小框零次、拖动无请求/重复touchend、最新B/C合并、换照片和取消清队列、载入覆盖图时不清空旧帧、切换过程中不能确认、候选无效时失败、精调默认折叠/两点/撤销/重识别、照片更换清理、原照片坐标/含孔多片确认、回手动。原有V1～V4测试保留。独立AI78本轮未重跑（模型和后端未改）；不复用昨天结果冒称今天新测试。

## 真实模型与坐标

固定公开CDC21505一张700×460，沿用V5.1许可记录。测试脚本编译生产TS，生产photo-canvas接收模拟touchstart/move/end，真实aiTransport上传/下载和请求本机服务；wx的网络/图片解码和Canvas接口由适配器提供。不是微信原生操作，不是假模型。

无效1px框零请求；有效框[215,245,495,385]松手后恰好1次真实推理，移动和重复松手没有额外请求；0.935695s，3个真实候选。默认仅预览；切换不推理/不确认。精调增加[430,328]前景和[500,350]排除点后显式重识别一次0.800174s，仍3候选。选candidate-1并一次确认：photo_oriented_normalized_v1、5片4孔、Mask SHA保留；取消后GET410。计时是本机单次HTTP，不宣称一般性能/医学准确率。测试不改变人体图谱。

## 原生微信范围

已实际打开Shingles、完整编译Errors0、从人体胸部进入新AI页、用途说明、相册选择公开CDC21505、成功上传并看到默认圈选提示；未出现技术模式按钮。`wechat-upload.png`是本轮真实窗口截图。原生自动拖动两次没有形成有效框，不能因此宣称松手/候选/确认真实触摸已通过；已请求用户手工圈选协助，后续结果另行追加。此前V5.2截图不当作本轮新界面验收。

NOT_RUN：本轮原生完整圈选→自动识别→候选→精调→确认（当前待协助）、真机/相机、原生多屏、实际连续录屏/零闪白、GUI网络故障及迟到竞态。自动化覆盖不代替这些设备测试。

## 实际失败与修复

- 首轮原184测试及类型检查通过。新增14项首轮有2项测试记录器断言失败：导航flag写到被展开复制前的对象；boxinvalid之后还会发送renderstate，不能断言它是最后一个事件。改为记录导航数组和筛选事件次数后198全通过，不伪称产品错误。
- 首次WXML编译FAILED：表达式中的XML实体 `&amp;&amp;` 被微信当作表达式字符，报unexpected `;`。改为WXML实际支持的 `&&` 后完整编译/原生编译器通过；首个错误摘录留在native-compile-first.txt。
- 原生自动拖动未产生有效圈选；未通过篡改坐标、直接伪造UI结果或重复手绘Mask绕过。真实模型链路有独立HTTP适配证据。

## 修改范围

生产：pages/ai-annotate三个文件、state/ai-session.ts、components/photo-canvas/photo-canvas.ts、utils/photo-coordinate.ts。测试：新增ai-simple.test.cjs，扩展photo-canvas.test.cjs；新增test_ai_simple_http.cjs真实联调脚本。文档：README、v5-ai-segmentation、architecture、task及本证据目录。未改MobileSAM/FastAPI/类型契约/上传服务/身份与清理/正式人体图谱/匹配逻辑，未提交或推送Git。

开工614文件指纹对比：11个既有文件变更；225个受保护源代码、资源和测试文件全部一致，未发现意外改动或文件缺失。完整清单见[protection-check.json](protection-check.json)。阶段状态和原生待验事项见根[task.md](../../../task.md#v52-极简交互改造2026-10-28)。
