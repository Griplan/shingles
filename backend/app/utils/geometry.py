"""Independent input validation. Never repair, clip, snap or reorder annotations."""
from shapely.geometry import Polygon, MultiPolygon

class EvaluationError(Exception):
    def __init__(self, code, message, status=422):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)

MIN_AREA = 1e-10
POINT_EPSILON = 1e-12

def annotation_polygon(vertices, body):
    points = [(p.x, p.y) for p in vertices]
    same = lambda a,b: abs(a[0]-b[0]) <= POINT_EPSILON and abs(a[1]-b[1]) <= POINT_EPSILON
    if len(points)>1 and same(points[0], points[-1]): points.pop()
    if not 3 <= len(points) <= 128:
        raise EvaluationError('INVALID_ANNOTATION', '每片需要3至128个有效顶点')
    if any(same(a,b) for i,a in enumerate(points) for b in points[i+1:]):
        raise EvaluationError('INVALID_ANNOTATION', '标注包含重复顶点')
    poly=Polygon(points)
    if not poly.is_valid or poly.area <= MIN_AREA:
        raise EvaluationError('INVALID_ANNOTATION', '标注自交、退化或面积过小，请返回编辑')
    if not body.covers(poly):
        raise EvaluationError('INVALID_ANNOTATION', '标注跨出人体有效轮廓，请返回编辑；不会自动裁切')
    return poly

def annotation_geometry(lesion, body):
    """Both sources use identical geometry; never read photo/model/source metadata."""
    if lesion.vertices is not None:
        return annotation_polygon(lesion.vertices, body)
    geometry = lesion.geometry
    ringsets = [geometry.coordinates] if geometry.type == 'Polygon' else geometry.coordinates
    polygons = []
    for rings in ringsets:
        converted = []
        for ring in rings:
            points = [(p.x, p.y) for p in ring]
            if points[0] != points[-1] or len(set(points[:-1])) != len(points)-1:
                raise EvaluationError('INVALID_ANNOTATION', '完整轮廓必须闭合且无重复顶点')
            converted.append(points)
        polygon = Polygon(converted[0], converted[1:])
        if not polygon.is_valid or polygon.area <= 0:
            raise EvaluationError('INVALID_ANNOTATION', '病灶片区或孔洞无效，不会自动修复')
        polygons.append(polygon)
    shape = MultiPolygon(polygons) if geometry.type == 'MultiPolygon' else polygons[0]
    if not shape.is_valid or shape.area <= 0:
        raise EvaluationError('INVALID_ANNOTATION', '病灶片区重叠或拓扑无效，不会合并或裁切')
    if not body.covers(shape):
        raise EvaluationError('INVALID_ANNOTATION', '标注跨出人体有效轮廓，请返回编辑；不会自动裁切')
    return shape
