#!/bin/sh
# Fixed SSH target and fixed service. Never accepts an arbitrary remote command.
set -eu
case "${1:-status}" in
 stop) command='sudo -n systemctl stop dermatome.service && systemctl show dermatome.service -p ActiveState -p MainPID && systemctl is-active acupuncture.service' ;;
 start) command='sudo -n systemctl start dermatome.service && systemctl show dermatome.service -p ActiveState -p MainPID && systemctl is-active acupuncture.service' ;;
 restart) command='sudo -n systemctl restart dermatome.service && systemctl show dermatome.service -p ActiveState -p MainPID && systemctl is-active acupuncture.service' ;;
 status) command='systemctl show dermatome.service -p ActiveState -p SubState -p MainPID -p NRestarts -p MemoryCurrent && systemctl is-active acupuncture.service' ;;
 logs) command='sudo -n journalctl -u dermatome.service -n 50 --no-pager' ;;
 *) echo '用法: cloud-control.sh start|stop|restart|status|logs' >&2; exit 2 ;;
esac
exec ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o UpdateHostKeys=no -o ForwardAgent=no -o ClearAllForwardings=yes acupuncture-server "$command"
