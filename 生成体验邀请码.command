#!/bin/zsh
set -eu
cd -- "${0:A:h}"
python3 scripts/issue_trial_invitation.py
echo '操作结束。按任意键关闭窗口。'
read -k 1
