"""Deploy the final formal HTTPS backend delta with independent rollback."""

from __future__ import annotations

import hashlib
import io
import json
import subprocess
import tarfile
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
SSH = [
    "ssh",
    "-T",
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    "UpdateHostKeys=no",
    "-o",
    "ForwardAgent=no",
    "-o",
    "ClearAllForwardings=yes",
    "-o",
    "ConnectTimeout=12",
    "acupuncture-server",
]
FILES = [
    "backend/app/services/production_access.py",
    "deployment/configure-wechat-production.sh",
    "docs/compliance/wechat-review/https-release-readiness/nginx-final-release.conf",
]


def remote(command: str, data: bytes | None = None, timeout: int = 180) -> bytes:
    result = subprocess.run(
        SSH + [command],
        input=data,
        capture_output=True,
        check=False,
        timeout=timeout,
    )
    if result.returncode:
        output = (result.stdout + result.stderr).decode(errors="replace")
        raise RuntimeError(output[-8_000:])
    return result.stdout


manifest = json.loads((ROOT / "deployment/release-manifest.json").read_text())
for name in FILES:
    assert manifest[name] == hashlib.sha256((ROOT / name).read_bytes()).hexdigest()

deployment_id = time.strftime("final-release-%Y%m%d-%H%M%S", time.localtime())
stage = f"/srv/dermatome-mapper/deployment/{deployment_id}-staging"
backup = f"/srv/dermatome-mapper/deployment/backups/{deployment_id}"

before_probe = r"""
import hashlib,json,pathlib,subprocess
r=pathlib.Path('/srv/dermatome-mapper')
def sha(path):
    path=pathlib.Path(path)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
units={
    unit:subprocess.check_output(
        ['systemctl','show',unit,'-p','MainPID','-p','ActiveState','--no-pager'],
        text=True,
    ).strip().splitlines()
    for unit in ['dermatome','acupuncture','nginx']
}
print(json.dumps({
    'deployment_id':DEPLOYMENT_ID,
    'production_access_sha256':sha(r/'backend/app/services/production_access.py'),
    'release_manifest_sha256':sha(r/'deployment/release-manifest.json'),
    'nginx_site_sha256':sha('/etc/nginx/sites-available/dermatome.bglabs.cloud'),
    'wechat_config_present':(r/'config/wechat-production.env').is_file(),
    'units':units,
},ensure_ascii=False))
""".replace("DEPLOYMENT_ID", repr(deployment_id))
before = json.loads(remote("sudo -n python3 -", before_probe.encode()))
(OUT / "before.json").write_text(json.dumps(before, ensure_ascii=False, indent=2) + "\n")

remote(f"sudo -n install -d -m 0750 {stage} {backup}")
archive = io.BytesIO()
with tarfile.open(fileobj=archive, mode="w:gz") as bundle:
    for name in FILES:
        bundle.add(ROOT / name, arcname=name, recursive=False)
    bundle.add(
        ROOT / "deployment/release-manifest.json",
        arcname="deployment/release-manifest.json",
        recursive=False,
    )
remote(f"sudo -n tar -xzf - -C {stage}", archive.getvalue())

prepare = f"""
set -euo pipefail
STAGE={stage!r}
BACKUP={backup!r}
R=/srv/dermatome-mapper
SITE=/etc/nginx/sites-available/dermatome.bglabs.cloud
python3 -m py_compile "$STAGE/backend/app/services/production_access.py"
bash -n "$STAGE/deployment/configure-wechat-production.sh"
python3 - <<'PY'
import hashlib,json,pathlib
stage=pathlib.Path({stage!r})
manifest=json.loads((stage/'deployment/release-manifest.json').read_text())
files=[
 'backend/app/services/production_access.py',
 'deployment/configure-wechat-production.sh',
 'docs/compliance/wechat-review/https-release-readiness/nginx-final-release.conf',
]
for name in files:
    actual=hashlib.sha256((stage/name).read_bytes()).hexdigest()
    assert actual==manifest[name],name
PY
test -d "$BACKUP"
test ! -e "$BACKUP/production_access.py"
install -m 0600 "$R/backend/app/services/production_access.py" "$BACKUP/production_access.py"
install -m 0600 "$R/deployment/release-manifest.json" "$BACKUP/release-manifest.json"
install -m 0600 "$SITE" "$BACKUP/nginx-domain.conf"
echo PREPARED
"""
prepared = remote("sudo -n bash -s", prepare.encode()).decode()

apply = f"""
set -euo pipefail
STAGE={stage!r}
BACKUP={backup!r}
R=/srv/dermatome-mapper
SITE=/etc/nginx/sites-available/dermatome.bglabs.cloud
backend_changed=0
nginx_changed=0
restore_backend() {{
  if [[ "$backend_changed" == 1 ]]; then
    systemctl stop dermatome.service >/dev/null 2>&1 || true
    install -m 0644 "$BACKUP/production_access.py" "$R/backend/app/services/production_access.py"
    install -m 0644 "$BACKUP/release-manifest.json" "$R/deployment/release-manifest.json"
    systemctl start dermatome.service >/dev/null 2>&1 || true
  fi
}}
restore_nginx() {{
  if [[ "$nginx_changed" == 1 ]]; then
    install -m 0644 "$BACKUP/nginx-domain.conf" "$SITE"
    nginx -t >/dev/null 2>&1 || true
    systemctl reload nginx >/dev/null 2>&1 || true
  fi
}}
rollback() {{
  restore_nginx
  restore_backend
}}
trap rollback ERR
backend_changed=1
install -m 0644 "$STAGE/backend/app/services/production_access.py" "$R/backend/app/services/production_access.py"
install -m 0755 "$STAGE/deployment/configure-wechat-production.sh" "$R/deployment/configure-wechat-production.sh"
install -d -m 0755 "$R/docs/compliance/wechat-review/https-release-readiness"
install -m 0644 "$STAGE/docs/compliance/wechat-review/https-release-readiness/nginx-final-release.conf" "$R/docs/compliance/wechat-review/https-release-readiness/nginx-final-release.conf"
install -m 0644 "$STAGE/deployment/release-manifest.json" "$R/deployment/release-manifest.json"
systemctl restart dermatome.service
ready=0
for attempt in $(seq 1 45); do
  if curl -fsS --max-time 2 http://127.0.0.1:8001/api/v1/health >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
test "$ready" == 1
nginx_changed=1
install -m 0644 "$STAGE/docs/compliance/wechat-review/https-release-readiness/nginx-final-release.conf" "$SITE"
nginx -t
systemctl reload nginx
trap - ERR
echo APPLIED
"""
applied = remote("sudo -n bash -s", apply.encode(), timeout=240).decode()
(OUT / "apply.txt").write_text(prepared + applied)

after_probe = r"""
import hashlib,json,pathlib,subprocess,urllib.error,urllib.request
r=pathlib.Path('/srv/dermatome-mapper')
def sha(path):
    path=pathlib.Path(path)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
def http(url,method='GET',data=None,headers=None):
    request=urllib.request.Request(url,method=method,data=data,headers=headers or {})
    try:
        with urllib.request.urlopen(request,timeout=8) as response:
            return {
                'status':response.status,
                'body':response.read(2048).decode(errors='replace'),
                'headers':dict(response.headers),
            }
    except urllib.error.HTTPError as error:
        return {
            'status':error.code,
            'body':error.read(2048).decode(errors='replace'),
            'headers':dict(error.headers),
        }
units={
    unit:subprocess.check_output(
        ['systemctl','show',unit,'-p','MainPID','-p','ActiveState','--no-pager'],
        text=True,
    ).strip().splitlines()
    for unit in ['dermatome','acupuncture','nginx','certbot.timer','dermatome-cleanup.timer']
}
print(json.dumps({
    'deployment_id':DEPLOYMENT_ID,
    'production_access_sha256':sha(r/'backend/app/services/production_access.py'),
    'release_manifest_sha256':sha(r/'deployment/release-manifest.json'),
    'nginx_site_sha256':sha('/etc/nginx/sites-available/dermatome.bglabs.cloud'),
    'wechat_config_present':(r/'config/wechat-production.env').is_file(),
    'units':units,
    'public_health':http('https://dermatome.bglabs.cloud/api/v1/health'),
    'formal_login_before_secret':http(
        'https://dermatome.bglabs.cloud/api/v1/access/wechat',
        'POST',
        b'{"code":"synthetic-code"}',
        {'Content-Type':'application/json'},
    ),
    'ready_route_closed':http('https://dermatome.bglabs.cloud/api/v1/ready'),
    'legacy_access_closed':http(
        'https://dermatome.bglabs.cloud/api/v1/access/session',
        'POST',
        b'{}',
        {'Content-Type':'application/json'},
    ),
    'acupuncture_health':http('https://acupuncture.yandunshuati.online/health'),
},ensure_ascii=False))
""".replace("DEPLOYMENT_ID", repr(deployment_id))
after = json.loads(remote("sudo -n python3 -", after_probe.encode()))
(OUT / "after.json").write_text(json.dumps(after, ensure_ascii=False, indent=2) + "\n")

report = {
    "deployment_id": deployment_id,
    "backup": backup,
    "health": after["public_health"]["status"],
    "formal_login_before_secret": after["formal_login_before_secret"]["status"],
    "ready": after["ready_route_closed"]["status"],
    "legacy": after["legacy_access_closed"]["status"],
    "acupuncture": after["acupuncture_health"]["status"],
}
print(json.dumps(report, ensure_ascii=False, indent=2))
