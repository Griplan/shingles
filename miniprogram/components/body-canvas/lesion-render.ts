import { AnnotationLayer } from "../../types/annotation";
import { BodyModelConfig, SurfaceView, NormalizedPoint, ViewportTransform } from "../../types/dermatome";
import { normalizedToCanvas } from "../../utils/coordinate";
import { modelBasis, sameBasis } from "../../state/annotation-session";
import type { BodyContext } from "./render";

/** 已恢复到CSS空间；同一个实际viewport，线宽/顶点大小不随聚焦或DPR增长。 */
export function drawLesions<V extends SurfaceView>(ctx:BodyContext,viewport:ViewportTransform,model:Pick<BodyModelConfig,"id"|"version"|"geometryId"|"regionSetId"> & {readonly view:V},layer:AnnotationLayer<V>|null):void {
  if(!layer || layer.view!==model.view || !sameBasis(layer.basis,modelBasis(model)))return;
  const trace=(points:readonly NormalizedPoint[],closed:boolean)=>{
    points.forEach((p,i)=>{
      const q=normalizedToCanvas(p,viewport);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);
    });if(closed)ctx.closePath();
  };
  const path=(points:readonly NormalizedPoint[],closed:boolean)=>{ctx.beginPath();trace(points,closed);};
  const signedArea=(r:readonly NormalizedPoint[])=>{
    let sum=0;const origin=r[0];
    for(let i=1;i<r.length-1;i++)sum+=(r[i].x-origin.x)*(r[i+1].y-origin.y)-(r[i+1].x-origin.x)*(r[i].y-origin.y);
    return sum;
  };
  ctx.save();
  try {
    // 只裁切显示视口，不以人体clip掩盖无效多边形；保存前已验证整片包含。
    ctx.beginPath();ctx.rect(0,0,viewport.viewportWidth,viewport.viewportHeight);ctx.clip();
    ctx.lineJoin="round";ctx.lineCap="round";ctx.setLineDash([]);
    const polygons=layer.completed.filter(p=>p.view===model.view);
    for(const p of polygons) {
      const selected=p.id===layer.selectedId;
      for(const polygon of p.geometry?.coordinates || [[p.ring]]) {
        ctx.beginPath();
        // Default nonzero fill is supported by Canvas 2D; opposite winding preserves holes.
        const sign=signedArea(polygon[0]);
        polygon.forEach((ring,i)=>trace(i && signedArea(ring)*sign>0?[...ring].reverse():ring,true));
        if(layer.fillMode!=="outline") {
          ctx.fillStyle=selected?"rgba(182,78,48,0.32)":"rgba(182,78,48,0.26)";ctx.fill();
        }
        ctx.strokeStyle=selected?"#76351f":"#ac5239";ctx.lineWidth=selected?2.2:1.6;ctx.stroke();
      }
    }
    if(layer.draft?.view===model.view) {
      const vertices=layer.draft.vertices;
      path(vertices,false);ctx.strokeStyle="#216c61";ctx.lineWidth=1.6;ctx.stroke();
      vertices.forEach((p,i)=>{
        const q=normalizedToCanvas(p,viewport);ctx.beginPath();ctx.arc(q.x,q.y,3.2,0,2*Math.PI);
        ctx.fillStyle=i===0?"#216c61":"#ffffff";ctx.fill();ctx.strokeStyle="#216c61";ctx.lineWidth=1.3;ctx.stroke();
      });
    }
  } finally {ctx.restore();}
}
