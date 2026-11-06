# V6.5 本轮验证记录

日期2026-11-05；macOS15.6.1 arm64，Python3.12.14，Shapely2.1.2，Node24。输入：本地合法源图、固定人工参考点、明确标记工程用合成标注；没有患者图片。

| 实际执行命令 | 结果 | 证据 |
|---|---|---|
| `npm --prefix miniprogram test` | PASSED 335/335 | evidence/frontend-final2.log |
| `PYTHONPATH=backend ai/.venv/bin/python -m pytest backend/tests ai/tests -q` | PASSED 280；7条既有MobileSAM registry警告 | evidence/backend-ai-final.log |
| `npm --prefix miniprogram run typecheck` | PASSED | evidence/typecheck-final.log |
| `ai/.venv/bin/python -m pytest scripts/test_atlas_geometry.py scripts/test_atlas_extensions.py -q` | PASSED 11 | evidence/source-parser-tests.log |
| `ai/.venv/bin/python scripts/prepare_hand_atlas.py` | PASSED 11产物，22源路径实例可复现 | evidence/reproducibility.log |
| `ai/.venv/bin/python scripts/sync_atlas.py --check` | PASSED | 同上 |
| `ai/.venv/bin/python scripts/sync_matching_body.py --check` | PASSED | 同上 |
| `ai/.venv/bin/python scripts/build_sole_atlas.py` | PASSED 只读复现 | 同上 |
| `ai/.venv/bin/python scripts/check_preview_atlas.py` | PASSED 136区；49229顶点、17孔洞 | evidence/atlas-check-final.log |
| `ai/.venv/bin/python scripts/check_project.py` | PASSED 静态九页/组件/路由 | evidence/project-check.log |
| `PYTHONPATH=backend ai/.venv/bin/python scripts/benchmark_main_hands.py` | PASSED 非手部结果等价和真实4手跨区样例 | evidence/performance.json、hand-matching-examples.json |
| `node scripts/benchmark_hand_canvas.cjs` | Node模拟绘制调用性能；不是原生Canvas计时 | evidence/canvas-performance.json |

46个固定参考位置包括四手掌/背中心、尺侧、拇/食/中/环/小指、指尖、掌根、虎口与指缝；36个源图明确参考区、8个空气点、2个源组合边界细缝。初版13失败、第二版3失败均保留。原因包括：空气点落在黑色粗描边/相邻皮肤、环指位于源细缝、掌根组合标签读错，以及错误预期接口错误码。通过放大原SVG与网格图核对后修正fixture；没有用命中函数生成期望标签。两个细缝点保留为B类部分覆盖，未把缺口填平。`reference-points-initial/second.json`及`*-reference-review.png`记录纠正过程。

几何checker最初对2个极小有效环使用未居中鞋带公式发生浮点抵消，改为先平移到首点再求和；原几何不改。第一次新前端测试发现已退役空目录仍存在，删除空目录后通过。所有失败日志保留。

新增后台56项手部测试覆盖人工参考点、左右/视图、父版数据逐项等价、身体轮廓只改指缝、多片/孔洞、未配置区、退役410、旧版本409、源路径复现。前端新增4组测试覆盖46点、320/375/430尺寸、局部/全身/复位、真实路径全部/单区绘制及状态恢复、旧路由/资源移除。原AI上传/修正/确认/放置/匹配、多片、结果失效、全身与脚底用例继续执行。AI回归属于自动测试；本轮未再运行实际MobileSAM照片推理，模型和AI代码未改。

## 同环境性能

20轮交替、相同10个非手部标注与两面汇总：匹配结果的标签、左右、顺序、面积、覆盖数值完全相同。新图谱的身份/来源描述和候选中的区域实例ID列表当然不同，未将这些字段称为字节等价。

| 测量项 | 父版中位 ms | 新版中位 ms |
|---|---:|---:|
| JSON+几何构造（两者均不含来源哈希） | 18.392 | 31.653 |
| 10片/两视图几何匹配 | 62.182 | 113.825 |

当前正式数据加载器（含版本、哈希、有效性验证）中位 51.770 ms。完整曲线新增使几何处理增加，不能宣称无退化。每请求每视图一次并集、身体索引和Canvas投影WeakMap复用均保留，源码哈希核对未改。未为提速丢掉小片、孔洞或简化医学边界。

## 微信状态

2026-11-05：工具发现Shingles窗口；尝试编译返回“19 is an invalid element ID”，随后截图为窗口切换动画，而可访问树仍是旧页面/旧palm文件列表。无法可靠确认新构建运行。

微信本轮编译、手部点选绘制、前后切换、全部/单标签、脚底实际导航、真机帧时延及内存峰值：**NOT_RUN**。静态SVG/PNG明确带OFFLINE标记，不是微信截图。未上传体验版、未部署腾讯云、未改原服务、未提交或推送Git。

待人工/后续真实工具验证：用新版后端与新版小程序共同编译，正面左右手与背面左右手分别圈选计算；复核指缝不会闭合穿过；选单区后病灶轮廓保留；返回全部；脚底左右独立标注；不同屏幕观察标签遮挡。原服务器仍为旧数据时应409，不应回退旧图谱掩盖差异。

## 补充性能与退役清理复测

Node（v24.11.1，Apple M4）仅测46点命中和模拟Canvas方法分派，10轮预热后50轮交替：

| 项目 | 父版中位ms | 新版中位ms |
|---|---:|---:|
| 46点/P6索引复用 | 0.044292 | 0.088188 |
| 正背两层/投影缓存方法分派 | 0.090001 | 0.126791 |

这不是原生Canvas绘制时长，也不包含GPU栅格化、微信逻辑线程通信或真实手机点击，不能转换成FPS。局部共享加载器错误文字清理后，`backend/tests/test_sole_matching.py`再次执行27通过（evidence/sole-post-cleanup.log）。最终覆盖说明元数据纠错后，单独复查新版本与接口绑定，见evidence/post-metadata-check.log，不重复累加进280的完整套件计数。
