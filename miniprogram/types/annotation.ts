import { BodyView, SurfaceView, NormalizedPoint } from "./dermatome";
import type { ConfirmedPhoto } from "./ai";
import type { BodyMultiPolygon, PlacementTransform } from "./placement";

export interface AnnotationBasis {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly geometryId: string;
  readonly regionSetId: string;
}
export interface NavigationContext { readonly entryRegionId: string | null }
export interface AnnotationDraft<V extends SurfaceView = BodyView> {
  readonly id: string;
  readonly view: V;
  readonly vertices: readonly NormalizedPoint[];
  readonly navigation: NavigationContext;
}
export interface CompletedPolygon<V extends SurfaceView = BodyView> {
  readonly id: string;
  readonly view: V;
  /** 显式闭环：末项重复首项；草稿则不重复。 */
  readonly ring: readonly NormalizedPoint[];
  /** 可选完整几何；存在时ring仅保留旧读取器的首外环，不得用于绘制/计算替代完整形状。 */
  readonly geometry?: BodyMultiPolygon;
  readonly source?: {readonly kind:"manual"} | {
    readonly kind:"ai_assisted";
    readonly placementId:string;
    /** 原始照片分割及其Mask引用，引用受原expires_at约束，不是永久照片存储。 */
    readonly photo:ConfirmedPhoto;
    readonly transform:PlacementTransform;
  };
  readonly navigation: NavigationContext;
}
export interface AnnotationViewState<V extends SurfaceView = BodyView> {
  readonly completed: readonly CompletedPolygon<V>[];
  readonly draft: AnnotationDraft<V> | null;
  readonly selectedId: string | null;
  readonly focusRegionId: string | null;
}
export interface AnnotationSession {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly basis: AnnotationBasis;
  readonly currentView: BodyView;
  readonly phase: "editing" | "review";
  readonly revision: number;
  readonly views: { readonly front: AnnotationViewState; readonly back: AnnotationViewState };
}
export interface AnnotationToken<V extends SurfaceView = BodyView> {
  readonly sessionId: string;
  readonly revision: number;
  readonly view: V;
  readonly basis: AnnotationBasis;
}
export interface AnnotationPointEvent extends AnnotationToken {
  readonly status: "valid" | "outside-body" | "outside-model" | "unavailable";
  readonly normalized: NormalizedPoint | null;
}
export interface AnnotationLayer<V extends SurfaceView = BodyView> extends AnnotationToken<V> {
  /** 展示参数，不写入标注会话或请求；结果叠加时只保留人工边界。 */
  readonly fillMode?: "filled" | "outline";
  readonly completed: readonly CompletedPolygon<V>[];
  readonly draft: AnnotationDraft<V> | null;
  readonly selectedId: string | null;
}
