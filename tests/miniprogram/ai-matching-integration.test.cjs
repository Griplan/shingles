// V5.4 synthetic state/geometry tests, no medical ground truth.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {AnnotationSessionStore,sessionToken}=load('state/annotation-session.js');
const {PlacementSessionStore}=load('state/placement-session.js');
const {MatchingSessionStore,matchingIdentity,snapshotKey,lesionForMatching}=load('state/matching-session.js');
const {syntheticPhoto}=require('./placement-fixtures.cjs');
function setup(){const a=new AnnotationSessionStore(),p=new PlacementSessionStore(a),source=syntheticPhoto(100,true);
 const r=p.open(source,'back','back-upper-back',()=>true);assert.equal(r.ok,true,r.message);
 const owner=p.acquire(r.draft.id);assert.equal(p.confirm(r.draft.id,owner).ok,true);
 return {a,p,source,id:a.snapshot().views.back.completed[0].id};}
function response(r){const cov=(view,ids)=>({view,lesion_ids:ids,annotation_area:1,covered_area:0,uncovered_area:1,covered_ratio:0,uncovered_ratio:1,coverage_status:'none',candidates:[]});
 return {request_id:r.request_id,annotation_revision:r.annotation_revision,identity:r.identity,method:'manual_annotation_reference_geometry',area_unit:'normalized_template_area',source:{preview:true,medical_review_status:'pending',attribution:'SYNTHETIC',coverage_note:'TEST'},warnings:[],lesions:r.lesions.map(l=>cov(l.view,[l.id])),views:[...new Set(r.lesions.map(l=>l.view))].map(v=>cov(v,r.lesions.filter(l=>l.view===v).map(l=>l.id)))};}
test('V5.4 wire retains all pieces/holes and excludes photos, masks and model information',()=>{
 const {a}=setup(),saved=a.snapshot().views.back.completed[0],wire=lesionForMatching(saved);
 assert.equal(wire.geometry,saved.geometry);assert.equal(wire.geometry.coordinates.length,5);assert.ok(wire.geometry.coordinates.every(p=>p.length===2));
 assert.deepEqual(Object.keys(wire).sort(),['geometry','id','source','view']);assert.equal(wire.vertices,undefined);
 assert.deepEqual({...wire,source:'manual'},lesionForMatching({...saved,source:{kind:'manual'}}));
 assert.throws(()=>lesionForMatching({...saved,geometry:{...saved.geometry,coordinateSpace:'photo_oriented_normalized_v1'}}),/照片/);
 assert.throws(()=>lesionForMatching({...saved,geometry:undefined}),/完整人体/);
});
test('V5.4 edit is isolated until atomic replacement, stable ID and repeat confirmation',async()=>{
 const {a,p,id,source}=setup();const original=a.snapshot().views.back.completed[0],m=new MatchingSessionStore(()=>a.snapshot(),r=>Promise.resolve(response(r)));
 await m.calculate();const result=m.refresh().response,key=snapshotKey(a.snapshot(),matchingIdentity());
 const edit=p.edit(id);assert.equal(edit.ok,true,edit.message);const owner=p.acquire(edit.draft.id);
 assert.equal(p.update(edit.draft.id,owner,{...edit.draft.transform,scale:.7,rotationDegrees:20},false).ok,true);
 assert.equal(a.snapshot().views.back.completed[0],original);assert.equal(snapshotKey(a.snapshot(),matchingIdentity()),key);assert.equal(m.refresh().response,result);
 assert.equal(p.confirm(edit.draft.id,owner).ok,false,'cannot confirm in-flight geometry');
 const d=p.read(edit.draft.id,owner).draft;assert.equal(p.update(d.id,owner,d.transform,true).ok,true);
 assert.equal(p.confirm(d.id,owner).ok,true);const updated=a.snapshot().views.back.completed[0];
 assert.equal(updated.id,id);assert.equal(a.snapshot().views.back.completed.length,1);assert.notDeepEqual(updated.geometry,original.geometry);
 assert.deepEqual(updated.source.photo,source);assert.equal(m.refresh().response,null);
 const revision=a.snapshot().revision;assert.equal(p.confirm(d.id,owner).ok,true);assert.equal(a.snapshot().revision,revision);
 await m.calculate();assert.equal(m.refresh().status,'ready');
});
test('V5.4 saved placement remains editable/matchable after photo TTL and cleanup without network',async()=>{
 const {a,p,id}=setup(),now=Date.now;Date.now=()=>now()+7200000;
 try{const edit=p.edit(id);assert.equal(edit.ok,true,edit.message);p.invalidateSource(edit.draft.source.session_id);
  const owner=p.acquire(edit.draft.id);assert.notEqual(owner,null);p.update(edit.draft.id,owner,{...edit.draft.transform,scale:.8},true);
  assert.equal(p.confirm(edit.draft.id,owner).ok,true);let sends=0;
  const m=new MatchingSessionStore(()=>a.snapshot(),r=>{sends++;return Promise.resolve(response(r))});await m.calculate();assert.equal(sends,1);assert.equal(m.refresh().status,'ready');
 }finally{Date.now=now;}
});
test('V5.4 failed/canceled editing and stale replacement leave saved geometry untouched',()=>{
 const {a,p,id}=setup(),original=a.snapshot().views.back.completed[0],edit=p.edit(id),owner=p.acquire(edit.draft.id);
 p.update(edit.draft.id,owner,{...edit.draft.transform,translation:{x:0,y:0}},true);assert.equal(p.confirm(edit.draft.id,owner).ok,false);
 assert.equal(a.snapshot().views.back.completed[0],original);p.discard(edit.draft.id,owner);assert.equal(a.snapshot().views.back.completed[0],original);
 const again=p.edit(id),lease=p.acquire(again.draft.id);a.dispatch(sessionToken(a.snapshot()),{type:'delete',id});assert.equal(p.confirm(again.draft.id,lease).ok,false);
});
test('V5.4 late old AI response and network retry never insert additional annotations',async()=>{
 const {a,p,id}=setup(),pending=[];const m=new MatchingSessionStore(()=>a.snapshot(),r=>new Promise((resolve,reject)=>pending.push({r,resolve,reject})));
 const first=m.calculate();const e=p.edit(id),lease=p.acquire(e.draft.id);p.update(e.draft.id,lease,{...e.draft.transform,scale:.8},true);p.confirm(e.draft.id,lease);
 const second=m.calculate();pending[1].resolve(response(pending[1].r));await second;const ready=m.refresh().response;
 pending[0].resolve(response(pending[0].r));await first;assert.equal(m.refresh().response,ready);
 const retry=m.calculate();pending[2].reject(Error('timeout'));await retry;assert.equal(m.refresh().status,'error');assert.equal(a.snapshot().views.back.completed.length,1);
 const good=m.calculate();pending[3].resolve(response(pending[3].r));await good;assert.equal(a.snapshot().views.back.completed[0].id,id);
 m.calculate();m.cancelPending();pending[4].resolve(response(pending[4].r));await Promise.resolve();await Promise.resolve();assert.equal(m.refresh().response,null);
});
