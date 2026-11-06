import { BodyRegion, BodyView, NormalizedPoint, NormalizedRect } from "../types/dermatome";

export const BODY_REGION_GEOMETRY_ID = "commons-blank-cc0-v1";
export const BODY_REGION_SET_ID = "commons-blank-cc0-v1-ui-regions-1";

/** Commons新素材重新配准的UI示意区域，独立于正式医学图谱。 */
function region(
  view: BodyView, key: string, name: string, side: BodyRegion["side"],
  bounds: NormalizedRect, points: readonly (readonly [number, number])[],
): BodyRegion {
  const outline: readonly NormalizedPoint[] = Object.freeze(
    points.map(([x, y]) => Object.freeze({ x, y })),
  );
  return Object.freeze({ id: view + "-" + key, view, name, side, bounds: Object.freeze(bounds), outline });
}

// 按新素材逐面配准；只表达UI粗区域，不含医学皮节。
const FRONT: readonly BodyRegion[] = Object.freeze([
  region("front","head","头部","midline",{x:0.36,y:0.025,width:0.28,height:0.16},[[0.36,0.025],[0.64,0.025],[0.64,0.185],[0.36,0.185]]),
  region("front","neck","颈部","midline",{x:0.43,y:0.18,width:0.14,height:0.045},[[0.43,0.18],[0.57,0.18],[0.57,0.225],[0.43,0.225]]),
  region("front","chest","胸部","midline",{x:0.26,y:0.22,width:0.5,height:0.13},[[0.27,0.22],[0.73,0.22],[0.68,0.35],[0.32,0.35]]),
  region("front","abdomen","腹部","midline",{x:0.28,y:0.35,width:0.44,height:0.19},[[0.33,0.35],[0.67,0.35],[0.7,0.47],[0.52,0.54],[0.48,0.54],[0.3,0.47]]),
  region("front","left-arm","左上肢","left",{x:0.64,y:0.205,width:0.33,height:0.385},[[0.7,0.205],[0.8,0.23],[0.825,0.36],[0.86,0.46],[0.97,0.52],[0.96,0.59],[0.79,0.59],[0.72,0.46],[0.64,0.31]]),
  region("front","right-arm","右上肢","right",{x:0.03,y:0.205,width:0.33,height:0.385},[[0.3,0.205],[0.2,0.23],[0.175,0.36],[0.14,0.46],[0.03,0.52],[0.04,0.59],[0.21,0.59],[0.28,0.46],[0.36,0.31]]),
  region("front","left-leg","左下肢","left",{x:0.5,y:0.49,width:0.275,height:0.495},[[0.5,0.49],[0.705,0.49],[0.72,0.67],[0.705,0.86],[0.775,0.985],[0.5,0.985]]),
  region("front","right-leg","右下肢","right",{x:0.225,y:0.49,width:0.275,height:0.495},[[0.5,0.49],[0.295,0.49],[0.28,0.67],[0.295,0.86],[0.225,0.985],[0.5,0.985]]),
]);
const BACK: readonly BodyRegion[] = Object.freeze([
  region("back","head","头部","midline",{x:0.35,y:0.025,width:0.29,height:0.12},[[0.35,0.025],[0.64,0.025],[0.64,0.145],[0.35,0.145]]),
  region("back","neck","颈部","midline",{x:0.42,y:0.145,width:0.16,height:0.065},[[0.42,0.145],[0.58,0.145],[0.58,0.21],[0.42,0.21]]),
  region("back","upper-back","上背部","midline",{x:0.25,y:0.195,width:0.5,height:0.16},[[0.26,0.195],[0.74,0.195],[0.68,0.355],[0.32,0.355]]),
  region("back","lower-back","腰背部","midline",{x:0.28,y:0.355,width:0.44,height:0.185},[[0.33,0.355],[0.67,0.355],[0.7,0.47],[0.52,0.54],[0.48,0.54],[0.3,0.47]]),
  region("back","left-arm","左上肢","left",{x:0.03,y:0.205,width:0.33,height:0.385},[[0.3,0.205],[0.2,0.23],[0.175,0.36],[0.14,0.46],[0.03,0.52],[0.04,0.59],[0.21,0.59],[0.28,0.46],[0.36,0.31]]),
  region("back","right-arm","右上肢","right",{x:0.64,y:0.205,width:0.33,height:0.385},[[0.7,0.205],[0.8,0.23],[0.825,0.36],[0.86,0.46],[0.97,0.52],[0.96,0.59],[0.79,0.59],[0.72,0.46],[0.64,0.31]]),
  region("back","left-leg","左下肢","left",{x:0.225,y:0.49,width:0.275,height:0.495},[[0.5,0.49],[0.295,0.49],[0.28,0.67],[0.295,0.86],[0.225,0.985],[0.5,0.985]]),
  region("back","right-leg","右下肢","right",{x:0.5,y:0.49,width:0.275,height:0.495},[[0.5,0.49],[0.705,0.49],[0.72,0.67],[0.705,0.86],[0.775,0.985],[0.5,0.985]]),
]);
export const BODY_REGIONS: Readonly<Record<BodyView, readonly BodyRegion[]>> = Object.freeze({front:FRONT,back:BACK});
export function getBodyRegion(view: BodyView, id: string): BodyRegion | undefined {
  return BODY_REGIONS[view].find(item=>item.id===id);
}
