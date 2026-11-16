# 07 瓶颈排序与证据等级

## 1. MobileSAM 同照片重复图像编码

- 证据等级：`CONFIRMED`
- 阶段：框选、改框、正负提示点、多局部框。
- 代码：`ai/inference/mobile_sam.py::MobileSAM.predict()`、`ai/inference/local_regions.py::predict_regions()`、`backend/app/services/ai_sessions.py::segment()`。
- 数据：本机图像编码 P50 约 0.40 秒；同图改框总耗时 P50 0.82 秒，未因照片未变而降低。
- 影响：暖启动每轮可重复付出约 0.4 秒；多局部框会按框重复编码。
- 尚未排除：云端图像编码占比未单独插桩；有界缓存的 Linux RSS 峰值未测。

## 2. 照片框选高频 Canvas 查询与重绘

- 证据等级：`STRUCTURAL_CONFIRMED / NATIVE_LATENCY_NOT_MEASURED`
- 阶段：框选拖动和笔刷拖动。
- 代码：`miniprogram/packages/clinical/components/photo-canvas/photo-canvas.ts::point/redraw/queueTouch`。
- 数据：120 次移动产生 120 次节点查询、清屏、照片/Mask 双绘制和 `setData`，另有约 122 次矩形查询。
- 影响：高频主线程工作与 bridge 调用可能造成界面落后于手指。
- 尚未排除：微信原生 Canvas 的实际 raster 成本和触摸桥接开销。

## 3. 冷启动与云端 CPU 推理

- 证据等级：`CONFIRMED`
- 阶段：模型首次加载、MobileSAM 编码/解码、Mask 后处理、响应。
- 数据：本机模型加载约 1.73 秒；本机冷首次 Mask 约 2.38 秒；云端首次/第二次约 3.79/3.67 秒。
- 影响：首次使用和云端体验存在明显秒级等待。
- 尚未排除：云端内部 Nginx、CPU 配额、模型编码与后处理各自占比没有细粒度 trace。

## 4. Mask 后处理与结果返回

- 证据等级：`MEASURED_SECONDARY`
- 数据：本机局部分析 Polygon/MultiPolygon P50 约 0.23–0.28 秒。
- 影响：即使缓存图像编码，后处理仍是不可忽略部分。
- 风险：不能通过删减小片、孔洞或简化医学形状换速度。

## 5. 候选切换

- 证据等级：`MEASURED_NOT_PRIMARY`
- 数据：约 21 ms，不重新推理。
- 结论：不是当前前三项热点。

## 6. 人体放置

- 证据等级：`MEASURED_NOT_PRIMARY`
- 数据：进入可交互约 21 ms；调整期间 0 个后端请求；确认到匹配约 0.32–0.44 秒。
- 结论：P6 的缓存贴片、RAF 和人体边索引仍有效，当前不是 AI 照片流程的主要等待来源。

## 不能确认的问题

- 客户手机具体 FPS 与触摸到屏幕延迟：`NOT_MEASURED`
- 微信开发者工具原生 trace：`NOT_RUN`
- Android/iOS 网络、内存与相册/相机：`NOT_RUN`
- 当前体验版是否包含 P8.1/P9：`UNKNOWN`
- 云端请求前后 CPU throttling 增量：`NOT_MEASURED`
