import {capabilities,currentCapabilities} from "./environment";
/** 集中开发能力开关；修改为false后入口与页面均关闭。query不参与判断。 */
export const DEVELOPMENT_FEATURES=Object.freeze({atlasPreview:true,referenceMatching:true});
export function isAtlasPreviewEnvironment(account:unknown,enabled:boolean=DEVELOPMENT_FEATURES.atlasPreview):boolean {
  return enabled&&capabilities(account).atlasDebug;
}
export function canPreviewAtlas():boolean {
  try {return isAtlasPreviewEnvironment(wx.getAccountInfoSync());}catch {return false;}
}

/** Independent client gate. Server checks its own environment; query cannot enable either. */
export function canMatchReference():boolean {
 return DEVELOPMENT_FEATURES.referenceMatching&&currentCapabilities().referenceMatching;
}
