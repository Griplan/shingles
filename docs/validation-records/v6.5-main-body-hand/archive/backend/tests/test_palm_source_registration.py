"""Source-registration engineering checks; not clinical dermatome validation."""
import hashlib
import json
from pathlib import Path

import pytest
from shapely.affinity import scale
from shapely.geometry import Point, box, shape
from shapely.ops import unary_union

from app.schemas.evaluate import EvaluateRequest
from app.services import palm_atlas_service as palms
from app.services.dermatome_matcher import evaluate
from test_palm_matching import palm_identity

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize('view', ['palm-left', 'palm-right'])
@pytest.mark.parametrize('name,logical,label', [
    ('thumb', (380, 320), 'C6'), ('index', (250, 150), 'C7'),
    ('middle', (185, 140), 'C7'), ('ring', (135, 140), 'C8'),
    ('little', (65, 220), 'C8'), ('thenar', (320, 460), 'C6'),
    ('central_palm', (210, 375), 'C7'), ('ulnar_palm', (65, 430), 'C8'),
])
def test_source_observed_landmarks_and_matching(name, logical, label, view):
    # Expectations were assigned while viewing the original Servier image and
    # Gray surface, before running the matcher. Mirror retains anatomical side.
    x, y = logical[0]/440, logical[1]/700
    if view == 'palm-left':
        x = 1-x
    dataset = palms.load_palm_dataset(palm_identity(palms.ATLAS_DIR, palms.BODY_FILE))
    point = Point(x, y)
    assert [r['labelId'] for r in dataset.regions if r['view'] == view and r['shape'].contains(point)] == [label]
    lesion = box(x-.001, y-.001, x+.001, y+.001)
    request = EvaluateRequest(request_id='SOURCE_REGISTRATION_CHECK', annotation_revision=1,
                              identity=dataset.identity, lesions=[{
        'id': name, 'view': view, 'vertices': [{'x': px, 'y': py} for px, py in lesion.exterior.coords],
    }])
    result = evaluate(request, dataset).lesions[0]
    assert [c.label for c in result.candidates] == [label]
    assert result.covered_ratio == pytest.approx(1)


def test_registered_partition_is_valid_contained_nonoverlapping_and_mirrored():
    dataset = palms.load_palm_dataset(palm_identity(palms.ATLAS_DIR, palms.BODY_FILE))
    by_view = {view: [r for r in dataset.regions if r['view'] == view] for view in palms.VIEWS}
    for view, regions in by_view.items():
        geometries = [r['shape'] for r in regions]
        assert all(g.is_valid and dataset.bodies[view].covers(g) for g in geometries)
        assert unary_union(geometries).symmetric_difference(dataset.bodies[view]).area < 1e-12
        for i, geometry in enumerate(geometries):
            assert all(geometry.intersection(other).area < 1e-14 for other in geometries[i+1:])
        assert all(r['partitionType'] == 'spinal_dermatome' and r['medicalReviewStatus'] == 'pending' for r in regions)
    for left, right in zip(by_view['palm-left'], by_view['palm-right']):
        assert left['labelId'] == right['labelId']
        mirrored = scale(right['shape'], xfact=-1, yfact=1, origin=(.5, 0))
        assert left['shape'].symmetric_difference(mirrored).area < 1e-12


def test_original_curve_provenance_and_no_medical_approval_claim():
    registration = json.loads((palms.ATLAS_DIR/'registration.json').read_text())
    original = ROOT/'data/sources/servier-palm-v1/original.pptx'
    assert hashlib.sha256(original.read_bytes()).hexdigest() == registration['sourceSHA256']
    assert registration['boundaryShapeIds'] == ['72147', '72148']
    assert registration['sourceSlide'] == 26 and registration['sourceGroupId'] == '71682'
    assert len(registration['anchors']) == 6
    assert registration['mappedBoundarySimple'] == [True, True]
    assert max(registration['targetBoundaryOutsideLength']) == 0
    assert max(registration['sourceRawStrokeJoinDistances']) < .5
    assert max(registration['targetEndpointJoinAdjustments']) < .01
    manifest = json.loads((palms.ATLAS_DIR/'manifest.json').read_text())
    assert manifest['mappingEnabled'] is False and manifest['medicalReviewStatus'] == 'pending'
    assert manifest['sourceLicenseStatus'] == 'verified'
