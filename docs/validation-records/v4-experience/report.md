# V4体验精修验证记录

日期2026-10-26～27；macOS、Node v24.11.1、TypeScript5.9.3、Python3.12.14、现有项目依赖。测试输入为synthetic标注、既有真实参考图谱及组件适配器。完整进度只在task.md记录。没有新依赖或Git提交/推送。

## 命令与证据

均在项目根执行，命令退出0才计通过。

| 命令 | 结果/日志 |
| --- | --- |
| `npm test --prefix miniprogram` | 最终154项，frontend-resume-final.txt（154/154）；动画中断、取消、终止、无帧降级、稳定节点、模态隔离、视图准备竞争、缓存、旧请求/结果和既有V1～V4回归 |
| `npm run typecheck --prefix miniprogram` | typecheck-completion.txt |
| `backend/.venv/bin/python -m pytest backend/tests -q` | 47 PASSED，backend.txt；1条既有httpx弃用警告，无后端改动 |
| `node scripts/test_matching_http.cjs` | http-final.txt：真实localhost API，单页确认→计算全部→标签/放大/筛选→编辑失效→重算→背面→无覆盖→缓存；断网由适配器注入，其他成功结果真实HTTP。不是微信触摸测试 |
| `backend/.venv/bin/python scripts/check_project.py` | project.txt，目录/JSON/路由组件配置PASSED |
| `backend/.venv/bin/python scripts/sync_atlas.py --check` | atlas-sync.txt，规范数据与包内副本一致 |
| `backend/.venv/bin/python scripts/sync_matching_body.py --check` | body-sync.txt，与原V2人体轮廓导出一致 |
| 微信工具自带wcc/wcsc，完整参数见日志 | native-wcc-completion.txt / native-wcsc-completion.txt，原生模板/样式编译；非GUI验收 |
| `node scripts/profile_canvas_workflow.cjs docs/validation-records/v4-experience/body-canvas-before.ts.txt` | canvas-counters.json，确定性组件计数，非原生GPU/像素/FPS性能实验 |

最终HTTP适配器首请求：networkMs104、requestAndValidationMs105、prepareMs0（毫秒分辨率，不表示没有开销）。原生模拟器单独有networkMs161和缓存淡入transitionMs211的样本；不得混合成一次端到端时间，见gui-validation.md。

## 优化前后计数

相同207×363、DPR2、初始化后20次同面单区/全部交互、关闭动画。基线为开工保存的旧body-canvas，绘制helper使用当前版本，所以只比较组件测量、上下文获取、资源和清屏策略，不比较旧像素输出。

| 指标 | 原组件 | 当前组件 |
| --- | ---: | ---: |
| 节点尺寸查询 | 22 | 1 |
| getContext调用 | 22 | 1 |
| 图片创建/加载 | 1 | 2（正背预载） |
| width写入 / height写入 | 1 / 1 | 1 / 1 |
| 人体绘制 | 21 | 21 |
| 图片就绪前清屏 | 1 | 0 |
| 组件setData调用 | 22 | 2 |

getContext调用次数不等于创建22个不同上下文。原图片本来缓存，不伪称降低了20次PNG解码。增加正背预载是内存与换面等待的取舍。没有录屏、真机FPS或功耗测量。

## 失败保留与修正

- frontend-first.txt：首轮149项中11失败，主要旧复核复位/结果页与新同页策略断言、最后事件改为renderstats等测试前提变化；按新要求改断言并增加直接行为检查。
- frontend-second.txt：151/152通过，测试载入模块缓存仍引用旧Page定义；macOS临时目录符号链接导致缓存路径不同，改用require.resolve准确清除。frontend-third.txt152通过；随后新增门禁与模态回归，frontend-final.txt153通过、frontend-modal-final.txt154通过，最终另存frontend-completion.txt；随后补页面hide/show无重复淡入检查，frontend-resume-final.txt仍154/154通过，不覆盖前述日志。
- http-sandbox-failed.txt：受限网络无法连本机服务，获准后真实本机流程通过，http-local.txt及http-final.txt保留。失败不是伪造后端成功。
- 真实说明面板被原生Canvas覆盖：FAILED后修复，实际面板可读、复制回执、关闭恢复PASSED；增加隐藏不销毁/不漏触摸和计时不覆盖测试。
- 原生热更新缺模块、样式选择器警告、320切换后页面/截图不同步按gui-validation.md原样记录。完整编译通过不代替动态验收。

93个保护文件hash一致，见protection-check.json。当前runtime变更仅体验直接相关前端；annotation-session只改展示聚焦规则，api只添计时。资产、图谱、粗分区、医学状态、匹配逻辑/比例、API字段、后端、依赖和环境门禁未改。
