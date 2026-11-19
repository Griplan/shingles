# 03 当前完成度

> 文档基线：2026-11-19；代码基线为 Git `27b41f6` 加当前未提交工作区。代码、部署和真机状态分层记录，以当前源码与实际证据为准。

## 3.1 状态判定规则

本节以“当前工作区代码”为单位，不把旧服务器或旧体验包算作当前代码已部署。

| 维度 | 含义 |
| --- | --- |
| 代码 | 当前源码是否实现 |
| 自动测试 | 是否在当前环境实际通过 |
| 云端 | 是否有对应版本部署证据 |
| 体验版 | 是否有新体验包并实际打开 |
| 真机 | 是否在 Android/iOS 真机完成 |

## 3.2 核心功能矩阵

| 功能 | 代码 | 当前自动测试 | 云端 | 体验版 | 真机 |
| --- | --- | --- | --- | --- | --- |
| 首页与完整人体导航 | IMPLEMENTED | TESTED | 仅 V6.7 历史版本 | PARTIAL/UNKNOWN | NOT_RUN |
| 正背面切换与缩放平移 | IMPLEMENTED | TESTED | V6.7 | 旧版本可存在 | NOT_RUN |
| 手工 Polygon | IMPLEMENTED | TESTED | 前端功能 | 0.6.8 之后有本地改动 | NOT_RUN |
| 多片、MultiPolygon、孔洞 | IMPLEMENTED | TESTED | 后端支持 | PARTIAL | NOT_RUN |
| 人体填充区域边界校验 | IMPLEMENTED | TESTED | 前端本地 | PARTIAL | NOT_RUN |
| 粗区域点击和高亮 | IMPLEMENTED | TESTED | 前端功能 | 可存在 | NOT_RUN |
| Goran 全身参考匹配 | IMPLEMENTED | TESTED | DEPLOYED（V6.7） | UNKNOWN | NOT_RUN |
| 文件上传与高清照片预处理 | IMPLEMENTED | TESTED（替身与真实模型测试） | 最近本地后端增量未部署 | PARTIAL | NOT_RUN |
| MobileSAM 真模型 | IMPLEMENTED | TESTED（本机真实推理） | 历史真实验证，最新 P12 未验证 | UNKNOWN | NOT_RUN |
| Mask 候选切换 | IMPLEMENTED | TESTED | 前端功能 | UNKNOWN | NOT_RUN |
| 人工笔刷修正 | IMPLEMENTED | TESTED | 后端接口已有历史部署 | UNKNOWN | NOT_RUN |
| 照片坐标到人体坐标 | IMPLEMENTED | TESTED | 主要是前端 | UNKNOWN | NOT_RUN |
| 拖动、缩放、旋转 | IMPLEMENTED | TESTED（Node/微信工具） | 前端功能 | UNKNOWN | NOT_RUN |
| 放置后自动匹配 | IMPLEMENTED | TESTED | 后端依赖 V4 | UNKNOWN | NOT_RUN |
| 完全/部分/完全越界人体交集 | IMPLEMENTED | TESTED | 当前云端未确认含 V7 新路由 | UNKNOWN | NOT_RUN |
| 左右脚底 | IMPLEMENTED | TESTED | DEPLOYED（V6.7） | UNKNOWN | NOT_RUN |
| 左右腋下模拟 | IMPLEMENTED | TESTED | DEPLOYED（V6.7） | UNKNOWN | NOT_RUN |
| 中性会阴模拟 | IMPLEMENTED | TESTED（含微信工具） | DEPLOYED（V6.7） | UNKNOWN | NOT_RUN |
| 独立手掌 | DEPRECATED | 回归保护 | 不应使用 | 不应使用 | NOT_RUN |
| 折叠屏响应式 | IMPLEMENTED | TESTED（布局矩阵） | 前端功能 | 未确认最新包 | NOT_RUN |
| 照片框选性能优化 | IMPLEMENTED | TESTED | 前端功能 | 未确认最新包 | NOT_RUN |
| 复杂放置性能优化 | IMPLEMENTED | TESTED | 前端功能 | 未确认最新包 | NOT_RUN |
| 2 分钟 AI 闲置清理 | IMPLEMENTED | TESTED（本机） | NOT DEPLOYED | 服务端无关 | NOT_RUN |
| 匹配结果 Canvas 修复 | IMPLEMENTED | TESTED + 微信工具验证 | 前端功能 | UNKNOWN | NOT_RUN |

## 3.3 当前验证基线

本轮交接前实际执行：

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | `431/431` 通过 |
| 后端与 AI 全量测试（正确设置测试门禁） | `343/343` 通过，7 条既有依赖警告 |
| `scripts/check_project.py` | 通过 |
| `scripts/sync_atlas.py --check` | 通过 |
| `scripts/check_miniprogram_packages.py` | 通过 |
| 全部 WXML/WXSS 的微信 `wcc`/`wcsc` | 通过 |
| `git diff --check` | 通过 |

后端第一次在未开启 `ENABLE_REFERENCE_MATCHING` 时运行，出现 2 个会阴模拟数据测试失败。原因是测试命令缺少环境门禁，不是产品代码回归；使用记录中的正确测试环境后全量通过。

## 3.4 包体基线

本地微信上传压缩前的保守估算：

| 包 | bytes | MiB | 2 MB 余量 |
| --- | ---: | ---: | ---: |
| 主包 | 902,748 | 0.861 | 1,194,404 |
| clinical | 1,424,938 | 1.359 | 672,214 |
| special | 756,636 | 0.722 | 1,340,516 |

最大文件是 clinical 分包的图谱编码数据，约 1.17 MB。当前分包低于平台单包限制，但仍应在新增大资源时持续检查。

## 3.5 最近真实微信工具证据

2026-11-17 在微信开发者工具实际完成：

- 编译 Errors 0；
- 完整人体取点、闭合和完成标注；
- 自动进入结果；
- Canvas 实测 `425 × 594`；
- 人体、棕色病灶轮廓和 7 个彩色参考区域显示；
- 单标签高亮与“查看全部”恢复。

证据见 [matching-canvas-zero-width 报告](../validation-records/matching-canvas-zero-width/report.md)。

这不是手机体验版验收。

## 3.6 部署状态

最近有完整证据的云端部署是 V6.7：

- 145 个发布文件哈希一致；
- 公网 smoke 8/8 通过；
- 会阴 S2 和 UNDEFINED 接口可用；
- `acupuncture.service` 与 Nginx 未被修改；
- 线上 MobileSAM 在当次因会话容量 429，未重新推理。

之后 P8/P9/P11/P11.2/P12.1/V7 等本地增量没有完整部署证据。当前线上与当前工作区已分叉。

## 3.7 体验版状态

有证据确认开发者工具曾成功上传版本 `0.6.8`。报告明确写着仍需在微信公众平台手动设为体验版；没有“已设为体验版”的证据。

因此：

- 可以说：`0.6.8` 上传成功；
- 不能说：`0.6.8` 已成为体验版；
- 不能说：`0.6.8` 包含其后的 V7/P11.2/P12.1 改动；
- 不能说：Android/iOS 已验证。
