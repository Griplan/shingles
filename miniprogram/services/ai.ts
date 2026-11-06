import {apiBaseUrl} from "../config/api";
import {accessHeaders,controlledServerActive} from "../config/controlled";
import {AI_CONFIG,canUseAI} from "../config/ai";
import {ensureTrialAccess,trialHeaders,invalidateTrialAccess,needsTrialAccess} from "./trial-access";
import {PhotoTransport,PhotoSession,PhotoResult,PhotoPrompts,ConfirmedPhoto,EditedCandidate} from "../types/ai";
const ERRORS:Record<string,string>={AI_DISABLED:"当前版本暂未开放AI辅助标注",AI_UNAVAILABLE:"AI后端尚未就绪，仍可返回手动标注",
 TRIAL_ACCESS_REQUIRED:"测试连接已失效，请重试",ACCESS_UNAVAILABLE:"当前测试服务暂不可用，请稍后重试",
 ACCESS_DENIED:"测试连接未完成，请重试",RATE_LIMITED:"操作过于频繁，请稍后重试",SERVICE_UNAVAILABLE:"AI服务暂时停用，请稍后重试或返回手动标注",
 AI_SESSION_GONE:"照片已过期，请重新上传",AI_BUSY:"AI正在处理，请稍后重试",AI_CAPACITY:"临时分析已满，请稍后重试",
 AI_TIMEOUT:"AI处理超时，提示已保留，请稍后重试",STALE_RESULT:"结果已失效，请重新分割",PHOTO_MISMATCH:"照片已更换，请重新分割",
 IMAGE_TOO_LARGE:"照片不能超过20MiB",INVALID_DIMENSIONS:"照片尺寸不支持（8至8192像素，总计不超过1200万像素）",
 UNSUPPORTED_FORMAT:"请使用静态JPEG、PNG或WebP图片",INVALID_IMAGE:"照片损坏或格式不支持，请更换照片",INVALID_INPUT:"提示格式不合法，请重置提示",
 INVALID_CANDIDATE:"候选为空或轮廓无效，请重新分割",RESULT_TOO_COMPLEX:"轮廓过于复杂，请缩小目标或调整提示",OUT_OF_MEMORY:"内存不足，请换较小照片重试",
 BRUSH_LIMIT:"本次修正过长，请使用更短的笔画",INVALID_BRUSH:"笔画无效，请重新涂画",INVALID_STRATEGY:"多个局部范围请使用局部分析"};
function failure(status:number,data:unknown):Error {const code=(data as {error?:{code?:string}})?.error?.code||"";
 if((controlledServerActive()||needsTrialAccess())&&(code==="IMAGE_TOO_LARGE"||code==="INVALID_DIMENSIONS"))return new Error("测试服务仅支持10MiB以内、总计不超过300万像素的照片，请更换照片");
 return new Error(ERRORS[code]||(status===502||status===503?"AI服务暂时不可用，请确认已启动；可返回手动标注":`AI请求未完成（${status}），可以重试或返回手动标注`));}
function network(e:{errMsg?:string}):Error {return new Error(/timeout|timed out/i.test(e.errMsg||"")?"请求超时，提示已保留，请稍后重试":"当前网络连接失败，请稍后重试或返回手动标注");}
function base(){if(!canUseAI())throw new Error(ERRORS.AI_DISABLED);return apiBaseUrl()+"/api/v1/ai/sessions";}
async function request<T>(path:string,method:"POST"|"DELETE",data:unknown,key=""):Promise<T>{
 if(method!=="DELETE"&&needsTrialAccess())await ensureTrialAccess();
 return new Promise((resolve,reject)=>{
 let url:string;try{url=base()+path;}catch(e){reject(e);return;}
 const headers:Record<string,string>={"content-type":"application/json","x-ai-session-key":key,...accessHeaders(),...trialHeaders()};
 wx.request({url,method,data:data as Record<string,unknown>,timeout:AI_CONFIG.timeoutMs,header:headers,
 success:r=>{if(r.statusCode===401&&headers.authorization)invalidateTrialAccess(headers.authorization);
  if(r.statusCode>=200&&r.statusCode<300)resolve(r.data as T);else reject(failure(r.statusCode,r.data));},fail:e=>reject(network(e))});
});}
const downloads=new Set<string>();
function forget(path:string){if(!downloads.delete(path))return;wx.getFileSystemManager().unlink({filePath:path,fail:()=>{}});}
async function download(s:PhotoSession,name:string,resultId=""):Promise<string>{
 if(needsTrialAccess())await ensureTrialAccess();
 const headers:Record<string,string>={"x-ai-session-key":s.session_token,...accessHeaders(),...trialHeaders()};
 const url=base()+`/${s.session_id}/assets/${name}`+(resultId?`?result_id=${encodeURIComponent(resultId)}`:"");
 return new Promise((resolve,reject)=>wx.downloadFile({url,timeout:AI_CONFIG.timeoutMs,header:headers,success:r=>{
  if(r.statusCode===401&&headers.authorization)invalidateTrialAccess(headers.authorization);
  if(r.tempFilePath)downloads.add(r.tempFilePath);
  if(r.statusCode!==200){forget(r.tempFilePath);reject(failure(r.statusCode,r.statusCode===410?{error:{code:"AI_SESSION_GONE"}}:{}));return;}
  wx.getImageInfo({src:r.tempFilePath,success:info=>{
   if(info.width!==s.image.width||info.height!==s.image.height){forget(r.tempFilePath);reject(new Error("图片与照片尺寸不一致，请重新上传"));return;}resolve(r.tempFilePath);
  },fail:()=>{forget(r.tempFilePath);reject(new Error("图片预览无法读取，请重试"));}});
 },fail:e=>reject(network(e))}));
}
export const aiTransport:PhotoTransport={
 async open(path){
  const created=await request<{session_id:string;session_token:string;expires_at:number}>("","POST",{});
  if(!/^[a-f0-9]{32}$/.test(created.session_id)||typeof created.session_token!=="string"||!Number.isFinite(created.expires_at))throw new Error("AI会话响应无效");
  try{
   const headers:Record<string,string>={"x-ai-session-key":created.session_token,...accessHeaders(),...trialHeaders()};
   const uploaded=await new Promise<{photo_id:string;image:PhotoSession["image"];session_id:string;expires_at:number}>((resolve,reject)=>wx.uploadFile({
    url:base()+`/${created.session_id}/photo`,filePath:path,name:"file",timeout:AI_CONFIG.timeoutMs,header:headers,
    success:r=>{if(r.statusCode===401&&headers.authorization)invalidateTrialAccess(headers.authorization);let data:unknown;try{data=JSON.parse(r.data);}catch{reject(new Error("上传响应无效，请重试"));return;}
     if(r.statusCode===200)resolve(data as never);else reject(failure(r.statusCode,data));},fail:e=>reject(network(e))}));
   if(uploaded.session_id!==created.session_id||!/^[a-f0-9]{32}$/.test(uploaded.photo_id)||!uploaded.image||
    !Number.isFinite(uploaded.image.width)||!Number.isFinite(uploaded.image.height)||uploaded.image.width<8||uploaded.image.height<8||
    !/^[a-f0-9]{64}$/.test(uploaded.image.oriented_rgb_sha256)||uploaded.expires_at!==created.expires_at)throw new Error("照片响应无效，请重新上传");
   const session:PhotoSession={...created,...uploaded,localPhoto:""};session.localPhoto=await download(session,"photo.png");return session;
  }catch(e){try{await request(`/${created.session_id}`,"DELETE",{},created.session_token);}catch{/* TTL still applies; no image is persisted by the client. */}throw e;}
 },
 segment:(s:PhotoSession,p:PhotoPrompts,revision:number,id:string,strategy="context_crop")=>request<PhotoResult>(`/${s.session_id}/segment`,"POST",{photo_id:s.photo_id,prompts:p,prompt_revision:revision,request_id:id,strategy},s.session_token),
 asset:(s,id,result,revision=0)=>download(s,`${id}${revision?'-edit-'+revision:''}-alpha.png`,result),
 edit:(s,r,id,revision,strokes)=>request<EditedCandidate>(`/${s.session_id}/edit`,"POST",{photo_id:s.photo_id,result_id:r.result_id,candidate_id:id,prompt_revision:r.prompt_revision,coordinate_space:r.coordinate_space,edit_revision:revision,strokes},s.session_token),
 confirm:(s,r,id,revision=0)=>request<ConfirmedPhoto>(`/${s.session_id}/confirm`,"POST",{photo_id:s.photo_id,result_id:r.result_id,candidate_id:id,prompt_revision:r.prompt_revision,edit_revision:revision},s.session_token),
 async remove(s){try{await request(`/${s.session_id}`,"DELETE",{},s.session_token);}catch(e){if((e as Error).message!==ERRORS.AI_SESSION_GONE)throw e;}},forget,
};
