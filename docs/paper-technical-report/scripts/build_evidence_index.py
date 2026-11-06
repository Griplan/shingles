from pathlib import Path
import re,json
r=Path(__file__).resolve().parents[3];p=r/'docs/paper-technical-report'
rows=[
('E01','当前版本、边界与来源快照',['AGENTS.md','task.md','miniprogram/data/body-models.ts','miniprogram/config/environment.ts','data/atlas/goran-2022-preview-v2/manifest.json'],'A：当前代码与只读统计','可写版本；旧包version不是阶段；无Git HEAD'),
('E02','当前人体与有效轮廓',['miniprogram/assets/body/commons-cc0/NOTICE.md','scripts/prepare_commons_body.py','scripts/prepare_commons_body.cjs','data/body/commons-template4.json'],'A：原作、派生脚本及绑定；医审非本项','可写CC0提取与逻辑尺寸，不能称人体个体配准'),
('E03','SVG可见区域及标签数字化',['scripts/svg_geometry.py','scripts/prepare_atlas.py','data/atlas/goran-2022-preview-v2/source-map.json'],'A：源码＋离线来源/几何校验','可描述路径、填充、遮挡与标签来源映射'),
('E04','全身工程行映射',['scripts/prepare_atlas.py','data/atlas/goran-2022-preview-v2/registration.json','data/atlas/goran-2022-preview-v2/registration-report.json'],'A：实现与数值检查；医学B','可写插值与误差参数；不可写解剖精度'),
('E05','面部/足部扩展与114实例',['scripts/prepare_atlas_extensions.py','scripts/check_preview_atlas.py','scripts/test_atlas_extensions.py','data/atlas/goran-2022-preview-v2/local-registration.json'],'A：重新调用check，未写正式validation','全量清单及工程继承验证；未覆盖表面保留'),
('E06','真实MobileSAM加载与预处理',['ai/inference/mobile_sam.py','ai/preprocessing/image.py','ai/models/MobileSAM-source/mobile_sam/build_sam.py','ai/models/MobileSAM-source/mobile_sam/predictor.py','ai/models/MobileSAM-source/mobile_sam/modeling/sam.py'],'A：固定源码与历史真实推理','可描述真实架构、尺寸、Mask恢复；未训练专用模型'),
('E07','照片/人体/显示变换',['miniprogram/utils/coordinate.ts','miniprogram/utils/photo-coordinate.ts','miniprogram/utils/placement-geometry.ts'],'A：源码、回归、1341独立oracle','可写相似变换及完整包含，非自动定位'),
('E08','唯一会话与正式确认',['miniprogram/state/annotation-session.ts','miniprogram/state/placement-session.ts','miniprogram/types/annotation.ts'],'A：状态测试及历史HTTP','可写完整多片孔洞保留，不承诺云病例持久化'),
('E09','Mask到像素单元并集',['ai/postprocessing/polygons.py','ai/tests/test_geometry.py'],'A：源码、合成与历史真实Mask回转','保真度不是医学分割准确率'),
('E10','裁剪、候选质量与真实画笔',['ai/inference/local_regions.py','ai/postprocessing/quality.py','ai/postprocessing/brush.py','ai/segmentation.py','ai/tests/test_oversegmentation.py'],'A：已实现、有限真实实验；普遍效果B','可写策略，不能断言普遍改善误选'),
('E11','照片接口与防迟到状态',['backend/app/services/ai_sessions.py','backend/app/api/routes/ai.py','backend/app/schemas/ai.py','miniprogram/state/ai-session.ts'],'A：API、状态单测与历史联调','版本保护/超时/临时隔离；真机另记'),
('E12','人体请求结构与完整后端校验',['backend/app/schemas/evaluate.py','backend/app/utils/geometry.py'],'A：测试及独立几何','可写严格校验，非疾病判别'),
('E13','真实图谱求交及并集去重',['backend/app/services/atlas_service.py','backend/app/services/dermatome_matcher.py'],'A：核心测试、合成与HTTP','覆盖比是几何量，非诊断概率'),
('E14','匹配结果失效与覆盖展示',['miniprogram/state/matching-session.ts','miniprogram/utils/matching-presentation.ts','miniprogram/components/body-canvas/body-canvas.ts','miniprogram/utils/overlay-transition.ts'],'A：状态与有限工具验证；本版手机B','显示不改变人体几何，过期返回拒绝'),
('E15','本次前端298测试与typecheck',['docs/paper-technical-report/audit/frontend-tests.txt','docs/paper-technical-report/audit/typecheck.txt','scripts/test_miniprogram.cjs'],'A：本次执行','非手机/医学测试，不累加历史数量'),
('E16','本次Python180测试',['docs/paper-technical-report/audit/python-tests.txt'],'A：本次执行','假模型测试不能称真实推理；7 warnings保留'),
('E17','V5.1样本与9组主实验',['ai/experiments/sources.json','ai/experiments/cases.json','ai/experiments/run_suite.py','docs/validation-records/v5.1/report.md'],'A：历史真实模型与失败记录','3来源照片含同病例，2合成；专家真值不存在'),
('E18','CPU/MPS性能',['docs/validation-records/v5.1/benchmark-cpu.json','docs/validation-records/v5.1/benchmark-mps.json'],'A：历史4次/设备','区分冷暖、RSS及MPS内存；不当医疗指标'),
('E19','过度分割19流程21调用57候选',['ai/experiments/oversegmentation.py','docs/validation-records/v5-oversegmentation/experiment-summary.json','docs/validation-records/v5-oversegmentation/report.md'],'A：历史有限样本','候选顺序改变不代表临床改善'),
('E20','画笔撤销与真实Mask修改',['docs/validation-records/v5-oversegmentation/report.md'],'A：历史HTTP/开发工具','2净笔画4操作；无完整人工用时对照'),
('E21','放置优化配对基准',['scripts/compare_placement_performance.cjs','docs/validation-records/v5.3-performance/summary.json','docs/validation-records/v5.3-performance/report.md','miniprogram/components/placement-overlay/preview.ts'],'A：Node3次配对中位数','事件总耗时不等于GPU帧时'),
('E22','原生Canvas事件回放',['docs/validation-records/v5.3-performance/report.md'],'A：历史开发工具；真机B','无同设备优化前对照；结束校验仍约0.6s'),
('E23','Linux低负载真实模型',['docs/validation-records/tencent-cloud-mobile-sam-p0-20261101/final-state-and-summary.json','docs/paper-technical-report/audit/linux-performance-extract.json'],'A：历史3个独立串行进程','线程/资源受限；非多用户容量或医学性能'),
('E24','P4.2真实公网闭环',['docs/validation-records/p4.2-no-invitation-20261102/public-test-access.json','docs/validation-records/p4.2-no-invitation-20261102/public-flow/real-page-http.json','docs/validation-records/p4.2-no-invitation-20261102/protection.json'],'A：真实HTTP＋页面适配器','不是当前手机原生验收'),
('E25','本次只读云状态',['docs/paper-technical-report/audit/server-readonly.json'],'A：本次SSH查询','只证明当时active、监听和资源，不证明未来高峰'),
('E26','独立部署与安全界限',['deployment/dermatome.service','deployment/nginx.dermatome-ip-test.conf','deployment/public-ip-control.sh','backend/app/services/access.py','backend/app/services/trial_access.py'],'A：代码、历史检查、本次服务状态','HTTP不加密；公共会话不是可信用户身份'),
('E27','trial免邀请码功能配置',['miniprogram/config/environment.ts','miniprogram/services/api.ts','miniprogram/services/ai.ts','miniprogram/services/trial-access.ts','backend/app/api/routes/access.py'],'A：代码和HTTP；手机B','develop/trial业务与release隔离；无包内共享key'),
('E28','医学审核与缺失覆盖',['data/atlas/goran-2022-preview-v2/manifest.json','data/atlas/goran-2022-preview-v2/coverage.json','ai/experiments/sources.json'],'B：明确pending；C：专家研究未实施','不写医学已验证；Dice等NOT_MEASURED'),
('E29','模型/图谱/人体/图片许可',['ai/licenses/MobileSAM-Apache-2.0.txt','data/atlas/goran-2022-preview-v2/NOTICE.md','miniprogram/assets/body/commons-cc0/NOTICE.md','ai/experiments/sources.json'],'A：固定文件＋官方页面核验','派生图谱需署名和相同许可，整项目许可不擅定'),
('E30','历史与当前差异、手机证据边界',['README.md','docs/architecture.md','docs/api.md','docs/v5-ai-segmentation.md','task.md'],'B：手机上传/验收缺证据','以现行代码和对应时点证据解释，保留历史失败')]
text='# 技术结论与证据索引\n\n2026-11-02。A/B/C必须连同验证层次阅读；A不表示医学有效。源文件字节摘要见[manifest](audit/source-manifest.json)，全部函数定位见[symbol-index](audit/symbol-index.json)。以下链接相对本包；行号按本次快照，后续改动需重新生成。\n\n'
text+='| ID | 技术结论 | 实际状态 | 论文使用界限 |\n|---|---|---|---|\n'
for eid,claim,paths,status,scope in rows:text+=f'| [{eid}](#{eid.lower()}) | {claim} | {status} | {scope} |\n'
missing=[]
for eid,claim,paths,status,scope in rows:
 text+=f'\n## {eid}\n\n**{claim}**。{status}；{scope}。\n\n'
 for path in paths:
  f=r/path
  if not f.exists():missing.append(path);continue
  # Small readable representative declarations, exact full listing provided in symbol index.
  lines=f.read_text(errors='replace').splitlines() if f.suffix in ['.py','.ts','.cjs'] else []
  symbols=[(i,l.strip()) for i,l in enumerate(lines,1) if re.match(r'^(?:export )?(?:async )?(?:def |class |function )',l)]
  loc='；'+ '；'.join(f'第{n}行 `{s[:110]}`' for n,s in symbols[:5]) if symbols else ''
  text+=f'- [{path}](../../{path}){loc}。\n'
text+='''
## 历史差异的处理

| 历史表述／数字 | 本次结论 | 原因与处理 |
|---|---|---|
| 正面23标签／46实例，背面30／60 | 正面27／54，背面30／60；全体114实例 | preview.2加入V1/V2/V3和可见S1；不照抄旧规模 |
| AI未实现、V2以后TODO | 当前代码已包含V5.4与分割专项 | 分阶段追加文档尚有历史段落；不篡改旧记录 |
| trial baseURL为空／需邀请码 | 当前独立HTTP公网IP＋受限公共会话 | P4.2取消前台邀请码；旧exchange路由保留兼容，不是当前必经 |
| health=v0、应用v4、包0.0.0 | 兼容元信息，不能当功能版本 | 模板、atlas和数据hash分别绑定 |
| 优化前后性能／自动工具验收 | Node配对与工具原生回放分开 | 无手机同比，不用静态截图替代真机 |
| 裁剪后面积变小等于变好 | 有些扩大、有些仍失败 | 无专家真值，不能做准确率或优越性断言 |
| 免邀请码等于无需服务端隔离 | 仍需限时bearer和照片owner | 公共申请不验证真人身份；HTTP仅测试 |
| 服务器已部署等于手机完成 | 云端工程A；当前手机B | 用户稍后上传，新体验版/真机仍NOT_RUN |

## 证据层次矩阵

| 内容 | 源码 | 自动化 | 真实模型/HTTP | 开发工具 | 当前手机 | 医学专家 |
|---|---|---|---|---|---|---|
| 分割/修正/确认 | 有 | 通过 | 历史有 | 部分历史有 | NOT_RUN | NOT_MEASURED |
| 人体多片放置 | 有 | 通过 | 历史数据闭环 | 历史有 | NOT_RUN | NOT_MEASURED |
| 神经参考匹配 | 有 | 通过 | 历史有 | 历史有 | NOT_RUN | pending |
| 图谱数字化 | 有 | 本次只读通过 | 离线资源 | 预览证据 | 不构成医学检查 | pending |
| 双服务云运行 | 有配置 | 历史保护测试 | 本次只读状态正常 | 不适用 | 不替代手机网络 | 不适用 |

医学指标、操作者实验、临床验证均不能用上述工程证据补位。本次没有运行新模型实验；历史样本与失败仍按原时间、设备记录。
'''
(p/'技术结论与证据索引.md').write_text(text)
print('Missing paths:',missing)
