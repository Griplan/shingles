import { BodyRegion, BodyView, NormalizedPoint, NormalizedRect } from "../types/dermatome";

export const BODY_REGION_GEOMETRY_ID = "neutral-body-v2";
export const BODY_REGION_SET_ID = "neutral-body-v2-ui-regions-1";

/** 原创 UI 示意区域，独立于正式医学图谱。 */
function region(
  view: BodyView, key: string, name: string, side: BodyRegion["side"],
  bounds: NormalizedRect, points: readonly (readonly [number, number])[],
): BodyRegion {
  const outline: readonly NormalizedPoint[] = Object.freeze(
    points.map(([x, y]) => Object.freeze({ x, y })),
  );
  return Object.freeze({ id: view + "-" + key, view, name, side, bounds: Object.freeze(bounds), outline });
}
// 各视图独立数据；正面人体左侧在屏幕右方，背面则在屏幕左方。
const FRONT: readonly BodyRegion[] = Object.freeze([
  region("front","head","头部","midline",{x:.37,y:.025,width:.26,height:.135},
    [[.37,.025],[.63,.025],[.63,.16],[.37,.16]]),
  region("front","neck","颈部","midline",{x:.435,y:.15,width:.13,height:.04},
    [[.435,.15],[.565,.15],[.565,.19],[.435,.19]]),
  region("front","chest","胸部","midline",{x:.33,y:.18,width:.34,height:.15},
    [[.34,.18],[.66,.18],[.64,.33],[.36,.33]]),
  region("front","abdomen","腹部","midline",{x:.33,y:.33,width:.34,height:.19},
    [[.36,.33],[.64,.33],[.67,.49],[.50,.52],[.33,.49]]),
  region("front","left-arm","左上肢","left",{x:.62,y:.18,width:.28,height:.39},
    [[.65,.18],[.76,.21],[.90,.57],[.77,.57],[.62,.27]]),
  region("front","right-arm","右上肢","right",{x:.10,y:.18,width:.28,height:.39},
    [[.35,.18],[.24,.21],[.10,.57],[.23,.57],[.38,.27]]),
  region("front","left-leg","左下肢","left",{x:.50,y:.51,width:.20,height:.475},
    [[.50,.51],[.67,.51],[.70,.985],[.50,.985]]),
  region("front","right-leg","右下肢","right",{x:.30,y:.51,width:.20,height:.475},
    [[.50,.51],[.33,.51],[.30,.985],[.50,.985]]),
]);
const BACK: readonly BodyRegion[] = Object.freeze([
  region("back","head","头部","midline",{x:.37,y:.025,width:.26,height:.135},
    [[.37,.025],[.63,.025],[.63,.16],[.37,.16]]),
  region("back","neck","颈部","midline",{x:.435,y:.15,width:.13,height:.04},
    [[.435,.15],[.565,.15],[.565,.19],[.435,.19]]),
  region("back","upper-back","上背部","midline",{x:.33,y:.18,width:.34,height:.17},
    [[.34,.18],[.66,.18],[.64,.35],[.36,.35]]),
  region("back","lower-back","腰背部","midline",{x:.33,y:.35,width:.34,height:.17},
    [[.36,.35],[.64,.35],[.67,.50],[.50,.52],[.33,.50]]),
  region("back","left-arm","左上肢","left",{x:.10,y:.18,width:.28,height:.39},
    [[.35,.18],[.24,.21],[.10,.57],[.23,.57],[.38,.27]]),
  region("back","right-arm","右上肢","right",{x:.62,y:.18,width:.28,height:.39},
    [[.65,.18],[.76,.21],[.90,.57],[.77,.57],[.62,.27]]),
  region("back","left-leg","左下肢","left",{x:.30,y:.51,width:.20,height:.475},
    [[.50,.51],[.33,.51],[.30,.985],[.50,.985]]),
  region("back","right-leg","右下肢","right",{x:.50,y:.51,width:.20,height:.475},
    [[.50,.51],[.67,.51],[.70,.985],[.50,.985]]),
]);
export const BODY_REGIONS: Readonly<Record<BodyView, readonly BodyRegion[]>> = Object.freeze({
  front: FRONT, back: BACK,
});
export function getBodyRegion(view: BodyView, id: string): BodyRegion | undefined {
  return BODY_REGIONS[view].find((item) => item.id === id);
}
