# 图 11：关键页面与状态模块

来源：本项目当前源码审计，2026-11-02；对应证据见上级 技术结论与证据索引.md。流程图不是医学验证结果。

```mermaid
flowchart TB
  IDX["index / select
视图与部位上下文"] --> ANN["annotate
手工编辑 + 计算结果"]
  IDX --> AI["ai-annotate
AIPhotoFlow"]
  AI -->|"确认照片几何"| PL["placement
PlacementSession"]
  PL -->|"确认位置 / 编辑"| CAN["annotationSession
唯一正式标注状态"]
  ANN --> CAN
  CAN --> MAT["matchingSession
快照 / 失效 / 请求序号"]
  MAT --> ANN
  CAN --> CV["body-canvas
人体 / 标注 / 参考覆盖"]
  ANN --> CV
  PL --> CV
  OLD["result
兼容重定向"] --> ANN
  DBG["atlas-debug
仅开发"] --> CV
```

![渲染图](page-modules.png)
