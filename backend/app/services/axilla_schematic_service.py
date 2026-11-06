"""Artificial schematic atlas. Separate from medical/provisional source evidence."""
import sys
from shapely.ops import unary_union
from app.services import axilla_atlas_service as base
from app.services.local_atlas_service import load_local_dataset
from app.services.access import feature_enabled
from app.utils.geometry import EvaluationError
ROOT=base.ROOT;ATLAS_ID='axilla-schematic-v1';ATLAS_VERSION='axilla-schematic.1'
ATLAS_DIR=ROOT/'data/atlas/axilla-schematic-v1'
BODY_FILE=base.BODY_FILE;RESOURCE_KEY=base.RESOURCE_KEY;RESOURCE_FILE=base.RESOURCE_FILE
VIEWS=base.VIEWS;INPUTS=base.INPUTS;BASIS=base.BASIS;content_hash=base.content_hash
SCHEMATIC=True
CONTAINMENT_ROUNDOFF=1e-12;CONTAINMENT_DISTANCE_ROUNDOFF=1e-10
META=dict(atlasType='SCHEMATIC',reviewStatus='NOT_MEDICALLY_VALIDATED',intendedUse='INTERACTIVE_SIMULATION',sourceType='ARTIFICIALLY_CONSTRUCTED')
def validate_source_region(region,registration):
    if (any(region.get(k)!=v or registration.get(k)!=v for k,v in META.items())
        or region['partitionType']!='schematic_region' or region['labelId'] not in ['T1','T2','T3']
        or region['displayName']!='模拟 '+region['labelId'] or region['sourcePathId'] is not None
        or region['sourceFile']!='scripts/build_axilla_schematic.py'
        or region['viewId']!=region['view'] or region['atlasId']!=ATLAS_ID):
        raise ValueError('invalid schematic origin/label')
def load_schematic_dataset(identity):
    if not feature_enabled('ENABLE_REFERENCE_MATCHING'):raise EvaluationError('MATCHING_DISABLED','当前环境未启用交互模拟',403)
    ds=load_local_dataset(identity,sys.modules[__name__])
    if any(ds.manifest.get(k)!=v for k,v in META.items()):raise EvaluationError('ATLAS_UNAVAILABLE','模拟状态缺失',503)
    for view,body in ds.bodies.items():
        shapes=[r['shape'] for r in ds.regions if r['view']==view]
        union=unary_union(shapes)
        if (len(shapes)!=3 or body.difference(union).area>1e-12 or sum(g.area for g in shapes)-union.area>1e-12):
            raise EvaluationError('ATLAS_UNAVAILABLE','模拟分区覆盖或邻接校验失败',503)
    return ds
