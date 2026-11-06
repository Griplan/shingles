import {AIPhotoFlow,AI_WARNINGS} from "../../state/ai-session";
import {aiTransport} from "../../services/ai";
import {canUseAI,photoByteLimit} from "../../config/ai";
import {PhotoBox,PhotoPoint,BrushStroke} from "../../types/ai";
import {getBodyRegion} from "../../data/body-regions";
import {BodyView} from "../../types/dermatome";
import {placementSession} from "../../state/placement-session";
import {usingPublicIpDebug} from "../../config/servers";
const flows=new WeakMap<object,AIPhotoFlow>();
const contexts=new WeakMap<object,{view:BodyView;regionId:string}>();
const timers=new WeakMap<object,ReturnType<typeof setInterval>>();
const privacy="照片仅发送至本项目配置的后端，临时用于AI辅助圈定范围，不作诊断。会话30分钟失效，取消或返回会请求删除。受控云端停启保留未过期数据，过期后定期清理。当前仅限公开或合成测试图片，请勿上传真实患者照片。";
const photoPrivacy=()=>usingPublicIpDebug()?"当前使用HTTP公网调试，图片和临时会话不加密。只可选择公开授权或合成测试图片，严禁真实患者照片。照片临时用于AI辅助圈定范围，需自行确认；30分钟失效，取消或返回会请求删除。":privacy;
Page({
 data:{available:false,context:"",photo:"",photoWidth:0,photoHeight:0,mask:"",mode:"box",phase:"empty",error:"",cleanupWarning:"",
  points:[] as PhotoPoint[],box:null as PhotoBox|null,additionalBoxes:[] as PhotoBox[],warnings:[] as string[],
  editingMask:false,brushRadius:.02,brushSize:20,canUndoBrush:false,pendingBrush:false,addingRegion:false,strategy:"context_crop",
  canConfirm:false,renderReady:false,canUndo:false,layoutRevision:0,hasPrompt:false,
  selecting:true,adjusting:false,working:false,previewing:false,hasResult:false,canCycle:false,failed:false,openingPlacement:false,hasPendingPlacement:false},
 onLoad(query:Record<string,string>){
  const view=query.view,region=(view==="front"||view==="back")?getBodyRegion(view,query.region):null;
  this.setData({available:canUseAI()&&!!region,context:region?`${view==="front"?"正面":"背面"} · ${region.name}`:"请返回选择身体部位"});
  if(region&&(view==="front"||view==="back"))contexts.set(this,{view,regionId:region.id});
  flows.set(this,new AIPhotoFlow(aiTransport,()=>this.syncFlow()));
  timers.set(this,setInterval(()=>{const f=flows.get(this);if(f?.session&&f.session.expires_at*1000<=Date.now()){
   placementSession.invalidateSource(f.session.session_id);
   void f.cancel();f.error="照片已过期并清理，请重新上传";this.syncFlow();}},5000));
 },
 onUnload(){const f=flows.get(this);if(f?.session)placementSession.invalidateSource(f.session.session_id);flows.delete(this);contexts.delete(this);const timer=timers.get(this);if(timer)clearInterval(timer);timers.delete(this);if(f)void f.cancel();},
 onShow(){this.setData({available:canUseAI()&&contexts.has(this),layoutRevision:this.data.layoutRevision+1,openingPlacement:false,hasPendingPlacement:placementSession.hasPendingSource(flows.get(this)?.confirmed||null)});},onResize(){this.setData({layoutRevision:this.data.layoutRevision+1});},
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
  if(!this.data.available||this.data.phase==="uploading")return;
  wx.showModal({title:"照片用途与隐私",content:photoPrivacy(),confirmText:"同意选择",success:r=>{
   if(!r.confirm||!flows.has(this))return;
   wx.chooseMedia({count:1,mediaType:["image"],sourceType:[source],sizeType:["original"],success:chosen=>{
    const file=chosen.tempFiles[0];if(!flows.has(this)||!file)return;
    if(file.size>photoByteLimit()){wx.showToast({title:"照片过大，请选择"+Math.round(photoByteLimit()/1024/1024)+"MiB以内的图片",icon:"none"});return;}
    this.invalidatePendingPlacement();this.setData({mode:"box",adjusting:false,selecting:true,editingMask:false,addingRegion:false});void flows.get(this)!.replace(file.tempFilePath);
   },fail:e=>{if(!/cancel/.test(e.errMsg))wx.showToast({title:"未能选择照片，请重试",icon:"none"});}});
  }});
 },
 showPrivacy(){wx.showModal({title:"照片用途与隐私",content:photoPrivacy(),showCancel:false});},
 onPrompt(e:WechatMiniprogram.CustomEvent<{box:PhotoBox|null;point:PhotoPoint|null}>){
  const f=flows.get(this);if(!f)return;
  if(e.detail.box&&this.data.addingRegion){this.setData({addingRegion:false,selecting:false});void f.addBox(e.detail.box);}
  else if(e.detail.box&&this.data.selecting&&!this.data.adjusting)void f.selectBox(e.detail.box);
  else if(e.detail.point&&this.data.adjusting)f.edit(null,e.detail.point);
 },
 boxInvalid(){wx.showToast({title:"圈选范围太小，请稍微扩大",icon:"none"});},
 reselect(){if(this.data.phase==="confirming")return;this.invalidatePendingPlacement();this.setData({mode:"box",selecting:true,adjusting:false,editingMask:false,addingRegion:false});flows.get(this)?.reset();},
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
 confirm(){if(this.data.renderReady&&!this.data.adjusting&&!this.data.editingMask)void flows.get(this)?.confirm();},
 placeOnBody(){
  const f=flows.get(this),context=contexts.get(this),source=f?.confirmed;
  if(!f||!context||!source||f.phase!=="confirmed"||this.data.openingPlacement)return;
  const result=placementSession.open(source,context.view,context.regionId,()=>flows.get(this)===f&&f.confirmed===source&&!!f.session&&f.session.expires_at*1000>Date.now());
  if(!result.ok){this.setData({error:result.message});return;}
  this.setData({openingPlacement:true});wx.navigateTo({url:`/pages/placement/placement?draftId=${encodeURIComponent(result.draft.id)}`,
   fail:()=>this.setData({openingPlacement:false,error:"放置页面未能打开，照片分割结果仍保留"})});
 },
 renderState(e:WechatMiniprogram.CustomEvent<{source:string;mask:string;ready:boolean}>){
  const detail=e.detail;
  wx.nextTick(()=>{if(flows.has(this)&&detail.source===this.data.photo&&detail.mask===this.data.mask&&this.data.renderReady!==detail.ready)
    this.setData({renderReady:detail.ready});});
 },
 invalidatePendingPlacement(){const sid=flows.get(this)?.session?.session_id;if(sid)placementSession.invalidateSource(sid);},
 cancel(){this.invalidatePendingPlacement();this.setData({mode:"box",selecting:true,adjusting:false,editingMask:false,addingRegion:false});void flows.get(this)?.cancel();},
 backManual(){this.invalidatePendingPlacement();const f=flows.get(this);if(f)void f.cancel();wx.navigateBack({fail:()=>wx.redirectTo({url:"/pages/select/select"})});},
});
