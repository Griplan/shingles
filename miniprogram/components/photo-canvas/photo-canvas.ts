import {fitPhoto,photoTouch,dragBox,PhotoRect} from "../../utils/photo-coordinate";
import {PhotoBox,PhotoPoint} from "../../types/ai";
import {readTouch} from "../../utils/body-debug";
interface Runtime {alive:boolean;serial:number;node:WechatMiniprogram.Canvas|null;rect:PhotoRect|null;paintedSource:string;
 inputKey:string;geometryKey:string;gesture:number;inputQueue:Promise<void>;
 stroke:{x:number;y:number}[];strokeInvalid:boolean;
 start:{x:number;y:number}|null;drag:PhotoBox|null;images:Map<string,Promise<WechatMiniprogram.Image>>}
const states=new WeakMap<object,Runtime>();
Component({
 properties:{source:String,mask:String,photoWidth:Number,photoHeight:Number,mode:{type:String,value:"box"},
  points:{type:Array,value:[] as PhotoPoint[]},box:{type:null,value:null as PhotoBox|null},additionalBoxes:{type:Array,value:[] as PhotoBox[]},brushRadius:{type:Number,value:.02},showPrompts:{type:Boolean,value:true},disabled:Boolean,layoutRevision:Number},
 data:{error:""},
 observers:{"source,mask,photoWidth,photoHeight,points,box,additionalBoxes,brushRadius,showPrompts,layoutRevision"(){this.syncInput();void this.redraw();},"mode,disabled"(){this.syncInput();void this.redraw();}},
 lifetimes:{created(){states.set(this,{alive:false,serial:0,node:null,rect:null,paintedSource:"",inputKey:"",geometryKey:"",gesture:0,inputQueue:Promise.resolve(),stroke:[],strokeInvalid:false,start:null,drag:null,images:new Map()});},
  ready(){states.get(this)!.alive=true;void this.redraw();},detached(){states.delete(this);}},
 pageLifetimes:{show(){void this.redraw();},resize(){void this.redraw();}},
 methods:{
  invalidateGesture(){const s=states.get(this);if(s){s.gesture++;s.start=null;s.drag=null;s.stroke=[];s.strokeInvalid=false;s.inputQueue=Promise.resolve();}},
  syncInput(){
   const s=states.get(this);if(!s)return;
   const p=this.properties,key=JSON.stringify([p.source,p.photoWidth,p.photoHeight,p.mode,p.brushRadius,!!p.disabled,p.layoutRevision]);
   // Repeated property notifications and repainting are not new gestures.
   if(s.inputKey!==key){s.inputKey=key;this.invalidateGesture();}
  },
  async redraw(){
   this.syncInput();
   const s=states.get(this);if(!s?.alive)return;const serial=++s.serial;
   const source=this.properties.source,mask=this.properties.mask;this.triggerEvent("renderstate",{ready:false,source,mask});
   const current=()=>states.get(this)===s&&s.serial===serial;
   try{
    const m=await new Promise<{node:WechatMiniprogram.Canvas;width:number;height:number}>(resolve=>
     this.createSelectorQuery().select("#photo").fields({node:true,size:true}).exec((r:unknown[])=>resolve(r[0] as never)));
    if(!current())return;
    if(!m?.node||m.width<=0||m.height<=0)throw Error();
    if(s.node!==m.node){s.node=m.node;s.images.clear();s.paintedSource="";this.invalidateGesture();}
    const geometryKey=JSON.stringify([m.width,m.height]);
    if(s.geometryKey!==geometryKey){s.geometryKey=geometryKey;this.invalidateGesture();}
    const node=m.node,ctx=node.getContext("2d") as WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
    const dpr=wx.getWindowInfo().pixelRatio||1;
    if(s.paintedSource!==source){ctx.clearRect(0,0,node.width,node.height);s.rect=null;s.start=null;s.drag=null;}
    if(!source){s.rect=null;s.images.clear();this.setData({error:""});return;}
    const load=(path:string)=>{let promise=s.images.get(path);if(!promise){promise=new Promise<WechatMiniprogram.Image>((resolve,reject)=>{
     const image=node.createImage();image.onload=()=>image.width===this.properties.photoWidth&&image.height===this.properties.photoHeight?resolve(image):reject(Error());image.onerror=()=>reject(Error());image.src=path;
    });s.images.set(path,promise);}return promise;};
    for(const key of s.images.keys())if(key!==source&&key!==mask)s.images.delete(key);
    const photo=await load(source),alpha=mask?await load(mask):null;if(!current())return;
    // Commit a complete frame only after images are ready; never clear while awaiting a mask.
    const pw=Math.round(m.width*dpr),ph=Math.round(m.height*dpr);
    if(node.width!==pw)node.width=pw;if(node.height!==ph)node.height=ph;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,m.width,m.height);
    const r=fitPhoto(this.properties.photoWidth,this.properties.photoHeight,m.width,m.height);s.rect=r;
    ctx.drawImage(photo,r.left,r.top,r.width,r.height);if(alpha)ctx.drawImage(alpha,r.left,r.top,r.width,r.height);
    s.paintedSource=source;
    const box=this.properties.showPrompts!==false?(s.drag||this.properties.box):null;
    if(box){ctx.strokeStyle="#9b4c24";ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(r.left+box.xMin*r.width,r.top+box.yMin*r.height,(box.xMax-box.xMin)*r.width,(box.yMax-box.yMin)*r.height);ctx.setLineDash([]);}
    if(this.properties.showPrompts!==false)for(const b of (this.properties.additionalBoxes||[]) as PhotoBox[]){ctx.strokeStyle="#9b4c24";ctx.lineWidth=1;ctx.strokeRect(r.left+b.xMin*r.width,r.top+b.yMin*r.height,(b.xMax-b.xMin)*r.width,(b.yMax-b.yMin)*r.height);}
    for(const p of (this.properties.showPrompts!==false?this.properties.points:[]) as PhotoPoint[]){const x=r.left+p.x*r.width,y=r.top+p.y*r.height;
     ctx.beginPath();ctx.arc(x,y,6,0,2*Math.PI);ctx.fillStyle=p.label===1?"#176f58":"#b64236";ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();
     ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);if(p.label===1){ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);}ctx.stroke();}
    // Temporary brush path is a gesture guide; only the returned mask changes the result.
    if(s.stroke.length){const radius=(this.properties.brushRadius||.02)*Math.min(r.width,r.height);
     ctx.lineWidth=2*radius;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=this.properties.mode==="paint-add"?"rgba(32,121,192,0.35)":"rgba(199,78,60,0.35)";
     ctx.beginPath();s.stroke.forEach((p,i)=>{const x=r.left+p.x*r.width,y=r.top+p.y*r.height;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
     const p=s.stroke[s.stroke.length-1];ctx.beginPath();ctx.arc(r.left+p.x*r.width,r.top+p.y*r.height,radius,0,2*Math.PI);ctx.lineWidth=1;ctx.stroke();}
    this.setData({error:""});this.triggerEvent("renderstate",{ready:true,source,mask});
   }catch{if(current()){s.rect=null;this.setData({error:"照片预览暂时不可用，请重新选择照片"});this.triggerEvent("renderstate",{ready:false,source,mask});}}
  },
  async point(event:unknown){const input=readTouch(event),s=states.get(this);if(!input||!s?.rect||this.properties.disabled)return null;
   const gesture=s.gesture,rect=s.rect;let x=input.point.x,y=input.point.y;
   if(input.kind==="client"){
    const bounds=await new Promise<WechatMiniprogram.BoundingClientRectCallbackResult>(resolve=>this.createSelectorQuery().select("#photo").boundingClientRect(r=>resolve(r as WechatMiniprogram.BoundingClientRectCallbackResult)).exec());
    this.syncInput();
    if(states.get(this)!==s||gesture!==s.gesture||!bounds)return null;x-=bounds.left;y-=bounds.top;
   }
   return photoTouch(x,y,rect);
  },
  queueTouch(kind:"start"|"move"|"end",event:unknown):Promise<void>{
   this.syncInput();const s=states.get(this);if(!s)return Promise.resolve();
   const gesture=s.gesture,position=this.point(event).catch(()=>null);
   // Native events do not await selector queries; commit their positions in event order.
   const pending=s.inputQueue.then(async()=>{
    const p=await position;this.syncInput();
    if(states.get(this)!==s||s.gesture!==gesture||this.properties.disabled)return;
    if(this.properties.mode==="paint-add"||this.properties.mode==="paint-erase"){
     if(kind==="start"){s.start=p;s.stroke=p?[p]:[];s.strokeInvalid=!p;return;}
     if(!s.start)return;
     if(!p)s.strokeInvalid=true;
     else {const last=s.stroke[s.stroke.length-1];if(p.x!==last.x||p.y!==last.y){if(s.stroke.length>=256)s.strokeInvalid=true;else s.stroke.push(p);}}
     if(kind==="move"){void this.redraw();return;}
     const points=s.stroke.map(p=>({...p})),invalid=s.strokeInvalid;s.start=null;s.stroke=[];
     if(invalid)this.triggerEvent("strokeinvalid");
     else this.triggerEvent("stroke",{mode:this.properties.mode==="paint-add"?"add":"erase",radius:this.properties.brushRadius||.02,points});
     void this.redraw();return;
    }
    if(kind==="start"){s.start=p;s.drag=null;return;}
    if(kind==="move"){if(p&&s.start&&this.properties.mode==="box"){s.drag=dragBox(s.start,p);void this.redraw();}return;}
    const start=s.start;s.start=null;s.drag=null;
    if(!p||!start){void this.redraw();return;}
    if(this.properties.mode==="box"){
     const box=dragBox(start,p),r=s.rect;
     if(box&&r&&(box.xMax-box.xMin)*r.width>=12&&(box.yMax-box.yMin)*r.height>=12)this.triggerEvent("prompt",{box,point:null});
     else {this.triggerEvent("boxinvalid");void this.redraw();}
    }
    else if(p.x<1&&p.y<1&&Math.hypot(p.x-start.x,p.y-start.y)<.035)this.triggerEvent("prompt",{box:null,point:{...p,label:this.properties.mode==="foreground"?1:0}});
   });
   s.inputQueue=pending;return pending;
  },
  touchStart(e:unknown){this.invalidateGesture();return this.queueTouch("start",e);},
  touchMove(e:unknown){return this.queueTouch("move",e);},
  touchEnd(e:unknown){return this.queueTouch("end",e);},
  touchCancel(){this.invalidateGesture();void this.redraw();},
 }
});
