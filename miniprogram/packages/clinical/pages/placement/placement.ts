import {placementSession} from "../../state/placement-session";
import {annotationSession,sessionToken} from "../../../../state/annotation-session";
import {matchingSession} from "../../state/matching-session";
import {intersectLesionWithBody} from "../../../../services/api";
import {AnnotationLayer} from "../../../../types/annotation";
import {BodyView,BodyViewportEvent,NormalizedPoint,NormalizedRect,ViewportTransform} from "../../../../types/dermatome";
import {PlacementTransform,PreparedPhotoGeometry} from "../../../../types/placement";
import {getBodyModel} from "../../../../data/body-models";
import {placementBounds} from "../../../../utils/placement-geometry";
import {canPlaceAI} from "../../../../config/ai";
import {canMatchReference} from "../../../../config/development";
import {cancelPlacementReady,placementReady,retainPlacementView} from "../../state/placement-navigation";

type SliderKind="scale"|"angle";
interface Life {id:string;owner:number;active:boolean;sequence:number;timer:ReturnType<typeof setInterval>|null;labels:ReturnType<typeof setTimeout>|null;drag:PlacementTransform|null;slider:SliderKind|null;cancelledSlider:SliderKind|null}
const lives=new WeakMap<object,Life>();
Page({
 data:{draftId:"",context:"",view:"front" as BodyView,zoomRegion:"",regionId:null as string|null,focusBounds:null as NormalizedRect|null,layoutRevision:0,interactionKey:"",
  viewport:null as ViewportTransform|null,prepared:null as PreparedPhotoGeometry|null,transform:null as PlacementTransform|null,
  layer:null as AnnotationLayer|null,scalePercent:100,angle:0,confirmed:false,editingSaved:false,calculating:false,dragging:false,valid:false,needsClip:false,error:"",message:"",dialog:false,opening:false,overlayReady:false,revision:0},
 onLoad(query:Record<string,string>){
  if(!canPlaceAI()){this.setData({error:"当前版本暂未开放AI人体放置，请返回手动标注"});return;}
  const owner=placementSession.acquire(query.draftId||"");
  const life:Life={id:query.draftId||"",owner:owner||0,active:true,sequence:0,timer:null,labels:null,drag:null,slider:null,cancelledSlider:null};lives.set(this,life);
  if(owner===null){this.setData({error:"本次放置已失效，请返回照片页重新确认"});return;}
  this.setData({draftId:life.id,interactionKey:`${life.id}:${owner}`});this.syncDraft(true);
  life.timer=setInterval(()=>{if(life.active)this.checkCurrent();},5000);
 },
 onShow(){const life=lives.get(this);if(!life)return;life.active=true;life.sequence++;life.drag=null;
  this.setData({dragging:false,opening:false,calculating:false,layoutRevision:this.data.layoutRevision+1});this.finishAdjustment();this.checkCurrent();this.guardExit();},
 onHide(){const life=lives.get(this);if(life){this.finishAdjustment();life.active=false;life.sequence++;life.drag=null;}if(this.data.calculating)matchingSession.cancelPending();},
 onUnload(){cancelPlacementReady(this.data.draftId);const life=lives.get(this);if(life){this.finishAdjustment();this.cancelLabels();life.active=false;if(life.timer)clearInterval(life.timer);placementSession.release(life.id,life.owner);}if(this.data.calculating)matchingSession.cancelPending();lives.delete(this);},
 onResize(){
  this.cancelLabels();const life=lives.get(this);if(!life?.active)return;
  const previous=placementSession.read(life.id,life.owner);
  const interrupted=!!life.drag||(previous.ok&&previous.draft.validation.code==="ADJUSTING");
  life.drag=null;
  if(life.slider)life.cancelledSlider=life.slider;
  life.slider=null;
  this.setData({viewport:null,overlayReady:false,dragging:false,layoutRevision:this.data.layoutRevision+1});
  if(interrupted){placementSession.cancelAdjustment(life.id,life.owner);this.syncDraft();}
 },
 onPageScroll(){this.selectComponent("#placement-preview")?.invalidateLayout();this.finishAdjustment();},
 guardExit(){try{if(this.data.confirmed)wx.disableAlertBeforeUnload();else wx.enableAlertBeforeUnload({message:"位置尚未确认，离开后可从照片页继续本次调整；关闭小程序会丢失草稿。"});}catch{/* 自定义返回仍提供明确选择。 */}},
 checkCurrent(){const life=lives.get(this);if(!life)return false;const r=placementSession.read(life.id,life.owner);
  if(!r.ok){this.setData({error:r.message,valid:false,dragging:false});return false;}return true;},
 syncDraft(initial=false){
  const life=lives.get(this);if(!life)return;const r=placementSession.read(life.id,life.owner);
  if(!r.ok){this.setData({error:r.message,valid:false});return;}
  const d=r.draft,region=d.regionId?getBodyModel(d.view).regions.find(x=>x.id===d.regionId):null,s=annotationSession.read(d.token.sessionId);
  // Keep the formal annotation unchanged until confirmation, but show the edited shape only once.
  const completed=s.ok?s.session.views[d.view].completed.filter(p=>d.phase!=="adjusting"||p.id!==d.editTarget?.id):[];
  const layer:AnnotationLayer|null=s.ok?{...sessionToken(s.session),view:d.view,completed,
   draft:null,selectedId:s.session.views[d.view].selectedId}:null;
  const common={view:d.view,regionId:d.regionId,context:`${d.view==="front"?"正面":"背面"} · ${region?`${region.name}（初始提示）`:"自由放置"}`,
   transform:d.transform,scalePercent:Math.round(d.transform.scale*100),angle:d.transform.rotationDegrees,
   confirmed:d.phase==="confirmed",valid:d.validation.ok,needsClip:d.validation.code==="OUTSIDE_BODY",
   error:"",message:d.clip?`已使用有效人体交集，越界部分 ${(d.clip.outsideAreaRatio*100).toFixed(1)}%`:(d.validation.message||""),
   revision:d.revision,layer,overlayReady:this.data.revision===d.revision?this.data.overlayReady:false};
  if(initial)this.setData({...common,editingSaved:!!d.editTarget,prepared:d.prepared,zoomRegion:region?.id||"",focusBounds:null});
  else this.setData(common);
  if(d.phase==="confirmed"){this.setData({layer});this.guardExit();}
 },
 onViewport(e:WechatMiniprogram.CustomEvent<BodyViewportEvent>){
  const life=lives.get(this);if(!life?.active||!this.checkCurrent())return;
  const model=getBodyModel(this.data.view),d=e.detail;
  if((d.layoutRevision===undefined||d.layoutRevision===this.data.layoutRevision)&&d.view===model.view&&d.modelId===model.id&&d.modelVersion===model.version&&JSON.stringify(d.viewport)!==JSON.stringify(this.data.viewport))
   this.setData({viewport:d.viewport,overlayReady:false});
 },
 onOverlayReady(e:WechatMiniprogram.CustomEvent<{key:string;revision:number;viewportKey:string;ready:boolean}>){const detail=e.detail;
  wx.nextTick(()=>{if(lives.get(this)?.active&&detail.key===this.data.interactionKey&&detail.revision===this.data.revision&&this.data.viewport&&detail.viewportKey===JSON.stringify(this.data.viewport)&&this.data.overlayReady!==detail.ready)
    {if(detail.ready)placementReady(this.data.draftId);this.setData({overlayReady:detail.ready,...(!detail.ready?{message:"病灶范围暂时无法显示，请返回照片页重试"}:this.data.message==="病灶范围暂时无法显示，请返回照片页重试"?{message:""}:{})});}});
 },
 cancelLabels(){const life=lives.get(this);if(life&&life.labels!==null){clearTimeout(life.labels);life.labels=null;}},
 updateLabels(){const life=lives.get(this);if(!life||life.labels!==null)return;
  life.labels=setTimeout(()=>{life.labels=null;if(lives.get(this)!==life||!life.active)return;const r=placementSession.read(life.id,life.owner);
   if(r.ok)this.setData({scalePercent:Math.round(r.draft.transform.scale*100),angle:r.draft.transform.rotationDegrees});},100);
 },
 finishAdjustment(){this.cancelLabels();const life=lives.get(this);if(!life?.active)return;const r=placementSession.read(life.id,life.owner);
  if(r.ok&&r.draft.phase==="adjusting"&&r.draft.validation.code==="ADJUSTING"){
   placementSession.update(life.id,life.owner,r.draft.transform,true);this.syncDraft();
  }life.drag=null;if(this.data.dragging)this.setData({dragging:false});
 },
 update(transform:PlacementTransform,complete:boolean){const life=lives.get(this);if(!life?.active||this.data.confirmed||this.data.error)return;
  const r=placementSession.update(life.id,life.owner,transform,complete);
  if(!r.ok){this.setData({message:r.message,valid:false});return;}
  if(complete){this.cancelLabels();this.syncDraft();return;}
  if(this.data.valid||this.data.overlayReady||this.data.message)this.setData({valid:false,overlayReady:false,message:""});
  const overlay=this.selectComponent("#placement-preview");
  if(overlay)overlay.previewTransform(r.draft.transform,r.draft.revision,this.data.interactionKey);
  // Percentage/angle text is throttled; dragging needs no page-state bridge at all.
  if(!life.drag)this.updateLabels();
 },
onDrag(e:WechatMiniprogram.CustomEvent<{key:string;phase:string;delta:NormalizedPoint;transform?:PlacementTransform}>){
  const life=lives.get(this);if(!life?.active||e.detail.key!==this.data.interactionKey||this.data.dialog||this.data.confirmed)return;
  const r=placementSession.read(life.id,life.owner);if(!r.ok){this.setData({error:r.message,valid:false});return;}
  if(e.detail.phase==="start"){life.drag=r.draft.transform;this.setData({dragging:true,valid:false});return;}
  const start=life.drag;if(!start)return;
  if(e.detail.phase==="cancel"){life.drag=null;this.setData({dragging:false});this.update(r.draft.transform,true);return;}
  const delta=e.detail.delta;if(!delta||![delta.x,delta.y].every(Number.isFinite))return;
  const complete=e.detail.phase==="end";
  const transform=e.detail.transform||{...start,translation:{x:start.translation.x+delta.x,y:start.translation.y+delta.y}};
  if(complete){life.drag=null;if(this.data.dragging)this.setData({dragging:false});}
  this.update(transform,complete);
 },
 scaleChanging(e:WechatMiniprogram.CustomEvent<{value:number}>){this.slider("scale",e.detail.value,false);},
 scaleChanged(e:WechatMiniprogram.CustomEvent<{value:number}>){this.slider("scale",e.detail.value,true);},
 angleChanging(e:WechatMiniprogram.CustomEvent<{value:number}>){this.slider("angle",e.detail.value,false);},
 angleChanged(e:WechatMiniprogram.CustomEvent<{value:number}>){this.slider("angle",e.detail.value,true);},
 startSlider(){const life=lives.get(this);if(life)life.cancelledSlider=null;},
 slider(kind:SliderKind,value:number,complete:boolean){const life=lives.get(this);if(!life?.active||this.data.dialog||life.cancelledSlider===kind)return;
  const r=placementSession.read(life.id,life.owner);if(!r.ok)return;
  life.slider=complete?null:kind;
  this.update({...r.draft.transform,...(kind==="scale"?{scale:value/100}:{rotationDegrees:value})},complete);},
 reset(){const life=lives.get(this);if(!life?.active||this.data.confirmed||this.data.dialog)return;
  const r=placementSession.reset(life.id,life.owner);if(r.ok)this.syncDraft();else this.setData({message:r.message});},
 toggleFocus(){if(this.data.dragging||this.data.dialog)return;this.finishAdjustment();const r=placementSession.read(this.data.draftId,lives.get(this)?.owner);
  const bounds=r.ok?placementBounds(r.draft.geometry):this.data.focusBounds;
  this.setData({viewport:null,overlayReady:false,zoomRegion:"",focusBounds:this.data.focusBounds?null:bounds,layoutRevision:this.data.layoutRevision+1});},
 async chooseView(view:BodyView){const life=lives.get(this);if(!life?.active||this.data.dialog||this.data.dragging||this.data.confirmed||this.data.calculating||view===this.data.view)return;
  this.finishAdjustment();const r=placementSession.switchView(life.id,life.owner,view);
  if(!r.ok){this.setData({message:r.message});return;}
  this.setData({viewport:null,overlayReady:false,focusBounds:null,layoutRevision:this.data.layoutRevision+1});this.syncDraft();
 },
 switchView(event:WechatMiniprogram.TouchEvent){const value=event.currentTarget.dataset.view;if(value==="front"||value==="back")void this.chooseView(value);},
 async useBodyIntersection(){
  const life=lives.get(this);if(!life?.active)return false;const r=placementSession.read(life.id,life.owner);if(!r.ok)return false;
  const d=r.draft,target=d.transform.target;
  const clipped=await intersectLesionWithBody({view:d.view,template_id:target.templateId,template_version:target.templateVersion,
    geometry_id:target.geometryId,region_set_id:target.regionSetId,geometry:d.rawGeometry});
  if(clipped.status==="outside"||!clipped.geometry){this.setData({message:"病灶完全位于人体外，请移动回有效皮肤范围"});return false;}
  if(clipped.status==="inside"){
   // The client only calls this endpoint after its exact local check reports
   // an out-of-body result. An "inside" response therefore means the two
   // boundary checks disagree; never manufacture a tiny clip or save it.
   this.setData({message:"人体边界检查结果不一致，请重新调整位置后再试"});return false;
  }
  const accepted=await new Promise<boolean>(resolve=>wx.showModal({title:"使用有效人体交集？",content:`当前范围有 ${(clipped.outside_area_ratio*100).toFixed(1)}% 位于人体外。确认后将保留人体内的病灶部分，原始调整参数仍可继续修改。`,cancelText:"继续调整",confirmText:"使用交集",success:value=>resolve(value.confirm),fail:()=>resolve(false)}));
  if(!accepted)return false;
  const applied=placementSession.applyBodyIntersection(life.id,life.owner,clipped.geometry,clipped.outside_area_ratio);
  if(!applied.ok){this.setData({message:applied.message});return false;}return true;
 },
 async confirmPosition(){const life=lives.get(this);if(!life?.active||this.data.dialog||this.data.dragging||this.data.calculating||this.data.opening||this.data.error)return;
  if(!this.data.confirmed&&((!this.data.valid&&!this.data.needsClip)||!this.data.viewport||!this.data.overlayReady))return;
  const sequence=++life.sequence;this.setData({calculating:true,message:""});
  if(!this.data.confirmed&&this.data.needsClip){
   try{if(!await this.useBodyIntersection()){this.setData({calculating:false});return;}}
   catch(e){this.setData({calculating:false,message:(e as Error).message||"人体交集检查失败，标注已保留"});return;}
   this.finishAdjustment();this.syncDraft();
  }
  // Commit is atomic/idempotent. A retry reads the saved body annotation, never inserts again.
  const r=this.data.confirmed?placementSession.read(life.id,life.owner):placementSession.confirm(life.id,life.owner);
  if(!r.ok){this.setData({calculating:false,message:r.message,valid:false});return;}
  matchingSession.refresh();this.syncDraft();
  const s=annotationSession.read(r.draft.token.sessionId);
  if(!s.ok){this.setData({calculating:false,message:s.message});return;}
  const focused=annotationSession.dispatch(sessionToken(s.session),{type:"focus",regionId:this.data.zoomRegion||null});
  const review=focused.ok&&focused.session.phase!=="review"?annotationSession.dispatch(sessionToken(focused.session),{type:"review"}):focused;
  if(!review.ok){this.setData({calculating:false,message:review.message});return;}
  if(!canMatchReference()){this.setData({calculating:false,message:"位置已保存，当前环境未开启参考图谱计算"});return;}
  if(matchingSession.refresh().status!=="ready")await matchingSession.calculate();
  if(lives.get(this)!==life||!life.active||life.sequence!==sequence)return;
  this.setData({calculating:false});
  const matched=matchingSession.refresh();
  if(matched.status!=="ready"||!matched.response){this.setData({message:matched.message||"计算未完成，已保存范围保留，可重试"});return;}
  if(this.data.viewport)retainPlacementView({sessionId:s.session.sessionId,requestId:matched.response.request_id,
   view:this.data.view,viewport:this.data.viewport,regionId:this.data.zoomRegion});
  this.openAnnotations(true);
 },
 viewAnnotations(){this.openAnnotations(false);},
 openAnnotations(result:boolean){const life=lives.get(this);if(!life?.active||!this.data.confirmed||this.data.opening||this.data.calculating)return;
  const r=placementSession.read(life.id,life.owner);if(!r.ok){this.setData({error:r.message});return;}
  this.setData({opening:true});
  const fallback=()=>wx.redirectTo({url:`/packages/clinical/pages/annotate/annotate?sessionId=${encodeURIComponent(r.draft.token.sessionId)}${result?"&result=1":""}`,
   fail:()=>{if(lives.get(this)===life&&life.active)this.setData({opening:false,message:"标注页面未能打开，已保存范围仍保留"});}});
  const pages=typeof getCurrentPages==="function"?getCurrentPages():[];
  if(result&&pages[pages.length-2]?.route==="packages/clinical/pages/annotate/annotate")wx.navigateBack({fail:fallback});else fallback();
 },
 backPhoto(){const life=lives.get(this);if(!life?.active||this.data.dialog)return;
  this.finishAdjustment();
  const leave=()=>{try{wx.disableAlertBeforeUnload();}catch{}placementSession.discard(life.id,life.owner);wx.navigateBack({fail:()=>wx.redirectTo({url:"/pages/select/select"})});};
  if(this.data.confirmed||this.data.error){leave();return;}
  const sequence=++life.sequence;this.setData({dialog:true});wx.showModal({title:"放弃本次放置？",content:this.data.editingSaved?"已保存的原标注和原计算结果会保留。":"照片中已确认的识别范围和其他标注会保留。",cancelText:"继续调整",confirmText:"放弃返回",
   success:r=>{if(lives.get(this)===life&&life.active&&life.sequence===sequence&&r.confirm)leave();},
   complete:()=>{if(lives.get(this)===life)this.setData({dialog:false});}});
 },
});
