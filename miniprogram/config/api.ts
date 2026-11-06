/** Simulator loopback, trusted HTTPS, or the explicit temporary IP debugging channel. */
import {controlledServerActive,CONTROLLED_SIMULATOR_URL} from "./controlled";
import {currentEnvironment} from "./environment";
import {SERVERS,validatedHttpsBase,trialServiceBase} from "./servers";
export const API_CONFIG=Object.freeze({simulatorBaseUrl:"http://127.0.0.1:8000",deviceBaseUrl:"",timeoutMs:15000});
export function apiBaseUrl():string {
 const env=currentEnvironment();
 if(env==="trial")return trialServiceBase();
 if(env==="release")return validatedHttpsBase(SERVERS.releaseBaseUrl);
 if(env!=="develop")throw new Error("当前版本暂不支持在线服务");
 const simulator=wx.getSystemInfoSync().platform==="devtools";
 if(simulator&&controlledServerActive())return CONTROLLED_SIMULATOR_URL;
 const url=simulator?API_CONFIG.simulatorBaseUrl:API_CONFIG.deviceBaseUrl;
 if(!simulator)return url?validatedHttpsBase(url):trialServiceBase();
 if(!url)throw new Error("当前测试服务暂不可用，请稍后重试");
 return url.replace(/\/$/,"");
}
