# V6.6 坐标、配准与版本

| 字段 | 值 |
|---|---|
| viewId | axilla-left / axilla-right |
| templateId / version | commons-axilla-v1 / 1.0.0 |
| geometryId | cc0-raised-axilla-outline-v1 |
| regionSetId | commons-axilla-ui-v1 |
| 逻辑画布 | 400×360；运行透明PNG800×720 |
| 坐标 | normalized_2d_top_left；病灶geometry.coordinateSpace仍为body_template_normalized_v1，另强制绑定模板、view及身份摘要 |
| atlasId / version | axilla-reference-v1 / axilla-unconfigured.1 |
| 技术/许可/医审 | blocked_missing_boundary_evidence / unconfigured / pending |

显示源原图4000×3000，统一缩到900×675编辑坐标；人工描摹的轮廓与褶线保存在生成脚本和resource.json。右图的逻辑点为 `(0.42*x+10, 0.42*y+30)`，除以400/360得到归一化点；左图再镜像x。该步骤是**显示素材生成**，不是Goran皮节配准。没有平移旧front/back的标注或把照片坐标混入当前人体。

皮肤闭合曲线以0.2编辑像素容差采样为Polygon，删除重复连续点而不做凸包或平滑。名义转换尺度为0.084逻辑像素；该数只是采样参数换算，不是人工描摹误差上限或医学定位精度。SVG、PNG、body.json和前端数据来自同一轮廓。完整多边形有效性、外部空白、跨凹陷边、三屏触摸往返和镜像对称已测试。不可见面保持不可标注；不将整张图片包围矩形当皮肤。

**皮节配准未执行成功。** 不存在足够的跨姿态控制点、可追踪的隐藏面和完整合法边界，故registration.method=null，sourceElements=[]，registeredRegionCount=0。没有仿射误差/RMS可报告；更不能把显示源采样容差称为神经配准误差。

复现命令（仓库根目录）：

```sh
ai/.venv/bin/python scripts/build_axilla.py
ai/.venv/bin/python scripts/audit_axilla_sources.py
ai/.venv/bin/python scripts/preview_axilla.py
DERMATOME_SHARP_MODULE=/Users/griplan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp node scripts/render_axilla.cjs
```

最后一条只用本机既有Sharp导出，不是运行时依赖。更新编辑源后才使用build_axilla.py --write；不要手改生成JSON。未发布前的Thomson试稿归档、不复用其坐标。

后续引入有依据的边界时需新图谱版本及摘要，重新检查各侧模板对应、孔洞、多片、未覆盖和标签。旧标注会话遇身份变化会明确拒绝复用，不静默迁移。是否能够沿用同一显示模板还需审核；不预先承诺。
