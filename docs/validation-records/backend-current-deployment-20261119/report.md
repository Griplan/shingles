# 当前后端同步到腾讯云（2026-11-19）

## 1. 部署结果

部署 ID：`backend-current-20261119-155751`

状态：**APPLIED**

本次只更新智络智绘后端的 13 个已审阅文件，并重启 `dermatome.service`：

- `backend/app/api/routes/ai.py`
- `backend/app/api/routes/evaluate.py`
- `backend/app/main.py`
- `backend/app/schemas/evaluate.py`
- `backend/app/services/access.py`
- `backend/app/services/ai_boundary.py`
- `backend/app/services/ai_image_input.py`
- `backend/app/services/ai_limits.py`
- `backend/app/services/ai_sessions.py`
- `backend/app/services/body_intersection.py`
- `deployment/cleanup.py`
- `deployment/nginx.dermatome-ip-test.conf`
- `deployment/nginx.dermatome.conf.template`

备份目录：

`/srv/dermatome-mapper/deployment/backups/backend-current-20261119-155751`

部署脚本、计划、前后快照和原始 smoke 证据保存在本目录：

- [deploy.py](deploy.py)
- [plan.json](plan.json)
- [apply.json](apply.json)
- [before.json](before.json)
- [server-before.json](server-before.json)
- [after.json](after.json)
- [public-smoke.json](public-smoke.json)
- [real-ai-smoke.json](real-ai-smoke.json)
- [real-ai-smoke.py](real-ai-smoke.py)
- [verify-server.py](verify-server.py)
- [server-after-verification.json](server-after-verification.json)

## 2. 线上实测

部署后发布清单：

- 清单文件：150 项；
- 服务器实际文件：150 项；
- 缺失：0；
- SHA-256 不一致：0。

服务状态：

- `dermatome.service`：`active`，`NRestarts=0`；
- `acupuncture.service`：`active`，未重启，PID `611289`；
- Nginx：`active`，主 PID `12643`，启动时间未改变；
- `dermatome-cleanup.timer`：`active`；
- 8000、8001 端口仍只监听 `127.0.0.1`；
- `nginx -t`：配置语法和测试均通过。

公网入口：

`http://212.64.26.206/dermatome-test`

公网合成数据 smoke 为 **12/12 PASS**，覆盖健康检查、匿名拒绝、测试访问开通、鉴权 ready、人体交集、会阴模拟区域、旧版本拒绝、AI 会话创建、删除和重复删除。

另外使用仓库内公开 CDC PHIL 21505 教学样图执行了真实 AI HTTP 链路，**10/10 PASS**：

| 步骤 | 实际结果 |
| --- | --- |
| 健康检查与测试访问 | HTTP 200 |
| 鉴权 ready | HTTP 200 |
| AI 会话创建 | HTTP 200 |
| 照片上传 | HTTP 200，700×460，未被服务器放大 |
| MobileSAM 分割 | HTTP 200，3 个候选，耗时约 6.1 秒（含冷启动） |
| 人工确认 | HTTP 200，16 个片区、25 个孔洞 |
| Mask 下载 | HTTP 200，PNG 签名有效 |
| 会话删除 | HTTP 204 |
| 删除后访问照片 | HTTP 410 |

测试后再次读取 ready：`ai_model_loaded=true`，`medical_review=pending`，`diagnosis_enabled=false`。
服务端临时会话目录计数为 0；没有保留本次公开样图会话。

## 3. 能力与限制

本次线上已启用：

- V7 人体边界交集接口；
- 原始照片传输上限 50 MiB；
- 原始图像素上限 5000 万；
- 受控 MobileSAM 推理上限 300 万像素；
- AI 临时会话空闲回收默认 120 秒；
- 活动访问续期、推理期间保护和幂等 DELETE；
- 清理定时器对无状态文件的 120 秒兜底；
- 公网 IP 测试入口的 Nginx 请求体上限 `51m`。

`AI_IDLE_SECONDS` 未在 `service.env` 显式覆盖，线上使用 `ai_limits.py` 中的 120 秒默认值。

注意：本次只把公网 IP 测试入口的实际 Nginx 配置更新为 51 MiB；域名站点的实际配置仍保持原有的 10 MiB 限制，仓库中的域名模板已更新但未未经授权替换线上域名配置。若后续要让域名入口接收 50 MiB，需要单独备份、校验并重新应用域名站点配置。

## 4. 回归测试

本机实际执行：

- `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 ENABLE_AI_SEGMENTATION=1 ENABLE_PUBLIC_TEST_ACCESS=1 PYTHONPATH=backend:. ai/.venv/bin/python -m pytest backend/tests ai/tests -q`：**343 passed**，7 条既有 MobileSAM/timm 依赖警告；
- `npm test --prefix miniprogram`：**431 passed**；
- `npm run typecheck --prefix miniprogram`：PASS；
- `python3 scripts/check_project.py`：PASS；
- `python3 scripts/sync_atlas.py --check`：PASS；
- `python3 scripts/check_miniprogram_packages.py`：主包 902,748 bytes、`clinical` 1,424,938 bytes、`special` 756,636 bytes，均低于保守单一分包限制 2 MiB；
- `git diff --check`：PASS。

本次是后端部署，没有上传或设置微信体验版。工作区现有前端改动保留，由用户自行提交体验版。

## 5. 尚未完成

- 未实际上传 50 MiB 大图并测量 Linux 解码内存峰值；
- 未用缩短测试 TTL 在公网等待 120 秒验证真实后台回收；
- 未测双手机并发上传或并发 MobileSAM；
- 手机原生微信界面、真实网络删除和体验版完整流程仍为 `NOT_RUN`；
- 没有把本次工程验证写成医学审核或诊断准确率验收。

真实 AI 测试只使用公开教学样图，没有上传患者照片。线上进程在测试后观察到 RSS 约 576 MiB、进程峰值约 712 MiB，cgroup 上限 1.5 GiB，OOM 计数为 0；这不是并发压力测试结论。

## 6. 回滚

只回滚智络智绘：

1. 停止 `dermatome.service`；
2. 从备份目录恢复本次 13 个文件和 `deployment/release-manifest.json`；
3. 从备份恢复 `/etc/nginx/sites-available/dermatome-ip-test`；
4. 运行 `nginx -t`，通过后平滑 reload Nginx；
5. 启动 `dermatome.service`；
6. 检查智络智绘 health、ready 和 `acupuncture.service`；
7. 不重启针灸服务，不整机回滚。

本次未执行 Git commit 或 Git push。
