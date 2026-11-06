"""Small offline SVG geometry reader: transforms, adaptive Béziers, evenodd/nonzero fills.
Not used in the mini-program and not a medical-boundary generator.
"""
import math
import re
from shapely.geometry import LineString, Polygon, GeometryCollection
from shapely.ops import unary_union, polygonize

NUMBER=r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?'

def multiply(a,b):
    return (a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5])

IDENTITY=(1,0,0,1,0,0)
def transform(text):
    result=IDENTITY
    for name,args in re.findall(r'(\w+)\(([^)]+)\)',text or ''):
        n=list(map(float,re.findall(NUMBER,args)))
        if name=='translate':m=(1,0,0,1,n[0],n[1] if len(n)>1 else 0)
        elif name=='scale':m=(n[0],0,0,n[-1],0,0)
        elif name=='matrix':m=tuple(n)
        else:raise ValueError('Unsupported SVG transform '+name)
        result=multiply(result,m)
    return result

def project(p,m):return (m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5])
def mid(a,b):return ((a[0]+b[0])/2,(a[1]+b[1])/2)
def distance(p,a,b):
    dx=b[0]-a[0];dy=b[1]-a[1];d=dx*dx+dy*dy
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)) if d else 0
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
def cubic(a,b,c,d,out,tolerance,depth=0):
    if max(distance(b,a,d),distance(c,a,d))<=tolerance or depth>=18:out.append(d);return
    ab,bc,cd=mid(a,b),mid(b,c),mid(c,d);abc,bcd=mid(ab,bc),mid(bc,cd);center=mid(abc,bcd)
    cubic(a,ab,abc,center,out,tolerance,depth+1);cubic(center,bcd,cd,d,out,tolerance,depth+1)

def path_rings(d,m=IDENTITY,tolerance=.12):
    tokens=re.findall(r'[a-zA-Z]|'+NUMBER,d);i=0;command=None;point=(0,0);start=point;last_control=None;previous='';rings=[];out=[]
    counts={'M':2,'L':2,'H':1,'V':1,'C':6,'S':4,'Q':4,'T':2}
    while i<len(tokens):
        if tokens[i].isalpha():command=tokens[i];i+=1
        upper=command.upper();relative=command.islower()
        if upper=='Z':
            if out:out.append(start);rings.append([project(p,m) for p in out]);out=[]
            point=start;last_control=None;previous='Z';command=None;continue
        if upper not in counts:raise ValueError('Unsupported SVG path command '+str(command))
        size=counts[upper];values=list(map(float,tokens[i:i+size]));i+=size
        def coord(k):return (values[k]+(point[0] if relative else 0),values[k+1]+(point[1] if relative else 0))
        if upper=='M':
            if out:rings.append([project(p,m) for p in out]);out=[]
            point=coord(0);start=point;out=[point];command='l' if relative else 'L'
        elif upper=='L':point=coord(0);out.append(point)
        elif upper=='H':point=(values[0]+(point[0] if relative else 0),point[1]);out.append(point)
        elif upper=='V':point=(point[0],values[0]+(point[1] if relative else 0));out.append(point)
        elif upper in ('C','S'):
            if upper=='C':b,c,end=coord(0),coord(2),coord(4)
            else:b=(2*point[0]-last_control[0],2*point[1]-last_control[1]) if previous in ('C','S') else point;c,end=coord(0),coord(2)
            cubic(point,b,c,end,out,tolerance);point=end;last_control=c
        else:
            control=coord(0) if upper=='Q' else ((2*point[0]-last_control[0],2*point[1]-last_control[1]) if previous in ('Q','T') else point)
            end=coord(2) if upper=='Q' else coord(0)
            b=(point[0]+2*(control[0]-point[0])/3,point[1]+2*(control[1]-point[1])/3);c=(end[0]+2*(control[0]-end[0])/3,end[1]+2*(control[1]-end[1])/3)
            cubic(point,b,c,end,out,tolerance);point=end;last_control=control
        if upper not in ('C','S','Q','T'):last_control=None
        previous=upper
    if out:rings.append([project(p,m) for p in out])
    return rings

def filled_geometry(rings,fill_rule='nonzero'):
    rings=[r if r[0]==r[-1] else r+[r[0]] for r in rings if len(r)>=3]
    if not rings:return GeometryCollection()
    def winding(p,ring):
        x,y=p;w=0
        for a,b in zip(ring,ring[1:]):
            cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])
            if a[1]<=y<b[1] and cross>0:w+=1
            elif b[1]<=y<a[1] and cross<0:w-=1
        return w
    faces=list(polygonize(unary_union([LineString(r) for r in rings])))
    def inside(p):
        w=sum(winding(p.representative_point().coords[0],r) for r in rings)
        return w%2!=0 if fill_rule=='evenodd' else w!=0
    return unary_union([p for p in faces if inside(p)])

def flatten_geometry(geometry):
    if geometry.geom_type=='Polygon':return [geometry]
    if hasattr(geometry,'geoms'):return [p for g in geometry.geoms for p in flatten_geometry(g)]
    return []
