"""One model instance, one input; full exports included in Linux process peak."""
import sys,os,json,pathlib,time,resource,gc,traceback
ROOT=pathlib.Path('/srv/dermatome-preflight-20261101-p0');sys.path.insert(0,str(ROOT))
stage=sys.argv[1];assert stage in ('load','A','B','C')
def memory():
 d=dict(l.split(':',1) for l in open('/proc/self/status') if ':' in l)
 return {k:int(d[k].split()[0])*1024 for k in ['VmRSS','VmHWM']}
def host():
 d=dict(l.split(':',1) for l in open('/proc/meminfo') if ':' in l)
 return {'available_bytes':int(d['MemAvailable'].split()[0])*1024,'swap_used_bytes':(int(d['SwapTotal'].split()[0])-int(d['SwapFree'].split()[0]))*1024}
def checkpoint():
 # Guard before every expensive phase, in addition to cgroup and independent observer.
 m=memory();h=host()
 if m['VmRSS']>1150*1024**2 or m['VmHWM']>1280*1024**2 or h['available_bytes']<1024**3 or h['swap_used_bytes']>record['before']['swap_used_bytes']+1024**2:
  raise RuntimeError('RESOURCE_MARGIN_INSUFFICIENT')
record={'stage':stage,'kind':'Linux single-process CPU preflight; no medical accuracy labels','python':sys.version,'before':host()}
start=time.monotonic();cpu=time.process_time()
try:
 import torch
 torch.set_num_threads(1);torch.set_num_interop_threads(1)
 from ai.inference.mobile_sam import MobileSAM
 t=time.monotonic();model=MobileSAM(ROOT/'model/MobileSAM-source/weights/mobile_sam.pt',device='cpu',threads=1)
 record.update(model=model.metadata,model_load_call_seconds=time.monotonic()-t,import_and_load_seconds=time.monotonic()-start,after_load=memory(),threads={'intra':torch.get_num_threads(),'inter':torch.get_num_interop_threads()})
 checkpoint()
 if stage!='load':
  from ai.segmentation import segment_image
  from ai.export import export_result
  from PIL import Image
  import numpy as np
  from shapely.geometry import shape
  from ai.preprocessing.image import prepare_image
  if stage=='A':
   source=ROOT/'samples/cdc-18254-neck-crop.png';prompts={'coordinate_space':'photo_oriented_pixels_v1','points':[[210,180,1]],'box':[150,130,265,235]};strategy='context_crop';derivation='Documented neck crop from CDC18254; no face.'
  elif stage=='B':
   source=ROOT/'samples/cdc-21505.jpg';prompts={'coordinate_space':'photo_oriented_pixels_v1','points':[],'box':[215,245,495,385]};strategy='context_crop';derivation='Original public CDC21505.'
  else:
   # 2.98MP derived public image: capacity input, not extra clinical information.
   source=ROOT/'samples/cdc-21506-derived-1400x2126.png'
   with Image.open(ROOT/'samples/cdc-21506.jpg') as im:im.convert('RGB').resize((1400,2126),Image.Resampling.LANCZOS).save(source)
   prompts={'coordinate_space':'photo_oriented_pixels_v1','points':[[920,1300,1]],'box':[700,1180,1060,1400]};strategy='full_image';derivation='CDC21506 enlarged 2x for bounded memory/capacity test only; not new medical sample.'
  checkpoint();t=time.monotonic();prepared=prepare_image(source);record['preprocess_seconds']=time.monotonic()-t;checkpoint()
  t=time.monotonic();result=segment_image(prepared,prompts,model=model,strategy=strategy);record['segment_wall_seconds']=time.monotonic()-t
  record.update(image={'width':result.image.shape[1],'height':result.image.shape[0],'source':source.name,'derivation':derivation},prompts=prompts,strategy=strategy,model_transform=result.record['model_transform'],timings=result.record['timings'],after_segment=memory())
  checkpoint();t=time.monotonic();folder=ROOT/'outputs'/stage;export_result(result,folder);record['export_seconds']=time.monotonic()-t
  record['candidates']=[]
  for c,mask in zip(result.record['candidates'],result.masks):
   g=shape(c['geometry']) if c['geometry'] else None
   item={k:c.get(k) for k in ['candidate_id','status','component_count','hole_count','model_score','quality']}
   item.update(mask_shape=list(mask.shape),mask_foreground_pixels=int(mask.sum()),geometry_valid=bool(g and g.is_valid),area_error_pixels=abs(g.area*mask.size-int(mask.sum())) if g else None)
   record['candidates'].append(item)
  if not any(c['geometry_valid'] for c in record['candidates']):raise RuntimeError('NO_VALID_CONTOUR')
  record['status']='PASSED_ENGINEERING_REQUIRES_USER_CONFIRMATION'
 else:record['status']='MODEL_LOADED'
 record['after']=host();record['final_memory']=memory();record['total_seconds']=time.monotonic()-start;record['process_cpu_seconds']=time.process_time()-cpu;record['ru_maxrss_bytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024
except Exception as e:
 record.update(status='FAILED',error_type=type(e).__name__,error=str(e)[:220],final_memory=memory(),after=host(),total_seconds=time.monotonic()-start)
(ROOT/'logs'/(stage+'-result.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2))
print(json.dumps({k:record.get(k) for k in ['stage','status','model_load_call_seconds','import_and_load_seconds','segment_wall_seconds','export_seconds','total_seconds','final_memory','error']},ensure_ascii=False),flush=True)
if record['status']=='FAILED':sys.exit(2)
