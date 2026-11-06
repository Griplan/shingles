"""One local synthetic-image inference, metadata only. No cache implementation."""
import sys,json,time,resource,platform
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];sys.path.insert(0,str(ROOT))
import numpy as np,psutil
from ai.inference.mobile_sam import MobileSAM
started=time.perf_counter();model=MobileSAM(ROOT/'ai/models/MobileSAM-source/weights/mobile_sam.pt',device='cpu',threads=4)
loaded=time.perf_counter()-started;predictor=model.predictor;record={};original=predictor.reset_image
# Observe the existing tensor immediately before the real finally/reset; retain no tensor.
def reset():
    features=getattr(predictor,'features',None)
    if features is not None:
        record.update(shape=list(features.shape),dtype=str(features.dtype),device=str(features.device),elements=features.numel(),element_bytes=features.element_size(),tensor_bytes=features.numel()*features.element_size(),storage_bytes=features.untyped_storage().nbytes(),input_size=list(predictor.input_size),original_size=list(predictor.original_size))
    original()
predictor.reset_image=reset
image=np.full((460,700,3),190,dtype=np.uint8);image[180:260,280:380]=[150,80,90]
try:
    masks,scores,timings,transform=model.predict(image,{'points':[],'box':[260,160,400,280]})
finally:predictor.reset_image=original
result={'date':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'purpose':'Feature memory sizing only; no clinical accuracy or new performance baseline','input':'Synthetic RGB rectangle, 700x460, no external images','environment':{'python':sys.version,'platform':platform.platform(),'model':model.metadata},'load_ms':loaded*1000,'feature_before_existing_reset':record,'reset_cleared_features':predictor.features is None,'candidate_count':len(masks),'timings':timings,'process_rss':psutil.Process().memory_info().rss,'max_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024)}
Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n');print('Tensor bytes:',record['tensor_bytes'],'reset:',result['reset_cleared_features'])
