# 实际验证记录（2026-11-05）

使用原Python3.12/ai/.venv、Shapely2.1.2、Node/TypeScript环境，无新依赖。

| 实际命令（仓库根） | 结果 |
|---|---|
| `npm --prefix miniprogram test` | 351通过/0失败/0跳过，9.821s；evidence/frontend.log |
| `PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests ai/tests -q` | 311通过、7条既有模型注册警告，30.50s；evidence/backend.log |
| `PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests/test_axilla_schematic.py -q` | 8通过/0失败，0.64s；已包含在311内，evidence/schematic-tests.log |
| `ai/.venv/bin/python docs/validation-records/v6.6-axilla/full-simulation/check_local.py` | TypeScript、旧空腋下复现、脚底复现、全身图谱检查、wcc/wcsc六项exit0；evidence/checks.json |
| `ai/.venv/bin/python docs/validation-records/v6.6-axilla/full-simulation/make_evidence.py` | 两侧实际FastAPI TestClient三片合成标注，200、三个模拟候选及完整状态；evidence/api-examples.json |
| `ai/.venv/bin/python docs/validation-records/v6.6-axilla/full-simulation/measure_local.py` | 2次预热+20次串行加载/校验/匹配；evidence/performance.json |

## 实际覆盖测试范围

独立左右的原皮肤完整求交、五个观察点/轮廓边缘、网格/并集面积、多片/内孔、重复并集去重、T1/T2/T3/跨区域、只有边界接触、外部拒绝、旧版本拒绝、左右实际坐标镜像、生产/unknown关闭。

前端用实际API合成fixture驱动共享Page和MatchingStore，对左右分别执行圈选三片→计算→三标签全部高亮→单标签筛选→全部→放大/复位→修改→重算；几何不被修改，响应丢失模拟状态任一字段则拒绝叠加。原provisional fixture使用原模型验证，空图谱仍不请求网络；没有删除历史兼容测试。

全套回归包含全身正背面、主人体手部、足底、V2/V4/V5及P6。97个既有部署清单中的数据、人体来源、AI代码和V4数值模块摘要不变（retained-history.json）；旧医学审计目录只读保留。没有恢复独立手掌、修改MobileSAM或云端。

## 首次失败与数值边界

schematic-first.log保留6通过/2失败：最初将裁切后的atlas区域本身作为用户标注，严格标注验证拒绝了约1e-20的皮肤外舍入残差。边界接触测试改为皮肤内部的共边片段，完整有效皮肤测试仍使用原皮肤几何，均通过；未放松用户标注校验或修改匹配公式。benchmark-first.txt记录同类初始计时输入失败，最终用原始完整皮肤作为三标签基准输入。

## 性能

20轮同机中位：全身82.337ms，脚底3.257ms，新三分区腋下4.282ms。全身/脚底数值响应摘要与既有V6.6基线一致。历史计时背景负载未控制，不据此宣称固定提升/退化百分比或手机帧率；P6几何/并集与Canvas调度源码不改。

## 微信真实运行

NOT_RUN。已实际读取Shingles开发工具窗口，AX点击编译报invalid element ID；按截图坐标点击编译又报noWindowsAvailable。截图显示旧PROVISIONAL页面，未把旧图当作V6.6.3验收证据。wcc/wcsc输出成功只证明静态编译，不代表真实触摸/运行高亮已通过。尝试记录：evidence/wechat-attempt.json。

本轮没有生产服务器访问、部署、体验版上传、真实患者样本或临床验证。
