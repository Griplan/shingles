# AI 病灶放置：完整人体与大屏适配修复

日期：2026-11-17

## 现象

进入“确认病灶位置”后只看到局部人体；在平板、横屏手机和外屏/展开态中，原先 P9 的大屏双栏布局没有生效，人体仍被限制在页面上方约一半高度。

## 根因

1. 放置页初始化时仍把粗粒度 `regionId` 写入 `zoomRegion`。`ensureViewport()` 随即根据该区域调用 `focusViewport()`，即使实际流程是 V7 的全身自由放置，也会自动裁成局部人体。
2. 放置页 WXSS 使用页面级选择器强制 `.p9-split` 为纵向、`.body-stage` 为 `50vh / max-height:620px`。这些规则的优先级高于通用 P9 双栏规则，因此大屏仍保持手机单栏形态。
3. 选择器尺寸测量失败时的窗口回退也按手机 `50vh` 计算，无法与宽屏布局保持一致。

## 修复

- 放置入口不再把身体区域提示转换成人眼可见的自动放大；初始视口固定为当前正/背面的完整人体。
- 用户仍可通过“放大病灶范围 / 查看全身”明确切换局部与完整视图。
- `min-width:680px` 且 `min-height:520px` 时恢复 P9 左右分栏：
  - 左侧人体工作区约占 5/8；
  - 右侧调整面板约占 3/8，并独立滚动；
  - 人体高度使用页面剩余空间，最大 740px。
- 宽屏选择器查询失败时，JavaScript 回退尺寸也按同一 5:3 双栏规则计算。
- 普通手机仍保持上下布局和 50vh 人体工作区。

修改文件：

- `miniprogram/packages/clinical/pages/placement/placement.ts`
- `miniprogram/packages/clinical/pages/placement/placement.wxss`
- `tests/miniprogram/placement-flow.test.cjs`
- `tests/miniprogram/fixed-body-viewport.test.cjs`
- `task.md`

## 验证

| 检查 | 结果 |
| --- | --- |
| TypeScript | PASS |
| 小程序前端测试 | 430/430 PASS |
| 完整人体初始视口 | PASS；区域提示不再自动聚焦 |
| 宽屏 800×720 回退视口 | PASS；人体工作区 470×592 |
| 项目结构、图谱与分包检查 | PASS |
| 微信 `wcc` | PASS；85,681 bytes |
| 微信 `wcsc` | PASS；4,638 bytes |
| `git diff --check` | PASS |

保守未压缩包体：

- 主包：902,656 bytes
- clinical：1,422,872 bytes
- special：756,636 bytes

## 未验证

- 本轮没有重新完成带真实 AI 草稿的微信模拟器视觉复测；当前公网测试服务此前曾返回 HTTP 429。
- Android、iOS、横屏手机、平板和实体折叠屏仍为 `NOT_RUN`。自动化与静态编译不能替代真机视觉验收。

## 回滚

只回滚放置页初始化视口、放置页宽屏媒体查询及对应两项测试。工作区包含其他未提交改动，禁止整库 reset 或 clean。
