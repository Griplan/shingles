"""Temporary sessions; public test opening requires an explicit server switch."""
from fastapi import APIRouter, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from app.services.ai_sessions import AIError

router=APIRouter(prefix='/access',tags=['controlled-access'])
class ExchangeRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    invitation:str=Field(min_length=1,max_length=128)

class PublicTestRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')

def runtime(request):
    service=getattr(request.app.state,'trial_access',None)
    if service is None:raise AIError('ACCESS_UNAVAILABLE','当前测试服务暂不可用',503)
    return service

@router.post('/exchange')
def exchange(payload:ExchangeRequest,request:Request):
    return runtime(request).exchange(payload.invitation)

@router.post('/session')
def public_session(payload:PublicTestRequest,request:Request):
    return runtime(request).public_session()

@router.delete('/session',status_code=204)
def revoke(request:Request):
    authorization=request.headers.get('authorization','')
    if not authorization.startswith('Bearer '):raise AIError('TRIAL_ACCESS_REQUIRED','请先开通体验访问',401)
    runtime(request).revoke(authorization[7:])
    return Response(status_code=204)
