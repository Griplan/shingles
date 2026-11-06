import { BodyModelConfig, BodyRegionHit, NormalizedPoint } from "../types/dermatome";
import { HIT_EDGE_TOLERANCE, pointInOutline } from "./body-path";

/** 只命中已有UI多边形。与人体同用逻辑单位边缘容差，不吸附、不按顺序抢占。 */
export function hitTestRegion(point: NormalizedPoint, model: BodyModelConfig): BodyRegionHit {
  const logical = { x: point.x * model.logicalWidth, y: point.y * model.logicalHeight };
  if (![point.x, point.y].every(Number.isFinite) || point.x < 0 || point.x > 1 ||
      point.y < 0 || point.y > 1 || !pointInOutline(logical, model.hitOutline)) {
    return { status: "outside-body", regionIds: [] };
  }
  const dx = HIT_EDGE_TOLERANCE / model.logicalWidth;
  const dy = HIT_EDGE_TOLERANCE / model.logicalHeight;
  const regionIds = model.regions.filter(region => {
    const b = region.bounds;
    if (region.view !== model.view || point.x < b.x - dx || point.x > b.x + b.width + dx ||
        point.y < b.y - dy || point.y > b.y + b.height + dy) return false;
    return pointInOutline(logical, region.outline.map(p =>
      ({ x: p.x * model.logicalWidth, y: p.y * model.logicalHeight })));
  }).map(region => region.id).sort();
  return { status: regionIds.length === 1 ? "unique" : regionIds.length ? "ambiguous" : "unconfigured", regionIds };
}
