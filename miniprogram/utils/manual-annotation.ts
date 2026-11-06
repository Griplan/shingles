import {AnnotationViewState} from "../types/annotation";
import {NormalizedPoint,SurfaceView} from "../types/dermatome";
import {BodyGeometry,MAX_VERTICES,pointInBody,samePoint,validatePolygon} from "./annotation-geometry";

export type ManualAction={type:"start"}|{type:"add";point:NormalizedPoint}|{type:"undo"}|{type:"cancel"}|{type:"close"}|
 {type:"select";id:string}|{type:"delete";id:string};
type Result<V extends SurfaceView>={ok:true;state:AnnotationViewState<V>}|{ok:false;message:string};
const fail=(message:string):{ok:false;message:string}=>({ok:false,message});
/** Shared V2 manual edit operations. Callers own session identity, revisions and freezing. */
export function editManualView<V extends SurfaceView>(current:AnnotationViewState<V>,view:V,body:BodyGeometry,
 action:ManualAction,nextId:()=>string,maxRegions:number):Result<V> {
 switch(action.type){
  case "start":
   if(current.draft)return fail("已有草稿，请先闭合或取消");
   if(current.completed.length>=maxRegions)return fail(`每面最多 ${maxRegions} 片，请先删除不需要的区域`);
   return {ok:true,state:{...current,selectedId:null,draft:{id:nextId(),view,vertices:[],navigation:{entryRegionId:current.focusRegionId}}}};
  case "add":
   if(!current.draft)return fail("管理状态不添加顶点，请先新增区域");
   if(!pointInBody(action.point,body))return fail("请点击人体轮廓内的位置，不会吸附到边缘");
   if(current.draft.vertices.length>=MAX_VERTICES)return fail(`每片最多 ${MAX_VERTICES} 个顶点`);
   if(current.draft.vertices.some(p=>samePoint(p,action.point)))return fail("该点与已有顶点重复，请点击下一个位置；闭合请使用按钮");
   return {ok:true,state:{...current,draft:{...current.draft,vertices:[...current.draft.vertices,{x:action.point.x,y:action.point.y}]}}};
  case "undo":
   if(!current.draft?.vertices.length)return fail("没有可撤销的草稿顶点");
   return {ok:true,state:{...current,draft:{...current.draft,vertices:current.draft.vertices.slice(0,-1)}}};
  case "cancel":return {ok:true,state:{...current,draft:null}};
  case "close":{
   if(!current.draft)return fail("请先新增区域");
   if(current.completed.length>=maxRegions)return fail(`每面最多 ${maxRegions} 片，请先删除不需要的区域`);
   const checked=validatePolygon(current.draft.vertices,body);if(!checked.ok)return checked;
   const polygon={id:current.draft.id,view,ring:checked.ring,navigation:current.draft.navigation};
   return {ok:true,state:{...current,completed:[...current.completed,polygon],draft:null,selectedId:polygon.id}};
  }
  case "select":
   if(current.draft||!current.completed.some(p=>p.id===action.id))return fail("请先处理草稿，或选择有效的已完成区域");
   return {ok:true,state:{...current,selectedId:action.id}};
  case "delete":
   if(current.draft||current.selectedId!==action.id||!current.completed.some(p=>p.id===action.id))return fail("删除目标已变化，请重新选择");
   return {ok:true,state:{...current,completed:current.completed.filter(p=>p.id!==action.id),selectedId:null}};
 }
}
