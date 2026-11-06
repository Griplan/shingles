# V6.6.4 腋下模拟匹配部署与体验版联调

日期：2026-11-06。云端后端已同步并验证；微信体验版未上传，原因是开发者工具登录票据失效。

## 本地版本

- 图谱：`axilla-schematic-v1 / axilla-schematic.1`。
- 左右合计 6 个 SCHEMATIC 区域，标签为模拟 T1、T2、T3。
- 状态保持 `SCHEMATIC / NOT_MEDICALLY_VALIDATED / INTERACTIVE_SIMULATION / ARTIFICIALLY_CONSTRUCTED`。
- 前端 351/351、后端与 AI 311/311 通过；TypeScript、WCC/WCSC、全身 136 区、旧腋下、脚底和模拟图谱检查通过。

## 云端同步

计划只改变 10 个文件：5 个后端注册/状态文件和 5 个 `axilla-schematic-v1` 数据文件。其中 6 个为新增文件，4 个为替换文件。未同步 AI 权重、访问配置、systemd、Nginx、人体素材或依赖。

首次暂存校验在停止 dermatome 前失败：左右合计 6 个区域被误写为期望 3 个，安全断言阻止切换。失败证据见 [first-preflight-failure.txt](first-preflight-failure.txt)。使用独立 r2 目录重试后，暂存校验结果为：

- 全身：136 个区域；
- 脚底：4 个区域；
- 旧 PROVISIONAL 腋下：4 个区域；
- 新 SCHEMATIC 腋下：6 个区域。

成功结果见 [plan.json](plan.json) 与 [apply.log](apply.log)。有效回滚备份为：

`/srv/dermatome-mapper/deployment/backups/v664-axilla-schematic-20261106-r2`

## 云端公网验收

使用公开测试入口 `http://212.64.26.206/dermatome-test` 和合成几何执行 26 项请求，全部通过，结果见 [smoke.json](smoke.json)。覆盖：

- 左右腋下各返回模拟 T1、T2、T3；
- 单片和三片标注；
- SCHEMATIC、未医学验证、模拟用途、人工构建和 pending 状态；
- 匿名请求拒绝、限时测试会话建立与撤销；
- 错误图谱版本返回 409；
- 主人体手部与原左右脚底响应回归。

首次快速验收触发 Nginx 的 5 次/秒限制，记录见 [smoke-first-rate-limit.txt](smoke-first-rate-limit.txt)。没有修改限流；验收按 0.25 秒间隔重跑后通过。

## 原服务保护

部署前后针灸与 Nginx 的 MainPID、启动时间和 NRestarts 均未变化；保护文件摘要一致，针灸内网健康/就绪和原 HTTPS 健康/就绪均返回 200。只重启了 dermatome。证据见 [before.json](before.json) 与 [after.json](after.json)。

## 微信体验版

尝试版本：`0.6.6-axilla.20261106`，AppID：`wx951711e2fa1da5ff`。开发者工具 CLI 服务端口最终能启动到 `127.0.0.1:9420`，但工具日志报告 `errcode=41001`、`access_token missing`，当前微信账号需要重新登录。窗口自动化接口也持续超时。

因此：

- 新代码未上传；
- 未设置新体验版；
- 手机完整流程 `NOT_RUN`；
- 旧体验版不会自动获得本地 V6.6.3/V6.6.4 代码。

尝试证据见 [upload-attempt.json](upload-attempt.json)。最少人工操作是在微信开发者工具登录有 AppID 权限的账号，编译并上传上述版本，再在微信平台将其设为体验版。

## 回滚

回滚只处理 dermatome，不停止针灸或 Nginx：

1. 停止 `dermatome`。
2. 从 `/srv/dermatome-mapper/deployment/backups/v664-axilla-schematic-20261106-r2` 恢复 `backend/app/api/routes/evaluate.py`、`backend/app/schemas/evaluate.py`、`backend/app/services/atlas_service.py`、`backend/app/services/local_atlas_service.py` 和 `deployment/release-manifest.json`。
3. 启动 `dermatome` 并检查 `http://127.0.0.1:8001/api/v1/health`。
4. 新增的 `axilla-schematic-v1` 文件可保留；旧注册文件恢复后它们不会被引用。

医学审核仍为 pending。100% 是当前局部模板的有效皮肤模拟覆盖，不是医学准确率或真实受累神经定位。
