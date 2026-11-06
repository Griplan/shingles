import {getLocalModel,isLocalSurfaceView} from "../../data/local-models";
import {LocalSurfaceView,PalmSession} from "../../types/palm";
import {AnnotationLayer} from "../../types/annotation";
import {AtlasRegion} from "../../types/atlas";
import {MatchCandidate} from "../../types/evaluate";
import {NormalizedPoint,NormalizedRect,ViewportTransform} from "../../types/dermatome";
import {palmSession,palmToken} from "../../state/palm-session";
import {palmMatching} from "../../state/palm-matching-session";
import {canMatchReference,canPreviewAtlas} from "../../config/development";
import {coverageText} from "../../state/matching-session";
import {placeLabels,candidateRegions,CandidateLabel,LabelRail} from "../../utils/matching-presentation";
const isPalm=isLocalSurfaceView;
const lives=new WeakMap<object,{active:boolean;sequence:number}>();
const emptyRail:LabelRail={items:[],height:320,overflow:false};
function focus(points:readonly NormalizedPoint[]):NormalizedRect|null {
 if(!points.length)return null;let x=1,y=1,right=0,bottom=0;
 for(const p of points){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 const w=Math.max(.06,right-x),h=Math.max(.06,bottom-y),pad=.08;
 x=Math.min(.94,Math.max(0,x-w*pad));y=Math.min(.94,Math.max(0,y-h*pad));right=Math.min(1,right+w*pad);bottom=Math.min(1,bottom+h*pad);
 return {x,y,width:Math.max(.06,right-x),height:Math.max(.06,bottom-y)};
}
Page({
 data:{partName:"手掌",leftView:"palm-left" as LocalSurfaceView,rightView:"palm-right" as LocalSurfaceView,view:"palm-left" as LocalSurfaceView,title:"左手掌",session:null as PalmSession|null,layer:null as AnnotationLayer<LocalSurfaceView>|null,
  mode:"draw" as "draw"|"inspect",phase:"editing" as "editing"|"review",pointCount:0,completedCount:0,leftCount:0,rightCount:0,
  selectedId:"",regions:[] as {id:string;label:string}[],message:"",error:"",loading:false,layoutRevision:0,
  focusBounds:null as NormalizedRect|null,viewport:null as ViewportTransform|null,stageHeight:400,
  resultMode:false,previewMode:false,selected:"",labels:[] as CandidateLabel[],rail:emptyRail,
  atlasRegions:[] as readonly AtlasRegion<LocalSurfaceView>[],atlasReady:false,atlasBlocked:"",matchingAllowed:false,previewAllowed:false,
  coverage:"",infoOpen:false,sourceTitle:"",sourceUrl:"",attribution:"",handAttribution:"",handSource:"",orientation:"掌侧"},
 onLoad(options:Record<string,string|undefined>){
  lives.set(this,{active:true,sequence:0});
  if(!isPalm(options.view)){this.setData({error:"当前部位视图不存在，请返回重新选择"});return;}
  let height=680;try{height=wx.getWindowInfo().windowHeight;}catch{/* test adapter */}
  this.setData({stageHeight:Math.max(300,Math.min(460,height-250))});this.openView(options.view);
 },
 onShow(){const life=lives.get(this);if(life)life.active=true;this.setData({layoutRevision:this.data.layoutRevision+1});if(this.data.session)this.sync();},
 onHide(){const life=lives.get(this);if(life){life.active=false;life.sequence++;}palmMatching.forView(this.data.view).cancelPending();this.setData({loading:false});},
 onUnload(){const life=lives.get(this);if(life){life.active=false;life.sequence++;}palmMatching.forView(this.data.view).cancelPending();lives.delete(this);},
 onResize(){this.setData({layoutRevision:this.data.layoutRevision+1,viewport:null});},
 openView(view:LocalSurfaceView){
  const life=lives.get(this);if(life)life.sequence++;palmMatching.forView(this.data.view).cancelPending();
  const result=palmSession.open(view);if(!result.ok){this.setData({error:result.message});return;}
  const model=getLocalModel(view);
  const sole=view.startsWith("sole-"),left=view.endsWith("-left"),partName=sole?"脚底":"手掌";
  wx.setNavigationBarTitle?.({title:partName+"病灶标注"});
  this.setData({view,title:model.name,partName,leftView:sole?"sole-left":"palm-left",rightView:sole?"sole-right":"palm-right",orientation:sole?(left?"大脚趾在左 · 足底":"大脚趾在右 · 足底"):(left?"拇指在左 · 掌侧":"拇指在右 · 掌侧"),session:result.session,
   resultMode:false,previewMode:false,selected:"",focusBounds:null,viewport:null,loading:false,message:"",error:"",layoutRevision:this.data.layoutRevision+1,
   atlasReady:model.atlas.technicalReady,atlasBlocked:model.atlas.blockedReason,matchingAllowed:canMatchReference(),previewAllowed:canPreviewAtlas(),
   sourceTitle:model.atlas.sourceTitle,sourceUrl:model.atlas.sourceUrl,attribution:model.atlas.attribution,
   handAttribution:model.resource.attribution+" · "+model.resource.license,handSource:model.resource.url});
  this.sync();
 },
 switchView(e:WechatMiniprogram.TouchEvent){const view=e.currentTarget.dataset.view;if(isPalm(view)&&view!==this.data.view)this.openView(view);},
 sync(){const s=this.data.session;if(!s)return;const result=palmSession.read(this.data.view,s.sessionId);
  if(!result.ok){this.setData({error:result.message});return;}
  const session=result.session,state=session.state,match=palmMatching.forView(session.view).refresh();
  const resultMode=this.data.resultMode&&match.status==="ready";
  this.setData({session,phase:session.phase,mode:state.draft?"draw":"inspect",pointCount:state.draft?.vertices.length||0,
   completedCount:state.completed.length,selectedId:state.selectedId||"",regions:state.completed.map((p,i)=>({id:p.id,label:`标注 ${i+1}`})),
   leftCount:palmSession.snapshot(this.data.leftView)?.state.completed.length||0,rightCount:palmSession.snapshot(this.data.rightView)?.state.completed.length||0,
   layer:{...palmToken(session),completed:state.completed,draft:state.draft,selectedId:state.selectedId,fillMode:resultMode?"outline":"filled"},
   resultMode,loading:match.status==="loading",...((match.status==="error"||match.status==="stale")&&match.message?{message:match.message}:{})});this.refreshOverlay();
 },
 action(action:Parameters<typeof palmSession.dispatch>[1]){
  const session=this.data.session;if(!session||this.data.loading||this.data.infoOpen)return;
  const result=palmSession.dispatch(palmToken(session),action);
  if(!result.ok){this.setData({message:result.message});return;}
  this.setData({session:result.session,message:"",resultMode:false,previewMode:false,selected:""});this.sync();
 },
 onPoint(e:WechatMiniprogram.CustomEvent<{sessionId:string;revision:number;view:LocalSurfaceView;templateId:string;templateVersion:string;geometryId:string;status:string;point:NormalizedPoint|null}>){
  if(this.data.mode!=="draw"||this.data.phase!=="editing"||this.data.infoOpen||this.data.previewMode)return;
  const d=e.detail,m=getLocalModel(this.data.view);
  if(d.sessionId!==this.data.session?.sessionId||d.revision!==this.data.session?.revision||d.view!==m.view||d.templateId!==m.id||d.templateVersion!==m.version||d.geometryId!==m.geometryId)return;
  if(d.status!=="valid"||!d.point){this.setData({message:"请在当前部位有效皮肤范围内取点"});return;}
  this.action({type:"add",point:d.point});
 },
 undo(){this.action({type:"undo"});},cancelDraft(){this.action({type:"cancel"});},closePolygon(){this.action({type:"close"});},
 newRegion(){this.action({type:"start"});},selectPolygon(e:WechatMiniprogram.TouchEvent){const id=e.currentTarget.dataset.id;if(typeof id==="string")this.action({type:"select",id});},
 deleteSelected(){if(this.data.selectedId)this.action({type:"delete",id:this.data.selectedId});},finish(){this.action({type:"review"});},edit(){this.action({type:"edit"});},
 async calculate(){
  const life=lives.get(this);if(!life?.active||this.data.loading||!this.data.session||this.data.phase!=="review")return;
  const model=getLocalModel(this.data.view);if(!canMatchReference()||!model.atlas.technicalReady){this.setData({message:model.atlas.blockedReason||"当前环境暂不开放参考计算"});return;}
  const sequence=++life.sequence,view=this.data.view;this.setData({loading:true,message:"",previewMode:false,selected:""});
  try{await palmMatching.forView(view).calculate();if(lives.get(this)!==life||!life.active||life.sequence!==sequence||this.data.view!==view)return;
   const match=palmMatching.forView(view).refresh();this.setData({resultMode:match.status==="ready",message:match.message||"",loading:false});this.sync();
  }catch{if(lives.get(this)===life&&life.active&&life.sequence===sequence)this.setData({loading:false,message:"暂未完成计算，标注已保留，请稍后重试"});}
 },
 togglePreview(){if(!canPreviewAtlas())return;this.setData({previewMode:!this.data.previewMode,resultMode:false,selected:"",message:""});this.refreshOverlay();},
 refreshOverlay(){
  const view=this.data.view,model=getLocalModel(view);let regions:readonly AtlasRegion<LocalSurfaceView>[]=[],labels:CandidateLabel[]=[],coverage="";
  try{
   if(this.data.resultMode){
    const match=palmMatching.forView(view).refresh(),result=match.response?.views.find(v=>v.view===view);
    if(result){const candidates=result.candidates;
     const parts=(c:MatchCandidate<LocalSurfaceView>)=>candidateRegions(c,model.atlas.regions,view);
     labels=candidates.map(c=>{const rr=parts(c);return {id:c.candidate_id,name:c.display_name,label:c.label,side:c.side,color:rr[0].color,ratio:coverageText(c.lesion_coverage_ratio),y:rr.reduce((sum,r)=>sum+r.labelPoint.y,0)/rr.length};});
     regions=[...new Map(candidates.filter(c=>!this.data.selected||c.candidate_id===this.data.selected).flatMap(parts).map(r=>[r.id,r])).values()];
     coverage=`覆盖 ${coverageText(result.covered_ratio)} · 未覆盖 ${coverageText(result.uncovered_ratio)}`;
    }
   }else if(this.data.previewMode){
    const grouped=[...new Set(model.atlas.regions.map(r=>r.labelId))];
    labels=grouped.map(label=>{const rr=model.atlas.regions.filter(r=>r.labelId===label);return {id:label,name:label,label,side:view.endsWith("-left")?"left":"right",color:rr[0].color,ratio:"参考",y:rr.reduce((sum,r)=>sum+r.labelPoint.y,0)/rr.length};});
    regions=model.atlas.regions.filter(r=>!this.data.selected||r.labelId===this.data.selected);
   }
   const layoutChanged=!!labels.length!==!!this.data.labels.length;
   this.setData({atlasRegions:regions,labels,coverage,rail:placeLabels(labels,this.data.stageHeight-24,this.data.viewport),layoutRevision:this.data.layoutRevision+(layoutChanged?1:0)});
  }catch(error){this.setData({atlasRegions:[],labels:[],rail:emptyRail,resultMode:false,message:(error as Error).message});}
 },
 chooseCandidate(e:WechatMiniprogram.TouchEvent){const id=e.currentTarget.dataset.id;if(typeof id!=="string"||!this.data.labels.some(l=>l.id===id))return;this.setData({selected:id});this.refreshOverlay();},
 showAll(){this.setData({selected:""});this.refreshOverlay();},
 onViewport(e:WechatMiniprogram.CustomEvent<{view:LocalSurfaceView;viewport:ViewportTransform}>){if(e.detail.view!==this.data.view)return;this.setData({viewport:e.detail.viewport,rail:placeLabels(this.data.labels,this.data.stageHeight-24,e.detail.viewport)});},
 zoom(){let points:readonly NormalizedPoint[]=[];
  if(this.data.selected&&this.data.atlasRegions.length)points=this.data.atlasRegions.flatMap(r=>r.geometry.coordinates.flatMap(poly=>poly[0].map(([x,y])=>({x,y}))));
  else {const s=this.data.session?.state;points=s?.completed.find(p=>p.id===s.selectedId)?.ring||s?.draft?.vertices||[];}
  if(!points.length)points=getLocalModel(this.data.view).body.flatMap(p=>p.outer);
  this.setData({focusBounds:focus(points)});
 },
 reset(){this.setData({focusBounds:null});},
 showInfo(){this.setData({infoOpen:true});},closeInfo(){this.setData({infoOpen:false,layoutRevision:this.data.layoutRevision+1});},swallow(){},
 returnBody(){const pages=getCurrentPages(),index=pages.map(p=>p.route).lastIndexOf("pages/select/select");
  if(index>=0&&index<pages.length-1)wx.navigateBack({delta:pages.length-1-index});else wx.redirectTo({url:"/pages/select/select"});}
});
