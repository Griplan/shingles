import {apiBaseUrl,API_CONFIG} from "../config/api";
import {accessHeaders,controlledServerActive} from "../config/controlled";
import {currentEnvironment} from "../config/environment";

let formalSession:{token:string;expires:number}|null=null;
let pending:Promise<void>|null=null;

function ensureFormalAccess():Promise<void> {
 if(formalSession&&formalSession.expires>Date.now()/1000+10)return Promise.resolve();
 if(pending)return pending;
 const endpoint=apiBaseUrl()+"/api/v1/access/wechat";
 const login=new Promise<string>((resolve,reject)=>wx.login({
  success:r=>r.code?resolve(r.code):reject(new Error("微信登录凭证不可用，请重试")),
  fail:()=>reject(new Error("微信登录未完成，请重试")),
 }));
 const request=login.then(code=>new Promise<void>((resolve,reject)=>wx.request({
  url:endpoint,method:"POST",data:{code},timeout:API_CONFIG.timeoutMs,
  success:r=>{
   if(r.statusCode!==200){
    reject(new Error(r.statusCode===403?"微信登录未通过，请重试":r.statusCode===429?"连接过于频繁，请稍后重试":r.statusCode===503?"图片与参考匹配服务暂未启用":"图片与参考匹配服务暂不可用"));return;
   }
   const value=r.data as {access_token?:unknown;expires_at?:unknown;token_type?:unknown;access_kind?:unknown}|null;
   if(!value||typeof value.access_token!=="string"||!/^dm1\.[A-Za-z0-9_-]{40,450}\.[A-Za-z0-9_-]{43}$/.test(value.access_token)||
    typeof value.expires_at!=="number"||!Number.isFinite(value.expires_at)||value.expires_at<=Date.now()/1000||
    value.token_type!=="Bearer"||value.access_kind!=="production"){reject(new Error("微信登录响应无效，请重试"));return;}
   formalSession={token:value.access_token,expires:value.expires_at};resolve();
  },
  fail:()=>reject(new Error("无法连接正式服务，请稍后重试")),
 })));
 pending=request;
 void request.then(()=>{pending=null;},()=>{pending=null;});
 return request;
}

export async function onlineHeaders():Promise<Record<string,string>> {
 if(controlledServerActive())return accessHeaders();
 const env=currentEnvironment();
 if(env!=="develop"&&env!=="trial"&&env!=="release")throw new Error("当前版本暂不支持在线服务");
 await ensureFormalAccess();
 return {authorization:"Bearer "+formalSession!.token};
}

export function invalidateOnlineAccess(authorization?:string):void {
 if(!authorization)return;
 if(authorization==="Bearer "+formalSession?.token)formalSession=null;
}
