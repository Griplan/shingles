import { getBodyRegion } from "../../data/body-regions";
import { getBodyModel } from "../../data/body-models";
import { BodyRegionProbe, BodyView, BodyViewportEvent, DebugProbe } from "../../types/dermatome";
import { annotationSession } from "../../state/annotation-session";

import {canUseDeveloperTools} from "../../config/environment";
import {canUseAI} from "../../config/ai";

const initialModel=getBodyModel("front");
const EMPTY_DEBUG={probeStatus:"",debugMessage:"轻点人体，查看实际坐标。",screenX:"—",screenY:"—",
  canvasX:"—",canvasY:"—",normalizedX:"—",normalizedY:"—",markerX:"—",markerY:"—"};

Page({
  data: Object.assign({
    view: "front" as BodyView,
    regions: initialModel.regions,
    modelId: initialModel.id,
    modelVersion: initialModel.version,
    logicalWidth: initialModel.logicalWidth,
    logicalHeight: initialModel.logicalHeight,
    selectedRegion: "",
    selectedName: "未选择",
    zoomRegion: "",
    mode: "overview" as "overview" | "focused",
    sheetOpen: false,
    sheetRegions: initialModel.regions,
    candidateIds: [] as readonly string[],
    selectionMessage: "",
    infoOpen: false,
    developerOpen: false,
    debugAllowed:false,aiAllowed:false,
    layoutRevision: 0,
    screenLeft: "人体右侧",
    screenRight: "人体左侧",
    debugEnabled:false,
    cssWidth:"—",cssHeight:"—",physicalWidth:"—" as number|string,
    physicalHeight:"—" as number|string,dpr:"—" as number|string,
    scale:"—",zoom:"—",offsetX:"—",offsetY:"—",
  },EMPTY_DEBUG),
  onShow() {const debugAllowed=canUseDeveloperTools();this.setData({layoutRevision:this.data.layoutRevision+1,debugAllowed,aiAllowed:canUseAI(),...(!debugAllowed?{developerOpen:false,debugEnabled:false}:{})});},
  onResize() { this.setData({layoutRevision:this.data.layoutRevision+1}); },
  switchView(event: WechatMiniprogram.TouchEvent) {
    const view: unknown = event.currentTarget.dataset.view;
    if ((view !== "front" && view !== "back") || view === this.data.view) return;
    const model=getBodyModel(view);
    this.setData(Object.assign({
      view:model.view,regions:model.regions,modelId:model.id,modelVersion:model.version,
      logicalWidth:model.logicalWidth,logicalHeight:model.logicalHeight,
      selectedRegion:"",selectedName:"未选择",zoomRegion:"",
      mode:"overview" as const,sheetOpen:false,sheetRegions:model.regions,candidateIds:[],selectionMessage:"",
      screenLeft: view === "front" ? "人体右侧" : "人体左侧",
      screenRight: view === "front" ? "人体左侧" : "人体右侧",
    },EMPTY_DEBUG));
  },
  selectRegion(event: WechatMiniprogram.TouchEvent) {
    const id: unknown = event.currentTarget.dataset.id;
    if (typeof id !== "string") return;
    this.applySelection(id);
  },
  /** 人体唯一命中和列表选择共用入口；只选择，绝不自动放大。 */
  applySelection(id:string) {
    const region=getBodyRegion(this.data.view,id);
    if(!region)return;
    this.setData({selectedRegion:region.id,selectedName:region.name,zoomRegion:"",mode:"overview",
      sheetOpen:false,candidateIds:[],sheetRegions:getBodyModel(this.data.view).regions,selectionMessage:""});
  },
  chooseFromList(event:WechatMiniprogram.CustomEvent<{id:string}>) {
    if(this.data.sheetOpen && typeof event.detail.id==="string" &&
      this.data.sheetRegions.some(r=>r.id===event.detail.id))this.applySelection(event.detail.id);
  },
  openRegionPicker() {
    this.setData({sheetOpen:true,candidateIds:[],sheetRegions:getBodyModel(this.data.view).regions});
  },
  closeRegionPicker() { this.setData({sheetOpen:false,candidateIds:[]}); },
  onRegionProbe(event:WechatMiniprogram.CustomEvent<BodyRegionProbe>) {
    const p=event.detail;
    if(this.data.debugEnabled||this.data.sheetOpen||this.data.infoOpen||this.data.mode!=="overview"||
      p.view!==this.data.view||p.modelId!==this.data.modelId||p.modelVersion!==this.data.modelVersion)return;
    if(p.status==="unique" && p.regionIds.length===1) {this.applySelection(p.regionIds[0]);return;}
    if(p.status==="ambiguous") {
      const candidates=getBodyModel(this.data.view).regions.filter(r=>p.regionIds.includes(r.id));
      if(candidates.length>1)this.setData({sheetOpen:true,sheetRegions:candidates,
        candidateIds:candidates.map(r=>r.id),selectionMessage:"此处靠近多个部位，请从候选中确认"});
      return;
    }
    const messages={"outside-body":"请轻触人体内的部位，或从列表选择",
      "outside-model":"请轻触人体内的部位，或从列表选择",
      unconfigured:"该位置暂未配置区域，可从列表选择",unavailable:"画布位置正在更新，请重新轻触"};
    if(p.status!=="unique")this.setData({selectionMessage:messages[p.status]});
  },
  zoomIn() {
    if (!this.data.sheetOpen && getBodyRegion(this.data.view, this.data.selectedRegion)) {
      this.setData({ zoomRegion: this.data.selectedRegion, mode:"focused",selectionMessage:"" });
    }
  },
  showFullBody() { this.setData({ zoomRegion: "",mode:"overview",selectionMessage:"" }); },
  openSpecialParts() {
    if(this.data.sheetOpen || this.data.infoOpen)return;
    wx.navigateTo({url:"/pages/special-parts/special-parts",fail:()=>this.setData({selectionMessage:"特殊部位页面未能打开，请重试"})});
  },
  startAnnotation() {
    if(this.data.sheetOpen || this.data.infoOpen || this.data.debugEnabled)return;
    const result=annotationSession.open(this.data.view,this.data.selectedRegion);
    if(!result.ok){this.setData({selectionMessage:result.message});return;}
    this.setData({infoOpen:true});
    wx.navigateTo({url:`/pages/annotate/annotate?sessionId=${encodeURIComponent(result.session.sessionId)}`,
      fail:()=>this.setData({selectionMessage:"标注页面未能打开，请重试；会话仍保留"}),
      complete:()=>this.setData({infoOpen:false})});
  },
  startAI() {
    if(!canUseAI())return;
    if(this.data.sheetOpen||this.data.infoOpen||this.data.debugEnabled||!getBodyRegion(this.data.view,this.data.selectedRegion))return;
    wx.navigateTo({url:`/pages/ai-annotate/ai-annotate?view=${this.data.view}&region=${encodeURIComponent(this.data.selectedRegion)}`,
      fail:()=>this.setData({selectionMessage:"AI页面未能打开，请重试"})});
  },
  toggleDeveloper() {
    if(!canUseDeveloperTools())return;
    this.setData(Object.assign({developerOpen:!this.data.developerOpen,
      debugEnabled:this.data.developerOpen?false:this.data.debugEnabled,
      layoutRevision:this.data.layoutRevision+1},EMPTY_DEBUG));
  },
  showSource() {
    this.setData({infoOpen:true});
    wx.showModal({title:"人体素材说明",content:"Human body with blank labels.svg\n作者：Šlomo；基于 Digital Nomad / Cdang。\nCC0 1.0，允许修改、商业使用和分发。\n来源：commons.wikimedia.org/wiki/File:Human_body_with_blank_labels.svg\n仅为粗粒度身体示意，不是医学皮节图。",showCancel:false,confirmText:"知道了",
      complete:()=>this.setData({infoOpen:false})});
  },
  toggleDebug(event:WechatMiniprogram.CustomEvent<{value:boolean}>) {
    if(!canUseDeveloperTools())return;
    this.setData(Object.assign({debugEnabled:event.detail.value},EMPTY_DEBUG));
  },
  onDebugProbe(event:WechatMiniprogram.CustomEvent<DebugProbe>) {
    const p=event.detail;
    if(!this.data.debugEnabled || this.data.sheetOpen || this.data.infoOpen || p.view!==this.data.view || p.modelId!==this.data.modelId ||
      p.modelVersion!==this.data.modelVersion)return;
    const messages={valid:"有效人体位置", "outside-body":"点击位置不在人体轮廓内",
      "outside-model":"点击位置超出模型范围",unavailable:"画布位置正在更新，请重新点击"};
    this.setData({
      probeStatus:p.status,debugMessage:messages[p.status],
      screenX:p.screen?p.screen.x.toFixed(1):"—",screenY:p.screen?p.screen.y.toFixed(1):"—",
      canvasX:p.canvas?p.canvas.x.toFixed(1):"—",canvasY:p.canvas?p.canvas.y.toFixed(1):"—",
      normalizedX:p.normalized?p.normalized.x.toFixed(4):"—",normalizedY:p.normalized?p.normalized.y.toFixed(4):"—",
      markerX:"—",markerY:"—",
    });
  },
  onViewportChange(event:WechatMiniprogram.CustomEvent<BodyViewportEvent>) {
    const p=event.detail;if(p.view!==this.data.view||p.modelId!==this.data.modelId||p.modelVersion!==this.data.modelVersion)return;
    const v=p.viewport;
    this.setData({cssWidth:v.viewportWidth.toFixed(1),cssHeight:v.viewportHeight.toFixed(1),
      physicalWidth:p.physicalWidth,physicalHeight:p.physicalHeight,dpr:p.dpr,
      scale:v.scale.toFixed(4),zoom:v.zoom.toFixed(3),offsetX:v.offsetX.toFixed(1),offsetY:v.offsetY.toFixed(1),
      markerX:p.markerCanvas?p.markerCanvas.x.toFixed(1):"—",markerY:p.markerCanvas?p.markerCanvas.y.toFixed(1):"—"});
  },
});
