import { getBodyModel } from "../data/body-models";
import { AnnotationBasis, AnnotationSession, AnnotationToken, AnnotationViewState, CompletedPolygon } from "../types/annotation";
import { BodyModelConfig, BodyView, NormalizedPoint } from "../types/dermatome";
import { bodyGeometry } from "../utils/annotation-geometry";
import {editManualView} from "../utils/manual-annotation";
import type { ConfirmedPhoto } from "../types/ai";
import type { BodyMultiPolygon, PlacementTransform } from "../types/placement";
import { preparePhotoGeometry, transformPhotoPolygonToBody, validatePlacementGeometry } from "../utils/placement-geometry";

export const MAX_REGIONS_PER_VIEW=20;
export type SessionResult={readonly ok:true;readonly session:AnnotationSession} | {readonly ok:false;readonly message:string};
export type SessionAction=
  | {type:"start"}|{type:"add";point:NormalizedPoint}|{type:"undo"}|{type:"cancel"}|{type:"close"}
  | {type:"select";id:string}|{type:"delete";id:string}
  | {type:"switch";view:BodyView;resolution?:"discard"|"close"}
  | {type:"focus";regionId:string|null}|{type:"review";discardDraft?:boolean}|{type:"edit"};
export interface PlacementCommit {
  readonly placementId:string;
  readonly entryRegionId:string;
  readonly geometry:BodyMultiPolygon;
  readonly source:ConfirmedPhoto;
  readonly transform:PlacementTransform;
  /** Compare-and-replace an existing AI annotation; stable annotation ID is retained. */
  readonly editTarget?:{readonly id:string;readonly placementId:string};
}
export function modelBasis(model:Pick<BodyModelConfig,"id"|"version"|"geometryId"|"regionSetId">):AnnotationBasis {
  return {templateId:model.id,templateVersion:model.version,geometryId:model.geometryId,regionSetId:model.regionSetId};
}
export function sameBasis(a:AnnotationBasis,b:AnnotationBasis):boolean {
  return a.templateId===b.templateId && a.templateVersion===b.templateVersion &&
    a.geometryId===b.geometryId && a.regionSetId===b.regionSetId;
}
export function sessionToken(s:AnnotationSession):AnnotationToken {
  return {sessionId:s.sessionId,revision:s.revision,view:s.currentView,basis:s.basis};
}
function freeze<T>(value:T):T {
  if(value && typeof value==="object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
}
const emptyView=():AnnotationViewState=>({completed:[],draft:null,selectedId:null,focusRegionId:null});
const fail=(message:string):SessionResult=>({ok:false,message});
let sequence=0;
const id=(kind:string)=>`${kind}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;

/** 一个实例只拥有一个权威会话。导出的单例用于运行时；构造器供独立内存测试。 */
export class AnnotationSessionStore {
  private active:AnnotationSession|null=null;
  constructor(private readonly modelFor:(view:BodyView)=>BodyModelConfig=getBodyModel) {}
  snapshot():AnnotationSession|null { return this.active; }
  read(sessionId:string):SessionResult {
    const s=this.active;
    if(!s || s.sessionId!==sessionId)return fail("本次运行会话已结束，请返回选择页重新开始");
    if(!["front","back"].every(v=>sameBasis(s.basis,modelBasis(this.modelFor(v as BodyView)))))
      return fail("人体模板或区域配置版本不匹配，原会话已保留，不能自动迁移坐标");
    return {ok:true,session:s};
  }
  open(view:BodyView,entryRegionId:string):SessionResult {
    const model=this.modelFor(view);
    if(!model.regions.some(r=>r.id===entryRegionId))return fail("请先选择当前视图中的有效部位");
    if(this.active) {
      const existing=this.read(this.active.sessionId);
      if(!existing.ok)return existing;
      // 重入优先恢复草稿及其原视图，不用新入口覆盖尚未处理的数据。
      if(existing.session.views[existing.session.currentView].draft)return existing;
      const next={...existing.session,currentView:view,revision:existing.session.revision+1,
        views:{...existing.session.views,[view]:{...existing.session.views[view],focusRegionId:
          existing.session.phase==="review"?null:entryRegionId}}};
      this.active=freeze(next);return {ok:true,session:this.active};
    }
    const initial=emptyView();
    this.active=freeze({schemaVersion:1,sessionId:id("session"),basis:modelBasis(model),currentView:view,
      phase:"editing",revision:0,views:{front:emptyView(),back:emptyView(),[view]:{
        ...initial,focusRegionId:entryRegionId,draft:{id:id("region"),view,vertices:[],navigation:{entryRegionId}}}}});
    return {ok:true,session:this.active};
  }
  /** 放置入口只调整导航元数据；不继承空手工草稿的面，也不删掉任何已有顶点。 */
  openPlacement(view:BodyView,entryRegionId:string):SessionResult {
    if(view!=="front" && view!=="back")return fail("无效视图");
    if(!this.modelFor(view).regions.some(r=>r.id===entryRegionId))return fail("请先选择当前视图中的有效部位");
    if(!this.active)return this.open(view,entryRegionId);
    const found=this.read(this.active.sessionId);if(!found.ok)return found;
    const s=found.session;
    if(s.views.front.draft?.vertices.length || s.views.back.draft?.vertices.length)
      return fail("请先闭合或取消已有手动草稿，再进入放置页面");
    if(s.currentView===view && s.views[view].focusRegionId===entryRegionId)return found;
    this.active=freeze({...s,currentView:view,revision:s.revision+1,views:{...s.views,[view]:{
      ...s.views[view],focusRegionId:entryRegionId}}});
    return {ok:true,session:this.active};
  }
  /** 唯一正式写入口；拖动草稿不经过这里。重算、完整校验后一次追加整个贴片。 */
  commitPlacement(token:AnnotationToken,payload:PlacementCommit):SessionResult {
    const found=this.read(token.sessionId);if(!found.ok)return found;
    const s=found.session,view=s.currentView,model=this.modelFor(view);
    if(!payload || typeof payload.placementId!=="string" || !payload.placementId.length || payload.placementId.length>128)
      return fail("放置标识无效，请返回分割页重新进入");
    if(!sameBasis(token.basis,s.basis) || token.view!==view)
      return fail("人体模板或视图已变化，请重新进入放置页面");
    const previous=[...s.views.front.completed,...s.views.back.completed].find(p=>p.source?.kind==="ai_assisted" && p.source.placementId===payload.placementId);
    if(previous?.source?.kind==="ai_assisted") {
      // 同一确认的重复点击不会要求旧revision再写一次；相同ID不同内容不能复用。
      const same=previous.view===view && previous.navigation.entryRegionId===payload.entryRegionId &&
        JSON.stringify(previous.geometry)===JSON.stringify(payload.geometry) &&
        JSON.stringify(previous.source.photo)===JSON.stringify(payload.source) &&
        JSON.stringify(previous.source.transform)===JSON.stringify(payload.transform);
      return same?{ok:true,session:s}:fail("该放置已确认，不能以同一标识覆盖不同范围");
    }
    if(token.revision!==s.revision)return fail("标注会话已变化，请重新进入放置页面");
    if(s.views.front.draft?.vertices.length || s.views.back.draft?.vertices.length)
      return fail("请先闭合或取消已有手动草稿，再确认放置");
    const replaced=payload.editTarget?s.views[view].completed.find(p=>p.id===payload.editTarget?.id):null;
    if(payload.editTarget&&(!replaced||replaced.source?.kind!=="ai_assisted"||replaced.source.placementId!==payload.editTarget.placementId||
      JSON.stringify(replaced.source.photo)!==JSON.stringify(payload.source)))return fail("原AI标注已变化，不能覆盖；请返回重新选择");
    if(!replaced&&s.views[view].completed.length>=MAX_REGIONS_PER_VIEW)return fail(`每面最多 ${MAX_REGIONS_PER_VIEW} 片，请先删除不需要的区域`);
    if(!model.regions.some(r=>r.id===payload.entryRegionId))return fail("当前视图没有该部位，请重新选择");
    if(!payload.source || !Number.isFinite(payload.source.expires_at) || (!replaced&&payload.source.expires_at<=Date.now()/1000))
      return fail("照片分析会话已过期，请返回重新上传或分析");
    const source=payload.source;
    if(![source.session_id,source.photo_id,source.result_id,source.mask_asset].every(v=>typeof v==="string" && v.length>0) ||
      !/^candidate-[0-2]$/.test(source.candidate_id) || !/^[a-f0-9]{64}$/i.test(source.mask_sha256) ||
      !Number.isInteger(source.prompt_revision) || source.prompt_revision<0 || !Number.isFinite(source.confirmed_at) ||
      source.confirmed_at>source.expires_at || source.prompts?.coordinate_space!=="photo_oriented_normalized_v1")
      return fail("缺少有效的AI确认来源，请返回分割页重新确认");
    let geometry:BodyMultiPolygon;
    try {
      const prepared=preparePhotoGeometry(payload.source);
      geometry=transformPhotoPolygonToBody(prepared,payload.transform,model);
      const checked=validatePlacementGeometry(geometry,model);if(!checked.ok)return fail(checked.message);
      // 不相信页面传入的预览，禁止把不同形状或不同坐标空间静默存入会话。
      if(JSON.stringify(geometry)!==JSON.stringify(payload.geometry))return fail("预览范围与最终位置不一致，请重新调整并确认");
    }catch(e){return fail(e instanceof Error?e.message:"放置数据无效，请返回分割页重新确认");}
    const polygon:CompletedPolygon={id:replaced?.id||id("region"),view,ring:geometry.coordinates[0][0],geometry,
      source:{kind:"ai_assisted",placementId:payload.placementId,
        photo:JSON.parse(JSON.stringify(payload.source)) as ConfirmedPhoto,
        transform:JSON.parse(JSON.stringify(payload.transform)) as PlacementTransform},
      navigation:{entryRegionId:payload.entryRegionId}};
    const current=s.views[view];
    this.active=freeze({...s,phase:"editing",revision:s.revision+1,views:{...s.views,[view]:{
      ...current,completed:replaced?current.completed.map(p=>p.id===replaced.id?polygon:p):[...current.completed,polygon],draft:null,selectedId:polygon.id}}});
    return {ok:true,session:this.active};
  }
  dispatch(token:AnnotationToken,action:SessionAction):SessionResult {
    const found=this.read(token.sessionId);if(!found.ok)return found;
    const s=found.session,view=s.currentView,model=this.modelFor(view);
    if(token.revision!==s.revision || token.view!==view || !sameBasis(token.basis,s.basis))
      return fail("操作已过期，请在当前画面重试");
    if(s.phase==="review" && !["edit","switch","focus"].includes(action.type))return fail("复核为只读，请先继续修改");
    let current=s.views[view],nextView=view,phase=s.phase;
    const complete=():string|null=>{
      const result=editManualView(current,view,bodyGeometry(model),{type:"close"},()=>id("region"),MAX_REGIONS_PER_VIEW);
      if(!result.ok)return result.message;current=result.state;return null;
    };
    switch(action.type) {
      case "start":case "add":case "undo":case "cancel":case "close":case "select":case "delete":{
        const result=editManualView(current,view,bodyGeometry(model),action,()=>id("region"),MAX_REGIONS_PER_VIEW);
        if(!result.ok)return fail(result.message);current=result.state;break;
      }
      case "switch":
        if(action.view!=="front" && action.view!=="back")return fail("无效视图");
        if(action.view===view)return {ok:true,session:s};
        if(current.draft?.vertices.length) {
          if(!action.resolution)return fail("请先处理当前草稿再切换视图");
          if(action.resolution==="close") {const error=complete();if(error)return fail(error);}
          else current={...current,draft:null};
        } else current={...current,draft:null};
        nextView=action.view;break;
      case "focus":
        if(action.regionId!==null && !model.regions.some(r=>r.id===action.regionId))return fail("当前视图没有该部位");
        current={...current,focusRegionId:action.regionId};break;
      case "review":
        if(s.views.front.completed.length+s.views.back.completed.length===0)return fail("至少闭合一片有效区域后才能完成标注");
        if(s.views[view==="front"?"back":"front"].draft?.vertices.length)return fail("另一面尚有未闭合草稿，请先处理");
        if(current.draft?.vertices.length && !action.discardDraft)return fail("尚有未闭合草稿，请继续绘制或明确放弃");
        current={...current,draft:null};phase="review";break;
      case "edit":phase="editing";break;
    }
    let views={...s.views,[view]:current};
    // Review explicitly ends empty drawing placeholders on both views; no vertices are discarded here.
    if(action.type==="review")for(const side of ["front","back"] as const){
      if(views[side].draft?.vertices.length===0)views[side]={...views[side],draft:null};
    }
    // 复核保留当前视野；只有明确的focus操作改变查看范围。
    this.active=freeze({...s,currentView:nextView,phase,revision:s.revision+1,views});
    return {ok:true,session:this.active};
  }
}

/** 内存唯一权威；不使用storage/网络，也不依赖onUnload保存。 */
export const annotationSession=new AnnotationSessionStore();
