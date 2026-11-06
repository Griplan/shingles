#!/bin/zsh
set -eu
cd -- "${0:A:h}"
./deployment/cloud-control.sh status
echo "操作结束。按任意键关闭窗口。"
read -k 1
