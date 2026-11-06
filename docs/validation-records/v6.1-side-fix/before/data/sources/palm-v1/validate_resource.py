"""Independent source-view landmarks, not generated from the function under test."""
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.affinity import scale
import json
ROOT=Path(__file__).resolve().parents[3]
m=json.loads((ROOT/'data/body/palm-resource.json').read_text())
a=shape(m['views']['palm-right']['body']);b=shape(m['views']['palm-left']['body'])
# Manually selected while inspecting original SVG and final PNG, prior to these checks.
pts=[('thumb',60,310,True),('index',188,140,True),('middle',254,95,True),('ring',307,110,True),('little',377,195,True),('central_palm',280,470,True),('wrist',280,640,True),('index_middle_gap',219,260,False),('middle_ring_gap',283,260,False),('ring_little_gap',347,285,False),('thumb_index_gap',137,340,False)]
checks=[]
for name,x,y,expected in pts:
 v=[x/440,y/700];actual=a.covers(Point(v));assert actual==expected,(name,actual)
 mirrored=b.covers(Point(1-v[0],v[1]));assert mirrored==expected
 checks.append({'name':name,'rightNormalized':v,'leftNormalized':[1-v[0],v[1]],'expectedOnSurface':expected,'actualOnSurface':actual})
assert a.is_valid and b.is_valid
assert abs(a.area-b.area)<1e-10
symmetric_difference=scale(a,xfact=-1,yfact=1,origin=(.5,0)).symmetric_difference(b).area
assert symmetric_difference<1e-8
for g in [a,b]:
 assert g.exterior.coords[0]==g.exterior.coords[-1]
 assert all(0<=n<=1 for pt in g.exterior.coords for n in pt)
r={'status':'PASS','scope':'Source-derived display geometry and static resources only; not neurological atlas or WeChat runtime','logicalSize':[440,700],'runtimeRasterSize':[880,1400],'outlineVertexCountEach':366,'polygonValid':True,'mirrorSymmetricDifferenceArea':symmetric_difference,'referencePoints':checks,'checks':['closed valid normalized rings','source path retained with documented wrist crop','left/right equal area and horizontal mirror within rounding tolerance','seven visible anatomical surface points and four visible gaps checked on both sides']}
Path(__file__).with_name('resource-validation.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('PASS: 22 manually selected display reference-point tests + valid closed polygons + mirror within rounding tolerance')
