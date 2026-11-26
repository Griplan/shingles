# 正式 HTTPS 第一阶段生产记录

> 续篇见[第二阶段生产记录](stage2-production.md)。

2026-11-24，腾讯云 `212.64.26.206`。已上线 [HTTPS 健康检查](https://dermatome.bglabs.cloud/api/v1/health)，业务接口仍关闭。

## 验证结果

- 两台 DNSPod 权威服务器及 1.1.1.1、8.8.8.8、119.29.29.29 均返回 A `212.64.26.206`、TTL 600 秒。记录上线前已存在，本阶段未修改 DNS。Cloudflare 和 Google 未返回 AAAA。工作站透明代理合成本地 DNS 地址，故采用独立公共解析结果加外部指定 IP 的 TLS 测试复核，并在服务器用系统 DNS 直接验证域名。
- TCP 80/443 公网实测可达。UFW 未启用，检查了系统防火墙的入站链，现有防火墙与云配置未改。腾讯云安全组后台规则清单未直接读取。8000、8001 继续仅监听回环。
- 公网 HTTP 返回 308 并跳转同路径 HTTPS，ACME 路径保持直出。首次平滑重载刚返回时探针收到旧配置的 404，复测确认公网探针 200 后才执行一次证书签发，临时探针已移除。
- Let’s Encrypt YE1 已签发独立证书，SAN 仅为 `dermatome.bglabs.cloud`，有效期 2026-11-24 08:22:58 至 2027-02-22 08:22:57 UTC。完整证书链、主机名和公网校验均通过，服务返回 200。
- HTTPS 站点只反代 `/api/v1/health` 到 `127.0.0.1:8001`，不转发客户端凭据或请求体。实际请求确认 Swagger、OpenAPI、ready、令牌签发、照片上传、提取、DELETE、候选图片和参考匹配均返回 404。见[公网验证](stage1-public-verification.txt)。
- `nginx -t` 在备份前、各次重载前和续期模拟后均通过。备份中原有 19 个 Nginx 文件及链接逐项核对一致。智络智绘、针灸和 Nginx 主 PID、启动时间均与变更前一致。两个后端回环健康、原 HTTP 测试入口，以及针灸原 HTTPS `/health` 均为 200。
- `certbot.timer` 已启用并运行。对新证书执行 `certbot renew --cert-name dermatome.bglabs.cloud --dry-run --run-deploy-hooks` 成功。原有 deploy hook 实际执行 `nginx -t` 并平滑重载，公开端点仍返回已安装的可信证书，指纹一致。模拟不替换现有生产证书。Certbot 将 Nginx 的常规 stderr 信息标为 error output，检查输出为通过，重载有 systemd 日志佐证。见[证书续期验证](stage1-renewal-verification.txt)及 [Certbot 文档](https://eff-certbot.readthedocs.io/en/stable/using.html)。

## 生产变更与回滚

- 新增 `/etc/nginx/sites-available/dermatome.bglabs.cloud` 与对应 `sites-enabled` 符号链接。[实际上线配置](nginx-stage1-applied.conf)
- 创建 ACME 目录 `/var/www/dermatome-acme/.well-known/acme-challenge/`。Certbot 为此域名创建独立 `live/`、`archive/` 证书目录及 `renewal/dermatome.bglabs.cloud.conf`。使用原续期 timer 和 deploy hook。
- Nginx 完整备份为 `/srv/dermatome-mapper/deployment/backups/https-stage1-20261124-172044/nginx.tar.gz`，同目录保存变更前进程状态。
- 回滚时只移除新增站点的启用链接，执行 `sudo nginx -t && sudo systemctl reload nginx`。再验证针灸原 HTTPS 和智络智绘原 HTTP 入口。若永久撤回，再移除新增站点文件及专用 ACME 空目录，以 `sudo certbot delete --cert-name dermatome.bglabs.cloud` 清理该证书续期条目。保留原有站点、证书、DNS 和清理服务。无需重启两项后端。

## 正式鉴权与第二阶段条件

当前旧测试令牌由 `TrialAccess` 签发和验证，权限检查依赖受控环境，令牌记录没有可用于正式入口的签发方或受众绑定。正式方案应独立签发并校验。建议小程序通过 `wx.login` 获取一次性登录 code，服务端持微信 AppSecret 完成交换，为获准账号签发短时正式令牌。正式服务校验正式签发方、受众、到期和用户状态，使用与测试分开的签发密钥或不透明令牌存储。图片资源还需按用户和照片会话做服务端授权。正式路由默认拒绝，公开测试令牌、旧邀请令牌和测试密钥头只用于原测试入口。发布前分别用这三种旧凭据验证正式入口拒绝，用有效正式令牌验证完整流程和跨用户隔离。AppSecret 和签发密钥留在服务端配置。

第二阶段需确认正式鉴权机制、微信合法域名及隐私和送审配置，完成当前画布回归并验证关闭调试后的手机流程。部署时再验收 300 秒闲置回收、确认后删除、容量释放和推理异常恢复。第一阶段没有部署业务代码、切换 TTL、开放正式在线能力或上传微信版本，本地生命周期改动保留。
