"""Compose audit reports from measured JSON; writes only the audit directory."""
from pathlib import Path
import json,re,html,csv
A=Path(__file__).resolve().parents[1];E=A/'evidence'
def read(n):return json.loads((E/n).read_text())
def write(n,s):(A/n).write_text(s.strip()+'\n')
summary=read('summary.json');inv=read('metadata/all-22-inventory.json');labels=read('label-inventory.json')
verified=sum(x['status']=='BYTES_VERIFIED' for x in inv)
source_front='https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg'
source_back='https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg'
write('01-source-inventory.md',f'''# 原始来源、版本与许可

审计日期：2026-11-05。官方[系列图库](https://commons.wikimedia.org/wiki/Dermatomes_3D_shaded_true_SVG)列出22份作品，本次取得全部22份官方文件元数据，{verified}份原始字节已校验。本次22份均已补齐原件与SHA-256，不用文件名替代内容核验。

用户指定的正面、背面、男性有标签组合、男性无标签组合、男女有标签母版**五份均已取得并实际解析/渲染**；还取得男女无标签母版。原下载曾报DNS限制及HTTP429；间隔后补取优先文件，失败记录保留。没有绕过访问控制，没有覆盖现有原图。

全部文件页登记作者Goran_tek-en、作品日期2022-09-24、CC BY-SA 4.0。以下timestamp为文件上传修订时间，不是文件页面文字最后编辑时间；完整历史和官方SHA1见metadata/commons-imageinfo.json。SHA256由本地实际字节计算。

| 文件（官方来源） | 文件版本时间UTC | SVG标称尺寸 | 本地SHA-256 | 核验 |
|---|---|---|---|---|
'''+ '\n'.join(f"| [{x['file']}]({x['page']}) | {x['timestamp']} | {x['dimensions'][0]} × {x['dimensions'][1]} | `{x['sha256']}` | {x['status']} |" for x in inv)+'''

## 版本关系与观察面

母版的root/2、root/6、root/10、root/14分别为女性前、女性后、男性前、男性后，附带头侧插图。男性单图root/6/1、root/9/1的42/50条着色Path，与母版root/10/1、root/14/1逐条d字符串相同；只改变布局平移。证据：[版本路径核验](evidence/version-path-comparison.json)。

有/无标签组合中若d字符串因数值格式不同而不一致，不能据此宣称新增边界。已在相同容器坐标内解析实际填充，8组比较的最大面积对称差均小于1e-9源单位²（最大约7.36e-12），没有新分区；见[实际几何对比](evidence/unlabeled-geometry-comparison.json)。

横向lying版本为同样的前/后视图经旋转、等比布局；已查看取得的四个有标签横向图，没有独立抬掌、抬足、抬臂、外展大腿或会阴仰视图。文件内部存在matrix旋转，不能将横向布局当作第三观察面。女性母版展示女性体型及外阴前方，但没有新增完整下方会阴视图，也没有独立C6/C7/C8掌侧边界。

[全部文件结构](evidence/downloaded-svg-structures.json)列出SVG实际尺寸、元素数量、显隐、变换、原文字和XML路由；无ID的元素用root子节点索引定位，不能把Path索引当SVG ID。

## 许可与修改记录

- Goran原件：[正面]('''+source_front+''')、[背面]('''+source_back+''')；作者Goran_tek-en，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。保留署名、来源与许可链接，注明裁剪、路径采样、技术着色及配准等修改；派生图谱继续同许可或相容许可。不能暗示作者认可本项目或医学验证。
- 本审计Goran裁切图、路径预览与源几何数据按CC BY-SA 4.0标记；它们不是新增临床皮节资料。原始SVG不改写。
- Servier原曲线及其派生掌侧图谱单独标记[CC BY 4.0](https://smart.servier.com/how-to-cite-servier-medical-art/)。比较板是分来源并列，不将Servier边界换署名为Goran；不宣称全项目只有一种素材许可。
- Gray1237只是公有领域展示外形，不能赋予神经边界医学来源。原图/派生资源许可与应用代码许可分开处理。
- 母版隐藏的一个嵌入位图是头颈外观参考，非皮节图，未作为手掌/足底医学证据或产品素材；不另行推断该位图的独立版权。
''')

coverage=[
('头面部','B','主图前V1/V2/V3、C2；后V1/C2；侧头插图V1/V2/V3、C2–C5','前p13/14/15/16，后p21/22；头侧插图14条','前面局部已用；后V1、头侧插图未用；头发/耳眼口排除','可见面有边界，不能声称完整头皮/口腔覆盖'),
('颈部','B','前C2/C3/C4；后C2/C3/C4等可见过渡','前p15/17/18；后p22/23/24','已配准可见部分','侧方曲面未展开'),
('肩部','B','前C4/C5/C6；后C4/C5/C6/C7/C8过渡','前p18/21/28；后p20/24/26/40/46','已配准可见部分','肩顶、腋侧遮挡不能补全'),
('胸部','A','源前T1–T6附近实际路径，非固定高度公式','前p1–6','已用','A仅表示图上可见投影，非医学无争议'),
('腹部','A','源前T7–T12及L1过渡','前p7–12/33','已用','不外推侧腹隐面'),
('背部','A','后T1–T12，L1/L2过渡','后p6–19','已用','不等于三维全背侧面'),
('上臂','B','源C5/C6、后C7/C8；胸段过渡按原图','前p19/20/21/28；后p20/25/26/27/40/41','可见部分已用','内侧贴近躯干处遮挡'),
('前臂','B','源C5、C6–8、C8/T1、T1/T2等组合','前p28/32；后p41/47/48','已用近端；远端裁除','不能将组合标签拆成独立节段'),
('手背','C','C6–8与C8/T1组合，可见指甲','后p28–31/39/42/47/48','远端未用','完整独立C6/C7/C8边界不足'),
('手掌','C','掌心、五指掌侧真实可见；主要C6–8、C8/T1','前p29/30/31','未用；独立手掌目前另用Servier','缺的是独立节段边界，不是完全没有掌侧图像'),
('手指掌侧/背侧','B/C','掌纹、指腹与背侧指甲可辨；标签为组合','前p29/31；后p28–31/39/42/47/48','未用','指侧/接触面不完整；无法恢复每指独立三段边界'),
('腰臀部','A/B','后L1/L2、S2/S3/S4/S5；中央C1字样含义不明','后p18/19/32/33/34/35/49','除p35外采用可见部分','臀沟深部非完整展开'),
('腹股沟','B','L1/L2及前会阴S3/S4','前p33/34/39/40','L1/L2已用，S3/S4前片未用','邻近皮肤可提取，隐蔽皱褶不可补画'),
('大腿前后面及内侧','A/B','前L2/L3；后L2/L3、S2/S3等可见片','前p34/35；后p19/32/37/49','前后可见面已用','内侧仅窄带，未显示的贴合面为D'),
('小腿','A/B','L3/L4/L5及后S2等真实路径','前p35/36/41；后p36/37/38/49','踝以上已用','内外侧曲面不可视为完整展开'),
('足背','A','前L4/L5/S1','前p36/37/38/41','V3.1已补可见足背','不是足底'),
('足底','A/B','后L5/S1明确封闭面；L4/S2仅近端踝缘','后p43/44；近端p36/49','p43/44未导出，其他路径踝下也被截','真实足底/趾腹示意存在；需独立模板和专业核对'),
('脚趾','B','前足趾背侧、后趾腹；后L5/S1','前p41等；后p43/44','前可见趾已用，后未用','不是每趾的完整三维表面'),
('腋下','B/D','前T1/T2近腋缘有色区','前p19/20；后近臂躯干过渡','已用当前可见皮肤','腋窝中央/深部未充分展开，需抬臂视图'),
('会阴','B/D/E','前S3/S4；后S3/S4/S5；C1字样歧义','前p39/40；后p32–35','前未用，后部分已用，C1不使用','完整会阴下方、深部皱褶缺观察面；C1含义E'),
]
write('02-full-body-coverage.md','''# 全身覆盖、完整标签和统计口径

A=原图真实显示且有明确分区；B=仅部分表面可见；C=有颜色/标签但不够恢复所要求的完整独立边界；D=遮挡/未展示；E=证据不足。A不是临床验证或人体全部曲面的声明，组合状态应按“已见/未见”分别理解。

| 部位 | 类别 | 实际标签/表面 | 原始路径证据 | 当前采用情况 | 限制 |
|---|---|---|---|---|---|
'''+ '\n'.join('| '+' | '.join(row)+' |' for row in coverage)+'''

## 原始标签清单

已确认的35个不同标签：独立脊神经C2、C3、C4、C5、C6、C7、C8；T1–T12；L1–L5；S1–S5（29个）；组合C6–8、C8/T1、T1/T2（3个）；三叉感觉V1、V2、V3（3个）。另外原图尾骨/臀沟处写有“C1”，含义UNKNOWN，不认定为颈C1或擅改Co1。没有明确的Co/Co1字样，不能以医学编号补全。

下表统计主图填色Path，不重复计头侧插图；两个单图各有7条头侧插图Path，其中V1/V2/V3及C2–C5可识别，因此背面文件有V2/V3文字和插图，但**主后面人体没有后脸V2/V3区域**。

| 标签 | 原图主图存在 | 正面Path索引 | 背面Path索引 | 左右侧 | 主图Path数 | 当前区域实例 |
|---|---|---|---|---|---|---|
'''+ '\n'.join(f"| {r['label']} | 是 | {', '.join(map(str,r['frontPaths'])) or '—'} | {', '.join(map(str,r['backPaths'])) or '—'} | 原图双侧；中线区域可跨侧 | {len(r['frontPaths'])+len(r['backPaths'])} | {r['currentRegionCount']} |" for r in sorted(labels,key=lambda x:(['C','T','L','S','V'].index(x['label'][0]),int(re.search(r'\d+',x['label'])[0]),x['label'])))+'''

每条Path实际位于哪侧、是否跨中线、多少有效片、面积、XML路由、d指纹以及当前区域ID，见[path-inventory.csv](evidence/path-inventory.csv)。单条Path可以包含左右两手/两足，不能把Path数直接当作神经数或侧别实例数。前面屏幕左=人体右，后面屏幕左=人体左；独立Gray掌侧五指向上时左掌拇指在屏幕左，不混用规则。

## 数量与面积（本次重新计算）

| 指标 | 正面 | 背面 |
|---|---:|---:|
| 选定填色Path（含头侧插图） | 42 | 50 |
| 主人体Path | 35 | 43 |
| 主图明确标签 | 30 | 33（另有歧义C1） |
| 经实际绘制顺序解析的主图片数 | 61 | 65 |
| 当前导出标签 | 27 | 30 |
| 当前左右区域实例 | 54 | 60 |
| 当前MultiPolygon片数 | 63 | 71 |
| 当前孔洞 | 15 | 2 |
| 具有任一导出引用的主图Path | 30/35 | 33/43 |
| 当前模板可见皮肤面积被图谱并集覆盖 | 88.7266% | 90.4561% |

全项目全身唯一标签仍35个，左右/视图实例114，片134，孔17。原图126个解析片包含绘制细缝与数值碎片，不代表126个医学分区。所有114个当前几何有效，来源标签与sourcePathIndices一致。

面积分母为当前400×900模板真实皮肤轮廓，分子为当前atlas并集与皮肤的交集；不是全身三维体表覆盖率，不是诊断准确率。未显示表面不能纳入分母，也不能解释为没有感觉神经。源域进入配准的面积占比约91.2721%/88.3058%，这还是目标头发/眼口/边缘适配之前的输入域，不能与上述目标比率作误差或性能对比。

证据：[summary.json](evidence/summary.json)。当前采样微重叠折算逻辑面积约前0.411678、后0.430113 px²；体外尾差约0.001345/0.000551 px²。它们在既有阈值内，但并非数学绝对无缝，也不构成医学重叠证据。

![全身前面覆盖对照](evidence/coverage-front.png)
![全身背面覆盖对照](evidence/coverage-back.png)
''')
(E/'coverage-matrix.json').write_text(json.dumps([dict(zip(['part','class','labels','paths','current','limits'],r)) for r in coverage],ensure_ascii=False,indent=2))
with (E/'coverage-matrix.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['部位','类别','可见标签','路径','当前采用','限制']);w.writerows(coverage)
write('03-palm-investigation.md','''# 手掌专项调查

**结论：部分包含。原图包含掌心和五根手指掌侧的真实图像/封闭面，但不包含可分别恢复的完整C6、C7、C8掌侧边界。** 不能写成“正面手就是背面”，也不能把C6–8合并面拆成三个独立区域。

## 实际观察面与指部

正面双手可见掌纹、掌心、指腹、拇指及鱼际外形；背面可见指甲，是手背/指背。手部有倾斜和少量侧面混合，不能证明全部指侧/指间表面。两侧原图独立保留，未通过镜像生成本审计证据。

| 位置 | 源图证据 | 独立C6/C7/C8边界是否足够 |
|---|---|---|
| 拇指掌侧、食指、中指及邻近掌心 | 前p29的C6–8组合大面；源引线root/9/16指到远端 | 否，不能凭手指名称细分 |
| 大鱼际/掌根邻近 | 前p30同为C6–8，root/9/45引线 | 否；两种填色/两个Path不代表两个独立神经节段 |
| 环指/小指、尺侧掌心 | 前p31 C8/T1组合，root/9/49引线 | 否，无法将C8与T1拆开；环指有相邻组合面分界 |
| 腕口与近端前臂 | p28 C5、p32 C8/T1等依源图 | 这些近端片不能外推掌侧C6/C7边界 |
| 手背、指背 | 后p28–31 C6–8小片、p47/48组合大面，p39/42 C8/T1 | 与掌侧不同，不能翻成掌图 |

前p29=`root/6/1/24`，p30=`root/6/1/25`，p31=`root/6/1/26`。主要边界不是由渐变产生：实际平色fill路径存在；上方光影渐变和掌纹为外观。主图独立C6前p21只到近端上臂范围，不延伸为完整掌图；前面没有独立C7/C8路径。背面独立C6/C7/C8也不能提供新的掌侧观察面。

隐藏线稿、男女母版、有/无标签组合已核查。没有发现隐藏而可直接启用的完整C6/C7/C8掌侧分区。该结论来自本次22份实际取得版本及完整母版，没有把隐藏线稿当成正式新增边界。

## 与Gray模板的配准

- 整体位置/方向/尺度：可用平移、等比例缩放、旋转调整；右手源图五指向下，旋转后再与同侧Gray对齐，不能混淆侧别。
- 手指张角、长宽、拇指外展、掌宽及指蹼：需要局部非刚性配准。一个全局仿射变换不能同时贴合五指和腕口。
- 源图掌侧可见面与Gray掌侧可进行几何对应；Goran背侧的指甲/手背面不能当掌侧。
- **配准不能创造缺失的C6/C7/C8独立边界**。即使把组合面几何完整贴合Gray，输出仍只能叫C6–8、C8/T1参考区，不能满足当前3独立标签需求。

![左手原图](evidence/left-hand-original.png)
![右手原图](evidence/right-hand-original.png)
![左手真实Path](evidence/left-hand-paths.png)
![右手真实Path](evidence/right-hand-paths.png)

放大图均由原始SVG渲染；Path图只隐藏外观渐变并标索引，剪裁框边缘是查看窗口，不是新神经边界。对应坐标窗口和XML路由见figure-index.json与path-inventory.csv。
''')
write('04-sole-investigation.md','''# 足底专项调查

**结论：Goran背面确实画了两足足底、前脚掌和趾腹，并有可提取的L5/S1闭合分区。并非仅画了足跟。** 它可作为独立足底参考视图的候选源；不等于足部所有曲面、每条细小解剖边界或个体皮节都完整确定。

## 观察面和标签

正面足趾有甲板，是足背/足侧及趾背；背面足趾显示趾腹，足底长面从跟部延伸至前足与趾腹，是简化的足底示意。它与中性人体背图的跟腱、足跟外后面不是同一表面。将源足底缩扁到现有足跟是错误的对应。

| 区域 | 原图实际情况 | 提取依据 | 限制 |
|---|---|---|---|
| 足背、可见内外侧 | 前L4/L5/S1真实着色面 | 前p36/37/38/41，V3.1已采用 | 不当成足底 |
| 足底中央、跟垫至大部分足弓/前足 | 后S1大面 | 后p44，`root/9/1/44`；引线root/12/47 | 图上没有单独标“足弓”或3D曲率，不能细分未画出的边界 |
| 前足内侧/部分趾腹 | 后L5面 | 后p43，`root/9/1/43`；root/12/62与L5文字关联 | 不能外推到每趾全部侧面 |
| 踝端近缘 | 后L4与S2邻接片 | 后p36、p49 | 裁剪窗口包含它们，不等于它们覆盖整个足底 |
| 趾腹/足趾分界 | L5/S1两面实际到达远端 | p43/44 | 趾间遮挡/立体侧面并未展开；不额外造五趾神经区 |
| 足跟完整周面 | 仅下方跟垫与部分边缘可见 | 后p44及外形 | 跟腱、后跟、内外侧完整周向仍需另行对应 |

原图主后图p43范围x135.58–299.22、y894.18–945.32；p44范围x124.13–310.66、y847.03–939.13（全SVG用户单位）。二者均实际含双侧几何。p49 S2到y879.89，但在足底近端旁缘，不能据此把足底任意填成S2。不存在“因为足常见L4/L5/S1/S2就补齐四区”的逻辑。

## 为什么项目没有后足底

旧生成器明确在源y842/目标y820截断，p43/44完全被排除；V3.1只新增正面足背，后足底因目标观察面不同保持未配置。这是**原图有数据、目标模板/配准未支持**，不是下载/解析器没有足底路径，也不是微小区域被简化消失。

因此，独立足底可以优先走“Goran原p43/44→左右各自提取→足底模板→局部配准→技术+医学审核”。这只是可行性结论；本轮未配准、未生成生产足底图谱。对于源图未显示的周向/趾间表面仍需补充资料，不能把有限足底示意宣传为完整足部标准。

这里是脊神经皮节标签，不是胫神经、腓神经或内/外侧足底神经区域，不能相互替代。

![左足原图](evidence/left-foot-original.png)
![右足原图](evidence/right-foot-original.png)
![左足原始填色面](evidence/left-foot-paths.png)
![右足原始填色面](evidence/right-foot-paths.png)
''')
write('05-svg-geometry-audit.md','''# SVG解析与几何审计

## 可追溯解析

源文件当前为docs/research/v3-atlas/goran-front.original.svg、goran-back.original.svg，SHA1与本次Commons文件元数据相符。审计下载独立保存在evidence/originals；生产原件未覆盖。

- 主图平色层：front root/6/1，back root/9/1。递归group，累积translate/scale/matrix；主着色Path自身通常没有ID，因此记录零基XML路由和d的SHA256。
- 使用现有scripts/svg_geometry.py采样贝塞尔、按evenodd/nonzero实际填充规则形成面；主着色按后画覆盖先画解析，不能把叠在下面的整块底色当可见分区。
- 按原文件核实clipPath、mask、use：取得的单图及组合文件中这些元素为0；不是忽略了这些语义。渐变通过定义及引用用于光影，医学分区由实际平色面与文字引线核对，不能按同色自动合并节段。
- 图层的display:none确实存在；母版root/3、7、11、15为隐藏线稿，无额外可见手掌/足底角度或独立掌侧三分区。显式打开这些层的审计图与原始最终图分开保存。嵌入位图是头部外观参考，未当成皮节源。
- 全部文字（含重复、头侧插图）、实际显隐和变换在front/back-svg-tree.json及downloaded-svg-structures.json；全部引线**各子路径**端点在all-leader-endpoints.json。旧audit_source_labels.py仅打印部分端点，本轮保留旧输出作辅助，并补全多子路径端点；不能仅用“上一个text”给引线贴标签。

## 标签核验与歧义

主图35个明确标签+尾骨C1字样单列；三叉感觉与脊神经、组合分区分型。未发现当前114实例与登记sourcePathIndices之间的标签错配，所有实例都有来源引用；这不等于已获医学审核。背面V2/V3只出现在头侧插图，不算主后面皮肤。

C1字样的引线root/12/60落到p35的尾骨位置，既不擅自当颈C1也不改成Co1。本轮未以外部医学常识覆盖原字样。

## 小片与采样

原始解析主图前61片/后65片，保留多片和孔洞，未用凸包。现行前63片/15孔、后71片/2孔均有效。数量不相等源于分侧、聚合、配准/裁切以及局部新增，不能据片数直接判遗漏。

旧prepare_atlas.py确有源片面积>.001源单位²、目标片>.00001逻辑单位²，以及拓扑保持简化.01逻辑像素。审计找到落入旧源阈值的极小解析碎片：旧流程有效前7片、后6片，最大约6.77e-5源单位²；其中部分低至1e-13，可能来自采样/布尔运算。额外前V3 p16的一片在新增面部流程中不使用该阈值，不能算成实际丢弃。没有证据表明完整手指或足底被这些阈值删除。

目标端阈值所去除碎片没有独立完整历史列表；**具体逐片目标损失UNKNOWN**，不能声称完全零损失。当前registration-report记录简化/配准损失，但不能替代医学细小区域审核。下一轮若重建应增加逐片损失台账，本轮不改生成器。

当前旧版技术校验仍有微重叠/微体外采样尾差；本轮照实报告，不修改容差、几何或审核状态。

## 数据权限

审计原坐标几何输出front/back-raw-source-regions.json明确`coordinateSpace=original_svg_user_units`、auditOnly。它不是人体归一化坐标，未同步进miniprogram或backend。不得直接加载为正式神经匹配数据。
''')
write('06-current-atlas-diff.md','''# 当前图谱差异与实际数据链路

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
''')
write('07-goran-servier-comparison.md','''# Goran与Servier掌侧对照

![真实来源与当前模板并排](evidence/goran-servier-palms.png)

上左：Goran原始右掌（原姿态）；上中：同一SVG实际着色面及Path索引；上右：Servier原PPTX曲线的源坐标截取；下方：当前Gray左右掌模板及既有Servier派生6区。它们没有做跨来源医学边界融合。颜色是各资源的显示编码，不能用相同/不同颜色判相同/不同神经。

Goran来源为2022年同套SVG，原p29/p30写C6–8，p31写C8/T1；Servier来源为官方Dermatomes，PPTX第26页group71682，外形71995，曲线72147/72148，文字72039/72041分别C7/C8，C6从标注前臂区域连续到拇指侧。

| 维度 | Goran | 当前Servier |
|---|---|---|
| 观察面 | 正面掌侧；后面手背，分别有真实原图 | 前面图掌侧 |
| 主要掌侧含义 | C6–8与C8/T1组合 | C6/C7/C8独立参考区 |
| 拇指/掌根边界 | 同一C6–8组合内存在两种色面，不能拆义 | 两条原始曲线切出三面，C6与拇指侧连续 |
| 尺侧分区 | C8/T1，不能去掉T1假装完全相同 | C8 |
| 分辨能力 | 合并参考，不足以恢复独立三段边界 | 支持独立三段参考展示，医审仍pending |
| 许可 | CC BY-SA 4.0 | CC BY 4.0，独立署名 |
| 配准 | 还未为Gray生成生产数据 | 6个掌/指蹼/腕口控制点，右侧配准后镜像左侧 |

有明显的**标签粒度与参考边界差别**；不能把它简单判为某图医学错误，也不能声称二者完全一致。Goran的C6–8大面内部缺少独立边界，无法与Servier做逐段重叠准确率；没有临床真值，不计算/虚构Dice、IoU或准确率。

原图手形姿态和Gray的指蹼、张角不同，当前Servier配准后的曲线位置也受工程变换影响；这与源图本来采用组合标签是两类差异。当前Servier右掌图经180°观察后与Gray同侧，不把来源姿态变化当成医学分布变化。

Servier官方[作品](https://smart.servier.com/smart_image/dermatomes/)、[署名许可](https://smart.servier.com/how-to-cite-servier-medical-art/)，源字节及来源曲线见data/sources/servier-palm-v1/和data/atlas/palm-v1/registration.json。本轮只读，没有替换、改名或删除这套数据。
''')
write('08-unification-feasibility.md','''# 统一来源可行性

推荐整体采用**方案B：Goran为主要全身来源，缺失/分辨能力不足的独立表面保留有来源的补充图谱**；手掌具体落实方案C，足底可以优先评估局部方案A。

| 方案 | 本次判断 | 依据/条件 |
|---|---|---|
| A 全部改成Goran | 不推荐 | 独立掌侧C6/C7/C8界线不足；腋窝、完整内侧及会阴下方观察面不全。合并标签几何再精美也不能产生缺失医学信息 |
| A 仅足底优先Goran | 有条件可行 | 后p43/44真实L5/S1足底面；需要独立左右足底模板、来源姿态对应、有效面/孔洞保留及医审，不能复用现有后跟投影 |
| B Goran主图+补充来源 | 推荐整体架构 | 每个view/region绑定来源、模板、版本和许可，不将混合来源声称为纯Goran |
| C 手掌继续独立Servier | 推荐保持 | 当前已具备有出处独立C6/C7/C8曲线；改为Goran会失去该分辨能力。仍需专业审核当前配准 |

## 五个特殊部位逐项判断

| 部位 | 能否纯Goran | 具体限制/后续 |
|---|---|---|
| 手掌（左右） | 仅组合参考可以；独立C6/C7/C8不行 | 保留Servier独立掌图谱，不用手背替代掌侧 |
| 脚底（左右） | 可优先使用其有限二维足底示意 | 后p43/44；完整足部周向/趾间仍不保证，先做独立模板审查 |
| 腋下 | 完整腋窝不行 | 只见臂躯干边缘T1/T2等，需抬臂观察参考 |
| 大腿内侧 | 可见窄条可用，完整内侧不行 | 需真正外展/内侧面来源，禁止把前后面拉宽当内侧 |
| 会阴 | 可见前/后局部可用，完整下方不行 | C1字样歧义；需适当姿态的可信来源和医学审核，不能强制填满 |

神经皮节是皮肤与脊神经相关感觉区域；神经根、背根神经节是不同解剖对象，外周神经感觉区又是另一划分体系。项目提供皮肤位置与参考皮节的几何对应，不能直接定位内部神经节病变。

统一来源可减少追溯成本，但不能用来证明医学标准唯一性或消除图谱间差异。Goran是带医学信息的插图，不是本项目已验证的国际标准。维持medicalReviewStatus=pending、mappingEnabled=false，不因本审计升级准入。
''')
write('09-recommended-next-step.md','''# 下一轮建议与本轮验证范围

建议下一轮先做“Goran独立足底来源配准原型”，仍先保留现有全身和掌图谱。具体顺序：

1. 固定原背SVG及p43/p44的路径指纹，分别提取左右侧；p36/p49仅作为踝端背景参考，不先验造四段足底。
2. 取得可合法编辑的、与源足底观察面兼容的独立足底展示素材；核对足跟垫、大趾侧、前足、五趾及源足部倾斜。
3. 建立新模板/坐标域与独立配准记录，保留原始/已配准几何及未支持表面；不改当前人体后跟。
4. 进行几何合法性、分侧、边界保持、模板包含、标注和匹配的工程验证；同时由合适专业人员核对L5/S1及足部观察面。
5. 按实际来源和许可维护数据；审核前仅参考预览。另行授权后才接入业务、部署/上传。

手掌保持Servier，优先补做已记录的专业配准审核与真实微信闭环。腋下、大腿内侧、会阴继续调查真实展开面，不以自动补画填补来源空白。

## 本次执行记录

- 审计脚本8项断言通过；原SVG几何5项、V3.1扩展6项通过。
- 同源Goran副本、手掌副本、人体导出三项只读同步检查通过。
- 导入check_preview_atlas.check()执行校验并把结果写到本审计证据目录；没有执行会重写生产validation.json的脚本主入口。
- 有/无标签几何8组对照通过，全部已有生产几何有效；源码/数据保护哈希检查结果见delivery-check.json。
- 初次使用系统python3进行人体同步检查因未装Shapely失败，日志test-body-sync.log保留；改用项目既有ai/.venv解释器后通过test-body-sync-retry.log，未安装依赖。
- 下载遇DNS/HTTP429，部分优先文件在间隔后成功；实际最终数量见01-source-inventory，不把失败当成功。
- 首次新证据SVG用ns0前缀导致Sharp无法识别；登记默认SVG命名空间后重新渲染成功。初次透明背景预览不利于观察，审计预览增加白底后复核，不改原始字节。
- NOT_RUN：临床审核、用户手机/微信运行、云端回归、部署/上传。本轮是离线来源审计，没有授权这些操作，不需要以界面测试替代原件验证。
- 原前后端全量测试本轮NOT_RUN：未改业务代码，执行范围针对来源/几何/同源性；不借用V6.1历史328/256冒充本轮结果。

## 文件范围

新增docs/goran-full-atlas-audit中的报告、公开来源原件、JSON/CSV统计、SVG/PNG预览及可复现审计脚本；只在task.md追加审计记录。现行atlas、Servier掌侧数据、人体模板、病灶、服务和匹配公式不改。没有Git提交/推送，没有服务器连接、部署或微信上传。

复现（项目根目录，网络下载是可选独立步骤）：

```sh
ai/.venv/bin/python docs/goran-full-atlas-audit/scripts/audit_versions.py
ai/.venv/bin/python docs/goran-full-atlas-audit/scripts/audit_geometry.py
ai/.venv/bin/python docs/goran-full-atlas-audit/scripts/compare_unlabeled.py
ai/.venv/bin/python docs/goran-full-atlas-audit/scripts/render_evidence.py
ai/.venv/bin/python docs/goran-full-atlas-audit/scripts/render_comparison.py
ai/.venv/bin/python docs/goran-full-atlas-audit/scripts/build_reports.py
ai/.venv/bin/python docs/goran-full-atlas-audit/scripts/test_audit.py
```

PNG渲染使用本机已存在的Sharp，不增加项目运行依赖；SVG源可直接打开。具体PNG命令见scripts/render_png.cjs。
''')
write('README.md',f'''# V6.3 Goran全身图谱完整性审计

2026-11-05。**结论：不能为统一来源而全部替换。手掌有真实掌侧表面，却缺独立C6/C7/C8完整分界；足底则确实存在L5/S1源几何，值得优先复用到独立足底模板。** 推荐Goran为主、缺失部位独立补充，现有Servier掌图谱保持。

| 部位 | Goran原图覆盖情况 | 可提取皮节 | 是否可以直接使用 | 缺少的证据/工作 |
|---|---|---|---|---|
| 全身正面 | 大部分可见前面；不覆盖全部体表 | 30主图标签；当前27标签/54实例 | 已用部分，不是全部 | 掌侧、前会阴等未导出，隐面不全 |
| 全身背面 | 大部分可见后面，**包括足底示意** | 33明确主图标签+歧义C1；当前30/60 | 已用部分，不是全部 | 后头皮、手背、足底未全采用，C1待核实 |
| 左手掌 | 掌心及五指掌侧可见 | C6–8、C8/T1组合 | 不能替代独立C6/C7/C8 | 缺分开的医学边界；Gray仍需局部配准 |
| 右手掌 | 同上，有实际原侧几何 | C6–8、C8/T1组合 | 同上 | 同上 |
| 左脚底 | 真正足底、跟垫至前足/趾腹 | 后p43 L5、p44 S1 | 可提取，尚不可直接贴现人体 | 独立足底模板、局部配准、医审 |
| 右脚底 | 同上，有实际原侧几何 | L5、S1；踝邻接L4/S2 | 同上 | 不能把邻接片扩成整个足底 |
| 腋下 | 边缘部分可见，深部未展开 | 可见T1/T2等源片 | 完整腋窝不行 | 抬臂独立视图 |
| 大腿内侧 | 可见窄带，隐藏面缺失 | 可见L2/L3及后S2/S3等 | 完整内侧不行 | 真正内侧/外展观察面 |
| 会阴 | 前外生殖器/后臀沟局部 | S3/S4、后S5，歧义C1 | 完整会阴不行 | 下方观察面、C1语义及医学审核 |

本轮官方22版清单已核对；{verified}份原件字节已取得校验。指定五份和有/无标签男女母版均已完成实查。原图、标签引线、92条填色Path（主图78、插图14）逐条有记录；现有114个区域实例未改动。

## 直接回答八个问题

1. **到底有哪些皮节？** 已确认35个不同标签：C2–C8、T1–T12、L1–L5、S1–S5；组合C6–8、C8/T1、T1/T2；三叉V1/V2/V3。另有尾骨处“C1”字样含义UNKNOWN，不能当颈C1或Co1。详见[完整标签/左右/路径表](02-full-body-coverage.md)。
2. **项目是否全部提取？** 否。当前27/30标签、54/60实例；完全未引用的主图路径前5条、后10条，还有局部裁除。没有发现包内和后端图谱不同步。[逐项遗漏](06-current-atlas-diff.md)。
3. **掌心和五指掌侧C6/C7/C8完整界线？** 部分包含：有掌侧表面与组合区，独立三段边界不足。不是缺手形、也不是可以按颜色拆三段。[掌侧证据](03-palm-investigation.md)。
4. **足底、跟垫、足弓、跖侧趾腹？** 存在可提取L5/S1二维足底示意，包含这些表面的可见部分；不是完整周向/每趾侧面标准。现项目未用源p43/44，原因是目标后跟观察面不符。[足底证据](04-sole-investigation.md)。
5. **与Servier差异？** 明显的是分区粒度/标签：Goran组合区，Servier独立三段；尺侧C8/T1与C8不同。没有真值，不能据此判谁更准确。[对照](07-goran-servier-comparison.md)。
6. **能配准到Gray？** 可尝试配准掌侧组合几何；手指/指蹼需局部非刚性处理。任何变换都不能补出缺失的独立医学边界。
7. **五类特殊部位能否纯Goran？** 足底优先可行；手掌仅组合区可行；完整腋下、内侧大腿、会阴均需补充观察面。[逐部位方案](08-unification-feasibility.md)。
8. **值得全部统一吗？** 不值得牺牲信息完整性来统一署名。推荐整体B、掌侧C、足底局部A的分来源架构，明确每区真实出处。

## 真实预览

![掌侧来源对照](evidence/goran-servier-palms.png)
![左足正背原始SVG放大，右栏为足底](evidence/left-foot-original.png)

这些是原始资源/实际路径的离线矢量渲染，不是微信运行截图。足底存在和掌侧组合标签由原SVG、文字引线、父版一致性证实；未来Gray/足底配准的工作量与可行性是工程判断，尚未实施或通过医学审核。

## 文档与证据索引

- [01 原始来源与22版清单](01-source-inventory.md)
- [02 全身覆盖矩阵、完整标签与面积](02-full-body-coverage.md)
- [03 手掌专项](03-palm-investigation.md)
- [04 足底专项](04-sole-investigation.md)
- [05 SVG与隐藏层核验](05-svg-geometry-audit.md)
- [06 当前提取差异与源码链](06-current-atlas-diff.md)
- [07 Goran/Servier比较](07-goran-servier-comparison.md)
- [08 统一来源可行性](08-unification-feasibility.md)
- [09 下一轮建议、命令与限制](09-recommended-next-step.md)
- [逐Path CSV](evidence/path-inventory.csv)、[逐Path几何正面](evidence/front-raw-source-regions.json)、[背面](evidence/back-raw-source-regions.json)、[来源结构](evidence/downloaded-svg-structures.json)、[全部引线端点](evidence/all-leader-endpoints.json)。

来源：[Goran正面]({source_front})、[Goran背面]({source_back})、[官方系列](https://commons.wikimedia.org/wiki/Dermatomes_3D_shaded_true_SVG)，Goran_tek-en / CC BY-SA 4.0；[Servier](https://smart.servier.com/smart_image/dermatomes/) / CC BY 4.0独立记录。图谱是参考插图，不能等同临床唯一标准、内部神经节病变定位或临床准确率。

**本轮只新增审计资料并追加task.md，未更换图谱、修改业务代码、访问服务器、部署或上传体验版。** 医学审核保持pending。
''')
# Compact exportable matrix, not a new anatomical drawing.
colors={'A':'#d8eee3','B':'#fff0d0','C':'#f8dfce','D':'#e5e7eb','E':'#e8e0f1'}
s='<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1080"><rect width="100%" height="100%" fill="white"/><g font-family="PingFang SC, sans-serif" font-size="17" fill="#233b34"><text x="24" y="38" font-size="27">Goran 可见表面覆盖矩阵（源图能力，不是临床准确率）</text><text x="24" y="72">A 明确可提取　B 部分可见　C 独立边界不足　D 遮挡　E 未确认</text>'
for i,row in enumerate(coverage):
 y=100+i*45;s+=f'<rect x="20" y="{y}" width="1260" height="42" fill="{colors[row[1][0]]}"/><text x="30" y="{y+28}">{html.escape(row[0])}</text><text x="270" y="{y+28}">{row[1]}</text><text x="350" y="{y+28}" font-size="15">{html.escape(row[2])}</text>'
s+='<text x="24" y="1050" font-size="15">证据：原始前/后SVG，具体Path与限制见02-full-body-coverage.md。未显示不等于无神经分布。</text></g></svg>'
(E/'coverage-matrix.svg').write_text(s)
print('Written 10 reports and coverage matrix')
