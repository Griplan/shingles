import sys,os,json,hashlib,platform,time
from pathlib import Path
ROOT=Path.cwd();sys.path[:0]=[str(ROOT/'backend'),str(ROOT/'backend/tests'),str(ROOT/'scripts')]
os.environ['DERMATOME_ENV']='test';os.environ['ENABLE_REFERENCE_MATCHING']='1'
from test_axilla_provisional import dataset,payload
from fastapi.testclient import TestClient
from app.main import app
from shapely.geometry import Point,shape,box
from shapely.affinity import affine_transform
from shapely.ops import unary_union
from build_sole_atlas import svg_path
O=ROOT/'docs/validation-records/v6.6-axilla/provisional-matching';d=dataset()
rows=[]
with TestClient(app) as c:
 for view in ['axilla-left','axilla-right']:
  rr=[r for r in d.regions if r['view']==view];p=rr[0]['shape'].representative_point();g=rr[0]['shape'].buffer(-.003)
  q=payload(g,view);start=time.perf_counter();r=c.post('/api/v1/evaluate',json=q);assert r.status_code==200,r.text
  rows.append(dict(request=q,response=r.json(),elapsedMs=(time.perf_counter()-start)*1000))
(O/'evidence/real-api-examples.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
reg=json.loads((ROOT/'data/atlas/axilla-goran-provisional-v1/registration.json').read_text())
def svg(name,content,w=1100,h=650):
 (O/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="#f6faf7"/><g font-family="PingFang SC,Arial,sans-serif" fill="#274f44">{content}</g></svg>')
def text(x,y,t,size=22):return f'<text x="{x}" y="{y}" font-size="{size}">{t}</text>'
for view in ['axilla-left','axilla-right']:
 art=(O/(view+'.svg')).read_text();art=art[art.index('<svg'):].replace('width="400" height="360"','x="20" y="85" width="600" height="540"')
 rr=[r for r in d.regions if r['view']==view];coverage=json.loads((O/'evidence/coverage.json').read_text())[view]
 s=text(25,40,view+' · PROVISIONAL / HIGH / 未经医学审核',26)+art
 s+=text(650,120,'B类：原侧p19→T1 / p20→T2')+text(650,160,'三对估计点局部仿射，保留源曲线')+text(650,200,'C类推定延伸：无')+text(650,240,f'配置皮肤面积 {coverage["configuredRatio"]:.2%}')+text(650,280,'中央腋底、胸壁等继续未覆盖')
 for i,r in enumerate(rr):
  p=r['labelPoint'];s+=text(20+p['x']*600,85+p['y']*540,r['labelId'],18)
 # Actual synthetic lesion used by FastAPI and actual returned candidate highlights.
 example=next(e for e in rows if e['request']['lesions'][0]['view']==view)
 coords=example['request']['lesions'][0]['geometry']['coordinates'];g=shape({'type':'MultiPolygon','coordinates':[[[[p['x'],p['y']] for p in ring] for ring in poly] for poly in coords]})
 s+=f'<path d="{svg_path(affine_transform(g,[600,0,0,540,20,85]))}" stroke="#964a31" fill="none" stroke-width="2"/>'
 
 for i,(u,v) in enumerate(reg['sides'][view.split('-')[-1]]['targetControlPoints'],1):
  s+=f'<circle cx="{20+u*600}" cy="{85+v*540}" r="4" fill="#925035"/>'+text(26+u*600,80+v*540,str(i),15)
 s+=text(650,350,'棕色：实际请求的合成病灶')+text(650,390,'返回标签：'+','.join(c['label'] for c in example['response']['views'][0]['candidates']))+text(650,450,'覆盖率为几何重叠，不是医学概率')+text(650,500,'Goran_tek-en / CC BY-SA 4.0',18)
 svg(view+'-preview',s)
 # Uncovered display, independent skin boundary, no guessed floor fill.
 s=text(25,40,view+' · 灰色未覆盖，蓝色已配置B类')+art
 missing=shape(coverage['uncoveredGeometry']);s+=f'<path d="{svg_path(affine_transform(missing,[600,0,0,540,20,85]))}" fill="#7d827d" fill-opacity=".45"/>'
 s+=text(650,160,'未覆盖不代表没有感觉神经')+text(650,200,'无直接来源的抬臂表面不补齐')
 svg(view+'-uncovered',s)
# Control diagrams in separate source/target coordinate frames, not a false common projection.
s=text(25,35,'控制点对应 · 全部目标点均为人工估计 / HIGH',25)
for col,side in enumerate(['right','left']):
 xoff=25+col*530;s+=text(xoff,80,side+' / 原图裁窗 → 目标近端内臂',20)
 for e in reg['sourceElements']:
  if e['viewId']!='axilla-'+side:continue
  g=shape(e['sourceGeometry']);bounds=(130,260,200,315) if side=='right' else (290,260,350,315)
  a=3;tx=xoff-bounds[0]*a;ty=110-bounds[1]*a
  s+=f'<path d="{svg_path(affine_transform(g,[a,0,0,a,tx,ty]))}" fill="#c8dfb0" stroke="#487c55"/>'
 target=reg['sides'][side]['targetControlPoints'];source=reg['sides'][side]['sourceControlPoints']
 for i,((sx,sy),(u,v)) in enumerate(zip(source,target),1):
  s+=f'<circle cx="{sx*a+tx}" cy="{sy*a+ty}" r="4" fill="#9c4c37"/>'+text(sx*a+tx+6,sy*a+ty,str(i),16)
  s+=text(xoff,335+(i-1)*47,f'{i}: ({sx:.2f},{sy:.0f}) → ({u:.2f},{v:.2f})',18)
 s+=text(xoff,510,'源控制点来自曲线截线，目标是姿态估计。',18)
s+=text(25,590,'A：源SVG可见几何；B：本轮所有目标区域；C：0区域。拟合残差不是医学配准误差。',19)
svg('control-point-correspondence',s)
