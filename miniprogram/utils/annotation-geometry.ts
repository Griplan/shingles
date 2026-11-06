import { BodyModelConfig, NormalizedPoint as Point } from "../types/dermatome";

// 归一化单位：数值判等1e-12，面积退化1e-10。不是触摸或人体扩张容差。
export const GEOMETRY_EPSILON = 1e-12;
export const MIN_POLYGON_AREA = 1e-10;
export const MAX_VERTICES = 128;
const EPS = GEOMETRY_EPSILON;
export interface BodyPart { readonly outer: readonly Point[]; readonly holes: readonly (readonly Point[])[] }
/** 有效简单多边形的非相交部分；闭环可显式重复末点。不是粗部位分区。 */
export type BodyGeometry = readonly BodyPart[];
export type GeometryResult = {readonly ok:true; readonly ring:readonly Point[]} |
  {readonly ok:false; readonly code:string; readonly message:string};
const cross = (a:Point,b:Point,c:Point):number => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export const samePoint = (a:Point,b:Point):boolean => Math.abs(a.x-b.x)<=EPS && Math.abs(a.y-b.y)<=EPS;
export function validPoint(p:unknown):p is Point {
  if(!p || typeof p!=="object")return false;
  const q=p as Point;
  return typeof q.x==="number" && typeof q.y==="number" && Number.isFinite(q.x) && Number.isFinite(q.y) &&
    q.x>=0 && q.x<=1 && q.y>=0 && q.y<=1;
}
function openRing(ring:readonly Point[]):readonly Point[] {
  return ring.length>1 && samePoint(ring[0],ring[ring.length-1]) ? ring.slice(0,-1) : ring;
}
function onSegment(p:Point,a:Point,b:Point):boolean {
  return Math.abs(cross(a,b,p))<=EPS*Math.hypot(b.x-a.x,b.y-a.y) &&
    p.x>=Math.min(a.x,b.x)-EPS && p.x<=Math.max(a.x,b.x)+EPS &&
    p.y>=Math.min(a.y,b.y)-EPS && p.y<=Math.max(a.y,b.y)+EPS;
}
/** -1外部、0边界、1内部。无0.25逻辑单位触摸扩张。 */
export function locatePoint(p:Point,ring:readonly Point[]):-1|0|1 {
  let inside=false;
  const r=openRing(ring);
  for(let i=0,j=r.length-1;i<r.length;j=i++) {
    const a=r[j],b=r[i];
    if(onSegment(p,a,b))return 0;
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside?1:-1;
}
interface BodyRingIndex {
  readonly low:number;
  readonly high:number;
  readonly buckets:readonly (readonly (readonly [Point,Point])[])[];
}
// Only deeply frozen body rings may be cached. Mutable/custom geometry continues
// through the original predicate, so a changed vertex can never reuse stale edges.
// Weak keys retain no expired body/template; these are edges, NOT validation verdicts.
const bodyRingIndexes=new WeakMap<readonly Point[],BodyRingIndex>();
function bucketAt(y:number,low:number,high:number,count:number):number {
  return Math.max(0,Math.min(count-1,Math.floor((y-low)/(high-low)*count)));
}
function locateBodyPoint(p:Point,ring:readonly Point[]):-1|0|1 {
  let index=bodyRingIndexes.get(ring);
  if(!index){
    if(ring.length<32||!Object.isFrozen(ring)||!ring.every(q=>Object.isFrozen(q)&&validPoint(q)))
      return locatePoint(p,ring);
    const r=openRing(ring);
    let low=Infinity,high=-Infinity;
    for(const q of r){low=Math.min(low,q.y);high=Math.max(high,q.y);}
    low-=EPS;high+=EPS;
    const buckets:[Point,Point][][]=Array.from({length:64},()=>[]);
    for(let i=0,j=r.length-1;i<r.length;j=i++){
      const a=r[j],b=r[i],edge:[Point,Point]=[a,b];
      // Include the original onSegment tolerance; this is a conservative broad
      // phase. Exact boundary and ray predicates (and their order) stay unchanged.
      const first=bucketAt(Math.min(a.y,b.y)-EPS,low,high,buckets.length);
      const last=bucketAt(Math.max(a.y,b.y)+EPS,low,high,buckets.length);
      for(let k=first;k<=last;k++)buckets[k].push(edge);
    }
    index={low,high,buckets};bodyRingIndexes.set(ring,index);
  }
  if(p.y<index.low||p.y>index.high)return -1;
  let inside=false;
  for(const [a,b] of index.buckets[bucketAt(p.y,index.low,index.high,index.buckets.length)]){
    if(onSegment(p,a,b))return 0;
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside?1:-1;
}
export function pointInBody(p:Point,body:BodyGeometry):boolean {
  return validPoint(p) && body.some(part=>locateBodyPoint(p,part.outer)>=0 &&
    part.holes.every(hole=>locateBodyPoint(p,hole)<=0));
}
const bodyCache=new WeakMap<BodyModelConfig,BodyGeometry>();
export function bodyGeometry(model:BodyModelConfig):BodyGeometry {
  let body=bodyCache.get(model);
  if(!body) {
    // 当前源图经独立几何审核为一个无孔简单外环；不从包围盒或粗区域拼人体。
    body=Object.freeze([Object.freeze({outer:Object.freeze(model.hitOutline.map(p=>Object.freeze({
      x:p.x/model.logicalWidth,y:p.y/model.logicalHeight}))),holes:Object.freeze([])})]);
    bodyCache.set(model,body);
  }
  return body;
}
/** 两条闭线段的全部交点在ab上的参数；共线时返回交叠端点。 */
export function intersectionParameters(a:Point,b:Point,c:Point,d:Point):number[] {
  const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y;
  const denominator=rx*sy-ry*sx;
  const length=Math.hypot(rx,ry),other=Math.hypot(sx,sy);
  if(Math.abs(denominator)>EPS*length*other) {
    const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/denominator;
    const u=((c.x-a.x)*ry-(c.y-a.y)*rx)/denominator;
    return t>=-EPS && t<=1+EPS && u>=-EPS && u<=1+EPS ? [Math.max(0,Math.min(1,t))] : [];
  }
  if(Math.abs(cross(a,b,c))>EPS*length)return [];
  const l2=rx*rx+ry*ry;
  if(!l2)return onSegment(a,c,d)?[0]:[];
  const t=(p:Point)=>((p.x-a.x)*rx+(p.y-a.y)*ry)/l2;
  const lo=Math.max(0,Math.min(t(c),t(d))),hi=Math.min(1,Math.max(t(c),t(d)));
  return lo<=hi+EPS?[Math.max(0,lo),Math.min(1,hi)]:[];
}
export function edges(ring:readonly Point[]):readonly [Point,Point][] {
  const r=openRing(ring);
  return r.map((p,i)=>[p,r[(i+1)%r.length]] as [Point,Point]);
}
export function area(r:readonly Point[]):number {
  // 相对首点求和，避免小形状在大坐标处的消减。
  let sum=0;for(let i=1;i<r.length-1;i++)sum+=cross(r[0],r[i],r[i+1]);
  return Math.abs(sum)/2;
}
/** 扫描相邻顶点y中间的一条线，返回严格位于简单环内部的点。不是任意稀疏抽样。 */
export function interiorPoint(ring:readonly Point[]):Point {
  const r=openRing(ring),ys=[...new Set(r.map(p=>p.y))].sort((a,b)=>a-b);
  for(let k=1;k<ys.length;k++) {
    const y=(ys[k-1]+ys[k])/2,xs:number[]=[];
    for(const [a,b] of edges(r))if((a.y>y)!==(b.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]>xs[i])return {x:(xs[i]+xs[i+1])/2,y};
  }
  throw new RangeError("无效人体孔洞数据");
}
const failure=(code:string,message:string):GeometryResult=>({ok:false,code,message});
/** 开放草稿→显式闭环。逐交点切分所有边；每个拓扑区间内归属恒定，非固定步长抽样。 */
export function validatePolygon(input:readonly Point[],body:BodyGeometry):GeometryResult {
  if(!Array.isArray(input) || input.some(p=>!validPoint(p)))return failure("POINT","坐标必须是 [0,1] 内的有限数值");
  if(input.length<3)return failure("COUNT","至少需要三个不同的顶点");
  if(input.length>MAX_VERTICES)return failure("LIMIT",`每片最多 ${MAX_VERTICES} 个顶点，请拆成多片`);
  for(let i=0;i<input.length;i++)for(let j=0;j<i;j++)if(samePoint(input[i],input[j]))
    return failure("REPEAT",`第 ${i+1} 个点与已有点重复，请撤销；闭合由按钮完成`);
  const segments=edges(input);
  for(let i=0;i<segments.length;i++) {
    const previous=input[(i+input.length-1)%input.length],p=input[i],next=input[(i+1)%input.length];
    if(onSegment(previous,p,next)||onSegment(next,previous,p))return failure("FOLD","存在回折重叠的边，请撤销重画");
    for(let j=0;j<i;j++) {
      if(j===i-1 || (j===0 && i===segments.length-1))continue;
      if(intersectionParameters(...segments[i],...segments[j]).length)
        return failure("SELF_INTERSECTION","边线自交或非相邻边接触，请撤销或重画");
    }
  }
  if(area(input)<=MIN_POLYGON_AREA)return failure("AREA","范围共线或面积退化，请调整点位");
  if(!body.length || input.some(p=>!pointInBody(p,body)))return failure("OUTSIDE","存在人体外的顶点，请调整点位");
  const boundaries=body.flatMap(part=>[part.outer,...part.holes]).flatMap(edges);
  for(const [a,b] of segments) {
    const ts=[0,1,...boundaries.flatMap(([c,d])=>intersectionParameters(a,b,c,d))].sort((x,y)=>x-y);
    for(let i=1;i<ts.length;i++)if(ts[i]>ts[i-1]) {
      const t=(ts[i]+ts[i-1])/2;
      if(!pointInBody({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},body))
        return failure("BACKGROUND","边线跨过人体外空白，请调整点位或拆成多个区域");
    }
  }
  // 边已完整覆盖时，仍可能将一个完整人体孔洞包围在填充内部。
  for(const part of body)for(const hole of part.holes)if(locatePoint(interiorPoint(hole),input)===1)
    return failure("HOLE","填充范围包围人体外孔洞，请拆成多个区域");
  return {ok:true,ring:[...input.map(p=>({x:p.x,y:p.y})),{x:input[0].x,y:input[0].y}]};
}
