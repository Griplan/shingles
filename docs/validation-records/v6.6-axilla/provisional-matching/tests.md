# 实际测试记录（2026-11-05）

Python3.12 / 原ai/.venv / Shapely2.1.2；原Node/TypeScript工具，没有安装新依赖。所有病灶为合成几何，没有患者照片或临床标注。

| 实际命令（仓库根） | 结果 | 证据 |
|---|---|---|
| `npm --prefix miniprogram test` | 350通过，0失败/跳过，9.576s | evidence/frontend-final.log |
| `PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests ai/tests -q` | 303通过，7条既有模型注册警告，29.27s | evidence/backend-final.log |
| `PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests/test_axilla_provisional.py -q` | 专项7通过，0.28s；已包含在303内，不相加 | evidence/provisional-tests.log |
| `ai/.venv/bin/python docs/validation-records/v6.6-axilla/provisional-matching/check_local.py` | 6项命令exit0，TypeScript、旧腋下复现、脚底复现、全身图谱核验、wcc、wcsc | evidence/checks.json及各日志 |
| `ai/.venv/bin/python docs/validation-records/v6.6-axilla/provisional-matching/make_evidence.py` | 两侧实际FastAPI TestClient计算200，响应带PROVISIONAL/HIGH | evidence/real-api-examples.json |
| `ai/.venv/bin/python docs/validation-records/v6.6-axilla/provisional-matching/measure_local.py` | 2轮预热+20轮实际串行加载/校验/匹配 | evidence/performance.json |

## 已验证范围

左右有效几何/皮肤内包含/正行列式/无面积重叠；原侧源路径与d摘要；源片变换与运行几何一致；T1单区、T2单区、跨边线两标签、仅边界接触不返回邻区、完全未覆盖、MultiPolygon与内孔、重复标注并集去重、身份过期拒绝、原空图谱仍409、生产/未知环境403。

前端还验证PROVISIONAL状态缺失时拒绝响应、实际后端fixture通过MatchingStore、计算不改保存的标注、共享页面显示T1/T2预览、左右会话及全身/足底隔离、缩放/复位/三种宽度、release/trial环境能力。Node模拟页面不等于微信页面实测。

全套后端含全身136区、主人体手部、足底及AI流程；前端含V1～V5和P6。旧214文件基线中204文件不变，10项是本轮有意的路由/schema/注册/状态校验和页面/类型改动，清单见checks.json。所有既有data/body、data/atlas、显示素材、V4数值匹配器及P6几何模块摘要保持不变；新图谱只写新目录。

## 首次失败保留

frontend-first.log保留3个旧断言失败：它们把当前入口永久视为未就绪。现改为当前入口断言PROVISIONAL，另对旧空图谱显式注入旧model继续验证0网络请求与未就绪。没有删除旧拒绝路径。

provisional-tests-first.log保留一次浮点断言失败：未覆盖比值0.9999999999999998，测试原写严格等于1；改用浮点近似断言，数值匹配器没有改。生成证据期间一次追加测试命令在miniprogram目录使用了仓库根相对路径，返回文件不存在；已改正目录，最终测试已实际包含新增的两项状态/Store测试。

## 性能与真实运行边界

本轮同机20轮中位：全身79.811ms，脚底3.133ms，新腋下1.239ms。全身/脚底响应去除新增可选null字段后SHA与V6.6历史记录完全一致。历史中位78.365/3.044ms仅作背景，非同步受控前后对照，不据此宣称加速或固定帧率。原P6并集复用、闭合校验和Canvas调度不改；本轮有限本机采样未显示数量级退化。

微信wcc/wcsc已实际编译局部页面/组件成功；**微信运行/手机触摸/真实自动高亮：NOT_RUN**。离线图与ASGI结果不能冒充运行截图。医学审核、临床定位准确性、模型再推理、服务器部署及体验版上传均NOT_RUN/不在本轮范围。
