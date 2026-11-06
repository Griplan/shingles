"""Artificial smooth UI partition, not extracted or inferred Goran boundaries."""
import json,hashlib
from pathlib import Path
from shapely.geometry import shape,Polygon,MultiPolygon,mapping,Point
from shapely.affinity import scale
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from build_sole_atlas import flatten_geometry
ROOT=Path(__file__).resolve().parents[1];DIR=ROOT/'data/atlas/axilla-schematic-v1';OUT=ROOT/'docs/validation-records/v6.6-axilla/full-simulation'
ID='axilla-schematic-v1';VERSION='axilla-schematic.1'
META=dict(atlasType='SCHEMATIC',reviewStatus='NOT_MEDICALLY_VALIDATED',intendedUse='INTERACTIVE_SIMULATION',sourceType='ARTIFICIALLY_CONSTRUCTED')
NOTE='本区域使用人为构建的神经皮节示意分区，边界未经医学验证，仅供交互模拟和科普，不用于判断实际受累神经，不能代替就医。'
CURVES=[[(0,.26),(.28,.20),(.48,.50),(1,.38)],[(0,.50),(.35,.40),(.65,.72),(1,.60)]]
def dump(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def mp(g):return json.loads(json.dumps(mapping(MultiPolygon([orient(p,1) for p in flatten_geometry(g)]))))
def curve(c):
 return [tuple((1-t)**3*c[0][k]+3*(1-t)**2*t*c[1][k]+3*(1-t)*t*t*c[2][k]+t**3*c[3][k] for k in [0,1]) for t in [i/160 for i in range(161)]]
def top(c):
 pts=curve(c);return Polygon([(-1,-1),(2,-1),(2,pts[-1][1]),*reversed(pts),(-1,pts[0][1])])
def build():
 body=json.loads((ROOT/'data/body/axilla-v1.json').read_text());basis={k:body[k] for k in ['templateId','templateVersion','geometryId','regionSetId']}
 skin=shape(body['views']['axilla-right']['geometry']);a=skin.intersection(top(CURVES[0]));rest=skin.difference(a);b=rest.intersection(top(CURVES[1]));parts=[a,b,rest.difference(b)]
 models=json.loads((ROOT/'miniprogram/data/axilla.generated.ts').read_text().split('>>=')[1].rstrip(';\n'));coverage={};views={}
 for side in ['right','left']:
  view='axilla-'+side;surface=shape(body['views'][view]['geometry']);regions=[]
  for label,g,color in zip(['T1','T2','T3'],parts,['#aa96cf','#7fbba5','#e3b684']):
   if side=='left':g=scale(g,-1,1,origin=(.5,0))
   assert g.is_valid and g.area>0 and g.difference(surface).area<1e-12
   p=g.representative_point();geom=mp(g)
   regions.append(dict(id=view+'-schematic-'+label,view=view,viewId=view,side=side,**basis,**META,atlasId=ID,atlasVersion=VERSION,partitionType='schematic_region',labelId=label,sourceLabel=label,dermatomeLabel=label,displayName='模拟 '+label,color=color,geometry=geom,polygonGeometry=geom,labelPoint=dict(x=p.x,y=p.y),sourceRefs=['project-artificial-axilla-design-v1'],sourcePathIndices=[],sourceFile='scripts/build_axilla_schematic.py',sourcePathId=None,registrationMethod='artificial_bezier_partition_clip_skin_mirror_left',medicalReviewStatus='pending',productionStatus='registered_development_preview',derivation='Artificial UI design; no source SVG medical boundary; labels are simulation symbols'))
  union=unary_union([shape(r['geometry']) for r in regions]);missing=surface.difference(union)
  hits=[Point(x/200,y/200) for x in range(201) for y in range(201) if surface.covers(Point(x/200,y/200))]
  absent=[p for p in hits if not union.buffer(1e-12).covers(p)]
  coverage[view]=dict(skinArea=surface.area,unionArea=union.area,coveredRatio=union.intersection(surface).area/surface.area,missingArea=missing.area,outsideArea=union.difference(surface).area,overlapArea=sum(shape(a['geometry']).intersection(shape(b['geometry'])).area for i,a in enumerate(regions) for b in regions[i+1:]),rawAreaSumMinusUnion=sum(shape(r['geometry']).area for r in regions)-union.area,gridSpacing=.005,skinGridPoints=len(hits),missedGridPoints=len(absent),boundaryTolerance=1e-12,undefinedArea=0,undefinedRegions=0)
  assert missing.area<1e-12 and not absent
  views[view]=dict(view=view,atlasVersion=VERSION,**META,regions=regions);dump(DIR/(view+'.json'),views[view])
 registration=dict(**basis,**META,status='passed_offline_geometry',method='artificial_bezier_partition_clip_skin_mirror_left',curvesRightNormalized=CURVES,segmentsPerCurve=160,sourceMedicalBoundary=None,labelsAreSimulationSymbols=True,leftTransform='x=1-x,y=y',undefinedRegion='none required; all skin assigned to the three schematic zones')
 sources=dict(**META,boundarySystem='schematic_skin_partition',boundaryLicenseStatus='verified',sources=[dict(id='project-artificial-axilla-design-v1',purpose='artificial_partition_design',licenseStatus='verified',license='CC0-1.0',author='dermatome-mapper project',url='docs/validation-records/v6.6-axilla/full-simulation/region-design.md',boundaryEvidence='Artificial UI partition, NOT medical boundary evidence; Goran only contextual direction, no SVG extraction')])
 dump(DIR/'registration.json',registration);dump(DIR/'sources.json',sources)
 h=hashlib.sha256()
 for n in ['axilla-left.json','axilla-right.json','sources.json','registration.json']:h.update(n.encode()+b'\0'+(DIR/n).read_bytes()+b'\0')
 manifest=dict(**basis,**META,atlasId=ID,atlasVersion=VERSION,contentSHA256=h.hexdigest(),mappingEnabled=False,medicalReviewStatus='pending',technicalValidationStatus='passed_offline_geometry',sourceLicenseStatus='verified',sourceTitle='腋下人工模拟分区 · SCHEMATIC',sourceUrl=sources['sources'][0]['url'],attribution='项目人工构建模拟分区（CC0-1.0）；皮肤底图为Roquex CC0照片衍生。不是Goran原始边界。',license='CC0-1.0',coverageNote=NOTE)
 dump(DIR/'manifest.json',manifest);dump(OUT/'evidence/coverage.json',coverage)
 identity=dict(template_id=basis['templateId'],template_version=basis['templateVersion'],geometry_id=basis['geometryId'],region_set_id=basis['regionSetId'],atlas_id=ID,atlas_version=VERSION,atlas_content_sha256=h.hexdigest(),body_content_sha256=hashlib.sha256((ROOT/'data/body/axilla-v1.json').read_bytes()).hexdigest(),coordinate_system='normalized_2d_top_left')
 for v,model in models.items():model['atlas'].update(**META,identity=identity,regions=views[v]['regions'],technicalReady=True,blockedReason='',**{k:manifest[k] for k in ['sourceTitle','sourceUrl','attribution','coverageNote']})
 (ROOT/'miniprogram/data/axilla-schematic.generated.ts').write_text('// GENERATED artificial schematic, NOT medical geometry.\nimport {LocalSurfaceModel} from "../types/local-surface";\nimport {AxillaView} from "../types/dermatome";\nexport const AXILLA_SCHEMATIC_MODELS:Readonly<Record<AxillaView,LocalSurfaceModel>>='+json.dumps(models,ensure_ascii=False,separators=(',',':'))+';\n')
 print(json.dumps(coverage,indent=2))
if __name__=='__main__':build()
