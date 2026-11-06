"""Documentation artifact integrity checks, not medical validation or UI tests."""
import hashlib
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote

from shapely.affinity import scale
from shapely.geometry import shape, box

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
NS = '{http://www.w3.org/2000/svg}'


def read(path):
    return json.loads(path.read_text())


def run():
    checks = []
    baseline = read(OUT / 'evidence/protected-before.json')
    inventory = {
        str(p.relative_to(ROOT))
        for directory in ('miniprogram', 'backend/app', 'data/body', 'data/atlas')
        for p in (ROOT / directory).rglob('*')
        if p.is_file() and p.suffix in {'.ts', '.js', '.json', '.svg', '.png', '.wxml', '.wxss', '.py'}
        and not {'node_modules', '__pycache__'} & set(p.parts)
        and p.name != 'project.private.config.json'
    }
    assert inventory == set(baseline), 'Runtime file inventory changed'
    assert all(hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == h for p, h in baseline.items())
    checks.append({'name': 'runtime inventory and content unchanged', 'files': len(baseline)})

    paths = read(OUT / 'evidence/goran-paths-rechecked.json')
    assert paths['registeredTargetRegions'] == 0 and len(paths['paths']) == 9
    for p in paths['paths']:
        raw_file = ROOT / f"docs/research/v3-atlas/goran-{p['view']}.original.svg"
        assert hashlib.sha1(raw_file.read_bytes()).hexdigest() == p['sourceSHA1']
        root = ET.parse(raw_file).getroot()
        node = root
        for index in p['route'].split('/')[1:]:
            node = list(node)[int(index)]
        assert hashlib.sha256(node.attrib['d'].encode()).hexdigest() == p['pathD_SHA256']
        assert 'fill-rule:evenodd' in node.get('style', '') and p['fillRule'] == 'evenodd'
        assert node.get('id') is None and p['sourceElementId'] is None
        assert not any(e.tag in {NS+'mask', NS+'clipPath', NS+'use'} for e in root.iter())
        raw, visible = shape(p['rawGeometry']), shape(p['visibleGeometry'])
        assert raw.is_valid and visible.is_valid and not visible.is_empty
        assert visible.difference(raw).area < 1e-7
        assert abs(visible.area-p['paintVisibleAreaSVGUnits2']) < 1e-7
        assert abs(sum(v['areaSVGUnits2'] for v in p['sides'].values())-visible.area) < 1e-7
        assert all(v['areaSVGUnits2'] > 0 for v in p['sides'].values())
        assert p['targetBoundary'] is None and p['targetRegistration'] == 'NOT_ESTABLISHED'
    checks.append({'name': 'pinned source identity and valid visible geometry; no target registrations', 'paths': 9})

    body = read(ROOT / 'data/body/axilla-v1.json')
    drafts = {}
    for side in ('left', 'right'):
        d = drafts[side] = read(OUT / f'review-draft/{side}-observation-windows.json')
        assert d['status'] == 'review-draft' and d['runtimeEligible'] is False
        assert d['viewId'] == f'axilla-{side}'
        assert d['coordinateSpace'] == 'review_template_normalized_v1'
        assert not d['dermatomeDrafts'] and not d['knownDermatomeBoundariesOnTemplate']
        assert d['hiddenSurfaceMask'] is None and d['approval'] is None
        assert all(k['confirmedNormalizedPoint'] is None for k in d['landmarks'])
        assert [o['id'] for o in d['observationWindows']] == ['O1', 'O2', 'O3', 'O4', 'O5']
        surface = shape(body['views'][d['viewId']]['geometry'])
        for o in d['observationWindows']:
            geometry = shape(o['geometry'])
            assert geometry.is_valid and not geometry.is_empty and box(0, 0, 1, 1).covers(geometry)
            assert geometry.difference(surface).area < 1e-12
            assert o['segmentLabel'] is None and o['reviewDecision'] is None
        sheet = ET.parse(OUT / f'review-draft/{side}-annotation-sheet.svg').getroot()
        layer = next(e for e in sheet.iter() if e.get('id') == 'clinician-boundaries-review-draft')
        assert not list(layer), 'Blank review worksheet must have zero neural boundaries'
        assert sheet.get('viewBox') == '0 0 400 360'
    for left, right in zip(drafts['left']['observationWindows'], drafts['right']['observationWindows']):
        assert shape(left['geometry']).symmetric_difference(scale(shape(right['geometry']), -1, 1, origin=(.5, 0))).area < 1e-12
    checks.append({'name': 'valid observation windows, mirrored display and blank medical coordinates', 'windows': 10, 'empty_boundary_sheets': 2})

    submission = read(OUT / 'review-draft/boundary-submission.template.json')
    assert submission['runtimeEligible'] is False and submission['geometry'] is None
    assert submission['label'] is None and submission['approval'] is None
    assert submission['viewId'] is None and submission['status'] == 'review-draft'
    checks.append({'name': 'boundary submission template contains no invented region'})

    atlas = ROOT / 'data/atlas/axilla-v1'
    manifest = read(atlas / 'manifest.json')
    assert manifest['mappingEnabled'] is False and manifest['medicalReviewStatus'] == 'pending'
    assert manifest['technicalValidationStatus'] == 'blocked_missing_boundary_evidence'
    for side in ('left', 'right'):
        assert read(atlas / f'axilla-{side}.json')['regions'] == []
    frontend = (ROOT / 'miniprogram/data/axilla.generated.ts').read_text()
    assert frontend.count('"technicalReady":false') == 2
    checks.append({'name': 'runtime atlas remains empty and disabled on both sides'})

    dimensions = {}
    svgs = sorted((OUT / 'figures').glob('*.svg'))
    assert len(svgs) == 4
    for svg in svgs:
        root = ET.parse(svg).getroot()
        png = svg.with_suffix('.png').read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n'
        w, h = struct.unpack('>II', png[16:24])
        assert (w, h) == (int(root.get('width')), int(root.get('height')))
        dimensions[svg.stem] = [w, h]
    checks.append({'name': 'four review figures render to matching PNG dimensions', 'dimensions': dimensions})

    missing = []
    for md in OUT.glob('*.md'):
        for href in re.findall(r'\]\(([^)]+)\)', md.read_text()):
            if re.match(r'https?://|#', href):
                continue
            target = md.parent / unquote(href.split('#')[0])
            if not target.exists():
                missing.append(f'{md.name}: {href}')
    assert not missing, missing
    checks.append({'name': 'local document and figure links resolve'})
    result = {'status': 'PASSED', 'scope': 'artifact integrity only; not clinical validation', 'checks': checks}
    (OUT / 'evidence/artifact-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    run()
