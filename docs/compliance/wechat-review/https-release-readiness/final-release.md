# 正式发布准备与 HTTPS 业务接入

2026-11-24。智络智绘正式后端和 `dermatome.bglabs.cloud` 业务反向代理已部署。当前唯一尚未执行的服务器配置是微信 AppSecret 写入；在此之前正式业务路由保持 fail-closed，返回 `503 PRODUCTION_UNAVAILABLE`，不会匿名放行。

## 当前结论

| 项目 | 状态 |
|---|---|
| 正式域名、certbot 续期 | PASSED |
| 普通微信用户默认访问策略 | DONE：任意通过本小程序 AppID `code2Session` 验真的用户均可获得业务令牌 |
| 白名单 | OPTIONAL：仅显式配置时限制受控测试；不再作为正式服务启动条件 |
| 短期令牌、用户隔离、登录与接口限流 | DONE |
| trial / release 地址 | DONE：均固定为 `https://dermatome.bglabs.cloud` |
| release 图片处理、人体放置、参考匹配 | ENABLED |
| 正式 HTTPS 精确业务路由 | DEPLOYED |
| AppSecret | BLOCKED：服务器尚未配置，故线上微信登录与真实业务为 NOT_RUN |
| 云端合成图完整 AI 链路 | BLOCKED：必须先完成真实 `wx.login` 验真 |
| 微信体验版/正式审核 | NOT_RUN：由用户上传，代码不自动上传或提交审核 |

## 访问控制

服务器以 `ENABLE_PRODUCTION_ACCESS=1` 作为正式入口总开关。AppSecret 和独立 HMAC 签名密钥仅保存于 root-only 配置文件。`DERMATOME_WECHAT_ALLOWED_OPENIDS` 为空时不设置账号白名单；OpenID 仍须来自微信 `code2Session` 成功响应，并且每个 OpenID 会转换为稳定的独立内部用户 ID。非法、缺失或非文字 OpenID 不影响公开信息，也不被接受。

如临时受控测试需要限制账号，可设置空格分隔的 `DERMATOME_WECHAT_ALLOWED_OPENIDS`。删除该变量即恢复普通微信用户准入。该白名单不用于永久运营。

正式令牌有效期 15 分钟，仅保存在小程序内存；之后静默重新 `wx.login`。正式令牌与旧 HTTP 测试令牌、邀请令牌和 `X-Test-Access-Key` 分开验证。照片会话绑定内部用户 ID，并继续要求 `X-AI-Session-Key`。错误用户、过期令牌、篡改令牌和跨用户照片访问均被拒绝。登录入口有后端每分钟及并发限制，Nginx 另有每 IP 限流。

## 公网业务路由

独立 Nginx 站点只转发以下精确路径：

- `POST /api/v1/access/wechat`
- `POST /api/v1/evaluate`
- `POST /api/v1/evaluate/body-intersection`
- `POST /api/v1/ai/sessions`
- `POST /api/v1/ai/sessions/<session>/photo`
- `POST /api/v1/ai/sessions/<session>/segment`
- `POST /api/v1/ai/sessions/<session>/edit`
- `POST /api/v1/ai/sessions/<session>/confirm`
- `GET /api/v1/ai/sessions/<session>/assets/<name>`
- `DELETE /api/v1/ai/sessions/<session>`

公开路径在 Nginx 内部改写为 `/internal/production/api/v1/...`，由后端再次检查方法、路径和短期微信令牌。`/docs`、`/api/v1/ready`、旧 `/api/v1/access/session`、旧 `/dermatome-test` 和其他内部接口不在此正式站点开放。Nginx 清除旧测试密钥头。只有照片上传 location 接收最多 51 MiB，以容纳后端 50 MiB 文件和 multipart 开销；登录、匹配、分割和修正路径最多 2 MiB。客户端仍自动处理到约 8 MiB、300 万像素、最长边 1920 px。MobileSAM、医学图谱、人体模型和 V4 几何公式未改。

## 实际生产验证

部署 ID：`final-release-20261124-184702`

备份：`/srv/dermatome-mapper/deployment/backups/final-release-20261124-184702`

| 检查 | 实际结果 |
|---|---|
| `nginx -t` | PASSED |
| HTTPS 健康检查 | 200 |
| 缺少 AppSecret 时正式登录 | 503 `PRODUCTION_UNAVAILABLE` |
| 非上传正式接口超过 2 MiB | 413，由 Nginx 在代理前拒绝 |
| 照片上传路径在未配置时 | 503，不匿名进入图片处理 |
| 随机的内部/未知路径 | 404 |
| `/api/v1/ready` | 404 |
| 旧 `/api/v1/access/session` | 404 |
| `/docs` | 404 |
| `dermatome.service` | active |
| `acupuncture.service` | active，PID `611289` 未变 |
| Nginx | active，master PID `12643` 未变，仅平滑重载 |
| `certbot.timer`、`dermatome-cleanup.timer` | active |
| 针灸 HTTPS `/health` | 200 |

完整机器输出见 [before.json](final-release-evidence/before.json)、[after.json](final-release-evidence/after.json)、[路由与限流实测](final-release-evidence/live-routing.txt)和[部署脚本](final-release-evidence/deploy-final-release.py)。

## AppSecret 安全配置

不要在任何聊天、截图、仓库或命令行参数中提交 AppSecret。已部署不包含密钥的配置助手：

```bash
ssh acupuncture-server
sudo /srv/dermatome-mapper/deployment/configure-wechat-production.sh
```

脚本会在终端隐藏输入 AppSecret，校验 32 位十六进制格式，生成独立的 32 字节签名密钥，创建权限为 `0600` 的 `/srv/dermatome-mapper/config/wechat-production.env`，写入仅包含 `EnvironmentFile=` 的 systemd drop-in，然后只重启 `dermatome.service`。脚本不会显示或回显 AppSecret。

如果上述文件已经存在，脚本会拒绝覆盖。需要轮换时，先由管理员将旧文件移动到 root-only 备份，再重新运行；不要删除正在服务的唯一有效密钥而不保留恢复手段。

配置完成后可先执行：

```bash
curl -sS -o /tmp/dermatome-login-check.json \
  -w '%{http_code}\n' \
  -X POST https://dermatome.bglabs.cloud/api/v1/access/wechat \
  -H 'Content-Type: application/json' \
  --data '{"code":"invalid-synthetic-code"}'
cat /tmp/dermatome-login-check.json
```

预期由 `503` 变为 `403 PRODUCTION_ACCESS_DENIED`。这不是真实登录成功；真实登录必须由微信小程序在运行时用一次性 `wx.login` code 完成，不能从服务器伪造。

## 最小发布验收

1. 执行上述 AppSecret 配置。
2. 在微信开发者工具中选择 Shingles 项目、AppID `wx951711e2fa1da5ff` 和正式环境，确认关闭“不校验合法域名”及开发调试。
3. 上传新版本并设为体验版。合法域名已由用户确认配置完成。
4. 用至少两个普通微信账号分别 `wx.login`，验证两账号均无需白名单即可进入，且照片会话不能互访。
5. 使用公开授权或合成图片完成登录 → 上传 → 轮廓提取 → 确认 → 人体放置 → 参考匹配 → DELETE。
6. 再做一次纯手动标注和参考匹配，并在手机检查正背面、标签高亮和 300 秒异常回收说明。
7. 只有在上述流程和平台类目、隐私、资质核查均通过后才提交审核；本仓库不自动提交审核或正式发布。

## 回滚

仅回滚智络智绘，不影响针灸：

```bash
sudo systemctl stop dermatome.service
sudo install -m 0644 /srv/dermatome-mapper/deployment/backups/final-release-20261124-184702/production_access.py \
  /srv/dermatome-mapper/backend/app/services/production_access.py
sudo install -m 0644 /srv/dermatome-mapper/deployment/backups/final-release-20261124-184702/release-manifest.json \
  /srv/dermatome-mapper/deployment/release-manifest.json
sudo install -m 0644 /srv/dermatome-mapper/deployment/backups/final-release-20261124-184702/nginx-domain.conf \
  /etc/nginx/sites-available/dermatome.bglabs.cloud
sudo rm -f /srv/dermatome-mapper/deployment/configure-wechat-production.sh
sudo rm -f /srv/dermatome-mapper/docs/compliance/wechat-review/https-release-readiness/nginx-final-release.conf
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl start dermatome.service
```

若已写入 AppSecret 且要同时关闭正式鉴权，再移除
`/etc/systemd/system/dermatome.service.d/wechat-production.conf` 和
`/srv/dermatome-mapper/config/wechat-production.env`，执行 `systemctl daemon-reload`，然后重启智络智绘。始终不重启或修改针灸服务；恢复后检查 `dermatome.service`、健康接口和针灸 `/health`。
