# 05 系统架构

> 文档基线：2026-11-19；代码基线为 Git `27b41f6` 加当前未提交工作区。代码、部署和真机状态分层记录，以当前源码与实际证据为准。

## 5.1 总体架构

```mermaid
flowchart TB
  User[手机 / 微信开发者工具]
  MP[微信原生小程序]
  APIS[FastAPI API]
  MATCH[图谱与匹配服务]
  AIS[可选 AI 会话服务]
  SAM[MobileSAM CPU/MPS]
  BODY[人体模板与图谱 JSON]
  TMP[私有临时照片目录]
  NGX[Nginx / 受控入口]

  User --> MP
  MP -->|健康/匹配/AI| NGX
  NGX --> APIS
  APIS --> MATCH
  APIS --> AIS
  MATCH --> BODY
  AIS --> SAM
  AIS --> TMP
```

核心原则是“人工标注和几何匹配必须能在 AI 不可用时独立运行”。

## 5.2 小程序内部分层

```mermaid
flowchart LR
  Pages[页面层] --> Components[Canvas 组件层]
  Pages --> Stores[运行期状态 Store]
  Components --> Utils[坐标与几何纯函数]
  Stores --> Types[TypeScript 数据契约]
  Pages --> Services[API / AI 服务封装]
  Services --> Config[环境与服务地址]
  Utils --> Generated[人体/图谱生成数据]
```

页面不应直接修改原始 Mask 或图谱。它们通过 store 和纯函数获取新状态。

## 5.3 后端调用链

```mermaid
flowchart TB
  R[HTTP Request]
  B[AccessBoundary / AIBoundary]
  P[Pydantic Schema]
  L[Fixed Atlas Loader]
  G[Shapely Geometry]
  M[Matcher]
  E[Error Envelope / Response]

  R --> B --> P
  P -->|evaluate| L --> G --> M --> E
  P -->|body-intersection| G --> E
  P -->|AI| A[AI Session Store] --> E
```

`GET /atlas` 仍是历史 501 占位；当前没有通过该接口把完整图谱暴露给客户端。图谱主要随客户端生成包发布，后端使用固定路径和身份校验。

## 5.4 端到端人工标注流程

```mermaid
sequenceDiagram
  participant U as 用户
  participant P as annotate 页面
  participant S as annotationSession
  participant API as FastAPI
  participant M as Shapely matcher
  U->>P: 点击人体取点并闭合
  P->>S: dispatch(add/close/review)
  S-->>P: 新 revision 与完整几何
  U->>P: 完成标注
  P->>S: review
  P->>API: POST /evaluate
  API->>M: 版本校验 + 交集 + 并集
  M-->>API: 候选/覆盖
  API-->>P: 200 响应
  P-->>U: 人体高亮和标签
```

## 5.5 AI 端到端流程

```mermaid
sequenceDiagram
  participant Mini as 小程序
  participant API as FastAPI
  participant Store as AI Session Store
  participant SAM as MobileSAM
  participant Place as placementSession
  Mini->>API: 创建 AI 会话
  Mini->>API: 上传照片
  API->>Store: 安全解码、方向统一、去 EXIF
  Mini->>API: 框选提示 / segment
  API->>SAM: 单槽真实推理
  SAM-->>Store: Mask + 轮廓 + alpha
  Store-->>Mini: 候选摘要
  Mini->>API: confirm(candidate, revision)
  API-->>Mini: confirmed-photo-segmentation-v1
  Mini->>Place: 复制 MultiPolygon 与照片度量
  Place-->>API: 放置页首帧就绪后 DELETE
```

## 5.6 坐标边界

```mermaid
flowchart LR
  O[照片方向统一原图]
  P[photo_oriented_normalized_v1]
  B[body_template_normalized_v1]
  V[独立局部模板坐标]
  O -->|Mask/轮廓| P
  P -->|等比缩放+旋转+平移| B
  V -->|各自 template/geometry 校验| M[匹配]
  B --> M
```

虽然三套坐标都用 `[0,1]`，数值相同并不意味着位置相同。必须同时传递：

- `view`
- `templateId`
- `templateVersion`
- `geometryId`
- `regionSetId`
- `atlasId`
- `atlasVersion`
- 内容哈希

## 5.7 部署拓扑

```mermaid
flowchart TB
  Phone[微信小程序]
  Net[公网测试 HTTP 或正式 HTTPS]
  Nginx[Nginx]
  Acu[acupuncture.service :8000]
  Der[dermatome.service :8001]
  Timer[dermatome-cleanup.timer]
  Files[私有临时目录]
  Phone --> Net --> Nginx
  Nginx -->|原项目路由| Acu
  Nginx -->|/dermatome-test/| Der
  Der --> Files
  Timer --> Files
```

当前公网测试入口使用 HTTP，只适用于公开或合成照片。正式发布需要 HTTPS、合法微信域名和受控身份体系。

## 5.8 为什么不用单一大服务

原针灸项目和新项目共享服务器，但采用以下隔离：

- 独立代码目录；
- 独立 Python venv；
- 独立 systemd service；
- 独立端口；
- 独立资源限制；
- 独立日志；
- 独立回滚；
- 原 Nginx 路径不被默认修改。

这使 AI 推理、OOM 或发布失败不会直接停掉针灸服务。
