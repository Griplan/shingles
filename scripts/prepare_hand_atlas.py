"""Reproduce V6.5 main-body hands; default read-only, --write exports a NEW atlas.
Never writes old atlas/body files, images, sole or medical review status.
"""
import argparse, copy, hashlib, json, math, xml.etree.ElementTree as ET
from pathlib import Path
from shapely import affinity
from shapely.geometry import Polygon, shape, Point
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from hand_registration import ROOT, domains, canonical, landmarks, pair_boundary, mapper, visible, warp_geometry
from svg_geometry import flatten_geometry

PARENT=ROOT/'data/atlas/goran-2022-preview-v2'
ATLAS=ROOT/'data/atlas/goran-2022-preview-v3'
VERSION='goran-2022-commons-template4-preview.3'
TEMPLATE_VERSION='4.0.1'
GEOMETRY_ID='commons-blank-cc0-hands-v2'
REPORT=ROOT/'docs/validation-records/v6.5-main-body-hand/evidence'
NAMES=['radial_wrist','thumb_tip','thumb_index_web','index_tip','index_middle_web','middle_tip','middle_ring_web','ring_tip','ring_little_web','little_tip','ulnar_wrist']

def read(p):return json.loads(p.read_text())
def encode(d):return json.dumps(d,ensure_ascii=False,indent=2)+'\n'
def normalized(g):
 parts=[]
 for p in flatten_geometry(g):
  if p.area<=0:continue
  p=orient(p,sign=1);rings=[]
  for ring in [p.exterior,*p.interiors]:
   pts=[]
   for x,y in ring.coords:
    q=[x/400,y/900]
    if not pts or q!=pts[-1]:pts.append(q)
   if pts[0]!=pts[-1]:pts.append(pts[0])
   rings.append(pts)
  parts.append(rings)
 raw={'type':'MultiPolygon','coordinates':parts}
 assert shape(raw).is_valid and not shape(raw).is_empty
 return raw

def build():
 manifest=read(PARENT/'manifest.json');manifest.update(atlasVersion=VERSION,templateVersion=TEMPLATE_VERSION,geometryId=GEOMETRY_ID,inheritedParentVersion=manifest['atlasVersion'])
 manifest['attribution']+=' V6.5以原始手部Path分别配准四个主人体手表面；保留组合标签，修正CC0底图指缝命中轮廓。'
 manifest['coverageNote']='主人体正面掌侧、背面手背已加入Goran实际组合参考区C6–8、C8/T1及源腕部过渡；不等于独立C6/C7/C8掌侧边界。源描边缝、目标表面适配余量、手指隐面仍未覆盖。其余面部/足部和未配置范围沿用父版。仅教学参考，医学审核待完成。'
 data={v:read(PARENT/(v+'.json')) for v in ['front','back']}
 oldbody=read(ROOT/'data/body/commons-template4.json');newbody={v:affinity.scale(shape(oldbody['views'][v]['geometry']),400,900,origin=(0,0)) for v in data}
 for v in data:
  data[v].update(atlasVersion=VERSION,templateVersion=TEMPLATE_VERSION,geometryId=GEOMETRY_ID)
  for r in data[v]['regions']:r.update(atlasVersion=VERSION,templateVersion=TEMPLATE_VERSION,geometryId=GEOMETRY_ID)
 original={v:unary_union([affinity.scale(shape(r['geometry']),400,900,origin=(0,0)) for r in data[v]['regions']]) for v in data}
 report={'atlasVersion':VERSION,'templateVersion':TEMPLATE_VERSION,'geometryId':GEOMETRY_ID,'medicalReviewStatus':'pending','method':'regularized thin-plate-spline on independently observed contour correspondences; exact surface boundary interpolation; explicit target skin intersection','regularization':1e-4,'scaleConditioning':100,'sourceCurveTolerance':.12,'targetInkCurveTolerance':.02,'sourceEdgeSampleSpacing':.1,'outputSimplificationToleranceLogical':.002,'parentFileSHA256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(PARENT.iterdir()) if p.is_file()},'hands':{},'notes':['No source composite label split, no Servier boundary reused.','No source/target hand mirrored to produce the other; x reflection only conditions each independent solver, then is reversed.','Image and normalized coordinate frame unchanged; template patch/geometry revision identifies hand validity correction.','TPS numerical sampling is not proof of clinical registration or continuous injectivity. Explicit skin adaptation and source seams remain unconfigured.']}
 all_domains=domains();sourcemap=read(PARENT/'source-map.json')
 for key,domain in all_domains.items():
  view,side=key.split('-');mirror=(side=='left')==(view=='front')
  a=canonical(domain['source'],mirror);b=canonical(domain['target'],mirror);ia,ib=landmarks(a),landmarks(b)
  sa,tb,land=pair_boundary(a,b,ia,ib);fn=mapper(sa,tb);source_domain=Polygon(sa);target_domain=Polygon(tb)
  physical_target=Polygon(domain['target']);removed=Polygon(domain['oldTarget']).difference(physical_target)
  newbody[view]=newbody[view].difference(removed)
  items,raw=visible(view);audits=read(ROOT/f'docs/goran-full-atlas-audit/evidence/{view}-raw-source-regions.json')['regions'];root=ET.parse(ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg').getroot()
  assert not any(e.tag.rsplit('}',1)[-1] in ['clipPath','mask','use'] for e in root.iter())
  details=[];registered=[];painted=Polygon()
  for idx,g in raw.items():
   if mirror:g=affinity.scale(g,-1,1,origin=(0,0))
   g=g.intersection(source_domain)
   if not g.area:continue
   audit=next(r for r in audits if r['index']==idx);item=items[idx]
   e=root
   for n in item['elementRoute'].split('/')[1:]:e=e[int(n)]
   assert item['elementRoute']==audit['route'] and hashlib.sha256(e.get('d').encode()).hexdigest()==audit['pathD_SHA256']
   label=sourcemap['views'][view][idx]['labelId'];assert label==audit['label'] and label
   warped=warp_geometry(g,fn)
   outside=warped.difference(target_domain).area;inside=warped.intersection(target_domain)
   if mirror:inside=affinity.scale(inside,-1,1,origin=(0,0))
   inherited_overlap=inside.intersection(original[view]).area;new_overlap=inside.intersection(painted).area
   assert new_overlap<.5, ('resampling overlap exceeds explicit hand budget',key,idx,new_overlap)
   mapped=inside.difference(original[view]).difference(painted)
   # Keep bounded source-curve approximation; never repair invalid polygons.
   reduced=mapped.simplify(.002,preserve_topology=True)
   if mapped.hausdorff_distance(reduced)>.002 or len(flatten_geometry(mapped))!=len(flatten_geometry(reduced)):reduced=mapped
   # Simplification can create subpixel overshoot; record it and use the same skin/paint priority.
   reduced=reduced.intersection(physical_target).difference(original[view]).difference(painted)
   assert reduced.is_valid and not reduced.is_empty
   painted=painted.union(reduced);registered.append(reduced)
   record={'sourcePathIndex':idx,'sourceElementId':item['elementRoute'],'sourceSVGId':e.get('id'),'pathD_SHA256':audit['pathD_SHA256'],'label':label,'sourceVisibleArea':g.area,'sourceParts':len(flatten_geometry(g)),'sourceHoles':sum(len(p.interiors) for p in flatten_geometry(g)),'rawTargetArea':warped.area,'outsideTargetArea':outside,'inheritedOverlapArea':inherited_overlap,'resamplingOverlapArea':new_overlap,'outputArea':reduced.area,'outputParts':len(flatten_geometry(reduced)),'outputHoles':sum(len(p.interiors) for p in flatten_geometry(reduced))}
   details.append(record)
   rp=reduced.representative_point();source_ref='commons-goran-2022-'+view
   region={'id':f'goran-{view}-hand-p{idx}-{side}','atlasVersion':VERSION,'templateId':manifest['templateId'],'templateVersion':TEMPLATE_VERSION,'geometryId':GEOMETRY_ID,'partitionType':'spinal_dermatome_composite' if label in ['C6-C8','C8/T1','T1/T2'] else 'spinal_dermatome','labelId':label,'sourceLabel':sourcemap['views'][view][idx].get('sourceLabel',label),'view':view,'side':side,'color':item['color'],'geometry':normalized(reduced),'labelPoint':{'x':rp.x/400,'y':rp.y/900},'sourceRefs':[source_ref],'sourcePathIndices':[idx],'sourceFile':f'docs/research/v3-atlas/goran-{view}.original.svg','sourceElementId':item['elementRoute'],'sourcePathSHA256':audit['pathD_SHA256'],'sourceLicense':'CC BY-SA 4.0','registrationMethod':'independent_hand_tps_boundary_v1','registrationRefs':['hand-registration.json#'+key],'productionStatus':'registered_development_preview','medicalReviewStatus':'pending','derivation':'Goran original visible fill, registered on the unchanged CC0 main-body hand; no fabricated subdivisions.'}
   data[view]['regions'].append(region)
  covered=unary_union(registered).union(original[view]).intersection(physical_target)
  report['hands'][key]={**domain,'mirrorConditioningOnly':mirror,'landmarks':[{'name':name,'source':a[i],'target':b[j]} for name,i,j in zip(NAMES,ia,ib)],'pairedBoundarySource':sa,'pairedBoundaryTarget':tb,'paths':details,'removedFalseSkinGapArea':removed.area,'coveredArea':covered.area,'skinArea':physical_target.area,'uncoveredArea':physical_target.difference(covered).area,'uncoveredGeometry':normalized(physical_target.difference(covered))}
 files={}
 for v in data:
  assert newbody[v].geom_type=='Polygon' and newbody[v].is_valid
  files[str((ATLAS/(v+'.json')).relative_to(ROOT))]=encode(data[v])
 body_ts='// GENERATED by scripts/prepare_hand_atlas.py. CC0 ink-derived hand gaps only; visual PNGs unchanged.\nimport { CanvasPoint } from "../types/dermatome";\n'
 for v in data:
  coords=list(newbody[v].exterior.coords)[:-1]
  body_ts+='export const '+v.upper()+'_HIT_OUTLINE:readonly CanvasPoint[]=Object.freeze('+json.dumps([{'x':x,'y':y} for x,y in coords],separators=(',',':'))+'.map(p=>Object.freeze(p)));\n'
 files['miniprogram/data/body-hands.generated.ts']=body_ts
 files[str((ATLAS/'source-map.json').relative_to(ROOT))]=(PARENT/'source-map.json').read_text()
 # Inherited registration parameters stay reproducible but are explicitly historical.
 for name in ['registration.json','local-registration.json']:
  historical=read(PARENT/name)
  historical['recordScope']='Inherited parent regions only; hand exclusions are superseded ONLY by hand-registration.json. All other exclusions remain.'
  historical['activeAtlasVersion']=VERSION
  historical['activeHandRegistration']='hand-registration.json'
  files[str((ATLAS/name).relative_to(ROOT))]=encode(historical)
 coverage=read(PARENT/'coverage.json');coverage['atlasVersion']=VERSION
 coverage['unconfigured']=[note.replace('distal hands/fingers, ', 'hidden finger surfaces and source hand seams, ') for note in coverage['unconfigured']]
 coverage['handCoverageNote']='Main-body visible palms/dorsums are configured; unconfigured hand areas are source seams, target adaptation margins and hidden surfaces. See handSurfaceCoverage.'
 for entry in coverage['entries']:
  hand_regions=[r for r in data[entry['view']]['regions'] if '-hand-' in r['id'] and r['labelId']==entry['labelId']]
  if not hand_regions:continue
  current=[r for r in data[entry['view']]['regions'] if r['labelId']==entry['labelId']]
  entry['historicalExcludedPathReasons']=entry['excludedPathReasons']
  entry.update(configuredSides=sorted({r['side'] for r in current}),partCount=sum(len(r['geometry']['coordinates']) for r in current),status='registered_preview',excludedPathReasons=[],surfaceLimit='Parent visible surfaces plus independently registered main-body hand fills; original composite labels and small seams retained. No hidden finger surface coverage.',handRegistrationRef='hand-registration.json')
 coverage['handSurfaceCoverage']={k:{field:h[field] for field in ['skinArea','coveredArea','uncoveredArea']} for k,h in report['hands'].items()}
 files[str((ATLAS/'coverage.json').relative_to(ROOT))]=encode(coverage)
 sources=read(PARENT/'sources.json')
 for source in sources['sources']:
  if source['id'].startswith('commons-goran-2022-'):
   source['licenseRecheckedDate']='2026-11-05'
   source['modification']+=' V6.5 independently registers source hand fills to unchanged main-body images using 11 boundary landmarks per hand; regularized TPS and explicit target skin intersection; hand gaps corrected from original CC0 SVG ink. See hand-registration.json. Labels remain composite and medical review remains pending.'
   source['attribution']+=' V6.5 derivative bound to template 4.0.1 / atlas preview.3, CC BY-SA 4.0.'
 files[str((ATLAS/'sources.json').relative_to(ROOT))]=encode(sources)
 files[str((ATLAS/'hand-registration.json').relative_to(ROOT))]=encode(report)
 files[str((ATLAS/'manifest.json').relative_to(ROOT))]=encode(manifest)
 files[str((ATLAS/'NOTICE.md').relative_to(ROOT))]=(PARENT/'NOTICE.md').read_text()+'\nV6.5: original Goran hand paths registered independently to front palms/back dorsums. Composite labels retained. Hand hit geometry corrected from CC0 source ink. Registration remains pending medical review. Prior atlas and Servier archives are retained, not runtime fallbacks.\n'
 return files,report

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');a=p.parse_args();files,report=build()
 for name,content in files.items():
  path=ROOT/name
  if a.write:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content)
  elif name.endswith('/manifest.json'):
   # The package step computes contentSHA256, not a second geometry authority.
   expected=json.loads(content);current=read(path);expected['contentSHA256']=current['contentSHA256'];assert expected==current,name
  else:assert path.read_text()==content,'Generated artifact differs: '+name
 print(('Generated' if a.write else 'PASSED reproducibility'),len(files),'artifacts;',sum(len(h['paths']) for h in report['hands'].values()),'hand path instances')
