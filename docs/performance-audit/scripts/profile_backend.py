"""Local phase timings only; synthetic coordinates never appear in measurements."""
import sys,json,time,statistics,platform,resource,cProfile,pstats,io,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];sys.path[:0]=[str(ROOT/'backend'),str(ROOT)]
from app.schemas.evaluate import EvaluateRequest
from app.services.atlas_service import load_dataset
from app.services.dermatome_matcher import evaluate
import psutil,shapely,pydantic
import app.services.dermatome_matcher as matcher
sub={};scope=''
for name in ['annotation_geometry','candidates_for','coverage','unary_union']:
 original=getattr(matcher,name)
 def wrapped(*a,_f=original,_name=name,**k):
  global scope
  previous=scope
  if _name!='unary_union':scope=_name
  label=scope+'.'+_name if _name=='unary_union' else _name;t=time.perf_counter()
  try:return _f(*a,**k)
  finally:
   sub.setdefault(label,[]).append((time.perf_counter()-t)*1000);scope=previous
 setattr(matcher,name,wrapped)
OUT=ROOT/'docs/performance-audit/evidence'
base=json.loads((ROOT/'docs/paper-technical-report/audit/example-evaluate.json').read_text())['request']
rows=[]
for count in [1,5]:
 for rep in range(10):
  sub={};trace=f'match-local-{count}-{rep}';p=json.loads(json.dumps(base));p['request_id']=trace
  p['lesions']=[{**p['lesions'][0],'id':f'synthetic-{i}'} for i in range(count)]
  row={'traceId':trace,'lesion_objects':count,'phases_ms':{},'rss_before':psutil.Process().memory_info().rss}
  def step(name,f):
   t=time.perf_counter();v=f();row['phases_ms'][name]=(time.perf_counter()-t)*1000;return v
  t=time.perf_counter();encoded=step('REQUEST_SERIALIZE',lambda:json.dumps(p));raw=step('REQUEST_JSON_PARSE',lambda:json.loads(encoded));req=step('PYDANTIC_VALIDATE',lambda:EvaluateRequest.model_validate(raw));d=step('ATLAS_LOAD',lambda:load_dataset(req.identity));result=step('MATCH_BACKEND',lambda:evaluate(req,d));s=step('RESPONSE_SERIALIZE',result.model_dump_json);step('CLIENT_JSON_PARSE_PYTHON',lambda:json.loads(s));row.update(wall_ms=(time.perf_counter()-t)*1000,request_bytes=len(encoded.encode()),response_bytes=len(s.encode()),rss_after=psutil.Process().memory_info().rss);row['nested_match_ms']=sub;rows.append(row)
pr=cProfile.Profile();pr.enable();req=EvaluateRequest.model_validate(base);evaluate(req,load_dataset(req.identity));pr.disable();buf=io.StringIO();pstats.Stats(pr,stream=buf).strip_dirs().sort_stats('cumulative').print_stats(28)
(OUT/'backend-cprofile-detailed.txt').write_text(buf.getvalue())
(OUT/'backend-local-detailed.json').write_text(json.dumps({'environment':{'python':sys.version,'platform':platform.platform(),'processor':platform.machine(),'shapely':shapely.__version__,'pydantic':pydantic.__version__},'kind':'local Python single process, synthetic requests; no HTTP or native client','rows':rows},indent=2)+'\n')
print('backend complete',len(rows),'runs')
