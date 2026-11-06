# V4 失败、修正与未完成记录

2026-10-26。本轮所有输入为合成几何或规范图谱，没有患者资料。

1. 首次TypeScript检查 FAILED：matching-session.ts中Array.isArray收窄后every回调id变为隐式any（TS7006）。加显式string注解；后续typecheck与143项测试通过。最早错误在会话工具输出，未另存原终端文件；本文件为错误摘要。
2. 首次本机服务/微信CLI在沙箱内启动 FAILED：127.0.0.1监听EPERM。使用已授权的本机执行后Uvicorn成功。微信CLI进一步提示IDE service port disabled，未开启安全设置，改用项目菜单打开已有Shingles。没有更改另一个项目。
3. 首次HTTP页面联调受沙箱网络限制失败（http-sandbox-failure.txt）；允许本机连接后开始真实联调。
4. 联调发现业务状态缺陷：有旧结果→新增草稿→闭合，key曾被清空导致状态回idle，丢失“需要重新计算”提醒（first-http-state-failure.txt）。修复refresh保留stale，增加专用回归，最终通过。
5. 第二轮联调夹具错误：结果页切回front只改变显示，V2当前面仍为back；测试在背面画了“正面头发”三角导致partial（second-http-fixture-failure.txt）。业务正确保留两面独立；测试显式切换V2面后再画，未修改图谱或期望容差。最终前面头发为none。
6. 批量文档更新首次命令失败，stdin出现Non-UTF-8 SyntaxError，解析阶段未写文件。拆分小文件/补丁后成功。
7. 静态project检查首次 FAILED：旧规则强制每页有navigator标签（first-project-failure.txt）。V4结果页实际使用backToEdit保留会话。改为专门验证result的绑定、处理函数、navigateBack和带sessionId的annotate回退路径；其他页面原规则保留，真实页面定义的返回编辑也由HTTP联调验证。
8. 后端保留一条既有Starlette/httpx弃用警告，不为消除警告新增依赖；不影响47项通过。
9. 微信实际V4流程 NOT_RUN：工具重开后能加载V4首页，但AX点击未导航，截图与辅助树部分内容不一致，坐标操作报noWindowsAvailable。未保存/冒充V4结果页运行截图；详见gui-validation.md。真实手机和多尺寸触摸仍NOT_RUN。
