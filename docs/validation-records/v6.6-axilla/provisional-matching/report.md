# V6.6.2 本地试验性腋下匹配

当前左右腋下入口已使用独立PROVISIONAL图谱，可以沿用人工圈选→完成标注→**试验性参考匹配**→全部高亮/单区查看→返回修改的本地流程。API和自动化验证通过；微信/手机实际运行仍NOT_RUN，未部署、未上传。

## 实际交付范围

1. 左右均可计算，使用同一V4接口与求交/并集逻辑。
2. 实际配置2个标签T1、T2；每侧各2个MultiPolygon实例，本次各1个外环，共4个Polygon片区。
3. 来源仅Goran前p19、p20原侧可见片段；目标全部为B类估计局部仿射。A类保留源SVG坐标，C类延伸0区域。没有将目标称为原始精确边界。
4. 近端内臂小块可以匹配；左右配置面积分别约6.25%、6.21%。中央腋底、两褶大部分、邻胸壁继续未覆盖；没有强行配置T3或拆分T1/T2组合标签。
5. 计算成功后共享页面按实际candidate.region_ids加载同源geometry，保留棕色标注轮廓；单标签/显示全部/放大复位沿用原实现。此项代码和自动测试已接通，真实微信高亮尚待运行验收。
6. 每个区域、manifest、源变换记录、API响应及前端保存响应均带PROVISIONAL或明确的未审核/高不确定状态；客户端拒绝新图谱缺状态响应。
7. 既有全身正背面、主人体手部、脚底数据及模板不变；独立手掌入口继续退役；AI腋下放置未接入。
8. 自动化：前端350、后端+AI303通过；旧空图谱及版本/环境门禁保留。详见[测试记录](tests.md)。

## 使用方法

使用包含本轮代码的本地后端，重新编译小程序，在“人体模型→特殊部位→左腋下/右腋下”圈选近端内臂彩色参考片对应位置，完成标注后点“试验性参考匹配”。开发版可点“参考图谱”查看位置。trial不开放调试图谱页，但可以计算；release/unknown仍禁用网络匹配。手机体验版/云端旧代码不会自动更新，本轮没有上传或部署。

页面常驻提示：“试验性神经皮节参考匹配：区域边界由公开图谱近似配准，尚未经过医学审核，仅用于模拟与科普，不能用于疾病诊断或替代就医。”旧标注不自动迁移图谱身份；旧内存会话被版本保护拒绝时原记录保留。

## 图件与证据

- [原Goran九路径与标签](../medical-review/figures/03-Goran九路径源图对照.png)
- [左近似配准与合成请求示例](axilla-left-preview.png) / [右侧](axilla-right-preview.png)
- [源/目标控制点、A/B/C区别](control-point-correspondence.png)
- [左未覆盖](axilla-left-uncovered.png) / [右未覆盖](axilla-right-uncovered.png)
- [实际接口请求/响应](evidence/real-api-examples.json)

合成病灶是真实提交到本地接口的测试几何，不能称为真实患者数据。源图曲线、实际控制点、矩阵和未覆盖几何可编辑/可追溯，见[source-to-target-mapping](source-to-target-mapping.md)、[atlas合同](provisional-atlas.md)、[几何检查](geometry-validation.md)。所有组合图及源曲线衍生部分遵守Goran_tek-en CC BY-SA 4.0，保留来源及修改说明。

## 文件改动

新增 `scripts/build_axilla_provisional.py`、`data/atlas/axilla-goran-provisional-v1/`、`miniprogram/data/axilla-provisional.generated.ts`、`backend/app/services/axilla_provisional_service.py`、`backend/tests/test_axilla_provisional.py`及本目录。

修改前后端图谱路由/来源schema与TypeScript合同、`local-models.ts`、局部页面TS/WXML、`matching-session.ts`状态守卫及腋下测试。更新docs/api.md、docs/atlas-spec.md、task.md。没有修改dermatome_matcher.py、P6几何校验/并集机制、已有图谱或人体素材。

## 尚未完成的医学事项

目标全部估计，误差没有医学量化；原图垂臂与本模板抬臂之间存在个体/姿态形变。模板缺肩、肘和肋间标志，褶线/视向仍未专业核对；没有用T2感觉检查点或ICBN分布生成面积。当前小片模拟不能解释整个腋窝，不能作为疾病定位、论文医学准确性证据或真实皮肤面积。未来需对模板和控制点、原图内臂片段适用性、真实边界及未覆盖范围逐侧审核，才能扩大或升级图谱。

本轮停止于本地试验性功能，不继续会阴或生产发布。
