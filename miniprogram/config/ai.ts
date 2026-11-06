import {currentCapabilities,currentEnvironment} from "./environment";
import {controlledServerActive} from "./controlled";
export const AI_CONFIG=Object.freeze({enabled:true,timeoutMs:60000,maxBytes:20*1024*1024});
export function canUseAI():boolean {
 return AI_CONFIG.enabled&&currentCapabilities().aiSegmentation;
}
export function canPlaceAI():boolean {return currentCapabilities().aiPlacement;}
export function photoByteLimit():number {return currentEnvironment()==="trial"||controlledServerActive()?10*1024*1024:AI_CONFIG.maxBytes;}
