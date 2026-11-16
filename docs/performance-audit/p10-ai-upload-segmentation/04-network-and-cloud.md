# 04 网络与腾讯云

## 实际入口与身份

本轮只使用项目现有 HTTP 公网开发测试入口：

`http://212.64.26.206/dermatome-test`

它不是 HTTPS 发布方案，也不是手机验收。测试使用公开 CDC 图，临时访问会话在结束后撤销，临时照片在流程结束后删除，删除后资源访问返回 410。

云端 readiness 返回：

- template：`commons-neutral-v1 / 4.0.1`
- geometry：`commons-blank-cc0-hands-v2`
- atlas：`goran-2022 / goran-2022-commons-template4-preview.3`
- AI：已加载，CPU
- medical review：`pending`
- diagnosis：禁用

## 网络耗时

| 阶段 | 本机 | 云端 |
| --- | ---: | ---: |
| 公开测试图上传 | 145–157 ms | 158.7 ms |
| 第一次真实推理 | 752.7 ms（暖） | 3,795.0 ms |
| 第二次真实推理 | 718.1 ms（暖） | 3,672.4 ms |
| 放置确认到匹配完成 | 324.7 ms（中位） | 435.7 ms |

上传不是主要瓶颈。云端与本地使用相同 MobileSAM 关键文件摘要，但 CPU 架构、线程与配额不同；不能把 M4 性能外推到腾讯云。

## 只读服务器快照

| 项目 | 本次只读观察 |
| --- | --- |
| CPU | AMD EPYC、4 逻辑核、x86_64 |
| load average | `0.11 / 0.06 / 0.02` |
| RAM | 约 3.64 GiB，available 约 2.47 GiB |
| `dermatome.service` | active/running，PID 1262949，NRestarts 0 |
| dermatome 当前内存 | 538,968,064 bytes |
| dermatome cgroup peak | 797,048,832 bytes |
| OOM / OOM kill | 0 / 0 |
| `acupuncture.service` | active/running，PID 611289，NRestarts 0 |
| 8000 / 8001 | 均仅监听 `127.0.0.1` |
| cgroup CPU throttling 累计值 | `nr_throttled=136`、`throttled_usec=152375` |

CPU throttling 是 cgroup 生命周期累计值，本轮没有可靠的前后增量，不能把 152.375 ms 累计限流归因于本次请求。低负载测试没有观察到队列或内存告警，但不能据此断言生产高并发稳定。

## 原服务保护

本轮只读；没有修改 Nginx、systemd、端口、防火墙、模型、上传限制或服务文件，没有重启任何服务。记录时 `acupuncture.service` 和 `dermatome.service` 均 active，NRestarts 为 0。P10 没有执行针灸业务请求，不能把健康状态描述成其完整业务验收。

## 未完成

- 手机 Wi-Fi/5G 上传和下载耗时：`NOT_RUN`
- HTTPS 合法域名：未配置，本轮不创建
- 微信体验版实际版本：无法确认
- 云端请求前后 CPU throttling 增量：`NOT_MEASURED`
- 高并发、持续压力和 Linux 带缓存特征基准：未执行
