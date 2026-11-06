import { getBodyModel } from "../../data/body-models";
import { BodyModelConfig, CanvasRect, DebugPoint, NormalizedRect, ViewportTransform } from "../../types/dermatome";
import { AtlasLayer, AtlasRegion } from "../../types/atlas";
import { fitViewport, focusViewport, reframeViewport } from "../../utils/coordinate";
import { InputTouch, probeTouch, readTouch } from "../../utils/body-debug";
import { drawBody, BodyContext } from "./render";
import { hitTestRegion } from "../../utils/body-hit-test";
import { AnnotationLayer } from "../../types/annotation";
import { bodyGeometry, pointInBody } from "../../utils/annotation-geometry";
import { modelBasis, sameBasis } from "../../state/annotation-session";
import { OverlayTransition, FrameClock } from "../../utils/overlay-transition";
import { EXPERIENCE } from "../../config/experience";
interface ImageEntry { image:WechatMiniprogram.Image;ready:boolean;failed:boolean;promise:Promise<boolean>;resolve:(ready:boolean)=>void }
interface CanvasMeasurement { node:WechatMiniprogram.Canvas;width:number;height:number }
interface Runtime {
 mounted:boolean;visible:boolean;pending:boolean;generation:number;probeSequence:number;
 model:BodyModelConfig|null;viewport:ViewportTransform|null;point:DebugPoint|null;touch:InputTouch|null;moved:boolean;
 measurement:CanvasMeasurement|null;ctx:BodyContext|null;layout:number;images:Map<string,ImageEntry>;
 transition:OverlayTransition;overlayKey:string;displayRegions:Map<string,AtlasRegion>;displayLayer:AtlasLayer|null;
 measures:number;initializations:number;loads:number;frames:number;painted:boolean;queuedAt:number;ctxNode:WechatMiniprogram.Canvas|null;
}
const runtimes=new WeakMap<object,Runtime>();
Component({
 properties:{
  view:{type:String,value:"front"},selectedRegion:{type:String,value:""},zoomRegion:{type:String,value:""},
  debugEnabled:{type:Boolean,value:false},interactionBlocked:{type:Boolean,value:false},touchDisabled:{type:Boolean,value:false},
  layoutRevision:{type:Number,value:0},interactionMode:{type:String,value:"select"},
  annotation:{type:null,value:null as AnnotationLayer|null},atlas:{type:null,value:null as AtlasLayer|null},
  focusBounds:{type:null,value:null as NormalizedRect|null},motionEnabled:{type:Boolean,value:false},
  retainedViewport:{type:null,value:null as ViewportTransform|null},
  overlayKey:{type:String,value:""},sceneId:{type:Number,value:0},
 },
 data:{loading:true,error:""},
 observers:{
  "view,selectedRegion,zoomRegion,debugEnabled,interactionBlocked,touchDisabled,layoutRevision,interactionMode,annotation,atlas,focusBounds,retainedViewport,motionEnabled,overlayKey,sceneId"(){
   const state=runtimes.get(this);if(!state)return;
   if(!this.properties.debugEnabled || state.model?.view!==this.properties.view)state.point=null;
   const changed=state.layout!==this.properties.layoutRevision;state.layout=this.properties.layoutRevision;
   this.refreshCanvas(changed);
  },
 },
 lifetimes:{
  created(){runtimes.set(this,{mounted:false,visible:true,pending:false,generation:0,probeSequence:0,
   model:null,viewport:null,point:null,touch:null,moved:false,measurement:null,ctx:null,layout:0,images:new Map(),
   transition:new OverlayTransition(),overlayKey:"",displayRegions:new Map(),displayLayer:null,
   measures:0,initializations:0,loads:0,frames:0,painted:false,queuedAt:Date.now(),ctxNode:null});},
  ready(){const s=runtimes.get(this);if(s){s.mounted=true;this.queueDraw();}},
  detached(){const s=runtimes.get(this);if(s){s.transition.cancel(true);s.images.forEach(i=>i.resolve(false));}runtimes.delete(this);},
 },
 pageLifetimes:{
  show(){const s=runtimes.get(this);if(s){s.visible=true;this.refreshCanvas(true);}},
  hide(){const s=runtimes.get(this);if(s){s.visible=false;s.generation++;s.probeSequence++;s.pending=false;s.touch=null;
   // 恢复时重新确认尺寸并直接绘制终态，不能重播进入结果的淡入。
   s.viewport=null;s.transition.cancel(true);s.displayRegions.clear();}},
  resize(){this.refreshCanvas(true);},
 },
 methods:{
  refreshCanvas(measure=true){
   const s=runtimes.get(this);if(!s)return;s.generation++;s.probeSequence++;s.pending=false;s.touch=null;s.transition.cancel();s.queuedAt=Date.now();
   if(measure)s.measurement=null;this.queueDraw();
  },
  failCanvas(){const s=runtimes.get(this);if(s){s.viewport=null;s.transition.cancel(true);}
   this.setData({loading:false,error:"人体画布暂时无法显示。请重试；如仍失败，请更新微信或开发者工具基础库。"});this.triggerEvent("rendererror");},
  ensureImage(model:BodyModelConfig,node:WechatMiniprogram.Canvas):ImageEntry|null {
   const s=runtimes.get(this);if(!s || !model.visual.imagePath)return null;
   const key=[model.id,model.version,model.view,model.visual.imagePath].join(":");let entry=s.images.get(key);
   if(entry && !entry.failed)return entry;
   let resolve:(ready:boolean)=>void=()=>{};const promise=new Promise<boolean>(r=>{resolve=r;});
   entry={image:node.createImage(),ready:false,failed:false,promise,resolve};const current=entry;s.images.set(key,current);s.loads++;
   const finish=(ok:boolean)=>{if(runtimes.get(this)!==s)return;
    current.ready=ok;current.failed=!ok;resolve(ok);
    if(s.visible && this.properties.view===model.view){if(ok)this.refreshCanvas(false);else this.failCanvas();}
   };
   current.image.onload=()=>finish(current.image.width>0 && current.image.height>0);
   current.image.onerror=()=>finish(false);current.image.src=model.visual.imagePath;return current;
  },
  /** 页面先等待本地目标图片就绪，再一并提交view/标注/标签；此期间旧场景保持完整。 */
  async prepareView(view:string):Promise<boolean>{
   const s=runtimes.get(this);if(!s?.measurement || (view!=="front"&&view!=="back"))return false;
   const image=this.ensureImage(getBodyModel(view),s.measurement.node);return image?image.promise:true;
  },
  queueDraw(){
   const s=runtimes.get(this);if(!s || !s.mounted || !s.visible || s.pending || this.properties.interactionBlocked)return;
   s.pending=true;const generation=s.generation;
   const current=()=>runtimes.get(this)===s && s.visible && generation===s.generation;
   wx.nextTick(()=>{if(!current())return;
    const draw=(measurement:CanvasMeasurement)=>{if(!current())return;s.pending=false;
     try{
      if(!measurement?.node || typeof measurement.node.getContext!=="function" || !Number.isFinite(measurement.width)||!Number.isFinite(measurement.height))throw Error("Canvas不可用");
      if(s.ctxNode && s.ctxNode!==measurement.node){s.ctx=null;s.images.forEach(i=>i.resolve(false));s.images.clear();s.transition.cancel(true);s.displayRegions.clear();}
      s.measurement=measurement;this.paintScene();
     }catch{this.failCanvas();}
    };
    if(s.measurement){draw(s.measurement);return;}
    try{s.measures++;this.createSelectorQuery().select("#body-canvas").fields({node:true,size:true}).exec((results:unknown[])=>draw(results[0] as CanvasMeasurement));}
    catch{s.pending=false;this.failCanvas();}
   });
  },
  paintScene(){
   const s=runtimes.get(this),view=this.properties.view;if(!s?.measurement || !s.visible || (view!=="front"&&view!=="back"))return;
   const {node,width,height}=s.measurement,model=getBodyModel(view),entry=this.ensureImage(model,node);
   // 两个本地视图共用节点缓存。没有清空和异步等待之间的半成品帧。
   this.ensureImage(getBodyModel(view==="front"?"back":"front"),node);
   if(entry && !entry.ready){if(!s.painted)this.setData({loading:true,error:""});return;}
   const dpr=wx.getWindowInfo().pixelRatio;if(!Number.isFinite(dpr)||dpr<=0)throw Error("无效DPR");
   const base=fitViewport(width,height,model),target=model.regions.find(r=>r.id===this.properties.zoomRegion);
   const retained=this.properties.retainedViewport;
   if(retained&&(retained.logicalWidth!==model.logicalWidth||retained.logicalHeight!==model.logicalHeight))throw Error("视口模板不一致");
   const viewport=this.properties.focusBounds?focusViewport(base,this.properties.focusBounds):retained?reframeViewport(retained,width,height):target?focusViewport(base,target.bounds):base;
   const physicalWidth=Math.round(width*dpr),physicalHeight=Math.round(height*dpr);
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
     this.properties.debugEnabled?s.point:null,entry?.image||null,annotation,layer,opacity);
    s.frames++;s.painted=true;
    if(firstVisibleOverlayFrameMs===null && (atlas?.regions||[]).some(r=>(opacity.get(r.id)||0)>0))firstVisibleOverlayFrameMs=Date.now()-s.queuedAt;
    if(this.data.loading || this.data.error)this.setData({loading:false,error:""});
    if(first){first=false;firstFrameReadyMs=Date.now()-s.queuedAt;
     // 帧调度不会重复发标签布局事件。
     this.triggerEvent("viewportchange",{view,modelId:model.id,modelVersion:model.version,visualId:model.visual.id,
      viewport,dpr,physicalWidth,physicalHeight,markerCanvas});
     this.triggerEvent("sceneready",{sceneId,view,durationMs:clock?EXPERIENCE.overlayMs:0});
    }
    if(done){s.displayRegions=new Map((atlas?.regions||[]).map(r=>[r.id,r]));s.displayLayer=atlas;
     this.triggerEvent("renderstats",{sceneId,view,measures:s.measures,initializations:s.initializations,resourceLoads:s.loads,
      frames:s.frames,firstFrameReadyMs,firstVisibleOverlayFrameMs,completedFrameReadyMs:Date.now()-s.queuedAt,
      drawMs:Date.now()-drawStart,transitionMs:Date.now()-start,width,height});
    }}catch{this.failCanvas();}
   };
   // 视口变化不对几何做插值。无动画时一次绘制完整终态。
   const sameViewport=JSON.stringify(priorViewport)===JSON.stringify(viewport);
   s.transition.start((atlas?.regions||[]).map(r=>r.id),retain,clock && sameViewport?EXPERIENCE.overlayMs:0,clock,paint);
  },
    onCanvasStart(event:unknown) {
      const state=runtimes.get(this);if(!state)return;
      state.touch=null;
      if((this.properties.interactionBlocked || this.properties.touchDisabled) || (!this.properties.debugEnabled &&
        (this.properties.interactionMode==="readonly" ||
          (this.properties.interactionMode!=="draw" && this.properties.zoomRegion))))return;
      state.touch=readTouch(event);state.moved=false;
    },
    onCanvasMove(event:unknown) {
      const state=runtimes.get(this);if(!state?.touch)return;
      const next=readTouch(event);
      if(!next||next.kind!==state.touch.kind||
        Math.hypot(next.point.x-state.touch.point.x,next.point.y-state.touch.point.y)>8)state.moved=true;
    },
    onCanvasCancel() { const state=runtimes.get(this);if(state)state.touch=null; },
    onCanvasEnd(event:unknown) {
      const state=runtimes.get(this),input=readTouch(event);
      if(!state)return;
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
