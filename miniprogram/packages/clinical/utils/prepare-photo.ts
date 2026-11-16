/** Only the final upload image becomes the photo coordinate reference. */
export const ORIGINAL_PHOTO_LIMITS=Object.freeze({bytes:50*1024*1024,pixels:50_000_000});
export const PHOTO_LIMITS=Object.freeze({bytes:8*1024*1024,pixels:3_000_000,side:1920,minSide:8});
// Preserve the proven P8 canvas budget. Larger inputs must never reach createImage.
const CANVAS_SOURCE_LIMITS={bytes:20*1024*1024,pixels:16_000_000,side:8192};
type Format="jpeg"|"png"|"webp";
type Info=WechatMiniprogram.GetImageInfoSuccessCallbackResult;
type Canvas=WechatMiniprogram.Canvas;
type FileSystem=WechatMiniprogram.FileSystemManager;
export type PreparedPhoto={path:string;release:()=>void};
const needCrop="请在相册裁剪后重试";
const interrupted=()=>new Error("照片准备已取消");

export function fitUploadSize(width:number,height:number,factor=1){
 const scale=Math.min(1,PHOTO_LIMITS.side/Math.max(width,height),Math.sqrt(PHOTO_LIMITS.pixels/(width*height)))*factor;
 return {width:Math.floor(width*scale),height:Math.floor(height*scale)};
}
export function photoFormat(bytes:Uint8Array):Format|null{
 const has=(start:number,values:number[])=>values.every((v,i)=>bytes[start+i]===v);
 if(has(0,[255,216,255]))return "jpeg";
 if(has(0,[137,80,78,71,13,10,26,10]))return "png";
 if(has(0,[82,73,70,70])&&has(8,[87,69,66,80]))return "webp";
 return null;
}

const axes:Record<Info["orientation"],[number,number,number,number,number,number]>={
 up:[1,0,0,1,0,0],"up-mirrored":[-1,0,0,1,1,0],down:[-1,0,0,-1,1,1],"down-mirrored":[1,0,0,-1,0,1],
 "left-mirrored":[0,1,1,0,0,0],right:[0,1,-1,0,1,0],"right-mirrored":[0,-1,-1,0,1,1],left:[0,-1,1,0,0,1],
};
export function photoAxes(orientation:Info["orientation"]){
 const [a,b,c,d,x,y]=axes[orientation];
 return {matrix:[a,b,c,d,x,y] as const,swapped:a===0};
}

/** Remove orientation metadata before decoding a rotated source. This prevents
 * differing native decoder auto-rotation behavior (including mirrored EXIF). */
export function withoutPhotoOrientation(input:ArrayBuffer,format:Format,scanOnly=false):ArrayBuffer{
 const bytes=new Uint8Array(input),dv=new DataView(input),parts:Uint8Array[]=[];
 const invalid=()=>new Error("照片文件结构无效，请重新选择");
 const animated=()=>new Error("暂不支持动图，请在相册导出静态照片");
 if(format==="jpeg"){
  parts.push(bytes.subarray(0,2));
  let p=2;
  while(p<bytes.length){
   const start=p;
   if(bytes[p++]!==255)throw invalid();
   while(bytes[p]===255)p++;
   const marker=bytes[p++];
   if(marker===0xda){parts.push(bytes.subarray(start));break;}
   if(p+2>bytes.length)throw invalid();
   const size=dv.getUint16(p);
   if(size<2||p+size>bytes.length)throw invalid();
   if(marker!==0xe1)parts.push(bytes.subarray(start,p+size));
   p+=size;
  }
 }else{
  const png=format==="png";
  let p=png?8:12;
  parts.push(bytes.slice(0,p));
  while(p+8<=bytes.length){
   const type=String.fromCharCode(...bytes.subarray(p+(png?4:0),p+(png?8:4)));
   const size=dv.getUint32(p+(png?0:4),!png);
   const end=p+8+size+(png?4:size%2);
   if(end>bytes.length)throw invalid();
   if(type==="acTL"||type==="ANIM"||type==="ANMF")throw animated();
   if(type!=="eXIf"&&type!=="EXIF"&&type!=="XMP "){
    const chunk=bytes.subarray(p,end);
    if(type==="VP8X"&&size>=1){
     const header=chunk.slice();header[8]&=~0x0c;parts.push(header);
    }else parts.push(chunk);
   }
   p=end;
  }
  if(p!==bytes.length)throw invalid();
 }
 if(scanOnly)return input;
 const length=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(length);
 let offset=0;
 for(const part of parts){out.set(part,offset);offset+=part.length;}
 if(format==="webp")new DataView(out.buffer).setUint32(4,length-8,true);
 return out.buffer;
}

const stat=(fs:FileSystem,path:string)=>new Promise<number>((resolve,reject)=>fs.stat({
 path,success:r=>{const s=r.stats;if(!Array.isArray(s)&&s.isFile()&&Number.isSafeInteger(s.size)&&s.size>0)resolve(s.size);else reject(new Error("照片文件为空或无法读取"));},
 fail:()=>reject(new Error("照片文件无法读取，请重新选择")),
}));
function binaryData(data:unknown):ArrayBuffer|null{
 if(typeof data==="string"){
  const bytes=new Uint8Array(data.length);
  for(let i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i)&255;
  return bytes.buffer;
 }
 if(Object.prototype.toString.call(data)==="[object ArrayBuffer]")return data as ArrayBuffer;
 if(ArrayBuffer.isView(data))return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer;
 return null;
}
const read=(fs:FileSystem,path:string,length?:number,position=0)=>new Promise<ArrayBuffer>((resolve,reject)=>fs.readFile({
 filePath:path,position,...(length===undefined?{}:{length}),success:r=>{
  const data=binaryData(r.data);
  if(data)resolve(data);
  else{
   console.warn("[photo] readFile returned unsupported data",Object.prototype.toString.call(r.data));
   reject(new Error("无法读取照片内容，请重新选择"));
  }
 },
 fail:()=>reject(new Error("照片文件无法读取，请重新选择")),
}));
const imageInfo=(path:string)=>new Promise<Info>((resolve,reject)=>wx.getImageInfo({
 src:path,success:resolve,fail:()=>reject(new Error("照片无法解码，请重新选择或导出为 JPEG")),
}));
const prefix="p8-photo-decode-";
function unlink(fs:FileSystem,path:string){fs.unlink({filePath:path,fail:()=>{}});}
function pruneDecodeFiles(fs:FileSystem,dir:string){
 fs.readdir({dirPath:dir,success:({files})=>{
  for(const file of files){
   const age=/^p8-photo-decode-(\d+)-[a-z0-9]+\.(jpeg|png|webp)$/.exec(file);
   if(age&&Date.now()-Number(age[1])>5*60_000)unlink(fs,dir+"/"+file);
  }
 },fail:()=>{}});
}
export function prunePhotoPreparationCache(){
 const dir=wx.env?.USER_DATA_PATH;
 if(dir)pruneDecodeFiles(wx.getFileSystemManager(),dir);
}
const write=(fs:FileSystem,path:string,data:ArrayBuffer)=>new Promise<void>((resolve,reject)=>fs.writeFile({
 filePath:path,data,success:()=>resolve(),fail:()=>reject(new Error("照片准备空间不足，请重试")),
}));
function loadCanvasImage(canvas:Canvas,path:string):Promise<WechatMiniprogram.Image>{
 return new Promise((resolve,reject)=>{
  const image=canvas.createImage();
  const done=(ok:boolean)=>{clearTimeout(timer);image.onload=()=>{};image.onerror=()=>{};
   if(ok)resolve(image);else reject(new Error("照片无法绘制，请重新选择或导出为 JPEG"));};
  const timer=setTimeout(()=>done(false),15000);
  image.onload=()=>done(true);image.onerror=()=>done(false);image.src=path;
 });
}

const largeError="此设备未能安全缩小这张高清照片，"+needCrop+"，或在相机中选择较低分辨率";
let preparationActive=false,nativePending=false;

function canNativeResize(){
 if(typeof wx.compressImage!=="function")return false;
 try{
  const sdk=wx.getAppBaseInfo?.().SDKVersion||wx.getSystemInfoSync?.().SDKVersion||"";
  const [major,minor]=sdk.split(".").map(Number);
  return major>2||major===2&&minor>=26;
 }catch{return false;}
}

/** Read only short ranges. Large PNG/WebP are never loaded into a JS buffer.
 * APNG acTL must precede IDAT; WebP animation is declared in VP8X. */
async function scanLargeContainer(fs:FileSystem,path:string,format:Format,size:number,check:()=>void){
 const png=format==="png";
 let p=png?8:12;
 for(let i=0;i<256&&p+8<=size;i++){
  const data=await read(fs,path,8,p);check();
  const header=new DataView(data);
  const type=String.fromCharCode(...new Uint8Array(data,png?4:0,4));
  const length=header.getUint32(png?0:4,!png),end=p+8+length+(png?4:length%2);
  if(end>size)break;
  if(type==="acTL"||type==="ANIM"||type==="ANMF")throw new Error("暂不支持动图，请在相册导出静态照片");
  if(type==="VP8X"){
   if(length!==10)break;
   const flags=new Uint8Array(await read(fs,path,1,p+8))[0];check();
   if(flags&2)throw new Error("暂不支持动图，请在相册导出静态照片");
  }
  if(png?type==="IDAT":type==="VP8 "||type==="VP8L")return;
  p=end;
 }
 throw new Error("无法安全读取这张高清照片，"+needCrop);
}

/** Patch only APP1 marker bytes on a private native file copy. This disables
 * decoder EXIF/XMP autorotation without copying a 50 MiB file into JavaScript. */
async function neutralizeLargeJpeg(fs:FileSystem,path:string,copy:string,size:number,check:()=>void){
 const markers:number[]=[];
 let p=2,foundScan=false;
 for(let i=0;i<256&&p+4<=size;i++){
  const bytes=new Uint8Array(await read(fs,path,4,p));check();
  if(bytes[0]!==255)break;
  if(bytes[1]===255){p++;continue;}
  const length=bytes[2]*256+bytes[3];
  if(length<2||p+2+length>size)break;
  if(bytes[1]===218){foundScan=true;break;}
  if(bytes[1]===225)markers.push(p+1);
  p+=2+length;
 }
 if(!foundScan||!markers.length)throw new Error(largeError);
 const failed=()=>new Error(largeError);
 await new Promise<void>((resolve,reject)=>fs.copyFile({srcPath:path,destPath:copy,success:()=>resolve(),fail:()=>reject(failed())}));check();
 const fd=await new Promise<string>((resolve,reject)=>fs.open({filePath:copy,flag:"r+",success:r=>resolve(r.fd),fail:()=>reject(failed())}));
 try{
  for(const position of markers){
   check();
   await new Promise<void>((resolve,reject)=>fs.write({fd,position,data:Uint8Array.of(239).buffer,
    success:r=>r.bytesWritten===1?resolve():reject(failed()),fail:()=>reject(failed())}));
  }
 }finally{
  await new Promise<void>(resolve=>fs.close({fd,complete:()=>resolve()}));
 }
}

function nativeResize(fs:FileSystem,src:string,width:number,height:number):Promise<string>{
 if(nativePending)return Promise.reject(new Error("微信仍在处理上一张高清照片，请稍后重试"));
 nativePending=true;
 return new Promise((resolve,reject)=>{
  let expired=false;
  const timer=setTimeout(()=>{expired=true;reject(new Error("微信缩小高清照片超时，"+needCrop));},30000);
  const done=()=>{clearTimeout(timer);nativePending=false;};
  try{
   wx.compressImage({src,compressedWidth:width,compressedHeight:height,quality:92,
    success:r=>{done();if(!r.tempFilePath||r.tempFilePath===src){reject(new Error(largeError));return;}
     if(expired)unlink(fs,r.tempFilePath);else resolve(r.tempFilePath);},
    fail:()=>{done();reject(new Error(largeError));}});
  }catch{done();reject(new Error(largeError));}
 });
}

export async function preparePhoto(path:string,getCanvas:()=>Promise<Canvas>,active:()=>boolean):Promise<PreparedPhoto>{
 if(preparationActive||nativePending)throw new Error("正在准备另一张照片，请稍后重试");
 preparationActive=true;
 try{return await prepareSelectedPhoto(path,getCanvas,active);}
 finally{preparationActive=false;}
}

async function prepareSelectedPhoto(path:string,getCanvas:()=>Promise<Canvas>,active:()=>boolean):Promise<PreparedPhoto>{
 const check=()=>{if(!active())throw interrupted();};
 check();
 const fs=wx.getFileSystemManager();
 const size=await stat(fs,path);check();
 if(size>ORIGINAL_PHOTO_LIMITS.bytes)throw new Error("原照片超过 50 MiB，"+needCrop);
 const format=photoFormat(new Uint8Array(await read(fs,path,Math.min(size,16))));check();
 if(!format)throw new Error("暂不支持此照片格式，请在相册导出为静态 JPEG、PNG 或 WebP（包括 HEIC 转存）");
 const info=await imageInfo(path);check();
 const {width:w,height:h}=info,orientation=info.orientation||"up";
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||Math.min(w,h)<PHOTO_LIMITS.minSide||!Object.prototype.hasOwnProperty.call(axes,orientation))
  throw new Error("照片尺寸或方向异常，请重新选择");
 if(w*h>ORIGINAL_PHOTO_LIMITS.pixels)throw new Error("原照片超过 5000 万像素，"+needCrop);
 const target=fitUploadSize(w,h);
 if(Math.min(target.width,target.height)<PHOTO_LIMITS.minSide)throw new Error("照片长宽比超出支持范围，"+needCrop);
 if(w*h<=PHOTO_LIMITS.pixels&&Math.max(w,h)<=PHOTO_LIMITS.side&&size<=PHOTO_LIMITS.bytes)
  return {path,release:()=>{}}; // Server handles EXIF on unchanged input.
 if(w*h<=CANVAS_SOURCE_LIMITS.pixels&&Math.max(w,h)<=CANVAS_SOURCE_LIMITS.side&&size<=CANVAS_SOURCE_LIMITS.bytes)
  return encodeCanvasPhoto(fs,path,format,w,h,orientation,getCanvas,check);

 if(!canNativeResize())throw new Error("当前微信不支持安全缩小这张高清照片，请更新微信或在相册裁剪后重试");
 if(format!=="jpeg"&&orientation!=="up")throw new Error("此格式的旋转高清照片请先在相册转存为 JPEG，或裁剪后重试");
 let copy="",resized="";
 try{
  if(format!=="jpeg")await scanLargeContainer(fs,path,format,size,check);
  if(orientation!=="up"){
   copy=wx.env.USER_DATA_PATH+"/"+prefix+Date.now()+"-"+Math.random().toString(36).slice(2)+".jpeg";
   await neutralizeLargeJpeg(fs,path,copy,size,check);
  }
  check();
  resized=await nativeResize(fs,copy||path,target.width,target.height);check();
  if(resized===path){resized="";throw new Error(largeError);}
  const bytes=await stat(fs,resized);check();
  const actual=await imageInfo(resized);check();
  const {width,height}=actual;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||Math.min(width,height)<PHOTO_LIMITS.minSide||
   Math.max(width,height)>PHOTO_LIMITS.side||width*height>PHOTO_LIMITS.pixels||
   Math.abs(width-target.width)>1||Math.abs(height-target.height)>1||(actual.orientation&&actual.orientation!=="up"))
   throw new Error("微信未返回正确尺寸或方向的缩图，"+needCrop);
  const outputFormat=photoFormat(new Uint8Array(await read(fs,resized,Math.min(16,bytes))));check();
  if(outputFormat!==format)throw new Error("微信未能保留此高清图片格式，请在相册转存为 JPEG 或裁剪后重试");
  if(orientation==="up"&&bytes<=PHOTO_LIMITS.bytes){
   const finalPath=resized;resized="";
   return {path:finalPath,release:()=>unlink(fs,finalPath)};
  }
  // Rotate only the bounded thumbnail. For an unusually large thumbnail, reuse
  // P8 JPEG encoding, but never load a temporary file above the P8 safety budget.
  if(bytes>CANVAS_SOURCE_LIMITS.bytes)throw new Error(largeError);
  return await encodeCanvasPhoto(fs,resized,format,width,height,orientation,getCanvas,check,true);
 }finally{
  if(copy)unlink(fs,copy);
  if(resized)unlink(fs,resized);
 }
}

async function encodeCanvasPhoto(fs:FileSystem,path:string,format:Format,w:number,h:number,orientation:Info["orientation"],
 getCanvas:()=>Promise<Canvas>,check:()=>void,alreadyNeutral=false):Promise<PreparedPhoto>{
 const {matrix:[a,b,c,d,x,y],swapped}=photoAxes(orientation);
 const width=swapped?h:w,height=swapped?w:h;
 let intermediate="",output="",canvas:Canvas|undefined;
 try{
  let decodePath=path;
  // Scan non-JPEG containers before conversion to reject animated input. Strip
  // EXIF before drawing only when the source actually needs orientation.
  if(!alreadyNeutral&&(orientation!=="up"||format!=="jpeg")){
   const raw=withoutPhotoOrientation(await read(fs,path),format,orientation==="up");check();
   if(orientation!=="up"){
    const dir=wx.env.USER_DATA_PATH;
    intermediate=dir+"/"+prefix+Date.now()+"-"+Math.random().toString(36).slice(2)+"."+format;
    await write(fs,intermediate,raw);check();decodePath=intermediate;
   }
  }
  canvas=await getCanvas();check();
  const image=await loadCanvasImage(canvas,decodePath);check();
  if(image.width!==w||image.height!==h)throw new Error("照片解码尺寸与原图不一致，请导出为 JPEG 后重试");
  for(const [quality,factor] of [[.94,1],[.86,1],[.76,1],[.86,.85],[.78,.70]]){
   const target=fitUploadSize(width,height,factor);
   if(Math.min(target.width,target.height)<PHOTO_LIMITS.minSide)break;
   canvas.width=target.width;canvas.height=target.height;
   const ctx=canvas.getContext("2d");
   if(!ctx)throw new Error("当前设备无法准备高清照片，请更新微信后重试");
   ctx.setTransform(1,0,0,1,0,0);
   ctx.fillStyle="#ffffff";ctx.fillRect(0,0,target.width,target.height);
   ctx.setTransform(a,b,c,d,x*target.width,y*target.height);
   ctx.drawImage(image,0,0,swapped?target.height:target.width,swapped?target.width:target.height);
   output=await new Promise<string>((resolve,reject)=>wx.canvasToTempFilePath({
    canvas,x:0,y:0,width:target.width,height:target.height,destWidth:target.width,destHeight:target.height,
    fileType:"jpg",quality,success:r=>resolve(r.tempFilePath),
    fail:()=>reject(new Error("照片压缩未完成，请重试或在相册裁剪")),
   }));
   check();
   const bytes=await stat(fs,output);check();
   if(bytes<=PHOTO_LIMITS.bytes){
    const actual=await imageInfo(output);check();
    if(actual.width!==target.width||actual.height!==target.height||(actual.orientation&&actual.orientation!=="up"))
     throw new Error("压缩后照片尺寸或方向不一致，请重试");
    const finalPath=output;output="";
    return {path:finalPath,release:()=>unlink(fs,finalPath)};
   }
   unlink(fs,output);output="";
  }
  throw new Error("无法把这张照片安全压缩到 8 MiB 以内，"+needCrop);
 }finally{
  if(canvas){canvas.width=1;canvas.height=1;}
  if(intermediate)unlink(fs,intermediate);
  if(output)unlink(fs,output);
 }
}
