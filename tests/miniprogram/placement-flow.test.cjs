// Synthetic coordinates exercise production state/page/component. Not a native WeChat test.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const {PlacementSessionStore,placementSession}=load('packages/clinical/state/placement-session.js');
const {AnnotationSessionStore,annotationSession,sessionToken}=load('state/annotation-session.js');
const {getBodyModel}=load('data/body-models.js');
const {fitViewport,focusViewport,normalizedToCanvas,projectNormalizedToCanvas}=load('utils/coordinate.js');
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
function photo(id='SYNTHETIC') {return {schema_version:'confirmed-photo-segmentation-v1',session_id:id,photo_id:'photo-'+id,result_id:'result-'+id,candidate_id:'candidate-0',prompt_revision:1,
 coordinate_space:'photo_oriented_normalized_v1',confirmed_by_user:true,confirmed_at:Date.now()/1000-1,expires_at:Date.now()/1000+1200,
 image:{width:700,height:460,oriented_rgb_sha256:'a'.repeat(64)},model:{name:'synthetic-fixture'},prompts:{coordinate_space:'photo_oriented_normalized_v1',points:[],box:null},mask_asset:'candidate-0.png',mask_sha256:'b'.repeat(64),
 geometry:{type:'MultiPolygon',coordinates:[[[[.1,.2],[.4,.2],[.4,.7],[.1,.7],[.1,.2]],[[.2,.3],[.2,.4],[.3,.4],[.3,.3],[.2,.3]]],[[[.6,.2],[.8,.2],[.8,.7],[.6,.7],[.6,.2]]]]}};}
function setup(view='back') {const annotations=new AnnotationSessionStore(),store=new PlacementSessionStore(annotations),source=photo();let current=true;
 const r=store.open(source,view,view==='back'?'back-upper-back':'front-chest',()=>current);assert.equal(r.ok,true,r.message);return {annotations,store,source,id:r.draft.id,owner:store.acquire(r.draft.id),invalidate:()=>current=false};}
test('V5.3 draft keeps source independent; move/size/rotation never write formal V2 until one confirmation',()=>{
 const h=setup(),source=structuredClone(h.source),before=h.annotations.snapshot(),d=h.store.read(h.id,h.owner).draft;
 assert.equal(d.view,'back');assert.equal(d.regionId,'back-upper-back');
 const moved={...d.transform,scale:.7,rotationDegrees:25,translation:{x:.5,y:.3}};
 assert.equal(h.store.update(h.id,h.owner,moved,false).ok,true);assert.equal(h.annotations.snapshot(),before);
 const end=h.store.update(h.id,h.owner,moved,true);assert.equal(end.draft.validation.ok,true,end.draft.validation.message);assert.deepEqual(h.source,source);
 assert.equal(h.store.confirm(h.id,h.owner).ok,true);const saved=h.annotations.snapshot();assert.equal(saved.views.back.completed.length,1);assert.equal(saved.views.front.completed.length,0);
 assert.equal(saved.views.back.completed[0].geometry.coordinates.length,2);assert.equal(saved.views.back.completed[0].geometry.coordinates[0].length,2);
 assert.equal(h.store.confirm(h.id,h.owner).ok,true);assert.equal(h.annotations.snapshot(),saved);
 h.invalidate();assert.equal(h.store.read(h.id,h.owner).ok,true,'saved body geometry survives expired source');assert.equal(h.annotations.snapshot(),saved);
});
test('V5.3 reset and cancel affect only placement draft; invalid body placement cannot commit',()=>{
 const h=setup(),d=h.store.read(h.id,h.owner).draft,before=h.annotations.snapshot();
 const r=h.store.update(h.id,h.owner,{...d.transform,translation:{x:.01,y:.1},scale:4},true);assert.equal(r.ok,true);assert.equal(r.draft.validation.ok,false);
 assert.equal(h.store.confirm(h.id,h.owner).ok,false);assert.equal(h.annotations.snapshot(),before);
 assert.deepEqual(h.store.reset(h.id,h.owner).draft.transform,d.initial);h.store.discard(h.id,h.owner);assert.equal(h.store.read(h.id).ok,false);assert.equal(h.annotations.snapshot(),before);assert.ok(h.source.geometry.coordinates.length);
});
test('V5.3 page leases, source replacement, expiry and annotation revision reject old callbacks',()=>{
 const h=setup(),d=h.store.read(h.id).draft,newOwner=h.store.acquire(h.id);
 assert.equal(h.store.update(h.id,h.owner,d.transform,true).ok,false);assert.equal(h.store.read(h.id,newOwner).ok,true);
 h.annotations.dispatch(sessionToken(h.annotations.snapshot()),{type:'focus',regionId:null});assert.equal(h.store.read(h.id,newOwner).ok,false);
 const g=setup();g.invalidate();assert.equal(g.store.confirm(g.id,g.owner).ok,false);assert.equal(g.annotations.snapshot().views.back.completed.length,0);
 const j=setup(),replacement=j.store.open(photo('NEW'),'front','front-chest',()=>true);assert.equal(replacement.ok,true);assert.equal(j.store.read(j.id).ok,false);
 const expired=photo();expired.expires_at=Date.now()/1000-1;assert.equal(new PlacementSessionStore().open(expired,'back','back-upper-back',()=>true).ok,false);
});
test('system unload preserves in-run draft for resuming, while old owner can no longer write',()=>{
 const h=setup(),d=h.store.read(h.id).draft;const t={...d.transform,scale:.75,rotationDegrees:-25};h.store.update(h.id,h.owner,t,true);
 h.store.release(h.id,h.owner);assert.equal(h.store.hasPendingSource(h.source),true);assert.equal(h.store.update(h.id,h.owner,d.transform,true).ok,false);
 const resumed=h.store.open(h.source,'back','back-upper-back',()=>true);assert.equal(resumed.draft.id,h.id);assert.deepEqual(resumed.draft.transform,t);
 const owner=h.store.acquire(h.id);assert.equal(h.store.reset(h.id,owner).ok,true);
});
test('placement detaches from the temporary photo session before it is released',()=>{
 const annotations=new AnnotationSessionStore();let now=Date.now(),current=true;
 const store=new PlacementSessionStore(annotations,()=>now),source=photo('RELEASE');
 const opened=store.open(source,'back','back-upper-back',()=>current);assert.equal(opened.ok,true,opened.message);
 const detached=store.detachSource(opened.draft.id);assert.equal(detached.ok,true);assert.equal(detached.draft.sourceDetached,true);
 current=false;now+=10_000_000;store.invalidateSource(source.session_id);
 const resident=store.read(opened.draft.id);assert.equal(resident.ok,true,resident.message);
 const owner=store.acquire(opened.draft.id),d=resident.draft;
 const settled=store.update(opened.draft.id,owner,{...d.transform,scale:.8},true);
 assert.equal(settled.ok,true,settled.message);assert.equal(settled.draft.validation.ok,true);
 assert.equal(store.confirm(opened.draft.id,owner).ok,true,'detached copied geometry must not depend on expired server session');
 const saved=annotations.snapshot().views.back.completed.at(-1);assert.equal(saved.source.photo.session_id,source.session_id);
 assert.equal(saved.geometry.coordinates.length,2);
});
test('failed placement navigation can reattach the untouched temporary source',()=>{
 const h=setup(),source=h.source;let current=true;
 assert.equal(h.store.detachSource(h.id).ok,true);assert.equal(h.store.attachSource(h.id,()=>current).ok,true);
 assert.equal(h.store.read(h.id,h.owner).draft.sourceDetached,false);current=false;
 assert.equal(h.store.read(h.id,h.owner).ok,false);
});
test('explicit abandon or new photo clears a detached placement while passive expiry does not',()=>{
 const h=setup();assert.equal(h.store.detachSource(h.id).ok,true);
 h.store.invalidateSource(h.source.session_id);assert.equal(h.store.read(h.id,h.owner).ok,true);
 h.store.invalidateSource(h.source.session_id,true);assert.equal(h.store.read(h.id).ok,false);
});
test('unclipped projection previews outside coordinates without changing strict V1 projection rules',()=>{
 const v=fitViewport(400,600,{id:'synthetic',logicalWidth:200,logicalHeight:400});
 assert.throws(()=>normalizedToCanvas({x:-.1,y:.5},v));assert.equal(projectNormalizedToCanvas({x:-.1,y:.5},v).x,v.offsetX-.1*200*v.scale);
 assert.throws(()=>projectNormalizedToCanvas({x:Infinity,y:0},v));
});
test('deleted V2 placement cannot reopen as falsely confirmed; original photo can create a fresh draft',()=>{
 const h=setup();assert.equal(h.store.confirm(h.id,h.owner).ok,true);const s=h.annotations.snapshot(),id=s.views.back.completed[0].id;
 assert.equal(h.annotations.dispatch(sessionToken(s),{type:'delete',id}).ok,true);assert.equal(h.store.read(h.id).ok,false);
 const next=h.store.open(h.source,'back','back-upper-back',()=>true);assert.equal(next.ok,true,next.message);assert.notEqual(next.draft.id,h.id);assert.equal(next.draft.phase,'adjusting');
 assert.equal(h.annotations.snapshot().views.back.completed.length,0);
});

let pageDef;global.Page=o=>pageDef=o;load('packages/clinical/pages/placement/placement.js');
function pageFixture(t,sourceId='PAGE'){const source=photo(sourceId),r=placementSession.open(source,'back','back-upper-back',()=>true);assert.equal(r.ok,true,r.message);
 const nav=[],modal=[];global.wx={request:o=>o.fail({errMsg:"synthetic offline"}),getAccountInfoSync:()=>({miniProgram:{envVersion:"develop"}}),getSystemInfoSync:()=>({platform:"devtools"}),nextTick:f=>queueMicrotask(f),enableAlertBeforeUnload:o=>modal.push(o),disableAlertBeforeUnload:()=>{},showModal:o=>modal.push(o),navigateBack:()=>nav.push('photo'),redirectTo:o=>nav.push(o.url)};
 const calls={wake:0,retry:0};const p={data:structuredClone(pageDef.data),selectComponent:()=>({previewTransform(){},wake(){calls.wake++},retry(){calls.retry++},invalidateLayout(){}}),setData(c,callback){Object.assign(this.data,c);callback?.()}};for(const[k,v]of Object.entries(pageDef))if(typeof v==='function')p[k]=v.bind(p);
 p.onLoad({draftId:r.draft.id});p.onShow();t.after(()=>p.onUnload());return {p,r,nav,modal,calls,source};}
test('production placement page: back focus, drag, sliders, full-view invariance, confirmation and V2 navigation',async t=>{
 const {p,nav}=pageFixture(t),model=getBodyModel('back'),base=fitViewport(375,500,model),vp=focusViewport(base,model.regions.find(x=>x.id==='back-upper-back').bounds);
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:base}});assert.equal(p.data.view,'back');assert.equal(p.data.zoomRegion,'','a coarse entry hint must not zoom the body');
 const key=p.data.interactionKey,initial=annotationSession.snapshot();p.onDrag({detail:{key,phase:'start',delta:{x:0,y:0}}});
 p.onDrag({detail:{key,phase:'move',delta:{x:0,y:.005}}});assert.equal(annotationSession.snapshot(),initial);p.onDrag({detail:{key,phase:'end',delta:{x:0,y:.005}}});
 p.scaleChanging({detail:{value:70}});p.scaleChanged({detail:{value:70}});p.angleChanged({detail:{value:25}});assert.equal(p.data.scalePercent,70);assert.equal(p.data.angle,25);
 const transform=structuredClone(p.data.transform);p.toggleFocus();assert.ok(p.data.focusBounds);p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});assert.deepEqual(p.data.transform,transform);
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(base),ready:true}});await flush();assert.equal(p.data.overlayReady,false,'stale full-body frame cannot acknowledge the explicit focused view');
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(vp),ready:true}});await flush();assert.equal(p.data.valid,true,p.data.message);p.confirmPosition();p.confirmPosition();
 assert.equal(p.data.confirmed,true,p.data.message);assert.equal(annotationSession.snapshot().views.back.completed.length,1);assert.equal(p.data.layer.completed.length,1);
 await flush();p.viewAnnotations();assert.match(nav.at(-1),/pages\/annotate\/annotate\?sessionId=/);
});
test('drag release settles once and the confirm button can re-enable only after the matching overlay frame',async t=>{
 const {p}=pageFixture(t,'PAGE_DRAG_SETTLE'),model=getBodyModel('back'),vp=fitViewport(375,500,model),key=p.data.interactionKey;
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});
 const start=p.data.transform,moved={...start,translation:{x:start.translation.x+.01,y:start.translation.y-.005}},revision=p.data.revision;
 p.onDrag({detail:{key,phase:'start',delta:{x:0,y:0}}});assert.equal(p.data.dragging,true);
 p.onDrag({detail:{key,phase:'end',delta:{x:.01,y:-.005},transform:moved}});
 const settled=placementSession.read(p.data.draftId).draft;
 assert.equal(p.data.dragging,false);assert.equal(settled.transform.translation.x,moved.translation.x);assert.equal(settled.transform.translation.y,moved.translation.y);
 assert.equal(settled.revision,revision+1);assert.equal(settled.geometryRevision,settled.revision,'only release performs the final transform/check');
 assert.equal(p.data.valid,true,p.data.message);assert.equal(p.data.overlayReady,false);
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(vp),ready:true}});await flush();
 assert.equal(p.data.overlayReady,true);
 assert.equal(!p.data.valid||!p.data.viewport||!p.data.overlayReady||p.data.dragging||p.data.dialog||p.data.calculating,false,'native button condition is enabled');
 p.confirmPosition();await flush();assert.equal(p.data.confirmed,true,p.data.message);
});
test('production placement page: missing handoff fails without replacing the V2 session',()=>{
 const before=annotationSession.snapshot(),p={data:structuredClone(pageDef.data),selectComponent:()=>({previewTransform(){}}),setData(c){Object.assign(this.data,c)}};for(const[k,v]of Object.entries(pageDef))if(typeof v==='function')p[k]=v.bind(p);
 p.onLoad({});assert.match(p.data.error,/失效/);p.onUnload();assert.equal(annotationSession.snapshot(),before);
});
test('placement exit has valid native button lengths; continuing retains draft and explicit discard preserves V2',t=>{
 const {p,modal,nav,source}=pageFixture(t,'PAGE_EXIT'),before=annotationSession.snapshot();p.backPhoto();const options=modal.at(-1);
 assert.ok(Array.from(options.confirmText).length<=4);assert.ok(Array.from(options.cancelText).length<=4);assert.equal(p.data.dialog,true);
 options.success({confirm:false});options.complete();assert.equal(p.data.dialog,false);assert.equal(placementSession.hasPendingSource(source),true);
 p.backPhoto();const discard=modal.at(-1);discard.success({confirm:true});discard.complete();assert.equal(nav.at(-1),'photo');
 assert.equal(placementSession.read(p.data.draftId).ok,false);assert.equal(annotationSession.snapshot(),before);
});

test('rapid slider updates stay local; resize restores the last completed placement without recomputing geometry',async t=>{
 const {p}=pageFixture(t,'PERF_PAGE'),calls=[],previews=[];
 const original=p.setData;p.setData=function(c){calls.push(c);original.call(this,c)};p.selectComponent=()=>({previewTransform:(...args)=>previews.push(args),invalidateLayout(){}});
 const initial=p.data.transform,key=p.data.interactionKey,model=getBodyModel('back'),vp=fitViewport(375,500,model);
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});calls.length=0;
 for(let i=0;i<120;i++)p.scaleChanging({detail:{value:65+i%10}});
 assert.equal(previews.length,120);assert.ok(calls.length<=1,'no per-event setData');assert.equal(p.data.transform,initial,'full page binding changes only when settled');
 assert.equal(p.data.valid,false);p.onOverlayReady({detail:{key,revision:0,viewportKey:JSON.stringify(vp),ready:true}});await flush();
 p.confirmPosition();assert.equal(p.data.confirmed,false,'stale ack cannot save in-flight data');
 p.onHide();const d=placementSession.read(p.data.draftId).draft;assert.equal(d.geometryRevision,d.revision);assert.equal(d.validation.ok,true);assert.equal(d.transform.scale,.74);
 const n=calls.length;await new Promise(r=>setTimeout(r,110));assert.equal(calls.length,n,'no label timer writes after hiding');
 p.onShow();p.angleChanged({detail:{value:15}});
 const settled=placementSession.read(p.data.draftId).draft,saved=annotationSession.snapshot();
 p.angleChanging({detail:{value:25}});p.onResize();
 const restored=placementSession.read(p.data.draftId).draft;
 assert.equal(restored.geometry,settled.geometry);assert.deepEqual(restored.transform,settled.transform);
 assert.equal(annotationSession.snapshot(),saved);assert.equal(p.data.angle,15);assert.equal(p.data.scalePercent,74);
 assert.equal(p.data.overlayReady,false);assert.equal(p.data.viewport,null);
 p.angleChanged({detail:{value:25}});assert.equal(placementSession.read(p.data.draftId).draft,restored);
 p.startSlider();p.angleChanged({detail:{value:20}});assert.equal(p.data.angle,20);
});
test('unload during drag settles complete geometry without saving, and old page events cannot write',t=>{
 const {p}=pageFixture(t,'PERF_UNLOAD'),key=p.data.interactionKey,initial=annotationSession.snapshot();
 p.onDrag({detail:{key,phase:'start',delta:{x:0,y:0}}});p.onDrag({detail:{key,phase:'move',delta:{x:0,y:.002}}});
 p.onUnload();const d=placementSession.read(p.data.draftId).draft;assert.equal(d.geometryRevision,d.revision);assert.equal(d.validation.ok,true);assert.equal(annotationSession.snapshot(),initial);
 p.onDrag({detail:{key,phase:'end',delta:{x:.9,y:.9}}});assert.equal(placementSession.read(p.data.draftId).draft,d);
});

test('native timer id zero is still a pending label timer and is canceled on hide',t=>{
 const {p}=pageFixture(t,'PERF_TIMER_ZERO'),jobs=[],canceled=[];
 const originalSet=global.setTimeout,originalClear=global.clearTimeout;
 global.setTimeout=f=>{jobs.push(f);return 0};global.clearTimeout=id=>canceled.push(id);
 try{for(let i=0;i<20;i++)p.scaleChanging({detail:{value:65+i%10}});assert.equal(jobs.length,1);p.onHide();assert.deepEqual(canceled,[0]);}
 finally{global.setTimeout=originalSet;global.clearTimeout=originalClear;}
});
test('overlay waiting, error and redraw states are recoverable and do not reblock an initialized page',async t=>{
 const {p,calls}=pageFixture(t,'OVERLAY_RECOVERY'),model=getBodyModel('back'),vp=fitViewport(375,500,model),key=p.data.interactionKey;
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(vp),ready:false,status:'waiting'}});await flush();
 assert.equal(p.data.overlayWaiting,true);assert.equal(p.data.initialReady,false);assert.equal(p.data.error,'');
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(vp),ready:false,status:'error'}});await flush();
 assert.equal(p.data.error,'');assert.equal(p.data.overlayFault,false);assert.equal(p.data.overlayWaiting,true);
 assert.match(p.data.message,/自动恢复/);assert.equal(calls.retry,1,'the first native draw error triggers one automatic retry');
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(vp),ready:false,status:'error'}});await flush();
 assert.match(p.data.error,/加载失败/);assert.equal(p.data.overlayFault,true);assert.equal(p.data.initialReady,false);
 p.retryOverlay();assert.equal(p.data.error,'');assert.equal(p.data.overlayFault,false);assert.equal(p.data.overlayWaiting,true);
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(vp),ready:true,status:'ready'}});await flush();
 assert.equal(p.data.initialReady,true);assert.equal(p.data.overlayReady,true);
 const initial=p.data.transform;p.onDrag({detail:{key,phase:'start',delta:{x:0,y:0}}});
 p.onDrag({detail:{key,phase:'end',delta:{x:.01,y:0},transform:{...initial,translation:{x:initial.translation.x+.01,y:initial.translation.y}}}});
 assert.equal(p.data.initialReady,true,'ordinary revision redraw never restores the full-screen loading overlay');
 assert.equal(p.data.overlayReady,false);
 p.onOverlayReady({detail:{key,revision:p.data.revision,viewportKey:JSON.stringify(vp),ready:true,status:'ready'}});await flush();
 assert.equal(p.data.overlayReady,true);assert.equal(p.data.initialReady,true);
});
test('overlay handshake accepts an equivalent frame across a transient layout revision and rejects stale geometry',t=>{
 const {p}=pageFixture(t,'OVERLAY_HANDSHAKE'),model=getBodyModel('back'),vp=fitViewport(375,500,model),key=p.data.interactionKey,revision=p.data.revision;
 p.onOverlayReady({detail:{key,revision,layoutRevision:p.data.layoutRevision,viewportKey:'null',viewport:null,ready:false,status:'waiting'}});
 assert.equal(p.data.overlayWaiting,true,'waiting is observed before the body viewport has synchronised');
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp,layoutRevision:p.data.layoutRevision-1}});
 p.onOverlayReady({detail:{key,revision,layoutRevision:p.data.layoutRevision,viewportKey:JSON.stringify(vp),viewport:vp,ready:true,status:'ready'}});
 assert.deepEqual(p.data.viewport,vp,'the acknowledged frame supplies the exact rendered viewport');
 assert.equal(p.data.initialReady,true);assert.equal(p.data.overlayReady,true);assert.equal(p.data.overlayWaiting,false);
 const stale=fitViewport(375,500,model);
 stale.offsetX+=1;
 p.onOverlayReady({detail:{key,revision,layoutRevision:p.data.layoutRevision,viewportKey:JSON.stringify(stale),viewport:stale,ready:true,status:'ready'}});
 assert.deepEqual(p.data.viewport,vp,'a frame from an older layout cannot replace the current placement viewport');
 assert.equal(p.data.overlayReady,true,'a stale geometry acknowledgement does not tear down the valid current frame');
});
test('body viewport handoff wakes the existing overlay without destroying and re-querying it',async t=>{
 const {p,calls}=pageFixture(t,'OVERLAY_WAKE'),model=getBodyModel('back'),vp=fitViewport(375,500,model);
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});
 await flush();
 assert.equal(calls.wake,1);assert.equal(calls.retry,0);
});
test('body viewport queued before onShow revision is accepted instead of causing a permanent reconnect wait',async t=>{
 const {p,calls}=pageFixture(t,'VIEWPORT_REVISION_RACE'),model=getBodyModel('back'),vp=fitViewport(375,500,model);
 p.setData({layoutRevision:3});
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp,layoutRevision:2}});
 await flush();
 assert.deepEqual(p.data.viewport,vp);
 assert.equal(p.data.overlayWaiting,false);
 assert.equal(p.data.error,'');
 assert.equal(calls.wake,1);
});
test('legacy body-canvas failure is recovered by the stable local body fallback',async t=>{
 const {p}=pageFixture(t,'BODY_RECOVERY'),model=getBodyModel('back'),vp=fitViewport(375,500,model);
 p.bodyRenderError();
 assert.equal(p.data.error,'');
 assert.equal(p.data.overlayWaiting,false);
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});
 await flush();
 assert.deepEqual(p.data.viewport,vp);
 assert.equal(p.data.error,'');
 assert.equal(p.data.overlayWaiting,false);
});
test('zero-size placement slot falls back to the actual content window instead of leaving a blank page',async t=>{
 const {p}=pageFixture(t,'VIEWPORT_FALLBACK');
 global.wx.getWindowInfo=()=>({windowWidth:390,windowHeight:844});
 p.createSelectorQuery=()=>({
  select:()=>({
   fields:()=>({
    exec:callback=>callback([{width:0,height:0}]),
   }),
  }),
 });
 p.ensureViewport(true,6);
 assert.ok(p.data.viewport);
 assert.equal(p.data.viewport.viewportWidth,390-56*(390/750));
 assert.equal(p.data.viewport.viewportHeight,844*0.58);
 assert.equal(p.data.bodyFallbackVisible,true);
 assert.ok(p.data.bodyImagePath.endsWith('/back.png'));
 assert.equal(p.data.error,'');
});
test('placement entry ignores a coarse region hint and starts with the complete body',async t=>{
 const {p}=pageFixture(t,'FULL_BODY_ENTRY'),model=getBodyModel('back');
 p.createSelectorQuery=()=>({
  select:()=>({
   fields:()=>({
    exec:callback=>callback([{width:720,height:650}]),
   }),
  }),
 });
 p.ensureViewport(true,0);
 assert.equal(p.data.zoomRegion,'');
 assert.equal(p.data.focusBounds,null);
 assert.deepEqual(p.data.viewport,fitViewport(720,650,model));
});
test('wide-screen fallback mirrors the P9 two-column body workspace',async t=>{
 const {p}=pageFixture(t,'WIDE_VIEWPORT_FALLBACK');
 global.wx.getWindowInfo=()=>({windowWidth:800,windowHeight:720});
 p.createSelectorQuery=()=>({
  select:()=>({
   fields:()=>({
    exec:callback=>callback([{width:0,height:0}]),
   }),
  }),
 });
 p.ensureViewport(true,6);
 assert.equal(p.data.viewport.viewportWidth,(800-32-16)*0.52);
 assert.equal(p.data.viewport.viewportHeight,720-128);
 assert.equal(p.data.zoomRegion,'');
 assert.equal(p.data.viewport.viewportWidth,391.04);
 assert.equal(p.data.viewport.viewportHeight,592);
});
test('overlay watchdog retries once, then reports a recoverable timeout without faking readiness',t=>{
 const {p}=pageFixture(t,'OVERLAY_WATCHDOG'),jobs=[],originalSet=global.setTimeout,originalClear=global.clearTimeout;
 const model=getBodyModel('back'),vp=fitViewport(375,500,model);
 global.setTimeout=fn=>{jobs.push(fn);return jobs.length};global.clearTimeout=()=>{};
 try{
  p.clearOverlayWatchdog();p.armOverlayWatchdog();assert.equal(jobs.length,0,'body viewport is not reported as an overlay reconnect timeout');
  p.setData({viewport:vp});p.armOverlayWatchdog();assert.equal(jobs.length,1);
  jobs[0]();assert.equal(p.data.overlayWaiting,true);assert.equal(p.data.initialReady,false);assert.equal(p.data.error,'');assert.equal(jobs.length,2);
  jobs[1]();assert.equal(p.data.initialReady,false);assert.match(p.data.error,/加载超时/);assert.equal(p.data.overlayFault,true);
 }finally{global.setTimeout=originalSet;global.clearTimeout=originalClear;}
});
