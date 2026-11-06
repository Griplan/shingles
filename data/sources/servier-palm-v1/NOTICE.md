# Servier 掌侧皮节参考来源

核验日期：2026-11-04。机构：Servier Medical Art / Les Laboratoires Servier。

- 原始页面：https://smart.servier.com/smart_image/dermatomes/
- 原始素材包：https://smart.servier.com/wp-content/uploads/2016/10/SMART-Nervous-system.pptx
- 官方 PNG：https://smart.servier.com/wp-content/uploads/2016/10/Dermatomes1.png
- 许可：https://creativecommons.org/licenses/by/4.0/
- 授权证据：https://smart.servier.com/how-to-cite-servier-medical-art/
- 移动应用及商业修改说明：https://smart.servier.com/using-smart-images-what-you-can-do/

上述官方页面明确允许署名后的修改、商业用途和移动应用使用；不是仅依据可下载推定许可。需保留来源、许可链接及修改说明，不暗示 Servier 背书。

Image adapted from Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

`original.pptx` 保留原始下载字节，SHA256：`b6f10318613415bdcfed5503d7a082435f3641f87f66b39587c4b522664a7ebc`；`official-preview.png` 保留官网 PNG 字节，SHA256：`bf3908d0e23aa73d7868431d7b800705aefe2d37e521b4bf0959e64e8abd8f3b`。

采用第26页前面观 group 71682：外形71995，分界曲线72147、72148，C7/C8标签72039、72041；C6区域与原图标有C6的前臂连续。没有用外周正中/尺/桡神经区域改名。图示右掌五指向下，作为独立右掌显示时旋转180°，拇指在右。

修改：仅提取原始边界、截取掌腕范围、将其配准到已存在的 Gray 手掌模板、生成左侧镜像；未改变 Gray 模板、原全身图谱或匹配公式。配准方法、原坐标、源路径ID和控制点存于 `data/atlas/palm-v1/registration.json`；可执行 `scripts/build_palm_atlas.py` 检查重现。

源图属于教学示意图。商业许可不等于医学审核；个体皮节重叠、变异及配准有效性没有临床验证。当前仅为参考预览，`medicalReviewStatus=pending`、`mappingEnabled=false`。

`palm-atlas-preview.svg/png` 是实际运行资源和图谱生成的静态预览，不是微信运行截图。手掌展示来源另见 `../palm-v1/NOTICE.md`。
