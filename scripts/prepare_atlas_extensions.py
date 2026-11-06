"""V3.1 local, sourced additions to an immutable V3 atlas. No patient inputs.

Face/foot controls live in local-registration.json. The parent's paths/coordinates
remain the authority outside explicitly added surfaces; rebuilding never writes it.
"""
import bisect
import copy
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

from shapely import affinity
from shapely.geometry import Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.validation import explain_validity

from prepare_atlas import ROOT, source_paths, source_outline, models, spans, interpolate
from svg_geometry import flatten_geometry, distance, transform, multiply, path_rings, filled_geometry

ATLAS = ROOT / 'data/atlas/goran-2022-preview-v2'
PARENT = ROOT / 'data/atlas/goran-2022-preview-v1'
NAMES = {'V1': '三叉神经眼支 V1', 'V2': '三叉神经上颌支 V2', 'V3': '三叉神经下颌支 V3'}


def read(path):
    return json.loads(path.read_text())


def write(name, value):
    (ATLAS / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def row_warp(rows):
    """Continuous orientation-preserving local map, with landmark x/y controls."""
    assert len(rows) >= 2
    for i, row in enumerate(rows):
        assert len(row['sourceX']) == len(row['targetX']) >= 2
        for key in ('sourceX', 'targetX'):
            assert all(a < b for a, b in zip(row[key], row[key][1:])), key
        if i:
            assert rows[i-1]['sourceY'] < row['sourceY'] and rows[i-1]['targetY'] < row['targetY']
    ys = [r['sourceY'] for r in rows]
    def warp(x, y):
        i = max(0, min(len(rows)-2, bisect.bisect_right(ys, y)-1))
        a, b = rows[i:i+2]
        t = (y-a['sourceY'])/(b['sourceY']-a['sourceY'])
        # Interpolate corresponding knots BEFORE mapping x. This keeps shared
        # anatomy controls continuous as their source x positions change with y.
        sx = [p+(q-p)*t for p, q in zip(a['sourceX'], b['sourceX'])]
        tx = [p+(q-p)*t for p, q in zip(a['targetX'], b['targetX'])]
        return interpolate(x, list(zip(sx, tx))), a['targetY']+(b['targetY']-a['targetY'])*t
    return warp


def warp_geometry(geometry, warp):
    """Sample source curves without discarding small pieces or repairing topology."""
    def ring(source):
        points = list(source.coords)
        out = []
        def sample(a, b, depth=0):
            wa, wb = warp(*a), warp(*b)
            mid = ((a[0]+b[0])/2, (a[1]+b[1])/2)
            if depth < 18 and distance(warp(*mid), wa, wb) > .001:
                sample(a, mid, depth+1)
                sample(mid, b, depth+1)
            else:
                out.append(wa)
        for a, b in zip(points, points[1:]):
            n = max(1, math.ceil(math.dist(a, b)/.25))
            for i in range(n):
                sample(tuple(a[k]+(b[k]-a[k])*i/n for k in (0, 1)),
                       tuple(a[k]+(b[k]-a[k])*(i+1)/n for k in (0, 1)))
        return out + [out[0]]
    parts = [Polygon(ring(p.exterior), [ring(h) for h in p.interiors])
             for p in flatten_geometry(geometry) if p.area > 0]
    assert all(p.is_valid for p in parts), [explain_validity(p) for p in parts if not p.is_valid]
    return unary_union(parts)


def normalized(geometry):
    parts = []
    for part in flatten_geometry(geometry):
        if part.area <= 0:
            continue
        part = orient(part, sign=1)
        parts.append([[[round(x/400, 10), round(y/900, 10)] for x, y in ring.coords]
                      for ring in [part.exterior, *part.interiors]])
    result = {'type': 'MultiPolygon', 'coordinates': parts}
    assert shape(result).is_valid, explain_validity(shape(result))
    return result


def logical(region):
    return affinity.scale(shape(region['geometry']), xfact=400, yfact=900, origin=(0, 0))


def visible_paths():
    items = source_paths('front')
    visible, painted = {}, None
    # Exclude the independent head inset, but keep all actual main-face layers
    # when resolving painter order, including the original C2 ear/jaw boundary.
    inset = {0, 22, 23, 24, 25, 26, 27}
    for item in reversed(items):
        if item['index'] in inset:
            continue
        raw = item['geometry']
        visible[item['index']] = raw if painted is None else raw.difference(painted)
        painted = raw if painted is None else painted.union(raw)
    return items, visible


def target_path_geometry(path_id):
    """Read the unchanged target SVG, including its nested viewBox origin."""
    root = ET.parse(ROOT/'miniprogram/assets/body/commons-cc0/front.svg').getroot()
    found = []
    def walk(element, matrix, nested=False):
        matrix = multiply(matrix, transform(element.get('transform')))
        if nested and element.tag.endswith('}svg'):
            vb = [float(n) for n in element.get('viewBox').split()]
            assert float(element.get('width')) == vb[2] and float(element.get('height')) == vb[3]
            matrix = multiply(matrix, transform(f'translate({-vb[0]} {-vb[1]})'))
        if element.get('id') == path_id:
            found.append(filled_geometry(path_rings(element.get('d'), matrix), 'nonzero'))
        for child in element:
            walk(child, matrix, True)
    walk(root, transform(None))
    assert len(found) == 1 and found[0].is_valid
    return found[0]


def foot_rows(config, source_body, target_body, screen_side):
    """Each dorsal foot has independent contour controls, not a leg extrapolation."""
    rows = []
    start, end, step = config['sourceStartY'], config['sourceEndY'], config['rowSpacing']
    for k in range(math.ceil((end-start)/step)+1):
        y = min(end, start+k*step)
        ty = interpolate(y, config['sourceRows'])
        ss, tt = spans(source_body, y), spans(target_body, ty)
        ss = [p for p in ss if (sum(p)/2 < 233) == (screen_side == 'left')]
        tt = [p for p in tt if (sum(p)/2 < 200) == (screen_side == 'left')]
        if not ss or not tt:
            continue
        # Toe gaps remain holes in the source/target silhouette. Outer extrema
        # only define the projection coordinate, not a new dermatome boundary.
        a, b = min(p[0] for p in ss), max(p[1] for p in ss)
        c, d = min(p[0] for p in tt), max(p[1] for p in tt)
        rows.append({'sourceY': y, 'targetY': ty, 'sourceX': [a, (a+b)/2, b],
                     'targetX': [c, (c+d)/2, d]})
    assert len(rows) > 400
    return rows


def main():
    config = read(ATLAS/'local-registration.json')
    for name, digest in config['parentFileSHA256'].items():
        assert hashlib.sha256((PARENT/name).read_bytes()).hexdigest() == digest, 'Historical parent changed: '+name
    manifest = read(ATLAS/'manifest.json')
    version = manifest['atlasVersion']
    data = {v: copy.deepcopy(read(PARENT/(v+'.json'))) for v in ('front', 'back')}
    for view in data:
        data[view]['atlasVersion'] = version
        for region in data[view]['regions']:
            region['atlasVersion'] = version
    regions = data['front']['regions']
    inherited = unary_union([logical(r) for r in regions])
    model = models()['front']
    body = Polygon([(p['x'], p['y']) for p in model['hitOutline']])
    items, visible = visible_paths()
    source_body = source_outline('front')
    report = {key: config[key] for key in ('atlasVersion', 'parentAtlasVersion', 'parentContentSHA256', 'parentFileSHA256')}
    report.update(extensions=[], landmarkRows={}, notes=[
        'Local image registration is engineering evidence, not medical approval.',
        'Original parent geometry, including C2/C3, is never overwritten. Conflicts are explicitly unconfigured.',
        'Foot extension shares its ankle boundary with parent geometry. Adjacent polygons of the same label are unioned for valid MultiPolygon topology.',
        'No area-based deletion or simplification of new local fragments. Source paint seams remain.',
        'Source visible area is measured before target-side splitting; bilateral face records repeat that source total and must not be summed as distinct source area.'])
    source_map = read(ATLAS/'source-map.json')
    additions = {}

    for kind in ('face', 'feet'):
        local = config[kind]
        if kind == 'face':
            transforms = [('both', row_warp(local['rows']), box(*local['sourceDomain']))]
            masks = local['targetSurfaceExclusions']
            assert hashlib.sha256((ROOT/'miniprogram/assets/body/commons-cc0/front.svg').read_bytes()).hexdigest() == masks['targetSVGSHA256'], 'Target source changed'
            excluded_surface = unary_union([Polygon(masks['mouthInterior']), target_path_geometry(masks['hairPathId'])] +
                                           [Polygon(p) for p in masks['earAndEyeWindows']])
            target_domain = body.difference(excluded_surface).intersection(box(0, masks['minimumVisibleFaceY'], 400, 900))
            report['landmarkRows'][kind] = local['rows']
        else:
            target_domain = body.intersection(box(0, local['targetStartY'], 400, 900))
            transforms = []
            report['landmarkRows'][kind] = {}
            for screen_side, lo, hi in [('left', 0, 233), ('right', 233, 440)]:
                rows = foot_rows(local, source_body, body, screen_side)
                transforms.append((screen_side, row_warp(rows), box(lo, local['sourceStartY'], hi, local['sourceEndY'])))
                report['landmarkRows'][kind][screen_side] = rows
        for _, warp, source_domain in transforms:
            for index_text, label in local['pathLabels'].items():
                index = int(index_text)
                src = visible[index].intersection(source_domain).intersection(source_body)
                if src.is_empty:
                    continue
                raw = warp_geometry(src, warp)
                for side, half in [('right', box(0, 0, 200, 900)), ('left', box(200, 0, 400, 900))]:
                    raw_half = raw.intersection(half)
                    if raw_half.is_empty or raw_half.area == 0:
                        continue
                    out = raw_half.difference(body).area
                    adapted = raw_half.intersection(target_domain)
                    conflict = adapted.intersection(inherited).area
                    kept = adapted.difference(inherited)
                    if kept.is_empty:
                        raise ValueError(f'Entire local area lost: {kind}/{label}/{side}')
                    key = (label, side)
                    record = additions.setdefault(key, {'geometries': [], 'indices': set(), 'ref': local['id'], 'color': items[index]['color'],
                        'sourceVisibleAreaBeforeSideSplit': 0., 'rawMappedArea': 0., 'rawOutsideLogicalPx2': 0., 'omittedAgainstParentLogicalPx2': 0., 'surfaceExclusionLogicalPx2': 0.})
                    record['geometries'].append(kept)
                    record['indices'].add(index)
                    record['sourceVisibleAreaBeforeSideSplit'] += src.area
                    record['rawMappedArea'] += raw_half.area
                    record['rawOutsideLogicalPx2'] += out
                    record['omittedAgainstParentLogicalPx2'] += conflict
                    record['surfaceExclusionLogicalPx2'] += raw_half.intersection(body).difference(target_domain).area

    for (label, side), record in additions.items():
        added = unary_union(record.pop('geometries'))
        added_geometry = normalized(added)
        rid = 'front-'+side+'-'+label
        region = next((r for r in regions if r['id'] == rid), None)
        if region is None:
            point = max(flatten_geometry(added), key=lambda p: p.area).representative_point()
            region = {'id': rid, 'atlasVersion': version, 'templateId': model['id'], 'templateVersion': model['version'],
                      'geometryId': model['geometryId'], 'partitionType': 'trigeminal_sensory' if label in NAMES else 'spinal_dermatome',
                      'labelId': label, 'sourceLabel': next(c['sourceLabel'] for c in source_map['views']['front'] if c['labelId'] == label),
                      'view': 'front', 'side': side, 'color': record['color'], 'geometry': added_geometry,
                      'labelPoint': {'x': point.x/400, 'y': point.y/900}, 'sourceRefs': ['commons-goran-2022-front'],
                      'sourcePathIndices': sorted(record['indices']), 'productionStatus': 'registered_development_preview',
                      'medicalReviewStatus': 'pending', 'derivation': 'Original labeled SVG visible fill; local landmark registration; explicit unsupported surfaces; no mirroring or lesion inputs.'}
            if label in NAMES:
                region['displayName'] = NAMES[label]
            regions.append(region)
        else:
            # Keep original region identity/label point. Only adjacent added foot
            # pieces are joined; no new duplicate label instance is manufactured.
            # Union in the final coordinate space: re-rounding the already
            # normalized parent's ankle seam can collapse near-coincident edges.
            joined = shape(region['geometry']).union(shape(added_geometry))
            assert joined.is_valid, explain_validity(joined)
            region['geometry'] = {'type': 'MultiPolygon', 'coordinates': [
                [[list(p) for p in ring.coords] for ring in [q.exterior, *q.interiors]]
                for q in [orient(p, sign=1) for p in flatten_geometry(joined)]]}
            region['sourcePathIndices'] = sorted(set(region['sourcePathIndices']) | record['indices'])
        region['registrationRefs'] = [record['ref']]
        verts = sum(len(ring) for part in added_geometry['coordinates'] for ring in part)
        report['extensions'].append({**{k: v for k, v in record.items() if k not in ('indices', 'ref', 'color')},
            'regionId': rid, 'view': 'front', 'labelId': label, 'side': side, 'registrationRef': record['ref'],
            'sourcePathIndices': sorted(record['indices']), 'retainedAreaLogicalPx2': shape(added_geometry).area*360000,
            'outsideFraction': record['rawOutsideLogicalPx2']/record['rawMappedArea'],
            'polygonParts': len(added_geometry['coordinates']), 'verticesBefore': verts, 'verticesAfter': verts,
            'hausdorff': 0, 'areaDelta': 0, 'geometry': added_geometry})

    for view in data:
        write(view+'.json', data[view])
    coverage = copy.deepcopy(read(PARENT/'coverage.json'))
    coverage['atlasVersion'] = version
    for view in data:
        for label in sorted({r['labelId'] for r in data[view]['regions']}):
            subset = [r for r in data[view]['regions'] if r['labelId'] == label]
            entry = next((c for c in coverage['entries'] if c['view'] == view and c['labelId'] == label), None)
            if entry is None:
                entry = {'view': view, 'labelId': label, 'sourceLabel': subset[0]['sourceLabel'], 'sourcePresent': True, 'medicalReviewStatus': 'pending'}
                coverage['entries'].append(entry)
            entry.update(status='registered_preview', configuredSides=[r['side'] for r in subset], partCount=sum(len(r['geometry']['coordinates']) for r in subset), sourcePathIndices=sorted({p for r in subset for p in r['sourcePathIndices']}))
            if view == 'front' and label in ('V1', 'V2', 'V3', 'L4', 'L5', 'S1'):
                entry['surfaceLimit'] = 'Only independently registered front visible surface. No hair-covered scalp, ocular opening, complex ear transition, lateral-head inset, oral interior, sole, inferred posterior face or heel.'
                entry['excludedPathReasons'] = []
    coverage['unconfigured'] = [e['reason'] for e in config['exclusions']] + ['Hair-covered scalp, ocular openings, complex ear transition, distal hands/fingers, head-side inset, ear canal/oral interior, ambiguous C1/Co1, anterior perineum remain unconfigured.', 'Blank is not absent sensation.']
    coverage['surfaceExclusions'] = config['exclusions']
    write('coverage.json', coverage)
    write('local-registration-report.json', report)
    print('Built', version, {v: len(d['regions']) for v, d in data.items()})
    for r in report['extensions']:
        print(r['regionId'], 'area', round(r['retainedAreaLogicalPx2'], 3), 'outside%', round(r['outsideFraction']*100, 4), 'parent conflict', round(r['omittedAgainstParentLogicalPx2'], 3))


if __name__ == '__main__':
    main()
