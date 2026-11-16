import {ConfirmedPhoto} from "../../../types/ai";
import {AnnotationToken} from "../../../types/annotation";
import {BodyView} from "../../../types/dermatome";
import {BodyMultiPolygon,PlacementTransform,PreparedPhotoGeometry} from "../../../types/placement";
import {getBodyModel} from "../../../data/body-models";
import {annotationSession,AnnotationSessionStore,sessionToken} from "../../../state/annotation-session";
import {initialPlacement,placementSimilarity,preparePhotoGeometry,transformPhotoPolygonToBody,validatePlacementGeometry} from "../../../utils/placement-geometry";

interface Validation {readonly ok:boolean;readonly code?:string;readonly message?:string}
export interface PlacementDraft {
 readonly id:string;readonly revision:number;readonly view:BodyView;readonly regionId:string|null;
 readonly source:ConfirmedPhoto;readonly prepared:PreparedPhotoGeometry;
 readonly transform:PlacementTransform;readonly initial:PlacementTransform;readonly geometry:BodyMultiPolygon;
 /** Exact source transform result; it remains the editable authority after clipping. */
 readonly rawGeometry:BodyMultiPolygon;
 readonly clippedFromGeometry?:BodyMultiPolygon;
 readonly clip?:{readonly method:"body_intersection_v1";readonly outsideAreaRatio:number};
 /** Geometry is the last settled preview, never the in-flight transform's authority. */
 readonly geometryRevision:number;
 readonly validation:Validation;readonly token:AnnotationToken;readonly phase:"adjusting"|"confirmed";
 /** True after the placed geometry is self-contained and no longer needs the temporary photo service. */
 readonly sourceDetached:boolean;
 readonly editTarget?:{readonly id:string;readonly placementId:string};
}
type Result={ok:true;draft:PlacementDraft}|{ok:false;message:string};
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
function freeze<T>(v:T):T {if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
let sequence=0;
/** 仅一份放置草稿；正式标注始终由 AnnotationSessionStore 拥有。 */
export class PlacementSessionStore {
 private draft:PlacementDraft|null=null;private owner=0;private currentSource:()=>boolean=()=>false;
 private settled:Pick<PlacementDraft,"transform"|"validation">|null=null;
 constructor(private annotations:AnnotationSessionStore=annotationSession,private now:()=>number=Date.now){}
 /** Re-edit saved body geometry without reading or extending the temporary photo service. */
 edit(annotationId:string):Result {
  try{
   const s=this.annotations.snapshot(),p=s&&[...s.views.front.completed,...s.views.back.completed].find(v=>v.id===annotationId);
   if(!s||!p||p.source?.kind!=="ai_assisted"||!p.geometry)throw Error("没有可调整的AI标注，请返回重新选择");
   const regionId=p.navigation.entryRegionId||null,source=p.source.photo,prepared=preparePhotoGeometry(source);
   const model=getBodyModel(p.view),transform=clone(p.source.transform),geometry=transformPhotoPolygonToBody(prepared,transform,model);
   if(!p.source.clip&&JSON.stringify(geometry)!==JSON.stringify(p.geometry))throw Error("已保存轮廓与来源不一致，不能重新放置");
   const validation=validatePlacementGeometry(p.geometry,model);if(!validation.ok)throw Error(validation.message);
   const opened=this.annotations.openPlacement(p.view,regionId);if(!opened.ok)throw Error(opened.message);
   this.owner++;this.currentSource=()=>true;
   const clip=p.source.clip,clippedFromGeometry=clip?geometry:undefined;
   this.draft=freeze({id:`placement-${this.now().toString(36)}-${++sequence}`,revision:0,view:p.view,regionId,
    source,prepared,transform,initial:clone(transform),geometry:p.geometry,rawGeometry:geometry,clippedFromGeometry,clip,
    geometryRevision:0,validation,
    token:sessionToken(opened.session),phase:"adjusting",sourceDetached:true,editTarget:{id:p.id,placementId:p.source.placementId}});
   this.settled={transform,validation};
   return {ok:true,draft:this.draft};
  }catch(e){return {ok:false,message:(e as Error).message||"无法重新调整该标注"};}
 }
 open(source:ConfirmedPhoto,view:BodyView,regionId:string|null,stillCurrent:()=>boolean):Result {
  try {
   const same=!!this.draft&&this.draft.source.session_id===source?.session_id&&this.draft.source.result_id===source?.result_id&&
    this.draft.source.candidate_id===source?.candidate_id&&this.draft.source.confirmed_at===source?.confirmed_at&&
    this.draft.view===view&&this.draft.regionId===regionId;
   if(same&&this.draft?.sourceDetached){
    this.currentSource=stillCurrent;
    const d=this.draft,s=this.annotations.read(d.token.sessionId);
    const deleted=d.phase==="confirmed"&&s.ok&&!s.session.views[d.view].completed.some(p=>p.source?.kind==="ai_assisted"&&p.source.placementId===d.id);
    if(!deleted)return this.read(d.id);
   }
   if(!source||!Number.isFinite(source.expires_at)||!stillCurrent()||source.expires_at*1000<=this.now())throw Error("照片分析已过期，请返回重新上传或分析");
   if(this.draft?.source.session_id===source.session_id&&this.draft.source.result_id===source.result_id&&
     this.draft.source.candidate_id===source.candidate_id&&this.draft.source.confirmed_at===source.confirmed_at&&
     this.draft.view===view&&this.draft.regionId===regionId){
    this.currentSource=stillCurrent;
    const d=this.draft,s=this.annotations.read(d.token.sessionId);
    const deleted=d.phase==="confirmed"&&s.ok&&!s.session.views[d.view].completed.some(p=>p.source?.kind==="ai_assisted"&&p.source.placementId===d.id);
    if(!deleted)return this.read(d.id);
   }
   const model=getBodyModel(view),region=regionId?model.regions.find(r=>r.id===regionId):null;
   if(regionId!==null&&!region)throw Error("所选人体部位与视图不一致");
   const s=this.annotations.snapshot();
   if(s&&(s.views.front.draft?.vertices.length||s.views.back.draft?.vertices.length))throw Error("请先在手动标注页处理未闭合草稿，再放置识别范围");
   const prepared=preparePhotoGeometry(source),transform=initialPlacement(prepared,model,region);
   const geometry=transformPhotoPolygonToBody(prepared,transform,model),validation=validatePlacementGeometry(geometry,model);
   const opened=this.annotations.openPlacement(view,regionId);if(!opened.ok)throw Error(opened.message);
   if(opened.session.currentView!==view)throw Error("请先处理原有人体标注草稿");
   this.owner++;this.currentSource=stillCurrent;
   this.draft=freeze({id:`placement-${this.now().toString(36)}-${++sequence}`,revision:0,view,regionId,
    source:clone(source),prepared,transform,initial:clone(transform),geometry,rawGeometry:geometry,geometryRevision:0,validation,token:sessionToken(opened.session),
    phase:"adjusting",sourceDetached:false});
   this.settled={transform,validation};
   return {ok:true,draft:this.draft};
  }catch(e){return {ok:false,message:(e as Error).message||"无法读取照片分割范围，请返回重新确认"};}
 }
 read(id:string,owner?:number):Result {
  const d=this.draft;
  if(!d||d.id!==id||(owner!==undefined&&owner!==this.owner))return {ok:false,message:"本次放置已失效，请返回照片页重新进入"};
  if(d.phase!=="confirmed"&&!d.editTarget&&!d.sourceDetached&&(!this.currentSource()||d.source.expires_at*1000<=this.now()))
   return {ok:false,message:"照片分析已过期或已更换，请返回重新上传或确认"};
  const s=this.annotations.read(d.token.sessionId);if(!s.ok)return s;
  if(d.editTarget&&d.phase!=="confirmed"&&!s.session.views[d.view].completed.some(p=>p.id===d.editTarget?.id&&p.source?.kind==="ai_assisted"&&p.source.placementId===d.editTarget.placementId))
   return {ok:false,message:"原AI标注已变化或删除，请返回重新选择"};
  if(d.phase==="confirmed"&&!s.session.views[d.view].completed.some(p=>p.source?.kind==="ai_assisted"&&p.source.placementId===d.id))
   return {ok:false,message:"该人体标注已删除，请返回照片页重新放置"};
  if(d.phase!=="confirmed"&&(s.session.revision!==d.token.revision||s.session.currentView!==d.view))
   return {ok:false,message:"人体标注会话已变化，请返回照片页重新进入；已有标注仍保留"};
  return {ok:true,draft:d};
 }
 /** Mark copied photo geometry as self-contained before the temporary service source is released. */
 detachSource(id:string):Result {
  const r=this.read(id);if(!r.ok)return r;const d=r.draft;
  if(d.phase==="confirmed")return r;
  if(!d.sourceDetached){const next=freeze({...d,sourceDetached:true});this.draft=next;return {ok:true,draft:next};}
  return {ok:true,draft:d};
 }
 /** Restore service-source checks when placement navigation failed to open. */
 attachSource(id:string,stillCurrent:()=>boolean):Result {
  const r=this.read(id);if(!r.ok)return r;const d=r.draft;
  if(d.phase==="confirmed")return r;
  if(!stillCurrent()||d.source.expires_at*1000<=this.now())return {ok:false,message:"照片分析已过期，请返回重新上传或分析"};
  this.currentSource=stillCurrent;
  if(d.sourceDetached){const next=freeze({...d,sourceDetached:false});this.draft=next;return {ok:true,draft:next};}
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
   this.draft=freeze({...d,revision,transform:clone(transform),geometry,rawGeometry:complete?geometry:d.rawGeometry,
    clippedFromGeometry:undefined,clip:undefined,geometryRevision:complete?revision:d.geometryRevision,validation});
   if(complete)this.settled={transform:this.draft.transform,validation};
   return {ok:true,draft:this.draft};
  }catch(e){return {ok:false,message:(e as Error).message||"调整参数无效，请重试"};}
 }
 /** One-shot exact intersection supplied by the body geometry service after final validation. */
 applyBodyIntersection(id:string,owner:number,geometry:BodyMultiPolygon,outsideAreaRatio:number):Result {
  const r=this.read(id,owner);if(!r.ok)return r;const d=r.draft;
  if(d.phase==="confirmed")return {ok:false,message:"位置已确认"};
  if(d.geometryRevision!==d.revision)return {ok:false,message:"请先结束调整，再检查人体交集"};
  if(!Number.isFinite(outsideAreaRatio)||outsideAreaRatio<=0||outsideAreaRatio>=1)
   return {ok:false,message:"人体交集比例无效，请重新调整位置"};
  const model=getBodyModel(d.view),checked=validatePlacementGeometry(geometry,model);
  if(!checked.ok)return {ok:false,message:checked.message};
  const rawCheck=validatePlacementGeometry(d.rawGeometry,model);
  if(rawCheck.ok||rawCheck.code!=="OUTSIDE_BODY")
   return {ok:false,message:"当前范围不需要使用人体交集"};
  const revision=d.revision+1;
  this.draft=freeze({...d,revision,geometry:clone(geometry),clippedFromGeometry:clone(d.rawGeometry),
   clip:{method:"body_intersection_v1",outsideAreaRatio},geometryRevision:revision,validation:{ok:true}});
  this.settled={transform:this.draft.transform,validation:{ok:true}};
  return {ok:true,draft:this.draft};
 }
 /** Move the editable patch to the other independent 2D template without re-uploading or re-segmenting. */
 switchView(id:string,owner:number,view:BodyView):Result {
  const r=this.read(id,owner);if(!r.ok)return r;const d=r.draft;
  if(d.phase==="confirmed")return {ok:false,message:"位置已确认，不能切换视图"};
  if(view===d.view)return r;
  const model=getBodyModel(view),transform={...initialPlacement(d.prepared,model,null),
   scale:d.transform.scale,rotationDegrees:d.transform.rotationDegrees};
  const geometry=transformPhotoPolygonToBody(d.prepared,transform,model);
  const validation=validatePlacementGeometry(geometry,model);
  const opened=this.annotations.openPlacement(view,null);if(!opened.ok)return {ok:false,message:opened.message};
  const revision=d.revision+1;
  this.draft=freeze({...d,view,regionId:null,transform,geometry,rawGeometry:geometry,clippedFromGeometry:undefined,clip:undefined,
   initial:clone(transform),revision,geometryRevision:revision,validation,token:sessionToken(opened.session)});
  this.settled={transform,validation};
  return {ok:true,draft:this.draft};
 }
 cancelAdjustment(id:string,owner:number):Result {
  const r=this.read(id,owner),settled=this.settled;
  if(!r.ok||!settled||r.draft.validation.code!=="ADJUSTING")return r;
  const revision=r.draft.revision+1;
  this.draft=freeze({...r.draft,transform:settled.transform,validation:settled.validation,revision,geometryRevision:revision});
  return {ok:true,draft:this.draft};
 }
 reset(id:string,owner:number):Result {const r=this.read(id,owner);return r.ok?this.update(id,owner,r.draft.initial,true):r;}
 confirm(id:string,owner:number):Result {
  const r=this.read(id,owner);if(!r.ok||r.draft.phase==="confirmed")return r;
  const d=r.draft;
  if(d.geometryRevision!==d.revision)return {ok:false,message:"请先结束调整，检查范围后再确认位置"};
  const result=this.annotations.commitPlacement(d.token,{placementId:d.id,entryRegionId:d.regionId,source:d.source,transform:d.transform,
    geometry:d.geometry,clippedFromGeometry:d.clippedFromGeometry,clip:d.clip,sourceDetached:d.sourceDetached,editTarget:d.editTarget});
  if(!result.ok)return result;
  this.draft=freeze({...d,phase:"confirmed",validation:{ok:true}});return {ok:true,draft:this.draft};
 }
 discard(id:string,owner:number):void {if(this.draft?.id===id&&owner===this.owner&&this.draft.phase!=="confirmed"){this.owner++;this.draft=null;this.settled=null;}}
 invalidateSource(photoSessionId:string,includeDetached=false):void {
  if(this.draft?.source.session_id===photoSessionId&&this.draft.phase!=="confirmed"&&!this.draft.editTarget&&(includeDetached||!this.draft.sourceDetached)){
   this.owner++;this.draft=null;this.settled=null;
  }
 }
}
export const placementSession=new PlacementSessionStore();
