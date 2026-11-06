"""V6.5 independent data checks; technical only, never medical review."""
import hashlib,json
from pathlib import Path
from shapely.geometry import shape,box
from shapely.ops import unary_union
from check_preview_atlas import validate_geometry
from sync_atlas import ATLAS,content_hash
ROOT=Path(__file__).resolve().parents[1]
def check():
 m=json.loads((ATLAS/'manifest.json').read_text());report=json.loads((ATLAS/'hand-registration.json').read_text())
 assert m['contentSHA256']==content_hash() and m['atlasVersion'].endswith('.3')
 assert m['medicalReviewStatus']=='pending' and m['mappingEnabled'] is False
 for f,h in report['parentFileSHA256'].items():assert hashlib.sha256((ATLAS.parent/'goran-2022-preview-v2'/f).read_bytes()).hexdigest()==h
 result={'atlasVersion':m['atlasVersion'],'status':'PASSED_OFFLINE_GEOMETRY','views':{},'notMedicalReview':True}
 for view in ['front','back']:
  old=json.loads((ATLAS.parent/'goran-2022-preview-v2'/(view+'.json')).read_text())['regions'];rows=json.loads((ATLAS/(view+'.json')).read_text())['regions'];lookup={r['id']:r for r in rows}
  for r in old:
   for key in r:
    if key not in ['atlasVersion','templateVersion','geometryId']:assert lookup[r['id']][key]==r[key],(r['id'],key)
  hand=[r for r in rows if '-hand-' in r['id']];body=shape(json.loads((ROOT/'data/body/commons-template4-hands-v2.json').read_text())['views'][view]['geometry'])
  counts={'regions':len(rows),'newHandRegions':len(hand),'vertices':0,'holes':0}
  for r in rows:
   g,n=validate_geometry(r['geometry']);counts['vertices']+=n['vertices'];counts['holes']+=n['holes']
   assert r['view']==view and r['templateVersion']==m['templateVersion']
   if '-hand-' in r['id']:
    assert g.difference(body).area<1e-12 and r['sourceLicense']=='CC BY-SA 4.0'
    assert (g.centroid.x>.5)==((view=='front')==(r['side']=='left'))
    assert r['sourceElementId'].startswith('root/') and r['sourcePathSHA256']
  union=unary_union([shape(r['geometry']) for r in hand]);assert sum(shape(r['geometry']).area for r in hand)-union.area<1e-11
  result['views'][view]=counts
 return result
if __name__=='__main__':print(json.dumps(check(),ensure_ascii=False,indent=2))
