import { annotationSession,modelBasis,sameBasis } from "./annotation-session";
import { AnnotationSession,CompletedPolygon } from "../types/annotation";
import { EvaluateLesion,EvaluateRequest,EvaluateResponse,MatchingIdentity } from "../types/evaluate";
import {SurfaceView} from "../types/dermatome";
import {AtlasRegion} from "../types/atlas";
import { BODY_SPACE } from "../types/placement";
import { ATLAS_MANIFEST as M,ATLAS_REGIONS } from "../data/atlas.generated";
import { MATCHING_BODY_SHA256 } from "../data/matching-body.generated";
import { getBodyModel } from "../data/body-models";
import { evaluateAnnotations } from "../services/api";

export function matchingIdentity():MatchingIdentity {
 return {template_id:M.templateId,template_version:M.templateVersion,geometry_id:M.geometryId,
  region_set_id:getBodyModel("front").regionSetId,atlas_id:"goran-2022",atlas_version:M.atlasVersion,
  atlas_content_sha256:M.contentSHA256,body_content_sha256:MATCHING_BODY_SHA256,coordinate_system:"normalized_2d_top_left"};
}
export function identityEqual(a:MatchingIdentity,b:MatchingIdentity):boolean {
 return !!a && Object.keys(b).every(k=>a[k as keyof MatchingIdentity]===b[k as keyof MatchingIdentity]);
}
function frozen<T>(value:T):T {
 if(value && typeof value==="object"){Object.values(value).forEach(frozen);Object.freeze(value);}return value;
}
/** Wire data is deliberately limited to body geometry; no photo, prompts, mask or credentials. */
export function lesionForMatching(p:CompletedPolygon):EvaluateLesion {
 const base={id:p.id,view:p.view,source:p.source?.kind||"manual" as const};
 if(p.geometry){
  if(p.geometry.type!=="MultiPolygon"||p.geometry.coordinateSpace!==BODY_SPACE)
   throw new Error("匹配只接受已确认的人体坐标，照片坐标不能提交");
  return {...base,geometry:p.geometry};
 }
 if(p.source?.kind==="ai_assisted")throw new Error("AI标注缺少完整人体轮廓，请重新确认位置");
 return {...base,vertices:p.ring};
}
export function snapshotKey(s:AnnotationSession|null,identity:MatchingIdentity):string {
 if(!s)throw new Error("本次标注会话已结束，请返回选择页");
 if(!sameBasis(s.basis,modelBasis(getBodyModel("front"))) || s.basis.templateId!==identity.template_id ||
  s.basis.templateVersion!==identity.template_version || s.basis.geometryId!==identity.geometry_id || s.basis.regionSetId!==identity.region_set_id)
  throw new Error("标注人体版本不一致，请返回编辑检查");
 if(s.views.front.draft || s.views.back.draft)throw new Error("尚有未完成草稿，请返回编辑继续绘制或明确放弃");
 const lesions=[...s.views.front.completed,...s.views.back.completed];
 if(!lesions.length)throw new Error("至少完成一片有效标注才能计算");
 // Geometry identity excludes display revision, phase, focus and selection.
 return JSON.stringify([s.sessionId,s.basis,identity,lesions.map(p=>[p.id,lesionForMatching(p),p.source?.kind==="ai_assisted"?p.source.placementId:null]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}
const validNumber=(n:unknown):n is number=>typeof n==="number" && Number.isFinite(n) && n>=0;
function requireValue(ok:unknown):asserts ok {if(!ok)throw new Error("响应数据或图谱身份不一致，已阻止结果叠加，请更新或重试");}
export function checkedResponse(raw:unknown,request:EvaluateRequest):EvaluateResponse;
export function checkedResponse<V extends SurfaceView>(raw:unknown,request:EvaluateRequest<V>,regions:readonly AtlasRegion<V>[]):EvaluateResponse<V>;
export function checkedResponse(raw:unknown,request:EvaluateRequest<SurfaceView>,regions:readonly AtlasRegion<SurfaceView>[]=ATLAS_REGIONS):EvaluateResponse<SurfaceView> {
 requireValue(raw && typeof raw==="object");const r=raw as EvaluateResponse<SurfaceView>;
 requireValue(r.request_id===request.request_id && r.annotation_revision===request.annotation_revision && identityEqual(r.identity,request.identity));
 requireValue(r.method==="manual_annotation_reference_geometry" && r.area_unit==="normalized_template_area" &&
  r.source?.preview===true && r.source.medical_review_status==="pending" && typeof r.source.attribution==="string" &&
  typeof r.source.coverage_note==="string" && Array.isArray(r.warnings) && r.warnings.every(w=>typeof w==="string"));
 if(request.identity.atlas_id==="axilla-schematic-v1")requireValue(r.source.atlas_type==="SCHEMATIC"&&r.source.review_status==="NOT_MEDICALLY_VALIDATED"&&r.source.intended_use==="INTERACTIVE_SIMULATION"&&r.source.source_type==="ARTIFICIALLY_CONSTRUCTED"&&typeof r.source.disclaimer==="string"&&r.source.disclaimer.length>0);
 if(request.identity.atlas_id==="axilla-goran-provisional-v1")requireValue(r.source.atlas_status==="PROVISIONAL"&&r.source.uncertainty_level==="HIGH");
 requireValue(Array.isArray(r.lesions) && r.lesions.length===request.lesions.length && Array.isArray(r.views));
 const expectedViews=[...new Set(request.lesions.map(l=>l.view))].sort();
 requireValue(r.views.map(v=>v.view).sort().join()===expectedViews.join());
 const seen=new Set<string>();
 for(const c of [...r.lesions,...r.views]) {
  requireValue((["front","back","sole-left","sole-right","axilla-left","axilla-right"].includes(c.view) && expectedViews.includes(c.view)) && Array.isArray(c.lesion_ids) && c.lesion_ids.length && new Set(c.lesion_ids).size===c.lesion_ids.length);
  requireValue(c.lesion_ids.every((id:string)=>request.lesions.some(l=>l.id===id && l.view===c.view)));
  requireValue(validNumber(c.annotation_area) && c.annotation_area>0 && validNumber(c.covered_area) && validNumber(c.uncovered_area) &&
   validNumber(c.covered_ratio) && c.covered_ratio<=1+1e-12 && validNumber(c.uncovered_ratio) && c.uncovered_ratio<=1+1e-12 &&
   Math.abs(c.covered_ratio+c.uncovered_ratio-1)<1e-9 && ["full","partial","none"].includes(c.coverage_status));
  requireValue(Array.isArray(c.candidates));const ids=new Set<string>(),keys=new Set<string>();
  for(const m of c.candidates) {
   requireValue(typeof m.candidate_id==="string" && !ids.has(m.candidate_id));ids.add(m.candidate_id);
   const key=JSON.stringify([m.partition_type,m.label,m.side,m.view]);requireValue(!keys.has(key));keys.add(key);
   requireValue(m.view===c.view && typeof m.display_name==="string" && validNumber(m.intersection_area) && m.intersection_area>0 &&
    validNumber(m.lesion_coverage_ratio) && m.lesion_coverage_ratio>0 && m.lesion_coverage_ratio<=1+1e-12 && Array.isArray(m.region_ids) && m.region_ids.length);
   const actual=regions.filter(a=>a.view===m.view && a.side===m.side && a.partitionType===m.partition_type && a.labelId===m.label).map(a=>a.id).sort();
   requireValue(actual.length && JSON.stringify([...m.region_ids].sort())===JSON.stringify(actual));
  }
 }
 for(const c of r.lesions){requireValue(c.lesion_ids.length===1 && !seen.has(c.lesion_ids[0]));seen.add(c.lesion_ids[0]);}
 for(const c of r.views)requireValue(JSON.stringify([...c.lesion_ids].sort())===JSON.stringify(request.lesions.filter(l=>l.view===c.view).map(l=>l.id).sort()));
 return frozen(JSON.parse(JSON.stringify(r)) as EvaluateResponse<SurfaceView>);
}
export type MatchState={status:"idle"|"loading"|"ready"|"stale"|"error";message:string;response:EvaluateResponse|null;snapshot:AnnotationSession|null};
export class MatchingSessionStore {
 private sequence=0;private geometryRevision=0;private key="";
 private state:MatchState={status:"idle",message:"尚未计算",response:null,snapshot:null};
 constructor(private readonly read:()=>AnnotationSession|null,private readonly send:(r:EvaluateRequest)=>Promise<unknown>,
  private readonly identity:()=>MatchingIdentity=matchingIdentity) {}
 refresh():MatchState {
  let key:string;
  try{key=snapshotKey(this.read(),this.identity());}catch(e){const had=!!this.key || this.state.status==="stale";this.sequence++;this.key="";this.state={status:had?"stale":"idle",message:(e as Error).message,response:null,snapshot:null};return this.state;}
  if(key!==this.key){const had=!!this.key || this.state.status==="stale";this.key=key;this.geometryRevision++;this.sequence++;
   this.state={status:had?"stale":"idle",message:had?"标注或图谱已变化，请确认范围后点击计算":"尚未计算",response:null,snapshot:null};}
  return this.state;
 }
 cancelPending():void {if(this.state.status==="loading"){this.sequence++;this.state={status:"idle",message:"请求已停止接收，标注保留，可点击计算",response:null,snapshot:null};}}
 async calculate():Promise<void> {
  const state=this.refresh();if(state.status==="loading")return;
  const s=this.read();let key:string;try{key=snapshotKey(s,this.identity());}catch{return;}
  if(!s)return;
  const seq=++this.sequence,snapshot=frozen(JSON.parse(JSON.stringify(s)) as AnnotationSession);
  const request=frozen({request_id:`match-${Date.now().toString(36)}-${seq}`,annotation_revision:this.geometryRevision,
   identity:this.identity(),lesions:[...snapshot.views.front.completed,...snapshot.views.back.completed].map(lesionForMatching)});
  this.state={status:"loading",message:"正在计算几何对应…",response:null,snapshot};
  const current=()=>{let now:string;try{now=snapshotKey(this.read(),this.identity());}catch{return false;}return seq===this.sequence && now===key;};
  try{const raw=await this.send(request);if(!current()){this.refresh();return;}const response=checkedResponse(raw,request);
   this.state={status:"ready",message:"",response,snapshot};
  }catch(e){if(current())this.state={status:"error",message:(e as Error).message||"计算失败，可重试；标注仍保留",response:null,snapshot};}
 }
}
export const matchingSession=new MatchingSessionStore(()=>annotationSession.snapshot(),evaluateAnnotations);
export function coverageText(value:number):string {
 if(value===0)return "0%";if(value===1)return "100%";
 if(value<0.0001)return "<0.01%";if(value>0.9999)return ">99.99%";
 return `${(value*100).toFixed(2)}%`;
}
