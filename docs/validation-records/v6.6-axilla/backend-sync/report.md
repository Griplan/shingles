# V6.6.2 云端后端同步（2026-11-05）

用户在本轮明确授权“更新后端”，覆盖上一轮仅本地、不部署的边界。已连接既有acupuncture-server，更新独立dermatome服务；没有上传微信体验版。

## 诊断和实际操作

更新前云端仍为V6.5全身/足底版本，缺少腋下view及其独立atlas。服务虽正常，旧schema会拒绝axilla-left/right并由前端显示“当前视图尚未支持”。本轮新增腋下schema/registry/来源状态以及空、PROVISIONAL两套独立数据，原全身atlas与sole不改。

实际变更18个运行文件，文件范围和摘要见plan.json；其中包括6个后端路由/schema/加载模块及12个新数据文件。没有安装依赖或替换PyTorch/MobileSAM权重，没有修改访问凭据、服务环境、systemd、Nginx、端口或安全组。继续单worker监听127.0.0.1:8001，经原测试前缀访问。

执行顺序：核对服务器记录摘要与实际文件一致→备份→固定白名单压缩包→Linux暂存校验→只停止dermatome→复制变更文件→摘要复核→启动dermatome→健康检查→公网鉴权/实际匹配回归。

暂存检查实际通过：全身136实例、足底4实例、新腋下4实例。18个更新文件清单见plan.json，成功输出见apply.log。备份为 `/srv/dermatome-mapper/deployment/backups/v662-axilla-20261105-r2`，暂存为同项目deployment/v662-axilla-staging-r2。若切换失败，脚本仅恢复B的原有变更文件和release manifest并启动B；新无引用文件保留为证据。

首次检查因旧全身manifest没有atlasId而在服务停止之前失败，未改变运行代码；改为使用该清单的既有注册标识goran-2022。首次备份和暂存保留，第二次使用r2独立目录；摘要见first-preflight-failure.txt。没有把失败改写为成功。

## 真实公网检查

入口仍是现有 `http://212.64.26.206/dermatome-test`。使用现有受限短期测试会话，在进程内保留Bearer，最后撤销；没有打印或保存凭据，没有上传患者照片。该HTTP测试通道仍只适用于原先授权的公开/合成测试数据。

`ai/.venv/bin/python docs/validation-records/v6.6-axilla/backend-sync/smoke.py` 实际22项检查通过（smoke.json）：

- 健康200，未授权匹配401，合法会话/ready200，结束撤销204。
- 左右腋下真实HTTP结果与本地合成几何响应完全一致，包括source.atlas_status=PROVISIONAL、uncertainty_level=HIGH。
- 两侧T1/T2单区命中，中央未配置处不返回候选；原空腋下身份仍409 ATLAS_NOT_READY。
- 旧全身手部实际几何请求/响应保持一致，左右足底L5匹配正常。
- 过期atlas版本仍409 VERSION_MISMATCH。

这些是实际公网HTTP请求，不是手机微信运行。微信真机：NOT_RUN。此前本地350前端/303后端AI测试记录仍见provisional-matching/tests.md，本轮没有改业务实现或重复引用为新执行数量。

## 原服务保护

before.json与after.json对比：acupuncture和Nginx的MainPID、启动时间、NRestarts完全一致；针灸服务/代码及已启用Nginx配置摘要一致；针灸内网和原HTTPS health/ready均200。只重启dermatome，没有重启针灸或Nginx。

## 客户端和限制

含V6.6.2前端的客户端可直接重试腋下“试验性参考匹配”。旧体验包不会自动获得新页面/atlas配置；若仍是旧包需另行上传当前代码，本轮未执行上传。新的PROVISIONAL图谱仅约6.2%近端内臂可计算，中央/胸壁等未覆盖，绝非完整医学腋窝定位。服务端版本同步不等于医学审核或真机验收。
