"""V6.5 offline hand registration; no runtime dependency or inferred nerve boundaries.
Target gaps come from the unchanged CC0 ink paths. Source labels/fills come only
from pinned Goran SVG. TPS is an engineering correspondence, pending medical review.
"""
import json, math, xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon, LineString, Point, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import substring, nearest_points
from shapely import affinity
from svg_geometry import IDENTITY, transform, multiply, path_rings, flatten_geometry
from prepare_atlas import ROOT, source_outline, source_paths, EXPECTED_SHA1
R=ROOT
SOURCE_Y=440.
TARGET_Y={'front':440.1111111111111,'back':439.6666666666667}
def target_paths(v):
 out={}
 def walk(e,m,nested=False):
  m=multiply(m,transform(e.get('transform')))
  if nested and e.tag.endswith('}svg'):
   vb=list(map(float,e.get('viewBox').split()));m=multiply(m,transform(f'translate({-vb[0]} {-vb[1]})'))
  if e.tag.endswith('}path'):out[e.get('id')]=path_rings(e.get('d'),m,.02)[0]
  for c in e:walk(c,m,True)
 walk(ET.parse(R/f'miniprogram/assets/body/commons-cc0/{v}.svg').getroot(),IDENTITY)
 return out

def domains():
 result={}
 for view in ['front','back']:
  body=affinity.scale(shape(json.load(open(R/'data/body/commons-template4.json'))['views'][view]['geometry']),400,900,origin=(0,0));src=source_outline(view);paths=target_paths(view)
  for side in ['left','right']:
   screenleft=(side=='right')==(view=='front')
   win=box(0 if screenleft else 292,440.1111111111111 if view=='front' else 439.6666666666667,108 if screenleft else 400,560)
   hand=body.intersection(win);assert hand.geom_type=='Polygon'
   pid=({'front':('path4036','path4119'),'back':('path4023','path3979')}[view])[0 if screenleft else 1]
   pts=paths[pid]
   peaks=[i for i in range(1,len(pts)-1) if pts[i][1]>500 and pts[i][1]>=pts[i-1][1] and pts[i][1]>pts[i+1][1]]
   assert len(peaks)==4
   fixed=hand
   for a,b in zip(peaks,peaks[1:]):
    ring=pts[a:b+1]+[(pts[b][0],560),(pts[a][0],560)]
    gap=Polygon(ring);assert gap.is_valid
    fixed=fixed.difference(gap)
   # Original thumb/index boundary is split across two ink paths; join at their
   # actual intersection, or their sub-stroke source endpoint gap (<0.4 logical px).
   outerpid=({'front':('path4024','path4123'),'back':('path4021','path4001')}[view])[0 if screenleft else 1]
   fl=LineString(pts);ol=LineString(paths[outerpid]);fa,oa=nearest_points(fl,ol)
   assert fa.distance(oa)<.4
   peak=min(peaks,key=lambda i:abs(fl.project(Point(pts[i]))-fl.project(fa)))
   ot=max(paths[outerpid],key=lambda p:p[1])
   arc=list(substring(fl,fl.project(Point(pts[peak])),fl.project(fa)).coords)+list(substring(ol,ol.project(oa),ol.project(Point(ot))).coords)
   gap=Polygon(arc+[(arc[-1][0],560),(arc[0][0],560)])
   assert gap.is_valid
   fixed=fixed.difference(gap)
   assert fixed.geom_type=='Polygon' and fixed.is_valid
   srcwin=box(0 if screenleft else (330 if view=='front' else 320),440,120 if screenleft else 500,560);sh=src.intersection(srcwin);assert sh.geom_type=='Polygon'
   result[view+'-'+side]={'source':list(sh.exterior.coords)[:-1],'target':list(fixed.exterior.coords)[:-1],'targetPathId':pid,'thumbPathId':outerpid,'sourceCutY':SOURCE_Y,'targetCutY':TARGET_Y[view],'oldTarget':list(hand.exterior.coords)[:-1]}
 return result

def canonical(pts,mirror=False):
 pts=[(-x if mirror else x,y) for x,y in pts]
 pts=list(orient(Polygon(pts),sign=-1).exterior.coords)[:-1]
 top=min(y for x,y in pts);idx=min((i for i,p in enumerate(pts) if abs(p[1]-top)<1e-7),key=lambda i:pts[i][0])
 return pts[idx:]+pts[:idx]
def landmarks(pts,delta=5):
 # Five distal tips and four webs in boundary order, determined on actual contours.
 out=[0];mode=1;best=0
 for i,p in enumerate(pts[1:],1):
  if mode==1:
   if p[1]>pts[best][1]:best=i
   elif pts[best][1]-p[1]>delta:out.append(best);best=i;mode=-1
  else:
   if p[1]<pts[best][1]:best=i
   elif p[1]-pts[best][1]>delta:out.append(best);best=i;mode=1
 top=pts[0][1];ulnar=max((i for i,p in enumerate(pts) if abs(p[1]-top)<1e-7),key=lambda i:pts[i][0]);out.append(ulnar)
 assert len(out)==11,[(i,pts[i]) for i in out]
 return out

def pair_boundary(a,b,ia,ib):
 aa=[];bb=[];land=[]
 for k in range(11):
  pa=a[ia[k]:ia[k+1]+1] if k<10 else a[ia[k]:]+[a[0]]
  pb=b[ib[k]:ib[k+1]+1] if k<10 else b[ib[k]:]+[b[0]]
  la,lb=LineString(pa),LineString(pb)
  ts=sorted(set([round(la.project(Point(p))/la.length,12) for p in pa]+[round(lb.project(Point(p))/lb.length,12) for p in pb]))
  land.append(len(aa))
  for t in ts[:-1]:aa.append(la.interpolate(t,normalized=True).coords[0]);bb.append(lb.interpolate(t,normalized=True).coords[0])
 return aa,bb,land


def mapper(s,t):
 raws=np.asarray(s);rawt=np.asarray(t)
 ss=[];tt=[]
 for i in range(len(s)):
  a,b=raws[i],raws[(i+1)%len(s)];c,d=rawt[i],rawt[(i+1)%len(t)];n=max(1,int(np.ceil(np.linalg.norm(b-a))))
  for j in range(n):ss.append(a+(b-a)*j/n);tt.append(c+(d-c)*j/n)
 s=np.asarray(ss)/100;t=np.asarray(tt)/100
 # Keep original boundary correspondence, conditioning in comparable logical units.
 keep=[0]
 for i in range(1,len(s)):
  if np.linalg.norm(s[i]-s[keep[-1]])>=.00001:keep.append(i)
 s=s[keep];t=t[keep];n=len(s)
 def u(d):
  q=(d*d).sum(axis=-1);return q*np.log(np.maximum(q,1e-30))
 k=u(s[:,None,:]-s[None,:,:])+np.eye(n)*1e-4;p=np.c_[np.ones(n),s]
 coef=np.linalg.solve(np.block([[k,p],[p.T,np.zeros((3,3))]]),np.vstack([t,np.zeros((3,2))]))
 def point(x,y):
  p=np.array([x,y])/100
  q=np.array([x,y]);end=np.roll(raws,-1,axis=0);edge=end-raws
  f=np.clip(((q-raws)*edge).sum(axis=1)/(edge*edge).sum(axis=1),0,1)
  distances=np.linalg.norm(raws+f[:,None]*edge-q,axis=1);i=int(np.argmin(distances))
  if distances[i]<1e-7:return tuple(rawt[i]+f[i]*(rawt[(i+1)%len(rawt)]-rawt[i]))
  return tuple((np.r_[u(s-p),1,p]@coef)*100)
 return point

def warp_geometry(g,fn,spacing=.1):
 def ring(r):
  ps=list(r.coords);out=[]
  for a,b in zip(ps,ps[1:]):
   n=max(1,math.ceil(math.dist(a,b)/spacing))
   for i in range(n):out.append(fn(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))
  return out+[out[0]]
 parts=[Polygon(ring(p.exterior),[ring(h) for h in p.interiors]) for p in flatten_geometry(g)]
 assert all(p.is_valid for p in parts), 'Hand warp invalid; do not repair/convex-hull'
 from shapely.ops import unary_union
 result=unary_union(parts)
 assert result.is_valid
 return result

def visible(view):
 items=source_paths(view);insets={0,22,23,24,25,26,27} if view=='front' else {0,1,2,3,4,5,45}
 painted=Polygon();result={}
 for it in reversed(items):
  if it['index'] in insets:continue
  result[it['index']]=it['geometry'].difference(painted);painted=painted.union(it['geometry'])
 return items,result
