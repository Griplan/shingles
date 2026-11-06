import { apiBaseUrl,API_CONFIG } from "../config/api";
import { canMatchReference } from "../config/development";
import {SurfaceView} from "../types/dermatome";
import { EvaluateRequest } from "../types/evaluate";
import { accessHeaders } from "../config/controlled";
import {ensureTrialAccess,trialHeaders,invalidateTrialAccess,needsTrialAccess} from "./trial-access";
import {currentEnvironment} from "../config/environment";
let latestTiming:{requestId:string;networkMs:number}|null=null;
export function requestTiming(){return latestTiming;}
export const API_ERROR_TEXT:Readonly<Record<string,string>>={
 TRIAL_ACCESS_REQUIRED:"测试连接已失效，请重试；标注已保留",ACCESS_UNAVAILABLE:"当前测试服务暂不可用，请稍后重试",
 ACCESS_DENIED:"测试连接未完成，请重试；标注已保留",RATE_LIMITED:"请求过于频繁，请稍后重试",SERVICE_UNAVAILABLE:"服务暂时停用，请稍后重试；标注已保留",
 MATCHING_DISABLED:"服务尚未启用开发测试匹配",INVALID_INPUT:"请求格式不合法，请更新客户端后重试",
 INVALID_ANNOTATION:"标注无效或跨出人体，请返回编辑",VERSION_MISMATCH:"人体或图谱版本不一致，请同步更新前后端",
 ATLAS_NOT_READY:"手掌参考分区尚未就绪，标注已保留",ATLAS_NOT_FOUND:"后端未配置这套图谱",ATLAS_UNAVAILABLE:"图谱文件缺失、损坏或尚未同步",
 VIEW_UNSUPPORTED:"当前视图尚未支持",LIMIT_EXCEEDED:"标注数量超限，请返回编辑",PAYLOAD_TOO_LARGE:"请求过大，请减少标注顶点",
 INTERNAL_ERROR:"服务暂时无法完成计算，请重试",COMPUTATION_ERROR:"几何计算校验失败，请联系开发人员"};
/** Inspect only the platform error category; never display or log raw request data. */
export function networkErrorText(error:unknown):string {
 if(currentEnvironment()==="trial")return "当前网络连接失败或超时，请稍后重试。已有标注已保留";
 const detail=error && typeof error==="object" ? (error as {errMsg?:unknown}).errMsg : "";
 const message=typeof detail==="string" ? detail.toLowerCase() : "";
 if(/url not in domain list|not in.*domain list|合法域名|domain.*not allowed/.test(message))
  return "请求被微信合法域名校验拦截；请检查开发工具的本地网络设置，或配置合法HTTPS后端域名。标注已保留";
 if(/timeout|timed out|超时/.test(message))
  return "后端请求超时；请稍后重试或检查服务响应，标注已保留";
 return "无法连接后端；请检查服务是否运行及访问地址，标注已保留，可重试";
}
/** The caller validates identity and result shape before showing any returned overlay. */
export async function evaluateAnnotations(payload:EvaluateRequest<SurfaceView>):Promise<unknown> {
 if(needsTrialAccess())await ensureTrialAccess();
 return new Promise((resolve,reject)=>{
  if(!canMatchReference()){reject(new Error("当前环境不允许参考匹配"));return;}
  let url:string;try{url=apiBaseUrl()+"/api/v1/evaluate";}catch(e){reject(e);return;}
  const started=Date.now(),headers:Record<string,string>={"content-type":"application/json",...accessHeaders(),...trialHeaders()};
  wx.request({url,method:"POST",data:payload as unknown as Record<string,unknown>,timeout:API_CONFIG.timeoutMs,
   header:headers,success:r=>{
    if(r.statusCode===401&&headers.authorization)invalidateTrialAccess(headers.authorization);
    latestTiming={requestId:payload.request_id,networkMs:Date.now()-started};
    if(r.statusCode===200){resolve(r.data);return;}
    const data=r.data as {error?:{code?:string}};
    reject(new Error(API_ERROR_TEXT[data?.error?.code||""]||(r.statusCode===502||r.statusCode===503?"服务暂时不可用，请确认已启动；标注已保留":`服务请求失败（${r.statusCode}），标注已保留`)));
   },fail:error=>reject(new Error(networkErrorText(error)))});
 });
}
