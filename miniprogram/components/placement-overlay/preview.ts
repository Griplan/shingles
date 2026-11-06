import {BodyModelConfig,NormalizedPoint,ViewportTransform} from "../../types/dermatome";
import {PlacementTransform,PreparedPhotoGeometry} from "../../types/placement";
import {placementSimilarity,pointInPhotoPlacement} from "../../utils/placement-geometry";
import {projectNormalizedToCanvas} from "../../utils/coordinate";

type Context=WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
const FILL="rgba(208,91,47,0.30)",EDGE="#ab4c2d";
/** One cache per immutable confirmed source. Raster is only an editing preview. */
export class PlacementPreview {
 private readonly paths:readonly (readonly (readonly NormalizedPoint[])[])[];
 private cache:WechatMiniprogram.OffscreenCanvas|null=null;
 private cacheRect:{x:number;y:number;width:number;height:number}|null=null;
 constructor(readonly photo:PreparedPhotoGeometry){
  // Orient once for nonzero filling; never bridge holes or drop small components.
  this.paths=photo.polygons.map(poly=>poly.map((ring,index)=>{
   let area=0;for(let k=1;k+1<ring.length;k++)area+=(ring[k].x-ring[0].x)*(ring[k+1].y-ring[0].y)-(ring[k+1].x-ring[0].x)*(ring[k].y-ring[0].y);
   return ((area>0)===(index===0)?ring:[...ring].reverse()).map(q=>({x:q.x*photo.width,y:q.y*photo.height}));
  }));
  try{
   if(typeof wx.createOffscreenCanvas!=="function")return;
   const b=photo.bounds,ratio=Math.min(2044/Math.max(b.width,b.height),Math.max(1,1020/Math.max(b.width,b.height)));
   const width=Math.ceil(b.width*ratio)+4,height=Math.ceil(b.height*ratio)+4;
   const cache=wx.createOffscreenCanvas({type:"2d",width,height}),ctx=cache.getContext("2d");
   ctx.setTransform(ratio,0,0,ratio,2-b.x*ratio,2-b.y*ratio);
   this.drawPaths(ctx,false,1);this.cache=cache;
   this.cacheRect={x:b.x-2/ratio,y:b.y-2/ratio,width:width/ratio,height:height/ratio};
  }catch{this.cache=null;this.cacheRect=null;/* Old devices retain exact vector preview. */}
 }
 private drawPaths(ctx:Context,stroke:boolean,lineWidth:number):void {
  for(const poly of this.paths){ctx.beginPath();for(const ring of poly){ring.forEach((q,i)=>{if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y)});ctx.closePath();}
   ctx.fillStyle=FILL;ctx.fill();if(stroke){ctx.strokeStyle=EDGE;ctx.lineWidth=lineWidth;ctx.lineJoin="round";ctx.stroke();}}
 }
 draw(ctx:Context,v:ViewportTransform,t:PlacementTransform,model:BodyModelConfig,interactive:boolean):void {
  const {c,s,k}=placementSimilarity(this.photo,t,model),a=projectNormalizedToCanvas(t.translation,v),scale=k*v.scale;
  ctx.save();try{ctx.transform(c*scale,s*scale,-s*scale,c*scale,a.x,a.y);ctx.translate(-t.photoCenter.x,-t.photoCenter.y);
  if(interactive&&this.cache&&this.cacheRect){const b=this.cacheRect;
   try{ctx.drawImage(this.cache,b.x,b.y,b.width,b.height);}catch{this.cache=null;this.cacheRect=null;this.drawPaths(ctx,true,1.6/scale);}
  }else this.drawPaths(ctx,true,1.6/scale);
  }finally{ctx.restore();}
  if(interactive){
   // Only four bound corners; no MultiPolygon traversal while moving.
   const b=this.photo.bounds,points=[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]];
   ctx.beginPath();points.forEach(([px,py],i)=>{const x=(px-t.photoCenter.x)*scale,y=(py-t.photoCenter.y)*scale;
    if(i===0)ctx.moveTo(a.x+c*x-s*y,a.y+s*x+c*y);else ctx.lineTo(a.x+c*x-s*y,a.y+s*x+c*y);});ctx.closePath();
   ctx.setLineDash([4,4]);ctx.strokeStyle=EDGE;ctx.lineWidth=1.2;ctx.stroke();ctx.setLineDash([]);
  }
 }
 hit(point:NormalizedPoint,t:PlacementTransform,model:BodyModelConfig):boolean {
  const {c,s,k}=placementSimilarity(this.photo,t,model),x=(point.x-t.translation.x)*model.logicalWidth,y=(point.y-t.translation.y)*model.logicalHeight;
  const q={x:(t.photoCenter.x+(c*x+s*y)/k)/this.photo.width,y:(t.photoCenter.y+(-s*x+c*y)/k)/this.photo.height};
  return pointInPhotoPlacement(q,this.photo);
 }
 dispose():void {if(this.cache){this.cache.width=1;this.cache.height=1;}this.cache=null;this.cacheRect=null;}
}
