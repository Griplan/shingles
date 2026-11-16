import {currentCapabilities} from "./environment";
export const AI_CONFIG=Object.freeze({enabled:true,timeoutMs:60000});
export function canUseAI():boolean {
 return AI_CONFIG.enabled&&currentCapabilities().aiSegmentation;
}
export function canPlaceAI():boolean {return currentCapabilities().aiPlacement;}
