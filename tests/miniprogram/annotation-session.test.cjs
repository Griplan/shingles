const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {AnnotationSessionStore,sessionToken}=load('state/annotation-session.js');
const {getBodyModel}=load('data/body-models.js');
const f=require('../../backend/tests/fixtures/synthetic-annotation-geometry.json').editor;
const setup=()=>{const store=new AnnotationSessionStore();assert.equal(store.open('front','front-chest').ok,true);
 const act=a=>store.dispatch(sessionToken(store.snapshot()),a);return {store,act,current:()=>store.snapshot().views[store.snapshot().currentView]};};
function polygon(h,key='UI-A'){for(const point of f[key])assert.equal(h.act({type:'add',point}).ok,true);return h.act({type:'close'});}
test('V2.1 valid entry, unique immutable authority, immediate draft sync and stale token rejection',()=>{
 const h=setup(),first=h.store.snapshot(),token=sessionToken(first);
 assert.equal(h.store.open('back','front-chest').ok,false);
 assert.equal(h.store.open('front','front-chest').session.sessionId,first.sessionId);
 assert.equal(h.act({type:'add',point:f['UI-A'][0]}).ok,true);
 assert.equal(first.views.front.draft.vertices.length,0);assert.equal(h.current().draft.vertices.length,1);
 assert.equal(h.store.read(first.sessionId).session,h.store.snapshot());assert.ok(Object.isFrozen(h.current().draft.vertices[0]));
 assert.equal(h.store.dispatch(token,{type:'add',point:f['UI-A'][1]}).ok,false);
 const snapshot=h.store.snapshot();assert.equal(h.act({type:'add',point:f['UI-A'][0]}).ok,false);assert.equal(h.store.snapshot(),snapshot);
 assert.equal(h.act({type:'add',point:f.outside}).ok,false);
});
test('V2.1 expired process/session and changed template/geometry/region version retain original data',()=>{
 for(const key of ['version','id','geometryId','regionSetId']) {
  let changed=false;const store=new AnnotationSessionStore(view=>changed?{...getBodyModel(view),[key]:'changed'}:getBodyModel(view));
  const opened=store.open('front','front-chest').session;changed=true;
  assert.equal(store.read(opened.sessionId).ok,false);assert.equal(store.open('front','front-chest').ok,false);assert.equal(store.snapshot(),opened);
 }
 const h=setup();assert.equal(h.store.read('expired').ok,false);
 assert.equal(new AnnotationSessionStore().read(h.store.snapshot().sessionId).ok,false);
});
test('V2.2 invalid close preserves draft; undo and cancel affect only current draft',()=>{
 const h=setup();assert.equal(h.act({type:'close'}).ok,false);assert.equal(polygon(h).ok,true);
 const saved=h.current().completed;assert.equal(h.act({type:'add',point:f['UI-A'][0]}).ok,false);
 h.act({type:'start'});for(const point of f['UI-self-cross'])h.act({type:'add',point});
 const original=h.current().draft;assert.equal(h.act({type:'close'}).ok,false);assert.equal(h.current().draft,original);
 h.act({type:'undo'});assert.equal(h.current().draft.vertices.length,3);assert.deepEqual(h.current().completed,saved);
 h.act({type:'cancel'});assert.equal(h.current().draft,null);assert.deepEqual(h.current().completed,saved);
});
test('V2.3 multiple overlapping regions stay independent; selected delete changes only target',()=>{
 const h=setup();polygon(h);const first=h.current().completed[0];h.act({type:'start'});polygon(h,'UI-B');
 const second=h.current().completed[1];assert.notEqual(first.id,second.id);assert.equal(h.current().completed.length,2);
 assert.equal(h.act({type:'delete',id:first.id}).ok,false);
 assert.equal(h.act({type:'delete',id:second.id}).ok,true);assert.deepEqual(h.current().completed,[first]);
 h.act({type:'start'});assert.equal(h.act({type:'select',id:first.id}).ok,false);h.act({type:'cancel'});
 h.act({type:'select',id:first.id});assert.equal(h.current().selectedId,first.id);
});
test('V2.3 draft switch is atomic: cancel/invalid close retain; discard or valid close switch; views isolated',()=>{
 const h=setup();h.act({type:'add',point:f['UI-A'][0]});const snapshot=h.store.snapshot();
 assert.equal(h.act({type:'switch',view:'back'}).ok,false);assert.equal(h.act({type:'switch',view:'back',resolution:'close'}).ok,false);assert.equal(h.store.snapshot(),snapshot);
 h.act({type:'switch',view:'back',resolution:'discard'});assert.equal(h.store.snapshot().views.front.draft,null);
 h.act({type:'start'});polygon(h);const back=h.current().completed;
 h.act({type:'switch',view:'front'});assert.equal(h.current().completed.length,0);
 h.act({type:'start'});for(const point of f['UI-A'])h.act({type:'add',point});
 h.act({type:'switch',view:'back',resolution:'close'});assert.deepEqual(h.current().completed,back);assert.equal(h.store.snapshot().views.front.completed.length,1);
});
test('V2.4 reentry restores nonempty draft and its view; review guards zero/draft and continues same session',()=>{
 const h=setup();assert.equal(h.act({type:'review'}).ok,false);h.act({type:'add',point:f['UI-A'][0]});
 const current=h.store.snapshot();assert.equal(h.store.open('back','back-upper-back').session,current);
 h.act({type:'cancel'});h.act({type:'start'});polygon(h);const first=h.current().completed[0];
 h.act({type:'start'});h.act({type:'add',point:f['UI-A'][0]});const before=h.store.snapshot();
 assert.equal(h.act({type:'review'}).ok,false);assert.equal(h.store.snapshot(),before);
 assert.equal(h.act({type:'review',discardDraft:true}).ok,true);assert.equal(h.store.snapshot().phase,'review');
 assert.equal(h.current().draft,null);assert.equal(h.current().focusRegionId,'front-chest');
 assert.equal(h.act({type:'start'}).ok,false);assert.equal(h.act({type:'delete',id:first.id}).ok,false);
 h.act({type:'edit'});assert.deepEqual(h.current().completed,[first]);assert.equal(h.store.snapshot().sessionId,current.sessionId);
});
test('V2.5 focus is presentation only; entry navigation is not a polygon fence',()=>{
 const h=setup(),original=h.store.snapshot();for(const point of f['UI-cross-navigation'])h.act({type:'add',point});
 const points=h.current().draft.vertices;h.act({type:'focus',regionId:null});assert.deepEqual(h.current().draft.vertices,points);
 h.act({type:'focus',regionId:'front-chest'});assert.deepEqual(h.current().draft.vertices,points);
 assert.equal(h.act({type:'close'}).ok,true);assert.equal(h.current().completed[0].navigation.entryRegionId,'front-chest');
 assert.deepEqual(h.current().completed[0].ring.slice(0,-1),f['UI-cross-navigation']);assert.equal(original.basis,h.store.snapshot().basis);
});
test('V2 resource limits fail without truncation and IDs never reuse on cancel/delete',()=>{
 const h=setup(),initial=h.current().draft.id;h.act({type:'cancel'});h.act({type:'start'});assert.notEqual(h.current().draft.id,initial);
 for(let i=0;i<20;i++){if(!h.current().draft)h.act({type:'start'});assert.equal(polygon(h).ok,true);}
 const snapshot=h.store.snapshot();assert.equal(h.act({type:'start'}).ok,false);assert.equal(h.store.snapshot(),snapshot);
});

test('V2 128-vertex limit rejects extra input without mutating or truncating existing draft',()=>{
 const h=setup();for(const point of f['UI-128'])assert.equal(h.act({type:'add',point}).ok,true);
 const snapshot=h.store.snapshot();assert.equal(h.act({type:'add',point:f['UI-A'][0]}).ok,false);assert.equal(h.store.snapshot(),snapshot);
 assert.equal(h.current().draft.vertices.length,128);assert.equal(h.act({type:'close'}).ok,true);assert.equal(h.current().completed[0].ring.length,129);
});
