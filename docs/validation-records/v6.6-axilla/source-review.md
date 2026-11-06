# V6.6 来源调查与许可（2026-11-05）

本轮实际查看了素材预览和文件许可页。结论：找到可合法制作局部体表示意的显示资源；**没有找到足以为当前抬臂观察窗建立可靠皮节多边形的边界证据**。不能把许可可用与解剖配准可用混为一谈。

## 显示素材

| 原始素材 / 作者 | 许可证据 | 实际判断与用途 |
|---|---|---|
| [MaleArmpit1.jpg](https://commons.wikimedia.org/wiki/File:MaleArmpit1.jpg)，Roquex | 文件页CC0 1.0，可修改、商用、分发，不强制署名；本项目保留归属 | **采用显示衍生**。原图4000×3000，作者明确右腋下；局部抬臂、褶线和近端上臂/胸侧可见。没有完整肩帽，不能补称全肩解剖模板 |
| [Thomson plate 12–13 side view arm raised](https://commons.wikimedia.org/wiki/File:Thomson_plate_12-13_-_side_view,_arm_raised.webp)，Arthur Thomson，Henry Frowde，1896 | Commons公共领域、作者逝世超过100年 | 曾制作试稿，目检发现偏后侧，腋窝中央不足；**弃用**，保留rejected-thomson及原因 |
| [LaserArmpit1.jpg](https://commons.wikimedia.org/wiki/File:LaserArmpit1.jpg)、[Axila1.jpg](https://commons.wikimedia.org/wiki/File:Axila1.jpg)，Roquex | 文件页CC0 | 已查看，裁切过近、姿态上下文不足，未作为运行资源 |
| [Gray1215.png](https://commons.wikimedia.org/wiki/File:Gray1215.png)，Henry Vandyke Carter / Gray，1918 | Commons公共领域 | 胸壁后外侧与横举臂；腋窝未充分展开，未采用 |
| [Axillary lines.svg](https://commons.wikimedia.org/wiki/File:Axillary_lines.svg)，Mikael Häggström / Gray背景 | Commons公共领域 | 腋线定位，不是皮节面；不转换为神经区域 |
| [Gray1218.png](https://commons.wikimedia.org/wiki/File:Gray1218.png) | Commons公共领域 | 实图是心脏胸壁投影，不适用于本轮，排除 |

原文件在 `docs/research/v6.6-axilla/`；只有两张衍生透明 PNG 和可编辑 SVG 进入小程序资源目录。正式采用的原图SHA256见[资源许可](../../../miniprogram/assets/axilla/NOTICE.md)。文件页固定版本：[MaleArmpit1 oldid=1235200142](https://commons.wikimedia.org/w/index.php?title=File:MaleArmpit1.jpg&oldid=1235200142)。原文件下载链接经Commons文件重定向取得；直连上传域名曾超时，没有将失败当下载成功。未上传照片到任何AI服务。

## 神经资料与可复用边界

| 来源 | 核查结论 | 图像许可 / 本轮处理 |
|---|---|---|
| Goran_tek-en，2022，[正面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg)、[背面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg) | 真实T1、T2、T3及T1/T2路径可复核，但垂臂图不能证明抬臂后隐面边界 | CC BY-SA4.0；保留作者、链接、修改记录，相应审计衍生图同许可；没有导入腋下运行图谱 |
| Baglien、Varacallo，[Cutaneous Innervation](https://www.ncbi.nlm.nih.gov/sites/books/NBK545249/?report=printable)，2023更新 | 用于辨别皮神经、神经根和体表感觉关系，不提供当前姿态可直接采用的闭合边界 | StatPearls CC BY-NC-ND4.0，不据此把教材图改编打包进商业项目；仅阅读并链接 |
| Herekar、Bordoni、Daly，[Intercostobrachial Nerves](https://www.ncbi.nlm.nih.gov/sites/books/NBK557619/)，2023更新 | 肋间臂神经通常与T2相关，可有T1/T3变异；**外周神经走行不等于皮节面** | CC BY-NC-ND4.0；不复制或数字化插图 |
| Rajendran等，[Surface Anatomy and Sensory Evaluation of Dermatomes](https://pmc.ncbi.nlm.nih.gov/articles/PMC12097171/)，2025，DOI10.21315/mjms-09-2024-738 | 文本涉及T1内侧前臂/远端上臂、T2近端内侧上臂/腋窝、T3较低邻近胸壁；Figure1为感觉检查点，不是区域轮廓 | 文章CC BY4.0；图示还有ASIA改编来源，点位不能自动转Polygon，本轮不复制其图 |
| Jordan Wiggins、Seervai，[DermNet Dermatomes](https://dermnetnz.org/topics/dermatomes)，2020 | 用于了解图谱差异与重叠，不提供当前观察窗的配准控制点 | 配图注明其他图片来源，未取得足够复用许可证据，图片许可记UNKNOWN；不下载/导入 |

以上医学条目只作短摘要和来源索引。没有使用教材图描绘T1/T2/T3三块，也没有将感觉检查点扩张成面积。来源可支持研究方向，不足以证明任一腋下目标Polygon。需要具有合适姿态、明确许可的参考区域图及专业审核，才可能继续配准。
