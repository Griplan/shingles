# V6.7 线上后端同步记录

## 本次变更

小程序开发工具原先固定访问本机 `http://127.0.0.1:8000`，与体验版使用的公网测试入口不一致。2026-11-12 已把 develop 与 trial 统一到：

```text
http://212.64.26.206/dermatome-test
```

`wx.request`、`wx.uploadFile` 和资源下载继续共用 `apiBaseUrl()`，没有增加第二套地址。该入口是受控 HTTP 调试通道，只允许公开或合成测试图片，不代表正式 HTTPS/患者隐私部署。

## 本机与部署清单对比

本机 `deployment/release-manifest.json` 仍记录 V6.6.4。与当前工作区比较，后端运行文件有以下明确差异：

- 修改：`backend/app/main.py`
- 修改：`backend/app/schemas/evaluate.py`
- 修改：`backend/app/services/atlas_service.py`
- 新增：`backend/app/services/perineum_atlas_service.py`
- 新增：`backend/app/services/perineum_schematic_service.py`
- 新增：`data/atlas/perineum-schematic-v1/` 4 个文件
- 新增：`data/body/perineum-resource.json`
- 新增：`data/body/perineum-v1.json`

因此部署前线上记录仍对应 V6.6.4；r4 完成后，线上发布清单已经包含本轮 V6.7 会阴运行文件。

## 发布脚本

[deploy.py](deploy.py) 的设计范围：

1. 通过既有 `acupuncture-server` SSH 别名只读读取线上 release manifest。
2. 先要求线上 manifest 与实际文件哈希完全一致；发现漂移则拒绝覆盖。
3. 只计划 V6.7 会阴相关的 11 个文件。
4. 在独立 staging 目录完成摘要、Python 编译和 Shapely 数据集校验。
5. 备份将被覆盖的 B 项目文件和 release manifest。
6. 只停止、启动 `dermatome.service`。
7. 启动失败时恢复 B 文件并独立重启 B。
8. 部署前后核对针灸服务、Nginx 的 PID、启动时间、重启数和保护文件摘要。

[smoke.py](smoke.py) 使用公开合成多边形检查健康、匿名拒绝、自动测试会话、会阴 S2、模拟未定区、模拟状态和旧版本拒绝。

## 实际执行状态

- 小程序默认线上地址切换：`PASSED`
- TypeScript：`PASSED`
- 小程序测试：`388/388 PASSED`
- 会阴后端专项：`11/11 PASSED`
- 工程结构、图谱与分包检查：`PASSED`
- 线上实时 dry-run：`PASSED`
- 腾讯云文件写入：`PASSED`，r4 同步 11 个会阴相关文件
- `dermatome.service` 重启：`PASSED`
- 线上发布清单：`PASSED`，145 项全部存在且哈希一致
- 公网 smoke：`PASSED`，8/8
- `acupuncture.service` 与 Nginx 保护检查：`PASSED`，PID、启动时间、重启计数和受保护文件摘要未变化

早期线上检查曾因运行环境的自动权限审批超时被阻断；后续取得连接权限后完成 r4
部署。该早期 `BLOCKED` 记录保留在失败历史中，不代表当前线上状态。

当前线上状态于 2026-11-12 复核：

- `dermatome.service`：`active`，`NRestarts=0`
- `acupuncture.service`：`active`
- `nginx.service`：`active`
- 公网 smoke 实际通过 health、匿名拒绝、受控测试会话、鉴权 ready、会阴 S2、
  模拟未定区、旧版本拒绝和会话清理
- ready 返回 `ai_model_loaded=false`；MobileSAM 为惰性加载，因此该 smoke 不宣称
  已执行线上 AI 推理
- 另行尝试公开 CDC 测试图时，受控服务已有两个临时分析会话，新建会话返回
  `429 AI_CAPACITY`。测试访问会话已清理，未删除他人分析会话；线上 MobileSAM
  真实推理仍为 `NOT_RUN`。证据见
  [online-ai-smoke-failed.json](online-ai-smoke-failed.json)

## 恢复执行

取得 SSH 执行权限后，在项目根目录运行：

```bash
ai/.venv/bin/python docs/validation-records/v6.7-perineum/deployment-v6.7/deploy.py
ai/.venv/bin/python docs/validation-records/v6.7-perineum/deployment-v6.7/deploy.py --apply
ai/.venv/bin/python docs/validation-records/v6.7-perineum/deployment-v6.7/smoke.py
```

第一条是只读对比；第二条才写入腾讯云；第三条验证公网结果。脚本使用固定备份目录
`/srv/dermatome-mapper/deployment/backups/v67-perineum-20261112-r4`，重复执行会拒绝覆盖已有备份。

首次 r1 暂存校验只打包了增量文件，导致 `app.utils` 无法导入。该失败发生在停止
`dermatome.service` 之前，没有切换线上文件；r2 改为把完整后端 Python 包放进暂存目录，
但应用时仍只复制 manifest 判定为变化的文件。失败的 r1 备份和暂存目录保留作证据。

第二次 r2 暂存校验通过且新服务实际启动，但部署脚本把需要 Bearer 的 `/ready`
当成匿名接口轮询，收到 401 后误判启动失败并自动回滚。r3 先创建受控测试会话，再检查
`/ready` 和真实会阴 S2 合成匹配；r2 备份、暂存和服务日志保留作证据。

第三次 r3 在应用端 smoke 顶部导入 Shapely，但 SSH 执行器是系统 Python，而不是项目
虚拟环境，因此在读取部署包、停止服务之前即退出。r4 的运行时 smoke 改为纯标准库
归一化矩形，不再假设系统 Python 安装项目依赖。r4 最终成功，线上发布清单由 134
项更新为 145 项，当前实际文件和清单无缺失、无哈希漂移。

## 回滚

若已执行第二条但需要回退，从上述备份目录恢复本次 `plan.json` 中非新增文件及
`deployment/release-manifest.json`，删除本次新增的会阴服务、图谱和人体文件，然后只重启
`dermatome.service`。不得重启 `acupuncture.service` 或 Nginx。
