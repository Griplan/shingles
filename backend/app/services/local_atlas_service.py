"""Shared fixed local-surface loader. V4 matching math is unchanged."""
import hashlib
import json
from shapely.errors import ShapelyError
from app.schemas.evaluate import Identity
from app.services.atlas_service import Dataset, valid_geometry
from app.utils.geometry import EvaluationError


def load_local_dataset(identity: Identity, config) -> Dataset:

    if identity.atlas_id != config.ATLAS_ID:
        raise EvaluationError('ATLAS_NOT_FOUND', '未配置该图谱标识', 404)
    if identity.atlas_version != config.ATLAS_VERSION:
        raise EvaluationError('VERSION_MISMATCH', '局部视图图谱版本不一致，请更新客户端', 409)
    try:
        blobs = {name: (config.ATLAS_DIR/name).read_bytes() for name in config.INPUTS}
        manifest = json.loads((config.ATLAS_DIR/'manifest.json').read_bytes())
        if (manifest['atlasId'] != config.ATLAS_ID or manifest['atlasVersion'] != config.ATLAS_VERSION
                or manifest['contentSHA256'] != config.content_hash(blobs)
                or any(manifest[key] != value for key, value in config.BASIS.items())):
            raise ValueError('local surface manifest identity/checksum')
        if any(not isinstance(manifest[key], str) for key in
               ('sourceTitle', 'sourceUrl', 'attribution', 'license', 'coverageNote')):
            raise ValueError('local surface source metadata')
        body_blob = config.BODY_FILE.read_bytes()
        body = json.loads(body_blob)
        if (body['coordinateSystem'] != 'normalized_2d_top_left'
                or any(body[key] != value for key, value in config.BASIS.items())
                or set(body['views']) != set(config.VIEWS)):
            raise ValueError('local surface body identity')
        if (set(body['sourceSHA256']) != {config.RESOURCE_KEY}
                or hashlib.sha256(config.RESOURCE_FILE.read_bytes()).hexdigest() != body['sourceSHA256'][config.RESOURCE_KEY]):
            raise ValueError('local surface body resource provenance')
        actual = Identity(template_id=config.BASIS['templateId'], template_version=config.BASIS['templateVersion'],
                          geometry_id=config.BASIS['geometryId'], region_set_id=config.BASIS['regionSetId'],
                          atlas_id=config.ATLAS_ID, atlas_version=config.ATLAS_VERSION,
                          atlas_content_sha256=config.content_hash(blobs),
                          body_content_sha256=hashlib.sha256(body_blob).hexdigest(),
                          coordinate_system='normalized_2d_top_left')
        bodies = {}
        for view, side in config.VIEWS.items():
            if body['views'][view]['side'] != side:
                raise ValueError('local surface body side')
            bodies[view] = valid_geometry(body['views'][view]['geometry'])
        data = {view: json.loads(blobs[view+'.json']) for view in config.VIEWS}
        for view, document in data.items():
            if document['view'] != view or document['atlasVersion'] != config.ATLAS_VERSION or not isinstance(document['regions'], list):
                raise ValueError('local surface view identity')
        if manifest['mappingEnabled'] is not False or manifest['medicalReviewStatus'] != 'pending':
            raise ValueError('local surface preview gate')
        # Body/atlas mismatch remains a distinct error, even for a blocked atlas.
        if identity != actual:
            raise EvaluationError('VERSION_MISMATCH', '局部视图模板、图谱或内容校验不一致，请同步更新后重试', 409)
        if (manifest['technicalValidationStatus'] != 'passed_offline_geometry'
                or manifest['sourceLicenseStatus'] != 'verified'):
            raise EvaluationError('ATLAS_NOT_READY', '局部视图皮节边界资料尚未通过配置检查，当前可标注但不能计算；标注仍保留', 409)
        sources = json.loads(blobs['sources.json'])
        registration = json.loads(blobs['registration.json'])
        if (sources['boundarySystem'] != ('schematic_skin_partition' if getattr(config,'SCHEMATIC',False) else 'spinal_dermatome')
                or sources['boundaryLicenseStatus'] != 'verified'
                or registration['status'] != 'passed_offline_geometry'
                or registration['geometryId'] != config.BASIS['geometryId']):
            raise ValueError('local surface anatomical boundary evidence')
        # Source IDs must name boundary evidence, not merely the display surface's license.
        source_ids = {source['id'] for source in sources['sources']
                      if source.get('purpose') == ('artificial_partition_design' if getattr(config,'SCHEMATIC',False) else 'dermatome_boundaries')
                      and source.get('licenseStatus') == 'verified'
                      and source.get('url') and source.get('license')
                      and source.get('author') and source.get('boundaryEvidence')}
        if (not source_ids or not manifest['license'] or manifest['license'] == 'UNKNOWN'
                or not manifest['sourceTitle'] or not manifest['sourceUrl'] or not manifest['attribution']):
            raise ValueError('local surface boundary source license')
        regions = []
        ids = set()
        for view, side in config.VIEWS.items():
            for region in data[view]['regions']:
                if (region['id'] in ids or region['view'] != view or region['side'] != side
                        or region['atlasVersion'] != config.ATLAS_VERSION
                        or region['partitionType'] != ('schematic_region' if getattr(config,'SCHEMATIC',False) else 'spinal_dermatome')
                        or region['medicalReviewStatus'] != 'pending'
                        or any(region[key] != config.BASIS[key] for key in ('templateId', 'templateVersion', 'geometryId'))
                        or not region['labelId'] or not region['sourceLabel']
                        or not region['sourceRefs'] or not set(region['sourceRefs']) <= source_ids):
                    raise ValueError('local surface region identity/source/side')
                geometry = valid_geometry(region['geometry'])
                if not bodies[view].covers(geometry):
                    # Require exact containment by default. Sole permits only independently
                    # bounded numerical edge noise, never a visible outside region.
                    if (not hasattr(config, 'CONTAINMENT_ROUNDOFF')
                            or geometry.difference(bodies[view]).area > config.CONTAINMENT_ROUNDOFF
                            or geometry.hausdorff_distance(geometry.intersection(bodies[view])) > config.CONTAINMENT_DISTANCE_ROUNDOFF):
                        raise ValueError('local region outside surface')
                if hasattr(config, 'validate_source_region'):
                    config.validate_source_region(region, registration)
                regions.append({**region, 'shape': geometry})
                ids.add(region['id'])
        if not regions or any(not data[view]['regions'] for view in config.VIEWS):
            raise EvaluationError('ATLAS_NOT_READY', '尚未配置可靠的左右局部视图皮节边界，不能执行面积匹配', 409)
    except (OSError, ValueError, KeyError, TypeError, AttributeError, IndexError, ShapelyError) as exc:
        raise EvaluationError('ATLAS_UNAVAILABLE', '局部视图图谱或模板数据缺失、损坏或尚未同步', 503) from exc
    return Dataset(actual, manifest, tuple(regions), bodies)
