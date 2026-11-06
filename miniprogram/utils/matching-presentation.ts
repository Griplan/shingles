import { AtlasRegion } from "../types/atlas";
import { MatchCandidate } from "../types/evaluate";
import { BodyView, SurfaceView, ViewportTransform } from "../types/dermatome";
import { normalizedToCanvas } from "./coordinate";
import { coverageText } from "../state/matching-session";

export interface CandidateLabel {
 id:string; name:string; label:string; side:string; color:string; ratio:string; y:number;
}
export interface PlacedLabel extends CandidateLabel { top:number }
export interface LabelRail { items:PlacedLabel[]; height:number; overflow:boolean }
export const LABEL_HEIGHT=44, LABEL_GAP=4, RAIL_HEADER=24, RAIL_FOOTER=20;
export const sideName=(side:string):string=>side==="left"?"人体左侧":side==="right"?"人体右侧":"未指定侧别";
export function screenSide(side:string,view:BodyView):"left"|"right"|"unspecified" {
 if(side!=="left" && side!=="right")return "unspecified";
 return view==="front"?(side==="left"?"right":"left"):side;
}
/** 只认响应实例ID及完整身份；不按标签猜测、丢弃缺失片或截取top-k。 */
export function candidateRegions<V extends SurfaceView>(candidate:MatchCandidate<V>,regions:readonly AtlasRegion<V>[],view:V):AtlasRegion<V>[] {
 const found=candidate.region_ids.map(id=>regions.find(r=>r.id===id));
 if(candidate.view!==view || !found.length || found.some(r=>!r || r.view!==view || r.side!==candidate.side ||
   r.partitionType!==candidate.partition_type || r.labelId!==candidate.label))
  throw new Error("响应实例与本地图谱不一致，已停止全部高亮，请更新数据或重试");
 return found as AtlasRegion<V>[];
}
const prepared=new WeakMap<readonly MatchCandidate[],{source:readonly AtlasRegion[];view:BodyView;labels:CandidateLabel[];all:AtlasRegion[];single:Map<string,AtlasRegion[]>}>();
export function presentation(candidates:readonly MatchCandidate[],regions:readonly AtlasRegion[],view:BodyView,selected:string) {
 const cached=prepared.get(candidates);
 if(cached?.source===regions && cached.view===view)return {labels:cached.labels,regions:selected?cached.single.get(selected)||[]:cached.all};
 const all=new Map<string,AtlasRegion>(),single=new Map<string,AtlasRegion>();
 const byCandidate=new Map<string,AtlasRegion[]>();
 const labels=candidates.map(c=>{
  const parts=candidateRegions(c,regions,view);
  byCandidate.set(c.candidate_id,[...new Map(parts.map(r=>[r.id,r])).values()]);
  for(const r of parts){all.set(r.id,r);if(c.candidate_id===selected)single.set(r.id,r);}
  // 这里只决定文字的纵向布局，不作为连线锚点或命中数据。
  const ys=parts.flatMap(r=>r.geometry.coordinates.flatMap(p=>p[0].map(v=>v[1])));
  return {id:c.candidate_id,name:c.display_name,label:c.label,side:c.side,
   color:parts[0].color,ratio:coverageText(c.lesion_coverage_ratio),y:(Math.min(...ys)+Math.max(...ys))/2};
 });
 prepared.set(candidates,{source:regions,view,labels,all:[...all.values()],single:byCandidate});
 return {labels,regions:[...(selected?single:all).values()]};
}
/** 按实际视口投影高度排列。空间足够时靠近人体部位；拥挤时有序独立滚动，全部可访问。 */
export function placeLabels(labels:readonly CandidateLabel[],height:number,viewport:ViewportTransform|null):LabelRail {
 const sorted=[...labels].sort((a,b)=>a.y-b.y || a.id.localeCompare(b.id));
 const needed=sorted.length*(LABEL_HEIGHT+LABEL_GAP)-LABEL_GAP;
 const overflow=needed>height;
 let previous=-LABEL_HEIGHT-LABEL_GAP;
 const items=sorted.map((label,i)=>{
  const y=viewport?normalizedToCanvas({x:.5,y:label.y},viewport).y-RAIL_HEADER:label.y*height;
  const top=overflow?i*(LABEL_HEIGHT+LABEL_GAP):Math.max(previous+LABEL_HEIGHT+LABEL_GAP,Math.min(height-LABEL_HEIGHT,Math.max(0,y-LABEL_HEIGHT/2)));
  previous=top;return {...label,top};
 });
 if(!overflow){
  let next=height+LABEL_GAP;
  for(let i=items.length-1;i>=0;i--){items[i].top=Math.min(items[i].top,next-LABEL_HEIGHT-LABEL_GAP);next=items[i].top;}
 }
 return {items,height:Math.max(height,needed),overflow};
}
export function stageHeight(windowHeight:number):number {
 return Math.max(320,Math.min(460,windowHeight-240));
}
