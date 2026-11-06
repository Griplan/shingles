// Real display-resource registration checks; synthetic protocol responses are not medical evidence.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const {getLocalModel,isLocalSurfaceView}=load('data/local-models.js');
const {LocalSurfaceSessionStore,localToken}=load('state/local-surface-session.js');
const {LocalSurfaceMatchingStore,localSnapshotKey}=load('state/local-surface-matching-session.js');
const {checkedResponse}=load('state/matching-session.js');
const {pointInBody,validatePolygon}=load('utils/annotation-geometry.js');
const {annotationSession}=load('state/annotation-session.js');
const root=path.resolve(__dirname,'../..'),P=(x,y)=>({x,y});
const model=getLocalModel('sole-left');
function setup(view='sole-left',modelFor=getLocalModel){const store=new LocalSurfaceSessionStore(modelFor);let s=store.open(view).session;const act=action=>{const out=store.dispatch(localToken(s),action);assert.equal(out.ok,true,out.message);s=out.session;return s;};return {store,act,get s(){return s}};}
function close(h){h.act({type:'add',point:P(.45,.65)});h.act({type:'add',point:P(.55,.65)});h.act({type:'add',point:P(.5,.7)});h.act({type:'close'});return h.s;}
function response(q){const cov=(v,ids)=>({view:v,lesion_ids:ids,annotation_area:.1,covered_area:0,uncovered_area:.1,covered_ratio:0,uncovered_ratio:1,coverage_status:'none',candidates:[]});return {request_id:q.request_id,annotation_revision:q.annotation_revision,identity:q.identity,method:'manual_annotation_reference_geometry',area_unit:'normalized_template_area',source:{preview:true,medical_review_status:'pending',attribution:'SYNTHETIC ONLY',coverage_note:'Not medical'},warnings:[],lesions:q.lesions.map(p=>cov(p.view,[p.id])),views:[cov(q.lesions[0].view,q.lesions.map(p=>p.id))]};}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise}};
const readyModel=v=>{const m=getLocalModel(v);return {...m,atlas:{...m.atlas,technicalReady:true,blockedReason:''}}}; // protocol only: never shipped

test('left/right independent sessions carry complete geometry and identities; full-body singleton untouched',()=>{
 const bodyBefore=annotationSession.snapshot(),h=setup(),s=close(h),left=s.state.completed[0];
 assert.equal(left.view,'sole-left');assert.equal(left.source.kind,'manual');assert.deepEqual(left.basis,s.basis);assert.deepEqual(left.atlasIdentity,s.atlasIdentity);assert.deepEqual(left.geometry.coordinates,[[left.ring]]);assert.ok(Object.isFrozen(left.geometry.coordinates[0][0]));
 const right=h.store.open('sole-right');assert.equal(right.ok,true);assert.notEqual(right.session.sessionId,s.sessionId);assert.equal(right.session.state.completed.length,0);assert.strictEqual(h.store.open('sole-left').session,s);assert.strictEqual(annotationSession.snapshot(),bodyBefore);
 assert.equal(h.store.dispatch({...localToken(s),view:'sole-right'},{type:'start'}).ok,false);
});

test('revision/template/atlas changes are rejected without rewriting history',()=>{
 let current=model;const h=setup('sole-left',()=>current),old=localToken(h.s);h.act({type:'add',point:P(.5,.6)});
 assert.equal(h.store.dispatch(old,{type:'undo'}).ok,false);const history=h.s;
 current={...model,version:'future'};assert.equal(h.store.open('sole-left').ok,false);assert.strictEqual(h.store.snapshot('sole-left'),history);
 current={...model,atlas:{...model.atlas,identity:{...model.atlas.identity,atlas_content_sha256:'c'.repeat(64)}}};assert.equal(h.store.read('sole-left',history.sessionId).ok,false);
});

test('same V2 lifecycle supports undo, disjoint/overlapping regions, selection, deletion, review read-only and resume',()=>{
 const h=setup();h.act({type:'add',point:P(.5,.6)});h.act({type:'undo'});assert.equal(h.s.state.draft.vertices.length,0);close(h);const first=h.s.state.completed[0];
 h.act({type:'start'});close(h);assert.equal(h.s.state.completed.length,2);assert.notEqual(h.s.state.completed[1].id,first.id);
 h.act({type:'select',id:first.id});h.act({type:'delete',id:first.id});assert.equal(h.s.state.completed.length,1);
 h.act({type:'review'});assert.equal(h.store.dispatch(localToken(h.s),{type:'start'}).ok,false);h.act({type:'edit'});h.act({type:'start'});h.act({type:'cancel'});assert.equal(h.s.state.completed.length,1);
});

test('unready atlas still refuses to send, preserving confirmed annotation',async()=>{
 const h=setup();close(h);h.act({type:'review'});let calls=0;const m=new LocalSurfaceMatchingStore(()=>h.s,()=>({...model,atlas:{...model.atlas,technicalReady:false,blockedReason:'局部边界尚未就绪'}}),async()=>{calls++},()=>true),before=h.s;
 await m.calculate();assert.equal(calls,0);assert.equal(m.refresh().response,null);assert.match(m.refresh().message,/尚未就绪/);assert.strictEqual(h.s,before);
});

test('synthetic protocol: duplicate suppression, complete payload, error retry and immutable accepted result',async()=>{
 const h=setup();close(h);h.act({type:'review'});const d=deferred();let calls=0,q;const m=new LocalSurfaceMatchingStore(()=>h.s,()=>readyModel('sole-left'),r=>{q=r;return ++calls===1?d.promise:Promise.resolve(response(r))},()=>true);
 const a=m.calculate();await m.calculate();assert.equal(calls,1);assert.equal(q.lesions[0].view,'sole-left');assert.strictEqual(q.lesions[0].geometry,h.s.state.completed[0].geometry);assert.equal(q.lesions[0].vertices,undefined);
 d.reject(new Error('offline'));await a;assert.equal(m.refresh().status,'error');await m.calculate();assert.equal(m.refresh().status,'ready');assert.ok(Object.isFrozen(m.refresh().response));
});

test('synthetic protocol: late responses after geometry changes, edit, cancel or permission loss cannot publish',async()=>{
 for(const kind of ['geometry','edit','cancel','permission']){const h=setup();close(h);h.act({type:'review'});let allowed=true,q;const d=deferred(),m=new LocalSurfaceMatchingStore(()=>h.s,()=>readyModel('sole-left'),r=>{q=r;return d.promise},()=>allowed);const a=m.calculate();
  if(kind==='geometry'){h.act({type:'edit'});h.act({type:'start'});close(h);h.act({type:'review'});m.refresh();}
  if(kind==='edit')h.act({type:'edit'});if(kind==='cancel')m.cancelPending();if(kind==='permission')allowed=false;
  d.resolve(response(q));await a;assert.equal(m.refresh().response,null,kind);assert.notEqual(m.refresh().status,'loading',kind);
 }
});

test('synthetic protocol: old A does not overwrite newer B; rights are checked before any request',async()=>{
 const h=setup();close(h);h.act({type:'review'});const calls=[];const m=new LocalSurfaceMatchingStore(()=>h.s,()=>readyModel('sole-left'),q=>{const d=deferred();calls.push({q,...d});return d.promise},()=>true);
 const a=m.calculate();h.act({type:'edit'});h.act({type:'start'});close(h);h.act({type:'review'});m.refresh();const b=m.calculate();calls[1].resolve(response(calls[1].q));await b;const saved=m.refresh().response;calls[0].resolve(response(calls[0].q));await a;assert.strictEqual(m.refresh().response,saved);
 let n=0;const release=new LocalSurfaceMatchingStore(()=>h.s,()=>readyModel('sole-left'),async()=>{n++},()=>false);await release.calculate();assert.equal(n,0);assert.equal(release.refresh().status,'error');
});

test('synthetic response association forbids other hand/full-body candidates and changed identity',()=>{
 const h=setup();close(h);h.act({type:'review'});const q={request_id:'TEST',annotation_revision:h.s.revision,identity:h.s.atlasIdentity,lesions:h.s.state.completed.map(p=>({id:p.id,view:p.view,geometry:p.geometry}))};
 assert.ok(checkedResponse(response(q),q,[]));for(const mutate of [r=>r.views[0].view='front',r=>r.lesions[0].view='sole-right',r=>r.identity={...r.identity,geometry_id:'other'},r=>r.views[0].candidates=[{candidate_id:'fake',partition_type:'spinal_dermatome',label:'SYNTHETIC',side:'left',view:'sole-left',display_name:'test',intersection_area:.01,lesion_coverage_ratio:.1,region_ids:['fake']}]] ){const r=response(q);mutate(r);assert.throws(()=>checkedResponse(r,q,[]));}
 assert.throws(()=>localSnapshotKey({...h.s,view:'sole-right'},model));
});

test('synthetic late network failure after leaving review clears its pending state without surfacing old error',async()=>{
 const h=setup();close(h);h.act({type:'review'});const d=deferred(),m=new LocalSurfaceMatchingStore(()=>h.s,()=>readyModel('sole-left'),()=>d.promise,()=>true);
 const pending=m.calculate();h.act({type:'edit'});d.reject(new Error('stale transport failure'));await pending;
 assert.equal(m.refresh().status,'idle');assert.equal(m.refresh().response,null);assert.doesNotMatch(m.refresh().message,/stale transport/);
});
