"""Real local CPU model; hooks and timers only in this process, no saved photo/mask."""
import sys,time,json,platform,resource,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];sys.path[:0]=[str(ROOT),str(ROOT/'backend')]
import psutil
from ai.inference.mobile_sam import MobileSAM
import ai.segmentation as segmentation
from app.services.ai_sessions import AISessions
from app.schemas.ai import SegmentRequest
OUT=ROOT/'docs/performance-audit/evidence';rows=[];current={}
def wrap(obj,name,key):
 original=getattr(obj,name)
 def wrapped(*a,**k):
  t=time.perf_counter()
  try:return original(*a,**k)
  finally:current.setdefault(key,[]).append((time.perf_counter()-t)*1000)
 setattr(obj,name,wrapped)
for name in ['prepare_image','mask_to_polygons','inspect_candidates']:wrap(segmentation,name,name)
load_start=time.perf_counter();model=MobileSAM(ROOT/'ai/models/MobileSAM-source/weights/mobile_sam.pt',device='cpu',threads=4);load_ms=(time.perf_counter()-load_start)*1000
# Split actual torch modules (CPU synchronous); includes no fake inference.
handles=[]
for name in ['image_encoder','prompt_encoder','mask_decoder']:
 module=getattr(model.predictor.model,name);start={}
 def pre(m,a,key=name,clock=start):clock['t']=time.perf_counter()
 def post(m,a,o,key=name,clock=start):current.setdefault(key,[]).append((time.perf_counter()-clock['t'])*1000)
 handles += [module.register_forward_pre_hook(pre),module.register_forward_hook(post)]
wrap(model.predictor,'set_image','set_image')
photo=ROOT/'ai/experiments/inputs/cdc-21505.jpg'
# Real production service lifecycle, isolated temp directory; not the live service.
with tempfile.TemporaryDirectory(prefix='p5-ai-') as folder:
 service=AISessions(root=Path(folder),model_factory=lambda:model)
 for name in ['_persist','_publish']:wrap(service,name,name)
 service.persistent=True
 created=service.create();sid=created['session_id'];token=created['session_token']
 t=time.perf_counter();data=photo.read_bytes();read_ms=(time.perf_counter()-t)*1000
 t=time.perf_counter();uploaded=service.upload(sid,token,data);upload_local_ms=(time.perf_counter()-t)*1000
 for i in range(4):
  current={};t=time.perf_counter();rss=psutil.Process().memory_info().rss;cpu=time.process_time()
  req=SegmentRequest.model_validate({'photo_id':uploaded['photo_id'],'request_id':f'p5-local-ai-{i}','prompt_revision':i,'strategy':'context_crop','prompts':{'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':215/700,'yMin':245/460,'xMax':495/700,'yMax':385/460}}})
  result=service.segment(sid,token,req)
  record=service.sessions[sid]['result']['record'] if hasattr(service,'sessions') else None
  # Public service record on disk: only copy safe timing metadata, never geometry.
  if record is None:record=json.loads((Path(folder)/sid/'result/record.json').read_text())
  rows.append({'traceId':f'p5-local-ai-{i}','kind':'first inference after load' if i==0 else 'same image/crop repeat','wall_ms':(time.perf_counter()-t)*1000,'cpu_ms':(time.process_time()-cpu)*1000,'rss_before':rss,'rss_after':psutil.Process().memory_info().rss,'process_highwater_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'phases_ms':current,'model_timings':record['timings'],'candidate_count':len(result['candidates']),'response_bytes':len(json.dumps(result).encode())})
 service.delete(sid,token);service.close()
for h in handles:h.remove()
(OUT/(sys.argv[1] if len(sys.argv)>1 else 'ai-local.json')).write_text(json.dumps({'environment':{'python':sys.version,'platform':platform.platform(),'cpu':'Apple M4','threads':4,'device':'cpu'},'source':'existing CDC PHIL21505 public-domain 700x460; no image data saved in this audit','model':model.metadata,'load_ms':load_ms,'input_read_ms':read_ms,'local_upload_decode_orient_encode_ms':upload_local_ms,'rows':rows,'notes':'First service call receives already loaded model; cold user time additionally includes load_ms. _publish includes _persist and PNG writes; nested timers not additive.'},indent=2)+'\n')
print('real local inference complete',len(rows))
