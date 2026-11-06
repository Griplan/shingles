"""V6.4 deterministic extraction, not inferred anatomy. Default validates; --write emits.
Original curves -> SVG paint order -> visible plantar domain -> one rigid similarity.
No hull, buffer, gap fill, simplification, mirroring or medical boundary invention.
"""
import argparse, copy, hashlib, json, re, sys
from pathlib import Path
import xml.etree.ElementTree as ET
from shapely import set_precision
from shapely.geometry import box, mapping, MultiPolygon, shape
from shapely.ops import unary_union
from shapely.affinity import affine_transform
from shapely.geometry.polygon import orient
from svg_geometry import transform, multiply, path_rings, filled_geometry, flatten_geometry

ROOT=Path(__file__).resolve().parents[1]
SOURCE='docs/research/v3-atlas/goran-back.original.svg'
URL='https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg'
LICENSE='CC BY-SA 4.0'
NS='{http://www.w3.org/2000/svg}'
ET.register_namespace('', NS[1:-1])
BASIS=dict(templateId='goran-sole-v1',templateVersion='1.0.0',geometryId='goran-plantar-outline-v1',regionSetId='goran-sole-ui-v1')
ATLAS_ID='goran-sole-v1'; VERSION='goran-sole-preview.1'
TOL=.02; WIDTH=320; HEIGHT=640; SCALE=5.6
ATLAS=ROOT/'data/atlas/sole-v1'
OUT=ROOT/'docs/validation-records/v6.4'
INPUTS=['sole-left.json','sole-right.json','sources.json','registration.json']
SOURCE_ID='commons-goran-2022-plantar'
NOTE='仅 Goran 原图可见足底投影的 L5/S1；原图细缝及未配置表面不补齐。非完整足部周向、外周神经分布或诊断；医学审核待完成。'

def serialized(x):return json.dumps(x,ensure_ascii=False,indent=2)+'\n'
def at(root,route):
 e=root
 for i in route.split('/')[1:]:e=e[int(i)]
 return e

def matrix(root,route):
 m=transform(None); e=root
 m=multiply(m,transform(e.get('transform')))
 for i in route.split('/')[1:]:
  e=e[int(i)];m=multiply(m,transform(e.get('transform')))
 return m

def geo(root,route,tol=TOL):
 e=at(root,route)
 return filled_geometry(path_rings(e.get('d'),matrix(root,route),tolerance=tol),'evenodd' if 'fill-rule:evenodd' in e.get('style','') else 'nonzero')

def mp(g):return MultiPolygon([orient(p,sign=1) for p in flatten_geometry(g)])
def gj(g):return json.loads(json.dumps(mapping(mp(g))))
def svg_path(g):
 return ' '.join('M'+' L'.join(f'{x:.12g},{y:.12g}' for x,y in ring.coords)+' Z' for p in flatten_geometry(g) for ring in [p.exterior,*p.interiors])
def digest(d):
 h=hashlib.sha256()
 for n in INPUTS:h.update(n.encode()+b'\0'+d[n].encode()+b'\0')
 return h.hexdigest()

def extract(tol=TOL):
 blob=(ROOT/SOURCE).read_bytes();assert hashlib.sha1(blob).hexdigest()=='261566ce5128fdc2cc536945c148ac1c8f62e66d'
 root=ET.fromstring(blob)
 assert not any(e.tag in (NS+'mask',NS+'clipPath',NS+'use') for e in root.iter())
 audit=json.loads((ROOT/'docs/goran-full-atlas-audit/evidence/back-raw-source-regions.json').read_text())['regions']
 paths={};evidence=[]
 for label,route,leader in [('L5','root/9/1/43','root/12/62'),('S1','root/9/1/44','root/12/47')]:
  e=at(root,route);old=next(x for x in audit if x['route']==route)
  sha=hashlib.sha256(e.get('d').encode()).hexdigest()
  assert e.tag==NS+'path' and old['label']==label and old['pathD_SHA256']==sha
  assert at(root,leader).tag==NS+'path'
  paths[label]=geo(root,route,tol)
  evidence.append(dict(label=label,route=route,sourceElementId=e.get('id'),pathD_SHA256=sha,leaderRoute=leader,
                       accumulatedSVGMatrix=matrix(root,route),sourceBounds=paths[label].bounds,
                       identityEvidence='Pinned whole-file SHA1 + actual element route/tag + d SHA256 + V6.3 visible leader trace; not index alone'))
 # True visible fills, subtract all later SVG paint layers (including ankle S2).
 visible={}
 for label,route in [('L5','root/9/1/43'),('S1','root/9/1/44')]:
  later=[geo(root,f'root/9/1/{i}',tol) for i in range(int(route.split('/')[-1])+1,50)]
  visible[label]=paths[label].difference(unary_union(later))
 silhouette=geo(root,'root/9/0/0',tol)
 views={}
 for side,half in [('left',box(0,800,210,960)),('right',box(210,800,423.6,960))]:
  # At y=880 both edges are already below the source's heel cap. Use that actual
  # cap above the seam and the independent full-body skin silhouette below it.
  # This keeps actual toe skin and source fill gaps, unlike a dermatome-union body.
  cap=paths['S1'].intersection(half)
  body=mp(silhouette.intersection(cap.union(half.intersection(box(0,880,424,960)))))
  assert body.is_valid and not body.is_empty
  cx=(body.bounds[0]+body.bounds[2])/2;cy=(847.03+945.32)/2
  svg_m=[-SCALE,0,0,-SCALE,WIDTH/2+SCALE*cx,HEIGHT/2+SCALE*cy]
  norm=[svg_m[0]/WIDTH,0,0,svg_m[3]/HEIGHT,svg_m[4]/WIDTH,svg_m[5]/HEIGHT]
  target=mp(set_precision(affine_transform(body,norm),1e-12))
  assert target.is_valid and all(0<=x<=1 for x in target.bounds)
  raw_regions={label:mp(affine_transform(g.intersection(body),norm)) for label,g in visible.items()}
  numerical_loss={label:g.difference(target).area for label,g in raw_regions.items()}
  assert max(numerical_loss.values()) < 1e-11
  regions={label:mp(set_precision(g,1e-12).intersection(target)) for label,g in raw_regions.items()}
  # Node sub-grid roundoff at shared skin edges; no anatomical expansion.
  reconciled=mp(unary_union([target,*regions.values()]))
  reconciliation=dict(area=reconciled.difference(target).area,hausdorff=target.hausdorff_distance(reconciled))
  assert reconciliation['area']<1e-11 and reconciliation['hausdorff']<1e-10
  target=reconciled
  # Exact containment is verified after JSON roundtrip, not assumed from a crop.
  for g in regions.values():assert g.is_valid and not g.is_empty and g.difference(target).area<1e-12,(side,'surface containment',g.is_valid,g.is_empty,g.difference(target).area)
  views[side]=dict(body=body,target=target,regions=regions,matrix=svg_m,norm=norm,
                   reconciliation=reconciliation,numerical_loss=numerical_loss,losses={label:visible[label].intersection(half).difference(body).area for label in visible})
 return root,views,evidence

def artwork(root,v):
 body=v['body'];bounds=box(*body.bounds)
 paths=[]
 # Retain the real plantar shading, toe creases and contour paths, no labels or dermatome lines.
 for group in [2,3,4,5,6]:
  for i,e in enumerate(root[9][group]):
   if e.tag!=NS+'path':continue
   route=f'root/9/{group}/{i}'
   pts=[p for ring in path_rings(e.get('d'),matrix(root,route),tolerance=TOL) for p in ring]
   if not pts:continue
   xs,ys=zip(*pts)
   if not bounds.intersects(box(min(xs),min(ys),max(xs),max(ys))):continue
   child=copy.deepcopy(e);child.set('transform','matrix('+','.join(map(str,matrix(root,route)))+')')
   paths.append(ET.tostring(child,encoding='unicode'))
 # Keep only gradients transitively used by the extracted real artwork.
 # Removing unused definitions saves package bytes without changing any path.
 definitions={e.get('id'):e for d in root if d.tag==NS+'defs' for e in d.iter() if e.get('id')}
 def refs(text):return set(re.findall(r'url\(#([^)]+)\)',text)+re.findall(r'href="#([^"]+)"',text))
 pending=refs(''.join(paths));needed=set()
 while pending:
  key=pending.pop()
  if key in needed:continue
  assert key in definitions,key
  needed.add(key);pending.update(refs(ET.tostring(definitions[key],encoding='unicode'))-needed)
 defs='<defs>'+''.join(ET.tostring(definitions[k],encoding='unicode') for k in sorted(needed))+'</defs>'
 path=svg_path(body);m=','.join(map(str,v['matrix']))
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}"><title>Goran original plantar surface; CC BY-SA 4.0; 180 degree rotation; no mirror</title>{defs}<defs><clipPath id="plantar-skin"><path d="{path}" fill-rule="evenodd"/></clipPath></defs><g transform="matrix({m})"><path d="{path}" fill="#f0d5c0" stroke="#9e8072" stroke-width=".28" fill-rule="evenodd"/><g clip-path="url(#plantar-skin)">{"".join(paths)}</g></g></svg>'

def build():
 root,views,evidence=extract();files={}
 attribution='Goran_tek-en (2022), CC BY-SA 4.0；从原背图独立提取两足足底，移除标签和皮节底色，旋转180°并等比例放大；两侧均为原侧，未镜像。'
 source=dict(title='Dermatomes labeled, male back 3d-shaded — plantar detail',url=URL,author='Goran_tek-en',license=LICENSE,attribution=attribution)
 resource={**BASIS,'logicalWidth':WIDTH,'logicalHeight':HEIGHT,'coordinateSystem':'normalized_2d_top_left','source':source,'views':{}}
 coverage={};regions_by_view={}
 audit=json.loads((ROOT/'docs/goran-full-atlas-audit/evidence/back-raw-source-regions.json').read_text())['regions']
 later=None;other_paint=[]
 for i in range(49,-1,-1):
  g=geo(root,f'root/9/1/{i}');visible=g if later is None else g.difference(later)
  later=g if later is None else later.union(g)
  if i in (43,44):continue
  for side,v in views.items():
   fragment=visible.intersection(v['body'])
   if fragment.area>0:
    other_paint.append(dict(side=side,sourceElementId=f'root/9/1/{i}',sourceLabel=next(x['label'] for x in audit if x['index']==i),areaOriginalSVGUnits=fragment.area,bounds=fragment.bounds,ratioOfSkin=fragment.area/v['body'].area,status='unconfigured',reason=('Numerical boundary-only residue, no measurable plantar area.' if fragment.area<1e-10 else 'Proximal ankle/heel seam fragment; not confirmed as an independent plantar area. Keep uncovered, no extrapolation.')))
 for side,v in views.items():
  view='sole-'+side;svg=f'miniprogram/assets/sole/{view}.svg';png=f'/assets/sole/{view}.png'
  files[svg]=artwork(root,v)
  resource['views'][view]=dict(anatomicalSide=side,body=gj(v['target']),imagePath=png,svgPath='/assets/sole/'+view+'.svg',orientation='toes_up_180_degree_no_mirror')
  regions=[]
  for label,g in v['regions'].items():
   ref=next(e for e in evidence if e['label']==label);p=g.representative_point()
   regions.append(dict(id=view+'-'+label,view=view,viewId=view,side=side,**BASIS,atlasId=ATLAS_ID,atlasVersion=VERSION,
    partitionType='spinal_dermatome',labelId=label,dermatomeLabel=label,sourceLabel=label,
    color='#a79cd9' if label=='L5' else '#9086fa',geometry=gj(g),labelPoint={'x':p.x,'y':p.y},
    sourceRefs=[SOURCE_ID],sourcePathIndices=[int(ref['route'].split('/')[-1])],sourceFile=SOURCE,
    sourceElementId=ref['route'],sourceSVGId=ref['sourceElementId'],sourcePathSHA256=ref['pathD_SHA256'],sourceLicense=LICENSE,
    registrationMethod='same_source_similarity_180_no_mirror',registrationRefs=['registration.json'],
    productionStatus='registered_development_preview',medicalReviewStatus='pending',derivation=attribution))
  regions_by_view[view]=regions
  files['data/atlas/sole-v1/'+view+'.json']=serialized(dict(view=view,atlasVersion=VERSION,regions=regions))
  union=unary_union(list(v['regions'].values()));blank=v['target'].difference(union)
  coverage[view]=dict(skinArea=v['target'].area,coveredArea=union.area,uncoveredArea=blank.area,
    uncoveredRatio=blank.area/v['target'].area,uncoveredGeometry=gj(blank),sourceClippingLossArea=v['losses'],numericalContainmentLoss=v['numerical_loss'],skinNodingRoundoff=v['reconciliation'],
    labels={l:dict(area=g.area,parts=len(g.geoms),holes=sum(len(p.interiors) for p in g.geoms)) for l,g in v['regions'].items()})
 files['data/body/sole-resource.json']=serialized(resource)
 body={**BASIS,'coordinateSystem':'normalized_2d_top_left','sourceSHA256':{'data/body/sole-resource.json':hashlib.sha256(files['data/body/sole-resource.json'].encode()).hexdigest()},'views':{view:dict(side=view.split('-')[1],geometry=x['body']) for view,x in resource['views'].items()}}
 files['data/body/sole-v1.json']=serialized(body)
 sources=dict(boundarySystem='spinal_dermatome',boundaryLicenseStatus='verified',sources=[dict(id=SOURCE_ID,purpose='dermatome_boundaries',licenseStatus='verified',**source,boundaryEvidence=evidence,licenseEvidence=URL,licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',sourceFile=SOURCE,sourceSHA256=hashlib.sha256((ROOT/SOURCE).read_bytes()).hexdigest())])
 files['data/atlas/sole-v1/sources.json']=serialized(sources)
 registration=dict(**BASIS,status='passed_offline_geometry',method='same_source_similarity_180_no_mirror',sourceFile=SOURCE,
   curveToleranceOriginalUnits=TOL,simplification=None,numericalPrecisionNormalized=1e-12,mirrored=False,clipOrMaskInOriginal=False,
   bodyDefinition='Original full-body silhouette root/9/0/0 below y=880 plus its intersection with original S1 heel cap above y=880. Only a plantar display-domain seam, not an added dermatome border.',
   views={side:dict(sourceToLogicalSVGMatrix=v['matrix'],sourceToNormalizedShapelyMatrix=v['norm']) for side,v in views.items()},
   sourceElements=evidence,unconfiguredAdjacentSourceFragments=other_paint,medicalReviewStatus='pending')
 files['data/atlas/sole-v1/registration.json']=serialized(registration)
 content=digest({n:files['data/atlas/sole-v1/'+n] for n in INPUTS})
 manifest=dict(**BASIS,atlasId=ATLAS_ID,atlasVersion=VERSION,contentSHA256=content,sourceTitle=source['title'],sourceUrl=URL,
  attribution=attribution,license=LICENSE,sourceLicenseStatus='verified',mappingEnabled=False,medicalReviewStatus='pending',technicalValidationStatus='passed_offline_geometry',coverageNote=NOTE)
 files['data/atlas/sole-v1/manifest.json']=serialized(manifest)
 identity=dict(template_id=BASIS['templateId'],template_version=BASIS['templateVersion'],geometry_id=BASIS['geometryId'],region_set_id=BASIS['regionSetId'],atlas_id=ATLAS_ID,atlas_version=VERSION,atlas_content_sha256=content,body_content_sha256=hashlib.sha256(files['data/body/sole-v1.json'].encode()).hexdigest(),coordinate_system='normalized_2d_top_left')
 models={}
 for view,s in resource['views'].items():
  rings=[dict(outer=[{'x':x,'y':y} for x,y in p[0]],holes=[[{'x':x,'y':y} for x,y in ring] for ring in p[1:]]) for p in s['body']['coordinates']]
  models[view]=dict(id=BASIS['templateId'],version=BASIS['templateVersion'],geometryId=BASIS['geometryId'],regionSetId=BASIS['regionSetId'],name='左脚底' if view=='sole-left' else '右脚底',view=view,logicalWidth=WIDTH,logicalHeight=HEIGHT,imagePath=s['imagePath'],sourcePath=s['svgPath'],body=rings,resource=source,
   atlas=dict(identity=identity,regions=regions_by_view[view],technicalReady=True,blockedReason='',**{k:manifest[k] for k in ['sourceTitle','sourceUrl','attribution','medicalReviewStatus','coverageNote']}))
 files['miniprogram/data/sole.generated.ts']='// GENERATED by scripts/build_sole_atlas.py; independent original sides, CC BY-SA 4.0.\nimport {LocalSurfaceModel} from "../types/local-surface";\nimport {SoleView} from "../types/dermatome";\nexport const SOLE_MODELS:Readonly<Record<SoleView,LocalSurfaceModel>>='+json.dumps(models,ensure_ascii=False,separators=(',',':'))+';\n'
 files['docs/validation-records/v6.4/extraction.json']=serialized(dict(sourceElements=evidence,coverage=coverage,registration=registration))
 return files

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
 for name,text in build().items():
  p=ROOT/name
  if args.write:p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
  else:assert p.read_text()==text,'Stale sole export: '+name
 print('PASS: actual Goran source identity, paint order, both independent sides, valid containment, synchronized exports')
