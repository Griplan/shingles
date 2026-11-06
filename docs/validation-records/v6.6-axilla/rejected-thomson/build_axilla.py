"""V6.6 surface-only derivative. No dermatome polygons are invented here.

Default: read-only reproduction check. --write: emit only new axilla artifacts.
The editable path traces the public-domain raised-arm photograph, not Goran colors.
"""
import argparse, hashlib, json
from pathlib import Path
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.affinity import affine_transform
from shapely.geometry.polygon import orient
from svg_geometry import path_rings

ROOT=Path(__file__).resolve().parents[1]
SOURCE='docs/research/v6.6-axilla/thomson-1896-plates12-13.webp'
SHA='9136ca36b2dfbf0b83c70ef71755c2e38879eb101399b98eca258a23735b20b2'
URL='https://commons.wikimedia.org/wiki/File:Thomson_plate_12-13_-_side_view,_arm_raised.webp'
BASIS=dict(templateId='thomson-axilla-v1',templateVersion='1.0.0',geometryId='thomson-raised-axilla-outline-v1',regionSetId='thomson-axilla-ui-v1')
ATLAS_ID='axilla-reference-v1'; VERSION='axilla-unconfigured.1'
WIDTH=400; HEIGHT=620
INPUTS=['axilla-left.json','axilla-right.json','sources.json','registration.json']
REASON='腋下皮节边界尚未就绪，当前可圈选并保存标注，暂不能计算。'
NOTE='抬臂侧面可见皮肤的局部示意；皮节未配置，不表示没有感觉神经。隐蔽深部不外推。'
# Working source frame: original crop (1450,0,790,1340), resized to width 590.
# Top arm, posterior-neck junction and lower chest cuts delimit this LOCAL display.
OUTLINE='M 400 12 L 537 12 C 516 102 478 197 449 275 C 420 365 388 432 350 478 C 345 508 357 548 373 587 C 394 646 430 713 456 785 C 482 852 496 920 475 992 L 208 992 C 179 923 159 864 135 812 C 101 767 82 712 74 661 C 65 602 71 552 94 506 C 112 480 117 457 106 435 L 199 426 C 224 380 276 333 312 278 C 352 212 382 133 400 12 Z'
# Visible folds/surface landmarks traced from the same plate; NOT neural borders.
DETAILS=[
 ('upper-arm','M 446 72 C 417 204 371 338 295 423'),
 ('shoulder','M 199 426 C 210 473 242 501 292 505 C 314 501 336 490 350 478'),
 ('posterior-fold','M 107 546 C 124 579 165 621 211 651 C 237 670 268 684 294 689'),
 ('anterior-fold','M 350 478 C 359 531 357 581 337 622 C 325 649 306 671 294 689'),
 ('axillary-floor','M 235 541 C 269 553 301 551 330 534'),
 ('lateral-wall','M 147 700 C 213 731 281 747 334 737'),
 ('lower-wall','M 181 817 C 240 842 295 846 339 836'),
]

def serialized(x):return json.dumps(x,ensure_ascii=False,indent=2)+'\n'
def digest(blobs):
 h=hashlib.sha256()
 for n in INPUTS:h.update(n.encode()+b'\0'+blobs[n].encode()+b'\0')
 return h.hexdigest()
def gj(g):return json.loads(json.dumps(mapping(MultiPolygon([orient(g,1)]))))

def build():
 assert hashlib.sha256((ROOT/SOURCE).read_bytes()).hexdigest()==SHA,'Unverified display source'
 raw=Polygon(path_rings(OUTLINE,tolerance=.2)[0]);assert raw.is_valid and raw.area>0
 right=affine_transform(raw,[.55/WIDTH,0,0,.55/HEIGHT,36/WIDTH,30/HEIGHT])
 shapes={'right':right,'left':affine_transform(right,[-1,0,0,1,1,0])}
 files={};source=dict(title='Thomson (1896), plate 12, raised-arm surface study',url=URL,
  author='Arthur Thomson; published by Henry Frowde',license='Public domain (PD-old-100)',
  attribution='依据 Thomson 1896 抬臂体表图描摹可见轮廓与褶线，去除头部、文字和肌肉纹理；左侧镜像。仅体表示意，非皮节图谱。')
 resource={**BASIS,'logicalWidth':WIDTH,'logicalHeight':HEIGHT,'coordinateSystem':'normalized_2d_top_left','source':source,
  'sourceFile':SOURCE,'sourceSHA256':SHA,'traceFrame':{'cropOriginalPixels':[1450,0,790,1340],'workingWidth':590,'toLogical':[.55,0,0,.55,36,30],'outlinePath':OUTLINE,'detailPaths':dict(DETAILS),'curveToleranceWorkingPixels':.2},
  'orientationEvidence':'Plate profile faces right: anterior/right and posterior/left on screen; exposed right lateral surface. Left derivative reflects x=1-x; this does not mirror a dermatome atlas.',
  'scope':'Raised-arm lateral-oblique visible surface, not a complete flattened axillary cavity; cropped upper arm, neck and lower chest. Medical/illustration review pending.', 'views':{}}
 for side,g in shapes.items():
  view='axilla-'+side
  assert g.is_valid and all(0<=x<=1 for x in g.bounds)
  mirror='translate(400 0) scale(-1 1)' if side=='left' else ''
  details=''.join(f'<path id="{name}" d="{d}"/>' for name,d in DETAILS)
  files[f'miniprogram/assets/axilla/{view}.svg']=f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="620" viewBox="0 0 400 620"><title>{view}: surface-only derivative of Thomson 1896 public-domain plate; no neural boundaries</title><g transform="{mirror}"><g transform="matrix(.55 0 0 .55 36 30)"><path id="skin" d="{OUTLINE}" fill="#efe1d3" stroke="#78675f" stroke-width="3.2" stroke-linejoin="round"/><g fill="none" stroke="#ac9181" stroke-width="2.6" stroke-linecap="round">{details}</g></g></g></svg>\n'''
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
 print('Axilla surface and blocked atlas: 11 artifacts '+('written' if args.write else 'reproduced')+'; 0 dermatome regions')
