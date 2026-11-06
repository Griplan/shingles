import {ConfirmedPhoto} from "../types/ai";
import {AnnotationToken} from "../types/annotation";
import {BodyView} from "../types/dermatome";
import {BodyMultiPolygon,PlacementTransform,PreparedPhotoGeometry} from "../types/placement";
import {getBodyModel} from "../data/body-models";
import {annotationSession,AnnotationSessionStore,sessionToken} from "./annotation-session";
import {initialPlacement,placementSimilarity,preparePhotoGeometry,transformPhotoPolygonToBody,validatePlacementGeometry} from "../utils/placement-geometry";

interface Validation {readonly ok:boolean;readonly code?:string;readonly message?:string}
export interface PlacementDraft {
 readonly id:string;readonly revision:number;readonly view:BodyView;readonly regionId:string;
 readonly source:ConfirmedPhoto;readonly prepared:PreparedPhotoGeometry;
 readonly transform:PlacementTransform;readonly initial:PlacementTransform;readonly geometry:BodyMultiPolygon;
 /** Geometry is the last settled preview, never the in-flight transform's authority. */
 readonly geometryRevision:number;
 readonly validation:Validation;readonly token:AnnotationToken;readonly phase:"adjusting"|"confirmed";
 readonly editTarget?:{readonly id:string;readonly placementId:string};
}
type Result={ok:true;draft:PlacementDraft}|{ok:false;message:string};
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
function freeze<T>(v:T):T {if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
let sequence=0;
/** 仅一份放置草稿；正式标注始终由 AnnotationSessionStore 拥有。 */
export class PlacementSessionStore {
 private draft:PlacementDraft|null=null;private owner=0;private currentSource:()=>boolean=()=>false;
 constructor(private annotations:AnnotationSessionStore=annotationSession,private now:()=>number=Date.now){}
 /** Re-edit saved body geometry without reading or extending the temporary photo service. */
 edit(annotationId:string):Result {
  try{
   const s=this.annotations.snapshot(),p=s&&[...s.views.front.completed,...s.views.back.completed].find(v=>v.id===annotationId);
   if(!s||!p||p.source?.kind!=="ai_assisted"||!p.geometry)throw Error("没有可调整的AI标注，请返回重新选择");
   const regionId=p.navigation.entryRegionId||"",source=p.source.photo,prepared=preparePhotoGeometry(source);
   const model=getBodyModel(p.view),transform=clone(p.source.transform),geometry=transformPhotoPolygonToBody(prepared,transform,model);
   if(JSON.stringify(geometry)!==JSON.stringify(p.geometry))throw Error("已保存轮廓与来源不一致，不能重新放置");
   const validation=validatePlacementGeometry(geometry,model);if(!validation.ok)throw Error(validation.message);
   const opened=this.annotations.openPlacement(p.view,regionId);if(!opened.ok)throw Error(opened.message);
   this.owner++;this.currentSource=()=>true;
   this.draft=freeze({id:`placement-${this.now().toString(36)}-${++sequence}`,revision:0,view:p.view,regionId,
    source,prepared,transform,initial:clone(transform),geometry,geometryRevision:0,validation,
    token:sessionToken(opened.session),phase:"adjusting",editTarget:{id:p.id,placementId:p.source.placementId}});
   return {ok:true,draft:this.draft};
  }catch(e){return {ok:false,message:(e as Error).message||"无法重新调整该标注"};}
 }
 open(source:ConfirmedPhoto,view:BodyView,regionId:string,stillCurrent:()=>boolean):Result {
  try {
   if(!source||!Number.isFinite(source.expires_at)||!stillCurrent()||source.expires_at*1000<=this.now())throw Error("照片分析已过期，请返回重新上传或分析");
   if(this.draft?.source.session_id===source.session_id&&this.draft.source.result_id===source.result_id&&
     this.draft.source.candidate_id===source.candidate_id&&this.draft.source.confirmed_at===source.confirmed_at&&
     this.draft.view===view&&this.draft.regionId===regionId){
    this.currentSource=stillCurrent;
    const d=this.draft,s=this.annotations.read(d.token.sessionId);
    const deleted=d.phase==="confirmed"&&s.ok&&!s.session.views[d.view].completed.some(p=>p.source?.kind==="ai_assisted"&&p.source.placementId===d.id);
    if(!deleted)return this.read(d.id);
   }
   const model=getBodyModel(view),region=model.regions.find(r=>r.id===regionId);
   if(!region)throw Error("所选人体部位与视图不一致，请返回重新选择");
   const s=this.annotations.snapshot();
   if(s&&(s.views.front.draft?.vertices.length||s.views.back.draft?.vertices.length))throw Error("请先在手动标注页处理未闭合草稿，再放置识别范围");
   const prepared=preparePhotoGeometry(source),transform=initialPlacement(prepared,model,region);
   const geometry=transformPhotoPolygonToBody(prepared,transform,model),validation=validatePlacementGeometry(geometry,model);
   const opened=this.annotations.openPlacement(view,regionId);if(!opened.ok)throw Error(opened.message);
   if(opened.session.currentView!==view)throw Error("请先处理原有人体标注草稿");
   this.owner++;this.currentSource=stillCurrent;
   this.draft=freeze({id:`placement-${this.now().toString(36)}-${++sequence}`,revision:0,view,regionId,
    source:clone(source),prepared,transform,initial:clone(transform),geometry,geometryRevision:0,validation,token:sessionToken(opened.session),phase:"adjusting"});
   return {ok:true,draft:this.draft};
  }catch(e){return {ok:false,message:(e as Error).message||"无法读取照片分割范围，请返回重新确认"};}
 }
 read(id:string,owner?:number):Result {
  const d=this.draft;
  if(!d||d.id!==id||(owner!==undefined&&owner!==this.owner))return {ok:false,message:"本次放置已失效，请返回照片页重新进入"};
  if(d.phase!=="confirmed"&&!d.editTarget&&(!this.currentSource()||d.source.expires_at*1000<=this.now()))return {ok:false,message:"照片分析已过期或已更换，请返回重新上传或确认"};
  const s=this.annotations.read(d.token.sessionId);if(!s.ok)return s;
  if(d.editTarget&&d.phase!=="confirmed"&&!s.session.views[d.view].completed.some(p=>p.id===d.editTarget?.id&&p.source?.kind==="ai_assisted"&&p.source.placementId===d.editTarget.placementId))
   return {ok:false,message:"原AI标注已变化或删除，请返回重新选择"};
  if(d.phase==="confirmed"&&!s.session.views[d.view].completed.some(p=>p.source?.kind==="ai_assisted"&&p.source.placementId===d.id))
   return {ok:false,message:"该人体标注已删除，请返回照片页重新放置"};
  if(d.phase!=="confirmed"&&(s.session.revision!==d.token.revision||s.session.currentView!==d.view))
   return {ok:false,message:"人体标注会话已变化，请返回照片页重新进入；已有标注仍保留"};
  return {ok:true,draft:d};
 }
 acquire(id:string):number|null {if(!this.read(id).ok)return null;return ++this.owner;}
 hasPendingSource(source:ConfirmedPhoto|null):boolean {const d=this.draft;return !!source&&!!d&&d.phase==="adjusting"&&d.source.session_id===source.session_id&&d.source.result_id===source.result_id&&d.source.candidate_id===source.candidate_id&&this.read(d.id).ok;}
 release(id:string,owner:number):void {if(this.draft?.id===id&&owner===this.owner)this.owner++;}
 update(id:string,owner:number,transform:PlacementTransform,complete:boolean):Result {
  const r=this.read(id,owner);if(!r.ok)return r;if(r.draft.phase==="confirmed")return {ok:false,message:"位置已确认，可在原标注页查看或删除"};
  try {
   const d=r.draft,model=getBodyModel(d.view);
   placementSimilarity(d.prepared,transform,model);
   const same=JSON.stringify(transform)===JSON.stringify(d.transform);
   if(same&&(!complete||d.geometryRevision===d.revision))return r;
   const revision=d.revision+1;
   const geometry=complete?transformPhotoPolygonToBody(d.prepared,transform,model):d.geometry;
   const validation:Validation=complete?validatePlacementGeometry(geometry,model):{ok:false,code:"ADJUSTING"};
   this.draft=freeze({...d,revision,transform:clone(transform),geometry,geometryRevision:complete?revision:d.geometryRevision,validation});
   return {ok:true,draft:this.draft};
  }catch(e){return {ok:false,message:(e as Error).message||"调整参数无效，请重试"};}
 }
 reset(id:string,owner:number):Result {const r=this.read(id,owner);return r.ok?this.update(id,owner,r.draft.initial,true):r;}
 confirm(id:string,owner:number):Result {
  const r=this.read(id,owner);if(!r.ok||r.draft.phase==="confirmed")return r;
  const d=r.draft;
  if(d.geometryRevision!==d.revision)return {ok:false,message:"请先结束调整，检查范围后再确认位置"};
  const result=this.annotations.commitPlacement(d.token,{placementId:d.id,entryRegionId:d.regionId,source:d.source,transform:d.transform,geometry:d.geometry,editTarget:d.editTarget});
  if(!result.ok)return result;
  this.draft=freeze({...d,phase:"confirmed",validation:{ok:true}});return {ok:true,draft:this.draft};
 }
 discard(id:string,owner:number):void {if(this.draft?.id===id&&owner===this.owner&&this.draft.phase!=="confirmed"){this.owner++;this.draft=null;}}
 invalidateSource(photoSessionId:string):void {if(this.draft?.source.session_id===photoSessionId&&this.draft.phase!=="confirmed"&&!this.draft.editTarget){this.owner++;this.draft=null;}}
}
export const placementSession=new PlacementSessionStore();
