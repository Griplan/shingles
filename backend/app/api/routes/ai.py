"""Development-only capability sessions. Tokens are headers, never query strings."""
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from app.schemas.ai import SessionCreated, PhotoUploaded, SegmentRequest, SegmentResponse, ConfirmRequest, ConfirmedPhoto, EditRequest, EditedCandidate
from app.services.ai_sessions import AIError, MAX_UPLOAD, TIMEOUT

router=APIRouter(prefix='/ai/sessions',tags=['ai-development'])
def runtime(request):
    service=getattr(request.app.state,'ai_sessions',None)
    if service is None: raise AIError('AI_UNAVAILABLE','当前后端未配置AI运行环境，仍可使用手动标注',503)
    return service

def auth(request,sid):
    service=runtime(request);token=request.headers.get('x-ai-session-key','')
    with service.lock:
        s=service.get(sid,token)
        if s.get('owner_id')!=request.scope.get('trial_principal'):
            raise AIError('AI_SESSION_GONE','照片会话无效或已过期，请重新上传',410)
    return service,token

@router.post('',response_model=SessionCreated)
def create(request:Request): return runtime(request).create(request.scope.get('trial_principal'))

@router.post('/{sid}/photo',response_model=PhotoUploaded)
async def upload(sid:str,request:Request):
    service,token=auth(request,sid)
    try:
        async with request.form(max_files=1,max_fields=0,max_part_size=MAX_UPLOAD) as form:
            file=form.get('file')
            if len(form)!=1 or not hasattr(file,'read'): raise AIError('INVALID_IMAGE','请上传单张图片')
            data=await file.read(MAX_UPLOAD+1)
            return await run_in_threadpool(service.upload,sid,token,data)
    except AIError: raise
    except ImportError: raise AIError('AI_UNAVAILABLE','AI上传依赖未安装，仍可使用手动标注',503) from None
    except Exception: raise AIError('INVALID_IMAGE','无法读取照片，请检查文件格式和大小') from None

@router.post('/{sid}/segment',response_model=SegmentResponse)
async def segment(sid:str,payload:SegmentRequest,request:Request):
    service,token=auth(request,sid)
    try:
        return await asyncio.wait_for(asyncio.to_thread(service.segment,sid,token,payload),TIMEOUT)
    except asyncio.TimeoutError:
        service.invalidate(sid,token,payload.request_id)
        raise AIError('AI_TIMEOUT','AI处理超时，请稍后重试',504) from None

@router.post('/{sid}/confirm',response_model=ConfirmedPhoto)
def confirm(sid:str,payload:ConfirmRequest,request:Request):
    service,token=auth(request,sid);return service.confirm(sid,token,payload)

@router.post('/{sid}/edit',response_model=EditedCandidate)
async def edit(sid:str,payload:EditRequest,request:Request):
    service,token=auth(request,sid)
    try:
        return await asyncio.wait_for(asyncio.to_thread(service.edit,sid,token,payload),TIMEOUT)
    except asyncio.TimeoutError:
        # Full history + revision makes a retry idempotent even if the worker finished.
        raise AIError('AI_TIMEOUT','修正处理超时，请重试本次修正',504) from None

@router.get('/{sid}/assets/{name}')
def asset(sid:str,name:str,request:Request,result_id:str|None=None):
    service,token=auth(request,sid)
    return Response(service.asset(sid,token,name,result_id),media_type='image/png',headers={
        'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'})

@router.delete('/{sid}',status_code=204)
def delete(sid:str,request:Request):
    service,token=auth(request,sid);service.delete(sid,token);return Response(status_code=204)
