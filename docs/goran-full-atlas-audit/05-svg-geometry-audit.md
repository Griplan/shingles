# SVG解析与几何审计

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
