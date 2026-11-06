/** GET /api/v1/health 的 V0 响应。 */
export interface HealthResponse {
  status: "ok";
  project: "dermatome-mapper";
  version: "v0";
}

/** V0 未实现接口的 HTTP 501 响应，不包含医学评估结果。 */
export interface ApiError {
  error: {
    code: "NOT_IMPLEMENTED";
    message: string;
  };
}

/** V1 展示坐标，不含医学皮节/病灶语义。 */
export type BodyView = "front" | "back";
/** Local surfaces have independent template coordinates; never alias them to front/back. */
export type SoleView = "sole-left" | "sole-right";
export type AxillaView = "axilla-left" | "axilla-right";
export type LocalSurfaceView = SoleView | AxillaView;
export type SurfaceView = BodyView | LocalSurfaceView;
export interface NormalizedPoint { readonly x: number; readonly y: number }
export interface CanvasPoint { readonly x: number; readonly y: number }
export interface NormalizedRect extends NormalizedPoint {
  readonly width: number;
  readonly height: number;
}
/** 坐标工具只依赖逻辑尺寸，不知道视觉资源或区域。 */
export interface LogicalModel {
  readonly id: string;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
}
export type PathCommand =
  | readonly ["M" | "L", number, number]
  | readonly ["C", number, number, number, number, number, number]
  | readonly ["Q", number, number, number, number]
  | readonly ["Z"];
export interface BodyVisual extends LogicalModel {
  readonly sourcePath: string;
  /** 本地PNG绘制资源；SVG保留为编辑源，outline只用于同源命中与裁剪。 */
  readonly imagePath?: string;
  readonly geometryId: string;
  readonly view: BodyView;
  readonly outline: readonly PathCommand[];
  readonly details: readonly (readonly PathCommand[])[];
  readonly shadows: readonly (readonly PathCommand[])[];
  readonly palette: { readonly edge: string; readonly light: string; readonly skin: string; readonly shade: string };
}
export interface BodyModelConfig extends LogicalModel {
  readonly version: string;
  readonly geometryId: string;
  readonly view: BodyView;
  readonly visual: BodyVisual;
  readonly regionSetId: string;
  readonly regionGeometryId: string;
  readonly regions: readonly BodyRegion[];
  /** 从同一绘制曲线细分而来，不是医学区域。逻辑单位。 */
  readonly hitOutline: readonly CanvasPoint[];
}
export interface DebugPoint {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly view: BodyView;
  readonly normalized: NormalizedPoint;
}
export interface CanvasRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
export type ProbeStatus = "valid" | "outside-body" | "outside-model" | "unavailable";
export interface DebugProbe {
  readonly status: ProbeStatus;
  readonly view: BodyView;
  readonly modelId: string;
  readonly modelVersion: string;
  /** 页面可显示区域 CSS 像素（不含导航条），不是设备物理屏幕像素。 */
  readonly screen: CanvasPoint | null;
  readonly canvas: CanvasPoint | null;
  readonly normalized: NormalizedPoint | null;
}
export interface BodyRegionHit {
  readonly status: "unique" | "outside-body" | "unconfigured" | "ambiguous";
  readonly regionIds: readonly string[];
}
/** 只报告粗粒度UI选择候选；不是病灶点，不持久化。 */
export interface BodyRegionProbe {
  readonly status: BodyRegionHit["status"] | "outside-model" | "unavailable";
  readonly view: BodyView;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly regionIds: readonly string[];
}
export interface BodyViewportEvent {
  readonly view: BodyView;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly visualId: string;
  readonly viewport: ViewportTransform;
  readonly dpr: number;
  readonly physicalWidth: number;
  readonly physicalHeight: number;
  readonly markerCanvas: CanvasPoint | null;
}
export interface BodyRegion {
  readonly id: string;
  readonly view: BodyView;
  readonly name: string;
  readonly side: "left" | "right" | "midline";
  /** focusBounds：局部视野含周边留白；只可用于放大或预筛。 */
  readonly bounds: NormalizedRect;
  /** regionGeometry：高亮与最终命中共用闭合外环，末点隐式连首点；不是医学皮节。 */
  readonly outline: readonly NormalizedPoint[];
}
export interface ViewportTransform {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** 最终 CSS 像素/逻辑单位，x/y 共用。 */
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly zoom: number;
  readonly padding: number;
}
