import {AIPhotoFlow,AI_WARNINGS,NO_USABLE_CONTOUR_MESSAGE} from "../../state/ai-session";
import {aiTransport} from "../../../../services/ai";
import {canUseAI} from "../../../../config/ai";
import {PhotoBox,PhotoPoint,BrushStroke} from "../../../../types/ai";
import {getBodyRegion} from "../../../../data/body-regions";
import {BodyView} from "../../../../types/dermatome";
import {placementSession} from "../../state/placement-session";
import {controlledServerActive} from "../../../../config/controlled";
import {preparePhoto,prunePhotoPreparationCache,PreparedPhoto} from "../../utils/prepare-photo";
const photoPicks=new WeakMap<object,{cancelled:boolean}>();
const flows=new WeakMap<object,AIPhotoFlow>();
const contexts=new WeakMap<object,{view:BodyView;initialRegionHint:string|null}>();
const timers=new WeakMap<object,ReturnType<typeof setInterval>>();
const privacy="经您同意后，照片会发送至项目后端，仅用于本次自动化图像分割以提取目标轮廓，不用于模型训练。确认轮廓并建立可独立放置的草稿后立即请求删除照片会话，取消或返回也会请求删除。当前在线测试服务按空闲期限定期回收（部署更新后为连续闲置 5 分钟），处理中不会按闲置清理。仅可使用公开授权或合成测试图片，请勿上传真实患者照片。";
const photoPrivacy=()=>controlledServerActive()?"当前使用本机受控开发服务，仅可使用公开或合成测试图片。"+privacy:privacy;
Page({
 data:{preparing:false,preparationError:"",noUsableContourMessage:NO_USABLE_CONTOUR_MESSAGE,available:false,context:"",photo:"",photoWidth:0,photoHeight:0,mask:"",mode:"box",phase:"empty",error:"",cleanupWarning:"",
  points:[] as PhotoPoint[],box:null as PhotoBox|null,additionalBoxes:[] as PhotoBox[],warnings:[] as string[],
  editingMask:false,brushRadius:.02,brushSize:20,canUndoBrush:false,pendingBrush:false,addingRegion:false,strategy:"context_crop",
  canConfirm:false,renderReady:false,canUndo:false,layoutRevision:0,hasPrompt:false,
  selecting:true,adjusting:false,working:false,previewing:false,hasResult:false,canCycle:false,failed:false,openingPlacement:false,hasPendingPlacement:false},
 onLoad(query:Record<string,string>){
  prunePhotoPreparationCache();
  const view:BodyView=query.view==="back"?"back":"front";
  const region=getBodyRegion(view,query.region);
  this.setData({available:canUseAI(),context:view==="front"?"正面":"背面"});
  contexts.set(this,{view,initialRegionHint:region?.id||null});
  flows.set(this,new AIPhotoFlow(aiTransport,()=>this.syncFlow()));

 },
 onUnload(){this.cancelPhotoPick();const f=flows.get(this);if(f?.session)placementSession.invalidateSource(f.session.session_id);flows.delete(this);contexts.delete(this);const timer=timers.get(this);if(timer)clearInterval(timer);timers.delete(this);if(f)void f.cancel();},
 onShow(){this.setData({available:canUseAI()&&contexts.has(this),layoutRevision:this.data.layoutRevision+1,renderReady:false,openingPlacement:false,hasPendingPlacement:placementSession.hasPendingSource(flows.get(this)?.confirmed||null)});},onResize(){this.setData({layoutRevision:this.data.layoutRevision+1,renderReady:false});},
 syncFlow(){
  const f=flows.get(this);if(!f)return;
  const changed=this.data.photo!==(f.session?.localPhoto||"")||this.data.mask!==f.maskPath;
  const usable=f.result?.candidates.filter(c=>c.status==="ok")||[];
  const selected=f.result?.candidates.find(c=>c.candidate_id===f.selected);
  const hasResult=!!f.maskPath&&selected?.status==="ok";
  this.setData({photo:f.session?.localPhoto||"",photoWidth:f.session?.image.width||0,photoHeight:f.session?.image.height||0,
   mask:f.maskPath,points:f.prompts.points,box:f.prompts.box,additionalBoxes:f.prompts.additional_boxes||[],phase:f.phase,error:f.error,cleanupWarning:f.cleanupWarning,
   canUndoBrush:!!f.corrections.get(f.selected)?.length,pendingBrush:!!f.pendingCorrection,strategy:f.strategy,
   warnings:selected?.warnings.map(w=>AI_WARNINGS[w]).filter(Boolean)||[],
   canConfirm:f.canConfirm(),canUndo:f.history.length>0,hasPrompt:!!f.prompts.box||f.prompts.points.some(p=>p.label===1),
   hasPendingPlacement:placementSession.hasPendingSource(f.confirmed),
   working:f.phase==="segmenting"||f.phase==="correcting"||f.previewing,previewing:f.previewing,hasResult,canCycle:usable.length>1&&!f.pendingCorrection,
   selecting:(f.result||f.error)&&!this.data.adjusting?false:this.data.selecting,
   failed:!!f.session&&f.phase==="ready"&&!f.previewing&&!hasResult&&!!f.error&&!this.data.adjusting,
   renderReady:changed?false:this.data.renderReady});
 },
 pickPhoto(event:WechatMiniprogram.TouchEvent){this.choosePhoto(event.currentTarget.dataset.source==="camera"?"camera":"album");},
 changePhoto(){wx.showActionSheet({itemList:["从相册选择","拍照"],success:r=>this.choosePhoto(r.tapIndex===1?"camera":"album")});},
 choosePhoto(source:"album"|"camera"){
  if(!this.data.available||this.data.phase==="uploading"||photoPicks.has(this))return;
  const pick={cancelled:false};photoPicks.set(this,pick);
  const active=()=>!pick.cancelled&&flows.has(this)&&photoPicks.get(this)===pick;
  const done=()=>{if(photoPicks.get(this)===pick)photoPicks.delete(this);};
  wx.showModal({title:"照片用途与隐私",content:photoPrivacy(),confirmText:"同意选择",fail:done,success:r=>{
   if(!r.confirm||!active()){done();return;}
   wx.chooseMedia({count:1,mediaType:["image"],sourceType:[source],sizeType:["original"],success:async chosen=>{
    const file=chosen.tempFiles[0];if(!active()||!file){done();return;}
    this.setData({preparing:true,preparationError:""});
    let prepared:PreparedPhoto|undefined;
    try{
     prepared=await preparePhoto(file.tempFilePath,()=>new Promise((resolve,reject)=>{
      wx.nextTick(()=>{
       if(!active()){reject(new Error("照片准备已取消"));return;}
       this.createSelectorQuery().select("#prepare-photo-canvas").fields({node:true}).exec(res=>{
        if(res[0]?.node)resolve(res[0].node);else reject(new Error("无法初始化照片处理，请重试"));
       });
      });
     }),active);
     if(!active()||!canUseAI())return;
     this.invalidatePendingPlacement(true);
     this.setData({preparing:false,mode:"box",adjusting:false,selecting:true,editingMask:false,addingRegion:false});
     await flows.get(this)!.replace(prepared.path);
    }catch(e){if(active())this.setData({preparationError:(e as Error).message||"照片准备失败，请重新选择"});}
    finally{
     prepared?.release();
     if(flows.has(this)&&photoPicks.get(this)===pick)this.setData({preparing:false});
     done();
    }
   },fail:e=>{if(active()&&!/cancel/.test(e.errMsg))wx.showToast({title:"未能选择照片，请重试",icon:"none"});done();}});
  }});
 },
 cancelPhotoPick(){const pick=photoPicks.get(this);if(pick)pick.cancelled=true;},
 showPrivacy(){wx.showModal({title:"照片用途与隐私",content:photoPrivacy(),showCancel:false});},
 onPrompt(e:WechatMiniprogram.CustomEvent<{box:PhotoBox|null;point:PhotoPoint|null}>){
  const f=flows.get(this);if(!f||this.data.preparing)return;
  if(e.detail.box&&this.data.addingRegion){this.setData({addingRegion:false,selecting:false});void f.addBox(e.detail.box);}
  else if(e.detail.box&&this.data.selecting&&!this.data.adjusting)void f.selectBox(e.detail.box);
  else if(e.detail.point&&this.data.adjusting)f.edit(null,e.detail.point);
 },
 boxInvalid(){wx.showToast({title:"圈选范围太小，请稍微扩大",icon:"none"});},
  reselect(){if(this.data.phase==="confirming")return;if(this.data.hasPendingPlacement||flows.get(this)?.sourceReleased){this.changePhoto();return;}this.invalidatePendingPlacement(true);this.setData({mode:"box",selecting:true,adjusting:false,editingMask:false,addingRegion:false});flows.get(this)?.reset();},
 openAdjustment(){if(!this.data.hasResult||this.data.working||this.data.phase!=="ready")return;this.setData({adjusting:true,selecting:false,editingMask:false,mode:"foreground"});},
 openBrush(){if(!this.data.hasResult||this.data.working||this.data.phase!=="ready")return;this.setData({editingMask:true,adjusting:false,selecting:false,mode:"paint-erase"});},
 brushMode(e:WechatMiniprogram.TouchEvent){const mode=e.currentTarget.dataset.mode;if(this.data.editingMask&&!this.data.working&&["paint-add","paint-erase"].includes(mode))this.setData({mode});},
 brushSizeChanged(e:WechatMiniprogram.CustomEvent<{value:number}>){const value=e.detail.value;if(Number.isFinite(value)&&value>=5&&value<=60)this.setData({brushSize:value,brushRadius:value/1000});},
 onStroke(e:WechatMiniprogram.CustomEvent<BrushStroke>){if(this.data.editingMask)void flows.get(this)?.brush(e.detail);},
 strokeInvalid(){wx.showToast({title:"笔画无效或过长，请在照片内分笔修正",icon:"none"});},
 undoBrush(){void flows.get(this)?.undoBrush();},restoreBrush(){void flows.get(this)?.restoreBrush();},retryBrush(){void flows.get(this)?.retryBrush();},
 finishBrush(){if(!this.data.working&&!this.data.pendingBrush&&this.data.renderReady)this.setData({editingMask:false,mode:"box"});},
 addRegion(){if(this.data.working)return;this.setData({adjusting:false,editingMask:false,addingRegion:true,selecting:true,mode:"box"});},
 alternativeAnalysis(){if(this.data.working)return;this.setData({adjusting:false,editingMask:false,selecting:false,mode:"box"});void flows.get(this)?.changeStrategy();},
 setMode(event:WechatMiniprogram.TouchEvent){const mode=event.currentTarget.dataset.mode;if(this.data.adjusting&&["foreground","background"].includes(mode))this.setData({mode});},
 undo(){flows.get(this)?.undo();},
 refine(){if(!this.data.adjusting||!this.data.hasPrompt)return;this.setData({adjusting:false,selecting:false,mode:"box"});void flows.get(this)?.segment();},
 nextResult(){
  const f=flows.get(this),choices=f?.result?.candidates.filter(c=>c.status==="ok")||[];
  if(!f||choices.length<2)return;
  const i=choices.findIndex(c=>c.candidate_id===f.selected);void f.preview(choices[(i+1)%choices.length].candidate_id);
 },
 async confirm(){
  const flow=flows.get(this);
  if(!flow||!this.data.renderReady||this.data.adjusting||this.data.editingMask)return;
  await flow.confirm();
  if(flows.get(this)===flow&&flow.phase==="confirmed"&&flow.confirmed){
   const draft=this.preparePlacement(flow,flow.confirmed);
   if(!draft.ok)this.setData({error:draft.message});
  }
 },
 preparePlacement(flow:AIPhotoFlow,source:NonNullable<AIPhotoFlow["confirmed"]>){
  const context=contexts.get(this);
  if(!context)return {ok:false as const,message:"页面已关闭，请重新进入"};
  const pending=placementSession.pendingForSource(source);
  if(pending?.sourceDetached)return {ok:true as const,draft:pending};
  const stillCurrent=()=>flows.get(this)===flow&&flow.confirmed===source&&!!flow.session;
  const opened=placementSession.open(source,context.view,context.initialRegionHint,stillCurrent);
  if(!opened.ok)return opened;
  const detached=placementSession.detachSource(opened.draft.id);
  if(detached.ok){
   this.setData({hasPendingPlacement:true,error:""});
   void flow.releaseSourceAfterPlacement();
  }
  return detached;
 },
 async placeOnBody(){
  const flow=flows.get(this),source=flow?.confirmed;
  if(!flow||!source||flow.phase!=="confirmed"||this.data.openingPlacement)return;
  this.setData({openingPlacement:true});
  wx.showLoading?.({title:"正在准备轮廓放置",mask:true});
  await new Promise<void>(resolve=>wx.nextTick(resolve));
  if(flows.get(this)!==flow||flow.confirmed!==source){wx.hideLoading?.();this.setData({openingPlacement:false});return;}
  const result=this.preparePlacement(flow,source);
  if(!result.ok){wx.hideLoading?.();this.setData({openingPlacement:false,error:result.message});return;}
  const failed=()=>{
   wx.hideLoading?.();
   if(flows.get(this)===flow)this.setData({openingPlacement:false,error:"放置页面未能打开，放置草稿仍保留，请重试"});
  };
  try{
   wx.navigateTo({url:`/packages/clinical/pages/placement/placement?draftId=${encodeURIComponent(result.draft.id)}`,
    success:()=>{wx.hideLoading?.();},fail:failed});
  }catch{failed();}
 },
 renderState(e:WechatMiniprogram.CustomEvent<{source:string;mask:string;ready:boolean;layoutRevision?:number}>){
  const detail=e.detail;
  wx.nextTick(()=>{if(flows.has(this)&&(detail.layoutRevision===undefined||detail.layoutRevision===this.data.layoutRevision)&&detail.source===this.data.photo&&detail.mask===this.data.mask&&this.data.renderReady!==detail.ready)
    this.setData({renderReady:detail.ready});});
 },
 invalidatePendingPlacement(includeDetached=false){const sid=flows.get(this)?.session?.session_id;if(sid)placementSession.invalidateSource(sid,includeDetached);},
 cancel(){this.cancelPhotoPick();this.setData({preparationError:""});this.invalidatePendingPlacement(true);this.setData({mode:"box",selecting:true,adjusting:false,editingMask:false,addingRegion:false});void flows.get(this)?.cancel();},
 backManual(){this.cancelPhotoPick();this.invalidatePendingPlacement(true);const f=flows.get(this);if(f)void f.cancel();wx.navigateBack({fail:()=>wx.redirectTo({url:"/pages/select/select"})});},
});
