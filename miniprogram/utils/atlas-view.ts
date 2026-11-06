import { AtlasDisplayMode, AtlasGroupFilter, AtlasLocalFocus, AtlasRegion, AtlasSideFilter } from "../types/atlas";
import { BodyModelConfig, BodyView, SurfaceView, NormalizedRect } from "../types/dermatome";
import { BODY_LANDMARKS, GEOMETRY_ID } from "../assets/body/commons-v1";

export function atlasRegionInGroup(region:AtlasRegion,group:AtlasGroupFilter):boolean {
 return group==="all" || (group==="trigeminal" ? region.partitionType==="trigeminal_sensory" :
  region.partitionType==="spinal_dermatome" || region.partitionType==="spinal_dermatome_composite");
}
export function atlasLabelName(regions:readonly AtlasRegion[],labelId:string):string {
 const r=regions.find(r=>r.labelId===labelId);
 const branches:Readonly<Record<string,string>>={V1:"三叉神经眼支 V1",V2:"三叉神经上颌支 V2",V3:"三叉神经下颌支 V3"};
 return r?.displayName || (r?.partitionType==="trigeminal_sensory" ? branches[labelId] : undefined) || labelId;
}
export function atlasRegionsForView(regions:readonly AtlasRegion[],view:BodyView,side:AtlasSideFilter,
 mode:AtlasDisplayMode,labelId:string,group:AtlasGroupFilter="all"):readonly AtlasRegion[] {
 if(mode==="hidden")return [];
 return regions.filter(r=>r.view===view && (side==="both" || r.side===side) &&
  atlasRegionInGroup(r,group) && (mode!=="single" || r.labelId===labelId));
}
/** 多片统一包围盒仅用于focus，绝不当作填充几何。 */
export function atlasFocusBounds(regions:readonly AtlasRegion<SurfaceView>[]):NormalizedRect|null {
 const points=regions.flatMap(r=>r.geometry.coordinates.flatMap(p=>p[0]));
 if(!points.length)return null;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x=Math.max(0,Math.min(...xs)-.02),y=Math.max(0,Math.min(...ys)-.015);
 return {x,y,width:Math.min(1,Math.max(...xs)+.02)-x,height:Math.min(1,Math.max(...ys)+.015)-y};
}
export function atlasLabelOptions(regions:readonly AtlasRegion[],view:BodyView,side:AtlasSideFilter,
 group:AtlasGroupFilter="all"):readonly {id:string;name:string}[] {
 // 跨视图保留真实标签，便于明确显示“该视图未配置”，不生成空编号。
 const ids=[...new Set(regions.filter(r=>atlasRegionInGroup(r,group)).map(r=>r.labelId))];
 const groupOrder:Record<string,number>={V:0,C:1,T:2,L:3,S:4};
 ids.sort((a,b)=>((groupOrder[a[0]]??9)-(groupOrder[b[0]]??9)) ||
  (parseInt(a.slice(1),10)-parseInt(b.slice(1),10)) || a.localeCompare(b));
 return [{id:"",name:"选择神经区域"},...ids.map(id=>({id,
  name:`${atlasLabelName(regions,id)} · 本面${atlasRegionsForView(regions,view,side,"single",id,group).length}区`}))];
}

/** 查看窗口，绝不作为新医学边界：复用冻结模板的头部UI bounds、踝高及实际足轮廓。 */
export function atlasLocalFocusBounds(model:BodyModelConfig,target:AtlasLocalFocus):NormalizedRect|null {
 if(model.geometryId!==GEOMETRY_ID || model.id!=="commons-neutral-v1" || model.version!=="4.0.1")return null;
 if(target==="face")return model.view==="front" ? model.regions.find(r=>r.id==="front-head")?.bounds || null : null;
 const marks=BODY_LANDMARKS[model.view],screenRight=(target==="left-foot")===(model.view==="front");
 const points=model.hitOutline.filter(p=>p.y>=marks.ankle.y && (screenRight?p.x>marks.head.x:p.x<marks.head.x));
 if(!points.length)return null;
 const xs=points.map(p=>p.x/model.logicalWidth),ys=points.map(p=>p.y/model.logicalHeight);
 const x=Math.max(0,Math.min(...xs)-.025),y=Math.max(0,marks.ankle.y/model.logicalHeight-.025);
 return {x,y,width:Math.min(1,Math.max(...xs)+.025)-x,height:Math.min(1,Math.max(...ys)+.015)-y};
}
