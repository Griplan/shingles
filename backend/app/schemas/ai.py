"""Photo-space contract, intentionally incompatible with evaluate/template coordinates."""
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator
from typing import Annotated

Unit = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False, strict=True)]
class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')
class PhotoPoint(StrictModel):
    x: Unit
    y: Unit
    label: Annotated[StrictInt, Field(ge=0, le=1)]
    @model_validator(mode='after')
    def inside(self):
        if self.x == 1 or self.y == 1: raise ValueError('Point must be inside pixel domain')
        return self
class PhotoBox(StrictModel):
    xMin: Unit
    yMin: Unit
    xMax: Unit
    yMax: Unit
    @model_validator(mode='after')
    def ordered(self):
        if self.xMin >= self.xMax or self.yMin >= self.yMax: raise ValueError('Empty box')
        return self
class PhotoPrompts(StrictModel):
    coordinate_space: Literal['photo_oriented_normalized_v1']
    points: list[PhotoPoint] = Field(default_factory=list, max_length=64)
    box: PhotoBox | None = None
    additional_boxes: list[PhotoBox] = Field(default_factory=list,max_length=3)
    @model_validator(mode='after')
    def valid_prompt(self):
        if self.box is None and not any(p.label == 1 for p in self.points): raise ValueError('No foreground')
        if self.additional_boxes and self.box is None: raise ValueError('Additional regions require initial box')
        return self
class SegmentRequest(StrictModel):
    photo_id: str = Field(pattern=r'^[a-f0-9]{32}$')
    request_id: str = Field(min_length=1,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
    prompt_revision: Annotated[StrictInt,Field(ge=0,le=1_000_000)]
    prompts: PhotoPrompts
    strategy: Literal['context_crop','full_image'] = 'context_crop'
class ConfirmRequest(StrictModel):
    photo_id: str
    result_id: str
    candidate_id: str
    prompt_revision: StrictInt
    edit_revision: Annotated[StrictInt,Field(ge=0,le=1_000_000)] = 0
class BrushPoint(StrictModel):
    x: Unit
    y: Unit
class BrushStroke(StrictModel):
    mode: Literal['add','erase']
    radius: Annotated[float,Field(ge=.001,le=.1,allow_inf_nan=False,strict=True)]
    points: list[BrushPoint] = Field(min_length=1,max_length=256)
class EditRequest(ConfirmRequest):
    coordinate_space: Literal['photo_oriented_normalized_v1']
    edit_revision: Annotated[StrictInt,Field(ge=1,le=1_000_000)]
    strokes: list[BrushStroke] = Field(max_length=32)
    @model_validator(mode='after')
    def bounded(self):
        if sum(len(s.points) for s in self.strokes)>4096:raise ValueError('Too many brush points')
        return self
class SessionCreated(StrictModel):
    session_id: str
    session_token: str
    expires_at: float
    development_only: Literal[True] = True
class PhotoUploaded(StrictModel):
    session_id: str
    photo_id: str
    image: dict[str,Any]
    expires_at: float
class Candidate(StrictModel):
    candidate_id: str
    status: str
    area_ratio: float
    outside_box_ratio: float | None
    component_count: int
    hole_count: int
    warnings: list[str]
    display_priority: int = 0
    edit_revision: int = 0
    quality: dict[str,Any] = Field(default_factory=dict)
class EditedCandidate(StrictModel):
    session_id: str
    photo_id: str
    result_id: str
    prompt_revision: int
    coordinate_space: Literal['photo_oriented_normalized_v1']
    candidate: Candidate
class SegmentResponse(StrictModel):
    session_id: str
    photo_id: str
    result_id: str
    request_id: str
    prompt_revision: int
    coordinate_space: Literal['photo_oriented_normalized_v1']
    status: str
    candidates: list[Candidate]
    expires_at: float
class PhotoGeometry(StrictModel):
    type: Literal['MultiPolygon']
    coordinates: list[list[list[tuple[float,float]]]]
class ConfirmedPhoto(StrictModel):
    schema_version: Literal['confirmed-photo-segmentation-v1']
    session_id: str
    photo_id: str
    result_id: str
    candidate_id: str
    prompt_revision: int
    coordinate_space: Literal['photo_oriented_normalized_v1']
    confirmed_by_user: Literal[True]
    confirmed_at: float
    expires_at: float
    image: dict[str,Any]
    model: dict[str,Any]
    prompts: PhotoPrompts
    geometry: PhotoGeometry
    mask_asset: str
    mask_sha256: str
    correction: dict[str,Any] | None = None
