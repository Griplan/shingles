#!/bin/sh
set -eu
cd "$(dirname "$0")"
sh deployment/public-ip-control.sh enable
printf "\n操作完成。按回车关闭窗口。\n"
read -r unused
