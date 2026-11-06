# 智络智绘微信体验版接入报告（P4）

2026-11-01。当前结论：**体验版业务能力和限时鉴权代码已完成，后端已部署，真实云端HTTP链路已通过；手机HTTPS、微信平台配置、体验版上传与真机验收尚未完成。**

用户本轮确认“仍无域名，先完成可独立实施的部分”。因此不猜测域名、不借用针灸正式站点、不开放公网8001、不用HTTP/IP替代体验版HTTPS地址。唯一进度见[task.md](../task.md)。

## 1. 环境门禁修复

原`canMatchReference()`只接受develop，WXML据此隐藏计算；`canUseAI()`还要求platform=devtools，手机页面的available为false。手机baseURL为空，旧受控凭据也只允许在开发工具使用。

新增集中[environment.ts](../miniprogram/config/environment.ts)，原development/ai配置只转发能力判断，不按页面各写一套。照片上传/推理/人工确认、AI放置与既有匹配流程复用，无算法重写。

| 能力 | develop | trial | release/未知环境 |
|---|---|---|---|
| 人体/手动标注 | 保留 | 保留 | 保留原有离线能力 |
| 参考神经匹配/计算 | 开放 | 开放 | 关闭 |
| 图片选择、拍照与AI分割 | 开放 | 开放 | 关闭 |
| AI人体放置 | 开放 | 开放 | 关闭，直接进入页面也拒绝 |
| 图谱开发页/坐标调试 | 原开发规则 | 隐藏并在方法内拒绝 | 隐藏并拒绝 |

trial会显示计算和AI入口，AI页面available为true。坐标调试、内部版本/性能JSON只留开发环境；来源、许可、医审待审状态、辅助性质说明仍可查看。首页在手机开发/体验环境显示“开通体验访问”，不展示内部地址、工程日志或模型分数。

这是UI能力策略，**不是服务端身份认证**。发送envVersion=trial不会获得任何接口权限。release未开放网络业务。

## 2. HTTPS通道与地址管理

[servers.ts](../miniprogram/config/servers.ts)集中保存trialBaseUrl/releaseBaseUrl；[api.ts](../miniprogram/config/api.ts)根据实际envVersion选地址。

- 开发工具develop保留本机8000，以及明确选择后的SSH回环18001。
- trial即便在模拟器中也只接受已配置的HTTPS主机；不回退到本机、局域网或8001。
- 校验拒绝HTTP、IP、localhost、`.local`、自定义端口、用户密码、路径/query/fragment与非法域名格式。release有独立配置，配置地址不会自动开放release功能。
- **当前trialBaseUrl仍空**，因为没有已授权、已验证DNS/TLS的B域名。无地址时在上传/凭据对话框前明确提示“当前测试服务暂不可用”，不会把凭据发到猜测的地址。

当前真实可用访问是服务器127.0.0.1:8001或管理员SSH通道，**不是手机HTTPS地址**。本轮未新增Nginx站点/证书/安全组或DNS。提供了未安装的[独立Nginx模板](../deployment/nginx.dermatome.conf.template)，保留显式占位符，不能当作已配置站点。

微信真机“开发调试”可以跳过平台合法域名校验，见[腾讯官方文档](https://cloud.tencent.com/document/product/1137/39909)；本轮按用户P4要求保留HTTPS和鉴权，不以这个选项代替可达的安全入口。

## 3. 微信合法域名与AppID

仓库project.config.json和微信工具项目基本信息均核实AppID为 **wx951711e2fa1da5ff（智络智绘）**，本机目录为当前miniprogram。工具外层旧URL里的另一AppID未用于部署或平台修改。

本轮没有操作微信公众平台，不能宣称已核对或修改其现有域名清单。

| 类型 | 实际用途 | 当前平台状态 |
|---|---|---|
| request | 开通/退出体验、AI提示/确认/修正/删除、evaluate | UNKNOWN / NOT_RUN，暂无已核实B域名 |
| uploadFile | 单张照片上传 | UNKNOWN / NOT_RUN |
| downloadFile | 方向统一照片及候选alpha下载 | UNKNOWN / NOT_RUN |
| WebSocket | 业务未使用 | 不需为本项目业务新增 |

不能只登记request就说照片能用。以后需在正确AppID的“开发管理→开发设置→服务器域名”登记同一已验证HTTPS主机的request、uploadFile、downloadFile；同时确认主体/备案、体验成员以及照片/相机相关隐私声明与平台权限。相关账号操作未验证。

## 4. 鉴权：一次性邀请换取限时会话

实时检查发现已有管理员测试凭据与照片能力令牌，未配置微信AppSecret/微信登录。保留管理员凭据仅供原开发工具/SSH运维；**不把它发给手机或写进小程序包**。

当前最小受控体验机制为服务器管理员签发一次性邀请码：

1. 管理员通过已有SSH权限在服务器签发256位随机邀请，10分钟内有效、仅消费一次。
2. 指定体验成员在首页或首次在线操作时输入邀请码。
3. `POST /api/v1/access/exchange`原子验证未过期/未使用邀请，签发随机Bearer会话，固定1小时失效。
4. 每个会话有服务器生成的独立principal。客户端只在运行内存保留token，不写Storage/URL/日志；过期或撤销后需重新开通。
5. 所有业务API验证Bearer；照片仍需独立x-ai-session-key，且照片owner必须与当前principal相同。即使另一体验会话拿到了照片ID和照片key，也返回统一410。
6. `DELETE /api/v1/access/session`撤销当前访问。重启保留未过期访问与照片归属，原30分钟照片失效规则不延长。

服务端只有0700私有目录、0600原子JSON状态和令牌摘要，没有新增数据库、用户后台或明文token存储。邀请码最多8份待消费，会话最多16份；开通入口4KiB实际体积限制、每分钟最多10次尝试，原120/min认证请求、照片上限、单推理429及TTL继续生效。拒绝Origin跨站访问；无公开照片目录或API文档。

此机制验证的是**管理员邀请授予的体验资格**，不宣称已验证微信身份/openid，也不是正式多用户患者认证。微信平台体验成员资格仍需后台另行设置。以后若必须绑定微信用户，应在服务器私有配置接入AppSecret与白名单，再实施wx.login/code2Session；本轮未伪造微信登录。

[生成体验邀请码.command](../生成体验邀请码.command)已交付，实际签发助手测试成功。它经SSH把邀请码保存到本机被Git忽略的private-data/唯一命名JSON，终端只显示文件位置，不输出码值，并移除本次服务器明文中转文件。请只交给指定成员；邀请失效后重新生成。不要把任何码值写入共享配置或公开聊天。

## 5. AI与人体匹配流程

原流程复用：选择部位→AI辅助标注→拍照/相册→拖框自动推理→候选切换/可撤销修正→人工确认→放置人体→拖动/等比缩放/旋转→确认位置并计算→显示全部参考区域与两侧标签。

统一的限时访问头覆盖request/uploadFile/downloadFile。旧401不能清掉后来新开的会话；开通对话框只保留一个在途任务，退出后迟到的开通响应不能恢复授权。未认证、超时、断网、服务忙碌均不制造成功结果，也不清V2正式标注。

Mask/MultiPolygon、多个片区与孔洞、照片/人体坐标区别、人体边界校验、V2唯一权威会话、版本绑定及V4结果失效机制不变。受控照片仍≤10MiB且解码≤300万像素，原图不偷偷压缩；相机大图可能超限，需选择符合限制的测试图。当前测试只用公开CDC21505与合成图片，不开放真实患者上传，不宣称确诊或医学准确率。

## 6. 云端部署与原服务保护

部署版本 **20261101-p4-15893ff5de3a**，94个运行文件内容一致，非Git提交。修改5个既有后端文件，新增access路由与trial_access服务；独立目录、venv、官方MobileSAM和CPU依赖均不变。没有新模型/付费API/重新训练。

`dermatome.service`继续仅127.0.0.1:8001，单worker、1推理/1线程、CPUQuota100%、MemoryMax1536MiB/SwapMax0。MobileSAM本轮真实推理成功；最终快照RSS约585MiB，2秒空闲CPU采样约0.12%单核；全阶段观测cgroup峰值约685MiB，最低主机MemAvailable约2.25GiB。是本轮低负载采样，不承诺最大图/多用户性能。

部署前备份至B独立`deployment/backups/p4-20261101`，仅重启B，并做了一次明确的B stop/start故障回归。A PID3480408/启动时间/NRestarts0、Nginx PID12643/启动时间保持不变，本机与原HTTPS健康/ready均200；6个原文件、39个本机人体/图谱/会话/匹配文件指纹不变。488轮保护采样无A失败或保护停止，Swap无新增IO、OOM0。A业务视觉/考试/数据库未调用，不冒充全业务验收。

没有Nginx reload、证书覆盖、防火墙或安全组改动，没有Git提交/推送。原一键启停命令继续有效。临时P4监测及SSH测试通道在收尾停止，正式B与cleanup.timer保持运行，P0环境保留。

## 7. 实际测试与证据

| 项目 | 结果 |
|---|---|
| Python全量 | `ai/.venv/bin/python -m pytest backend/tests ai/tests -q`：176通过、7条既有timm/registry警告；后补非法字节鉴权头断言的访问专项6项再次通过 |
| 小程序全量 | `npm --prefix miniprogram test`：294通过；TypeScript实际编译通过 |
| 环境矩阵/HTTPS验证 | develop/trial/release/未知、iOS/Android测试替身、trial业务开放/调试隐藏、release直接进入AI放置拒绝、非法地址拒绝通过 |
| 页面原链路 | trial测试替身+真实云端HTTP：2次真实分割、候选/确认、背面放置/缩放旋转、前后面手工标注共存、匹配/编辑重算、清照片后匹配通过 |
| 旧develop回归 | 同样真实云端全链路通过，保留原开发工具配置方式 |
| 云端访问安全 | 21项实际HTTP检查通过：邀请重放/未认证env伪装拒绝、跨principal读取/上传/推理/确认/修正/删除拒绝、有效owner保留、过期与撤销拒绝 |
| 新鉴权停启 | 实际stop B后不可用，start后旧Bearer与照片仍有效，原图字节一致，再次真实MobileSAM返回3候选；最后删除照片/撤销授权 |
| 微信工具 | 当前Shingles项目实际编译、更新首页可见，调试器最终Errors0/Warnings3；不是手机体验版 |
| 微信平台/新HTTPS | NOT_RUN：用户无B域名，未访问平台管理配置 |
| 体验版上传/指定 | NOT_RUN：尚无有效HTTPS API，不上传并冒充可用体验版；没有修改当前已指定版本 |
| 真机Wi-Fi/蜂窝、相机权限、拖动/缩放/旋转、标签与完整流程 | NOT_RUN，不能用模拟器或Node适配器代替 |
| 故障/大图 | 超时、忙碌、模型失败、旧照片迟到/旧计算失效有自动化覆盖；本轮实际云端还验证Bearer会话并发时一个200、另一个429 AI_BUSY，授权失效和stop。未注入OOM/45秒模型挂起或做最大3MP全HTTP/长时压力 |

trial测试的网络层**显式使用测试适配器改接SSH回环**，代码先断言未配置trial HTTPS会拒绝，再由测试替身注入通道；该适配器不进入小程序包。这证明业务与真实云端接口，不证明HTTPS或手机成功。

实际命令：

```bash
npm --prefix miniprogram test
ai/.venv/bin/python -m pytest backend/tests ai/tests -q
DERMATOME_TEST_ENV=trial DERMATOME_TEST_BASE=http://127.0.0.1:18001 node scripts/test_placement_http.cjs <证据目录>
ai/.venv/bin/python scripts/test_trial_cloud_access.py
ai/.venv/bin/python scripts/test_trial_cloud_restart.py
ai/.venv/bin/python scripts/test_trial_cloud_busy.py
```

首次分割约6.72秒含加载、细化3.67秒，匹配约367～372ms含通道传输；停启后首次分割6.35秒。只有一张公开源与一个32×24合成图的实际云端输入，不是医学数据集或准确率。

[完整证据目录](validation-records/p4-wechat-trial-20261101/)、[trial真实HTTP](validation-records/p4-wechat-trial-20261101/trial-cloud-http/real-page-http.json)、[21项隔离检查](validation-records/p4-wechat-trial-20261101/cloud-access-security.json)、[停启](validation-records/p4-wechat-trial-20261101/trial-restart-report.json)、[保护记录](validation-records/p4-wechat-trial-20261101/protection.json)。

### 真实失败记录

- 第一次TypeScript检查发现headers推断不含authorization，以及未使用导入；修正显式Record类型与导入后通过。
- 首轮前端回归18项失败：部分是旧“手机/体验版必须关闭”断言与未声明环境的测试替身，另外发现新增无条件await改变原开发请求时序。仅在需要体验鉴权时等待，明确测试环境，补独立trial/HTTPS/竞态测试，最终294通过。旧失败文件保留，不说首次全过。
- 并发补测首轮ReadTimeout，直连重测又因本机18001无监听而ConnectError。复核确认闲置SSH通道已超时断开（Broken pipe），生产服务正常；恢复带保活的通道、测试显式trust_env=False直连回环后，真实一个200/一个429，清理204。两次失败保留。先前台账在取结果前写入并发成功描述，已追加更正及最终实测结果。
- 微信工具AX控件ID过期，刷新完整界面后点击编译；热更新旧Errors6在编译结束后清为0。未冒充手机操作。

## 8. 最少剩余操作

1. 用户提供明确可授权的B域名/子域名、DNS控制和主体/备案确认。先验证解析与可信TLS，再按独立模板配置B Nginx，备份后nginx -t、reload并立即核对A/B。
2. 将验证过的HTTPS主机填入SERVERS.trialBaseUrl；release继续独立且业务关闭。不得填示例、IP或回环地址。
3. 在AppID wx951711e2fa1da5ff的微信后台核对request/uploadFile/downloadFile域名，检查体验成员及照片/相机隐私与权限配置。无平台权限时由用户执行并回传结果。
4. 重新编译→上传带真实HTTPS配置的新开发版本→“版本管理”指定体验版；不提交正式审核/发布。然后生成单独的一次性邀请，手机开通体验。
5. 使用合法测试图，在Wi-Fi与移动网络各跑完整流程，包括手动计算、AI确认/贴片/标签、取消/重入和异常。逐项记录，成功后才能称手机体验版可用。

当前没有需要用户在聊天提供的AppSecret、长期Token或SSH私钥。邀请码机制不依赖AppSecret。

## 9. 回滚

仅针对B：stop dermatome→恢复B备份的5个旧文件和原清单，移除/不引用本轮2个新增模块→start dermatome→检查A/B。保留runtime里的合法照片/授权状态与日志，不清A文件，不重启A或全机。备份中的新增文件清单可审计。前端可关闭相应业务全局开关或回退到P1–P3内容，仍不开放release。

本轮没有B Nginx站点，当前回滚无需reload Nginx。未来域名配置另有独立备份和nginx -t/reload步骤。执行前[回滚方案](validation-records/p4-wechat-trial-20261101/rollback-plan.md)。

## 10. 最终状态

| 层级 | 实际状态 |
|---|---|
| 体验版业务与限时鉴权代码 | DONE，自动化通过 |
| 受控后端部署与真实AI/匹配HTTP | DONE，经SSH加密通道 |
| 手机HTTPS入口/域名 | BLOCKED，用户暂无域名 |
| 微信后台域名/隐私/体验成员配置 | NOT_RUN / UNKNOWN |
| 当前P4体验版已上传并指定 | NOT_RUN |
| 手机真实操作已通过 | NOT_RUN |

**尚不能宣布“手机体验版已可完整使用”。** 后端和代码已准备好，剩余核心阻塞是授权的HTTPS入口及随后的平台配置、上传和真机验证；不自动推进新业务功能。

## P4.1 路线变更（2026-11-02追加）

以上是P4历史边界。用户现在明确授权手机开发调试+公网IP，取消新域名/临时隧道要求。独立入口 `http://212.64.26.206/dermatome-test` 已启用；既有鉴权/限制与release隔离保持，原A站点文件不变。HTTP不加密，仅公开/合成样本。公网真实AI/匹配已通过；新上传及手机仍未完成。当前操作与证据见 [P4.1公网调试](wechat-public-ip-test.md)，台账仍只在 task.md。
