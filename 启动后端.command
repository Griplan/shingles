#!/bin/zsh
# 本机微信模拟器开发服务；保留终端窗口即可看到退出原因。
set -u

project_root=${0:A:h}
cd "$project_root" || exit 1
python_bin="$project_root/backend/.venv/bin/python"

if [[ ! -x "$python_bin" ]]; then
  print '未找到项目的 Python 虚拟环境，请先按 README 安装后端依赖。'
  read -r '?按回车关闭窗口。'
  exit 1
fi

print '正在启动 dermatome-mapper 本机开发后端……'
print '服务地址：http://127.0.0.1:8000'
print '启动后请保留此终端窗口；关闭窗口或按 Ctrl+C 会停止服务。'
print '如果提示端口已被占用，请先检查是否已经有后端在运行。'

DERMATOME_ENV=development ENABLE_REFERENCE_MATCHING=1 \
  "$python_bin" -m uvicorn app.main:app --app-dir backend \
  --host 127.0.0.1 --port 8000 --no-access-log
server_status=$?

print "后端已停止（退出码：$server_status）。"
read -r '?按回车关闭窗口；需要时重新双击启动后端.command。'
exit "$server_status"
