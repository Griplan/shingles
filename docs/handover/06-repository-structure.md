# 06 仓库结构

> 文档基线：2026-11-19；代码基线为 Git `27b41f6` 加当前未提交工作区。代码、部署和真机状态分层记录，以当前源码与实际证据为准。

## 6.1 顶层目录

```text
dermatome-mapper/
├── AGENTS.md
├── README.md
├── task.md
├── miniprogram/
├── backend/
├── ai/
├── data/
├── deployment/
├── scripts/
├── tests/
└── docs/
```

| 路径 | 责任 |
| --- | --- |
| `AGENTS.md` | AI Coding Agent 和工作边界。含历史授权段落，注意滞后 |
| `README.md` | 项目入口和常用说明。不同版本内容叠加 |
| `task.md` | 唯一总开发台账 |
| `miniprogram/` | 微信原生小程序 |
| `backend/` | FastAPI、Schema、几何服务 |
| `ai/` | MobileSAM 独立推理实验和服务适配 |
| `data/` | 后端正式/预览图谱和人体导出 |
| `deployment/` | systemd、Nginx、清理、回滚、发布清单 |
| `scripts/` | 生成、同步、检查、预览、基准和 HTTP 验证 |
| `tests/` | Node 小程序测试和少量根级几何对照 |
| `docs/` | 架构、API、隐私、验证和交接 |

## 6.2 小程序当前结构

```text
miniprogram/
├── app.ts / app.json / app.wxss
├── config/
├── services/
├── state/
├── utils/
├── types/
├── data/
├── assets/
├── components/
├── pages/
└── packages/
    ├── clinical/
    └── special/
```

主包只保留：

- `pages/select/select`
- `pages/index/index`
- 人体共享资源、共享组件、公共状态和坐标纯函数

分包：

- `clinical`：人工标注、结果、AI 和放置；
- `special`：特殊部位菜单、局部表面和局部图谱。

## 6.3 后端结构

```text
backend/app/
├── main.py
├── api/routes/
├── schemas/
├── services/
└── utils/
```

| 目录 | 责任 |
| --- | --- |
| `api/routes` | HTTP 接口和参数边界 |
| `schemas` | Pydantic 数据契约 |
| `services` | 图谱加载、AI 会话、匹配、人体交集、访问控制 |
| `utils` | 纯几何和 Shapely 输入转换 |

## 6.4 AI 结构

```text
ai/
├── preprocessing/
├── inference/
├── postprocessing/
├── experiments/
├── models/
├── tests/
├── segmentation.py
└── cli.py
```

`models/` 中只提交许可和源码外壳；权重和批量输出被 Git 忽略。

## 6.5 数据目录

| 路径 | 内容 |
| --- | --- |
| `data/atlas/v1` | 历史空图谱，未验证 |
| `data/atlas/goran-2022-preview-v3` | 当前全身参考图谱 |
| `data/atlas/sole-v1` | 左右足底 |
| `data/atlas/axilla-goran-provisional-v1` | 腋下试验性近似 |
| `data/atlas/axilla-schematic-v1` | 腋下全覆盖人工模拟 |
| `data/atlas/perineum-schematic-v1` | 会阴人工模拟 |
| `data/body` | 后端人体/局部模板导出 |

旧 `palm-v1`、`axilla-v1` 等文件仍在目录中用于历史追溯，但不再是正常运行时首选。

## 6.6 文件所有权提示

- 小程序页面行为通常同时涉及 `.ts`、`.wxml`、`.wxss`、`.json`；
- 后端 API 变更必须同步 Schema、服务、TypeScript 类型、`docs/api.md` 和测试；
- 图谱几何变更必须更新生成器、manifest、哈希、前后端 generated copy；
- 人体几何变更必须更新 template/geometry/regionSet 版本；
- 只改视觉样式且轮廓完全相同时，才可复用几何 ID。

## 6.7 不要手工修改生成文件

下列文件通常由生成器产生：

- `miniprogram/packages/clinical/data/atlas.generated.ts`
- `miniprogram/data/body-hands.generated.ts`
- `miniprogram/assets/body/commons-cc0/geometry.generated.ts`
- `miniprogram/packages/special/data/*.generated.ts`
- `data/body/*.json`

应先修改生成器或源数据，再执行同步检查。当前检查命令为：

```bash
python3 scripts/sync_atlas.py --check
python3 scripts/check_main_hands.py
python3 scripts/check_atlas.py
```

## 6.8 忽略与敏感目录

`.gitignore` 排除：

- `.venv`
- `node_modules`
- 模型权重
- AI 原始输入和输出
- `private-data/`
- 患者/上传目录
- 私钥、凭据和本机微信配置

`private-data/` 在本地存在，但其中文件不能复制到文档、截图、提交或公开测试记录。
