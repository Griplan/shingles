# 当前图谱差异与实际数据链路

## 源码与数据路径

1. `docs/research/v3-atlas/goran-{front,back}.original.svg`：固定原始字节。
2. `scripts/prepare_atlas.py::source_paths/source_outline`、`scripts/svg_geometry.py`：从指定主图组递归提取/变换/解析填充与绘制顺序。
3. `data/atlas/goran-2022-preview-v1/source-map.json`和registration.json：V3人工核验标签、排除与横截面配准；父版原样归档。
4. `scripts/prepare_atlas_extensions.py` + `data/atlas/goran-2022-preview-v2/local-registration.json`：继承父版，局部新增正面V1/V2/V3及L4/L5/S1可见足背；前54、后60。
5. `data/atlas/goran-2022-preview-v2/front.json/back.json`：当前权威人体归一化MultiPolygon；atlasVersion=goran-2022-commons-template4-preview.2，template=commons-neutral-v1/4.0.0、geometry=commons-blank-cc0-v1。
6. `scripts/sync_atlas.py`：七输入内容SHA→`miniprogram/data/atlas.generated.ts`；本轮--check验证完全一致。
7. `components/body-canvas/atlas-render.ts`、state/matching-session.ts：同源region ID显示/高亮及身份核对；不是另一套手工几何。
8. `backend/app/services/atlas_service.py`：固定注册目录，重新检查SHA/模板/医审/绑定，加载同一front/back JSON；`dermatome_matcher.py`执行既有Shapely交集/并集。算法本轮不修改。
9. `data/body/commons-template4.json`：从V2真实人体hitOutline同步，含源代码指纹；本轮独立--check通过。

## 完全未采用的主图Path

| 视图/Path | 含义 | 当前遗漏位置 | 分类 |
|---|---|---|---|
| 前29/30/31 | C6–8、C8/T1掌侧 | source-map有标签，registration显式整体排除 | 有源组合几何、缺模板配准；独立C6/C7/C8边界本身不足 |
| 前39/40 | S4/S3前会阴 | 显式排除 | 源局部存在；中性模板对应不可靠，完整隐面仍缺 |
| 后21 | V1主后头皮 | source-map显式excluded | 技术/模板配准未实施，不是原图无V1 |
| 后28/29/30/31 | C6–8远端指背/拇指片 | 手部窗口裁切 | 可见表面提取未支持，不能变成掌侧独立三分区 |
| 后39/42 | C8/T1手背尺侧 | 手部窗口裁切 | 同上 |
| 后43/44 | L5/S1足底 | y842截止，V3.1未追加 | 有真实源面；独立足底配准可修复 |
| 后35 | 原字样C1 | 无标签导出 | 医学语义待核实，不是正常技术遗漏 |

共前5、后10条主图Path完全未引用。**另有部分采用的路径仍被裁掉远端**，包括前p28/32、后p20/41/47/48的腕手段及后p36/49踝下段；逐路径源域保留/排除面积在path-inventory.csv。正面面部还受目标头发、眼口、耳部等不支持窗口影响。两张图共14条头侧插图路径不用于主人体。

## 真缺失、技术缺失及文字遗留

- 未发现因wx绘制漏用或前后端副本不同而消失的区域；同步、来源引用和当前几何校验通过。
- 存在“源有而项目未实现”的明确排除，上表已定位到生成/配准阶段。它们不应统称为Goran缺失。
- “完整独立掌侧C6/C7/C8”、抬臂腋窝、完整内侧腿面/会阴底面等，不能单靠提取脚本补齐。
- 当前source-map/registration部分描述继承V3.0“颅神经/足部未配置”措辞；应以V3.1 local-registration和实际front/back为准。它是历史元数据措辞遗留，**不是当前正面足部仍为空**。本轮不改生产JSON或历史记录，审计报告明确纠正阅读方式。
- 未发现无sourceRefs的生产区域，未将来源追溯通过表述为临床正确。Servier独立掌图谱的6区并不计入全身114区。
