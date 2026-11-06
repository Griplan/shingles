# 开发与实验总进度

本文件是唯一总进度台账。当前授权 **V4：病灶标注与参考神经图谱空间匹配、接口及基础结果展示**（允许开发测试参考几何匹配，不重开人体外观迭代）；V2已获用户验收，原测试及未验项目状态保留。预算与历史规划不构成已完成承诺。

当前阶段决策：**V4.1～V4.3实现及自动化通过；V4.4本机HTTP联调通过，微信完整触摸、多屏和真机待验（整体 IN_PROGRESS）。** V1/V2用户验收和V3.1工程成果保留，医学审核仍pending。原V3匹配计划由本轮V4授权实施，详见文末记录。

任务状态：TODO / IN_PROGRESS / DONE / FAILED / BLOCKED。实验执行状态：NOT_RUN / FAILED / PASSED。计划与结果分开；只追加真实实验记录，保留失败和历史结论。

## V0：项目初始化

版本名称：V0：项目初始化  
状态：DONE（2026-10-17，结合既有自动检查与用户反馈完成 V0 验收）  
开发目标：完成结构、中文文档、开发规范、前后端最小环境及健康检查，不实现 V1+ 业务。  
前置条件：检查现有工作区；Python 3.11+；前端完整验证需微信开发者工具。

任务清单：
- [x] DONE 初始化仓库结构（新建独立目录并 git init，未提交/推送）
- [x] DONE 创建 README.md
- [x] DONE 创建 AGENTS.md
- [x] DONE 创建 task.md
- [x] DONE 编写系统架构文档及需求、验证、隐私文档
- [x] DONE 编写 API 约定（当前实现与未来草案明确分开）
- [x] DONE 编写图谱数据规范及来源登记
- [x] DONE 创建小程序最小骨架（四页、导航、配置和类型）
- [x] DONE 创建 FastAPI 最小服务（health 200、两个 501）
- [x] DONE 创建测试结构（12 个 V0 基础用例）
- [x] DONE 执行基本运行验证（pytest、模块导入、真实 Uvicorn HTTP、TypeScript）
- [x] DONE 完成空图谱、AI 目录与 README、结构/JSON/导航路径/忽略规则检查
- [x] DONE 微信开发者工具导入和页面运行人工确认（2026-10-17 用户反馈已查看页面正常；未声称逐项验证全部导航路径）
- [ ] TODO 完整逐页导航与返回路径回归；NOT_RUN（补充验证，不阻塞本次 V0 用户验收）
- [ ] TODO 补充至少一台真机验证记录；NOT_RUN（补充验证，不阻塞 V0 结束，不以模拟器或静态检查替代）

实验目标：验证骨架可导入、后端可启动、health 正常、占位接口不返回医学结果，检查目录/图谱/前端静态结构。  
实验输入：空且未验证的图谱、健康检查请求、501 请求、各页面及配置；不使用患者数据。  
实验方法：pytest、真实 HTTP 启动冒烟、JSON 与结构检查、TypeScript 编译检查；有条件时微信开发者工具编译及导航。  
评价指标：各项命令退出码、响应状态与字段、文件完整性、编译及导航记录。  
验收标准：目录和文档完整；后端能启动且 health 正常、基础测试通过；小程序有完整页面与基本导航；没有伪造图谱。微信编译与交互未运行时单列 NOT_RUN，不宣称全面验收。

实际实验记录：
- 日期：2026-10-15（Asia/Shanghai）
- 执行环境：当前目录为空；系统 `python3` 为 3.9.6；发现 `/opt/homebrew/bin/python3.12`，后续使用独立虚拟环境。
- 执行命令：`pwd`、`ls -la`、祖先 AGENTS.md 检查、`python3 --version`、`command -v python3.12`、`git status --short`。
- 实际结果：空目录，无既有项目或上级开发规范；当前目录尚未初始化 Git。开发验证 NOT_RUN。
- 证据：本轮工具执行输出；后续实验日志追加于本节。
- 问题：默认 Python 版本低于项目最低要求，启动说明需明确选择 Python 3.11+。

### 2026-10-15 实际实验追加

日期：2026-10-15（Asia/Shanghai）。  
执行环境：macOS 15.6.1 arm64；独立虚拟环境 Python 3.12.14；FastAPI 0.143.1、Pydantic 2.14.1、Shapely 2.2.0、Uvicorn 0.54.0、pytest 9.1.1；Node v21.7.3、npm 10.5.0、TypeScript 5.9.3、miniprogram-api-typings 5.2.3。完整已安装 Python 版本清单见后端证据。

以下路径以项目根目录为基准；pytest/pip 命令在 backend 下执行，npm 命令在 miniprogram 下执行。

| 执行命令 / 尝试 | 实际结果 | 证据 |
| --- | --- | --- |
| `.venv/bin/python -m pip install -e '.[dev]'` 首次沙箱安装 | FAILED，DNS 解析失败；不是代码或测试通过 | [首次安装日志](docs/validation-records/v0-pip-install-2026-10-15.txt) |
| 同依赖安装命令，获准网络权限后重试 | PASSED，声明依赖安装成功 | [重试安装日志](docs/validation-records/v0-pip-install-retry-2026-10-15.txt) |
| `.venv/bin/python -m pytest` | PASSED，12 passed、1 条上游弃用警告，exit 0 | [后端验证](docs/validation-records/v0-backend-2026-10-15.txt) |
| `.venv/bin/python -m pip check`；导入 app 及 pkgutil 枚举的子模块 | PASSED，无依赖冲突；app 与 14 个子模块全部导入 | [后端验证](docs/validation-records/v0-backend-2026-10-15.txt) |
| `backend/.venv/bin/python scripts/smoke_backend.py` 首次沙箱执行 | FAILED，回环端口 bind 被禁止，exit 1 | [首次 HTTP 记录](docs/validation-records/v0-http-2026-10-15.txt) |
| 同 HTTP 命令，获准本地监听后重试 | PASSED，实际启动 Uvicorn；health 200、atlas/evaluate 501；服务正常关闭，exit 0 | [HTTP 重试记录](docs/validation-records/v0-http-retry-2026-10-15.txt) |
| npm view/install 初次尝试与一次取消 | FAILED，先 ENOTFOUND，后 ECONNRESET；等待重试取消 exit 143；保留全部记录 | [前端验证摘要及原始日志索引](docs/validation-records/v0-frontend-summary.txt) |
| `npm install --prefer-offline --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000 --logs-dir /private/tmp/dermatome-mapper-npm-logs` | PASSED，安装 2 个开发依赖并生成真实 lockfile，exit 0 | [安装成功日志](docs/validation-records/v0-frontend-npm-install-passed.txt) |
| `npm ci --offline --ignore-scripts --no-audit --no-fund --logs-dir /private/tmp/dermatome-mapper-npm-logs` | PASSED，依据 lockfile 使用官方已下载缓存重装，exit 0 | [npm ci 日志](docs/validation-records/v0-frontend-npm-ci-passed.txt) |
| `npm run typecheck` | PASSED，tsc --noEmit，exit 0；不代表微信工具编译 | [前端验证摘要](docs/validation-records/v0-frontend-summary.txt) |
| `backend/.venv/bin/python scripts/check_atlas.py` | PASSED，JSON、版本/视图、未验证及禁用状态符合 V0；不作医学验证 | [静态总检](docs/validation-records/v0-static-2026-10-15.txt) |
| `backend/.venv/bin/python scripts/check_project.py` | PASSED，必要文件、空目录保留、JSON、四页配置及导航目标完整 | [静态总检](docs/validation-records/v0-static-2026-10-15.txt) |
| `git check-ignore --stdin`；Python 检查 Markdown 相对链接 | PASSED，15 个敏感/生成路径样例被排除、3 个必要路径保留；当次检查 39 个相对链接有效 | [静态总检](docs/validation-records/v0-static-2026-10-15.txt) |
| 官方微信 CLI `open --project <本项目/miniprogram>` | FAILED，沙箱端口 EPERM；获准重试后提示 IDE service port disabled；未修改全局设置，取消调用 exit 143 | [前端验证摘要](docs/validation-records/v0-frontend-summary.txt) |
| `cua.getApp('/Applications/wechatwebdevtools.app')` | FAILED，界面连接 timeoutReached，未取得 UI 状态 | [界面连接记录](docs/validation-records/v0-wechat-attempt-2026-10-15.txt) |
| 微信开发者工具编译、模拟器点击导航、真机 | NOT_RUN；CLI 受服务端口设置限制且界面连接不可用 | 上述两项记录；没有编译/导航成功证据 |

问题：默认系统 Python 3.9.6 不符合要求，已改用 3.12；Starlette 对 TestClient 的 httpx 用法给出弃用警告，测试仍通过，未屏蔽；依赖网络失败经有限重试解决；GUI 编译/交互仍未验证。没有真实医学图谱，图谱始终保持空且禁用。

实际完成内容：新建 85 个源码、配置、文档、占位及验证证据文件，逐项见 [实际文件清单](docs/file-inventory.txt)；未修改原有项目文件（工作区原为空）。创建独立 Git 仓库，未提交、未推送；安装的 .venv/node_modules 和 Git 元数据不计入清单。文档及代码只读交叉审查未发现阻塞问题；所有业务服务、坐标工具与 AI 均仅保留职责说明。

以下为 2026-10-15 验收快照，保留当时未完成结论；当前结论见下方 2026-10-17 追加记录。

| V0 验收条件 | 2026-10-15 历史结论 |
| --- | --- |
| 目录结构完整 | PASSED |
| 后端可以启动 | PASSED，真实 Uvicorn 回环 HTTP |
| /api/v1/health 正常 | PASSED，200 及字段准确 |
| 后端基础测试通过 | PASSED，12 项 |
| 小程序基本页面与导航 | 源码、类型及路径 PASSED；开发者工具编译和实际导航 NOT_RUN |
| 核心开发文档完整 | PASSED，README/AGENTS/task/6 份 docs/AI 说明与真实实现核对 |
| 不存在伪造医学图谱 | PASSED，正背面空集合，来源未取得、未验证、禁用 |

版本结论：V0 代码、文档及自动检查已完成，但小程序实际编译/导航缺少执行证据，因此保留 IN_PROGRESS，**不宣称 V0 全部验收通过**。业务功能均未实现；真机验证另外保留 NOT_RUN。  
下一步：在可操作的微信开发者工具中导入 miniprogram，实际编译并点击四页导航/返回后追加记录；再补充真机记录。V1 前先取得合法图谱/背景、登记许可和审核范围；只有用户明确授权后再开始 V1。

### 2026-10-17 用户人工验证与 V0 收尾

日期：2026-10-17（Asia/Shanghai）。  
执行环境：用户本机微信开发者工具，已导入本项目；工具版本、基础库版本及设备型号未提供，不补填。  
执行命令：不适用，用户手动导入并查看页面；本轮只更新状态文档，没有重新执行代码测试。  
实际结果：PASSED（用户报告），项目能够在开发者工具中打开，已查看页面运行正常。结合 2026-10-15 已通过的结构、类型、导航目标、后端测试及 HTTP 冒烟检查，完成 V0 基础工程验收。  
证据：本聊天中用户原话：“我现在打开开发者工具倒入项目了，看到了一些页面，目前都正常，现在是不是v0就算标记结束了”。该证据是用户人工反馈，不是代理取得的编译日志、截图或逐项导航测试报告。  
问题：完整逐页导航与返回路径回归、真机验证仍为 NOT_RUN，作为补充检查保留；不声称全部路径或设备已通过。原有上游弃用警告与空图谱限制继续有效。

实际修改：更新 task.md 当前状态、人工验证记录及收尾结论；同步 README.md 状态概述。未新增文件，未修改业务代码，未执行 Git 提交或推送。2026-10-15 的失败尝试、NOT_RUN 和 IN_PROGRESS 结论按历史保留，不覆盖。

版本结论：**V0：DONE**。基础工程、文档、后端运行及小程序基本页面已具备本轮所需的验收依据；用户人工确认覆盖已查看页面，补充检查不扩大为已通过结果。  
下一步：V1 保持 TODO；先取得并确认合法人体背景与图谱来源、许可、方向和审核范围，在用户明确授权 V1 后再开发人体展示。

## V1：2D 人体模型展示

版本名称：V1：2D 人体模型展示  
状态：DONE（2026-10-17，本轮功能、自动测试与三种开发者工具模拟器验收完成；真机补充验证 NOT_RUN）  
开发目标：原生 Canvas 2D 展示原创中性正面/背面全身模型，支持独立粗粒度区域、选择高亮、局部放大与复位，建立可复用的归一化坐标系统。  
前置条件：用户已明确授权 V1；沿用 V0 工程和用户配置。根据本轮新需求，中性原创展示模型可先行，不以取得医学皮节图谱为 V1 唯一前提；医学映射仍需合法且审核合格的真实图谱。

任务清单：
- [x] DONE 加载人体模型
- [x] DONE 正反面切换
- [x] DONE 基础区域展示
- [x] DONE Canvas 坐标映射
- [x] DONE 设备尺寸适配
- [x] DONE 区域放大与全身复位
- [x] DONE 坐标纯函数 A～J 测试与 V0 回归
- [x] DONE 人体资源说明、候选医学资料检索与文档同步

实验目标：验证不同屏幕尺寸、设备像素比及视图下坐标一致性。  
实验输入：合法背景、预先定义的归一化参考点、至少三种视口尺寸与不同 DPR。  
实验方法：正反变换往返、固定参考点重投影、开发者工具和至少一台真机观察；记录显示矩形及误差。  
评价指标：归一化坐标误差、像素显示误差、视图方向正确性、切换和布局结果。  
验收标准：模型显示、切换正常；无拉伸/错误镜像；纯数值往返误差目标 ≤1e-6，显示位置误差目标 ≤1 CSS px（目标值，不是结果）。

### V1 开发前历史快照（保留原文，不代表当前状态）

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：尚未取得图谱，未授权开发。

版本结论：未开始。  
下一步：取得并核验合法图谱，用户确认后开始 V1。

### 2026-10-17 V1 开工记录

已读取用户本轮完整需求、AGENTS、task、README、requirements/architecture/atlas-spec/validation，检查小程序、后端和空图谱。工作区既有项目全部为未提交文件；保存开工前源码快照于本机临时目录用于核对变更，不初始化或提交 Git。用户导入后已有项目配置变更，保持其内容。

兼容处理：旧规范仅授权 V0、要求 V1 先取得医学图谱；用户本轮已明确授权 V1 并允许原创中性示意模型先行。更新当前授权和前置条件，保留旧的未开始记录为历史，不把它当作当前状态。V2/V3、后端业务和 AI 均不在本轮范围。

实现决定：采用固定 400×900 逻辑画布的原创 Canvas 贝塞尔路径；正背面独立细节与区域表；区域只用于 UI；按钮选择、按区域边界等比例缩放，暂不加入 Canvas 点击采样或手势。绘图不依赖在线图片或图片解码。坐标只处理 Canvas 本地 CSS 像素，DPR 仅处理物理绘图分辨率。

测试目标：纯函数误差阈值 1e-9；窄/常规/宽容器与 DPR 场景；Canvas 模拟节点功能测试和实际微信渲染分开记录。测试结果仍待实际执行。

### 2026-10-17 V1 实现与实际验证追加

日期：2026-10-17（Asia/Shanghai）。执行环境：既有 macOS 本机工作区，Node v21.7.3、TypeScript 5.9.3；Python 3.12.14 独立虚拟环境；微信开发者工具 Stable 2.01.2510290、基础库 3.17.4。没有新增运行依赖、重建项目、提交或推送 Git。

实际实现及文件：新增原创人体路径与资源说明、正背面独立 UI 区域、body-canvas 组件及渲染器、前端测试执行脚本和两组测试；扩展 select 页面、坐标工具及类型、首页、项目检查脚本；同步开发规范、README、需求、架构、图谱、验证及来源说明。新增/修改的逐项清单见 [V1 文件变更](docs/v1-changes.txt)，包含本轮证据文件；V0 文件清单和失败日志保留。后端、正式图谱、用户 project.config.json 与 lockfile 保持开工快照内容。

坐标结果：使用 neutral-body-v1 原创模型的 400×900 逻辑画布，正背面分别管理 view 和区域 ID；原点左上，x 向右、y 向下，底层数据为 [0,1]²。先扣除 16 CSS px 留白，再取宽高适配比的较小值；局部视口以目标 bounds 中心对齐容器中心，缩放和平移只改变不可变 ViewportTransform。正向为 offset + normalized × logicalSize × scale，逆向减 offset 后除 logicalSize × scale。Canvas 本地 CSS 像素和物理像素分离，DPR 只用于 backing store 与绝对 setTransform，不进入归一化坐标。模型外留白、Canvas 外点和非法逆向视口返回 null；正向非法参数抛 RangeError。1e-12 仅容忍机器舍入；测试的往返误差断言阈值为 1e-9，不代表实际屏幕像素测量。

| 真实执行命令 / 操作 | 状态及结果 | 证据 |
| --- | --- | --- |
| miniprogram 下 `npm run typecheck`、`npm test` 初次完整执行 | PASSED，类型检查 exit 0；24/24 测试通过（15 坐标 + 9 Canvas/页面） | [首次前端结果](docs/validation-records/v1-unit-2026-10-17.txt) |
| `npm test` 增加非法视口回归，修复前执行 | FAILED，25 项中 24 通过、1 失败；scale=0 等非法视口未主动拒绝 | [失败原始日志](docs/validation-records/v1-invalid-viewport-failed-2026-10-17.txt) |
| 补充统一视口校验后 `npm run typecheck`、`npm test` | PASSED，exit 0；25/25 测试（16 坐标 + 9 Canvas/页面），0 失败、0 跳过 | [修复后原始日志](docs/validation-records/v1-unit-repaired-2026-10-17.txt) |
| backend 下 `.venv/bin/python -m pytest` | PASSED，12/12，1 条既有上游 Starlette TestClient 弃用警告，exit 0；包含 health 和 501 契约回归 | [后端/静态回归](docs/validation-records/v1-regression-2026-10-17.txt) |
| 根目录 `backend/.venv/bin/python scripts/check_atlas.py` | PASSED，空图谱、unverified、mapping_enabled=false；不是医学审核 | [后端/静态回归](docs/validation-records/v1-regression-2026-10-17.txt) |
| 根目录 `backend/.venv/bin/python scripts/check_project.py` | PASSED，V0/V1 必要文件、JSON、导航、组件与原生 Canvas 配置 | [后端/静态回归](docs/validation-records/v1-regression-2026-10-17.txt) |
| 微信开发者工具：重新打开本项目、编译、按钮及导航操作 | PASSED，实际渲染正背面、高亮、局部放大、全身复位、重复切换、离开重入；V0 首页/annotate/result/返回导航可用 | [GUI 操作记录](docs/validation-records/v1-gui-2026-10-17.txt) |
| 320×568/DPR2、390×844/DPR3、430×932/DPR3 三种模拟器 | PASSED，完整人体等比例显示；区域选择、放大、复位；控件可纵向滚动，无观察到的横向溢出或重叠 | [GUI 操作记录](docs/validation-records/v1-gui-2026-10-17.txt) |
| 最终文档链接/JSON/配置保护/范围核对 | PASSED，59 个相对链接、7 个 JSON 示例、配置与 V0 历史逐字节保护；18 新增/18 修改/0 删除，不计入单元测试数量 | [最终静态记录](docs/validation-records/v1-final-static-2026-10-17.txt) |

测试覆盖：A 标准→显示、B 显示→标准、C 往返、D 不同宽高比、E 留白、F 局部、G 复位、H 非法尺寸/NaN/Inf/非法视口、I 边界、J 正背面独立区域均实际通过；三种数值容器、11×11 参考点网格和全部 12 个区域中心，断言阈值 1e-9。Canvas 单测使用明确的节点/context 测试替身，覆盖 DPR1/2/3、初始化失败重试、隐藏/显示/resize/detach 的旧回调失效、页面状态与重复操作；不冒充实际渲染，实际渲染另列 GUI 证据。

失败与修复保留：首次连接已有模拟器应用通道断开；重新打开当前项目后恢复。首次 Canvas 高度导致小屏初始画面不能一眼看到足部，修改为 50vh（min260/max440px）并重测。WXSS 热更新时旧 backing store 可能短暂不匹配新高度，重新编译/切换/重入触发实测尺寸重绘；一次导航过渡捕获到模拟器原生 Canvas 残留图层，滚动回顶部后对齐恢复。最终重新编译，并复核胸部选择→放大→复位、背面→正面清空选择，恢复原 390×844 模拟器及正面全身初始状态。以上未推断为真机表现。

图谱状态：已使用本地原创中性人体，不含第三方图片，资源说明见 assets/body/README.md；原创来源已登记，第三方许可不适用，项目整体分发许可证尚未指定，不能声称已开源授权。已在线查证并登记三项真实候选资料：Wikimedia Dermatoms.svg、ASIA ISNCSCI 2026 表、Lee 等 2008 论文。候选的许可、视图和编号仅填已证实信息，其他字段 UNKNOWN；没有导入候选图像或制作医学多边形。正式 atlas 仍 regions=[]、unverified、mapping_enabled=false，未取得适配本模型且审核通过的医学图谱。V2 的纯标注不因此阻塞；V3 医学映射 BLOCKED，需许可、配准、数字化和医学审核。

### V1 当前验收（以本轮用户 19 项清单为准）

本轮用户允许无医学图谱完成 V1；实际开发者工具渲染已经执行。旧实验方法中真机及 ≤1 CSS px 显示误差属于尚未完成的补充验证，未改写为已通过；下表 PASS 的设备范围仅是已列三种模拟器及自动测试。

| 验收项 | 当前结论 / 依据 |
| --- | --- |
| 微信小程序展示正面人体 | PASS，实际工具完整渲染 |
| 微信小程序展示背面人体 | PASS，实际工具后背细节与标签 |
| 正反面切换 | PASS，实测及页面状态测试 |
| 随设备变化不拉伸 | PASS，三个模拟器观察及等比公式测试；真机 NOT_RUN |
| 粗粒度区域选择 | PASS，12 个独立区域、按钮操作 |
| 选中区域明确反馈 | PASS，选中按钮/名称/模型高亮 |
| 指定区域放大 | PASS，胸部、上背部及左上肢实测 |
| 恢复全身 | PASS，复位保留选择高亮 |
| 正背面解剖学左右 | PASS，区域定义测试和背面左上肢观察 |
| 归一化坐标系统 | PASS，400×900、[0,1]²、view 独立 |
| 正向及逆向转换 | PASS，A～J 自动测试，阈值 1e-9 |
| Canvas 尺寸与 DPR | PASS，DPR1/2/3 单测及工具 DPR2/3 渲染；真机 NOT_RUN |
| 坐标核心自动化测试 | PASS，16 项实际通过 |
| 医学图谱与模型分离 | PASS，独立目录和结构 |
| 未编造医学边界 | PASS，正式图谱和后端与快照一致 |
| 未提前实现 V2/V3 | PASS，annotate/result 保留占位、无病灶采集或匹配 |
| 文档更新 | PASS，README/需求/架构/图谱/验证/来源说明 |
| task 更新 | PASS，任务、结果、失败及限制已追加 |
| 报告真实状态 | PASS，原始失败与通过记录分开、未运行单列 |

补充验证：实际手机硬件、旋转矩阵、旧基础库兼容、屏幕 ≤1 CSS px 定量测量、真实节点初始化故障注入均 **NOT_RUN**。图片加载失败场景 **N/A**（纯本地路径，无图片加载器）；实际初始化错误提示存在，测试替身验证了重试。没有完成医学审核或临床验证。

已知问题：小屏操作区需要纵向滚动；开发工具热更新/导航时的 Canvas 合成短暂残留需真机确认；工具/基础库有自动热重载、SharedArrayBuffer/getSystemInfo/worker 提示，后端有一条既有弃用警告。原创人体仅为示意，不能充作精确解剖图；未来医学图谱须与模型和视图做配准，不可直接套用。未测设备不在已验证范围内。

版本结论：**V1：DONE**，本轮指定的 19 项验收在列明的自动测试与开发者工具模拟器范围内通过，真机补充项保留 NOT_RUN。没有启动 V2～V8；无提交、无推送。下一步：取得 V2 授权后，先接入 Canvas 本地点击→统一逆变换，再实现会话内多病灶多边形、撤销/清空和视图/模型版本绑定；另行补真机与尺寸变化验证。医学图谱继续作为 V3 依赖。

## V1.1：完整人体模型与坐标调试

版本名称：V1.1：完整人体模型与坐标调试  
状态：IN_PROGRESS（实现/自动检查完成；最终微信页面触摸与布局验收 NOT_RUN，工具连接阻塞）  
目标：优化完整正背面人体；分离视觉资源、版本化配置、UI 区域与坐标工具；头颈选择；单点调试、轮廓命中及缩放重投影。用户本轮已授权，仅限 V1.1，不实现病灶或医学映射。

任务清单：
- [x] DONE 分析旧模型与缺头反馈，保存基线并保留历史
- [x] DONE 新版本完整人体资源、头颈与自然形体优化
- [x] DONE 模型配置与资源/区域绑定、兼容规则
- [x] DONE 调试开关、真实点击坐标、单点十字重投影
- [x] DONE 轮廓命中、留白与范围外区分
- [x] DONE 自动测试与现有可执行回归
- [ ] 最终微信工具触摸、布局及多尺寸验收（NOT_RUN，见连接阻塞记录）
- [x] DONE 文档、文件清单及真实验收记录

检查结论（2026-10-17）：旧 neutral-body-v1 400×900 采用连续 Canvas 贝塞尔路径，未用静态图片；轮廓已含头（起点200,35，头部左右158/242）、颈及四肢。正背面轮廓共用、细节和6个UI区域独立；放大为 bounds 视口适配。尚无头颈区域、轮廓命中或点击输入；绘图器直接导入固定资源常量，资源与配置耦合。缺头反馈尚未复现，不能杜撰原因；需实际编译观察全身与局部模式。保留旧资源作为历史，新几何必须新版本并重新适配区域。

计划：保留400×900逻辑画布与纯变换公式；引入 neutral-body-v2，调整头肩、四肢姿态与形体，前后独立视觉资源。调试默认关闭，最多一个会话内点，绑定模型版本及view；根据同一轮廓曲线细分命中，不用包围矩形判定人体。正常区域按钮优先负责选择，Canvas点击仅在调试开启时响应且不改变区域。

测试计划：原A～J回归；头颈/16区域/绑定和替换兼容；轮廓内外、四肢空隙、曲线细分误差；点击事件client与Canvas坐标、滚动、DPR、缩放/复位、异步旧回调、关闭/换面隔离；真实工具检查三个尺寸及实际点击。结果：NOT_RUN（开工时）。

### 2026-10-18 V1.1 实际实现与测试追加

日期：2026-10-18（Asia/Shanghai，开工检查记录跨日保留）。环境：既有macOS本机项目，Node v21.7.3、TypeScript5.9.3、官方小程序类型5.2.3；后端独立Python3.12.14环境；微信开发者工具Stable2.01.2510290、基础库3.17.4。用户配置、后端、AI和正式图谱不改；无新小程序依赖、无Git提交或推送。

实际实现：新增neutral-v2.ts原创完整人体资源、body-models.ts版本化配置/绑定/样式替换、body-path.ts同源轮廓命中、body-debug.ts事件基准/探测/重投影；原body-canvas负责按配置绘制及单点交互，select增加头颈入口、调试开关和实际状态面板。新增body-debug.test.cjs并扩展既有测试。新增可复现离线SVG预览脚本及预览图；文档更新了模型、几何、坐标与验证规则。逐项见[V1.1文件变化](docs/v11-changes.txt)。

模型与几何：旧neutral-body-v1与新neutral-body-v2/2.0.0均400×900，但不几何兼容。头顶(200,35)→(200,30)，头主体右侧x242→237（耳侧仍至242），右肩连接(270,177)→(267,175)，手外侧控制范围x346→355，右足内侧末端(209,859)→(212,870)；左侧对称生成。上肢bounds横向扩展（画面右 .63/.25→.62/.28，画面左 .12/.25→.10/.28），下肢高度 .46→.475；每面新增head/neck，合计16个UI区域。胸腹/背部bounds保持并复核。完整参数与资源来源见[模型说明](miniprogram/assets/body/README.md)。几何变化只影响当前前端人体/区域/命中，旧模型资源保留，不静默迁移旧点；当前没有病灶或已启用医学图谱可迁移。

资源与坐标解耦：coordinate.ts只依赖LogicalModel逻辑尺寸，不知道visual或区域。配置明确id/version/geometryId/view、逻辑尺寸、visual与regionSet；替换样式时withBodyVisual要求轮廓及绑定一致，错版/错尺寸/错view拒绝。视觉层使用暖中性肤色、曲线与轻微阴影，正背面独立细节/阴影，无外部图片或AI依赖。项目整体分发许可仍未指定。

调试规范：默认关闭，只在会话WeakMap中保留一个modelId/modelVersion/view/normalized点，无病灶集合、storage或API。原生CanvasTouch.x/y为本地CSS坐标；clientX/Y减去每次触摸重新查询的rect；screen为页面可显示区域CSS坐标，不是设备物理屏幕。模型画布内先逆变换再轮廓命中；outline自适应细分阈值0.2逻辑单位，边缘判断容差0.25逻辑单位，不吸附。超模型/轮廓外分别提示并清除十字。变换公式不变，DPR仍只用于物理画布。十字重投影时保持7 CSS px；离开可见视口隐藏不贴边。换面/关闭清理，放大/复位/resize保留标准点。超过8 CSS px移动、取消和多指不当作调试点击，正常区域按钮不被Canvas点击替代。

| 实际命令 / 操作 | 结果 | 证据 |
| --- | --- | --- |
| 小程序目录 npm run typecheck、npm test（首轮） | PASSED，43/43测试，类型检查exit0 | [首轮日志](docs/validation-records/v11-first-2026-10-18.txt) |
| 兼容性修改后再次typecheck/test | FAILED，TS2322：Object.assign将view字面量拓宽为string；测试编译失败，本次没有执行单测，不伪报43项失败 | [失败及后端回归原始记录](docs/validation-records/v11-final-tests-2026-10-18.txt) |
| 改用类型明确的model.view后typecheck/test | PASSED，43/43 | [修复记录](docs/validation-records/v11-repaired-2026-10-18.txt) |
| 最后将未测元数据初值改为“—”后typecheck/test | PASSED，43/43，0失败、0跳过，exit0 | [最终前端结果](docs/validation-records/v11-confirmed-2026-10-18.txt) |
| backend目录 .venv/bin/python -m pytest | PASSED，12/12，1条既有Starlette弃用警告，exit0 | [后端回归](docs/validation-records/v11-final-tests-2026-10-18.txt) |
| 根目录 backend/.venv/bin/python scripts/check_atlas.py / scripts/check_project.py（分别执行） | PASSED，空图谱约束和工程结构，均exit0 | [静态回归](docs/validation-records/v11-final-tests-2026-10-18.txt) |
| node scripts/preview_body.cjs docs/validation-records/v11-model-preview-2026-10-18.svg | PASSED，从实际资源编译导出SVG；环境已有Sharp转换860×1020 PNG并实际查看，完整正背面头颈/手足；不是微信截图 | [离线SVG](docs/validation-records/v11-model-preview-2026-10-18.svg)、[PNG](docs/validation-records/v11-model-preview-2026-10-18.png) |
| 微信工具编译、重新打开当前项目及页面观察 | 初期FAILED（新模块热更新/Babel objectSpread2缺失、空Canvas）；改用Object.assign并完整编译后错误计数归零，实际捕获到新完整正面；但原生Canvas/页面出现残留层，最终稳定布局与交互未确认 | [真实GUI尝试记录](docs/validation-records/v11-gui-2026-10-18.txt) |
| 最终触摸/十字、头颈按钮、多尺寸、前后面页面交互 | NOT_RUN：CUA失去模拟器Webview节点，坐标点击/滚动noWindowsAvailable；重绑定、重开项目、Raise、重置连接和机型菜单尝试未恢复。最终工具头部Errors0/Warnings2不是交互通过依据 | [GUI连接阻塞记录](docs/validation-records/v11-gui-2026-10-18.txt) |
| 最终文档/保护/范围检查 | PASSED：78个本地链接、7个JSON示例、5份WXML结构、15新增/24修改/0删除及历史/配置保护；通用XML解析器误报&&，修正检查输入后通过，原失败保留 | [最终静态记录](docs/validation-records/v11-static-2026-10-18.txt) |

自动验证共55项通过：前端43（坐标16、原Canvas/页面9、新资源/命中/探测10、扩展Canvas/页面8），后端12。数值断言1e-9，不是触摸精度。测试实际覆盖头颈、16区域合法性与左右、资源存在/版本绑定、样式可替换/几何错版拒绝、曲线内外与四肢间隙、三种容器/DPR、滚动前后两类触点、缩放复位/resize单点不变、视口外隐藏、换面关闭隔离、旧回调、失败提示及无病灶数据。真实微信触摸和≤2 CSS px误差目标仍NOT_RUN。

问题与修复：本次真实工具失败说明静态类型及Node测试不保证微信模块加载；移除对象展开依赖后完整编译错误归零。样式检查发现部分不允许的选择器，改为class；随后代码自查发现一次字符串替换误改按钮class选择器，已逐项修复并核对WXML引用。静态WXML结构核对曾因通用XML解析器不能接受合法表达式中的原始&&而误报，已只修正检查器输入、不改业务WXML并重查通过。最终UI仍因工具连接/图层残留受阻，未隐藏问题或将其归咎于“模型缺头”。旧模型本来有头，缺头反馈本轮不能复现或确定原因。当前资源图已确认完整，但不能代替小程序最终布局验收。

图谱与范围：医学atlas三文件保持原字节，regions=[]/unverified/mapping_enabled=false；头颈仅UI区域，不映射脊神经或三叉神经。没有V2病灶绘制、V3匹配、AI/3D/数据库或后端改造。

### V1.1 逐项验收

PASS注明验证层级；自动函数/节点替身或离线资源检查不代表真实微信触摸通过。最终真实页面与设备项目保留NOT_RUN，整体不标DONE。


人体模型：

| 验收项 | 状态 | 依据及范围 |
| --- | --- | --- |
| 正面完整人体 | PASS | 实际资源/离线图完整；曾捕获真实Canvas正面，但最终页面布局NOT_RUN |
| 背面完整人体 | PASS | 独立背面资源及离线渲染；最终微信背面操作NOT_RUN |
| 包含头部和颈部 | PASS | 同源轮廓命中测试及实际查看离线图 |
| 包含完整四肢与手脚 | PASS | 轮廓内点/对称测试和离线图 |
| 正反面比例一致 | PASS | 共享几何和400×900配置测试 |
| 人体视觉效果得到明显改善 | PASS | 检查暖肤色/阴影/连续轮廓离线图；微信布局未验收 |
| 不再使用粗糙几何拼接模型 | PASS | 连续贝塞尔路径与渲染检查 |
| 不同屏幕下人体不变形 | PASS | 三种数值容器等比测试；实际三机型布局NOT_RUN |

区域选择：

| 验收项 | 状态 | 依据及范围 |
| --- | --- | --- |
| 头部可选择 | PASS | 区域配置、头部视口测试和按钮数据绑定；微信操作NOT_RUN |
| 颈部可选择 | PASS | 区域配置、颈部视口测试和按钮数据绑定；微信操作NOT_RUN |
| 原有区域正常 | PASS | 既有区域/页面回归和16区域范围检查 |
| 选中高亮正常 | PASS | Canvas命令/剪裁替身验证；最终微信点击NOT_RUN |
| 局部放大正常 | PASS | 居中适配与Canvas/页面回归；最终微信点击NOT_RUN |
| 返回全身正常 | PASS | reset与Canvas/页面回归；最终微信点击NOT_RUN |

坐标系统：

| 验收项 | 状态 | 依据及范围 |
| --- | --- | --- |
| 统一归一化坐标 | PASS | 同一coordinate.ts，400×900逻辑画布 |
| 正向变换正确 | PASS | A及手算预期 |
| 逆向变换正确 | PASS | B及范围/非法值 |
| 放大后坐标不变 | PASS | 纯函数/单点重投影测试 |
| 复位后坐标不变 | PASS | reset/原始点不变测试 |
| 正反面独立 | PASS | view/版本隔离测试 |
| 留白点击处理正确 | PASS | 纯探测函数及Canvas替身，实际触摸NOT_RUN |
| 人体轮廓命中检测正确 | PASS | 同源曲线、头颈四肢及间隙/边缘测试 |

坐标调试：

| 验收项 | 状态 | 依据及范围 |
| --- | --- | --- |
| 具有调试开关 | PASS | 默认关闭、开关状态/事件测试；实际开关操作NOT_RUN |
| 点击显示实际坐标 | PASS | 输入事件/矩形计算和面板动态格式测试；实际微信触摸NOT_RUN |
| 显示当前视图 | PASS | 实际组件事件至面板测试 |
| 显示当前模型版本 | PASS | 配置/事件错版隔离与面板测试 |
| 点击位置有十字标记 | PASS | drawBody命令位置断言；实际微信十字NOT_RUN |
| 缩放时十字标记不漂移 | PASS | 缩放复位/resize数值和命令测试；像素实测NOT_RUN |
| 切换视图不会混用调试点 | PASS | 组件/页面错view回调和点清理测试 |
| 调试功能不生成病灶数据 | PASS | 仅单DebugPoint、无病灶数组/API/storage，范围核对 |

架构：

| 验收项 | 状态 | 依据及范围 |
| --- | --- | --- |
| 视觉资源与坐标逻辑解耦 | PASS | coordinate仅LogicalModel，渲染按model.visual |
| 模型具有版本标识 | PASS | neutral-body-v2/2.0.0 |
| 模型几何与区域数据正确绑定 | PASS | geometryId/regionSet验证 |
| 后续可在同一框架中替换视觉资源 | PASS | withBodyVisual样式替换/不兼容拒绝测试 |
| 不依赖 AI 模型 | PASS | 源码/未变AI范围核对 |
| 不依赖后端医学匹配接口 | PASS | 本地配置/路径/纯函数，无API请求 |

工程质量：

| 验收项 | 状态 | 依据及范围 |
| --- | --- | --- |
| TypeScript 检查完成 | PASS | 最终tsc exit0，失败历史保留 |
| 坐标单元测试完成 | PASS | 16项坐标及新增探测/轮廓测试 |
| 原有功能回归测试完成 | PASS | 现有可执行前后端回归；真实页面导航回归NOT_RUN |
| 文档更新完成 | PASS | README/资源/需求/架构/图谱/验证/引用说明 |
| task.md 更新完成 | PASS | 本节含实现、失败、证据和限制，V0/V1历史保留 |
| 未编造医学图谱 | PASS | 正式医学文件未改、禁用状态 |
| 未伪造测试结果 | PASS | 原始日志与部分GUI失败、NOT_RUN分别记录 |

独立的真实运行验收：最终完整页面正面/背面、真实头颈/区域操作、实际调试点击/十字重投影/留白拒绝、最终三个模拟器尺寸与导航均 **NOT_RUN**（工具连接阻塞）。真机、旋转、旧基础库和像素误差测量 **NOT_RUN**。未解除的实际程序FAIL不能假报PASS；当前未能证明最终页面稳定，因此整体保留IN_PROGRESS。医学映射 **BLOCKED**（后续V3数据/许可/审核依赖，不是本轮代码阻塞）；图片解码N/A。

已知限制：原创人体非精确解剖图；轮廓命中是曲线细分近似，不承诺临床边界。实际微信事件精度与布局待人工清单复核；工具曾出现原生画布残留，不能保证重编译后所有设备已恢复。开启面板只增加纵向内容，不调整画布尺寸；小屏需滚动。上游工具提示与后端一条弃用警告仍记录，不删除旧日志。

V2就绪：代码层面已有单次输入→Canvas CSS→归一化→轮廓过滤，以及模板/view/版本、重投影和生命周期隔离，可复用为后续点击多边形输入基础。但应先补足当前微信实际触摸与像素/尺寸检查，再授权开发V2；尚缺多边形会话状态、闭合/撤销/清空、多病灶、几何合法性和交互测试，本轮未实现。V3还需合法图谱配准及医学审核。

版本结论：**V1.1：IN_PROGRESS**。实现与55项自动验证、离线资源检查完成；最终微信触摸/布局验收因工具连接故障未完成，不提前标DONE。下一步执行docs/validation.md第9节人工步骤或在界面连接恢复后复测，再追加结果并决定收尾；保留V0/V1历史和全部失败证据。

## V1.2：人体解剖比例专项修复

版本名称：V1.2：人体解剖比例专项修复  
状态：IN_PROGRESS  
授权范围：重绘原创人体几何、同步UI区域与同源命中、关键参考位置配准、视觉对比及既有交互回归；不实现V2/V3，不改无关后端，不提交/推送Git。

任务清单：
- [x] DONE 检查旧模型关键位置、保存基线与原资源/区域
- [x] DONE 新模板原始路径重绘及前后同骨架细节
- [x] DONE 更新16个粗区域及关键位置配准检查
- [x] DONE 生成旧正面/新正面/新背面/参考位置对比并实际看图修正
- [ ] 坐标与模型配准分别测试，回归交互及屏幕适配
- [x] DONE 更新文档、证据、文件清单和验收

2026-10-22 开工分析：旧neutral-body-v2/2.0.0，400×900。头顶y30、下颌y138（头高108），肩外连接约(267,175)、腰侧(248,327)、髋外侧约(280,440)、裆点(200,510)、膝线前y626/后y631、踝部约y826。旧图显示躯干窄长、裆偏低、上腿可见段短；膝线、膝内外轮廓和阴影不够一致。并非简单等比例缩放可以修复。

实现决定：保留旧neutral-v2.ts原字节和旧区域表快照body-regions-v2.ts；当前切换新neutral-body-v3/3.0.0，逻辑尺寸和归一化公式不变，直接重绘曲线及细节。以用户给出的7.5～8头身、裆50%～54%、膝72%～76%作插画设计参考，不宣称医学标准或专家审核。关键位置数据用于技术配准和参考图，不是医学皮节或患者解剖数据。

测试计划：原坐标/组件/页面回归，新增关键位置在轮廓与对应区域内、前后骨架一致、裆/膝及上下腿比例、跨模板调试点拒绝、各区域放大及三种尺寸投影；离线视觉检查与真实微信/真机结果分别记录。开工结果：NOT_RUN。

### 2026-10-22 V1.2 实现与实际验证追加

当前结论：几何重绘、区域同步、离线视觉检查和自动回归已完成；微信小屏显示与控件状态已部分实测。真实触摸/十字误差及其余尺寸未完成，故V1.2总状态仍为IN_PROGRESS，不宣布全量验收通过。V0/V1/V1.1历史记录未覆盖。

环境：沿用项目Node/TypeScript及独立Python虚拟环境；微信工具Stable2.01.2510290、基础库3.17.4（工具灰度警告）。输入仅本地原创人体与合成触点，无患者数据。开发前基线保存于本机临时目录，旧neutral-v2.ts原字节保留、旧body-regions.ts另存body-regions-v2.ts；[本轮文件变化](docs/v12-changes.txt)列出相对基线新增/修改，未提交或推送。

新模板：neutral-body-v3 / 3.0.0，geometryId=neutral-body-v3，regionSetId=neutral-body-v3-ui-regions-1。保留400×900逻辑画布、归一化规则、纯坐标公式；直接重建连续贝塞尔轮廓、细节和阴影，不是对旧图整体或局部缩放。前后共用同骨架轮廓，背面细节独立。

| 几何项目 | 旧v2 | 新v3 |
| --- | --- | --- |
| 头顶/下颌 | y30 / y138 | 保留，约7.79头身 |
| 右肩外轮廓连接 | (267,175) | (284,180)，肩关节参考(277,195) |
| 胸廓宽，腋窝以下y270 | 107.84 | 129.49，约增加20% |
| 裆点及其相对全身高度 | y510 / 57.04% | y474 / 52.76% |
| 前膝线及其相对全身高度 | y626 / 70.83% | y650 / 73.68%，后膝线同步靠近y650 |
| 踝参考 | y826 | y825 |
| 可见裆膝 / 膝踝段 | 116 / 200 | 176 / 175；髋膝参考段218 |
| 肘/腕/指尖参考 | 原姿态 | y334 / 451 / 526 |

百分比分母为实际细分轮廓高度841.5，原点为头顶y30；这些为插画设计度量，不是骨长、患者数据或医学准确率。胸腰髋曲线直接重绘，新腰y331宽约100.56、髋y432宽约158.44，形成相对腰部收束；没有通过缩小头部制造比例变化。双臂轻度展开，颈颌、掌指和足踝过渡重新处理。完整参数与原创来源见[资源说明](miniprogram/assets/body/README.md)。

区域同步：16区域重新配准，颈部、胸腹/上下背、双臂和双腿bounds及多边形均更新，头部因几何保留而复核后沿用。新指尖超出旧上肢范围、新髋点高于旧下肢起点，新增断言明确证明旧坐标不可直接沿用。hitOutline由新visual.outline动态细分；没有另一份失配的旧命中数据。所有区域逐项检查放大视口，关键点在对应bounds和独立多边形内。正面/背面沿用人体自身左右约定。正式医学JSON保持空、未验证、禁用。

| 实际操作/命令 | 结果 | 证据 |
| --- | --- | --- |
| 小程序npm run typecheck；首轮npm test | 类型检查PASSED；单测FAILED，49/50，1项截面宽度断言失败 | [首轮原始日志](docs/validation-records/v12-first-tests-2026-10-22.txt) |
| 修正截面测量方法后npm test | PASSED，50/50，0失败/跳过，exit0；测试流程重新编译全部TS | [修复后原始日志](docs/validation-records/v12-repaired-tests-2026-10-22.txt) |
| backend/.venv/bin/python -m pytest（backend目录） | PASSED，12/12，1条既有Starlette TestClient弃用警告，exit0 | [回归原始日志](docs/validation-records/v12-regression-2026-10-22.txt) |
| check_atlas.py、check_project.py、node --check scripts/preview_body.cjs | PASSED，均exit0；正式空图谱与必要路径合法 | [回归原始日志](docs/validation-records/v12-regression-2026-10-22.txt) |
| 导出并实际查看首版与四栏SVG→PNG | PASSED，实际看图；首版标题错误保留，最终动态标题正确 | [视觉操作记录](docs/validation-records/v12-visual-2026-10-22.txt) / [四栏PNG](docs/validation-records/v12-comparison-2026-10-22.png) / [SVG](docs/validation-records/v12-comparison-2026-10-22.svg) |
| 微信当前项目重开、小屏显示、区域/切面/放大复位状态 | 部分PASSED，最终Errors0/Warnings5，详细边界见记录 | [GUI操作记录](docs/validation-records/v12-gui-2026-10-22.txt) |
| 本轮文件边界、历史保护、文档链接/结构检查 | PASSED，14新增/17修改/0删除；27份历史证据原字节不变，exit0 | [静态检查](docs/validation-records/v12-static-2026-10-22.txt) |

失败及修复：首轮胸宽测试在y236截取，此高度上臂与胸肩仍连通，测到含上臂宽度；改为双方腋窝以下y270比较，不改模型来迎合错误测试，随后50项通过。首个离线预览继承旧脚本硬编码v2标题，已改动态读取id/version；首版原文件保留。微信新增模块热加载首次失败，完整编译仍有旧缓存错误；重开当前同一项目后资源加载与错误数0已确认，未改账号或全局设置。

自动验证共62项通过：前端50（原坐标16、Canvas/页面9、V1.1资源/调试18、新解剖位置配准7），后端12。新7项分别检查错版隔离、设计比例、实际轮廓截面、前后关节点包含与次序、16区域独立包含、真实膝线配准、三尺寸关节点探测/重投影/放大复位。坐标1e-9数值断言不是触摸精度。全部50项和类型检查通过不能代替解剖学专业审核或微信输入验证。

### V1.2 逐项验收与尚未解决事项

| 验收项 | 状态 | 实际证据/限制 |
| --- | --- | --- |
| 保留旧版并新建独立模板，直接重绘原始几何 | PASS | v2资源保留、v2区域快照、新v3路径与配置 |
| 上下腿、胸腰髋、肩臂、颈颌及手足调整 | PASS（工程视觉范围） | 四栏图实际检查、比例及轮廓断言；无医学审核 |
| 旧正面/新正面/新背面/设计位置参考图 | PASS | 同尺度四栏PNG/SVG；非微信截图 |
| 16个粗区域、同源命中、前后骨架与左右配准 | PASS（自动检查范围） | 独立包含、前后同轮廓、膝细节、错版拒绝 |
| 原坐标公式、区域放大/复位、轮廓命中与十字投影 | PASS（自动检查范围） | 50项前端测试，三尺寸前后关节点另测 |
| 微信小屏全身显示、切面、头/胸/腹/背/四肢选择 | PASS（已操作范围） | iPhone5/DPR2，实际看到完整正面；按钮状态逐项确认 |
| 微信区域放大与返回全身 | PASS（状态）；局部裁切视觉复核未齐 | 上背部/右下肢局部及复位文案已确认，截图在按钮滚动区 |
| 坐标调试开关及模板元数据 | PASS | 实际开关、400×900、v3/3.0.0、CSS/DPR；未产生有效点击点 |
| 真实人体内/外点击、滚动输入、十字≤2 CSS px误差 | NOT_RUN | 窗口坐标输入反复报noWindowsAvailable；重绑同一窗口仍失败，AX与截图可用 |
| 三种屏幕实际渲染/交互 | 部分，未全验 | 本轮仅iPhone5/DPR2；其他两种仅自动测试，实际GUI未运行 |
| 真机/旋转/全部区域局部裁切与手足易读性 | NOT_RUN | 需要设备与人工复核，不能继承V1旧结论 |
| 无V2/V3、无无关后端/新框架/医学数据变更、无Git提交推送 | PASS | 本轮文件边界检查；病灶与医学映射未实现 |

剩余操作：在微信中用真实指针/触摸点胸、髋、膝、踝及留白，核对动态坐标与十字≤2 CSS px目标；逐区域放大看裁切、切面后点位清空；补390×844/DPR3和430×932/DPR3及真机。当前无法执行的原因是原生坐标输入通道错误，已保存实际失败，不把它记成代码通过或失败。用户对整体自然度的最终确认与专业医学审核尚未取得。本轮交付代码及工程视觉修复，不将V1.2标记DONE。

> 下节为上一轮调查阶段完整历史快照，其中“等待选择/尚未替换”仅指当时。当前实施授权、结果及剩余验证见后续“V1.3 实际素材替换追加”。

## V1.3：人体素材调查与替换准备

版本名称：V1.3：素材调查、真实预览与选型决策  
状态：IN_PROGRESS（调查完成，等待用户选定；资源替换未开始）  
授权：只调查、许可核验、原文件检查、预览、迁移评估与计划。用户选定之前不得更换模型、修改区域/坐标/命中/缩放代码，不实现V2/V3，不提交或推送。

- [x] DONE 阅读规范/台账/架构/坐标规范并分析当前路径和交互实现
- [x] DONE 调查Commons、Servier、付费平台与开源人体高亮项目
- [x] DONE 核验两套可进入选择的来源系列：Goran BY-SA、Cdang CC0；A1/A2只算同系列变体
- [x] DONE 获取有明确开放许可的原文件、记录来源/哈希、制作并实际查看真实前后预览
- [x] DONE 输出对比、许可证据、迁移工作量、风险和下一步计划
- [ ] TODO 用户选择正式素材并确认对应交付许可条件
- [ ] TODO 取得后续实施授权后替换资源、升级模板及重建区域/命中/放大范围
- [ ] TODO 新素材坐标配准、微信/多机型/真机视觉及输入验收

2026-10-22 开工判断：用户明确认为V1.2视觉仍不满足要求；V1.2中工程比例断言及测试通过不代表获得用户视觉认可。停止修补neutral-v3原轮廓，本轮保留其全部原字节。当前active模板仍neutral-body-v3/3.0.0，400×900。旧V0/V1/V1.1/V1.2记录保持历史原文，不把上一轮工程视觉PASS改写成用户验收。

调查交付：[完整比选报告](docs/v13-material-review.md)、[同尺度真实预览](docs/research/v13-materials/candidate-comparison.png)、[署名与素材许可](docs/research/v13-materials/NOTICE.md)。预览为两套来源、三个展示选项：A1男性/A2女性均为Goran tek-en同一套成熟阴影SVG；B为Cdang原四视图中的真实男性前后线稿。没有假造3～5个独立合格方案。Servier肌肉双面另有[真实排除预览](docs/research/v13-materials/c-servier-excluded-preview.png)，不列作表面底图；付费Irina Mir需扩展许可且小程序适用性未核验，未下载未授权源文件。

推荐：优先A1（需要女性体型时A2），前提是接受CC BY-SA 4.0署名、改动说明和适用改编同许可分享。B的CC0许可负担低，但只是线稿备选。若A视觉或许可条件不被接受，建议专业医学插画委托，不退回旧模型反复修补。未声称医学审核完成。

技术结论：归一化公式可复用，整体仿射只能处理画布/留白，不能证明旧区域解剖配准正确。选定后需要独立新模板/几何/区域集，按所选体型/视图重建16粗区域、命中/遮罩和局部bounds；A建议SVG编辑源+透明PNG运行。当前renderer尚无图片异步绘制分支，不能只改路径配置。前后可有自然外轮廓差异，不强求outline完全一致。单一体型的整理/适配/配准/技术验收初估3～5工程日，非执行结果或医学审核承诺。data/atlas保持禁用空结构。

| 实际检查 | 结果与限制 | 证据 |
| --- | --- | --- |
| 网络检索及原文件许可核验 | PASSED（文献/来源调查范围）；A BY-SA 4.0、B CC0；Servier BY4.0明确允许应用但图像内容不适合。付费打包与其他权利未确认处标UNKNOWN | [比选报告](docs/v13-material-review.md)及[调查记录](docs/validation-records/v13-research-2026-10-22.txt) |
| 开放原文件获取 | Goran男女SVG、Cdang四视图SVG、Servier双面PNG成功；中性线稿HTTP429失败保留 | [获取URL/字节/哈希/失败](docs/research/v13-materials/fetch-record.json) |
| SVG结构检查与离线预览 | PASSED，原SVG可解析，本地SVG→PNG成功；最终六图人体高度650px，完整性实际看图；不能外推微信直接SVG解码 | [结构检查](docs/research/v13-materials/svg-inspection.json) / [预览记录](docs/research/v13-materials/preview-record.json) |
| 首次预览失败 | FAILED，派生SVG以ns0:svg序列化导致本地图形库拒绝识别，exit1；改默认SVG命名空间后成功，原文件字节未改 | [调查记录](docs/validation-records/v13-research-2026-10-22.txt) |
| 最终边界/文件与来源哈希、JSON/文档、项目及图谱静态检查 | PASSED，3份既有文档修改、34个研究/证据文件新增、0删除；所有运行代码及原历史证据原字节保留 | [V1.3验证记录](docs/validation-records/v13-validation-2026-10-22.txt) / [文件边界审计](docs/validation-records/v13-scope-audit-2026-10-22.txt) / [文件清单](docs/v13-changes.txt) |
| 新素材微信Canvas、命中/区域、真实触摸和真机 | NOT_RUN，尚未选定，不实施替换；本轮离线预览不是微信截图 | 本轮用户强制决策关卡 |

剩余风险：A的SA交付条件需用户接受；B的线稿视觉能否满足目标需用户确认；人物衍生素材的其他适用权利和医学准确性不能仅由CC许可保证；SVG源与未来PNG/命中必须同一变换；新图绝不能沿用全部旧区域坐标。未经选定，本轮不将资源更换标记完成。

下一步：等待用户在已交付预览中选择A1、A2、B，或转专业委托。只有选定后才进入资源替换→版本升级→区域/命中配准→坐标验证→真实视觉验收。选择前运行代码保持不变。

## V1.3 实际素材替换追加（2026-10-22）

版本名称：V1.3：使用真实Commons人体正背面素材。  
状态：**DONE（本轮素材替换、重新配准和已列工程验收范围）**；真机/其他模拟器及未覆盖的输入补测单列NOT_RUN，不宣称全设备或专业医学验收通过。  
授权变化：用户最新指令明确指定优先查看Human body with blank labels.svg并直接替换。上轮等待选型的关卡与TODO已被这次授权取代，保留原文为历史；本轮自主采用符合许可的指定素材，没有继续修补旧人体。

任务与实际完成：
- [x] DONE 阅读AGENTS/task/README/架构/图谱规范、资源/绘制/区域/命中/坐标/调试/缩放和现有测试；修改前保存166个非忽略文件快照用于字节比对
- [x] DONE 实际查看指定Commons原图、文件许可和两级衍生来源，下载真实原SVG并固定SHA；选用CC0中性前后线稿
- [x] DONE 保留原SVG，提取原前/后独立人体组、移除标签引线，统一等比画布；不重画、不拉伸人体、不翻转前图
- [x] DONE 导出两张本地透明1200×2700 PNG，Canvas异步加载后实际drawImage，失败提示/重试，不回退旧人体
- [x] DONE 新模板commons-neutral-v1/4.0.0，新geometry及regionSet；保留旧v1/v2/v3资源、原样存档v3区域
- [x] DONE 全部16粗UI区域及局部bounds针对新图配准，命中/高亮同源轮廓重新生成；归一化公式/左右约定/调试功能保留
- [x] DONE 独立像素与区域配准测试、公式回归、类型检查、后端既有回归、项目/空图谱检查
- [x] DONE 实际查看新两面和旧v3/新正/新背/工程参考同尺度离线对比，微信小屏实际显示新模型、全部区域控件和多点输入验证
- [ ] TODO 补充真实背面点击、精确臂躯间隙采样、滚动前后对照及每一区域逐图裁切；NOT_RUN，当前输入通道后续出现noWindowsAvailable，未伪造输入
- [ ] TODO 其他模拟器/DPR3、真机/旋转、十字像素级误差、专业医学审核与用户最终美术确认；NOT_RUN，不继承历史版本结果

原模型分析：旧v3的数值比例断言不能保证视觉自然，颈肩、胸腰髋体积、膝踝及手足仍呈人为简化曲线。用户已经否定旧模型视觉，故停止局部path改造。新素材选型依据为真实预览中的完整成年形态、可辨关节/掌指与背面结构、简洁线稿、同套双面、编辑源和明确CC0授权。它是表面教学示意线稿，不是写实三维模型或已医学审核的解剖教材；未为凑7.5～8头身强行改原图比例。

来源与许可：采用[Human body with blank labels.svg](https://commons.wikimedia.org/wiki/File:Human_body_with_blank_labels.svg)，Šlomo，2015-11-18，750×768；[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)允许免费修改、商业使用、复制及打包分发，无强制署名/同许可要求。本地保留作者衍生链和[NOTICE](miniprogram/assets/body/commons-cc0/NOTICE.md)，没有默认整个Commons属于CC0。获取HTTP200/187724字节，[精确下载记录](docs/research/v13-replacement/source-fetch.json)，SHA-256：486cdc8a89fbfe0ff0a4bb4104efc19bb5c708337c37768be6f9120c4837753a。其他权利及医学准确性不由CC0保证。

实际技术变化：

| 项目 | 原v3 | 当前素材与配准 |
| --- | --- | --- |
| 模板/版本 | neutral-body-v3 / 3.0.0 | commons-neutral-v1 / 4.0.0 |
| 几何 / 区域集 | neutral-body-v3 / neutral-body-v3-ui-regions-1 | commons-blank-cc0-v1 / commons-blank-cc0-v1-ui-regions-1 |
| 显示源 | 本地手工贝塞尔路径 | 原SVG g5692/front71paths、g5815/back49paths → 独立PNG，真正drawImage |
| 画布 | 400×900 | 400×900，公式不变，原两面同scale=840/731、同Y位移8.16689466484268，各自水平居中 |
| 轮廓 | 两面共用连续示意轮廓 | 两面独立同源栅格边缘；前1563顶点、后1487顶点，含真实掌指与间隙 |
| 关键参考 | 原原创插画关节点 | 逐面人工工程配准：front肩/肘/腕y220/340/448，裆/膝/踝481/640/820；back206/330/450、477/635/820 |
| 区域 / 局部范围 | v3 UI多边形/bounds | 16区域全部重建并独立参考点核验；front头下界已超过旧范围，不可直接复用旧表 |
| 保留与迁移 | v1/v2/v3历史资源 | 原文件原字节保留，新增body-regions-v3.ts原样快照；旧点拒绝跨版投影，不静默迁移 |

轮廓处理只对源线稿栅格做alpha阈值24、3×3像素闭运算弥合细小断线、外部漫水与边界跟踪，并以0.3逻辑单位简化；原SVG人体path没有因此变形。命中/裁剪与运行PNG同源，并有独立PNG解码密集对照。工程参考不是医学皮节，不用简单整体仿射来假定旧区域有效。正式皮节未来必须绑定本模板id/version和view，当前医学三份JSON保持原字节、空且禁用。

视觉交付：[新旧四栏PNG](docs/validation-records/v13-replacement-comparison-2026-10-22.png) / [SVG](docs/validation-records/v13-replacement-comparison-2026-10-22.svg)，[新两面PNG](docs/validation-records/v13-replacement-model-preview-2026-10-22.png) / [SVG](docs/validation-records/v13-replacement-model-preview-2026-10-22.svg)。已实际看图：身体完整、手足/关节结构和颈肩过渡明显区别于旧图，两面同尺度，未观察到明显长小腿、狭直躯干或前后尺寸不一。资源预览不是微信截图；本轮真实微信正背面及局部截图由CUA在对话工具输出中取得并查看，分别记录于[视觉摘要](docs/validation-records/v13-replacement-visual-2026-10-22.txt)与[GUI记录](docs/validation-records/v13-replacement-gui-2026-10-22.txt)。

实际测试（2026-10-22，macOS arm64，Python3.12既有venv/Node21.7.3/既有TypeScript5.9.3；无新增项目依赖）：

| 方法 / 命令 | 实际结果 | 证据 |
| --- | --- | --- |
| 获取/转换源素材 | PASSED；初期单通道mask断言FAILED，明确灰度输出后成功；原SVG完整保留 | [构建与失败修复摘要](docs/validation-records/v13-replacement-build-2026-10-22.txt) / [manifest](miniprogram/assets/body/commons-cc0/manifest.json) |
| 首次npm类型检查目录错误 | FAILED，根目录无package.json、exit254；随后正确目录通过，不隐藏首次错误 | [首轮原始记录](docs/validation-records/v13-replacement-first-tests-2026-10-22.txt) |
| miniprogram下npm run typecheck / npm test | PASSED，exit0 / 58/58；独立公式、源像素命中、16区域/focus配准、DPR/生命周期/加载异常分开覆盖；其中7个v3比例用例仅历史夹具回归 | [最终回归完整日志](docs/validation-records/v13-replacement-regression-2026-10-22.txt) / [扩展首轮58项](docs/validation-records/v13-replacement-expanded-tests-2026-10-22.txt) |
| backend下.venv/bin/python -m pytest | PASSED，12/12，exit0；保留1条上游Starlette弃用警告 | 同上最终回归日志 |
| check_atlas.py / check_project.py | PASSED，exit0；空图谱禁用，含新资源与脚本的结构检查通过 | 同上最终回归日志 |
| 原SVG/派生哈希、原path、历史字节、相对链接/JSON/WXML与边界审计 | PASSED；20文件修改、42新增、0删除；106受保护文件原字节、163相对链接、22JSON与5WXML。首次因自引用证据文件未创建而FAILED，创建记录后重跑通过，原失败保留 | [范围审计](docs/validation-records/v13-replacement-scope-2026-10-22.txt) / [修改清单](docs/v13-replacement-changes.txt) |
| 微信重新编译/重开当前项目、进入页面 | 初期新模块热更新FAILED；重开后新两面真实渲染，最终Errors0/Warnings5 | [GUI记录](docs/validation-records/v13-replacement-gui-2026-10-22.txt) |
| 小屏实际交互/坐标 | PASSED已列范围：16区域选择/放大/复位控件状态、新头/上背局部实际绘图、真实胸部及头颈腹/上肢/膝踝点击、胸点放大复位坐标不变、模型外拒绝；未覆盖项详见GUI | 同上；不外推真机/全部视觉裁切 |

实测胸点normalized(0.4928,0.2832)；Canvas点击与全身十字均(141.3,80.6)，放大后十字(133.3,127.9)，复位回原位，标准值不变。双腿间隙/留白点击后标准坐标空；模型外完整提示已读取。首个“臂躯间隙”采样实际落在臂边缘，返回有效位置；修正点尚未输入即遇原生通道noWindowsAvailable，故不把该真实间隙步骤记PASS。自动源像素间隙对照另已通过。

文件范围：修改当前配置、图片绘制/加载、16区域及展示文案，新增来源SVG/派生资源/生成轮廓/构建脚本/独立配准测试/旧v3夹具，更新README/架构/图谱规范/验证/来源及本台账；[逐项清单](docs/v13-replacement-changes.txt)。coordinate.ts/body-path.ts/body-debug.ts、所有后端业务、依赖、正式atlas、旧模型及过去证据不变。未开发V2/V3，不自动提交或推送Git。

本轮结论：**小程序已经实际使用新Commons素材，素材替换目标完成**。工程观察支持它作为新的简洁表面底图；最终用户美术认可、专业医学审核、其它设备及上列补测不冒充完成。下一步先补足这些验证；只有另行获得V2授权才开发病灶标注，V3仍依赖合法正式图谱与审核。

## V1.5：人体直点式区域选择与页面交互改造

状态：IN_PROGRESS（2026-10-22，按用户粘贴的V1.5完整要求实施）。  
授权：正常全身点击→粗区域高亮→底部确认放大；备用底部列表；调试隔离；布局与回归。保留Commons素材/姿态、commons-neutral-v1/4.0.0和归一化规范，不改医学图谱，不开发V2/V3，不提交推送。

开工检查：区域为独立归一化多边形，bounds只用于放大；已有probeTouch统一处理Canvas本地x/y或clientX/Y减新rect、逆变换与源轮廓命中。尚无区域点击选择。原拖动阈值8 CSS px、异步generation隔离和focusViewport可复用。front头/颈、颈/胸、胸/上臂及腹/腿存在重叠，需报告候选，不按数组顺序任选。旧大按钮和多卡片使页面过长。没有局部AGENTS；已保存修改前非忽略文件快照以验证素材/后端/坐标/历史边界。

计划：
- [x] DONE 新增纯区域命中工具，区分唯一/外部/未配置/候选
- [x] DONE 组件共用真实触点处理，选择/局部/调试/弹层隔离
- [x] DONE 紧凑浏览布局与两列底部列表，统一选择入口，明确overview/focused
- [x] DONE 补自动用例并回归原坐标/图片/配准与后端静态检查
- [ ] IN_PROGRESS 微信实际流程、320/375/430与矮屏检查、截图；未能执行如实NOT_RUN
- [x] DONE 更新README/架构/验证、本台账和实际文件/边界清单

测试状态：NOT_RUN（开工时，后续只追加真实结果）。

### V1.5 实施与验收追加记录（2026-10-22）

当前结论：**IN_PROGRESS：交互代码及自动回归完成；真实模拟器部分通过，精确触点、剩余尺寸和本地截图导出未完成。** 上述开工NOT_RUN保留为历史，不代表最终自动检查状态。未进入V2。

实现：页面集中管理overview/focused、选择、候选、底部列表和开发调试；初次无默认选择，人体唯一命中与列表共用applySelection，只选中不放大。有效选择后确认放大，局部普通点击忽略，返回全身保留选择；换面清空选择/缩放/调试点。底部两列列表由当前区域配置生成，取消保留视口/选择，改选回全身；移除主界面大按钮、大卡片和占位“下一步”。来源许可收到“说明”，调试默认关闭并明确隔离提示。

命中：新增body-hit-test纯工具，先源人体轮廓过滤，再bounds预筛与已有UI多边形点包含；使用原0.25逻辑单位边缘容差，返回全部候选，不按数组顺序、最近点或高度猜测。唯一/体外/未配置/歧义独立处理；解剖左右与正背面区域不变。现有头颈、颈胸、胸腹及腹腿等粗区域重叠是事实，通过候选确认而非编造新医学边界解决。未观察到足以要求更改现有素材/区域的明显错位；这不等同专业医学审核。

坐标与事件：继续readTouch/probeTouch统一逆变换，Canvas本地x/y或clientX/Y减新rect，DPR只设物理画布；8 CSS px滑动、多指、取消、重复结束、生命周期及过期异步隔离。onShow/onResize/布局修订重测，点击另查新rect，尺寸不一致拒用旧变换。弹层/说明优先阻断，debug只探测不选区，focused普通点击不产生标记。正常选择不存点、不调API。高亮复用原裁切/视口绘制。

真实布局修复：微信原生Canvas曾盖住弹层，改为阻断期间仅隐藏绘制节点并保留外壳、缓存、模板和标准调试点，暂停隐藏节点测量，关闭后重测重绘。小屏原生辅助按钮固有宽度导致标题/列表溢出，改用可访问button语义view及两列固定单元；主操作按钮仍原生。所有失败、初始类型错误与目录误用保留在[首次检查](docs/validation-records/v15-first-check-2026-10-22.txt)。

自动执行（最终全回归，各退出0；原始输出：[v15-regression](docs/validation-records/v15-regression-2026-10-22.txt)）：

| 工作目录 | 命令 | 实际结果 |
| --- | --- | --- |
| miniprogram | npm run typecheck | PASSED，TypeScript 5.9.3 |
| miniprogram | npm test | PASSED，73/73，0失败；既有坐标/图片/源像素配准回归保留 |
| backend | .venv/bin/python -m pytest | PASSED，12/12；Python3.12.14，一个既有Starlette弃用提示 |
| 根目录 | backend/.venv/bin/python scripts/check_project.py | PASSED，必要文件、JSON、注册与路径 |
| 根目录 | backend/.venv/bin/python scripts/check_atlas.py | PASSED，正式空图谱仍未验证/禁用 |

独立手算synthetic UI矩形/三角形夹具只放backend/tests/fixtures（无医学标签）；覆盖体内未配置、多候选/边缘、体外/包围盒假阳性、非法输入/顺序无关。真实16区域分别检查左右和正背面；组件使用手算CSS触点独立期望，覆盖320/375/430和矮容器、滚动rect、轻触/拖动/多指、候选、失效查询、弹层原生绘制层恢复及debug归一化点不变。页面覆盖选择与列表一致性、取消保留局部、错面错版、调试隔离。Node组件替身不是微信实际渲染/触控验收；公式、UI命中与源图配准分别核验。

真实微信工具：Stable2.01.2510290、基础库3.17.4。曾编译缓存拒绝新组件，清除编译缓存后Errors0（未修改项目过滤设置）。320×568/DPR2实际看过全身未选、胸部已选、胸部局部、最终两列弹层四状态截图，头脚完整、底栏不盖脚、标题/操作文字可见、列表末行可达。实际执行列表选胸→高亮但不放大→确认放大→focused普通Canvas点击不换区→更换/关闭保留局部→返回全身保留选择→列表头部→换背面清空；Canvas中心实际触摸另成功出现腹部/左右腿候选而非任选。详见[真实GUI记录](docs/validation-records/v15-gui-2026-10-22.txt)。

未完成：精确胸部唯一触点、臂躯留白/真实拖动与遮罩点击、V1.5实际调试十字和≤2 CSS px测量；375切机型后曾出现模拟器框/内容不同步，重开后AX状态恢复但截图变为畸变小窗，不能判PASS；430最终实测、真机/旋转均NOT_RUN。原生坐标输入报noWindowsAvailable，后续截图导出/Preview连接timeoutReached。已有四状态真实截图留在本次对话工具输出，未能确认本地PNG导出，**本地截图交付要求尚未满足**。无HTML/资源预览冒充微信截图。

范围：素材SVG/PNG、模板commons-neutral-v1/4.0.0、400×900逻辑画布、16区域/命中源数据、coordinate/body-debug/body-path、atlas-spec和正式医学atlas均保留；后端业务/依赖不变，backend仅新增按规范放置的UI合成夹具。逐项文件见[v15-changes](docs/v15-changes.txt)，修改前208文件比较及静态补检见[范围核对](docs/validation-records/v15-scope-2026-10-22.txt)。旧版本历史和失败证据保留，无Git暂存、提交或推送。

验收判定：V1.5实现与自动回归已完成，**未达到全部真实验收条件，不标DONE**。下一步依docs/validation.md第12节补精确输入、375/430、调试误差和四状态本地截图，追加真实结果后再收尾；本轮不继续V2。

## V1.6：人体区域边界精修与点击、高亮一致性修复

状态：IN_PROGRESS（2026-10-22，按本轮用户要求；V1.5未完成的真实验收记录保留）。
授权：精修粗区域几何、共用边界、高亮及点击一致性；保留Commons素材/模板坐标、页面布局与交互，不开发V2/V3、不改正式图谱、不提交推送。

计划：
- [x] DONE 检查真实原资源、区域多边形/放大bounds/源轮廓及绘制命中，留修改前快照
- [x] DONE 同步胸/上肢/颈/腹及背面邻界，独立修订区域集版本，不改人体模板版本
- [x] DONE 轻量实线高亮与共享几何，独立源图参考点及几何/缩放/一致性测试
- [ ] IN_PROGRESS 同倍率前后/左右臂/交界预览，尝试实际微信；如实记录NOT_RUN
- [x] DONE 自动回归、范围检查和文档实际结果

开工测试状态：NOT_RUN；结果后续追加。

### V1.6 实施与实际结果（2026-10-22）

当前状态：**IN_PROGRESS：区域修复、自动验证、离线对照和375宽实际渲染已完成；精确上臂/边界原生触点与其余机型补验未完成，不宣称全部验收DONE。** 开工NOT_RUN与V1.5限制保留历史。

原因核查：render.ts实际画selected.outline闭合多边形并裁切源人体；body-hit-test实际用相同outline点包含，bounds仅预筛及focus，三种职责未错误混用。原胸部四点梯形覆盖肩/上臂，与上肢有真实面积重叠。独立Shapely将旧胸/上背与上肢交集裁到源人体内，正面左/右约2054.254475/2054.503216逻辑平方单位，背面约2123.218952/2183.434057；修订后均为0。原SVG正面71条/背面49条路径均fill:none，闭合小细节并非封闭身体区域套件；源图、PNG与400×900坐标配准未发现整体偏移，局部粗区域不贴合是本次原因。

修订内容：正/背面各自肩臂seam按原图腋线和肩部可见结构重配，肩外侧归对应上肢。共享neck base、waist和flank数组以正/反方向复用，胸侧保留，不把梯形简单缩小。为相邻分区整体一致，同时修正头颈接线、下腹/腰背与双腿在产品骨盆线y450的衔接及足侧覆盖；因此16区域均有修订，名称和ID不变。最终每面8个简单闭合多边形、28对区域内部交集为0，源整体轮廓未分配面积为0；未增加医学边界。体外仍被bodyOutline门控，未配置分支保留，公共边沿用0.25逻辑单位容差返回候选，不靠先后顺序或吸附。

三种数据：outline=实际区域（绘制、最终命中共用），bounds=包围盒加归一化x0.015/y0.012留白得到的局部视野（仅放大/预筛），hitOutline/visual.outline=源整体有效人体。高亮改20%浅绿填色与1 CSS px细实线，圆角连接，随viewport.scale抵消缩放变粗；裁切save/restore成对，源线稿可读。没有Path2D、DOM、运行重采样或新框架。

版本：人体模板commons-neutral-v1/4.0.0、geometryId commons-blank-cc0-v1、400×900和图片均不变；只将区域配置从commons-blank-cc0-v1-ui-regions-1修订为ui-regions-2。body-regions-v15.ts是原区域文件逐字节快照；新旧ID同名不表示几何语义相同。当前没有持久化选择或病灶数据，无业务数据自动迁移；未来依赖区域几何的数据必须绑定regionSetId。医学atlas保持空、unverified、mapping_enabled=false。详见[身体区域约定](docs/body-regions.md)。

实际执行（退出0，[最终完整回归](docs/validation-records/v16-regression-2026-10-22.txt)）：

| 目录 | 命令 | 实际结果 |
| --- | --- | --- |
| miniprogram | npm run typecheck | PASSED |
| miniprogram | npm test | PASSED，77/77；原坐标、触点、图片、状态、调试及源像素配准保留 |
| 根目录 | backend/.venv/bin/python scripts/check_body_regions.py | PASSED；16闭合简单多边形、每面28对无面积重叠、共边/焦点包含/源轮廓覆盖 |
| backend | .venv/bin/python -m pytest | PASSED，12/12；一个既有Starlette弃用提示 |
| 根目录 | backend/.venv/bin/python scripts/check_project.py | PASSED，V1.6文件/注册/JSON/路径 |
| 根目录 | backend/.venv/bin/python scripts/check_atlas.py | PASSED，正式空图谱仍禁用 |

新增38个人工源图参考点（每面19）：先实际查看原PNG及20逻辑单位网格，独立指定期望，再用命中函数验证；胸中央/两侧、明显上臂、肩界两侧、颈/腹、空气与共边均覆盖。PNG透明度使用Node核心独立解码，实际fill路径与outline逐点比较并独立射线法检查参考点是否染色；focusBounds放大成整画布不改变命中。跨320/375/430及矮容器、全身/focus/复位验证同点归属。几何审核与公式回归、源图参考点和真实微信分别报告，不冒充医学配准或物理输入实测。

失败保留：[首次检查说明](docs/validation-records/v16-first-check-2026-10-22.txt)、[最初70/73回归](docs/validation-records/v16-first-regression-2026-10-22.txt)。三个旧断言分别依赖已删除头颈/颈胸重叠带，以及把focusBounds当作左右分界；改成新公共边与实际outline断言后77/77，未改坐标公式“配合测试”。早期几何草稿的窄缝/人体外重叠已改共享flank并复查。原失败日志不覆盖。

视觉证据：[同倍率旧/新与左右臂PNG](docs/validation-records/v16-regions-2026-10-22-comparison.png) / [SVG](docs/validation-records/v16-regions-2026-10-22-comparison.svg)，以及[共享边界参考PNG](docs/validation-records/v16-regions-2026-10-22-boundaries.png) / [SVG](docs/validation-records/v16-regions-2026-10-22-boundaries.svg)。已实际查看：胸/上背不再盖住外侧上臂，左右臂与躯干分开，腋下沿源线、无人工挖空。它们由真实生产drawBody命令与原PNG导出；旧区域统一用当前样式，便于隔离几何变化。均明确是离线对照，不能当作微信截图。

真实微信（Stable2.01.2510290、基础库3.17.4、iPhone6/7/8=375×667/DPR2、118%）：实际编译Errors0，3～4条基础库/热重载提示。列表胸部→实际全身新胸高亮→确认放大→返回全身，左右上肢分别选择及背面上背部实际渲染/放大均已观察；肩外侧未染为胸部，上肢自己的肩/臂/手高亮，解剖左右对应、布局稳定。真实截图留于本轮CUA工具输出，未宣称导出本地GUI PNG。调试首次AX点击只聚焦未开启，重试实际确认Value1后Canvas中心点击得到有效单点X0.4951/Y0.2502，所选上背不变，真实截图有十字；返回全身后标准值相同。详见[真实GUI记录](docs/validation-records/v16-gui-2026-10-22.txt)。

待验/限制：精确胸侧、上臂和空气位置原生坐标点击报Computer Use noWindowsAvailable，不能将列表/Canvas中心事件当作这些位置的实测；公共界真实触摸、其余320/430机型、真机/旋转及≤2 CSS px误差未验，记录NOT_RUN。肩部产品分界的最终审美认可与人工精细复核仍需用户确认；这不是医学审核。可在微信按docs/validation.md第13节复验，本轮不继续V2。

修改文件见[V1.6清单](docs/v16-changes.txt)，素材/模板/坐标/页面/后端/图谱/历史字节边界检查见[范围核对](docs/validation-records/v16-scope-2026-10-22.txt)。没有更换或重画人体，没有改页面布局、后端、API、依赖或医学状态，没有Git暂存/提交/推送。

## V1系列收尾与V2准备（2026-10-22）

本条是当前阶段决策，前面V1及V1.x记录是当时真实历史，不覆盖其中FAILED/NOT_RUN/IN_PROGRESS。

- [x] DONE 记录用户已认可当前人体模型和基础交互，决定结束V1迭代。
- [x] DONE 审查实际实现、占位能力和已有证据，区分接受、实现与验证。
- [x] DONE 固定V2依赖基线、已知问题及阶段门槛。
- [x] DONE 完成V2.1～V2.5方案、数据/交互约定、测试及最终验收计划。
- [ ] TODO V2业务开发，须下一轮授权；本轮没有修改业务文件。

**三个维度分开记录**：

| 维度 | 本轮结论 |
| --- | --- |
| 用户决策 | 用户本轮明确“V1可以结束，下一步准备开发V2”；当前模型与基础交互已接受，V1迭代结束，不继续非阻塞外观优化 |
| 实现状态 | 当前Commons正/背面本地PNG及可编辑SVG，完整人体；每面8个粗区含头、颈、胸/上背、腹/腰背及解剖左右四肢；人体点击/候选确认、共享多边形高亮、两列备用弹层、确认聚焦/复位、单点坐标调试、整体人体/模型外命中、布局和异步重测均有代码。annotate/result仍V0占位，没有病灶绘图、会话暂存或医学匹配 |
| 验证状态 | 最新既有V1.6自动证据PASSED：typecheck、77/77前端、12/12后端及几何/项目/空图谱检查；375模拟器实际胸部/双臂/背部高亮、focus/复位、debug已观察。精确上臂/公共界/空隙触点、当前修订的320/430全面实测、真机/旋转、≤2 CSS px误差和本地GUI截图导出仍NOT_RUN/未完成；历史失败保留，不据用户认可改成PASS |

用户接受与收尾记录本身DONE；**不把V1.x原先要求的全部验证标为DONE**，不弱化AGENTS第2/3/8/10节。原V1最初DONE仅指当时列明的交付/模拟器范围，后续子轮的IN_PROGRESS记录也继续保留。V1迭代结束不等于医学审核、临床验证、病灶识别或神经节段匹配完成。本轮未修改AGENTS质量要求；其旧轮次授权说明不作为继续V1视觉工作的理由，以本轮用户“只收尾规划”指令为准。

实现/验证依据：[V1.6实际回归](docs/validation-records/v16-regression-2026-10-22.txt)、[真实GUI范围](docs/validation-records/v16-gui-2026-10-22.txt)、[几何](docs/validation-records/v16-geometry-2026-10-22.txt)、[最初失败](docs/validation-records/v16-first-regression-2026-10-22.txt)及更早各轮记录。**本轮仅审查这些既有证据，没有重跑单元测试或新做微信验收**。本轮文档/范围检查单独记录在[收尾检查](docs/validation-records/v1-close-v2-plan-2026-10-22.txt)，不能算V2测试。

本轮文档验核实际记录：2026-10-22，既有macOS/Python3.12环境；命令`backend/.venv/bin/python /private/tmp/audit_v1_close_v2_plan.py`（本轮临时检查脚本，不新增项目业务工具），exit0。输入为修改前246个非忽略文件快照与当前文档；结果为6份既有文档修改、2份文档/证据新增、0删除，其余240份（含AGENTS、所有业务源码/素材/测试/后端/图谱/依赖及旧证据）字节不变；162个相对链接和4个JSON示例有效，6个冻结SHA指纹相符，38项V2用例七字段完整且全NOT_RUN，五个开发子阶段仍TODO。V0～V1.6历史、旧V2简略计划、V3～V8记录保留；未创建V2模块、业务测试、夹具或空组件。本轮只将文档检查记PASSED，不记作V2业务测试，也没有Git暂存/提交/标签/推送。

### 遗留事项分类

| 类别/编号 | 事项 | 处理决定 |
| --- | --- | --- |
| A1 不阻塞V2.1 | 轻微样式/文案、肩界审美细节、可选分区调试显示 | 接受现状，留待必要时另行授权，不再继续V1视觉迭代 |
| A2 不作为现有错误结论 | 已知开发工具提示/热更新现象、更多设备与本地GUI截图补证 | 保留历史限制；若V2输入/布局复现真实问题，再按影响处理，不伪造历史通过 |
| B/P1-P3 阶段门槛 | 现有Canvas没有annotationpoint/病灶层，focused正常点击被忽略；没有权威会话与返回保护 | 这些是尚未开发的V2能力，不是已解决的V1功能；纳入V2.1，先同视口/事件隔离/会话再接顶点，未通过不能进入V2.2 |
| B/P4 闭合阻塞 | 当前只有单点人体命中，没有完整用户多边形自交/边/填充包含校验 | V2.2先证明完整区域校验，不能顶点在内就保存，未完成则阻塞有效闭合 |
| B/P5 输入验收风险 | 精确位置原生触摸及多机型未完成，不能声称严重错位也不能声称已通过 | V2.1补独立参考和实际触点；发现明显错误必须先修，坐标/图层准入不通过不能推进点输入验收 |
| B/P6 生命周期风险 | 系统返回/进程终止不能保证全部拦截，现有页没有标注暂存 | V2.1逐操作写同一内存，V2.4验证返回/重入与失效提示，不承诺跨启动恢复 |
| V3依赖，非V2前提 | 正式医学图谱仍空、unverified、mapping_enabled=false | V2纯人工标注可准备；V3医学映射继续受数据/许可/配准/审核门槛约束 |

没有经证实、必须先改人体/布局才能启动V2.1的阻塞。本轮不修上述问题；缺失能力与测试门槛不因结束V1而消失。

### 固定基础与兼容边界

V2基线为commons-neutral-v1/4.0.0，geometryId commons-blank-cc0-v1，区域集commons-blank-cc0-v1-ui-regions-2；正/背源与运行资源在miniprogram/assets/body/commons-cc0/{front,back}.{svg,png}；400×900逻辑画布，PNG1200×2700。归一化完整画布左上原点、x右/y下、[0,1]有限值；front/back独立，解剖学左右不镜像混用。coordinate.ts提供fit/focus/reset/正逆变换，body-debug提供真实触点基准，body-path/同源hitOutline提供单点人体判断；body-canvas/region-picker/已注册annotate页可复用，lesion-editor只有.gitkeep不能当作现成编辑器。

路径、实际SHA-256指纹、可复用能力与缺口详见[开发计划第2～3节](docs/v2-plan.md)。不再非必要变更图片/比例/姿态/逻辑空间；必要变更须记录几何/区域版本及会话兼容处理。这是文档基线，没有Git提交、标签或发布，也没有更改正式医学图谱状态。

## V2：病灶区域标注

版本名称：V2：病灶区域标注  
状态：TODO  
开发目标：多次点击形成病灶多边形，支持多个不连续病灶，数据仅保存在当前会话。  
前置条件：V1 验收、用户授权 V2，坐标和视图规范已确认。

任务清单：
- [ ] 点击添加标注点
- [ ] 多边形连线和闭合
- [ ] 撤销
- [ ] 清空
- [ ] 标注数据保存于当前会话
- [ ] 支持多个不连续病灶

实验目标：验证标注坐标、边界处理和缩放一致性。  
实验输入：合成点击序列、边缘点、重复点、未闭合轮廓、多个不连续轮廓。  
实验方法：交互回放及坐标断言；缩放/尺寸变化后重投影；检查撤销、清空和重入页面。  
评价指标：坐标误差、有效多边形比例、操作行为一致性、状态隔离。  
验收标准：输出符合图谱规范的归一化多边形；无屏幕像素持久化；多病灶和编辑操作符合约定，非法轮廓明确提示。

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：依赖 V1。

版本结论：未开始。  
下一步：V1 完成并取得 V2 授权后实施。

### V2规划更新（2026-10-22，替代上方初始简略计划作为下一轮实施入口）

名称：**病灶多边形标注、多区域管理与会话暂存**。  
规划任务：DONE；业务开发：TODO；全部V2测试：NOT_RUN。  
前置：下一轮授权V2.1，读取当前规范和冻结基线；不要求先取得正式医学图谱，不意味着已解除V2整片几何和真实输入门槛。

[完整集中计划](docs/v2-plan.md)包含实际路径核查、基线、模式与状态、文档内数据结构、完整区域校验、依赖/风险、分阶段任务及38项测试计划。task是唯一进度入口，详细计划不维护另一份实际进度。

| 子阶段 | 任务/目标与依赖 | 完成标准（未来验收要求） | 任务状态 | 测试状态 |
| --- | --- | --- | --- | --- |
| V2.1 | 标注入口、既有annotate、唯一会话、模式/同视口/标准触点、返回保护；先核对基线 | 上下文正确且无假数据，错版/迟到事件拒绝，聚焦输入与调试隔离并有实际输入证据 | TODO | NOT_RUN |
| V2.2 | V2.1后实现逐点/撤销/取消/有效闭合；完整区域包含技术验证先行 | 单片有效可保存，非法/跨背景不保存且草稿保留，坐标和显示同源 | TODO | NOT_RUN |
| V2.3 | V2.2后多片、列表选片/删除、草稿与视图隔离、明确重叠策略 | 多片独立不连线、只删指定ID，切面不丢非空草稿 | TODO | NOT_RUN |
| V2.4 | 基于V2.1同会话完善暂存/返回/复核，依赖V2.3 | 同进程返回重入恢复；同页review仅显示真实范围/数量，可继续修改；不承诺跨启动 | TODO | NOT_RUN |
| V2.5 | 前四阶段通过后集成/非法输入/多区域多视图/坐标设备回归与文档 | 完整真实操作有证据；无法实际运行保留NOT_RUN，不以V1成绩冒充V2验收 | TODO | NOT_RUN |

关键规划：sessionId+basis（模板/区域配置）+view的单一内存会话；草稿开放点列与完成显式闭环分开，每view最多一草稿；完成列表逐片独立，允许重叠但不自动合并/统计面积。入口region只用于导航和初始focus，不能裁切病灶；调试点严格分离；路由只带标识、不带多边形。受控切面/离开处理草稿，系统返回和进程终止区别说明。完整环的边与填充包含不能由顶点命中代替。V2不发评估请求、不创建atlas_version，未来V4适配另行冻结契约。

全部新计划用例G01～G12、C01～C07、S01～S12、U01～U06、E01均NOT_RUN（合计38项），各项都有目标、输入、预期、执行方式和判据。没有创建这些业务测试/夹具、会话模块、类型或组件。V1的77项既有测试不是V2成绩。

下一次从V2.1开始：类型/唯一会话与单测 → 有效入口/既有annotate和初始聚焦 → 显式模式、同视口层接口、标准触点 → 受控/系统返回及错版/过期/异步保护 → 实际输入验证。P4完整多边形校验在V2.2闭合前完成；本轮不编码、不选新库、不改页面/后端、不提交或推送。

V2规划完成，下一轮可从V2.1开始实施。

## V3：神经皮节空间映射

版本名称：V3：神经皮节空间映射  
状态：TODO  
开发目标：加载合格图谱，验证多边形，计算交集并生成可解释的候选节段。  
前置条件：用户授权 V3；V2 数据契约稳定；医学映射必须有合法且审核通过的图谱。没有图谱时只可做独立合成几何测试。

任务清单：
- [ ] 加载标准图谱
- [ ] 多边形合法性检查
- [ ] 空间交集计算
- [ ] 重叠面积计算
- [ ] 候选节段排序
- [ ] 多病灶匹配
- [ ] 边界情况处理

实验目标：独立验证几何计算；另行验证医学映射，不混为一个准确率。  
实验输入：`backend/tests/fixtures/` 的 synthetic 几何数据，区域名使用 synthetic-a 等；后续医学验证使用合法审核样本。  
实验方法：以手算可核对面积为基准，覆盖完全包含、部分相交、完全不相交、跨多个区域、边界附近、多个病灶、非法多边形；明确多病灶合并计数及分母。  
评价指标：交集面积误差、候选覆盖与顺序、非法输入拒绝率；医学审核结果单列。  
验收标准：全部几何场景单测通过；能解释分母、排序、无匹配及多候选；未验证图谱不能进行医学映射；不将比例称为诊断置信度。

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：几何算法与医学验证均未开始。

版本结论：未开始。  
下一步：V2 完成并取得 V3 授权后实施。

## V4：FastAPI 接口集成

版本名称：V4：FastAPI 接口集成  
状态：TODO  
开发目标：小程序与后端完成图谱查询、标注评估业务通信。  
前置条件：用户授权 V4；V3 规则服务与数据契约稳定，具备业务联调图谱。

任务清单：
- [ ] 图谱查询接口
- [ ] 标注评估接口
- [ ] 请求参数验证
- [ ] 响应数据结构
- [ ] 错误处理
- [ ] 前后端联调

实验目标：验证正常、异常及边界请求和前后端契约。  
实验输入：有效标注、缺失/越界字段、不存在及未审核图谱、无匹配、多候选、网络错误。  
实验方法：pytest API 集成测试、OpenAPI 与 TS 类型核对、微信开发者工具和真机联调。  
评价指标：状态码、错误码、响应字段、结果可解释性、请求/异常 UI 行为。  
验收标准：小程序能提交标注并获取结果；每类错误可区分；Schema、TS、文档和测试同步；不泄漏敏感输入。

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：V0 的 501 占位接口不算业务集成完成。

版本结论：未开始。  
下一步：V3 完成并取得 V4 授权后实施。

## V5：结果可视化

版本名称：V5：结果可视化  
状态：TODO  
开发目标：完成从选择、标注到候选展示、返回修改的演示闭环。  
前置条件：用户授权 V5；V4 联调通过；合法图谱满足演示范围。

任务清单：
- [ ] 展示候选神经节段
- [ ] 高亮对应皮节区域
- [ ] 显示标注范围
- [ ] 展示几何重叠比例
- [ ] 展示医学提示
- [ ] 支持返回修改标注

实验目标：核验显示结果和后端语义一致，以及完整交互流程可用。  
实验输入：单候选、多候选、无匹配和需返回修改的合法测试用例。  
实验方法：端到端交互验证；逐项比对候选、高亮、比例及视图版本；记录用户对提示的理解。  
评价指标：完整流程通过情况、几何结果显示一致性、提示可见性。  
验收标准：完整业务闭环可用；显示候选及医学限制；比例明确为几何量；返回修改不混用视图/图谱。

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：尚无业务结果可视化实现。

版本结论：未开始。  
下一步：V4 完成并取得 V5 授权后实施。

## V6：人体区域扩展与验证

版本名称：V6：人体区域扩展与验证  
状态：TODO  
开发目标：在图谱具备条件时完善胸腹/背部，评估扩展范围。  
前置条件：用户授权 V6；V5 闭环通过；每个新增区域分别具备来源、许可及医学审核。

任务清单：
- [ ] 完善胸腹部
- [ ] 完善背部
- [ ] 评估侧面视图需求
- [ ] 评估头颈部扩展
- [ ] 评估四肢扩展
- [ ] 医学规则审核
- [ ] 用户交互测试

实验目标：验证新区域数据、人体方向和教学辅助解释一致性。  
实验输入：按区域分组的合法图谱与审核用例、用户交互任务。  
实验方法：几何回归、医学专家逐区域审核、交互测试；对不一致点记录争议及处置。  
评价指标：来源和审核记录完整性、几何回归结果、用户任务完成情况、待解决分歧。  
验收标准：所有实际启用区域有来源、验证状态和测试记录；未达条件区域保持禁用；评估扩展不等于已实现。

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：区域扩展取决于合法数据和审核资源。

版本结论：未开始。  
下一步：V5 完成后按数据条件和预算确定 V6 范围。

## V7：AI 辅助病灶分割（可选）

版本名称：V7：AI 辅助病灶分割（可选）  
状态：TODO  
开发目标：研究预训练交互分割能否降低人工标注成本，不取代人体解剖定位。  
前置条件：用户明确授权；合法授权且去标识化的数据和参考标注；资源预算及隐私流程确认；无 AI 时核心仍可独立运行。

任务清单：
- [ ] 评估 SAM 类交互分割
- [ ] 设计病灶 Mask 生成与人工提示流程
- [ ] 建立合法参考标注和数据划分
- [ ] 对比分割效果与人工修正成本
- [ ] 验证 AI 模块可独立关闭

实验目标：在具备参考标注时量化分割质量和使用成本，不预设结果。  
实验输入：合法图像、人工提示、参考 Mask、明确数据划分和模型版本/许可。  
实验方法：独立测试集对比；按个体划分避免泄漏；记录硬件、预处理、阈值及人工修正协议；无参考标注不开展定量比较。  
评价指标：Dice、IoU、推理耗时、人工修正时间或操作次数；结果按实际样本与范围报告。  
验收标准：实验可复现、数据来源可追溯、隐私合规；是否接入由实际收益决定；不得把图像分割指标当作解剖定位或医学诊断能力。

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：无数据、无模型、未授权；本版本可跳过，不能预填成功。

版本结论：未开始，可选。  
下一步：在核心闭环稳定且满足数据条件后决定是否启动。

## V8：集成测试及最终交付

版本名称：V8：集成测试及最终交付  
状态：TODO  
开发目标：完成授权范围的整体测试、文档及最终交付。  
前置条件：用户授权 V8；核心 V1～V5 完成；V6 实际范围确定；V7 如未开展则明确排除，不能阻塞无 AI 交付。

任务清单：
- [ ] 前后端联调
- [ ] 功能测试
- [ ] 边界测试
- [ ] 数据校验
- [ ] 性能检查
- [ ] 隐私检查
- [ ] 医学规则验证记录
- [ ] 部署说明
- [ ] README 更新
- [ ] 最终交付检查

实验目标：核实约定交付范围、可复现运行、风险和未支持能力。  
实验输入：获准启用的图谱、版本化合成测试集、授权医学审核记录及目标环境配置。  
实验方法：全量回归、前后端及真机联调、性能采样、敏感文件与日志检查、全新环境按文档复现；部署方式必须实际验证后才写已验证。  
评价指标：功能/边界通过情况、实际延迟与环境、审核覆盖、隐私缺陷和未解决问题。  
验收标准：全部约定功能与必要验证完成；报告真实测量及限制；重大问题解决；数据与医学审核可追溯；不宣称诊断能力。

实际实验记录：  
日期：NOT_RUN  
执行环境：NOT_RUN  
执行命令：NOT_RUN  
实际结果：NOT_RUN  
证据：NOT_RUN  
问题：整体项目在 V1，部署和最终交付未验证。

版本结论：未开始。  
下一步：依赖版本完成后按批准范围验收交付。


## V2 正式实施（2026-10-23）

状态：IN_PROGRESS。用户授权连续实施 V2.1～V2.5；V1 收尾与既有未验项不变。

- [ ] IN_PROGRESS V2.1：入口、唯一会话、模板绑定、初始聚焦与模式隔离。
- [ ] IN_PROGRESS V2.2：代码/自动化完成，真实闭合渲染待验（见最终记录）。
- [ ] IN_PROGRESS V2.3：代码/自动化完成，真实多片与两面待验。
- [ ] IN_PROGRESS V2.4：代码/自动化完成，实际单点重入通过，完成复核待验。
- [ ] IN_PROGRESS V2.5：自动回归与文档完成，完整实际验收待补。

开工：读取规范、计划及现有实现，记录 248 个非忽略文件的修改前 SHA（临时基线 /private/tmp/dermatome-v2-baseline.json）。原 annotate 为占位，无已有 V2 状态。保持模板4.0.0、区域2及坐标公式。首次类型检查 FAILED：Canvas 新增 Object/null 属性被微信类型定义推导为 never；改用官方支持的任意类型属性 type:null，业务值仍明确为 AnnotationLayer|null，继续重跑。

### V2.1～V2.4 实施与首轮验证追加

代码已接通：有效入口 → 既有 annotate → 同一 Canvas/viewport → 草稿/闭合 → 多片列表/确认删除 → 两面 → 同页复核。会话逐操作写唯一模块，返回不清空；未更改素材、区域或坐标公式。显式闭环遵循已定计划，运行时没有新增依赖。

2026-10-23：`npm --prefix miniprogram test` 首轮109/109 PASSED（v2-first-regression日志），补充真实组件定义/页面流程替身后117/117 PASSED（v2-flow-regression日志）。包含两片删除/重入/背面/复核完整自动流程，不能代表微信端到端。类型检查修正属性声明后PASSED。两次测试启动前的工作目录/输出路径错误未执行测试，已改为明确的 --prefix 与根目录证据路径，不计为产品失败或测试通过。

阶段执行已连续推进到V2.5；V2.1～V2.4代码与当前自动用例完成，阶段整体保持IN_PROGRESS（实际触点/渲染门槛待验），不因工具障碍停止独立可完成的工程工作。微信首次热加载 FAILED：新增lesion-render、annotation-session模块未识别；已尝试清编译/文件列表缓存。当前原生坐标输入报`Computer Use server error -10005: noWindowsAvailable`，截图仅窗口缩略图，不能当作可验收的小程序运行证据。真实草稿/闭合/多片/复核截图和端到端保持NOT_RUN，继续独立几何对照与回归。

### V2.5 最终自动验证与实际验收结论（2026-10-23）

**当前 V2 总状态：IN_PROGRESS；代码完成，实际运行完整验收待验证。** 未改医学审核状态，未开发V3，无Git提交/推送/标签。阶段状态按完整验收口径：

| 子阶段 | 代码与自动化 | 真实运行及整体状态 |
| --- | --- | --- |
| V2.1 入口/会话/模式 | DONE；有效入口、模板绑定、唯一权威、初始聚焦、模式/异步隔离 | 实际入口、聚焦、单点/撤销及重入PASSED；完整模式/设备项待验，IN_PROGRESS |
| V2.2 单片绘制/校验 | DONE；草稿、撤销取消、闭合/填充、自交/退化/整片包含 | 单点实际绘制PASSED；真实三点闭合、错误轮廓及填充待验，IN_PROGRESS |
| V2.3 多片/两面 | DONE；独立ID、确认删除、重叠不合并、切面草稿处理 | 真实多片删除、两面完成区域NOT_RUN，IN_PROGRESS |
| V2.4 恢复/复核 | DONE；即时内存、返回、失效/错版、完成与继续 | 实际单点草稿保留返回/重入PASSED；完成区域复核/继续NOT_RUN，IN_PROGRESS |
| V2.5 集成验收 | DONE（自动化和文档）；保留全部历史失败 | 实际E01、320/430/矮屏、真机和四类截图未齐，IN_PROGRESS |

- [x] DONE V2.1～V2.4全部授权代码，连续推进，没有停在占位或规划。
- [x] DONE V2.5自动集成回归、独立几何对照、V1/后端回归、原生页面/样式编译和范围核对。
- [x] DONE 更新README、计划实际差异、架构、验证及本地数据规范；首页仅修正过时能力文案，未重设计布局。
- [ ] IN_PROGRESS 完整真实微信E01流程、闭合/多片/复核截图、精确触点/滚动/弹层、多尺寸与真机验收。

实际命令与结果（均2026-10-23）：

| 命令/检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm --prefix miniprogram run typecheck` | PASSED | v2-final-regression日志 |
| `npm --prefix miniprogram test` | PASSED，118/118，无跳过 | 同上；包括新几何/会话/页面及Canvas用例和全部既有回归 |
| `backend/.venv/bin/python scripts/check_annotation_geometry.py` | PASSED，2421个固定/种子随机案例与独立Shapely一致；两面1563/1487点外环有效且无孔 | v2-geometry-oracle及final日志 |
| `backend/.venv/bin/python scripts/check_body_regions.py` | PASSED，原16区无面积重叠、完整覆盖、共边及focus | final日志 |
| `backend/.venv/bin/python scripts/check_project.py`、`scripts/check_atlas.py` | PASSED，注册/路径/JSON与空图谱禁用约束 | final日志 |
| backend中`.venv/bin/python -m pytest` | PASSED，12/12，1条依赖警告 | final日志 |
| 微信安装包wcc / wcsc CLI编译 | PASSED，输入文件预先确认存在、输出非空；不能等同实际运行 | final日志；首页文案后单独补编译见post-copy日志 |

证据链接：[首轮109项](docs/validation-records/v2-first-regression-2026-10-23.txt)、[补充流程117项](docs/validation-records/v2-flow-regression-2026-10-23.txt)、[最终118项及全回归](docs/validation-records/v2-final-regression-2026-10-23.txt)、[独立几何](docs/validation-records/v2-geometry-oracle-2026-10-23.txt)、[失败与修复](docs/validation-records/v2-failures-2026-10-23.txt)、[真实GUI记录](docs/validation-records/v2-gui-2026-10-23.txt)、[变更及保护范围](docs/v2-changes.txt)。

实际工具补充：Stable2.01.2510290/base3.17.4，375×667/DPR2。清缓存后仍出现旧框架渲染错误，随后项目菜单重新打开解决，实际select/annotate Errors0。真实选择胸部→进入局部绘制→Canvas中心加1点（绿色点可见）→撤销至0→再加1点→保留返回→重入恢复1点均有本轮AX状态及实际全窗口截图（会话内显示，未导出本地文件）。这些只证明该子集；原生指定坐标点击仍报noWindowsAvailable，无法选取三处预定点，因此未伪造闭合/多片/复核截图。

[离线绘制预览](docs/validation-records/v2-offline-render-2026-10-23.png)由生产drawBody/lesion-render及真实PNG重放，显示开放草稿/单片/双片/两面复核；形状来自synthetic夹具，无患者数据。已实际看图：原模型不变，草稿开放、完成填色、不同片独立、正背分开；该图明确不是微信截图。复现脚本`preview_annotations.cjs`需环境已有sharp，可选开发工具，不是小程序依赖。

边界与限制：所有合法环在保存前进行完整边界区间检查及孔洞排除；不按入口粗区域裁切、不扩大人体、不吸附、不重排/凸包/静默修补。孔洞/多部分是人体约束结构；用户病灶首版仍为单外环，多片独立。当前人体外环来自既有源图近似，不代表医学配准。128点/20片只验证了Node行为上限，低端真机性能NOT_RUN。内存会话不保证进程结束/重启/编译后恢复；系统返回不保证全部拦截。未来V3还需正式合法图谱、审核与模板配准、后端独立输入验证及重叠去重规则，本轮没有实现。

遗留手工验收按docs/validation.md第15节：前面两片/删第二片/重入，背面独立片，切回前面完成复核再继续；三类无效输入、跨空白、debug/弹层/滑动、新尺寸及真机分别记结果。没有这些实际证据，不标整个V2 DONE。

## V2用户验收与V3范围调整（本轮用户授权，2026-10-23）

用户明确反馈V2已验收通过：V2按用户接受范围结束，保留上述118项/12项及GUI子集的原始结果，历史NOT_RUN不改写成自动实测PASSED。V1/V2代码和数据作为本轮保护基线。

当前本轮：**V3：神经分区图谱数字化、人体配准与测试预览，IN_PROGRESS**。旧V3“神经皮节空间映射”章节保留为历史计划；其中病灶交集、覆盖率、候选排序、多病灶匹配移至“后续匹配任务（TODO，未实施）”，不再属于本轮V3。调整原因为用户明确要求先完成来源可追溯图谱及配准预览，再另行授权匹配。

- [x] DONE 公开主来源与许可、实际图像及标签核验，建立覆盖清单。
- [x] DONE 由源分区矢量迁移到当前人体，记录分部位配准与未配置范围。
- [x] DONE 独立版本图谱、生成包内副本及一致性/几何校验。
- [x] DONE 开发环境受控入口、全量/单区/侧别/放大/标签测试页（逻辑与绘制测试通过，原生单区触摸另列待验）。
- [ ] IN_PROGRESS 自动化及V2隔离回归已通过、文档已更新；真实工具全量/侧别/隐藏/标签/重入已观察，原生单区/聚焦、多尺寸、发布包及真实V2触摸回归待人工验收。

开工已读取AGENTS/task、README、架构、图谱规范、验证、来源与真实运行代码；当前图谱v1仍为空，暂无V3实现。本轮基线267个非忽略文件SHA保存在/private/tmp/dermatome-v3-baseline.json。Servier页面许可已核对，但条款限制自动访问站点内容；不继续自动下载其资源，转查备用Commons原SVG。初次普通网络下载因DNS限制FAILED，使用已获本轮授权的网络下载能力重试；不绕过站点验证或访问限制。

后续匹配任务：TODO（用户另行授权后）——病灶交集/覆盖率、同视图重叠去重、候选排序、后端评估与合格医学图谱准入；本轮不实施。

### V3 本轮实现、证据与验收边界（2026-10-23）

本轮实现与自动验证完成；**V3整体保留IN_PROGRESS，等待下列真实触摸人工验收**，不将未执行项标为DONE。V2用户验收决定有效，历史实测/NOT_RUN记录不改写。未继续开发病灶匹配。

来源与许可：实际采用Goran_tek-en同套2022年Commons男性正背面SVG，具体文件CC BY-SA 4.0；原件、来源页、原始URL/访问日/SHA1、署名及改动声明已留存。派生图谱及生成副本同许可；当前CC0人体及独立软件代码许可不因该声明改变。Servier条款许可与自动访问限制均核对，未下载或宣称看过原图；Ralf Stephan备用原SVG已查看，因半面/渐变合并路径不适合而未混入边界。sourceLicenseStatus=verified，medicalReviewStatus=pending，mappingEnabled=false；没有编造医学审核人或通过记录。

图谱：`goran-2022-commons-template4-preview.1`；人体仍`commons-neutral-v1 / 4.0.0`、geometry `commons-blank-cc0-v1`、400×900、既有归一化公式/UI区域/命中原样。由同源原始SVG实际42/50条填色路径逐标签审计，解析evenodd、实际绘制顺序、多片与孔洞。使用源文件完整人体底层轮廓作体表分部对应，两面独立配准，头颈/肩胸/腋下/腰盆/裆/膝踝控制行可追溯；x=200是当前模板经工程点核对后显式登记并读取的中线，不是通用默认。没有非等比覆盖整图、平均生成T段、镜像正面作背面或凸包连片。

已配置：正面23标签/46实例/49片/11孔，C2–C6、C8/T1、T1–T12、L1–L5；背面30标签/60实例/71片/2孔，C2–C8、C6-C8、T1/T2、T1–T12、L1–L5、S2–S5。组合标签保留原来源含义，不凭编号补区。远端手掌/手指、足趾、前面会阴、三叉神经V区/头部侧插图及歧义C1/Co1不配准；S1仅足部，两面未配置，正面S3/S4会阴和C6-C8远端、背面C8/T1掌侧未配置；保留其他标签可靠近端片区。逐路径/逐标签的缺失原因见source-map、coverage、registration-report。留白不代表无神经。

技术：data/atlas/goran-2022-preview-v1为唯一制作/数据源；sync_atlas.py生成miniprogram/data/atlas.generated.ts，记录SHA256，--check拒绝旧副本。prepare_atlas.py只编译当前人体依赖图，不依赖已有图谱包副本，也不导入标注状态。重复提取后front/back/coverage/registration-report字节完全一致。配准裁切前体外面积正面58.1546、背面107.3499逻辑像素²，逐路径损失全部暴露且各低于5%；最终简化体外约0.00135/0.00056，制造微重叠约0.41134/0.43011逻辑像素²。不是医学重叠/置信度，不以运行时clip掩盖配准；孔洞与狭长片保留，采样自交直接拒绝，简化实测Hausdorff不超过0.01逻辑像素。

页面：独立atlas-debug；首页紧凑入口；全量/单区/隐藏、真实数据生成的紧凑picker、人体左右/双侧、主动聚焦/全身、标签碰撞避让开关、来源/版本/许可/覆盖说明。独立状态，不导入V2会话、不调API/结果页。Canvas沿用原坐标和PNG，默认null图谱/自定义focus参数使V1/V2原行为保留，高亮真实MultiPolygon，包围盒仅用focus。集中development配置只允许envVersion=develop；trial/release/缺失/异常关闭，入口和页面动作都检查，不接受query授权。本机工具ignoreDevUnusedFiles=true误过滤新增页面，清编译/文件列表缓存和重开未解；当前项目及被忽略的本机private同项改false后真实页面恢复。只改开发构建剔除，不松动类型、域名、上传或运行时环境保护；其他private字段保持同值。

实际检查（macOS、Python3.12.14、TypeScript5.9.3/既有官方类型）：

| 命令/范围 | 实际结果 | 证据 |
| --- | --- | --- |
| npm run typecheck --prefix miniprogram | PASSED | final-checks.txt |
| npm test --prefix miniprogram | 首轮126/127，夹具默认参数错误；修正127/127；增加真实组件和入口保护后最终129/129 PASSED | first/second-frontend-check.txt、final-checks.txt的128项、final-frontend-129.txt |
| backend/.venv/bin/python scripts/test_atlas_geometry.py | 5/5 PASSED，evenodd/nonzero孔、多片、曲线、变换、非法指令 | final-checks.txt |
| backend/.venv/bin/python scripts/check_preview_atlas.py | PASSED，106实例，闭环/孔/有效性/侧别/模板/来源索引/裁切前后/误差检查 | validation.json、final-checks.txt、rebuild-consistency.txt |
| python3 scripts/sync_atlas.py --check | PASSED，canonical校验和及生成副本一致 | final-checks.txt、rebuild-consistency.txt |
| prepare_atlas.py重建+逐文件SHA比较 | PASSED，4个派生文件字节相同 | rebuild-consistency.txt |
| check_atlas.py / check_body_regions.py / check_project.py | PASSED，V0空且禁用、V1原区域及五页配置有效 | final-checks.txt |
| check_annotation_geometry.py | 2421个独立Shapely对照用例PASSED | final-checks.txt |
| backend/.venv/bin/python -m pytest（backend目录） | 12/12 PASSED；既有Starlette/httpx弃用警告1条 | final-checks.txt |
| 已安装微信wcc/wcsc编译5页与现有组件 | exit0 PASSED；不冒充真实交互 | final-checks.txt |

前端覆盖：真实MultiPolygon/孔绘图、与包围盒职责分离、CSS细线与全身/聚焦/3种尺寸坐标往返、版本拒绝、同标签多片聚合、侧别/缺失视图/选择保持视口/重入、标签开关/碰撞、入口及页面fail-closed。V2快照夹具加读写抛错哨兵，执行全部预览动作未触发snapshot/read/open/dispatch，原对象与内容不变；原V2编辑撤销/闭合/删除/换面恢复回归继续通过。此为自动回归，不冒充真实已有会话跨编译恢复。

真实工具：Stable2.01.2510290、基础库3.17.4、iPhone6/7/8模拟器。首页进入成功；原人体上真实显示正面46、背面60实例，实际截图在本轮工具输出展示；背面单侧30、隐藏0、全部恢复、标签开关、退出/重入默认正面46且标签关闭已观察，控制台Errors0。原生picker显示真实标签及本面数量，但自动滚轮返回CUA -10005 noWindowsAvailable；不能声称已完成T5真实点选、所选左右截图、聚焦边界/复位触摸、缺失标签真实流程。其他模拟器尺寸/真机/低端性能/实际trial-release包/总开关GUI/真实V2会话触摸回归均NOT_RUN，自动替身与公式测试单独列明。没有患者数据用于截图。开发重编译会结束内存运行，这是V2既有限制，不宣称跨进程暂存或真实患者标注保全验收。

证据入口：[自动检查](docs/validation-records/v3-atlas/final-checks.txt)、[最终129项](docs/validation-records/v3-atlas/final-frontend-129.txt)、[重建一致性](docs/validation-records/v3-atlas/rebuild-consistency.txt)、[GUI真实观察及人工步骤](docs/validation-records/v3-atlas/gui-validation.txt)、[失败与修复](docs/validation-records/v3-atlas/failures-and-fixes.txt)、[保护指纹](docs/validation-records/v3-atlas/protected-files.json)、[来源标签点](docs/validation-records/v3-atlas/source-label-points.txt)。[源图/配准对照](docs/validation-records/v3-atlas/source-registration-comparison.png)与[关键部位局部对照](docs/validation-records/v3-atlas/key-sites-comparison.png)是已实际看图的离线资源证据，不是微信截图；尝试工具截图导出未得到核实的仓库图片，未拿离线图冒充。

文件：新增独立图谱版本/来源原件、制作/同步/校验/预览/标签审计脚本、atlas类型与覆盖层/工具函数、开发配置/测试页及合成非医学测试夹具；共同Canvas只扩展可选atlas/focus参数，index增加开发入口，app注册测试页，项目配置修复开发过滤，静态项目检查适配五页。README、架构、图谱规范、验证、来源及本台账更新，集中说明见[docs/v3-atlas.md](docs/v3-atlas.md)，逐项[变更清单](docs/v3-changes.txt)。基线267项中原有50项保护文件（全部人体资源/区域/坐标、V2状态与标注代码、后端既有代码/测试、V0图谱）指纹不变；16份原文件修改，其余251份基线文件不变，无删除。未更改后端业务或正式医学审核状态，无Git暂存、提交、标签或推送。

尚需人工确认：原生picker单标签及左右/聚焦/缺失视图真实流程、其他屏幕与真机、真实V2已有会话回归、专业人员对男性源图迁移到中性人体的肩腋/盆会阴/膝踝等配准复核。后续匹配仍TODO且未获本轮实施授权。本轮停在V3图谱预览，不开展病灶交集、覆盖率、候选排序或诊断。


## V3.1：面部感觉分区与可见足部图谱补全（2026-10-24）

状态：IN_PROGRESS（工程增量 DONE；模拟器部分验证 PASSED；余项触摸/真机 NOT_RUN；医学审核 pending）。本节为额度中断后继续执行的同一任务记录，不重开 V1/V2，不进入病灶匹配。

目标与实际结果：

| 计划 | 实际结果 |
| --- | --- |
| P0 溯源面部三分支并局部配准 | DONE，原正面路径13/14/16，V1/V2/V3各左右两实例，完整名称与独立类型 |
| P1 当前可见足部 | 正面 DONE，36/37/38/41的 L4/L5/S1局部配准；背面足跟 BLOCKED：源为足底/趾腹，目标为足跟/跟腱，不能当同表面 |
| 保留旧版与单一数据源 | DONE，preview.1十文件不变；新preview.2目录、配置、生成器及小程序副本一致 |
| 图谱测试页增量 | DONE，分组/三分支直选/面部与双足视口/无数据说明；保留开发环境守卫 |
| 真实交互验收 | 部分 PASSED，原生列表指定足标签及其他未完成项如实保留，见GUI记录 |
| 医学审核 | pending，没有审核人或专业审核记录；mappingEnabled=false |

任务清单：

- [x] DONE 检查原始SVG、许可、旧生成过程和前端：面部是旧source-map主动未启用；足部为源842/目标820明确截止，不是标签正则或前端隐藏。
- [x] DONE 核对Goran原标签和引线，保留CC BY-SA 4.0署名与修改声明；原SVG未改。
- [x] DONE 面部眼鼻口颌分段局部配准，排除头发、耳周、眼球开口、口缝及不可见表面；不平均切三横带，不覆盖旧C2/C3。
- [x] DONE 正面双足按实际足背/趾轮廓分别配准；L4/L5保留旧ID并集，新增S1双侧，无小面积过滤。
- [x] DONE 版本升级为goran-2022-commons-template4-preview.2；人体commons-neutral-v1/4.0.0、400×900、归一化规则与V2数据契约不变。
- [x] DONE 数据/几何/侧别/孔洞/微片/来源引线/工程参照点及父版继承检查；确定性重复生成与包内副本检查。
- [x] DONE 实际模拟器面部三分支显示/左右筛选/面部放大/背面无数据/正面54实例/左足局部显示核验。
- [ ] BLOCKED 背面足跟补全：现有源足底投影不能对应；不新增足底模板，不伪造完成。
- [ ] TODO 完成原生列表指定L4/L5/S1单选、右足放大、标签开关、专用复位按钮、背面足跟提示及退出重入逐项GUI验证；NOT_RUN/未完成核对。
- [ ] TODO 其他尺寸、真机触摸、trial/release实际环境与V2完整GUI回归；NOT_RUN。
- [ ] TODO 专业人员复核面部颞侧、眼睑/耳颌边界及足趾配准；医学审核pending。

实际修改：新增 `data/atlas/goran-2022-preview-v2/`、局部生成/预览/测试脚本、显式synthetic配准夹具、V3.1说明及证据；修改图谱类型、过滤/聚焦、开发预览页、标签显示、同步及校验脚本与前端测试。完整文件列表见[变更清单](docs/validation-records/v3.1-atlas/changes.txt)。未改backend/app，无新依赖，无Git提交/推送。

覆盖结果：正面54实例/27标签/63片/15孔，背面60实例/30标签/71片/2孔。新增6面部实例和2个S1实例；4个原L4/L5实例只追加足部。其余102个父实例几何逐项不变；4个追加实例踝线上方和原面积独立比较通过。源背面V1确实存在但目标后头皮缺可靠局部对应，仍未配置；V2/V3背面主图无对应表面。不能把“未配置”写成“无感觉神经”。

执行环境：macOS，Python3.12.14/Shapely2.2.0，现有Node/TypeScript5.9.3，微信开发者工具Stable2.01.2510290/base3.17.4。测试输入只含源图、当前人体、确定性合成几何/内存会话，不使用患者输入。

| 实际命令（项目根目录，pytest在backend） | 结果与证据 |
| --- | --- |
| `backend/.venv/bin/python scripts/prepare_atlas_extensions.py` | 初次FAILED：踝线重复舍入自交，后在最终归一化空间并集修正；最终两次输出四文件SHA256一致。失败记录保留 |
| `backend/.venv/bin/python scripts/check_preview_atlas.py` | PASSED；结构、来源、版本、侧别、继承、体外/内部重叠与新增片区报告一致 |
| `backend/.venv/bin/python scripts/test_atlas_extensions.py` | 6/6 PASSED；合成孔洞/微片/单调性、实际源引线和目标工程参照点 |
| `backend/.venv/bin/python scripts/test_atlas_geometry.py` | 5/5 PASSED |
| `npm run typecheck --prefix miniprogram` | PASSED |
| `npm test --prefix miniprogram` | 134/134 PASSED；包含V2、环境守卫、预览不读写会话哨兵及新增分组/聚焦/标签检查 |
| `backend/.venv/bin/python scripts/check_annotation_geometry.py` | 2421个确定性夹具/随机比较 PASSED，非医学准确率 |
| `backend/.venv/bin/python scripts/check_body_regions.py` | PASSED；正背面各8区、各28对无内部重叠、共边/focus/人体覆盖 |
| `backend/.venv/bin/python scripts/check_atlas.py` | PASSED；正式V0空图谱仍未验证且禁用 |
| `backend/.venv/bin/python scripts/check_project.py` | PASSED；五页结构，不冒充GUI |
| `../backend/.venv/bin/python -m pytest`（backend实际使用其绝对路径） | 12/12 PASSED；1条既有httpx/Starlette弃用警告 |
| `python3 scripts/sync_atlas.py --check` | PASSED；七输入校验及小程序生成副本一致 |
| 微信工具自带wcc/wcsc编译五页与两个组件 | PASSED，两个退出码0 |
| `backend/.venv/bin/python scripts/preview_atlas_extensions.py`及已有Sharp渲染PNG | PASSED，最终离线源图/前后对照已目视查看，不是运行截图 |

日志：[完整检查](docs/validation-records/v3.1-atlas/final-checks.txt)、[最终复现与重跑](docs/validation-records/v3.1-atlas/reproducibility.txt)、[失败与修正](docs/validation-records/v3.1-atlas/failures-and-fixes.txt)、[51个保护文件SHA256](docs/validation-records/v3.1-atlas/protection-check.json)。原始来源和对应依据：[来源核验](docs/validation-records/v3.1-atlas/source-audit.md)。

真实模拟器：[GUI记录](docs/validation-records/v3.1-atlas/gui-validation.txt)。初始页面图像与辅助树不同步，经“重新打开此项目”恢复；后实际看到V1/V2/V3、右侧在正面屏幕左侧、背面V3为0/无数据、正面全量54及左足局部。原生滚轮点击L5仅滚到条目，确认后仍选C2，不记指定足标签通过；继续操作时工具报noWindowsAvailable，余项未完成。界面Errors0/Warnings8，未逐条检查警告。运行截图仅在会话工具输出中，未伪造落盘截图；真机及余项不因自动测试而改PASSED。

前后对照：[面部](docs/validation-records/v3.1-atlas/face-before-after.png)、[单分支](docs/validation-records/v3.1-atlas/face-single-branches.png)、[足部及投影阻塞](docs/validation-records/v3.1-atlas/feet-before-after.png)、[全身](docs/validation-records/v3.1-atlas/full-model-preview.png)。这些是OFFLINE资源叠加图。完整契约及生成方法见[V3.1说明](docs/v3.1-atlas.md)。

结论：P0面部及可可靠对应的正面足部工程实现完成，真实模拟器已有部分证据；不能标记全部触摸验收或医学验收完成。背面足跟维持明确未配置。V1/V2业务代码、会话读写和坐标不变；未实现病灶匹配。下一步为用户在当前工具补验上述实际操作，并由专业人员审查局部配准；无授权不扩展为匹配阶段。


## V4 开工（2026-10-26）

状态：IN_PROGRESS。用户授权连续实施 V4.1～V4.4；V4包含匹配核心、真实接口和最小结果展示，后续版本才完善结果体验与最终交付。保留旧规划及V3/V3.1所有NOT_RUN与医学pending记录。用户认可显示效果不等于医学审核。

- [ ] IN_PROGRESS V4.1 数据身份、同源人体轮廓导出、契约及加载校验。
- [ ] TODO V4.2 纯几何逐片匹配、视图内并集、未覆盖及独立测试。
- [ ] TODO V4.3 开发环境真实API、结果页面、高亮、快照失效与请求竞争。
- [ ] TODO V4.4 联调、回归、实际GUI证据和文档。

边界：不改人体/图谱几何，不读取照片，不新增医学分区，不开启正式医疗映射。开发测试可显式启用参考几何匹配；正式服务默认关闭。基线保存于/private/tmp/dermatome-v4-baseline.json，不提交或推送Git。

## V4 实施与验证结果（2026-10-26）

状态：IN_PROGRESS（实现及自动化/真实本机HTTP完成；完整微信交互验收NOT_RUN）。本节更新上节开工计划，不覆盖历史失败和V3.1未验结论。此前页首遗留“不开发病灶匹配”与V4授权矛盾，已更正为允许开发测试参考几何匹配；不是改变正式医学准入。

| 阶段计划 | 实际结果 |
| --- | --- |
| V4.1 数据对接与契约 | DONE：固定模板/图谱/归一化身份，导出同源V2人体，Pydantic/TS/API文档一致 |
| V4.2 匹配引擎 | DONE：独立真实交集、组内并集、同面多片并集、未覆盖、非法输入与CLI |
| V4.3 API与结果页 | DONE：真实POST、首次自动请求、真实实例高亮、返回编辑、失效与迟到响应防护、独立环境门禁 |
| V4.4 完整联调回归 | IN_PROGRESS：自动化和本机HTTP PASSED；真实微信画点闭环、多屏/真机NOT_RUN |

- [x] DONE V4.1～V4.3工程实现，前端与后端独立限制develop/development/test。
- [x] DONE 47项后端、143项前端、真实HTTP页面流程、原V1/V2/V3及图谱/人体同源回归。
- [x] DONE 12个人工查看真实资源预选参考位置及114实例算法内部点冒烟；非临床准确率。
- [x] DONE 61个保护文件SHA前后相同，未改人体/粗分区/图谱/V2核心/原Canvas或坐标公式；无新依赖，无Git提交/推送。
- [x] DONE 文档、真实日志、离线对照图与失败修正记录。
- [ ] BLOCKED 微信自动操作可靠性：能加载V4首页，但AX点击未导航、画面与树不一致及noWindowsAvailable，未取得真实结果界面闭环证据。
- [ ] TODO 按GUI清单人工补验实际画点、候选高亮、修改后失效、重算、背面、无覆盖、断网重试及多屏/真机；NOT_RUN。
- [ ] TODO 专业医学审核；pending，mappingEnabled=false和V0空图谱保持不变。

身份：人体commons-neutral-v1/4.0.0，400×900，geometry commons-blank-cc0-v1，UI修订commons-blank-cc0-v1-ui-regions-2；图谱goran-2022-commons-template4-preview.2。图谱SHA256 `8689fca1aa50cff0b1b7d7cd1adcd80cf244cd1a93ed580e91406d0cc2fb2056`；同源人体导出SHA256 `59979433be334f53a705f90a484aadc312a426387f4c1a3b59a718393fbf426a`。

公式：单片/同面病灶并集L为分母，候选R按(type,label,解剖侧别,view)组内并集，比例area(L∩R)/area(L)；全部图谱并集A给总覆盖area(L∩A)/area(L)与未覆盖area(L−A)/area(L)。候选可重叠，不能直接累加；组合标签不拆解；正背不混算；边界零面积无候选，微小交集只按明确浮点阈值处理，保留原数值，不转临床置信度。

接口与安全：POST /api/v1/evaluate取已完成片区不可变快照，请求关联ID/几何revision/模板+图谱身份；拒绝草稿/错版/自交/体外/超限，不自动修复。每面20片、每片128有效点、正文512KiB。后端默认403，development/test且显式开关才计算；前端develop独立保护。production不接受debug绕过。result复用原body-canvas，保留人工轮廓并叠加选中的完整参考区域，不重新计算百分比。快照key与递增序号确保修改失效及晚A不覆盖新B，展示切面/缩放不变结果。网络错误保留标注、可重试。只发送坐标/版本至配置后端，无照片、身份、第三方AI或持久化。

实际执行环境：macOS，Python3.12.14/Shapely2.2.0及已安装FastAPI/Pydantic，Node21.7.3/TypeScript5.9.3。微信Stable2.01.2510290、base3.17.4只完成项目重开与V4首页加载。测试输入为合成范围及既有规范图谱。

| 命令（项目根） | 实际结果/证据 |
| --- | --- |
| `backend/.venv/bin/python -m pytest backend/tests -q` | 47 PASSED；backend-final.txt；1条既有httpx弃用警告 |
| `npm test --prefix miniprogram` | 143 PASSED；frontend-final.txt |
| `npm run typecheck --prefix miniprogram` | PASSED；final-typecheck.txt |
| `node scripts/test_matching_http.cjs`（README命令启动本机后端后） | PASSED；http-page-integration.txt：V2画片→真实API→选候选→返回新增→stale→重算→背面→无覆盖；网络失败用平台适配器模拟，其余结果真实计算。不是微信触摸 |
| `backend/.venv/bin/python scripts/smoke_backend.py` | PASSED；http-production-gate.txt，实际HTTP 200/501/403，临时服务关闭 |
| `backend/.venv/bin/python scripts/sync_matching_body.py --check` / `scripts/sync_atlas.py --check` | PASSED；body-sync.txt、atlas-sync.txt |
| `backend/.venv/bin/python scripts/check_annotation_geometry.py` | 2421确定性比较PASSED；annotation-regression.txt |
| `backend/.venv/bin/python scripts/test_atlas_extensions.py` / `scripts/test_atlas_geometry.py` | 6/6及5/5 PASSED；atlas-extensions.txt、atlas-geometry.txt |
| `backend/.venv/bin/python scripts/check_preview_atlas.py` / `scripts/check_body_regions.py` / `scripts/check_atlas.py` / `scripts/check_project.py` | PASSED；对应日志；project首轮旧导航规则失败后适配真实受控返回 |
| 微信自带wcc/wcsc编译五页两个组件 | exit0；native-compile.txt；不代表GUI验收 |
| `backend/.venv/bin/python scripts/preview_matching.py` + 已安装Sharp渲染PNG | PASSED，已目视查看离线资源/真实计算叠加；不是模拟器截图 |
| `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 backend/.venv/bin/python scripts/evaluate_annotations.py < docs/validation-records/v4/synthetic-request.json` | PASSED，CLI响应与直接核心响应逐字段相同；cli-response.json |

全部证据在[本轮目录](docs/validation-records/v4/)，[检查汇总](docs/validation-records/v4/checks.json)、[失败与修正](docs/validation-records/v4/failures-and-fixes.md)、[GUI实际记录](docs/validation-records/v4/gui-validation.md)、[保护文件](docs/validation-records/v4/protection-check.json)、[变更清单](docs/validation-records/v4/changes.txt)。失败包括初次TS类型、沙箱端口/网络、草稿闭合丢失stale提醒（已修复并回归）、联调夹具没切V2视图（测试更正）、旧navigator静态规则。没有删除失败日志。

主要修改：后端schema/route/loader/matcher/校验/环境门禁；前端API/config/types/matching-session/result、annotate入口、首页隐私文案；新增共享人体导出和脚本/测试。原图谱/身体资源/粗区/V2核心不改。完整原理、操作入口、API、限制及11项报告见[V4开发报告](docs/v4-matching.md)。

验收结论：工程实现与自动化可交付试用，V4完整实际界面验收尚未完成；不能称全部PASSED。背面足跟、手指等未配置及医学pending保留。下一步仅补验V4清单；停止本轮，不开发导出、病例管理或诊断。

## V4 本地请求失败修正（2026-10-26）

- [x] DONE 定位用户实际错误：微信Console明确指出127.0.0.1:8000不在request合法域名列表，前端统一fail文案掩盖了真实原因。
- [x] DONE 验证现存后端仍在监听，health和项目TEST合成请求均HTTP200；不是后端已停止的结论。
- [x] DONE services/api.ts区分合法域名拦截、超时与连接失败；不回显原始载荷，保留标注；补充本地网络设置说明。
- [x] DONE 前端144/144、类型检查PASSED；新增错误分类及API封装回归。
- [ ] TODO 用户选择临时本地调试网络选项或配置合法HTTPS域名后，在实际模拟器重试；未自动更改网络安全设置，不预记请求成功。

此次实际改动：miniprogram/services/api.ts、tests/miniprogram/matching-session.test.cjs、README.md、本台账及docs/validation-records/v4-network。此前“本机HTTP联调通过”仅证明平台适配流程，不能证明微信域名门禁已满足；README原本缺少回环HTTP与域名检查的冲突说明，已追加更正。证据与已知范围见[排查记录](docs/validation-records/v4-network/diagnosis.md)。医学pending及V4真实GUI未验项仍保留。

## V4 彩色填充专项核查（2026-10-26）

- [x] DONE 查明用户截图原因：结果已返回，但selected为空，传入Canvas的参考区域集合为空。统计范围按钮与参考候选按钮职责不同，默认计算成功不自动选择候选。
- [x] DONE 实际微信模拟器点选正面L2后，看到人体自身左侧大腿浅蓝填充，原棕色人工轮廓保留；放大按钮由disabled变为enabled。
- [x] DONE 实际点击“放大参考区域”，截图确认局部放大后的参考填充与棕色轮廓同时存在。
- [x] DONE 重跑真实本机HTTP页面联调脚本PASSED，只发送自带合成标注，不重新提交用户现存标注。
- [ ] TODO 默认没有选中候选的提示、列表与画布距离及选中后的展示引导有待后续改善；本轮用户仅要求检查汇报，未修改业务或默认行为。
- [ ] NOT_RUN 本轮L5切换/复位视觉核对：继续操作遇noWindowsAvailable，未扩大实测结论；其他屏幕与真机仍待验。

本次更新只含本台账和docs/validation-records/v4-highlight下的专项记录/真实HTTP日志；没有改模型、图谱或业务代码。实际GUI证据仅在会话工具截图输出，未复制用户图片/标注进代码库。详细[专项报告](docs/validation-records/v4-highlight/report.md)。本节将“正面候选高亮、原轮廓保留与局部放大”从历史未验项补为本轮实际PASSED；不覆盖V4其余NOT_RUN、失败历史或医学pending。
## V4 交互精简与人体结果联动（2026-10-26，追加记录）

本节为用户最新授权的增量实现，补充此前“彩色填充专项核查只检查、不修改”的历史状态。工程实现DONE；完整多屏/真机验收IN_PROGRESS，不能称全部验收通过。

| 本轮计划 | 实际结果 |
| --- | --- |
| 检查确认→请求→结果→候选→高亮链路 | DONE：确认后原本有两层叠加填充；selected为空导致参考region集合为空；stale新导航缺少自动请求 |
| 确认病灶立即填充 | DONE：每片单次半透明填充，普通0.26/选中0.32，保持原闭合轮廓 |
| 一次计算直接显示全部参考区域 | DONE：新页面首个onShow处理非ready/nonloading状态，ready复用；精确region_ids映射、实例去重、缺片失败关闭 |
| 人体两侧标签与单区/全部联动 | DONE：解剖侧别、实际高度排序、44px标签与独立滚动，不删除低覆盖候选；单区保留全部片区与孔洞 |
| 保留视图/逐片汇总/编辑失效/异步保护 | DONE：展示操作不请求；修改后旧结果失效；V2几何key与请求序号保持；同标签和显示全部共用复位 |
| 自动化与真实HTTP回归 | DONE：149前端、47后端、类型、原生编译、数据同步/结构检查及真实本机HTTP通过 |
| 真实GUI与多屏 | IN_PROGRESS：390主流程通过，320侧栏及末尾候选等通过；原生Canvas偏移/缓存导航异常待复测，375/430结果页和真机NOT_RUN |

- [x] DONE 确认就见病灶色块、一次计算默认全部参考上色；计算后人工标注改为轮廓，区别两种范围。
- [x] DONE 左右同名候选不合并，完整组合标签/全名/比例保留；不改变后端原排序，仅布局副本按解剖高度排列。
- [x] DONE 标签点击保持视野，显式放大；全部/全身/修改四个紧凑动作；横向逐片/汇总；来源与医疗限制可展开。
- [x] DONE 93个保护文件SHA与开工基线相同：后端、人体/图谱/配置、归一化公式、V2核心、API契约/封装、依赖等保持不变。无新框架或依赖，无提交/推送。
- [x] DONE 实际390×844：两片填充→一次计算6候选自动上色→标签单区→放大/显示全部→逐片/汇总→返回新增背面→一次计算26候选，独立滚动与正确侧别。
- [x] DONE 实际320×568：一次计算14候选，独立滚动触达末尾人体左C5 0.11%，点击单区及底部操作可达；仅计正常刷新后的可见证据。
- [ ] FAILED 320原生Canvas初次/恢复时曾上移遮挡上方控件，滚动后正常；增加容器定位/溢出约束不足以证明根治。须干净启动复测。
- [ ] FAILED 320有效缓存“查看结果”重入曾导航失败并残留旧画布，标注保留；单元/HTTP缓存通过不代替此真实失败。
- [ ] BLOCKED 自动工具反复noWindowsAvailable/状态不同步；用户恢复前台后继续验证至375×667标注页，但截图仍返回小尺寸倾斜窗口，无法可靠画点。375/430结果页实际触摸NOT_RUN。
- [ ] TODO 480短屏、手机真机、GUI断网/无覆盖/迟到响应/删除重算及最终同标签切回完整复测；自动化已有覆盖，真实触摸仍NOT_RUN。
- [ ] TODO 专业医学审核，pending/mappingEnabled=false不变；不将几何比例解释为诊断置信度。

新增工程文件：`miniprogram/utils/matching-presentation.ts`、`tests/miniprogram/matching-presentation.test.cjs`。修改：result和annotate各3个页面文件、annotation展示类型、lesion-render、matching-session操作文案、canvas测试、HTTP联调脚本。新增/更新说明：README、架构、V4历史说明的增量链接、`docs/v4-interaction.md`、本节及`docs/validation-records/v4-interaction/`。完整[变更清单](docs/validation-records/v4-interaction/changes.txt)。没有换模板；人体仍commons-neutral-v1/4.0.0，图谱仍goran-2022-commons-template4-preview.2，原粗区修订不变。

| 实际命令 | 结果与证据（v4-interaction目录） |
| --- | --- |
| `npm test --prefix miniprogram` | 149/149 PASSED，frontend-completion.txt |
| `npm run typecheck --prefix miniprogram` | PASSED，typecheck-completion.txt |
| `backend/.venv/bin/python -m pytest backend/tests -q` | 47 PASSED、1条既有弃用警告，backend.txt |
| `node scripts/test_matching_http.cjs`（既有本机开发后端） | PASSED，http-check.txt；成功响应真实HTTP，失败由wx适配器注入，不冒充GUI网络故障 |
| `backend/.venv/bin/python scripts/sync_atlas.py --check`、`scripts/sync_matching_body.py --check`、`scripts/check_project.py`（同解释器） | PASSED，atlas-sync.txt、body-sync.txt、project.txt |
| 微信自带wcc/wcsc编译七个WXML/WXSS（完整参数见日志） | exit0，native-compile-final.txt；原生编译不是触摸验证 |

环境：macOS、Node21.7.3/TS5.9.3、Python3.12.14/Shapely2.2.0、微信Stable2.01.2510290/base3.17.4。输入均合成标注和已有规范图谱，不使用患者数据。首轮旧fill断言失败、WXML实体编译失败、本机连接沙箱失败保留原日志并记录修正；GUI异常同样保留。实际截图显示于本对话CUA输出，未声称已保存本地PNG。

[实现报告](docs/v4-interaction.md) · [命令与失败记录](docs/validation-records/v4-interaction/report.md) · [真实GUI证据与未验项](docs/validation-records/v4-interaction/gui-validation.md) · [保护文件](docs/validation-records/v4-interaction/protection-check.json)。下一步只补本轮未验项及定位可复现的画布/导航异常，不扩展后续版本。
## V4 后端再次断连恢复（2026-10-26，追加记录）

- [x] DONE 本次真实原因：8000端口没有监听，健康请求退出7；后端进程已停止，具体退出原因未查明。与此前合法域名拦截分别记录。
- [x] DONE 重新启动既有本机开发后端，PID52080监听127.0.0.1:8000；不改变端口、网络安全设置或业务代码。
- [x] DONE 健康接口HTTP200；`node scripts/test_matching_http.cjs`真实HTTP合成流程PASSED，覆盖一次计算/全部显示、编辑失效、多片/背面、失败恢复及缓存。
- [x] DONE 增加可执行`启动后端.command`及README用法，便于macOS双击恢复本机服务。`zsh -n 启动后端.command`PASSED；不安装开机常驻服务。
- [ ] NOT_RUN Finder实际双击启动及微信用户现存标注重试；未停止现已恢复的服务或重新发送用户标注。

首次受限启动绑定端口报operation not permitted并退出3；经工具批准同命令启动成功，失败记录保留。环境macOS/项目Python虚拟环境/Node，输入只用自带合成标注。修改文件仅README、本台账；新增启动入口及[恢复记录/原始输出](docs/validation-records/v4-network-recovery-2026-10-26/report.md)。当前服务可用不代表重启后自动运行，须保留开发服务或重新启动。此前GUI未验项和医学pending保持；无Git提交/推送。

## V4 体验精修：连续计算、过渡与说明收纳（2026-10-26～27，追加）

状态：IN_PROGRESS（工程实现DONE，自动化及375主要功能通过，完整动态视觉/多屏/真机验收未完成）。用户授权本轮体验改造并协助前台恢复和手工闭合测试三角形。本节更新上轮独立结果路由与自动复位的当前行为，不覆盖既有失败、NOT_RUN或医学pending。

| 本轮计划 | 实际结果 |
| --- | --- |
| 先排查跳动/闪白来源 | DONE：独立result创建组件、review清focus、属性变更重复测量/getContext、资源等待分支clearRect；旧版图片已有缓存且宽高已有相等保护，不虚构重复解码 |
| 同页确认/计算/结果/修改 | DONE：复用annotate一个Canvas，result保留兼容redirect；预留侧栏、固定操作区；全部/逐片/修改保持视口 |
| Canvas过渡与竞争保护 | DONE：200ms透明度帧调度、最新选择替代旧帧、结束停绘、无能力降级；本地正背预载后整套切换，无几何变形 |
| 精简UI与说明入口 | DONE：当前操作与必要错误留主界面，署名/许可/审核/公式/版本在所有环境可访问的说明；开发调试收纳；真实原生画布遮挡修复 |
| 自动化与真实本机HTTP | DONE：154前端、47后端、类型、项目/数据同步、原生编译、真实本机HTTP、保护hash |
| 真正模拟器功能与动态验收 | IN_PROGRESS：375两片→一次计算全部六候选→连续单选/全部→逐片/汇总→正背隔离→说明复制已验；录屏、多屏与真机仍NOT_RUN |

- [x] DONE 闭合立即填充；点击一次计算显示所有真实候选，棕色人工轮廓保留；没有额外结果路由或第二次计算入口。
- [x] DONE 缓存本地资源/测量/上下文/投影；清屏与完整绘制之间不再异步等待；每帧不setData、不重复测量标签。
- [x] DONE 复核不清聚焦，显示全部/逐片/返回修改不自动复位。保留旧结果失效、请求与动画竞争、开发门禁、真实无覆盖/错误和微小比例提示。
- [x] DONE 实际375×667主要GUI功能PASSED；用户协助的测试范围仅发本机既有开发后端。说明打开发现Canvas遮挡，修复后面板可读，许可复制回执已见，关闭恢复原视野。
- [x] DONE 154/154前端、47/47后端、类型检查、真实HTTP、wcc/wcsc、项目/图谱/人体同步；93保护文件hash一致。无新依赖、无Git提交/推送。
- [ ] BLOCKED 多屏自动操作：320切换后AX与截图不同步，完整编译/重连仍不能可靠验证；不能拿旧结果截图作为320验收。
- [ ] TODO 320/430/矮屏完整GUI、真机、实际连续录屏、动画流畅/零闪白、无动画开关触摸闭环；NOT_RUN。另需GUI新增后stale/重算、断网恢复、多标签末尾等专项，已有自动化不代替真实操作。
- [ ] TODO 专业医学审核保持pending；正式映射未启用，未新增边界/匹配功能。

身份未变：commons-neutral-v1/4.0.0、goran-2022-commons-template4-preview.2及粗区原修订。归一化/人体/图谱几何、匹配公式/阈值/API字段/后端/依赖/环境配置不改。annotation-session只改复核和展示聚焦策略；services/api只加计时。主改annotate四文件、body-canvas/render/atlas-render、matching-presentation、result兼容入口及相应测试；新增experience配置、overlay-transition及其测试、profile_canvas_workflow脚本。详细[变更清单](docs/validation-records/v4-experience/changes.txt)。

实际命令：`npm test --prefix miniprogram`154 PASSED（frontend-completion.txt）；`npm run typecheck --prefix miniprogram`PASSED（typecheck-completion.txt）；`backend/.venv/bin/python -m pytest backend/tests -q`47 PASSED/1既有httpx弃用警告（backend.txt）；`node scripts/test_matching_http.cjs`PASSED（http-final.txt，真实成功HTTP/注入网络失败）；同解释器执行`check_project.py`、`sync_atlas.py --check`、`sync_matching_body.py --check`均PASSED；微信wcc/wcsc参数与exit0见native-*-completion.txt。

性能证据：确定性适配器207×363/DPR2、初始化后20次切选（无动画），尺寸查询22→1、getContext调用22→1、组件setData22→2、图片未就绪清屏1→0；图片加载1→2为正背预载，宽/高写入原本各1而非反复重置。不是FPS或原生性能结论。实际模拟器首次网络161ms/请求及校验173ms；另一次缓存显示准备5ms/首帧3ms/最终帧绘制1ms/过渡211ms，不能拼接成同一次请求耗时。新增首个非零覆盖帧与完成帧指标尚未取得原生样本。

本轮环境Node24.11.1/TS5.9.3、Python3.12.14、macOS、微信Stable2.01.2510290/base3.17.4。保留首轮失败、缓存测试失败、受限网络失败、原生热更新模块/样式警告与GUI问题。代码及命令通过不等于全项体验验收。[实现与来源入口](docs/v4-experience.md) · [测试/计数及失败修正](docs/validation-records/v4-experience/report.md) · [真实GUI与人工清单](docs/validation-records/v4-experience/gui-validation.md) · [保护校验](docs/validation-records/v4-experience/protection-check.json)。

V4体验精修补记：最终增加页面hide/show直接恢复终态、取消旧帧且不重载图片/上下文的检查，`npm test --prefix miniprogram`仍154/154 PASSED（frontend-resume-final.txt，编译当前TS后运行）。末次微信完整编译AX显示375原设备/项目首页/Errors:0；由于像素状态仍不可靠，不追加多屏或动画通过结论。本机开发后端PID52080仍监听127.0.0.1:8000。


## V5 AI 辅助流程开工（2026-10-27，当前授权）

用户明确将 AI 从历史 V7 规划提前到 V5。本轮只授权 V5.1；AGENTS 的历史 V4 范围与旧路线以本次指令为准。已有 V1～V4、医学图谱及其审核状态不改。

- [ ] IN_PROGRESS V5.1：独立提示分割、真实本地模型、照片坐标 Mask/多边形、实验与错误验证。
- [ ] TODO V5.2：照片上传、分割接口与人工确认交互（本轮不实现）。
- [ ] TODO V5.3：人工移动/等比缩放/旋转，将已确认照片形状放置到具体人体模板。
- [ ] TODO V5.4：人工定位确认后复用既有几何匹配和结果联动。
- [ ] TODO V5.5：完整流程、隐私、性能及多设备验收。

开工检查：读取 AGENTS、台账、README、架构/API/图谱/验证/隐私文档及 V2 标注类型；AI 目录仅占位。M4/16GB，磁盘余量约17GiB，后端Python3.12.14尚无PyTorch。采用独立AI虚拟环境，核心后端不导入AI。V2目前仅闭合单外环、多片独立，尚不能无损承接孔洞；V5.1保留孔洞，后续禁止静默压平。保护基线保存在/private/tmp/dermatome-v51-baseline.json。

### V5.1 实施与真实验证收尾（2026-10-27）

- [x] DONE V5.1工程实现与独立可行性验证：官方MobileSAM预训练模型真实加载/CPU与MPS推理；照片坐标Mask、透明层、含孔多片轮廓、CLI、明确失败状态、实验与保护回归。**医学分割质量仍有限，候选待用户审查；不代表临床验收。**
- [ ] TODO V5.2：照片上传/提示接口与人工确认；本轮未实现。
- [ ] TODO V5.3：人工变换与人体模板绑定；本轮未实现。
- [ ] TODO V5.4：定位确认后复用空间匹配；本轮未实现。
- [ ] TODO V5.5：完整体验/隐私/性能/设备验收；本轮未实现。

最终模型MobileSAM vit_t，包1.0，固定官方commit f706ad9c4eb7f219c00d9050e46328518ffb65d2，Apache-2.0，40,728,226字节；权重Git/SHA256核验与安全加载。SAM2.1 tiny完成官方代码/许可/环境/156,008,466字节权重调查，实际推理NOT_RUN，没有按名称断言效果高低。独立ai/.venv，Python3.12.14/PyTorch2.5.1；M4/16GB，CPU4线程实测；MPS正常权限可用，受限探测false如实保留。

真实输入3张CDC公开教学源照片（21505/21506同病例，18254只用去面部颈部裁片），另2张synthetic几何图，不充作15～30医学样本。CPU9组A～I（包含要求A～F）真实推理；另MPS/CLI各1次完整导出，共33候选，另CPU/MPS各4次性能重复不增加样本数。CPU主实验推理0.432～0.681s，中位0.441s；加载1.556s；MPS首次5.915s，预热0.118～0.126s。模型最高分不是诊断置信度，甚至输出>1；不自动选择、截断或假成功。

实际看图：B框选清晰簇可得到部分有用轮廓；A单点漏掉大簇；C/E高分整图误选；D有大量网格碎片；F低对比受框影响且混入正常样皮肤。保留全部候选和失败预览。没有专家参考Mask，不计算医学准确率；人工修正轮数/时长和正常皮肤对照NOT_RUN。几何与质量分开：33实际Mask转多边形逐像素保真0差异、alpha对齐，**只是导出保真**。

独立测试最终55项PASSED（首轮52项也保留）；既有后端47项、小程序154项、TS、项目/空图谱/预览图谱检查全部PASSED。180项backend/miniprogram/data/scripts/tests原文件指纹未变；现有人体、图谱/审核、坐标、API和前端均未改。微信GUI/真机/后续上传/人工配准/专家临床验证NOT_RUN。无提交、推送。

文件：新增ai/inference/mobile_sam.py、preprocessing/image.py、postprocessing/polygons.py、segmentation.py、export.py、cli.py、errors.py、requirements、tests、experiments脚本/配置/来源、许可证及报告。修改README/ai README/AGENTS当前授权说明、.gitignore、architecture/api/validation与本台账；旧AI占位README原文留存README-v0.md，不覆盖旧实验。错误下载、环境限制及上游warning如实记录。

照片坐标basis为photo_oriented_normalized_v1，保留EXIF方向/尺寸/源RGB指纹/提示/候选Mask引用/闭合MultiPolygon/孔/模型/耗时/status/error；不含人体模板/神经标签。默认无损像素格几何，V2现有单外环和128点约束尚不能直接接收复杂结果；后续需明确契约、确认和配准，禁止静默删洞或当成人体坐标。

资料：[V5.1报告](docs/v5-ai-segmentation.md) · [运行入口](ai/README.md) · [命令与55/47/154测试证据](docs/validation-records/v5.1/report.md) · [全部真实候选预览（本地忽略目录）](ai/experiments/outputs/v51-cpu-20261027/all-candidates.jpg) · [保护检查](docs/validation-records/v5.1/protection-check.json)。

本轮停止在V5.1，等待用户审查候选分割效果；未进入V5.2。


## V5.2 开工（2026-10-27）

- [ ] IN_PROGRESS V5.2：照片上传、交互提示、真实候选、人工确认与临时清理。
- [ ] TODO V5.3 人体放置；本轮不实现。
- [ ] TODO V5.4 匹配整合；本轮不实现。
- [ ] TODO V5.5 完整验收；本轮不实现。

已检查根AGENTS（无局部约束）、V5.1与实验、README、FastAPI/路由/配置、V2标注及V4版本保护。沿用MobileSAM固定权重与V5.1像素几何，无训练/下载。V5.1无HTTP服务、模型实例顺序调用可复用但不能并发共享。采用可关闭的AI服务适配，独立AI环境运行；默认生产禁用，仅开发工具本机测试，暂不接收真实患者照片。照片/Mask保留照片坐标；选择部位只作未来放置上下文。开工指纹/private/tmp/dermatome-v52-baseline.json。

### V5.2 实施与开发环境验收收尾（2026-10-27，覆盖上节开工状态）

- [x] DONE V5.2：工程实现、真实模型HTTP和微信开发工具人工协作主流程完成。仅开发测试范围，等待用户审查分割效果；不表示真机/生产/临床验收完成。
- [x] DONE 独立AI入口/上传用途说明、默认框、前景/背景点、撤销/重置、真实多候选切换、异常提示、显式确认、取消/换图/返回原手动。确认停在照片范围页。
- [x] DONE 可选FastAPI会话/上传/分割/认证素材/确认/删除接口；复用MobileSAM固定模型与权重，进程缓存串行推理；不重下载、不训练、无外部AI请求。
- [x] DONE EXIF统一照片与Mask原尺寸同源；照片归一化MultiPolygon保留离散片及孔洞；不进入V2人体数据或V4匹配。确认结构明确为confirmed-photo-segmentation-v1。
- [x] DONE 随机会话/能力令牌、实际文件/像素/请求大小限制、有限并发、固定30分钟失效、取消/退出/到期清理、迟到请求隔离。服务停机残留下次启动清理，不宣称介质擦除或生产权限体系。
- [x] DONE AI78、前端184、后端47、TypeScript、项目结构通过；AI环境同47项也通过。真实HTTP V4合成流程在当前AI启用服务上通过，原匹配算法/人体/图谱不变。
- [x] DONE 微信9项主流程人工协作验证：用户手动框/两类点，其余上传、候选切换、确认、返回手动、取消再上传均实际执行。确认只选局部小范围，不代表完整医学分割。最后修复父子重复更新警告并重编译验证上传/模式/清理。
- [ ] NOT_RUN 真机、相机拍摄、原生多屏、大尺寸手机照、GUI断网/迟到压力、服务MPS、生产HTTPS/身份授权/安全审计及临床效果。超时/A→B/EXIF/清理等自动化覆盖不冒充实际设备测试。
- [ ] TODO V5.3：人工平移/等比缩放/旋转、人体模板绑定及含孔几何交接。本轮没有实现。
- [ ] TODO V5.4：人工定位后接原神经图谱匹配。本轮没有实现。
- [ ] TODO V5.5：完整流程/隐私/性能/设备验收。本轮没有实现。

真实HTTP输入只有既有公开CDC21505一张700×460，两轮框及框+前背景点，各3候选；首请求2.189s含加载0.934s，第二0.569s，CPU4线程。第二轮显式选candidate-1保留5片4孔，Mask SHA验证、删除204/再次读取410通过；不是模型高分自动确认，也没有医学准确率。微信另外上传合成离散图验证取消后重建，不能算新增医学样本。

当前AI环境Python3.12.14/Torch2.5.1/MobileSAM1.0；新增可选multipart0.0.32（PyPI），FastAPI0.162.0等实际版本保存在ai-environment.txt，pip check通过；backend/.venv不变。新启动AI后端.command在原8000端口同时提供AI与V4；旧启动后端.command保留，二者不要同时启动。当前真实服务已开启，退出/重启电脑需重新启动，不是常驻部署。

实际命令与日志：[验证报告](docs/validation-records/v5.2/report.md)。其中ai pytest78（ai-tests-second.txt）、npm test184（frontend-final.txt）、typecheck、原backend pytest47（backend-core.txt）、AI环境backend pytest同47（backend-ai-env.txt）、check_project六页、pip check、真实AI HTTP（real-http.json）、V4真实HTTP（v4-http-regression.txt）均PASSED。首次类型错误、工具touchcancel/坐标偏移、父子递归warning均记录在fixes.md；保留修复前确认截图，修复后重编译Errors0，仍有平台弃用提示。

改动：新backend schemas/ai、routes/ai、services/ai_sessions/ai_boundary；前端types/config/services/state的AI模块、photo-coordinate、photo-canvas、ai-annotate；服务/前端测试、HTTP验证脚本与AI启动器。修改main可选接入、pyproject可选依赖、ai/segmentation已验证图像输入、路由/选择入口/首页隐私文案/结构检查，以及README、AI文档、API、架构、隐私、授权增量与本台账。[完整清单与保护记录](docs/validation-records/v5.2/protection-check.json)；历史实验不覆盖，无Git提交或推送。

[实现及V5.3契约](docs/v5-ai-segmentation.md#9-v52-小程序与本地服务2026-10-27) · [微信确认截图](docs/validation-records/v5.2/wechat-confirmed.png) · [修复后再次上传](docs/validation-records/v5.2/wechat-reupload-synthetic.png)。本轮止于V5.2，等待用户审查。

## V5.2 极简交互改造（2026-10-28）

- [ ] IN_PROGRESS 上传→有效框选松手自动识别→人工确认；精细调整默认折叠，候选改为“换个结果”。
- [ ] TODO 自动请求去重/最新框排队、原照片保留、异常和回退、前端回归与实际小程序验证。
- [ ] TODO V5.3～V5.5，仍未授权实施。

已阅读AGENTS、台账、AI页面/画布/坐标/状态/传输和现有测试。仅改V5.2前端；保留MobileSAM/FastAPI/数据契约/安全与清理机制。开工指纹保存在/private/tmp/dermatome-v52-simple-baseline.json。历史结果和未验项保留。

### 实施与验证结果（2026-10-28）

以上为开工计划，以下记录本轮实际结果：

- [x] DONE 极简前端实现：上传后默认圈选，松手自动识别；“换个结果”循环真实候选，“确认识别范围”仍需人工操作。前景/排除点、撤销和重新识别收于“精细调整”，原能力保留。
- [x] DONE 请求与显示保护：小框拒绝、同框去重、在途只排队最新有效框、换图/取消/重新圈选失效旧结果；分析期间保留照片，候选切换载入完整帧后再显示并允许确认。
- [x] DONE 自动化与真实模型HTTP联调，结果如下；MobileSAM、FastAPI、上传隐私/清理、照片坐标契约和V1～V4核心能力保持原实现。
- [ ] IN_PROGRESS 本轮原生微信完整圈选→自动识别→候选切换→精调→确认验收。编译与上传已实际通过，自动拖动未形成有效框，已请求用户手动圈选协助；完整链路当前NOT_RUN，不能用适配器联调或旧界面截图替代。
- [ ] TODO V5.3～V5.5，未实施；不进入人体放置或神经匹配。

实际命令：`npm test --prefix miniprogram` **198 PASSED**（原184+新增14），`npm run typecheck --prefix miniprogram` PASSED；`backend/.venv/bin/python -m pytest backend/tests -q` **47 PASSED**（既有1条warning）；`backend/.venv/bin/python scripts/check_project.py` PASSED；微信自带wcc/wcsc两项exit0，完整工具编译Errors0。新增测试初次2项测试记录器断言失败、首轮WXML实体编译失败及修复均保留日志；独立AI78本轮未重跑。

`node scripts/test_ai_simple_http.cjs` PASSED：生产页面、组件事件、状态及传输经wx平台适配器调用本机真实MobileSAM；1张已有公开CDC21505，1px无效框0请求，有效框松手仅1次推理0.935695s/3候选；换候选0额外推理；补充两类提示后重新识别1次0.800174s/3候选；最后1次人工确认指令返回照片归一化坐标、多片含孔结构（5片4孔），删除后读取410。以上是工程联调，不是原生触摸验证或医学分割准确率。

修改文件：AI页面TS/WXML/WXSS、photo-canvas.ts、ai-session.ts、photo-coordinate.ts；新增ai-simple.test.cjs，扩展photo-canvas.test.cjs，新增真实HTTP脚本；更新README、架构、AI说明、本台账及验证记录。开工614文件指纹比较：11个既有文件变更，225个受保护源代码/资源/测试文件不变，无意外改动、无缺失。无Git提交或推送。

限制：原生完整主流程、真机/相机、多屏、连续录屏的零闪白、GUI断网/超时与竞态仍未验证。自动化已覆盖对应状态和坐标行为，但不宣称设备验收完成。工程实现已完成；本轮整体验收保持IN_PROGRESS，等待圈选反馈后补记。当前仅开发测试，不上传真实患者照片。

证据：[详细报告](docs/validation-records/v5.2-simple/report.md) · [真实HTTP结果](docs/validation-records/v5.2-simple/real-page-http.json) · [本轮微信上传截图](docs/validation-records/v5.2-simple/wechat-upload.png) · [文件保护](docs/validation-records/v5.2-simple/protection-check.json)。

### 松手无变化反馈与修复（2026-10-28，追加）

用户实际回复“松手后没有变化”，原生主流程本次反馈为FAILED。不能继续只归因于自动工具输入限制。检查并用测试复现两个前端缺陷：异步client位置查询错误依赖重绘序号，move重绘使end查询失效；重复同值mode/disabled通知清空手势起点。

- [x] DONE 照片画布修复：输入有效期独立于绘制，按事件派发顺序提交异步查询；同值通知保留手势，实际换图/布局/模式/禁用/取消才失效。保持原照片坐标公式和自动推理契约。
- [x] DONE 新增5项回归，最终203 PASSED；修复前201项中的2项FAILED日志保留。类型检查、项目结构检查PASSED。真实本机MobileSAM联调使用重叠client事件/异步位置查询，松手1请求，另1次精调，人工确认保留照片坐标5片4孔，删除后410。受保护225文件未变。
- [ ] IN_PROGRESS 修复后原生微信全链路验收；自动操作返回noWindowsAvailable，已请求用户编译并重新上传拖框。当前NOT_RUN，等待反馈后继续验证。相机/真机/多屏等未验项保留。
- [ ] TODO V5.3～V5.5，不实施。

本次仅改生产photo-canvas.ts、扩展photo-canvas.test.cjs和真实HTTP脚本，新增验证目录并更新AI说明/本台账。原模型/后端/安全/匹配未改，后端47项本次未重复执行，不冒称新增通过。无Git提交或推送。真实命令、首次受限网络失败与重跑、具体耗时、原生限制见[修复记录](docs/validation-records/v5.2-touch-fix/report.md)。

### 修复后原生协作复测与收尾（2026-10-28）

用户按复测要求重新编译、上传并圈选后回复：**“已自动出现绿色范围”**。该反馈确认本次“松手无变化”问题在用户微信操作中已解决；之前FAILED及工具限制记录保留。

- [x] DONE 用户手动圈选松手，自动识别并显示真实绿色覆盖层（用户反馈＋工具随后观察）。
- [x] DONE 工具通过原生按钮切换真实候选，保存两张不同覆盖范围截图；展开精细调整，画布控件点击添加补充点和排除点，撤销最后一个点，重新识别后恢复同一确认界面。
- [x] DONE 原生点击“确认识别范围”，页面显示“已确认照片中的分割范围。下一阶段将支持放置到人体模型。”；返回手动入口，胸部选择保留，再进入原手动标注页面。
- [x] DONE **V5.2 极简交互改造**：工程实现、203项前端测试和真实模型HTTP联调通过，当前开发工具的主流程协作验收完成。本条是本轮最新阶段结论，取代上方待原生反馈的历史状态。
- [ ] NOT_RUN 真机、相机、多屏、GUI故障/竞态压力及连续录像；非阻塞补充验收，不能据本次结果宣称生产部署或医学分割效果通过。
- [ ] TODO V5.3～V5.5，未实施。

此次仅追加文档和原生截图，没有修改生产代码或重跑前轮已通过的测试。操作者区别：用户完成真实拖框；工具完成后续候选/精调/确认/返回。任意坐标点击仍报noWindowsAvailable，因此精调使用画布可访问性控件的中心点击；两个相反提示用于控件验证，提交重新识别前已撤销最后的排除点，不当作医学质量验证。保留控制台既有1条过期会话DELETE410和平台warning，不写成Errors0。

原生证据见[收尾记录](docs/validation-records/v5.2-touch-fix/report.md#原生协作复测补记2026-10-28)及[确认截图](docs/validation-records/v5.2-touch-fix/wechat-confirmed.png)。本轮止于V5.2；无Git提交或推送。

## V5.3 人体放置（2026-10-31）

- [ ] IN_PROGRESS 消费V5.2已确认照片轮廓，在对应人体视图/部位初始化放置草稿；单指拖动、等比缩放、旋转、重置及人工确认。
- [ ] TODO 全MultiPolygon/孔洞变换与人体完整表面包含验证，V2唯一会话无损、原子、幂等写入及旧结果失效。
- [ ] TODO 自动化、真实模型联调和实际微信验证；未运行项如实保留。
- [ ] TODO V5.4～V5.5，不自动实施。

已读取用户主请求、附件第九～十六节及现有约束/台账，当前用户授权V5.3优先于AGENTS中的历史阶段边界。原始照片数据保持照片坐标；人工放置不是AI解剖配准。开工文件指纹保存在/private/tmp/dermatome-v53-baseline.json。不得修改人体/神经图谱、匹配算法或提交/推送Git。几何、会话适配、文档并行实施；历史记录保留。

### V5.3 实施结果与验收范围（2026-11-01）

以上为10月31日开工计划；以下为本轮最新实际结论：**V5.3功能实现完成，当前微信开发工具主流程验证通过，等待用户最终验收；补充原生分支与真机等未验项保留。**

- [x] DONE AI照片确认后“放置到人体”；继承正/背面与粗部位，局部聚焦、整组拖动和可见移动柄、10%～400%等比大小、-180°～180°旋转、重置、全身/局部查看、确认和V2恢复。
- [x] DONE 照片原尺寸像素度量→统一中心相似变换→人体逻辑→人体归一化坐标；源确认不变，多个片区和孔洞完整保留，不裁切、凸包或静默简化。
- [x] DONE 完整填充范围包含检查（所有边的交点区间及内域），拒绝跨人体外背景及人体孔洞；独立Shapely最终1341例一致。超20000总顶点明示不兼容，保留原分割结果。
- [x] DONE V2唯一会话兼容扩展、原子追加一组AI标注、重复确认幂等、manual保护、视图/模板/来源/修订/期限重验。正式几何含geometry，旧ring仅兼容外环；旧V4请求入口对AI几何明确拒绝，原匹配算法不改、未接V5.4。
- [x] DONE 草稿lease与旧回调隔离；显示确认需当前viewport帧；拖动被隐藏/尺寸变化打断时收尾校验。自定义返回继续/放弃选择，普通系统离开保留运行内草稿可继续；照片取消/换图/到期明确释放未确认草稿。临时照片期限不清掉已保存人体几何。
- [x] DONE 最终自动测试：前端**248 PASSED/0 FAILED**（基线203+新增45），后端**47 PASSED**，独立AI **78 PASSED**；TypeScript、7页/组件结构、微信wcc/wcsc编译通过。具体命令与警告见验证报告，不相加为医学准确率。
- [x] DONE 真实模型HTTP联调：同一公开CDC21505，最终两次0.761202s/0.679637s、每轮3候选；显式确认candidate-1，完整5片4孔941点，背面70%/25°放置。放置阶段0网络请求、原front manual保留、back新增1组、双确认不重复、V2恢复、原始照片数据不变、删临时照片后正式人体标注保留。
- [x] DONE 实际微信主流程：工具完成背面上背部选择→公开照片上传→真实拖框自动分析→确认→放置→拖动→71%/25°滑杆→全身→移到人体外禁确认/提示→移回→双击确认→V2恢复1组；随后人工加3点闭合，AI标注1+区域2共存。保存原始截图。此GUI提示与HTTP实验不同，不沿用HTTP的5片4孔计数。
- [x] DONE 退出提示缺陷修复：初版confirmText“放弃并返回”超过微信4字限制，实际接口失败；改“放弃返回”，完整重新编译后真实弹框和“继续调整”通过。原失败诊断、旧页面缓存现象及修复后截图保留。
- [ ] NOT_RUN/待补 原生“明确放弃”最终分支、保存后返回选择再重入完整路径、滑动返回恢复及各GUI故障/TTL/竞态压力（已有自动化覆盖）。工具末尾再次切换项目/任意坐标noWindowsAvailable，未冒称这些分支通过。
- [ ] NOT_RUN 真机、相机、多屏、连续录像/帧率、20000点最坏性能与临床定位/分割质量；当前公开测试图无专家标注。
- [ ] TODO V5.4～V5.5，未实施。本轮结束于V5.3，等待用户审查。

独立几何审核发现并修复两处孔洞接触使填充内域断开的拓扑问题，初次1340例中2差异和最终1341通过均保留；不得把早期1337通过替代最终结果。审查另补删除AI后重放置、导航栈返回、临时草稿释放、视口ready令牌和中断手势收尾。没有删除原有测试。

修改范围：新placement类型/几何/草稿控制器、放置页和透明Canvas组件、5个placement测试文件及真实HTTP/独立Shapely脚本；扩展V2类型/会话/绘制、AI页面交接、标注页恢复及计算隔离、公共投影/原几何helper导出、路由/结构检查和必要文档。精确清单见[changes.json](docs/validation-records/v5.3/changes.json)。开工655文件对比，115个受保护backend/AI/data/人体资源文件无修改，无文件缺失；无新模型/框架/数据库、无Git提交/推送。

完整记录：[实施报告](docs/validation-records/v5.3/report.md) · [坐标和数据契约](docs/v5-placement.md) · [实际放置截图](docs/validation-records/v5.3/wechat-placement-adjusted.png) · [V2恢复截图](docs/validation-records/v5.3/wechat-v2-restored.png)。
## V5.3 交互性能专项（2026-11-01，追加）

- [ ] IN_PROGRESS 审计拖动/滑杆调用链；同环境、同合成数据采集优化前后计时；最小必要优化缓存贴片、单帧调度及状态传输。
- [ ] TODO 回归完整多片/孔洞、最终人体边界校验、V2提交和失效保护；记录实际原生验证及未执行项。

本轮仅授权V5.3性能优化，V5.4～V5.5不开发。初查每次移动草稿与绘制各变换全部顶点、草稿递归冻结、页面同步、client触摸每次查询位置；背景已有独立Canvas，完整几何校验仅结束/确认执行。开工指纹 `/private/tmp/dermatome-v53-perf-baseline.json`，原实现快照和后续测量见 `docs/validation-records/v5.3-performance/`。性能结论等待实测，不预设帧率或倍数。

### V5.3 性能专项实施结果（2026-11-01）

- [x] DONE 调用链与优化前计时：确认每个移动有两次完整顶点变换及高频setData/位置查询；背景和边界校验并非逐帧执行。保留四份原源码及第一次计时，不覆盖旧V5.3验证。
- [x] DONE 最小优化：不可变源保留；透明离屏贴图一次缓存；移动仅更新变换；单个requestAnimationFrame/无能力单次定时器；手势内共用位置测量；移动不setData，滑杆文字限频；精确终态/最终完整校验、geometryRevision一致性与V2原子提交不变。未改模型/人体/图谱/匹配/后端，无新依赖。
- [x] DONE 同环境3对实测：8组数据（100/500/2000点，1片或5片5孔，补320/430宽）及拖动/快速滑杆/全身聚焦/确认。2000点5片5孔375宽，120次移动JS处理总耗时中位32.755→1.105ms；全部顶点变换241→0、setData241→2、位置查询121→1。是确定性平台适配与Canvas命令计时，不是微信GPU/消息桥延迟或FPS。松手完整校验阶段211.766→212.264ms，未隐藏这一剩余风险。
- [x] DONE 自动化：`npm test --prefix miniprogram` **263 PASSED / 0 FAILED**，既有248+新增15；`npm run typecheck --prefix miniprogram`通过；后端pytest **47**、AI pytest **78**；独立Shapely **1341**；项目7页检查及微信wcc/wcsc通过。前两轮248/260/262结果保留，最终见frontend-final.txt。
- [x] DONE 真实本机MobileSAM联调：公开CDC21505显式确认后，完整5片4孔941点放置、70%/25°、原manual保留、V2恢复、重复确认1组、放置0网络请求、删除临时照片不删body数据。平台绘制适配器不是原生微信操作。
- [ ] NOT_RUN 本轮原生连续拖动/缩放/旋转和真机流畅度：自动工具可读Shingles但坐标操作持续noWindowsAvailable，AX控制台输入无执行证据；已请求前台。不能复用上轮截图宣称优化后验收，也不承诺固定帧率。20000点最大负载、原生缓存画质/内存与手机多屏待验。
- [ ] TODO V5.4～V5.5保持未开发。性能代码及工程回归已完成，实际流畅度验收仍待用户/原生复测。

修改生产：placement-overlay组件TS及新增preview.ts，placement页面TS/WXML，placement-session、placement-geometry；新增/补充性能夹具、事件/预览/生命周期测试及成对计时脚本，适配既有真实HTTP验证脚本；更新本台账与V5.3说明。具体文件/保护指纹见[changes.json](docs/validation-records/v5.3-performance/changes.json)和[protection-check.json](docs/validation-records/v5.3-performance/protection-check.json)。所有实际命令、完整分项、限制及证据见[性能报告](docs/validation-records/v5.3-performance/report.md)。无Git提交/推送。

性能专项收尾补记：新增定时器ID=0的原生兼容防重/取消回归，最终 `npm test --prefix miniprogram` **264 PASSED**（原248+新增16），类型检查通过，日志frontend-timer-final.txt/typecheck-final.txt；263结果按历史保留。代码保护核对356个受保护文件均未变。首次全目录核对误包含已被后端既有TTL清理的16个临时私有资源，修正为只检查源码/固定数据，保留失败说明而不记录私有会话标识。

### V5.3 性能专项原生补测（2026-11-01，前台恢复后）

- [x] DONE 实际微信重新编译→背面上背部→公开CDC21505照片上传→拖框自动MobileSAM→确认→人体放置。真实工具拖动、162%大小、44°旋转、全身切换及“确认位置”成功，保留本轮截图。实际候选27片/36孔/2207点，未冒用HTTP实验数量。
- [x] DONE 真实微信Canvas连续事件回放：60次移动、40次缩放、40次旋转，各观察到60/40/40次缓存drawImage；绘制同步JS合计29.7/21.9/21.1ms，源几何不变。明确是注入事件回放，不是真机手势或FPS；实际工具拖动本身只派发1次move。
- [x] DONE 全身切换后变换完全一致；原生确认保存全部27片/36孔/2207点；点击返回标注页，实际annotate路由和数据恢复一致，AI标注1组，神经匹配仍禁用。最后V2页面截图与路由不一致，故只认定数据核验通过，不伪造最终截图。
- [ ] IN_PROGRESS 实际流畅度最终验收：缓存预览已验证，但复杂样本操作结束完整校验约0.58～0.65秒，仍有停顿。未降低几何精度或跳过最终边界检查；不得宣称全部卡顿消除或固定帧率。
- [ ] NOT_RUN 本轮原生人体外拖动分支、拖动中退出、真机、多屏与20000点最坏负载；后半程工具再次noWindowsAvailable。原有自动化覆盖保留，不重复标为原生通过。
- [ ] TODO V5.4～V5.5，未进入。

本次只追加task.md、[性能报告原生补测](docs/validation-records/v5.3-performance/report.md#前台恢复后的原生补测2026-11-01追加)及`native/`计时/截图。没有修改生产代码，未重复运行前轮已通过的264前端、47后端、78AI、1341几何测试。第一次wx计时非单调和诊断脚本环结构误读均保留说明，后续有效采样改用performance.now、卸载全部计时包装。原始文件见[原生摘要](docs/validation-records/v5.3-performance/native/summary.json)。无Git提交/推送。

## V5.4 AI放置与既有参考匹配整合（2026-11-01）

- [ ] IN_PROGRESS V5.4.1 统一完整人体几何与稳定标注ID、原子幂等提交和重新编辑。
- [ ] TODO V5.4.2 同一evaluate接口无损支持MultiPolygon/孔洞，复用V4公式、版本和迟到响应保护。
- [ ] TODO V5.4.3 确认位置并计算、同一V4结果展示及视口衔接、失败重试。
- [ ] TODO V5.4.4 自动回归、真实模型与匹配HTTP联调、微信验收和证据。
- [ ] TODO V5.5，不自动实施。

用户本轮已授权V5.4，优先于AGENTS历史阶段限制；记录用户认可V5.3当前操作速度，不以此覆盖先前0.58～0.65秒收尾校验实测。已审查V5.3完整geometry及V2唯一会话，旧V4只接收简单vertices并主动阻止AI计算，需最小兼容扩展。保留源照片、现有图谱/人体/数学公式/隐私规则；开工指纹`/private/tmp/dermatome-v54-baseline.json`，不提交或推送Git。

### V5.4 实施与原生验收结果（2026-11-01，追加）

以上为开工计划；以下是本轮最新结论：**V5.4 工程实现、自动化和当前微信开发工具主流程完成，等待用户验收；未执行的真机/压力项目明确保留。**

- [x] DONE V5.4.1：V2唯一正式人体会话保留完整MultiPolygon/孔洞/照片来源；AI重新编辑为独立草稿，确认时比较替换原placementId、保留稳定标注ID，原子幂等提交。未确认草稿不改变原结果，照片TTL清理不影响已保存人体匹配。
- [x] DONE V5.4.2：同一evaluate最小扩展geometry或旧vertices二选一，明确人体坐标；匹配载荷白名单不发照片/Mask/提示/令牌。复用原面积公式、并集、候选身份、正反面和版本保护，不新增模型或匹配服务。同几何manual/AI自动与真实HTTP响应一致；无覆盖真实返回0候选。
- [x] DONE V5.4.3：“确认位置并计算”保存后一次计算，失败只重试；沿用V4自动全部填充/两侧标签/单区/全部，保留当前显示比例与中心；确认编辑后旧结果失效，迟到请求不能覆盖。保留V5.3缓存贴片与最终完整几何检查。
- [x] DONE V5.4.4：最终前端 **275 PASSED / 0 FAILED**、后端 **61 PASSED**、独立AI **78 PASSED**、独立Shapely **1341**；TypeScript、项目7页检查、微信wcc/wcsc编译通过。真实命令、旧失败和警告见报告，未删除旧测试。
- [x] DONE 真实模型HTTP：公开CDC21505一张、两次推理1.923297/0.546735秒；确认5片4孔941点，70%/25°放置后真实evaluate两次132.964/128.805ms；manual共存、编辑同ID替换、照片清理410后仍匹配、来源等价性通过。wx/Canvas适配器不冒充原生GUI。
- [x] DONE 微信原生23步主流程：背面上背部→实际上传/拖框/候选人工确认→真实拖动、72%/28°→确认计算自动全部5候选与两侧标签→T3单区/显示全部→编辑后同ID新位置实际T5～T8候选、无旧填充→正反切换→人工三点闭合与AI同请求。原生这次是8片5孔1015点，不混用HTTP数据。
- [x] DONE 原生异常补测：停止本次测试后端，双击确认只请求一次、保存1组；恢复后重试成功，前后lesions完全一致。编辑放弃保留旧几何和结果，重新进入可用。现有图谱/人体求差只读确认手部未配置后，真实17%贴片拖到该位置，返回覆盖0%、0候选/0填充，无猜测节段。
- [x] DONE 原生发现并修复编辑重影：只从显示背景隐藏正在调整的旧目标，不改正式会话；其他标注保留、确认后恢复一份。补断言，275项与类型检查重跑通过，完整重新编译后实际拖动无重影。旧模块热更新错误经完整编译恢复；两次诊断字段错误与预期断线错误保留说明，不称全程Errors0。
- [x] DONE 性能保护回归：8组100/500/2000点/单片及5片5孔/320～430宽通过，移动阶段无完整顶点变换；2000点120事件/30帧机会1.038ms，结束校验约208ms（平台适配器，不是GPU/FPS）。原生匹配往返125/135ms、人工共存170ms、断线恢复105ms，有限实测不承诺固定性能。
- [ ] NOT_RUN 真机、相机、真实多屏、快速返回竞态压力、弱网持续压力、20000点最坏原生负载、逐帧过渡录像和临床准确率；相关自动化不冒充上述验收。复杂几何收尾停顿仍保留历史风险。
- [ ] TODO V5.5，未实施；本轮停止，等待用户审查。

原公式/人体/图谱/AI模型/图片安全机制不变，无新增框架、数据库或依赖。后端已恢复并留供测试；仅开发环境，未宣称可接收真实患者或完成医学审核。文件变更及保护核验见[changes.json](docs/validation-records/v5.4/changes.json)、[protection-check.json](docs/validation-records/v5.4/protection-check.json)。无Git提交或推送。

完整报告（12项）：[V5.4开发与验收报告](docs/validation-records/v5.4/report.md)；[统一数据流](docs/v5-ai-integration.md)；[自动全部截图](docs/validation-records/v5.4/native/03-automatic-all.jpg)；[修改重算截图](docs/validation-records/v5.4/native/05-edited-result.jpg)；[真实无覆盖截图](docs/validation-records/v5.4/native/09-uncovered.jpg)。

## V5 MobileSAM 过度分割专项（2026-11-01）

- [ ] IN_PROGRESS 复核原始Mask/提示/轮廓/候选，复现V5.1失败样本，区分工程错误与模型局限。
- [ ] TODO 上下文裁剪、多个局部区域、原照片精确回填、可解释候选优先级。
- [ ] TODO 可撤销补充/擦除画笔，实际Mask与轮廓同步，保留原模型预测及人工确认。
- [ ] TODO 真实对照、V5.2～V5.4和手动流程回归、文档与专用模型数据方案；不训练。

用户本轮授权仅分割专项，优先于旧阶段限制，不自动把它标成V5.5。开工指纹`/private/tmp/dermatome-overseg-baseline.json`。使用既有合法公开和合成样本，不读取或外传患者资料；本轮未提供具体新增失败照片，不能将公开样本的结论直接归因于用户未提供的图片。不改人体、医学图谱、匹配公式，不提交/推送Git。

### 分割专项实施结果（2026-11-01，追加）

以上为开工计划；以下为最新结论：**分割专项工程实现与当前开发工具主流程完成，通用模型误选/漏选尚未解决，等待用户审查实际效果；未进行专用训练或V5.5开发。**

- [x] DONE 真实诊断：已有公开CDC样本复现多点候选覆盖99.767%/模型分数约0.970；未发现反转、旧坐标错位、孔洞填充或形态闭运算。旧页面取首个有效候选，并非最高分自动确认。用户新增失败原图未提供，不冒认已定位其逐图原因。
- [x] DONE 局部/多框策略：保留既有MobileSAM，框周边max(16px,20%长边)上下文，至多4处、原图整数偏移回填、零插值；点-only显式回整图。精细调整可补圈或改用整图，裁剪边缘截断提示保留。新增流程的归一化整数往返多1px问题已以1e-8px容差修复并补测试；不是旧过度分割的全部原因。
- [x] DONE 候选解释：框面积比/框外占比/提示包含排除/碎片/两两差异，按提示遵从度降低异常展示优先级；全部真实候选保留，不按SAM分数确认，不按面积自动删除/缩小。
- [x] DONE 真实画笔：隐藏于“修正范围”的补充/擦除/大小/撤销/恢复原识别，松手一次更新实际Mask+原轮廓算法；原始AI结果不变。每候选edit_revision+完整历史幂等重放，旧照片/候选/超时结果不能错误确认，维持权限/TTL/清理。
- [x] DONE 最终真实实验：3张公开来源照片（两张同一病例）+2合成图，10实验/19次流程/21次predict/57个候选，全部工程执行成功、全部Mask↔Polygon逐像素一致。局部B4.056→4.768%、F1.954→1.984%、G1.662→7.484%，效果混合，不把面积变化当医学改善；F失败与高分大范围保留。加载1.362s，单图流程0.472～0.906s、3框1.487s；无专家标注，医学Dice/IoU未测。
- [x] DONE 自动回归：前端 **285 PASSED**、AI **101 PASSED**、后端 **61 PASSED**、独立Shapely **1341**；TypeScript、7页结构与微信wcc/wcsc通过。两条新增AI夹具漏coordinate_space导致422的失败日志保留，修复测试而非放宽服务。最终命令和记录见专项报告。
- [x] DONE 最终真实HTTP：公开CDC21505，两次真实模型推理、擦除→撤销→擦除→补充→显式确认；10片13孔845点完整进入V2，70%/25°放置及原V4计算、同ID编辑、人工共存、源等价和清理后匹配通过。wx绘图适配器不冒充原生。
- [x] DONE 微信原生：真实上传/拖框→局部推理→擦除/撤销/补充→人工确认→腹部拖动→确认并计算/4项参考标签。2笔净修正移除840、补入479像素，15,982→15,621像素；最终 **12片20孔1288点**与revision4完整保存。实际修正请求41～53ms、确认15ms、evaluate155ms；不是临床操作效率研究。原生结束后再修整数框浮点边缘，以独立测试+最终真实HTTP复验，未重复全原生链路。
- [x] DONE 后续专用模型仅评估：专家标注定义/双人复核、独立患者划分、小规模合法数据试点与学习曲线、MobileSAM基线及轻量2D U-Net/nnU-Net、SAM小模块微调对比计划；查阅官方来源，未安装新模型、未训练、未编造准确率。
- [ ] NOT_RUN 真机、多屏原生画笔、相机、弱网压力、实际OOM/最大32笔负载、临床专家质量验收、15～30独立病例。不能宣称自动分割已达到医学要求。
- [ ] TODO V5.5及其他业务阶段，未自动实施。

主要新增：AI local_regions/quality/brush、可复现实验/公共源修正导出、独立专项测试。修改AI分割/导出/提示验证，临时服务schema/routes/session/boundary，小程序AI types/service/state/page/photo-canvas及相应测试，真实链路脚本；更新API/架构/AI README/总README/本台账。具体[变更清单](docs/validation-records/v5-oversegmentation/changes.json)。59个受保护人体/图谱/坐标/会话/匹配及原模型/轮廓核心文件哈希均未变，见[保护核验](docs/validation-records/v5-oversegmentation/protection-check.json)。无新依赖、无Git提交/推送；后端已载入最终代码并留供开发测试，不接收真实患者照片。

完整[诊断及测试报告](docs/validation-records/v5-oversegmentation/report.md)，[前后修正对照](docs/validation-records/v5-oversegmentation/previews/brush-comparison.jpg)，[高分失败对照](docs/validation-records/v5-oversegmentation/previews/high-score-failure.jpg)，[原生结果](docs/validation-records/v5-oversegmentation/native/05-corrected-matching.jpg)。失败样本与历史台账未覆盖；本轮停止，等待用户验收。

## 腾讯云只读巡检与双项目容量评估（2026-11-01）

用户仅授权调查已有智枢智教服务器，评估与智络智绘共存；不安装、不部署、不重启、不改配置/数据库/防火墙，不开启生产AI或推进V5.5。

- [x] DONE 本机线索：读取当前AGENTS/task、项目A部署与HTTPS交接/生产依赖资料及SSH Host必要字段；确认acupuncture-server，未连接无关实验主机、未输出私钥/凭据或扫描未知主机。
- [x] DONE 实际只读连通：Ubuntu24.04.4 x86_64、AMD EPYC来宾4逻辑CPU（不是历史推测2核）、内核物理内存3.64GiB、MemAvailable约2.78～2.81GiB、swap1.94GiB使用0；40GiB系统盘，可用30.69GiB，无额外数据盘。
- [x] DONE 原服务：acupuncture.service enabled/active、单worker/独立venv/Python3.12.3、回环8000，RSS269.49MiB、HWM270.38MiB，NRestarts0；本机与公网HTTPS健康/就绪200，ready三项布尔true。未发送业务图片、考试或数据库请求，不冒充全业务验收。
- [x] DONE Nginx/证书：80/443运行，A域名HTTPS→127.0.0.1:8000；8001当前未监听。证书实际有效至北京时间2027-01-22 00:56:10，仅覆盖A域名，TLS1.2/1.3和公网信任校验通过；certbot.timer已启用、上次退出0。本轮未续证/重载，B域名/证书和微信后台仍待准备。
- [x] DONE 历史与容量：读取已有sysstat近24小时143个10分钟采样，CPU区间平均最大1.21%、最低采样可用内存约2.79GiB、swap采样0；不冒充瞬时峰值。A cgroup无OOM计数，内核journal窗口无可见记录，不能宣称历史全机无OOM。既有Mac CPU MobileSAM记录高水位约959.59MiB，缺Linux大图/全HTTP峰值，未在生产安装或加载模型。
- [x] DONE 推荐与风险：结论 **CONDITIONAL GO**，仅作为低并发受控试部署候选；A/B独立venv/systemd/回环端口/HTTPS域名，B单worker/单推理，未来实测1～2线程、图片与内存/磁盘预算。8GB有余量优势但不要求立即升级；请求增长或A稳定性严格时再考虑独立AI机器。发现B仍限制development/test、develop+devtools、真机URL为空，不能直接照搬开发开关公开发布。
- [x] DONE 报告与证据：[docs/tencent-cloud-audit.md](docs/tencent-cloud-audit.md)、6份服务器/公网/本机脱敏JSON及本地指纹/链接核验。只新增文档证据和本台账，未改应用代码、未提交/推送Git；原A与Nginx结束时PID/启动时间/重启数均与开始相同。
- [ ] NOT_RUN Linux隔离安装/加载/最大图推理、双业务并发、压力/稳定性、B真机与公网功能、云控制台安全组/带宽/套餐及备案实时核验；本轮均未获部署授权，不执行。
- [ ] TODO 后续需要B域名与DNS/主体授权、预计人数/等待与图片上限、敏感图片处理范围和原项目维护窗口；不需要补充SSH私钥或密码。不自动进入部署。

巡检细节、三个方案对比、风险分级及检查边界见报告；现有资源有机会共用，但尚不能保证MobileSAM不影响原项目。


## P0 腾讯云Linux受限MobileSAM验证（2026-11-01）

- [ ] IN_PROGRESS 实时资源/健康复核、可执行cgroup资源保护与停止条件。
- [ ] TODO 独立目录/venv、既有固定官方模型/权重校验、CPU依赖兼容性。
- [ ] TODO 受限真实加载，按安全条件逐级少量串行推理与完整指标。
- [ ] TODO 结束复核、残留任务检查、报告/容量结论与清理说明。

用户本轮明确授权独立临时环境与少量受限模型测试，覆盖上轮仅只读边界；不改/srv/acupuncture、原环境/服务/Nginx/永久systemd/证书/防火墙，不开放端口，不正式部署或启动常驻服务，不提交/推送。现况与结果以本轮实际测量为准，保护无法落实或原服务异常即停止新增负载。

### P0实施结果（2026-11-01，追加）

以上为开工计划，以下为本轮实际结果。**P0受限Linux技术验证通过，正式部署决策CONDITIONAL GO；未正式部署，不推进后续业务阶段。**

- [x] DONE 实时检查与硬保护：原acupuncture健康/就绪200、PID3480408/启动时间/NRestarts0稳定，4逻辑CPU、3.64GiB内存、初始可用约2.79GiB。cgroup v2探针实际验证MemoryMax1536MiB、MemoryHigh1280MiB、MemorySwapMax0、CPUQuota100%、Nice15、TasksMax64；模型任务90秒上限、独立控制监测和子进程清理，未改永久systemd或原服务。
- [x] DONE 独立环境：新建`/srv/dermatome-preflight-20261101-p0/`及venv；固定torch2.5.1+cpu/torchvision0.20.1+cpu/timm1.0.12/NumPy2.1.3/Pillow11.1/Shapely2.1.2/psutil6.1.1，pip check通过。模型官方固定commit20文件本地/远端哈希核验，单份40,728,226字节权重；未安装OpenCV或FastAPI服务层，不动A环境。
- [x] DONE 故障真实保留：首轮PyPI超时，清理后的摘要flush参数错误修复；第二轮约14KB/s慢下载主动结束；第三轮仅在命令行临时用腾讯云官方HTTPS镜像并复用单份CPU wheel，安装完成。初次加载因12KiB静态Swap被绝对零门禁拦住；连续采样无换页/PSI压力后允许≤1MiB静态基线，但模型任何新增换页立即停止，硬内存/CPU/测试零Swap限制不变。没有swapoff或重启原服务。
- [x] DONE 真实纯加载：单线程CPU，模型构造1.761秒、含导入3.103秒，加载RSS379.06MiB、高水位388.61MiB；/usr/bin/time与进程记录一致，原服务正常后才推进单图。
- [x] DONE 逐级真实单图3次、9候选：A公开颈部裁图300×410，纯模型3.813秒/链路3.921秒/进程总7.088秒/峰值659.55MiB；B公开700×460，4.065/4.199/8.088秒、659.93MiB；C公开源2倍派生1400×2126（2.98MP），3.210/3.517/13.292秒、660.44MiB。C导出6.172秒，均输出原尺寸Mask/合法多片含孔轮廓；下载后本机对9候选逐像素回栅格一致。不是医学准确率、12MP测试或全HTTP时延。
- [x] DONE 期间与结束：模型任务主机最低可用约2.30GiB，cgroup Swap/OOM均0，系统静态Swap12KiB未增长、pswpin/out不变；最终oom_kill0。四个模型阶段21轮在途健康/就绪采样均200。结束原A与Nginx PID/启动时间/重启数不变，6个核心文件哈希一致；无测试进程/临时单元残留，8001未监听。未测原业务推理并发，不声称全业务性能无影响。
- [x] DONE 报告与容量决策：维持单worker/单并发/显式1线程/约1CPU及受控图片边界，现有配置可进入下一步受控生产准备；暂不必立即升级8GB，长期负载、大图/复杂轮廓或更严稳定性需求再评估。B开发门禁、域名/HTTPS/真机与隐私/访问控制需另行完成，未建立dermatome.service。
- [x] DONE 环境盘点与保护：保留本轮根目录约1.22GiB（venv约976MiB，模型+单份wheelhouse约250MiB等）供审查；同时间/用户的59个pip临时候选约3.73MiB仅列清单，不擅自批量删除。276个本机应用代码文件哈希不变；无Git提交/推送。本轮明确建立了服务器测试环境，不能说服务器完全无变化。
- [ ] NOT_RUN B正式FastAPI/全HTTP/真实图片上传安全、两个常驻服务长期稳定性、多用户业务并发、12MP极限、故障注入/OOM压力、真机与正式患者图；未进行部署、Nginx/证书/原systemd/防火墙变更或资源购买。
- [ ] TODO 用户审查P0后，再决定B域名/DNS/主体、生产门禁和隐私方案、预发布/发布回滚与维护窗口；不自动正式部署。

完整[腾讯云MobileSAM部署前验证报告](docs/tencent-cloud-mobile-sam-preflight.md)；[Linux实际输出预览](docs/validation-records/tencent-cloud-mobile-sam-p0-20261101/linux-output-preview.jpg)；[时间与RSS汇总](docs/validation-records/tencent-cloud-mobile-sam-p0-20261101/metrics-summary.json)；[保护及无残留核验](docs/validation-records/tencent-cloud-mobile-sam-p0-20261101/protection-verification.json)。原始安装失败、静态Swap预检、监测和time -v均保留在同证据目录server/logs中。上轮“Linux未运行”为当时历史结论，本轮只补充本次受控实测，不将其扩写成正式上线验收。

## P1–P3 腾讯云独立部署与受控联调（2026-11-01）

- [ ] IN_PROGRESS 独立生产目录、低权限用户、锁定CPU环境、dermatome.service与资源限制。
- [ ] IN_PROGRESS 受控测试鉴权、上传/像素/频率限制、模型单线程与单并发、临时会话停启保护。
- [ ] TODO 本机HTTP真实模型/匹配/异常/独立启停与原服务保护验收。
- [ ] TODO 独立域名/DNS/HTTPS与微信合法域名核实，条件不足时明确NOT_RUN。
- [ ] TODO 可执行微信联调、部署证据与运维/回滚报告。

本轮用户明确授权新增B生产服务与满足条件时独立Nginx/HTTPS，覆盖旧开发环境范围；不改A代码/环境/服务/域名证书，不开放公网8001。先制定仅针对B的回滚，原A异常即停止B；P0目录保留。继续限定公开/合成图片与人工确认，不启用正式医学映射，不推进V5.5或Git提交。

### P1–P3实施结果（2026-11-01，追加）

以上为开工计划，以下为实际验收。**P1独立部署DONE；P3服务器独立启停DONE；P2独立HTTPS/微信公网接入BLOCKED（用户确认无新域名），完整原生云端联调NOT_RUN（用户暂缓凭据输入）。总体未全部验收，不标记公网或微信可用。服务器已部署，公网或微信联调仍待完成。**

- [x] DONE 独立生产环境：`/srv/dermatome-mapper`，低权限dermatome用户、root只读代码/模型/venv、独立runtime/logs/config；固定Linux CPU依赖及MobileSAM官方源/40,728,226字节权重SHA核验，pip check通过。P0目录保留，未动A环境，未装CUDA。内容版本20261101-p1p3-92c517b5f35a，92运行文件与云端逐一相同，非Git提交。
- [x] DONE `dermatome.service` enabled/active，仅127.0.0.1:8001；单Uvicorn worker/模型缓存/单推理429、模型线程1，CPUQuota100%/MemoryHigh1280MiB/MemoryMax1536MiB/MemorySwapMax0/TasksMax64实际cgroup核验；有限自动重启，日志脱敏与目录隔离。独立cleanup.timer保持过期照片清理。
- [x] DONE 受控生产边界：保留默认production禁用，新增controlled加SHA256凭据与功能开关；API访问凭据+原会话能力令牌、Origin拒绝、文档404、认证请求120/min/新会话8/min、最多2临时会话，10MiB/3MP限制；无公开静态照片目录。测试凭据仅本机ignored私有文件，小程序用户输入只留内存，既有8000/真机HTTPS门禁保留。
- [x] DONE 停启数据保护：原子私有快照保留合法未过期照片/完整MultiPolygon孔洞/确认信息，令牌只存摘要；超时失效同步持久化，重启不复活旧结果。固定30分钟失效不延长，运行时30秒/停服timer5分钟清理，取消立即删除；原V2权威会话/人体坐标及V4失效机制不变。
- [x] DONE 云端真实HTTP：经唯一回环SSH通道执行实际页面状态/Canvas与wx网络适配器→真实云端上传/两次MobileSAM/3候选/人工确认/背面贴片70%与25°/V2正式保存/匹配与编辑重算/删照片后仍匹配，最后安全补丁后复验通过。不是原生GUI或真机。相同几何AI/手工来源结果完全一致。
- [x] DONE 云端20项专项：鉴权401、跨站403、文档404、坏图/3MP超限422、实际体积超限413、EXIF方向、单推理429、外会话410、Mask/alpha下载/人工确认、原尺寸700×460 Mask与独立Shapely像素中心回栅格全等。公开CDC21505一张图，无患者上传或医学准确率结论。
- [x] DONE 独立stop/start/restart实测：停后PID0且8001消失，cgroup约480.7MiB释放，MemAvailable实测增约436MiB；未过期公开测试Mask哈希及确认快照保留，start/restart首次真实推理7.66/6.78秒，取消204再取410。未停A或Nginx。新服务保持enabled/active，临时部署guard/SSH通道已结束，本轮中转安装包已清理，P0与日志保留。
- [x] DONE 原服务保护：274轮采样A健康/就绪均200，原HTTPS结束200，A PID3480408/启动时间/NRestarts0、Nginx PID12643与启动时间不变，6个原文件与39个本机人体/图谱/匹配/会话文件哈希相同。未调用A业务视觉/考试/数据库接口，不能冒充A全业务验收。
- [x] DONE 实测：初次云端分割6.91秒含加载，暖模型3.58～3.61秒；匹配356～392ms含传输。全HTTP观测RSS高水位约764.9MiB、cgroup峰值约696.75MiB，最低主机可用约2.25GiB，B cgroup Swap/OOM0；全机静态Swap12→524KiB、pswpout1→5、pswpin/oom_kill0，不宣称全机无换页。最终RSS约543.6MiB、2秒空闲CPU约0.11%单核。
- [x] DONE 失败真实保留：首次安装被过严全机换页guard停止，复核静态小量/PSI0/A正常后只调整临时监测门槛，硬cgroup限额不变；新venv重建，第二轮安装40.1秒成功/峰值约1.2GiB。初次SSH禁转发选项、停机502断言、预处理默认参数/测试间限频计数及目录权限统计问题均有失败记录与修复说明，未冒充首次全通过。
- [x] DONE 测试：`ai/.venv/bin/python -m pytest backend/tests ai/tests -q`169项全量通过（7条既有官方源警告）；最后新增限频断言后`backend/tests/test_controlled.py`8项专项通过（与全量重叠，非另8个独立用例）；`npm --prefix miniprogram test`286项通过；TypeScript编译与云端状态脚本实际成功。Linux隔离清理验证过期删除、未过期/符号链接目标保留；结束临时会话目录0。
- [x] DONE 运维：新增固定目标cloud-control与启动/停止/查看云端.command，一键入口仅操作B；stop不等于disable，停主服务不拉起模型的cleanup timer保留。执行前独立回滚已制定；无Nginx新增站点、reload、证书覆盖、安全组/防火墙改动、Git提交/推送或资源购买。
- [ ] BLOCKED B独立域名/DNS/HTTPS与微信request/uploadFile/downloadFile合法域名登记；用户确认暂无域名，不借用A正式路由或开放公网8001。
- [ ] NOT_RUN 完整微信原生云端/真机流程、真实45秒超时/弱网/故障注入、实时等待30分钟过期、最大3MP全HTTP、长期多用户/与A视觉同时推理、临床与患者隐私上线验收。本机真实首页仅编译显示新入口，用户选择暂不输入凭据；未虚构联调成功。
- [ ] TODO 用户准备授权域名/主体/DNS及微信平台权限后另行独立HTTPS/真机验收；本轮不推进V5.5，不接收真实患者图。

新增：deployment访问/运维定义/锁定依赖/回滚与版本清单，backend受控访问与就绪接口、受控与清理测试，云端HTTP/启停验收脚本、小程序内存凭据模块及一键.command。修改AI预处理可选输入上限、后端门禁/线程/临时快照、小程序API/AI请求鉴权和首页/隐私文字；人体、图谱与匹配公式未改。文档更新README/architecture/api/privacy/原audit和本台账。完整[部署报告](docs/tencent-cloud-deployment.md)、[保护与指标](docs/validation-records/tencent-deployment-20261101/protection-and-metrics.json)、[启停证据](docs/validation-records/tencent-deployment-20261101/lifecycle-report.json)、[最终云端链路](docs/validation-records/tencent-deployment-20261101/http-page-final/real-page-http.json)。

## P4 微信体验版完整功能接入（2026-11-01）

- [ ] IN_PROGRESS 审查当前云端与小程序，统一develop/trial/release业务与调试能力。
- [ ] TODO 体验版完整业务入口、HTTPS地址配置与最小限时鉴权。
- [ ] TODO 独立部署/回滚、真实云端AI与匹配回归，保护原针灸服务。
- [ ] TODO 新HTTPS域名/微信平台配置与真实手机验收；缺权限按实际记录BLOCKED/NOT_RUN。

本轮用户授权受控trial完整业务能力及必要B部署，覆盖旧仅develop/devtools范围；正式版继续限制、开发图谱/坐标工具在trial默认隐藏。不改人体/图谱/匹配公式/A代码或服务，不开放HTTP/公网8001绕过HTTPS，不把envVersion当服务端身份，不提交/推送。

### P4实施结果（2026-11-01，追加）

**可独立实施部分已完成；总体P4尚未完成手机验收。** 用户本轮明确回复“仍无域名，先完成可独立实施的部分”。因此手机HTTPS/微信平台/上传指定体验版/真机不能标记完成，不用HTTP或公网8001绕过，也不借用A正式站点。

- [x] DONE 实时复核：A/B与原HTTPS正常；B原PID3798425，8001仅回环；Nginx只有A站点，无已核实B域名；当前AppID由仓库和微信工具项目基本信息双重核验为wx951711e2fa1da5ff。仅提取服务配置名，确认无微信登录配置，未输出AppSecret或管理员凭据。
- [x] DONE 集中能力策略：新增environment.ts明确develop/trial/release/unknown，trial开放计算/图片/AI/人体放置，release/未知在线能力关闭、原人体与手动离线能力保持。原development/ai门禁转发统一策略，移除业务强制devtools；图谱开发页、选择页/标注页坐标调试、性能JSON及内部版本在trial隐藏并在方法内拒绝。
- [x] DONE 网络与UI：servers.ts独立trial/release地址，只接受验证格式的HTTPS主机，无效/IP/HTTP/端口/用户密码/路径/query均拒绝，不回退localhost。首页正常产品文案与“开通体验访问”；业务API/上传/download统一携带限时授权；主流程仍上传→拖框自动分割→候选/修正→人工确认→贴片移动/缩放/旋转→确认计算/高亮与两侧标签。云端大小/像素限制及辅助/隐私说明保留。
- [x] DONE 最小可靠鉴权：复用原受控服务基础，新增管理员经SSH签发的10分钟一次性邀请换取固定1小时Bearer（客户端仅内存、后端摘要/私有原子状态、无数据库）。服务端随机principal，不把envVersion当身份；照片同时校验该principal与原照片key。邀请原子防重放，最多8待用/16授权、开通4KiB/10次每分钟；保留120/min、单推理/2照片/10MiB/3MP/TTL/日志脱敏。不是微信openid身份认证；未配置AppSecret，不把共享管理员密钥发给手机或嵌入包。
- [x] DONE 安全部署：备份后仅更新B5个旧后端文件并新增access路由/trial_access模块，版本20261101-p4-15893ff5de3a、94运行文件与本机一致；未改venv/依赖/模型/人体/图谱/匹配公式/A/Nginx/证书/防火墙。B仍独立单worker/1线程/单并发/1CPU/1.5GiB/零cgroupSwap。回滚目录deployment/backups/p4-20261101，执行前方案与全部证据保留。
- [x] DONE 自动化：Python全量176通过、7条既有官方源警告；最后非法字节鉴权头断言的访问专项6项通过（与全量重叠）；前端294通过、TypeScript编译通过。独立新增trial矩阵、HTTPS拒绝、单登录对话框、过时授权响应隔离、统一网络头与受控UI测试。旧“体验版必须拒绝”断言及缺失环境测试替身按新授权更新，未放松release/未知。
- [x] DONE 真实云端trial适配器链路：通过管理员SSH通道，以可靠wx envVersion=trial/iOS替身运行实际页面/状态/几何和真实云端上传、两次MobileSAM、候选切换/确认、背面贴片70%/25°、V2与手工标注共存、匹配/编辑重算/清照片后仍匹配；旧develop完整链路也通过。trial生产配置仍拒绝空HTTPS，测试网络适配器只存在脚本，不进入包；不是手机/TLS验收。
- [x] DONE 云端21项真实授权检查：未知/已用邀请、env伪装、跨principal即使持照片key的读取/上传/推理/确认/修正/删除均拒绝；合法owner原图保持；取消后410、管理员仅将自己一次性测试token设过期后401、撤销后401。未更改时钟或真实用户授权。另补实测Bearer合法会话两个在途推理仅一个200、另一个429 AI_BUSY，清理照片与授权。
- [x] DONE 新鉴权实际stop/start：停B后PID0无8001（通道响应502），A保持健康；start后旧Bearer与未过期照片恢复，原图字节相同，再次真实MobileSAM返回3候选，最后取消照片/撤销授权。未重启A/Nginx/整机。
- [x] DONE 实测：首次trial分割6.72秒含加载、细化3.67秒、匹配367～372ms含传输，停启后首次6.35秒。保护211轮A健康/ready均200、无保护停止，最低主机可用约2.25GiB，B阶段cgroup峰值约650MiB；最终快照RSS约568MiB、2秒空闲CPU约0.12%单核。全机swap静态524KiB、pswpin/out与OOM无增长，不声称无swap分配。6个原服务器文件、39个本机人体/图谱/匹配/会话核心文件哈希不变。
- [x] DONE 微信开发工具：Shingles正确路径/AppID实际编译成功、更新首页可见、最终Errors0/Warnings3。首个AX旧ID失效后刷新再编译；热更新旧Errors6已清零。没有将这些观察冒充trial手机结果，没有上传空HTTPS构建或修改当前指定体验版本。
- [x] DONE 运维与记录：新增“生成体验邀请码.command”和助手，实际签发/私有传回成功、码值未输出；真实测试照片与访问均取消。交付未安装的独立Nginx模板、内容清单、回滚方案、P4报告；更新README/API/architecture/privacy/部署说明。本轮不提交/推送Git，不开发新业务。
- [ ] BLOCKED 实际trialBaseUrl仍为空，缺明确授权B域名/DNS和可信HTTPS入口；用户确认暂无域名。没有伪造域名、使用A路由或公开8001。
- [ ] NOT_RUN 微信后台request/uploadFile/downloadFile、体验成员/相机隐私权限配置（状态UNKNOWN）、P4上传及指定体验版、手机Wi-Fi/移动网络全链路/拖动标签/相机与重入。无域名时不继续要求用户盲测。
- [ ] NOT_RUN 最大3MP全HTTP/长期多用户或与A视觉同时推理、临床/患者隐私上线、OOM/45秒模型挂起。模型失败/超时/照片更换与旧响应/结果失效由自动化覆盖，不冒充全量真实故障注入。
- [ ] TODO 授权域名→DNS/TLS/独立Nginx验证→填trialBaseUrl→正确AppID登记三种域名与体验成员/隐私→上传指定→真实手机两种网络验收。本轮独立工作停止于此，不自动开放release。

失败真实保留：首轮TS headers类型/未使用导入；初次18个前端失败包含旧门禁断言、未声明环境测试替身及新增无条件await影响原开发请求时序，修复仅需鉴权时等待后294通过。所有原失败日志保留，未覆盖成首轮通过。

主要新增environment/servers配置、trial-access客户端与服务端/路由、授权及trial测试、云端权限/停启脚本、私有邀请码助手/command及Nginx待配置模板。修改原前端配置/网络封装与首页/选择/AI/放置/标注的能力和调试条件、后端鉴权/生命周期/照片owner，不改算法数据。详见[体验版接入报告](docs/wechat-trial-integration.md)、[真实trial链路](docs/validation-records/p4-wechat-trial-20261101/trial-cloud-http/real-page-http.json)、[权限21项](docs/validation-records/p4-wechat-trial-20261101/cloud-access-security.json)、[并发](docs/validation-records/p4-wechat-trial-20261101/trial-busy.json)、[停启](docs/validation-records/p4-wechat-trial-20261101/trial-restart-report.json)、[保护](docs/validation-records/p4-wechat-trial-20261101/protection.json)。

P4并发记录更正：上段“另补实测Bearer并发”描述在收取补测结果前写入；实际首轮命令退出1，httpx.ReadTimeout，追踪显示继承了本机代理环境，尚未生成通过证据。该补测首轮标记FAILED，不能引用为已通过；明确直连SSH回环的重测结果在后续记录追加。既有21项授权、trial/develop链路及停启通过记录不因此扩写或冒充首次成功。

P4并发补测最终结果：首轮本机代理ReadTimeout、第二轮直连ConnectError；复核SSH会话已因闲置超时断开（Broken pipe），当时无本机18001监听，服务器A/B正常。恢复带15秒保活的唯一回环通道，并以trust_env=False明确直连后，实际主请求200、同时请求429 AI_BUSY，随后照片删除204/访问撤销204。[最终证据](docs/validation-records/p4-wechat-trial-20261101/trial-busy.json)。前述提前写入的通过描述以本条最终实际结果为准；两次失败文件保留。Python回环验收脚本已明确禁用继承代理，Node验收未启用环境代理。此修复仅涉及本地测试通道/脚本，没有改生产模型、业务算法或原针灸配置。

P4最终收尾：实际清点临时照片目录0、有效体验邀请0、有效授权会话0；仅撤销本轮失败补测那份未消费邀请，未批量操作其他数据。B、A与原cleanup.timer保持active，临时监测/带保活测试通道已停止，P0和B回滚备份保留。初次系统Python语法编译因继承的macOS缓存路径不可写而失败，未扩大权限，改用内存compile完成6个脚本语法检查；sh/node语法与私有文件Git忽略检查通过。最终A/Nginx身份及6文件哈希仍一致，详细结束计数与最新资源以P4保护/finish-check JSON为准。仍不把无域名状态标为P4手机完成。

P4最后资源补充：收尾保护累计488轮A健康/ready零失败，B全阶段cgroup观测峰值685.05MiB、最终RSS584.56MiB、主机最低可用2.25GiB；覆盖了最后并发补测，因此替代前面较早快照的650MiB/568MiB数值。

## P4.1 手机体验版临时HTTPS调试通道（2026-11-02）

- [ ] IN_PROGRESS 实时核对云端与环境能力，检查本机隧道工具和可信来源。
- [ ] TODO SSH回环→短期HTTPS通道、鉴权/资源/异常保护及独立关闭。
- [ ] TODO 配置真实trial URL，验证request/upload/download和真实AI/匹配，release保持隔离。
- [ ] TODO 类型/自动化/编译与可执行上传、真机协作及文档记录。

本轮用户明确授权经确认的临时HTTPS隧道及手机开发调试，覆盖此前只接受自有域名的P4接入前提；仍保留HTTPS、邀请码/会话隔离、单推理和图片限制，不开公网8001、不改A/Nginx/模型/图谱/算法，不使用真实患者照片，不自动开放release或提交推送。

### P4.1 路线调整：公网IP开发调试（2026-11-02）

用户明确取消新域名与临时隧道，授权复用现有公网80端口，独立HTTP测试前缀。此前HTTPS隧道计划撤回，未创建隧道或公开端口。HTTP传输邀请码、令牌、图片均不加密，仅公开授权/合成样本，不能用于患者或正式发布。

- [ ] IN_PROGRESS 核实历史IP访问、监听/防火墙与现有Nginx；原A服务与文件保护基线。
- [ ] TODO 独立可撤销IP虚拟主机/测试前缀，保留鉴权/上传/限流，8001仍回环。
- [ ] TODO 集中配置trial与develop手机地址，release隔离；真实公网鉴权/AI/匹配/原A回归。
- [ ] TODO 自动化、原生编译/上传与真机协作，记录结果和关闭方法。

### P4.1 公网IP实施结果（2026-11-02，追加）

**服务器与小程序配置完成；新上传和真机未完成，整体不标记DONE。** 用户授权公网IP HTTP开发调试，覆盖原HTTPS/新域名前提，不创建隧道。

- [x] DONE 历史A交接记录与当前配置/公网均确认IP HTTP入口212.64.26.206:80→Nginx→8000。B active/PID3810200，始终只监听127.0.0.1:8001。UFW inactive、nft INPUT accept及既有SSH拒绝；云控制台安全组详情UNKNOWN，无工具授权，未读取云密钥或改规则，已有80实际可达。
- [x] DONE 独立IP vhost和/dermatome-test/api/v1/前缀，剥离后转回8001。IP其他路径保留A原fallback；A两个站点/证书/服务不变。nginx -t与平滑reload，原master及A/B PID不变。启用前核对A fallback SHA，后续A改配置须先关闭B入口并审查副本。
- [x] DONE 公网清除管理员key头，复用10分钟一次性邀请/1小时Bearer/照片owner+key。Nginx5r/s+burst12/每IP6连接/11MiB体积；后端10MiB照片/3MP/30分钟TTL/2照片/单推理、120请求/8照片/10交换每分钟等原保护不变。代理故障明确503，开通5xx不再误报邀请码无效。
- [x] DONE servers.ts集中配置真实trialBaseUrl=http://212.64.26.206/dermatome-test及显式调试开关，只允许精确地址，任意HTTP/IP变体拒绝；普通HTTPS验证保留。develop手机/trial同入口，模拟器保留本机/受控SSH，release独立关闭，未知环境关闭。request/upload/download统一base+一次/api/v1；业务矩阵与调试工具权限复验。
- [x] DONE 开通及选图前明确HTTP照片、邀请码、令牌不加密，只允许公开/合成样本，禁止患者照片；鉴权不消除窃听/篡改风险，不用于正式版。电脑不再中转，测试入口需主动关闭。
- [x] DONE 前端296/296、TypeScript、项目/脚本检查通过；Python backend/tests+ai/tests 176通过、7条既有官方源警告。首次295/296系旧无地址用例未隔离新配置，显式置空后通过，失败日志保留。
- [x] DONE 真实公网21项访问隔离/邀请/失效/撤销与16项入口检查。匿名401、Origin403、非法文件/3MP422、10MiB/11MiB413；20次小health最多4并发得到13个200、7个429，无推理压测。真实管理员key绝不经HTTP，合成头拒绝配合实际配置SHA证明剥离，不能单靠无效头断言。
- [x] DONE 真实trial配置页面适配器链路：公开CDC PHIL21505上传、两次MobileSAM200各3候选、人工确认、背面70%/25度放置、V2共存、匹配/编辑重算、清照片后仍计算。10片/12孔/770顶点保留，源照片与全身坐标不变，AI/手工相同几何响应全等。分割HTTP3.557/3.298秒（已加载模型），匹配345.8/332.6ms。没有重写apiBaseUrl；wx/Canvas适配器不是原生手机。
- [x] DONE 独立关闭/恢复实测B404→200，A IP ready均200。最初两次紧跟reload断言读到旧worker而失败，助手加入真实状态轮询后复验通过。新增开/关公网测试入口command与固定SSH助手，只动B链接，不停两项API。
- [x] DONE 原服务保护326轮health/ready无失败，无保护停止；A/Nginx/B身份和原6文件SHA不变，94个B既有运行文件相同。主机最低available约2.17GiB，B cgroup峰值755.94MiB，OOM/swap页计数未增。临时监测已停，入口enabled、A/B/Nginx active；本轮照片/有效邀请/有效授权均0，无cloudflared进程或本机18001监听。
- [x] DONE 初拟真实管理员key公网剥离测试在执行前被安全审查拒绝，未读取/发送，改用合成头和配置哈希，不要求放宽保护。不改模型、人体、图谱、匹配、放置规则或后端运行文件；未装依赖/提交/推送。
- [ ] BLOCKED 新代码尚未上传/指定体验版：CLI首轮90秒超时，交互重试确认服务端口关闭，选择不扩大本机CLI访问，n退出246，无upload info。GUI坐标noWindowsAvailable，旧成功弹窗不是本轮证据。已异步请求用户上传0.5.4-ip.20261102并指定，或恢复窗口代传。
- [ ] NOT_RUN 新体验版手机开发调试、Wi-Fi/移动网络、拍照权限、真实拖动/标签。公网/适配器通过不能代替真机；旧体验版不会自动更新。

变更：前端config/api、servers、services/trial-access和AI页隐私；三个前端测试与真实HTTP脚本；新增public ingress专项、Nginx IP配置/开关/两个command；更新README/API/P4报告/回滚。详见[公网调试说明](docs/wechat-public-ip-test.md)，[真实公网链路](docs/validation-records/p4.1-public-ip-20261102/public-trial/real-page-http.json)、[21项访问](docs/validation-records/p4.1-public-ip-20261102/cloud-access-security.json)、[16项入口](docs/validation-records/p4.1-public-ip-20261102/public-ingress-security.json)、[独立撤销](docs/validation-records/p4.1-public-ip-20261102/ingress-revoke-restore.json)、[保护](docs/validation-records/p4.1-public-ip-20261102/protection.json)、[上传状态](docs/validation-records/p4.1-public-ip-20261102/cli-upload-result.json)。

## P4.2 取消邀请码操作（2026-11-02）

- [ ] IN_PROGRESS 取消输入/开通入口，点击业务时自动建立临时测试会话；服务端显式测试开关，保留隔离和限额。
- [ ] TODO 自动化、真实公网AI/匹配及A保护回归、独立B部署与回退记录。
- [ ] TODO 文档与新包说明；用户已表示稍后自行上传，手机验收仍NOT_RUN。

用户本轮明确授权取消邀请限制，覆盖之前必须持邀请资格的要求。服务器无法验证微信开发调试状态，免邀请入口同样可被其他互联网客户端申请，只用于公开/合成图片；保留临时随机会话用于照片隔离，不将它宣传为微信身份认证。release不开放，不修改模型、人体、图谱、匹配或放置规则。

### P4.2 实施结果（2026-11-02，追加）

**免邀请码代码及云端部署DONE；用户稍后自行上传新包，真机NOT_RUN。** 不将手机开发调试当作服务端身份，也不以公开固定共享key代替邀请码。

- [x] DONE 首页开通入口/输入框移除；计算/上传自动POST access/session空JSON取得内存临时会话，单次在途、缓存/固定1小时到期后自动新建；旧返回/401隔离，失败只在用户重试时再连。服务错误改为“连接失效请重试”，不再要求用户去不存在的开通入口。隐私确认继续保留。
- [x] DONE 后端仅controlled且ENABLE_PUBLIC_TEST_ACCESS=1允许公共测试会话，默认关闭、production拒绝；服务器随机principal、摘要存储，最多16有效会话。其他业务仍需自动Bearer，照片继续owner+photo key隔离。4KiB/10次每分钟开通（与旧交换共享）、原Nginx/后端限流、10MiB/3MP/30分钟TTL/单推理/CPU内存硬限制不变。旧邀请交换仅留回退兼容，前端不再调用；原生成邀请脚本已不需要。
- [x] DONE 真实语义明确：其他互联网客户端也可申请测试会话，不能保证只有微信或已开开发调试的手机访问。测试令牌用于隔离，不是邀请资格或微信身份验证；仍仅公开/合成照片，HTTP不加密。release/未知前端能力保持关闭。
- [x] DONE 最终前端298通过、TypeScript/项目静态检查通过；Python180通过、7条既有源警告。新增默认/production关闭、容量/到期/持久化/撤销、拒绝env/debug身份伪装、owner/请求体/Origin/限流测试；前端无弹窗/无开通入口、单次自动连接、过期、迟到、空/坏响应与失败重试通过。原几何/模型逻辑不改。
- [x] DONE 23项真实公网检查，无邀请码或管理员key：自动会话、匿名业务401、Origin403、坏输入/超限413/422、合法上传、两guest owner隔离、删除/撤销。随后实际页面及wx/Canvas适配器完整链路：0次邀请码输入，自动测试会话、公开CDC21505上传、两次真实MobileSAM各3候选、确认、背面70%/25度贴片、V2与手工共存、两次匹配/编辑重算/清照片仍计算通过。10片12孔770顶点保留；分割HTTP6.422秒含冷加载/3.311秒、匹配328.7/347.6ms。不是原生手机验收或医学准确率。
- [x] DONE 部署前明确清单/回退，root私有B备份p42-no-invitation-20261102；仅更新3个鉴权Python、B回退文档及94文件清单，设置B免邀请开关后只重启B。Nginx/A/模型/依赖/人体/图谱/匹配/放置/V2/V4核心未改；新B PID3980765，A与Nginx身份不变。完整94运行文件本机/服务器匹配，包内无私有凭据。
- [x] DONE A保护253轮health/ready无失败，无保护停止；原7文件（含B公网Nginx）哈希不变，OOM/swap页计数不增。临时监测已停，A/B/Nginx继续active；本轮测试照片与访问均已取消/撤销。公网入口仍开启，可用既有关闭command单独撤销。
- [x] DONE 准备失败保留：首次只允许3个代码文件的清单断言发现此前本机回退文档变更，未改服务器业务；随后助手因计划文件不存在停止于临时监测阶段。补充明确4文件计划后备份/暂存/部署成功，未用整体同步覆盖未知文件。未提交/推送Git。
- [ ] TODO 用户稍后用当前代码上传，建议版本0.5.4-open.20261102并设体验版。前次0.5.4-ip的旧代码/旧体验版不会自动取消邀请码；本轮不擅自替用户上传。
- [ ] NOT_RUN 新体验版手机开发调试、相册/拍照权限、两种网络和真实触摸全流程；自动化与公网适配器不冒充真机。

修改backend/services/access、trial_access和api/routes/access；miniprogram/services/trial-access、api、ai，index.ts/wxml及AI隐私；后端/前端鉴权测试、真实HTTP链路脚本，新增test_public_test_access.py；更新README/API/privacy、回退、manifest、旧P4.1追加覆盖说明。报告：[免邀请码测试](docs/wechat-public-test-access.md)；证据：[23项公网](docs/validation-records/p4.2-no-invitation-20261102/public-test-access.json)、[真实全流程](docs/validation-records/p4.2-no-invitation-20261102/public-flow/real-page-http.json)、[部署](docs/validation-records/p4.2-no-invitation-20261102/deployment-result.json)、[原服务保护](docs/validation-records/p4.2-no-invitation-20261102/protection.json)、[完整性与清理](docs/validation-records/p4.2-no-invitation-20261102/integrity-cleanup.json)。

## 论文级技术审计与资料包（2026-11-02）

- [ ] IN_PROGRESS 以当前代码/真实记录审计图谱、AI、坐标、匹配、前后端与部署，生成 docs/paper-technical-report。仅文档、图表与只读分析脚本；不改业务/模型/图谱/生产服务，不运行训练或患者处理。
- [ ] TODO 完整标签清单、证据与校验值、来源核验、图表实渲染及一致性检查；分开记录工程与医学/手机验证。

### 论文级技术审计交付完成（2026-11-02，承接上方 IN_PROGRESS）

- [x] DONE：生成 `docs/paper-technical-report/` 主报告、十章中文专项资料、完整35标签/114实例清单与CSV、30项证据索引、源码/模型指纹、复现说明及研究缺口。明确工程A、目标级未验证B和建议C；不升级图谱医审。
- [x] DONE：9张可编辑Mermaid架构/算法图及PNG/SVG（18项导出成功），逐图查看复核；既有公开图片实验预览按原字节纳入资料包并保留来源/许可。首次CLI参数和浏览器启动失败已记录，修正后成功，未冒充一次通过。
- [x] DONE：本次前端298 passed/0 failed、typecheck exit0；Python180 passed/7 warnings（12.73s）；图谱完整只读check、sync_atlas --check、sync_matching_body --check通过；独立Shapely 1341个几何案例一致。具体命令与日志在包内audit。
- [x] DONE：本次只读SSH核验腾讯云Ubuntu24.04.4/4逻辑CPU/3.64GiB，针灸与dermatome及Nginx active、loopback监听与健康正常；未修改或重启服务器。当前B入口仍HTTP测试通道，不用于患者。
- [x] DONE：任务前后295个受保护文件内容一致，无新增核心文件；权重SHA符合固定模型。仅新增文档、图表、文档目录内只读统计/检查脚本，并追加本台账；未提交Git、未训练、未新推理、未压测、未更改人体/图谱/匹配/业务。
- [x] DONE：本包链接、图数、标签、哈希与交付清单校验，结果见 `docs/paper-technical-report/audit/delivery-check.json`。
- 证据限制：3张公开照片中21505/21506为同一病例，另2张合成图；无专家真值、独立临床测试、医学审核或操作者对照。当前体验版上传及手机闭环NOT_RUN。未导出PDF/DOCX，Markdown为完整主文件。
- 后续仅建议：优先补专家病灶真值对照、独立图谱/参考对应审核、多操作者放置一致性和易用性研究；本轮不执行这些研究或新功能。

### 论文技术资料主文件中文命名（2026-11-02）

- [x] DONE：按用户要求，将资料包顶层14个主文件（阅读指南、10章正文、清单、CSV、证据索引）改成中文名；入口为 [阅读指南](docs/paper-technical-report/阅读指南.md)，主报告为 [系统技术报告](docs/paper-technical-report/01-系统技术报告.md)。
- [x] DONE：同步包内链接、文档生成/检查脚本及交付摘要；改名前后映射见 `docs/paper-technical-report/audit/chinese-filename-map.json`。图表源、原始测试日志与项目代码文件名保持原有用途。
- 验证：运行文档统计与交付检查，确认主文件存在、内部链接和图表引用有效、295个受保护文件无变化；结果见包内 `audit/delivery-check.json`。此次仅命名与链接调整，无需重跑业务测试。

## P5 全链路性能审计（2026-11-03）

- [ ] IN_PROGRESS 复核 A～I 实际调用路径；新增独立、默认不参与产品运行的测量脚本，采集本机基线和云端低负载证据。
- [ ] TODO 分级报告瓶颈、待验证项及最小优化计划；不修改模型、图谱、匹配或生产资源限制。
- [ ] NOT_RUN 当前微信/真机帧数据待检查；Node 命令适配器与本机 CPU 结果不能代替手机或云端耗时。

### P5 审计交付（2026-11-03，追加）

- [x] DONE 当前 A～I 调用路径/缓存/数据桥接/生命周期/模型/匹配/云端资源审计。交付[中文性能报告阅读指南](docs/performance-audit/阅读指南.md)及9篇专题、独立脚本和原始证据；不进入优化实施。
- [x] DONE Node生产模块与wx/Canvas命令适配器：全新会话10场景×3次放置（单片、多片5孔、10/100/500/2000顶点、三宽、退出）、19个body场景含10次重入；照片120触摸×9场景。帧和原生桥接不由这些数字推断。
- [x] DONE 本机匹配单片/5对象各10次；MobileSAM 3次新进程加载、12次真实CPU推理（同一合法公开CDC21505）。证实放置完整校验、coverage重复整图union、同crop重编码三个计算热点；不得删除孔洞/小片或跳过最终校验。
- [x] DONE 已有腾讯云只读巡检及3次串行合成匹配/2次公开图AI请求：200、3候选；A每次前后health/ready200，A/B/Nginx PID不变、NRestarts0、OOM增量0。本次照片删除/访问撤销204。未修改配置/配额/服务/入口或读取秘密。
- [x] PASSED 类型检查；前端298通过，backend+ai 180通过/7条既有依赖警告；原Canvas缓存检查通过。161个受保护业务/数据/资源文件哈希0变化。未提交/推送Git。
- [x] DONE 依据实际计时输出A确认/B可疑/C理论清单、P1/P2及前三项最小优化/测试/回滚；没有确认的P0事故，没有宣称任何提速倍数。
- [ ] NOT_RUN 手机完整流程/移动网络/原生画布与长期Native内存；真实FPS、首屏、图像解码、桥接、生产分段网络/推理计时NOT_MEASURED。微信界面读取成功但点击调试面板报noWindowsAvailable，未生成原生性能轨迹。

关键最终基线：M4 Node2000顶点五片五孔松手206.92–212.94ms、确认233.40–239.73ms；连续移动0完整几何校验。M4本机5对象匹配中位165.08ms，其中重复图谱union约129ms。云端匹配208.30–332.33ms、AI3199.26/3217.47ms；本机热AI512.84–588.61ms不可代替云端。B限流观察窗增8.848ms，不能断言CPUQuota是主因。

本轮实际新增文件仅docs/performance-audit/及此台账追加。测量失败与修正保存在[复现记录](docs/performance-audit/09-测量方法与复现记录.md)，包括错误健康路径、测量器release门禁/clear/语法及初始累计会话；最终以isolated和final证据为准。下一轮建议先做完整人体校验等价加速、请求内整图并集复用，embedding缓存需另验证失效与容量。本轮停止在审计交付。

### P5 无人值守交付复核（2026-11-03）

- [x] DONE 用户重发P5附件并要求无需人工确认。逐字核对与上一份任务一致，无新增优化/部署授权；不重复执行已通过的推理、云端请求或测试。
- [x] PASSED 10份中文报告及链接完整，必要JSON证据可解析，原始类型检查/298项前端/180项Python日志保留；161个受保护文件仍与审计基线一致。
- [x] DONE 未发起人工确认请求，未操作生产服务器、重启服务、修改业务、提交或推送。复核记录：[无人值守交付复核](docs/performance-audit/evidence/unattended-delivery-recheck.json)。本次为完整性检查，不是新的性能测量。
- [ ] NOT_RUN 真机全链路；原生帧率/渲染时延NOT_MEASURED，保留原具体原因，不以重复静态检查替代。无需等待用户在电脑旁操作即可交付现有审计成果。

## P6 第一轮性能优化（2026-11-03）

- [ ] **IN_PROGRESS**：复现 P5 基线后，等价加速人体边界校验及请求内图谱并集复用。最终确认仍全量验证；不部署、不修改模型、图谱或匹配规则。AI 编码缓存与照片查询仅设计评估。
- 实际结果与证据待本轮执行后追加；此前 P5 报告和原始数据保留。用户离开电脑，本轮不发起确认或人工验收请求。

### P6 实施交付（2026-11-03，追加）

- [x] **DONE** P6 本地代码与自动验收：仅修改 `miniprogram/utils/annotation-geometry.ts` 和 `backend/app/services/dermatome_matcher.py`。不可变人体环64桶保守边索引；每请求每视图完整图谱union一次。没有合法性结论缓存，最终提交仍完整重算和验证。
- [x] **DONE** 基线和证据保存：原三份源码及207文件SHA清单；旧P5全部报告/证据保持。10场景×3轮前后；2000顶点5片5孔21轮/版本（首轮预热、正式20轮）；7组后端21对/组共294次本地串行计时。一次被测试并行干扰的初始基线保留并明确排除，已独立重跑。
- [x] **PASSED** 本轮真实回归：TS；前端303；后端+AI197（7条既有依赖警告）；2421手工几何oracle；1341放置oracle及同1341冻结索引路径oracle；图谱5+6项、来源/绑定/副本哈希/人体导出、Canvas计数。新增5项前端差分（408完整场景等）和17项后端差分/复用检查均通过，几何及完整响应零容差相等。
- [x] **DONE** 性能：本机JS 2000顶点多片松手P50 208.23→26.26ms，确认230.74→46.00ms；同机Python 5对象总计（图谱加载+匹配+序列化）171.87→59.56ms，完整图谱并集6→1次。详细P95/最大值、分段和内存见[中文实施报告](docs/performance-audit/10-第一轮性能优化结果.md)和[新测量汇总](docs/performance-audit/p6/evidence/summary.json)。不等同手机/云端延迟或FPS。
- [x] **DONE** AI编码缓存仅评估：一次合成图真实CPU推理观测到特征 `[1,256,64,64]` float32、4MiB，推理后原reset正常。记录会话隔离、内容/crop/版本键、TTL/LRU预算和Linux峰值RSS待测；没有缓存实现。照片Canvas冗余查询仅P2设计记录，未改代码。
- [x] **DONE** 无人值守约束：没有发起用户确认，没有连接或变更生产、Nginx、配额、鉴权、上传规则、模型、人体图谱和针灸服务，没有Git提交/推送、没有新体验版上传。161个P5受保护文件中仅上述2个授权源码变化。现有云端/体验版不会自动获得本地改动。
- [ ] **NOT_RUN** 微信原生性能和手机完整流程：本次工具能读Shingles首页，但调试器元素失效，按实际截图点击仍报`noWindowsAvailable`。保留[实际尝试](docs/performance-audit/p6/evidence/wechat-attempt.json)，不请求用户恢复窗口或解锁。长期原生内存、帧/闪烁/漂移、云端优化后耗时未验证。

本轮完成范围：P0人体几何等价加速＋P1请求内图谱union复用、本地回归及报告。回滚源文件/哈希/命令见实施报告；无数据迁移。P6到此停止，不进入AI缓存、Canvas重构或生产发布。

## V6.1 独立手掌视图（2026-11-04）

- [ ] **IN_PROGRESS**：检查全身 front/back 强绑定，新增左右掌侧局部视图、独立坐标/会话及紧凑入口，复用现有标注校验与 V4 匹配算法。
- [ ] **IN_PROGRESS**：核实掌侧素材及脊神经皮节来源/商业派生许可；无可靠完整边界时明确阻止面积匹配，不以典型检查点或外周神经分区代替。
- [ ] **TODO**：类型/接口兼容、回归、真实微信可执行验证及文档；不开发其他特殊部位，不部署、不提交Git。

### V6.1 本地实施交付（2026-11-04，追加真实状态）

- [x] **DONE V6.1.1**：人体选择页紧凑“特殊部位”→左右掌侧独立页；PalmView/模板注册、坐标与会话隔离，返回全身保留原正背选择和标注。没有其他特殊部位空入口。
- [x] **DONE V6.1.2 展示资源**：实际查看候选后采用公有领域Gray1237.svg真实外缘/掌纹，去骨骼血管文字、截腕、同源镜像；440×700、880×1400 PNG、每侧366闭环坐标；源文件/许可/哈希/复现脚本保留。左右拇指方向、22人工参考点及PNG轮廓抽样通过。
- [ ] **BLOCKED V6.1.2 医学边界 / V6.1.3 真实匹配**：指定资料为感觉点、许可受限、非所需神经体系或合并标签，未取得可合法商业派生且可核实的完整掌侧脊神经皮节边界。正式掌图谱0标签/0区域，无虚构配准或C6/C7/C8几何；pending和mappingEnabled=false保留。前端禁算，后端409 ATLAS_NOT_READY，不返回伪成功空匹配。
- [x] **DONE V6.1.3 工程接入**：复用V2人工动作与完整皮肤包含、V4接口/响应核对/Shapely数学、P6边索引与请求内并集；独立掌会话保存view/template/atlas/完整MultiPolygon/manual来源；结果层技术路径用明确合成数据验证。修复异步touch会话revision及迟到匹配的保护。没有把手掌写入front/back统计。
- [x] **PASSED V6.1.4 自动验收**：TS；最终前端326/326；backend+AI237（7条既有依赖warning，含40掌专项），最终来源hash更新后掌专项40复测；原图谱5+6项；路径/来源/绑定/原人体和图谱副本/手掌生成一致性；166文件快照中63受保护文件0变化、0删除。既有匹配数学、人体/神经图谱、MobileSAM、V5放置与P6算法保持。
- [ ] **NOT_RUN 微信原生与手机验收**：实际尝试读到旧Shingles首页，但编译元素invalid ID且截图与窗口不一致，未可靠操作新页面。不把Node适配器或静态预览当真机。没有请求用户解锁/前台/人工测试；详细尝试留档。
- [ ] **TODO（后续另行授权）AI手掌放置**：V5当前全身模板强绑定，未强行重构或显示AI掌侧入口。本轮不做其他四处特殊部位。
- [x] **DONE 文档与停止范围**：README、architecture、atlas-spec、api、validation、references、新[V6.1说明](docs/v6-special-body-views.md)、[来源调查](docs/validation-records/v6.1-sources.md)和[验收报告](docs/validation-records/v6.1/report.md)更新。未部署/访问生产、未上传体验版、未提交或推送Git。当前体验版不会自动新增手掌功能。

结论：手掌显示/手工标注和技术接口已经实现，**完整V6.1验收未达成**，真实医学匹配受边界来源阻塞，原生交互待验证。没有以合成测试或典型检查点代替真实分区。后续先取得可核实且授权明确的掌侧边界与配准审核，再恢复真实匹配验收；本轮到此停止。

### V6.1 左右手掌纠正（2026-11-04）

- [x] **DONE** 用户指出左右相反，核实属实。撤销此前“原图图注左右不符”的判断；五指向上、掌心面向观察者，左掌拇指在画面左、右掌在右。原始Gray1237.png明确左掌，未镜像SVG应为左掌。
- [x] **DONE** 同步修正左右PNG/SVG、完整命中轮廓、生成脚本/矩阵/来源字段、页脚提示和对比预览；保留错误旧版资源及哈希。当前文档更正，历史来源及验收记录加撤销提示。
- [x] **DONE** 模板版本1.1.0、geometry v2、regionSet v2、atlas preview.2，前后端身份及内容哈希同步。旧1.0.0会话明确拒绝，不自动换侧/镜像或覆盖历史标注。
- [x] **PASSED** 前端328、后端137；新增左右源图/PNG/命中一致与旧模板会话/HTTP拒绝回归；22参考点/闭环/镜像及手掌/原人体/原图谱同步检查通过；63个原有受保护文件0变化。独立AI未重跑，不把上轮237写成本次通过数。
- [ ] **NOT_RUN** 微信原生复验；静态新预览已查看。没有部署或上传，现有手机体验版不自动获得本地修改。掌侧真实皮节边界仍BLOCKED。

修正原因、修改范围、真实日志及旧版回退材料见[左右纠正记录](docs/validation-records/v6.1-side-fix/report.md)。上轮自动化通过不等于左右解剖验证通过，现以该更正为准。

### V6.1 重发任务续查（2026-11-04）

- [ ] IN_PROGRESS 本次附件与上一版逐字一致，承接左右修正后的1.1.0，不重新初始化。继续原生操作验证及边界来源调查。
- [x] DONE 新找到 Servier 官方 CC BY 4.0 皮节图，已查看 PNG 及原始 PPTX 曲线；正在评估是否能可靠配准，尚未据此启用匹配或改变医学审核状态。

### V6.1 Servier真实边界接入交付（2026-11-04，承接重发续查）

- [x] **DONE V6.1.2来源**：实际查看Servier官网PNG及官方PPTX，第26页掌侧原始曲线可编辑；官方CC BY 4.0明确商业派生和移动应用。补齐原文件/哈希/署名。此前边界缺失阻塞由新证据解除，旧调查和失败保留。
- [x] **DONE V6.1.2/3本地参考接入**：C6/C7/C8共3标签、左右各3区共6实例；preview.2→preview.3。6个指蹼/腕口控制点配准原始曲线，右侧注册后镜像左侧；没有按指头或三等分造边界，没有增加T1。手掌模板仍1.1.0、geometry v2，原手形/皮肤轮廓不变。medicalReviewStatus=pending、mappingEnabled=false，正式门禁未开放。
- [x] **DONE 工程真实性**：两次整手配准越界失败保留；最终仅掌部控制曲线越界0、无自交、严格人体内包含、无内部面积重叠。修复源描边交接及浮点换算尾差，未裁掉失败曲线、未内缩区域、未放宽校验或改变匹配公式。生成器默认只读检查，旧preview.2和旧当前文档已备份。
- [x] **PASSED 自动验收**：前端328/0失败；backend+AI256/7条既有依赖警告；新增18项来源配准测试（8个预先人工参考点×2侧，加分区/镜像、来源/医审保护）。原未就绪/空图谱拒绝、合成多片/孔洞/跨区/未覆盖/接触/去重/版本/环境门禁测试继续保留。可重现生成、手掌/全身/图谱同步、九页项目检查5项exit0。
- [x] **PASSED 原生部分观察**：工具实际切换左右掌，计数分别0/1；看到修正后左拇指左/右拇指右；右掌原有三角形放大、复位后位置保留。原有标注未删除或重写。这些原生检查发生在新Servier图谱写入前。
- [ ] **NOT_RUN 新图谱原生闭环/手机**：坐标点击仍noWindowsAvailable，未新增顶点、闭合；新图谱计算/全部高亮/单标签/跨屏/手机未验证，不将静态6区预览或TestClient冒充原生链路。
- [x] **DONE 保护与停止范围**：232个运行文件快照中仅7个授权掌侧图谱/注册文件改变，225个不变、0删除；无全身人体/图谱/AI/放置/P6数学修改。未访问生产、未部署、未上传体验版、未提交/推送Git。手机旧包/服务器不自动获得新功能。
- [ ] **TODO后续**：专业图谱配准审核、新前后端版本发布及真实微信闭环另行执行；AI手掌放置仍未实现；不开发手背/足底/腋下/大腿内侧/会阴。

当前结论：本地代码已具备有真实来源的手掌人工标注→参考匹配，解除“无来源空图谱”的工程阻塞；**完整微信验收与医学审核仍未完成**。报告与命令：[续查交付](docs/validation-records/v6.1-recheck/report.md)；原始日志frontend.txt/backend-ai.txt；5项检查checks.json；保护摘要delivery-check.json；原生操作范围wechat-attempt.json。本轮在此停止。

### V6.3 Goran完整性审计（2026-11-05）

- [ ] IN_PROGRESS：核验官方版本、原始SVG及手掌/足底观察面，比较现行114区和Servier掌图谱；只生成独立审计脚本、证据与报告，不改生产数据、不部署。

### V6.3 Goran完整性审计交付（2026-11-05，结束本轮审计）

- [x] **DONE 来源实查**：官方22个男女/标签/无标签/站立/横向版本全部取得原始SVG，记录文件页、作者Goran_tek-en、2022-09-24上传版本、SHA-256、尺寸、图层和CC BY-SA 4.0。用户指定五份均实际解析/渲染；有/无标签及母版8组填充几何比对通过。DNS限制、HTTP429和间隔后成功补取均保留记录。
- [x] **DONE 主图逐路径审计**：正面42/背面50填色Path，其中主图35/43、头侧插图各7。35个明确标签（29独立脊神经、3组合、3三叉感觉），尾骨处源字样C1单列UNKNOWN，不擅改Co1。现图谱仍35标签/114实例，前54后60、134片/17孔。完全未导出的主图Path前5/后10，并列出部分裁切与目标表面排除，非单纯前端显示遗漏。
- [x] **DONE 手掌结论**：实际看到正面掌心/五指掌侧、背面指甲/指背。前p29/30为C6–8、p31为C8/T1，缺完整独立C6/C7/C8掌侧分界；隐藏线稿、组合和女性版本未补足该信息。不能用配准创造医学边界；继续保留Servier独立掌图谱。
- [x] **DONE 足底结论**：背面原图确实存在足底、跟垫、前足及趾腹示意，p43=L5、p44=S1；p36/L4、p49/S2是踝端邻接范围。现图谱未采用源足底的原因是y842截止及目标后跟观察面不符，不是Goran没有足底。建议下一轮优先调查独立足底模板和局部配准，未开始实施。
- [x] **DONE 证据报告**：新增docs/goran-full-atlas-audit/的README、9章专项、NOTICE、22原件、完整来源/文字/引线/Path/区域差异JSON与CSV、41组SVG/PNG及22版总览。实际查看手掌、足部、全身覆盖、源/Servier/Gray对照与隐藏层；全部为离线证据，非微信截图。Goran和Servier来源许可分别标记。
- [x] **PASSED 本轮检查**：审计8项、SVG几何5项、V3.1扩展6项，共19项自动测试；8组版本几何对照；Goran/手掌/人体3项只读同步；check_preview_atlas.check()只读技术校验。首次系统python3人体检查因缺Shapely失败，换既有ai/.venv后通过，失败日志保留；未安装依赖。没有执行会写生产validation.json的主入口。
- [x] **PASSED 修改保护**：260个受保护运行/数据/脚本文件SHA-256无变化、无删除；本轮新增审计目录并追加本台账。未改生产atlas、Servier数据、模板、病灶、V4匹配公式/审核状态；未访问服务器、部署、上传微信或提交/推送Git。
- [ ] **NOT_RUN（不属本轮验收）**：临床/专业配准审核、手机/微信运行、云端测试、完整V1～V6回归；不把历史328/256等测试数写成本轮通过数。

总体建议：方案B（Goran为全身主源、分表面补充）；掌侧采取C继续Servier；足底局部A有条件可行。腋下、完整大腿内侧及会阴下方仍需相应观察面。审计DONE，**图谱替换/足底开发未实施**。报告：[V6.3总报告](docs/goran-full-atlas-audit/README.md)；检查：[保护结果](docs/goran-full-atlas-audit/evidence/delivery-check.json)、evidence/test-*.log、unlabeled-comparison.log。到此停止。


## V6.4 Goran 独立足底（2026-11-05）

状态：IN_PROGRESS。复核背面实际源路径、建立独立 sole-left/sole-right 模板与参考图谱，复用手动标注与 V4/P6 匹配。保持全身/Servier 手掌数据；不实现足底 AI、不部署、不上传。医学审核保持 pending。


### V6.4 本地实现交付（2026-11-05）

- [x] **DONE 源图复核**：固定Goran背面原件SHA1，实际元素路由/d SHA256/父矩阵/引线关联确认L5 p43、S1 p44；扫描50个着色Path及绘制顺序，无原clip/mask/use。S2邻踝极窄接缝两片明确unconfigured，L4仅数值残余；不补造其他足底皮节。
- [x] **DONE 独立模型/图谱**：sole-left、sole-right；template goran-sole-v1/1.0.0，geometry goran-plantar-outline-v1，atlas goran-sole-preview.1，4个L5/S1实例。原侧分别提取、旋转180°、等比5.6、320×640逻辑/640×1280PNG；左大趾左、右大趾右，无镜像。原曲线、孔洞和小片保留，左/右显示皮肤约0.102%/0.081%未配置，隐面不外推。CC BY-SA 4.0署名及修改说明齐全，医学审核pending、mappingEnabled=false。
- [x] **DONE 流程复用**：特殊部位入口新增左右脚底；原局部页/Canvas/权威会话按四view隔离，沿用V2手工圈选/多片/撤销/删除/完整皮肤检查/放大复位、V4真实接口及单区/全部高亮。请求/响应显式支持两新view，模板/图谱/哈希/迟到响应保护保留，不混入全身或手掌面积。
- [x] **PASSED 本轮自动化**：TS；前端336/0失败（新增8）；后端+AI283/0失败（新增27足底项，7条既有依赖警告）；实际FastAPI四局部视图200及页面→真实接口适配联动；曲线0.02/0.01对照、PNG轮廓10944个非边缘抽样、足底生成和原掌/全身/人体同步通过。旧失败与测试初稿修正日志保留，不引用历史通过数。
- [x] **PASSED 回归/性能/保护**：68个原有资源/图谱/核心算法文件SHA256不变、0删除；V4/P6数学、坐标、V5变换未改。全身三场景各20对同机交替计时/完整响应相等，未见明显退化，详情performance.json；新足底与手掌本地计时有记录，不宣称固定帧率或云性能。
- [ ] **NOT_RUN 微信/手机完整验收**：编译点击返回invalid element ID，截图为不可读窗口过渡画面；静态资源不是运行截图，未宣称真实触摸、手机或微信完整闭环通过。
- [ ] **PENDING 医学审核**：足底观察面、源近端截取、S2邻踝接缝、五趾隐面、个体皮节差异和教学适用性仍需专业审查。
- [x] **DONE 文档与停止范围**：[V6.4开发报告](docs/validation-records/v6.4/开发报告.md)、来源/原路径/覆盖/误差/许可/测试/实际预览与日志齐全；README、architecture、atlas-spec、api及局部视图说明更新。不做AI足底、不开发下一部位、不访问/部署生产、不上传微信、不提交或推送Git。

结论：**V6.4本地工程与技术验证完成，原生微信/手机及医学验收未完成**。现有服务器和体验版未更新；不能将本地测试说成手机已经可用。


## V6.5 主人体手部补全与独立手掌退役（2026-11-05）

- [ ] **IN_PROGRESS**：复核真实 Goran 手部源路径、局部配准到现有全身模板；建立新图谱版本；移除独立手掌业务并保留足底通用能力。保留旧数据及历史来源，不自动迁移；不部署、不上传、不修改匹配公式或人体素材。


## V6.5 本轮收尾（2026-11-05，覆盖本轮开工IN_PROGRESS状态）

- [x] DONE — 本地实现：主人体正面掌侧/背面手背补全，独立掌运行功能退役，保留独立足底。未部署、未上传、未提交Git。
- 真实问题：旧提取流程排除front p29/30/31、遗漏背面指背Path并截断源手面；旧栅格有效轮廓填实部分指缝。不是人体图片缺手、不是前后面或高亮返回值错误。
- 模板/图谱：图片与400×900坐标不变；有效指缝修正绑定4.0.1 / commons-blank-cc0-hands-v2；图谱preview.3新增22实例，旧114区坐标逐项不动，旧版本保留。高亮与计算使用同一份新几何、同一原V4公式与P6复用。组合C6–8/C8/T1不拆分，医审pending、mappingEnabled=false保持。
- 退役：旧palm页/Canvas/状态/资源/后端专用加载器移出运行，通用脚底组件迁至local-surface。旧视图或图谱请求410 VIEW_RETIRED，无front/back坐标迁移。原模块仅内存会话，没有删除持久化用户记录。历史源文件/图谱/代码归档保留。
- 实测：前端335通过；后端+AI280通过（7条既有模型注册警告）；源解析11通过；类型检查、源生成复现、图谱/人体哈希、足底只读复现、静态工程检查通过。初版参考点和检查器数值失败均保留，修正理由见测试记录，未掩盖部分覆盖点。
- 非手部10片/两视图数值等价通过；实际四手跨区请求/响应已留存。新几何复杂度增加，20轮同机匹配中位62.182→113.825ms，不能宣称无性能退化；未削减源曲线/孔洞换速度。完整性能与Node绘制调度数据见evidence。
- [ ] TODO — 微信本轮编译/导航/手部交互/脚底UI/真机性能：NOT_RUN，窗口工具invalid element与截图状态不一致；不把静态图冒充微信证据。
- [ ] TODO — 医学专家审核四手配准、五指细节、组合标签与腕部过渡。源细缝/隐藏表面仍未覆盖，不自行补全。
- [ ] TODO — 后续获授权再同步部署新图谱与前后端版本；当前新客户端连接旧云端应409。本轮不执行。
- 报告：[开发与前后对照](docs/validation-records/v6.5-main-body-hand/report.md)、[源路径](docs/validation-records/v6.5-main-body-hand/source-path-audit.md)、[配准](docs/validation-records/v6.5-main-body-hand/atlas-registration.md)、[退役策略](docs/validation-records/v6.5-main-body-hand/removed-palm-feature.md)、[实际测试](docs/validation-records/v6.5-main-body-hand/tests.md)。计划与实际范围均仅主人体手部+独立掌退役，其他特殊部位不开展。


## V6.5 后端版本冲突修复（2026-11-05）

- [ ] IN_PROGRESS：用户报告版本冲突；已实测本机与腾讯云当前新身份请求均409。承接本轮故障修复，恢复本机并准备B后端匹配所需版本同步。保持模型、AI实现、鉴权、Nginx和针灸服务不变；备份/校验后仅重启B。记录于docs/validation-records/v6.5-backend-sync/。


### V6.5 后端版本冲突修复完成（2026-11-05）

- [x] DONE：核实本机旧进程缓存旧图谱、云端仍4.0.0/preview.2，两端实际新版evaluate均409。已重启本机开发后端；已备份/暂存验证并同步云端B的匹配所需版本，仅重启dermatome。用户本次故障修复承接并完成后端同步，覆盖上一轮“未部署”现状。
- [x] PASSED：两端ready/evaluate200，绑定4.0.1/hands-v2/preview.3；真实HTTP28检查通过，含四手跨区、左右脚底、401、旧身份409和退役掌410；临时测试会话已撤销。云端117文件摘要一致；未跳过版本校验。
- [x] PASSED保护：针灸PID611289、Nginx PID12643和启动时间不变，针灸本机health/ready及HTTPS health均200。AI权重/实现、服务资源/上传/鉴权配置、Nginx与针灸代码不改。
- [ ] NOT_RUN：手机/微信界面、旧体验版上传、实际MobileSAM再次推理；不把HTTP验证说成真机验收。旧客户端仍需要对应新包，不能跨身份计算。
- 证据：[修复记录](docs/validation-records/v6.5-backend-sync/report.md)、before/after.json、smoke.json、plan.json、apply.log、server-verification.json。备份B deployment/backups/v65-hand-20261105，可独立回退；无Git提交推送。


## V6.5 结果标签文字不可见（2026-11-05）

- [ ] IN_PROGRESS：实际SDK确认v2 `wx-button:not([size=mini])`默认184px宽度压过单class标签样式，66px脚底侧栏裁掉居中文字。已修复局部/全身标签样式优先级，名称和覆盖率数据、图谱及后端不改；正在验证。


### V6.5 标签文字修复收尾（2026-11-05）

- [x] DONE：安装SDK证实v2默认184px按钮宽度覆盖单class标签宽度，66px侧栏把居中文字裁掉。足底改为两级作用域选择器/100%宽度/44px高度，全身同类选择器同步修正；实际label/name/ratio数据及后端不改。
- [x] PASSED：前端335/0失败、TS；微信自带wcc/wcsc编译两个页面均exit0，证据见[修复记录](docs/validation-records/v6.5-label-visibility/report.md)。修改前副本、SDK规则/摘要、实际日志保留。
- [ ] NOT_RUN：微信/手机真实视觉复测，自动编译点击invalid element；未把编译器或Node测试说成原生验收。需要重新编译前端，旧体验包需新上传。
- 无图谱、人体、标注、匹配公式、后端或服务器修改；未上传、未提交Git。


## V6.6 左右腋下独立视图（2026-11-05）

- [ ] IN_PROGRESS：复核局部视图架构与医学/素材来源；独立抬臂模板、手动标注、可靠边界准入。没有依据的皮节保持 ATLAS_NOT_READY；不部署、不上传、不改现有全身/手部/足底图谱及 P6 公式。
- 工作区全部为既有未跟踪文件，未清理或重置；保护文件摘要保存于 docs/validation-records/v6.6-axilla/evidence/protected-before.json。

### V6.6 本轮收尾（2026-11-05，取代本轮IN_PROGRESS）

- [x] DONE — 可安全实施的本地工程：特殊部位新增axilla-left/right，显式registry、两个400×360独立模板、V2多片圈选/撤销/删除/确认/放大复位、左右/脚底/全身会话隔离及返回入口。现有全身/手部/脚底、V4公式、P6校验和AI实现保持。
- [x] DONE — 显示素材许可核验：Roquex MaleArmpit1 CC0右腋下照片，描摹可见轮廓/褶线，左图镜像，SVG与透明PNG本地化；原图摘要/改编过程/弃用Thomson试稿保留。模板commons-axilla-v1/1.0.0、geometry cc0-raised-axilla-outline-v1。这是局部观察窗；完整肩部未包含，不能宣称完整医学插画视觉验收。
- [x] DONE — Goran原图9元素、T1/T2/T3/T1/T2标签及矩阵/d摘要重新审计；只存审计源坐标，未把垂臂边缘拉伸到抬臂隐藏面。NCBI/PMC/DermNet与其他源许可调查完成，未复制受限教材图。
- [ ] BLOCKED — 可靠抬臂皮节边界/配准：当前0个目标神经标签、0实例，axilla-reference-v1/axilla-unconfigured.1，医审pending、mappingEnabled=false。前端禁用计算，后端409 ATLAS_NOT_READY；中央、前后褶、近端内臂、胸侧均未配置，不能报假成功未覆盖比例。**V6.6完整神经匹配和高亮尚未验收完成**。
- [x] PASSED — 本轮真实前端348通过/0失败，后端+AI296通过/7条既有注册警告；腋下专项16通过，TS、微信自带wcc/wcsc、源10文件复现、Goran9元素复核、足底复现、全身136区检查通过。初测1个前端焦点期望和2个后端状态码期望失败保留，修正测试假设，未改既有公式。
- [x] PASSED — 50个保护文件摘要不变；同机各20轮真实请求：全身中位79.774→78.365ms、足底3.067→3.044ms，响应SHA完全一致。没有手机帧率结论。多片/孔洞完整几何校验通过；原手动UI无挖孔编辑器，不冒充新增孔洞编辑。
- [ ] TODO — 微信/手机运行、触摸/真实高亮和原生性能：NOT_RUN。CUA项目可读但点击invalid element，截图缩小倾斜无法可靠操作；编译器与静态预览不算运行截图。
- [ ] TODO — 医学/插画审核及更完整肩部素材；需有许可的抬臂参考区域和可验证跨姿态控制点，不自行推测边界。AI腋下放置未接入，V5仍仅全身。
- 执行边界：未触碰生产服务器、原针灸服务、权重/配额；未部署、未上传、未提交推送；未恢复独立掌，未开发会阴。原自动匹配功能仍按各自模板工作。
- 报告与证据：[报告](docs/validation-records/v6.6-axilla/report.md)、[来源许可](docs/validation-records/v6.6-axilla/source-review.md)、[解剖与源路径](docs/validation-records/v6.6-axilla/anatomy-and-atlas.md)、[配准限制](docs/validation-records/v6.6-axilla/registration.md)、[测试/失败/性能](docs/validation-records/v6.6-axilla/tests.md)。本轮停止于可安全交付的局部标注及显式阻塞，不进入下一特殊部位。

## V6.6.1 腋下医学审核材料准备（2026-11-05）

- [ ] IN_PROGRESS — 审查模板/肩部上下文、重核9个Goran实际源路径、分清皮节/感觉检查点/外周皮神经证据，生成左右审核图、观察区域、审核表与后续接入方案。所有草案仅在docs/validation-records/v6.6-axilla/medical-review/review-draft，不进入运行图谱，不启用计算，不改标注，不部署上传。

### V6.6.1 收尾（2026-11-05，取代本轮IN_PROGRESS）

- [x] DONE — 医学审核材料包：[审核材料说明](docs/validation-records/v6.6-axilla/medical-review/审核材料说明.md)。左右待审核PNG/SVG、9源路径逐项对照、模板改良取景方案、医学依据与许可清单、已知/不确定面、可填写审核表MD/CSV、400×360空边界勾画底板、空数据交接模板、后续V4接入方案已生成。
- [x] DONE — 确认现有来源不含完整肩/肘/胸壁定位标志，影响姿态定位；保留原模板制作审核版A，设计扩展取景候选B，B只是取景/标志规范，没有虚构新皮肤几何或替换当前版本。左右各5个观察窗口可重叠，均无神经标签，独立存放review-draft。
- [x] DONE — 重新定位Goran正面p1/p2/p3/p19/p20和背面p6/p7/p8/p41：原文件SHA1、XML route、d SHA256、evenodd填充、父矩阵、绘制顺序和原侧实例已复核。源曲线可复现，抬臂目标配准仍0条；保留T1/T2组合标签，不拆分或补绘隐藏腋底。
- [x] DONE — 医学资料区分皮节/关键感觉检查点/ICBN及其他外周皮神经。核实2019标准T1/T2/T3点定义；图上K2?仅提问符，确认坐标全部null。ASIA官网已列2026新版，但出版商全文403，不能宣称核实新版；已列入医生必审项。没有复制受限教材插图。
- [x] PASSED — 本轮重新执行腋下专项16通过（0.36s）；2次本地FastAPI TestClient左右请求均409 ATLAS_NOT_READY。7组材料检查通过：源几何、观察窗、空神经提交、4图渲染、文档链接及214个运行文件清单/摘要不变。详见[验证记录](docs/validation-records/v6.6-axilla/medical-review/验证记录.md)。未沿用上一轮通过数。
- [ ] BLOCKED — 正式腋下几何匹配仍缺逐侧可靠闭合边界、可见面配准、必要的模板补全及医学人员签署。当前0个目标区域、pending、mappingEnabled=false、ATLAS_NOT_READY均保留；医学审核NOT_RUN。材料准备完成不等于图谱构建完成。
- [ ] NOT_RUN — 微信/手机及全套运行回归（本轮无运行代码修改），未进行临床验证、部署、上传体验版或下一特殊部位开发。
- 修改边界：仅新增docs/validation-records/v6.6-axilla/medical-review及追加本task台账；现有人体/脚底/图谱/V4公式/标注/AI实现不变。未访问生产服务器，未提交或推送Git。本轮停止，待独立医学审核材料回传。

## V6.6.2 试验性腋下匹配（2026-11-05）
- [ ] IN_PROGRESS — 用户授权高不确定性局部近似配准；独立PROVISIONAL版本、保留旧空图谱、仅开发/体验参考；不部署、不更改原标注与匹配公式。

### V6.6.2 收尾（2026-11-05，取代本轮IN_PROGRESS）
- [x] DONE — 新增独立axilla-goran-provisional-v1/goran-axilla-provisional.1，保留旧axilla-reference-v1空图谱与ATLAS_NOT_READY。原侧Goran前p19 T1、p20 T2取近端可见片，逐侧3个估计点共享局部仿射；全部B类/HIGH/未医审，C延伸0。目标仅约6.2%皮肤，不补中央、胸壁或T3。
- [x] DONE — 当前腋下入口切换独立试验图谱，按钮“试验性参考匹配”、页面常驻提示、API source.PROVISIONAL/HIGH与客户端防丢状态守卫；开发/体验沿用统一能力，release关闭。复用V2/V4，原数据/素材/公式/P6不变，旧标注不自动换身份。
- [x] PASSED — 本轮前端350通过/0失败，后端+AI303通过/7条既有警告；新专项7已包含其中，TS、wcc/wcsc、旧腋下/脚底生成复现和全身136区检查通过。214保护文件中204不变，10个接入/合同/页面文件为授权修改，旧人体/所有旧atlas/V4数值模块不变。
- [x] DONE — 配准点/矩阵/原曲线出处、左右预览、未覆盖图、真实ASGI合成病灶匹配JSON、状态与许可、首次失败日志保留。见[本轮报告](docs/validation-records/v6.6-axilla/provisional-matching/report.md)、[测试](docs/validation-records/v6.6-axilla/provisional-matching/tests.md)。20轮同机中位全身79.811ms、足底3.133ms、新腋下1.239ms，历史不是同步配对基线，不宣称帧率或加速。
- [ ] NOT_RUN — 微信/手机实际圈选和高亮、医学审核、临床准确性；静态图/Node/ASGI不冒充原生验收。试验范围不代表完整腋窝，医学不确定性高。
- 执行边界：无生产服务器操作、无部署/上传、无提交推送、无会阴开发；本地试验性代码交付后停止。

## V6.6.2 云端后端同步（2026-11-05，用户后续明确授权）
- [x] DONE — 用户要求“更新后端”，覆盖此前不部署范围；核实云端缺腋下view/图谱后，备份、Linux暂存验证并更新18文件，仅重启dermatome。新PROVISIONAL/旧未就绪图谱均可识别，全身/足底原数据不变。
- [x] PASSED — 公网实际22项检查：左右T1/T2、新状态字段、未覆盖、旧空图谱409、主人体手部原响应、足底、鉴权401及旧版本409；临时测试会话最后撤销。证据[同步报告](docs/validation-records/v6.6-axilla/backend-sync/report.md)、smoke.json、plan.json、apply.log。
- [x] PASSED — 针灸和Nginx进程/启动时间/重启数与保护文件摘要不变，原健康/ready及HTTPS均200；未改模型/访问配置/端口，不安装依赖。备份保留B目录deployment/backups/v662-axilla-20261105-r2。首次暂存校验失败发生在停服务前，兼容旧manifest字段后成功，记录保留。
- [ ] NOT_RUN — 微信手机实际重试；本轮只更新后端，未上传体验版，旧客户端代码不自动更新。医学审核仍pending。

## V6.6.3 腋下全覆盖模拟（2026-11-05）
- [ ] IN_PROGRESS — 用户授权人工构建SCHEMATIC分区，独立版本，完整有效皮肤覆盖；保留旧provisional、医学pending和发布门禁；不部署、不上传。

### V6.6.3 收尾（2026-11-05，取代本轮IN_PROGRESS）
- [x] DONE — 独立axilla-schematic-v1/axilla-schematic.1，3个模拟标签、左右共6个Polygon片区。人工平滑Bezier裁切原皮肤，全状态SCHEMATIC/NOT_MEDICALLY_VALIDATED/INTERACTIVE_SIMULATION/ARTIFICIALLY_CONSTRUCTED，非Goran提取，不覆盖旧provisional。
- [x] PASSED — 左右有效皮肤覆盖均100.000000%（浮点报告精度），各16,357网格皮肤点0漏点；残余面积右2.406e-19、左1.220e-19，仅舍入，区域实际面积重叠0。原皮肤面积不改，未定区0实例。
- [x] DONE — 模拟区域匹配入口、模拟标签/结果页常驻提示、API来源状态和严格丢状态拒绝；复用V2/V4完整几何、左右隔离与单区/全部/修改重算；正式发布及鉴权门禁不变。
- [x] PASSED — 本轮前端351/0失败，后端AI311/7条既有警告，新专项8包含其中；TS、wcc/wcsc、原空腋下/脚底复现、全身136区检查通过。97项既有数据/AI/V4摘要不变。20轮本机中位全身82.337ms、脚底3.257ms、模拟腋下4.282ms，无手机帧率结论。
- [x] DONE — 7张SVG/PNG静态预览、真实ASGI多片合成请求与响应、覆盖/左右/内孔/版本/模拟状态测试及首次失败记录保留。见[报告](docs/validation-records/v6.6-axilla/full-simulation/report.md)、[测试](docs/validation-records/v6.6-axilla/full-simulation/regression-tests.md)。
- [ ] NOT_RUN — 微信/手机真实运行：读到Shingles，但AX编译无效元素、坐标编译noWindowsAvailable；旧PROVISIONAL截图不作为新验收。医学验证未执行；人工模拟不代表医学验证。
- 执行边界：未访问生产服务器、未部署/上传、未提交推送、未改原标注/全身/手部/脚底/权重/V4数值公式/P6源码，未恢复独立手掌，不进入会阴。当前云端仍上一版；本轮仅交付本地模拟代码后停止。

## V6.6.4 腋下模拟匹配部署与体验版联调（2026-11-06）

- [x] DONE — 本地图谱仍为 `axilla-schematic-v1 / axilla-schematic.1`，未重新生成。前端 351/351、后端与 AI 311/311、TypeScript、WCC/WCSC、全身/旧腋下/脚底检查通过。
- [x] DONE — 腾讯云白名单同步 10 个文件：5 个后端注册/状态文件和 5 个 SCHEMATIC 图谱文件；仅重启 dermatome。Linux 暂存验证为全身136、脚底4、旧PROVISIONAL 4、新SCHEMATIC 6区域。
- [x] PASSED — 首次暂存将左右合计6区误写成3区，在停止服务前安全失败；使用独立 r2 目录修正后成功。证据保留于 `deployment-v6.6.4/first-preflight-failure.txt`、plan.json、apply.log。
- [x] PASSED — 公网合成几何26项检查通过：左右T1/T2/T3、单片/三片、SCHEMATIC/未医审状态、鉴权、版本409、主人体手部和脚底回归。首次快速请求触发Nginx 5r/s限流，未改限流；按0.25秒间隔重跑通过。
- [x] PASSED保护 — 针灸 PID 611289、Nginx PID 12643、启动时间及 NRestarts 与部署前一致；保护摘要一致，针灸和原HTTPS健康/就绪均200。备份为 `/srv/dermatome-mapper/deployment/backups/v664-axilla-schematic-20261106-r2`。
- [ ] NOT_RUN — 微信体验版未上传。CLI 服务最终启动到 127.0.0.1:9420，但日志报 errcode 41001 / access_token missing，当前开发者工具账号需重新登录；CUA 窗口接口持续超时。尝试版本 `0.6.6-axilla.20261106`，未设置体验版。
- [ ] NOT_RUN — 手机左右腋下圈选、模拟匹配、高亮、单标签/全部和左右会话仍需登录后上传新体验版并真机验证。旧体验版不会自动获得本轮代码。
- 报告与证据：[V6.6.4部署记录](docs/validation-records/v6.6-axilla/deployment-v6.6.4/report.md)、smoke.json、upload-attempt.json、before/after.json。医学审核仍pending；模拟覆盖不是医学准确率。
