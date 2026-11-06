from pathlib import Path
import json
O=Path(__file__).parent
x=json.loads((O/'extraction.json').read_text());res=json.loads((O/'resource-check.json').read_text());perf=json.loads((O/'performance.json').read_text())
rows=[]
for e in x['sourceElements']:
 rows.append(f"| {e['label']} | `{e['route']}` | `{e['leaderRoute']}` | `{e['pathD_SHA256']}` |")
coverage=[]
for view,c in x['coverage'].items():
 coverage.append(f"| {view} | {c['skinArea']:.12f} | {100*(1-c['uncoveredRatio']):.6f}% | {100*c['uncoveredRatio']:.6f}% | L5 {c['labels']['L5']['parts']}片/{c['labels']['L5']['holes']}孔；S1 {c['labels']['S1']['parts']}片/{c['labels']['S1']['holes']}孔 |")
loss=[]
for view,c in x['coverage'].items():
 for label,a in c['sourceClippingLossArea'].items():loss.append(f"| {view}/{label} | {a:.12f} | {c['numericalContainmentLoss'][label]:.3g} | {res[view]['containmentOutsideArea'][label]:.3g} |")
text='''# Goran 足底原路径、模板配准与覆盖

## 源身份与标签的复核

固定原件 SHA1 `261566ce5128fdc2cc536945c148ac1c8f62e66d`。两个源元素没有XML id；使用完整结构路由+完整文件摘要+原d字符串SHA256识别。运行数据 `sourceElementId` 存路由，`sourceSVGId=null`明确不存在原id，不制造原始ID。

| 标签 | 实际源元素 | 原标签引线 | Path d SHA256 |
|---|---|---|---|
'''+ '\n'.join(rows)+'''

父节点 root/9 `translate(-1308.7,-38.43)` 与 root/9/1 `translate(904.76,42.43)` 合成为 `(1,0,0,1,-403.94,4)`。两个元素含原左右实例，不从数组位置单独断言身份。L5引线root/12/62的几何关联与V6.3原图一致，不能用XML紧邻的C1文本自动关联；S1引线为root/12/47。

整个原件无clipPath/mask/use。提取按原SVG绘制顺序减去后画填色面，不把遮挡的底层区域算作可见皮节。背景不取原神经彩色面作为皮肤全集：远端使用 root/9/0/0 原人体独立轮廓，近端沿真实S1跟垫上缘界定足底显示域；在原y=880处接到独立外形。这是显示域截取，不是新神经分界。

## 同源配准与左右

原图脚趾朝下；背面屏幕左侧是解剖左足。两侧按原x=210中间空白分离，不切穿足部。随后各自旋转180°、相同比例5.6放大，平移至320×640画布，最后分别除画布宽高归一化。没有横向镜像、非均匀拉伸、跨图谱近似配准或把足底坐标解释为back坐标。

公式为 `X=160−5.6*(x−cx)`、`Y=320−5.6*(y−896.175)`；x/y先是已累积SVG变换后的原图用户坐标，cx取各侧皮肤范围中心。再保存 `(X/320,Y/640)`。两轴在逻辑空间尺度相同，旋转矩阵行列式为正。具体矩阵在registration.json和extraction.json。

左足大趾在新画面左、右足大趾在右，已实际查看原图与独立PNG。这是工程方向核验，不代表医学审核签字。两侧外形和面积确实不完全相同，保留源图差异。

## 实际覆盖与未覆盖

| view | 归一化皮肤面积 | L5/S1覆盖 | 未配置比例 | 真实区域结构 |
|---|---:|---:|---:|---|
'''+ '\n'.join(coverage)+'''

面积基于当前二维显示域，不能解释为真实皮肤面积或跨模板累计。

| 表面 | 原图与本次提取结论 |
|---|---|
| 跟垫 | S1大面覆盖可见主体；近端邻踝接缝未自动补齐 |
| 足弓 | 可见投影有S1；无3D曲率和个体足弓校正 |
| 前脚掌 | 内侧L5、其余主面S1；使用原弯曲边界 |
| 五趾跖侧 | 原图五个可见趾腹均有实际着色；不推断每趾全部周面或单一神经归属 |
| 趾间孔隙/空白 | 原皮肤孔隙不是可标注皮肤；皮肤内着色细缝保留未覆盖 |
| 完整后跟周向、足背、趾侧隐面 | 不在独立足底模板中；不能外推 |

扫描全部50个背面着色Path：除L5/S1外，源p49/S2在两侧近端轮廓接缝分别有0.146643、0.063715原SVG平方单位可见交叠（显示皮肤的0.004750%/0.002035%）。它们是极窄的邻踝片，尚不能独立确认足底归属；记录为unconfigured，并计入未覆盖，不把两区扩大到整底。p36/L4另有约1.29e-15平方单位的纯数值边界残余，没有可测足底面积。完整清单在registration.unconfiguredAdjacentSourceFragments；没有预设只允许两个源标签后跳过其他元素检查。

## 原曲线到多边形及误差

使用既有svg_geometry适应性曲线采样，容差0.02原SVG单位；原evenodd填充转换为有效面，保留孔洞/小片。没有buffer平滑、凸包、片区过滤、补洞或形状简化。原d仍在固定SVG源文件。

源着色轮廓与独立皮肤描边存在微小不一致，按显示皮肤裁切且记录面积损失；没有把源区域扩到皮肤之外。下表第二列为原源空间面积，后两列为归一化面积，不能直接相加：

| 区域 | 原皮肤裁切损失 | 变换后精度处理前越界 | 最终浮点越界面积 |
|---|---:|---:|---:|
'''+ '\n'.join(loss)+'''

归一化运算使用1e-12数值网格并对共享皮肤边作数值节点统一；记录的皮肤变化Hausdorff小于6e-13，不是解剖补全。足底加载检查仅接受面积≤1e-12且Hausdorff≤1e-10的双重舍入误差，手掌原精确包含规则不变，病灶完整皮肤校验和V4匹配面积阈值未改。

0.02与0.01采样对照的最大归一化Hausdorff为 '''+f"{max(v for row in res.values() for v in row['samplingHausdorffNormalizedAgainstHalfTolerance'].values()):.12f}"+'''（按640逻辑轴保守换算约0.153像素）。这是两档采样的工程差异，不是医学位置误差上界。最终导出与当前提取面逐区对称差面积为0。L5/S1内部重叠最大约3.63e-15归一化面积，仅浮点残余；未使用数组优先级掩盖实际重叠。

原L5保留每侧2孔；右S1保留原曲线闭合端的极小独立片，未因小而删除，也不把它赋予新的医学语义。实际皮肤本身还有趾间孔隙，Canvas与完整合法性检查使用相同的独立轮廓。

## 复现

```bash
ai/.venv/bin/python scripts/build_sole_atlas.py          # 默认只读检查
ai/.venv/bin/python scripts/build_sole_atlas.py --write  # 显式重建足底，不写全身/掌图谱
ai/.venv/bin/python scripts/preview_sole.py
# 使用已有sharp；DERMATOME_SHARP_MODULE可指定现有安装路径
node scripts/render_sole.cjs
ai/.venv/bin/python docs/validation-records/v6.4/check_resources.py
```

原路径对照：[左原图](../../goran-full-atlas-audit/evidence/left-foot-original.png)、[右原图](../../goran-full-atlas-audit/evidence/right-foot-original.png)、[左源Path着色](../../goran-full-atlas-audit/evidence/left-foot-paths.png)、[右源Path着色](../../goran-full-atlas-audit/evidence/right-foot-paths.png)。最终[底图](models.png)、[全部](atlas.png)、[L5](L5.png)、[S1](S1.png)均为真实资源离线渲染。
'''
(O/'原路径提取与覆盖范围.md').write_text(text)
rows=[]
for name,r in perf['full_body'].items():rows.append(f"| {name} | {r['before']['p50']:.2f} / {r['before']['p95']:.2f} | {r['after']['p50']:.2f} / {r['after']['p95']:.2f} |")
locals=[]
for name,r in perf['local_views'].items():locals.append(f"| {name} | {r['summary']['p50']:.2f} | {r['summary']['p95']:.2f} |")
(O/'测试与验收记录.md').write_text('''# V6.4 技术测试与验收

2026-11-05，现有Apple Silicon arm64/macOS环境，Python3.12.14、项目既有TypeScript/Node/Shapely。没有新装框架或依赖，没有生产连接。

## 最终执行

| 实际命令/检查 | 结果 | 原始记录 |
|---|---|---|
| npm run typecheck --prefix miniprogram | PASS | typecheck.log |
| npm test --prefix miniprogram | **336通过，0失败** | frontend-final.log |
| PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests ai/tests -q | **283通过，0失败；7条既有依赖警告** | python-final.log |
| build_sole_atlas.py默认只读重现 | PASS | sole-sync.log |
| sync_palm.py --check | PASS，旧身份/数据不变 | palm-sync.log |
| sync_atlas.py --check | PASS | atlas-sync.log |
| sync_matching_body.py --check | PASS | body-sync.log |
| check_project.py | PASS，路由/配置结构检查，不是微信编译 | project-check.log |
| check_resources.py | PASS，原曲线、几何、PNG轮廓抽样 | resource-check.json/resources.log |
| 真实本地FastAPI足底/手掌请求 | 四视图均200，实际区域与来源返回 | http-evidence.json |
| 生产后端/手机/微信原生完整链 | **NOT_RUN** | wechat-attempt.json |

本轮新增8个前端测试、27个后端足底测试。既有全身、Servier掌侧、AI确认/放置/匹配、P6差分和union复用测试均在上列全套命令中实际执行；不是复用历史通过数。AI真实模型的全套医学效果实验没有重跑，不把AI单元/集成测试通过当作医学有效性验证。

## 覆盖内容

- 左右独立会话、四局部view显式注册、旧front/back/掌会话不受污染。
- 手动取点、闭合、多片、新增、撤销、取消、删除、确认；过期session/revision和迟到请求拒绝。
- 实际来源L5、S1单区；跨区；多个Polygon与孔洞；实际未覆盖细缝；边界接触零面积；不分配最近标签。
- 6个人工查看原图后固定的工程参考点，覆盖双侧前足、足弓和跟垫。真实未覆盖点另由几何差集构造，仅验证计算语义，不冒充医学参考真值。
- 页面调用真实FastAPI适配器后显示两标签/实际几何，单区/全部高亮；放大/复位不改坐标；320/375/430三个宽度的纯坐标往返。不是原生手机触摸测量。
- 原始L5孔洞、多片保留；四顶点均在皮肤但跨趾间孔隙的框被前后端完整校验拒绝。没有只查顶点。
- 错atlas/template/hash、左右混用、来源路由/标签/越界篡改、未知view、production门禁均拒绝。旧服务器无足底图谱时不会回退背面。
- PNG按alpha/皮肤几何抽样：左2592内部+2882外部、右2627内部+2843外部，排除边缘抗锯齿带；均通过。不是逐像素医学配准准确率。

失败记录保留：首轮后端旧测试认为sole-left应被schema拒绝，更新为V6.4有效view但不可使用掌图谱；新增前端测试初稿有删除前未选择和选点落在聚焦视口外的测试步骤错误，已纠正；后端新断言初稿把既有422写成400、未考虑完整源扫描得到的L4数值残余，也已更正。没有修改原匹配规则来适配预期答案。

## P6性能回归

全身加载器改前代码通过移除新增足底固定路由还原，并与本轮开始保存的SHA256逐字节相符。V4 matcher、P6皮肤索引、坐标、手工校验、V5放置代码本身与起始SHA一致。每场景先1对预热，再20对交替执行；逐请求完整响应深比较相等。计时含本地加载+匹配，不含网络/手机绘制。

单位ms，P50 / P95：

| 场景 | 改前 | 改后 |
|---|---:|---:|
'''+ '\n'.join(rows)+'''

这组同机数据未显示原全身关键匹配退化，不将小幅波动解释为优化倍数。另验证P6每请求每view一次完整图谱并集，5个标注和汇总共享；不同请求不共享。前端缓存索引的旧差分测试通过；没有新增高频监听或逐触摸全量计算。

局部视图本地加载+匹配，每项20次热样本：

| 视图 | P50 ms | P95 ms |
|---|---:|---:|
'''+ '\n'.join(locals)+'''

全部样本和环境在performance.json，复现脚本profile_and_http.py。样本规模有限，不能外推腾讯云CPU、手机帧率、并发容量或SLA；没有在生产压测。

## 微信与医学验收状态

尝试读取Shingles微信开发者工具，项目路径可见；点击编译返回无效元素编号，截图为216×290不可读过渡画面。未获得新脚底可操作画面，因此原生渲染、实际触摸、真机、微信完整计算都记NOT_RUN。未请求用户接管，也未上传体验版。

静态PNG已实际查看左右、大趾、足弓、跟垫、L5/S1覆盖；这是资源视觉核验。医学专业审查、个体差异、完整3D皮肤及邻踝S2归属仍未完成。技术测试成功不改变pending。
''')
