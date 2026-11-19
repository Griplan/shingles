# 智络智绘（dermatome-mapper）技术交接

本目录面向接任开发者、部署人员、测试人员和医学数据审核人员。内容以 **2026-11-19 当前工作区代码**、现有自动化测试、验证记录和 `task.md` 为依据，并明确指出历史文档、线上版本与当前本地工作区之间的差异。

## 先用五分钟理解项目

智络智绘是一个微信原生小程序与 FastAPI 研究工具。用户可以：

1. 在完整人体正面或背面手工圈选一个或多个病灶；
2. 上传局部皮肤照片，由 MobileSAM 生成待人工确认的候选 Mask；
3. 将确认后的 MultiPolygon 以相似变换放到人体模板；
4. 在脚底、腋下或会阴等独立局部视图手工圈选并模拟匹配；
5. 使用 Shapely 计算病灶与版本化参考图谱的真实二维面积交集；
6. 在人体模型上查看候选标签、覆盖比例和单区高亮。

它不是带状疱疹诊断模型，也不是经过医学审核的临床定位系统。系统输出是教学、研究和交互模拟用的参考几何结果。

## 当前状态一眼看

| 项目 | 状态 |
| --- | --- |
| 当前 Git 提交 | `27b41f6`，提交信息“更改流程” |
| 当前分支 | `main` |
| 远程 | `https://github.com/Griplan/shingles.git` |
| Git 同步 | 本地提交尚未推送；远端 `origin/main` 为 `a7bb1b8` |
| 工作区 | 包含大量后续未提交改动，不能整库重置或清理 |
| 当前代码阶段 | V7.0/V7.1、P8/P8.1、P9/P10/P11、P11.2、P12.1 等本地增量 |
| 最近记录的云端版本 | V6.7 后端已部署并完成公网 smoke |
| 微信上传 | 曾成功上传 `0.6.8`，但没有证据证明已设为体验版 |
| 真机 | `NOT_RUN` |
| 医学审核 | 全部仍为 `pending` 或 `NOT_MEDICALLY_VALIDATED` |

## 文档索引

| 序号 | 文档 | 主要问题 |
| --- | --- | --- |
| 01 | [项目总览](01-project-overview.md) | 产品目标、边界、用户与术语 |
| 02 | [开发演进史](02-development-history.md) | 为什么形成当前架构 |
| 03 | [当前完成度](03-current-progress.md) | 功能状态矩阵与证据边界 |
| 04 | [技术栈](04-technology-stack.md) | 版本、运行环境和依赖 |
| 05 | [系统架构](05-system-architecture.md) | 端到端数据流和模块责任 |
| 06 | [仓库结构](06-repository-structure.md) | 目录导航与代码所有权 |
| 07 | [小程序架构](07-miniprogram-architecture.md) | 页面、组件、状态和分包 |
| 08 | [后端架构](08-backend-architecture.md) | FastAPI、路由、服务与错误处理 |
| 09 | [AI 分割](09-ai-segmentation.md) | MobileSAM、图像安全、Mask 与候选 |
| 10 | [神经参考图谱](10-dermatome-atlas.md) | 全部 atlas 版本、来源和审核状态 |
| 11 | [多边形与几何](11-polygon-and-geometry.md) | 坐标、Polygon/MultiPolygon、交集 |
| 12 | [人体放置流程](12-body-placement-workflow.md) | 照片轮廓到人体坐标的完整链路 |
| 13 | [特殊部位](13-special-body-regions.md) | 脚底、腋下、会阴与已退役手掌 |
| 14 | [API 与数据契约](14-api-and-data-contracts.md) | 当前可调用接口、请求和响应 |
| 15 | [状态与会话](15-state-and-session-management.md) | V2 权威会话、AI 会话和草稿 |
| 16 | [性能优化](16-performance-optimization.md) | P6、P9、P10、P11、P11.2 |
| 17 | [开发环境](17-development-environment.md) | 安装、启动、构建和常用命令 |
| 18 | [部署与发布](18-deployment-and-release.md) | 腾讯云、公网测试、体验版和回滚 |
| 19 | [测试与验收](19-testing-and-validation.md) | 自动化、微信和真机证据边界 |
| 20 | [安全、隐私与许可](20-security-privacy-and-licenses.md) | 临时照片、鉴权、来源和删除 |
| 21 | [已知问题与技术债](21-known-issues-and-technical-debt.md) | 交接时最需要处理的风险 |
| 22 | [后续路线图](22-future-roadmap.md) | 建议的优先级与准入门槛 |
| 23 | [维护与故障排查](23-maintenance-and-troubleshooting.md) | 常见故障的定位路径 |
| 24 | [新开发者指南](24-new-developer-guide.md) | 首日、首周和首个修改建议 |
| 25 | [架构决策记录](25-architecture-decisions.md) | 关键取舍及其后果 |
| 26 | [术语表](26-glossary.md) | 医学、几何与工程术语 |
| - | [图表索引](diagrams/README.md) | 全部 Mermaid 图、维护规则和证据边界 |

## 状态标签

- `IMPLEMENTED`：当前工作区代码中存在并已接入实际流程。
- `TESTED`：有当前可重复的自动化或静态测试证据。
- `DEPLOYED`：有部署记录表明目标环境已获得对应版本。
- `TRIAL_VERIFIED`：已在新体验版和真机实际完成流程。
- `PARTIAL`：实现或验证只覆盖一部分。
- `NOT_RUN`：任务适用但没有实际执行。
- `BLOCKED`：缺少来源、许可、审核、凭据或环境。
- `UNKNOWN`：当前没有足够证据判断。

`IMPLEMENTED`、`TESTED`、`DEPLOYED` 和 `TRIAL_VERIFIED` 不能互相替代。

## 交接时必须知道的五件事

1. **当前工作区不等于 Git HEAD，也不等于线上版本。** 大量 V7/P8–P12 改动仍未提交，线上主要是较早的 V6.7 后端。
2. **坐标空间不能混用。** `photo_oriented_normalized_v1`、全身 `body_template_normalized_v1` 和各特殊视图的归一化坐标均由不同模板定义。
3. **AI 只是候选生成器。** 最高分候选不是自动确认结果；用户确认和人体放置是强制步骤。
4. **模拟图谱不是医学图谱。** 腋下 T1/T2/T3、会阴 S2–S5/UNDEFINED 等是人造交互分区。
5. **历史文档会滞后。** `AGENTS.md`、README 和隐私文档有多个阶段叠加，必须结合本目录、实际代码和 `task.md` 最新记录阅读。

## 变更本目录

交接文档是解释层，不替代 `task.md`。修改业务行为时，应同时更新对应专题文档，但历史验证结论只能追加和标注“已被覆盖”，不能删除失败记录。
