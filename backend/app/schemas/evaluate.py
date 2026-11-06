"""V4 reference geometry contract; no diagnosis or patient identity fields."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

# Each identifier is an independent template coordinate surface, not a crop of front/back.
View = Literal['front', 'back', 'sole-left', 'sole-right', 'axilla-left', 'axilla-right']
Identifier = Annotated[str, Field(strict=True, min_length=1, max_length=160)]
Digest = Annotated[str, Field(strict=True, pattern=r'^[0-9a-f]{64}$')]
Coordinate = Annotated[float, Field(strict=True, ge=0, le=1, allow_inf_nan=False)]

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')

class Point(StrictModel):
    x: Coordinate
    y: Coordinate

class Identity(StrictModel):
    template_id: Identifier
    template_version: Identifier
    geometry_id: Identifier
    region_set_id: Identifier
    atlas_id: Identifier
    atlas_version: Identifier
    atlas_content_sha256: Digest
    body_content_sha256: Digest
    coordinate_system: Literal['normalized_2d_top_left']

Ring = Annotated[list[Point], Field(min_length=4, max_length=20000)]
PolygonRings = Annotated[list[Ring], Field(min_length=1, max_length=4096)]

class PolygonGeometry(StrictModel):
    type: Literal['Polygon']
    coordinateSpace: Literal['body_template_normalized_v1']
    coordinates: PolygonRings

class MultiPolygonGeometry(StrictModel):
    type: Literal['MultiPolygon']
    coordinateSpace: Literal['body_template_normalized_v1']
    coordinates: Annotated[list[PolygonRings], Field(min_length=1, max_length=1024)]

class Lesion(StrictModel):
    id: Identifier
    view: View
    # 128 distinct vertices, plus optional equivalent closure.
    vertices: Annotated[list[Point], Field(min_length=3, max_length=129)] | None = None
    geometry: Annotated[PolygonGeometry | MultiPolygonGeometry, Field(discriminator='type')] | None = None
    source: Literal['manual', 'ai_assisted'] = 'manual'

    @model_validator(mode='after')
    def exclusive_geometry(self):
        if (self.vertices is None) == (self.geometry is None):
            raise ValueError('Provide exactly one geometry representation')
        if self.vertex_count() > 20000:
            raise ValueError('A lesion may contain at most 20000 vertices')
        return self

    def vertex_count(self):
        if self.vertices is not None:
            return len(self.vertices)
        polygons = [self.geometry.coordinates] if self.geometry.type == 'Polygon' else self.geometry.coordinates
        return sum(len(ring) for polygon in polygons for ring in polygon)

class EvaluateRequest(StrictModel):
    request_id: Identifier
    annotation_revision: Annotated[int, Field(strict=True, ge=0)]
    identity: Identity
    lesions: Annotated[list[Lesion], Field(min_length=1, max_length=40)]

    @model_validator(mode='after')
    def geometry_budget(self):
        if sum(lesion.vertex_count() for lesion in self.lesions) > 40000:
            raise ValueError('Request geometry exceeds the processing limit')
        return self

class Candidate(StrictModel):
    candidate_id: str
    region_ids: list[str]
    partition_type: str
    label: str
    source_label: str
    display_name: str
    side: str
    view: View
    intersection_area: float
    lesion_coverage_ratio: float

class Coverage(StrictModel):
    view: View
    lesion_ids: list[str]
    annotation_area: float
    covered_area: float
    uncovered_area: float
    covered_ratio: float
    uncovered_ratio: float
    coverage_status: Literal['full', 'partial', 'none']
    candidates: list[Candidate]

class SourceInfo(StrictModel):
    atlas_type: Literal['SCHEMATIC'] | None = None
    review_status: Literal['NOT_MEDICALLY_VALIDATED'] | None = None
    intended_use: Literal['INTERACTIVE_SIMULATION'] | None = None
    source_type: Literal['ARTIFICIALLY_CONSTRUCTED'] | None = None
    disclaimer: str | None = None
    atlas_status: Literal['PROVISIONAL'] | None = None
    uncertainty_level: Literal['HIGH'] | None = None
    title: str
    url: str
    attribution: str
    license: str
    medical_review_status: Literal['pending']
    preview: Literal[True]
    coverage_note: str

class EvaluateResponse(StrictModel):
    request_id: str
    annotation_revision: int
    identity: Identity
    method: Literal['manual_annotation_reference_geometry']
    area_unit: Literal['normalized_template_area']
    source: SourceInfo
    lesions: list[Coverage]
    views: list[Coverage]
    warnings: list[str]
