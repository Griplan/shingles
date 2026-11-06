import { CanvasPoint, PathCommand } from "../types/dermatome";

/** 同一贝塞尔路径的命中近似；最大控制点到弦距离 0.2 逻辑单位。 */
export const PATH_FLATNESS = .2;
export const HIT_EDGE_TOLERANCE = .25;

function distance(p: CanvasPoint, a: CanvasPoint, b: CanvasPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/length2)) : 0;
  return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
}
const midpoint = (a: CanvasPoint, b: CanvasPoint): CanvasPoint => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2});

export function flattenOutline(commands: readonly PathCommand[]): readonly CanvasPoint[] {
  const points: CanvasPoint[] = [];
  let current: CanvasPoint = {x:0,y:0};
  function cubic(a: CanvasPoint, b: CanvasPoint, c: CanvasPoint, d: CanvasPoint, depth=0): void {
    if (Math.max(distance(b,a,d),distance(c,a,d)) <= PATH_FLATNESS || depth >= 16) {
      points.push(d); return;
    }
    const ab=midpoint(a,b), bc=midpoint(b,c), cd=midpoint(c,d);
    const abc=midpoint(ab,bc), bcd=midpoint(bc,cd), m=midpoint(abc,bcd);
    cubic(a,ab,abc,m,depth+1); cubic(m,bcd,cd,d,depth+1);
  }
  for (const c of commands) {
    if (c[0]==="M" || c[0]==="L") { current={x:c[1],y:c[2]}; points.push(current); }
    else if (c[0]==="C") {
      const end={x:c[5],y:c[6]}; cubic(current,{x:c[1],y:c[2]},{x:c[3],y:c[4]},end); current=end;
    } else if (c[0]==="Q") {
      const control={x:c[1],y:c[2]}, end={x:c[3],y:c[4]};
      cubic(current,{x:current.x+2*(control.x-current.x)/3,y:current.y+2*(control.y-current.y)/3},
        {x:end.x+2*(control.x-end.x)/3,y:end.y+2*(control.y-end.y)/3},end); current=end;
    }
  }
  if (points.length < 3 || commands[commands.length-1]?.[0] !== "Z") throw new RangeError("轮廓必须闭合");
  return Object.freeze(points.map(p=>Object.freeze(p)));
}

/** 非零填充的简单单轮廓；边缘容差仅判断，不移动输入点。 */
export function pointInOutline(point: CanvasPoint, outline: readonly CanvasPoint[]): boolean {
  if (![point.x,point.y].every(Number.isFinite) || outline.length<3) return false;
  let inside=false;
  for (let i=0,j=outline.length-1;i<outline.length;j=i++) {
    const a=outline[j], b=outline[i];
    if (distance(point,a,b)<=HIT_EDGE_TOLERANCE) return true;
    if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
