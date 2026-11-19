# P11.2 回归记录

## 实际执行

| 检查 | 结果 | 证据 |
|---|---|---|
| TypeScript | PASS | `evidence/typecheck.log` |
| 小程序前端测试 | 422 / 422 PASS（跨 transient layout revision 握手与画布占位补丁后复跑） | `evidence/miniprogram-tests.log` |
| 后端与 AI | 330 / 330 PASS，7 条既有警告 | `evidence/backend-ai-tests.log` |
| 项目结构 | PASS | `evidence/project-check.log` |
| 图谱哈希 | PASS | `evidence/atlas-check.log` |
| 分包引用与体积 | PASS | `evidence/package-check.log` |
| WXML `wcc` | exit 0，48,539 bytes | `evidence/wcc.stdout`、`wcc.stderr` |
| WXSS `wcsc` | exit 0，831 bytes | `evidence/wcsc.stdout`、`wcsc.stderr` |
| `git diff --check` | PASS | `evidence/diff-check.log` |

## 关键专项覆盖

- 同源缓存复用、Mask/几何变化失效、序列化副本不可信。
- 快速人体校验与完整校验在有效、人体外、多角度和多缩放下的结果一致。
- 真实 6018 顶点、389 片区、301 孔洞样本完整保留。
- 120 次 partial update 不执行变换或校验。
- 松手执行一次变换和一次快速人体校验。
- 确认不会重复完整内部拓扑校验，但仍重新变换、校验人体并比对几何。
- 拖动开始/结束事件各一次，移动事件不跨组件桥。
- waiting、error、ready 和 retry。
- waiting 在页面尚无 viewport 时仍可被识别。
- ready 回执携带实际绘制 viewport 和 layout revision；旧布局迟到帧不能覆盖新布局。
- 有效 ready 回执不因生命周期的 transient layout revision 变化而被丢弃，旧几何 viewport 仍被拒绝。
- PNG 未就绪时使用同一模板轮廓占位，并发布可用于放置坐标的 viewport。
- 首次 watchdog 只重试一次，第二次才报告超时。
- 首次 ready 后 revision 更新不恢复阻塞遮罩。
- 替代 Canvas、矢量 fallback、页面隐藏/显示和来源切换。

## 未验证

- 微信开发者工具本轮原生拖动和确认点击。
- Android/iOS 真机首帧、FPS、触摸延迟和内存。
- 低端 Android CPU 上 6018 顶点同步准备耗时。
- 折叠屏展开/合上时的实际 Canvas 重布局。

以上状态为 `NOT_RUN`，未用 Node 或静态编译代替。
