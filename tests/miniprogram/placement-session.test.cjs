// Synthetic geometry and in-memory state only; no medical segmentation expectations.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {AnnotationSessionStore,sessionToken,modelBasis}=load('state/annotation-session.js');
const {getBodyModel}=load('data/body-models.js');
const {preparePhotoGeometry,transformPhotoPolygonToBody}=load('utils/placement-geometry.js');
const {MatchingSessionStore,snapshotKey,matchingIdentity}=load('state/matching-session.js');
const {drawLesions}=load('components/body-canvas/lesion-render.js');
const {fitViewport,focusViewport}=load('utils/coordinate.js');
const fixtures=require('../../backend/tests/fixtures/synthetic-annotation-geometry.json').editor;
function photo(){return {schema_version:'confirmed-photo-segmentation-v1',session_id:'SYNTHETIC_SESSION',photo_id:'SYNTHETIC_PHOTO',
 result_id:'SYNTHETIC_RESULT',candidate_id:'candidate-1',prompt_revision:3,coordinate_space:'photo_oriented_normalized_v1',
 confirmed_by_user:true,confirmed_at:Date.now()/1000-1,expires_at:Date.now()/1000+1200,
 image:{width:100,height:80,oriented_rgb_sha256:'a'.repeat(64),exif_orientation:1},model:{name:'synthetic_fixture'},
 prompts:{coordinate_space:'photo_oriented_normalized_v1',points:[],box:null},mask_asset:'candidate-1.png',mask_sha256:'b'.repeat(64),
 geometry:{type:'MultiPolygon',coordinates:[
 [[[.1,.1],[.4,.1],[.4,.7],[.1,.7],[.1,.1]],[[.2,.3],[.3,.3],[.3,.5],[.2,.5],[.2,.3]]],
 [[[.6,.1],[.9,.1],[.9,.7],[.6,.7],[.6,.1]]]]}};}
function setup(view='front'){
 const store=new AnnotationSessionStore(),entry=view==='front'?'front-chest':'back-upper-back';assert.equal(store.open(view,entry).ok,true);
 return {store,entry,view,act:a=>store.dispatch(sessionToken(store.snapshot()),a)};
}
function payload(h,id='SYNTHETIC_PLACEMENT'){
 const source=photo(),model=getBodyModel(h.view),transform={target:{...modelBasis(model),view:h.view},translation:{x:.5,y:.31},photoCenter:{x:50,y:32},baseScale:1,scale:1,rotationDegrees:0};
 return {placementId:id,entryRegionId:h.entry,source,transform,geometry:transformPhotoPolygonToBody(preparePhotoGeometry(source),transform,model)};
}
function manual(h){for(const point of fixtures['UI-A'])assert.equal(h.act({type:'add',point}).ok,true);assert.equal(h.act({type:'close'}).ok,true);return h.store.snapshot().views[h.view].completed[0];}
function fakeResponse(r){const cov=(view,ids)=>({view,lesion_ids:ids,annotation_area:1,covered_area:0,uncovered_area:1,covered_ratio:0,uncovered_ratio:1,coverage_status:'none',candidates:[]});return {request_id:r.request_id,annotation_revision:r.annotation_revision,identity:r.identity,method:'manual_annotation_reference_geometry',area_unit:'normalized_template_area',source:{preview:true,medical_review_status:'pending',attribution:'SYNTHETIC',coverage_note:'test'},warnings:[],lesions:r.lesions.map(l=>cov(l.view,[l.id])),views:[...new Set(r.lesions.map(l=>l.view))].map(v=>cov(v,r.lesions.filter(l=>l.view===v).map(l=>l.id)))};}
test('V5.3 atomic group commit preserves old manual annotations, components, holes and immutable photo source',()=>{
 const h=setup(),old=manual(h),p=payload(h),before=h.store.snapshot(),source=structuredClone(p.source);
 const result=h.store.commitPlacement(sessionToken(before),p);assert.equal(result.ok,true,result.message);
 const s=result.session,group=s.views.front.completed[1];assert.equal(s.sessionId,before.sessionId);assert.equal(s.revision,before.revision+1);
 assert.equal(s.views.front.completed.length,2);assert.equal(s.views.front.completed[0],old);assert.equal(group.geometry.coordinates.length,2);assert.equal(group.geometry.coordinates[0].length,2);
 assert.deepEqual(group.ring,group.geometry.coordinates[0][0]);assert.equal(group.source.kind,'ai_assisted');assert.deepEqual(group.source.photo,source);
 assert.equal(s.views.front.selectedId,group.id);assert.equal(s.views.front.draft,null);assert.equal(s.phase,'editing');
 assert.deepEqual(p.source,source);assert.equal(Object.isFrozen(p.source),false);assert.equal(Object.isFrozen(group.source.photo.geometry.coordinates[0][1]),true);
 assert.deepEqual(JSON.parse(JSON.stringify(s)).views.front.completed[1],group);
});
test('V5.3 duplicate confirmation is idempotent even with original token; conflicting payload cannot overwrite',()=>{
 const h=setup(),p=payload(h),token=sessionToken(h.store.snapshot());assert.equal(h.store.commitPlacement(token,p).ok,true);
 const saved=h.store.snapshot();assert.equal(h.store.commitPlacement(token,structuredClone(p)).session,saved);
 assert.equal(saved.views.front.completed.length,1);
 const different=structuredClone(p);different.transform.scale=1.2;assert.equal(h.store.commitPlacement(token,different).ok,false);assert.equal(h.store.snapshot(),saved);
});
test('V5.3 invalid token, template/view, expiry, source or preview cannot partially mutate V2',()=>{
 const cases=[
  (h,p,t)=>{t.sessionId='EXPIRED';},(h,p,t)=>{t.revision++;},(h,p,t)=>{t.view='back';},
  (h,p,t)=>{t.basis.templateVersion='OLD';},(h,p)=>{p.transform.target.view='back';},
  (h,p)=>{p.source.expires_at=Date.now()/1000-1;},(h,p)=>{p.source.confirmed_by_user=false;},
  (h,p)=>{p.source.geometry.coordinates=[];},(h,p)=>{p.source.mask_asset='';},
  (h,p)=>{p.geometry.coordinateSpace='photo_oriented_normalized_v1';},
  (h,p)=>{p.geometry.coordinates[0][0][0].x+=.001;},(h,p)=>{p.transform.scale=0;},
  (h,p)=>{p.transform.translation={x:0,y:0};},(h,p)=>{p.entryRegionId='back-upper-back';}
 ];
 for(const change of cases){const h=setup(),p=payload(h),t=structuredClone(sessionToken(h.store.snapshot()));change(h,p,t);const before=h.store.snapshot();
  const r=h.store.commitPlacement(t,p);assert.equal(r.ok,false,change.toString());assert.equal(h.store.snapshot(),before);}
});
test('V5.3 pending manual draft is never discarded; empty draft may be atomically replaced; back view stays isolated',()=>{
 const h=setup();h.act({type:'add',point:fixtures['UI-A'][0]});const before=h.store.snapshot();assert.equal(h.store.commitPlacement(sessionToken(before),payload(h)).ok,false);assert.equal(h.store.snapshot(),before);
 h.act({type:'cancel'});assert.equal(h.store.commitPlacement(sessionToken(h.store.snapshot()),payload(h)).ok,true);
 const b=setup('back'),p=payload(b);assert.equal(b.store.commitPlacement(sessionToken(b.store.snapshot()),p).ok,true);assert.equal(b.store.snapshot().views.front.completed.length,0);assert.equal(b.store.snapshot().views.back.completed[0].view,'back');
 const saved=b.store.snapshot().views.back.completed[0];b.act({type:'focus',regionId:null});b.act({type:'switch',view:'front'});b.act({type:'switch',view:'back'});
 assert.equal(b.store.snapshot().views.back.completed[0],saved);assert.deepEqual(saved.geometry,p.geometry);
});
test('V5.3 placement entry can switch front empty draft to back atomically without changing manual open semantics',()=>{
 const h=setup(),first=h.store.snapshot(),frontDraft=first.views.front.draft;
 assert.equal(h.store.open('back','back-upper-back').session,first,'manual open still restores its existing draft');
 const result=h.store.openPlacement('back','back-upper-back');assert.equal(result.ok,true,result.message);
 assert.equal(result.session.currentView,'back');assert.equal(result.session.revision,first.revision+1);assert.equal(result.session.views.front.draft,frontDraft);
 const again=h.store.openPlacement('back','back-upper-back');assert.equal(again.session,result.session,'same navigation does not mutate the token');
 const current=h.store.snapshot();assert.equal(h.store.openPlacement('back','front-chest').ok,false);assert.equal(h.store.snapshot(),current);
 const p=payload({view:'back',entry:'back-upper-back'});assert.equal(h.store.commitPlacement(sessionToken(current),p).ok,true);
 assert.equal(h.store.snapshot().views.back.completed.length,1);assert.equal(h.store.snapshot().views.front.draft,frontDraft);
 const active=setup();active.act({type:'add',point:fixtures['UI-A'][0]});const draft=active.store.snapshot();
 assert.equal(active.store.openPlacement('back','back-upper-back').ok,false);assert.equal(active.store.snapshot(),draft);
 const empty=new AnnotationSessionStore();assert.equal(empty.openPlacement('back','back-upper-back').ok,true);assert.equal(empty.snapshot().currentView,'back');
});
test('V5.4 extends V5.3 invalidation: complete AI geometry enters the shared V4 transport',async()=>{
 const h=setup();manual(h);let sends=0;const matcher=new MatchingSessionStore(()=>h.store.snapshot(),r=>{sends++;return Promise.resolve(fakeResponse(r));});
 await matcher.calculate();assert.equal(matcher.refresh().status,'ready');assert.equal(sends,1);
 const p=payload(h);assert.equal(h.store.commitPlacement(sessionToken(h.store.snapshot()),p).ok,true);
 assert.equal(matcher.refresh().response,null);assert.equal(matcher.refresh().status,'stale');assert.ok(snapshotKey(h.store.snapshot(),matchingIdentity()));
 await matcher.calculate();assert.equal(sends,2);assert.equal(matcher.refresh().status,'ready');
 const ai=h.store.snapshot().views.front.completed[1];assert.equal(h.act({type:'delete',id:ai.id}).ok,true);await matcher.calculate();assert.equal(sends,3);assert.equal(matcher.refresh().status,'ready');
});
function recorder(){const fills=[],strokes=[],paths=[];let current=[];const c={save(){},restore(){},rect(){},clip(){},setLineDash(){},beginPath(){current=[];},moveTo(x,y){const r=[[x,y]];current.push(r);},lineTo(x,y){current.at(-1).push([x,y]);},closePath(){},fill(){fills.push(structuredClone(current));},stroke(){strokes.push(structuredClone(current));}};return {c,fills,strokes,paths};}
const area=r=>r.reduce((a,p,i)=>{const q=r[(i+1)%r.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2;
test('V5.3 renderer draws every component and a genuine oppositely wound hole across focus/full view',()=>{
 const h=setup(),p=payload(h);assert.equal(h.store.commitPlacement(sessionToken(h.store.snapshot()),p).ok,true);const s=h.store.snapshot(),model=getBodyModel('front'),layer={...sessionToken(s),completed:s.views.front.completed,draft:null,selectedId:null};
 for(const viewport of [fitViewport(320,600,model),focusViewport(fitViewport(390,780,model),{x:.4,y:.2,width:.2,height:.3})]){
  const rec=recorder();drawLesions(rec.c,viewport,model,layer);assert.equal(rec.fills.length,2);assert.equal(rec.fills[0].length,2);assert.equal(rec.fills[1].length,1);
  assert.ok(area(rec.fills[0][0])*area(rec.fills[0][1])<0,'hole has opposing winding without clipping or source mutation');
  const outlined=recorder();drawLesions(outlined.c,viewport,model,{...layer,fillMode:'outline'});assert.equal(outlined.fills.length,0);assert.equal(outlined.strokes.length,2);
 }
 assert.deepEqual(s.views.front.completed[0].geometry,p.geometry);
});

test('V5.3 V2 page restores complete back-view AI group, keeps body coordinates on full view and manual add available',async()=>{
 const store=load('state/annotation-session.js').annotationSession,view='back',entry='back-upper-back';store.open(view,entry);
 const h={store,view,entry,act:a=>store.dispatch(sessionToken(store.snapshot()),a)},old=manual(h),p=payload(h);
 assert.equal(store.commitPlacement(sessionToken(store.snapshot()),p).ok,true);const ai=store.snapshot().views.back.completed[1];
 let def;global.Page=o=>def=o;load('pages/annotate/annotate.js');let requests=0;
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getWindowInfo:()=>({windowHeight:844}),getSystemInfoSync:()=>({platform:'devtools'}),request(o){requests++;assert.ok(o.data.lesions[1].geometry);o.success({statusCode:200,data:fakeResponse(o.data)});}};
 const page={data:structuredClone(def.data),setData(c){Object.assign(this.data,c)}};for(const[k,v]of Object.entries(def))if(typeof v==='function')page[k]=v.bind(page);
 page.onLoad({sessionId:store.snapshot().sessionId,result:'1'});page.onShow();
 assert.equal(page.data.view,'back');assert.equal(page.data.backCount,2);assert.equal(page.data.hasAIPlacement,true);assert.equal(page.data.matchingAllowed,true);assert.equal(page.data.resultMode,true);
 assert.deepEqual(page.data.layer.completed[1].geometry,p.geometry);assert.match(page.data.regions[1].label,/AI标注/);
 page.fullBody();assert.equal(page.data.zoomRegion,'');assert.equal(store.snapshot().views.back.completed[1],ai);assert.equal(store.snapshot().views.back.completed[0],old);
 page.finish();await page.viewMatches();assert.equal(requests,1);assert.equal(page.data.resultMode,true);assert.equal(page.data.matchStatus,'ready');page.continueEditing();page.newRegion();
 assert.equal(page.data.mode,'draw');assert.equal(store.snapshot().views.back.completed[1],ai);page.onHide();page.onUnload();
});
