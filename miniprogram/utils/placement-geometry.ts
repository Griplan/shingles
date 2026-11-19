import { ConfirmedPhoto, PHOTO_SPACE } from "../types/ai";
import { BodyModelConfig, BodyRegion, NormalizedPoint as Point, NormalizedRect } from "../types/dermatome";
import { BODY_SPACE, BodyMultiPolygon, PlacementPolygon, PlacementRing, PlacementTransform,
  PlacementValidation, PreparedPhotoGeometry } from "../types/placement";
import { area, BodyGeometry, bodyGeometry, edges, GEOMETRY_EPSILON,
  intersectionParameters, locatePoint, pointInBody, samePoint } from "./annotation-geometry";

// Explicit rejection retains the complete source result; no simplification or truncation.
export const MAX_PLACEMENT_VERTICES = 20000;
export const MIN_PLACEMENT_SCALE = .1;
export const MAX_PLACEMENT_SCALE = 4;
const EPS = GEOMETRY_EPSILON;
const fail = (code:string,message:string):PlacementValidation=>({ok:false,code,message});
export class PlacementError extends Error {
  constructor(readonly code:string,message:string){super(message);this.name="PlacementError";}
}
function reject(code:string,message:string):never{throw new PlacementError(code,message);}
interface BodyBoundaryIndex {
  readonly low:number;
  readonly high:number;
  readonly buckets:readonly (readonly (readonly [Point,Point])[])[];
}
const bodyBoundaryIndexes=new WeakMap<BodyGeometry,BodyBoundaryIndex>();
const BODY_BOUNDARY_BUCKETS=128;
function boundaryBucket(y:number,low:number,high:number):number {
  return Math.max(0,Math.min(BODY_BOUNDARY_BUCKETS-1,Math.floor((y-low)/(high-low)*BODY_BOUNDARY_BUCKETS)));
}
function bodyBoundaryIndex(body:BodyGeometry):BodyBoundaryIndex|null {
  const cached=bodyBoundaryIndexes.get(body);if(cached)return cached;
  // Only the canonical deeply frozen body outline is cached. Custom mutable
  // fixtures keep the full scan so later mutations cannot use stale edges.
  if(!Object.isFrozen(body)||!body.every(part=>Object.isFrozen(part)&&Object.isFrozen(part.outer)&&
    Object.isFrozen(part.holes)&&part.outer.every(point=>Object.isFrozen(point))&&
    part.holes.every(hole=>Object.isFrozen(hole)&&hole.every(point=>Object.isFrozen(point)))))return null;
  const all=body.flatMap(part=>[part.outer,...part.holes]).flatMap(edges);
  if(!all.length)return null;
  let low=Infinity,high=-Infinity;
  for(const [a,b] of all){low=Math.min(low,a.y,b.y);high=Math.max(high,a.y,b.y);}
  low-=EPS;high+=EPS;
  const buckets:(readonly [Point,Point])[][]=Array.from({length:BODY_BOUNDARY_BUCKETS},()=>[]);
  for(const edge of all){
    const first=boundaryBucket(Math.min(edge[0].y,edge[1].y)-EPS,low,high);
    const last=boundaryBucket(Math.max(edge[0].y,edge[1].y)+EPS,low,high);
    for(let index=first;index<=last;index++)buckets[index].push(edge);
  }
  const result=Object.freeze({low,high,buckets:Object.freeze(buckets.map(bucket=>Object.freeze(bucket)))});
  bodyBoundaryIndexes.set(body,result);return result;
}
function bodyBoundariesForSegment(a:Point,b:Point,index:BodyBoundaryIndex,all:readonly (readonly [Point,Point])[]):readonly (readonly [Point,Point])[]{
  const low=Math.min(a.y,b.y),high=Math.max(a.y,b.y);
  if(high<index.low||low>index.high)return [];
  const first=boundaryBucket(low,index.low,index.high),last=boundaryBucket(high,index.low,index.high);
  if(first===0&&last===BODY_BOUNDARY_BUCKETS-1)return all;
  const candidates=new Set<readonly [Point,Point]>();
  for(let bucket=first;bucket<=last;bucket++)for(const edge of index.buckets[bucket])candidates.add(edge);
  return [...candidates];
}
const finitePoint=(p:unknown):p is Point=>!!p&&typeof p==="object"&&
  Number.isFinite((p as Point).x)&&Number.isFinite((p as Point).y);
function uniqueRing(r:PlacementRing):PlacementRing{return r.slice(0,-1);}
function boundsOf(points:readonly Point[]):NormalizedRect {
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of points){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
  return {x,y,width:right-x,height:bottom-y};
}
/** -1 excluded/outside, 0 filled boundary, 1 filled interior. Hole winding is irrelevant. */
function locateInPolygon(p:Point,polygon:PlacementPolygon):-1|0|1 {
  const outer=locatePoint(p,polygon[0]);if(outer<0)return -1;
  for(const hole of polygon.slice(1)){const v=locatePoint(p,hole);if(v>0)return -1;if(v===0)return 0;}
  return outer;
}
export function pointInPlacement(p:Point,geometry:BodyMultiPolygon):boolean {
  return finitePoint(p)&&geometry.coordinates.some(poly=>locateInPolygon(p,poly)>=0);
}
export function pointInPhotoPlacement(p:Point,photo:PreparedPhotoGeometry):boolean {
  return photo.coordinateSpace===PHOTO_SPACE&&finitePoint(p)&&photo.polygons.some(poly=>locateInPolygon(p,poly)>=0);
}
/** Arrangement intervals: all crossing parameters, never fixed-step edge sampling. */
function intervals(a:Point,b:Point,boundaries:readonly (readonly [Point,Point])[]):Point[] {
  const ts=[0,1];
  for(const [c,d] of boundaries){
    if(Math.max(a.x,b.x)+EPS<Math.min(c.x,d.x)||Math.max(c.x,d.x)+EPS<Math.min(a.x,b.x)||
       Math.max(a.y,b.y)+EPS<Math.min(c.y,d.y)||Math.max(c.y,d.y)+EPS<Math.min(a.y,b.y))continue;
    ts.push(...intersectionParameters(a,b,c,d));
  }
  ts.sort((x,y)=>x-y);const result:Point[]=[];
  for(let i=1;i<ts.length;i++)if(ts[i]>ts[i-1]){
    const t=(ts[i]+ts[i-1])/2;result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  }
  return result;
}
interface EdgeYIndex {
  readonly low:number;
  readonly high:number;
  readonly buckets:readonly (readonly (readonly [Point,Point])[])[];
}
interface RingData {
  readonly ring:PlacementRing;
  readonly points:PlacementRing;
  readonly edges:readonly (readonly [Point,Point])[];
  readonly bounds:NormalizedRect;
  readonly index:EdgeYIndex;
}
interface PolygonSetData {
  readonly total:number;
  readonly polygons:readonly (readonly RingData[])[];
}
const EDGE_Y_BUCKETS=128;
function edgeBucket(y:number,index:EdgeYIndex):number {
  return Math.max(0,Math.min(EDGE_Y_BUCKETS-1,Math.floor((y-index.low)/(index.high-index.low)*EDGE_Y_BUCKETS)));
}
/** Conservative broad phase for exact ring checks. Every intersecting edge must
 * share at least one Y bucket because its closed Y ranges overlap. */
function edgeYIndexFromEdges(all:readonly (readonly [Point,Point])[]):EdgeYIndex {
  let low=Infinity,high=-Infinity;
  for(const [a,b] of all){low=Math.min(low,a.y,b.y);high=Math.max(high,a.y,b.y);}
  low-=EPS;high+=EPS;
  const buckets:((readonly [Point,Point])[])[]=Array.from({length:EDGE_Y_BUCKETS},()=>[]);
  for(const edge of all){
    const first=Math.max(0,Math.min(EDGE_Y_BUCKETS-1,Math.floor((Math.min(edge[0].y,edge[1].y)-EPS-low)/
      (high-low)*EDGE_Y_BUCKETS)));
    const last=Math.max(0,Math.min(EDGE_Y_BUCKETS-1,Math.floor((Math.max(edge[0].y,edge[1].y)+EPS-low)/
      (high-low)*EDGE_Y_BUCKETS)));
    for(let bucket=first;bucket<=last;bucket++)buckets[bucket].push(edge);
  }
  return {low,high,buckets};
}
function edgeCandidates(a:Point,b:Point,index:EdgeYIndex):readonly (readonly [Point,Point])[] {
  const low=Math.min(a.y,b.y),high=Math.max(a.y,b.y);
  if(high<index.low||low>index.high)return [];
  const first=edgeBucket(low,index),last=edgeBucket(high,index);
  if(first===last)return index.buckets[first];
  const unique=new Set<readonly [Point,Point]>();
  for(let bucket=first;bucket<=last;bucket++)for(const edge of index.buckets[bucket])unique.add(edge);
  return [...unique];
}
function pointOnSegment(p:Point,a:Point,b:Point):boolean {
  const cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
  return Math.abs(cross)<=EPS*Math.hypot(b.x-a.x,b.y-a.y)&&
    p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&
    p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
}
/** Exact same boundary/even-odd predicate as locatePoint, restricted to the
 * conservative Y buckets. Used only while checking a valid ring against an
 * already indexed outer ring. */
function locateInIndexedRing(p:Point,index:EdgeYIndex):-1|0|1 {
  if(p.y<index.low||p.y>index.high)return -1;
  let inside=false;
  for(const [a,b]of index.buckets[edgeBucket(p.y,index)]){
    if(pointOnSegment(p,a,b))return 0;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside?1:-1;
}
function disjointBounds(a:NormalizedRect,b:NormalizedRect):boolean {
  return a.x+a.width<b.x-EPS||b.x+b.width<a.x-EPS||
    a.y+a.height<b.y-EPS||b.y+b.height<a.y-EPS;
}
/** Strict filled witness found by the full scanline arrangement of outer and hole rings. */
function polygonInteriorData(polygon:readonly RingData[]):Point {
  const es=polygon.flatMap(r=>r.edges),ys=[...new Set(polygon.flatMap(r=>r.points.map(p=>p.y)))].sort((a,b)=>a-b);
  const byTop=es.map(([a,b],index)=>({a,b,y:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y),index}))
    .sort((a,b)=>a.y-b.y);
  let active:typeof byTop=[],next=0;
  for(let k=1;k<ys.length;k++){
    const y=(ys[k-1]+ys[k])/2,xs:number[]=[];
    while(next<byTop.length&&byTop[next].y<y)active.push(byTop[next++]);
    active=active.filter(edge=>edge.bottom>y);
    for(const {a,b}of active)xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
    xs.sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)if(xs[i]>xs[i-1]){
      const p={x:(xs[i]+xs[i-1])/2,y};
      if(polygon.every((ring,index)=>index===0?locateInIndexedRing(p,ring.index)>=0:locateInIndexedRing(p,ring.index)<0))
        return p;
    }
  }
  return reject("DEGENERATE","病灶范围没有有效面积，请返回重新确认分割");
}
function validateRing(ring:PlacementRing):RingData {
  if(!Array.isArray(ring)||ring.length<4||ring.some(p=>!finitePoint(p))||!samePoint(ring[0],ring[ring.length-1]))
    reject("INVALID_RING","病灶轮廓必须是有效的闭合范围");
  const points=uniqueRing(ring),seen=new Set<string>(),es=edges(ring);
  for(const p of points){const key=p.x+","+p.y;if(seen.has(key))reject("INVALID_RING","病灶轮廓存在重复顶点");seen.add(key);}
  for(let i=0;i<points.length;i++)if(samePoint(points[i],points[(i+1)%points.length]))
    reject("DEGENERATE","病灶轮廓包含退化边");
  if(area(points)<=1e-24)reject("DEGENERATE","病灶轮廓没有有效面积");
  // Exact segment intersections with a bounding-box sweep as broad phase.
  const sorted=es.map(([a,b],i)=>({a,b,i,x:Math.min(a.x,b.x),right:Math.max(a.x,b.x),y:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)})).sort((a,b)=>a.x-b.x);
  let active:typeof sorted=[];
  for(const edge of sorted){
    active=active.filter(other=>other.right+EPS>=edge.x);
    for(const other of active){
      if(other.bottom+EPS<edge.y||edge.bottom+EPS<other.y)continue;
      const adjacent=Math.abs(edge.i-other.i)===1||Math.abs(edge.i-other.i)===es.length-1;
      const ts=intersectionParameters(edge.a,edge.b,other.a,other.b);
      if(ts.length&&(!adjacent||(ts.length>1&&Math.abs(ts[1]-ts[0])>EPS)))
        reject("SELF_INTERSECTION","病灶轮廓自交或回折，请返回重新确认分割");
    }
    active.push(edge);
  }
  return {ring,points,edges:es,bounds:boundsOf(points),index:edgeYIndexFromEdges(es)};
}
function inspectRing(ring:PlacementRing):RingData {
  const points=uniqueRing(ring),es=edges(ring);
  return {ring,points,edges:es,bounds:boundsOf(points),index:edgeYIndexFromEdges(es)};
}
function ringsShareEdge(a:RingData,b:RingData):boolean {
  if(disjointBounds(a.bounds,b.bounds))return false;
  return a.edges.some(([p,q])=>edgeCandidates(p,q,b.index).some(([r,s])=>{
    const ts=intersectionParameters(p,q,r,s);return ts.length>1&&Math.abs(ts[1]-ts[0])>EPS;
  }));
}
/** A cycle in the ring/contact-point incidence graph disconnects the filled interior.
 * One contact shared by several rings is a star, not an artificial pairwise cycle. */
function validateInteriorConnectivity(polygon:readonly RingData[]):void {
  if(polygon.length<2)return;
  const contacts:{point:Point;rings:Set<number>}[]=[],buckets=new Map<string,number[]>();
  function contact(point:Point,a:number,b:number):void {
    const x=Math.round(point.x/EPS),y=Math.round(point.y/EPS);let index=-1;
    for(let dx=-1;dx<=1&&index<0;dx++)for(let dy=-1;dy<=1&&index<0;dy++)
      for(const candidate of buckets.get(`${x+dx},${y+dy}`)||[])
        if(samePoint(point,contacts[candidate].point)){index=candidate;break;}
    if(index<0){index=contacts.length;contacts.push({point,rings:new Set()});const key=`${x},${y}`;
      buckets.set(key,[...(buckets.get(key)||[]),index]);}
    contacts[index].rings.add(a);contacts[index].rings.add(b);
  }
  for(let i=1;i<polygon.length;i++)for(let j=0;j<i;j++){
    if(disjointBounds(polygon[i].bounds,polygon[j].bounds))continue;
    for(const [a,b]of polygon[i].edges)for(const [c,d]of edgeCandidates(a,b,polygon[j].index)){
      if(Math.max(a.x,b.x)+EPS<Math.min(c.x,d.x)||Math.max(c.x,d.x)+EPS<Math.min(a.x,b.x))continue;
      for(const t of intersectionParameters(a,b,c,d))contact({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},i,j);
    }
  }
  const parent=Array.from({length:polygon.length+contacts.length},(_,i)=>i);
  const find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  contacts.forEach((v,i)=>{
    for(const ring of v.rings){const a=find(ring),b=find(polygon.length+i);
      if(a===b)reject("DISCONNECTED_INTERIOR","病灶孔洞接触使填充范围断开，请返回重新确认分割");parent[a]=b;}
  });
}
/** True only for positive-area intersections; isolated boundary touches are allowed. */
function pointInPolygonData(p:Point,polygon:readonly RingData[]):-1|0|1 {
  const outer=locateInIndexedRing(p,polygon[0].index);if(outer<0)return -1;
  for(const hole of polygon.slice(1)){const v=locateInIndexedRing(p,hole.index);if(v>0)return -1;if(v===0)return 0;}
  return outer;
}
function polygonsOverlap(a:readonly RingData[],b:readonly RingData[]):boolean {
  if(disjointBounds(a[0].bounds,b[0].bounds))return false;
  const ea=a.flatMap(r=>r.edges),eb=b.flatMap(r=>r.edges);
  if(ea.some(([p,q])=>b.some(ring=>!disjointBounds(a[0].bounds,ring.bounds)&&
    intervals(p,q,edgeCandidates(p,q,ring.index)).some(v=>pointInPolygonData(v,b)===1)))||
     eb.some(([p,q])=>a.some(ring=>!disjointBounds(b[0].bounds,ring.bounds)&&
       intervals(p,q,edgeCandidates(p,q,ring.index)).some(v=>pointInPolygonData(v,a)===1))))return true;
  return pointInPolygonData(polygonInteriorData(a),b)===1||pointInPolygonData(polygonInteriorData(b),a)===1;
}
function validatePolygons(polygons:readonly PlacementPolygon[]):PolygonSetData {
  if(!Array.isArray(polygons)||!polygons.length)reject("EMPTY","没有可放置的病灶范围，请返回重新确认分割");
  if(polygons.length>1024)reject("COMPLEXITY","病灶片区过多，暂不能完整放置；原分割结果已保留");
  let total=0;
  for(const poly of polygons){
    if(!Array.isArray(poly)||!poly.length||poly.length>4096)reject("INVALID_POLYGON","病灶片区数据不合法");
    for(const ring of poly){if(!Array.isArray(ring))reject("INVALID_RING","病灶边界数据不合法");total+=ring.length;}
  }
  if(total>MAX_PLACEMENT_VERTICES)reject("COMPLEXITY",`病灶边界超过${MAX_PLACEMENT_VERTICES}点，暂不能完整放置；原分割结果已保留`);
  const data:readonly (readonly RingData[])[]=polygons.map(poly=>poly.map(validateRing));
  for(let polygonIndex=0;polygonIndex<data.length;polygonIndex++){
    const ringData:readonly RingData[]=data[polygonIndex],outer=ringData[0];
    for(let i=1;i<ringData.length;i++){
      const hole=ringData[i];
      if(locateInIndexedRing(polygonInteriorData([hole]),outer.index)!==1||ringsShareEdge(outer,hole)||
        hole.edges.some(([a,b]:readonly [Point,Point])=>[a,b,...intervals(a,b,edgeCandidates(a,b,outer.index))]
          .some(p=>locateInIndexedRing(p,outer.index)<0)))
        reject("INVALID_HOLE","病灶内部空洞与外边界不兼容，请返回重新确认分割");
      for(let j=1;j<i;j++){
        const prior=ringData[j];if(disjointBounds(hole.bounds,prior.bounds))continue;
        if(ringsShareEdge(hole,prior)||polygonsOverlap([hole],[prior]))
          reject("INVALID_HOLE","病灶内部空洞重叠，请返回重新确认分割");
      }
    }
    validateInteriorConnectivity(ringData);polygonInteriorData(ringData);
  }
  const bounds=data.map(p=>p[0].bounds);
  for(let i=0;i<data.length;i++)for(let j=0;j<i;j++){
    const a=bounds[i],b=bounds[j];
    if(a.x+a.width<b.x-EPS||b.x+b.width<a.x-EPS||a.y+a.height<b.y-EPS||b.y+b.height<a.y-EPS)continue;
    if(polygonsOverlap(data[i],data[j]))reject("OVERLAP","独立病灶片区存在内部重叠，请返回重新确认分割");
    // Shared line boundaries are invalid MultiPolygon components; point touches remain valid.
    if(data[i].some((r:RingData)=>data[j].some((s:RingData)=>ringsShareEdge(r,s))))
      reject("OVERLAP","独立片区共用边线，请返回重新确认分割");
  }
  return {total,polygons:data};
}
function inspectPolygons(polygons:readonly PlacementPolygon[]):PolygonSetData {
  let total=0;
  const data=polygons.map(poly=>poly.map(ring=>{total+=ring.length;return inspectRing(ring)}));
  return {total,polygons:data};
}
function freeze<T>(value:T):T {
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
interface PreparedCacheEntry {readonly key:string;readonly prepared:PreparedPhotoGeometry}
let preparedCache:PreparedCacheEntry|null=null;
const preparedKeys=new WeakMap<object,string>();
function sourceGeometryKey(source:ConfirmedPhoto,width:number,height:number):string {
  return JSON.stringify([source.schema_version,source.session_id,source.photo_id,source.result_id,source.candidate_id,
    source.prompt_revision,source.mask_sha256,width,height,source.geometry]);
}
export function preparedPhotoMatchesSource(prepared:PreparedPhotoGeometry,source:ConfirmedPhoto):boolean {
  const width=source?.image?.width,height=source?.image?.height;
  if(!prepared||!Number.isSafeInteger(width)||!Number.isSafeInteger(height))return false;
  try{return preparedKeys.get(prepared)===sourceGeometryKey(source,width as number,height as number);}
  catch{return false;}
}
export function preparePhotoGeometry(source:ConfirmedPhoto):PreparedPhotoGeometry {
  if(!source||source.schema_version!=="confirmed-photo-segmentation-v1"||source.confirmed_by_user!==true||
    source.coordinate_space!==PHOTO_SPACE||source.geometry?.type!=="MultiPolygon")
    reject("PHOTO_SPACE","未找到有效的照片确认结果，请返回重新确认分割");
  const width=source.image?.width,height=source.image?.height;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>12000000)
    reject("PHOTO_SIZE","原照片尺寸无效，请重新上传分析");
  const raw=source.geometry.coordinates;
  if(!Array.isArray(raw))reject("INVALID_POLYGON","照片轮廓数据无效");
  if(raw.length>1024)reject("COMPLEXITY","病灶片区过多，暂不能完整放置；原分割结果已保留");
  let key:string;
  try{key=sourceGeometryKey(source,width as number,height as number);}
  catch{reject("INVALID_POLYGON","照片轮廓数据无效");}
  if(preparedCache?.key===key)return preparedCache.prepared;
  let count=0;
  const polygons=raw.map(poly=>{
    if(!Array.isArray(poly)||poly.length>4096)return reject("INVALID_POLYGON","照片轮廓数据无效");
    return poly.map(ring=>{
      if(!Array.isArray(ring))return reject("INVALID_RING","照片边界数据无效");
      count+=ring.length;
      if(count>MAX_PLACEMENT_VERTICES)reject("COMPLEXITY",`病灶边界超过${MAX_PLACEMENT_VERTICES}点，暂不能完整放置；原分割结果已保留`);
      return ring.map(p=>{
        if(!Array.isArray(p)||p.length!==2||!p.every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1))
          return reject("PHOTO_POINT","照片坐标必须在原图范围内");
        return {x:p[0],y:p[1]};
      });
    });
  });
  const vertexCount=validatePolygons(polygons).total;
  const bounds=boundsOf(polygons.flatMap(poly=>poly[0]).map(p=>({x:p.x*width,y:p.y*height})));
  const prepared=freeze({coordinateSpace:PHOTO_SPACE,width,height,polygons,vertexCount,bounds,
    center:{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}});
  preparedKeys.set(prepared,key);preparedCache={key,prepared};return prepared;
}
export function initialPlacement(photo:PreparedPhotoGeometry,model:BodyModelConfig,region?:BodyRegion|null):PlacementTransform {
  if(region&&(region.view!==model.view||!model.regions.some(r=>r.id===region.id)))reject("VIEW","当前部位与人体视图不一致");
  const body=boundsOf(model.hitOutline.map(p=>({x:p.x/model.logicalWidth,y:p.y/model.logicalHeight})));
  const b=region?.bounds||(body.width>0&&body.height>0?body:{x:0,y:0,width:1,height:1});
  // Visible, explicit edit baseline, not physical scale or a fit-to-body correction.
  const baseScale=Math.min(b.width*model.logicalWidth/photo.bounds.width,b.height*model.logicalHeight/photo.bounds.height)*.35;
  return {target:{templateId:model.id,templateVersion:model.version,geometryId:model.geometryId,regionSetId:model.regionSetId,view:model.view},
    translation:{x:b.x+b.width/2,y:b.y+b.height/2},photoCenter:{...photo.center},baseScale,scale:1,rotationDegrees:0};
}
/** Shared scalar validation/math for preview and final geometry; no vertex traversal. */
export function placementSimilarity(photo:PreparedPhotoGeometry,t:PlacementTransform,model:BodyModelConfig):{c:number;s:number;k:number} {
  if(!t||!t.target||t.target.templateId!==model.id||t.target.templateVersion!==model.version||t.target.geometryId!==model.geometryId||
    t.target.regionSetId!==model.regionSetId)reject("TEMPLATE","人体模板版本不匹配，请重新进入放置页面");
  if(t.target.view!==model.view)reject("VIEW","人体视图不匹配，请重新进入放置页面");
  if(photo.coordinateSpace!==PHOTO_SPACE||!finitePoint(t.translation)||!finitePoint(t.photoCenter)||
    t.photoCenter.x<0||t.photoCenter.x>photo.width||t.photoCenter.y<0||t.photoCenter.y>photo.height||
    ![t.baseScale,t.scale,t.rotationDegrees,model.logicalWidth,model.logicalHeight].every(Number.isFinite)||
    t.baseScale<=0||t.baseScale>1e6||t.scale<MIN_PLACEMENT_SCALE||t.scale>MAX_PLACEMENT_SCALE||
    t.rotationDegrees< -180||t.rotationDegrees>180||model.logicalWidth<=0||model.logicalHeight<=0)
    reject("TRANSFORM","位置、大小或角度参数异常，请重置调整");
  const rad=t.rotationDegrees*Math.PI/180;
  return {c:Math.cos(rad),s:Math.sin(rad),k:t.baseScale*t.scale};
}
export function transformPhotoPolygonToBody(photo:PreparedPhotoGeometry,t:PlacementTransform,model:BodyModelConfig):BodyMultiPolygon {
  const {c,s,k}=placementSimilarity(photo,t,model);
  const coordinates=photo.polygons.map(poly=>poly.map(r=>r.map(p=>{
    const x=(p.x*photo.width-t.photoCenter.x)*k,y=(p.y*photo.height-t.photoCenter.y)*k;
    const q={x:t.translation.x+(c*x-s*y)/model.logicalWidth,y:t.translation.y+(s*x+c*y)/model.logicalHeight};
    if(!finitePoint(q))reject("TRANSFORM","变换数值超出可处理范围，请重置调整");return q;
  })));
  return {type:"MultiPolygon",coordinateSpace:BODY_SPACE,coordinates};
}
export function placementBounds(geometry:BodyMultiPolygon):NormalizedRect {
  return boundsOf(geometry.coordinates.flatMap(poly=>poly[0]));
}
function validateBodyContainment(modelOrBody:BodyModelConfig|BodyGeometry,data:PolygonSetData):PlacementValidation {
  try {
    const body=Array.isArray(modelOrBody)?modelOrBody as BodyGeometry:bodyGeometry(modelOrBody as BodyModelConfig);
    const boundaries=body.flatMap(part=>[part.outer,...part.holes]).flatMap(edges);
    const boundaryIndex=bodyBoundaryIndex(body);
    const outside=()=>fail("OUTSIDE_BODY","部分病灶范围超出人体，请调整位置或大小。");
    if(!body.length)return outside();
    for(const poly of data.polygons){
      if(!pointInBody(polygonInteriorData(poly),body))return outside();
      for(const ring of poly)for(const [a,b]of ring.edges){
        const candidates=boundaryIndex?bodyBoundariesForSegment(a,b,boundaryIndex,boundaries):boundaries;
        if([a,b,...intervals(a,b,candidates)].some(p=>!pointInBody(p,body)))return outside();
      }
      // An excluded body hole may be fully enclosed without crossing lesion edges.
      // Allow the lesion's own holes to cover it; only filled lesion pixels are tested.
      const lesionEdges=poly.flatMap(ring=>ring.edges);
      for(const part of body)for(const hole of part.holes){
        if(pointInPolygonData(polygonInteriorData([inspectRing(hole)]),poly)===1)return outside();
        for(const [a,b]of edges(hole))if(intervals(a,b,lesionEdges).some(p=>pointInPolygonData(p,poly)===1))return outside();
      }
    }
    return {ok:true};
  }catch(error){
    if(error instanceof PlacementError)return fail(error.code,error.message);
    return fail("INVALID_GEOMETRY","病灶轮廓数据无法校验，请返回重新确认分割");
  }
}
/** Full validation for untrusted or newly clipped geometry. */
export function validatePlacementGeometry(geometry:BodyMultiPolygon,modelOrBody:BodyModelConfig|BodyGeometry):PlacementValidation {
  try{
    if(!geometry||geometry.type!=="MultiPolygon"||geometry.coordinateSpace!==BODY_SPACE)
      return fail("BODY_SPACE","病灶坐标空间不正确，不能保存到人体标注");
    const data=validatePolygons(geometry.coordinates);
    return validateBodyContainment(modelOrBody,data);
  }catch(error){
    if(error instanceof PlacementError)return fail(error.code,error.message);
    return fail("INVALID_GEOMETRY","病灶轮廓数据无法校验，请返回重新确认分割");
  }
}
/**
 * Geometry produced by a positive uniform scale + rotation from a validated
 * PreparedPhotoGeometry keeps its internal topology. This path still performs
 * every body-surface test but avoids repeating the quadratic ring topology pass.
 */
export function validateTransformedPlacementGeometry(geometry:BodyMultiPolygon,modelOrBody:BodyModelConfig|BodyGeometry):PlacementValidation {
  try{
    if(!geometry||geometry.type!=="MultiPolygon"||geometry.coordinateSpace!==BODY_SPACE)
      return fail("BODY_SPACE","病灶坐标空间不正确，不能保存到人体标注");
    const data=inspectPolygons(geometry.coordinates);
    return validateBodyContainment(modelOrBody,data);
  }catch(error){
    if(error instanceof PlacementError)return fail(error.code,error.message);
    return fail("INVALID_GEOMETRY","病灶轮廓数据无法校验，请返回重新确认分割");
  }
}
