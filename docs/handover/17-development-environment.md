# 17 开发环境

> 文档基线：2026-11-19；代码基线为 Git `27b41f6` 加当前未提交工作区。代码、部署和真机状态分层记录，以当前源码与实际证据为准。

## 17.1 必备工具

- Python 3.11 或更高；
- Node.js / npm；
- 微信开发者工具；
- 有 AppID 或测试号的小程序项目权限；
- 访问 PyPI/npm 的网络；
- 如运行 AI：足够内存和本地 MobileSAM 权重。

## 17.2 Python 环境

项目有意分成两个可选环境：

```bash
# 后端轻量环境
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'

# AI 环境可复用已有 ai/.venv
ai/.venv/bin/python -m pip install -r ai/requirements.txt
```

实际仓库已存在两个虚拟环境时，不重复重建，先检查版本和依赖。

## 17.3 后端启动

只启动核心匹配：

```bash
DERMATOME_ENV=test \
ENABLE_REFERENCE_MATCHING=1 \
PYTHONPATH=backend \
backend/.venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 --port 8000
```

启动 AI：

```bash
DERMATOME_ENV=test \
ENABLE_REFERENCE_MATCHING=1 \
ENABLE_AI_SEGMENTATION=1 \
PYTHONPATH=backend \
ai/.venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 --port 8000
```

历史桌面启动脚本：

- `启动后端.command`
- `启动AI后端.command`

## 17.4 小程序环境

```bash
cd miniprogram
npm ci
npm run typecheck
npm test
```

微信开发者工具导入目录必须是：

```text
dermatome-mapper/miniprogram
```

不要导入仓库根目录。

## 17.5 测试门禁

Python 全量：

```bash
DERMATOME_ENV=test \
ENABLE_REFERENCE_MATCHING=1 \
ENABLE_AI_SEGMENTATION=1 \
PYTHONPATH=backend:. \
ai/.venv/bin/python -m pytest backend/tests ai/tests -q
```

如果不设置 `ENABLE_REFERENCE_MATCHING=1`，会阴模拟测试会按产品门禁拒绝，出现 2 个“失败”并不代表几何代码回归。

## 17.6 常用检查

```bash
python3 scripts/check_project.py
python3 scripts/sync_atlas.py --check
python3 scripts/check_main_hands.py
python3 scripts/check_miniprogram_packages.py
git diff --check
```

WXML/WXSS：

```bash
/Applications/wechatwebdevtools.app/Contents/Resources/package.nw/node_modules/wcc-exec/wcc \
  <all .wxml files> -o /private/tmp/handover-wxml.js

/Applications/wechatwebdevtools.app/Contents/Resources/package.nw/node_modules/wcc-exec/wcsc \
  <all .wxss files> -o /private/tmp/handover-wxss.js
```

## 17.7 本机测试与真机差异

本机可以验证：

- TypeScript；
- 页面状态机；
- Canvas 适配器；
- Shapely 和 MobileSAM；
- 本地 HTTP；
- 微信静态编译。

必须在真机验证：

- `wx.chooseMedia` 相册/相机；
- 原生 `wx.compressImage`；
- 大图内存；
- 触摸延迟；
- FPS；
- 折叠屏实际姿态；
- 网络切换；
- 微信后台合法域名和体验版。

## 17.8 开发时的数据原则

- 只用公开授权、去标识化或合成图片；
- 不把患者照片放进仓库；
- 不将 token 写入 URL 或日志；
- 不把 `private-data/` 内容提交；
- 不手工修改生成图谱后绕过同步脚本；
- 不删除旧失败记录。

## 17.9 修改前必读

每次功能修改至少检查：

1. `AGENTS.md` 的历史约束；
2. `task.md` 最新覆盖；
3. 本交接目录相关章节；
4. 当前 Git dirty 状态；
5. 相关测试和验证记录；
6. 数据版本和坐标系。

不要使用 `git reset`、`git clean` 或 `git checkout -- .` 解决工作区冲突。
