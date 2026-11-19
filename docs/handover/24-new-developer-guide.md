# 24 新开发者指南

> 文档基线：2026-11-19。预计完成本指南中的 30 分钟阅读、首日运行和第一周练习后，能够安全定位并完成一个受控的小修改。

## 24.1 30 分钟理解系统

按这个顺序阅读：

1. [项目总览](01-project-overview.md)；
2. [系统架构](05-system-architecture.md)；
3. [小程序架构](07-miniprogram-architecture.md)；
4. [AI 分割](09-ai-segmentation.md)；
5. [人体放置流程](12-body-placement-workflow.md)；
6. [多边形与几何](11-polygon-and-geometry.md)；
7. [当前完成度](03-current-progress.md)；
8. [已知问题](21-known-issues-and-technical-debt.md)。

30 分钟后应能回答：

- 哪些数据在照片坐标？
- 哪些数据在人体模板坐标？
- MobileSAM 输出什么，不输出什么？
- 谁负责匹配，谁负责显示？
- 为什么当前工作区不等于线上？
- 为什么模拟图谱不能当医学诊断？

## 24.2 开工前安全检查

```bash
cd /Users/griplan/project/extra/Shingles‌/dermatome-mapper
git status --short
git log -5 --oneline --decorate
```

如果工作区不干净：

- 不执行 `git reset --hard`；
- 不执行 `git clean -fd`；
- 不执行 `git checkout -- .`；
- 先确认文件属于哪个任务；
- 只编辑当前授权范围。

不要读取或复制 `private-data/` 的 secret 内容到聊天、文档或日志。

## 24.3 本地环境

### 小程序

```bash
cd miniprogram
npm ci
npm run typecheck
npm test
```

微信开发者工具导入目录：

```text
dermatome-mapper/miniprogram
```

### 后端

优先使用已有 venv：

```bash
backend/.venv/bin/python --version
ai/.venv/bin/python --version
```

需要创建时：

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
```

AI 运行时固定环境：

```bash
ai/.venv/bin/python -m pip install -r ai/requirements.txt
```

MobileSAM 源码和权重需要按 `ai/README.md` 与当前验证记录获取。权重不提交 Git，也不在请求中自动下载。

### 启动核心后端

```bash
DERMATOME_ENV=test \
ENABLE_REFERENCE_MATCHING=1 \
PYTHONPATH=backend \
backend/.venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 --port 8000
```

### 启动带 AI 后端

```bash
DERMATOME_ENV=test \
ENABLE_REFERENCE_MATCHING=1 \
ENABLE_AI_SEGMENTATION=1 \
PYTHONPATH=backend \
ai/.venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 --port 8000
```

确认：

```bash
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/ready
```

如果小程序在开发工具中访问本机地址失败，先检查 envVersion、baseURL、Bearer、`urlCheck` 和工具网络设置。不要把手机 `127.0.0.1` 当后端。

## 24.4 代码地图

### 首页与人体

- 起始页：`miniprogram/pages/select/`
- 人体组件：`miniprogram/components/body-canvas/`
- 页面状态：`miniprogram/state/annotation-session.ts`
- 公共类型：`miniprogram/types/dermatome.ts`
- Canvas 尺寸：`miniprogram/utils/canvas-size.ts`

### 人工标注与结果

- `miniprogram/packages/clinical/pages/annotate/`
- `miniprogram/packages/clinical/pages/result/`
- `miniprogram/packages/clinical/state/matching-session.ts`

### AI 分割

- 页面：`miniprogram/packages/clinical/pages/ai-annotate/`
- 照片准备：`miniprogram/packages/clinical/utils/prepare-photo.ts`
- 照片 Canvas：`miniprogram/packages/clinical/components/photo-canvas/`
- AI 会话：`miniprogram/packages/clinical/state/ai-session.ts`
- 服务端路由：`backend/app/api/routes/ai.py`
- 会话服务：`backend/app/services/ai_sessions.py`
- 图像输入：`backend/app/services/ai_image_input.py`
- MobileSAM：`ai/inference/`

### 放置

- `miniprogram/packages/clinical/pages/placement/`
- `miniprogram/packages/clinical/components/placement-overlay/`
- `miniprogram/packages/clinical/state/placement-session.ts`
- `miniprogram/utils/placement-geometry.ts`
- `backend/app/services/body_intersection.py`

### 特殊部位

- `miniprogram/packages/special/pages/special-parts/`
- `miniprogram/packages/special/pages/local-surface/`
- `miniprogram/packages/special/components/local-surface-canvas/`
- `miniprogram/packages/special/data/`

### 图谱与匹配

- 后端路由：`backend/app/api/routes/`
- 图谱加载：`backend/app/services/atlas_service.py`
- 匹配服务：`backend/app/services/`
- 图谱数据：`data/atlas/`
- 小程序图谱编码：`miniprogram/packages/clinical/data/atlas-codec.ts`
- 生成脚本：`scripts/sync_atlas.py`

## 24.5 第一天练习

### 练习 1：手工标注

1. 启动本机后端；
2. 打开微信开发者工具；
3. 首页进入完整人体；
4. 正面点三到五个有效皮肤点；
5. 闭合；
6. 完成标注；
7. 确认自动进入匹配结果；
8. 查看一个和多个标签、单区高亮、查看全部；
9. 返回修改并二次匹配。

观察：

- 页面传的是归一化 body geometry 还是屏幕像素；
- 请求 identity；
- 结果页 view 和 atlas；
- 修改后旧结果如何失效。

### 练习 2：AI 分割

只用公开、授权或合成照片：

1. 进入 AI 辅助标注；
2. 上传；
3. 框选；
4. 等待真实候选；
5. 查看候选和异常提示；
6. 确认；
7. 进入放置；
8. 拖动、缩放、旋转；
9. 确认位置；
10. 自动匹配；
11. 核对照片会话是否删除。

观察：

- 框选坐标；
- `photo_oriented_normalized_v1`；
- 处理图宽高；
- Mask 与显示矩形；
- MultiPolygon/孔洞；
- 放置 transform；
- 本地几何与后端删除解耦。

## 24.6 第 2～3 天

### 坐标系统

建立以下对照：

| 空间 | 原点 | 用途 | 不能拿它做什么 |
| --- | --- | --- | --- |
| 屏幕像素 | Canvas 左上 | 触摸、绘制 | 存业务几何 |
| 照片归一化 | 处理图左上 | 提示、Mask、Polygon | 直接做人体匹配 |
| 人体模板归一化 | 正/背面或特殊模板左上 | 保存、匹配 | 跨模板复用 |
| Canvas backing store | 物理像素 | 高 DPI 绘制 | 对外 API |

### 图谱

检查一个 manifest：

- template；
- geometry；
- region set；
- atlas；
- SHA；
- source；
- license；
- review status；
- mapping enabled。

理解 `SCHEMATIC` 与有来源参考图谱的区别。

### 会话

区分：

- V2 annotation session；
- AI 临时 session；
- placement draft；
- matching result；
- 页面 runtime viewport。

理解照片删除后为什么放置与匹配仍能继续。

## 24.7 第一周

### 完成一个安全的小修改

适合的第一个任务：

- 错误文案；
- 可访问标签；
- 页面空状态；
- 小范围样式；
- 一个明确且有回归覆盖的坐标或状态 bug。

不建议第一个任务就做：

- 更换图谱；
- 修改匹配公式；
- 改 MobileSAM；
- 引入数据库；
- 重写 Canvas；
- 大规模分包重构。

### 修改前

1. 写清现象、复现和验收；
2. 找到真实代码路径；
3. 确认坐标空间；
4. 检查数据结构版本；
5. 检查历史和现有测试；
6. 说明会影响前端、后端、图谱还是部署。

### 修改后

至少执行与范围对应的检查：

```bash
npm --prefix miniprogram run typecheck
npm --prefix miniprogram test
python3 scripts/check_project.py
python3 scripts/sync_atlas.py --check
python3 scripts/check_miniprogram_packages.py
git diff --check
```

界面改动再执行 WXML/WXSS 编译；实际交互改动在微信开发者工具复走；真机改动必须真机验收。

## 24.8 修改决策表

| 修改 | 必须同步检查 |
| --- | --- |
| API 字段 | Pydantic、TS 类型、`docs/api.md`、测试、旧数据兼容 |
| 人体模板 | 新版本，不原地改；geometry/region/atlas 绑定 |
| 图谱边界 | 来源、许可、审核状态、manifest SHA、生成与回归 |
| AI 模型 | 来源、许可、权重 SHA、内存、冷热启动、回滚 |
| 上传限制 | 前端预处理、FastAPI、Nginx、OOM、隐私 |
| 匹配公式 | 医学/几何影响、后端测试、结果契约、历史版本 |
| 特殊部位 | viewId、模板、左右、会话隔离、模拟状态 |
| 分包 | 主包/分包引用、路由、静态路径、2 MB 上限 |
| 部署 | manifest、备份、health/ready、原针灸回归、回滚 |

## 24.9 常见错误认识

- “CI 通过就说明手机可用”：错误；需要微信编译和真机。
- “上传体验版就完成体验版更新”：错误；还需在公众平台设为体验版。
- “覆盖率 100% 是医学准确率”：错误；只是模拟分区覆盖面积。
- “MobileSAM 输出就是最终病灶”：错误；需人工确认。
- “在正面画好就能翻转到背面”：错误；正背面是独立坐标。
- “删除照片会删除人体草稿”：错误；确认放置后草稿是独立几何。
- “服务器返回健康就证明图谱正确”：错误；还需 identity 和真实几何 smoke。

## 24.10 接手前共同确认清单

项目负责人和新开发者应共同确认：

- 仓库写权限、分支和提交规则；
- 微信开发者工具与公众平台权限；
- AppID、体验版和合法域名设置；
- 腾讯云只读/运维权限；
- systemd/Nginx/安全组变更权限；
- 私密凭据安全获取方式；
- MobileSAM 权重位置和 SHA；
- 图谱来源、许可和医学审核负责人；
- 合法测试图片与禁止使用的数据；
- 当前稳定版、当前试验版和回滚版本；
- Android/iOS 测试设备；
- 下一阶段唯一优先目标。

在这些事项未确认前，应继续做本地可验证工作，不擅自部署或接触真实患者数据。
