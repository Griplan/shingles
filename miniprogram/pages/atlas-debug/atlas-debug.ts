import { canPreviewAtlas } from "../../config/development";
import { ATLAS_MANIFEST, ATLAS_REGIONS } from "../../data/atlas.generated";
import { getBodyModel } from "../../data/body-models";
import { AtlasDisplayMode, AtlasGroupFilter, AtlasLayer, AtlasSideFilter } from "../../types/atlas";
import { BodyView, NormalizedRect } from "../../types/dermatome";
import { atlasFocusBounds, atlasLabelName, atlasLabelOptions, atlasLocalFocusBounds, atlasRegionsForView } from "../../utils/atlas-view";

/** Independent developer state. No annotation-session import, API or patient payload. */
Page({
 data:{allowed:false,view:"front" as BodyView,side:"both" as AtlasSideFilter,
  group:"all" as AtlasGroupFilter,
  displayMode:"all" as AtlasDisplayMode,labelId:"",showLabels:false,infoOpen:false,
  layer:null as AtlasLayer|null,focusBounds:null as NormalizedRect|null,layoutRevision:0,
  options:[] as readonly {id:string;name:string}[],pickerIndex:0,
  faceOptions:[] as readonly {id:string;name:string}[],
  selectedText:"选择神经区域",message:"",configuredCount:0,shownCount:0,
  screenLeft:"人体右侧",screenRight:"人体左侧",manifest:ATLAS_MANIFEST},
 onLoad() {this.refresh();},
 onShow() {this.refresh();this.setData({layoutRevision:this.data.layoutRevision+1});},
 onResize() {this.setData({layoutRevision:this.data.layoutRevision+1});},
 /** Every entry and action fails closed; query parameters never participate. */
 refresh() {
  if(!canPreviewAtlas()) {this.setData({allowed:false,layer:null,focusBounds:null});return;}
  const d=this.data,options=atlasLabelOptions(ATLAS_REGIONS,d.view,d.side,d.group);
  const current=atlasRegionsForView(ATLAS_REGIONS,d.view,d.side,d.displayMode,d.labelId,d.group);
  const selected=atlasRegionsForView(ATLAS_REGIONS,d.view,d.side,"single",d.labelId,d.group);
  const message=d.displayMode==="single" && !selected.length?"此视图暂无该区域" :
   d.displayMode==="hidden"?"覆盖层已隐藏":d.group==="trigeminal" && !current.length?"此视图未配置面部三叉神经分区":
   "仅显示当前筛选下已配置区域，不代表全部人体神经分区";
  this.setData({allowed:true,options,pickerIndex:Math.max(0,options.findIndex(o=>o.id===d.labelId)),
   selectedText:atlasLabelName(ATLAS_REGIONS,d.labelId)||"选择神经区域",message,
   faceOptions:atlasLabelOptions(ATLAS_REGIONS,d.view,d.side,"trigeminal").slice(1).map(o=>
    ({id:o.id,name:atlasLabelName(ATLAS_REGIONS,o.id)})),
   configuredCount:atlasRegionsForView(ATLAS_REGIONS,d.view,"both","all","").length,
   shownCount:current.length,screenLeft:d.view==="front"?"人体右侧":"人体左侧",
   screenRight:d.view==="front"?"人体左侧":"人体右侧",
   layer:{atlasVersion:ATLAS_MANIFEST.atlasVersion,templateId:ATLAS_MANIFEST.templateId,
    templateVersion:ATLAS_MANIFEST.templateVersion,geometryId:ATLAS_MANIFEST.geometryId,
    view:d.view,regions:current,showLabels:d.showLabels}});
 },
 switchView(e:WechatMiniprogram.TouchEvent) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const v:unknown=e.currentTarget.dataset.view;
  if(v!=="front" && v!=="back")return;
  this.setData({view:v,focusBounds:null});this.refresh();
 },
 changeMode(e:WechatMiniprogram.TouchEvent) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const mode:unknown=e.currentTarget.dataset.mode;
  if(mode!=="all" && mode!=="single" && mode!=="hidden")return;
  this.setData({displayMode:mode});this.refresh();
 },
 changeGroup(e:WechatMiniprogram.TouchEvent) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const group:unknown=e.currentTarget.dataset.group;
  if(group!=="all" && group!=="trigeminal" && group!=="spinal")return;
  const keep=atlasLabelOptions(ATLAS_REGIONS,this.data.view,this.data.side,group).some(o=>o.id===this.data.labelId);
  this.setData({group,focusBounds:null,...(!keep?{labelId:"",displayMode:this.data.displayMode==="hidden"?"hidden":"all"}:{})});
  this.refresh();
 },
 chooseFace(e:WechatMiniprogram.TouchEvent) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const id:unknown=e.currentTarget.dataset.label;
  if(typeof id!=="string" || !this.data.faceOptions.some(o=>o.id===id))return;
  this.setData({group:"trigeminal",labelId:id,displayMode:"single"});this.refresh();
 },
 chooseLabel(e:WechatMiniprogram.CustomEvent<{value:string}>) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const option=this.data.options[Number(e.detail.value)];if(!option)return;
  // Deliberately preserve viewport until explicit focus/full action.
  this.setData({labelId:option.id,displayMode:option.id?"single":"all"});this.refresh();
 },
 changeSide(e:WechatMiniprogram.TouchEvent) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const side:unknown=e.currentTarget.dataset.side;if(side!=="both" && side!=="left" && side!=="right")return;
  this.setData({side,focusBounds:null});this.refresh();
 },
 toggleLabels(e:WechatMiniprogram.CustomEvent<{value:boolean}>) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  this.setData({showLabels:e.detail.value});this.refresh();
 },
 focusSelected() {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const selected=atlasRegionsForView(ATLAS_REGIONS,this.data.view,this.data.side,"single",this.data.labelId,this.data.group);
  if(!selected.length) {this.setData({message:"请先从分区列表选择当前视图有数据的标签"});return;}
  this.setData({focusBounds:atlasFocusBounds(selected)});
 },
 focusLocal(e:WechatMiniprogram.TouchEvent) {
  if(!canPreviewAtlas()) {this.refresh();return;}
  const target:unknown=e.currentTarget.dataset.focus;
  if(target!=="face" && target!=="left-foot" && target!=="right-foot")return;
  const focus=atlasLocalFocusBounds(getBodyModel(this.data.view),target);
  if(!focus) {
   this.setData({message:target==="face"?"背面未配置面部三叉神经，请切换正面查看":"当前模板没有可用的局部查看范围"});return;
  }
  // Only a viewport change: preserves side, selected label, geometry, and all normalized points.
  this.setData({focusBounds:focus,...(target!=="face" && this.data.view==="back"?
   {message:"本模板背面显示足跟；来源足底不能直接配准，此处未配置足部分区"}:{})});
 },
 fullBody() {if(!canPreviewAtlas()){this.refresh();return;}this.setData({focusBounds:null});},
 clearSelection() {
  if(!canPreviewAtlas()) {this.refresh();return;}
  this.setData({labelId:"",displayMode:"all"});this.refresh();
 },
 toggleInfo() {if(!canPreviewAtlas()){this.refresh();return;}this.setData({infoOpen:!this.data.infoOpen});},
});
