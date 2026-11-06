# 腋下参考图谱未就绪

`axilla-reference-v1 / axilla-unconfigured.1`，绑定 `commons-axilla-v1 / 1.0.0 / cc0-raised-axilla-outline-v1`。

两个视图均 `regions: []`；0 个已配准神经标签，0 个可计算区域实例。许可证 UNKNOWN 指**未取得皮节边界来源**，不是显示底图 CC0 不明确。`medicalReviewStatus: pending`、`mappingEnabled: false`；前端不发送计算，后端明确返回409 ATLAS_NOT_READY。不得将空图谱解释成正常的“未覆盖100%”匹配成功。

Goran 原始 T1/T2/T3/T1/T2 路径仅留在审计证据，未转换到抬臂坐标。来源、授权和阻塞理由见 `docs/validation-records/v6.6-axilla/`。今后接入真实边界必须重新配准、绑定新图谱身份、核查视图和医审状态，不能只翻转 readiness 开关。
