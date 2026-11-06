import asyncio
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse
from app.services.ai_sessions import enabled, AISessions, AIError, MAX_UPLOAD
from app.services.access import controlled, upload_limit

@asynccontextmanager
async def lifespan(app):
    app.state.ai_sessions=None
    app.state.trial_access=None
    if controlled():
        from app.services.trial_access import TrialAccess
        app.state.trial_access=TrialAccess()
    stop=asyncio.Event();task=None
    if enabled():
        try: app.state.ai_sessions=AISessions()
        except (OSError,ImportError): pass  # Optional service failure must not disable manual matching.
        if app.state.ai_sessions:
            async def sweep():
                while not stop.is_set():
                    try: await asyncio.wait_for(stop.wait(),30)
                    except asyncio.TimeoutError: app.state.ai_sessions.sweep()
            task=asyncio.create_task(sweep())
    try: yield
    finally:
        stop.set()
        if task: await task
        if app.state.ai_sessions: app.state.ai_sessions.close()

class AIBoundary:
    def __init__(self,app):self.app=app;self.uploads=asyncio.Semaphore(2)
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or not scope['path'].startswith('/api/v1/ai/'):
            return await self.app(scope,receive,send)
        async def reject(code,message,status):
            await JSONResponse({'error':{'code':code,'message':message}},status_code=status,
                               headers={'Cache-Control':'no-store'})(scope,receive,send)
        if not enabled(): return await reject('AI_DISABLED','AI仅开放开发测试；请使用手动标注',403)
        # No cookies, public file mounts, redirects or third-party image URLs.
        async def private_send(message):
            if message['type']=='http.response.start':
                message['headers']=[*message.get('headers',[]),(b'cache-control',b'no-store, private')]
            await send(message)
        if scope['method'] not in ('POST','PUT'):
            return await self.app(scope,receive,private_send)
        limit=upload_limit()+64*1024 if scope['path'].endswith('/photo') else (256*1024 if scope['path'].endswith('/edit') else 16384)
        # Reject excess parallel uploads instead of holding their bodies indefinitely.
        if self.uploads.locked(): return await reject('AI_BUSY','服务繁忙，请稍后重试',429)
        async with self.uploads:
            chunks=[];size=0
            while True:
                message=await receive()
                if message['type']=='http.disconnect':return
                blob=message.get('body',b'');size+=len(blob)
                if size>limit:return await reject('IMAGE_TOO_LARGE','请求文件或提示超出大小限制',413)
                chunks.append(blob)
                if not message.get('more_body',False):break
            body=b''.join(chunks);consumed=False
            async def replay():
                nonlocal consumed
                if not consumed:consumed=True;return {'type':'http.request','body':body,'more_body':False}
                return await receive()
            await self.app(scope,replay,private_send)
