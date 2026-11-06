# V6.6 实际验证记录

日期2026-11-05，开发机macOS arm64，Python3.12（既有ai/.venv），原Node/TypeScript工具；没有安装新依赖。测试病灶均为明确的合成几何；不提供临床准确率。

## 自动测试与静态检查

| 实际命令（仓库根目录） | 结果 | 证据 |
|---|---|---|
| `npm --prefix miniprogram test` | PASSED，348项，0失败/跳过；9.436秒 | evidence/frontend-tests.log |
| `npm --prefix miniprogram run typecheck` | PASSED，exit0 | evidence/typecheck.log |
| `PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests ai/tests -q` | PASSED，296项，28.83秒；7条既有MobileSAM/timm模型注册警告 | evidence/backend-ai-tests.log |
| `PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests/test_axilla.py -q` | PASSED，16项，0.31秒；补充左右合成请求镜像后复测 | evidence/axilla-tests.log |
| `ai/.venv/bin/python docs/validation-records/v6.6-axilla/verify.py` | PASSED，7条命令exit0；50个保护文件摘要不变 | evidence/checks.json、protected-before/after.json |

verify.py实际执行：axilla10文件只读复现、Goran9元素复查、sole只读复现、全身136区/49229顶点/17孔洞检查、现有静态工程检查、微信工具自带wcc和wcsc。编译涉及special-parts、local-surface、local-surface-canvas；输出摘要见evidence/wechat-compiler.json。**编译成功不是微信页面交互通过。**

### 新增测试证明的范围

- 实际左右皮肤轮廓、CC0源摘要、生成结果一致、视图身份、镜像朝向。
- 源照片人工参考点：中央、两褶附近、近端内臂、胸侧均能闭合圈选；留白点拒绝。
- 跨皮肤外部凹陷的三角形，即使所有顶点在皮肤内也拒绝；自交、空草稿、重复操作受现有V2规则保护，边界接触有效。
- 多片及孔洞几何可由现有完整几何校验承载，没有被填充/凸包化。**现有手动页只画简单闭合环，没有新增“挖孔”编辑器或AI导入入口**；此项不能表述成用户可手绘孔洞。
- 四个局部视图独立会话、切换/重入、撤销/删除/确认、版本变化和旧事件保护；全身单例未变。
- 320/375/430宽度、聚焦和复位的坐标往返；调用真实共享Page方法验证导航/关闭圈选/未就绪状态。Node适配器不是微信运行时。
- 前端未就绪时0次网络请求；真实ASGI接口两侧均409 ATLAS_NOT_READY，无假候选、无最近T2分配；见evidence/api-unready.json。
- 错误身份409 VERSION_MISMATCH、跨模板view409 VIEW_UNSUPPORTED、坏文件/伪开关503 ATLAS_UNAVAILABLE、production禁用403。
- 回归集合含全身正背面、V6.5手部实际Goran实例、足底L5/S1实际匹配/标签/单区与全部高亮、V2、V4、V5.1～5.4及P6既有测试。独立手掌仍退役；没有恢复入口。

### 初次失败与修正

保留frontend-tests-initial.log：347通过、1失败；测试在局部放大后还断言屏幕外参考点能转换回来，实际公共坐标函数按设计返回null。改为对每个参考点分别聚焦，再验证可见点往返；**没有改坐标公式**。

保留axilla-tests-initial.log：14通过、2失败；跨模板视图的现有业务状态码是409，测试误写422，已按真实既有契约修正，没有修改匹配器。新试稿改源的原因另存rejected-thomson/rejection.md；没有隐去失败试稿。

## P6同条件回归

命令：`ai/.venv/bin/python docs/validation-records/v6.6-axilla/measure.py before`、同脚本`after`。同一机/环境/真实全身和足底请求，各2轮预热+20轮串行，计时包含图谱加载/校验/匹配。真实原始耗时与响应摘要分别保存在performance-before/after.json。

| 请求 | 前中位(ms) | 后中位(ms) | 前p95(ms) | 后p95(ms) | 响应 |
|---|---:|---:|---:|---:|---|
| 原全身 | 79.774 | 78.365 | 88.142 | 86.617 | 完全相同SHA256 |
| 原足底 | 3.067 | 3.044 | 3.116 | 3.077 | 完全相同SHA256 |

有限样本未见明显退化，不声称加速倍数、手机帧率或统计显著性。新增腋下未配置，无真实神经区域并集性能可测；没有用空图谱耗时冒充神经匹配性能。

共享Canvas继续使用静态图片Promise缓存和单个待绘制rAF；运行时不解析SVG。touchmove只辨别拖动，不跑完整几何；闭合才调用原P6校验。模型/图谱在registry内冻结，未新建动画循环。共享Canvas缓存/取消/过期触摸测试在完整前端集内通过；未实测原生帧耗时。

## 微信、人工和医学验收

**微信交互 / 手机：NOT_RUN。** 已用CUA读取到Shingles项目；会话先要求恢复接口文档，恢复后应用名获取失败，再以实际bundle ID获得项目状态。点击“编译”返回invalid element ID，实际截图只显示缩小倾斜窗口，无法可靠继续。没有以旧页面状态、编译器或静态预览代替微信截图，也没有执行体验版上传。

**视觉资源目检：已执行。** 已查看源照片、候选源、左右PNG、原图描摹对照、Goran原图裁切；确认裁切局限并弃用Thomson试稿。完整肩部、两褶解剖命名与用户辨识度尚需人工/专业验收。生成预览明确为静态图。

**腋下成功匹配/神经高亮：BLOCKED。** 无已配准真实区域，不执行虚构单区/跨区成功测试；原全身/足底成功匹配回归继续通过。

**医学审核：NOT_RUN。** 需专家审核观察角度、左右、前后褶/中央参考点、合法皮节边界来源、跨姿态映射误差与重叠。没有医学专家、真实病灶真值或临床研究结果。

**云端部署、体验版上传、MobileSAM新推理：NOT_RUN。** 本轮不需要并且未执行；AI是已有自动回归，不是重新进行临床或真实模型质量评估。
