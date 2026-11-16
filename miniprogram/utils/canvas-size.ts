export function canvasBackingSize(width:number,height:number,deviceRatio:number) {
  const ratio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
  const dpr=Math.min(ratio,3,3072/Math.max(width,height),Math.sqrt(4_000_000/(width*height)));
  return {dpr,width:Math.max(1,Math.floor(width*dpr)),height:Math.max(1,Math.floor(height*dpr))};
}
