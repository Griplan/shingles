import os,sys,json,time,statistics,hashlib,platform
from pathlib import Path
R=Path.cwd();sys.path[:0]=[str(R/'backend'),str(R/'backend/tests')]
os.environ['DERMATOME_ENV']='test';os.environ['ENABLE_REFERENCE_MATCHING']='1'
from test_evaluate_api import payload as body
from test_sole_matching import request as sole
from test_axilla_schematic import payload, dataset
from app.schemas.evaluate import EvaluateRequest
from app.services.atlas_service import load_dataset
from app.services.dermatome_matcher import evaluate
rows={};d=dataset();g=d.bodies[d.regions[0]['view']];axilla=EvaluateRequest.model_validate(payload(g,d.regions[0]['view']))
for name,q in [('body',EvaluateRequest.model_validate(body())),('sole',sole()),('schematic',axilla)]:
 times=[];signature=None
 for i in range(22):
  start=time.perf_counter();result=evaluate(q,load_dataset(q.identity)).model_dump(mode='json',exclude_none=True);elapsed=(time.perf_counter()-start)*1000
  digest=hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()
  if signature is not None:assert signature==digest
  signature=digest
  if i>=2:times.append(elapsed)
 rows[name]=dict(n=20,medianMs=statistics.median(times),p95Ms=sorted(times)[18],rawMs=times,responseSHA256=signature)
old=json.loads((R/'docs/validation-records/v6.6-axilla/evidence/performance-after.json').read_text())
for name in ['body','sole']:assert rows[name]['responseSHA256']==old['results'][name]['responseSHA256']
O=Path(__file__).parent/'evidence/performance.json';O.write_text(json.dumps(dict(environment=platform.platform(),method='2 warmups +20 serial load/validate/evaluate; unchanged numeric matcher; excludes new optional null metadata; not native UI timing',historicalBaseline='v6.6 performance-after; background load uncontrolled, not paired speedup evidence',results=rows),indent=2))
print({k:v['medianMs'] for k,v in rows.items()})
