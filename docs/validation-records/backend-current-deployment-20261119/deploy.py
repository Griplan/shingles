"""Deploy the current backend delta to the independent dermatome server.

The default invocation is plan-only. Pass ``--apply`` to update the server.
Only dermatome-owned files, the dermatome IP test location, and dermatome.service
are touched. The acupuncture service and domain configuration stay untouched.
"""

from __future__ import annotations

import hashlib
import io
import json
import subprocess
import sys
import tarfile
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
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


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def remote(command: str, data: bytes | None = None, timeout: int = 180) -> bytes:
    result = subprocess.run(
        SSH + [command],
        input=data,
        capture_output=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode:
        message = (result.stderr + result.stdout).decode(errors="replace")
        raise RuntimeError(message[-6000:])
    return result.stdout


def write_json(name: str, value: object) -> None:
    (OUT / name).write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )


before = json.loads(
    remote("sudo -n python3 -", (ROOT / "deployment/snapshot.py").read_bytes())
)
write_json("before.json", before)

probe = r'''
import hashlib,json,pathlib
root=pathlib.Path('/srv/dermatome-mapper')
manifest_path=root/'deployment/release-manifest.json'
manifest=json.loads(manifest_path.read_text())
actual={f:(hashlib.sha256((root/f).read_bytes()).hexdigest() if (root/f).is_file() else 'missing') for f in manifest}
env={}
p=root/'config/service.env'
allowed={'DERMATOME_ENV','ENABLE_REFERENCE_MATCHING','ENABLE_AI_SEGMENTATION','ENABLE_PUBLIC_TEST_ACCESS','AI_IDLE_SECONDS'}
if p.is_file():
    for line in p.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1)
            if k in allowed: env[k]=v
site=pathlib.Path('/etc/nginx/sites-available/dermatome-ip-test')
print(json.dumps({
    'manifest':manifest,
    'actual':actual,
    'manifest_sha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    'env_public':env,
    'nginx_site_sha256':hashlib.sha256(site.read_bytes()).hexdigest() if site.is_file() else None,
    'service_unit_sha256':hashlib.sha256(pathlib.Path('/etc/systemd/system/dermatome.service').read_bytes()).hexdigest(),
}))
'''
server = json.loads(remote("sudo -n python3 -", probe.encode()))
write_json("server-before.json", server)

if server["manifest"] != server["actual"]:
    raise SystemExit("Server release manifest drift detected; refusing deployment")

backend_files = sorted(
    str(path.relative_to(ROOT))
    for path in (ROOT / "backend/app").rglob("*.py")
    if "__pycache__" not in path.parts
)
planned_files = [
    *backend_files,
    "deployment/cleanup.py",
    "deployment/nginx.dermatome-ip-test.conf",
    "deployment/nginx.dermatome.conf.template",
]
missing = [name for name in planned_files if not (ROOT / name).is_file()]
if missing:
    raise SystemExit("Missing local deployment files: " + ", ".join(missing))

release_manifest = dict(server["manifest"])
release_manifest.update({name: digest(ROOT / name) for name in planned_files})
changed = [
    name
    for name in planned_files
    if server["actual"].get(name) != release_manifest[name]
]
new = [name for name in changed if name not in server["actual"]]
expected_changed = {
    "backend/app/api/routes/ai.py",
    "backend/app/api/routes/evaluate.py",
    "backend/app/main.py",
    "backend/app/schemas/evaluate.py",
    "backend/app/services/access.py",
    "backend/app/services/ai_boundary.py",
    "backend/app/services/ai_image_input.py",
    "backend/app/services/ai_limits.py",
    "backend/app/services/ai_sessions.py",
    "backend/app/services/body_intersection.py",
    "deployment/cleanup.py",
    "deployment/nginx.dermatome-ip-test.conf",
    "deployment/nginx.dermatome.conf.template",
}
if set(changed) != expected_changed:
    raise SystemExit(
        "Planned file set differs from reviewed backend delta.\n"
        f"actual={sorted(set(changed))}\nexpected={sorted(expected_changed)}"
    )

deployment_id = time.strftime("backend-current-%Y%m%d-%H%M%S", time.localtime())
plan = {
    "deployment_id": deployment_id,
    "files": planned_files,
    "changed": changed,
    "new": new,
    "previous_manifest": server["manifest"],
    "manifest": release_manifest,
    "backup": f"/srv/dermatome-mapper/deployment/backups/{deployment_id}",
    "stage": f"/srv/dermatome-mapper/deployment/{deployment_id}-staging",
    "scope": "dermatome.service and dermatome-test IP ingress only",
}
write_json("plan.json", plan)

print("Deployment:", deployment_id)
print("Changed files:", len(changed))
for name in changed:
    print(("NEW " if name in new else "MOD "), name, flush=True)

if "--apply" not in sys.argv:
    print("Plan only. Pass --apply to deploy.")
    raise SystemExit(0)

buffer = io.BytesIO()
with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
    for name in planned_files:
        archive.add(ROOT / name, arcname=name, recursive=False)
    manifest_bytes = (
        json.dumps(release_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode()
    info = tarfile.TarInfo("deployment/release-manifest.json")
    info.size = len(manifest_bytes)
    info.mode = 0o644
    archive.addfile(info, io.BytesIO(manifest_bytes))

prepare = r'''
from pathlib import Path
import json,shutil,subprocess
p=json.loads(PLAN)
r=Path('/srv/dermatome-mapper')
b=Path(p['backup']);s=Path(p['stage'])
assert not b.exists() and not s.exists(), 'backup or staging already exists'
assert subprocess.check_output(['systemctl','is-active','dermatome'],text=True).strip()=='active'
assert subprocess.check_output(['systemctl','is-active','acupuncture'],text=True).strip()=='active'
assert subprocess.check_output(['systemctl','is-active','nginx'],text=True).strip()=='active'
b.mkdir(mode=0o700);s.mkdir(mode=0o755)
for f in p['changed']:
    if f.endswith('/') or f.endswith('/.'):
        raise RuntimeError('directory entry in file plan')
for f in [f for f in p['changed'] if f not in p['new']]:
    d=b/f
    d.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(r/f,d)
(b/'deployment/release-manifest.json').parent.mkdir(parents=True,exist_ok=True)
shutil.copy2(r/'deployment/release-manifest.json',b/'deployment/release-manifest.json')
site=Path('/etc/nginx/sites-available/dermatome-ip-test')
nginx_backup=b/'nginx/dermatome-ip-test'
nginx_backup.mkdir(parents=True,exist_ok=True)
shutil.copy2(site,nginx_backup/site.name)
print(json.dumps({'prepared':True,'backup':str(b),'stage':str(s)}))
'''.replace("PLAN", repr(json.dumps(plan, ensure_ascii=False)))
prepared = remote("sudo -n python3 -", prepare.encode()).decode()
(OUT / "prepare.log").write_text(prepared + "\n")
print(prepared)

remote(
    f"sudo -n tee {plan['stage']}/package.tgz >/dev/null",
    buffer.getvalue(),
)

apply_remote = r'''
from pathlib import Path
import hashlib,json,os,re,shutil,subprocess,tarfile,time,urllib.error,urllib.request
p=json.loads(PLAN)
r=Path('/srv/dermatome-mapper');s=Path(p['stage']);b=Path(p['backup'])
site=Path('/etc/nginx/sites-available/dermatome-ip-test')
nginx_backup=b/'nginx/dermatome-ip-test/dermatome-ip-test'
manifest=r/'deployment/release-manifest.json'
stopped=False
changed_on_disk=False

def is_active(unit):
    return subprocess.run(['systemctl','is-active','--quiet',unit],check=False).returncode==0

def wait_health(path='/api/v1/health', attempts=60):
    for _ in range(attempts):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8001'+path,timeout=2) as q:
                if q.status==200:return True
        except Exception:pass
        time.sleep(1)
    return False

def restore():
    global stopped
    if stopped:
        subprocess.run(['systemctl','stop','dermatome'],check=False,timeout=65)
    for f in p['changed']:
        dst=r/f;src=b/f
        if src.exists():
            dst.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(src,dst)
        elif dst.exists():
            dst.unlink()
    if (b/'deployment/release-manifest.json').exists():
        shutil.copy2(b/'deployment/release-manifest.json',manifest)
    if nginx_backup.exists():
        shutil.copy2(nginx_backup,site)
    test=subprocess.run(['nginx','-t'],capture_output=True,text=True)
    if test.returncode==0:
        subprocess.run(['systemctl','reload','nginx'],check=False,timeout=30)
    subprocess.run(['systemctl','start','dermatome'],check=False,timeout=30)
    wait_health(attempts=20)

try:
    with tarfile.open(s/'package.tgz') as t:
        names={m.name for m in t.getmembers()}
        assert names==set(p['files'])|{'deployment/release-manifest.json'}
        assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in t.getmembers())
        t.extractall(s,filter='data')
    for f in p['files']:
        assert hashlib.sha256((s/f).read_bytes()).hexdigest()==p['manifest'][f],f
    for f in p['files']:
        if f.endswith('.py'):
            compile((s/f).read_text(),f,'exec')
    # Staged imports use the already-deployed immutable data/model assets.
    for name in ('data','miniprogram','ai'):
        q=s/name
        if not q.exists():q.symlink_to(r/name,target_is_directory=True)
    preflight=(
        "import hashlib,json,sys\n"
        "from pathlib import Path\n"
        f"stage=Path({str(s)!r}); root=Path({str(r)!r})\n"
        "sys.path.insert(0,str(stage/'backend'))\n"
        "from app.main import app\n"
        "from app.services.ai_limits import MAX_UPLOAD_BYTES,MAX_SOURCE_PIXELS,IDLE_SECONDS,CONTROLLED_INFERENCE_PIXELS\n"
        "assert (MAX_UPLOAD_BYTES,MAX_SOURCE_PIXELS,IDLE_SECONDS,CONTROLLED_INFERENCE_PIXELS)==(50*1024*1024,50_000_000,120,3_000_000)\n"
        "from app.schemas.evaluate import BodyIntersectionRequest\n"
        "from app.services.body_intersection import clip_to_body\n"
        "body=json.loads((root/'data/body/commons-template4-hands-v2.json').read_text())['views']['front']\n"
        "ring=[{'x':.48,'y':.30},{'x':.52,'y':.30},{'x':.52,'y':.34},{'x':.48,'y':.34},{'x':.48,'y':.30}]\n"
        "payload=BodyIntersectionRequest(view='front',template_id=body['templateId'],template_version=body['templateVersion'],geometry_id=body['geometryId'],region_set_id=body['regionSetId'],geometry={'type':'MultiPolygon','coordinateSpace':'body_template_normalized_v1','coordinates':[[ring]]})\n"
        "result=clip_to_body(payload)\n"
        "assert result.status=='inside' and result.geometry is not None\n"
        "print(json.dumps({'imports':True,'body_intersection':'inside','limits':[MAX_UPLOAD_BYTES,MAX_SOURCE_PIXELS,IDLE_SECONDS]}))\n"
    )
    preflight_result=subprocess.run(
        [str(r/'.venv/bin/python'),'-c',preflight],
        cwd=s,capture_output=True,text=True,timeout=40,
    )
    if preflight_result.returncode:
        raise RuntimeError('staged preflight failed: '+(preflight_result.stderr+preflight_result.stdout)[-4000:])
    source=(s/'deployment/nginx.dermatome-ip-test.conf').read_text()
    assert 'client_max_body_size 51m;' in source
    assert 'proxy_pass http://127.0.0.1:8001/api/v1/;' in source

    subprocess.run(['systemctl','stop','dermatome'],check=True,timeout=65)
    stopped=True
    changed_on_disk=True
    for f in p['changed']:
        src=s/f;dst=r/f
        dst.parent.mkdir(parents=True,exist_ok=True)
        temporary=dst.with_name(dst.name+'.deploy-tmp')
        shutil.copyfile(src,temporary)
        os.chmod(temporary,0o644)
        temporary.replace(dst)
    shutil.copyfile(s/'deployment/release-manifest.json',manifest)
    os.chmod(manifest,0o644)
    installed=site.with_name('dermatome-ip-test.deploy-tmp')
    shutil.copyfile(s/'deployment/nginx.dermatome-ip-test.conf',installed)
    os.chmod(installed,0o644)
    installed.replace(site)
    test=subprocess.run(['nginx','-t'],capture_output=True,text=True,timeout=30)
    if test.returncode:
        raise RuntimeError('nginx -t failed: '+(test.stderr+test.stdout)[-3000:])
    for f in p['files']:
        assert hashlib.sha256((r/f).read_bytes()).hexdigest()==p['manifest'][f],f
    subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
    if not wait_health(attempts=60):raise RuntimeError('health did not become ready')
    subprocess.run(['systemctl','reload','nginx'],check=True,timeout=30)
    if not wait_health(attempts=10):raise RuntimeError('health failed after nginx reload')

    anon_req=urllib.request.Request('http://127.0.0.1:8001/api/v1/ready',method='GET')
    try:
        urllib.request.urlopen(anon_req,timeout=10)
        raise RuntimeError('ready allowed anonymous access')
    except urllib.error.HTTPError as e:
        assert e.code==401,e.code
    token_req=urllib.request.Request(
        'http://127.0.0.1:8001/api/v1/access/session',
        data=b'{}',headers={'Content-Type':'application/json'},method='POST',
    )
    with urllib.request.urlopen(token_req,timeout=10) as q:
        token=json.load(q)['access_token']
    headers={'Authorization':'Bearer '+token}
    try:
        with urllib.request.urlopen(
            urllib.request.Request('http://127.0.0.1:8001/api/v1/ready',headers=headers),
            timeout=15,
        ) as q:
            ready=json.load(q)
        assert ready['status']=='ready'
        body=json.loads((r/'data/body/commons-template4-hands-v2.json').read_text())['views']['front']
        ring=[
            {'x':.48,'y':.30},{'x':.52,'y':.30},
            {'x':.52,'y':.34},{'x':.48,'y':.34},{'x':.48,'y':.30},
        ]
        payload={
            'view':'front',
            'template_id':body['templateId'],
            'template_version':body['templateVersion'],
            'geometry_id':body['geometryId'],
            'region_set_id':body['regionSetId'],
            'geometry':{
                'type':'MultiPolygon',
                'coordinateSpace':'body_template_normalized_v1',
                'coordinates':[[ring]],
            },
        }
        request=urllib.request.Request(
            'http://127.0.0.1:8001/api/v1/evaluate/body-intersection',
            data=json.dumps(payload).encode(),
            headers={**headers,'Content-Type':'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(request,timeout=20) as q:
            intersection=json.load(q)
        assert intersection['method']=='body_intersection_v1'
        assert intersection['status']=='inside'
        assert intersection['geometry'] is not None
    finally:
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    'http://127.0.0.1:8001/api/v1/access/session',
                    headers=headers,method='DELETE',
                ),
                timeout=10,
            ).close()
        except Exception:
            pass

    public_health=subprocess.run(
        [
            'curl','--noproxy','*','-s','-o','/dev/null','-w','%{http_code}',
            '--max-time','8','-H','Host: 212.64.26.206',
            'http://127.0.0.1/dermatome-test/api/v1/health',
        ],
        capture_output=True,text=True,timeout=12,
    )
    assert public_health.stdout.strip()=='200',public_health.stdout
    subprocess.run(['systemctl','start','dermatome-cleanup.service'],check=True,timeout=30)
    assert is_active('dermatome-cleanup.timer')
    assert is_active('acupuncture')
    assert is_active('nginx')
    effective_limits=[
        line.strip()
        for line in site.read_text().splitlines()
        if 'client_max_body_size' in line
    ]
    assert effective_limits==['client_max_body_size 10m;','client_max_body_size 51m;'],effective_limits
    print(json.dumps({
        'status':'APPLIED',
        'deployment_id':p['deployment_id'],
        'changed_files':len(p['changed']),
        'backup':str(b),
        'staged_preflight':json.loads(preflight_result.stdout),
        'public_health':200,
        'authenticated_ready':ready['status'],
        'body_intersection':intersection['status'],
        'ai_model_loaded':ready['ai_model_loaded'],
        'nginx_limits':effective_limits,
        'cleanup_timer':True,
        'acupuncture_active':True,
    },sort_keys=True))
except Exception as exc:
    restore()
    raise RuntimeError('deployment failed and rollback was attempted: '+repr(exc))
'''.replace("PLAN", repr(json.dumps(plan, ensure_ascii=False)))
result = json.loads(remote("sudo -n python3 -", apply_remote.encode(), timeout=300))
write_json("apply.json", result)

(ROOT / "deployment/release-manifest.json").write_text(
    json.dumps(release_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
)

after = json.loads(
    remote("sudo -n python3 -", (ROOT / "deployment/snapshot.py").read_bytes())
)
write_json("after.json", after)

for field in ("MainPID", "ActiveEnterTimestamp", "NRestarts"):
    if before["a"].get(field) != after["a"].get(field):
        raise SystemExit(f"acupuncture.{field} changed")
    if before["nginx"].get(field) != after["nginx"].get(field):
        raise SystemExit(f"nginx.{field} changed")

before_a_hashes = {
    key: value
    for key, value in before["hashes"].items()
    if "dermatome-ip-test" not in key
}
after_a_hashes = {
    key: value
    for key, value in after["hashes"].items()
    if "dermatome-ip-test" not in key
}
if before_a_hashes != after_a_hashes:
    raise SystemExit("Protected A/Nginx hash mismatch")

print(json.dumps(result, ensure_ascii=False, sort_keys=True))
