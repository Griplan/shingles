"""Same-process parent/current data comparison; not a phone FPS benchmark."""
import sys,json,time,statistics,platform,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT/'backend'),str(ROOT/'backend/tests')]
from shapely.geometry import shape,box
from shapely.ops import unary_union
from app.services.atlas_service import Dataset,load_dataset
from app.services.dermatome_matcher import evaluate
from app.schemas.evaluate import Identity,EvaluateRequest
from test_evaluate_api import identity,payload
OUT=ROOT/'docs/validation-records/v6.5-main-body-hand/evidence'
def raw_load(version):
 p=ROOT/f'data/atlas/goran-2022-preview-{version}';m=json.loads((p/'manifest.json').read_text());rs=[]
 for v in ['front','back']:
  for r in json.loads((p/(v+'.json')).read_text())['regions']:rs.append({**r,'shape':shape(r['geometry'])})
 b=json.loads((ROOT/('data/body/commons-template4.json' if version=='v2' else 'data/body/commons-template4-hands-v2.json')).read_text())
 # Identity does not participate in geometry; use current request binding for paired pure-matcher tests only.
 return Dataset(Identity(**identity()),m,tuple(rs),{v:shape(b['views'][v]['geometry']) for v in b['views']})
def stats(a):
 b=sorted(a);return {'n':len(a),'medianMs':statistics.median(a),'p95Ms':b[min(len(b)-1,int(len(b)*.95))],'maxMs':max(a)}
def timecall(fn):
 t=time.perf_counter();r=fn();return r,(time.perf_counter()-t)*1000
old,new=raw_load('v2'),raw_load('v3')
rows=[]
for v in ['front','back']:
 for label in ['T5','T10','C5','L3','L5']:
  r=next(r for r in old.regions if r['view']==v and r['labelId']==label and r['side']=='left');p=r['shape'].representative_point();e=min(.0005,p.distance(r['shape'].boundary)/3)
  q=payload(p.x,p.y,v);q['lesions'][0]['vertices']=[{'x':x,'y':y} for x,y in box(p.x-e,p.y-e,p.x+e,p.y+e).exterior.coords];rows.append(q['lesions'][0]|{'id':v+label})
q=payload();q['lesions']=rows;request=EvaluateRequest.model_validate(q)
a,b=evaluate(request,old),evaluate(request,new)
def comparable(r):
 d=r.model_dump(include={'lesions','views'})
 for c in d['lesions']+d['views']:
  for item in c['candidates']:item.pop('region_ids') # same candidate can now include additional distal hand instances
 return d
assert comparable(a)==comparable(b),'Non-hand numerical results changed'
raw={v:{'dataDecodeGeometryMs':[],'matcher10LesionsMs':[]} for v in ['v2','v3']}
for _ in range(20):
 for v,d in [('v2',old),('v3',new)]:
  _,ms=timecall(lambda:raw_load(v));raw[v]['dataDecodeGeometryMs'].append(ms)
  _,ms=timecall(lambda:evaluate(request,d));raw[v]['matcher10LesionsMs'].append(ms)
actual_load=[]
for _ in range(20):_,ms=timecall(lambda:load_dataset(Identity(**identity())));actual_load.append(ms)
# Actual source-derived cross-label hand lesions; these are engineering test shapes, not patient cases.
examples=[]
for v,s,x,y in [('front','right',68,473),('front','left',332,473),('back','left',72,475),('back','right',330,477)]:
 q=payload(x/400,y/900,v);q['lesions'][0]['vertices']=[{'x':a/400,'y':b/900} for a,b in box(x-8,y-4,x+8,y+4).exterior.coords]
 result=evaluate(EvaluateRequest.model_validate(q),new);examples.append({'name':v+'-'+s,'request':q,'response':result.model_dump()})
(OUT/'hand-matching-examples.json').write_text(json.dumps(examples,ensure_ascii=False,indent=2)+'\n')
report={'date':'2026-11-05','environment':{'python':platform.python_version(),'machine':platform.machine(),'system':platform.platform()},'method':'Alternating 20 parent/current iterations in same process; same 10 fixed non-hand lesions; P6 matcher unchanged. Raw dataset decode excludes provenance hashing in both versions. Current production loader measured separately. No phone timing.','nonHandEquivalence':'EXACT: coverage/area/labels/sides/order for 10 lesions and 2 view unions; identity/source and expanded candidate region-id lists intentionally excluded','statistics':{v:{k:stats(a) for k,a in vals.items()} for v,vals in raw.items()},'currentValidatedLoader':stats(actual_load),'raw':raw}
(OUT/'performance.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='raw'},indent=2))
