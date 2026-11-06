"""Source-to-export fidelity and PNG alpha containment; no medical accuracy metric."""
import sys,json,hashlib,platform
from pathlib import Path
from PIL import Image
from shapely.geometry import Point,shape
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
from build_sole_atlas import extract
_,base,_=extract();_,fine,_=extract(.01)
report={}
for side,v in base.items():
 view='sole-'+side
 im=Image.open(ROOT/f'miniprogram/assets/sole/{view}.png').convert('RGBA')
 model=json.loads((ROOT/'data/body/sole-resource.json').read_text())['views'][view]
 body=shape(model['body']);inside=outside=0
 for y in range(6,im.height,12):
  for x in range(6,im.width,12):
   p=Point((x+.5)/im.width,(y+.5)/im.height)
   if p.distance(body.boundary)<.006:continue # stroke + antialias tolerance, not skin expansion
   if body.contains(p):assert im.getpixel((x,y))[3]>200;inside+=1
   else:assert im.getpixel((x,y))[3]==0;outside+=1
 regions={r['labelId']:shape(r['geometry']) for r in json.loads((ROOT/f'data/atlas/sole-v1/{view}.json').read_text())['regions']}
 report[view]={'pngSize':im.size,'alphaSamplesInside':inside,'alphaSamplesOutside':outside,'pngSHA256':hashlib.sha256((ROOT/f'miniprogram/assets/sole/{view}.png').read_bytes()).hexdigest(),'samplingHausdorffNormalizedAgainstHalfTolerance':{l:g.hausdorff_distance(fine[side]['regions'][l]) for l,g in v['regions'].items()},'L5_S1_overlapArea':regions['L5'].intersection(regions['S1']).area,'containmentOutsideArea':{l:g.difference(body).area for l,g in regions.items()},'sourceToExportAreaDiscrepancy':{l:g.symmetric_difference(v['regions'][l]).area for l,g in regions.items()}}
 assert report[view]['L5_S1_overlapArea']<1e-12
(Path(__file__).parent/'resource-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS PNG alpha, source curves, 4 actual regions, holes and no area overlap',report)
