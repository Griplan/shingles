import { BodyModelConfig, BodyRegion, CanvasPoint, DebugPoint, PathCommand, ViewportTransform } from "../../types/dermatome";
import { projectDebugPoint } from "../../utils/body-debug";
import { AnnotationLayer } from "../../types/annotation";
import { drawLesions } from "./lesion-render";
import { AtlasLayer } from "../../types/atlas";
import { drawAtlas } from "./atlas-render";

export type BodyContext = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
function trace(ctx: BodyContext, commands: readonly PathCommand[]): void {
  ctx.beginPath();
  commands.forEach((c) => {
    switch (c[0]) {
      case "M": ctx.moveTo(c[1], c[2]); break;
      case "L": ctx.lineTo(c[1], c[2]); break;
      case "C": ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); break;
      case "Q": ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]); break;
      case "Z": ctx.closePath(); break;
    }
  });
}

/** 绘制本地PNG或历史路径，调用方预先设置DPR；新素材缺失时不回退旧人体。 */
export function drawBody(
  ctx: BodyContext, viewport: ViewportTransform, model: BodyModelConfig, selected?: BodyRegion,
  debugPoint: DebugPoint | null = null,
  image: WechatMiniprogram.Image | null = null,
  annotation: AnnotationLayer | null = null,
  atlas: AtlasLayer | null = null,
  atlasOpacity?: ReadonlyMap<string,number>,
): CanvasPoint | null {
  const {visual,view}=model;
  ctx.clearRect(0, 0, viewport.viewportWidth, viewport.viewportHeight);
  ctx.fillStyle = "#faf8f4";
  ctx.fillRect(0, 0, viewport.viewportWidth, viewport.viewportHeight);
  ctx.save();
  try {
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.scale, viewport.scale);
    if (visual.imagePath) {
      if (!image) throw new Error("人体本地素材尚未加载");
      ctx.drawImage(image, 0, 0, model.logicalWidth, model.logicalHeight);
    } else {
      const gradient = ctx.createLinearGradient(125, 0, 280, 0);
      gradient.addColorStop(0, visual.palette.skin);
      gradient.addColorStop(.45, visual.palette.light);
      gradient.addColorStop(1, visual.palette.skin);
      trace(ctx, visual.outline);
      ctx.fillStyle = gradient; ctx.fill();
      ctx.strokeStyle = visual.palette.edge; ctx.lineWidth = 1.1 / viewport.scale;
      ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    }
    // 背景 → 人体/阴影 → V1粗选区 → 细节，病灶与调试在恢复CSS空间后绘制。
    ctx.save();
    try {
      trace(ctx, visual.outline); ctx.clip();
      ctx.fillStyle=visual.palette.shade; ctx.globalAlpha=.18;
      visual.shadows.forEach(path=>{trace(ctx,path);ctx.fill();});
      ctx.globalAlpha=1;
      if (selected && selected.view === view && model.regions.includes(selected)) {
        ctx.beginPath();
        selected.outline.forEach((point, index) => {
          const x = point.x * model.logicalWidth, y = point.y * model.logicalHeight;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(28,122,103,0.20)"; ctx.fill();
        ctx.strokeStyle = "#267c68"; ctx.lineWidth = 1 / viewport.scale;
        ctx.setLineDash([]); ctx.lineJoin="round"; ctx.lineCap="round"; ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = visual.palette.edge;
      ctx.globalAlpha=.65; ctx.lineWidth = .7 / viewport.scale;
      visual.details.forEach((commands) => { trace(ctx, commands); ctx.stroke(); });
    } finally { ctx.restore(); }
  } finally { ctx.restore(); }
  drawAtlas(ctx,viewport,model,atlas,atlasOpacity);
  drawLesions(ctx,viewport,model,annotation);
  // 此处已恢复到CSS坐标，十字保持7 CSS px，不随放大变粗/变大。
  const marker=projectDebugPoint(debugPoint,model,viewport);
  if(marker) {
    ctx.save();
    try {
      ctx.setLineDash([]); ctx.lineCap="round"; ctx.beginPath();
      ctx.moveTo(marker.x-7,marker.y);ctx.lineTo(marker.x+7,marker.y);
      ctx.moveTo(marker.x,marker.y-7);ctx.lineTo(marker.x,marker.y+7);
      ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.stroke();
      ctx.strokeStyle="#bc4a35";ctx.lineWidth=1.5;ctx.stroke();
    } finally {ctx.restore();}
  }
  return marker;
}
