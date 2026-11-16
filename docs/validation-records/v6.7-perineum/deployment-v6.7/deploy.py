"""Deploy only the V6.7 perineum backend delta to the independent B service."""

from __future__ import annotations

import hashlib
import io
import json
import subprocess
import sys
import tarfile
from pathlib import Path


ROOT = Path.cwd()
OUT = ROOT / "docs/validation-records/v6.7-perineum/deployment-v6.7"
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


def remote(command: str, data: bytes | None = None, timeout: int = 180) -> bytes:
    result = subprocess.run(
        SSH + [command],
        input=data,
        capture_output=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(
            (result.stderr + result.stdout).decode(errors="replace")[-4000:]
        )
    return result.stdout


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


before = json.loads(
    remote("sudo -n python3 -", (ROOT / "deployment/snapshot.py").read_bytes())
)
(OUT / "before.json").write_text(json.dumps(before, indent=2) + "\n")

probe = b"""from pathlib import Path
import hashlib,json
r=Path('/srv/dermatome-mapper')
m=json.loads((r/'deployment/release-manifest.json').read_text())
a={f:hashlib.sha256((r/f).read_bytes()).hexdigest() if (r/f).is_file() else 'missing' for f in m}
perineum={
  'service_atlas': (r/'backend/app/services/perineum_atlas_service.py').is_file(),
  'service_schematic': (r/'backend/app/services/perineum_schematic_service.py').is_file(),
  'atlas_dir': (r/'data/atlas/perineum-schematic-v1').is_dir(),
  'body': (r/'data/body/perineum-v1.json').is_file(),
}
print(json.dumps({'recorded':m,'actual':a,'perineum':perineum}))
"""
server_before = json.loads(remote("sudo -n python3 -", probe))
(OUT / "server-before.json").write_text(
    json.dumps(server_before, indent=2) + "\n"
)
if server_before["actual"] != server_before["recorded"]:
    raise SystemExit("Server manifest drift detected; refusing overwrite")

backend_files = sorted(
    str(path.relative_to(ROOT))
    for path in (ROOT / "backend/app").rglob("*.py")
    if "__pycache__" not in path.parts
)
files = [
    *backend_files,
    *sorted(
        str(path.relative_to(ROOT))
        for path in (ROOT / "data/atlas/perineum-schematic-v1").glob("*.json")
    ),
    "data/body/perineum-resource.json",
    "data/body/perineum-v1.json",
]
missing = [name for name in files if not (ROOT / name).is_file()]
if missing:
    raise SystemExit("Missing deployment files: " + ", ".join(missing))

manifest = {
    **server_before["actual"],
    **{name: digest(ROOT / name) for name in files},
}
changed = [
    name
    for name in files
    if server_before["actual"].get(name) != manifest[name]
]
new = [name for name in changed if name not in server_before["actual"]]
plan = {
    "files": files,
    "changed": changed,
    "new": new,
    "previous": server_before["actual"],
    "manifest": manifest,
    "backup": "/srv/dermatome-mapper/deployment/backups/v67-perineum-20261112-r4",
    "stage": "/srv/dermatome-mapper/deployment/v67-perineum-staging-20261112-r4",
    "scope": "dermatome.service only",
}
(OUT / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
if not changed:
    print("Online B already contains all planned V6.7 file hashes.")
    raise SystemExit(0)

expected = {
    "backend/app/main.py",
    "backend/app/schemas/evaluate.py",
    "backend/app/services/atlas_service.py",
    "backend/app/services/perineum_atlas_service.py",
    "backend/app/services/perineum_schematic_service.py",
    "data/atlas/perineum-schematic-v1/manifest.json",
    "data/atlas/perineum-schematic-v1/perineum-overview.json",
    "data/atlas/perineum-schematic-v1/registration.json",
    "data/atlas/perineum-schematic-v1/sources.json",
    "data/body/perineum-resource.json",
    "data/body/perineum-v1.json",
}
if not set(changed).issubset(expected):
    raise SystemExit("Unexpected changed files: " + repr(sorted(set(changed) - expected)))
print("Planned B-only changes:", changed, flush=True)
if "--apply" not in sys.argv:
    raise SystemExit(0)

prepare = """import hashlib,json,shutil,subprocess
from pathlib import Path
p=json.loads(PLAN)
r=Path('/srv/dermatome-mapper')
b=Path(p['backup'])
s=Path(p['stage'])
assert not b.exists() and not s.exists(), 'backup/staging already exists'
assert all(hashlib.sha256((r/f).read_bytes()).hexdigest()==h for f,h in p['previous'].items())
assert subprocess.check_output(['systemctl','is-active','dermatome'],text=True).strip()=='active'
assert subprocess.check_output(['systemctl','is-active','acupuncture'],text=True).strip()=='active'
assert subprocess.check_output(['systemctl','is-active','nginx'],text=True).strip()=='active'
b.mkdir(mode=0o700)
s.mkdir(mode=0o755)
for f in [f for f in p['changed'] if f not in p['new']]+['deployment/release-manifest.json']:
 d=b/f
 d.parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(r/f,d)
print(json.dumps({'prepared':True,'backup':str(b),'stage':str(s),'A':'active','nginx':'active'}))
""".replace("PLAN", repr(json.dumps(plan)))
prepared = remote("sudo -n python3 -", prepare.encode()).decode()
(OUT / "prepare.log").write_text(prepared)
print(prepared, flush=True)

buffer = io.BytesIO()
with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
    for name in files:
        archive.add(ROOT / name, arcname=name, recursive=False)
remote(
    "sudo -n tee " + plan["stage"] + "/package.tgz >/dev/null",
    buffer.getvalue(),
)

apply_remote = """from pathlib import Path
import hashlib,json,os,shutil,subprocess,tarfile,time,urllib.request
p=json.loads(PLAN)
r=Path('/srv/dermatome-mapper')
s=Path(p['stage'])
b=Path(p['backup'])
with tarfile.open(s/'package.tgz') as t:
 assert {m.name for m in t.getmembers()}==set(p['files'])
 assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in t.getmembers())
 t.extractall(s,filter='data')
for f in p['files']:
 assert hashlib.sha256((s/f).read_bytes()).hexdigest()==p['manifest'][f]
 if f.endswith('.py'):
  compile((s/f).read_text(),f,'exec')
validation='''import hashlib,json,os,sys
from pathlib import Path
os.environ['DERMATOME_ENV']='test'
os.environ['ENABLE_REFERENCE_MATCHING']='1'
sys.path.insert(0,STAGE+'/backend')
from app.schemas.evaluate import Identity
from app.services.atlas_service import load_dataset
r=Path(STAGE)
m=json.loads((r/'data/atlas/perineum-schematic-v1/manifest.json').read_text())
body=(r/'data/body/perineum-v1.json').read_bytes()
i=Identity(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=m['regionSetId'],atlas_id=m['atlasId'],atlas_version=m['atlasVersion'],atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256(body).hexdigest(),coordinate_system='normalized_2d_top_left')
d=load_dataset(i)
assert {x['labelId'] for x in d.regions}=={'S2','S3','S4','S5','UNDEFINED'}
assert set(d.bodies)=={'perineum-overview'}
print('staged perineum dataset valid:',len(d.regions),'regions')
'''.replace('STAGE',repr(str(s)))
subprocess.run([str(r/'.venv/bin/python'),'-c',validation],check=True,timeout=30)
stopped=False
try:
 subprocess.run(['systemctl','stop','dermatome'],check=True,timeout=65)
 stopped=True
 for f in p['changed']:
  d=r/f
  d.parent.mkdir(parents=True,exist_ok=True)
  shutil.copyfile(s/f,d)
  os.chmod(d,0o644)
 (r/'deployment/release-manifest.json').write_text(json.dumps(p['manifest'],indent=2)+'\\n')
 assert all(hashlib.sha256((r/f).read_bytes()).hexdigest()==h for f,h in p['manifest'].items())
 subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
 for _ in range(90):
  try:
   with urllib.request.urlopen('http://127.0.0.1:8001/api/v1/health',timeout=2) as q:
    assert q.status==200
   break
  except Exception:
   time.sleep(1)
 else:
  raise RuntimeError('B health failed')
 req=urllib.request.Request('http://127.0.0.1:8001/api/v1/access/session',data=b'{}',headers={'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(req,timeout=10) as q:token=json.load(q)['access_token']
 headers={'Authorization':'Bearer '+token}
 try:
  with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8001/api/v1/ready',headers=headers),timeout=10) as q:ready=json.load(q)
  assert ready['status']=='ready'
  m=json.loads((r/'data/atlas/perineum-schematic-v1/manifest.json').read_text())
  body=(r/'data/body/perineum-v1.json').read_bytes()
  identity={'template_id':m['templateId'],'template_version':m['templateVersion'],'geometry_id':m['geometryId'],'region_set_id':m['regionSetId'],'atlas_id':m['atlasId'],'atlas_version':m['atlasVersion'],'atlas_content_sha256':m['contentSHA256'],'body_content_sha256':hashlib.sha256(body).hexdigest(),'coordinate_system':'normalized_2d_top_left'}
  coordinates=[[[
   {'x':.139,'y':.199},
   {'x':.141,'y':.199},
   {'x':.141,'y':.201},
   {'x':.139,'y':.201},
   {'x':.139,'y':.199},
  ]]]
  payload={'request_id':'V67_RUNTIME_SMOKE','annotation_revision':1,'identity':identity,'lesions':[{'id':'SYNTHETIC_S2','view':'perineum-overview','geometry':{'type':'MultiPolygon','coordinateSpace':'body_template_normalized_v1','coordinates':coordinates}}]}
  req=urllib.request.Request('http://127.0.0.1:8001/api/v1/evaluate',data=json.dumps(payload).encode(),headers={**headers,'Content-Type':'application/json'},method='POST')
  with urllib.request.urlopen(req,timeout=20) as q:result=json.load(q)
  assert [c['label'] for c in result['views'][0]['candidates']]==['S2']
  assert result['source']['atlas_type']=='SCHEMATIC'
 finally:
  try:urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8001/api/v1/access/session',headers=headers,method='DELETE'),timeout=10).close()
  except Exception:pass
 subprocess.run(['systemctl','is-active','--quiet','acupuncture'],check=True)
 subprocess.run(['systemctl','is-active','--quiet','nginx'],check=True)
 print(json.dumps({'status':'APPLIED','changedFiles':len(p['changed']),'backup':str(b),'runtime_perineum_labels':['S2']}))
except Exception:
 if stopped:
  subprocess.run(['systemctl','stop','dermatome'],check=False,timeout=65)
  for f in p['changed']:
   if f not in p['new']:
    shutil.copy2(b/f,r/f)
   elif (r/f).exists():
    (r/f).unlink()
  shutil.copy2(b/'deployment/release-manifest.json',r/'deployment/release-manifest.json')
  subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
  print('B-only rollback applied')
 raise
""".replace("PLAN", repr(json.dumps(plan)))
result = remote("sudo -n python3 -", apply_remote.encode(), timeout=240).decode()
(OUT / "apply.log").write_text(result)
print(result, flush=True)
(ROOT / "deployment/release-manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n"
)

after = json.loads(
    remote("sudo -n python3 -", (ROOT / "deployment/snapshot.py").read_bytes())
)
(OUT / "after.json").write_text(json.dumps(after, indent=2) + "\n")
if before["hashes"] != after["hashes"]:
    raise SystemExit("Protected A/Nginx files changed")
for key in ("a", "nginx"):
    for field in ("MainPID", "ActiveEnterTimestamp", "NRestarts"):
        if before[key][field] != after[key][field]:
            raise SystemExit(f"Protected service changed: {key}.{field}")
print("A and Nginx unchanged; B V6.7 deployed")
