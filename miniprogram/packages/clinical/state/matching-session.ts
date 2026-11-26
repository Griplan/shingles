import { annotationSession,modelBasis,sameBasis } from "../../../state/annotation-session";
import { AnnotationSession,CompletedPolygon } from "../../../types/annotation";
import { EvaluateLesion,EvaluateRequest,EvaluateResponse,MatchingIdentity } from "../../../types/evaluate";
import { BODY_SPACE } from "../../../types/placement";
import { ATLAS_MANIFEST as M,ATLAS_REGIONS } from "../data/atlas.generated";
import { MATCHING_BODY_SHA256 } from "../data/matching-body.generated";
import { getBodyModel } from "../../../data/body-models";
import { evaluateAnnotations } from "../../../services/api";
import {checkedResponse} from "../../../utils/matching-guards";
export {checkedResponse,identityEqual} from "../../../utils/matching-guards";
export {coverageText} from "../../../utils/matching-text";

export function matchingIdentity():MatchingIdentity {
 return {template_id:M.templateId,template_version:M.templateVersion,geometry_id:M.geometryId,
  region_set_id:getBodyModel("front").regionSetId,atlas_id:"goran-2022",atlas_version:M.atlasVersion,
  atlas_content_sha256:M.contentSHA256,body_content_sha256:MATCHING_BODY_SHA256,coordinate_system:"normalized_2d_top_left"};
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
 if(p.source?.kind==="ai_assisted")throw new Error("图片标注缺少完整人体轮廓，请重新确认位置");
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
  try{const raw=await this.send(request);if(!current()){this.refresh();return;}const response=checkedResponse(raw,request,ATLAS_REGIONS);
   this.state={status:"ready",message:"",response,snapshot};
  }catch(e){if(current())this.state={status:"error",message:(e as Error).message||"计算失败，可重试；标注仍保留",response:null,snapshot};}
 }
}
export const matchingSession=new MatchingSessionStore(()=>annotationSession.snapshot(),evaluateAnnotations);
