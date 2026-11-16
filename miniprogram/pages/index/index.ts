import { canPreviewAtlas } from "../../config/development";
Page({
 data:{atlasPreviewAllowed:false},
 onShow(){this.setData({atlasPreviewAllowed:canPreviewAtlas()});},
 openAtlasPreview(){
  if(!canPreviewAtlas()){this.setData({atlasPreviewAllowed:false});return;}
  wx.navigateTo({url:"/packages/clinical/pages/atlas-debug/atlas-debug"});
 },
});
