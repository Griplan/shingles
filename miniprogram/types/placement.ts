import { AnnotationBasis } from "./annotation";
import { BodyView, NormalizedPoint, NormalizedRect } from "./dermatome";
import { PHOTO_SPACE } from "./ai";

export const BODY_SPACE = "body_template_normalized_v1" as const;
export type PlacementRing = readonly NormalizedPoint[];
export type PlacementPolygon = readonly PlacementRing[];
/** Each polygon is [outer, ...holes]; rings explicitly repeat the first point. */
export interface BodyMultiPolygon {
  readonly type: "MultiPolygon";
  readonly coordinateSpace: typeof BODY_SPACE;
  readonly coordinates: readonly PlacementPolygon[];
}
/** Cached immutable photo geometry; center/bounds use oriented original image pixels. */
export interface PreparedPhotoGeometry {
  readonly coordinateSpace: typeof PHOTO_SPACE;
  readonly width: number;
  readonly height: number;
  readonly center: NormalizedPoint;
  readonly bounds: NormalizedRect;
  readonly polygons: readonly PlacementPolygon[];
  readonly vertexCount: number;
}
/** Similarity transform in original-photo pixel -> body logical units. */
export interface PlacementTransform {
  readonly target: AnnotationBasis & { readonly view: BodyView };
  readonly translation: NormalizedPoint;
  /** Original-image pixel center; never body coordinates. */
  readonly photoCenter: NormalizedPoint;
  readonly baseScale: number;
  readonly scale: number;
  readonly rotationDegrees: number;
}
export type PlacementValidation = { readonly ok: true } |
  { readonly ok: false; readonly code: string; readonly message: string };
