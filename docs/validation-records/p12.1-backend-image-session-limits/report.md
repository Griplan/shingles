# P12.1 后端图片接收与会话生命周期专项

日期：2026-11-17
范围：FastAPI 后端、服务端图片预处理、临时会话清理和部署配置模板
明确未改：小程序、MobileSAM 权重、医学图谱、V4 匹配公式、人体放置交互、针灸项目

## 1. 修改前限制

| 位置 | 修改前 | 问题 |
| --- | --- | --- |
| 受控 FastAPI 传输 | 10 MiB + 64 KiB multipart | 低于本轮目标 |
| development/test 传输 | 20 MiB + 64 KiB multipart | 与源图目标不一致 |
| 图片解码 | 受控 300 万像素；其他 1200 万像素 | 超过像素上限直接拒绝，不缩小 |
| 会话空闲期限 | 默认 900 秒 | 不符合本轮 120 秒要求 |
| B Nginx 模板 | 11 MiB | 无法转发 50 MiB 请求 |

小程序原本已自动把上传准备为最多 8 MiB、300 万像素、最长边 1920 px；本轮没有修改该流程。后端放宽用于接收未经该流程处理的兼容请求，并不允许把 5000 万像素原图送入 MobileSAM。

## 2. 新的后端合同

- 传输层与 multipart 文件：最高 50 MiB，额外允许 64 KiB multipart 开销。
- 源图元数据：最高 5000 万像素、单边 10000、最小边 8。
- 格式：单帧 JPEG、PNG、WebP；按实际内容识别，不信任扩展名或客户端 MIME。
- 受控环境推理：先应用 EXIF 方向并等比缩至最多 300 万像素，再生成 RGB、Mask 和模型输入。
- development/test 推理：最多 1200 万像素。
- 透明图统一合成到白底；输出仍为无原文件元数据、方向统一的 PNG。
- 超过源图/传输限制、损坏图、格式伪装、动画图、异常方向或分辨率数据继续明确失败。

格式验证、Pillow 解压缩炸弹防护、会话能力令牌、上传/推理串行保护、单 Worker 和临时目录 0700 均保留。

## 3. 会话回收

`AI_IDLE_SECONDS` 的默认值改为 120 秒。

- 创建、照片上传、分割、修正、确认和资源访问使用现有活动刷新逻辑。
- 扫描每 30 秒执行，不依赖新请求触发。
- `segment`/`edit` 推理期间会话加入 `active_sessions`，即使已到 TTL，扫描也不会删除。
- DELETE 幂等；结果发布前重新校验令牌与操作编号，删除后的迟到推理不能重建会话文件。
- 服务正常运行时的目标回收窗口为 120 秒外加最多约 30 秒扫描延迟。
- 服务停止期间沿用 `dermatome-cleanup.timer`；无有效状态文件的目录以最后修改时间 120 秒作为过期兜底。
- 放置页首帧就绪后立即 DELETE 的原流程不变。

### 前端心跳限制

本轮按用户要求不修改小程序。当前没有页面存活心跳；用户在 AI 页面停留超过 120 秒且期间没有任何服务端请求时，会话可能被正常回收。之后访问候选资源、确认或分割会收到 410。要在不影响短 TTL 的前提下保证长停留页面持续有效，需要后续单独实现“页面可见时低频心跳、隐藏/退出/断网时停止”的前端能力。

## 4. 实测

环境：Apple M4，本机 CPU；Python 3.12.14、Pillow 11.1.0、MobileSAM `vit_t`。

| 场景 | 输入 | 输出 | 耗时 | 峰值 RSS |
| --- | --- | --- | ---: | ---: |
| JPEG 服务端预处理 | 8064×6048，48,771,072 px，800,807 bytes | 2000×1500，3,000,000 px | 0.13 s | 122.85 MiB |
| JPEG 精确源图上限 | 10000×5000，50,000,000 px | 2448×1224，2,996,352 px | 0.12 s | 122.95 MiB |
| PNG 服务端预处理 | 8064×6048，1,438,603 bytes | 2000×1500 | 0.27 s | 314.83 MiB |
| 受控 3 MP 真实 MobileSAM | 48.8 MP JPEG；上传+推理 | 2000×1500；三个候选 status=ok | 上传 0.10 s；推理 2.11 s；总计 2.21 s | 929.94 MiB |

PNG 走 Pillow 常规解码，峰值高于 JPEG draft；当前会话锁仍串行化解码，单推理槽不变。以上是开发机数据，不是腾讯云 Linux、并发峰值或生产 SLA。

## 5. 自动化验证

实际运行：

```text
DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 ENABLE_AI_SEGMENTATION=1 \
PYTHONPATH=backend:. ai/.venv/bin/python -m pytest backend/tests ai/tests -q
```

结果：`343 passed`，7 条既有 MobileSAM/timm 依赖警告，0 失败。

覆盖增量包括：

- 4032×3024、6000×4000、8064×6048、10000×5000 等比缩放。
- EXIF 方向、透明背景、损坏/伪装/GIF/过小图片。
- 源文件字节与源图像素拒绝。
- 默认 120 秒 TTL、活动刷新、无请求后台回收、无状态文件 120 秒兜底、重启清理。
- 推理进行中即使 TTL 已过也不删除；完成后再由扫描回收。
- 50 MiB 以上实际请求 413、重复 DELETE、会话隔离与原有人体/图谱/AI 回归。

## 6. 部署影响

后端需同步：

- `backend/app/services/ai_limits.py`（新增）
- `backend/app/services/ai_image_input.py`（新增）
- `backend/app/services/access.py`
- `backend/app/services/ai_sessions.py`
- `backend/app/services/ai_boundary.py`
- `backend/app/api/routes/ai.py`
- `deployment/cleanup.py`

服务端配置需同步：

- `deployment/nginx.dermatome.conf.template`
- `deployment/nginx.dermatome-ip-test.conf`
- B API location 的 `client_max_body_size` 改为 `51m`，为 50 MiB 文件和 multipart 留余量。
- 如果云端 `service.env` 显式设置 `AI_IDLE_SECONDS=900`，部署时应改为 `120` 或删除该项以采用新默认值。

本轮未连接、修改或重启腾讯云，也未运行 `nginx -t`、部署服务或上传体验版。

## 7. 结论

后端已实现 50 MiB/5000 万源像素的受控接收、缩放后安全推理和 120 秒空闲回收。活动推理和立即删除受到保护。未解决项是没有前端心跳导致的长停留过期，以及云端 Linux、并发双上传、OOM 和真实网络上传仍未验证。
