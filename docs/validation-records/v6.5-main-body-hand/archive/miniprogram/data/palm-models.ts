import {PalmModel,PalmView} from "../types/palm";
import {PALM_MODELS} from "./palm.generated";
function freeze<T>(v:T):T {
 if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;
}
freeze(PALM_MODELS);
export function isPalmView(view:unknown):view is PalmView{return view==="palm-left"||view==="palm-right";}
export function getPalmModel(view:PalmView):PalmModel {
 if(!isPalmView(view))throw Error("未配置的手掌视图");
 return PALM_MODELS[view];
}
