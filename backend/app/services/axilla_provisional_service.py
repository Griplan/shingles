"""Explicit provisional registry. Original blocked axilla registry is unchanged."""
import hashlib,sys
from shapely.affinity import affine_transform
from shapely.geometry import shape
from app.services import axilla_atlas_service as original
from app.services.local_atlas_service import load_local_dataset
from app.services.access import feature_enabled
from app.utils.geometry import EvaluationError
ROOT=original.ROOT
ATLAS_ID='axilla-goran-provisional-v1';ATLAS_VERSION='goran-axilla-provisional.1'
ATLAS_DIR=ROOT/'data/atlas/axilla-goran-provisional-v1'
BODY_FILE=original.BODY_FILE;RESOURCE_KEY=original.RESOURCE_KEY;RESOURCE_FILE=original.RESOURCE_FILE
VIEWS=original.VIEWS;INPUTS=original.INPUTS;BASIS=original.BASIS
content_hash=original.content_hash
CONTAINMENT_ROUNDOFF=1e-12;CONTAINMENT_DISTANCE_ROUNDOFF=1e-10

def validate_source_region(region, registration):
    label=region['labelId'];route={'T1':'root/6/1/19','T2':'root/6/1/20'}.get(label)
    evidence=next((e for e in registration['sourceElements'] if e['viewId']==region['view'] and e['label']==label),None)
    if (not evidence or region.get('sourcePathId')!=route or evidence['sourcePathId']!=route
        or region['sourcePathSHA256']!=evidence['sourcePathSHA256']
        or region.get('atlasStatus')!='PROVISIONAL' or region.get('reviewStatus')!='UNREVIEWED_PROVISIONAL'
        or region.get('uncertaintyLevel')!='HIGH' or region.get('derivationClass')!='B'
        or region['atlasId']!=ATLAS_ID or region['viewId']!=region['view'] or region['sourceLabel']!=label
        or region['registrationMethod']!='estimated_local_affine_source_visible_only'):
        raise ValueError('provisional provenance')
    m=registration['sides'][region['side']]['matrixNormalized']
    if m[0]*m[3]-m[1]*m[2]<=0:raise ValueError('unexpected registration reflection')
    expected=affine_transform(shape(evidence['sourceGeometry']),m)
    # This version deliberately has no extensions; preserve source topology.
    if shape(region['geometry']).symmetric_difference(expected).area>1e-10:
        raise ValueError('provisional geometry differs from source transform')

def load_provisional_dataset(identity):
    if not feature_enabled('ENABLE_REFERENCE_MATCHING'):
        raise EvaluationError('MATCHING_DISABLED','试验性图谱仅限已启用的开发测试服务',403)
    dataset=load_local_dataset(identity,sys.modules[__name__])
    if dataset.manifest.get('atlasStatus')!='PROVISIONAL':
        raise EvaluationError('ATLAS_UNAVAILABLE','试验性图谱状态缺失',503)
    return dataset
