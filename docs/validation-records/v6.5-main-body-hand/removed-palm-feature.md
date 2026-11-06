# 独立手掌退役与脚底保护

特殊部位只保留左/右脚底，提示手部在全身正面/背面标注。没有新增手部页面或覆盖计算按钮。

从运行路径移除 `pages/palm`、`components/palm-canvas`、`assets/palm`、`data/palm-models.ts`、`data/palm.generated.ts`、`types/palm.ts`、`state/palm-*` 与后端 `palm_atlas_service.py`。原来供脚底共用的部分迁为 `pages/local-surface`、`components/local-surface-canvas`、`types/local-surface.ts`、`state/local-surface-*`；注册表仅接受 sole-left/right，继续复用原V2编辑器、坐标、V4匹配与P6机制。旧页面不注册，旧palm路由不能进入；local页面携带palm参数时拒绝。

HTTP请求中palm-left/right或旧palm-dermatomes-v1返回 `410 VIEW_RETIRED`，不会回退为front/back、sole或换来源。同一个L5/S1足底仍绑定原独立模板与图谱，未改变神经几何。

原运行文件与旧测试已保存到本目录 `archive/`；来源证据 `data/sources/palm-v1`、`data/sources/servier-palm-v1`、历史 `data/atlas/palm-v1` 和 `data/body/palm*` 保留，**没有运行时导入或fallback**。历史任务、许可、审计和预览不删除。

原PalmSessionStore只有模块内存，无数据库、wx storage持久化或病例文件。此次没有扫描/删除用户记录，也没有把独立掌坐标转换为全身坐标。若外部保有旧导出数据，保留其旧view/template/atlas身份，在历史版本离线查看或由用户参考原记录重新标注，不能自动导入本次全身会话。本轮不新造跨版本迁移功能。应用重启原本就不保证内存会话保留，此限制没有改变。

脚底源数据/PNG/SVG的哈希不变；sole.generated.ts仅变更共用类型导入名称，生成器只读复现通过。左右脚底会话隔离、孔洞、结果高亮、异步迟到、跨视图防污染测试继续执行。
