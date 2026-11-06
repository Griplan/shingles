// Actual new display geometry. Lesions are synthetic; no neural labels are invented.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..'),load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const {getLocalModel,isLocalSurfaceView,localViewPresentation}=load('data/local-models.js');
const provisionalModel=v=>load('data/axilla-provisional.generated.js').AXILLA_PROVISIONAL_MODELS[v];
const oldModel=v=>load('data/axilla.generated.js').AXILLA_MODELS[v];
const sessions=load('state/local-surface-session.js'),{LocalSurfaceSessionStore,localToken}=sessions;
const {LocalSurfaceMatchingStore}=load('state/local-surface-matching-session.js');
const {annotationSession}=load('state/annotation-session.js');
const {pointInBody,validatePolygon}=load('utils/annotation-geometry.js');
const {validatePlacementGeometry}=load('utils/placement-geometry.js');
const {fitViewport,focusViewport,normalizedToCanvas,canvasToNormalized}=load('utils/coordinate.js');
const P=(x,y)=>({x,y}),views=['axilla-left','axilla-right'];
const mirror=(p,v)=>v==='axilla-left'?P(1-p.x,p.y):p;
// Manually located in the original CC0 photo, before calling any hit/match function.
const references=[['central',P(.55,.4566666667)],['anterior-fold',P(.6655,.375)],['posterior-fold',P(.466,.4683333333)],['proximal-arm',P(.382,.235)],['lateral-chest',P(.7075,.655)]];
function harness(view='axilla-right',modelFor=getLocalModel){const store=new LocalSurfaceSessionStore(modelFor);let s=store.open(view).session;const act=a=>{const r=store.dispatch(localToken(s),a);assert.ok(r.ok,r.message);s=r.session;return s};return {store,act,get s(){return s}};}
function close(h,p=P(.55,.4567)){for(const q of [P(p.x-.012,p.y-.012),P(p.x+.012,p.y-.012),P(p.x,p.y+.012)])h.act({type:'add',point:q});h.act({type:'close'});}

test('axilla registry is explicit, new identity is independent and source has verified right-side CC0 provenance',()=>{
 for(const v of views){const m=getLocalModel(v);assert.ok(isLocalSurfaceView(v));assert.equal(m.id,'commons-axilla-v1');assert.equal(m.view,v);assert.equal(m.resource.license,'CC0 1.0');assert.match(m.resource.url,/MaleArmpit1/);assert.equal(m.atlas.technicalReady,true);assert.equal(m.atlas.regions.length,3);assert.equal(m.atlas.atlasType,"SCHEMATIC");assert.equal(m.atlas.medicalReviewStatus,'pending');assert.ok(Object.isFrozen(m.body[0].outer));assert.ok(fs.existsSync(path.join(root,'miniprogram',m.imagePath)));}
 for(const v of ['axilla','armpit','palm-left','palm-right','perineum','front'])assert.equal(isLocalSurfaceView(v),false);
 assert.match(localViewPresentation('axilla-right').orientation,/胸前在右/);assert.match(localViewPresentation('axilla-left').orientation,/胸前在左/);
});
test('both display surfaces are mirrored exactly without mirroring any neural atlas',()=>{
 const left=getLocalModel(views[0]).body[0].outer,right=getLocalModel(views[1]).body[0].outer;
 for(const p of right)assert.ok(left.some(q=>Math.abs(q.x-(1-p.x))<1e-12&&Math.abs(q.y-p.y)<1e-12));
 assert.deepEqual(getLocalModel(views[0]).atlas.identity,getLocalModel(views[1]).atlas.identity);
});
for(const v of views)test(v+' five source reference locations support closed annotations, air remains invalid',()=>{
 const h=harness(v),m=getLocalModel(v);
 references.forEach(([name,p],i)=>{if(i)h.act({type:'start'});const q=mirror(p,v);assert.ok(pointInBody(q,m.body),name);close(h,q)});
 assert.equal(h.s.state.completed.length,5);h.act({type:'review'});assert.equal(h.s.phase,'review');
 assert.equal(pointInBody(mirror(P(.05,.8),v),m.body),false);assert.equal(pointInBody(P(.01,.01),m.body),false);
});
test('whole-surface validation rejects a triangle bridging outside skin even with every vertex inside',()=>{
 const m=getLocalModel('axilla-right'),ring=[P(.3,.35),P(.46,.83),P(.7,.6)];
 assert.ok(ring.every(p=>pointInBody(p,m.body)));assert.equal(validatePolygon(ring,m.body).ok,false);
 const h=harness();ring.forEach(point=>h.act({type:'add',point}));assert.equal(h.store.dispatch(localToken(h.s),{type:'close'}).ok,false);assert.equal(h.s.state.completed.length,0);
});
test('self-crossing, empty and external marks are rejected; real crop boundary contact is accepted',()=>{
 const m=getLocalModel('axilla-right');assert.equal(validatePolygon([P(.5,.5),P(.65,.65),P(.5,.65),P(.65,.5)],m.body).ok,false);
 const h=harness();assert.equal(h.store.dispatch(localToken(h.s),{type:'add',point:P(.01,.01)}).ok,false);assert.equal(h.store.dispatch(localToken(h.s),{type:'close'}).ok,false);
 assert.ok(validatePolygon([P(.3,38.4/360),P(.4,38.4/360),P(.4,.2)],m.body).ok);
});
test('multi-part geometry with a hole is validated without flattening, filling or mutating source',()=>{
 const ring=(a,b,c,d)=>[P(a,b),P(c,b),P(c,d),P(a,d),P(a,b)];
 const g={type:'MultiPolygon',coordinateSpace:'body_template_normalized_v1',coordinates:[[ring(.5,.5,.7,.7),ring(.56,.56,.6,.6).reverse()],[ring(.4,.2,.45,.25)]]},before=JSON.stringify(g);
 assert.ok(validatePlacementGeometry(g,getLocalModel('axilla-right').body).ok);assert.equal(JSON.stringify(g),before);assert.equal(g.coordinates[0].length,2);assert.equal(g.coordinates.length,2);
});
test('two axillae and two soles retain separate V2 sessions, revisions, undo/delete and full-body history',()=>{
 const before=annotationSession.snapshot(),h=harness();close(h);const saved=h.s,old=localToken(saved);h.act({type:'start'});h.act({type:'add',point:P(.55,.5)});h.act({type:'undo'});assert.equal(h.s.state.draft.vertices.length,0);h.act({type:'cancel'});
 for(const v of ['axilla-left','sole-left','sole-right']){const r=h.store.open(v);assert.ok(r.ok);assert.notEqual(r.session.sessionId,saved.sessionId);assert.equal(r.session.state.completed.length,0);}
 assert.equal(h.store.dispatch(old,{type:'delete',id:saved.state.completed[0].id}).ok,false);h.act({type:'select',id:saved.state.completed[0].id});h.act({type:'delete',id:saved.state.completed[0].id});assert.equal(h.s.state.completed.length,0);assert.strictEqual(annotationSession.snapshot(),before);
});
test('template or atlas change blocks re-entry without silently reinterpreting saved axilla geometry',()=>{
 let model=getLocalModel('axilla-right');const h=harness('axilla-right',()=>model);close(h);const saved=h.s;
 model={...model,version:'changed'};assert.equal(h.store.open('axilla-right').ok,false);assert.strictEqual(h.store.snapshot('axilla-right'),saved);
});
test('unready atlas never sends evaluate and cannot publish empty success or assign nearest T2',async()=>{
 for(const v of views){const h=harness(v,oldModel);close(h,mirror(P(.55,.4567),v));h.act({type:'review'});let count=0;const before=h.s,m=new LocalSurfaceMatchingStore(()=>h.s,()=>oldModel(v),async()=>{count++;throw Error('must not request')},()=>true);
 await m.calculate();assert.equal(count,0);assert.equal(m.refresh().response,null);assert.match(m.refresh().message,/尚未就绪/);assert.strictEqual(h.s,before);}
});
test('three screen sizes and focus/reset preserve both axilla coordinates and their anatomical side',()=>{
 for(const v of views)for(const width of [320,375,430]){const model=getLocalModel(v),full=fitViewport(width,400,model,12);
 for(const [,p]of references){const q=mirror(p,v);for(const viewport of [full,focusViewport(full,{x:q.x-.1,y:q.y-.1,width:.2,height:.2}),full]){const back=canvasToNormalized(normalizedToCanvas(q,viewport),viewport);assert.ok(back);assert.ok(Math.abs(back.x-q.x)<1e-12&&Math.abs(back.y-q.y)<1e-12);}}}
});
let pageDef;global.Page=d=>pageDef=d;load('pages/local-surface/local-surface.js');
function page(){const p={data:structuredClone(pageDef.data),setData(v){Object.assign(this.data,v)}};for(const[k,v]of Object.entries(pageDef))if(typeof v==='function')p[k]=v.bind(p);return p}
function tap(p,q){const s=p.data.session;p.onPoint({detail:{...localToken(s),templateId:s.basis.templateId,templateVersion:s.basis.templateVersion,geometryId:s.basis.geometryId,status:'valid',point:q}})}
test('real shared page opens axilla, closes marks, focuses/resets, returns and exposes provisional labels while retaining marks',async()=>{
 sessions.localSession=new LocalSurfaceSessionStore();global.wx={getWindowInfo:()=>({windowHeight:700}),getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),setNavigationBarTitle(){}};
 const p=page();p.onLoad({view:'axilla-right'});assert.equal(p.data.partName,'腋下');for(const q of [P(.54,.44),P(.56,.44),P(.55,.48)])tap(p,q);p.closePolygon();assert.equal(p.data.completedCount,1);p.finish();const saved=JSON.stringify(p.data.session.state.completed);
 assert.equal(p.data.schematic,true);assert.match(p.data.provisionalNotice,/边界未经医学验证/);assert.equal(p.data.atlasReady,true);p.togglePreview();assert.deepEqual(p.data.labels.map(l=>l.label),["模拟 T1","模拟 T2","模拟 T3"]);p.togglePreview();p.zoom();assert.ok(p.data.focusBounds);p.reset();
 p.switchView({currentTarget:{dataset:{view:'axilla-left'}}});assert.equal(p.data.completedCount,0);p.switchView({currentTarget:{dataset:{view:'axilla-right'}}});assert.equal(JSON.stringify(p.data.session.state.completed),saved);
 let delta;global.getCurrentPages=()=>['pages/select/select','pages/special-parts/special-parts','pages/local-surface/local-surface'].map(route=>({route}));wx.navigateBack=o=>delta=o.delta;p.returnParts();assert.equal(delta,1);p.returnBody();assert.equal(delta,2);p.onUnload();
});
test('special chooser exposes soles and axillae only; no retired palms, perineum or AI placement',()=>{
 const text=fs.readFileSync(path.join(root,'miniprogram/pages/special-parts/special-parts.wxml'),'utf8');assert.deepEqual([...text.matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]).sort(),['axilla-left','axilla-right','sole-left','sole-right']);
 const page=fs.readFileSync(path.join(root,'miniprogram/pages/local-surface/local-surface.wxml'),'utf8');assert.doesNotMatch(page,/AI 辅助|放置到人体/);assert.match(page,/!atlasReady/);
});

test('provisional response keeps status and missing status is rejected',()=>{
 const {checkedResponse}=load('state/matching-session.js');
 const examples=JSON.parse(fs.readFileSync(path.join(root,'docs/validation-records/v6.6-axilla/provisional-matching/evidence/real-api-examples.json'),'utf8'));
 for(const {request,response} of examples){const model=provisionalModel(request.lesions[0].view);assert.equal(checkedResponse(response,request,model.atlas.regions).source.atlas_status,'PROVISIONAL');
 const stale=structuredClone(response);delete stale.source.atlas_status;assert.throws(()=>checkedResponse(stale,request,model.atlas.regions));
 }
});

test('actual API fixture passes through provisional matching store without changing saved geometry',async()=>{
 const examples=JSON.parse(fs.readFileSync(path.join(root,'docs/validation-records/v6.6-axilla/provisional-matching/evidence/real-api-examples.json'),'utf8'));
 for(const example of examples){const view=example.request.lesions[0].view,h=harness(view,provisionalModel),points=example.request.lesions[0].geometry.coordinates[0][0];
 for(const point of points.slice(0,-1))h.act({type:'add',point});h.act({type:'close'});h.act({type:'review'});const before=JSON.stringify(h.s),model=provisionalModel(view);let calls=0;
 const store=new LocalSurfaceMatchingStore(()=>h.s,()=>model,async q=>{calls++;const r=structuredClone(example.response);r.request_id=q.request_id;r.annotation_revision=q.annotation_revision;r.identity=q.identity;for(const c of [...r.lesions,...r.views])c.lesion_ids=[q.lesions[0].id];return r;},()=>true);
 await store.calculate();assert.equal(calls,1);assert.equal(store.refresh().status,'ready');assert.equal(store.refresh().response.source.atlas_status,'PROVISIONAL');assert.equal(JSON.stringify(h.s),before);
 }
});

test('both schematic pages calculate real fixture results, filter/all, edit/recalculate and retain status',async()=>{
 const matching=load('state/local-surface-matching-session.js'),oldForView=matching.localMatching.forView;
 const {checkedResponse}=load('state/matching-session.js');
 const examples=JSON.parse(fs.readFileSync(path.join(root,'docs/validation-records/v6.6-axilla/full-simulation/evidence/api-examples.json'),'utf8'));
 global.wx={getWindowInfo:()=>({windowHeight:700}),getAccountInfoSync:()=>({miniProgram:{envVersion:'trial'}}),setNavigationBarTitle(){}};
 sessions.localSession=new LocalSurfaceSessionStore();const stores={};let calls=0;
 matching.localMatching.forView=view=>stores[view]||(stores[view]=new LocalSurfaceMatchingStore(()=>sessions.localSession.snapshot(view),()=>getLocalModel(view),async q=>{
  calls++;const r=structuredClone(examples.find(e=>e.request.lesions[0].view===view).response);r.request_id=q.request_id;r.annotation_revision=q.annotation_revision;r.identity=q.identity;
  const ids=q.lesions.map(l=>l.id);r.lesions.forEach((c,i)=>c.lesion_ids=[ids[i]]);r.views[0].lesion_ids=ids;return r;
 },()=>true));
 try{
  for(const view of views){const p=page();p.onLoad({view});
   for(const [i,pt]of [P(.55,.4567),P(.382,.235),P(.7075,.655)].entries()){
    if(i)p.newRegion();const q=mirror(pt,view);for(const point of [P(q.x-.012,q.y-.012),P(q.x+.012,q.y-.012),P(q.x,q.y+.012)])tap(p,point);p.closePolygon();
   }
   p.finish();const before=JSON.stringify(p.data.session.state.completed);await p.calculate();assert.equal(p.data.resultMode,true);assert.equal(p.data.schematic,true);assert.match(p.data.provisionalNotice,/不能代替就医/);
   assert.equal(p.data.atlasRegions.length,3);assert.ok(p.data.labels.every(l=>l.label.startsWith('模拟 ')));
   p.chooseCandidate({currentTarget:{dataset:{id:p.data.labels[0].id}}});assert.equal(p.data.atlasRegions.length,1);p.showAll();assert.equal(p.data.atlasRegions.length,3);
   p.zoom();p.reset();assert.equal(JSON.stringify(p.data.session.state.completed),before);p.edit();assert.equal(p.data.resultMode,false);p.finish();await p.calculate();assert.equal(p.data.resultMode,true);p.onUnload();
  }
  assert.equal(calls,4);
  for(const {request,response} of examples){assert.equal(checkedResponse(response,request,getLocalModel(request.lesions[0].view).atlas.regions).source.atlas_type,'SCHEMATIC');
   for(const field of ['atlas_type','review_status','intended_use','source_type','disclaimer']){const broken=structuredClone(response);delete broken.source[field];assert.throws(()=>checkedResponse(broken,request,getLocalModel(request.lesions[0].view).atlas.regions));}
  }
 }finally{matching.localMatching.forView=oldForView;}
});
