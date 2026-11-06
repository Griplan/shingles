import {apiBaseUrl,API_CONFIG} from "../config/api";
import {currentEnvironment} from "../config/environment";
let session:{token:string;expires:number}|null=null;
let generation=0;
let pending:Promise<void>|null=null;
export function needsTrialAccess():boolean {
 const env=currentEnvironment();
 if(env==="trial")return true;
 if(env!=="develop")return false;
 try{return wx.getSystemInfoSync().platform!=="devtools";}catch{return true;}
}
export function trialAccessActive():boolean {return !!session&&session.expires>Date.now()/1000;}
export function trialHeaders():Record<string,string> {return trialAccessActive()?{authorization:"Bearer "+session!.token}:{};}
/** An old unauthorized response must never clear a newer temporary session. */
export function invalidateTrialAccess(authorization?:string):void {
 if(authorization&&authorization!=="Bearer "+session?.token)return;
 session=null;generation++;pending=null;
}
/** Silent, bounded public-test session. This does not attest WeChat identity or debug mode. */
export function ensureTrialAccess():Promise<void> {
 if(!needsTrialAccess()||trialAccessActive())return Promise.resolve();
 if(pending)return pending;
 let endpoint:string;try{endpoint=apiBaseUrl();}catch(e){return Promise.reject(e);}
 const owner=generation;
 const request=new Promise<void>((resolve,reject)=>wx.request({url:endpoint+"/api/v1/access/session",method:"POST",timeout:API_CONFIG.timeoutMs,
  header:{"content-type":"application/json"},data:{},success:r=>{
   if(owner!==generation){reject(new Error("本次连接已取消，请重试"));return;}
   if(r.statusCode!==200){reject(new Error(r.statusCode===429?"当前测试服务繁忙，请稍后重试":"当前测试服务暂不可用，请稍后重试"));return;}
   const value=(r.data&&typeof r.data==="object"?r.data:{}) as {access_token?:unknown;expires_at?:unknown;token_type?:unknown;access_kind?:unknown};
   if(typeof value.access_token!=="string"||!/^[A-Za-z0-9_-]{40,128}$/.test(value.access_token)||
    typeof value.expires_at!=="number"||!Number.isFinite(value.expires_at)||value.expires_at<=Date.now()/1000||
    value.token_type!=="Bearer"||value.access_kind!=="public_test"){
    reject(new Error("测试服务连接未完成，请重试"));return;}
   session={token:value.access_token,expires:value.expires_at};resolve();
  },fail:e=>reject(new Error(/timeout/i.test(e.errMsg||"")?"连接超时，请稍后重试":"当前网络连接失败，请检查手机开发调试是否已开启"))}));
 pending=request;void request.then(()=>{if(pending===request)pending=null;},()=>{if(pending===request)pending=null;});return request;
}
export async function endTrialAccess():Promise<void> {
 const header=trialHeaders();invalidateTrialAccess();
 if(!header.authorization)return;
 try{await new Promise<void>(resolve=>wx.request({url:apiBaseUrl()+"/api/v1/access/session",method:"DELETE",header,timeout:API_CONFIG.timeoutMs,success:()=>resolve(),fail:()=>resolve()}));}catch{/* Server expiry remains authoritative. */}
}
