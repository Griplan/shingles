"""Independent Goran plantar registry; same V4 loader and matcher, never back coordinates."""
import hashlib
import sys
from pathlib import Path
from app.services.local_atlas_service import load_local_dataset

ROOT=Path(__file__).resolve().parents[3]
ATLAS_ID='goran-sole-v1'
ATLAS_VERSION='goran-sole-preview.1'
ATLAS_DIR=ROOT/'data/atlas/sole-v1'
BODY_FILE=ROOT/'data/body/sole-v1.json'
RESOURCE_KEY='data/body/sole-resource.json'
RESOURCE_FILE=ROOT/RESOURCE_KEY
VIEWS={'sole-left':'left','sole-right':'right'}
INPUTS=['sole-left.json','sole-right.json','sources.json','registration.json']
BASIS=dict(templateId='goran-sole-v1',templateVersion='1.0.0',geometryId='goran-plantar-outline-v1',regionSetId='goran-sole-ui-v1')
# Only floating-point shared-edge noise; same V6.4 area and distance bounds.
CONTAINMENT_ROUNDOFF=1e-12
CONTAINMENT_DISTANCE_ROUNDOFF=1e-10

def content_hash(blobs):
    h=hashlib.sha256()
    for name in INPUTS:h.update(name.encode()+b'\0'+blobs[name]+b'\0')
    return h.hexdigest()

def validate_source_region(region, registration):
    label=region['labelId']
    route={'L5':'root/9/1/43','S1':'root/9/1/44'}.get(label)
    evidence=next((e for e in registration['sourceElements'] if e['label']==label),None)
    if (not evidence or evidence['route']!=route or region['sourceElementId']!=route
            or region['sourcePathSHA256']!=evidence['pathD_SHA256']
            or region['viewId']!=region['view'] or region['atlasId']!=ATLAS_ID
            or region['dermatomeLabel']!=label or region['sourceLabel']!=label
            or region['sourceLicense']!='CC BY-SA 4.0'
            or region['registrationMethod']!='same_source_similarity_180_no_mirror'
            or region['sourceFile']!=registration['sourceFile']):
        raise ValueError('sole source evidence mismatch')

def load_sole_dataset(identity):
    return load_local_dataset(identity,sys.modules[__name__])
