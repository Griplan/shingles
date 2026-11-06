/** Photo coordinates. Never pass these to V2 or /evaluate. */
export const PHOTO_SPACE="photo_oriented_normalized_v1" as const;
export interface PhotoPoint {x:number;y:number;label:0|1}
export interface PhotoBox {xMin:number;yMin:number;xMax:number;yMax:number}
export interface PhotoPrompts {coordinate_space:typeof PHOTO_SPACE;points:PhotoPoint[];box:PhotoBox|null;additional_boxes?:PhotoBox[]}
export interface BrushStroke {mode:"add"|"erase";radius:number;points:{x:number;y:number}[]}
export type InferenceStrategy="context_crop"|"full_image";
export interface PhotoSession {session_id:string;session_token:string;photo_id:string;expires_at:number;
 image:{width:number;height:number;oriented_rgb_sha256:string;[key:string]:unknown};localPhoto:string}
export interface PhotoCandidate {candidate_id:string;status:string;area_ratio:number;outside_box_ratio:number|null;
 component_count:number;hole_count:number;warnings:string[];display_priority?:number;edit_revision?:number;quality?:Record<string,unknown>}
export interface EditedCandidate {session_id:string;photo_id:string;result_id:string;prompt_revision:number;coordinate_space:typeof PHOTO_SPACE;candidate:PhotoCandidate}
export interface PhotoResult {session_id:string;photo_id:string;result_id:string;request_id:string;prompt_revision:number;
 coordinate_space:typeof PHOTO_SPACE;status:string;candidates:PhotoCandidate[];expires_at:number}
export interface ConfirmedPhoto {schema_version:"confirmed-photo-segmentation-v1";session_id:string;photo_id:string;
 result_id:string;candidate_id:string;prompt_revision:number;coordinate_space:typeof PHOTO_SPACE;confirmed_by_user:true;
 confirmed_at:number;expires_at:number;image:PhotoSession["image"];model:Record<string,unknown>;prompts:PhotoPrompts;
 geometry:{type:"MultiPolygon";coordinates:number[][][][]};mask_asset:string;mask_sha256:string;correction?:{edit_revision:number;stroke_count:number;[key:string]:unknown}|null}
export interface PhotoTransport {
 open(path:string):Promise<PhotoSession>;
 segment(session:PhotoSession,prompts:PhotoPrompts,revision:number,requestId:string,strategy?:InferenceStrategy):Promise<PhotoResult>;
 asset(session:PhotoSession,candidateId:string,resultId:string,editRevision?:number):Promise<string>;
 edit(session:PhotoSession,result:PhotoResult,candidateId:string,editRevision:number,strokes:BrushStroke[]):Promise<EditedCandidate>;
 confirm(session:PhotoSession,result:PhotoResult,candidateId:string,editRevision?:number):Promise<ConfirmedPhoto>;
 remove(session:PhotoSession):Promise<void>;
 forget(path:string):void;
}
