"""Recheck actual Goran source elements. Audit geometry is NEVER an axilla atlas."""
import hashlib,json,copy,xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import mapping
from build_sole_atlas import at,matrix,geo,svg_path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/validation-records/v6.6-axilla/evidence'
NS='{http://www.w3.org/2000/svg}'
SOURCES={'front':('d20be473843591779be22c102e193d8c1407861d',[1,2,3,19,20]),'back':('261566ce5128fdc2cc536945c148ac1c8f62e66d',[6,7,8,41])}

def build():
 rows=[]; originals=[]; curves=[]
 for view,(sha,indices) in SOURCES.items():
  file=ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg';blob=file.read_bytes();assert hashlib.sha1(blob).hexdigest()==sha
  root=ET.fromstring(blob);assert not any(e.tag in (NS+'clipPath',NS+'mask',NS+'use') for e in root.iter())
  old=json.loads((ROOT/f'docs/goran-full-atlas-audit/evidence/{view}-raw-source-regions.json').read_text())['regions']
  for i in indices:
   ref=next(r for r in old if r['index']==i);e=at(root,ref['route']);assert e.tag==NS+'path'
   assert hashlib.sha256(e.get('d').encode()).hexdigest()==ref['pathD_SHA256']
   g=geo(root,ref['route'],.02);assert g.is_valid and not g.is_empty
   rows.append(dict(sourceFile=str(file.relative_to(ROOT)),sourceSHA1=sha,route=ref['route'],sourceElementId=e.get('id'),sourceLabel=ref['label'],pathD_SHA256=ref['pathD_SHA256'],parentMatrix=matrix(root,ref['route']),scope='original arms-down visible skin only',sourceLicense='CC BY-SA 4.0',sides=ref['sides'],rawGeometry=mapping(g),admittedToAxilla=False,reason='Missing hidden skin and cross-pose boundary correspondences; no target registration.'))
  # Original artwork including color and leader context, cropped in ORIGINAL SVG units.
  for side,bounds in [('screen-left',(95,165,100,205)),('screen-right',(260,165,100,205))]:
   x=(len(originals))*250
   panel=copy.deepcopy(root);panel.set('viewBox',' '.join(map(str,bounds)));panel.set('width','240');panel.set('height','492');panel.set('x',str(x));panel.set('y','38')
   text=ET.tostring(panel,encoding='unicode')
   import re
   prefix=f'{view}-{side}-'
   text=re.sub(r'id="([^"]+)"',lambda m:'id="'+prefix+m[1]+'"',text)
   text=re.sub(r'url\(#([^)]+)\)',lambda m:'url(#'+prefix+m[1]+')',text)
   text=re.sub(r'href="#([^"]+)"',lambda m:'href="#'+prefix+m[1]+'"',text)
   originals.append(text+f'<text x="{x+10}" y="24">{view} / {side}</text>')
   regionPaths=''.join(f'<path d="{svg_path(geo(root,r["route"],.02))}" fill="{r["color"]}" fill-opacity=".45" stroke="{r["color"]}" stroke-width=".3"/>' for r in old if r['index'] in indices)
   curves.append(f'<svg x="{x}" y="38" width="240" height="492" viewBox="{bounds[0]} {bounds[1]} {bounds[2]} {bounds[3]}">{regionPaths}</svg><text x="{x+10}" y="24">{view} / {side}</text>')
 return rows,originals,curves

if __name__=='__main__':
 OUT.mkdir(parents=True,exist_ok=True);rows,originals,curves=build()
 (OUT/'goran-source-elements.json').write_text(json.dumps({'auditOnly':True,'coordinateSpace':'original_svg_user_units','registeredRegionCount':0,'elements':rows},ensure_ascii=False,indent=2)+'\n')
 for name,panels in [('goran-axilla-original',originals),('goran-source-curves',curves)]:
  (OUT/(name+'.svg')).write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="565"><rect width="100%" height="100%" fill="#fff"/><g font-family="sans-serif" font-size="14">'+''.join(panels)+'<text x="12" y="550">Goran_tek-en / CC BY-SA 4.0 | Original arms-down surface only; NOT registered to axilla. Offline preview.</text></g></svg>')
 print('Pinned 9 original paths rechecked; T1, T2, T3, T1/T2. Axilla atlas admission: 0.')
