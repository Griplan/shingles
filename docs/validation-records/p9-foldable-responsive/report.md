# P9 微信小程序响应式双形态布局

2026-11-10。本地实现方案 B：窗口宽度低于 680 px、或高度低于 520 px 时保留单栏；宽高均达标时，人体或照片在左，操作与结果在右。480 px 起限制加宽单栏的字号和内容宽度。以可用逻辑窗口为准，不识别具体机型。

现有人体、匹配、AI 分割、AI 放置及脚底、腋下、会阴工作页都复用该布局。手机保留原有侧边神经标签；宽屏在右栏用同一候选和选择处理函数渲染标签、筛选及操作。画布重测只更新显示，标注、会话、匹配结果、照片和图谱版本不因布局改变而重建。未完成的拖框、画笔、贴片拖动和滑杆操作在尺寸变化时取消；已完成的调整及已保存标注保留。

| 验证 | 实际结果 |
| --- | --- |
| TypeScript / Node 前端回归 | PASSED，384/384 |
| 后端与 AI 回归 | PASSED，322/322，7 条既有依赖警告 |
| 微信自带 WXML / WXSS 编译 | PASSED，14 个 WXML 一并编译、15 个 WXSS（含 app.wxss）逐文件编译 |
| 项目、图谱同步、分包和体积 | PASSED；主包 0.817 MiB，clinical 1.320 MiB，special 0.721 MiB |
| 微信开发者工具 2.01.2510290 | iPhone X 与 iPad 预设首页实际显示；编译后调试器 Errors 0。进入工作页未成功，宽屏完整交互 NOT_RUN |
| 真实折叠屏、键盘与系统安全区、设备内存和 FPS | NOT_RUN / NOT_MEASURED |

相关说明：[布局](layout-design.md) · [坐标](canvas-coordinate-validation.md) · [尺寸事件](resize-lifecycle.md) · [AI 与特殊部位](ai-and-special-views.md) · [性能和回归](performance-and-regression.md)。

主要文件：`miniprogram/app.json` / `app.wxss`；人体选择和各工作页的 WXML/WXSS；共享 `utils/canvas-size.ts`；人体、照片、放置和局部画布组件，以及放置草稿状态。未改医学数据、计算公式、AI 模型、照片处理链路、后端或云端配置。未上传体验版。
