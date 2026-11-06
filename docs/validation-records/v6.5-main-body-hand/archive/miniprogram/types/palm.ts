// Shared local-surface contracts; legacy Palm* names preserved for existing consumers.
import {LogicalModel,LocalSurfaceView} from "./dermatome";
import {AnnotationBasis,AnnotationToken,AnnotationViewState,CompletedPolygon} from "./annotation";
import {AtlasRegion} from "./atlas";
import {MatchingIdentity} from "./evaluate";
import {BodyGeometry} from "../utils/annotation-geometry";
export {PalmView,LocalSurfaceView} from "./dermatome";
export interface PalmModel extends LogicalModel {
 readonly name:string;readonly view:LocalSurfaceView;readonly version:string;readonly geometryId:string;readonly regionSetId:string;
 readonly imagePath:string;readonly sourcePath:string;readonly body:BodyGeometry;
 readonly resource:{readonly title:string;readonly url:string;readonly author:string;readonly license:string;readonly attribution:string};
 readonly atlas:{readonly identity:MatchingIdentity;readonly regions:readonly AtlasRegion<LocalSurfaceView>[];
  readonly technicalReady:boolean;readonly blockedReason:string;readonly sourceTitle:string;readonly sourceUrl:string;
  readonly attribution:string;readonly medicalReviewStatus:"pending";readonly coverageNote:string};
}
export interface PalmAnnotation extends CompletedPolygon<LocalSurfaceView> {
 readonly basis:AnnotationBasis;readonly atlasIdentity:MatchingIdentity;readonly source:{readonly kind:"manual"};
}
export interface PalmSession {
 readonly schemaVersion:1;readonly sessionId:string;readonly view:LocalSurfaceView;readonly basis:AnnotationBasis;
 readonly atlasIdentity:MatchingIdentity;readonly phase:"editing"|"review";readonly revision:number;
 readonly state:Omit<AnnotationViewState<LocalSurfaceView>,"completed">&{readonly completed:readonly PalmAnnotation[]};
}
export interface PalmToken extends AnnotationToken<LocalSurfaceView> {readonly atlasIdentity:MatchingIdentity}
export type PalmResult={readonly ok:true;readonly session:PalmSession}|{readonly ok:false;readonly message:string};
