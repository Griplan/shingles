# V5.2 实际验证记录 · 2026-10-27

状态以根task.md为准。本记录区分代码/替身、真实HTTP模型、微信人工协作操作；没有临床或生产部署验收。环境macOS15.6.1、M4/16GB、Python3.12.14、Node24.11.1、TS5.9.3；微信Stable2.01.2510290/base3.17.4、iPhone6/7/8模拟器。只有本机127.0.0.1:8000，未上传第三方AI，未改工具安全设置。

## 可复现命令与结果

从仓库根运行；原始日志保留首次/中间结果，最终引用下列文件。

| 实际命令 | 实际结果 | 证据 |
| --- | --- | --- |
| `ai/.venv/bin/python -m pip install -e 'backend[dev,ai-service]'` | PASSED，仅AI环境，复用权重 | install-service.txt |
| `ai/.venv/bin/python -m pytest ai/tests -q` | 78 PASSED，7条既有上游warning；V5.1原55+服务23 | ai-tests-second.txt（首轮75另存） |
| `npm test --prefix miniprogram` | 184 PASSED，原154+新增30 | frontend-final.txt（173/183中间记录保留） |
| `npm run typecheck --prefix miniprogram` | PASSED | typecheck-final.txt |
| `backend/.venv/bin/python -m pytest backend/tests -q` | 47 PASSED，原核心环境无需Torch/multipart | backend-core.txt |
| `ai/.venv/bin/python -m pytest backend/tests -q` | 同47项PASSED，更新FastAPI的AI环境回归 | backend-ai-env.txt |
| `backend/.venv/bin/python scripts/check_project.py` | PASSED，六页与组件配置 | project-final.txt |
| `ai/.venv/bin/python -m pip check` | 无依赖冲突；受限pip缓存警告不影响检查 | pip-check.txt |
| `ai/.venv/bin/python -m pip freeze` | 实际包版本留存 | ai-environment.txt |
| `zsh -n 启动AI后端.command` | exit0；Finder双击本身NOT_RUN | 当前命令结果 |
| `ai/.venv/bin/python scripts/verify_v52_http.py` | PASSED，真实模型两轮6候选、显式确认、删除及删除后拒绝 | real-http-run.txt、real-http.json |
| `node scripts/test_matching_http.cjs` | PASSED，对当前AI启用服务的既有V4合成回归 | v4-http-regression.txt |

HTTP实验初次脚本输出固定 `ai/experiments/outputs/v52-http-20261027`，拒绝覆盖。收尾为后续复现加 `--output`，默认新时间戳目录，summary写到新输出目录，避免覆盖本次历史JSON；帮助及语法检查通过（http-script-help.txt），没有因此重复计算或冒称新增样本。

## 自动化覆盖和限制

- 后端：真实解码/EXIF、伪MIME/损坏/格式拒绝、实际字节限制、提示合法性、FG/BG/框、多个真实形状类型、空Mask/巨大Mask/碎片/相似警告、模型缓存与失败、超时、TTL、重启残留、单目录独占、取消推理后不得复活、旧修订/错照片/旧Mask、令牌隔离与删除、确认多片/孔洞/像素、生产关闭、手动health不受影响。单测模型为可控替身，不计作真实推理。
- 前端：三种显示尺寸及DPR、等比留白坐标、局部/client触摸坐标、拖框/两类点/撤销/重置、候选预览与确认分开、空Mask不能确认、过大警告不改Mask、换照片A→B后旧上传/推理不覆盖、旧提示/预览/确认不复活、下载尺寸/照片身份、网络超时/会话过期/删除失败、真机/发布禁用。原生Canvas测试为记录绘制命令的适配器，不冒充实际多屏触摸。
- 最后一项回归覆盖renderstate经nextTick延迟回报、过滤过期照片和无变化状态。此修改后184项/类型/项目检查通过，微信重新编译并验证上传、提示模式、取消及再上传。

## 真实HTTP结果

输入1张公开CDC PHIL21505，700×460，与V5.1相同来源/许可（ai/experiments/sources.json）。第1轮框[215,245,495,385]像素；第2轮追加前景[430,328]、背景[500,350]，服务接收的是上述坐标除以原尺寸。两轮各3候选，全部技术状态ok；不是3或6个独立医学样本。

首请求2.189342s（包含本进程第一次加载0.934173s），第二请求0.569478s。CPU4线程float32，权重SHA和版本见real-http.json。第二轮显式选candidate-1，保留5片4孔，文件SHA校验通过。删除204，再读图410。无专家标注，不算医学准确率；预览可见漏选和包含间隙风险。

输出保留在被忽略目录 `ai/experiments/outputs/v52-http-20261027/`：original、每轮全部mask/alpha/overlay、confirmed.json、confirmed-polygons.jpg。HTTP预览不同于微信里的用户小框，不能相互替代证据。

## 微信实际操作

| 操作 | 状态与证据 |
| --- | --- |
| 本项目完整编译、选择胸部、AI入口 | PASSED，原手动按钮保留 |
| 用途说明、文件选择、上传CDC图片 | PASSED，真实定向PNG在画布显示 |
| 矩形提示 | PASSED（用户协助）：自动拖动连续touchcancel；用户明确回复“已框选，AI分割可点击”，随后实际出现真实候选 |
| 真实推理、候选2切换 | PASSED，wechat-candidate2.png；切换没有自动确认 |
| 前景+背景提示、再次分割 | PASSED（用户协助）：用户明确回复“已补充两种提示并重新分割”；实际候选页面继续可切换 |
| 查看候选3并显式确认 | PASSED，wechat-refined-candidate3.png / wechat-confirmed.png；显示下一阶段才支持人体放置 |
| 返回手动入口及进入手动页 | PASSED，wechat-return-manual.png保存部位；随后实际进入pages/annotate，未添加病灶 |
| 最后修复后重新编译、上传、切前景/排除模式 | PASSED，wechat-upload-final.png，Errors0，无recursive update；仍有平台弃用等warnings |
| 取消→空状态→再次上传合成离散图 | PASSED，wechat-reupload-synthetic.png；新图无旧Mask/旧提示，默认框选 |
| 最后取消并返回选择页 | PASSED，清理新会话，保留胸部上下文 |

以上为真实开发工具操作，用户提供拖框/两点，不宣称全自动E2E。测试工具曾选到另一个项目窗口或报告屏幕状态改变；每次重新核对Shingles，不操作其他项目业务。原生任意坐标自动点击偏移不能用于推定照片公式错误；不为迎合工具改坐标。使用的照片公开且不含患者私人材料。

## 失败、修复与未执行

详细[fixes.md](fixes.md)保留失败，不删除历史警告截图。确认页截图是在renderstate修复前保存，右侧仍有旧错误/警告；最终重新编译后的上传/再上传证据是修复后结果，不能宣称整轮无报错。

NOT_RUN：真机、拍摄权限和相机实际图片、原生多屏/极小屏、EXIF手机照原生流程、GUI断网/超时与A→B竞态（已有单测覆盖）、持续大图压测/实际耗尽内存、服务MPS、Finder双击启动、生产HTTPS/登录权限/全链路安全、临床专家及效果准确率。没有15～30张新医学测试集，也没有用户操作效率计时。

取消/删除后的访问拒绝有真实HTTP证据；TTL/重启清理由测试时钟与临时目录验证，不称实际等待30分钟。服务异常停止后的文件由下次启动清理，不能保证停机期间物理删除。保留公开实验输出供审查，与有TTL的上传会话分开。没有提交/推送Git。

最终服务检查：health HTTP200，临时照片会话目录剩余0个（final-service-check.txt）。基线561个已有文件中544个未变，17个是本轮明确修改；201个受保护工程/数据文件全部一致，无删除/意外改动（protection-check.json）。Git忽略检查覆盖模型、输入、完整输出、运行会话、虚拟环境和私有配置；新源代码无行尾空白，历史Markdown双空格换行不作无关清理。

## 代码与后续契约

主要新增：后端schemas/ai、routes/ai、services/ai_sessions及ai_boundary；前端AI类型/配置/服务/状态、photo-coordinate、photo-canvas及ai-annotate页面；AI服务测试、3个前端测试文件、HTTP验证脚本、AI后端启动器。

修改：后端main仅挂可选服务/边界/生命周期，pyproject可选multipart；ai/segmentation接收已验证PreparedImage；app路由、select入口和首页隐私文案、项目结构检查；台账/AGENTS授权增量/README/AI文档/API/架构/隐私/验证记录。没有改人体素材、区域坐标、图谱/医审、V2几何、V4匹配或模型权重。

确认结构 `confirmed-photo-segmentation-v1` 保留模型/提示/照片定向信息/Mask引用和SHA/多片含孔几何/用户确认及有效期；坐标固定 `photo_oriented_normalized_v1`。本轮确认不交给人体。V5.3另行设计人工变换、模板绑定、含孔形状与复杂度，以及跨页面临时数据交接。当前退出删除，并非长期可恢复病例。
