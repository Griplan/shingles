import {getLocalModel,isLocalSurfaceView} from "../../data/local-models";
import {LocalSurfaceView} from "../../types/local-surface";
import {AnnotationLayer} from "../../types/annotation";
import {AtlasRegion} from "../../types/atlas";
import {NormalizedRect,ViewportTransform,NormalizedPoint} from "../../types/dermatome";
import {fitViewport,focusViewport,canvasToNormalized,normalizedToCanvas} from "../../utils/coordinate";
import {readTouch,InputTouch} from "../../utils/body-debug";
import {pointInBody} from "../../utils/annotation-geometry";
import {drawLesions} from "../body-canvas/lesion-render";
type Context=WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
interface Runtime {alive:boolean;generation:number;layout:number;pending:number|null;node:WechatMiniprogram.Canvas|null;ctx:Context|null;width:number;height:number;viewport:ViewportTransform|null;images:Map<string,Promise<WechatMiniprogram.Image>>;start:InputTouch|null;gestureView:string;gestureToken:{sessionId:string;revision:number}|null;moved:boolean;painted:string}
const states=new WeakMap<object,Runtime>();
const validView=isLocalSurfaceView;
Component({
 properties:{view:{type:String,value:"sole-left"},layer:{type:null,value:null as AnnotationLayer<LocalSurfaceView>|null},atlasRegions:{type:Array,value:[] as readonly AtlasRegion<LocalSurfaceView>[]},focusBounds:{type:null,value:null as NormalizedRect|null},disabled:Boolean,interactionBlocked:Boolean,layoutRevision:Number},
 data:{error:"",loading:true},
 observers:{"view,layer,atlasRegions,focusBounds,disabled,interactionBlocked"(){this.queueDraw();},"layoutRevision"(){this.invalidateLayout();}},
 lifetimes:{created(){states.set(this,{alive:false,generation:0,layout:0,pending:null,node:null,ctx:null,width:0,height:0,viewport:null,images:new Map(),start:null,gestureView:"",gestureToken:null,moved:false,painted:""});},ready(){const s=states.get(this);if(s)s.alive=true;void this.initialize();},detached(){const s=states.get(this);if(s){s.alive=false;s.generation++;if(s.pending!==null)s.node?.cancelAnimationFrame(s.pending);s.images.clear();}states.delete(this);}},
 pageLifetimes:{show(){this.invalidateLayout();},resize(){this.invalidateLayout();}},
 methods:{
  invalidateLayout(){const s=states.get(this);if(!s?.alive)return;s.layout++;s.start=null;s.viewport=null;void this.initialize();},
  async initialize(){const s=states.get(this);if(!s?.alive)return;const generation=++s.generation,layout=s.layout;
   try{
    const result=await new Promise<{node:WechatMiniprogram.Canvas;width:number;height:number}>(resolve=>this.createSelectorQuery().select("#local-surface").fields({node:true,size:true}).exec((r:unknown[])=>resolve(r[0] as never)));
    if(states.get(this)!==s||!s.alive||s.generation!==generation||s.layout!==layout)return;
    if(!result?.node||result.width<=0||result.height<=0)throw Error("画布尚未就绪");
    if(s.node!==result.node){if(s.pending!==null)s.node?.cancelAnimationFrame(s.pending);s.pending=null;s.images.clear();s.painted="";}
    s.node=result.node;s.ctx=result.node.getContext("2d") as Context;s.width=result.width;s.height=result.height;
    this.queueDraw();
   }catch{if(states.get(this)===s&&s.generation===generation)this.setData({error:"当前部位显示暂时不可用",loading:false});}
  },
  queueDraw(){const s=states.get(this);if(!s?.alive||!s.node||s.pending!==null)return;
   s.pending=s.node.requestAnimationFrame(()=>{s.pending=null;void this.redraw();});
  },
  async redraw(){const s=states.get(this);if(!s?.alive||!s.node||!s.ctx||!validView(this.properties.view))return;
   const generation=++s.generation,node=s.node,ctx=s.ctx,view=this.properties.view,model=getLocalModel(view),key=`${view}:${model.id}:${model.version}:${model.geometryId}`;
   const current=()=>states.get(this)===s&&s.alive&&s.generation===generation&&this.properties.view===view;
   try{
    if(s.painted!==key){s.viewport=null;this.setData({loading:true,error:""});}
    let promise=s.images.get(model.imagePath);
    if(!promise){promise=new Promise((resolve,reject)=>{const image=node.createImage();image.onload=()=>resolve(image);image.onerror=()=>reject(Error("resource"));image.src=model.imagePath;});s.images.set(model.imagePath,promise);}
    const image=await promise;if(!current())return;
    const dpr=wx.getWindowInfo().pixelRatio||1,w=Math.round(s.width*dpr),h=Math.round(s.height*dpr);
    if(node.width!==w)node.width=w;if(node.height!==h)node.height=h;
    const full=fitViewport(s.width,s.height,model,12),v=this.properties.focusBounds?focusViewport(full,this.properties.focusBounds):full;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,s.width,s.height);ctx.fillStyle="#faf8f4";ctx.fillRect(0,0,s.width,s.height);
    ctx.drawImage(image,v.offsetX,v.offsetY,model.logicalWidth*v.scale,model.logicalHeight*v.scale);
    ctx.save();try{
     ctx.beginPath();ctx.rect(0,0,s.width,s.height);ctx.clip();ctx.lineWidth=.8;ctx.lineJoin="round";
     for(const region of this.properties.atlasRegions as readonly AtlasRegion<LocalSurfaceView>[]){
      if(region.view!==view||region.templateId!==model.id||region.templateVersion!==model.version||region.geometryId!==model.geometryId||region.atlasVersion!==model.atlas.identity.atlas_version)continue;
      for(const polygon of region.geometry.coordinates){ctx.beginPath();
       const signed=(r:readonly (readonly [number,number])[])=>r.reduce((sum,a,i)=>{const b=r[(i+1)%r.length];return sum+a[0]*b[1]-a[1]*b[0];},0);
       const sign=signed(polygon[0]);polygon.forEach((r,i)=>{const ring=i&&signed(r)*sign>0?[...r].reverse():r;ring.forEach(([x,y],j)=>{const p=normalizedToCanvas({x,y},v);if(j)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();});
       ctx.globalAlpha=.3;ctx.fillStyle=region.color;ctx.fill();ctx.globalAlpha=.85;ctx.strokeStyle=region.color;ctx.stroke();
      }
     }
    }finally{ctx.restore();}
    drawLesions(ctx,v,model,this.properties.layer);s.viewport=v;s.painted=key;
    this.setData({error:"",loading:false});this.triggerEvent("viewport",{view,viewport:v});
   }catch{if(current()){s.viewport=null;s.images.delete(model.imagePath);this.setData({error:"当前部位素材未能显示，请重试",loading:false});}}
  },
  retry(){this.invalidateLayout();},
  touchStart(e:unknown){const s=states.get(this);if(!s)return;const layer=this.properties.layer;s.start=readTouch(e);s.gestureView=this.properties.view;s.gestureToken=layer?{sessionId:layer.sessionId,revision:layer.revision}:null;s.moved=false;},
  touchMove(e:unknown){const s=states.get(this),p=readTouch(e);if(!s?.start)return;if(!p||p.kind!==s.start.kind||Math.hypot(p.point.x-s.start.point.x,p.point.y-s.start.point.y)>8)s.moved=true;},
  touchCancel(){const s=states.get(this);if(s){s.start=null;s.moved=true;}},
  async touchEnd(e:unknown){const s=states.get(this),input=readTouch(e);if(!s?.start||s.gestureView!==this.properties.view||s.moved||!input||this.properties.disabled||this.properties.interactionBlocked||!s.viewport||!validView(this.properties.view))return;
   const token=s.gestureToken,unchanged=()=>!!token&&this.properties.layer?.sessionId===token.sessionId&&this.properties.layer?.revision===token.revision;
   if(!token||!unchanged()){s.start=null;return;}
   const start=s.start;s.start=null;if(input.kind!==start.kind||Math.hypot(input.point.x-start.point.x,input.point.y-start.point.y)>8)return;
   const view=this.properties.view,model=getLocalModel(view),viewport=s.viewport,layout=s.layout;let p:NormalizedPoint|null=null;
   let x=input.point.x,y=input.point.y;
   if(input.kind==="client"){
    const bounds=await new Promise<WechatMiniprogram.BoundingClientRectCallbackResult>(resolve=>this.createSelectorQuery().select("#local-surface").boundingClientRect(r=>resolve(r as WechatMiniprogram.BoundingClientRectCallbackResult)).exec());
    if(!bounds||Math.abs(bounds.width-s.width)>.5||Math.abs(bounds.height-s.height)>.5)return;x-=bounds.left;y-=bounds.top;
   }
   if(states.get(this)!==s||!s.alive||s.viewport!==viewport||s.layout!==layout||this.properties.view!==view||this.properties.disabled||this.properties.interactionBlocked||!unchanged())return;
   p=canvasToNormalized({x,y},viewport);const inside=!!p&&pointInBody(p,model.body);
   this.triggerEvent("point",{...token,view,templateId:model.id,templateVersion:model.version,geometryId:model.geometryId,status:inside?"valid":"outside",point:inside?p:null});
  }
 }
});
