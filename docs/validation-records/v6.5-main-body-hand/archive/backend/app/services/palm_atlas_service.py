"""Fixed palm-only registry; missing anatomical boundaries must never mean no-match.

This loader has no dataset cache or request-controlled paths. Every request checks
identity, content, surface containment, side and provenance before existing V4 math.
"""
import hashlib
import json
from pathlib import Path

from shapely.errors import ShapelyError

from app.schemas.evaluate import Identity
from app.services.atlas_service import Dataset, valid_geometry
from app.utils.geometry import EvaluationError

ROOT = Path(__file__).resolve().parents[3]
ATLAS_ID = 'palm-dermatomes-v1'
ATLAS_VERSION = 'palm-dermatomes-preview.3'
ATLAS_DIR = ROOT/'data/atlas/palm-v1'
BODY_FILE = ROOT/'data/body/palm-v1.json'
RESOURCE_KEY = 'data/body/palm-resource.json'
RESOURCE_FILE = ROOT/RESOURCE_KEY
VIEWS = {'palm-left': 'left', 'palm-right': 'right'}
INPUTS = ['palm-left.json', 'palm-right.json', 'sources.json', 'registration.json']
BASIS = {'templateId': 'commons-palm-v1', 'templateVersion': '1.1.0',
         'geometryId': 'commons-palm-outline-v2', 'regionSetId': 'commons-palm-ui-v2'}


def content_hash(blobs):
    digest = hashlib.sha256()
    for name in INPUTS:
        digest.update(name.encode()+b'\0'+blobs[name]+b'\0')
    return digest.hexdigest()


def load_palm_dataset(identity: Identity) -> Dataset:
    from app.services.local_atlas_service import load_local_dataset
    import sys
    return load_local_dataset(identity, sys.modules[__name__])
