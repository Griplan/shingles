import {LocalSurfaceView} from "../types/dermatome";
import {PalmAnnotation,PalmModel,PalmResult,PalmSession,PalmToken} from "../types/palm";
import {getLocalModel,isLocalSurfaceView} from "../data/local-models";
import {modelBasis,sameBasis,MAX_REGIONS_PER_VIEW} from "./annotation-session";
import {identityEqual} from "./matching-session";
import {editManualView,ManualAction} from "../utils/manual-annotation";
import {BODY_SPACE} from "../types/placement";
export type PalmAction=ManualAction|{type:"review"}|{type:"edit"};
function freeze<T>(v:T):T {if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
let sequence=0;
const id=(kind:string)=>`palm-${kind}-${Date.now().toString(36)}-${++sequence}`;
const fail=(message:string):PalmResult=>({ok:false,message});
export function palmToken(s:PalmSession):PalmToken{return {sessionId:s.sessionId,view:s.view,revision:s.revision,basis:s.basis,atlasIdentity:s.atlasIdentity};}
/** Independent authoritative local-surface sessions. Never touches the front/back singleton. */
export class PalmSessionStore {
 private sessions:Partial<Record<LocalSurfaceView,PalmSession>>={};
 constructor(private readonly modelFor:(view:LocalSurfaceView)=>PalmModel=getLocalModel){}
 snapshot(view:LocalSurfaceView):PalmSession|null{return this.sessions[view]||null;}
 read(view:LocalSurfaceView,sessionId:string):PalmResult {
  if(!isLocalSurfaceView(view))return fail("未知当前部位视图");
  const s=this.sessions[view];if(!s||s.sessionId!==sessionId)return fail("当前部位标注会话已结束，请返回重新选择");
  const model=this.modelFor(view);
  if(!sameBasis(s.basis,modelBasis(model))||!identityEqual(s.atlasIdentity,model.atlas.identity))
   return fail("当前部位模板或图谱版本已变化，原标注已保留，不能自动迁移");
  return {ok:true,session:s};
 }
 open(view:LocalSurfaceView):PalmResult {
  if(!isLocalSurfaceView(view))return fail("未知当前部位视图");
  const old=this.sessions[view];if(old)return this.read(view,old.sessionId);
  const model=this.modelFor(view),basis=modelBasis(model);
  const session:PalmSession=freeze({schemaVersion:1,sessionId:id("session"),view,basis,atlasIdentity:model.atlas.identity,phase:"editing",revision:0,
   state:{completed:[],draft:{id:id("region"),view,vertices:[],navigation:{entryRegionId:view}},selectedId:null,focusRegionId:null}});
  this.sessions[view]=session;return {ok:true,session};
 }
 dispatch(token:PalmToken,action:PalmAction):PalmResult {
  const found=this.read(token.view,token.sessionId);if(!found.ok)return found;
  const s=found.session,model=this.modelFor(s.view);
  if(token.revision!==s.revision||!sameBasis(token.basis,s.basis)||!identityEqual(token.atlasIdentity,s.atlasIdentity))return fail("操作已过期，请在当前当前部位重试");
  if(s.phase==="review"&&action.type!=="edit")return fail("确认范围为只读，请先返回修改");
  let state=s.state,phase=s.phase;
  if(action.type==="review"){
   if(!state.completed.length)return fail("请先闭合至少一片有效范围");
   if(state.draft?.vertices.length)return fail("请先闭合或取消当前草稿");
   state={...state,draft:null};phase="review";
  }else if(action.type==="edit")phase="editing";
  else{
   const changed=editManualView(state,s.view,model.body,action,()=>id("region"),MAX_REGIONS_PER_VIEW);
   if(!changed.ok)return changed;
   // Full geometry plus identity are attached once at close, preserving old immutable records.
   const completed=changed.state.completed.map(p=>{
    const old=state.completed.find(v=>v.id===p.id);if(old)return old;
    const annotation:PalmAnnotation={...p,basis:s.basis,atlasIdentity:s.atlasIdentity,source:{kind:"manual"},
     geometry:{type:"MultiPolygon",coordinateSpace:BODY_SPACE,coordinates:[[p.ring]]}};
    return annotation;
   });
   state={...changed.state,completed};
  }
  const next=freeze({...s,state,phase,revision:s.revision+1});this.sessions[s.view]=next;
  return {ok:true,session:next};
 }
}
export const palmSession=new PalmSessionStore();
