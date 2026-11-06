#!/bin/sh
# Server-side, fixed B ingress only. Does not stop/restart either API.
set -eu
site=/etc/nginx/sites-available/dermatome-ip-test
enabled=/etc/nginx/sites-enabled/dermatome-ip-test
source=/srv/dermatome-mapper/deployment/nginx.dermatome-ip-test.conf
original=/etc/nginx/sites-enabled/acupuncture
expected=db30b2164afcf41b2fdbf8ae4d2464deca988f3d1312063e99bd5d34123c79c8
wait_route() {
    attempts=0
    while test "$attempts" -lt 20; do
        code=$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 3 -H 'Host: 212.64.26.206' http://127.0.0.1/dermatome-test/api/v1/health || true)
        if test "$code" = "$1"; then return; fi
        attempts=$((attempts + 1)); sleep 0.25
    done
    echo 'Reload completed but ingress state not verified; inspect before retry.' >&2; return 1
}
check_original() {
    test "$(sha256sum "$original" | cut -d ' ' -f 1)" = "$expected" || { echo 'Original IP fallback changed; review before enabling.' >&2; exit 1; }
    systemctl is-active --quiet acupuncture.service
    curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:8000/ready >/dev/null
}
case "${1:-status}" in
 enable)
    check_original
    test ! -e "$site" || cmp -s "$source" "$site"
    install -o root -g root -m 644 "$source" "$site"
    if test -L "$enabled"; then test "$(readlink "$enabled")" = "$site"; else
        test ! -e "$enabled"
        ln -s "$site" "$enabled"
        if ! nginx -t; then rm -- "$enabled"; exit 1; fi
        if ! systemctl reload nginx; then rm -- "$enabled"; nginx -t && systemctl reload nginx; exit 1; fi
    fi
    check_original
    wait_route 200
    ;;
 disable)
    if test -L "$enabled"; then
        test "$(readlink "$enabled")" = "$site"
        rm -- "$enabled"
        if ! nginx -t; then ln -s "$site" "$enabled"; exit 1; fi
        if ! systemctl reload nginx; then ln -s "$site" "$enabled"; nginx -t && systemctl reload nginx; exit 1; fi
    else test ! -e "$enabled"; fi
    check_original
    wait_route 404
    ;;
 status) if test -L "$enabled"; then echo 'IP test ingress enabled'; else echo 'IP test ingress disabled'; fi ;;
 *) echo 'Usage: ip-test-control.sh enable|disable|status' >&2; exit 2 ;;
esac
