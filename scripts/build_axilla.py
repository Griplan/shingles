"""V6.6 surface-only derivative. No dermatome polygons are invented here.

Default: read-only reproduction check. --write: emit only new axilla artifacts.
The editable path traces the CC0 raised-arm photograph, not Goran colors.
"""
import argparse, hashlib, json
from pathlib import Path
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.affinity import affine_transform
from shapely.geometry.polygon import orient
from svg_geometry import path_rings

ROOT=Path(__file__).resolve().parents[1]
SOURCE='docs/research/v6.6-axilla/MaleArmpit1.jpg'
SHA='db6cb7e292e9ac93a9560db930c6993f6e14a13d9dc0aaaa645b377d54032cee'
URL='https://commons.wikimedia.org/wiki/File:MaleArmpit1.jpg'
BASIS=dict(templateId='commons-axilla-v1',templateVersion='1.0.0',geometryId='cc0-raised-axilla-outline-v1',regionSetId='commons-axilla-ui-v1')
ATLAS_ID='axilla-reference-v1'; VERSION='axilla-unconfigured.1'
WIDTH=400; HEIGHT=360
INPUTS=['axilla-left.json','axilla-right.json','sources.json','registration.json']
REASON='腋下皮节边界尚未就绪，当前可圈选并保存标注，暂不能计算。'
NOTE='抬臂侧面可见皮肤的局部示意；皮节未配置，不表示没有感觉神经。隐蔽深部不外推。'
# Working source frame: complete 4000 x 3000 original, width 900 (900 x 675).
# Upper arm and chest crop seams bound a LOCAL visible surface, never a full-body claim.
OUTLINE='M 100 20 L 590 20 C 645 83 716 161 777 223 C 811 257 841 287 880 310 L 880 650 L 410 650 C 391 601 375 547 362 495 C 349 443 335 393 308 353 C 270 294 233 237 199 184 C 160 124 126 64 100 20 Z'
# Visible folds/surface landmarks traced from the same plate; NOT neural borders.
DETAILS=[
 ('anterior-fold','M 590 20 C 606 80 596 154 617 211 C 630 251 614 290 591 322'),
 ('posterior-fold','M 308 353 C 368 370 419 344 468 304 C 511 269 546 236 567 211'),
 ('axillary-floor','M 430 375 C 478 350 527 319 565 278'),
 ('lower-crease','M 466 405 C 518 379 561 344 588 308'),
]

def serialized(x):return json.dumps(x,ensure_ascii=False,indent=2)+'\n'
def digest(blobs):
 h=hashlib.sha256()
 for n in INPUTS:h.update(n.encode()+b'\0'+blobs[n].encode()+b'\0')
 return h.hexdigest()
def gj(g):return json.loads(json.dumps(mapping(MultiPolygon([orient(g,1)]))))

def build():
 assert hashlib.sha256((ROOT/SOURCE).read_bytes()).hexdigest()==SHA,'Unverified display source'
 sampled=path_rings(OUTLINE,tolerance=.2)[0]
 points=[p for i,p in enumerate(sampled) if i==0 or p!=sampled[i-1]]
 raw=Polygon(points);assert raw.is_valid and raw.area>0
 right=affine_transform(raw,[.42/WIDTH,0,0,.42/HEIGHT,10/WIDTH,30/HEIGHT])
 shapes={'right':right,'left':affine_transform(right,[-1,0,0,1,1,0])}
 files={};source=dict(title='MaleArmpit1: raised right axillary surface',url=URL,
  author='Roquex',license='CC0 1.0',
  attribution='依据 Roquex / MaleArmpit1（CC0）右腋下照片描摹可见皮肤与褶线，去除照片纹理、毛发及背景；左侧镜像。仅体表示意，非皮节图谱。')
 resource={**BASIS,'logicalWidth':WIDTH,'logicalHeight':HEIGHT,'coordinateSystem':'normalized_2d_top_left','source':source,
  'sourceFile':SOURCE,'sourceSHA256':SHA,'traceFrame':{'cropOriginalPixels':[0,0,4000,3000],'workingWidth':900,'toLogical':[.42,0,0,.42,10,30],'outlinePath':OUTLINE,'detailPaths':dict(DETAILS),'curveToleranceWorkingPixels':.2},
  'orientationEvidence':'Author explicitly identifies right armpit; raised proximal arm at screen upper-left, anterior chest/pectoral fold at right, posterior fold at left. Left derivative reflects x=1-x; this does not mirror a dermatome atlas.',
  'scope':'Raised-arm close anterior-oblique visible surface, not a complete flattened axillary cavity; cropped upper arm and chest; shoulder cap beyond source is not invented. Medical/illustration review pending.', 'views':{}}
 for side,g in shapes.items():
  view='axilla-'+side
  assert g.is_valid and all(0<=x<=1 for x in g.bounds)
  mirror='translate(400 0) scale(-1 1)' if side=='left' else ''
  details=''.join(f'<path id="{name}" d="{d}"/>' for name,d in DETAILS)
  # Dashed crop seams are not anatomical body edges. Do not invent a shoulder
  # outside the source photograph merely to round off this local window.
  files[f'miniprogram/assets/axilla/{view}.svg']=f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="360" viewBox="0 0 400 360"><title>{view}: surface-only derivative of Roquex CC0 photograph; no neural boundaries</title><g transform="{mirror}"><g transform="matrix(.42 0 0 .42 10 30)"><path id="skin" d="{OUTLINE}" fill="#efe1d3" stroke="#78675f" stroke-width="3.2" stroke-linejoin="round"/><path d="M100 20 H590 M880 310 V650 H410" fill="none" stroke="#efe1d3" stroke-width="5"/><path id="crop-seams" d="M100 20 H590 M880 310 V650 H410" fill="none" stroke="#bca99b" stroke-width="2.2" stroke-dasharray="10 9"/><g fill="none" stroke="#ac9181" stroke-width="2.6" stroke-linecap="round">{details}</g></g></g></svg>\n'''
  resource['views'][view]=dict(anatomicalSide=side,body=gj(g),imagePath=f'/assets/axilla/{view}.png',svgPath=f'/assets/axilla/{view}.svg',orientation='anterior_left_posterior_right' if side=='left' else 'posterior_left_anterior_right',mirrored=side=='left')
  files[f'data/atlas/axilla-v1/{view}.json']=serialized(dict(view=view,atlasVersion=VERSION,regions=[]))
 files['data/body/axilla-resource.json']=serialized(resource)
 body={**BASIS,'coordinateSystem':'normalized_2d_top_left','sourceSHA256':{'data/body/axilla-resource.json':hashlib.sha256(files['data/body/axilla-resource.json'].encode()).hexdigest()},'views':{v:dict(side=s['anatomicalSide'],geometry=s['body']) for v,s in resource['views'].items()}}
 files['data/body/axilla-v1.json']=serialized(body)
 files['data/atlas/axilla-v1/sources.json']=serialized(dict(boundarySystem='spinal_dermatome',boundaryLicenseStatus='unconfigured',sources=[],displaySource=source,
  review='See docs/validation-records/v6.6-axilla/source-review.md. Display license is NOT boundary evidence. Goran hidden surfaces and sensory test points are not extrapolated.'))
 files['data/atlas/axilla-v1/registration.json']=serialized(dict(**BASIS,status='blocked_missing_boundary_evidence',method=None,sourceElements=[],registeredRegionCount=0,
  reason='No verified raised-arm dermatomal surface boundaries or sufficient cross-pose anatomical correspondences. No registration attempted.',medicalReviewStatus='pending'))
 content=digest({n:files['data/atlas/axilla-v1/'+n] for n in INPUTS})
 manifest=dict(**BASIS,atlasId=ATLAS_ID,atlasVersion=VERSION,contentSHA256=content,sourceTitle='腋下参考边界待配置',sourceUrl='',attribution='尚无可用于本模板计算的皮节边界；不将体表素材或感觉检查点作为图谱。',license='UNKNOWN',sourceLicenseStatus='unconfigured',mappingEnabled=False,medicalReviewStatus='pending',technicalValidationStatus='blocked_missing_boundary_evidence',coverageNote=NOTE)
 files['data/atlas/axilla-v1/manifest.json']=serialized(manifest)
 identity=dict(template_id=BASIS['templateId'],template_version=BASIS['templateVersion'],geometry_id=BASIS['geometryId'],region_set_id=BASIS['regionSetId'],atlas_id=ATLAS_ID,atlas_version=VERSION,atlas_content_sha256=content,body_content_sha256=hashlib.sha256(files['data/body/axilla-v1.json'].encode()).hexdigest(),coordinate_system='normalized_2d_top_left')
 models={}
 for v,s in resource['views'].items():
  rings=[dict(outer=[dict(x=x,y=y) for x,y in p[0]],holes=[[dict(x=x,y=y) for x,y in ring] for ring in p[1:]]) for p in s['body']['coordinates']]
  models[v]=dict(id=BASIS['templateId'],version=BASIS['templateVersion'],geometryId=BASIS['geometryId'],regionSetId=BASIS['regionSetId'],view=v,name='左腋下' if v.endswith('left') else '右腋下',logicalWidth=WIDTH,logicalHeight=HEIGHT,imagePath=s['imagePath'],sourcePath=s['svgPath'],body=rings,resource=source,
   atlas=dict(identity=identity,regions=[],technicalReady=False,blockedReason=REASON,**{k:manifest[k] for k in ['sourceTitle','sourceUrl','attribution','medicalReviewStatus','coverageNote']}))
 files['miniprogram/data/axilla.generated.ts']='// GENERATED by scripts/build_axilla.py; display surface only, atlas NOT READY.\nimport {LocalSurfaceModel} from "../types/local-surface";\nimport {AxillaView} from "../types/dermatome";\nexport const AXILLA_MODELS:Readonly<Record<AxillaView,LocalSurfaceModel>>='+json.dumps(models,ensure_ascii=False,separators=(',',':'))+';\n'
 return files

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');args=p.parse_args()
 for name,text in build().items():
  file=ROOT/name
  if args.write:file.parent.mkdir(parents=True,exist_ok=True);file.write_text(text)
  else:assert file.read_text()==text,'Axilla reproduction mismatch: '+name
 print('Axilla surface and blocked atlas: 10 artifacts '+('written' if args.write else 'reproduced')+'; 0 dermatome regions')
