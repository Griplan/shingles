# 本机后端再次断连与恢复

日期：2026-10-26（Asia/Shanghai）。环境：macOS，项目既有Python虚拟环境、Node及开发后端。输入：健康检查、自带合成标注；未重新发送用户现存标注。

## 定位与恢复

1. `lsof -nP -iTCP:8000 -sTCP:LISTEN`退出1、无监听；`curl --silent --show-error --max-time 5 --include http://127.0.0.1:8000/api/v1/health`退出7，提示无法连接。前端模拟器地址仍为127.0.0.1:8000。因此本次确认后端未运行；未查明此前进程退出的具体原因，不能直接归因为用户关闭窗口。
2. 首次在受限沙箱运行README既有开发启动命令，Uvicorn完成应用初始化后绑定失败：`[Errno 1] operation not permitted`，退出3；不是后端代码崩溃或图谱加载失败。
3. 经工具批准使用同一命令启动本机开发服务：`DERMATOME_ENV=development ENABLE_REFERENCE_MATCHING=1 backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log`。实际启动PID52080，监听127.0.0.1:8000。未更改微信网络检查设置，未扩大监听范围。
4. 健康检查HTTP200；自带真实HTTP联调脚本退出0。详见health.txt与http-integration.txt。脚本的平台API为适配器，成功结果来自实际服务；不能冒充微信GUI重新计算验收。

## 可重复启动入口

新增项目根目录`启动后端.command`，与README开发命令一致，自动切换项目目录并使用既有虚拟环境，只监听127.0.0.1，关闭访问日志。无安装依赖、开机启动或常驻系统设置。运行窗口明确提醒保留终端、Ctrl+C/关闭窗口会停止服务、端口已占用时先检查现有服务。失败/退出保留窗口与退出码，便于查看原因。

`zsh -n 启动后端.command`退出0，文件已加可执行权限。当前服务通过上面的同等命令实际运行；Finder双击脚本本轮NOT_RUN，不为了验证而停止已经恢复的服务。未改业务计算、API、前端或图谱；未提交或推送Git。重启电脑后需重新运行，不能承诺当前进程跨系统重启持续存在。

本次仅恢复本机后端并记录重复启动方式；此前GUI画布与导航未验项不因此转为通过。
