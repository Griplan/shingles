"""Local reference matching via stdin, using the exact API schema and core."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.schemas.evaluate import EvaluateRequest
from app.services.atlas_service import load_dataset
from app.services.dermatome_matcher import evaluate
from app.main import matching_enabled
if __name__=='__main__':
    if not matching_enabled():raise SystemExit('Set DERMATOME_ENV=development and ENABLE_REFERENCE_MATCHING=1 for local reference matching.')
    request=EvaluateRequest.model_validate(json.load(sys.stdin))
    print(evaluate(request,load_dataset(request.identity)).model_dump_json(indent=2))
