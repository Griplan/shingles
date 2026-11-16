# 会阴模拟图谱

## 身份

| 字段 | 值 |
| --- | --- |
| atlasId | `perineum-schematic-v1` |
| atlasVersion | `perineum-schematic.1` |
| atlasType | `SCHEMATIC` |
| sourceType | `ARTIFICIALLY_CONSTRUCTED` |
| reviewStatus | `NOT_MEDICALLY_VALIDATED` |
| intendedUse | `INTERACTIVE_SIMULATION` |
| medicalReviewStatus | `pending` |
| mappingEnabled | `false` |

图谱文件位于 `data/atlas/perineum-schematic-v1/`，包含 `manifest.json`、`perineum-overview.json`、`sources.json` 和 `registration.json`。小程序运行时数据由 `scripts/build_perineum_schematic.py` 确定性生成。

## 模拟区域

| 标签 | 界面名称 | 示意位置 | 有效皮肤面积 |
| --- | --- | --- | --- |
| S2 | 模拟 S2 | 上部和两侧骨盆周围 | 0.256051252393829 |
| S3 | 模拟 S3 | 下方及内侧大腿上下文 | 0.246803628762572 |
| S4 | 模拟 S4 | 中央会阴区域 | 0.074643896954871 |
| S5 | 模拟 S5 | 肛门周围窄环 | 0.005099897798895 |
| UNDEFINED | 模拟未定区 | 中央前侧/泌尿生殖面 | 0.025695446328684 |

这些名称只是界面模拟符号。图谱没有声称它们来自真实皮节边界，也没有把相邻标签扩展为诊断结论。

## 几何规则

- 全部区域均为有效 `MultiPolygon`。
- 区域先裁剪到同一有效皮肤轮廓。
- 肛门开口保持为孔洞。
- 区域并集等于有效皮肤，面积重叠为 0。
- 公共边界来自同一裁剪运算，不依赖数组先后决定归属。
- `UNDEFINED` 参与几何交集，但不冒充骶神经标签。

## 匹配

后端继续使用 V4 的 FastAPI、Shapely 和原匹配公式。请求通过固定图谱注册表加载本图谱；响应保留：

- `atlas_type=SCHEMATIC`
- `review_status=NOT_MEDICALLY_VALIDATED`
- `intended_use=INTERACTIVE_SIMULATION`
- `source_type=ARTIFICIALLY_CONSTRUCTED`
- 常驻 disclaimer

前端对这些状态字段做严格校验，缺失时拒绝发布结果。开发版和受控体验版可以使用模拟匹配；正式发布环境仍受既有门禁保护。

## 与 Goran 的区别

本图谱不是 Goran 原始 Path 提取，也不是由 Goran 区域近似变换得到。它仅用于确保会阴模板任意有效皮肤位置都有明确的模拟分区反馈。原有全身、足底和腋下图谱不修改。
