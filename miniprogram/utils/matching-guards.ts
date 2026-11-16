import {AtlasRegion} from "../types/atlas";
import {SurfaceView} from "../types/dermatome";
import {EvaluateRequest,EvaluateResponse,MatchingIdentity} from "../types/evaluate";

export function identityEqual(a:MatchingIdentity,b:MatchingIdentity):boolean {
 return !!a && Object.keys(b).every(k=>a[k as keyof MatchingIdentity]===b[k as keyof MatchingIdentity]);
}

const validNumber=(n:unknown):n is number=>typeof n==="number" && Number.isFinite(n) && n>=0;
function requireValue(ok:unknown):asserts ok {if(!ok)throw new Error("响应数据或图谱身份不一致，已阻止结果叠加，请更新或重试");}

export function checkedResponse<V extends SurfaceView>(
 raw:unknown,
 request:EvaluateRequest<V>,
 regions:readonly AtlasRegion<V>[],
):EvaluateResponse<V> {
 requireValue(raw && typeof raw==="object");const r=raw as EvaluateResponse<V>;
 requireValue(r.request_id===request.request_id && r.annotation_revision===request.annotation_revision && identityEqual(r.identity,request.identity));
 requireValue(r.method==="manual_annotation_reference_geometry" && r.area_unit==="normalized_template_area" &&
  r.source?.preview===true && r.source.medical_review_status==="pending" && typeof r.source.attribution==="string" &&
  typeof r.source.coverage_note==="string" && Array.isArray(r.warnings) && r.warnings.every(w=>typeof w==="string"));
 if(request.identity.atlas_id==="axilla-schematic-v1"||request.identity.atlas_id==="perineum-schematic-v1")requireValue(r.source.atlas_type==="SCHEMATIC"&&r.source.review_status==="NOT_MEDICALLY_VALIDATED"&&r.source.intended_use==="INTERACTIVE_SIMULATION"&&r.source.source_type==="ARTIFICIALLY_CONSTRUCTED"&&typeof r.source.disclaimer==="string"&&r.source.disclaimer.length>0);
 if(request.identity.atlas_id==="axilla-goran-provisional-v1")requireValue(r.source.atlas_status==="PROVISIONAL"&&r.source.uncertainty_level==="HIGH");
 requireValue(Array.isArray(r.lesions) && r.lesions.length===request.lesions.length && Array.isArray(r.views));
 const expectedViews=[...new Set(request.lesions.map(l=>l.view))].sort();
 requireValue(r.views.map(v=>v.view).sort().join()===expectedViews.join());
 const seen=new Set<string>();
 for(const c of [...r.lesions,...r.views]) {
  requireValue((["front","back","sole-left","sole-right","axilla-left","axilla-right","perineum-overview"].includes(c.view) && expectedViews.includes(c.view)) && Array.isArray(c.lesion_ids) && c.lesion_ids.length && new Set(c.lesion_ids).size===c.lesion_ids.length);
  requireValue(c.lesion_ids.every((id:string)=>request.lesions.some(l=>l.id===id && l.view===c.view)));
  requireValue(validNumber(c.annotation_area) && c.annotation_area>0 && validNumber(c.covered_area) && validNumber(c.uncovered_area) &&
   validNumber(c.covered_ratio) && c.covered_ratio<=1+1e-12 && validNumber(c.uncovered_ratio) && c.uncovered_ratio<=1+1e-12 &&
   Math.abs(c.covered_ratio+c.uncovered_ratio-1)<1e-9 && ["full","partial","none"].includes(c.coverage_status));
  requireValue(Array.isArray(c.candidates));const ids=new Set<string>(),keys=new Set<string>();
  for(const m of c.candidates) {
   requireValue(typeof m.candidate_id==="string" && !ids.has(m.candidate_id));ids.add(m.candidate_id);
   const key=JSON.stringify([m.partition_type,m.label,m.side,m.view]);requireValue(!keys.has(key));keys.add(key);
   requireValue(m.view===c.view && typeof m.display_name==="string" && validNumber(m.intersection_area) && m.intersection_area>0 &&
    validNumber(m.lesion_coverage_ratio) && m.lesion_coverage_ratio>0 && m.lesion_coverage_ratio<=1+1e-12 && Array.isArray(m.region_ids) && m.region_ids.length);
   const actual=regions.filter(a=>a.view===m.view && a.side===m.side && a.partitionType===m.partition_type && a.labelId===m.label).map(a=>a.id).sort();
   requireValue(actual.length && JSON.stringify([...m.region_ids].sort())===JSON.stringify(actual));
  }
 }
 for(const c of r.lesions){requireValue(c.lesion_ids.length===1 && !seen.has(c.lesion_ids[0]));seen.add(c.lesion_ids[0]);}
 for(const c of r.views)requireValue(JSON.stringify([...c.lesion_ids].sort())===JSON.stringify(request.lesions.filter(l=>l.view===c.view).map(l=>l.id).sort()));
 return Object.freeze(JSON.parse(JSON.stringify(r)) as EvaluateResponse<V>);
}
