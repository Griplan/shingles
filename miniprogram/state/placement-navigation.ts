import {BodyView,ViewportTransform} from "../types/dermatome";

/** One-use display handoff, never an additional annotation/result store. */
interface ResultView {sessionId:string;requestId:string;view:BodyView;viewport:ViewportTransform;regionId:string}
let pending:ResultView|null=null;
export function retainPlacementView(value:ResultView):void {pending={...value,viewport:{...value.viewport}};}
export function consumePlacementView(sessionId:string,requestId:string|undefined):ResultView|null {
 const value=pending;pending=null;
 return value?.sessionId===sessionId&&value.requestId===requestId?value:null;
}
