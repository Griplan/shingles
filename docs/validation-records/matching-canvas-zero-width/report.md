# 匹配结果页人体画布零宽修复

日期：2026-11-17

## 问题

完成人体放置或手动标注并开始神经区域匹配后，结果页出现：

> 画布显示失败，请点画布内的重试。结果尚未完整显示。

微信开发者工具控制台给出的实际错误为：

```text
[body-canvas] waiting for layout {width:0, height:594, retry:10}
[body-canvas] render failed: layout-width-or-height-unavailable
```

后端匹配请求、图谱数据和 Canvas 节点均已正常返回。故障位于结果页布局：人体 Canvas 组件的高度有效，但宽度被 Flex 布局计算为零，因此组件无法完成第一帧绘制。

## 根因

结果页同时承担手机单栏和宽屏双栏布局，原样式存在两处宽度塌缩：

1. `.canvas-area` 同时使用 `flex: 1 1 auto` 和 `width: 0`，在父项没有可分配宽度时保持零宽。
2. 宽屏媒体查询下 `.result-stage` 仍继承手机布局的 `flex: 0 0 auto`，同时把宽度改为 `auto`，使整个结果舞台依赖零宽 Canvas 的内在宽度。

这不是匹配请求失败，也不是人体 PNG 或神经图谱缺失。

## 修复

- `.canvas-area` 改为 `flex: 1 1 0`、`width: auto` 和 `min-width: 0`，明确占满结果舞台扣除侧边标签后的空间。
- Canvas 宿主显式设置为父容器的 `100% × 100%`。
- 手机布局继续使用单栏固定工作区。
- 宽屏布局将 `.result-stage` 恢复为可伸缩的横向 Flex 子项：`flex: 5 1 0`、`width: 0`、`min-width: 0`，与右侧滚动面板共同分配宽度。
- 保留 Canvas 失败自动重试一次、迟到场景过滤和用户手动重试路径。

修改文件：

- `miniprogram/packages/clinical/pages/annotate/annotate.wxss`
- `miniprogram/packages/clinical/pages/annotate/annotate.ts`
- `tests/miniprogram/matching-presentation.test.cjs`
- `tests/miniprogram/v7.1-ui-simplification.test.cjs`

## 实际微信验证

在微信开发者工具 `HUAWEI Mate X6内 100%` 预设中重新编译并实际完成以下流程：

1. 从完整人体进入手动标注。
2. 在人体有效轮廓内取点并闭合。
3. 完成标注并自动执行图谱匹配。
4. 结果页实际测得 Canvas `425 × 594`。
5. 页面显示人体底图、棕色病灶轮廓和 7 个彩色参考区域。
6. 点击 `T7 · 左侧` 后进入单区高亮。
7. 点击“查看全部”后恢复全部 7 个参考区域。
8. 每次重绘均继续收到非零尺寸的 `viewport-ready`，未再出现零宽错误或结果页错误文案。

证据：

- [全部参考区域](evidence/wechat-all-regions.png)
- [单区参考区域](evidence/wechat-single-region.png)
- [初始匹配结果](evidence/wechat-matching-result.png)

这说明手动标注与结果页共用路径上的画布塌缩问题已被修复。AI 放置确认后进入的也是同一结果页组件、同一 Canvas 和同一布局约束；本轮没有修改 AI 几何、人体模板、图谱或匹配公式。

## 自动化验证

| 检查 | 结果 |
| --- | --- |
| TypeScript | PASS |
| 小程序前端测试 | 431/431 PASS |
| 微信 WXML 编译 `wcc` | PASS |
| 微信 WXSS 编译 `wcsc` | PASS |
| 项目结构检查 | PASS |
| 图谱一致性检查 | PASS |
| 分包引用与体积检查 | PASS |
| `git diff --check` | PASS |

保守未压缩分包体积：

| 包 | bytes | MiB |
| --- | ---: | ---: |
| main | 902,748 | 0.861 |
| clinical | 1,424,938 | 1.359 |
| special | 756,636 | 0.722 |

## 尚未覆盖

- Android 和 iOS 真机仍需在更新体验版后验证实际匹配结果高亮。
- 实体折叠屏、横屏平板和低端机的原生布局刷新仍需人工确认。
- 微信开发者工具已实际完成手动标注匹配、单区切换和全部高亮；本轮没有重新上传照片走完 MobileSAM 全链路，但 AI 放置与手动流程最终使用相同结果页 Canvas。

## 回滚

只回滚本报告的样式修复、结果页 Canvas 恢复逻辑和对应测试。工作区包含其他未提交改动，禁止执行整库 `reset` 或 `clean`。
