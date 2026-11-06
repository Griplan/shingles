# Commons 人体素材来源与整理说明

当前背景模板 `commons-neutral-v1 / 4.0.0`，仅用于人体浏览和工程交互，不是已审核的神经皮节图谱。

- 原文件：[Human body with blank labels.svg](https://commons.wikimedia.org/wiki/File:Human_body_with_blank_labels.svg)，Šlomo，2015-11-18，750×768。2026-10-22 实际查看文件预览和 Licensing，并获取原 SVG；[原样本地副本](source.svg)。SHA-256：`486cdc8a89fbfe0ff0a4bb4104efc19bb5c708337c37768be6f9120c4837753a`。
- 文件页面明确标注 **CC0 1.0 Universal**：[许可条款](https://creativecommons.org/publicdomain/zero/1.0/)。免费，允许修改、商业使用、复制和将衍生资源打包进小程序；没有强制署名或相同许可分发要求。保留本说明以便追溯。此判断针对本文件，不推广到所有 Commons 文件。
- 衍生链：[Human body with japanese labels.svg](https://commons.wikimedia.org/wiki/File:Human_body_with_japanese_labels.svg)，Digital Nomad（Michael W Harris），基于 Cdang；[Silhouette humain asexue anterieur posterieur.svg](https://commons.wikimedia.org/wiki/File:Silhouette_humain_asexue_anterieur_posterieur.svg)，Cdang（Christophe Dang Ngoc Chan）。这两个具体文件页面均有 CC0 声明，已逐页核对。未使用底层真人照片，也未下载其他受限素材。
- 编辑：只提取原前景人体组 `g5692`（正面，71 paths）与 `g5815`（背面，49 paths），不保留空标签/引线，不重画人体，不翻转正面冒充背面。保留原组内路径和变换。独立正背面形体有自然差异。
- 尺度：同一缩放 `1.1491108071135432`、同一垂直位移 `8.16689466484268`，各自水平居中，放在 400×900 透明逻辑画布。只处理留白/画布定位，无横纵不等比拉伸。
- 可编辑源：[front.svg](front.svg)、[back.svg](back.svg)。运行图片：[front.png](front.png)、[back.png](back.png)，均 1200×2700，黑线保留，封闭内部加统一浅色底，外部透明。
- 命中/高亮边缘：来自上述源图同尺度栅格，不是手工人体。alpha 阈值24，3×3 栅格闭运算只连接原散线的亚逻辑单位缝隙，再从外部漫水取得内部并跟踪边缘，以0.3逻辑单位简化。原始 SVG 路径没有因此修改；接近边缘的命中有栅格/简化容差，不宣称无限精度。
- [manifest.json](manifest.json)记录来源、作者、许可、两个原组、归一化及各文件哈希；[geometry.generated.ts](geometry.generated.ts)为同源命中轮廓。重新构建方法见[资源总说明](../README.md)。

没有强制署名不等于医学审核。CC0 不提供准确性或其他权利保证；本项目尚无专业医学审核。不得从这些表面线条推导正式皮节边界。当前空医学图谱保持禁用。
