"""Extract the public-domain Gray1237 palmar surface paths; no hand drawing or dermatome inference."""
from pathlib import Path
import hashlib, json, sys
from xml.etree import ElementTree as ET
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts'))
from svg_geometry import path_rings
from shapely.geometry import Polygon, box, mapping
from shapely.affinity import translate, scale
SOURCE = Path(__file__).with_name('gray1237.original.svg')
OUT = ROOT / 'miniprogram/assets/palm'
W,H = 440,700
WRIST_CUT = 610.0
Y_TRANSLATION = 40.0
TOLERANCE = .12
EXPECTED_SOURCE_SHA256 = '0e0a71717f4278acc418f8d6a930767d3edef5a32e8890df895777da95d8c07c'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED_SOURCE_SHA256, 'Source version changed; re-audit before rebuilding'
root=ET.parse(SOURCE).getroot()
paths={e.get('id'):e for e in root.iter() if e.tag.split('}')[-1]=='path'}
outline=paths['path1881'].get('d')
source=Polygon(path_rings(outline,tolerance=TOLERANCE)[0])
assert source.is_valid, 'Original hand outline must be valid; do not silently repair it'
trimmed=source.intersection(box(-1000,-1000,1000,WRIST_CUT))
assert trimmed.geom_type=='Polygon' and trimmed.is_valid
body=translate(trimmed,yoff=Y_TRANSLATION)
crease_ids=[f'path{i}' for i in range(5541,5596,2)]
creases='\n'.join(f'<path id="{i}" d="{paths[i].get("d")}" fill="none" stroke="#81877f" stroke-width="0.9" stroke-linecap="round"/>' for i in crease_ids)
# Author's open forearm path is closed only at the documented display wrist cut.
xs=sorted([x for x,y in trimmed.exterior.coords if abs(y-WRIST_CUT)<1e-7])
assert len(xs)>=2
meta={
 'templateId':'commons-palm-v1','templateVersion':'1.1.0','geometryId':'commons-palm-outline-v2','regionSetId':'commons-palm-ui-v2',
 'logicalWidth':W,'logicalHeight':H,'coordinateSpace':'body_template_normalized_v1','direction':'fingers-up',
 'source':{'id':'commons-gray1237-palm','title':'Gray1237.svg','url':'https://commons.wikimedia.org/wiki/File:Gray1237.svg','originalUrl':'https://upload.wikimedia.org/wikipedia/commons/a/a9/Gray1237.svg','author':'Rhcastilhos (vectorisation), after Henry Vandyke Carter / Gray’s Anatomy plate 1237','license':'Public domain (PD-self; worldwide fallback permission for any purpose)','licenseEvidenceUrl':'https://commons.wikimedia.org/wiki/File:Gray1237.svg#Licensing','sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'originalLogicalWidth':530.75,'originalLogicalHeight':743.44,'outlinePathId':'path1881','creasePathIds':crease_ids},
 'derivation':{'wristCutSourceY':WRIST_CUT,'sourceToLeftLogicalMatrix':[1,0,0,1,0,Y_TRANSLATION],'leftToRightLogicalMatrix':[-1,0,0,1,W,0],'curveSamplingToleranceSourceUnits':TOLERANCE,'changes':['Removed bones, arteries, leader lines and text; retained original outline and skin crease paths','Cropped proximal forearm at source y=610; closed this display wrist boundary','Translated source 40 logical units down without changing hand proportions','Mirrored x to create right palm from the original left palm; no neural boundaries inferred'],'sideConvention':'Palmar surface faces the observer, fingers up. Left anatomical palm has screen-left thumb; right anatomical palm has screen-right thumb. The original Gray1237.png caption identifies a left palm, consistent with the unmirrored SVG. Version 1.1.0 corrects the reversed view assignments in 1.0.0; old annotations are not silently reassigned.'},
 'views':{}}
for view,mirror in [('palm-left',False),('palm-right',True)]:
 g=scale(body,xfact=-1,yfact=1,origin=(W/2,0)) if mirror else body
 normalized=scale(g,xfact=1/W,yfact=1/H,origin=(0,0))
 assert normalized.is_valid and len(normalized.interiors)==0
 coords=[[round(x,8),round(y,8)] for x,y in normalized.exterior.coords]
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<title>{view}: source-derived palmar display outline, not a dermatome atlas</title>
<desc>Derived from Gray1237.svg by Rhcastilhos, public domain. Original left palm outline and skin creases only. Wrist crop y=610; mirror for right palm.</desc>
<defs><clipPath id="wrist-cut"><rect x="0" y="0" width="530.75" height="610"/></clipPath></defs>
<g transform="{'matrix(-1 0 0 1 440 0)' if mirror else 'matrix(1 0 0 1 0 0)'}"><g transform="translate(0 40)">
<g clip-path="url(#wrist-cut)"><path id="source-outline" d="{outline} Z" fill="#faf7f1" stroke="#4d5951" stroke-width="1.8" stroke-linejoin="round"/>{creases}</g>
<path d="M {xs[0]:.8f} 610 L {xs[-1]:.8f} 610" fill="none" stroke="#4d5951" stroke-width="1.8"/>
</g></g></svg>'''
 (OUT/f'{view}.svg').write_text(svg)
 meta['views'][view]={'view':view,'anatomicalSide':'right' if mirror else 'left','thumbScreenSide':'right' if mirror else 'left','imagePath':f'/assets/palm/{view}.png','svgPath':f'/assets/palm/{view}.svg','body':{'type':'Polygon','coordinates':[coords]},'bodyBounds':list(normalized.bounds),'bodyArea':normalized.area,'outlineVertexCount':len(coords),'mirroredFrom':'palm-left' if mirror else None}
(ROOT/'data/body/palm-resource.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'logicalSize':[W,H], 'views':{k:{'vertices':v['outlineVertexCount'],'bounds':v['bodyBounds'],'area':v['bodyArea']} for k,v in meta['views'].items()}},indent=2))
