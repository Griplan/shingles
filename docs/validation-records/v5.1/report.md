# V5.1 实际验证记录

日期2026-10-27；命令均从仓库根目录运行。公开教学图片与明确标记synthetic的技术输入；没有真实用户照片上传。结果解释见[总报告](../../v5-ai-segmentation.md)。

| 命令/检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 独立环境安装固定PyPI依赖，安装固定MobileSAM源码 | PASSED；后端环境未安装AI | install.txt、install-mobilesam.txt、pip-freeze.txt |
| 首轮 `ai/.venv/bin/python -m pytest ai/tests -q` | PASSED 52项，7项上游warning | tests-first.txt |
| 补充极大数、非法图片类型、输出路径/简化参数后同命令 | **PASSED 55项**，7项上游warning | tests-final.txt |
| `ai/.venv/bin/python -m ai.experiments.prepare_inputs` | PASSED；3公开源、1派生裁片、2合成输入文件指纹（不将裁片重复算照片） | input-manifest.json |
| `ai/.venv/bin/python -m ai.experiments.run_suite --device cpu --output ai/experiments/outputs/v51-cpu-20261027` | PASSED exit0；9次真实推理，27候选/合法几何；质量并非全通过 | inference-cpu.txt |
| 同入口 `--device mps --case B_box --output ai/experiments/outputs/v51-mps-20261027` | PASSED exit0；真实MPS，3候选；第一次5.915s | inference-mps.txt |
| `ai/.venv/bin/python -m ai.cli --image ai/experiments/inputs/cdc-21505.jpg --prompts ai/experiments/example-prompts.json --output ai/experiments/outputs/v51-cli-20261027` | PASSED exit0，needs_confirmation，3候选；命令行可用 | cli.txt |
| `ai/.venv/bin/python -m ai.experiments.benchmark --device cpu` / `--device mps` | PASSED，各4次真实同图/同框推理；区分实例首次和预热，MPS有之前运行产生的系统缓存 | benchmark-cpu/mps.json及stderr.txt |
| `ai/.venv/bin/python -m ai.experiments.preview ai/experiments/outputs/v51-cpu-20261027` | PASSED；全部27候选可见，实际看图并登记失败，不只展示好结果 | 本机outputs下all-candidates.jpg及3张detail.jpg |
| 33实际Mask：Shapely.contains_xy逐像素格中心重建；alpha/尺寸/EXIF/有效性检查 | PASSED，0像素保真差异；**不是医学准确率** | real-output-validation.json |
| 同框CPU/MPS三个Mask比较 | PASSED，0差异（仅本例） | real-output-validation.json |
| `backend/.venv/bin/python -m pytest backend/tests -q` | **PASSED 47项**，1项既有Starlettewarning | backend-pytest.txt |
| `npm test --prefix miniprogram` | **PASSED 154项** | miniprogram-tests.txt |
| `npm run typecheck --prefix miniprogram` | PASSED | miniprogram-typecheck.txt |
| `backend/.venv/bin/python scripts/check_atlas.py` | PASSED | check-atlas.txt |
| `backend/.venv/bin/python scripts/check_project.py` | PASSED | check-project.txt |
| `backend/.venv/bin/python scripts/check_preview_atlas.py` | PASSED | check-preview-atlas.txt |
| 开工指纹对照，backend/miniprogram/data/scripts/tests | **180项原文件未变** | protection-check.json |
| git check-ignore四个真实环境/权重/输入/输出路径 | PASSED，全部忽略 | protection-check.json |

首轮及后续均使用实际预训练权重，没有替身推理冒充。7个AI warning来自官方TinyViT旧timm导入及重复模型注册；未隐藏或当失败，不修改官方源码。模型选择显式vit_t，权重strict匹配。

## 实际失败与限制

- 下载/环境探测失败按[download-attempts.txt](download-attempts.txt)记录；模型最终下载成功，完整原始下载状态在model-download*.json。
- 上述“技术PASSED”不能覆盖医学质量失败：A只选小亮点、C/E高分整图、D网格碎片、F边界框偏置均真实保留。
- 3张公开源中两张同病例，未达到15～30独立样本；无医学专家Mask、无临床正常皮肤对照。真实皮疹Dice/IoU、用户修正时长/轮次、专家确认 **NOT_RUN**。
- 物理内存耗尽、所有格式/巨图的真实性能上限、GPU利用率、不同设备/系统、CUDA、SAM2 **NOT_RUN**。OOM处理为受控错误路径测试，不宣称真实OOM压测。
- 小程序页面完全未改；本轮微信GUI/真机/V5上传接口 **NOT_RUN/未实现**。旧版V4未完成的多屏验收不因此变成通过。
- 输出有孔及复杂顶点，尚不能直接输入V2/V4；V5.3之前禁止混合坐标空间。
- 磁盘收尾仍约15GiB空余；AI环境552MiB，模型目录约62MiB（含本轮失败的部分下载）；模型本身38.84MiB。

没有Git提交、推送、替换模型人体素材或更改正式医审状态。V5.2之后停留设计，等用户审查真实分割效果。
