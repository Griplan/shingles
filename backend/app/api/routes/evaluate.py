"""V4 guarded reference matching; original atlas review state remains unchanged."""
from fastapi import APIRouter
from app.schemas.common import ErrorResponse
from app.schemas.evaluate import EvaluateRequest, EvaluateResponse
from app.services.atlas_service import load_dataset
from app.services.dermatome_matcher import evaluate

router=APIRouter(tags=['evaluate'])

@router.post('/evaluate',response_model=EvaluateResponse,response_model_exclude_none=True,responses={code:{'model':ErrorResponse} for code in (403,404,409,413,422,500,503)},summary='人工确认的人体标注与参考图谱几何匹配（仅显式启用的开发测试服务）')
def evaluate_annotations(payload: EvaluateRequest):
    dataset=load_dataset(payload.identity)
    result=evaluate(payload,dataset)
    if dataset.manifest.get('atlasStatus')=='PROVISIONAL':
        result.source=result.source.model_copy(update={'atlas_status':'PROVISIONAL','uncertainty_level':'HIGH'})
        result.warnings.insert(0,dataset.manifest['coverageNote'])
    if dataset.manifest.get('atlasType')=='SCHEMATIC':
        result.source=result.source.model_copy(update={'atlas_type':'SCHEMATIC','review_status':'NOT_MEDICALLY_VALIDATED','intended_use':'INTERACTIVE_SIMULATION','source_type':'ARTIFICIALLY_CONSTRUCTED','disclaimer':dataset.manifest['coverageNote']})
        result.warnings.insert(0,dataset.manifest['coverageNote'])
    return result
