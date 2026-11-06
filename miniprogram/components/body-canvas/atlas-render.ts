import type { BodyContext } from "./render";
import { AtlasLayer } from "../../types/atlas";
import { BodyModelConfig, ViewportTransform } from "../../types/dermatome";
import { normalizedToCanvas } from "../../utils/coordinate";
import { BODY_LANDMARKS } from "../../assets/body/commons-v1";
import { AtlasRegion } from "../../types/atlas";
// 每个实例仅保留最近视口的投影；透明度帧复用，视口/实例变化才重新投影。
const projected=new WeakMap<AtlasRegion,{key:string;polygons:{x:number;y:number}[][][]}>();
function project(region:AtlasRegion,v:ViewportTransform) {
 const key=JSON.stringify(v),cached=projected.get(region);if(cached?.key===key)return cached.polygons;
 const polygons=region.geometry.coordinates.map(p=>p.map(r=>r.map(([x,y])=>normalizedToCanvas({x,y},v))));
 projected.set(region,{key,polygons});return polygons;
}
/** 独立开发覆盖层；不导入、不读取、不修改annotation-session。 */
export function drawAtlas(ctx:BodyContext,viewport:ViewportTransform,model:BodyModelConfig,layer:AtlasLayer|null,opacity?:ReadonlyMap<string,number>):void {
 if(!layer || layer.view!==model.view || layer.templateId!==model.id || layer.templateVersion!==model.version ||
  layer.geometryId!==model.geometryId)return;
 ctx.save();
 try {
  ctx.beginPath();ctx.rect(0,0,viewport.viewportWidth,viewport.viewportHeight);ctx.clip();
  ctx.lineWidth=.8;ctx.lineJoin="round";ctx.setLineDash([]);
  for(const region of layer.regions) {
   if(region.view!==model.view || region.atlasVersion!==layer.atlasVersion || region.templateId!==model.id ||
      region.templateVersion!==model.version || region.geometryId!==model.geometryId)continue;
   const alpha=opacity?opacity.get(region.id)||0:1;if(alpha<=0)continue;
   for(const polygon of project(region,viewport)) {
    ctx.beginPath();
    for(const ring of polygon) {
     ring.forEach((p,i)=>{if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});
     ctx.closePath();
    }
    ctx.fillStyle=region.color;ctx.globalAlpha=.29*alpha;ctx.fill();
    ctx.globalAlpha=.85*alpha;ctx.strokeStyle=region.color;ctx.stroke();
   }
  }
  if(layer.showLabels) {
   const boxes:{x:number;y:number;width:number;height:number}[]=[];
   ctx.font="9px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.globalAlpha=1;
   for(const r of layer.regions) {
    if(r.view!==model.view || r.atlasVersion!==layer.atlasVersion || r.templateId!==model.id ||
       r.templateVersion!==model.version || r.geometryId!==model.geometryId)continue;
    // 小范围字样在局部视口再显示；此前已绘制的实际几何始终保留。
    if(viewport.zoom<2 && (r.partitionType==="trigeminal_sensory" ||
       r.labelPoint.y>=BODY_LANDMARKS[model.view].ankle.y/model.logicalHeight))continue;
    const p=normalizedToCanvas(r.labelPoint,viewport),width=ctx.measureText(r.labelId).width+6;
    const b={x:p.x-width/2,y:p.y-6,width,height:12};
    if(b.x<0 || b.y<0 || b.x+b.width>viewport.viewportWidth || b.y+12>viewport.viewportHeight ||
      boxes.some(a=>a.x<b.x+b.width && b.x<a.x+a.width && a.y<b.y+12 && b.y<a.y+a.height))continue;
    boxes.push(b);ctx.strokeStyle="#ffffff";ctx.lineWidth=3;ctx.strokeText(r.labelId,p.x,p.y);
    ctx.fillStyle="#173d38";ctx.fillText(r.labelId,p.x,p.y);
   }
  }
 } finally {ctx.restore();}
}
