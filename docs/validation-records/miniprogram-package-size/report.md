# 微信小程序体验版 2 MB 超限修复

日期：2026-11-07
最终体验版上传版本：`0.6.8`
状态：**DONE**（包体、编译、路由和上传已实际验证；微信后台设为体验版仍需人工确认）

## 1. 超限根因

修改前按上传内容做保守统计：

- 147 个文件；
- 总计 `4,077,700 bytes`，约 `3.889 MiB`；
- 微信旧上传日志为 `source size 3767KB exceed max limit 2MB`。

根因不是单一图片过大，而是全部页面、人体资源、临床图谱和特殊部位资源都位于主包：

- 临床图谱生成文件约 `1.71 MB`；
- 全身正背面 PNG 合计约 `0.43 MB`；
- 足底、腋下、会阴图片和模拟图谱均留在主包；
- AI、放置、结果、标注和调试页面也全部留在主包；
- 原始 SVG、说明文档、旧人体 TS 和旧图谱 TS 虽可在打包配置中排除，但此前的目录划分仍让运行资源过度集中。

## 2. 处理策略

采用最小必要改动：

1. 保留首页和人体选择页在主包。
2. 新增 `clinical` 分包，承载标注、结果、图谱调试、AI 辅助和病灶放置。
3. 新增 `special` 分包，承载特殊部位入口、足底、腋下和会阴局部页面。
4. 分包只引用主包公共代码，分包之间不互相引用。
5. 使用微信原生 `subPackages`，没有引入框架或重构业务。
6. 临床图谱坐标使用无损 Float64 Base64 编码，运行时还原原几何；没有量化、简化或改变任何坐标。
7. 通过 `packOptions.ignore` 排除 `node_modules`、原始 SVG、Markdown、旧人体/图谱 TS、测试占位和未使用组件目录。
8. 运行图片保留 PNG；原始 SVG 仅作为编辑源和许可/审计资料，不进入上传包。

分包路由：

| 包 | 页面 |
| --- | --- |
| 主包 | `pages/index/index`、`pages/select/select` |
| `clinical` | `annotate`、`result`、`atlas-debug`、`ai-annotate`、`placement` |
| `special` | `special-parts`、`local-surface` |

`atlas-debug` 是既有开发调试入口，保留在 `clinical` 分包，不占用主包；没有删除现有入口或改变其业务行为。

## 3. 最终包体

### 本地保守统计

该统计基于未压缩生成文件，因此比微信实际上传包更保守。

| 包 | 文件数 | bytes | MiB | 距 2 MiB 上限余量 |
| --- | ---: | ---: | ---: | ---: |
| 主包 | 63 | 853,130 | 0.814 | 1,244,022 bytes |
| `clinical` | 37 | 1,354,227 | 1.291 | 742,925 bytes |
| `special` | 23 | 754,623 | 0.720 | 1,342,529 bytes |

### 微信实际上传统计

微信开发者工具生成的实际上传统计：

| 包 | bytes | 约 MiB |
| --- | ---: | ---: |
| 主包 | 755,673 | 0.721 |
| `packages/clinical/` | 1,298,497 | 1.238 |
| `packages/special/` | 704,578 | 0.672 |
| 合计 | 2,758,748 | 2.631 |

每个包均低于微信单个分包 `2 MiB` 上限；主包也低于代码质量工具建议的 `1.5 MiB`。全项目总量远低于微信总计上限。

## 4. 最大的 20 个构建文件

| # | bytes | 包 | 文件 |
| ---: | ---: | --- | --- |
| 1 | 1,172,637 | clinical | `packages/clinical/data/atlas.generated.js` |
| 2 | 226,722 | main | `assets/body/commons-cc0/front.png` |
| 3 | 217,406 | main | `assets/body/commons-cc0/back.png` |
| 4 | 161,191 | special | `packages/special/data/perineum-schematic.generated.js` |
| 5 | 153,240 | main | `data/body-hands.generated.js` |
| 6 | 133,537 | special | `packages/special/assets/sole/sole-right.png` |
| 7 | 113,975 | special | `packages/special/assets/sole/sole-left.png` |
| 8 | 90,034 | special | `packages/special/assets/perineum/perineum-overview.png` |
| 9 | 83,561 | special | `packages/special/data/axilla-schematic.generated.js` |
| 10 | 76,001 | main | `assets/body/commons-cc0/geometry.generated.js` |
| 11 | 59,707 | special | `packages/special/data/sole.generated.js` |
| 12 | 29,715 | special | `packages/special/assets/axilla/axilla-right.png` |
| 13 | 29,555 | special | `packages/special/assets/axilla/axilla-left.png` |
| 14 | 29,549 | clinical | `packages/clinical/pages/annotate/annotate.js` |
| 15 | 21,529 | main | `components/body-canvas/body-canvas.js` |
| 16 | 19,956 | main | `utils/placement-geometry.js` |
| 17 | 17,446 | clinical | `packages/clinical/state/ai-session.js` |
| 18 | 17,385 | clinical | `packages/clinical/pages/placement/placement.js` |
| 19 | 15,631 | main | `state/annotation-session.js` |
| 20 | 15,385 | special | `packages/special/pages/local-surface/local-surface.js` |

机器可读明细见 `package-audit.json`。

## 5. 依赖与引用检查

- 主包保留人体 Canvas、公共坐标/几何工具、公共 API/鉴权入口、人体图片和人体手部数据。
- `clinical` 依赖主包公共代码，并包含临床图谱、标注/AI/放置页面及其专属组件和会话状态。
- `special` 依赖主包公共代码，并包含特殊部位页面、局部 Canvas、足底/腋下/会阴图片与图谱。
- 未发现 `clinical` 与 `special` 之间的跨分包引用。
- 所有页面路由、组件绝对路径、图片路径和跳转均已同步更新。
- `packOptions.ignore` 排除项已在真实上传成功弹窗中再次核验，共 27 个开发文件未被打包。

## 6. 验证结果

| 检查 | 结果 |
| --- | --- |
| TypeScript | PASS |
| 小程序前端自动化 | PASS，359/359 |
| 项目结构检查 | PASS |
| 临床图谱无损编码复现 | PASS |
| 主包/分包体积检查 | PASS |
| 分包间 JS、组件、静态资源引用检查 | PASS |
| 微信开发者工具编译 | PASS，Errors 0 |
| 首页、人体选择、人工标注、AI 辅助、特殊部位、脚底页面路由 | PASS |
| 微信上传 | PASS，版本 `0.6.8` |
| 手机真机全链路 | NOT_RUN |
| 微信后台将该上传版本设为体验版 | 未验证，需人工操作 |

微信代码质量扫描仍提示若干“主包存在可由分包使用的公共 JS”、组件按需注入建议和单张图片大于 200 KB 的优化提示。这些是建议项，不阻塞上传；主包体积检查已通过，所有平台硬限制均未超限。

## 7. 上传记录

微信开发者工具已显示“代码上传成功”：

- 版本：`0.6.8`
- 备注：`小程序分包修复：主包与临床/特殊部位分包低于2MB`
- 上传时间：2026-11-07 13:00（Asia/Shanghai）
- 构建错误：0
- 分包数量：2

上传成功不等于已经自动成为体验版。仍需在微信公众平台将版本 `0.6.8` 设为体验版，再由手机微信打开该体验版进行真机验收。

## 8. 工程边界

- 未修改人体图谱几何、神经匹配公式、MobileSAM 模型或用户标注；
- 未修改腾讯云后端、鉴权、域名或服务器；
- 未提交或推送 Git；
- 原始 SVG、旧版人体/图谱 TS 和文档保留在仓库，仅排除出上传包。
