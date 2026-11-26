# 正式 HTTPS 与照片生命周期发布准备

> 2026-11-24 第一阶段已上线独立 HTTPS 健康入口。以下为部署前准备记录，实际配置和验证见[第一阶段生产记录](stage1-production.md)。

2026-11-24。以下线上证据来自只读检查。本轮改动和配置样稿均留在本地，正式版在线开关继续关闭。

## 服务器与 DNS

| 项目 | 实际核查 |
|---|---|
| 服务服务器 | SSH 别名 `acupuncture-server` 指向 `212.64.26.206:22`，登录主机 `VM-0-11-ubuntu`。智络智绘和针灸项目同机，两项服务及清理 timer 均在运行。 |
| 服务端口 | 智络智绘 `127.0.0.1:8001`，针灸 `127.0.0.1:8000`，各自回环健康请求成功。公网受控测试健康接口返回 200。 |
| Nginx | 公网 80、443，启用 `acupuncture`、`acupuncture-domain`、`dermatome-ip-test`，尚无新域名站点。 |
| DNS | 从服务器向两台 DNSPod 权威服务器 `sharon.dnspod.net`、`panther.dnspod.net` 查询，`dermatome.bglabs.cloud` 的 A、AAAA、CNAME 均为 NXDOMAIN。主域名权威查询为 NOERROR，查询 A、AAAA、CAA 无记录。 |
| 证书 | 已安装的 Let’s Encrypt 证书仅覆盖 `acupuncture.yandunshuati.online`，到期日 2027-01-21 UTC。`certbot.timer` 已启用。指定公网 IP 访问新域名可到达 TLS 服务，但证书主机名验证失败（curl 60）。新域名证书、完整证书链和续期记录待建立。 |
| 网络与备案 | 外部探测可到达 443。腾讯云安全组规则未从控制台独立核验。备案号 `浙ICP备2026100679号-1`、上海关联资源 `212.64.26.206` 由用户提供，接入和服务用途仍需后台核对。 |

## 待批准执行的配置

1. 腾讯云 **云解析 DNSPod → 公网解析 → bglabs.cloud → 添加记录**。主机记录填 `dermatome`，记录类型选 **A**，线路选 **默认**，记录值填 `212.64.26.206`，TTL 填 **600 秒**（若套餐不支持则用控制台可用值）。保留主域名现有记录，当前只配置 IPv4。[DNSPod 公网解析设置](https://cloud.tencent.com/document/product/302/105742)
2. 腾讯云 **云服务器 → 实例 → 上海 → 选择公网 IP 为 212.64.26.206 的实例 → 安全组 → 入站规则**。核对现有 TCP 80、443；仅在缺少规则且经批准时补充。80 用于证书验证与续期，443 为小程序接口。8000、8001 保持回环；生产照片需要授权，放通 HTTPS 端口不能替代应用鉴权。并在 **腾讯云 ICP 备案 → 我的备案** 核对备案主体、域名与正确接入资源，必要时询问腾讯云现有备案的接入与用途。
3. 微信公众平台 **小程序 → 开发管理 → 开发设置 → 服务器域名**。在 **request 合法域名、uploadFile 合法域名、downloadFile 合法域名** 三项各添加 `https://dermatome.bglabs.cloud`。填写域名本身，无端口或路径。照片与匹配使用 `wx.uploadFile`、`wx.request`，受保护的轮廓预览使用 `wx.downloadFile`，此链路无需 WebSocket 或业务域名。正式验收关闭开发调试和免域名校验。[微信小程序网络文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

### Nginx、证书与回滚

1. **变更前**记录针灸和智络智绘健康状态、PID、当前 DNS、Nginx 启用站点及 `nginx -t` 结果。以 root 权限在仅管理员可读的发行备份目录保存本次涉及的 Nginx 配置与链接、智络智绘后端变更文件、发布清单和服务环境文件。配置备份不包含用户临时照片，凭据文件内容不输出。
2. DNS 生效后，创建 `/var/www/dermatome-acme`，把 [HTTP challenge 站点](nginx-http-acme.conf) 作为新站点加入 `sites-available` 并链接至 `sites-enabled`。执行 `sudo nginx -t && sudo systemctl reload nginx`。校验公网 challenge 路径，随后使用现有 Certbot webroot 方式签发独立证书：
   ```sh
   sudo certbot certonly --webroot -w /var/www/dermatome-acme -d dermatome.bglabs.cloud
   ```
3. 加入 [HTTPS 站点](nginx-https.conf)，先仅开放健康检查，再执行语法检查和平滑重载。检查 SAN、到期日、完整证书链及正常证书验证下的 200。核对已有 `certbot.timer` 和 deploy hook。若已有 hook 无需重复添加，否则经确认增加按新证书名或 `RENEWED_LINEAGE` 匹配的 hook，续期成功后以 `nginx -t && systemctl reload nginx` 重新载入。执行 `sudo certbot renew --cert-name dermatome.bglabs.cloud --dry-run` 验证续期。[Certbot webroot 与续期](https://eff-certbot.readthedocs.io/en/stable/using.html)
4. 经另行确认，部署本轮后端生命周期文件 `backend/app/services/ai_limits.py`、`backend/app/services/ai_boundary.py`、`deployment/cleanup.py`，确认 `AI_IDLE_SECONDS` 未被旧环境配置覆盖。同步发布清单，只重启 `dermatome.service`。保持现有停服清理 timer，验收在运行时清理和停服兜底两种情况。优先单用户使用合成照片验证删除、回收及名额释放，复查针灸服务和进程。
5. **正式授权、隐私及平台验收完成后**再审阅启用 [业务路由片段](dermatome-https-api.conf)。该片段代理上传、提取、确认、轮廓资源、DELETE 和匹配。站点默认拒绝未列出的路径，包括公共测试令牌签发、文档、调试和就绪接口；后端仍负责逐请求鉴权和会话隔离。限制单 IP 请求速率，照片资产不缓存，去掉测试密钥头。上线前实际运行 `nginx -t` 并校验路径拦截、413、429、鉴权及 HTTPS 合成照片链路。
6. **回滚**。如仅部署新域名，移除新增站点的启用链接，恢复本次涉及的配置，`nginx -t` 通过后平滑重载。如已同步后端，从本次发布备份恢复智络智绘文件、发布清单与服务环境，只重启 `dermatome.service`。经确认独立撤销本次 DNS A 记录和新续期 hook；复验原 HTTP 测试健康、针灸健康与 PID。针灸站点和服务保持原有配置。

### 正式访问授权是独立发布条件

本地 `servers.ts` 已准备正式域名。现有 `environment.ts` 对 release 仍关闭图片辅助标注、放置和在线参考匹配。体验版继续使用受控 HTTP。等 HTTPS 与授权验收后，体验版才可切到同一域名并关闭公网 IP 调试模式，随后按实际申报范围评估正式版。

当前正式包没有可直接复用的正式授权流程。前端只在 develop/trial 进入测试授权，后端在线功能也依赖已明确启用的受控环境。仅屏蔽 HTTPS 入口的公共测试令牌签发仍不够，因为同一后端可能接受从旧入口签出的令牌。正式入口需验证独立授权边界，拒绝测试凭据，例如采用服务端交换微信登录凭证并存储服务端密钥，或采用另行获批的受控邀请方案。两种方案均未实施。后台需要核实服务类目、资质、隐私声明、自动化处理披露、送审和发布功能一致性及备案实际接入；仅以 HTTPS 接通无法证明已获平台批准。

## 图片和生命周期

| 项目 | 当前线上 | 本地与拟发布 |
|---|---|---|
| 客户端 | 自动处理后 ≤8 MiB、≤300 万像素、最长边 ≤1920 px | 沿用。 |
| 服务端 | 文件 ≤50 MiB，源图 ≤5000 万像素，单边 8–10000 px，受控推理 ≤300 万像素。受控 HTTP 上传代理为 51 MiB。 | 沿用现有解码验证、缩放和上限。正式 HTTPS 建议代理请求体 ≤10 MiB，覆盖现有压缩照片及 multipart 封装。 |
| 资源 | 受控模式全局 2 个临时会话、单推理槽、2 个请求接收槽；本次读取时文件系统约 29 GiB 可用，未发现临时目录独立配额。CPU 1 核配额，内存高水位 1.25 GiB、硬上限 1.5 GiB。 | 不扩大并发或资源上限。历史公开样图推理峰值 RSS 约 712 MiB，50 MiB／5000 万像素线上上传峰值未实测。 |
| 确认删除 | 旧流程依赖放置页首帧。 | 确认成功且独立草稿建立后立即异步 DELETE，放置导航无需等响应。草稿复制多片几何、孔洞、图片尺寸、坐标空间、目标与变换，预览与最终放置从草稿生成。导航失败时重试同一内存草稿；退出小程序会失去未保存的内存草稿。草稿准备失败时不抢先删除。 |
| 闲置 | 服务默认 120 秒，当前未发现 `AI_IDLE_SECONDS` 覆盖。服务运行时应用扫描约 30 秒，停服独立 timer 约每 5 分钟扫描。 | 默认 300 秒，应用每 10 秒扫。正常运行且未推理时约闲置 300–310 秒清除，锁竞争或磁盘故障可能延后。停服 timer 最多额外约 5 分钟。有效在线操作更新期限，本地框选或提示点编辑若一直未提交请求，仍可能过期；需重新选图，当前无无限心跳。 |

DELETE 成功时会话目录及索引移除，受控名额立即释放。保存原始上传字节的临时文件在解码的 `finally` 中清理；服务器临时目录保存方向统一照片、候选 Mask、预览及快照，整个目录一起删除。预测器在推理结束后释放本次图像特征，模型权重继续常驻。重复 DELETE 安全。客户端最多尝试 3 次，失败显示待回收提醒。删除正在计算的会话时，计算结果不得再次发布；自动回收跳过活跃计算。重启重新核对快照期限和损坏状态。应用与停服 timer 通过同一目录所有权文件锁互斥。

现有分割和修正有 45 秒接口超时、操作失效和结果发布期限，底层已开始的原生推理线程不能被强制终止。正常返回会释放活动标志和推理槽，真正卡死时需重启智络智绘服务以恢复。正式前应验证故障恢复策略，若验收要求硬终止，应把推理隔离到可终止进程再上线。停服时残留按已有有效快照中的截止时间清理，无效快照使用最后修改时间加 300 秒。切换前的既有快照不保证在停机时自动延长。

## 回归与发布门槛

本地测试基线为 macOS 工作区 `fd65d53` 及未提交改动。后端测试使用 `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 ENABLE_AI_SEGMENTATION=1 ENABLE_PUBLIC_TEST_ACCESS=1 PYTHONPATH=backend:. ai/.venv/bin/python -m pytest backend/tests -q`，前端使用 `npm run typecheck --prefix miniprogram` 和 `npm test --prefix miniprogram`。本轮测试未使用真实患者图像。原始测试输出摘录见[本地验证记录](local-verification.txt)。

- PASSED — 后端 `242/242`，含默认期限、活动续期、短期模拟时钟扫描、活跃保护、重复删除、停服及重启清理和会话容量恢复。
- PASSED — TypeScript、项目结构、图谱一致性、分包边界，主包 919,926 B、clinical 1,479,701 B、special 780,183 B。微信原生 `wcc` 14 个 WXML、`wcsc` 15 个 WXSS。
- FAILED — 当前完整工作区前端 `421/431`。`placement-overlay.test.cjs` 两项分别涉及轮廓绘制/线宽（线条调用数 10，原契约 4）和已存在节点唤醒重绘（可观察绘制次数 1，原契约 2）。`placement-performance.test.cjs` 八项分别是六种缓存尺寸/孔洞组合、一项仿射和孔洞逐路径对照、一项缓存失效矢量降级。部分差异来自已有视觉辅助线和栅格化策略的变化，例如 120 帧线条调用预期 360 实测 1920；画布恢复、实际性能和孔洞表现仍需验证。测试原判据保留，两份已有 Canvas TS 增量均未覆盖。
- PASSED — 临时对照副本以 HEAD 加当前前端与测试差异为基线，只排除两份既有 `placement-overlay.ts`、`preview.ts` 增量，`431/431`。包含确认即发 DELETE、导航失败重试同一草稿以及放置确认和参考匹配回归。此结果不能作为当前待发布工作区的通过证明。
- NOT_RUN — 新域名 SSL 成功访问、Nginx 新配置语法检查、正式上传/提取/放置/匹配、线上的 300 秒清理、50 MiB 压力及内存、关闭调试的 iOS/Android 真机。新域名变更、证书申请、后端部署、体验版和正式版发布均待确认。

可在受控 HTTPS 合成测试中记录上传和分割状态、确认至 DELETE 的时间、重复 DELETE 204、资产失效、放置与匹配结果。再创建一个不继续操作的会话，通过不刷新会话的服务端计数或目录变化观察 300–310 秒回收，确认释放名额。另用一会话跨空闲阈值保持正在推理，在推理结束后验证回收。所有测试仅使用合成或公开授权样例；平台、账号和真机条件满足后再签署发布验收。
