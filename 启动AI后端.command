#!/bin/zsh
# V5.2 public/synthetic development images only; one local process, no access log.
set -u
project_root=${0:A:h}
cd "$project_root" || exit 1
python_bin="$project_root/ai/.venv/bin/python"
if [[ ! -x "$python_bin" ]]; then
  print '请先按 ai/README.md 安装独立AI环境。'
  read -r '?按回车关闭。'
  exit 1
fi
print '启动本地AI测试后端（同时保留V4参考匹配）。仅使用公开或合成图片。'
print '地址：http://127.0.0.1:8000；保留此窗口，Ctrl+C停止。'
print '若8000端口已占用，请先停止原开发后端，再启动本窗口。'
PYTHONPATH="$project_root${PYTHONPATH:+:$PYTHONPATH}" DERMATOME_ENV=development \
ENABLE_REFERENCE_MATCHING=1 ENABLE_AI_SEGMENTATION=1 AI_DEVICE=cpu \
 "$python_bin" -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log
server_status=$?
print "服务已停止（退出码：$server_status）。"
read -r '?按回车关闭窗口。'
exit "$server_status"
