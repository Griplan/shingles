# V6.1 来源文件与复现

这些资料用于本地来源核验。`sources.json` 逐项记录作者、来源、许可、哈希和取舍。神经边界状态为 **BLOCKED**；没有依据标志点、血管线或周围神经分布伪造 C6/C7/C8 区域。

- `gray1237.original.svg`：Rhcastilhos（据 Henry Vandyke Carter / Gray 第1237图矢量化），[原文件](https://commons.wikimedia.org/wiki/File:Gray1237.svg)，公有领域 PD-self，且有全球任何用途备用授权。选为掌面底图。
- `hand-pointing-down.original.svg`：Clker-Free-Vector-Images，Pixabay 40445，[原文件](https://commons.wikimedia.org/wiki/File:Hand_pointing_down_(contour).svg)，[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。不适合完整掌面，未投入运行。
- `hand.original.svg`：Kieff / LucasVB；历史上传 Kenny sh，[原文件](https://commons.wikimedia.org/wiki/File:Hand.svg)，选择 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)。本地 PNG 仅渲染原图，原图未改。不选用。
- `hand-parts.original.svg`：Fred the Oyster；衍生 HombreDHojalata及翻译贡献者，[原文件](https://commons.wikimedia.org/wiki/File:Hand_parts_-_en.svg)，[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)。本地 PNG 渲染原图；其为手背，不冒充掌面。
- `goran-*-hand-detail.svg/png`：Goran_tek-en，RobHurt提供信息；来源为仓库已核验的 [正面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg) / [背面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg) 原始 SVG，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。仅调整查看窗口截取手部，作为研究证据，衍生预览沿用 CC BY-SA 4.0；未用其合并区域拼造独立掌面分区。

## 复现显示资源

从项目根目录执行（使用已有 Shapely 环境和已安装 sharp，不需下载）：

```sh
ai/.venv/bin/python data/sources/palm-v1/build_resource.py
SHARP_MODULE=/path/to/installed/sharp node data/sources/palm-v1/render_resource.cjs
ai/.venv/bin/python data/sources/palm-v1/validate_resource.py
```

`SHARP_MODULE` 只是开发脚本模块寻址，不会进入运行时配置。此次使用现有 Codex node runtime 内的 sharp；无新运行时依赖。

统一画布 440×700；PNG 导出为 880×1400，具有透明背景。`path1881` 是作者原始手面外轮廓，`path5541`～`path5595` 为原始皮肤褶皱。裁切源 y=610 到腕口（不是神经边界），整体向下平移40，另一侧 x→440−x。无非均匀拉伸。保留原始 SVG，可逐项追溯。

`palm-comparison.png` 是**静态资源预览，不是微信运行截图**。

## 左右更正（2026-11-04）

原Gray1237.png图注明确为左掌，与未镜像SVG一致。五指朝上、掌心朝向观察者：左掌拇指在画面左，右掌在画面右。1.0.0的左右分配错误已在1.1.0纠正：左掌保留原轮廓，右掌由x→440−x镜像生成；图片、命中面及前后端身份同步，不复用旧版标注。神经图谱仍无边界，未提高审核状态。
