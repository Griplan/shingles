# 图表索引与复现

本次按真实源码整理9张可编辑图：图1～6为核心方法，图10～12补充人工流程、页面与API。图7～9为AI章引用的既有合法公开照片实验对照，未冒充本次新实验。

| 编号 | 内容 | 编辑源 | PNG | SVG |
|---|---|---|---|---|
| 图1 | 系统总体架构 | [system-architecture.mmd](system-architecture.mmd)／[Markdown](system-architecture.md) | [PNG](system-architecture.png) | [SVG](system-architecture.svg) |
| 图2 | 完整业务流程 | [complete-workflow.mmd](complete-workflow.mmd)／[Markdown](complete-workflow.md) | [PNG](complete-workflow.png) | [SVG](complete-workflow.svg) |
| 图3 | MobileSAM 分割与人工确认 | [ai-segmentation-pipeline.mmd](ai-segmentation-pipeline.mmd)／[Markdown](ai-segmentation-pipeline.md) | [PNG](ai-segmentation-pipeline.png) | [SVG](ai-segmentation-pipeline.svg) |
| 图4 | 照片到人体及显示坐标 | [coordinate-transform.mmd](coordinate-transform.mmd)／[Markdown](coordinate-transform.md) | [PNG](coordinate-transform.png) | [SVG](coordinate-transform.svg) |
| 图5 | 参考图谱几何匹配 | [dermatome-matching.mmd](dermatome-matching.mmd)／[Markdown](dermatome-matching.md) | [PNG](dermatome-matching.png) | [SVG](dermatome-matching.svg) |
| 图6 | 图谱数字化与模板配准 | [atlas-registration.mmd](atlas-registration.mmd)／[Markdown](atlas-registration.md) | [PNG](atlas-registration.png) | [SVG](atlas-registration.svg) |
| 图10 | 人工标注数据流程 | [manual-workflow.mmd](manual-workflow.mmd)／[Markdown](manual-workflow.md) | [PNG](manual-workflow.png) | [SVG](manual-workflow.svg) |
| 图11 | 关键页面与状态模块 | [page-modules.mmd](page-modules.mmd)／[Markdown](page-modules.md) | [PNG](page-modules.png) | [SVG](page-modules.svg) |
| 图12 | AI 确认、放置和计算接口时序 | [api-sequence.mmd](api-sequence.mmd)／[Markdown](api-sequence.md) | [PNG](api-sequence.png) | [SVG](api-sequence.svg) |

## 生成与阅读

使用隔离临时安装的 @mermaid-js/mermaid-cli **12.2.0**，本机Chrome，以PingFang SC字体导出；没有更改项目依赖。每图保留独立Markdown代码块和.mmd。PNG用于直接查看，SVG适合论文排版与编辑。各图含中文，其他设备重渲染需安装可用中文字体或替换mermaid-config.json中的fontFamily。

命令模板（本次按文件逐项实际执行）：

```bash
mmdc -p /path/to/local-puppeteer.json -c mermaid-config.json   -i system-architecture.mmd -o system-architecture.png   -b white --size 1800 -s 2
```

输出SVG时将扩展名改为.svg。Puppeteer配置仅指定本机Chrome executablePath；不用生产凭据。初次尝试旧版-w参数失败，改用当前CLI的--size；受限环境首次浏览器启动失败后，获准使用本机浏览器完成导出。首轮文字换行过密，第二轮增加wrappingWidth后重绘。最终18项渲染的退出状态见[render-log.json](render-log.json)，视觉检查见[visual-review.md](visual-review.md)。

图的箭头表示调用／数据流，不等于每个方框是独立服务。AI原始Mask→人工确认→人体位置确认→几何匹配顺序不可省略。图库医学审核状态仍为pending。当前HTTP测试通道不是正式HTTPS患者服务。图表不包含数据库、自动诊断或自动照片人体配准等未实现能力。
