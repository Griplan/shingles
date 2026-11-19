# 交接图表索引

> 文档基线：2026-11-19。当前图表以内嵌 Mermaid 为唯一可维护源，避免 `.mmd` 副本与正文长期漂移。

## 图表清单

| 图表 | 所在位置 | 用途 |
| --- | --- | --- |
| 总体数据流 | [05 系统架构](../05-system-architecture.md) | 小程序、FastAPI、AI、图谱与结果 |
| 开发演进 | [02 开发演进史](../02-development-history.md) | 主要版本与能力变化 |
| 页面与分包 | [07 小程序架构](../07-miniprogram-architecture.md) | 路由、分包、公共组件 |
| 后端调用 | [08 后端架构](../08-backend-architecture.md) | 路由、Schema、服务和图谱 |
| AI 分割 | [09 AI 分割](../09-ai-segmentation.md) | 上传、提示、编码、Mask、确认 |
| 人体放置坐标 | [12 人体放置流程](../12-body-placement-workflow.md) | 照片到人体草稿 |
| 图谱匹配 | [05 系统架构](../05-system-architecture.md) | identity、Shapely、候选和高亮 |
| AI 会话生命周期 | [15 状态与会话](../15-state-and-session-management.md) | 创建、活动、删除和过期 |
| 临时文件清理 | [20 安全与隐私](../20-security-privacy-and-licenses.md) | 上传、派生、删除 |
| 部署拓扑 | [18 部署与发布](../18-deployment-and-release.md) | Nginx、systemd、AI、清理 |
| 后续路线 | [22 路线图](../22-future-roadmap.md) | 从版本冻结到真机验收 |

## 维护规则

1. Mermaid 语法必须与当前代码一致，不展示未实现模块。
2. 业务架构变更时，先更新正文和事实来源，再更新图。
3. 原图来源示意图、验证截图和 Canvas 证据不放在本目录，应继续归入对应 `docs/validation-records/`。
4. 图表中的“模拟”“未审核”“未部署”标识不能省略。
5. 如果以后需要导出 SVG/PNG，应从正文 Mermaid 生成，并记录生成时间与源章节。
