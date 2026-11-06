import { BodyVisual, BodyView, PathCommand } from "../../types/dermatome";
import { FRONT_OUTLINE, BACK_OUTLINE } from "./commons-cc0/geometry.generated";

export const GEOMETRY_ID="commons-blank-cc0-v1";
const palette=Object.freeze({edge:"#252525",light:"#f9f4ee",skin:"#f9f4ee",shade:"#e6ddd2"});
const empty:readonly (readonly PathCommand[])[]=Object.freeze([]);
function visual(view:BodyView,outline:readonly PathCommand[]):BodyVisual {
  return Object.freeze({id:"commons-blank-"+view+"-png1",sourcePath:"/assets/body/commons-cc0/"+view+".svg",
    imagePath:"/assets/body/commons-cc0/"+view+".png",geometryId:GEOMETRY_ID,view,
    logicalWidth:400,logicalHeight:900,outline,details:empty,shadows:empty,palette});
}
export const FRONT_VISUAL=visual("front",FRONT_OUTLINE);
export const BACK_VISUAL=visual("back",BACK_OUTLINE);
const freezePoints=<T extends Record<string,{x:number;y:number}>>(points:T):Readonly<T>=>{
  Object.values(points).forEach(p=>Object.freeze(p));return Object.freeze(points);
};
/** 工程人工配准参考，来自去标注后的原素材；不是医学皮节或精确解剖测量。 */
export const BODY_LANDMARKS=Object.freeze({
  front:freezePoints({head:{x:200,y:95},chin:{x:200,y:155},neck:{x:200,y:174},chest:{x:200,y:260},
    waist:{x:200,y:370},pelvis:{x:200,y:435},crotch:{x:200,y:481},shoulder:{x:285,y:220},
    elbow:{x:300,y:340},wrist:{x:332,y:448},fingertips:{x:344,y:505},hip:{x:248,y:465},
    knee:{x:252,y:640},ankle:{x:259,y:820},foot:{x:270,y:855}}),
  back:freezePoints({head:{x:200,y:80},occiput:{x:200,y:116},neck:{x:200,y:158},chest:{x:200,y:240},
    waist:{x:200,y:355},pelvis:{x:200,y:435},crotch:{x:200,y:477},shoulder:{x:285,y:206},
    elbow:{x:298,y:330},wrist:{x:332,y:450},fingertips:{x:343,y:505},hip:{x:250,y:465},
    knee:{x:251,y:635},ankle:{x:249,y:820},foot:{x:254,y:854}}),
});
