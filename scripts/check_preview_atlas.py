"""Independent sourced-atlas checks. No lesion sessions or medical approval.

The active directory comes from the deterministic packager. V3.1 extends a pinned
parent; checks of inherited geometry compare coordinates, not merely area/bounds.
"""
import hashlib
import itertools
import json
import math
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon, shape, box
from shapely.ops import unary_union
from shapely.validation import explain_validity

from prepare_atlas import EXPECTED_SHA1, RESEARCH, models
from sync_atlas import ATLAS, content_hash

ROOT = Path(__file__).resolve().parents[1]
PARENT = ROOT / 'data/atlas/goran-2022-preview-v1'
PARENT_VERSION = 'goran-2022-commons-template4-preview.1'
PARENT_CONTENT_SHA256 = 'ae4bc65f60d8aba519d46fa3c4687a68f02a7ea7c1331aebdc9a1034e4133cd7'
# Recorded independently before V3.1. The generator cannot update these to
# legitimize an accidental rewrite of the historical atlas.
PARENT_FILE_SHA256 = {
    'NOTICE.md': '7bbe18d36fb9440c6b4b580e636668d5fefdb9061bbf8e633dc4cab34868f2b7',
    'back.json': 'aea2085c93560dc434bc9b0bb62cb7ef7d2df91023f19200e54816357f003bbb',
    'coverage.json': 'd79d88c3f892a436e33345b39229330bb2730c8b39a80ad5320b804504dfdfa1',
    'front.json': 'b68954b9c0af82b4ebdf052933b98a45efb8dcc74c84e4a181733cc50c11a80d',
    'manifest.json': 'c27b03c330ef5ce69480778c8fea2479608ff2dd347d34dfe6fc40e3fa758568',
    'registration-report.json': '709cec15b0b2a6d10905645ad3ac2faef29397542a71c45a99969639e26e0853',
    'registration.json': '8a997410d8e92d6133079cea4c228c990234dfbb896bd849f41c06b2a2b46066',
    'source-map.json': 'ceea8c7896c586d2067a2f302f34ce85cb87b631698cead36485f3fb0b413573',
    'sources.json': 'bed13c66fdfd9b9cd4cc6c63b9eee4272f7cc9912405a482f09acca1c8196252',
    'validation.json': '6ae9778a09972c2e4b24ffc66a1fa5a68000191cc79e37837f1f295014a1da7d',
}
TRIGEMINAL_NAMES = {
    'V1': '三叉神经眼支 V1', 'V2': '三叉神经上颌支 V2', 'V3': '三叉神经下颌支 V3',
}


def read_json(path):
    return json.loads(path.read_text())


def validate_geometry(geometry):
    """Validate independently of the renderer, including nonzero-fill winding."""
    assert geometry['type'] == 'MultiPolygon' and geometry['coordinates']
    parts = holes = vertices = 0
    for polygon in geometry['coordinates']:
        assert polygon, 'Polygon must have an outer ring'
        parts += 1
        holes += len(polygon) - 1
        for index, ring in enumerate(polygon):
            vertices += len(ring)
            assert len(ring) >= 4 and ring[0] == ring[-1], 'Rings must be explicitly closed'
            assert all(len(p) == 2 and all(
                isinstance(n, (int, float)) and not isinstance(n, bool)
                and math.isfinite(n) and 0 <= n <= 1 for n in p
            ) for p in ring), 'Coordinates must be finite normalized numbers'
            # Center before shoelace summation: tiny valid source seams otherwise
            # cancel against absolute normalized coordinates. No geometry changes.
            ox, oy = ring[0]
            signed = math.fsum((a[0]-ox)*(b[1]-oy)-(b[0]-ox)*(a[1]-oy) for a,b in zip(ring,ring[1:]))
            assert (signed > 0 if index == 0 else signed < 0), 'Opposite hole winding required by Canvas nonzero fill'
    geom = shape(geometry)
    assert geom.is_valid, explain_validity(geom)
    assert not geom.is_empty and geom.area > 0
    return geom, {'polygonParts': parts, 'holes': holes, 'vertices': vertices}


def validate_inherited_region(parent, current):
    """Existing coordinates are immutable; additions are separate polygon parts."""
    fixed = ('id', 'templateId', 'templateVersion', 'geometryId', 'partitionType',
             'labelId', 'sourceLabel', 'view', 'side', 'color', 'labelPoint',
             'medicalReviewStatus', 'productionStatus')
    for field in fixed:
        assert current[field] == parent[field], f'Inherited {parent["id"]}: changed {field}'
    original = parent['geometry']['coordinates']
    current_parts = current['geometry']['coordinates']
    parent_geometry, current_geometry = shape(parent['geometry']), shape(current['geometry'])
    if current_parts != original:
        assert current['view'] == 'front' and current['labelId'] in ('L4', 'L5'), 'Unexpected inherited geometry change'
        # Joining adjacent same-label ankle polygons changes ring traversal, not
        # the inherited surface. Check geometry independently above the seam.
        assert parent_geometry.difference(current_geometry).area * 360000 < .0001, 'Original area lost'
        assert parent_geometry.intersection(box(0,0,1,820/900)).symmetric_difference(current_geometry.intersection(box(0,0,1,820/900))).area * 360000 < .0001, 'Proximal geometry changed'
    assert set(parent['sourceRefs']) <= set(current['sourceRefs'])
    assert set(parent['sourcePathIndices']) <= set(current['sourcePathIndices'])
    added = current_geometry.difference(parent_geometry)
    if not added.is_empty and added.area > 1e-12:
        assert current['labelId'] in ('L4', 'L5', 'S1'), 'Only documented foot additions may augment existing regions'
        assert current.get('registrationRefs'), 'Added parts require local registration references'
        assert added.bounds[1] >= 820 / 900 - 1e-9, 'Foot additions cannot alter established proximal surfaces'
    return added


def validate_parent_files():
    actual_files = {p.name for p in PARENT.iterdir() if p.is_file()}
    assert actual_files == set(PARENT_FILE_SHA256), 'Historical parent inventory changed'
    for filename, expected in PARENT_FILE_SHA256.items():
        assert hashlib.sha256((PARENT / filename).read_bytes()).hexdigest() == expected, 'Historical parent changed: ' + filename
    parent_manifest = read_json(PARENT / 'manifest.json')
    assert parent_manifest['atlasVersion'] == PARENT_VERSION
    assert parent_manifest['contentSHA256'] == PARENT_CONTENT_SHA256


def check():
    read = lambda name: read_json(ATLAS / name)
    manifest = read('manifest.json')
    version = manifest['atlasVersion']
    is_extension = version != PARENT_VERSION
    assert manifest['sourceLicenseStatus'] == 'verified'
    assert manifest['medicalReviewStatus'] == 'pending' and manifest['mappingEnabled'] is False
    assert manifest['contentSHA256'] == content_hash(), 'Canonical checksum stale'
    if is_extension:
        assert manifest['inheritedParentVersion'] == PARENT_VERSION
        validate_parent_files()
        local_config = read('local-registration.json')
        local_report = read('local-registration-report.json')
        assert local_report['atlasVersion'] == version
        assert local_report['parentAtlasVersion'] == PARENT_VERSION
        assert local_report['parentContentSHA256'] == PARENT_CONTENT_SHA256
    else:
        local_config = local_report = None
    sources = read('sources.json')['sources']
    source_by_id = {source['id']: source for source in sources}
    assert len(source_by_id) == len(sources), 'Duplicate source IDs'
    for source in sources:
        assert source['license'] == 'CC-BY-SA-4.0' and source['sourceLicenseStatus'] == 'verified'
        assert hashlib.sha1((RESEARCH / f'goran-{source["view"]}.original.svg').read_bytes()).hexdigest() == EXPECTED_SHA1[source['view']]
        assert source['sourceSHA1'] == EXPECTED_SHA1[source['view']]

    model_data = models()
    source_map = read('source-map.json')
    registration = read('registration-report.json')
    registration_config = read('registration.json')
    coverage = read('coverage.json')
    assert coverage['atlasVersion'] == version
    ids, identities, report = set(), set(), {}
    added_regions = {}
    for view in ('front', 'back'):
        model = model_data[view]
        width, height = model['logicalWidth'], model['logicalHeight']
        scale = width * height
        body = Polygon([(p['x'] / width, p['y'] / height) for p in model['hitOutline']])
        data = read(view + '.json')
        assert data['view'] == view and data['atlasVersion'] == version
        configs = {entry['pathIndex']: entry for entry in source_map['views'][view]}
        assert len(configs) == len(source_map['views'][view]), 'Repeated source path index'
        parent_regions = {r['id']: r for r in read_json(PARENT / (view + '.json'))['regions']} if is_extension else {}
        assert set(parent_regions) <= {r['id'] for r in data['regions']}, 'Inherited region removed'
        geometries, outside = [], 0
        counts = {'polygonParts': 0, 'holes': 0, 'vertices': 0}
        for region in data['regions']:
            rid = region['id']
            assert rid not in ids, 'Duplicate region ID: ' + rid
            ids.add(rid)
            identity = (region['view'], region['labelId'], region['side'])
            assert identity not in identities, 'Repeated label/side must be a polygon part of its existing region'
            identities.add(identity)
            assert region['view'] == view and region['side'] in ('left', 'right')
            assert (region['atlasVersion'], region['templateId'], region['templateVersion'], region['geometryId']) == (
                version, model['id'], model['version'], model['geometryId'])
            assert region['medicalReviewStatus'] == 'pending' and region['productionStatus'] == 'registered_development_preview'
            label = region['labelId']
            if label in TRIGEMINAL_NAMES:
                assert view == 'front' and region['partitionType'] == 'trigeminal_sensory', 'No front-face geometry on posterior surface'
                assert region['displayName'] == TRIGEMINAL_NAMES[label]
                assert region.get('registrationRefs'), 'New face geometry requires local registration provenance'
            else:
                assert region['partitionType'] == ('spinal_dermatome_composite' if '/' in label or '-' in label else 'spinal_dermatome')
            assert region['sourceRefs'] and set(region['sourceRefs']) <= source_by_id.keys()
            assert all(source_by_id[source_id]['view'] == view for source_id in region['sourceRefs']), 'Source/target view mismatch'
            assert region['sourcePathIndices'] and all(
                configs[index]['labelId'] == label and configs[index]['status'] != 'excluded'
                for index in region['sourcePathIndices'])
            geom, geometry_counts = validate_geometry(region['geometry'])
            for key, value in geometry_counts.items():
                counts[key] += value
            point = region['labelPoint']
            assert geom.buffer(1e-8).covers(Point(point['x'], point['y'])), rid + ' label outside final geometry'
            screen_left = (view == 'front' and region['side'] == 'right') or (view == 'back' and region['side'] == 'left')
            axis = registration_config['targetMidline'][view][0][1] / width
            assert (geom.bounds[2] <= axis + 1e-9 if screen_left else geom.bounds[0] >= axis - 1e-9), 'Anatomical side wrong: ' + rid
            outside += geom.difference(body).area * scale
            geometries.append((rid, geom))
            if is_extension:
                addition = validate_inherited_region(parent_regions[rid], region) if rid in parent_regions else geom
                if not addition.is_empty and addition.area > 1e-12:
                    assert region.get('registrationRefs')
                    added_regions[rid] = (region, addition)
        overlaps = []
        for (aid, a), (bid, b) in itertools.combinations(geometries, 2):
            area = a.intersection(b).area * scale
            if area > 1e-8:
                overlaps.append({'a': aid, 'b': bid, 'logicalPx2': area})
        overlap = sum(pair['logicalPx2'] for pair in overlaps)
        union = unary_union([geom for _, geom in geometries])
        assert outside < .5, (view, 'Unexpected geometry outside silhouette', outside)
        assert overlap < 10, (view, 'Unexpected manufacturing overlap', overlap)
        raw = registration[view]['preAdaptationBySourcePath']
        assert all(item['outsideFraction'] < .05 for item in raw.values()), 'Large parent registration loss'
        assert registration[view]['rawOutsideTotal'] < 200
        assert all(item['hausdorff'] <= .0100001 for item in registration[view]['simplification'])
        assert not registration[view]['samplingNoding'], 'Unexpected parent sampled self-crossings'
        assert {entry['labelId'] for entry in coverage['entries'] if entry['view'] == view and entry['status'] == 'registered_preview'} == {
            region['labelId'] for region in data['regions']}
        registered_paths = {entry['sourcePath'] for entry in registration[view]['sourcePaths']}
        if is_extension:
            registered_paths |= {index for entry in local_report['extensions'] if entry['view'] == view for index in entry['sourcePathIndices']}
        for config in configs.values():
            assert config['status'] == 'excluded' or config['pathIndex'] in registered_paths, 'Source path silently missing'
        report[view] = {
            'regions': len(geometries), 'labels': len({r['labelId'] for r in data['regions']}), **counts,
            'outsideAfterSimplificationLogicalPx2': outside, 'manufacturingOverlapLogicalPx2': overlap,
            'overlapPairs': overlaps, 'rawOutsideBeforeAdaptationLogicalPx2': registration[view]['rawOutsideTotal'],
            'bodyAreaLogicalPx2': body.area * scale, 'configuredAreaLogicalPx2': union.area * scale,
            'unconfiguredAreaLogicalPx2': body.difference(union).area * scale,
            'coverageInterpretation': 'Unconfigured includes excluded/non-visible surfaces and source seams; not absence of sensation. Full-body tiling is not required.',
            'medicalReviewStatus': 'pending',
        }
    if is_extension:
        report['extensions'] = validate_extensions(local_config, local_report, added_regions, model_data)
    return {'atlasVersion': version, 'contentSHA256': content_hash(), 'status': 'PASSED_OFFLINE_GEOMETRY',
            'runtimeVisualStatus': 'NOT_RUN', 'medicalReviewStatus': 'pending', 'views': report}


def validate_extensions(config, report, added_regions, model_data):
    """Compare per-addition metrics with actual output; no clinical claims."""
    entries = report['extensions']
    assert len({entry['regionId'] for entry in entries}) == len(entries), 'Duplicate local report entry'
    assert {entry['regionId'] for entry in entries} == set(added_regions), 'Unreported local geometry'
    totals = {'addedRegionsOrParts': len(entries), 'rawOutsideLogicalPx2': 0, 'retainedAreaLogicalPx2': 0}
    for entry in entries:
        region, geom = added_regions[entry['regionId']]
        assert (entry['view'], entry['labelId'], entry['side']) == (region['view'], region['labelId'], region['side'])
        assert entry['registrationRef'] in region['registrationRefs']
        assert set(entry['sourcePathIndices']) <= set(region['sourcePathIndices'])
        model = model_data[region['view']]
        measured = geom.area * model['logicalWidth'] * model['logicalHeight']
        assert math.isclose(measured, entry['retainedAreaLogicalPx2'], abs_tol=.001), 'Local area report inconsistent'
        recorded, counts = validate_geometry(entry['geometry'])
        assert geom.symmetric_difference(recorded).area * 360000 < .001, 'Reported addition does not match final geometry'
        assert entry['polygonParts'] == counts['polygonParts']
        assert entry['sourceVisibleAreaBeforeSideSplit'] > 0 and entry['rawMappedArea'] > 0 and entry['retainedAreaLogicalPx2'] > 0
        assert 0 <= entry['rawOutsideLogicalPx2'] <= entry['rawMappedArea'] + 1e-7
        assert math.isclose(entry['outsideFraction'], entry['rawOutsideLogicalPx2'] / entry['rawMappedArea'], abs_tol=1e-7)
        assert entry['outsideFraction'] < .05, 'Resolve substantial local outside loss; do not hide by clipping'
        assert 0 <= entry['hausdorff'] <= .0100001
        assert entry['verticesBefore'] >= 4 and entry['verticesAfter'] >= 4
        totals['rawOutsideLogicalPx2'] += entry['rawOutsideLogicalPx2']
        totals['retainedAreaLogicalPx2'] += measured
    return totals


if __name__ == '__main__':
    try:
        if ATLAS.name == 'goran-2022-preview-v3':
            from check_main_hands import check as check_hands
            result = check_hands()
        else:
            result = check()
        (ATLAS / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        for view, metrics in result['views'].items():
            print(view, {key: value for key, value in metrics.items() if key not in ('overlapPairs', 'coverageInterpretation')})
        print('PASSED: sourced preview geometry/provenance/binding/side/inheritance checks. Not medical review or runtime proof.')
    except (AssertionError, ValueError, KeyError) as error:
        print('FAILED:', error, file=sys.stderr)
        raise SystemExit(1)
