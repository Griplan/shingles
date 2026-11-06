"""V6.6.2 estimated local registration. No extrapolated axillary floor."""
import hashlib,json,sys,xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from shapely.geometry import shape,box,MultiPolygon,mapping
from shapely.affinity import affine_transform
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from build_sole_atlas import geo,svg_path,flatten_geometry
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/validation-records/v6.6-axilla/provisional-matching'
DIR=ROOT/'data/atlas/axilla-goran-provisional-v1'
ID='axilla-goran-provisional-v1';VERSION='goran-axilla-provisional.1'
NOTE='试验性神经皮节参考匹配：区域边界由公开图谱近似配准，尚未经过医学审核，仅用于模拟与科普，不能用于疾病诊断或替代就医。'
def dump(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def mp(g):return mapping(MultiPolygon([orient(p,1) for p in flatten_geometry(g)]))
def build():
 body=json.loads((ROOT/'data/body/axilla-v1.json').read_text());basis={k:body[k] for k in ['templateId','templateVersion','geometryId','regionSetId']}
 audit=json.loads((ROOT/'docs/validation-records/v6.6-axilla/medical-review/evidence/goran-paths-rechecked.json').read_text())
 source=ROOT/'docs/research/v3-atlas/goran-front.original.svg';blob=source.read_bytes();root=ET.fromstring(blob)
 assert hashlib.sha1(blob).hexdigest()=='d20be473843591779be22c102e193d8c1407861d'
 rows={p['sourceLabel']:p for p in audit['paths'] if p['key'] in ['front-p19','front-p20']}
 registration=dict(**basis,status='passed_offline_geometry',atlasStatus='PROVISIONAL',method='estimated_local_affine_source_visible_only',sourceElements=[],sides={},extrapolation='NONE: no class C target polygons; central floor/chest remain unconfigured',medicalReviewStatus='pending')
 registration['contextLandmarks']={side:[dict(name=n,point=[1-x,y] if side=='left' else [x,y],status='ESTIMATED_CONTEXT_ONLY',usedForFit=False) for n,(x,y) in [('axillary_centre_not_confirmed_apex',(.55,.45)),('anterior_fold',(.6655,.375)),('posterior_fold',(.466,.4683333333)),('proximal_medial_arm',(.382,.235)),('adjacent_chest',(.7075,.655)),('arm_chest_transition',(.60,.40))]] for side in ['left','right']}
 views={};coverage={};colors={'T1':'#b690d9','T2':'#87b9db'}
 for side in ['right','left']:
  view='axilla-'+side;skin=shape(body['views'][view]['geometry']);half=box(0,265,233,305) if side=='right' else box(233,265,500,305)
  # Actual original curve intersections at y270/y300; their target positions are estimates.
  src=[[145.90059872122836,270],[143.19548644994688,300],[158.32838633377764,270]] if side=='right' else [[321.39541241843995,270],[324.04950773527963,300],[306.5822514600843,270]]
  target=[[.49,.32],[.32,.19],[.49,.43]];target=target if side=='right' else [[1-x,y] for x,y in target]
  coeff=np.linalg.solve(np.array([[x,y,1] for x,y in src]),np.array(target))
  m=[coeff[0,0],coeff[1,0],coeff[0,1],coeff[1,1],coeff[2,0],coeff[2,1]]
  assert m[0]*m[3]-m[1]*m[2]>0
  registration['sides'][side]=dict(sourceControlPoints=src,targetControlPoints=target,controlPointNames=['visible medial arm proximal edge','visible medial arm distal edge','arm/chest-facing edge'],targetPointStatus='ALL_ESTIMATED_NOT_MEDICAL_LANDMARKS',uncertaintyLevel='HIGH',matrixNormalized=m,sourceCrop=[*half.bounds],fitResidual='exact three-point fit; not anatomical error estimate')
  regions=[]
  for label,p in rows.items():
   source_g=shape(p['visibleGeometry']).intersection(half);g=affine_transform(source_g,m).intersection(skin)
   assert g.is_valid and g.area>0
   q=g.representative_point();geometry=mp(g)
   r=dict(id=view+'-'+label,view=view,viewId=view,side=side,**basis,atlasId=ID,atlasVersion=VERSION,atlasStatus='PROVISIONAL',reviewStatus='UNREVIEWED_PROVISIONAL',uncertaintyLevel='HIGH',derivationClass='B',partitionType='spinal_dermatome',labelId=label,dermatomeLabel=label,sourceLabel=label,displayName=label+'（试验性）',geometry=geometry,polygonGeometry=geometry,labelPoint=dict(x=q.x,y=q.y),color=colors[label],sourceRefs=['goran-front-2022-provisional'],sourcePathIndices=[int(p['key'].split('p')[-1])],sourceFile=str(source.relative_to(ROOT)),sourcePathId=p['route'],sourceElementId=p['route'],sourcePathSHA256=p['pathD_SHA256'],sourceLicense='CC BY-SA 4.0',registrationMethod=registration['method'],medicalReviewStatus='pending',productionStatus='registered_development_preview',derivation='B: source visible patch, cropped to proximal arm then estimated affine; no hidden surface extension')
   regions.append(r)
   registration['sourceElements'].append(dict(viewId=view,label=label,sourcePathId=p['route'],sourcePathSHA256=p['pathD_SHA256'],sourceGeometry=mp(source_g),derivationClass='A_SOURCE_ONLY',targetClass='B',targetControlPoints='sides.'+side))
  assert shape(regions[0]['geometry']).intersection(shape(regions[1]['geometry'])).area<1e-10
  views[view]=dict(view=view,atlasVersion=VERSION,atlasStatus='PROVISIONAL',regions=regions)
  union=unary_union([shape(r['geometry']) for r in regions]);coverage[view]=dict(configuredRatio=union.area/skin.area,uncoveredGeometry=mp(skin.difference(union)))
  original=(ROOT/f'miniprogram/assets/axilla/{view}.svg').read_text();layers=''.join(f'<path d="{svg_path(affine_transform(shape(r["geometry"]),[400,0,0,360,0,0]))}" fill="{r["color"]}" fill-opacity=".5" stroke="{r["color"]}" stroke-width=".8"/>' for r in regions)
  svg=original.replace('</svg>',layers+'</svg>');(OUT/f'{view}.svg').write_text(svg)
 sources=dict(boundarySystem='spinal_dermatome',boundaryLicenseStatus='verified',atlasStatus='PROVISIONAL',sources=[dict(id='goran-front-2022-provisional',purpose='dermatome_boundaries',licenseStatus='verified',license='CC BY-SA 4.0',author='Goran_tek-en',url='https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg',boundaryEvidence='Original visible inner-arm p19 T1/p20 T2 ONLY. Target control points are manual estimates, not reviewed target medical boundaries.',sourceSHA1=hashlib.sha1(blob).hexdigest())])
 for v,d in views.items():dump(DIR/(v+'.json'),d)
 dump(DIR/'sources.json',sources);dump(DIR/'registration.json',registration)
 inputs=['axilla-left.json','axilla-right.json','sources.json','registration.json'];h=hashlib.sha256()
 for n in inputs:h.update(n.encode()+b'\0'+(DIR/n).read_bytes()+b'\0')
 manifest=dict(**basis,atlasId=ID,atlasVersion=VERSION,atlasStatus='PROVISIONAL',contentSHA256=h.hexdigest(),mappingEnabled=False,medicalReviewStatus='pending',reviewStatus='UNREVIEWED_PROVISIONAL',technicalValidationStatus='passed_offline_geometry',sourceLicenseStatus='verified',sourceTitle='Goran 腋下局部近似配准 · PROVISIONAL',sourceUrl=sources['sources'][0]['url'],attribution='Goran_tek-en (2022), CC BY-SA 4.0；本项目裁取原侧内臂T1/T2并以估计点局部仿射；非原图完整腋窝边界。',license='CC BY-SA 4.0',coverageNote=NOTE)
 dump(DIR/'manifest.json',manifest);dump(OUT/'evidence/coverage.json',coverage)
 old=(ROOT/'miniprogram/data/axilla.generated.ts').read_text();models=json.loads(old.split('>>=')[1].rstrip(';\n'))
 identity=dict(template_id=basis['templateId'],template_version=basis['templateVersion'],geometry_id=basis['geometryId'],region_set_id=basis['regionSetId'],atlas_id=ID,atlas_version=VERSION,atlas_content_sha256=h.hexdigest(),body_content_sha256=hashlib.sha256((ROOT/'data/body/axilla-v1.json').read_bytes()).hexdigest(),coordinate_system='normalized_2d_top_left')
 for v,model in models.items():model['atlas'].update(identity=identity,regions=views[v]['regions'],technicalReady=True,blockedReason='',atlasStatus='PROVISIONAL',**{k:manifest[k] for k in ['sourceTitle','sourceUrl','attribution','coverageNote']})
 (ROOT/'miniprogram/data/axilla-provisional.generated.ts').write_text('// GENERATED by build_axilla_provisional.py; estimated, unreviewed.\nimport {LocalSurfaceModel} from "../types/local-surface";\nimport {AxillaView} from "../types/dermatome";\nexport const AXILLA_PROVISIONAL_MODELS:Readonly<Record<AxillaView,LocalSurfaceModel>>='+json.dumps(models,ensure_ascii=False,separators=(',',':'))+';\n')
 print('PROVISIONAL: 2 labels x 2 original sides = 4 regions; no class C extrapolation')
if __name__=='__main__':build()
