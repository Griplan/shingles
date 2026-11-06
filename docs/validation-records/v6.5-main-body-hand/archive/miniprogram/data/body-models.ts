import { BodyModelConfig, BodyView, BodyVisual } from "../types/dermatome";
import { FRONT_VISUAL, BACK_VISUAL, GEOMETRY_ID } from "../assets/body/commons-v1";
import { BODY_REGIONS, BODY_REGION_GEOMETRY_ID, BODY_REGION_SET_ID } from "./body-regions";
import { flattenOutline } from "../utils/body-path";

/** 同尺寸也不能视为几何兼容；资源、区域须显式绑定同一几何版本。 */
export function validateBodyModel(model: BodyModelConfig): void {
  const visual=model.visual;
  if (!model.id || !model.version || !model.regionSetId || !model.geometryId ||
      model.geometryId!==visual.geometryId || model.geometryId!==model.regionGeometryId ||
      model.view!==visual.view || model.logicalWidth!==visual.logicalWidth ||
      model.logicalHeight!==visual.logicalHeight ||
      ![model.logicalWidth,model.logicalHeight].every(n=>Number.isFinite(n)&&n>0)) {
    throw new RangeError("人体模板、资源和区域绑定不一致");
  }
  if(visual.imagePath && !/^\/assets\/body\/[^?]+\.png$/.test(visual.imagePath)) {
    throw new RangeError("人体图片必须为本地PNG资源");
  }
  const ids=new Set<string>();
  for(const r of model.regions) {
    const b=r.bounds;
    if(ids.has(r.id)||r.view!==model.view||
      ![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<=0||b.height<=0||
      b.x+b.width>1||b.y+b.height>1||r.outline.some(p=>![p.x,p.y].every(Number.isFinite)||p.x<0||p.x>1||p.y<0||p.y>1)) {
      throw new RangeError("人体区域不符合模板");
    }
    ids.add(r.id);
  }
  if(model.hitOutline.length<3 || model.hitOutline.some(p=>
    ![p.x,p.y].every(Number.isFinite)||p.x<0||p.y<0||p.x>model.logicalWidth||p.y>model.logicalHeight)) {
    throw new RangeError("人体轮廓超出逻辑画布");
  }
}
function model(view: BodyView): BodyModelConfig {
  const visual=view==="front"?FRONT_VISUAL:BACK_VISUAL;
  const config: BodyModelConfig = Object.freeze({
    id:"commons-neutral-v1",version:"4.0.0",geometryId:GEOMETRY_ID,view,
    logicalWidth:400,logicalHeight:900,visual,
    regionSetId:BODY_REGION_SET_ID,regionGeometryId:BODY_REGION_GEOMETRY_ID,regions:BODY_REGIONS[view],
    hitOutline:flattenOutline(visual.outline),
  });
  validateBodyModel(config); return config;
}
export const BODY_MODELS: Readonly<Record<BodyView,BodyModelConfig>> = Object.freeze({front:model("front"),back:model("back")});
export const getBodyModel = (view: BodyView): BodyModelConfig => BODY_MODELS[view];

/** 仅更换绘制风格时复用坐标。形状不同必须创建新模板，不静默迁移。 */
export function withBodyVisual(model:BodyModelConfig,visual:BodyVisual):BodyModelConfig {
  if(JSON.stringify(visual.outline)!==JSON.stringify(model.visual.outline)) {
    throw new RangeError("几何变化需要新模板版本和重新适配区域");
  }
  const next=Object.freeze(Object.assign({},model,{visual}));validateBodyModel(next);return next;
}
