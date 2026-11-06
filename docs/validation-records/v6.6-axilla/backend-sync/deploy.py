"""User-authorized B-only update with preflight, backup and rollback. No secrets archived."""
import subprocess,json,hashlib,tarfile,io
from pathlib import Path
ROOT=Path.cwd();OUT=ROOT/'docs/validation-records/v6.6-axilla/backend-sync'
SSH=['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','ConnectTimeout=10','acupuncture-server']
def remote(command,data=None,timeout=150):
 p=subprocess.run(SSH+[command],input=data,capture_output=True,timeout=timeout)
 if p.returncode:raise RuntimeError((p.stderr+p.stdout).decode(errors='replace')[-1800:])
 return p.stdout
snapshot=(ROOT/'deployment/snapshot.py').read_bytes()
before=json.loads(remote('sudo -n python3 -',snapshot));(OUT/'before.json').write_text(json.dumps(before,indent=2))
probe=b"""from pathlib import Path
import json,hashlib
r=Path('/srv/dermatome-mapper');m=json.loads((r/'deployment/release-manifest.json').read_text());a={f:hashlib.sha256((r/f).read_bytes()).hexdigest() if (r/f).is_file() else 'missing' for f in m}
print(json.dumps({'recorded':m,'actual':a}))
"""
old=json.loads(remote('sudo -n python3 -',probe));(OUT/'server-before.json').write_text(json.dumps(old,indent=2));assert old['actual']==old['recorded'],'Server drift: refuse overwrite'
files=sorted(str(p.relative_to(ROOT)) for folder in ['backend/app','data/atlas/goran-2022-preview-v3','data/atlas/sole-v1','data/atlas/axilla-v1','data/atlas/axilla-goran-provisional-v1'] for p in (ROOT/folder).rglob('*') if p.is_file() and p.suffix in ['.py','.json'] and '__pycache__' not in p.parts)
files+=['data/body/commons-template4-hands-v2.json','data/body/sole-v1.json','data/body/sole-resource.json','data/body/axilla-v1.json','data/body/axilla-resource.json']
files+=['miniprogram/assets/body/commons-v1.ts','miniprogram/data/body-models.ts','miniprogram/data/body-hands.generated.ts']
manifest={**old['actual'],**{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}}
changed=[f for f in files if old['actual'].get(f)!=manifest[f]]
plan=dict(files=files,changed=changed,new=[f for f in changed if f not in old['actual']],previous=old['actual'],manifest=manifest,backup='/srv/dermatome-mapper/deployment/backups/v662-axilla-20261105-r2',stage='/srv/dermatome-mapper/deployment/v662-axilla-staging-r2')
(OUT/'plan.json').write_text(json.dumps(plan,indent=2));assert not any(f.startswith(('ai/','config/')) for f in changed)
print('Planned changes:',changed,flush=True)
if '--apply' not in __import__('sys').argv:raise SystemExit(0)
prepare="""import json,hashlib,shutil,subprocess
from pathlib import Path
p=json.loads(PLAN);r=Path('/srv/dermatome-mapper');b=Path(p['backup']);s=Path(p['stage'])
assert not b.exists() and not s.exists(),'Backup/staging exists; preserve prior attempt'
assert all(hashlib.sha256((r/f).read_bytes()).hexdigest()==h for f,h in p['previous'].items())
assert subprocess.check_output(['systemctl','is-active','acupuncture'],text=True).strip()=='active'
b.mkdir(mode=0o700);s.mkdir(mode=0o755)
for f in [f for f in p['changed'] if f not in p['new']]+['deployment/release-manifest.json']:
 d=b/f;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/f,d)
print('B backup created; A active')
""".replace('PLAN',repr(json.dumps(plan)))
print(remote('sudo -n python3 -',prepare.encode()).decode(),flush=True)
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for f in files:t.add(ROOT/f,arcname=f,recursive=False)
remote('sudo -n tee '+plan['stage']+'/package.tgz >/dev/null',buf.getvalue())
apply="""from pathlib import Path
import json,hashlib,tarfile,subprocess,shutil,os,time,urllib.request
p=json.loads(PLAN);r=Path('/srv/dermatome-mapper');s=Path(p['stage']);b=Path(p['backup'])
with tarfile.open(s/'package.tgz') as t:
 assert {m.name for m in t.getmembers()}==set(p['files'])
 assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in t.getmembers())
 t.extractall(s,filter='data')
for f in p['files']:
 assert hashlib.sha256((s/f).read_bytes()).hexdigest()==p['manifest'][f]
 if f.endswith('.py'):compile((s/f).read_text(),f,'exec')
validation='''import os,sys,json,hashlib
from pathlib import Path
os.environ['DERMATOME_ENV']='test';os.environ['ENABLE_REFERENCE_MATCHING']='1'
sys.path.insert(0,STAGE+'/backend')
from app.services.atlas_service import load_dataset
from app.schemas.evaluate import Identity
r=Path(STAGE)
for folder,body,region_id in [('goran-2022-preview-v3','commons-template4-hands-v2.json',None),('sole-v1','sole-v1.json',None),('axilla-goran-provisional-v1','axilla-v1.json',None)]:
 m=json.loads((r/'data/atlas'/folder/'manifest.json').read_text());blob=(r/'data/body'/body).read_bytes();d=json.loads(blob)
 i=Identity(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=m.get('regionSetId') or d['views']['front']['regionSetId'],atlas_id=m.get('atlasId','goran-2022'),atlas_version=m['atlasVersion'],atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256(blob).hexdigest(),coordinate_system='normalized_2d_top_left')
 dataset=load_dataset(i);assert str(__import__('app.services.atlas_service',fromlist=['ROOT']).ROOT)==STAGE
 print(folder,len(dataset.regions),'valid')
'''.replace('STAGE',repr(str(s)))
subprocess.run([str(r/'.venv/bin/python'),'-c',validation],check=True,timeout=30)
assert all(hashlib.sha256((r/f).read_bytes()).hexdigest()==h for f,h in p['previous'].items())
stopped=False
try:
 subprocess.run(['systemctl','stop','dermatome'],check=True,timeout=65);stopped=True
 for f in p['changed']:
  d=r/f;d.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(s/f,d);os.chmod(d,0o644)
 (r/'deployment/release-manifest.json').write_text(json.dumps(p['manifest'],indent=2)+'\\n')
 assert all(hashlib.sha256((r/f).read_bytes()).hexdigest()==h for f,h in p['manifest'].items())
 subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
 for _ in range(40):
  try:
   with urllib.request.urlopen('http://127.0.0.1:8001/api/v1/health',timeout=2) as q:assert q.status==200
   break
  except Exception:time.sleep(.5)
 else:raise RuntimeError('B health failed')
 subprocess.run(['systemctl','is-active','--quiet','acupuncture'],check=True)
 print(json.dumps({'status':'APPLIED','changedFiles':len(p['changed']),'backup':str(b)}))
except Exception:
 if stopped:
  subprocess.run(['systemctl','stop','dermatome'],check=False,timeout=65)
  for f in p['changed']:
   if f not in p['new']:shutil.copy2(b/f,r/f)
  shutil.copy2(b/'deployment/release-manifest.json',r/'deployment/release-manifest.json')
  subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
  print('B-only rollback applied; new inert data retained')
 raise
""".replace('PLAN',repr(json.dumps(plan)))
result=remote('sudo -n python3 -',apply.encode(),timeout=180).decode();(OUT/'apply.log').write_text(result);print(result,flush=True)
(ROOT/'deployment/release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
after=json.loads(remote('sudo -n python3 -',snapshot));(OUT/'after.json').write_text(json.dumps(after,indent=2))
assert before['hashes']==after['hashes'],'A/Nginx protected files changed'
for key in ['a','nginx']:
 for field in ['MainPID','ActiveEnterTimestamp','NRestarts']:assert before[key][field]==after[key][field],(key,field)
assert all(after[k].get('status')==200 for k in ['health','ready','https_health','https_ready'])
print('A/Nginx protected; B health200')
