"""Experimental source-to-palm registration; does not write production atlases.

Extracts DrawingML cubic paths from Servier slide 26. Source boundary IDs are
explicitly recorded. Mean-value cage coordinates change the drawing's pose;
they are NOT a medically validated correspondence. Keep rejected runs too.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

import numpy as np
from shapely.geometry import Polygon, LineString, Point, box, mapping
from shapely.ops import nearest_points, split

DIR = Path(__file__).resolve().parent
ROOT = DIR.parents[2]
NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
tree = ET.parse(DIR/'slide26.xml')
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
    resolved = [(name, nearest_points(sr, Point(s))[0].coords[0],
                 nearest_points(tr, Point(t))[0].coords[0]) for name, s, t in anchors]
    for ring, which in [(sr, 1), (tr, 2)]:
        distances = [ring.project(Point(a[which])) for a in resolved]
        forward = sum((b-a) % ring.length for a, b in zip(distances, distances[1:]+distances[:1]))
        if forward > ring.length*1.01:
            if which == 1:
                sr = LineString(list(sr.coords)[::-1])
            else:
                tr = LineString(list(tr.coords)[::-1])
    source_cage, target_cage = [], []
    for first, last in zip(resolved, resolved[1:]+resolved[:1]):
        sd = (sr.project(Point(last[1]))-sr.project(Point(first[1]))) % sr.length
        td = (tr.project(Point(last[2]))-tr.project(Point(first[2]))) % tr.length
        fractions = np.linspace(0, 1, max(3, int(max(sd, td)/0.2)+1), endpoint=False)
        source_cage.extend(arc(sr, first[1], last[1], fractions))
        target_cage.extend(arc(tr, first[2], last[2], fractions))
    cage, mapped_cage = np.array(source_cage), np.array(target_cage)
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
    coords_b[-1] = nearest_points(source.boundary, Point(coords_b[-1]))[0].coords[0]
    b = LineString(coords_b)
    ta, tb = LineString([transform(p) for p in a.coords]), LineString([transform(p) for p in b.coords])
    original = {'outline': mapping(source), 'boundaries': [mapping(a), mapping(b)]}
    registered = {'outline': mapping(target), 'boundaries': [mapping(ta), mapping(tb)]}
    save('servier-registration-draft.json', {
        'status': 'experimental_not_approved', 'sourceSlide': 26,
        'sourceGroupId': '71682', 'sourceOutlineShapeId': '71995',
        'boundaryShapeIds': ['72147', '72148'], 'sourceWristCutY': 2310,
        'sourceCoordinates': 'DrawingML group child coordinates; not image pixels',
        'anchors': [{'name': n, 'source': s, 'targetLogical': t} for n, s, t in resolved],
        'source': original, 'target': registered,
        'sourceCage': cage.tolist(), 'targetCage': mapped_cage.tolist(),
        'mappedBoundarySimple': [ta.is_simple, tb.is_simple],
        'targetBoundaryOutsideLength': [ta.difference(target).length, tb.difference(target).length],
    })
    return source, target, a, b, ta, tb, resolved


if __name__ == '__main__':
    register()
    print('Wrote EXPERIMENTAL draft only; no runtime atlas changed')
