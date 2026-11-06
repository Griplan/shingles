# 足底/全身结果标签文字不可见修复

日期2026-11-05。输入证据为用户截图和当前代码；未将截图像素当作解剖坐标。

## 原因

当前labels/rail.items正常保留label、name和ratio，WXML绑定字段正确。app.json启用style:v2；实际已安装微信SDK的WAWebview.js包含 `wx-button:not([size=mini]){margin-left:auto;margin-right:auto;width:184px}`。源规则及SDK摘要见sdk-default-style.json。

原足底 `.nerve-label` 仅一个class（优先级0,1,0），宽64px，被SDK选择器0,1,1压过；侧栏宽66px而按钮184px，居中文字在侧栏外被裁切，仅看到白底和色条。全身结果标签原先同样使用单class，具有同类冲突。此项由当前SDK代码和样式优先级确认，非从截图推测后端缺少名字。

## 修改

- 足底标签改为 `.label-rail .nerve-label`，优先级0,2,0，明确left:0、width:100%、height:44px、margin:0。文字和比例各自块显示，名称颜色明确；加上可读无障碍名称。
- 全身结果标签改为 `.rail .nerve-label`，保留原calc宽度与现有标签内容/选择逻辑。
- 未删除app的v2配置，不给全应用所有按钮加!important，不修改图谱、候选标签、覆盖率、标注、后端或匹配公式。

修改文件：miniprogram/pages/local-surface/local-surface.wxml、local-surface.wxss、miniprogram/pages/annotate/annotate.wxss；修改前副本见before/。

## 实际验证

- `npm --prefix miniprogram test`：335通过，0失败，见frontend-tests.log。
- `npm --prefix miniprogram run typecheck`：通过，见typecheck.log。
- 已安装微信工具的wcc/wcsc编译两个受影响页面的WXML/WXSS均exit0，见wechat-compiler.json；临时编译输出仅记录大小/摘要，不作为运行包提交。
- 原生界面尝试点击“编译”返回 `21 is an invalid element ID`，可访问树仍残留旧palm文件路径，与本轮代码不符。真实微信视觉/手机复测 **NOT_RUN**；编译器通过不能代替原生渲染验收。

用户需在开发者工具重新“编译”后进入脚底并计算；标签应显示实际返回的L5/S1或当前匹配项。若使用旧体验包，需重新上传修复后的前端；服务器已在上一轮同步，此次不用再更新服务器。未上传小程序、未访问/修改服务器、未提交或推送Git。
