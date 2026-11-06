"""Small, fail-closed gate for an explicitly controlled test deployment."""
import hashlib
import hmac
import os
import time
from fastapi.responses import JSONResponse

def controlled():
    return os.getenv('DERMATOME_ENV') == 'controlled'

def feature_enabled(name):
    env = os.getenv('DERMATOME_ENV', 'production')
    allowed = env in ('development', 'test') or (controlled() and len(os.getenv('API_ACCESS_SHA256', '')) == 64)
    return allowed and os.getenv(name) == '1'

def upload_limit():
    return (10 if controlled() else 20) * 1024 * 1024

class AccessBoundary:
    def __init__(self, app):
        self.app = app
        self.window = 0
        self.requests = self.creations = 0
        self.exchange_window=0
        self.exchange_attempts=0

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or not controlled():
            return await self.app(scope, receive, send)
        async def reject(code, message, status):
            return await JSONResponse({'error': {'code': code, 'message': message}}, status_code=status,
                headers={'Cache-Control': 'no-store', 'Retry-After': '60'})(scope, receive, send)
        path = scope['path']
        if path == '/api/v1/health' and scope['method'] == 'GET':
            return await self.app(scope, receive, send)
        if not path.startswith('/api/v1/'):
            return await reject('NOT_FOUND', '接口不存在', 404)
        headers = dict(scope.get('headers', []))
        # No browser cross-origin access. Native mini-program requests have no Origin.
        if b'origin' in headers:
            return await reject('ORIGIN_DENIED', '不允许跨站访问', 403)
        # Bounded session opening. Public test mode is an explicit server opt-in,
        # never an assertion supplied by envVersion or phone debugging state.
        if path in ('/api/v1/access/exchange','/api/v1/access/session') and scope['method']=='POST':
            now=int(time.monotonic()//60)
            if now!=self.exchange_window:self.exchange_window,self.exchange_attempts=now,0
            self.exchange_attempts+=1
            if self.exchange_attempts>10:return await reject('RATE_LIMITED','开通请求过于频繁，请稍后重试',429)
            chunks=[];size=0
            while True:
                message=await receive()
                if message['type']=='http.disconnect':return
                blob=message.get('body',b'');size+=len(blob)
                if size>4096:return await reject('PAYLOAD_TOO_LARGE','开通请求超过大小限制',413)
                chunks.append(blob)
                if not message.get('more_body',False):break
            body=b''.join(chunks);consumed=False
            async def replay():
                nonlocal consumed
                if not consumed:consumed=True;return {'type':'http.request','body':body,'more_body':False}
                return await receive()
            async def exchange_send(message):
                if message['type']=='http.response.start':message['headers']=[*message.get('headers',[]),(b'cache-control',b'no-store, private')]
                await send(message)
            return await self.app(scope,replay,exchange_send)
        expected = os.getenv('API_ACCESS_SHA256', '')
        supplied = headers.get(b'x-test-access-key', b'')
        operator=len(expected)==64 and 0<len(supplied)<=512 and hmac.compare_digest(hashlib.sha256(supplied).hexdigest(),expected)
        bearer=headers.get(b'authorization',b'')
        principal=None
        if bearer.startswith(b'Bearer '):
            try:token=bearer[7:].decode('ascii')
            except UnicodeDecodeError:return await reject('TRIAL_ACCESS_REQUIRED','体验访问无效，请重新开通',401)
            try:
                service=getattr(scope['app'].state,'trial_access',None)
                principal=service.verify(token) if service else None
            except (OSError,ValueError,KeyError,TypeError):return await reject('ACCESS_UNAVAILABLE','当前测试服务暂不可用',503)
            if not principal:return await reject('TRIAL_ACCESS_REQUIRED','体验访问已过期或失效，请重新开通',401)
        if not operator and not principal:
            return await reject('ACCESS_DENIED', '受控测试服务，请先填写有效访问凭据', 401)
        scope['trial_principal']=principal['principal'] if principal else None
        now = int(time.monotonic() // 60)
        if now != self.window:
            self.window, self.requests, self.creations = now, 0, 0
        self.requests += 1
        if path == '/api/v1/ai/sessions' and scope['method'] == 'POST':
            self.creations += 1
            if self.creations > 8:
                return await reject('RATE_LIMITED', '新建照片过于频繁，请稍后重试', 429)
        if self.requests > 120:
            return await reject('RATE_LIMITED', '请求过于频繁，请稍后重试', 429)
        async def private_send(message):
            if message['type'] == 'http.response.start':
                message['headers'] = [*message.get('headers', []), (b'cache-control', b'no-store, private'),
                                      (b'x-content-type-options', b'nosniff')]
            await send(message)
        return await self.app(scope, receive, private_send)
