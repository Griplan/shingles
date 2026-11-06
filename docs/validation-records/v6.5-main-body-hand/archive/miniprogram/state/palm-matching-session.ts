import {PalmModel,PalmSession,LocalSurfaceView} from "../types/palm";
import {EvaluateRequest,EvaluateResponse} from "../types/evaluate";
import {getLocalModel} from "../data/local-models";
import {palmSession} from "./palm-session";
import {checkedResponse,identityEqual} from "./matching-session";
import {modelBasis,sameBasis} from "./annotation-session";
import {evaluateAnnotations} from "../services/api";
import {canMatchReference} from "../config/development";
export interface PalmMatchState {status:"idle"|"loading"|"ready"|"stale"|"error";message:string;response:EvaluateResponse<LocalSurfaceView>|null}
export function palmSnapshotKey(s:PalmSession|null,model:PalmModel):string {
 if(!s||s.view!==model.view||!sameBasis(s.basis,modelBasis(model))||!identityEqual(s.atlasIdentity,model.atlas.identity))throw Error("当前部位会话或模板已变化，请重新进入");
 if(s.state.draft?.vertices.length)throw Error("请先闭合或取消当前草稿");
 if(!s.state.completed.length)throw Error("请先完成一片有效标注");
 for(const p of s.state.completed)if(p.view!==s.view||!sameBasis(p.basis,s.basis)||!identityEqual(p.atlasIdentity,s.atlasIdentity)||!p.geometry)throw Error("标注与当前部位身份不一致");
 return JSON.stringify([s.sessionId,s.view,s.basis,s.atlasIdentity,s.state.completed]);
}
/** Same HTTP/response guard and geometry backend as V4; local view owns stale-response guard. */
export class PalmMatchingStore {
 private sequence=0;private key="";private state:PalmMatchState={status:"idle",message:"",response:null};
 constructor(private readonly read:()=>PalmSession|null,private readonly model:()=>PalmModel,
  private readonly send:(q:EvaluateRequest<LocalSurfaceView>)=>Promise<unknown>=evaluateAnnotations,private readonly allowed:()=>boolean=canMatchReference){}
 refresh():PalmMatchState {
  try{
   const key=palmSnapshotKey(this.read(),this.model());
   if(key!==this.key){const had=!!this.key;this.key=key;this.sequence++;this.state={status:had?"stale":"idle",message:had?"标注已变化，请重新计算":"",response:null};}
  }catch(e){this.sequence++;this.key="";this.state={status:"idle",message:(e as Error).message,response:null};}
  if(!this.model().atlas.technicalReady){this.sequence++;this.state={status:"idle",message:this.model().atlas.blockedReason,response:null};}
  return this.state;
 }
 cancelPending():void {if(this.state.status==="loading"){this.sequence++;this.state={status:"idle",message:"请求已停止接收，标注已保留",response:null};}}
 async calculate():Promise<void> {
  const existing=this.refresh(),model=this.model(),s=this.read();if(existing.status==="loading")return;
  if(!model.atlas.technicalReady||!s)return;
  if(!this.allowed()){this.state={status:"error",message:"当前环境不允许参考匹配，标注已保留",response:null};return;}
  if(s.phase!=="review"){this.state={status:"error",message:"请先确认标注范围",response:null};return;}
  let key:string;try{key=palmSnapshotKey(s,model);}catch(e){this.state={status:"error",message:(e as Error).message,response:null};return;}
  const seq=++this.sequence,request:EvaluateRequest<LocalSurfaceView>={request_id:`palm-match-${Date.now().toString(36)}-${seq}`,annotation_revision:s.revision,
   identity:s.atlasIdentity,lesions:s.state.completed.map(p=>({id:p.id,view:p.view,source:"manual",geometry:p.geometry!}))};
  this.state={status:"loading",message:"正在计算参考对应…",response:null};
  const current=()=>{try{return seq===this.sequence&&this.read()?.phase==="review"&&this.allowed()&&key===palmSnapshotKey(this.read(),this.model())&&this.model().atlas.technicalReady;}catch{return false;}};
  try{const raw=await this.send(request);if(!current()){if(seq===this.sequence)this.cancelPending();this.refresh();return;}
   this.state={status:"ready",message:"",response:checkedResponse(raw,request,model.atlas.regions)};
  }catch(e){
   if(current())this.state={status:"error",message:(e as Error).message||"计算失败，标注已保留",response:null};
   else if(seq===this.sequence){this.cancelPending();this.refresh();}
  }
 }
}
const stores:Partial<Record<LocalSurfaceView,PalmMatchingStore>>={};
export const palmMatching={forView(view:LocalSurfaceView):PalmMatchingStore {
 return stores[view]||(stores[view]=new PalmMatchingStore(()=>palmSession.snapshot(view),()=>getLocalModel(view)));
}};
