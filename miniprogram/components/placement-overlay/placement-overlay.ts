import {getBodyModel} from "../../data/body-models";
import {NormalizedPoint,ViewportTransform} from "../../types/dermatome";
import {PlacementTransform,PreparedPhotoGeometry} from "../../types/placement";
import {canvasToNormalized,projectNormalizedToCanvas} from "../../utils/coordinate";
import {readTouch} from "../../utils/body-debug";
import {PlacementPreview} from "./preview";
type Context=WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
type Rect=WechatMiniprogram.BoundingClientRectCallbackResult;
interface Runtime {alive:boolean;visible:boolean;pending:boolean;epoch:number;inputKey:string;queue:Promise<void>;
 node:WechatMiniprogram.Canvas|null;ctx:Context|null;initializing:Promise<void>|null;frame:number|null;timer:ReturnType<typeof setTimeout>|null;frameEpoch:number;
 preview:PlacementPreview|null;source:PreparedPhotoGeometry|null;sourceKey:string;local:PlacementTransform|null;localRevision:number;
 rect:Promise<Rect>|null;start:NormalizedPoint|null;delta:NormalizedPoint;dragging:boolean}
const states=new WeakMap<object,Runtime>();
Component({
 properties:{view:{type:String,value:"front"},prepared:{type:null,value:null as PreparedPhotoGeometry|null},
  transform:{type:null,value:null as PlacementTransform|null},viewport:{type:null,value:null as ViewportTransform|null},
  interactionKey:String,revision:Number,disabled:Boolean},
 observers:{"view,prepared,transform,viewport,interactionKey,revision,disabled"(){this.syncInput();this.queueDraw();}},
 lifetimes:{created(){states.set(this,{alive:false,visible:true,pending:false,epoch:0,inputKey:"",queue:Promise.resolve(),node:null,ctx:null,initializing:null,
  frame:null,timer:null,frameEpoch:0,preview:null,source:null,sourceKey:"",local:null,localRevision:-1,rect:null,start:null,delta:{x:0,y:0},dragging:false});},
  ready(){const s=states.get(this);if(s)s.alive=true;this.queueDraw();},
  detached(){this.cancelGesture();this.cancelFrame();states.get(this)?.preview?.dispose();states.delete(this);}},
 pageLifetimes:{hide(){this.cancelGesture();this.cancelFrame();const s=states.get(this);if(s){s.visible=false;s.local=null;}},
  show(){const s=states.get(this);if(s)s.visible=true;this.queueDraw();}},
 methods:{
  syncInput(){const s=states.get(this);if(!s)return;const key=JSON.stringify([this.properties.view,this.properties.viewport,this.properties.interactionKey,!!this.properties.disabled]);
   if(key!==s.inputKey){this.cancelGesture();this.cancelFrame();s.local=null;s.localRevision=-1;s.inputKey=key;}
   if(s.local&&this.properties.revision>=s.localRevision)s.local=null;
  },
  /** Small local parameters only: no setData/geometry/source transfer per move. */
  previewTransform(transform:PlacementTransform,revision:number,key:string){const s=states.get(this);
   if(!s?.alive||!s.visible||this.properties.disabled||key!==this.properties.interactionKey||revision<this.properties.revision||revision<s.localRevision)return;
   s.local=transform;s.localRevision=revision;this.queueDraw();
  },
  cancelGesture(){const s=states.get(this);if(s){s.epoch++;s.start=null;s.rect=null;s.dragging=false;s.delta={x:0,y:0};s.queue=Promise.resolve();}},
  invalidateLayout(){this.touchCancel();},
  cancelFrame(){const s=states.get(this);if(!s)return;s.frameEpoch++;
   if(s.frame!==null)s.node?.cancelAnimationFrame(s.frame);if(s.timer!==null)clearTimeout(s.timer);
   s.frame=null;s.timer=null;s.pending=false;
  },
  async ensureCanvas(){const s=states.get(this);if(!s||s.node)return;
   if(s.initializing)return s.initializing;
   s.initializing=new Promise<void>((resolve,reject)=>{
    this.createSelectorQuery().select("#placement").fields({node:true,size:true}).exec((r:unknown[])=>{
     if(states.get(this)!==s){resolve();return;}const m=r[0] as {node:WechatMiniprogram.Canvas}|undefined;
     if(!m?.node){reject(Error("Canvas unavailable"));return;}s.node=m.node;s.ctx=m.node.getContext("2d");resolve();
    });
   });try{await s.initializing;}finally{s.initializing=null;}
  },
  queueDraw(){const s=states.get(this);if(!s?.alive||!s.visible||s.pending)return;s.pending=true;const epoch=s.frameEpoch;
   const current=()=>states.get(this)===s&&s.visible&&epoch===s.frameEpoch;
   const draw=()=>{if(!current())return;s.pending=false;s.frame=null;s.timer=null;void this.redraw();};
   if(!s.node){wx.nextTick(()=>{if(!current())return;void this.ensureCanvas().then(()=>{if(current()){s.pending=false;this.queueDraw();}}).catch(()=>{if(current()){s.pending=false;this.reportReady(false);}});});return;}
   if(typeof s.node.requestAnimationFrame==="function"&&typeof s.node.cancelAnimationFrame==="function")s.frame=s.node.requestAnimationFrame(draw);
   else s.timer=setTimeout(draw,16);
  },
  reportReady(ready:boolean){this.triggerEvent("renderstate",{key:this.properties.interactionKey,revision:this.properties.revision,viewportKey:JSON.stringify(this.properties.viewport),ready});},
  async redraw(){const s=states.get(this);if(!s?.alive||!s.visible)return;
   try {
    if(!s.node)await this.ensureCanvas();if(states.get(this)!==s||!s.visible||!s.node||!s.ctx)return;
    const v=this.properties.viewport,p=this.properties.prepared,t=s.local||this.properties.transform,node=s.node,ctx=s.ctx;
    if(!v||!p||!t){ctx.clearRect(0,0,node.width,node.height);return;}
    const dpr=wx.getWindowInfo().pixelRatio||1,w=Math.round(v.viewportWidth*dpr),h=Math.round(v.viewportHeight*dpr);
    if(node.width!==w)node.width=w;if(node.height!==h)node.height=h;
    if(!s.preview||s.source!==p||s.sourceKey!==this.properties.interactionKey){s.preview?.dispose();s.preview=new PlacementPreview(p);s.source=p;s.sourceKey=this.properties.interactionKey;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,v.viewportWidth,v.viewportHeight);
    const interactive=s.dragging||!!s.local;
    ctx.save();try{
     ctx.beginPath();ctx.rect(0,0,v.viewportWidth,v.viewportHeight);ctx.clip();
     s.preview.draw(ctx,v,t,getBodyModel(this.properties.view==="back"?"back":"front"),interactive);
     const handle=projectNormalizedToCanvas(t.translation,v);ctx.beginPath();ctx.arc(handle.x,handle.y,14,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,0.92)";ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle="#ab4c2d";ctx.stroke();
     ctx.beginPath();ctx.moveTo(handle.x-7,handle.y);ctx.lineTo(handle.x+7,handle.y);ctx.moveTo(handle.x,handle.y-7);ctx.lineTo(handle.x,handle.y+7);ctx.stroke();
    }finally{ctx.restore();}
    // Only settled frames acknowledge a page revision. Moving frames never bridge state.
    if(!s.local)this.reportReady(true);
   }catch{this.reportReady(false);}
  },
  async point(event:unknown){const s=states.get(this),input=readTouch(event),v=this.properties.viewport;if(!s||!input||!v||this.properties.disabled)return null;
   const epoch=s.epoch;let x=input.point.x,y=input.point.y;
   if(input.kind==="client"){
    // Re-measure once at each gesture start, not every client-coordinate event.
    if(!s.rect)s.rect=new Promise<Rect>(resolve=>this.createSelectorQuery().select("#placement").boundingClientRect(r=>resolve(r as Rect)).exec());
    const rect=await s.rect;
    this.syncInput();if(states.get(this)!==s||s.epoch!==epoch||!rect)return null;x-=rect.left;y-=rect.top;
   }
   return canvasToNormalized({x,y},v);
  },
  queueTouch(kind:string,event:unknown):Promise<void>{
   this.syncInput();const s=states.get(this);if(!s?.visible||this.properties.disabled)return Promise.resolve();
   const epoch=s.epoch,key=this.properties.interactionKey,position=this.point(event).catch(()=>null);
   const work=s.queue.then(async()=>{const p=await position;this.syncInput();if(states.get(this)!==s||s.epoch!==epoch||!s.visible||this.properties.disabled)return;
    const v=this.properties.viewport,t=s.local||this.properties.transform;if(!v||!t)return;
    if(kind==="start"){
     if(!p||!s.preview)return;const a=projectNormalizedToCanvas(p,v),h=projectNormalizedToCanvas(t.translation,v);
     if(Math.hypot(a.x-h.x,a.y-h.y)>24&&!s.preview.hit(p,t,getBodyModel(this.properties.view==="back"?"back":"front")))return;
     s.start=p;s.delta={x:0,y:0};s.dragging=true;this.triggerEvent("placementdrag",{key,phase:"start",delta:s.delta});this.queueDraw();return;
    }
    if(!s.start)return;
    if(p)s.delta={x:p.x-s.start.x,y:p.y-s.start.y};
    const end=kind==="end";if(end){s.start=null;s.dragging=false;s.rect=null;}
    this.triggerEvent("placementdrag",{key,phase:end?"end":"move",delta:s.delta});this.queueDraw();
   });s.queue=work;return work;
  },
  touchStart(event:unknown){this.cancelGesture();return this.queueTouch("start",event);},
  touchMove(event:unknown){return this.queueTouch("move",event);},
  touchEnd(event:unknown){return this.queueTouch("end",event);},
  touchCancel(){const s=states.get(this);if(s?.start)this.triggerEvent("placementdrag",{key:this.properties.interactionKey,phase:"cancel",delta:s.delta});this.cancelGesture();this.queueDraw();},
 }
});
