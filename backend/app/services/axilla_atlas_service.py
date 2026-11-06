"""Fixed V6.6 identity. No boundary evidence: shared loader returns ATLAS_NOT_READY.

No Goran/full-body fallback; display-surface licensing cannot enable matching.
"""
import hashlib
import sys
from pathlib import Path
from app.services.local_atlas_service import load_local_dataset

ROOT=Path(__file__).resolve().parents[3]
ATLAS_ID='axilla-reference-v1'
ATLAS_VERSION='axilla-unconfigured.1'
ATLAS_DIR=ROOT/'data/atlas/axilla-v1'
BODY_FILE=ROOT/'data/body/axilla-v1.json'
RESOURCE_KEY='data/body/axilla-resource.json'
RESOURCE_FILE=ROOT/RESOURCE_KEY
VIEWS={'axilla-left':'left','axilla-right':'right'}
INPUTS=['axilla-left.json','axilla-right.json','sources.json','registration.json']
BASIS=dict(templateId='commons-axilla-v1',templateVersion='1.0.0',geometryId='cc0-raised-axilla-outline-v1',regionSetId='commons-axilla-ui-v1')

def content_hash(blobs):
    h=hashlib.sha256()
    for name in INPUTS:h.update(name.encode()+b'\0'+blobs[name]+b'\0')
    return h.hexdigest()

def load_axilla_dataset(identity):
    return load_local_dataset(identity,sys.modules[__name__])
