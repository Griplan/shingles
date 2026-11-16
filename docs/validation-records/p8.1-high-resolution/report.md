# P8.1 高清照片原生缩图增量

日期：2026-11-09。小程序本地代码、自动回归、真实本机 AI/放置链路通过。微信 Android/iOS 真机未运行，本轮未上传体验版。

## 改动与安全边界

| 阶段 | 限制与策略 |
| --- | --- |
| 选中的原图 | 实际文件大小 ≤50 MiB、实际宽高乘积 ≤5000 万像素。超限时明确建议在相册裁剪；极端长宽比若不能输出短边至少 8 px，同样提示。 |
| P8 Canvas 路径 | 原有直接处理预算保持 ≤20 MiB、≤1600 万像素、单边 ≤8192。超出任一预算不得送原图到 Canvas。 |
| 新增大图路径 | 检查微信基础库和 `wx.compressImage` 可用性，请求按原始比例直接缩到目标宽高。一次只处理一张；没有原分辨率 Canvas、没有将大文件整张读进 JS。 |
| 上传前最终校验 | ≤8 MiB、≤300 万像素、最长边 ≤1920 px。原生返回实际大小、尺寸、方向和格式都要复核。已经足够小的缩图直接使用；若仍大于 8 MiB，仅在符合 P8 解码预算时用既有 Canvas 编码流程处理缩图。 |

微信项目配置与工具页面实际运行基础库均为 **3.17.4**。本地微信官方 API 类型声明标明 `compressedWidth` / `compressedHeight` 最低为 **2.26.0**，并记录 iOS 原生压缩仅支持 JPG。[腾讯云图片 API 说明](https://intl.cloud.tencent.com/zh/document/product/1219/68036)列明两个尺寸参数的等比缩放用法。大 JPEG 走原生缩图；大 PNG/WebP 仅在系统支持且能保持格式时继续，遇到不支持的格式、原生错误或设备资源不足会提示裁剪、降低拍摄分辨率或转存 JPEG。P8 尺寸范围内的静态 PNG/WebP 仍走原路径，纯 HEIC 继续提示转存，不把 iOS/Android 原生支持当作已实测。

旋转或镜像的大 JPEG 使用私有磁盘副本，在 JPEG 头中仅修改 APP1 标记以防系统自行应用 EXIF/XMP 方向。头部用短范围读取，像素由原生接口缩小；确认缩图尺寸后，仅在小 Canvas 上施加一次 P8 的 EXIF 变换。需旋转的大 PNG/WebP 安全提示转存 JPEG，不猜测方向。缩图、私有副本按原有生命周期删除；取消后迟到结果会被清理。原生缩图设 30 秒界面超时；因为接口未提供取消句柄，回调尚未返回时不会启动第二次解码。

上传后的服务器定向处理图仍是框、点、Mask 和 MultiPolygon 的共同坐标基准；人体放置仍使用原有模板坐标。FastAPI、Nginx、MobileSAM、人体模板、神经图谱、匹配公式、线上配置及原针灸服务没有修改。P8.1 只需发布小程序。

微信开发者工具实测选择一张有效的 1280×1707、约 214 KiB JPEG 时，`readFile` 成功回调没有通过原来的 `instanceof ArrayBuffer` 判断，页面因此显示“无法读取照片内容”。该文件可从微信临时目录直接解码，确认不是照片损坏、格式伪装或大小超限。读取兼容层现同时接受跨执行域 ArrayBuffer、ArrayBuffer View 和微信二进制字符串，并仅将无法转换的结果报错；回归测试已覆盖跨执行域和字符串兼容分支。

## 本机实测

样图以公开 CDC PHIL 21505 等比生成并补边，仅用于验证尺寸与方向。使用小程序生产页面/组件代码，Node/Pillow 适配微信调用，其中大图原生分支用 Pillow 执行实际缩图；推理与匹配均为本机真实服务。以下耗时为单轮测量，非真机性能。

| 输入（存储尺寸） | 处理图 | 文件字节（前 → 后） | 准备耗时 | 本机上传 | 缩图子进程峰值 RSS |
| --- | --- | ---: | ---: | ---: | ---: |
| 4032×3024 | 1920×1440 | 1,266,413 → 333,423 | 219 ms | 150 ms | 未单独测量 |
| 6000×4000 | 1920×1280 | 2,352,328 → 267,876 | 276 ms | 148 ms | 149.4 MiB |
| 8064×6048 | 1920×1440 | 3,894,423 → 271,991 | 250 ms | 152 ms | 98.6 MiB |
| 6048×8064，EXIF 6 | 1920×1440 | 3,913,306 → 317,979 | 386 ms | 148 ms | 97.9 MiB |

原生分支适配器执行缩图约 142–188 ms。RSS 是本机 **Pillow 子进程**的独立峰值，包含启动与解码，不是微信、JS 堆或手机整机占用。四例真实 MobileSAM 请求约 0.71–0.79 秒（同一本机已热服务）。四例均完成框选、正负提示点、Mask 预览、确认、人体放置和神经匹配；均保留多片与孔洞，删除后照片访问返回 410。对照独立 EXIF 转正和缩放的参考图，平均 RGB 绝对差为 0.43–0.54/255；最大框坐标偏差 < 2e-13 个处理图像素；MultiPolygon 以像素中心重建后，每例与 Mask 的差异均为 **0 像素**。该验证不代表医学准确性或手机触控误差。

测试替身还覆盖原图恰好 50 MiB / 5000 万像素、两个上限分别超出、大文件低像素、小文件高像素、APNG、原生拒绝/OOM、基础库太旧、原生返回原尺寸或错误方向、输出超 8 MiB、取消、超时后的串行保护与迟到文件清理。恰好 50 MiB 的边界用自动化替身验证，未在手机相册实测。

## 验证与发布

- `npm --prefix miniprogram run typecheck`、`npm --prefix miniprogram test`：通过，380/380。
- `DERMATOME_ENV=test ENABLE_REFERENCE_MATCHING=1 PYTHONPATH=backend:. ai/.venv/bin/python -m pytest -q backend/tests ai/tests`：通过，322/322，7 条既有依赖警告。
- 微信自带 `wcc` / `wcsc`、项目结构、图谱一致性、包体及分包引用、`git diff --check`：通过；clinical 分包本地保守体积 1.314 MiB。
- 实际打开 Shingles 微信工具并重新编译：模拟器首页继续白屏，未进入相册，原生 `wx.compressImage` 流程、Android/iOS、设备内存、体验版均为 **NOT_RUN**。编译与本机适配测试不能替代真机结果。
- 运行时代码只改 `miniprogram/packages/clinical/utils/prepare-photo.ts`；回归扩展 `tests/miniprogram/prepare-photo.test.cjs` 与 `scripts/test_placement_http.cjs`。
- 发布步骤：微信开发者工具编译 `miniprogram` → 上传一个未使用的版本号 → 在微信公众平台将新版本设为体验版 → 分别在 Android 和 iOS 用 2400 万、4800 万像素公开 JPEG（至少一张 EXIF 旋转），完成选择、圈选、确认、放置和匹配。记录系统版本、微信版本、成功/失败及手机耗时。无需发布或重启后端。

证据：[1200 万](real-page-http.json)、[2400 万](real-page-http-6000x4000.json)、[4800 万](real-page-http-8064x6048.json)、[4800 万 EXIF 6](real-page-http-8064x6048-exif.json)。本机复测：在既有本机 AI 服务启动后运行 `DERMATOME_TEST_P81_SIZE=8064x6048 node scripts/test_placement_http.cjs docs/validation-records/p8.1-high-resolution`；2400 万改用 `6000x4000`，旋转例另加 `DERMATOME_TEST_HD_EXIF=1`，1200 万使用 `DERMATOME_TEST_HD=1` 并不设 `DERMATOME_TEST_P81_SIZE`。
