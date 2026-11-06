/** 兼容旧入口；当前标注、计算和结果共享annotate中的一个Canvas。 */
Page({
 data:{message:"正在返回标注工作区…"},
 onLoad(query:Record<string,string|undefined>){
  const sessionId=query.sessionId||"";
  wx.redirectTo({url:`/pages/annotate/annotate?sessionId=${encodeURIComponent(sessionId)}&result=1`,
   fail:()=>this.setData({message:"无法返回工作区，请使用左上角返回；本次标注仍保留"})});
 },
});
