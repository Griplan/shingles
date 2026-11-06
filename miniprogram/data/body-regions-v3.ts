import { BodyRegion, BodyView, NormalizedPoint, NormalizedRect } from "../types/dermatome";

export const BODY_REGION_GEOMETRY_ID = "neutral-body-v3";
export const BODY_REGION_SET_ID = "neutral-body-v3-ui-regions-1";

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
  region("front","neck","颈部","midline",{x:.43,y:.15,width:.14,height:.05},
    [[.43,.15],[.57,.15],[.57,.20],[.43,.20]]),
  region("front","chest","胸部","midline",{x:.31,y:.19,width:.38,height:.145},
    [[.32,.19],[.68,.19],[.67,.335],[.33,.335]]),
  region("front","abdomen","腹部","midline",{x:.30,y:.335,width:.40,height:.19},
    [[.33,.335],[.67,.335],[.70,.46],[.50,.525],[.30,.46]]),
  region("front","left-arm","左上肢","left",{x:.63,y:.18,width:.33,height:.43},
    [[.68,.18],[.79,.24],[.96,.61],[.81,.61],[.63,.27]]),
  region("front","right-arm","右上肢","right",{x:.04,y:.18,width:.33,height:.43},
    [[.32,.18],[.21,.24],[.04,.61],[.19,.61],[.37,.27]]),
  region("front","left-leg","左下肢","left",{x:.50,y:.47,width:.22,height:.515},
    [[.50,.47],[.70,.47],[.72,.985],[.50,.985]]),
  region("front","right-leg","右下肢","right",{x:.28,y:.47,width:.22,height:.515},
    [[.50,.47],[.30,.47],[.28,.985],[.50,.985]]),
]);
const BACK: readonly BodyRegion[] = Object.freeze([
  region("back","head","头部","midline",{x:.37,y:.025,width:.26,height:.135},
    [[.37,.025],[.63,.025],[.63,.16],[.37,.16]]),
  region("back","neck","颈部","midline",{x:.43,y:.15,width:.14,height:.05},
    [[.43,.15],[.57,.15],[.57,.20],[.43,.20]]),
  region("back","upper-back","上背部","midline",{x:.31,y:.19,width:.38,height:.17},
    [[.32,.19],[.68,.19],[.67,.36],[.33,.36]]),
  region("back","lower-back","腰背部","midline",{x:.30,y:.36,width:.40,height:.165},
    [[.33,.36],[.67,.36],[.70,.46],[.50,.525],[.30,.46]]),
  region("back","left-arm","左上肢","left",{x:.04,y:.18,width:.33,height:.43},
    [[.32,.18],[.21,.24],[.04,.61],[.19,.61],[.37,.27]]),
  region("back","right-arm","右上肢","right",{x:.63,y:.18,width:.33,height:.43},
    [[.68,.18],[.79,.24],[.96,.61],[.81,.61],[.63,.27]]),
  region("back","left-leg","左下肢","left",{x:.28,y:.47,width:.22,height:.515},
    [[.50,.47],[.30,.47],[.28,.985],[.50,.985]]),
  region("back","right-leg","右下肢","right",{x:.50,y:.47,width:.22,height:.515},
    [[.50,.47],[.70,.47],[.72,.985],[.50,.985]]),
]);
export const BODY_REGIONS: Readonly<Record<BodyView, readonly BodyRegion[]>> = Object.freeze({
  front: FRONT, back: BACK,
});
export function getBodyRegion(view: BodyView, id: string): BodyRegion | undefined {
  return BODY_REGIONS[view].find((item) => item.id === id);
}
