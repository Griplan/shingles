#!/bin/sh
# Deliberately fixed target; no service name is accepted from input.
set -eu
action=${1:-status}
case "$action" in
 start|stop|restart|status) exec sudo systemctl "$action" dermatome.service ;;
 logs) exec sudo journalctl -u dermatome.service -n 50 --no-pager ;;
 *) echo '用法: dermatome-control.sh start|stop|restart|status|logs' >&2; exit 2 ;;
esac
