# 来源与许可

## 展示参考

- 文件页：[File:Perineum.png](https://commons.wikimedia.org/wiki/File:Perineum.png)
- 作者：Omega658
- 许可：CC0 1.0
- 许可文本：[Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- 本项目用途：仅作为会阴观察范围、方向和组织关系的一般视觉参考。

本项目没有复制该照片的像素、轮廓 Path、纹理或标注。实际运行 SVG、PNG、皮肤轮廓和所有模拟区域均由项目生成器原创绘制。

## 项目原创矢量

- 源文件：`miniprogram/assets/perineum/perineum-overview.svg`
- 运行时图片：`miniprogram/assets/perineum/perineum-overview.png`
- 生成器：`scripts/build_perineum_schematic.py`
- 渲染器：`scripts/render_perineum.cjs`
- 作者标记：`dermatome-mapper project`
- 许可标记：CC0 1.0

模型为中性后下方示意，包含骨盆周围、中央肛门区和内侧大腿上下文。它不显示具体男女外生殖器，不是完整会阴环周，也不是三维解剖模型。

## 图谱边界

模拟图谱来源类型为 `ARTIFICIALLY_CONSTRUCTED`，边界体系为 `schematic_skin_partition`。S2–S5 是人工布置的交互分区符号，没有对应的 Goran、Servier 或其他来源皮节 Path 提取。

`UNDEFINED` 是明确的“模拟未定区”。它参与几何计算和高亮，以便演示任意有效皮肤位置都能得到模拟反馈，但不表达骶神经支配结论。

## 许可与医学状态分离

素材和代码许可已核实，不等于医学边界已经审核。图谱继续保留：

- `reviewStatus: NOT_MEDICALLY_VALIDATED`
- `medicalReviewStatus: pending`
- `mappingEnabled: false`
- `intendedUse: INTERACTIVE_SIMULATION`
