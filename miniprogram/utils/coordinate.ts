import {
  LogicalModel, CanvasPoint, NormalizedPoint, NormalizedRect, ViewportTransform,
} from "../types/dermatome";

const ROUND_OFF = 1e-12;
const FULL: NormalizedRect = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + " 必须是有限正数");
}

function validViewport(viewport: ViewportTransform): boolean {
  const sizes = [
    viewport.logicalWidth, viewport.logicalHeight, viewport.viewportWidth,
    viewport.viewportHeight, viewport.scale, viewport.zoom,
    viewport.logicalWidth * viewport.scale, viewport.logicalHeight * viewport.scale,
  ];
  return sizes.every((value) => Number.isFinite(value) && value > 0) &&
    [viewport.offsetX, viewport.offsetY, viewport.padding].every(Number.isFinite) &&
    viewport.padding >= 0 &&
    2 * viewport.padding < Math.min(viewport.viewportWidth, viewport.viewportHeight);
}

function requireViewport(viewport: ViewportTransform): void {
  if (!validViewport(viewport)) throw new RangeError("无效的视口变换");
}

function validRect(rect: NormalizedRect): void {
  positive(rect.width, "区域宽度");
  positive(rect.height, "区域高度");
  if (![rect.x, rect.y].every(Number.isFinite) || rect.x < 0 || rect.y < 0 ||
      rect.x + rect.width > 1 || rect.y + rect.height > 1) {
    throw new RangeError("区域必须位于完整归一化画布内");
  }
}

function fit(
  width: number, height: number, model: LogicalModel,
  target: NormalizedRect, padding: number,
): ViewportTransform {
  positive(width, "容器宽度"); positive(height, "容器高度");
  positive(model.logicalWidth, "逻辑宽度"); positive(model.logicalHeight, "逻辑高度");
  if (!Number.isFinite(padding) || padding < 0 || 2 * padding >= Math.min(width, height)) {
    throw new RangeError("留白必须非负且不能占满容器");
  }
  validRect(target);
  const usableW = width - 2 * padding, usableH = height - 2 * padding;
  const base = Math.min(usableW / model.logicalWidth, usableH / model.logicalHeight);
  const scale = Math.min(
    usableW / (model.logicalWidth * target.width),
    usableH / (model.logicalHeight * target.height),
  );
  positive(scale, "适配比例");
  const offsetX = width / 2 - (target.x + target.width / 2) * model.logicalWidth * scale;
  const offsetY = height / 2 - (target.y + target.height / 2) * model.logicalHeight * scale;
  if (![offsetX, offsetY, scale / base].every(Number.isFinite)) throw new RangeError("视口数值溢出");
  return Object.freeze({
    logicalWidth: model.logicalWidth, logicalHeight: model.logicalHeight,
    viewportWidth: width, viewportHeight: height, scale, offsetX, offsetY,
    zoom: scale / base, padding,
  });
}

export function fitViewport(
  width: number, height: number, model: LogicalModel, padding = 16,
): ViewportTransform {
  return fit(width, height, model, FULL, padding);
}

export function focusViewport(viewport: ViewportTransform, region: NormalizedRect): ViewportTransform {
  requireViewport(viewport);
  return fit(viewport.viewportWidth, viewport.viewportHeight, {
    id: "viewport", logicalWidth: viewport.logicalWidth, logicalHeight: viewport.logicalHeight,
  }, region, viewport.padding);
}

/** 重新计算全身视口，不修改原视口或原始坐标。 */
export function resetViewport(viewport: ViewportTransform): ViewportTransform {
  return focusViewport(viewport, FULL);
}

/** Cross-page camera handoff: preserve CSS scale and anatomical center, only resize the display window. */
export function reframeViewport(previous:ViewportTransform,width:number,height:number):ViewportTransform {
  requireViewport(previous);
  const base=fitViewport(width,height,{id:"handoff",logicalWidth:previous.logicalWidth,logicalHeight:previous.logicalHeight},Math.min(previous.padding,Math.min(width,height)/4));
  const result={...base,scale:previous.scale,zoom:previous.scale/base.scale,
    offsetX:previous.offsetX+(width-previous.viewportWidth)/2,
    offsetY:previous.offsetY+(height-previous.viewportHeight)/2};
  requireViewport(result);return Object.freeze(result);
}

function clampOffsets(viewport:ViewportTransform):ViewportTransform {
  const contentW=viewport.logicalWidth*viewport.scale,contentH=viewport.logicalHeight*viewport.scale;
  const marginX=Math.min(viewport.viewportWidth*.35,contentW*.35);
  const marginY=Math.min(viewport.viewportHeight*.35,contentH*.35);
  const offsetX=Math.max(Math.min(viewport.offsetX,viewport.viewportWidth-marginX),marginX-contentW);
  const offsetY=Math.max(Math.min(viewport.offsetY,viewport.viewportHeight-marginY),marginY-contentH);
  return Object.freeze({...viewport,offsetX,offsetY});
}

/** Browse-only camera movement. It never changes normalized lesion coordinates. */
export function panViewport(viewport:ViewportTransform,dx:number,dy:number):ViewportTransform {
  requireViewport(viewport);
  if(![dx,dy].every(Number.isFinite))throw new RangeError("平移量必须是有限数值");
  return clampOffsets({...viewport,offsetX:viewport.offsetX+dx,offsetY:viewport.offsetY+dy});
}

/** Zoom around one Canvas-local CSS point, preserving the point under the gesture. */
export function zoomViewportAt(viewport:ViewportTransform,canvasPoint:CanvasPoint,factor:number,
  model:LogicalModel):ViewportTransform {
  requireViewport(viewport);
  if(![canvasPoint.x,canvasPoint.y,factor].every(Number.isFinite)||factor<=0)
    throw new RangeError("缩放参数无效");
  const base=fitViewport(viewport.viewportWidth,viewport.viewportHeight,model,viewport.padding);
  const scale=Math.max(base.scale*.65,Math.min(base.scale*12,viewport.scale*factor));
  const logicalX=(canvasPoint.x-viewport.offsetX)/(viewport.logicalWidth*viewport.scale);
  const logicalY=(canvasPoint.y-viewport.offsetY)/(viewport.logicalHeight*viewport.scale);
  return clampOffsets({...viewport,scale,zoom:scale/base.scale,
    offsetX:canvasPoint.x-logicalX*viewport.logicalWidth*scale,
    offsetY:canvasPoint.y-logicalY*viewport.logicalHeight*scale});
}

export function normalizedToCanvas(point: NormalizedPoint, viewport: ViewportTransform): CanvasPoint {
  if (![point.x, point.y].every(Number.isFinite) ||
      point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
    throw new RangeError("标准坐标必须是 [0,1] 内的有限数");
  }
  return projectNormalizedToCanvas(point,viewport);
}

/** 放置草稿可以越界预览；投影不裁切、不赋予人体有效性，保存前另做完整几何校验。 */
export function projectNormalizedToCanvas(point: NormalizedPoint, viewport: ViewportTransform): CanvasPoint {
  requireViewport(viewport);
  if(![point.x,point.y].every(Number.isFinite))throw new RangeError("投影坐标必须为有限数");
  const result = {
    x: viewport.offsetX + point.x * viewport.logicalWidth * viewport.scale,
    y: viewport.offsetY + point.y * viewport.logicalHeight * viewport.scale,
  };
  if (![result.x, result.y].every(Number.isFinite)) throw new RangeError("显示坐标数值溢出");
  return result;
}

/** 输入为 Canvas 本地 CSS 像素，不是屏幕绝对坐标或 DPR 物理像素。 */
export function canvasToNormalized(point: CanvasPoint, viewport: ViewportTransform): NormalizedPoint | null {
  if (!validViewport(viewport)) return null;
  if (![point.x, point.y].every(Number.isFinite) || point.x < 0 || point.y < 0 ||
      point.x > viewport.viewportWidth || point.y > viewport.viewportHeight) return null;
  const x = (point.x - viewport.offsetX) / (viewport.logicalWidth * viewport.scale);
  const y = (point.y - viewport.offsetY) / (viewport.logicalHeight * viewport.scale);
  if (x < -ROUND_OFF || x > 1 + ROUND_OFF || y < -ROUND_OFF || y > 1 + ROUND_OFF) return null;
  // 仅修正 1e-12 内机器舍入；真实越界/留白点击不会吸附到边缘。
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}
