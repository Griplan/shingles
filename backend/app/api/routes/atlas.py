"""图谱查询占位；V4 接口集成前不提供医学图谱。"""

from fastapi import APIRouter, status

from app.schemas.common import ErrorDetail, ErrorResponse

router = APIRouter(tags=["atlas"])


@router.get(
    "/atlas",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    response_model=ErrorResponse,
    response_description="V0 图谱查询尚未实现",
    summary="图谱查询（未实现）",
)
def get_atlas() -> ErrorResponse:
    return ErrorResponse(
        error=ErrorDetail(
            code="NOT_IMPLEMENTED",
            message="图谱查询尚未实现；V0 不提供可用于医学映射的图谱。",
        )
    )
