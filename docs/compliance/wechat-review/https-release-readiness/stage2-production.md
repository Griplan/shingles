# 正式 HTTPS 第二阶段生产记录

2026-11-24。最初阶段的指定账号白名单已改为可选测试限制；正式策略是接受所有通过本小程序 AppID 验真的普通微信用户。智络智绘正式鉴权后端和精确 HTTPS 业务路由已经部署，当前仅缺服务器 AppSecret，因此正式登录和其他业务请求安全返回 503。完整现状与操作见[最终发布准备](final-release.md)。

## 正式登录与网络隔离

- 小程序正式客户端会调用 `wx.login` 获取临时 code，交给 HTTPS 后端向微信 `code2Session` 换取身份。后台只接收 code，AppSecret 留在服务器。默认允许所有属于本 AppID 的有效 OpenID；如显式配置白名单，则仅在受控测试期间限制账号。无昵称、头像或手机号采集。
- 正式会话使用独立 HMAC 密钥、独立签发方和本小程序受众、15 分钟有效期。小程序只在内存保存令牌，在快过期或被 401 拒绝后于下一次操作获取新令牌。登录请求合并，服务端对登录做速率与并发限制。普通获准用户无需填写邀请码或令牌。
- 新域名的业务路由将由 Nginx 转到内部正式命名空间。FastAPI 独立按路径、方法和正式令牌鉴权。旧测试入口的路由规则和令牌存储维持既有配置。正式令牌与旧令牌格式和签发机制分离。照片另需会话密钥及匹配所有者，换发短期访问令牌后同一用户仍可访问原会话；错误用户不能延长会话期限。
- 后端测试使用模拟微信交换，验证未授权账号、伪造身份字段、错误签发密钥、错误受众、过期、篡改、旧测试令牌、旧邀请令牌、旧测试密钥及跨用户访问拒绝，正式令牌也不能用于旧入口。公网正式业务路由目前返回 404，因此公网真实微信登录和权限测试为 NOT_RUN。
- 正式业务 Nginx 片段已进入独立域名站点，只开放登录、人体交集、参考匹配、AI 创建/上传/分割/修正/确认/资产下载/删除等精确路径。只有照片上传 location 接收最多 51 MiB；其余正式业务最多 2 MiB。后端仍为 50 MiB、5000 万源像素，受控处理最多 300 万像素。保留原先约 8 MiB 的客户端处理结果及坐标契约。当前会话容量仍是受控的 2 个会话以及单推理槽，不扩大。
- `trial` 和 `release` 均固定使用 `https://dermatome.bglabs.cloud`，不回退 HTTP/IP。开发工具保留独立受控测试配置。`release` 的图片处理、人体放置和参考匹配能力已启用，调试与图谱开发工具仍关闭。

## 本轮已部署

- 备份 `/srv/dermatome-mapper/deployment/backups/https-stage2-backend-20261124-173247`。更新 `backend/app/main.py`、`backend/app/api/routes/ai.py`、`backend/app/services/{access,production_access,ai_boundary,ai_limits}.py`、`deployment/cleanup.py` 及发布清单。清单 151 项实际校验一致。
- 仅重启 `dermatome.service`。智络智绘 HTTPS 健康 200、针灸原 HTTPS 健康 200，正常证书验证。针灸 PID 611289 未变，Nginx 未重载，正式站点、旧测试入口和续期配置未改。公网正式登录路径实测 404。未上传体验版、未重提审核、未发布正式版。
- 进程环境没有 `AI_IDLE_SECONDS` 覆盖，实际会话截止时间与最后活动相差 300 秒。应用运行中每 10 秒扫描。独立停服 timer 保持原来的 5 分钟兜底。线上观察未确认会话在最后活动后 300.26 秒被后台移除，观察期间无照片 API 请求，随后旧资产 410，两个名额均可再次分配。见[资源实测](stage2-resource-verification.jsonl)。受控 Linux 推理用公开授权 CDC PHIL 21505 图，700×460，耗时 5.97 秒，3 个候选，确认返回 16 片和 25 个孔洞。本次取样 cgroup 峰值约 580 MiB，限制 1.5 GiB。
- 原 HTTP 受控入口合成 smoke 12/12 通过，含人体交集、参考匹配及模拟状态、错误图谱版本拒绝和照片会话。见[旧入口回归](stage2-legacy-smoke.json)。
- 线上受控回环实际验证已确认的照片、Mask、透明预览和索引在 DELETE 后随目录消失，原始上传暂存文件在解码后即不在磁盘。重复 DELETE 204、旧资产 410、名额立即可复用。预测器在计算完成后通过现有 `reset_image()` 释放本次图像特征，仍保留模型权重；未对进程内部特征做独立内存测量。
- 本地小程序在确认并建立可独立放置的草稿后立即异步发起 DELETE，故障重试最多三次，草稿失败保留照片。测试覆盖 DELETE 未完成仍可打开页面、导航失败后使用同一草稿，以及放置/匹配。此客户端尚未上传，当前正式域名下的整段真机流程为 NOT_RUN。

## 推理和回收边界

接口与结果发布使用 45 秒期限，自动清理跳过活动推理。正常释放由 worker 的 `finally` 执行。真正卡死的原生线程无法由请求取消，线上未注入卡死，也未在共享服务器实施强杀。运维恢复方案是先记录智络智绘 worker、资源及错误，单独重启 `dermatome.service`，复查积压、临时目录和针灸健康；需要对卡死做硬截止时，正式发布前应验证可受控终止的进程隔离方案。用户如果一直在本地框选且超过 5 分钟未发有效服务器请求，照片可能过期，需要重新选择。当前不发送后台心跳。

## 本地验证和画布修复

- 后端 244/244，通过 `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 ENABLE_AI_SEGMENTATION=1 ENABLE_PUBLIC_TEST_ACCESS=1 PYTHONPATH=backend:. ai/.venv/bin/python -m pytest backend/tests -q`。
- 完整前端 432/432。原 10 项的调用基线对应旧圆形拖动把手和旧选框；现有设计的独立十字线与矩形曾被误计为轮廓路径。保留既有画布增量，测试分别严格检查缓存中全部原始顶点、壳及孔洞，逐点坐标误差阈值维持 1e-9，限制装饰层路径数，并检查缓存失败的完整矢量路径和唤醒仍无额外节点查询。
- TypeScript、图谱一致性、项目结构、分包引用、wcc 14 个 WXML、wcsc 15 个 WXSS、`git diff --check` 均通过。主包 922,667 B，clinical 1,479,701 B，special 780,183 B。真机性能及可见性待验收。

## 开通和验收条件

1. 在服务器终端运行 `sudo /srv/dermatome-mapper/deployment/configure-wechat-production.sh`，按隐藏提示输入 AppSecret。脚本生成独立签名密钥并安全写入 root-only 文件；不需要也不应设置 `DERMATOME_WECHAT_ALLOWED_OPENIDS`。详见[最终发布准备](final-release.md)。
2. 脚本只重启智络智绘。配置前正式登录返回 503；配置后无效合成 code 应为 403，真实 `wx.login` 才可换取业务令牌。Nginx 业务片段已经部署，无需再次修改或重载。
3. 微信公众平台的 request、uploadFile、downloadFile 合法域名已由用户确认配置为 `https://dermatome.bglabs.cloud`。继续核对隐私告知、平台类目、标识和资质，以及送审与发布行为一致。
4. 在微信开发者工具关闭“不校验合法域名”和开发调试，编译并上传当前代码，由用户设为体验版。使用普通微信账号完成图片和纯手动两条流程。真实微信登录、两账号隔离、手机端完整业务和真机上传仍为 NOT_RUN，直至 AppSecret 配置和用户上传完成。

配置文件格式如下，其中仅展示变量名，实际值请在服务器编辑器中安全填写：

```ini
DERMATOME_WECHAT_APP_SECRET=
ENABLE_PRODUCTION_ACCESS=1
DERMATOME_PRODUCTION_SIGNING_KEY=<服务器生成，不在本文件展示>
```

## 回滚

当前生产只部署了后端文件。使用上述专用备份恢复旧文件和发布清单，移除新加入的 `backend/app/services/production_access.py`，只重启智络智绘，复查新域名健康和针灸原 HTTPS。若后续启用正式业务配置，再同步撤下正式站点片段及该服务的正式配置 drop-in，执行 `nginx -t` 后平滑重载。保留第一阶段站点、证书和针灸配置。详见[部署输出](stage2-deployment.txt)与[第一阶段生产记录](stage1-production.md)。
