import { BodyView, SurfaceView, NormalizedPoint } from "./dermatome";
import { BodyMultiPolygon } from "./placement";
export type EvaluateLesion<V extends SurfaceView = BodyView> = {readonly id:string;readonly view:V;readonly source?:"manual"|"ai_assisted"} &
 ({readonly vertices:readonly NormalizedPoint[];readonly geometry?:never}|{readonly geometry:BodyMultiPolygon;readonly vertices?:never});
export interface MatchingIdentity {
 readonly template_id:string;readonly template_version:string;readonly geometry_id:string;readonly region_set_id:string;
 readonly atlas_id:string;readonly atlas_version:string;readonly atlas_content_sha256:string;readonly body_content_sha256:string;
 readonly coordinate_system:"normalized_2d_top_left";
}
export interface EvaluateRequest<V extends SurfaceView = BodyView> {
 readonly request_id:string;readonly annotation_revision:number;readonly identity:MatchingIdentity;
 readonly lesions:readonly EvaluateLesion<V>[];
}
export interface MatchCandidate<V extends SurfaceView = BodyView> {
 readonly candidate_id:string;readonly region_ids:readonly string[];readonly partition_type:string;readonly label:string;
 readonly source_label:string;readonly display_name:string;readonly side:string;readonly view:V;
 readonly intersection_area:number;readonly lesion_coverage_ratio:number;
}
export interface MatchCoverage<V extends SurfaceView = BodyView> {
 readonly view:V;readonly lesion_ids:readonly string[];readonly annotation_area:number;
 readonly covered_area:number;readonly uncovered_area:number;readonly covered_ratio:number;readonly uncovered_ratio:number;
 readonly coverage_status:"full"|"partial"|"none";readonly candidates:readonly MatchCandidate<V>[];
}
export interface EvaluateResponse<V extends SurfaceView = BodyView> {
 readonly request_id:string;readonly annotation_revision:number;readonly identity:MatchingIdentity;
 readonly method:"manual_annotation_reference_geometry";readonly area_unit:"normalized_template_area";
 readonly source:{readonly title:string;readonly url:string;readonly attribution:string;readonly license:string;
  readonly atlas_type?:"SCHEMATIC";readonly review_status?:"NOT_MEDICALLY_VALIDATED";readonly intended_use?:"INTERACTIVE_SIMULATION";readonly source_type?:"ARTIFICIALLY_CONSTRUCTED";readonly disclaimer?:string;readonly atlas_status?:"PROVISIONAL";readonly uncertainty_level?:"HIGH";readonly medical_review_status:"pending";readonly preview:true;readonly coverage_note:string};
 readonly lesions:readonly MatchCoverage<V>[];readonly views:readonly MatchCoverage<V>[];readonly warnings:readonly string[];
}
