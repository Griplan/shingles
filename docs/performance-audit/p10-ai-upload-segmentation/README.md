# P10 AI 照片上传、MobileSAM 分割与人体放置全链路性能审计

日期：2026-11-10。状态：本地与本机测试环境审计完成；客户手机、微信原生帧率和真机网络为 `NOT_MEASURED / NOT_RUN`。本轮没有部署服务器、没有上传体验版、没有修改业务算法。

## 结论

“不跟手”不是单一接口慢造成的，主要由两段不同问题叠加：

1. 框选拖动时，生产 `photo-canvas` 对每个 `touchmove` 执行一次完整重绘；client 坐标事件还重新查询画布位置。Node 命令适配器无法测出手机屏幕延迟，但结构性证据确认没有按帧合并。
2. 同一照片的框选、改框、正负提示点都会重新执行 MobileSAM 图像编码。本机热服务的中位单次分割约 0.78–0.82 秒，其中图像编码约 0.40 秒；腾讯云低负载实测首次和第二次真实推理分别约 3.79 秒和 3.67 秒。

候选 Mask 切换和人体放置不是主要瓶颈。候选切换约 21 ms；放置调整不发后端请求，已有缓存贴片和 `requestAnimationFrame` 单帧调度。放置确认到匹配完成的本机中位约 0.32 秒，云端约 0.44 秒。

## 版本与环境边界

| 项目 | 本次实际状态 |
| --- | --- |
| 本地代码 | 当前工作区，包含 P8/P8.1/P9 等未提交改动 |
| 本机 | Apple M4、macOS 15.6.1、Python 3.12.14、Node 24.11.1、CPU 推理、MobileSAM 4 threads |
| 云端 | `http://212.64.26.206/dermatome-test`，只读低负载测试；HTTP 调试入口，不是 HTTPS/手机验收 |
| 云端身份 | `commons-neutral-v1 / 4.0.1`、`commons-blank-cc0-hands-v2`、`goran-2022-commons-template4-preview.3` |
| MobileSAM | `vit_t`、Apache-2.0、权重 40,728,226 bytes；本地与云端关键文件 SHA-256 一致 |
| 微信体验版 | 当前手机实际版本无法确认；历史上传成功的是 `0.6.8`，但没有确认已设为体验版，且不包含后续 P8.1/P9/P10 |
| 手机端 | 未采集相册打开、原生触摸、FPS、内存或网络数据 |

本机完整链路使用 4032×3024 的公开 CDC 图等比生成样图，生产页面代码将其处理为 1920×1440，再连接真实本机 MobileSAM 和匹配服务。云端完整链路使用 700×460 的公开 CDC 图，没有把大图直接送入云端模型。

## 完整耗时

单位均为毫秒；`P50` 取三次暖启动本机完整链路的中位数。用户自行选择照片、手动框选和拖动调整的时间不计入系统等待。

| 阶段 | 本机冷启动 | 本机暖启动 P50 | 云端单次 | 客户手机 | 主要问题 |
| --- | ---: | ---: | ---: | --- | --- |
| 相册出现 | `NOT_MEASURED` | `NOT_MEASURED` | `NOT_APPLICABLE` | `NOT_MEASURED` | 微信原生界面未插桩 |
| 选图到可框选 | 581.4 | 572.9 | 682.6 | `NOT_MEASURED` | 准备、上传和首帧绘制 |
| 框选松手到首个 Mask 可交互 | 2,376.0 | 757.3 | 3,820.7 | `NOT_MEASURED` | 冷模型、上传、推理、后处理、Mask 下载与绘制 |
| 候选切换 | 21.4 | 21.2 | 20.7 | `NOT_MEASURED` | 仅下载实际候选资源并重绘 |
| 照片确认 | 21.3 | 21.0 | 42.2 | `NOT_MEASURED` | 确认接口和状态更新 |
| 确认到调用放置导航 | 129.0 | 117.8 | 60.5 | `NOT_MEASURED` | 页面状态与导航准备 |
| 导航到放置可交互 | 22.0 | 21.2 | 21.3 | `NOT_MEASURED` | 页面/Canvas 初始化 |
| 放置确认到匹配完成 | 278.8 | 324.7 | 435.7 | `NOT_MEASURED` | 几何校验、接口与结果状态 |
| 各阶段系统等待合计 | 约 3,429 | 约 1,834 | 约 5,084 | `NOT_MEASURED` | 不等于用户总耗时 |

完整表格、口径和代码路径见 [01-end-to-end-flow.md](01-end-to-end-flow.md)。用户感知等待分析见 [06-user-perceived-latency.md](06-user-perceived-latency.md)。

## 主要证据

- MobileSAM 45 次真实推理：[ai-service.json](evidence/ai-service.json)
- 本机冷启动完整链路：[real-page-http.json](evidence/local-e2e-cold/real-page-http.json)
- 本机暖启动三次：[run1](evidence/local-e2e-run1/real-page-http.json)、[run2](evidence/local-e2e-run2/real-page-http.json)、[run3](evidence/local-e2e-run3/real-page-http.json)
- 腾讯云低负载完整链路：[real-page-http.json](evidence/cloud-e2e/real-page-http.json)
- 云端身份与就绪：[cloud-state.json](evidence/cloud-state.json)
- 云端只读运行资源摘要：[cloud-runtime-snapshot.json](evidence/cloud-runtime-snapshot.json)
- 照片 Canvas 命令计数：[photo-canvas.json](evidence/photo-canvas.json)
- 自动检查日志：[backend-ai-tests.log](evidence/backend-ai-tests.log)、[frontend-tests.log](evidence/frontend-tests.log)、[typecheck.log](evidence/typecheck.log)、[project-check.log](evidence/project-check.log)、[atlas-check.log](evidence/atlas-check.log)、[package-check.log](evidence/package-check.log)

## 实际检查

| 检查 | 结果 |
| --- | --- |
| TypeScript | `PASSED` |
| 小程序前端 | `384 passed / 0 failed` |
| 后端与 AI | `322 passed / 0 failed`，7 条既有 MobileSAM/timm 警告 |
| MobileSAM 性能脚本 | 45 次真实推理完成 |
| 照片 Canvas 命令脚本 | 320/375/430 三宽度各 3 次完成 |
| 本机冷启动完整链路 | `PASSED` |
| 本机暖启动完整链路 | 3 次均 `PASSED` |
| 腾讯云低负载完整链路 | `PASSED` |
| 项目、图谱、分包结构 | `PASSED` |
| 微信手机/真机 | `NOT_RUN` |

后端曾出现 2 项会阴门禁失败；使用完整 `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 ENABLE_AI_SEGMENTATION=1` 重跑后 322/322 通过。失败是测试环境条件不足，不是业务回归，没有修改门禁代码。

## 优化优先级

1. 为同一会话、同一照片、同一局部裁片设计有界 MobileSAM 特征缓存。需要会话隔离、LRU/TTL、换图删除、内存实测和单并发保护。
2. 缓存照片 Canvas 节点与布局矩形，按 `requestAnimationFrame` 合并拖动绘制，并拆分静态照片层和动态提示层。
3. 评估模型预热、云端首次请求反馈和 Mask 后处理优化；必须先测 Linux 内存与 CPU，不能直接上线无界缓存。

候选切换、放置拖动和最终匹配不是当前前三项热点。详细排序与风险见 [07-bottleneck-ranking.md](07-bottleneck-ranking.md) 和 [08-optimization-plan.md](08-optimization-plan.md)。

## 尚未排除

- 客户手机是否存在更严重的触摸桥接、Canvas raster 或页面滚动问题。
- Android/iOS 原生相册、`wx.compressImage`、内存峰值和真实网络延迟。
- 当前体验版是否包含 P8.1/P9；没有上传或后台发布证据时不能把本地测试当作手机现状。
- 云端 CPU throttling 的请求前后增量；当前只有 cgroup 累计值，不能把累计值归因于本次请求。
