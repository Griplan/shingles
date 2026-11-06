# 独立试验图谱合同

- atlasId：`axilla-goran-provisional-v1`
- atlasVersion：`goran-axilla-provisional.1`
- atlasStatus：`PROVISIONAL`；reviewStatus：`UNREVIEWED_PROVISIONAL`；uncertaintyLevel：`HIGH`
- template：`commons-axilla-v1 / 1.0.0`；geometry：`cc0-raised-axilla-outline-v1`。底图、bodyContentSHA256和坐标完全不变。
- views：`axilla-left`、`axilla-right`，每侧T1、T2各1个MultiPolygon实例（本次各有1外环、0孔洞），共4实例；未配置T3或拆分T1/T2。
- 目录：`data/atlas/axilla-goran-provisional-v1/`，manifest、sources、registration及两侧JSON。

旧 `axilla-reference-v1 / axilla-unconfigured.1` 原目录不改，仍0区域/ATLAS_NOT_READY。当前局部入口改用新独立图谱，使用 `axilla-provisional.generated.ts`；旧generated和原生成器可复现。生成命令：`ai/.venv/bin/python scripts/build_axilla_provisional.py`。修改控制点后必须重建、回归并在已交付版本之后升atlasVersion，不能静默替换已分析结果的身份。

每实例包括viewId、atlasId/version、side、dermatomeLabel、polygonGeometry/geometry、sourceFile、sourcePathId/d摘要、registrationMethod、derivationClass、uncertaintyLevel、reviewStatus。几何全部B类；源A类几何保存registration.sourceElements；C类无。polygonGeometry是geometry的同一离线结果，不是单独绘图猜测。

后端通过独立registry和共享局部加载器加载，复用V4。加载器继续验证身份、摘要、有效皮肤、授权来源、标签/侧别/变换和派生形状。独立validator拒绝无记录延伸。正式医学映射仍 `mappingEnabled=false, medicalReviewStatus=pending`；局部模拟就绪仅表示离线几何配置成功。

API仍POST /api/v1/evaluate。仅新图谱响应source新增 `atlas_status=PROVISIONAL, uncertainty_level=HIGH`，完整提示进入warnings和coverage_note；请求/响应identity绑定新图谱。旧普通响应不添加null状态字段。小程序检查新身份必须返回PROVISIONAL/HIGH，否则拒绝叠加；结果状态和JSON记录会保留它们。

develop/trial复用现有referenceMatching能力；release/unknown关闭网络匹配。服务端仍需现有ENABLE_REFERENCE_MATCHING及开发/test或已鉴权controlled服务，客户端环境不构成服务器认证。没有移除鉴权或部署约束。

原V2标注几何不迁移、不删除。模板相同但图谱身份不同的既有内存会话仍由原版本保护拒绝重新解释，原记录保留；本轮不静默修改历史atlasIdentity。重启本来不持久化的局部会话后可开始新版本模拟。
