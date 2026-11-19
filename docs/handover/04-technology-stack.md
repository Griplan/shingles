# 04 技术栈与运行环境

> 文档基线：2026-11-19；代码基线为 Git `27b41f6` 加当前未提交工作区。代码、部署和真机状态分层记录，以当前源码与实际证据为准。

## 4.1 小程序

| 技术 | 版本/配置 |
| --- | --- |
| 语言 | TypeScript `5.9.3` |
| 微信类型 | `miniprogram-api-typings 5.2.3` |
| UI | 原生 WXML/WXSS |
| 绘制 | Canvas 2D + 本地 PNG/矢量轮廓 |
| 框架 | 无 React/Vue/跨端框架 |
| 分包 | 微信原生 `subPackages` |
| AppID | `wx951711e2fa1da5ff` |
| URL 校验 | `urlCheck: true` |
| 响应式 | `resizable: true`、`pageOrientation: auto` |
| 开发工具基础库样例 | 3.17.4 |

关键配置：

- `miniprogram/app.json`
- `miniprogram/project.config.json`
- `miniprogram/project.private.config.json`（本机私有，Git 忽略）

## 4.2 后端

后端要求 Python 3.11+：

| 依赖 | 范围 |
| --- | --- |
| FastAPI | `>=0.115,<1` |
| Pydantic | `>=2.9,<3` |
| Shapely | `>=2.0,<3` |
| Uvicorn | `>=0.30,<1` |
| python-multipart | 可选 AI 上传依赖 |
| Pytest | 开发依赖 |
| HTTPX | 开发依赖 |

后端入口为 `backend/app/main.py`，核心 `/evaluate` 不依赖 PyTorch。

## 4.3 AI

| 依赖 | 固定版本 |
| --- | --- |
| PyTorch | `2.5.1` |
| Torchvision | `0.20.1` |
| timm | `1.0.12` |
| NumPy | `2.1.3` |
| Pillow | `11.1.0` |
| Shapely | `2.1.2` |
| Pytest | `8.3.5` |
| psutil | `6.1.1` |
| MobileSAM 源码提交 | `f706ad9c4eb7f219c00d9050e46328518ffb65d2` |

MobileSAM 权重：

- 大小约 40,728,226 字节；
- 不自动下载；
- 不提交 Git；
- 加载时校验 state dict；
- 单进程单推理槽；
- 不并发共享可变 Predictor。

AI 依赖位于 `ai/requirements.txt` 和独立 `ai/.venv`。

## 4.4 当前开发机观察

文档调查时：

- macOS arm64；
- Node `24.11.1`；
- npm `11.6.2`；
- 系统 `python3` 为 3.9.6，不满足后端要求；
- 仓库已有 `backend/.venv` 与 `ai/.venv`；
- Python 3.12 环境用于后端与 AI 检查。

这些不是部署环境事实。生产环境历史记录为 Ubuntu 24.04、x86_64、4 逻辑 CPU、约 3.64 GiB 内存、独立 dermatome systemd 服务。

## 4.5 外部数据格式

- JSON：人体、图谱、manifest、API；
- GeoJSON 形状，但不代表地理坐标；
- PNG：人体和局部模板；
- SVG：来源审计与静态预览；
- Base64 Float64：clinical 图谱压缩编码，运行时还原原坐标；
- WXML/WXSS：微信视图层；
- Markdown：分工文档、台账和验证记录。

## 4.6 不应随意新增的依赖

当前架构刻意避免：

- 数据库；
- Redis；
- Docker/Kubernetes；
- 大型前端框架；
- 3D 引擎；
- 第三方在线 AI API；
- 在生产请求中自动下载模型；
- 为几何处理再引入第二个后端服务。

新增依赖前应证明现有依赖无法满足需求，并检查微信包体、服务器内存、许可证和离线可运行性。
