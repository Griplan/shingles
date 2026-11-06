# V6.6.3 腋下全区域交互模拟

本地已接通左右完整人工模拟分区。新版本 `axilla-schematic-v1 / axilla-schematic.1`，SCHEMATIC / NOT_MEDICALLY_VALIDATED / INTERACTIVE_SIMULATION / ARTIFICIALLY_CONSTRUCTED。旧Goran provisional和医学审核材料保留。

## 实际结果

- 左右有效皮肤覆盖均100.000000%（报告精度）；两侧各16,357个网格皮肤点无漏点，原皮肤面积未改。约1e-19残差只属浮点舍入，详见[覆盖记录](coverage-check.md)。
- 中央、前褶附近、后褶附近、近端内臂、外侧胸壁均可返回真实Polygon交集的模拟标签。每侧3个MultiPolygon实例、各1外环，共6片，标签“模拟 T1/T2/T3”。
- 没有需要另设的模拟未定区或可见未覆盖面；皮肤外空白不参与、也不能成为有效标注。
- 边界为人工两条平滑曲线，裁切并以差集衔接；**不是Goran源路径，不是医学边界推断**。Goran仅作为既有调查背景，新边界来源指向本项目人工设计。
- 计算、自动全部高亮、标签单区、恢复全部、修改重算、左右隔离、缩放复位已通过自动化Page/Store/接口验证；真实微信交互NOT_RUN。
- 页面、API source、warnings及前端保留响应明确非医学用途；匹配类别为schematic_region，不能当成经确认的脊神经节段结果。

## 如何使用本地代码

让本地后端加载本轮代码，重新编译小程序，进入人体模型→特殊部位→左/右腋下，圈选→闭合→完成标注→“模拟区域匹配”。开发版仍有参考预览入口；受控trial支持模拟计算，release/unknown保留关闭。当前云端和旧体验包**没有获得本轮更新**；本轮禁止部署/上传，未访问服务器。

旧会话如果绑定旧atlasIdentity，仍按既有版本保护拒绝静默重新解释，原标注保留；不能把旧provisional结果自动变成全覆盖模拟结果。

## 预览

[左完整模拟分区](axilla-left-full.png)、[右完整模拟分区](axilla-right-full.png)、[左右标签](labels.png)、[皮肤与并集](skin-union.png)、[未定区](undefined.png)、[左实际合成请求匹配](axilla-left-matching.png)、[右侧](axilla-right-matching.png)。均带非医学图谱提示，SVG可编辑。它们是本地实际JSON/SVG静态渲染，不是微信截图或真实患者。

## 文件与验证

新增scripts/build_axilla_schematic.py、新data/atlas/axilla-schematic-v1五个数据文件、axilla-schematic.generated.ts、axilla_schematic_service.py、后端专项测试以及本目录。调整局部loader的显式人工来源分支、atlas registry、来源schema/API文档、前端registry/类型/状态校验、腋下Page和测试。V4数值匹配器、既有全身/手部/脚底数据和P6机制不改。

实际前端351、后端+AI311通过；TS、wcc/wcsc及历史数据检查通过。详见[测试记录](regression-tests.md)。[区域设计](region-design.md)说明曲线与左右变换；[生成与合同](generated-atlas.md)说明来源、门禁及后续医学版本替换。

## 用途边界与后续

三个标签仅是界面模拟符号，不用于确诊、真实受累神经判断、治疗决策、严重程度或预后评估。医学审核仍pending；NOT_MEDICALLY_VALIDATED明确保留。未来医学图谱需独立来源/许可/签署/版本，不能把本版改个审核字段就升级为医学验证结果。

完整模拟范围只覆盖当前显示的可标注局部皮肤；它不解决模板缺肩/肘标志、真实皮肤形变、个体差异或深部不可见面的医学问题。本轮停止，不部署、不上传、不进入会阴。
