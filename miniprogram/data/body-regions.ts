import { BodyRegion, BodyView, NormalizedPoint } from "../types/dermatome";

export const BODY_REGION_GEOMETRY_ID = "commons-blank-cc0-hands-v2";
export const BODY_REGION_SET_ID = "commons-blank-cc0-v1-ui-regions-2";
type Vertex = readonly [number, number];

/** 编辑值是原素材400×900逻辑单位；在初始化时一次归一化，绘制与命中共用outline。 */
function region(view:BodyView,key:string,name:string,side:BodyRegion["side"],points:readonly Vertex[]):BodyRegion {
  const vertices=points.filter((p,i)=>i===0||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
  if(vertices.length>1 && vertices[0][0]===vertices[vertices.length-1][0] &&
    vertices[0][1]===vertices[vertices.length-1][1])vertices.pop();
  const outline:readonly NormalizedPoint[]=Object.freeze(vertices.map(([x,y])=>Object.freeze({x:x/400,y:y/900})));
  // bounds只作focus及快速预筛，不作为最终命中或填色。留白可包含邻近部位。
  const xs=outline.map(p=>p.x),ys=outline.map(p=>p.y);
  const x=Math.max(0,Math.min(...xs)-.015),y=Math.max(0,Math.min(...ys)-.012);
  const bounds=Object.freeze({x,y,width:Math.min(1,Math.max(...xs)+.015)-x,
    height:Math.min(1,Math.max(...ys)+.012)-y});
  return Object.freeze({id:view+"-"+key,view,name,side,bounds,outline});
}
const reversed=(points:readonly Vertex[]):Vertex[]=>[...points].reverse();

// 同一边界数组由两个相邻区域反向复用。肩外侧归上肢；不是医学神经支配界线。
const FRONT_NECK_BASE:readonly Vertex[]=[[168,180],[184,191],[200,194],[216,191],[234,180]];
const FRONT_RIGHT_SEAM:readonly Vertex[]=[[128,180],[140,203],[137,226],[128,248],[134,261],[134,294],[132,315]];
const FRONT_LEFT_SEAM:readonly Vertex[]=[[270,180],[260,202],[262,226],[272,247],[265,262],[266,294],[268,315]];
const FRONT_WAIST:readonly Vertex[]=[[132,315],[268,315]];
const FRONT_RIGHT_FLANK:readonly Vertex[]=[[132,315],[130,375],[116,423],[110,450]];
const FRONT_LEFT_FLANK:readonly Vertex[]=[[268,315],[270,375],[284,423],[290,450]];
const FRONT_PELVIS:readonly Vertex[]=[[110,450],[200,450],[290,450]];
const FRONT:readonly BodyRegion[]=Object.freeze([
  region("front","head","头部","midline",[[144,22.5],[256,22.5],[256,162],[144,162]]),
  region("front","neck","颈部","midline",[[144,162],[256,162],...reversed(FRONT_NECK_BASE)]),
  region("front","chest","胸部","midline",[[144,162],...FRONT_NECK_BASE,[256,162],...FRONT_LEFT_SEAM,
    ...reversed(FRONT_WAIST),...reversed(FRONT_RIGHT_SEAM)]),
  region("front","abdomen","腹部","midline",[...FRONT_WAIST,...FRONT_LEFT_FLANK,...reversed(FRONT_PELVIS),...reversed(FRONT_RIGHT_FLANK)]),
  region("front","left-arm","左上肢","left",[...FRONT_LEFT_SEAM,...FRONT_LEFT_FLANK,
    [300,531],[388,531],[388,450],[336,300],[340,180]]),
  region("front","right-arm","右上肢","right",[...FRONT_RIGHT_SEAM,...FRONT_RIGHT_FLANK,
    [100,531],[12,531],[12,450],[64,300],[60,180]]),
  region("front","left-leg","左下肢","left",[[200,450],[290,450],[288,540],[290,700],[310,886],[200,886]]),
  region("front","right-leg","右下肢","right",[[200,450],[110,450],[112,540],[110,700],[90,886],[200,886]]),
]);
// 背面独立配准：肩胛/腋线更高，不能复制正面胸廓。
const BACK_NECK_BASE:readonly Vertex[]=[[168,153],[184,169],[200,173],[216,169],[232,153]];
const BACK_LEFT_SEAM:readonly Vertex[]=[[122,156],[129,181],[127,198],[116,211],[120,230],[126,248],[130,272],[130,320]];
const BACK_RIGHT_SEAM:readonly Vertex[]=[[273,160],[265,183],[265,205],[280,220],[278,236],[274,253],[270,278],[272,320]];
const BACK_WAIST:readonly Vertex[]=[[130,320],[272,320]];
const BACK_LEFT_FLANK:readonly Vertex[]=[[130,320],[128,360],[116,423],[110,450]];
const BACK_RIGHT_FLANK:readonly Vertex[]=[[272,320],[272,360],[284,423],[290,450]];
const BACK_PELVIS:readonly Vertex[]=[[110,450],[200,450],[290,450]];
const BACK:readonly BodyRegion[]=Object.freeze([
  region("back","head","头部","midline",[[140,22.5],[256,22.5],[256,130],[140,130]]),
  region("back","neck","颈部","midline",[[140,130],[256,130],...reversed(BACK_NECK_BASE)]),
  region("back","upper-back","上背部","midline",[[140,130],...BACK_NECK_BASE,[256,130],...BACK_RIGHT_SEAM,
    ...reversed(BACK_WAIST),...reversed(BACK_LEFT_SEAM)]),
  region("back","lower-back","腰背部","midline",[...BACK_WAIST,...BACK_RIGHT_FLANK,...reversed(BACK_PELVIS),...reversed(BACK_LEFT_FLANK)]),
  region("back","left-arm","左上肢","left",[...BACK_LEFT_SEAM,...BACK_LEFT_FLANK,
    [100,531],[12,531],[12,440],[60,290],[60,156]]),
  region("back","right-arm","右上肢","right",[...BACK_RIGHT_SEAM,...BACK_RIGHT_FLANK,
    [300,531],[388,531],[388,440],[340,290],[340,160]]),
  region("back","left-leg","左下肢","left",[[200,450],[110,450],[112,540],[110,700],[90,886],[200,886]]),
  region("back","right-leg","右下肢","right",[[200,450],[290,450],[288,540],[290,700],[310,886],[200,886]]),
]);
export const BODY_REGIONS:Readonly<Record<BodyView,readonly BodyRegion[]>>=Object.freeze({front:FRONT,back:BACK});
export function getBodyRegion(view:BodyView,id:string):BodyRegion|undefined {
  return BODY_REGIONS[view].find(item=>item.id===id);
}
