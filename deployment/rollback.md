# 本轮执行前制定的独立回滚

只操作新建的dermatome资源。若A健康/就绪异常，立即 `sudo systemctl stop dermatome`，确认其cgroup无进程，再检查A与公网健康；不重启A或整机。代码/模型与日志保留。

如未来新增B Nginx站点，修改前保存原站点清单和哈希，并备份B文件。回滚只移除B的sites-enabled链接，`sudo nginx -t`成功后reload，再核对A的HTTPS。不得恢复或覆盖A站点/证书。本轮无授权B域名时不修改Nginx。

禁用自动启动须另外明确要求；本轮不自动disable。正式人体标注继续属于V2小程序会话，停后端不清它；受控服务中的合法未过期照片/结果使用私有原子快照，停启保留，固定TTL不延长。取消或过期才删除。

## P4.1 公网IP测试入口追加回退

本轮用户授权独立IP vhost，覆盖上文“无域名不改Nginx”的历史前提。只关闭 `dermatome-ip-test` 链接，使用 `sh deployment/public-ip-control.sh disable`，脚本 nginx -t、平滑reload并检查B前缀404/A ready200。原A站点/证书/服务不变，B FastAPI仍127.0.0.1:8001。恢复为enable；原A fallback SHA变化时拒绝启用。无需恢复整个Nginx备份。控制助手与独立站点源码/关闭实测见 docs/wechat-public-ip-test.md。

## P4.2 免邀请码测试会话回退

仅恢复B备份目录 `deployment/backups/p42-no-invitation-20261102` 中三个鉴权Python文件、service.env、release-manifest.json及本说明，再重启dermatome。原A/Nginx均不重启。只需关闭免邀请能力时，将B的ENABLE_PUBLIC_TEST_ACCESS设为0并重启B；关闭全部公网测试入口仍用public-ip-control.sh disable。前端此后若自动会话被关闭应明确报服务不可用，不能伪造成功；旧邀请接口保留用于回退/兼容，不再有用户输入入口。
