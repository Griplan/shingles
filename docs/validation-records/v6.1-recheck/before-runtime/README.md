# dermatome-mapper

**带状疱疹神经皮节辅助定位系统**

本地新增 **V6.1 左右手掌独立视图与人工标注**：进入人体模型 → 特殊部位 → 左/右手掌。真实掌侧皮节面积边界尚缺可靠来源，当前不能计算手掌参考节段；AI 手掌放置未实现。全身流程保持。详见 [手掌设计与限制](docs/v6-special-body-views.md)、[实际验收记录](docs/validation-records/v6.1/report.md)；唯一进度见 [task.md](task.md)。未部署或上传新的体验版。

**V1、V2已获用户验收；V5.4 现将 AI 分割后人工放置的人体轮廓接入同一 V4 参考图谱几何匹配。** 保留逐点草稿、撤销/取消、有效闭合、多片选择删除、独立正背面、运行内暂存和同页复核。历史未执行的实测项目继续保留；实际状态见 [task.md](task.md)。

继续使用 V1.3 的 [Human body with blank labels.svg](https://commons.wikimedia.org/wiki/File:Human_body_with_blank_labels.svg)（CC0）及独立正背面本地图片；模板保持 `commons-neutral-v1 / 4.0.0`。人体素材、归一化公式和同源整体命中轮廓未改变；16个UI区域修订为 `commons-blank-cc0-v1-ui-regions-2`，胸部/上背部与肩臂、颈腹边界同步，肩外侧归对应上肢。高亮和最终命中仍共用outline，bounds仅用于局部视野及预筛。说明与回退见[身体区域约定](docs/body-regions.md)。

[V1.3素材对比](docs/validation-records/v13-replacement-comparison-2026-10-22.png)、[实际正背面](docs/validation-records/v13-replacement-model-preview-2026-10-22.png)、[来源许可](miniprogram/assets/body/commons-cc0/NOTICE.md)保留。V1.6历史文件见[变更清单](docs/v16-changes.txt)，V2设计与实际差异见[集中计划](docs/v2-plan.md)。开发测试可显式启用参考几何匹配，正式医学映射仍禁用。此前[调查报告](docs/v13-material-review.md)及[替换清单](docs/v13-replacement-changes.txt)保留为历史。

面部/足部来源、配准、覆盖限制及复现见 [V3.1 图谱说明](docs/v3.1-atlas.md)。医学审核仍待完成，实际测试和验收以台账为准。

## 背景、目标与适用场景

项目计划通过标准人体模型、人工标注病灶和有来源的神经皮节图谱进行二维空间映射，优先覆盖胸腹部与背部，为教学、研究和辅助定位提供可解释的候选节段。核心系统应在没有 AI 模型时独立运行。

预算约 10000 元；第一阶段计划 1～2 周完成核心演示，第二阶段总计约 1 个月完成约定交付。实际进度取决于合法图谱、医学审核和各版本验收，不提前承诺未经验证的结果。

## 医学边界

- 这是医学辅助定位及教学研究系统，**不是临床确诊系统**，当前不能进行医学映射。
- 神经皮节有个体差异及相邻区域重叠；不能把位置机械映射为唯一确定的受累神经节，未来只输出候选节段及限制说明。
- 几何重叠比例是面积关系，**不是诊断置信度**。
- 不自行编造皮节边界、诊断规则或文献。每版图谱必须记录来源、版本、许可和医学审核状态。
- `data/atlas/v1/` 仍为空且禁用；新增来源派生的开发预览图谱，医学审核待完成、正式医学映射禁用，不能用于医学定位。

## 计划中的工作流程

进入小程序 → 选择人体正面/背面与区域 → 放大区域 → 多次点击标注 → 形成闭合多边形 → 后端计算与合格图谱的空间交集 → 输出主要及相邻候选节段 → 高亮展示并允许返回修改。

完整医学业务流程尚未实现。首页进入人体选择，选定部位后点击“开始标注”，进入现有annotate页面；有效闭合后立即显示病灶半透明填充；完成标注后点击一次“计算”，结果页自动显示本次匹配到的全部参考分区与人体两侧标签。点击标签进入单区查看，“显示全部”恢复本次结果。人体浏览和人工标注均无需启动后端，仅点击匹配才调用评估接口。

## 技术栈与系统架构

| 层 | 技术 | 当前状态 / 后续职责 |
| --- | --- | --- |
| 小程序 | 原生 TypeScript、WXML、WXSS、Canvas 2D | V1人体选择及V2多边形编辑、运行内暂存、复核 |
| 后端 | Python 3.11+、FastAPI、Pydantic、Shapely、Pytest | health、真实evaluate、独立校验及并集/交集；atlas GET保留501 |
| 图谱 | 版本化 JSON | V0空图谱保留；另有Goran 2022派生开发预览，医学审核待完成 |
| AI | 独立 `ai/` 与可选 FastAPI 适配器 | 真实 MobileSAM 提示分割、人工确认及放置；不是核心后端启动依赖 |

V4数据流为“小程序归一化坐标 → FastAPI → 图谱与规则匹配 → 候选结果 → 小程序展示”；AI 如启用，只辅助生成待人工确认的图像分割结果，不直接决定神经节段。正背面各自使用标准画布左上角为原点的 `[0,1] × [0,1]` 坐标，左右侧按人体解剖学约定。

当前不引入数据库、Redis、Docker、微服务、登录、云服务依赖、3D 引擎或大模型 API。详见 [架构](docs/architecture.md) 与 [图谱规范](docs/atlas-spec.md)。

## 项目目录

```text
dermatome-mapper/
├── README.md                  # 入口、运行说明及能力边界
├── task.md                    # 唯一开发/实验总进度
├── AGENTS.md                  # AI Coding Agent 可执行规范
├── .gitignore
├── docs/
│   ├── requirements.md        # 范围与验收边界
│   ├── architecture.md        # 模块和数据流
│   ├── api.md                 # 实现状态与 API 契约
│   ├── atlas-spec.md          # 坐标、版本、数据来源和准入
│   ├── validation.md          # 几何、接口、交互及医学验证方法
│   ├── privacy.md             # 数据最小采集与隐私约束
│   ├── file-inventory.txt     # V0 历史文件清单
│   ├── v1-changes.txt         # V1 历史变更清单
│   ├── v11-changes.txt        # V1.1 历史变更清单
│   ├── v12-changes.txt        # V1.2 变更清单
│   └── validation-records/    # 真实执行证据，由 task.md 索引
├── miniprogram/
│   ├── app.ts / app.json / app.wxss
│   ├── project.config.json / tsconfig.json
│   ├── package.json / package-lock.json
│   ├── pages/{index,select,annotate,result}/  # 每页 ts/json/wxml/wxss
│   ├── components/{body-canvas,region-picker,lesion-editor,segment-overlay}/
│   ├── assets/body/           # commons-v1.ts + commons-cc0/ 当前，旧模型保留
│   ├── services/api.ts        # 网络访问职责预留
│   ├── data/body-models.ts    # 版本、资源/区域绑定及视觉替换
│   ├── data/body-regions.ts   # Commons正背面独立UI多边形，每面8个
│   ├── data/body-regions-v2.ts # 旧v2区域原样快照
│   ├── utils/body-path.ts     # 复用曲线的细分与轮廓命中
│   ├── utils/body-debug.ts    # 实际触点基准、探测与十字重投影
│   ├── utils/body-hit-test.ts # 源轮廓过滤、UI多边形命中与候选
│   ├── utils/coordinate.ts    # 纯坐标变换、等比适配、局部视口及复位
│   └── types/dermatome.ts     # 当前接口类型
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/{health,atlas,evaluate}.py
│   │   ├── schemas/           # 当前公共响应；评估 schema 预留
│   │   ├── services/          # 规范图谱校验、几何交集与汇总
│   │   └── utils/geometry.py  # 独立标注几何与人体包含校验
│   ├── tests/                # V0 基础 API 测试
│   └── pyproject.toml
├── data/
│   ├── atlas/v1/{manifest,front,back}.json
│   ├── references.md         # 来源登记，当前未取得医学图谱
│   └── examples/             # 未来合法/合成示例预留
├── ai/
│   ├── README.md
│   └── {experiments,inference,models}/  # 空目录以 .gitkeep 保留
├── tests/miniprogram/         # 坐标、Canvas/页面替身、新模型解剖位置配准测试
└── scripts/
    ├── check_atlas.py         # V0 空图谱 JSON/元数据检查
    ├── check_project.py       # 文件、配置和页面路径静态检查
    ├── smoke_backend.py       # 临时启动 Uvicorn，验证真实 HTTP 后关闭
    ├── test_miniprogram.cjs   # 临时编译 TS + Node 内置测试器
    └── preview_body.cjs       # 从当前资源导出离线SVG（非微信截图）
```

body-canvas 已实现。lesion-editor、segment-overlay、AI 和示例目录仍为预留位置。当前人体资源为Commons CC0本地PNG与同源轮廓，不含医学皮节边界；Python 包含必要的 `__init__.py`。

V0 初始化文件快照逐项列于 [file-inventory.txt](docs/file-inventory.txt)，不计 `.git/`、`.venv/`、`node_modules/` 和被忽略的运行缓存。

## 环境要求

- Python **3.11 或以上**。本机默认 `python3` 可能版本较低；请先检查版本，再用符合要求的解释器创建虚拟环境。本轮环境存在 `python3.12`。
- Node.js 与 npm，用于安装 TypeScript 和微信类型声明；具体依赖以 `miniprogram/package-lock.json` 为准。
- 微信开发者工具，用于小程序实际编译、模拟器导航和真机验证。命令行 TypeScript 检查不等于开发者工具编译。
- 首次安装依赖需能访问 Python/npm 软件源；运行后端不需要数据库、模型、GPU 或外部 AI 服务。

## 后端启动

在本项目根目录执行（系统若没有 `python3.12`，替换为已安装的 Python 3.11+ 命令）：

```bash
cd backend
python3.12 --version
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
python -m uvicorn app.main:app --reload
```

服务默认监听 `127.0.0.1:8000`。在另一个终端验证：

```bash
curl --fail http://127.0.0.1:8000/api/v1/health
```

预期响应：

```json
{"status":"ok","project":"dermatome-mapper","version":"v0"}
```

交互式 API 文档位于 [本地 Swagger UI](http://127.0.0.1:8000/docs)。`GET /api/v1/atlas`仍返回501；evaluate默认403，显式开发测试启用后返回真实交集结果。health的version:v0为保留历史契约。详见 [API 文档](docs/api.md)。

以上是本地开发启动方式，未提供已验证的生产部署方案。Windows 可使用 `.venv\Scripts\Activate.ps1` 激活环境，该平台启动步骤本轮未验证。

## 小程序启动

V3独立开发入口位于首页“神经图谱测试”，支持正背全量、真实分区列表、单区/隐藏、人体左右、标签开关与主动放大复位。只允许envVersion=develop；trial/release/未知或异常关闭，页面内部同样保护。集中总开关在`miniprogram/config/development.ts`，设false同时关闭入口和访问，不接受query绕过。图谱为Goran_tek-en来源派生、CC BY-SA 4.0，医学审核待完成、正式医学映射禁用。来源、覆盖、唯一数据源、重建/同步/校验命令、实际证据及限制见[V3实施说明](docs/v3-atlas.md)，原V1/V2默认不显示图谱，也不修改标注会话。

在项目根目录执行：

```bash
cd miniprogram
npm ci
npm run typecheck
```

然后在微信开发者工具中导入 **`miniprogram/` 目录**。初始化示例使用 `touristappid`；当前保留用户导入后的项目配置及 AppID，本轮没有覆盖。换设备时使用自己的 AppID 或可用测试号。个人配置保存在被忽略的 `project.private.config.json`，不要公开账号相关信息。

工具读取 `project.config.json` 的 TypeScript 编译插件配置。点击工具栏“编译”，从首页进入人体模型。轻触身体区域只选择和高亮，再点“放大查看”；局部可“返回全身”或“更换部位”。“从列表选择”打开当前视图的两列底部列表，取消保留原状态，选择后回到全身。切换视图清空选择和缩放。无需“构建 npm”，项目没有前端框架或运行时 npm 业务依赖。新页面若被旧编译缓存忽略，先清理编译及项目文件列表缓存。本机V3已证实开发依赖过滤误报，项目关闭ignoreDevUnusedFiles；保留类型/域名检查和发布环境访问保护，具体记录见V3说明。

V1 不进行前后端业务联调；`services/api.ts` 仅预留职责。后续真实请求需处理合法域名、HTTPS 与设备可访问地址，手机上的 `localhost` 不指向电脑。本轮不把这些后续接入或未经实际执行的开发者工具编译描述为已通过。

## 测试与质量检查

在项目根目录运行：

```bash
cd backend
.venv/bin/python -m pytest
cd ..
backend/.venv/bin/python scripts/check_atlas.py
backend/.venv/bin/python scripts/check_project.py
backend/.venv/bin/python scripts/smoke_backend.py
cd miniprogram
npm run typecheck
npm test
```

`npm test` 使用现有 TypeScript 和 Node 内置测试器，在临时目录编译/执行后清理，不增加小程序依赖，不生成源码目录中的 JS。测试范围和实际结果见 task.md。

`check_atlas.py` 只检查 V0 未验证空结构；未来加入合法图谱时需随授权版本更新检查规则。它不证明来源、几何或医学准确性。`check_project.py` 检查目录、JSON 和四页文件路径，不执行 WXML/WXSS 或点击导航。

`smoke_backend.py` 使用临时回环端口启动 Uvicorn，检查health 200、atlas 501和默认禁用evaluate 403，随后关闭服务；若运行环境禁止绑定本地端口，需在允许本地监听的环境执行。

所有实际命令、结果、失败记录、未验证项及证据统一见 [task.md](task.md)。未执行项目写 `NOT_RUN`，失败写 `FAILED`，仅实际执行通过才写 `PASSED`。

## 版本规划与当前状态

| 版本 | 目标 |
| --- | --- |
| V0 | 项目初始化、规范、文档、页面骨架、health、基础测试 |
| V1 | 合法人体模型正背面展示、Canvas 坐标映射、尺寸适配 |
| V1.1 | 完整人体视觉优化、模型配置/版本、头颈与单点坐标调试 |
| V1.2 | 历史人体比例重绘、新版本与区域/轮廓配准、前后对比 |
| V1.3 | Commons CC0实际素材替换、本地PNG、独立轮廓与区域配准 |
| V1.5 | 人体直点粗区域选择、确认放大、紧凑底栏与备用列表 |
| V1.6 | 粗区域共享边界、高亮与命中一致、区域配置独立修订 |
| V2 | 点击标注、闭合/撤销/清空、会话保存、多病灶 |
| V3/V3.1 | 来源图谱数字化、人体配准和预览；医学审核独立待办 |
| V4 | 几何匹配、真实API、基础结果高亮和返回编辑 |
| V5 | 后续结果体验完善，未获本轮开发授权 |
| V6 | 按图谱及审核条件扩展区域并验证 |
| V7（可选） | 合法数据上的 AI 分割探索，不阻塞核心运行 |
| V8 | 集成/性能/隐私检查、医学验证记录、文档与交付 |

V0 已结束；V1交付基线保留Commons真实素材、V1.5交互和V1.6共享边界。已有人工标注与参考几何匹配；没有审核通过的正式医学映射、照片上传、AI、3D或临床诊断能力。完整状态和各版本独立实验计划以 [task.md](task.md) 为准。

[V2设计](docs/v2-plan.md)固定模板4.0.0/区域配置2与原坐标基础；标注与会话内暂存已接入，实际验收状态统一见task。V3/V3.1参考图谱已接入；医学审核和历史未验项仍以台账为准。

## 开发入口

修改前先读 [AGENTS.md](AGENTS.md) 和 [task.md](task.md)。修改接口必须同步 Pydantic、TypeScript、文档及测试；不擅自提交或推送。数据与隐私规则见 [privacy.md](docs/privacy.md)，AI 模块边界见 [ai/README.md](ai/README.md)。

## 当前模型、坐标与调试使用

当前模板 commons-neutral-v1 / 4.0.0，逻辑画布400×900，正背面独立图片和每面8个UI区域。来源及几何变化见 [资源说明](miniprogram/assets/body/README.md)。旧v2/v3模型、区域和model.ts保留历史，绘图器从body-models.ts读取当前资源；coordinate.ts只依赖逻辑尺寸，不导入资源。正式医学JSON仍为空、未验证且禁用。

导入既有小程序后点击“编译”，从首页进入人体模型。默认全身正面且无选择。人体外不吸附；体内无配置时提示从列表选择；区域重叠时显示候选列表，不能按数组顺序抢选。头、颈较小时可用列表。放大前须确认，返回全身保留高亮。

点击“开发调试”展开下方面板，再开启“坐标调试”。此时人体点击仅探测坐标，显示单个十字，不触发区域选择。面板显示实际视图、模板版本、区域ID、点击时屏幕/Canvas坐标、四位归一化坐标、当前十字位置及真实视口/DPR。关闭开发调试也关闭探测并清点；画布可随页面滚动。

十字存储为单个归一化点及view/模板版本，放大、复位、resize均重投影；超出可见视口时隐藏而不贴边。换面、关闭调试清空该点；点击不改变所选区域，也不形成病灶点集。轮廓内为有效点；逻辑画布内但轮廓外提示“不在人体轮廓内”；模型范围外提示“超出模型范围”。拖动超过8 CSS px、取消和多指不作为点击。

屏幕坐标指页面可显示区域CSS像素（不含导航条），不是设备物理屏幕像素；Canvas事件本地x/y直接使用，clientX/Y则减去点击时重新查询的Canvas矩形。DPR只用于物理画布。纯函数仍使用原来的fit/focus/reset及双向变换公式；模型变化不改变数学坐标规范，但不意味着旧几何点自动兼容新模板。

视觉资源仅改配色/阴影/细节且轮廓、画布、视图和geometryId一致时可用withBodyVisual替换；几何改变必须新版本并重查UI区域，未来图谱/标注也须绑定模板。当前无病灶、无医学映射，人体轮廓命中只是UI几何判断。

Canvas ready/show/resize/属性变更按需重绘；异步查询按generation/点击序号隔离。WXSS或跨文件热更新可能留下旧画布/模块，验收前完整编译；部分工具版本不能加载对象展开生成的Babel辅助模块，本次采用Object.assign避免新增该运行依赖。实际工具状态和连接限制见task.md。

V1.2历史模型资源离线对比：[四栏 PNG](docs/validation-records/v12-comparison-2026-10-22.png) / [可编辑 SVG](docs/validation-records/v12-comparison-2026-10-22.svg)。依次为旧正面、新正面、新背面、设计参考位置；由实际原始路径导出，已实际看图，不是微信截图或医学图谱。复现执行 `node scripts/preview_body.cjs <不存在的新输出路径.svg> --comparison`；去掉标志可导出当前正背面。无新增运行依赖，PNG使用环境已有图形库转换。

历史V1.2保留约7.79头身，将裆点y510改为474、膝线前y626改为650、踝y826改为825，重绘胸廓及肩、腰、髋、手足过渡；不是缩放旧图。位置数据为插画设计参考，不是医学测量。新增anatomy-registration测试检查实际轮廓、关节点和16区域，独立于坐标公式测试。微信小屏已实测显示及控件状态；真实点击偏差、其他模拟器尺寸等未完成项见task.md，不能据自动测试宣布全量验收。

## V1.3 素材构建与回归

当前资源说明与构建命令见[assets/body/README.md](miniprogram/assets/body/README.md)。`node scripts/preview_body.cjs <新的输出.svg> --comparison`输出旧v3/新两面/工程参考，普通模式输出新两面；对新模型嵌入实际PNG。类型/前端测试仍在miniprogram执行`npm run typecheck`、`npm test`，源像素配准测试与坐标公式测试分别运行，历史v3比例断言不代表当前素材医学审核。GUI和真机验证范围仅见task.md。


## V1.6 区域修订与复验

[同倍率旧/新区域及左右臂对比](docs/validation-records/v16-regions-2026-10-22-comparison.png)、[共享边界与人工参考点](docs/validation-records/v16-regions-2026-10-22-boundaries.png)由实际生产drawBody命令和本地PNG导出，**是离线预览，不是微信截图**；旧区域使用当前轻实线样式，便于比较几何。实际微信与未验证项单独记于task.md。

原有npm测试继续运行，新增源图人工参考点和填色路径断言；根目录另运行 `backend/.venv/bin/python scripts/check_body_regions.py`，使用既有TypeScript与Shapely检查自交、重叠、共用边界、focus包含及源轮廓覆盖，不增加运行时框架。预览复现：`node scripts/preview_regions.cjs <不存在的新输出前缀> [已有sharp模块路径]`；不给sharp只输出SVG。模板版本保持4.0.0，不将UI分区当作医学皮节。


## V1收尾与V2准备

用户于2026-10-22决定结束V1，停止非阻塞性外观迭代。用户接受、实际实现和实际验证分别记录：历史FAILED/NOT_RUN以及尚未全量验证的V1.x记录保留，接受界面不等于所有设备或医学验证完成，详见[收尾台账](task.md)。本轮只审查与写文档，没有修改素材、区域、布局、业务类型或接口。

2026-10-22的规划与V1证据保留；2026-10-23用户授权实施完整V2。当前操作见下节，设计及与计划的差异见[集中计划](docs/v2-plan.md)。不做AI、医学匹配、后端评估、数据库或跨启动恢复。

## V2 标注操作

1. 在人体选择页选择正面/背面及部位，点击“开始标注”，默认聚焦所选部位。未选择或调试中不能开始；标注页隐藏粗部位绿色高亮。
2. 沿边缘逐点轻触。“撤销”去草稿末点，“取消当前”仅清草稿且非空时确认。至少三点后点击“闭合区域”，不要再次点首点。校验失败保留草稿并提示原因。
3. 闭合后通过列表选片，“新增区域”开启下一片，“删除选中”确认后只删该片。管理和复核状态不会隐式加点；重叠片独立保留，不合并。
4. “返回全身”和“聚焦入口部位”只改变视口，胸部不是标注围栏。切面有非空草稿时选择继续、放弃并切换或验证闭合后切换。
5. 至少一片有效区域后可“完成标注”；有草稿时需明确处理。复核显示两面数量和独立范围，切面查看或“继续修改”。没有神经节段、置信度或服务器保存结果。
6. “返回选择”可保留草稿；再次进入优先恢复未处理草稿及原视图。同一次运行中数据逐操作写内存，系统返回不清空，但不保证拦截所有系统导航。关闭进程、重启或重新编译可能丢失；没有长期存储或云同步。错版会话保留数据并拒绝自动迁移。

开发调试默认关闭；开启后只探测坐标，暂停标注点击并保留草稿。每片最多128顶点、每面20片，超限不截断；低端真机性能待测。完成环显式重复末尾首点，坐标始终是完整400×900模板的归一化点。

验证：`npm --prefix miniprogram run typecheck`、`npm --prefix miniprogram test`；根目录运行`backend/.venv/bin/python scripts/check_annotation_geometry.py`作独立Shapely对照，另保留既有后端和静态回归。人工协议见[验证文档](docs/validation.md)，真实结果及失败见[台账](task.md)。[离线绘制器预览](docs/validation-records/v2-offline-render-2026-10-23.png)使用synthetic测试形状，**不是微信截图**。

## V4 开发联调

macOS已安装本项目依赖后，可双击项目根目录的[启动后端.command](启动后端.command)。终端显示服务已启动后保留窗口，再在微信中计算；关闭该窗口、退出服务或重启电脑后，需要重新启动。它仅监听本机127.0.0.1，不会安装开机常驻服务。若提示8000端口已占用，先检查现有服务，不要重复启动。首次依赖安装仍按前面的后端启动说明执行。

仅本机开发环境启动（项目根目录）：

```bash
DERMATOME_ENV=development ENABLE_REFERENCE_MATCHING=1 backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log
```

模拟器地址集中在 `miniprogram/config/api.ts`，默认 `http://127.0.0.1:8000`。真机的 `deviceBaseUrl` 默认空，须另行配置可访问且符合微信合法域名要求的HTTPS开发服务；手机localhost指手机自身。不要关闭安全检查来掩盖配置问题。服务端口与配置应一致。开发工具服务端口不是API端口，本项目不要求开启CLI控制服务。

前端只允许develop；后端必须同时满足development/test与ENABLE_REFERENCE_MATCHING=1。production即使设开关1也拒绝，不接受query绕过。确认范围→完成标注→点击一次“计算”，在同一页面、同一人体画布上显示全部参考颜色与两侧标签，保留当前视野。修改标注后旧结果失效，再点击“计算”即可生成新结果；未改几何则复用有效缓存。标签、逐片/汇总及“显示全部”不自动复位，也不发请求；只有“全身”或“放大当前”主动改变视野。网络失败保留标注。仅会话内保存，不上传照片，不调用第三方AI。实际状态见[task.md](task.md)，契约见[API](docs/api.md)，基础计算与限制见[V4说明](docs/v4-matching.md)，当前操作见[V4连续体验说明](docs/v4-experience.md)，旧[交互联动说明](docs/v4-interaction.md)保留为历史。主页面“说明”中可查看并复制真实来源/许可、医学待审状态和版本，所有环境可访问；计算门禁不变。“减少动态效果”可关闭覆盖层过渡。

### 本地计算提示无法连接时

2026-10-26实际排查确认：当前工具对`http://127.0.0.1:8000`报“request合法域名列表”错误，后端本身正常。HTTP回环服务只适合本机开发调试；启用域名校验时它会被拦截。

若选择临时本地调试，在微信开发者工具“详情→本地设置”中由开发者开启“不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书”。这会降低当前开发环境的网络校验；完成本地调试、配置合法HTTPS域名后恢复。也可保持校验，直接使用登记过且证书有效的HTTPS后端。项目共享配置继续保留urlCheck=true，不自动关闭安全开关。新错误提示会区分域名拦截、超时及连接失败。

## V5.1 独立 AI 实验入口（2026-10-27）

用户本轮将历史 V7 AI 计划提前为 V5，当前只实现照片提示分割。独立安装和命令行演示见 [ai/README.md](ai/README.md)，实际结果与限制见 [V5.1报告](docs/v5-ai-segmentation.md)，进度仍以 [task.md](task.md) 为准。没有新增小程序上传页或 AI 接口；照片轮廓尚不能直接送入人体匹配。V1～V4不需要AI依赖。

## V5.2 AI 辅助标注（2026-10-27，覆盖上节历史入口说明）

已增加独立照片页及本地后端接口。选择人体部位后，保留“手动标注”，也可进入“AI 辅助标注”：同意用途 → 上传公开测试照片 → 默认拖框 → AI 分割 → 切换真实候选 → 补充前景／排除点、重新分割 → 显式确认。确认后停在照片页，不放置到人体，不调用神经匹配。切换候选不代表确认；不满意可重置、更换或取消照片。

本机开发使用[启动AI后端.command](启动AI后端.command)，它在原8000端口同时提供AI与原V4参考匹配；与旧启动器二选一，不重复启动。需先完成[AI环境安装](ai/README.md)及可选服务依赖安装。当前已安装的AI环境与权重可直接复用，不需要重新下载模型。服务窗口关闭或电脑重启后须重新启动。

只开放 develop 版微信开发工具和 development/test 后端，**仅使用公开或合成测试图片，尚不支持真实患者上传或真机部署**。既有本地网络配置沿用；不自动修改合法域名或安全设置。正式HTTPS、用户身份/授权、限流/备份/运维安全仍需另行验收。

照片先统一EXIF方向，再显示同尺寸Mask；照片坐标为 `photo_oriented_normalized_v1`，不能当人体坐标。临时会话30分钟失效，取消/返回请求清理；服务运行时定期清理，异常退出残留在下次启动清理。确认结果仅临时保留，返回会删除。核心人工流程不依赖AI安装。

[实现与限制](docs/v5-ai-segmentation.md#9-v52-小程序与本地服务2026-10-27) · [接口契约](docs/api.md#v52-临时照片分割接口2026-10-27) · [实际测试与微信截图](docs/validation-records/v5.2/report.md)。阶段状态只在[task.md](task.md)维护；V5.3～V5.5尚未实施。

### V5.2 当前简化操作（2026-10-28）

主流程现为：**上传照片 → 框住皮疹并松手 → 自动识别 → 确认识别范围**。不用再点“AI分割”。过小的框不会发请求；拖动时不请求，识别期间保留照片。可“重新圈选”，或用“换个结果”循环查看真实可用候选；预览不代表确认。

“识别不准确？精细调整”默认收起，展开才显示补充识别区域、排除误选区域、撤销和重新识别。完成调整后返回同一个确认流程。没有合适结果可重新圈选或返回手动标注；照片用途/隐私说明、取消删除及开发环境限制保留。确认仍只生成照片坐标结果，尚无人体放置。

本轮验证范围见[简化交互验证记录](docs/validation-records/v5.2-simple/report.md)，当前状态以[task.md](task.md)为准。

“松手无变化”已补充异步触摸修复；用户在微信重新编译后确认自动出现绿色范围，后续候选切换、精调、确认与返回手动已完成协作复测。详见[修复及原生截图](docs/validation-records/v5.2-touch-fix/report.md)。

### V5.3 人工放置到人体（2026-10-31）

本轮将照片确认结果交给“确认病灶位置”页面：按已有部位和正/背面聚焦，整体移动多片病灶，用滑杆调整大小和方向，再明确确认位置。所有片区和孔洞保持原形，最终人体范围必须完整位于真实人体表面；超出时提示调整，不自动裁切或吸附。

确认后追加到原 V2 运行内会话，原有手工标注保留。照片原结果继续使用独立照片坐标和临时会话期限；人工放置不等于 AI 自动解剖配准，大小的100%不代表真实物理比例。本轮止于保存和查看人体标注，神经匹配整合属于 V5.4。数据、生命周期和实际验证范围见[V5.3说明](docs/v5-placement.md)，当前实施与验收状态仍只在[task.md](task.md)维护。

## V5.4 使用入口（2026-11-01）

选择人体部位 → AI 辅助标注 → 上传公开测试照片并圈选 → 确认识别范围 → 放置到人体 → 调整位置、大小、方向 → **确认位置并计算**。成功后自动显示全部参考区域和两侧标签；点击标签单区查看，“显示全部”恢复。可在结果页调整对应 AI 标注的位置，确认后以同一标注 ID 更新并重新计算。网络失败保留正式范围，重试不重复保存。原手动标注入口继续使用同一服务。

多片与孔洞完整保留；evaluate 只接收正式人体几何和版本，不接收照片/Mask。AI 来源不是神经识别算法，覆盖比例不是诊断概率。开发后端同时开启原有 AI 与 reference matching 开关即可，无新依赖、无新权重。实际实现、测试及未验项目见 [V5.4 数据流](docs/v5-ai-integration.md)、[验证记录](docs/validation-records/v5.4/report.md) 和 [task.md](task.md)。V5.5 未实施。

本轮MobileSAM过度分割专项增加局部分析、候选异常提示和可撤销的“修正范围”（补充/擦除），确认后仍沿用人体放置及参考匹配。模型仍可能误选/漏选，必须人工确认。实际效果、测试与未验证项见[专项报告](docs/validation-records/v5-oversegmentation/report.md)，当前状态见[task.md](task.md)；未开展专用模型训练。

## 腾讯云受控部署（2026-11-01）

**服务器已部署，公网或微信联调仍待完成。** 独立`dermatome.service`/低权限用户/venv，回环8001，单CPU/1.5GiB限制、单推理，真实MobileSAM与V4匹配、独立停启及临时数据保留已验证；原针灸服务保持正常。无新授权域名，未改Nginx/证书或微信合法域名，尚不接收患者照片。

需要暂停以演示针灸项目时，双击[停止云端后端.command](停止云端后端.command)；恢复用[启动云端后端.command](启动云端后端.command)；查看用[查看云端状态.command](查看云端状态.command)。仅操作固定的dermatome服务。也可 `ssh acupuncture-server 'sudo systemctl stop dermatome'`，将stop换成start/restart即可；不需要重启Nginx或针灸服务。

开发工具联调需先运行[SSH测试通道](deployment/cloud-tunnel.sh)，然后首页“连接受控云端测试服务”输入本机private-data/cloud-access.json中的访问凭据（不在聊天中粘贴）。仅留运行内存，默认本机后端8000继续可用；真机不支持此回环地址。本轮完整原生云端测试由用户暂缓，程序适配器的真实云端链路已测通过。

版本、证据、依赖锁、临时数据30分钟失效/定时清理、停启影响、独立回滚及未来request/uploadFile/downloadFile域名准备见[部署报告](docs/tencent-cloud-deployment.md)。

## P4 体验版接入（2026-11-01）

体验版“计算”和AI业务门禁已修复，开发调试工具在体验版隐藏；release在线能力继续关闭。云端新增一次性邀请码换取限时访问，照片按授权会话隔离。真实云端AI→确认→人体放置→匹配及停启回归已通过。

**目前仍无新HTTPS域名，手机体验版尚不能完整使用。** 不填入猜测的地址，不自动开放8001。取得授权域名并验证HTTPS后，配置[servers.ts](miniprogram/config/servers.ts)，在微信后台登记request/uploadFile/downloadFile、上传并指定新体验版，再做手机验收。

未来体验用户可在首页或首次在线操作时开通访问。管理员双击[生成体验邀请码.command](生成体验邀请码.command)，码值只保存在本机私有文件，10分钟一次性，使用后获得固定1小时访问；不把管理员共享密钥发给手机。当前仅用公开或合成测试图片，云端限制10MiB/300万像素。

环境矩阵、当前AppID、鉴权、实测/未测范围、平台步骤及回滚见[体验版接入报告](docs/wechat-trial-integration.md)。本轮未上传空HTTPS配置的体验版，不能把294项前端测试和176项Python测试、开发工具编译或SSH接口成功当作手机通过。

P4.1 当前临时测试入口已按用户授权改为公网 IP HTTP，trial/手机 develop 配置与真实接口测试见 [手机公网调试说明](docs/wechat-public-ip-test.md)。仅公开/合成图片，传输不加密；新代码仍需上传并指定体验版，手机未验收。正式版保持关闭。此说明更新此前“必须先有新域名”的本轮调试前提，历史记录不删除。

P4.2 当前已取消邀请码输入和首页开通入口，手机develop/trial点击业务时自动建立限时测试会话。服务器无法验证微信开发调试，免邀请入口也可被其他客户端申请，仍仅公开/合成图片。请上传当前代码（建议0.5.4-open.20261102），旧体验版不会更新。详见[免邀请码测试说明](docs/wechat-public-test-access.md)。
