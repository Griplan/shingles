"""Bounded matching-data sync for existing B only; unchanged config, AI, Nginx and A."""
from pathlib import Path
import subprocess,json,hashlib,io,tarfile
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
SSH=['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','ConnectTimeout=10','acupuncture-server']
def remote(command,data=None,timeout=120):
 p=subprocess.run(SSH+[command],input=data,capture_output=True,timeout=timeout)
 if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1200:] or p.stdout.decode(errors='replace')[-1200:])
 return p.stdout
old=json.loads((OUT/'server-before.json').read_text());assert old['actual']==old['recorded']
files=['backend/app/__init__.py','backend/app/services/__init__.py','backend/app/schemas/__init__.py','backend/app/main.py','backend/app/schemas/evaluate.py','backend/app/services/atlas_service.py','backend/app/services/dermatome_matcher.py','backend/app/services/local_atlas_service.py','backend/app/services/sole_atlas_service.py','miniprogram/assets/body/commons-v1.ts','miniprogram/data/body-models.ts','miniprogram/data/body-hands.generated.ts','data/body/commons-template4-hands-v2.json','data/body/sole-v1.json','data/body/sole-resource.json']
files+=sorted(str(p.relative_to(ROOT)) for folder in ['data/atlas/goran-2022-preview-v3','data/atlas/sole-v1'] for p in (ROOT/folder).iterdir() if p.is_file())
assert all(not p.startswith(('ai/','private-data/','config/')) for p in files)
manifest={**old['actual'],**{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files}}
plan={'files':files,'existing_changed':[p for p in files if p in old['actual'] and old['actual'][p]!=manifest[p]],'new':[p for p in files if p not in old['actual']],'backup':'/srv/dermatome-mapper/deployment/backups/v65-hand-20261105','no_config_or_model_or_nginx_changes':True,'previous':old['actual'],'manifest':manifest}
(OUT/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as archive:
 for p in files:archive.add(ROOT/p,arcname=p,recursive=False)
 blob=(json.dumps(manifest,indent=2)+'\n').encode();info=tarfile.TarInfo('deployment/release-manifest.json');info.size=len(blob);info.mode=0o644;archive.addfile(info,io.BytesIO(blob))
prep='''from pathlib import Path
import hashlib,json,shutil,subprocess
r=Path('/srv/dermatome-mapper');plan=json.loads(PLAN)
assert all(hashlib.sha256((r/p).read_bytes()).hexdigest()==h for p,h in plan['previous'].items()),'Runtime drift'
assert subprocess.check_output(['systemctl','is-active','acupuncture'],text=True).strip()=='active'
b=r/'deployment/backups/v65-hand-20261105';b.mkdir(mode=0o700)
for p in plan['existing_changed']+['deployment/release-manifest.json']:
 d=b/p;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/p,d)
(r/'deployment/v65-hand-staging').mkdir(mode=0o755)
print('Pinned old release verified; B-only rollback backup created')
'''.replace('PLAN',repr(json.dumps(plan)))
print(remote('sudo -n python3 -',prep.encode()).decode().strip())
# The archive is made only from the fixed allowlist above; no workspace or secrets tarball.
remote('sudo -n tee /srv/dermatome-mapper/deployment/v65-hand-staging/package.tgz >/dev/null',buf.getvalue())
apply='''from pathlib import Path
import hashlib,json,tarfile,subprocess,os,shutil,time,urllib.request
r=Path('/srv/dermatome-mapper');s=r/'deployment/v65-hand-staging';b=r/'deployment/backups/v65-hand-20261105';plan=json.loads(PLAN)
with tarfile.open(s/'package.tgz') as t:
 assert {m.name for m in t.getmembers()}==set(plan['files']+['deployment/release-manifest.json'])
 assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in t.getmembers())
 t.extractall(s,filter='data')
for p in plan['files']:
 assert hashlib.sha256((s/p).read_bytes()).hexdigest()==plan['manifest'][p],p
 if p.endswith('.py'):compile((s/p).read_text(),p,'exec')
# Validate actual full-body and sole datasets against staged data and existing Linux dependencies.
validate="""import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,STAGE+'/backend')
import app
app.__path__.append('/srv/dermatome-mapper/backend/app') # unchanged helpers from installed release
from app.services import atlas_service
assert str(atlas_service.ROOT)==STAGE, 'Staged validation loaded the old module'
from app.services.atlas_service import load_dataset
from app.schemas.evaluate import Identity
r=Path(STAGE)
for atlas,body,aid in [('goran-2022-preview-v3','commons-template4-hands-v2.json','goran-2022'),('sole-v1','sole-v1.json','goran-sole-v1')]:
 m=json.loads((r/'data/atlas'/atlas/'manifest.json').read_text());bb=(r/'data/body'/body).read_bytes();d=json.loads(bb);fb=d['views'].get('front',d)
 i=Identity(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=fb['regionSetId'],atlas_id=aid,atlas_version=m['atlasVersion'],atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256(bb).hexdigest(),coordinate_system='normalized_2d_top_left')
 ds=load_dataset(i);print(aid,len(ds.regions),'valid')
""".replace('STAGE',repr(str(s)))
subprocess.run([str(r/'.venv/bin/python'),'-c',validate],check=True,timeout=30)
assert all(hashlib.sha256((r/p).read_bytes()).hexdigest()==h for p,h in plan['previous'].items()),'Runtime drift before apply'
stopped=False
try:
 subprocess.run(['systemctl','stop','dermatome'],check=True,timeout=65);stopped=True
 for p in plan['files']:
  dest=r/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(s/p,dest);os.chmod(dest,0o644)
 shutil.copyfile(s/'deployment/release-manifest.json',r/'deployment/release-manifest.json');os.chmod(r/'deployment/release-manifest.json',0o644)
 assert all(hashlib.sha256((r/p).read_bytes()).hexdigest()==h for p,h in plan['manifest'].items()),'Release verification failed'
 subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
 for _ in range(30):
  try:
   with urllib.request.urlopen('http://127.0.0.1:8001/api/v1/health',timeout=2) as q:assert q.status==200
   break
  except Exception:time.sleep(.5)
 else:raise RuntimeError('B health failed after restart')
 # Bounded guest capability to verify runtime identity; no token leaves memory.
 req=urllib.request.Request('http://127.0.0.1:8001/api/v1/access/session',data=b'{}',headers={'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(req,timeout=10) as q:token=json.load(q)['access_token']
 headers={'Authorization':'Bearer '+token}
 try:
  with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8001/api/v1/ready',headers=headers),timeout=10) as q:ready=json.load(q)
  assert ready['identity']['atlas_version']=='goran-2022-commons-template4-preview.3'
  assert ready['identity']['template_version']=='4.0.1'
 finally:
  urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8001/api/v1/access/session',headers=headers,method='DELETE'),timeout=10).close()
 subprocess.run(['systemctl','is-active','--quiet','acupuncture'],check=True)
 print(json.dumps({'status':'APPLIED','identity':ready['identity'],'service':'dermatome','files':len(plan['files'])}))
except Exception:
 if stopped:
  subprocess.run(['systemctl','stop','dermatome'],check=False,timeout=65)
  for p in plan['existing_changed']+['deployment/release-manifest.json']:shutil.copy2(b/p,r/p)
  # New inert files remain as evidence; restored old loader cannot reference them.
  subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
  print('B-only rollback applied')
 raise
'''.replace('PLAN',repr(json.dumps(plan)))
result=remote('sudo -n python3 -',apply.encode(),timeout=180).decode();print(result.strip());(OUT/'apply.log').write_text(result)
(ROOT/'deployment/release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
