"""Paired unchanged-full-body regression and new local-view measurements, local only."""
import os,sys,json,hashlib,time,statistics,platform,types
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
sys.path[:0]=[str(ROOT/'backend'),str(ROOT/'backend/tests')]
os.environ['DERMATOME_ENV']='test';os.environ['ENABLE_REFERENCE_MATCHING']='1'
from app.services import atlas_service as current
from app.services.dermatome_matcher import evaluate
from app.schemas.evaluate import EvaluateRequest
from test_evaluate_api import payload
from test_sole_matching import request as sole_request
from test_palm_matching import palm_identity
from app.services import palm_atlas_service as palms
from fastapi.testclient import TestClient
from app.main import app
before=json.loads((OUT/'before-sha256.json').read_text())
source=(ROOT/'backend/app/services/atlas_service.py').read_text()
branch="    if identity.atlas_id == 'goran-sole-v1':\n        from app.services.sole_atlas_service import load_sole_dataset\n        return load_sole_dataset(identity)\n"
assert source.count(branch)==1
baseline=source.replace(branch,'');assert hashlib.sha256(baseline.encode()).hexdigest()==before['backend/app/services/atlas_service.py']
(OUT/'baseline-atlas-service.py.txt').write_text(baseline)
mod=types.ModuleType('v64_before_loader');mod.__file__=str(ROOT/'backend/app/services/atlas_service.py');sys.modules[mod.__name__]=mod;exec(compile(baseline,mod.__file__,'exec'),mod.__dict__)

def measure(q,loader):
 t=time.perf_counter();dataset=loader(q.identity);loaded=time.perf_counter();r=evaluate(q,dataset);end=time.perf_counter()
 return r.model_dump(mode='json'),dict(total_ms=(end-t)*1000,load_ms=(loaded-t)*1000,match_ms=(end-loaded)*1000)
def summary(items):
 a=sorted(items);return dict(n=len(a),p50=statistics.median(a),p95=a[int(.95*len(a)+.999999)-1],maximum=max(a))
report={'environment':{'python':sys.version,'platform':platform.platform(),'machine':platform.machine()},'method':'One warm pair + 20 alternating pairs, serial; full-body baseline loader is reconstructed then verified byte-for-byte against pre-change SHA256. Exact same P6 matcher; no production calls, no SLA/fps claim.','full_body':{},'local_views':{}}
for view,count in [('front',1),('back',1),('front',5)]:
 data=payload(.5,.35,view);data['lesions']=[{**data['lesions'][0],'id':str(i)} for i in range(count)];q=EvaluateRequest.model_validate(data);rows=[]
 for i in range(21):
  if i%2:a,ta=measure(q,mod.load_dataset);b,tb=measure(q,current.load_dataset)
  else:b,tb=measure(q,current.load_dataset);a,ta=measure(q,mod.load_dataset)
  assert a==b
  rows.append(dict(warmup=i==0,before=ta,after=tb))
 report['full_body'][f'{view}-{count}']={'samples':rows,'before':summary([r['before']['total_ms'] for r in rows[1:]]),'after':summary([r['after']['total_ms'] for r in rows[1:]])}
http=[]
with TestClient(app) as client:
 for view in ['sole-left','sole-right','palm-left','palm-right']:
  if view.startswith('sole'):q=sole_request(view, None if view.endswith('left') else [__import__('shapely').geometry.box(.64,.2,.66,.22)])
  else:
   q=EvaluateRequest(request_id='V64_PALM_REGRESSION',annotation_revision=1,identity=palm_identity(palms.ATLAS_DIR,palms.BODY_FILE),lesions=[{'id':'test','view':view,'vertices':[{'x':.55,'y':.2},{'x':.57,'y':.2},{'x':.56,'y':.22}]}])
  samples=[]
  for i in range(21):
   result,t=measure(q,current.load_dataset)
   if i:samples.append(t)
  response=client.post('/api/v1/evaluate',json=q.model_dump(mode='json'));assert response.status_code==200,response.text
  http.append({'request':q.model_dump(mode='json'),'status':response.status_code,'response':response.json()})
  report['local_views'][view]={'samples':samples,'summary':summary([x['total_ms'] for x in samples])}
for file in ['backend/app/services/dermatome_matcher.py','miniprogram/utils/annotation-geometry.ts','miniprogram/utils/coordinate.ts','miniprogram/utils/manual-annotation.ts','miniprogram/utils/placement-geometry.ts']:
 assert hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==before[file],file
report['unchanged_core_files']='V4 matcher, P6 body index, coordinate, manual edit and V5 placement verified against start snapshot'
(OUT/'performance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(OUT/'http-evidence.json').write_text(json.dumps(http,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:{case:{key:val for key,val in item.items() if key!='samples'} for case,item in report[k].items()} for k in ['full_body','local_views']},indent=2))
