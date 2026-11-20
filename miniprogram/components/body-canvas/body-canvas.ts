import { getBodyModel } from "../../data/body-models";
import { BodyModelConfig, BodyView, CanvasRect, DebugPoint, NormalizedRect, ViewportTransform } from "../../types/dermatome";
import { AtlasLayer, AtlasRegion } from "../../types/atlas";
import { fitViewport, focusViewport, panViewport, reframeViewport, zoomViewportAt } from "../../utils/coordinate";
import { InputTouch, probeTouch, readTouch } from "../../utils/body-debug";
import { drawBody, BodyContext } from "./render";
import { hitTestRegion } from "../../utils/body-hit-test";
import { AnnotationLayer } from "../../types/annotation";
import { bodyGeometry, pointInBody } from "../../utils/annotation-geometry";
import { modelBasis, sameBasis } from "../../state/annotation-session";
import { OverlayTransition, FrameClock } from "../../utils/overlay-transition";
import { EXPERIENCE } from "../../config/experience";
import { canUseDeveloperTools } from "../../config/environment";
import { canvasBackingSize, windowPixelRatio } from "../../utils/canvas-size";
interface ImageEntry { image:WechatMiniprogram.Image;ready:boolean;failed:boolean;promise:Promise<boolean>;resolve:(ready:boolean)=>void }
interface CanvasMeasurement { node?:WechatMiniprogram.Canvas;width:number;height:number }
interface ShellMeasurement { width:number;height:number }
interface GesturePoint {id:number;point:{x:number;y:number};kind:"canvas"|"client"}
interface CameraGesture {kind:"pan"|"pinch";start:GesturePoint[];base:ViewportTransform;rect:{left:number;top:number}|null;
  distance:number;midpoint:{x:number;y:number};moved:boolean}
interface Runtime {
 mounted:boolean;visible:boolean;pending:boolean;scheduled:boolean;generation:number;probeSequence:number;
 model:BodyModelConfig|null;viewport:ViewportTransform|null;point:DebugPoint|null;touch:InputTouch|null;moved:boolean;
 measurement:CanvasMeasurement|null;shellMeasurement:ShellMeasurement|null;ctx:BodyContext|null;layout:number;images:Map<string,ImageEntry>;
 transition:OverlayTransition;overlayKey:string;displayRegions:Map<string,AtlasRegion>;displayLayer:AtlasLayer|null;
 measures:number;initializations:number;loads:number;frames:number;painted:boolean;queuedAt:number;ctxNode:WechatMiniprogram.Canvas|null;
 manualViewport:ViewportTransform|null;cameraKey:string;gesture:CameraGesture|null;gestureSequence:number;
 layoutRetries:number;layoutTimer:ReturnType<typeof setTimeout>|null;nodeRetries:number;
 nodeRetryTimer:ReturnType<typeof setTimeout>|null;fallbackMode:boolean;fallbackViewportKey:string;
 fallbackSceneKey:string;
}
const runtimes=new WeakMap<object,Runtime>();
function gesturePoints(event:unknown):GesturePoint[] {
 const source=event&&typeof event==="object"?(event as Record<string,unknown>).touches:null;
 if(!Array.isArray(source))return [];
 const points:GesturePoint[]=[];
 source.forEach((raw,index)=>{
  if(!raw||typeof raw!=="object")return;
  const t=raw as Record<string,unknown>,id=typeof t.identifier==="number"?t.identifier:index;
  if(typeof t.x==="number"&&typeof t.y==="number"&&Number.isFinite(t.x)&&Number.isFinite(t.y))
   points.push({id,kind:"canvas",point:{x:t.x,y:t.y}});
  else if(typeof t.clientX==="number"&&typeof t.clientY==="number"&&Number.isFinite(t.clientX)&&Number.isFinite(t.clientY))
   points.push({id,kind:"client",point:{x:t.clientX,y:t.clientY}});
 });
 return points;
}
function gestureGeometry(points:GesturePoint[],rect:{left:number;top:number}|null) {
 const local=points.map(p=>p.kind==="canvas"||!rect?p.point:{x:p.point.x-rect.left,y:p.point.y-rect.top});
 const midpoint=local.length>1?{x:(local[0].x+local[1].x)/2,y:(local[0].y+local[1].y)/2}:local[0]||{x:0,y:0};
 const distance=local.length>1?Math.hypot(local[1].x-local[0].x,local[1].y-local[0].y):0;
 return {midpoint,distance};
}
Component({
 properties:{
  view:{type:String,value:"front"},selectedRegion:{type:String,value:""},zoomRegion:{type:String,value:""},
  debugEnabled:{type:Boolean,value:false},interactionBlocked:{type:Boolean,value:false},touchDisabled:{type:Boolean,value:false},
  layoutRevision:{type:Number,value:0},interactionMode:{type:String,value:"select"},cameraEnabled:{type:Boolean,value:false},
  annotation:{type:null,value:null as AnnotationLayer|null},atlas:{type:null,value:null as AtlasLayer|null},
  focusBounds:{type:null,value:null as NormalizedRect|null},motionEnabled:{type:Boolean,value:false},
  retainedViewport:{type:null,value:null as ViewportTransform|null},
  overlayKey:{type:String,value:""},sceneId:{type:Number,value:0},
 },
 data:{loading:true,error:"",fallbackVisible:false,fallbackSrc:"",fallbackStyle:""},
 observers:{
  "view,selectedRegion,zoomRegion,debugEnabled,interactionBlocked,touchDisabled,layoutRevision,interactionMode,cameraEnabled,annotation,atlas,focusBounds,retainedViewport,motionEnabled,overlayKey,sceneId"(){
   const state=runtimes.get(this);if(!state)return;
   const cameraKey=JSON.stringify([this.properties.view,this.properties.zoomRegion,this.properties.focusBounds,
     this.properties.retainedViewport,this.properties.layoutRevision,this.properties.cameraEnabled]);
   if(state.cameraKey!==cameraKey){state.cameraKey=cameraKey;state.manualViewport=null;state.gesture=null;}
   if(!this.properties.debugEnabled || state.model?.view!==this.properties.view)state.point=null;
   const changed=state.layout!==this.properties.layoutRevision;state.layout=this.properties.layoutRevision;
   this.refreshCanvas(changed);
  },
 },
 lifetimes:{
  created(){runtimes.set(this,{mounted:false,visible:true,pending:false,scheduled:false,generation:0,probeSequence:0,
   model:null,viewport:null,point:null,touch:null,moved:false,measurement:null,shellMeasurement:null,ctx:null,layout:0,images:new Map(),
   transition:new OverlayTransition(),overlayKey:"",displayRegions:new Map(),displayLayer:null,
   measures:0,initializations:0,loads:0,frames:0,painted:false,queuedAt:Date.now(),ctxNode:null,
   manualViewport:null,cameraKey:"",gesture:null,gestureSequence:0,layoutRetries:0,layoutTimer:null,nodeRetries:0,
   nodeRetryTimer:null,fallbackMode:false,fallbackViewportKey:"",fallbackSceneKey:""});},
  ready(){const s=runtimes.get(this);if(s){s.mounted=true;this.queueDraw();}},
  detached(){const s=runtimes.get(this);if(s){if(s.layoutTimer!==null)clearTimeout(s.layoutTimer);if(s.nodeRetryTimer!==null)clearTimeout(s.nodeRetryTimer);s.transition.cancel(true);s.images.forEach(i=>i.resolve(false));}runtimes.delete(this);},
 },
 pageLifetimes:{
  show(){const s=runtimes.get(this);if(s){s.visible=true;this.refreshCanvas(true);}},
  hide(){const s=runtimes.get(this);if(s){if(s.layoutTimer!==null){clearTimeout(s.layoutTimer);s.layoutTimer=null;}if(s.nodeRetryTimer!==null){clearTimeout(s.nodeRetryTimer);s.nodeRetryTimer=null;}s.visible=false;s.generation++;s.probeSequence++;s.pending=false;s.touch=null;
   s.gesture=null;s.manualViewport=null;
   // 恢复时重新确认尺寸并直接绘制终态，不能重播进入结果的淡入。
   s.viewport=null;s.transition.cancel(true);s.displayRegions.clear();}},
  resize(){this.refreshCanvas(true);},
 },
 methods:{
  refreshCanvas(measure=true){
   const s=runtimes.get(this);if(!s)return;if(s.layoutTimer!==null){clearTimeout(s.layoutTimer);s.layoutTimer=null;}
   if(s.nodeRetryTimer!==null){clearTimeout(s.nodeRetryTimer);s.nodeRetryTimer=null;}
   // A failed PNG is only a visual-resource failure. Keep the exact vector
   // template available now, and retry the image on the next explicit refresh.
   s.images.forEach((entry,key)=>{if(entry.failed)s.images.delete(key);});
   s.generation++;s.probeSequence++;s.pending=false;s.touch=null;s.transition.cancel();s.queuedAt=Date.now();
   if(measure){s.measurement=null;s.viewport=null;s.layoutRetries=0;s.nodeRetries=0;}this.queueDraw();
  },
  failCanvas(reason:unknown){const s=runtimes.get(this);if(s){s.viewport=null;s.transition.cancel(true);}
   const detail=reason instanceof Error?reason.message:String(reason||"unknown");
   const code=/layout|width|height/i.test(detail)?"LAYOUT_UNAVAILABLE":/fallback|image/i.test(detail)?"FALLBACK_IMAGE_FAILED":
     /context|上下文/i.test(detail)?"CONTEXT_UNAVAILABLE":/canvas|画布/i.test(detail)?"CANVAS_NODE_MISSING":"DRAW_FAILED";
   if(canUseDeveloperTools())console.warn("[body-canvas] render failed:",detail);
   this.setData({loading:false,error:"人体画布暂时无法显示。请重试；如仍失败，请更新微信或开发者工具基础库。",fallbackVisible:false});
   this.triggerEvent("rendererror",{code,reason:detail,view:this.properties.view==="back"?"back":"front",sceneId:this.properties.sceneId});},
  clearNodeRetry(){const s=runtimes.get(this);if(s?.nodeRetryTimer!==null&&s){clearTimeout(s.nodeRetryTimer);s.nodeRetryTimer=null;}},
  scheduleCanvasNodeRetry(){
   const s=runtimes.get(this);if(!s?.mounted||!s.visible||s.nodeRetryTimer!==null)return;
   if(s.nodeRetries>=10)return;
   const delay=[24,48,80,120,180,260,380,520,700,900][s.nodeRetries++]||900;
   const generation=s.generation;
   s.nodeRetryTimer=setTimeout(()=>{
    s.nodeRetryTimer=null;
    if(runtimes.get(this)!==s||!s.visible||s.generation!==generation)return;
    s.measurement=null;this.queueDraw();
   },delay);
  },
  viewportForFallback(width:number,height:number,model:BodyModelConfig):ViewportTransform {
   const s=runtimes.get(this),base=fitViewport(width,height,model),target=model.regions.find(r=>r.id===this.properties.zoomRegion);
   const retained=this.properties.retainedViewport;
   if(retained&&(retained.logicalWidth!==model.logicalWidth||retained.logicalHeight!==model.logicalHeight))return base;
   const layout=this.properties.focusBounds?focusViewport(base,this.properties.focusBounds):retained?reframeViewport(retained,width,height):
     target?focusViewport(base,target.bounds):base;
   return s?.manualViewport&&s.manualViewport.viewportWidth===width&&s.manualViewport.viewportHeight===height?s.manualViewport:layout;
  },
  publishFallback(measurement:ShellMeasurement){
   const s=runtimes.get(this);if(!s||!s.visible||!Number.isFinite(measurement.width)||!Number.isFinite(measurement.height)||
     measurement.width<=0||measurement.height<=0){this.retryCanvasMeasurement();return;}
   const view:BodyView=this.properties.view==="back"?"back":"front",model=getBodyModel(view),
     viewport=this.viewportForFallback(measurement.width,measurement.height,model);
   const dpr=windowPixelRatio(),backing=canvasBackingSize(measurement.width,measurement.height,dpr);
   s.fallbackMode=true;s.measurement=null;s.shellMeasurement=measurement;s.layoutRetries=0;
   s.fallbackViewportKey=[model.id,model.version,view,JSON.stringify(viewport)].join("|");
   this.setData({loading:false,error:"",fallbackVisible:true,fallbackSrc:model.visual.imagePath||"",
     fallbackStyle:`left:${viewport.offsetX}px;top:${viewport.offsetY}px;width:${model.logicalWidth*viewport.scale}px;height:${model.logicalHeight*viewport.scale}px;`});
   this.triggerEvent("viewportchange",{view,modelId:model.id,modelVersion:model.version,visualId:model.visual.id,
     viewport,dpr,physicalWidth:backing.width,physicalHeight:backing.height,markerCanvas:null,
     fallback:true,layoutRevision:this.properties.layoutRevision});
  },
  activateImageFallback(reason:unknown,measurement?:ShellMeasurement){
   const s=runtimes.get(this);if(!s||!s.visible)return;
   const detail=reason instanceof Error?reason.message:String(reason||"canvas-unavailable");
   if(canUseDeveloperTools())console.info("[body-canvas] image fallback",{reason:detail,view:this.properties.view});
   s.fallbackMode=true;s.measurement=null;
   const view:BodyView=this.properties.view==="back"?"back":"front",src=getBodyModel(view).visual.imagePath||"";
   if(this.data.fallbackSrc!==src||!this.data.fallbackVisible)this.setData({loading:false,error:"",fallbackSrc:src,fallbackVisible:true});
   if(measurement&&measurement.width>0&&measurement.height>0)this.publishFallback(measurement);
   else if(s.shellMeasurement&&s.shellMeasurement.width>0&&s.shellMeasurement.height>0)this.publishFallback(s.shellMeasurement);
   else {
    try{this.createSelectorQuery().select(".canvas-shell").fields({size:true}).exec((results:unknown[])=>{
      const shell=results[0] as ShellMeasurement|undefined;
      if(shell)this.publishFallback(shell);else this.retryCanvasMeasurement();
    });}catch{this.retryCanvasMeasurement();}
   }
   this.scheduleCanvasNodeRetry();
  },
  activateLayoutFallback(){
   const s=runtimes.get(this);if(!s?.visible)return;
   // A 2D canvas node can briefly report width 0 while its parent shell is
   // already laid out. Keep the body and coordinate viewport usable through
   // the local PNG instead of turning this recoverable race into a fatal
   // error. scheduleCanvasNodeRetry() promotes the same region back to Canvas
   // as soon as the node receives its final size.
   if(s.shellMeasurement&&s.shellMeasurement.width>0&&s.shellMeasurement.height>0){
    this.activateImageFallback("layout-width-unavailable",s.shellMeasurement);return;
   }
   try{
    this.createSelectorQuery().select(".canvas-shell").fields({size:true}).exec((results:unknown[])=>{
     const shell=results[0] as ShellMeasurement|undefined;
     if(shell&&shell.width>0&&shell.height>0)this.activateImageFallback("layout-width-unavailable",shell);
     else this.retryCanvasMeasurement();
    });
   }catch{this.retryCanvasMeasurement();}
  },
  onFallbackLoad(){
   const s=runtimes.get(this);if(!s||!s.fallbackMode)return;
   const key=[this.properties.view,s.fallbackViewportKey,this.properties.sceneId].join(":");
   if(s.fallbackSceneKey===key)return;s.fallbackSceneKey=key;
   this.triggerEvent("sceneready",{sceneId:this.properties.sceneId,view:this.properties.view,durationMs:0,fallback:true});
  },
  onFallbackError(){
   const s=runtimes.get(this);if(!s)return;
   this.failCanvas("fallback-image-unavailable");
  },
  retryCanvasMeasurement(){
   const s=runtimes.get(this);if(!s?.mounted||!s.visible)return;
   if(s.layoutRetries>=10){this.failCanvas("layout-width-or-height-unavailable");return;}
   const delay=[16,32,64,96,128,160,220,300,400,500][s.layoutRetries++];
   s.measurement=null;s.viewport=null;s.pending=false;
   if(!s.painted)this.setData({loading:true,error:""});
   if(s.layoutTimer!==null)clearTimeout(s.layoutTimer);
   const generation=s.generation;
   s.layoutTimer=setTimeout(()=>{
    s.layoutTimer=null;
    if(runtimes.get(this)!==s||!s.visible||s.generation!==generation)return;
    this.queueDraw();
   },delay);
  },
  ensureImage(model:BodyModelConfig,node:WechatMiniprogram.Canvas):ImageEntry|null {
   const s=runtimes.get(this);if(!s || !model.visual.imagePath || typeof node.createImage!=="function")return null;
   const key=[model.id,model.version,model.view,model.visual.imagePath].join(":");let entry=s.images.get(key);
   if(entry)return entry;
   let resolve:(ready:boolean)=>void=()=>{};const promise=new Promise<boolean>(r=>{resolve=r;});
   entry={image:node.createImage(),ready:false,failed:false,promise,resolve};const current=entry;s.images.set(key,current);s.loads++;
   const finish=(ok:boolean)=>{if(runtimes.get(this)!==s)return;
    current.ready=ok;current.failed=!ok;resolve(ok);
    // drawBody already painted the exact frozen template as a placeholder.
    // Never turn a delayed/failed optional PNG into a whole-canvas fatal error.
    if(ok && s.visible && this.properties.view===model.view)this.refreshCanvas(false);
   };
   current.image.onload=()=>finish(current.image.width>0 && current.image.height>0);
   current.image.onerror=()=>finish(false);current.image.src=model.visual.imagePath;return current;
  },
  /** 页面先等待本地目标图片就绪，再一并提交view/标注/标签；此期间旧场景保持完整。 */
  async prepareView(view:string):Promise<boolean>{
   const s=runtimes.get(this);if(!s?.measurement || (view!=="front"&&view!=="back"))return false;
   if(!s.measurement.node)return false;
   const image=this.ensureImage(getBodyModel(view),s.measurement.node);return image?image.promise:true;
  },
  queueDraw(){
   const s=runtimes.get(this);if(!s || !s.mounted || !s.visible || s.pending || s.scheduled || this.properties.interactionBlocked)return;
   s.scheduled=true;
   wx.nextTick(()=>{s.scheduled=false;if(runtimes.get(this)!==s||!s.visible||this.properties.interactionBlocked)return;
    s.pending=true;const generation=s.generation;
    const current=()=>runtimes.get(this)===s && s.visible && generation===s.generation;
    const draw=(measurement:CanvasMeasurement)=>{if(!current())return;s.pending=false;
     try{
     if(!measurement){this.activateImageFallback("canvas-node-unavailable");return;}
     if(!Number.isFinite(measurement.width)||!Number.isFinite(measurement.height)||measurement.width<=0||measurement.height<=0){
      if(canUseDeveloperTools())console.info("[body-canvas] waiting for layout",{width:measurement?.width,height:measurement?.height,retry:s.layoutRetries});
      this.activateLayoutFallback();return;
     }
     if(!measurement.node || typeof measurement.node.getContext!=="function"){this.activateImageFallback("canvas-node-unavailable",measurement);return;}
     s.layoutRetries=0;
      if(canUseDeveloperTools())console.info("[body-canvas] measuring",{width:measurement.width,height:measurement.height,visible:s.visible});
      if(s.ctxNode && s.ctxNode!==measurement.node){s.ctx=null;s.images.forEach(i=>i.resolve(false));s.images.clear();s.transition.cancel(true);s.displayRegions.clear();}
     s.measurement=measurement as {node:WechatMiniprogram.Canvas;width:number;height:number};s.fallbackMode=false;
     this.clearNodeRetry();s.nodeRetries=0;
      this.paintScene();
    }catch(error){this.activateImageFallback(error,{width:measurement?.width||0,height:measurement?.height||0});}
    };
    // Layout changes are signalled explicitly through layoutRevision, resize
    // and page show. Ordinary scene and gesture frames reuse the measured node
    // and CSS size so dragging never triggers a selector query.
    if(s.measurement){draw(s.measurement);return;}
    try{s.measures++;this.createSelectorQuery().select("#body-canvas").fields({node:true,size:true}).exec((results:unknown[])=>draw(results[0] as CanvasMeasurement));}
    catch(error){s.pending=false;this.failCanvas(error);}
   });
  },
  paintScene(){
   const s=runtimes.get(this);if(!s?.measurement?.node||!s.visible)return;
   const {node,width,height}=s.measurement,view:BodyView=this.properties.view==="back"?"back":"front",
     model=getBodyModel(view),entry=this.ensureImage(model,node);
   // 两个本地视图共用节点缓存。没有清空和异步等待之间的半成品帧。
   this.ensureImage(getBodyModel(view==="front"?"back":"front"),node);
   if(entry && !entry.ready && canUseDeveloperTools())console.info("[body-canvas] drawing vector placeholder while image loads",{view});
   const {dpr,width:physicalWidth,height:physicalHeight}=canvasBackingSize(width,height,windowPixelRatio());
   const base=fitViewport(width,height,model),target=model.regions.find(r=>r.id===this.properties.zoomRegion);
   const retained=this.properties.retainedViewport;
   if(retained&&(retained.logicalWidth!==model.logicalWidth||retained.logicalHeight!==model.logicalHeight))throw Error("视口模板不一致");
   const layoutViewport=this.properties.focusBounds?focusViewport(base,this.properties.focusBounds):retained?reframeViewport(retained,width,height):target?focusViewport(base,target.bounds):base;
   const viewport=s.manualViewport&&s.manualViewport.viewportWidth===width&&s.manualViewport.viewportHeight===height?
     s.manualViewport:layoutViewport;
   if(node.width!==physicalWidth)node.width=physicalWidth;if(node.height!==physicalHeight)node.height=physicalHeight;
   if(!s.ctx){s.ctx=node.getContext("2d");s.ctxNode=node;s.initializations++;}const ctx=s.ctx;if(!ctx)throw Error("无2D上下文");
   const priorViewport=s.viewport,priorView=s.model?.view;s.model=model;s.viewport=viewport;
   const atlas=this.properties.atlas,annotation=this.properties.annotation,sceneId=this.properties.sceneId;
   const key=[model.id,model.version,view,this.properties.overlayKey,annotation?.sessionId||""].join(":");
   const retain=s.overlayKey===key && priorView===view;s.overlayKey=key;
   if(!retain)s.displayRegions.clear();
   const previousLayer=s.displayLayer;if(atlas)s.displayLayer=atlas;
   for(const r of atlas?.regions||[])s.displayRegions.set(r.id,r);
   const displayLayer=atlas||previousLayer;
   const generation=s.generation,start=Date.now();let first=true,firstFrameReadyMs=0,firstVisibleOverlayFrameMs:number|null=null;
   const valid=()=>runtimes.get(this)===s && s.visible && s.generation===generation;
   const clock:FrameClock|null=this.properties.motionEnabled && typeof node.requestAnimationFrame==="function" && typeof node.cancelAnimationFrame==="function" ?
    {now:()=>Date.now(),request:cb=>node.requestAnimationFrame(cb),cancel:id=>node.cancelAnimationFrame(id)}:null;
   const paint=(opacity:ReadonlyMap<string,number>,done:boolean)=>{
    if(!valid())return;try{const drawStart=Date.now();ctx.setTransform(dpr,0,0,dpr,0,0);
    const layer=displayLayer?{...displayLayer,regions:[...s.displayRegions.values()]}:null;
    const markerCanvas=drawBody(ctx,viewport,model,model.regions.find(r=>r.id===this.properties.selectedRegion),
     this.properties.debugEnabled?s.point:null,entry?.ready?entry.image:null,annotation,layer,opacity);
    s.frames++;s.painted=true;
    if(firstVisibleOverlayFrameMs===null && (atlas?.regions||[]).some(r=>(opacity.get(r.id)||0)>0))firstVisibleOverlayFrameMs=Date.now()-s.queuedAt;
    if(this.data.loading || this.data.error || this.data.fallbackVisible)this.setData({loading:false,error:"",fallbackVisible:false});
    if(first){first=false;firstFrameReadyMs=Date.now()-s.queuedAt;
     if(canUseDeveloperTools())console.info("[body-canvas] viewport-ready",{view,firstFrameReadyMs,width,height});
     // 帧调度不会重复发标签布局事件。
     this.triggerEvent("viewportchange",{view,modelId:model.id,modelVersion:model.version,visualId:model.visual.id,
      viewport,dpr,physicalWidth,physicalHeight,markerCanvas,fallback:false,layoutRevision:this.properties.layoutRevision});
     this.triggerEvent("sceneready",{sceneId,view,durationMs:clock?EXPERIENCE.overlayMs:0});
    }
    if(done){s.displayRegions=new Map((atlas?.regions||[]).map(r=>[r.id,r]));s.displayLayer=atlas;
     this.triggerEvent("renderstats",{sceneId,view,measures:s.measures,initializations:s.initializations,resourceLoads:s.loads,
      frames:s.frames,firstFrameReadyMs,firstVisibleOverlayFrameMs,completedFrameReadyMs:Date.now()-s.queuedAt,
      drawMs:Date.now()-drawStart,transitionMs:Date.now()-start,width,height});
    }}catch(error){this.failCanvas(error);}
   };
   // 视口变化不对几何做插值。无动画时一次绘制完整终态。
   const sameViewport=JSON.stringify(priorViewport)===JSON.stringify(viewport);
   s.transition.start((atlas?.regions||[]).map(r=>r.id),retain,clock && sameViewport?EXPERIENCE.overlayMs:0,clock,paint);
  },
    resetCamera(){const state=runtimes.get(this);if(!state||!state.manualViewport)return;state.manualViewport=null;state.gesture=null;this.queueDraw();},
    beginCameraGesture(event:unknown):boolean {
      const state=runtimes.get(this),points=gesturePoints(event);
      if(!state?.viewport||!this.properties.cameraEnabled||this.properties.debugEnabled||
        this.properties.interactionBlocked||this.properties.touchDisabled||points.length===0)return false;
      const pinch=points.length>1;
      if(!pinch&&this.properties.interactionMode==="draw")return false;
      const sequence=++state.gestureSequence,generation=state.generation,base=state.manualViewport||state.viewport;
      const setup=(rect:{left:number;top:number}|null)=>{
       if(runtimes.get(this)!==state||state.gestureSequence!==sequence||state.generation!==generation||!state.visible)return;
       const geometry=gestureGeometry(points,rect);
       state.gesture={kind:pinch?"pinch":"pan",start:points,base,rect,distance:geometry.distance,
         midpoint:geometry.midpoint,moved:false};
      };
      if(points[0].kind==="client"){
       this.createSelectorQuery().select("#body-canvas").boundingClientRect(rect=>setup(rect as {left:number;top:number}|null)).exec();
      }else setup(null);
      return true;
    },
    onCanvasStart(event:unknown) {
      const state=runtimes.get(this);if(!state)return;
      state.touch=null;state.gesture=null;
      if(this.beginCameraGesture(event))return;
      if(!state.viewport || (this.properties.interactionBlocked || this.properties.touchDisabled) || (!this.properties.debugEnabled &&
        (this.properties.interactionMode==="readonly" ||
          (this.properties.interactionMode!=="draw" && this.properties.zoomRegion))))return;
      state.touch=readTouch(event);state.moved=false;
    },
    onCanvasMove(event:unknown) {
      const state=runtimes.get(this);if(!state)return;
      if(state.gesture){
       const points=gesturePoints(event);if(points.length===0)return;
       const view=this.properties.view==="back"?"back":"front";
       const geometry=gestureGeometry(points,state.gesture.rect),model=getBodyModel(view);
       let next:ViewportTransform;
       if(state.gesture.kind==="pinch"){
        if(points.length<2||state.gesture.distance<=0)return;
        const factor=Math.max(.1,Math.min(10,geometry.distance/state.gesture.distance));
        next=panViewport(zoomViewportAt(state.gesture.base,state.gesture.midpoint,factor,model),
          geometry.midpoint.x-state.gesture.midpoint.x,geometry.midpoint.y-state.gesture.midpoint.y);
       }else next=panViewport(state.gesture.base,geometry.midpoint.x-state.gesture.midpoint.x,
         geometry.midpoint.y-state.gesture.midpoint.y);
       state.gesture.moved=true;state.manualViewport=next;state.point=null;this.queueDraw();return;
      }
      if(!state.touch)return;
      const next=readTouch(event);
      if(!next||next.kind!==state.touch.kind||
        Math.hypot(next.point.x-state.touch.point.x,next.point.y-state.touch.point.y)>8)state.moved=true;
    },
    onCanvasCancel() { const state=runtimes.get(this);if(state){state.touch=null;state.gesture=null;} },
    onCanvasEnd(event:unknown) {
      const state=runtimes.get(this),input=readTouch(event);
      if(!state)return;
      if(state.gesture){state.gesture=null;this.queueDraw();return;}
      const start=state.touch;state.touch=null;
      if((this.properties.interactionBlocked || this.properties.touchDisabled)||!state.visible||!start||state.moved||!input)return;
      const debugging=this.properties.debugEnabled;
      const drawing=this.properties.interactionMode==="draw",layer=this.properties.annotation;
      const mode=this.properties.interactionMode;
      if(!debugging && (mode==="readonly" || (!drawing && this.properties.zoomRegion)))return;
      if(input.kind!==start.kind||Math.hypot(input.point.x-start.point.x,input.point.y-start.point.y)>8)return;
      const viewport=state.viewport,model=state.model;
      if(!viewport||!model)return;
      const generation=state.generation,sequence=++state.probeSequence;
      // 每次点击重新测量可见矩形，不缓存滚动前的top，不读取DOM或设备物理屏幕坐标。
      const current=()=>runtimes.get(this)===state && generation===state.generation &&
        sequence===state.probeSequence && state.visible && !(this.properties.interactionBlocked || this.properties.touchDisabled) &&
        this.properties.debugEnabled===debugging && this.properties.interactionMode===mode &&
        this.properties.annotation?.revision===layer?.revision &&
        this.properties.annotation?.sessionId===layer?.sessionId &&
        (debugging || drawing || !this.properties.zoomRegion);
      const annotationProbe=(status:string,normalized:unknown)=>{
        if(layer && layer.view===model.view && sameBasis(layer.basis,modelBasis(model)))
          this.triggerEvent("annotationpoint",{sessionId:layer.sessionId,revision:layer.revision,
            view:model.view,basis:modelBasis(model),status,normalized});
      };
      const unavailable=()=>{
        if(!current())return;
        if(debugging) {
          state.point=null;
          this.triggerEvent("debugprobe",{status:"unavailable",view:model.view,modelId:model.id,
            modelVersion:model.version,screen:null,canvas:null,normalized:null});
        } else if(drawing)annotationProbe("unavailable",null);
        else this.triggerEvent("regionprobe",{status:"unavailable",view:model.view,modelId:model.id,
          modelVersion:model.version,regionIds:[]});
        this.queueDraw();
      };
      try {
        this.createSelectorQuery().select("#body-canvas").fields({rect:true,size:true}).exec((results:unknown[])=>{
          if(!current())return;
          const rect=results[0] as CanvasRect | undefined;
          if(!rect){unavailable();return;}
          const probe=probeTouch(input,rect,viewport,model);
          if(debugging) {
            state.point=probe.status==="valid"&&probe.normalized ? {
              view:model.view,modelId:model.id,modelVersion:model.version,normalized:probe.normalized,
            }:null;
            this.triggerEvent("debugprobe",probe);
          } else if(drawing) {
            const valid=probe.status==="valid" && probe.normalized && pointInBody(probe.normalized,bodyGeometry(model));
            annotationProbe(valid?"valid":probe.status==="valid"?"outside-body":probe.status,valid?probe.normalized:null);
          } else {
            const hit=probe.status==="valid"&&probe.normalized ? hitTestRegion(probe.normalized,model) :
              {status:probe.status,regionIds:[]};
            this.triggerEvent("regionprobe",Object.assign({view:model.view,modelId:model.id,
              modelVersion:model.version},hit));
          }
          if(probe.status==="unavailable")this.refreshCanvas();else if(debugging)this.queueDraw();
        });
      } catch {unavailable();}
    },
  },
});
