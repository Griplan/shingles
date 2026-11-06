import { BodyModelConfig, CanvasPoint, CanvasRect, DebugPoint, DebugProbe, ViewportTransform } from "../types/dermatome";
import { canvasToNormalized, normalizedToCanvas } from "./coordinate";
import { pointInOutline } from "./body-path";

export interface InputTouch { readonly kind:"canvas"|"client"; readonly point:CanvasPoint }
function object(value:unknown): Record<string,unknown> | null {
  return value!==null && typeof value==="object" ? value as Record<string,unknown> : null;
}
/** 原生Canvas提供本地x/y；部分工具提供clientX/Y。拒绝page/物理坐标猜测。 */
export function readTouch(event:unknown): InputTouch | null {
  const e=object(event), touches=e?.changedTouches;
  if(Array.isArray(e?.touches)&&e.touches.length>1)return null;
  if(!Array.isArray(touches)||touches.length!==1) return null;
  const t=object(touches[0]); if(!t)return null;
  if(typeof t.clientX==="number"&&typeof t.clientY==="number"&&[t.clientX,t.clientY].every(Number.isFinite)) {
    return {kind:"client",point:{x:t.clientX,y:t.clientY}};
  }
  if(typeof t.x==="number"&&typeof t.y==="number"&&[t.x,t.y].every(Number.isFinite)) {
    return {kind:"canvas",point:{x:t.x,y:t.y}};
  }
  return null;
}
export function probeTouch(input: InputTouch, rect:CanvasRect, viewport:ViewportTransform, model:BodyModelConfig): DebugProbe {
  const base={view:model.view,modelId:model.id,modelVersion:model.version};
  if(![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0||
      Math.abs(rect.width-viewport.viewportWidth)>.5||Math.abs(rect.height-viewport.viewportHeight)>.5) {
    return Object.assign({},base,{status:"unavailable" as const,screen:null,canvas:null,normalized:null});
  }
  const canvas=input.kind==="canvas"?input.point:{x:input.point.x-rect.left,y:input.point.y-rect.top};
  const screen=input.kind==="client"?input.point:{x:rect.left+canvas.x,y:rect.top+canvas.y};
  const p=canvasToNormalized(canvas,viewport);
  if(!p)return Object.assign({},base,{status:"outside-model" as const,screen,canvas,normalized:null});
  const inside=pointInOutline({x:p.x*model.logicalWidth,y:p.y*model.logicalHeight},model.hitOutline);
  return Object.assign({},base,{status:inside?"valid" as const:"outside-body" as const,screen,canvas,normalized:inside?p:null});
}
export function projectDebugPoint(point:DebugPoint|null,model:BodyModelConfig,viewport:ViewportTransform):CanvasPoint|null {
  if(!point||point.view!==model.view||point.modelId!==model.id||point.modelVersion!==model.version)return null;
  const p=normalizedToCanvas(point.normalized,viewport);
  return p.x>=0&&p.y>=0&&p.x<=viewport.viewportWidth&&p.y<=viewport.viewportHeight?p:null;
}
