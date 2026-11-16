"""Fixed identity for the neutral perineum overview.

The public loader is implemented by the schematic service. This module only
defines immutable file paths and view/basis metadata.
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ATLAS_ID = "perineum-schematic-v1"
ATLAS_VERSION = "perineum-schematic.1"
ATLAS_DIR = ROOT / "data/atlas/perineum-schematic-v1"
BODY_FILE = ROOT / "data/body/perineum-v1.json"
RESOURCE_KEY = "data/body/perineum-resource.json"
RESOURCE_FILE = ROOT / RESOURCE_KEY
VIEWS = {"perineum-overview": "unspecified"}
INPUTS = ["perineum-overview.json", "sources.json", "registration.json"]
BASIS = {
    "templateId": "neutral-perineum-overview-v1",
    "templateVersion": "1.0.0",
    "geometryId": "neutral-perineum-skin-v1",
    "regionSetId": "neutral-perineum-ui-v1",
}


def content_hash(blobs):
    digest = hashlib.sha256()
    for name in INPUTS:
        digest.update(name.encode() + b"\0" + blobs[name] + b"\0")
    return digest.hexdigest()
