"""Source-derived palm atlas; pending medical review and development preview only.

Extracts DrawingML cubic paths from Servier slide 26. Source boundary IDs are
explicitly recorded. Mean-value cage coordinates change the drawing's pose;
they are NOT a medically validated correspondence. Keep rejected runs too.
"""
from pathlib import Path
import hashlib
import zipfile
import argparse
import json
import xml.etree.ElementTree as ET

import numpy as np
from shapely.geometry import Polygon, LineString, Point, MultiPoint, box, mapping
from shapely.ops import nearest_points, snap, polygonize, unary_union

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT/'data/sources/servier-palm-v1'
NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
raw = (DIR/'original.pptx').read_bytes()
assert hashlib.sha256(raw).hexdigest() == 'b6f10318613415bdcfed5503d7a082435f3641f87f66b39587c4b522664a7ebc'
with zipfile.ZipFile(DIR/'original.pptx') as archive:
    tree = ET.fromstring(archive.read('ppt/slides/slide26.xml'))
shapes = tree.find('p:cSld/p:spTree/p:grpSp', NS).findall('p:sp', NS)


def source_path(index):
    prop = shapes[index].find('p:spPr', NS)
    transform = prop.find('a:xfrm', NS)
    off, ext = transform.find('a:off', NS), transform.find('a:ext', NS)
    path = prop.find('a:custGeom/a:pathLst/a:path', NS)
    origin = np.array([int(off.get('x')), int(off.get('y'))])
    scale = np.array([int(ext.get('cx'))/int(path.get('w')),
                      int(ext.get('cy'))/int(path.get('h'))])
    out = []
    for command in path:
        tag = command.tag.split('}')[-1]
        points = [origin+scale*np.array([int(p.get('x')), int(p.get('y'))]) for p in command]
        if tag == 'moveTo':
            out.append(points[0])
        elif tag == 'cubicBezTo':
            a, (b, c, d) = out[-1], points
            # 100 samples/cubic retained in audit; no hand-drawn nerve curves.
            for t in np.linspace(0, 1, 101)[1:]:
                u = 1-t
                out.append(u**3*a+3*u*u*t*b+3*u*t*t*c+t**3*d)
        elif tag == 'close':
            out.append(out[0])
        else:
            raise ValueError('Unexpected DrawingML command: '+tag)
    return [list(map(float, p)) for p in out]


def save(name, value):
    (DIR/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def arc(ring, start, end, fractions):
    a, b = ring.project(Point(start)), ring.project(Point(end))
    length = ring.length
    distance = (b-a) % length
    return np.array([ring.interpolate((a+f*distance) % length).coords[0] for f in fractions])


def register():
    # This cut excludes the source's more proximal T1 wedge; it is a display
    # extent, not an invented dermatome boundary. The full source is preserved.
    source = Polygon(source_path(0)).intersection(box(1600, 2310, 2100, 2700))
    assert source.geom_type == 'Polygon' and source.is_valid
    body = json.loads((ROOT/'data/body/palm-resource.json').read_text())
    target = Polygon([(x*440, y*700) for x, y in body['views']['palm-right']['body']['coordinates'][0]])
    assert target.is_valid
    # Tips, interdigital webs and the two wrist-cut corners, selected from the
    # real source/target drawings before mapping. No nerve vertices are controls.
    anchors = [
        ('ulnar_wrist', [2005, 2310], [55, 650]),
        ('little_tip', [2005, 2601.5], [63, 142]),
        ('little_ring_web', [1948.5, 2497.5], [94, 319]),
        ('ring_tip', [1900, 2660], [138, 69.5]),
        ('ring_middle_web', [1892.5, 2529], [156.5, 303.5]),
        ('middle_tip', [1830, 2672.5], [185, 47.5]),
        ('middle_index_web', [1842, 2521.5], [223, 301.5]),
        ('index_tip', [1770, 2647], [249.5, 80.5]),
        ('index_thumb_web', [1801, 2413], [299, 411.5]),
        ('thumb_tip', [1680.5, 2430], [405, 290]),
        ('radial_wrist', [1840, 2310], [255.5, 650]),
    ]
    # Orient both rings so these anatomical anchors traverse the same order.
    sr = LineString(source.exterior.coords)
    tr = LineString(target.exterior.coords)
    # Target anchors use actual canonical skin vertices so subsequent division
    # by 440/700 does not introduce new almost-collinear surface vertices.
    resolved = [(name, nearest_points(sr, Point(s))[0].coords[0],
                 min(tr.coords, key=lambda q: Point(q).distance(Point(t)))) for name, s, t in anchors]
    for ring, which in [(sr, 1), (tr, 2)]:
        distances = [ring.project(Point(a[which])) for a in resolved]
        forward = sum((b-a) % ring.length for a, b in zip(distances, distances[1:]+distances[:1]))
        if forward > ring.length*1.01:
            if which == 1:
                sr = LineString(list(sr.coords)[::-1])
            else:
                tr = LineString(list(tr.coords)[::-1])
    # Only the palm's four web junctions and wrist-cut corners constrain the
    # interior curves. Distal finger cages caused foldovers (retained v01/v02).
    resolved = [r for r in resolved if "tip" not in r[0]]
    source_cage = [r[1] for r in resolved]
    target_cage = [r[2] for r in resolved]
    # The two source boundary endpoints lie at web junctions. Their tiny stroke
    # joins are used as exact source controls; target controls are actual webs.
    source_cage[2] = nearest_points(sr, Point(source_path(153)[-1]))[0].coords[0]
    source_cage[4] = nearest_points(sr, Point(source_path(152)[-1]))[0].coords[0]
    cage, mapped_cage = np.array(source_cage), np.array(target_cage)
    resolved = [(r[0], tuple(s), tuple(t)) for r, s, t in zip(resolved, cage, mapped_cage)]
    assert Polygon(cage).is_valid and Polygon(mapped_cage).is_valid

    def transform(p):
        delta = cage-np.array(p)
        dist = np.linalg.norm(delta, axis=1)
        if dist.min() < 1e-8:
            return mapped_cage[dist.argmin()]
        nxt = np.roll(delta, -1, axis=0)
        ndist = np.roll(dist, -1)
        cross = delta[:, 0]*nxt[:, 1]-delta[:, 1]*nxt[:, 0]
        dot = np.sum(delta*nxt, axis=1)
        edge = np.flatnonzero((np.abs(cross) < 1e-7) & (dot < 0))
        if len(edge):
            i = edge[0]; j = (i+1) % len(cage)
            return (mapped_cage[i]*dist[j]+mapped_cage[j]*dist[i])/(dist[i]+dist[j])
        half = cross/(dist*ndist+dot)
        weights = (np.roll(half, 1)+half)/dist
        return weights@mapped_cage/weights.sum()

    a = LineString(source_path(152)).intersection(source)
    b = LineString(source_path(153)).intersection(source)
    # Endpoints within the original line stroke are joined explicitly and
    # recorded; no extension across an anatomically unconfigured area.
    coords_a = list(a.coords)
    coords_a[-1] = nearest_points(source.boundary, Point(coords_a[-1]))[0].coords[0]
    a = LineString(coords_a)
    coords_b = list(b.coords)
    coords_b[0] = nearest_points(a, Point(coords_b[0]))[0].coords[0]
    # The source stroke ends 0.0465 child units from the skin line. Use its
    # recorded web anchor, not a second almost-identical line intersection.
    assert Point(coords_b[-1]).distance(Point(cage[2])) < .5
    coords_b[-1] = tuple(cage[2])
    b = LineString(coords_b)
    ta, tb = LineString([transform(p) for p in a.coords]), LineString([transform(p) for p in b.coords])
    def partition(surface, first, second):
        before = [first.coords[0], first.coords[-1], second.coords[0], second.coords[-1]]
        first_points = list(first.coords)
        for i in [0, -1]:
            first_points[i] = nearest_points(surface.boundary, Point(first_points[i]))[0].coords[0]
        first = LineString(first_points)
        second_points = list(second.coords)
        second_points[0] = nearest_points(first, Point(second_points[0]))[0].coords[0]
        second_points[-1] = nearest_points(surface.boundary, Point(second_points[-1]))[0].coords[0]
        second = LineString(second_points)
        after = [first.coords[0], first.coords[-1], second.coords[0], second.coords[-1]]
        adjustments = [Point(p).distance(Point(q)) for p, q in zip(before, after)]
        assert max(adjustments) < .01, adjustments
        nodes = MultiPoint(after)
        linework = [snap(LineString(surface.exterior.coords), nodes, 1e-7),
                    snap(first, nodes, 1e-7), snap(second, nodes, 1e-7)]
        pieces = list(polygonize(unary_union(linework)))
        assert len(pieces) == 3, len(pieces)
        assert all(p.is_valid and p.area > 0 for p in pieces)
        assert unary_union(pieces).symmetric_difference(surface).area < 1e-8
        return pieces, adjustments

    sp, source_adjustments = partition(source, a, b)
    tp, target_adjustments = partition(target, ta, tb)
    # These are original source label boxes (Rectangle 48 / 50), not labels
    # generated by the matcher. C6 is the remaining connected thumb region,
    # continuous with the source's explicitly labelled C6 forearm.
    label_points = {'C7': (1859, 2452), 'C8': (1953, 2432)}
    named_source, named_target = {}, {}
    for label, point in label_points.items():
        named_source[label] = next(p for p in sp if p.covers(Point(point)))
        named_target[label] = next(p for p in tp if p.covers(Point(transform(point))))
    assert not named_target['C7'].equals(named_target['C8'])
    named_source['C6'] = next(p for p in sp if all(not p.equals(q) for q in named_source.values()))
    named_target['C6'] = next(p for p in tp if all(not p.equals(q) for q in named_target.values()))
    original = {'outline': mapping(source), 'boundaries': [mapping(a), mapping(b)]}
    registered = {'outline': mapping(target), 'boundaries': [mapping(ta), mapping(tb)]}
    evidence = {
        'status': 'experimental_not_approved', 'sourceSlide': 26,
        'sourceGroupId': '71682', 'sourceOutlineShapeId': '71995',
        'boundaryShapeIds': ['72147', '72148'], 'sourceWristCutY': 2310,
        'sourceCoordinates': 'DrawingML group child coordinates; not image pixels',
        'anchors': [{'name': n, 'source': s, 'targetLogical': t} for n, s, t in resolved],
        'source': original, 'target': registered,
        'sourceCage': cage.tolist(), 'targetCage': mapped_cage.tolist(),
        'mappedBoundarySimple': [ta.is_simple, tb.is_simple],
        'targetBoundaryOutsideLength': [ta.difference(target).length, tb.difference(target).length],
        'sourceEndpointJoinAdjustments': source_adjustments,
        'sourceRawStrokeJoinDistances': [
            Point(source_path(152)[-1]).distance(Point(cage[4])),
            Point(source_path(153)[0]).distance(a),
            Point(source_path(153)[-1]).distance(Point(cage[2])),
        ],
        'targetEndpointJoinAdjustments': target_adjustments,
        'sourceLabelPoints': label_points,
        'sourceRegions': {k: mapping(v) for k, v in named_source.items()},
        'targetRegions': {k: mapping(v) for k, v in named_target.items()},
        'technicalAreaConservationError': unary_union(tp).symmetric_difference(target).area,
    }
    return evidence, named_target


def build():
    from shapely.affinity import scale
    from shapely.geometry import shape, MultiPolygon
    evidence, right_regions = register()
    resource = json.loads((ROOT/'data/body/palm-resource.json').read_text())
    basis = {key: resource[key] for key in ['templateId', 'templateVersion', 'geometryId', 'regionSetId']}
    version = 'palm-dermatomes-preview.3'
    attribution = ('Image adapted from Servier Medical Art (https://smart.servier.com), '
                   'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). '
                   '掌侧曲线数字化、腕部截取、配准及左右镜像；非医学审核。')
    source_url = 'https://smart.servier.com/smart_image/dermatomes/'
    colors = {'C6': '#e4ae55', 'C7': '#66b5b1', 'C8': '#9385c5'}
    output = {}
    correction_areas = {}
    for view in ['palm-left', 'palm-right']:
        body = shape(resource['views'][view]['body'])
        regions = []
        for label in ['C6', 'C7', 'C8']:
            polygon = scale(right_regions[label], xfact=1/440, yfact=1/700, origin=(0, 0))
            if view == 'palm-left':
                polygon = scale(polygon, xfact=-1, yfact=1, origin=(.5, 0))
            # Only floating-point conversion noise may be removed at the skin
            # edge. An anatomical overshoot is an error, never silently clipped.
            outside = polygon.difference(body).area
            assert outside < 1e-14, (view, label, outside)
            correction_areas[view+'/'+label] = outside
            canonical = np.array(body.exterior.coords)
            def restore_ring(ring):
                result = []
                for p in ring.coords:
                    distances = np.linalg.norm(canonical-np.array(p), axis=1)
                    nearest = distances.argmin()
                    result.append(tuple(canonical[nearest]) if distances[nearest] < 1e-12 else p)
                return result
            polygon = Polygon(restore_ring(polygon.exterior), [restore_ring(h) for h in polygon.interiors])
            if polygon.geom_type == 'Polygon':
                geometry = MultiPolygon([polygon])
            elif polygon.geom_type == 'MultiPolygon':
                geometry = polygon
            else:
                raise ValueError('Unexpected region topology: '+polygon.geom_type)
            assert geometry.is_valid and body.covers(geometry)
            center = geometry.representative_point()
            regions.append({
                'id': view+'-'+label.lower(), 'atlasVersion': version,
                **{k: basis[k] for k in ['templateId', 'templateVersion', 'geometryId']},
                'partitionType': 'spinal_dermatome', 'labelId': label,
                'sourceLabel': label, 'view': view, 'side': view.split('-')[1],
                'color': colors[label], 'geometry': mapping(geometry),
                'labelPoint': {'x': center.x, 'y': center.y},
                'sourceRefs': ['servier-dermatomes-2016'],
                'sourcePathIndices': [0, 152, 153],
                'registrationRefs': ['servier-palm-cage-v3'],
                'productionStatus': 'registered_development_preview',
                'medicalReviewStatus': 'pending',
                'derivation': 'Source slide 26 group 71682: curves 72147/72148; palm-web/wrist cage; left is mirrored from registered right. No expert validation.',
            })
        shapes_now = [shape(r['geometry']) for r in regions]
        assert unary_union(shapes_now).symmetric_difference(body).area < 1e-12
        for i, a in enumerate(shapes_now):
            for b in shapes_now[i+1:]:
                assert a.intersection(b).area < 1e-14
        output[view+'.json'] = {'view': view, 'atlasVersion': version, 'regions': regions}
    sources = {
        'boundarySystem': 'spinal_dermatome', 'boundaryLicenseStatus': 'verified',
        'sources': [{
            'id': 'servier-dermatomes-2016', 'purpose': 'dermatome_boundaries',
            'url': source_url, 'author': 'Servier Medical Art / Les Laboratoires Servier',
            'license': 'CC BY 4.0', 'licenseStatus': 'verified',
            'commercialAdaptationAllowed': True, 'attribution': attribution,
            'licenseEvidence': ['https://smart.servier.com/how-to-cite-servier-medical-art/',
                                'https://smart.servier.com/using-smart-images-what-you-can-do/'],
            'originalUrl': 'https://smart.servier.com/wp-content/uploads/2016/10/SMART-Nervous-system.pptx',
            'originalFile': 'data/sources/servier-palm-v1/original.pptx',
            'originalSHA256': hashlib.sha256(raw).hexdigest(),
            'boundaryEvidence': 'Slide 26 anterior figure, group 71682, C6 forearm continuous to thumb; C7/C8 label shapes 72039/72041; boundary shapes 72147/72148.',
            'limitations': 'Educational schematic; individual overlap/variation and transfer to Gray palm are not clinically validated. The two original hands are not independent medical observations.',
        }],
        'previousResearchRecord': 'docs/validation-records/v6.1-sources.md',
    }
    evidence.update(status='passed_offline_geometry', geometryId=basis['geometryId'],
                    registrationId='servier-palm-cage-v3', medicalReviewStatus='pending',
                    method='mean-value coordinates of four palmar web landmarks and two wrist-cut corners; NOT whole-hand image registration',
                    mirroring='Registered right -> left: normalized x=1-x, y unchanged',
                    normalizedEdgeRoundoffAreas=correction_areas,
                    sourceSHA256=hashlib.sha256(raw).hexdigest(),
                    displayResourceSHA256=hashlib.sha256((ROOT/'data/body/palm-resource.json').read_bytes()).hexdigest(),
                    rejectedExperiments='docs/validation-records/v6.1-recheck/registration-v01-rejected and registration-v02-rejected',
                    note='Offline geometric checks only. No physician review, diagnostic validation, or new full-body anatomy.')
    manifest = {
        'atlasId': 'palm-dermatomes-v1', 'atlasVersion': version, **basis,
        'sourceTitle': 'Servier Medical Art — Dermatomes（掌侧配准参考预览）',
        'sourceUrl': source_url, 'attribution': attribution, 'license': 'CC BY 4.0',
        'sourceLicenseStatus': 'verified', 'medicalReviewStatus': 'pending',
        'mappingEnabled': False, 'technicalValidationStatus': 'passed_offline_geometry',
        'coverageNote': '来自 Servier 教学示意图的掌侧 C6/C7/C8 配准预览。腕部仅含来源截取范围；没有添加 T1。图示全覆盖不等于个体分布完整或医学确诊，皮节重叠及配准仍待专家审核。',
    }
    output.update({'sources.json': sources, 'registration.json': evidence})
    serialize = lambda v: json.dumps(v, ensure_ascii=False, indent=2)+'\n'
    text_files = {name: serialize(value) for name, value in output.items()}
    digest = hashlib.sha256()
    for name in ['palm-left.json', 'palm-right.json', 'sources.json', 'registration.json']:
        digest.update(name.encode()+b'\0'+text_files[name].encode()+b'\0')
    manifest['contentSHA256'] = digest.hexdigest()
    text_files['manifest.json'] = serialize(manifest)
    return text_files


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true', help='Write the development-preview dataset')
    args = parser.parse_args()
    for name, text in build().items():
        path = ROOT/'data/atlas/palm-v1'/name
        if args.write:
            path.write_text(text)
        else:
            assert path.read_text() == text, 'Generated palm atlas drift: '+name
    print('Generated source-derived palm preview (medical review pending)' if args.write else 'PASSED: original source -> registered palm atlas reproducible')


