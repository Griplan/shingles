"""Bounded local timing of unchanged real full-body/sole requests; no cloud load."""
import json, sys, time, statistics, platform, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path[:0]=[str(ROOT/'backend'),str(ROOT/'backend/tests')]
from test_evaluate_api import payload
from test_sole_matching import request
from app.schemas.evaluate import EvaluateRequest
from app.services.atlas_service import load_dataset
from app.services.dermatome_matcher import evaluate
rows={}
for name,q in [('body',EvaluateRequest.model_validate(payload())),('sole',request())]:
    times=[]; reference=None
    for i in range(22):
        start=time.perf_counter(); response=evaluate(q,load_dataset(q.identity)).model_dump(mode='json')
        ms=(time.perf_counter()-start)*1000
        if reference is None: reference=response
        assert response==reference
        if i>=2: times.append(ms)
    rows[name]={'n':len(times),'medianMs':statistics.median(times),'p95Ms':sorted(times)[18],'maxMs':max(times),'rawMs':times,'responseSHA256':hashlib.sha256(json.dumps(reference,sort_keys=True).encode()).hexdigest()}
out=Path(__file__).parent/'evidence'/('performance-'+sys.argv[1]+'.json')
out.write_text(json.dumps({'environment':platform.platform(),'python':platform.python_version(),'method':'2 warmups + 20 serial load/validate/evaluate calls, local CPU; not native Canvas or phone latency','results':rows},indent=2)+'\n')
print(json.dumps({k:{a:b for a,b in v.items() if a!='rawMs'} for k,v in rows.items()},indent=2))
