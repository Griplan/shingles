import {canUseDeveloperTools} from "../../config/environment";
import { canMatchReference } from "../../config/development";
import { matchingSession, coverageText } from "../../state/matching-session";
import { annotationSession, SessionAction, sessionToken } from "../../state/annotation-session";
import { AnnotationLayer, AnnotationPointEvent, AnnotationSession, AnnotationToken } from "../../types/annotation";
import { BodyView, DebugProbe, NormalizedRect, ViewportTransform } from "../../types/dermatome";
import { getBodyModel } from "../../data/body-models";

import { ATLAS_MANIFEST, ATLAS_REGIONS } from "../../data/atlas.generated";
import { AtlasLayer } from "../../types/atlas";
import { CandidateLabel, LabelRail, presentation, placeLabels, screenSide, sideName, stageHeight } from "../../utils/matching-presentation";
import { atlasFocusBounds } from "../../utils/atlas-view";
import { requestTiming } from "../../services/api";
import { EXPERIENCE } from "../../config/experience";
import {placementSession} from "../../state/placement-session";
import {consumePlacementView} from "../../state/placement-navigation";
interface PageLife { active:boolean; sequence:number; request:number; viewport?:ViewportTransform; viewportView?:BodyView; sceneKey?:string; started?:number; metrics?:Record<string,unknown> }
const emptyRail=():LabelRail=>({items:[],height:0,overflow:false});
const lives=new WeakMap<object,PageLife>();
Page({
  data:{resultMode:false,loading:false,matchStatus:"idle",matchMessage:"",scope:"",selected:"",selectedName:"",selectedRatio:"",
    candidates:[] as CandidateLabel[],leftRail:emptyRail(),rightRail:emptyRail(),unspecified:[] as CandidateLabel[],
    scopes:[] as {id:string;name:string}[],atlas:null as AtlasLayer|null,focusBounds:null as NormalizedRect|null,
    stageHeight:360,retainedViewport:null as ViewportTransform|null,editableAIId:"",editableAIName:"",openingPlacement:false,coveredText:"",uncoveredText:"",coverageStatus:"",hasCoverage:false,sceneId:0,sceneReady:false,
    overlayKey:"",motionEnabled:true,overlayMs:EXPERIENCE.overlayMs,feedbackMs:EXPERIENCE.feedbackMs,infoOpen:false,preparingView:false,
    debugAllowed:false,renderError:false,source:ATLAS_MANIFEST,detailsMessage:"",performanceText:"",hasAIPlacement:false,matchingAllowed:false,matchingReady:false,openingResult:false,matchingMessage:"",sessionId:"",session:null as AnnotationSession|null,layer:null as AnnotationLayer|null,
    view:"front" as BodyView,phase:"editing",mode:"readonly",zoomRegion:"",entryRegionId:"",
    viewLabel:"正面",stateLabel:"准备中",pointCount:0,completedCount:0,frontCount:0,backCount:0,
    regions:[] as {id:string;label:string}[],selectedId:"",debugEnabled:false,debugText:"",
    dialogOpen:false,layoutRevision:0,error:"",message:"",modelLabel:""},
  onLoad(query:Record<string,string|undefined>) {
    lives.set(this,{active:true,sequence:0,request:0});
    if(!query.sessionId){this.setData({error:"缺少运行会话，请返回选择页重新开始"});return;}
    this.setData({sessionId:query.sessionId,resultMode:query.result==="1"});this.measureLayout();this.receivePlacementView();this.syncSession();
  },
  onShow() {
    const life=lives.get(this);if(life){life.active=true;life.sequence++;}
    this.setData({dialogOpen:false,openingResult:false,openingPlacement:false,preparingView:false});
    if(this.data.sessionId){this.receivePlacementView();this.syncSession();}
  },
  onHide() { const life=lives.get(this);if(life){life.active=false;life.sequence++;} matchingSession.cancelPending(); },
  onUnload() { matchingSession.cancelPending();lives.delete(this); /* 会话已逐操作写入内存，不在此清空或延迟保存。 */ },
  onResize() {this.measureLayout();this.syncSession();},
  receivePlacementView(){
    const retained=consumePlacementView(this.data.sessionId,matchingSession.refresh().response?.request_id);
    if(retained&&annotationSession.snapshot()?.currentView===retained.view)this.setData({resultMode:true,scope:"",selected:"",focusBounds:null,
      retainedViewport:retained.viewport,stageHeight:retained.viewport.viewportHeight,layoutRevision:this.data.layoutRevision+1});
  },
  measureLayout() {
    let height=600;try{height=wx.getWindowInfo().windowHeight||height;}catch{/* Canvas仍会校验真实尺寸。 */}
    const next=stageHeight(height);if(next!==this.data.stageHeight)this.setData({stageHeight:next,layoutRevision:this.data.layoutRevision+1});
  },
  syncSession(message="") {
    const result=annotationSession.read(this.data.sessionId);
    if(!result.ok){this.setData({error:result.message,session:null,layer:null});return;}
    const s=result.session,view=s.currentView,current=s.views[view],draft=current.draft;
    const entryRegionId=draft?.navigation.entryRegionId || current.focusRegionId || this.data.entryRegionId;
    const validEntry=getBodyModel(view).regions.some(r=>r.id===entryRegionId)?entryRegionId:"";
    const hasAIPlacement=[...s.views.front.completed,...s.views.back.completed].some(p=>p.geometry || p.source?.kind==="ai_assisted");
    const started=Date.now(),matching=matchingSession.refresh(),allowed=canMatchReference();
    const resultMode=this.data.resultMode;
    const response=allowed?matching.response:null,show=resultMode && s.phase==="review" && !!response;
    const scopes=current.completed.map((p,i)=>({id:p.id,name:`标注${i+1}`}));
    const scope=scopes.some(p=>p.id===this.data.scope)?this.data.scope:"";
    const ai=current.completed.filter(p=>p.source?.kind==="ai_assisted"&&p.geometry);
    const target=resultMode?(scope?ai.find(p=>p.id===scope):ai.length===1?ai[0]:undefined):ai.find(p=>p.id===current.selectedId);
    const coverage=show?(scope?response?.lesions.find(c=>c.lesion_ids[0]===scope && c.view===view):response?.views.find(c=>c.view===view)):null;
    let selected=coverage?.candidates.some(c=>c.candidate_id===this.data.selected)?this.data.selected:"";
    let candidates:CandidateLabel[]=[],atlas:AtlasLayer|null=null,matchMessage=matching.status==="error"||matching.status==="stale"?matching.message:"";
    let matchStatus=matching.status;
    try {
      if(show){const display=presentation(coverage?.candidates||[],ATLAS_REGIONS,view,selected);candidates=display.labels;
        atlas={atlasVersion:response.identity.atlas_version,templateId:response.identity.template_id,templateVersion:response.identity.template_version,
          geometryId:response.identity.geometry_id,view,regions:display.regions,showLabels:false};}
    }catch(e){matchStatus="error";matchMessage=(e as Error).message;selected="";}
    const candidate=candidates.find(c=>c.id===selected),life=lives.get(this);
    const vp=life?.viewportView===view?life.viewport||null:null;
    const railHeight=this.data.stageHeight-44;
    const leftRail=placeLabels(candidates.filter(c=>screenSide(c.side,view)==="left"),railHeight,vp);
    const rightRail=placeLabels(candidates.filter(c=>screenSide(c.side,view)==="right"),railHeight,vp);
    // 几何失效改变overlayKey，组件立即丢弃旧颜色；返回编辑仍可淡出有效缓存。
    const overlayKey=[s.sessionId,response?.request_id||"none",view,scope].join(":");
    const sceneKey=JSON.stringify([overlayKey,resultMode,selected,s.revision,this.data.focusBounds,this.data.motionEnabled]);
    const changed=life?.sceneKey!==sceneKey;if(life)life.sceneKey=sceneKey;
    const patch={debugAllowed:canUseDeveloperTools(),...(!canUseDeveloperTools()?{debugEnabled:false}:{}),editableAIId:target?.id||"",editableAIName:target?`调整 AI 标注 ${current.completed.indexOf(target)+1} 位置`:"",hasAIPlacement,resultMode,matchingAllowed:allowed,matchingReady:matching.status==="ready",matchingMessage:"",error:"",session:s,view,phase:s.phase,viewLabel:view==="front"?"正面":"背面",
      layer:{...sessionToken(s),completed:show&&scope?current.completed.filter(p=>p.id===scope):current.completed,draft,
        selectedId:show?null:current.selectedId,fillMode:atlas?"outline" as const:"filled" as const},
      mode:s.phase==="editing" && draft?"draw":"readonly",zoomRegion:current.focusRegionId||"",
      entryRegionId:validEntry,pointCount:draft?.vertices.length||0,completedCount:current.completed.length,
      frontCount:s.views.front.completed.length,backCount:s.views.back.completed.length,
      selectedId:current.selectedId||"",regions:current.completed.map((p,i)=>({id:p.id,label:p.source?.kind==="ai_assisted"?`AI标注 ${i+1}`:`区域 ${i+1}`})),
      stateLabel:resultMode?"参考结果":s.phase==="review"?"确认范围":draft?"圈选范围":"标注管理",
      modelLabel:`${s.basis.templateId} / ${s.basis.templateVersion}`,message,
      loading:matching.status==="loading",matchStatus,matchMessage,scope,scopes,selected,candidates,atlas,overlayKey,
      selectedName:candidate?`${candidate.name} · ${sideName(candidate.side)}`:"",selectedRatio:candidate?.ratio||"",
      leftRail,rightRail,unspecified:candidates.filter(c=>screenSide(c.side,view)==="unspecified"),
      coveredText:coverage?coverageText(coverage.covered_ratio):"",uncoveredText:coverage?coverageText(coverage.uncovered_ratio):"",
      coverageStatus:coverage?.coverage_status||"",hasCoverage:!!coverage,
      sceneId:changed?this.data.sceneId+1:this.data.sceneId,
      sceneReady:changed && (!vp || !this.data.candidates.length && !!candidates.length)?false:this.data.sceneReady};
    // 不让提示、说明或重复sync再次发送未变的大型几何属性。
    const changedPatch:Record<string,unknown>={};
    for(const key of Object.keys(patch)){const value=(patch as Record<string,unknown>)[key];
      if(JSON.stringify((this.data as Record<string,unknown>)[key])!==JSON.stringify(value))changedPatch[key]=value;}
    if(Object.keys(changedPatch).length)this.setData(changedPatch);
    if(life && changed)life.metrics={...life.metrics,prepareMs:Date.now()-started};
  },
  act(action:SessionAction,token?:AnnotationToken) {
    const s=this.data.session;
    if(!lives.get(this)?.active || !s || this.data.error || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView)return;
    if(this.data.debugEnabled && !["focus","switch"].includes(action.type)) {
      this.setData({message:"请先关闭坐标调试，再继续标注操作"});return;
    }
    const result=annotationSession.dispatch(token||sessionToken(s),action);
    if(result.ok)this.syncSession();else this.setData({message:result.message});
  },
  onAnnotationPoint(event:WechatMiniprogram.CustomEvent<AnnotationPointEvent>) {
    const p=event.detail,s=this.data.session;
    if(!lives.get(this)?.active || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView || this.data.debugEnabled ||
      this.data.mode!=="draw" || !s || p.sessionId!==s.sessionId || p.view!==s.currentView || p.revision!==s.revision)return;
    if(p.status==="valid" && p.normalized)this.act({type:"add",point:p.normalized},p);
    else this.setData({message:p.status==="unavailable"?"画布位置正在更新，请重新轻触":"请轻触人体轮廓内的位置，不会吸附到边缘"});
  },
  undo() {this.act({type:"undo"});},
  closePolygon() {this.act({type:"close"});},
  newRegion() {this.act({type:"start"});},
  selectPolygon(event:WechatMiniprogram.TouchEvent) {
    if(this.data.mode==="draw" || this.data.phase==="review" || this.data.debugEnabled || this.data.dialogOpen || this.data.infoOpen)return;
    const id:unknown=event.currentTarget.dataset.id;if(typeof id==="string")this.act({type:"select",id});
  },
  /** 原生确认期间隐藏Canvas并阻止输入；迟到、隐藏或换revision的响应不再执行。 */
  ask(items:string[],choose:(index:number,token:AnnotationToken)=>void) {
    const s=this.data.session,life=lives.get(this);if(!s || !life?.active || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView)return;
    const token=sessionToken(s),sequence=++life.sequence;this.setData({dialogOpen:true});
    const current=()=>lives.get(this)===life && life.active && sequence===life.sequence;
    wx.showActionSheet({itemList:items,
      success:r=>{if(current()){this.setData({dialogOpen:false});choose(r.tapIndex,token);}},
      complete:()=>{if(current())this.setData({dialogOpen:false});}});
  },
  cancelDraft() {
    if(!this.data.pointCount){this.act({type:"cancel"});return;}
    this.ask(["继续绘制","放弃当前草稿（保留已完成区域）"],(index,token)=>{
      if(index===1)this.act({type:"cancel"},token);
    });
  },
  deleteSelected() {
    const s=this.data.session,life=lives.get(this),selected=this.data.regions.find(r=>r.id===this.data.selectedId);
    if(!s || !life?.active || !selected || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView || this.data.debugEnabled)return;
    const token=sessionToken(s),sequence=++life.sequence;
    this.setData({dialogOpen:true});
    const current=()=>lives.get(this)===life && life.active && sequence===life.sequence;
    wx.showModal({title:`删除${this.data.viewLabel} ${selected.label}？`,
      content:"仅删除这一片已完成区域，其他区域保持不变。",confirmText:"删除",confirmColor:"#ac5239",
      success:r=>{if(current()){this.setData({dialogOpen:false});if(r.confirm)this.act({type:"delete",id:selected.id},token);}},
      complete:()=>{if(current())this.setData({dialogOpen:false});}});
  },
  switchView(event:WechatMiniprogram.TouchEvent) {
    const view:unknown=event.currentTarget.dataset.view;
    if((view!=="front" && view!=="back") || this.data.dialogOpen || this.data.infoOpen)return;
    if(view===this.data.view){const life=lives.get(this);if(life && this.data.preparingView){life.sequence++;this.setData({preparingView:false});}return;}
    const switchTo=async(resolution?:"close"|"discard",token?:AnnotationToken)=>{
      const life=lives.get(this);if(!life)return;const seq=++life.sequence;
      this.setData({preparingView:true});
      const canvas=typeof this.selectComponent==="function"?this.selectComponent("#work-canvas"):null;
      const ready=canvas?.prepareView?await canvas.prepareView(view):true;
      if(lives.get(this)!==life || !life.active || life.sequence!==seq)return;
      this.setData({preparingView:false});
      if(!ready){this.setData({message:"另一面人体尚未就绪，请稍后重试"});return;}
      this.setData({scope:"",selected:"",debugText:"",focusBounds:null,retainedViewport:null});this.act({type:"switch",view,resolution},token);
    };
    if(this.data.pointCount)this.ask(["继续当前绘制","放弃草稿并切换","闭合有效区域后切换"],(index,token)=>{
      if(index===1)switchTo("discard",token);else if(index===2)switchTo("close",token);
    });else switchTo();
  },
  fullBody() {if(!lives.get(this)?.active || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView)return;
    this.setData({focusBounds:null,retainedViewport:null});this.act({type:"focus",regionId:null});},
  focusEntry() {if(!lives.get(this)?.active || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView)return;
    this.setData({focusBounds:null,retainedViewport:null});if(this.data.entryRegionId)this.act({type:"focus",regionId:this.data.entryRegionId});},
  finish() {
    if(this.data.debugEnabled || this.data.dialogOpen || this.data.infoOpen)return;
    if(!this.data.frontCount && !this.data.backCount){this.setData({message:"至少闭合一片有效区域后才能完成标注"});return;}
    if(this.data.pointCount)this.ask(["继续绘制当前草稿","放弃草稿后完成标注","取消此次完成操作"],(index,token)=>{
      if(index===1)this.act({type:"review",discardDraft:true},token);
    });else this.act({type:"review"});
  },
  continueEditing() {const life=lives.get(this);if(!life?.active || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView)return;
    life.request++;matchingSession.cancelPending();this.setData({resultMode:false,selected:"",scope:""});this.act({type:"edit"});},
  backToEdit() {this.continueEditing();},
  editAIPlacement(){
    const life=lives.get(this);if(!life?.active||this.data.loading||this.data.openingPlacement||this.data.dialogOpen||this.data.infoOpen||this.data.preparingView||this.data.debugEnabled)return;
    this.syncSession();if(!this.data.editableAIId)return;
    const opened=placementSession.edit(this.data.editableAIId);
    if(!opened.ok){this.setData({message:opened.message});return;}
    this.setData({openingPlacement:true});wx.navigateTo({url:`/pages/placement/placement?draftId=${encodeURIComponent(opened.draft.id)}`,
      fail:()=>{if(lives.get(this)===life&&life.active)this.setData({openingPlacement:false,message:"放置页面未能打开，原标注保留"});}});
  },
  async viewMatches() {
    const s=this.data.session,life=lives.get(this);
    if(!life?.active || !canMatchReference() || this.data.loading || this.data.dialogOpen || this.data.infoOpen || this.data.preparingView || this.data.debugEnabled || !s)return;
    if(s.phase!=="review" || s.views.front.draft || s.views.back.draft){this.setData({message:"请先完成标注并处理未闭合草稿"});return;}
    if(!s.views.front.completed.length && !s.views.back.completed.length)return;
    this.setData({resultMode:true,selected:""});this.syncSession();
    if(matchingSession.refresh().status==="ready")return;
    const sequence=++life.request,started=Date.now(),work=matchingSession.calculate();this.syncSession();await work;
    if(lives.get(this)!==life || !life.active || sequence!==life.request)return;
    const response=matchingSession.refresh().response,timing=requestTiming();
    life.metrics={requestAndValidationMs:Date.now()-started,...(response && timing?.requestId===response.request_id?{networkMs:timing.networkMs}:{})};this.syncSession();
  },
  calculate() {return this.viewMatches();},
  chooseCandidate(e:WechatMiniprogram.TouchEvent) {
    this.syncSession();const id:unknown=e.currentTarget.dataset.id;
    if(this.data.matchStatus!=="ready" || !this.data.resultMode || !this.data.sceneReady || this.data.preparingView ||
       this.data.infoOpen || typeof id!=="string" || !this.data.candidates.some(c=>c.id===id))return;
    this.setData({selected:this.data.selected===id?"":id});this.syncSession();
  },
  showAll() {this.syncSession();if(!this.data.matchingAllowed || !this.data.resultMode || this.data.infoOpen || this.data.preparingView)return;
    this.setData({selected:""});this.syncSession();},
  chooseScope(e:WechatMiniprogram.TouchEvent) {
    this.syncSession();const id:unknown=e.currentTarget.dataset.id;
    if(typeof id!=="string" || this.data.preparingView || this.data.infoOpen || !this.data.matchingAllowed || !this.data.resultMode ||
      (id!=="" && !this.data.scopes.some(scope=>scope.id===id)))return;
    this.setData({scope:id,selected:""});this.syncSession();
  },
  focusSelected() {this.syncSession();if(this.data.matchingAllowed && !this.data.infoOpen && !this.data.preparingView && this.data.selected&&this.data.atlas){
    this.setData({focusBounds:atlasFocusBounds(this.data.atlas.regions),retainedViewport:null});this.syncSession();}},
  onViewportChange(e:WechatMiniprogram.CustomEvent<{view:BodyView;modelId:string;modelVersion:string;viewport:ViewportTransform}>) {
    const life=lives.get(this),d=e.detail,m=getBodyModel(this.data.view);if(!life?.active||d.view!==this.data.view||d.modelId!==m.id||d.modelVersion!==m.version)return;
    const changed=life.viewportView!==d.view || JSON.stringify(life.viewport)!==JSON.stringify(d.viewport);
    life.viewport=d.viewport;life.viewportView=d.view;
    if(changed){const height=this.data.stageHeight-44,labels=this.data.candidates;
      this.setData({leftRail:placeLabels(labels.filter(c=>screenSide(c.side,this.data.view)==="left"),height,d.viewport),
        rightRail:placeLabels(labels.filter(c=>screenSide(c.side,this.data.view)==="right"),height,d.viewport)});}
  },
  onSceneReady(e:WechatMiniprogram.CustomEvent<{sceneId:number;view:BodyView}>) {
    if(lives.get(this)?.active && e.detail.sceneId===this.data.sceneId && e.detail.view===this.data.view)this.setData({sceneReady:true,renderError:false});
  },
  onRenderError() {this.setData({renderError:true,sceneReady:false});},
  onRenderStats(e:WechatMiniprogram.CustomEvent<Record<string,unknown>>) {
    const life=lives.get(this);if(!life?.active || e.detail.sceneId!==this.data.sceneId)return;
    // 说明关闭会恢复原生Canvas；同一场景的恢复重绘不能覆盖刚完成的过渡耗时。
    if(life.metrics?.sceneId===e.detail.sceneId && life.metrics.width===e.detail.width && life.metrics.height===e.detail.height)return;
    life.metrics={...life.metrics,...e.detail};if(this.data.infoOpen)this.updatePerformance();
  },
  updatePerformance() {const m=lives.get(this)?.metrics;this.setData({performanceText:m?JSON.stringify(m):"尚无本次绘制记录"});},
  openInfo() {this.setData({infoOpen:true,detailsMessage:""});this.updatePerformance();},
  closeInfo() {this.setData({infoOpen:false});},
  swallow() {},
  toggleMotion(e:WechatMiniprogram.CustomEvent<{value:boolean}>) {this.setData({motionEnabled:!e.detail.value});this.syncSession();},
  copySource(e:WechatMiniprogram.TouchEvent) {
    const urls:Record<string,string>={source:ATLAS_MANIFEST.sourceUrl,backSource:"https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg",license:"https://creativecommons.org/licenses/by-sa/4.0/",body:"https://commons.wikimedia.org/wiki/File:Human_body_with_blank_labels.svg",bodyLicense:"https://creativecommons.org/publicdomain/zero/1.0/"};
    const key=e.currentTarget.dataset.id,url=urls[key];if(!url)return;
    wx.setClipboardData({data:url,success:()=>this.setData({detailsMessage:"链接已复制，可粘贴到浏览器访问"}),fail:()=>this.setData({detailsMessage:"复制失败，可长按说明中的地址复制"})});
  },

  backToSelection() {
    const navigate=()=>{
      const pages=typeof getCurrentPages==="function"?getCurrentPages():[];
      let index=-1;for(let i=pages.length-2;i>=0;i--)if(pages[i].route==="pages/select/select"){index=i;break;}
      if(pages.length && index<0){wx.redirectTo({url:"/pages/select/select"});return;}
      wx.navigateBack({delta:index<0?1:pages.length-1-index,fail:()=>wx.redirectTo({url:"/pages/select/select"})});
    };
    if(this.data.dialogOpen)return;
    if(this.data.pointCount)this.ask(["保留草稿并返回选择页","放弃当前草稿后返回","继续编辑"],(index,token)=>{
      if(index===0)navigate();
      else if(index===1){const result=annotationSession.dispatch(token,{type:"cancel"});
        if(result.ok)navigate();else this.setData({message:result.message});}
    });else navigate();
  },
  toggleDebug(event:WechatMiniprogram.CustomEvent<{value:boolean}>) {
    if(!canUseDeveloperTools())return;
    if(!this.data.dialogOpen)this.setData({debugEnabled:event.detail.value,debugText:"",layoutRevision:this.data.layoutRevision+1});
  },
  onDebugProbe(event:WechatMiniprogram.CustomEvent<DebugProbe>) {
    const p=event.detail,s=this.data.session;
    if(!this.data.debugEnabled || this.data.dialogOpen || !s || p.view!==s.currentView ||
      p.modelId!==s.basis.templateId || p.modelVersion!==s.basis.templateVersion)return;
    this.setData({debugText:p.normalized?`标准坐标 ${p.normalized.x.toFixed(4)} / ${p.normalized.y.toFixed(4)}`:
      p.status==="unavailable"?"画布正在更新，请重试":"该位置不在人体内"});
  },
});
