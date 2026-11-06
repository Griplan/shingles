// Production page adapters + synthetic response identities. Native/HTTP evidence is separate.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {annotationSession:a,sessionToken}=load('state/annotation-session.js');
const {placementSession:p}=load('state/placement-session.js');
const {matchingSession:m}=load('state/matching-session.js');
const {consumePlacementView,retainPlacementView}=load('state/placement-navigation.js');
const {fitViewport,focusViewport,reframeViewport,normalizedToCanvas}=load('utils/coordinate.js');
const {getBodyModel}=load('data/body-models.js');
const {ATLAS_REGIONS}=load('data/atlas.generated.js');
const {syntheticPhoto}=require('./placement-fixtures.cjs');
let placement,annotate;global.Page=d=>placement=d;load('pages/placement/placement.js');global.Page=d=>annotate=d;load('pages/annotate/annotate.js');
const instance=def=>{const page={data:structuredClone(def.data),setData(c){Object.assign(this.data,c)},selectComponent:()=>({previewTransform(){}})};for(const[k,v]of Object.entries(def))if(typeof v==='function')page[k]=v.bind(page);return page;};
function reply(r){
 const cov=(view,ids)=>{const groups=new Map();for(const reg of ATLAS_REGIONS.filter(v=>v.view===view)){const key=[reg.partitionType,reg.labelId,reg.side].join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(reg);}
  const candidates=[...groups.entries()].slice(0,2).map(([id,regs])=>({candidate_id:id,view,partition_type:regs[0].partitionType,label:regs[0].labelId,side:regs[0].side,display_name:regs[0].labelId,intersection_area:.5,lesion_coverage_ratio:.5,region_ids:regs.map(v=>v.id)}));
  return {view,lesion_ids:ids,annotation_area:1,covered_area:1,uncovered_area:0,covered_ratio:1,uncovered_ratio:0,coverage_status:'full',candidates};};
 return {request_id:r.request_id,annotation_revision:r.annotation_revision,identity:r.identity,method:'manual_annotation_reference_geometry',area_unit:'normalized_template_area',source:{preview:true,medical_review_status:'pending',attribution:'SYNTHETIC RESPONSE',coverage_note:'not medical evidence'},warnings:[],lesions:r.lesions.map(l=>cov(l.view,[l.id])),views:[...new Set(r.lesions.map(l=>l.view))].map(v=>cov(v,r.lesions.filter(l=>l.view===v).map(l=>l.id)))};
}
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
let sequence=0;
function setup(t,editId){
 const requests=[],nav=[];
 global.wx={nextTick:f=>queueMicrotask(f),getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({platform:'devtools'}),getWindowInfo:()=>({windowHeight:844}),
  request:o=>requests.push(o),redirectTo:o=>nav.push(o.url),navigateTo:o=>nav.push(o.url),navigateBack:o=>nav.push('back'),enableAlertBeforeUnload(){},disableAlertBeforeUnload(){},showModal:o=>{o.success({confirm:true});o.complete?.();}};
 const source=syntheticPhoto(100,true);source.result_id+='-'+(++sequence);
 const r=editId?p.edit(editId):p.open(source,'back','back-upper-back',()=>true);assert.equal(r.ok,true,r.message);
 const page=instance(placement);page.onLoad({draftId:r.draft.id});page.onShow();t.after(()=>page.onUnload());
 const model=getBodyModel('back'),vp=focusViewport(fitViewport(375,500,model),model.regions.find(r=>r.id==='back-upper-back').bounds);
 page.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});page.setData({overlayReady:true});
 return {page,requests,nav,vp,source};
}
test('one confirmation, one request; retry preserves ID and all geometry; result defaults to all without another request',async t=>{
 const {page,requests,nav,vp,source}=setup(t),copy=structuredClone(source);
 const work=page.confirmPosition();page.confirmPosition();assert.equal(requests.length,1);assert.equal(page.data.confirmed,true);
 const saved=a.snapshot().views.back.completed.at(-1),id=saved.id,count=a.snapshot().views.back.completed.length;
 assert.deepEqual(requests[0].data.lesions.at(-1).geometry,saved.geometry);assert.equal(saved.geometry.coordinates.length,5);
 requests[0].fail({errMsg:'request:fail timeout'});await work;assert.match(page.data.message,/超时/);assert.equal(nav.length,0);
 const retry=page.confirmPosition();assert.equal(requests.length,2);assert.equal(a.snapshot().views.back.completed.length,count);assert.equal(a.snapshot().views.back.completed.at(-1).id,id);
 requests[1].success({statusCode:200,data:reply(requests[1].data)});await retry;assert.equal(nav.length,1);assert.match(nav[0],/result=1/);assert.deepEqual(source,copy);
 const result=instance(annotate);result.onLoad({sessionId:a.snapshot().sessionId,result:'1'});result.onShow();t.after(()=>result.onUnload());
 assert.equal(result.data.resultMode,true);assert.equal(result.data.selected,'');assert.ok(result.data.atlas.regions.length);assert.equal(result.data.layer.fillMode,'outline');assert.equal(result.data.candidates.length,2);
 assert.deepEqual(result.data.retainedViewport,vp);assert.equal(result.data.stageHeight,500);
 result.onSceneReady({detail:{sceneId:result.data.sceneId,view:'back'}});const all=result.data.atlas.regions.length;
 result.chooseCandidate({currentTarget:{dataset:{id:result.data.candidates[0].id}}});assert.ok(result.data.selected);assert.ok(result.data.atlas.regions.length<all);
 result.showAll();assert.equal(result.data.atlas.regions.length,all);result.fullBody();assert.equal(result.data.retainedViewport,null);await result.viewMatches();assert.equal(requests.length,2);
});
test('saved AI editing retains original results until confirmation; stable ID replaced and only new geometry requested',async t=>{
 const id=a.snapshot().views.back.completed.at(-1).id,old=a.snapshot().views.back.completed.at(-1),prior=m.refresh().response;
 const {page,requests,nav}=setup(t,id);assert.equal(page.data.editingSaved,true);assert.equal(m.refresh().response,prior);
 assert.equal(page.data.layer.completed.some(p=>p.id===id),false,'editing overlay must not duplicate the saved shape');
 page.scaleChanging({detail:{value:70}});page.angleChanging({detail:{value:20}});assert.equal(requests.length,0);assert.equal(a.snapshot().views.back.completed.at(-1),old);
 page.angleChanged({detail:{value:20}});page.setData({overlayReady:true});assert.equal(m.refresh().response,prior);
 const work=page.confirmPosition();assert.equal(requests.length,1);assert.equal(m.refresh().response,null);assert.equal(a.snapshot().views.back.completed.at(-1).id,id);
 assert.equal(page.data.layer.completed.filter(p=>p.id===id).length,1,'confirmed shape is restored exactly once');
 assert.notDeepEqual(requests[0].data.lesions.at(-1).geometry,old.geometry);
 requests[0].success({statusCode:200,data:reply(requests[0].data)});await work;assert.match(nav[0],/result=1/);assert.notEqual(m.refresh().response,prior);
});
test('page hiding/unload drops late response and navigation; confirmed annotation remains recoverable',async t=>{
 const {page,requests,nav}=setup(t),work=page.confirmPosition(),saved=a.snapshot().views.back.completed.at(-1);page.onHide();const state=structuredClone(page.data);
 requests[0].success({statusCode:200,data:reply(requests[0].data)});await work;assert.deepEqual(page.data,state);assert.equal(nav.length,0);assert.equal(m.refresh().response,null);assert.equal(a.snapshot().views.back.completed.at(-1),saved);
 page.onShow();const retry=page.confirmPosition();assert.equal(requests.length,2);requests[1].success({statusCode:200,data:reply(requests[1].data)});await retry;assert.equal(nav.length,1);
});
test('invalid placement never calls matching or replaces formal geometry; abandoned edit preserves original',async t=>{
 const id=a.snapshot().views.back.completed.at(-1).id,old=a.snapshot().views.back.completed.at(-1),{page,requests}=setup(t,id);
 assert.deepEqual(page.data.layer.completed,a.snapshot().views.back.completed.filter(p=>p.id!==id),'other saved shapes remain visible');
 page.update({...page.data.transform,translation:{x:0,y:0}},true);page.setData({overlayReady:true});await page.confirmPosition();assert.equal(requests.length,0);assert.equal(a.snapshot().views.back.completed.at(-1),old);
 page.backPhoto();assert.equal(a.snapshot().views.back.completed.at(-1),old);assert.equal(requests.length,0);
});
test('explicit review clears empty opposite placeholders, never active manual geometry',()=>{
 const {AnnotationSessionStore}=load('state/annotation-session.js'),{PlacementSessionStore}=load('state/placement-session.js');const store=new AnnotationSessionStore(),drafts=new PlacementSessionStore(store);
 store.open('front','front-chest');const r=drafts.open(syntheticPhoto(100),'back','back-upper-back',()=>true),owner=drafts.acquire(r.draft.id);assert.equal(drafts.confirm(r.draft.id,owner).ok,true);
 assert.ok(store.snapshot().views.front.draft);const review=store.dispatch(sessionToken(store.snapshot()),{type:'review'});assert.equal(review.ok,true);assert.equal(review.session.views.front.draft,null);
});
test('display handoff keeps anatomical center, CSS scale and shape across screen sizes; no geometry mutation',()=>{
 const model=getBodyModel('back'),original=focusViewport(fitViewport(375,500,model),model.regions.find(v=>v.id==='back-upper-back').bounds),point={x:.5,y:.3},before=normalizedToCanvas(point,original);
 for(const [w,h]of [[180,500],[320,640],[430,780]]){const v=reframeViewport(original,w,h),p=normalizedToCanvas(point,v);assert.equal(v.scale,original.scale);assert.ok(Math.abs((p.x-w/2)-(before.x-375/2))<1e-9);assert.ok(Math.abs((p.y-h/2)-(before.y-500/2))<1e-9);}
 assert.throws(()=>reframeViewport({...original,scale:0},320,600));
 retainPlacementView({sessionId:'S',requestId:'R',view:'back',viewport:original,regionId:'back-upper-back'});assert.equal(consumePlacementView('S','old'),null);assert.equal(consumePlacementView('S','R'),null);
 retainPlacementView({sessionId:'S',requestId:'R',view:'back',viewport:original,regionId:'back-upper-back'});assert.deepEqual(consumePlacementView('S','R').viewport,original);assert.equal(consumePlacementView('S','R'),null);
});
