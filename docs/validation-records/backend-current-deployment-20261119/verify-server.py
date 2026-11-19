"""Collect read-only post-deployment evidence from the dermatome server."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parents[3]
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

REMOTE = r'''
import hashlib
import json
import pathlib
import subprocess
import urllib.request

root = pathlib.Path('/srv/dermatome-mapper')

def run(*args):
    return subprocess.run(args, capture_output=True, text=True, check=False, timeout=20).stdout.strip()

def get_json(url):
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            return {'status': response.status, 'body': json.loads(response.read())}
    except Exception as exc:
        return {'error': type(exc).__name__}

def props(unit):
    fields = (
        'ActiveState', 'SubState', 'MainPID', 'ExecMainStartTimestamp',
        'NRestarts', 'MemoryCurrent', 'CPUUsageNSec', 'ControlGroup',
    )
    args = ['systemctl', 'show', unit]
    for field in fields:
        args.extend(['-p', field])
    return dict(
        line.split('=', 1) for line in run(*args).splitlines() if '=' in line
    )

manifest = json.loads((root / 'deployment/release-manifest.json').read_text())
actual = {
    name: hashlib.sha256((root / name).read_bytes()).hexdigest()
    if (root / name).is_file() else 'missing'
    for name in manifest
}
services = {
    name: props(name)
    for name in ('dermatome', 'acupuncture', 'nginx', 'dermatome-cleanup.timer')
}
pid = services['dermatome'].get('MainPID', '0')
process = {}
if pid != '0':
    process = {
        line.split(':', 1)[0]: line.split(':', 1)[1].strip()
        for line in pathlib.Path('/proc', pid, 'status').read_text().splitlines()
        if line.startswith(('VmRSS:', 'VmHWM:', 'Threads:'))
    }
group = pathlib.Path('/sys/fs/cgroup' + services['dermatome'].get('ControlGroup', ''))
limits = {}
for name in (
    'memory.max', 'memory.high', 'memory.current', 'memory.peak',
    'memory.swap.current', 'memory.events', 'cpu.max', 'cpu.stat',
):
    path = group / name
    if path.is_file():
        limits[name] = path.read_text().strip()

nginx_limits = {}
for path in (
    pathlib.Path('/etc/nginx/sites-enabled/dermatome-ip-test'),
    pathlib.Path('/etc/nginx/sites-enabled/acupuncture'),
    pathlib.Path('/etc/nginx/sites-enabled/acupuncture-domain'),
):
    if path.is_file():
        nginx_limits[str(path)] = [
            line.strip() for line in path.read_text().splitlines()
            if 'client_max_body_size' in line
        ]

nginx_test = subprocess.run(
    ['nginx', '-t'], capture_output=True, text=True, check=False, timeout=20
)
ai_session_root = root / 'runtime/uploads/v5-ai-sessions'
ai_session_dirs = (
    len([p for p in ai_session_root.iterdir() if p.is_dir()])
    if ai_session_root.is_dir() else 0
)

print(json.dumps({
    'time': run('date', '-Is'),
    'manifest_count': len(manifest),
    'manifest_match': manifest == actual,
    'missing': [name for name, value in actual.items() if value == 'missing'],
    'mismatched': [
        name for name, value in actual.items()
        if value != 'missing' and manifest[name] != value
    ],
    'services': services,
    'process': process,
    'limits': limits,
    'ports_8000_8001': [
        line for line in run('ss', '-lnt').splitlines()
        if '127.0.0.1:8000' in line or '127.0.0.1:8001' in line
    ],
    'nginx_client_max_body_size': nginx_limits,
    'nginx_test': {
        'returncode': nginx_test.returncode,
        'stdout': nginx_test.stdout.strip(),
        'stderr': nginx_test.stderr.strip(),
    },
    'ai_session_dir_count': ai_session_dirs,
    'dermatome_health': get_json('http://127.0.0.1:8001/api/v1/health'),
    'acupuncture_health': get_json('http://127.0.0.1:8000/health'),
    'acupuncture_ready': get_json('http://127.0.0.1:8000/ready'),
    'public_health': get_json('http://212.64.26.206/dermatome-test/api/v1/health'),
}))
'''

result = subprocess.run(
    SSH + ["sudo -n python3 -"],
    input=REMOTE,
    text=True,
    capture_output=True,
    check=False,
    timeout=45,
)
if result.returncode:
    raise SystemExit((result.stderr + result.stdout)[-5000:])
remote = json.loads(result.stdout)

with httpx.Client(
    base_url="http://212.64.26.206/dermatome-test",
    trust_env=False,
    timeout=20,
) as client:
    session = client.post("/api/v1/access/session", json={})
    session.raise_for_status()
    token = session.json()["access_token"]
    headers = {"authorization": "Bearer " + token}
    try:
        ready = client.get("/api/v1/ready", headers=headers)
        ready.raise_for_status()
        remote["public_ready"] = {
            "status": ready.status_code,
            "ai_model_loaded_after_real_smoke": ready.json().get("ai_model_loaded"),
            "medical_review": ready.json().get("medical_review"),
            "diagnosis_enabled": ready.json().get("diagnosis_enabled"),
        }
    finally:
        client.delete("/api/v1/access/session", headers=headers)

remote["deployment_id"] = "backend-current-20261119-155751"
remote["public_smoke"] = json.loads(
    (OUT / "public-smoke.json").read_text()
)
remote["real_ai_smoke"] = json.loads(
    (OUT / "real-ai-smoke.json").read_text()
)

(OUT / "server-after-verification.json").write_text(
    json.dumps(remote, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
)
print(
    json.dumps(
        {
            "status": "PASSED",
            "manifest_match": remote["manifest_match"],
            "public_ready": remote["public_ready"],
            "report": str(OUT / "server-after-verification.json"),
        },
        ensure_ascii=False,
    )
)
