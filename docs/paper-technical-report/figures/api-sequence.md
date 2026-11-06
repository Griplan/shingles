# 图 12：AI 确认、放置和计算接口时序

来源：本项目当前源码审计，2026-11-02；对应证据见上级 技术结论与证据索引.md。流程图不是医学验证结果。

```mermaid
sequenceDiagram
  actor U as 用户
  participant W as 微信页面
  participant A as 访问与AI会话
  participant S as MobileSAM单工作锁
  participant V as V2本地标注
  participant M as 匹配服务
  W->>A: 建立限时测试身份 / AI照片会话
  U->>W: 上传与框选
  W->>A: photo + segment（修订、request_id）
  A->>S: 定向照片、局部提示
  S-->>A: 真实候选 Mask
  A-->>W: 受保护预览、轮廓、警告
  U->>W: 切换 / 修正 / 确认
  W->>A: confirm 当前候选及编辑修订
  A-->>W: confirmed-photo-segmentation-v1
  U->>W: 人工移动、大小、方向并确认位置
  W->>V: 完整体表校验后提交人体几何
  U->>W: 计算（或确认位置并计算）
  W->>M: evaluate + 快照版本与哈希
  M-->>W: 几何覆盖、未覆盖、来源
  W->>W: 复核快照 / 拒绝过期响应
  W-->>U: 参考覆盖层及标签
```

![渲染图](api-sequence.png)
