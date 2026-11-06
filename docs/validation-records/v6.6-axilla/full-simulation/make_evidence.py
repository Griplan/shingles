"""Real ASGI results on synthetic polygons, plus static schematic visual evidence."""
import os,sys,json,copy,xml.etree.ElementTree as ET
from pathlib import Path
R=Path.cwd();O=Path(__file__).parent;sys.path[:0]=[str(R/'backend'),str(R/'backend/tests'),str(R/'scripts')]
os.environ['DERMATOME_ENV']='test';os.environ['ENABLE_REFERENCE_MATCHING']='1'
from fastapi.testclient import TestClient
from app.main import app
from test_axilla_schematic import identity,dataset
from shapely.affinity import affine_transform
from shapely.geometry import shape
from shapely.ops import unary_union
from build_sole_atlas import svg_path
N='{http://www.w3.org/2000/svg}';ET.register_namespace('',N[1:-1])
def text(x,y,t,size=22):return f'<text x="{x}" y="{y}" font-size="{size}">{t}</text>'
def emit(name,content,w=1200,h=800):
 (O/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="#f8faf7"/><g font-family="PingFang SC,Arial,sans-serif" fill="#244b40">{content}</g></svg>')
def panel(view,rr,x=20,y=110,w=640,h=576,labels=True):
 original=ET.parse(R/f'miniprogram/assets/axilla/{view}.svg').getroot();original.set('x',str(x));original.set('y',str(y));original.set('width',str(w));original.set('height',str(h))
 s=ET.tostring(original,encoding='unicode')
 for r in rr:
  g=affine_transform(shape(r['geometry']),[w,0,0,h,x,y]);s+=f'<path d="{svg_path(g)}" fill="{r["color"]}" fill-opacity=".7" stroke="{r["color"]}" stroke-width=".8" fill-rule="evenodd"/>'
 # Restore actual visible folds and source outline above colors.
 for e in original.iter():
  if e.get('id')=='skin':e.set('fill','none')
 s+=ET.tostring(original,encoding='unicode')
 if labels:
  for r in rr:
   p=r['labelPoint'];s+=text(x+w*p['x']-35,y+h*p['y'],r['displayName'],24)
 return s
examples=[];d=dataset();coverage=json.loads((O/'evidence/coverage.json').read_text())
with TestClient(app) as c:
 for side in ['left','right']:
  view='axilla-'+side;rr=[r for r in d.regions if r['view']==view]
  lesions=[]
  for i,(x,y) in enumerate([(.55,.4567),(.382,.235),(.7075,.655)]):
   if side=='left':x=1-x
   pts=[dict(x=x-.012,y=y-.012),dict(x=x+.012,y=y-.012),dict(x=x,y=y+.012)];pts.append(pts[0])
   lesions.append(dict(id='synthetic-'+str(i),view=view,geometry=dict(type='MultiPolygon',coordinateSpace='body_template_normalized_v1',coordinates=[[pts]])))
  q=dict(request_id='schematic-example-'+side,annotation_revision=1,identity=identity(),lesions=lesions)
  r=c.post('/api/v1/evaluate',json=q);assert r.status_code==200,r.text;out=r.json();assert len(out['views'][0]['candidates'])==3
  examples.append(dict(request=q,response=out))
  s=text(25,40,view+' · 完整模拟分区，非医学验证图谱',29)+panel(view,rr)
  s+=text(720,145,'SCHEMATIC / 人工构建',24)+text(720,195,'上臂方向：模拟 T1')+text(720,240,'中央及邻近：模拟 T2')+text(720,285,'较低胸壁方向：模拟 T3')+text(720,350,'有效皮肤面积覆盖 ≈100%')+text(720,400,'轮廓与原标注坐标不变')+text(720,450,'没有引用Goran曲线作为新边界')+text(720,530,'仅供交互模拟和科普')+text(720,575,'不判断实际受累神经')
  emit(view+'-full',s)
  s=text(25,40,view+' · 合成标注的实际API匹配示例',27)+panel(view,rr)
  for lesion in lesions:
   coords=[[[[p['x'],p['y']] for p in ring] for ring in poly] for poly in lesion['geometry']['coordinates']]
   g=affine_transform(shape(dict(type='MultiPolygon',coordinates=coords)),[640,0,0,576,20,110]);s+=f'<path d="{svg_path(g)}" fill="none" stroke="#93482b" stroke-width="3"/>'
  s+=text(720,160,'实际返回：模拟T1 / T2 / T3')+text(720,210,'棕色：请求中的三片合成标注')+text(720,260,'几何覆盖≈100%，不是医学概率')+text(720,330,'source.atlas_type = SCHEMATIC',19)+text(720,380,'NOT_MEDICALLY_VALIDATED',19)+text(720,450,'此图不是微信运行截图')
  emit(view+'-matching',s)
(O/'evidence/api-examples.json').write_text(json.dumps(examples,ensure_ascii=False,indent=2))
s=text(25,40,'左右模拟标签分布 · 非医学验证图谱',28)
for x,view in [(20,'axilla-left'),(610,'axilla-right')]:s+=panel(view,[r for r in d.regions if r['view']==view],x,100,560,504)+text(x+130,660,view,22)
emit('labels',s,1200,730)
s=text(25,40,'有效皮肤轮廓 / 分区并集对照 · 非医学验证图谱',26)
for x,view in [(20,'axilla-left'),(610,'axilla-right')]:
 g=d.bodies[view];u=unary_union([r['shape'] for r in d.regions if r['view']==view]);m=[560,0,0,504,x,100]
 s+=f'<path d="{svg_path(affine_transform(u,m))}" fill="#a8d1c0"/><path d="{svg_path(affine_transform(g,m))}" fill="none" stroke="#315f4c" stroke-width="3"/>'+text(x+70,640,view+' · 16,357网格点/0漏点',20)
s+=text(25,700,'深绿轮廓：原有效皮肤；浅绿：分区并集。残差仅浮点舍入（约1e-19面积）。',20)
emit('skin-union',s,1200,750)
s=text(25,40,'模拟未定区 · 本版本无剩余有效皮肤需另设区域',27)+panel('axilla-right',[r for r in d.regions if r['view']=='axilla-right'])+text(720,160,'模拟未定区：0片 / 0面积')+text(720,210,'其余均分入三块人工示意区域')+text(720,280,'这不表示医学边界已知')+text(720,330,'非医学验证图谱')
emit('undefined',s)
print('2 actual API examples, 7 static SVG figures')
