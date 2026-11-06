# V3 图谱来源、配准与预览说明

**当前版本已增量升级为 preview.2。** 当前数据、面部/足部局部配准与重建命令见 [V3.1 说明](v3.1-atlas.md)。以下内容保留为 preview.1 历史实现说明，所列缺失范围和数量不是当前覆盖；不要运行旧生成命令覆盖已归档父版。

本文件说明当前实现与复现方法，不维护任务进度；实际命令与验收由[task.md](../task.md)引用证据。用户已接受V2，旧V3交集、覆盖率、候选排序移至后续未实施任务。本轮只制作独立图谱及开发预览，不读取病灶做计算、不改V2会话、不调用评估接口。

## 主来源与许可

Goran_tek-en，2022-09-24，同套成年男性正背面：

- [正面原文件及许可](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg)，原SVG SHA1 `d20be473843591779be22c102e193d8c1407861d`。
- [背面原文件及许可](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg)，原SVG SHA1 `261566ce5128fdc2cc536945c148ac1c8f62e66d`。
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)；具体文件页与作者、原始URL、访问日、修改声明见[来源记录](../data/atlas/goran-2022-preview-v1/sources.json)。来源页信息贡献者Rob Hurt不是本项目医学审核人。

已实际查看两份SVG及标签，原文件指纹与Commons记录相符。原始文件保存在`docs/research/v3-atlas/`，运行时不请求外网。提取、配准、排除及简化是修改：派生图谱、记录和生成副本继续CC BY-SA 4.0，分发需保留作者、来源、许可链接及修改说明，不能暗示原作者认可本配准。见[随数据分发的NOTICE](../data/atlas/goran-2022-preview-v1/NOTICE.md)。当前人体CC0许可不变，独立应用代码不因本说明自动改许可。

优先核对了Servier正面、背面、条款与署名页：许可说明CC BY 4.0，但网站条款限制自动访问内容，因此未继续自动下载，也不宣称看过其原图。备用Ralf Stephan的Dermatoms.svg原件已查看，该文件的公共领域声明已核实，但只有半面、渐变合并轮廓，未采用其边界。Lee等2008论文只查阅PubMed摘要，用于提示图谱差异，未复制其图像。没有拼接不同来源的医学边界。

## 当前绑定与数据约定

图谱版本：`goran-2022-commons-template4-preview.1`。人体保持`commons-neutral-v1 / 4.0.0`、geometry `commons-blank-cc0-v1`、400×900逻辑画布、原PNG/命中轮廓、原归一化公式和UI区域版本。

每个实例有唯一id、独立labelId、view、人体解剖学side、模板/几何版本、分区类型、MultiPolygon、sourceRefs及原路径索引、制作与审核状态。颜色只显示。坐标为原画布归一化值，闭合环末点显式等于首点。每polygon首环是外环，后续环是孔洞；外环正面积、孔洞反向，适配Canvas默认nonzero填充。源SVG使用evenodd规则，提取阶段先解析为实际有效面；不能直接假设它和Canvas环方向相同。多片保留，不用凸包，不跨空白连接。

来源与许可verified；技术状态由实际离线校验记录；**medicalReviewStatus=pending、mappingEnabled=false**。开发页明确提示“开发预览，尚未完成医学审核”。技术测试不等于医审、临床有效性或诊断能力。

## 实际覆盖

| 视图 | 已配置标签 | 侧别实例 |
| --- | --- | --- |
| 正面 | C2、C3、C4、C5、C6、C8/T1；T1–T12；L1–L5 | 46，23标签 |
| 背面 | C2–C8、C6-C8、T1/T2；T1–T12；L1–L5；S2–S5 | 60，30标签 |

编号范围只是上述实际存在标签的简写，数据不按编号自动补全。组合C6-C8、C8/T1、T1/T2保留源标签含义，不拆成虚构的独立节段。两面源标签各自核对；正面未出现独立C7/C8不强行生成，背面缺失C8/T1不会复制正面。

几何包含正面49片/11孔、背面71片/2孔。每个来源标签、视图、左右、多片、状态与排除原因由[覆盖清单](../data/atlas/goran-2022-preview-v1/coverage.json)维护；每条原路径的标签或排除理由见[source-map](../data/atlas/goran-2022-preview-v1/source-map.json)。

明确未配置：颅神经V1/V2/V3、独立头侧插图、源图尾骨处歧义“C1”（不能擅自改为Co1或颈神经C1）、远端手掌/手指、足/趾、正面会阴。手足姿势与可见面不能可靠对应，因此S1仅足部路径两面均留空；正面S3/S4会阴路径留空；正面C6-C8远端手腕及手部路径排除，背面C8/T1掌侧路径排除。相同标签有可靠近端片区时仍保留近端。留白不代表没有感觉神经。此数据不是外周皮神经图，也不把粗UI区域当作皮节。

## 提取与配准

1. 固定原件校验和，只读取当前实际着色人物分组的42/50条填色路径，排除旧隐藏图层、图例、字样、头侧插图。人工核对标签、引线端点及对应路径，组合标签不按颜色/编号顺序猜测。原标签位置证据见[source-label-points](validation-records/v3-atlas/source-label-points.txt)；“前一文字上下文”不自动认定为引线标签。
2. 原SVG的evenodd填色、嵌套变换和实际绘制顺序转成有效面，保留可见区域、孔洞和不连续片区。自交不能用凸包或buffer修补。
3. 两面分别用原SVG**完整人体底层轮廓**对应目标人体轮廓，不能用区域填色的制造细缝当成身体空白。记录头颈、肩胸、腋下分离、腰、骨盆、裆、膝、踝对应高度。逐横截面对各连续体表段作单调分段对应，再迁移实际源分区边界；不是非等比拉伸彩色整图，也不是平均分割T段。
4. 原曲线采样平直误差0.12源单位，变换边界自适应至0.001目标逻辑像素，最大初始间隔0.5源单位。目标简化误差实测不超过0.01逻辑像素，并保留拓扑；不丢弃狭长节段。极小数值碎片阈值及所有排除写入registration。
5. 对目标体表作明确的表面适配，记录**裁切前**超出面积，不能以运行时clip伪装配准。正面约58.155、背面107.350逻辑像素²，约占各已配准面积0.059%/0.093%；最大单路径损失低于5%，主要是头颈边缘/体表曲线差异，仍需专业复核。简化后体外面积约0.00135/0.00056逻辑像素²。采样简化引入的总内部微重叠约0.412/0.431逻辑像素²，报告逐对列明，不声称数学完全无缝或医学互斥。
6. 此模板工程中线由现有BODY_LANDMARKS核对为x=200，登记为版本专属中线；源两侧均保留后拆分侧别，没有镜像复制。正面屏幕左=人体右，背面屏幕左=人体左。正背面独立数据，不能交换。

全部控制行、排除表、采样阈值与配准方法在[registration](../data/atlas/goran-2022-preview-v1/registration.json)，原路径可见面积、裁切前损失和简化量在[registration-report](../data/atlas/goran-2022-preview-v1/registration-report.json)。控制点是图像工程参考，不是医学标准点。男性来源迁移到中性模板存在体型/姿态差异，尚无专业医学配准确认。

## 唯一源与生成流程

权威目录`data/atlas/goran-2022-preview-v1/`。`source-map.json`和`registration.json`是可编辑的制作输入；原SVG固定；front/back、coverage、registration-report为确定性派生结果。小程序副本`miniprogram/data/atlas.generated.ts`只能由同步脚本生成，文件有禁止手工编辑标记。不要人工维护第二套区域。

根目录执行：

```bash
backend/.venv/bin/python scripts/prepare_atlas.py
python3 scripts/sync_atlas.py
backend/.venv/bin/python scripts/check_preview_atlas.py
python3 scripts/sync_atlas.py --check
backend/.venv/bin/python scripts/test_atlas_geometry.py
npm test --prefix miniprogram
```

只使用现有TypeScript和Shapely环境，无新运行时依赖。同步校验覆盖前后面、来源、覆盖清单和制作输入SHA256；校验器检查绑定、标签索引、合法环/孔、侧别、裁切前后面积、简化误差与制造重叠。后续更改数据需重新生成并保留新版本记录。

## 页面与隔离

首页“神经图谱测试”→默认正面全量→背面→分区列表选T5→人体左右筛选→放大所选→返回全身。单标签选取保留当前视口；换面保留标签，有缺失则显示“此视图暂无该区域”且无旧图残留。全部只指当前配置的分区，隐藏覆盖层仍保留人体。可清除选择、开关标签、展开来源/版本/许可与未配置说明。

集中配置在`miniprogram/config/development.ts`。目前只允许`envVersion=develop`；trial、release、未知、调用异常均默认关闭。`DEVELOPMENT_FEATURES.atlasPreview=false`同时关闭首页入口和页面内访问/动作；不读query授权。不使用患者标注页放预览状态。

复用body-canvas及原coordinate，通过默认null的atlas/focusBounds参数接入，默认V1/V2无覆盖。高亮使用真实MultiPolygon，不填focusBounds；focus仅复用focusViewport，边线保持CSS像素。标签碰撞时略去部分字样，可从列表查看。测试页不导入annotation-session、不创建病灶或进入结果页，也不发起网络请求。

packOptions.include显式登记测试页目录。本机工具依赖分析仍误过滤新页面，清编译/文件列表缓存及重开项目后未恢复；将项目的ignoreDevUnusedFiles设false（本机private同名覆盖也改false）后真实页面恢复。此选项只关闭开发构建的无依赖文件剔除，不关闭类型检查、域名校验或发布环境访问保护；上传设置没有修改。换机器若private将该项覆盖为true且出现同类错误，按真实控制台确认后修正，不清空模拟器用户数据。实际效果由GUI证据记录，不能由静态配置推定。

## 验核与限制

自动测试和GUI记录由task.md索引。原始资源与叠加对照在[离线对照图](validation-records/v3-atlas/source-registration-comparison.png)，是资源预览，不能冒充微信运行截图。必须分别记录开发者工具真实渲染、真机、其他屏幕和医学审核状态。

[肩腋、前臂腕部、膝踝局部对照](validation-records/v3-atlas/key-sites-comparison.png)使用同一原始图像和配准矢量，只改变查看窗口，未改变人体或边界。`preview_atlas.py`可重建这些SVG；本机PNG用既有Sharp渲染，Sharp只作为可选证据工具，不是小程序运行依赖。

人工验收：正背全量→T5单区→左右筛选→标签开关→聚焦复位→背面S5再切正面检查缺失→退出重入→V2已有草稿/闭合/撤销/删除/两面/返回恢复；再验证总开关false及发布环境直接路由阻断。当前atlas/evaluate后端仍501，后续病灶匹配、交集、候选排序未实施。
