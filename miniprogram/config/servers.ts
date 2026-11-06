/** Public addresses only; credentials must never be included here.
 * Temporary IP transport is confined to develop/ trial. Phone development debugging is required.
 * Replace trialBaseUrl and disable trialPublicIpDebug when a trusted HTTPS host is available.
 */
export const SERVERS=Object.freeze({trialBaseUrl:"http://212.64.26.206/dermatome-test",trialPublicIpDebug:true,releaseBaseUrl:""});
const PUBLIC_IP_TEST_BASE="http://212.64.26.206/dermatome-test";
export function trialServiceBase():string {
 if(SERVERS.trialPublicIpDebug&&SERVERS.trialBaseUrl===PUBLIC_IP_TEST_BASE)return PUBLIC_IP_TEST_BASE;
 return validatedHttpsBase(SERVERS.trialBaseUrl);
}
export function usingPublicIpDebug():boolean {return SERVERS.trialPublicIpDebug&&SERVERS.trialBaseUrl===PUBLIC_IP_TEST_BASE;}
export function validatedHttpsBase(value:string):string {
 // Native mini-program engines need no DOM or WHATWG URL implementation.
 const match=/^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)\/?$/i.exec(value);
 const host=match?.[1].toLowerCase();
 if(!host||host.length>253||!host.includes(".")||!/[a-z]/.test(host)||host.endsWith(".localhost")||host.endsWith(".local")||
  host.split(".").some(label=>!label||label.length>63||label.startsWith("-")||label.endsWith("-")))
  throw new Error("当前测试服务暂不可用，请联系邀请人完成服务接入");
 return "https://"+host;
}
