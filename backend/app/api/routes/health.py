"""V0 可用性检查，不代表图谱或医学映射已就绪。"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import hashlib
import json

from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="服务健康检查")
def get_health() -> HealthResponse:
    return HealthResponse(status="ok", project="dermatome-mapper", version="v0")

@router.get('/ready', summary='受控服务技术就绪状态（不代表医学审核）')
def ready(request:Request):
    from app.services.atlas_service import ATLAS_DIR, BODY_FILE, ATLAS_ID, ATLAS_VERSION, load_dataset
    from app.schemas.evaluate import Identity
    from app.services.access import feature_enabled
    try:
        manifest=json.loads((ATLAS_DIR/'manifest.json').read_bytes())
        body=BODY_FILE.read_bytes(); front=json.loads(body)['views']['front']
        identity=Identity(template_id=manifest['templateId'],template_version=manifest['templateVersion'],
            geometry_id=manifest['geometryId'],region_set_id=front['regionSetId'],atlas_id=ATLAS_ID,
            atlas_version=ATLAS_VERSION,atlas_content_sha256=manifest['contentSHA256'],
            body_content_sha256=hashlib.sha256(body).hexdigest(),coordinate_system='normalized_2d_top_left')
        load_dataset(identity)
    except Exception:
        return JSONResponse({'error':{'code':'ATLAS_UNAVAILABLE','message':'图谱技术校验未通过'}},status_code=503)
    service=getattr(request.app.state,'ai_sessions',None)
    if not feature_enabled('ENABLE_REFERENCE_MATCHING') or service is None:
        return JSONResponse({'error':{'code':'SERVICE_UNAVAILABLE','message':'服务尚未就绪'}},status_code=503)
    return {'status':'ready','identity':identity.model_dump(),'ai_model_loaded':service.model is not None,
            'ai_device':'cpu','medical_review':'pending','diagnosis_enabled':False}
