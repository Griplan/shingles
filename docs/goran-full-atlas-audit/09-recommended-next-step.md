# 下一轮建议与本轮验证范围

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
