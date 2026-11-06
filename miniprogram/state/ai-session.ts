import {PhotoTransport,PhotoSession,PhotoResult,ConfirmedPhoto,PhotoPrompts,PhotoBox,PhotoPoint,PHOTO_SPACE,BrushStroke,InferenceStrategy} from "../types/ai";
import {usablePhotoBox} from "../utils/photo-coordinate";
export const AI_WARNINGS:Record<string,string>={EMPTY_MASK:"该候选没有分割范围，请调整提示",CONTOUR_FAILED:"该候选轮廓无效，请重新分割",
 CROP_EDGE:"范围触及局部分析边缘，可能被截断；请扩大圈选或改用整图分析",
 LARGE_MASK:"当前分割范围较大，请检查是否包含正常皮肤",OUTSIDE_BOX:"范围明显超出框选，请检查并补充排除点",
 FRAGMENTED:"当前范围包含较多碎片，请仔细检查",SIMILAR_CANDIDATES:"部分候选很相似，请按实际边界选择",
 BOX_AREA_EXCESS:"识别范围明显大于圈选范围，请检查正常皮肤是否被误选",FOREGROUND_MISSED:"部分补充位置未被选中，请检查遗漏",
 BACKGROUND_INCLUDED:"部分排除位置仍被选中，可擦除误选或重新识别"};
export function samePhoto(r:PhotoResult,s:PhotoSession,revision:number,requestId:string):boolean {
 return r.session_id===s.session_id&&r.photo_id===s.photo_id&&r.coordinate_space===PHOTO_SPACE&&r.prompt_revision===revision&&r.request_id===requestId&&
 typeof r.result_id==="string"&&Array.isArray(r.candidates)&&r.candidates.length>0&&r.candidates.length<=3&&new Set(r.candidates.map(c=>c.candidate_id)).size===r.candidates.length&&r.candidates.every(c=>/^candidate-[0-2]$/.test(c.candidate_id)&&["ok","empty_mask","contour_failed"].includes(c.status)&&Number.isFinite(c.area_ratio)&&c.area_ratio>=0&&c.area_ratio<=1&&Array.isArray(c.warnings)&&(c.display_priority===undefined||Number.isInteger(c.display_priority)&&c.display_priority>=0&&c.display_priority<3)&&(c.edit_revision===undefined||c.edit_revision===0));
}
export class AIPhotoFlow {
 session:PhotoSession|null=null;result:PhotoResult|null=null;confirmed:ConfirmedPhoto|null=null;
 prompts:PhotoPrompts={coordinate_space:PHOTO_SPACE,points:[],box:null};history:PhotoPrompts[]=[];
 phase="empty";error="";cleanupWarning="";maskPath="";selected="";revision=0;
 private generation=0;private previewSerial=0;private requests=0;
 previewing=false;
 private active:Promise<void>|null=null;
 private running=false;
 private queued:{generation:number;revision:number}|null=null;
 strategy:InferenceStrategy="context_crop";
 corrections=new Map<string,BrushStroke[]>();
 pendingCorrection:{id:string;revision:number;strokes:BrushStroke[]}|null=null;
 private editSerial=0;
 constructor(private api:PhotoTransport,private changed:()=>void){}
 private notify(){this.changed();}
 private clearResult(){this.editSerial++;this.corrections.clear();this.pendingCorrection=null;this.previewSerial++;this.previewing=false;if(this.maskPath)this.api.forget(this.maskPath);this.maskPath="";this.result=null;this.confirmed=null;this.selected="";}
 private async release(s:PhotoSession){this.api.forget(s.localPhoto);try{await this.api.remove(s);}catch{this.cleanupWarning="临时数据删除尚未确认，服务将在30分钟内自动清理";this.notify();}}
 async replace(path:string){
  const old=this.session;const generation=++this.generation;this.queued=null;this.session=null;this.clearResult();
  this.prompts={coordinate_space:PHOTO_SPACE,points:[],box:null};this.history=[];this.strategy="context_crop";this.revision=0;this.phase="uploading";this.error="";this.notify();
  if(old)void this.release(old);
  try{const s=await this.api.open(path);if(generation!==this.generation){await this.release(s);return;}
   if(!Number.isFinite(s.image.width)||!Number.isFinite(s.image.height)||s.image.width<8||s.image.height<8){await this.release(s);throw new Error("照片尺寸异常，请重新上传");}
   this.session=s;this.phase="ready";
  }catch(e){if(generation!==this.generation)return;this.phase="empty";this.error=(e as Error).message;}
  this.notify();
 }
 edit(box:PhotoBox|null,point:PhotoPoint|null){
  if(!this.session||this.phase==="confirmed"||this.phase==="confirming"||this.phase==="correcting")return;
  const unit=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1;
  if((!box&&!point)||(box&&(![box.xMin,box.yMin,box.xMax,box.yMax].every(unit)||box.xMin>=box.xMax||box.yMin>=box.yMax))||
    (point&&(!unit(point.x)||!unit(point.y)||point.x===1||point.y===1||![0,1].includes(point.label))))return;
  if(point&&this.prompts.points.length>=64){this.error="提示点已达上限，请撤销或重置后重试";this.notify();return;}
  this.history.push(JSON.parse(JSON.stringify(this.prompts)) as PhotoPrompts);
  this.prompts=box?{...this.prompts,box}:{...this.prompts,points:point?[...this.prompts.points,point]:this.prompts.points};
  this.queued=null;this.revision++;this.clearResult();this.error="";this.phase="ready";this.notify();
 }
 undo(){if(!this.history.length||this.phase==="confirming"||this.phase==="confirmed")return;this.queued=null;this.prompts=this.history.pop()!;this.revision++;this.clearResult();this.phase="ready";this.error="";this.notify();}
 reset(){if(!this.session||this.phase==="confirming")return;this.queued=null;this.prompts={coordinate_space:PHOTO_SPACE,points:[],box:null};this.history=[];this.revision++;this.clearResult();this.phase="ready";this.error="";this.notify();}
 selectBox(box:PhotoBox):Promise<void>{
  if(!this.session||!usablePhotoBox(box)||this.phase==="confirming"||this.phase==="confirmed")return Promise.resolve();
  const previous=this.prompts.box;
  if(previous&&!this.prompts.points.length&&(["xMin","yMin","xMax","yMax"] as const).every(k=>Math.abs(previous[k]-box[k])<1e-6))return this.active||Promise.resolve();
  this.prompts={coordinate_space:PHOTO_SPACE,box:{...box},points:[]};this.history=[];
  this.revision++;this.clearResult();this.error="";this.phase="ready";
  return this.segment();
 }
 addBox(box:PhotoBox):Promise<void>{
  if(!this.session||!usablePhotoBox(box)||!this.prompts.box||this.phase!=="ready")return Promise.resolve();
  const extra=this.prompts.additional_boxes||[];
  if(extra.length>=3){this.error="最多可圈选四处，请先确认当前范围";this.notify();return Promise.resolve();}
  this.prompts={...this.prompts,additional_boxes:[...extra,{...box}]};this.strategy="context_crop";
  this.revision++;this.clearResult();this.history=[];return this.segment();
 }
 changeStrategy():Promise<void>{
  if(this.phase!=="ready")return Promise.resolve();
  if(this.prompts.additional_boxes?.length){this.error="多处圈选采用局部分析；如需整图分析，请重新圈选单一区域";this.notify();return Promise.resolve();}
  this.strategy=this.strategy==="context_crop"?"full_image":"context_crop";this.revision++;return this.segment();
 }
 segment():Promise<void>{
  if(!this.session||this.phase==="confirming"||this.phase==="confirmed"||this.phase==="correcting")return Promise.resolve();
  if(!this.prompts.box&&!this.prompts.points.some(p=>p.label===1)){this.error="请先圈选需要识别的区域";this.notify();return Promise.resolve();}
  if(this.phase==="segmenting")return this.active||Promise.resolve();
  const ticket={generation:this.generation,revision:this.revision};
  if(this.running){this.queued=ticket;this.phase="segmenting";this.notify();return this.active!;}
  this.running=true;
  this.active=this.drain(ticket).finally(()=>{this.running=false;this.active=null;});
  return this.active;
 }
 private async drain(ticket:{generation:number;revision:number}){
  let next:typeof ticket|null=ticket;
  while(next){
   if(next.generation===this.generation&&next.revision===this.revision&&this.session)await this.runSegment();
   next=this.queued;this.queued=null;
  }
 }
 private async runSegment(){
  const s=this.session!;
  const g=this.generation,rev=this.revision,id=`p${Date.now()}_${++this.requests}`;
  const prompts=JSON.parse(JSON.stringify(this.prompts)) as PhotoPrompts;
  this.clearResult();this.phase="segmenting";this.error="";this.notify();
  try{const r=await this.api.segment(s,prompts,rev,id,this.strategy);if(g!==this.generation||rev!==this.revision)return;
   if(!samePhoto(r,s,rev,id))throw new Error("结果与当前照片或提示不一致，请重试");
   this.result=r;this.phase="ready";
   const first=[...r.candidates].filter(c=>c.status==="ok").sort((a,b)=>(a.display_priority??0)-(b.display_priority??0))[0];
   if(first)await this.preview(first.candidate_id);
   else this.error="这次没有得到合适的识别范围，请重新圈选。";
  }catch(e){if(g!==this.generation||rev!==this.revision)return;this.phase="ready";this.error=(e as Error).message;}
  this.notify();
 }
 async preview(id:string){
  const s=this.session,r=this.result;if(!s||!r||this.phase==="confirming"||this.phase==="confirmed"||this.phase==="correcting"||this.pendingCorrection||!r.candidates.some(c=>c.candidate_id===id))return;
  const serial=++this.previewSerial,g=this.generation;this.selected=id;this.previewing=true;this.error="";this.notify();
  try{const path=await this.api.asset(s,id,r.result_id,r.candidates.find(c=>c.candidate_id===id)?.edit_revision||0);if(g!==this.generation||serial!==this.previewSerial){this.api.forget(path);return;}
   if(this.maskPath&&this.maskPath!==path)this.api.forget(this.maskPath);this.maskPath=path;
  }catch(e){if(g!==this.generation||serial!==this.previewSerial)return;if(this.maskPath)this.api.forget(this.maskPath);this.maskPath="";this.error=(e as Error).message;}
  this.previewing=false;
  this.notify();
 }
 canConfirm(){return this.phase==="ready"&&!this.previewing&&!this.pendingCorrection&&!!this.maskPath&&!!this.result?.candidates.some(c=>c.candidate_id===this.selected&&c.status==="ok");}
 async brush(stroke:BrushStroke){
  if(this.phase!=="ready"||this.previewing||this.pendingCorrection)return;
  const history=this.corrections.get(this.selected)||[];
  if(history.length>=32){this.error="修正已达32笔，请先撤销或重新识别";this.notify();return;}
  await this.correct([...history,JSON.parse(JSON.stringify(stroke)) as BrushStroke]);
 }
 async undoBrush(){if(this.phase!=="ready"||this.pendingCorrection)return;const h=this.corrections.get(this.selected)||[];if(h.length)await this.correct(h.slice(0,-1));}
 async restoreBrush(){if(this.phase==="ready")await this.correct([]);}
 async retryBrush(){if(this.phase==="ready"&&this.pendingCorrection)await this.correct(this.pendingCorrection.strokes,true);}
 private async correct(strokes:BrushStroke[],retry=false){
  const s=this.session,r=this.result,id=this.selected,c=r?.candidates.find(c=>c.candidate_id===id);
  if(!s||!r||!c||this.phase!=="ready")return;
  const revision=retry?this.pendingCorrection!.revision:Math.max(c.edit_revision||0,this.pendingCorrection?.revision||0)+1;
  const serial=++this.editSerial,g=this.generation;
  this.pendingCorrection={id,revision,strokes};this.phase="correcting";this.error="";this.previewSerial++;this.previewing=false;this.notify();
  try{
   const result=await this.api.edit(s,r,id,revision,strokes);
   if(g!==this.generation||serial!==this.editSerial||r!==this.result)return;
   if(result.session_id!==s.session_id||result.photo_id!==s.photo_id||result.result_id!==r.result_id||result.prompt_revision!==r.prompt_revision||
      result.coordinate_space!==PHOTO_SPACE||result.candidate.candidate_id!==id||result.candidate.edit_revision!==revision||
      !["ok","empty_mask"].includes(result.candidate.status))throw Error("修正结果与当前照片不一致，请重试");
   this.result={...r,candidates:r.candidates.map(c=>c.candidate_id===id?result.candidate:c)};
   this.corrections.set(id,JSON.parse(JSON.stringify(strokes)) as BrushStroke[]);this.pendingCorrection=null;this.phase="ready";
   await this.preview(id);
  }catch(e){if(g!==this.generation||serial!==this.editSerial)return;this.phase="ready";this.error=(e as Error).message+"；本次修正尚未确认，可重试或恢复原识别";}
  if(g===this.generation&&serial===this.editSerial)this.notify();
 }
 async confirm(){
  const s=this.session,r=this.result;if(!s||!r||!this.canConfirm())return;
  const g=this.generation,id=this.selected,rev=this.revision;
  this.phase="confirming";this.error="";this.notify();
  const editRevision=r.candidates.find(c=>c.candidate_id===id)?.edit_revision||0;
  try{const c=await this.api.confirm(s,r,id,editRevision);if(g!==this.generation||rev!==this.revision)return;
   if(c.photo_id!==s.photo_id||c.session_id!==s.session_id||c.result_id!==r.result_id||c.candidate_id!==id||c.prompt_revision!==rev||
     c.coordinate_space!==PHOTO_SPACE||c.confirmed_by_user!==true||c.image.width!==s.image.width||c.image.height!==s.image.height||
     c.image.oriented_rgb_sha256!==s.image.oriented_rgb_sha256||c.geometry?.type!=="MultiPolygon"||!c.geometry.coordinates.length||
     (c.correction?.edit_revision||0)!==editRevision)
       throw new Error("确认结果与当前照片不一致，请重新分割");
   this.confirmed=c;this.phase="confirmed";
  }catch(e){if(g!==this.generation||rev!==this.revision)return;this.phase="ready";this.error=(e as Error).message;}
  this.notify();
 }
 async cancel(){this.generation++;this.queued=null;const s=this.session;this.session=null;this.clearResult();this.phase="empty";this.error="";this.history=[];this.prompts={coordinate_space:PHOTO_SPACE,box:null,points:[]};this.notify();if(s)await this.release(s);}
}
