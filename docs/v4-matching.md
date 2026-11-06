# V4 开发报告

> 以下保留基础阶段的历史实现与验证记录。2026-10-26后续交互改造、一次计算默认全部上色及新的真实模拟器证据见[V4交互联动说明](v4-interaction.md)；进度以task.md最后追加记录为准。

本文件说明实际实现；唯一总进度仍为[task.md](../task.md)。日期2026-10-26。本轮没有人体/图谱重绘、医学审核升级、病例持久化、AI、新依赖或Git提交/推送。

## 1. 实际完成情况

V4.1数据对接/契约、V4.2匹配核心、V4.3真实接口与基础结果页已实现。V4.4自动化回归及真实本机HTTP联调完成；微信完整触摸闭环、多屏实际布局和手机仍NOT_RUN，不能宣称V4全面验收。既有V3.1背面足跟覆盖阻塞及医学pending保留。

## 2. 操作入口

按README启动仅本机开发后端。微信工具打开原miniprogram项目，重新编译：进入人体模型→选择部位→开始标注→三点以上有效闭合→完成标注→“查看对应神经区域”。首次进入结果自动计算；没有有效完成片区不可进入，有草稿沿用V2继续/放弃/取消处理。结果可按正背、单片/当前视图汇总查看，点击候选高亮；“返回编辑（保留标注）”回到原会话。修改后须重新计算。失败可重试，无假结果兜底。

模拟器默认127.0.0.1:8000，真机URL在config/api.ts显式配置，目前为空，不把电脑localhost冒充手机地址。前端develop；后端development/test加ENABLE_REFERENCE_MATCHING=1，正式环境始终拒绝当前预览匹配。只用合成标注联调。

## 3. 数据与版本

| 身份 | 实际值 |
| --- | --- |
| 人体模板 | commons-neutral-v1 / 4.0.0 |
| 几何/逻辑画布 | commons-blank-cc0-v1 / 400×900 |
| UI粗区修订 | commons-blank-cc0-v1-ui-regions-2 |
| 图谱ID/版本 | goran-2022 / goran-2022-commons-template4-preview.2 |
| 图谱内容SHA256 | 8689fca1aa50cff0b1b7d7cd1adcd80cf244cd1a93ed580e91406d0cc2fb2056 |
| V2同源人体导出SHA256 | 59979433be334f53a705f90a484aadc312a426387f4c1a3b59a718393fbf426a |
| 覆盖/状态 | 正54、背60实例；医学pending，mappingEnabled=false |

唯一规范图谱为data/atlas/goran-2022-preview-v2，包内atlas.generated保持同源。后端每次验证七输入校验与版本，人体另由现有hitOutline确定性导出并检查源文件SHA；不维护第二份手绘人体。保存61个保护文件的前后SHA，人体、粗区、图谱、V2核心和原Canvas逐字未改。

图谱沿用Goran_tek-en / Wikimedia Commons / CC BY-SA 4.0及原修改说明，源链接由manifest返回，前端保留署名、覆盖限制和待审核说明。人体Commons CC0许可不变。工程计算不改变医学准入状态。

## 4. 匹配规则

候选按(分区类型、label、解剖侧别、view)分组并集，保留全部region IDs、多片和孔洞；组合标签不拆分。单片比例=交集面积/该片面积；同面汇总先把标注取并集，以并集面积为分母。图谱总覆盖也用所有参考区域的并集，未覆盖单列；候选比例之和可能超过100%。正背分别计算，不合成全身面积，不转换cm²、不当诊断置信度。

边界零面积无候选，阈值max(1e-18,标注面积×1e-12)只处理浮点噪声，不设置业务小面积过滤。守恒失败报错，不截断掩盖。无覆盖为正常结果，不补最近邻。后台独立拒绝自交、重复点、退化、体外、错版与超限；人体内图谱空白不算输入非法。完整[公式/容差/错误码](api.md)。

## 5. API

复用POST /api/v1/evaluate；不另建match。请求含request_id、annotation_revision、identity、lesions(id/view/vertices)，不含照片、入口区过滤或任意文件路径。响应含身份、方法/来源/待审核状态、逐片lesions、逐面views、候选及未覆盖、warnings。错误统一顶层error.code/message；403/404/409/413/422/500/503分流，格式错误不回显坐标。

[可复现合成请求](validation-records/v4/synthetic-request.json)及[实际响应](validation-records/v4/synthetic-response.json)来自真实核心；CLI输出逐字段一致。health200与旧version:v0保持兼容，GET atlas保留501；evaluate默认403，显式开发测试后真实计算。前端和OpenAPI已同步。

## 6. 结果展示与旧结果防护

复用原body-canvas、atlas-render、lesion-render及坐标/放大逻辑。棕色轮廓是人工标注，彩色填充是选中候选的完整参考区域；不把整块参考区域说成病灶。单片及并集的比例由后端返回，前端只格式化。小正数显示<0.01%，避免显示成0%。

请求冻结当前标注与身份。几何key包含ID、点、view、模板及图谱校验；显示缩放、焦点、查看面不影响key。改变标注/清空/换版即清除结果和高亮；序号+当前key检查拒绝迟到A覆盖新B；离页停止接收结果。一次加载只发一个请求，失败保留标注。联调修正了草稿闭合后丢失stale提示的问题，失败证据保留。

## 7. 文件变更

- 后端：evaluate路由/Schema、atlas_service、dermatome_matcher、geometry、main环境/字节边界及统一错误；common错误类型。
- 前端：matching-session、matching-body生成身份、evaluate类型、API配置/请求模块、独立开发开关；annotate入口、result四文件、首页数据去向文案。
- 数据/工具：仅新增同源body导出；sync_matching_body、evaluate_annotations CLI、HTTP页面联调、离线preview_matching；更新旧smoke与导航静态检查以匹配当前契约。
- 测试：真实图谱参照点、合成手算、接口校验、状态竞争与原功能回归。
- 文档：README/API/架构/验证/图谱规范/隐私、AGENTS授权和task，证据目录。

完整[相对开工基线变更清单](validation-records/v4/changes.txt)。仓库原本整体未跟踪，未把git status所有文件当作本轮新增。

## 8. 测试结果

| 实际命令/范围 | 结果 |
| --- | --- |
| backend/.venv/bin/python -m pytest backend/tests -q | 47 PASSED，1条既有httpx弃用警告 |
| npm test --prefix miniprogram | 143 PASSED，含原V1/V2/V3及新增V4 |
| npm run typecheck --prefix miniprogram | PASSED |
| node scripts/test_matching_http.cjs（本机服务启动后） | PASSED：生产页面定义+V2状态+真实API，wx平台适配，非GUI |
| backend/.venv/bin/python scripts/smoke_backend.py | PASSED：真实生产配置HTTP 200/501/403；临时服务关闭 |
| sync_matching_body.py --check / sync_atlas.py --check | PASSED，两端同源和身份一致 |
| check_annotation_geometry.py | 2421个确定性比较PASSED，不是医学准确率 |
| test_atlas_extensions.py / test_atlas_geometry.py | 6/6、5/5 PASSED |
| check_preview_atlas.py / check_body_regions.py / check_atlas.py / check_project.py | PASSED |
| 官方wcc/wcsc全五页及两个组件 | exit0；不等于GUI通过 |
| 12个人工预选实际图谱位置及114实例算法内部点 | PASSED；两者分别记录，非临床验证 |
| 微信触摸闭环、多屏真实布局、真机、实际trial/release | NOT_RUN |

命令输出见[汇总](validation-records/v4/checks.json)、[真实HTTP](validation-records/v4/http-page-integration.txt)、[失败与修正](validation-records/v4/failures-and-fixes.md)。首次失败未删除，没有用放宽容差/改医学数据换通过。

## 9. 实际运行证据

[离线真实资源与计算结果图](validation-records/v4/matching-preview.png)包含正背、胸部局部、未配置头发；图中标注明确合成，图像明确不是微信截图。已目视核对人工轮廓与完整参考区域的区别。数值来自实际matcher。

微信项目已重新打开并加载V4首页，但AX点击未可靠导航，坐标操作出现noWindowsAvailable，画面与辅助树不一致，不能完成实际画点。未伪造结果运行截图。详细[GUI记录与人工补验步骤](validation-records/v4/gui-validation.md)。真实HTTP页面流程涵盖画片→结果→选候选→返回新增→失效→重算→背面→无覆盖→失败重试，但替换了平台API，不冒充真机。

## 10. 已知限制

工程：真实触摸、滚动、三种屏幕布局和真机网络未验；仅本次运行内暂存；当前无身份认证/生产部署能力，预览匹配受环境双重限制。手机地址尚未配置；V2贴边1e-12数值容差与后端严格covers存在极小边界差异，后端会明确拒绝并保留标注，不裁切。

图谱：手掌手指、前会阴、部分头皮/耳部、背面足跟等未配置；背面足底源不能强套足跟。数字化可能有微小留白，本轮如实报告未覆盖，没有修改边界掩盖。仅二维投影。

医学：全部pending，缺专业人员配准/覆盖审核。人工参照点与几何自动化不证明真实神经分布或临床准确率；正式医学映射仍禁用。

## 11. V4 验收结论

实现完成：V4.1–4.3。自动化/本机HTTP通过：V4.4可执行部分。真实小程序完整交互：NOT_RUN，须按GUI清单补验后由用户判断验收。医学审核：pending。当前不能称“V4所有验收条件通过”。本轮停止于V4，无报告导出、病例管理或诊断功能。

## 12. 后续交互增量（2026-10-26）

后续授权已实现确认范围立即填充、一次计算默认展示全部实际候选、人体两侧标签与单区/全部切换。更新了首次导航对stale状态的处理，保留缓存、请求序号、身份校验和几何key失效机制。匹配算法、API、图谱、人体和坐标公式不变。历史GUI未验结论由新增逐项实测记录补充，不覆盖本文件此前失败。详细实现、当前局限及证据见[交互说明](v4-interaction.md)和[验证报告](validation-records/v4-interaction/report.md)。
