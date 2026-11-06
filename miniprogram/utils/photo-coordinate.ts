import {PhotoBox} from "../types/ai";
export interface PhotoRect {left:number;top:number;width:number;height:number}
export function fitPhoto(width:number,height:number,containerWidth:number,containerHeight:number):PhotoRect {
 if(![width,height,containerWidth,containerHeight].every(n=>Number.isFinite(n)&&n>0))throw new Error("照片尺寸无效");
 const scale=Math.min(containerWidth/width,containerHeight/height);
 return {left:(containerWidth-width*scale)/2,top:(containerHeight-height*scale)/2,width:width*scale,height:height*scale};
}
export function photoTouch(x:number,y:number,rect:PhotoRect):{x:number;y:number}|null {
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<rect.left||y<rect.top||x>rect.left+rect.width||y>rect.top+rect.height)return null;
 return {x:(x-rect.left)/rect.width,y:(y-rect.top)/rect.height};
}
export function dragBox(a:{x:number;y:number},b:{x:number;y:number}):PhotoBox|null {
 const box={xMin:Math.min(a.x,b.x),yMin:Math.min(a.y,b.y),xMax:Math.max(a.x,b.x),yMax:Math.max(a.y,b.y)};
 return usablePhotoBox(box)?box:null;
}
/** Interaction threshold only, not a medical lesion-size rule. */
export function usablePhotoBox(box:PhotoBox):boolean {
 const width=box.xMax-box.xMin,height=box.yMax-box.yMin;
 return [box.xMin,box.yMin,box.xMax,box.yMax].every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&
  width>=.02&&height>=.02&&width*height>=.0016;
}
