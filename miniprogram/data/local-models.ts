/** Explicit local-surface registry. Never accepts front/back or infers a side. */
import {LocalSurfaceView,SoleView,AxillaView} from "../types/dermatome";
import {LocalSurfaceModel} from "../types/local-surface";
import {SOLE_MODELS} from "./sole.generated";
import {AXILLA_SCHEMATIC_MODELS as AXILLA_MODELS} from "./axilla-schematic.generated";
function freeze<T>(v:T):T{if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
freeze(SOLE_MODELS);
freeze(AXILLA_MODELS);
export function isSoleView(v:unknown):v is SoleView{return v==="sole-left"||v==="sole-right";}
export function isAxillaView(v:unknown):v is AxillaView{return v==="axilla-left"||v==="axilla-right";}
export function isLocalSurfaceView(v:unknown):v is LocalSurfaceView{return isSoleView(v)||isAxillaView(v);}
export function getLocalModel(v:LocalSurfaceView):LocalSurfaceModel{
 if(isSoleView(v))return SOLE_MODELS[v];
 if(isAxillaView(v))return AXILLA_MODELS[v];
 throw Error("未配置的局部视图");
}
export function localViewPresentation(v:LocalSurfaceView):{partName:string;leftView:LocalSurfaceView;rightView:LocalSurfaceView;orientation:string}{
 if(isAxillaView(v))return {partName:"腋下",leftView:"axilla-left",rightView:"axilla-right",orientation:v==="axilla-left"?"抬臂侧面 · 胸前在左":"抬臂侧面 · 胸前在右"};
 if(isSoleView(v))return {partName:"脚底",leftView:"sole-left",rightView:"sole-right",orientation:v==="sole-left"?"大脚趾在左 · 足底":"大脚趾在右 · 足底"};
 throw Error("未配置的局部视图");
}
