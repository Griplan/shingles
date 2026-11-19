export function windowPixelRatio():number {
  try {
    const api=wx as unknown as {
      getWindowInfo?:()=>{pixelRatio?:number};
      getSystemInfoSync?:()=>{pixelRatio?:number};
    };
    const ratio=api.getWindowInfo?.().pixelRatio ?? api.getSystemInfoSync?.().pixelRatio;
    return Number.isFinite(ratio)&&ratio&&ratio>0?ratio:1;
  } catch {
    return 1;
  }
}

export function canvasBackingSize(width:number,height:number,deviceRatio:number) {
  const ratio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
  const dpr=Math.min(ratio,3,3072/Math.max(width,height),Math.sqrt(4_000_000/(width*height)));
  return {dpr,width:Math.max(1,Math.floor(width*dpr)),height:Math.max(1,Math.floor(height*dpr))};
}
