# 本地候选分割模块（V5.1）

当前实现独立的 MobileSAM 提示分割、Mask/多片含孔轮廓、预览导出和错误处理。只在照片坐标中工作，输出必须由用户确认。没有小程序入口、照片上传 API、人体配准或医学诊断功能。唯一进度台账为 [task.md](../task.md)，历史占位说明原文保留在 [README-v0.md](README-v0.md)。

## 独立环境与模型

在仓库根目录执行（Python 3.11+，本轮实测 3.12）：

```sh
python3.12 -m venv ai/.venv
ai/.venv/bin/python -m pip install -r ai/requirements.txt
ai/.venv/bin/python -m ai.experiments.download_model
ai/.venv/bin/python -m pip install --no-deps --no-build-isolation ./ai/models/MobileSAM-source
```

官方代码固定为 `f706ad9c4eb7f219c00d9050e46328518ffb65d2`；安装用 PyPI，模型只从官方 GitHub 固定提交取得，逐文件检查 Git blob。权重 40,728,226 字节；加载时再次核验、`weights_only=True`、严格 state dict；没有自动联网下载或假推理回退。权重、源码缓存、环境、输入图和输出图均被 Git 忽略。源许可和署名见[模型与样本报告](../docs/v5-ai-segmentation.md)。

## 独立演示

先查看方向处理后的照片：`ai.preprocessing.image.prepare_image(path)` 返回 RGB 数组及方向信息，用 Pillow `Image.fromarray(prepared.rgb).save(...)` 导出无 EXIF 预览。提示点必须在该方向下给出，不能沿用未旋转 JPEG 的旧点。

保存提示为 JSON，例如：

```json
{"coordinate_space":"photo_oriented_pixels_v1","points":[[430,328,1],[500,350,0]],"box":[215,245,495,385]}
```

点为 `[x,y,label]`，1 前景/0 背景；框为 `[x0,y0,x1,y1]`，点与框均可选，但至少有前景点或有效框。点用原图像素（`0 <= x < width`），框可到外缘 width/height，不能把人体归一化点传入。

```sh
ai/.venv/bin/python -m ai.cli --image ai/experiments/inputs/cdc-21505.jpg --prompts /tmp/prompts.json --output ai/experiments/outputs/my-new-run --device cpu
ai/.venv/bin/python -m pytest ai/tests -q
```

输出目录必须新建或为空，不覆盖历史。每次输出 `original.png`、`prompts.png`、每个候选的 `mask.png`、透明 `alpha.png`、叠加 `overlay.png`、轮廓 `polygons.png` 和 `result.json`。绿线外环/橙线孔洞，输出和原图同尺寸。三个候选是互斥的方案选择，不能简单合并；分数是模型内部预计 Mask IoU，绝非诊断置信度。CLI 0 表示产生待确认候选，3 表示空结果或轮廓失败，2 表示输入/模型/输出失败。失败写 `failure.json`，不打印图片或完整提示载荷。

Python 入口：

```python
from ai.inference.mobile_sam import MobileSAM
from ai.segmentation import segment_image
from ai.export import export_result
model = MobileSAM("ai/models/MobileSAM-source/weights/mobile_sam.pt", device="cpu")
result = segment_image(image_path, prompts, model=model)
export_result(result, new_output_directory)
```

同一模型实例只用于顺序调用（官方 Predictor 有可变图像状态）；每次结束清理图像特征。本轮每次重新编码图片，尚无交互缓存/HTTP 并发服务。

## 坐标与轮廓

`photo_oriented_normalized_v1`：EXIF 校正后原图左上角为原点，像素格边界 x/width、y/height；外环闭合、孔洞独立，始终输出 GeoJSON 形状的 `MultiPolygon`（它不是地理坐标）。保留所有连通片和单像素，不填洞、不取凸包、不自动裁到人体。默认 simplify=0；即使请求较大简化，不能保持完全相同几何时回退原轮廓并记录。100,000 行区段上限超出明确失败且保留 Mask。

照片与人体坐标不通用；JSON 不含 templateId/view/神经标签。后续 V5.3 才能定义人工平移、等比缩放、旋转和模板绑定。V2 单外环/128点限制目前不能直接承接复杂轮廓，后续不能以填洞、丢片或有损压缩偷偷绕过。

## 输入、隐私与复现

支持单帧 JPEG/PNG/WebP，最大20MiB、12百万像素、单边8192、最小8×8；透明输入在白底合成并用于相同预览。方向校正后保存尺寸/EXIF方向处理说明，输出不继承身份/GPS/原文件名。输入许可与去标识化仍由调用者负责，程序不能自动证明照片无身份信息。

实验输入来自 [sources.json](experiments/sources.json)。下载其列明的三个公开图片到忽略目录后：

```sh
ai/.venv/bin/python -m ai.experiments.prepare_inputs
ai/.venv/bin/python -m ai.experiments.run_suite --device cpu --output ai/experiments/outputs/another-new-run
```

3张公开照片（其中2张同病例）与2张合成图不是临床数据集；无专家参考 Mask，不计算医学 Dice/IoU。实验耗时和定性失败见[报告](../docs/v5-ai-segmentation.md)。测试替身只用于错误/契约单测，真实推理证据与之分开。

照片/Mask不入Git，不发第三方AI，不读取正式图谱。实验仅保留本机直到用户审查，可按输出目录删除；未来上传服务必须另做权限、保留期和删除流程。后端可完全不安装本目录依赖，V1～V4照常使用。

## V5.2 本地小程序服务（2026-10-27追加）

沿用以上固定模型、权重、推理与轮廓逻辑。V5.2只是可选HTTP适配器和独立照片页面，不建立第二套分割网络。服务进程首次推理加载一次模型；单工作槽顺序使用 Predictor，重复提示重新编码照片，不缓存图像特征。单进程运行，第二进程争用同一临时根目录会关闭AI服务，不影响人工核心。

在仓库根目录、已有 `ai/.venv` 中安装可选后端服务依赖：

```sh
ai/.venv/bin/python -m pip install -e 'backend[dev,ai-service]'
./启动AI后端.command
```

新增依赖仅 `python-multipart>=0.0.20,<0.1`，来自PyPI；实际版本0.0.32。后端原声明的FastAPI等安装在AI环境，不改 `backend/.venv`。实际完整版本见[环境记录](../docs/validation-records/v5.2/ai-environment.txt)。当前使用Python3.12.14、Torch2.5.1、FastAPI0.162.0、Starlette1.10.0、Uvicorn0.54.0。`pip check`通过。没有重新下载权重。

默认CPU4线程；服务支持 `AI_DEVICE=auto` 选择可用CUDA/MPS/CPU，也可显式cpu/mps/cuda（指定设备不可用明确失败）。本轮HTTP与微信实测用CPU，V5.2服务MPS未实测。`AI_CHECKPOINT`可覆盖权重路径，默认从仓库定位；`AI_TEMP_ROOT`默认仓库 `private-data`，下建专用 `v5-ai-sessions`。不要将其指向公共静态目录或使用多个worker。

`segment_image`新增接收已验证 `PreparedImage`，避免合法压缩输入在方向修正为较大PNG后被上传体积上限重复拒绝；检查RGB类型、尺寸及元信息。原CLI路径、像素坐标、模型和多边形算法不变。

验证入口（不上传到第三方）：

```sh
ai/.venv/bin/python -m pytest ai/tests -q
ai/.venv/bin/python -m pytest backend/tests -q
npm test --prefix miniprogram
ai/.venv/bin/python scripts/verify_v52_http.py --help
```

真实HTTP脚本仅访问回环服务、使用已有公开CDC21505图片。输出目录必须不存在，参数见帮助；不覆盖历史。生产或非开发工具上传被禁用。照片、Mask、确认结果在会话内临时保留，退出/取消删除，不能作为病例持久化功能。[接口及安全边界](../docs/api.md) · [实际验证记录](../docs/validation-records/v5.2/report.md)。

### MobileSAM过度分割专项（2026-11-01）

复用既有权重/模型缓存。`segment_image(..., strategy="context_crop")` 支持主box与最多3个additional_boxes，按整数偏移回填原照片Mask；默认独立CLI接口仍full_image。无框的点提示明确退回整图。质量诊断只影响预览顺序/警告，不删除候选或自动确认。`postprocessing/brush.py`从不可变原Mask重放照片空间笔画，使用既有无损轮廓模块；小程序通过可选开发服务`/edit`调用，无第二套模型。

```sh
# 使用新的空输出路径，保护既有失败与对照记录
ai/.venv/bin/python -m ai.experiments.oversegmentation --output ai/experiments/outputs/your-new-comparison
ai/.venv/bin/python -m pytest ai/tests -q
# 仅导出像素SHA确实匹配公开CDC21505的单一已修正会话；不处理患者图片
ai/.venv/bin/python -m ai.experiments.export_public_correction --output ai/experiments/outputs/your-new-public-correction
```

本轮全部实际运行、逐样本效果/失败、Mask与Polygon保真、许可证和后续微调数据方案见[专项报告](../docs/validation-records/v5-oversegmentation/report.md)。裁剪未解决所有误选，暂无专家真值或临床准确率。原始输入/权重/批量实验结果继续忽略Git；报告预览只使用已有明确许可的公开测试源。
