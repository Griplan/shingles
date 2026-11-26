import {currentEnvironment} from "./environment";
/** Public address only; credentials must never be included here. */
export const SERVERS=Object.freeze({formalBaseUrl:"https://dermatome.bglabs.cloud"});
export function usesFormalService():boolean {
 const env=currentEnvironment();
 return env==="develop"||env==="trial"||env==="release";
}
export function formalServiceBase():string {return validatedHttpsBase(SERVERS.formalBaseUrl);}
export function validatedHttpsBase(value:string):string {
 // Native mini-program engines need no DOM or WHATWG URL implementation.
 const match=/^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)\/?$/i.exec(value);
 const host=match?.[1].toLowerCase();
 if(!host||host.length>253||!host.includes(".")||!/[a-z]/.test(host)||host.endsWith(".localhost")||host.endsWith(".local")||
  host.split(".").some(label=>!label||label.length>63||label.startsWith("-")||label.endsWith("-")))
  throw new Error("当前测试服务暂不可用，请联系邀请人完成服务接入");
 return "https://"+host;
}
