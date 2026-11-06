"""Issue a single-use trial invitation via existing admin SSH; never print its value."""
from pathlib import Path
import json
import os
import secrets
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[1]
private=ROOT/'private-data';private.mkdir(exist_ok=True,mode=0o700);private.chmod(0o700)
name='trial-invitation-'+time.strftime('%Y%m%d-%H%M%S')+'-'+secrets.token_hex(4)+'.json'
output=private/name
remote='/srv/dermatome-mapper/runtime/'+name
ssh=['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','acupuncture-server']
fd=None
try:
    fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    command='sudo -n -u dermatome env AI_TEMP_ROOT=/srv/dermatome-mapper/runtime/uploads PYTHONPATH=/srv/dermatome-mapper:/srv/dermatome-mapper/backend /srv/dermatome-mapper/.venv/bin/python -m app.services.trial_access issue --output '+remote
    subprocess.run(ssh+[command],check=True,capture_output=True,timeout=20)
    result=subprocess.run(ssh+['sudo -n cat '+remote],check=True,capture_output=True,timeout=15)
    record=json.loads(result.stdout)
    if not isinstance(record.get('invitation'),str) or not record.get('single_use') or record['expires_at']<=time.time():raise ValueError('Invalid invitation')
    with os.fdopen(fd,'wb') as file:file.write(result.stdout)
    fd=None
    subprocess.run(ssh+['sudo -n -u dermatome rm -- '+remote],check=True,capture_output=True,timeout=15)
except Exception:
    if fd is not None:os.close(fd)
    # Keep a nonempty downloaded invitation if only remote cleanup failed.
    if output.exists() and output.stat().st_size==0:output.unlink()
    print('签发未全部完成，请检查SSH权限或服务状态；凭据未输出到终端。',file=sys.stderr)
    raise SystemExit(1)
print('一次性体验邀请码已保存（10分钟内有效，使用后失效）：\n'+str(output))
print('仅通过可信方式交给指定体验成员；不要提交Git或粘贴到公开聊天。')
