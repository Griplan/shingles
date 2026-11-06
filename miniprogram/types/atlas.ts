import { BodyView, SurfaceView, NormalizedPoint, NormalizedRect } from "./dermatome";
/** 显式闭环；每个polygon[0]外环，其后为孔洞，方向与外环相反。 */
export interface AtlasGeometry { readonly type:"MultiPolygon"; readonly coordinates:readonly (readonly (readonly (readonly [number,number])[])[])[] }
export interface AtlasRegion<V extends SurfaceView = BodyView> {
 readonly id:string;
 /** Optional per-instance provenance for independent local surfaces. geometry is polygonGeometry. */
 readonly viewId?:V; readonly atlasId?:string; readonly regionSetId?:string;
 readonly dermatomeLabel?:string; readonly sourceFile?:string; readonly sourceElementId?:string;
 readonly sourceSVGId?:string|null; readonly sourcePathSHA256?:string; readonly sourceLicense?:string;
 readonly registrationMethod?:string; readonly atlasType?:"SCHEMATIC";readonly intendedUse?:string;readonly sourceType?:string;readonly atlasStatus?:"PROVISIONAL"; readonly uncertaintyLevel?:string; readonly reviewStatus?:string; readonly derivationClass?:string; readonly sourcePathId?:string|null; readonly polygonGeometry?:AtlasGeometry;
 readonly atlasVersion:string;
 readonly templateId:string;
 readonly templateVersion:string;
 readonly geometryId:string;
 readonly partitionType:"schematic_region"|"spinal_dermatome"|"spinal_dermatome_composite"|"trigeminal_sensory";
 readonly labelId:string;
 /** 可选以兼容上一版实例；三叉分支在列表显示完整名称。 */
 readonly displayName?:string;
 readonly sourceLabel:string;
 readonly view:V;
 readonly side:"left"|"right"|"unspecified";
 readonly color:string;
 readonly geometry:AtlasGeometry;
 readonly labelPoint:NormalizedPoint;
 readonly sourceRefs:readonly string[];
 readonly sourcePathIndices:readonly number[];
 readonly registrationRefs?:readonly string[];
 readonly productionStatus:"registered_development_preview";
 readonly medicalReviewStatus:"pending";
 readonly derivation:string;
}
export interface AtlasManifest {
 readonly atlasVersion:string;
 readonly inheritedParentVersion?:string;
 readonly templateId:string;
 readonly templateVersion:string;
 readonly geometryId:string;
 readonly sourceLicenseStatus:"verified";
 readonly technicalValidationStatus:string;
 readonly medicalReviewStatus:"pending";
 readonly mappingEnabled:false;
 readonly sourceTitle:string;
 readonly sourceUrl:string;
 readonly attribution:string;
 readonly coverageNote:string;
 readonly contentSHA256:string;
}
export interface AtlasLayer<V extends SurfaceView = BodyView> {
 readonly atlasVersion:string;
 readonly templateId:string;
 readonly templateVersion:string;
 readonly geometryId:string;
 readonly view:V;
 readonly regions:readonly AtlasRegion<V>[];
 readonly showLabels:boolean;
}
export type AtlasSideFilter="both"|"left"|"right";
export type AtlasDisplayMode="all"|"single"|"hidden";
export type AtlasGroupFilter="all"|"trigeminal"|"spinal";
export type AtlasLocalFocus="face"|"left-foot"|"right-foot";
export type AtlasFocusBounds=NormalizedRect;
