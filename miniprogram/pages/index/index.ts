import { canPreviewAtlas } from "../../config/development";
import {useControlledServer,clearControlledServer,controlledServerActive} from "../../config/controlled";
Page({
 data:{atlasPreviewAllowed:false,controlled:false},
 onShow(){this.setData({atlasPreviewAllowed:canPreviewAtlas(),controlled:controlledServerActive()});},
 connectTest(){
  if(controlledServerActive()){clearControlledServer();this.setData({controlled:false});return;}
  wx.showModal({title:"连接受控测试服务",content:"请先开启SSH测试通道。仅上传公开或合成图片。填写单独提供的访问凭据：",editable:true,placeholderText:"测试访问凭据",success:r=>{
   if(!r.confirm)return;
   try{useControlledServer(r.content||"");this.setData({controlled:true});}catch(e){wx.showToast({title:(e as Error).message,icon:"none"});}
  }});
 },
 openAtlasPreview(){
  if(!canPreviewAtlas()){this.setData({atlasPreviewAllowed:false});return;}
  wx.navigateTo({url:"/pages/atlas-debug/atlas-debug"});
 },
});
