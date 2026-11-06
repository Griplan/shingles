"""One-off, allowlisted B update. No credentials are printed or sent publicly."""
from pathlib import Path
import subprocess,json
root=Path.cwd();out=root/'docs/validation-records/p4.2-no-invitation-20261102'
ssh=['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','acupuncture-server']
def remote(command,data=None):
    r=subprocess.run(ssh+[command],input=data,capture_output=True,timeout=90)
    if r.returncode:raise RuntimeError('B deployment operation failed: '+r.stderr.decode(errors='replace')[-800:])
    return r.stdout
plan=json.loads((out/'deployment-plan.json').read_text());old=json.loads((out/'previous-runtime-manifest.json').read_text())
assert set(plan['files'])=={'backend/app/services/access.py','backend/app/services/trial_access.py','backend/app/api/routes/access.py','deployment/rollback.md'}
backup_script='''from pathlib import Path
import hashlib,json,shutil
root=Path('/srv/dermatome-mapper')
old=json.loads(INPUT_OLD)
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==sha for p,sha in old.items()),'Runtime drift; stop and inspect'
backup=root/'deployment/backups/p42-no-invitation-20261102';backup.mkdir(mode=0o700)
for p in CHANGED+['deployment/release-manifest.json','config/service.env']:
 dest=backup/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/p,dest)
stage=root/'deployment/p42-staging';stage.mkdir(mode=0o700)
for p in CHANGED:(stage/p).parent.mkdir(parents=True,exist_ok=True)
print('B runtime verified and private backup created')
'''.replace('INPUT_OLD',repr(json.dumps(old))).replace('CHANGED',repr(plan['files']))
print(remote('sudo -n python3 -',backup_script.encode()).decode().strip())
for p in plan['files']:
    remote('sudo -n install -o root -g root -m 644 /dev/stdin /srv/dermatome-mapper/deployment/p42-staging/'+p,(root/p).read_bytes())
remote('sudo -n install -o root -g root -m 644 /dev/stdin /srv/dermatome-mapper/deployment/p42-staging/release-manifest.json',(out/'new-runtime-manifest.json').read_bytes())
apply='''from pathlib import Path
import subprocess,os,hashlib,json,shutil
root=Path('/srv/dermatome-mapper');stage=root/'deployment/p42-staging';backup=root/'deployment/backups/p42-no-invitation-20261102'
changed=CHANGED
subprocess.run(['systemctl','is-active','--quiet','acupuncture'],check=True)
manifest=json.loads((stage/'release-manifest.json').read_text())
assert all(hashlib.sha256((stage/p).read_bytes()).hexdigest()==manifest[p] for p in changed)
try:
 subprocess.run(['systemctl','stop','dermatome'],check=True,timeout=65)
 for p in changed:os.replace(stage/p,root/p)
 env=root/'config/service.env';lines=env.read_text().splitlines();lines=[l for l in lines if not l.startswith('ENABLE_PUBLIC_TEST_ACCESS=')];lines.append('ENABLE_PUBLIC_TEST_ACCESS=1')
 temporary=env.with_name('service.env.p42tmp')
 fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(chr(10).join(lines)+chr(10))
 os.replace(temporary,env);os.replace(stage/'release-manifest.json',root/'deployment/release-manifest.json')
 subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
 subprocess.run(['systemctl','is-active','--quiet','acupuncture'],check=True)
 print('B updated with explicitly enabled public-test sessions; A left running')
except Exception:
 subprocess.run(['systemctl','stop','dermatome'],check=False,timeout=65)
 for p in changed+['config/service.env','deployment/release-manifest.json']:shutil.copy2(backup/p,root/p)
 subprocess.run(['systemctl','start','dermatome'],check=True,timeout=30)
 print('B-only rollback applied')
 raise
'''.replace('CHANGED',repr(plan['files']))
print(remote('sudo -n python3 -',apply.encode()).decode().strip())
(root/'deployment/release-manifest.json').write_text((out/'new-runtime-manifest.json').read_text())
(out/'deployment-result.json').write_text(json.dumps({'status':'APPLIED','changed':plan['files'],'public_test_access':True,'rollback_backup':plan['backup'],'A_and_nginx_not_changed':True},indent=2)+'\n')
