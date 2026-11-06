# V6.5 源路径核查

日期：2026-11-05。[Goran 正面原始 SVG](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg)、[Goran 背面原始 SVG](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg)。作者 Goran_tek-en，2022-09-24，CC BY-SA 4.0。页面许可本轮重新查看，未再次下载或替换源文件。

核对不是只看 path 数组序号：生成器校验原 SVG SHA1，再由元素层级 route 定位实际元素，核对 `d` 的 SHA256、标签来源记录、颜色、累计 transform 和实际绘制顺序。原图无 clipPath/mask/use。所有元素坐标先累计变换，再按原图绘制先后扣除被后方元素遮挡的区域。保留原始复合标签和分离片区。源标签引线证据仍在 V6.3 审计目录；本轮四张三联对照的左栏使用真实完整源 SVG 局部。

- 正面 SHA1：`d20be473843591779be22c102e193d8c1407861d`。
- 背面 SHA1：`261566ce5128fdc2cc536945c148ac1c8f62e66d`。
- 正面 p29/30：C6–8；p31：C8/T1。p28 C5、p32 C8/T1 仅补实际腕部过渡。
- 背面 p28/29/30/31：C6–8（实际指背）；p39/42：C8/T1；p47/48：C6–8 手背/腕部；p20 C7、p41 T1/T2 仅补源图实际腕部过渡。
- 不能由这些组合区推导独立完整的 C6、C7、C8 掌侧分界。未使用 Servier 或外周神经区域填补 Goran。

| 目标表面 | 源 path | 实际元素 route | 源标签 | d SHA256 前缀 | 源片区→目标片区 |
|---|---:|---|---|---|---|
| front-left | p32 | `root/6/1/27` | C8/T1 | `360dbb2ad68b3078` | 1→1 |
| front-left | p31 | `root/6/1/26` | C8/T1 | `83dde80b4e1c5cab` | 1→1 |
| front-left | p30 | `root/6/1/25` | C6-C8 | `d8590d614e5200e8` | 1→1 |
| front-left | p29 | `root/6/1/24` | C6-C8 | `705bdc85ce42aac9` | 1→1 |
| front-left | p28 | `root/6/1/23` | C5 | `69c9d8ec07625e50` | 1→2 |
| front-right | p32 | `root/6/1/27` | C8/T1 | `360dbb2ad68b3078` | 1→1 |
| front-right | p31 | `root/6/1/26` | C8/T1 | `83dde80b4e1c5cab` | 1→1 |
| front-right | p30 | `root/6/1/25` | C6-C8 | `d8590d614e5200e8` | 1→1 |
| front-right | p29 | `root/6/1/24` | C6-C8 | `705bdc85ce42aac9` | 2→2 |
| front-right | p28 | `root/6/1/23` | C5 | `69c9d8ec07625e50` | 1→2 |
| back-left | p47 | `root/9/1/47` | C6-C8 | `94aff42f986acf2f` | 1→1 |
| back-left | p41 | `root/9/1/41` | T1/T2 | `e1fd74cb65e4872f` | 1→1 |
| back-left | p39 | `root/9/1/39` | C8/T1 | `ac9ec31159d59ba4` | 2→2 |
| back-left | p29 | `root/9/1/29` | C6-C8 | `7e687d3ab2a5a5b6` | 1→1 |
| back-left | p28 | `root/9/1/28` | C6-C8 | `3121a3c7f2720ceb` | 3→3 |
| back-left | p20 | `root/9/1/20` | C7 | `812e974ba68a2913` | 1→1 |
| back-right | p48 | `root/9/1/48` | C6-C8 | `5dc672539f8160e2` | 1→1 |
| back-right | p42 | `root/9/1/42` | C8/T1 | `6c1dfb292fcd8c8e` | 1→1 |
| back-right | p41 | `root/9/1/41` | T1/T2 | `e1fd74cb65e4872f` | 1→1 |
| back-right | p31 | `root/9/1/31` | C6-C8 | `66ed748ad6d2778b` | 1→1 |
| back-right | p30 | `root/9/1/30` | C6-C8 | `246618f6a9822e7f` | 3→3 |
| back-right | p20 | `root/9/1/20` | C7 | `812e974ba68a2913` | 1→1 |

完整摘要、源元素路径、目标几何及采样参数见 `data/atlas/goran-2022-preview-v3/hand-registration.json` 与各 region 的 source* 字段。源图中 path 不具有可靠独立 id 的情况下，sourceElementId 使用实际元素 route，另带 d 摘要，不伪造源 id。

衍生图谱数据保持 CC BY-SA 4.0，署名并说明修改；人体图片仍为原 CC0 素材。许可可见 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。不能以许可核验代替医学审核。
