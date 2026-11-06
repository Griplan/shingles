# 手掌底图来源与授权

本目录的 palm-left.svg/png、palm-right.svg/png 来源于 Wikimedia Commons 的 [Gray1237.svg](https://commons.wikimedia.org/wiki/File:Gray1237.svg)，由 Rhcastilhos 根据 Gray's Anatomy 第1237图矢量化；原始插图署名 Henry Vandyke Carter。

矢量作者已将作品向全世界释放至公有领域；在不能放弃著作权的地区，页面同时给予任何用途、无条件使用许可。证据：[文件许可段落](https://commons.wikimedia.org/wiki/File:Gray1237.svg#Licensing)。并非依据 Commons 网站整体许可推定。

本项目修改：仅提取原始掌面外轮廓和皮肤褶皱路径；移除骨骼、动脉、引线和文字；截取腕口；统一画布、淡色填充和细线；镜像生成另一侧。没有手工拼接手形，没有由血管线推断神经皮节。

原文件、文件哈希、复现脚本和尺寸说明：`data/sources/palm-v1/`、`data/body/palm-resource.json`。这些是显示底图与表面命中轮廓，**不是神经皮节边界**。

## 左右更正（2026-11-04）

原Gray1237.png图注明确为左掌，与未镜像SVG一致。五指朝上、掌心朝向观察者：左掌拇指在画面左，右掌在画面右。1.0.0的左右分配错误已在1.1.0纠正：左掌保留原轮廓，右掌由x→440−x镜像生成；图片、命中面及前后端身份同步，不复用旧版标注。神经图谱仍无边界，未提高审核状态。
