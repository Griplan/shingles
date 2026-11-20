import {placementSession} from "../../state/placement-session";
import {annotationSession,sessionToken} from "../../../../state/annotation-session";
import {matchingSession} from "../../state/matching-session";
import {intersectLesionWithBody} from "../../../../services/api";
import {AnnotationLayer} from "../../../../types/annotation";
import {BodyView,NormalizedPoint,NormalizedRect,ViewportTransform} from "../../../../types/dermatome";
import {PlacementTransform} from "../../../../types/placement";
import {getBodyModel} from "../../../../data/body-models";
import {placementBounds} from "../../../../utils/placement-geometry";
import {fitViewport,focusViewport} from "../../../../utils/coordinate";
import {canPlaceAI} from "../../../../config/ai";
import {canMatchReference} from "../../../../config/development";
import {canUseDeveloperTools} from "../../../../config/environment";
import {cancelPlacementReady,placementReady,retainPlacementView} from "../../state/placement-navigation";

type SliderKind="scale"|"angle";
type OverlayState="ready"|"waiting"|"error";
interface Life {id:string;owner:number;active:boolean;sequence:number;timer:ReturnType<typeof setInterval>|null;labels:ReturnType<typeof setTimeout>|null;
  overlayWatchdog:ReturnType<typeof setTimeout>|null;overlayAttempts:number;drag:PlacementTransform|null;slider:SliderKind|null;cancelledSlider:SliderKind|null}
const OVERLAY_WATCHDOG_MS=8000,OVERLAY_WAITING_MESSAGE="正在准备病灶范围…";
const OVERLAY_RETRY_MESSAGE="病灶范围正在自动恢复显示…";
function trace(event:string,detail:Record<string,unknown>={}):void {
  if(canUseDeveloperTools())console.info(`[placement] ${event}`,detail);
}
function imageStyle(model:ReturnType<typeof getBodyModel>,viewport:ViewportTransform):string {
  return `left:${viewport.offsetX}px;top:${viewport.offsetY}px;width:${model.logicalWidth*viewport.scale}px;height:${model.logicalHeight*viewport.scale}px;`;
}
function fallbackStageSize():{width:number;height:number}|null {
  try {
    const api=wx as unknown as {
      getWindowInfo?:()=>{windowWidth?:number;windowHeight?:number};
      getSystemInfoSync?:()=>{windowWidth?:number;windowHeight?:number};
    };
    const info=api.getWindowInfo?.()??api.getSystemInfoSync?.();
    const windowWidth=Number(info?.windowWidth),windowHeight=Number(info?.windowHeight);
    if(![windowWidth,windowHeight].every(value=>Number.isFinite(value)&&value>0))return null;
    // Mirrors placement.wxss. Wide screens use the P9 5:3 split; ordinary
    // phones keep the 50vh stage bounded to 220–620 CSS pixels.
    const wide=windowWidth>=680&&windowHeight>=520;
    const pageWidth=Math.min(1120,windowWidth),contentWidth=wide?pageWidth-32:windowWidth-56*(windowWidth/750);
    const width=wide?(contentWidth-16)*0.52:contentWidth;
    const height=wide?Math.min(740,windowHeight-128):Math.min(620,Math.max(220,windowHeight*0.58));
    return width>32&&height>32?{width,height}:null;
  } catch {
    return null;
  }
}
function unrefTimer(timer:ReturnType<typeof setTimeout>):void {
  (timer as unknown as {unref?:()=>void}).unref?.();
}
const lives=new WeakMap<object,Life>();
Page({
 data:{draftId:"",context:"",view:"front" as BodyView,zoomRegion:"",regionId:null as string|null,focusBounds:null as NormalizedRect|null,layoutRevision:0,interactionKey:"",
  viewport:null as ViewportTransform|null,preparedReady:false,transform:null as PlacementTransform|null,
  layer:null as AnnotationLayer|null,scalePercent:100,angle:0,confirmed:false,editingSaved:false,calculating:false,dragging:false,valid:false,needsClip:false,error:"",message:"",dialog:false,opening:false,overlayReady:false,
  initialReady:false,overlayWaiting:false,overlayFault:false,bodyFallbackVisible:false,bodyImagePath:"",bodyImageStyle:"",revision:0},
 onLoad(query:Record<string,string>){
  if(!canPlaceAI()){this.setData({error:"当前版本暂未开放AI人体放置，请返回手动标注"});return;}
  const owner=placementSession.acquire(query.draftId||"");
  const life:Life={id:query.draftId||"",owner:owner||0,active:true,sequence:0,timer:null,labels:null,overlayWatchdog:null,overlayAttempts:0,
    drag:null,slider:null,cancelledSlider:null};lives.set(this,life);
  if(owner===null){this.setData({error:"本次放置已失效，请返回照片页重新确认"});return;}
  trace("load",{draftId:life.id,owner});
  this.setData({draftId:life.id,interactionKey:`${life.id}:${owner}`});this.syncDraft(true);
  life.timer=setInterval(()=>{if(life.active)this.checkCurrent();},5000);
 },
 onShow(){const life=lives.get(this);if(!life)return;life.active=true;life.sequence++;life.drag=null;trace("show",{layoutRevision:this.data.layoutRevision});
  this.setData({dragging:false,opening:false,calculating:false,layoutRevision:this.data.layoutRevision+1},()=>this.ensureViewport());
  this.finishAdjustment();this.checkCurrent();this.guardExit();},
 onHide(){const life=lives.get(this);if(life){trace("hide",{overlayReady:this.data.overlayReady,initialReady:this.data.initialReady});this.finishAdjustment();life.active=false;life.sequence++;life.drag=null;}if(this.data.calculating)matchingSession.cancelPending();},
 onUnload(){cancelPlacementReady(this.data.draftId);const life=lives.get(this);if(life){this.finishAdjustment();this.cancelLabels();life.active=false;if(life.timer)clearInterval(life.timer);this.clearOverlayWatchdog();placementSession.release(life.id,life.owner);}if(this.data.calculating)matchingSession.cancelPending();lives.delete(this);},
 onResize(){
  this.cancelLabels();const life=lives.get(this);if(!life?.active)return;
  const previous=placementSession.read(life.id,life.owner);
  const interrupted=!!life.drag||(previous.ok&&previous.draft.validation.code==="ADJUSTING");
  life.drag=null;
  if(life.slider)life.cancelledSlider=life.slider;
  life.slider=null;
  this.setData({viewport:null,overlayReady:false,dragging:false,bodyFallbackVisible:false,layoutRevision:this.data.layoutRevision+1},()=>this.ensureViewport());
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
  const model=getBodyModel(d.view);
  // Keep the formal annotation unchanged until confirmation, but show the edited shape only once.
  const completed=s.ok?s.session.views[d.view].completed.filter(p=>d.phase!=="adjusting"||p.id!==d.editTarget?.id):[];
  const layer:AnnotationLayer|null=s.ok?{...sessionToken(s.session),view:d.view,completed,
   draft:null,selectedId:s.session.views[d.view].selectedId}:null;
  const common={view:d.view,regionId:d.regionId,context:`${d.view==="front"?"正面":"背面"} · ${region?`${region.name}（初始提示）`:"自由放置"}`,
   transform:d.transform,scalePercent:Math.round(d.transform.scale*100),angle:d.transform.rotationDegrees,
   confirmed:d.phase==="confirmed",valid:d.validation.ok,needsClip:d.validation.code==="OUTSIDE_BODY",
   error:"",message:d.clip?`已使用有效人体交集，越界部分 ${(d.clip.outsideAreaRatio*100).toFixed(1)}%`:(d.validation.message||""),
   revision:d.revision,layer,overlayReady:this.data.revision===d.revision?this.data.overlayReady:false,
   bodyImagePath:model.visual.imagePath||""};
  if(initial)this.setData({...common,editingSaved:!!d.editTarget,preparedReady:!!d.prepared,zoomRegion:"",focusBounds:null},
    ()=>this.ensureViewport());
  else this.setData(common,()=>this.ensureViewport(false));
  if(d.phase==="confirmed"){this.setData({layer});this.guardExit();}
 },
  publishViewport(model:ReturnType<typeof getBodyModel>,viewport:ViewportTransform,force=false){
   const life=lives.get(this);if(!life?.active)return;
   const style=imageStyle(model,viewport),same=JSON.stringify(viewport)===JSON.stringify(this.data.viewport);
   if(!force&&same&&this.data.bodyImagePath===model.visual.imagePath&&this.data.bodyFallbackVisible){
    this.wakeOverlay();return;
   }
   life.overlayAttempts=0;
   this.setData({viewport,bodyFallbackVisible:true,bodyImagePath:model.visual.imagePath||"",bodyImageStyle:style,
    overlayReady:false,error:"",overlayWaiting:false,overlayFault:false},()=>{this.armOverlayWatchdog();this.wakeOverlay();});
  },
  ensureViewport(force=true,attempt=0){
   const life=lives.get(this);if(!life?.active)return;
   try{
    this.createSelectorQuery().select(".body-canvas-slot").fields({size:true}).exec((results:unknown[])=>{
     if(lives.get(this)!==life||!life.active)return;
     const stage=results[0] as {width?:number;height?:number}|undefined,width=Number(stage?.width),height=Number(stage?.height);
     let measuredWidth=width,measuredHeight=height;
     if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){
      if(attempt<6){setTimeout(()=>this.ensureViewport(force,attempt+1),20+attempt*30);return;}
      const fallback=fallbackStageSize();
      if(!fallback){trace("viewport-unavailable",{width,height,attempt});return;}
      measuredWidth=fallback.width;measuredHeight=fallback.height;
     }
     const r=placementSession.read(life.id,life.owner);if(!r.ok){this.setData({error:r.message,valid:false});return;}
     const model=getBodyModel(r.draft.view);
     const base=fitViewport(measuredWidth,measuredHeight,model);
     const viewport=this.data.focusBounds?focusViewport(base,this.data.focusBounds):base;
     trace("viewport",{width:measuredWidth,height:measuredHeight,view:model.view,focus:!!this.data.focusBounds,zoomRegion:this.data.zoomRegion,fallback:measuredWidth!==width||measuredHeight!==height});
     this.publishViewport(model,viewport,force);
    });
   }catch(error){
    trace("viewport-error",{message:(error as Error).message});
    const fallback=fallbackStageSize();const r=placementSession.read(life.id,life.owner);
    if(fallback&&r.ok){
     const model=getBodyModel(r.draft.view),base=fitViewport(fallback.width,fallback.height,model);
     const viewport=this.data.focusBounds?focusViewport(base,this.data.focusBounds):base;
     this.publishViewport(model,viewport,force);
    }
   }
  },
  onViewport(e:WechatMiniprogram.CustomEvent<{view:BodyView;modelId:string;modelVersion:string;viewport:ViewportTransform}>){
   const life=lives.get(this);if(!life?.active||!this.checkCurrent())return;
   const model=getBodyModel(this.data.view),d=e.detail;
   if(d.view!==model.view||d.modelId!==model.id||d.modelVersion!==model.version)return;
   this.publishViewport(model,d.viewport);
  },
  bodyRenderError(){
   // Placement no longer owns a body Canvas. Keep this compatibility handler
   // for queued events from a previous hot-reload build, but recover by
   // reusing the stable local body image and re-measuring only the fixed slot.
   trace("legacy-body-error",{viewport:!!this.data.viewport});
   this.clearOverlayWatchdog();
   this.setData({error:"",overlayReady:false,overlayWaiting:false,overlayFault:false,bodyFallbackVisible:false},
     ()=>this.ensureViewport(true));
  },
  wakeOverlay(){wx.nextTick(()=>{const life=lives.get(this);if(life?.active)this.selectComponent("#placement-preview")?.wake();});},
  onOverlayReady(e:WechatMiniprogram.CustomEvent<{key:string;revision:number;layoutRevision?:number;viewportKey:string;viewport?:ViewportTransform|null;ready:boolean;status?:OverlayState}>){const detail=e.detail,
   status:OverlayState=detail.status||(detail.ready?"ready":"error");
  trace("overlay",{status,revision:detail.revision,pageRevision:this.data.revision,layoutRevision:detail.layoutRevision,pageLayoutRevision:this.data.layoutRevision,hasViewport:!!detail.viewport});
  const life=lives.get(this);
  // layoutRevision is a transient scheduling generation. A frame can be
  // queued before onShow advances that generation and still be the exact
  // viewport the user is looking at. Rejecting it leaves the page waiting for
  // a duplicate event forever. The stable interaction key and placement
  // revision identify the content; the rendered viewport identifies the
  // geometry. A genuinely stale frame still fails the viewport comparison.
  if(!life?.active||detail.key!==this.data.interactionKey||detail.revision!==this.data.revision)return;
  if(status==="waiting"){if(!this.data.initialReady&&!this.data.overlayWaiting)this.setData({overlayWaiting:true});return;}
  if(status==="ready"){
   const frameViewport=detail.viewport||(detail.viewportKey&&detail.viewportKey!=="null"?JSON.parse(detail.viewportKey) as ViewportTransform:null);
   if(!frameViewport||JSON.stringify(frameViewport)!==JSON.stringify(this.data.viewport))return;
   this.clearOverlayWatchdog();life.overlayAttempts=0;if(!this.data.initialReady)placementReady(this.data.draftId);
   this.setData({overlayReady:true,initialReady:true,overlayWaiting:false,overlayFault:false,error:"",
     ...(this.data.message===OVERLAY_WAITING_MESSAGE||this.data.message==="病灶范围暂时无法显示，请返回照片页重试"?{message:""}:{})});
   return;
  }
  if(!this.data.initialReady&&life.overlayAttempts<1){
   life.overlayAttempts++;
   this.clearOverlayWatchdog();
   this.setData({error:"",message:OVERLAY_RETRY_MESSAGE,overlayWaiting:true,overlayFault:false},
     ()=>{this.selectComponent("#placement-preview")?.retry();this.armOverlayWatchdog();});
   return;
  }
  this.clearOverlayWatchdog();
  if(!this.data.initialReady)this.setData({error:"人体轮廓或病灶范围加载失败，请重试",overlayWaiting:false,overlayFault:true});
  else this.setData({overlayReady:false,overlayWaiting:false,overlayFault:true,message:"病灶范围暂时无法显示，请点击“重试显示”"});
 },
 clearOverlayWatchdog(){const life=lives.get(this);if(life?.overlayWatchdog!==null&&life){clearTimeout(life.overlayWatchdog as ReturnType<typeof setTimeout>);life.overlayWatchdog=null;}},
  armOverlayWatchdog(){const life=lives.get(this);if(!life?.active||!this.data.viewport||this.data.initialReady||life.overlayWatchdog!==null)return;
  life.overlayWatchdog=setTimeout(()=>{life.overlayWatchdog=null;if(!life.active||this.data.initialReady)return;
   if(life.overlayAttempts<1){life.overlayAttempts++;this.setData({error:"",overlayWaiting:true,overlayFault:false,message:OVERLAY_RETRY_MESSAGE});
    this.selectComponent("#placement-preview")?.retry();this.armOverlayWatchdog();return;}
   this.setData({error:"人体轮廓或病灶范围加载超时，请重试",overlayWaiting:false,overlayFault:true});
  },OVERLAY_WATCHDOG_MS);unrefTimer(life.overlayWatchdog);
 },
 retryOverlay(){const life=lives.get(this);if(!life?.active)return;this.clearOverlayWatchdog();
  this.setData({error:"",message:this.data.initialReady?"正在重新绘制病灶范围…":OVERLAY_WAITING_MESSAGE,overlayFault:false,overlayWaiting:true});
  this.selectComponent("#placement-preview")?.retry();life.overlayAttempts=0;this.armOverlayWatchdog();
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
  this.setData({viewport:null,overlayReady:false,bodyFallbackVisible:false,zoomRegion:"",focusBounds:this.data.focusBounds?null:bounds,layoutRevision:this.data.layoutRevision+1},
    ()=>this.ensureViewport());},
 async chooseView(view:BodyView){const life=lives.get(this);if(!life?.active||this.data.dialog||this.data.dragging||this.data.confirmed||this.data.calculating||view===this.data.view)return;
  this.finishAdjustment();const r=placementSession.switchView(life.id,life.owner,view);
  if(!r.ok){this.setData({message:r.message});return;}
  this.setData({viewport:null,overlayReady:false,bodyFallbackVisible:false,focusBounds:null,layoutRevision:this.data.layoutRevision+1},
    ()=>this.ensureViewport());this.syncDraft();
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
