"""Expiring opaque sessions: legacy invitations or explicitly enabled public testing.

No WeChat identity is inferred from envVersion. State contains hashes only; the
existing per-photo capability is additionally bound to the issued principal.
"""
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import threading
import time
from app.services.ai_sessions import AIError

INVITATION_TTL = 10 * 60
ACCESS_TTL = 60 * 60

class TrialAccess:
    def __init__(self, root=None, clock=time.time):
        base=Path(os.getenv('AI_TEMP_ROOT', str(Path(__file__).resolve().parents[3]/'private-data')))
        self.root=Path(root) if root is not None else base/'trial-access'
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.root.chmod(0o700)
        self.clock=clock
        self.lock=threading.RLock()

    @staticmethod
    def digest(value):
        return hashlib.sha256(value.encode()).hexdigest()

    @contextmanager
    def transaction(self):
        with self.lock, (self.root/'.state-lock').open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            path=self.root/'state.json'
            if path.exists():
                if path.is_symlink() or path.stat().st_size>128*1024:raise OSError('Invalid access state')
                state=json.loads(path.read_bytes())
                if state.get('version')!=1 or set(state)!= {'version','invitations','sessions'}:raise OSError('Invalid access state')
            else:state={'version':1,'invitations':{},'sessions':{}}
            original=json.dumps(state,sort_keys=True)
            for name in ('invitations','sessions'):
                state[name]={k:v for k,v in state[name].items() if v['expires_at']>self.clock()}
            try:yield state
            finally:
                if original!=json.dumps(state,sort_keys=True):
                    temporary=path.with_suffix('.tmp')
                    temporary.write_text(json.dumps(state,allow_nan=False));temporary.chmod(0o600);temporary.replace(path)

    def issue(self):
        with self.transaction() as state:
            if len(state['invitations'])>=8:raise AIError('ACCESS_CAPACITY','待使用的体验邀请已满，请稍后重试',429)
            code=secrets.token_urlsafe(32);expires=self.clock()+INVITATION_TTL
            state['invitations'][self.digest(code)]={'expires_at':expires}
            return {'invitation':code,'expires_at':expires,'single_use':True}

    def exchange(self,code):
        with self.transaction() as state:
            digest=self.digest(code)
            if not re.fullmatch(r'[A-Za-z0-9_-]{40,128}',code) or digest not in state['invitations']:
                raise AIError('INVITATION_INVALID','体验邀请码无效或已过期，请联系邀请人重新获取',401)
            if len(state['sessions'])>=16:raise AIError('ACCESS_CAPACITY','当前体验人数已满，请稍后重试',429)
            state['invitations'].pop(digest)
            return self._new_session(state,'invited_trial')

    def public_session(self):
        # This permits internet clients too. It provides isolation, not identity
        # verification, and stays disabled in production/default environments.
        if os.getenv('DERMATOME_ENV')!='controlled' or os.getenv('ENABLE_PUBLIC_TEST_ACCESS')!='1':
            raise AIError('PUBLIC_TEST_DISABLED','当前测试服务暂不可用',403)
        with self.transaction() as state:return self._new_session(state,'public_test')

    def _new_session(self,state,kind):
        if len(state['sessions'])>=16:raise AIError('ACCESS_CAPACITY','当前体验人数已满，请稍后重试',429)
        token=secrets.token_urlsafe(32);expires=self.clock()+ACCESS_TTL
        state['sessions'][self.digest(token)]={'principal':secrets.token_hex(16),'expires_at':expires}
        return {'access_token':token,'token_type':'Bearer','expires_at':expires,'access_kind':kind}

    def verify(self,token):
        if not re.fullmatch(r'[A-Za-z0-9_-]{40,128}',token):return None
        with self.transaction() as state:
            result=state['sessions'].get(self.digest(token))
            return dict(result) if result else None

    def revoke(self,token):
        with self.transaction() as state:state['sessions'].pop(self.digest(token),None)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Issue an invitation to a private file; never stdout.')
    parser.add_argument('action',choices=['issue'])
    parser.add_argument('--root',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    # Exclusive creation: an operator cannot accidentally overwrite an existing credential.
    fd=os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    try:
        invitation=TrialAccess(args.root).issue()
        with os.fdopen(fd,'w') as output:json.dump(invitation,output)
    except Exception:
        args.output.unlink(missing_ok=True)
        raise SystemExit('Invitation could not be issued; no credential was printed.') from None
    print('Invitation saved to the specified private file; valid for ten minutes, single use.')
