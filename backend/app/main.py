"""Application defaults to disabled matching; health does not load an atlas."""
import os
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.api.routes import atlas, evaluate, health, ai, access
from app.services.ai_boundary import AIBoundary, lifespan
from app.services.ai_sessions import AIError
from app.utils.geometry import EvaluationError
from app.services.access import AccessBoundary, feature_enabled

MAX_REQUEST_BYTES=2*1024*1024

def error_response(code,message,status):
    return JSONResponse(status_code=status,content={'error':{'code':code,'message':message}})

def matching_enabled():
    return feature_enabled('ENABLE_REFERENCE_MATCHING')

class EvaluationBoundary:
    """Gate before parsing; bound actual bytes even without Content-Length."""
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or scope['path']!='/api/v1/evaluate' or scope['method']!='POST':
            return await self.app(scope,receive,send)
        if not matching_enabled():
            return await error_response('MATCHING_DISABLED','当前服务未启用开发测试参考匹配',403)(scope,receive,send)
        chunks=[];size=0
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            blob=message.get('body',b'');size+=len(blob)
            if size>MAX_REQUEST_BYTES:
                return await error_response('PAYLOAD_TOO_LARGE','请求超过2 MiB限制',413)(scope,receive,send)
            chunks.append(blob)
            if not message.get('more_body',False):break
        body=b''.join(chunks);consumed=False
        async def replay():
            nonlocal consumed
            if not consumed:consumed=True;return {'type':'http.request','body':body,'more_body':False}
            return await receive()
        await self.app(scope,replay,send)

app=FastAPI(lifespan=lifespan,title='带状疱疹神经皮节辅助定位系统',version='v4',description='开发测试环境的人工标注与参考图谱二维几何匹配；非诊断。')
app.add_middleware(EvaluationBoundary)
app.add_middleware(AIBoundary)
app.add_middleware(AccessBoundary)

@app.exception_handler(AIError)
async def ai_error(_request:Request,exc:AIError):
    return error_response(exc.code,exc.message,exc.status)

@app.exception_handler(EvaluationError)
async def evaluation_error(_request:Request,exc:EvaluationError):
    return error_response(exc.code,exc.message,exc.status)

@app.exception_handler(RequestValidationError)
async def invalid_request(_request:Request,exc:RequestValidationError):
    view_errors=[e for e in exc.errors() if e['loc'][-1:] == ('view',)]
    if any(e.get('input') in ('palm-left','palm-right') for e in view_errors):
        return error_response('VIEW_RETIRED','独立手掌视图已停用，请在全身正面或背面重新标注；旧坐标不会自动迁移',410)
    if view_errors:
        return error_response('VIEW_UNSUPPORTED','当前支持全身正背面、左右脚底及左右腋下视图；参考计算还需对应图谱就绪',422)
    return error_response('INVALID_INPUT','请求字段、坐标、数量或格式不合法',422)

@app.exception_handler(Exception)
async def unexpected(_request:Request,_exc:Exception):
    # Never include coordinates, request bodies or stacks in the response.
    return error_response('INTERNAL_ERROR','服务暂时无法完成计算，请稍后重试；标注仍保留',500)

app.include_router(health.router,prefix='/api/v1')
app.include_router(atlas.router,prefix='/api/v1')
app.include_router(evaluate.router,prefix='/api/v1')

app.include_router(ai.router,prefix="/api/v1")
app.include_router(access.router,prefix='/api/v1')
