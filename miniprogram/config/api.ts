/** All normal environments use the formal HTTPS service. Only an explicit local credential may select localhost. */
import {controlledServerActive,CONTROLLED_SIMULATOR_URL} from "./controlled";
import {currentEnvironment} from "./environment";
import {formalServiceBase} from "./servers";
export const API_CONFIG=Object.freeze({timeoutMs:15000});
export function apiBaseUrl():string {
 const env=currentEnvironment();
 if(env!=="develop"&&env!=="trial"&&env!=="release")throw new Error("当前版本暂不支持在线服务");
 if(env==="develop"&&controlledServerActive())return CONTROLLED_SIMULATOR_URL;
 return formalServiceBase();
}
