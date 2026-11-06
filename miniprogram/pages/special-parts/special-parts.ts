import {isLocalSurfaceView} from "../../data/local-models";
Page({
 data:{opening:false,message:""},
 choose(event:WechatMiniprogram.TouchEvent){
  const view=event.currentTarget.dataset.view;
  if(this.data.opening||!isLocalSurfaceView(view))return;
  this.setData({opening:true,message:""});
  wx.navigateTo({url:`/pages/local-surface/local-surface?view=${view}`,fail:()=>this.setData({message:"部位页面未能打开，请重试"}),complete:()=>this.setData({opening:false})});
 },
 returnBody(){
  const pages=getCurrentPages(),index=pages.map(p=>p.route).lastIndexOf("pages/select/select");
  if(index>=0&&index<pages.length-1)wx.navigateBack({delta:pages.length-1-index});
  else wx.redirectTo({url:"/pages/select/select"});
 }
});
