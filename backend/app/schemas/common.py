"""V0 已实现接口的健康响应和统一未实现错误格式。"""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    """健康检查只表明 V0 服务运行正常。"""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]
    project: Literal["dermatome-mapper"]
    version: Literal["v0"]


class ErrorDetail(BaseModel):
    """V0 当前唯一业务错误；后续错误码须同步文档、前端及测试。"""

    model_config = ConfigDict(extra="forbid")

    code: Literal["NOT_IMPLEMENTED", "MATCHING_DISABLED", "INVALID_INPUT", "INVALID_ANNOTATION", "VERSION_MISMATCH", "ATLAS_NOT_FOUND", "ATLAS_UNAVAILABLE", "VIEW_UNSUPPORTED", "LIMIT_EXCEEDED", "PAYLOAD_TOO_LARGE", "COMPUTATION_ERROR", "INTERNAL_ERROR"]
    message: str


class ErrorResponse(BaseModel):
    """图谱与评估占位接口共享的错误信封。"""

    model_config = ConfigDict(extra="forbid")

    error: ErrorDetail
