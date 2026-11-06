#!/bin/sh
set -eu
case "${1:-status}" in enable|disable|status) action="${1:-status}";; *) echo '用法: public-ip-control.sh enable|disable|status' >&2; exit 2;; esac
exec ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o UpdateHostKeys=no -o ForwardAgent=no -o ClearAllForwardings=yes acupuncture-server "sudo -n /srv/dermatome-mapper/deployment/ip-test-control.sh $action"
