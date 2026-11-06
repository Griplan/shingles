export interface FrameClock { now():number; request(callback:()=>void):number; cancel(id:number):void }
/** 只有当前任务可以绘制；替换从已显示的透明度继续，不排队、不插值几何。 */
export class OverlayTransition {
 private serial=0; private frame:number|null=null; private clock:FrameClock|null=null;
 values=new Map<string,number>();
 cancel(clear=false):void {
  this.serial++;if(this.frame!==null)this.clock?.cancel(this.frame);this.frame=null;
  if(clear)this.values.clear();
 }
 start(ids:readonly string[],retain:boolean,duration:number,clock:FrameClock|null,
  paint:(values:ReadonlyMap<string,number>,done:boolean)=>void):void {
  this.cancel(!retain);this.clock=clock;
  const serial=this.serial,target=new Set(ids),from=new Map(this.values);
  const keys=[...new Set([...from.keys(),...ids])];
  const finish=()=>{this.values=new Map(ids.map(id=>[id,1]));paint(this.values,true);};
  if(!clock || duration<=0 || !keys.length){finish();return;}
  if(keys.every(k=>(from.get(k)||0)===(target.has(k)?1:0))){finish();return;}
  const start=clock.now();
  const tick=()=>{
   if(serial!==this.serial)return;this.frame=null;
   const progress=Math.min(1,Math.max(0,(clock.now()-start)/duration));
   const eased=1-(1-progress)*(1-progress);
   this.values=new Map(keys.map(k=>{const a=from.get(k)||0;return [k,a+((target.has(k)?1:0)-a)*eased];}));
   if(progress===1){finish();return;}paint(this.values,false);
   if(serial===this.serial)this.frame=clock.request(tick);
  };
  tick();
 }
}
