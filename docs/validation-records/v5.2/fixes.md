# 实际问题与修复

- 初次类型检查FAILED：Canvas context类型名称错误；改用项目已有的CanvasRenderingContext2D类型后通过。
- 真实微信拖框出现 touchcancel cancelable=false 渲染错误。取消事件改为 bind 监听，不尝试阻止不可取消事件；绘制时仅尺寸变化才重设Canvas backing store，拖动不反复重建。修复后需复测。
- 工具CLI端口关闭，未自动开启安全设置；改从已有项目菜单打开本项目。

- 完整重新编译后自动拖动仍触发工具层touchcancel；用户手动框选成功，真实候选生成。自动坐标点击也偏移，用户补充前景/背景点成功后再次分割。单独记录自动化限制，不再修改照片坐标去迎合自动工具。
- 微信实际运行发现父页面更新期间，Canvas属性observer同步回报renderstate导致recursive update warning。改为wx.nextTick并过滤过期/重复回报；不改变模型或提示坐标。

- 修复后完整重新编译，公开照片上传、前景/排除模式、取消、合成图重新上传均通过；AX Errors0，无新的recursive update警告。仍有wx.getSystemInfoSync弃用、开发工具已有域名校验设置提示及平台warning，未为本轮关闭安全校验。修复前的截图保留，不冒称当时没有warning。
- HTTP脚本收尾增加新输出目录参数与时间戳默认值，summary写入新输出目录，避免后续复现覆盖此次历史记录。帮助/语法检查通过；未冒充新的推理实验。
