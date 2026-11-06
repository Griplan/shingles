// Independent local-surface contracts. Main-body hands use front/back.
import {LogicalModel,LocalSurfaceView} from "./dermatome";
import {AnnotationBasis,AnnotationToken,AnnotationViewState,CompletedPolygon} from "./annotation";
import {AtlasRegion} from "./atlas";
import {MatchingIdentity} from "./evaluate";
import {BodyGeometry} from "../utils/annotation-geometry";
export {LocalSurfaceView} from "./dermatome";
export interface LocalSurfaceModel extends LogicalModel {
 readonly name:string;readonly view:LocalSurfaceView;readonly version:string;readonly geometryId:string;readonly regionSetId:string;
 readonly imagePath:string;readonly sourcePath:string;readonly body:BodyGeometry;
 readonly resource:{readonly title:string;readonly url:string;readonly author:string;readonly license:string;readonly attribution:string};
 readonly atlas:{readonly identity:MatchingIdentity;readonly regions:readonly AtlasRegion<LocalSurfaceView>[];
  readonly atlasType?:"SCHEMATIC";readonly reviewStatus?:"NOT_MEDICALLY_VALIDATED";readonly intendedUse?:"INTERACTIVE_SIMULATION";readonly sourceType?:"ARTIFICIALLY_CONSTRUCTED";readonly atlasStatus?:"PROVISIONAL"; readonly technicalReady:boolean;readonly blockedReason:string;readonly sourceTitle:string;readonly sourceUrl:string;
  readonly attribution:string;readonly medicalReviewStatus:"pending";readonly coverageNote:string};
}
export interface LocalSurfaceAnnotation extends CompletedPolygon<LocalSurfaceView> {
 readonly basis:AnnotationBasis;readonly atlasIdentity:MatchingIdentity;readonly source:{readonly kind:"manual"};
}
export interface LocalSurfaceSession {
 readonly schemaVersion:1;readonly sessionId:string;readonly view:LocalSurfaceView;readonly basis:AnnotationBasis;
 readonly atlasIdentity:MatchingIdentity;readonly phase:"editing"|"review";readonly revision:number;
 readonly state:Omit<AnnotationViewState<LocalSurfaceView>,"completed">&{readonly completed:readonly LocalSurfaceAnnotation[]};
}
export interface LocalSurfaceToken extends AnnotationToken<LocalSurfaceView> {readonly atlasIdentity:MatchingIdentity}
export type LocalSurfaceResult={readonly ok:true;readonly session:LocalSurfaceSession}|{readonly ok:false;readonly message:string};
