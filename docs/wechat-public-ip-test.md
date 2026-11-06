# P4.1 公网 IP 手机开发调试

2026-11-02。用户本轮明确选择公网 IP，不申请新域名、不创建临时隧道。本报告记录实际实现和验收证据；唯一进度台账是 [task.md](../task.md)。原 P4 的 HTTPS 前置结论保留为历史，本轮授权只覆盖临时测试，不能据此开放正式版。

**服务器公网接口已可用，真实 AI/匹配通过；新代码尚未确认上传，手机验收 NOT_RUN。**

## 真实入口与原项目历史

- 本轮实际地址：`http://212.64.26.206/dermatome-test`。健康路径：`/api/v1/health`。
- SSH 已有授权别名 `acupuncture-server` 指向该 IP；本机直连公网 HTTP 验证成功。服务器网卡为内网地址，通过腾讯云既有公网映射访问；未修改映射或云资源。
- A 项目历史 `deployment/HTTPS_HANDOVER.md` 明确记录“原 IP/default HTTP 站点保留”和公网 IP `/health` 200。当前只读配置及公网检查也确认 IP/default HTTP 80 → 127.0.0.1:8000。证明其确实有此方式；不能证明每一次历史手机操作都采用 IP。
- 原域名 `acupuncture.yandunshuati.online` HTTP 保持 308 → HTTPS，HTTPS 的 health/ready 都为 200。
- A 实际 PID 3480408、B 实际 PID 3810200；两服务均 active，未重启。B 始终只监听 `127.0.0.1:8001`，A 仍为 `127.0.0.1:8000`。
- Nginx 1.24 的公网监听为 80/443，SSH 为 22。UFW inactive；只读 nftables 显示 INPUT accept，加既有 SSH 拒绝规则/Docker 转发链。没有修改主机防火墙。
- 腾讯云控制台安全组规则详情 **UNKNOWN**：本次没有云控制台/API 授权工具，未读取云密钥。外部真实请求证明现有 80 可用，未增加端口、未改安全组。不能声称已审计控制台全部规则。

## 独立可撤销路由

新增 `sites-enabled/dermatome-ip-test`，由 B 专用配置管理：

```text
手机 trial（开启开发调试）
  → HTTP 212.64.26.206:80 /dermatome-test/api/v1/...
  → 新 IP 专用 Nginx 虚拟主机（server_name 为该 IP）
  → 剥离 /dermatome-test，转发到 127.0.0.1:8001/api/v1/...
```

原 A 两个 Nginx 文件没有修改。新 IP 虚拟主机中 `/` 回退逐字保留当前 A default 站点的转发设置，其余 Host 仍走原站点。原 IP 的 `/health`、`/ready` 与域名 HTTP/HTTPS 的行为都回归验证。B 路由只接受命名空间中的 `/api/v1/`，其余测试前缀 404，不暴露文档、运行目录或原始文件系统。

启用脚本核对 A 原 IP 文件的固定 SHA256；A 将来改过配置时拒绝直接启用，需要重新审查回退规则。**B 开启期间如计划调整 A 的 IP fallback，应先关闭 B 测试入口，避免新 vhost 的旧副本遮盖变更。** 该副本不是两项目长期共享配置方案。

新增文件独立，`nginx -t` 后仅平滑 reload；Nginx master PID 与 A/B PID 保持。两次最初撤销/恢复断言紧跟 reload，短暂读到旧 worker 响应而失败；操作助手现增加本机 Host/IP 健康状态轮询，最终实际外部关闭 404、恢复 200，A 始终 200。没有以固定延时猜测最终状态。

### 访问保护

- 不接受客户端 envVersion 作为身份；管理员经 SSH 签发 10 分钟一次性邀请，交换固定 1 小时 Bearer。客户端仅内存保存，服务端仅存摘要。不是患者账户系统或微信 openid 身份验证。
- 公网入口**清除 X-Test-Access-Key**。真实管理员密钥只留 SSH/回环，不嵌入包、不经公网 HTTP 发送。配置源与已生效站点 SHA256 相同；合成旧式密钥拒绝检查通过，它单独不能证明剥离，须连同配置证据判断。
- 照片继续同时校验 Bearer 所属 principal 和独立照片能力令牌；跨会话读取、上传、推理、确认、修改、删除均拒绝。照片不公开静态托管。
- Nginx 每 IP 5 请求/秒、burst 12、最多 6 并发连接，超限 429；后端另有全局 120 已鉴权请求/分钟、新照片 8/分钟、邀请交换 10/分钟。小规模 20 个 health 请求（最多 4 同时）实际得到 13 个 200、7 个 429；不属于压测或容量承诺。
- Nginx 请求体 11MiB（含 multipart 开销），后端实际照片 ≤10MiB、解码后 ≤3MP，校验实际文件内容，不能依赖 MIME。类型/像素/字节限额检查通过。
- CPU 单模型缓存、单推理 429、单 worker、单 CPU 配额、1.5GiB 内存上限、无 cgroup swap 等原保护不变。照片 TTL 30 分钟、最多两照片会话、取消立即删除、运行/停服清理机制不变。
- 入口关闭或后端不可用不取消本机正式人体标注。代理 502/504 转明确 503 JSON；开通遇到 5xx 显示服务暂不可用，不误称邀请码错误。公网 B access log 关闭，凭据不放 URL/日志。

**HTTP 不加密图片、邀请码或 Bearer，局域网/运营商链路上的窃听或篡改风险仍然存在。鉴权与限额不能消除这种传输风险。仅允许公开授权/合成图片，绝不用于真实患者或正式使用。** 小程序开通与选图前均明确提示。需要真实患者或上线时，另行采用受信任 HTTPS、合法域名及完整隐私/医审流程；本轮没有将新域名列为调试前提。

## 小程序配置与最少操作

集中配置在 [servers.ts](../miniprogram/config/servers.ts)：

- trialBaseUrl = `http://212.64.26.206/dermatome-test`，trialPublicIpDebug = true。
- 只额外允许该精确测试地址；任意 HTTP/IP、额外端口、credentials/query/路径变体均不放行。HTTPS 的既有验证不变。
- develop 模拟器继续本机 8000/明确受控 SSH18001；develop 手机和 trial 使用上述入口。release 仍独立空地址/在线能力关闭，未知环境关闭。临时地址不会被 release 网络解析使用。
- develop/trial 的人工标注、神经匹配、相册/拍照、AI/候选确认、人体放置及确认计算均开放；trial 的图谱开发/坐标调试仍隐藏。当前任务未修改既有业务能力矩阵。
- wx.request、wx.uploadFile、wx.downloadFile 共用 apiBaseUrl；只追加一次 `/api/v1/...`。真实公网端到端脚本使用生产地址配置，**没有重写 apiBaseUrl**；仅 wx/Canvas 为测试适配器，不是手机运行。

新版本建议 `0.5.4-ip.20261102`，AppID `wx951711e2fa1da5ff`。本轮 CLI 首次 90 秒超时，第二次交互式显示工具服务端口关闭，选择不自动开启后退出 246；没有上传成功凭据。GUI 旧“代码上传成功”弹窗不代表本轮成功，坐标操作报 noWindowsAvailable。未宣称新体验版已上传或指定。用户已收到异步上传/恢复窗口请求。

若工具仍不能代操作，最少步骤：

1. 在正确 Shingles 项目（本仓库 miniprogram 目录、上述 AppID）点击“上传”，版本填写 `0.5.4-ip.20261102`；微信后台将该新开发版本指定为体验版。旧体验版不会自动更新。
2. 手机重新打开新体验版，右上角开启“开发调试”，退出再进入。开发工具本机勾选并不能证明手机设置已启用；实际平台是否接受该 IP/HTTP 以手机验证为准。
3. 在电脑双击 `生成体验邀请码.command`，打开其输出的 ignored 私有 JSON，复制 invitation 到手机首页“开通体验访问”。10 分钟内用一次，成功后本次运行有效 1 小时。不要复制 cloud-access.json 管理员密钥，不发送原始凭据到聊天/截图。
4. 手工圈选→计算；再用公开测试照片→框选自动分析→候选与确认→放置、移动、缩放、旋转→确认位置并计算→查看全部区域、点单标签、恢复全部。Wi-Fi/移动网络各验证一次，记录版本/网络/错误文字（不记录令牌或患者图片）。

真实手机、拍照权限、两种网络和新体验版指定均 **NOT_RUN**。仅完成接口/实际页面适配器不能宣称核心手机目标已全部验收。

## 实际测试

证据目录：[p4.1-public-ip-20261102](validation-records/p4.1-public-ip-20261102/)。

| 验证 | 实际结果 |
|---|---|
| npm --prefix miniprogram test | 296 passed；首次 295/296，旧“未配置地址”用例未显式置空新配置，修正测试隔离后通过，失败日志保留 |
| npm --prefix miniprogram run typecheck | PASSED |
| ai/.venv/bin/python -m pytest backend/tests ai/tests -q | 176 passed、7 条既有官方 MobileSAM/timm 注册警告 |
| ai/.venv/bin/python scripts/check_project.py、sh/node 语法 | PASSED，静态检查不是原生编译 |
| test_trial_cloud_access.py（公网参数） | 21 检查通过；未知/重放邀请、owner 隔离、到期/撤销与清理 |
| test_public_ip_ingress.py | 16 检查通过；健康/401/403/413/422、授权 ready、取消、限流 |
| test_placement_http.cjs（trial、公网） | 真正上传 CDC PHIL 21505、两次 MobileSAM 200、每次 3 候选、人工确认、背面贴片、V2、两次匹配与编辑重算、清照片后仍匹配通过 |
| 真实推理/匹配时间 | 分割 HTTP 约 3.557 / 3.298 秒，匹配时间见 JSON；云端模型已加载，不作为首次冷启或手机性能数据 |
| 多片/孔洞与视口 | 本次正式人体几何 10 片、12 孔、770 顶点；70%/25°，源照片未修改，全身复位坐标不变，手工标注共存 |
| 独立关闭/恢复 | 公网 B 404→200；A IP ready 两次 200，未重启 A/B |
| 原服务及原文件 | A/原 Nginx master 身份、原 6 文件哈希一致；94 既有 B 运行文件与本机清单一致 |
| 新体验版上传、手机开发调试 | 未完成上传；手机 NOT_RUN，不把旧成功弹窗作证据 |

最初包含真实管理员密钥的公网验证计划被自动安全审查拒绝，命令未执行、密钥未发送。已用合成头与部署配置哈希完成更安全验证，没有要求放宽保护。没有临床标注或医学准确率结论。没有改模型、人体、图谱、放置变换、匹配公式或后端运行文件；未提交/推送 Git。

## 开关与后续边界

可直接双击本仓库 `关闭公网测试入口.command`；恢复用 `开启公网测试入口.command`。等价命令：

```sh
sh deployment/public-ip-control.sh disable
sh deployment/public-ip-control.sh enable
sh deployment/public-ip-control.sh status
```

仅删除/恢复 B 的 sites-enabled 链接，校验后平滑重载，并轮询确认入口状态；A 原文件与两项 FastAPI 不变。该公网入口独立于本机与 SSH 转发，**电脑关机不影响它，测试完必须主动关闭**。本轮未创建隧道，也未安装/启动 cloudflared。

关闭后已有后端数据仍按原 TTL 清理；如还需停 B，用已有 `停止云端后端.command`，不影响 A。无需删配置文件或回滚原 Nginx。复开前 A fallback 哈希必须仍符合审查版本。未来正式接入受信任 HTTPS 时，在 servers.ts 关闭 public IP debug 并填授权 HTTPS；release 不自动开放。

收尾保护：326轮A health/ready均200，无保护停止；主机available最低约2.17GiB，B cgroup峰值755.94MiB，OOM/swap页计数不变。A/Nginx/B身份、原6文件和94个运行文件一致。测试照片/有效邀请/授权均已清理；临时监测已停，新入口和两后端保持运行。详见protection.json/test-cleanup.json/runtime-integrity.json。

## P4.2 后续覆盖：已取消邀请码

用户现已取消邀请码输入与手动开通，本文件此前的邀请码使用步骤仅为历史。当前代码自动建立限时测试会话，不代表微信身份验证；云端明确启用公共测试开关。其他互联网客户端也能申请该会话，限额/照片隔离/HTTP公开合成图片边界保持。请上传最新0.5.4-open.20261102，用户选择稍后自行上传；手机仍NOT_RUN。当前接口、回退与测试见[免邀请码说明](wechat-public-test-access.md)。
