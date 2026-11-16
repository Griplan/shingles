# AI 照片进入人体放置后的临时源释放

日期：2026-11-13

## 问题

受控后端最多保留两个未过期 AI 临时照片会话。此前用户从“确认分割”进入人体放置页后，AI 页面仍在导航栈中，`onUnload` 尚未执行，原照片会话继续占用名额，短时连续测试会出现“临时分析已满”。

人体放置只需要已经复制到内存的：

- `ConfirmedPhoto`
- 已定向照片尺寸
- `PreparedPhotoGeometry`
- 照片坐标 MultiPolygon 与孔洞
- 放置变换和人体边界校验数据

后续拖动、缩放、旋转、最终人体校验及 V2 提交不需要再次读取后端原图或 Mask。

## 处理

1. 放置草稿新增 `sourceDetached` 状态；释放临时源后，草稿不再由服务端 `expires_at` 或 AI 页面会话回调控制。
2. 点击“放置到人体”后，先建立自包含草稿，再打开放置页面。
3. 放置页面成功打开后立即调用既有临时会话删除接口；重复进入或离开不会再次删除同名会话。
4. 放置页面打开失败时恢复临时源检查，不删除照片，用户可重试。
5. 删除失败时保留明确清理警告，但人体放置仍可继续；服务端 30 分钟 TTL 继续兜底。
6. 本地预览在 AI 页面存活期间保留，方便返回后继续同一放置；页面退出时清理本地预览。
7. 正式 V2 提交允许已复制、已释放临时源的放置草稿在服务端 TTL 后完成，但仍执行全部 MultiPolygon、孔洞、人体轮廓与目标模板校验。

后端临时会话数量、上传大小、像素、鉴权、单推理槽和启动配置均未修改。

## 修改文件

- `miniprogram/packages/clinical/state/ai-session.ts`
- `miniprogram/packages/clinical/state/placement-session.ts`
- `miniprogram/packages/clinical/pages/ai-annotate/ai-annotate.ts`
- `miniprogram/state/annotation-session.ts`
- `tests/miniprogram/ai-photo.test.cjs`
- `tests/miniprogram/ai-simple.test.cjs`
- `tests/miniprogram/placement-flow.test.cjs`
- `docs/privacy.md`
- `docs/architecture.md`
- `task.md`

## 验证

- TypeScript：PASS
- 前端自动化：397/397 PASS
- 项目结构：PASS
- 图谱无损生成：PASS
- 主包/分包边界与保守体积：PASS
- 微信 `wcc` / `wcsc`：AI、放置、照片 Canvas、放置 Overlay 编译 PASS
- `git diff --check`：PASS

新增覆盖：

- 放置草稿脱离临时源后跨过期仍可完成最终校验和 V2 提交
- 导航成功只删除一次后端临时源
- 重复“继续放置”不会重复删除
- 导航失败不删除照片并恢复源检查
- 删除后保留已确认几何和当前页面本地预览
- 原有取消、换图、返回、超时清理测试保持通过
- 被动 TTL 过期不会清除已脱离源的草稿
- 用户主动取消或换图时仍会清除自包含放置草稿

## 生产部署核验

2026-11-13 对既有 `acupuncture-server` 执行只读发布核查。本次临时照片释放逻辑仅修改小程序前端；服务端删除会话接口已经存在，因此没有新的后端文件需要上传。

- 本地与线上发布清单均为 145 个运行文件，新增、缺失和哈希差异均为 0。
- `dermatome.service`、`acupuncture.service` 与 Nginx 均为 `active`。
- 智络智绘仍只监听 `127.0.0.1:8001`；针灸服务仍只监听 `127.0.0.1:8000`。
- 公网 `http://212.64.26.206/dermatome-test` 的 8 项合成数据检查通过，包括健康检查、匿名拒绝、自动测试鉴权、ready、会阴 S2、会阴未定区、旧版本拒绝和会话清理。
- 本地 V6.7/会阴后端专项 35 项通过。
- 因为不存在服务端差异，本轮没有复制文件，也没有重启任何生产服务。

完整脱敏记录见 [`evidence/deployment-check.json`](evidence/deployment-check.json) 和 [`evidence/online-smoke.json`](evidence/online-smoke.json)。公网入口仍是受控测试入口，不是正式医疗或患者数据入口。

## 未验证

- 微信开发者工具中的原生页面导航和真实网络 `DELETE`
- 手机真机、弱网和删除请求超时
- 云端受限服务在释放后立即接受新会话的容量变化

上述项目为 `NOT_RUN`；自动化测试和静态编译不能替代原生与真机验收。
