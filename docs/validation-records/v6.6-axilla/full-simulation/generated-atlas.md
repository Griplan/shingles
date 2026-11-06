# 模拟图谱与接入合同

独立目录 `data/atlas/axilla-schematic-v1/`；atlasId=axilla-schematic-v1，atlasVersion=axilla-schematic.1。生成脚本 `scripts/build_axilla_schematic.py`，重建命令 `ai/.venv/bin/python scripts/build_axilla_schematic.py`。

每个manifest、视图、区域和registration带：

- atlasType=SCHEMATIC
- reviewStatus=NOT_MEDICALLY_VALIDATED
- intendedUse=INTERACTIVE_SIMULATION
- sourceType=ARTIFICIALLY_CONSTRUCTED

每侧3个MultiPolygon实例，当前各1外环/0孔洞，共6个Polygon片区；所有区域partitionType=schematic_region，displayName为“模拟 T1/T2/T3”。sourcePathId=null，sourceFile指向人工生成脚本；sourceRefs引用人工设计资料，不引用Goran源路径作为新边界证据。

皮肤templateId/version、geometryId、bodyContentSHA256和既有坐标未变；旧axilla-reference-v1空数据和axilla-goran-provisional-v1/goran-axilla-provisional.1均保留。新identity触发既有会话/结果版本保护，旧结果不能静默变成模拟结果；旧标注不会被改写或删除。当前会话仅运行期保存，退出应用后的生命周期不变。

## 后端

新增 `axilla_schematic_service.py` registry，复用局部加载器和V4。加载器显式区分schematic_skin_partition/artificial_partition_design与原有spinal_dermatome/dermatome_boundaries，避免把人工设计伪装成医学边界来源。图谱仍mappingEnabled=false/medicalReviewStatus=pending；没有把正式医学门禁改为通过。

新服务要求现有ENABLE_REFERENCE_MATCHING环境权限，验证全部人工状态、标签、身份/hash、有效几何、皮肤内包含、三分区并集覆盖和无异常面积重叠。鉴权、上传保护、V4数值公式/P6求并集逻辑保持。

POST /api/v1/evaluate请求结构不变，source新增：atlas_type=SCHEMATIC、review_status=NOT_MEDICALLY_VALIDATED、intended_use=INTERACTIVE_SIMULATION、source_type=ARTIFICIALLY_CONSTRUCTED、disclaimer。旧图谱不添加这些可选null字段。响应JSON/保存状态保留标识，客户端拒绝模拟身份缺失任一状态字段或提示的响应。

## 前端

`axilla-schematic.generated.ts`作为当前腋下模型图谱数据，显示皮肤资源不变。复用local-surface Page/Canvas与V2会话、V4匹配Store。按钮为“模拟区域匹配”，侧栏显示“模拟 T1/T2/T3”；结果标题为“腋下模拟结果”。全部/单区/返回修改及缩放复位继续同源绘图。

页面常驻（包括结果状态）：“本区域使用人为构建的神经皮节示意分区，边界未经医学验证，仅供交互模拟和科普，不用于判断实际受累神经，不能代替就医。”提示同时进入API disclaimer、coverage_note和warnings；不存在另外无标识的导出结果。

develop/trial沿用统一能力与已有后端鉴权，release/unknown仍关闭网络匹配；trial调试图谱入口继续按原权限隐藏，不硬编码全部开放。没有恢复独立手掌入口，没有AI腋下放置。

## 后续医学图谱替换

若未来获得医学审核边界，应创建另一atlasId/version及独立来源、许可、审核签署和配准误差记录。模拟数据永远保留人工状态，不通过改一项reviewStatus原地升级；经过工程/医学审查后另行决定正式门禁和发布。旧标注和结果仍绑定原identity，需要显式重新计算或授权迁移，不能改写历史结果。
