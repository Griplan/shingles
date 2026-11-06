# 图 10：人工标注数据流程

来源：本项目当前源码审计，2026-11-02；对应证据见上级 技术结论与证据索引.md。流程图不是医学验证结果。

```mermaid
flowchart LR
  A["选面 / 部位"] --> B["Canvas触摸
屏幕→人体坐标"]
  B --> C["草稿点 / 撤销 / 闭合"]
  C --> D{"环及体表合法"}
  D -->|"否"| C
  D -->|"确认"| E["annotationSession
稳定ID + 修订"]
  E --> F["匹配快照
POST evaluate"]
  F --> G["参考覆盖与标签"]
```

![渲染图](manual-workflow.png)
