# V4交互联动验证报告

日期2026-10-26；macOS，Node21.7.3、TypeScript5.9.3，项目Python3.12.14虚拟环境与Shapely2.2.0。输入为项目测试夹具、手绘合成多边形和既有规范图谱。所有命令在dermatome-mapper根目录执行，除原生编译在miniprogram目录执行。

## 自动检查

| 实际命令 | 结果 | 原始证据 |
| --- | --- | --- |
| `npm test --prefix miniprogram` | 149/149 PASSED，最终同标签清focus补丁后重跑 | frontend-completion.txt |
| `npm run typecheck --prefix miniprogram` | PASSED | typecheck-completion.txt |
| `backend/.venv/bin/python -m pytest backend/tests -q` | 47 PASSED，1条既有Starlette/httpx弃用警告 | backend.txt |
| `backend/.venv/bin/python scripts/sync_atlas.py --check` | PASSED | atlas-sync.txt |
| `backend/.venv/bin/python scripts/sync_matching_body.py --check` | PASSED | body-sync.txt |
| `backend/.venv/bin/python scripts/check_project.py` | PASSED，结构检查不是GUI验收 | project.txt |
| 微信随附`wcc`与`wcsc`编译七个WXML/WXSS文件 | 均exit0，完整参数见日志 | native-compile-final.txt |
| `node scripts/test_matching_http.cjs`，已启动README的本机开发后端 | PASSED，成功响应均来自真实API和规范图谱 | http-check.txt |
| SHA256与开工基线比较 | 93个受保护文件完全相同 | protection-check.json |

真实HTTP流程：画片→新结果页一次自动请求→全部实际实例→单区/放大/复位/resize；返回新增→旧覆盖清空→新导航一次请求→单片与并集；背面隔离；未配置发区无虚构候选；有效修订重入复用。网络失败仅在wx平台适配器注入，随后重试仍调用真实服务。这个流程不是微信原生触摸或网络故障实机测试。

新增测试涵盖精确ID解析和失败关闭、多部分/孔洞及去重、左右与长标签、API原序不变、320/375/430和480短屏布局、7/30标签滚动布局、默认全部/单区/显示全部、同标签切回与focus一致、缓存请求计数、编辑失效、原归一化投影、填充一次和轮廓模式。既有会话测试继续覆盖请求竞争、迟到/错版/错身份、失效和错误恢复。侧栏高度测试通过不代表实际字体、触摸与原生Canvas合成已验。

## 保留的失败及修正

- frontend-first.txt：143通过、1失败，旧测试要求选中片两次fill；目标改为单次正确填充后更新断言，并补真实轮廓/多片断言，最终149通过。没有删掉失败记录。
- native-compile-first.txt：wcc exit2，WXML表达式实体不合法；修正后wcc与wcsc通过。
- http-first.txt：沙箱拒绝本机HTTP连接。已确认本机开发后端存在，针对本机合成测试请求授权重跑，http-check.txt通过；不是业务返回假成功。
- 文档更新首轮系统python3读取中文stdin发生编码错误，脚本未执行任何写入；切项目虚拟环境并声明UTF-8后成功。此失败不涉及业务代码和测试结果。
- 实际模拟器的noWindowsAvailable、截图状态不同步、Canvas偏移及缓存导航失败完整保留在[GUI记录](gui-validation.md)。

## 结论边界

工程逻辑、真实本机HTTP及原生编译通过；390真实主流程和320部分场景可见验证通过。多屏完整验收尚未完成，存在需复测的原生画布/导航异常，375/430结果页、手机、部分异常触摸场景仍NOT_RUN。医疗正确性未在本轮验证，医学审核状态不变。唯一任务状态与后续项见[task.md](../../../task.md)。
