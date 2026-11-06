// Real Goran resources and real shared page/store; synthetic lesions, no clinical truth.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const {getLocalModel,isLocalSurfaceView}=load('data/local-models.js');
const {LocalSurfaceSessionStore,localToken,localSession}=load('state/local-surface-session.js');
const {LocalSurfaceMatchingStore}=load('state/local-surface-matching-session.js');
const {annotationSession}=load('state/annotation-session.js');
const {pointInBody}=load('utils/annotation-geometry.js');
const {fitViewport,focusViewport,normalizedToCanvas,canvasToNormalized}=load('utils/coordinate.js');
const P=(x,y)=>({x,y});
function close(store,view,x=.35,y=.21){let r=store.open(view);if(!r.ok)throw Error(r.message);for(const point of [P(x-.01,y-.01),P(x+.01,y-.01),P(x,y+.01)]){r=store.dispatch(localToken(r.session),{type:'add',point});assert.ok(r.ok,r.message)}r=store.dispatch(localToken(r.session),{type:'close'});assert.ok(r.ok,r.message);return r.session;}
function backend(q){const script=`import sys,json,os\nos.environ['DERMATOME_ENV']='test'\nos.environ['ENABLE_REFERENCE_MATCHING']='1'\nfrom fastapi.testclient import TestClient\nfrom app.main import app\nwith TestClient(app) as c:\n r=c.post('/api/v1/evaluate',json=json.load(sys.stdin))\n assert r.status_code==200,r.text\n print(r.text)\n`;
 const r=spawnSync(path.join(root,'ai/.venv/bin/python'),['-c',script],{cwd:root,input:JSON.stringify(q),encoding:'utf8',env:{...process.env,PYTHONPATH:path.join(root,'backend')}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
global.wx={getWindowInfo:()=>({pixelRatio:2,windowHeight:720}),getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),setNavigationBarTitle(){}};
const api=load('services/api.js');api.evaluateAnnotations=async q=>backend(q);
let pageDef;global.Page=d=>pageDef=d;load('pages/local-surface/local-surface.js');
const page=()=>{const p={data:structuredClone(pageDef.data),setData(v){Object.assign(this.data,v)}};for(const[k,v]of Object.entries(pageDef))if(typeof v==='function')p[k]=v.bind(p);return p;};
function tap(p,x,y){const s=p.data.session;p.onPoint({detail:{sessionId:s.sessionId,revision:s.revision,view:s.view,templateId:s.basis.templateId,templateVersion:s.basis.templateVersion,geometryId:s.basis.geometryId,status:'valid',point:P(x,y)}})}

test('only registered soles are exposed, never front/back aliases; original palms remain distinct',()=>{
 for(const v of ['sole-left','sole-right']){assert.ok(isLocalSurfaceView(v));const m=getLocalModel(v);assert.equal(m.view,v);assert.equal(m.id,'goran-sole-v1');assert.deepEqual(m.atlas.regions.map(r=>r.labelId),['L5','S1']);assert.ok(Object.isFrozen(m.body[0].outer));for(const r of m.atlas.regions){assert.equal(r.side,v.split('-')[1]);assert.equal(r.view,v);assert.equal(r.medicalReviewStatus,'pending');}}
 for(const v of ['sole','foot','front','back'])assert.equal(isLocalSurfaceView(v),false);
 assert.throws(()=>getLocalModel('palm-left')); assert.equal(isLocalSurfaceView('palm-left'),false);
 const markup=fs.readFileSync(path.join(root,'miniprogram/pages/special-parts/special-parts.wxml'),'utf8');for(const v of ['sole-left','sole-right'])assert.ok(markup.includes(v));
});
test('left/right sessions, body and palm remain isolated; undo/delete and stale token guards work',()=>{
 const store=new LocalSurfaceSessionStore(),before=annotationSession.snapshot();let left=close(store,'sole-left'),token=localToken(left);const saved=JSON.stringify(left.state.completed);
 const right=close(store,'sole-right',.65,.21);assert.notEqual(left.sessionId,right.sessionId);assert.equal(JSON.stringify(store.snapshot('sole-left').state.completed),saved);
 assert.equal(store.snapshot('palm-left'),null);assert.strictEqual(annotationSession.snapshot(),before);
 let r=store.dispatch(token,{type:'start'});assert.ok(r.ok);r=store.dispatch(localToken(r.session),{type:'add',point:P(.5,.65)});assert.ok(r.ok);r=store.dispatch(localToken(r.session),{type:'undo'});assert.equal(r.session.state.draft.vertices.length,0);
 assert.equal(store.dispatch(token,{type:'delete',id:left.state.completed[0].id}).ok,false);
 r=store.dispatch(localToken(r.session),{type:'cancel'});r=store.dispatch(localToken(r.session),{type:'select',id:left.state.completed[0].id});r=store.dispatch(localToken(r.session),{type:'delete',id:left.state.completed[0].id});assert.equal(r.session.state.completed.length,0);assert.equal(store.snapshot('sole-right').state.completed.length,1);
});
test('real sole geometry produces real API candidates through shared response guard; changes invalidate results',async()=>{
 for(const view of ['sole-left','sole-right']){const store=new LocalSurfaceSessionStore();let s=close(store,view,view.endsWith('left')?.35:.65);s=store.dispatch(localToken(s),{type:'review'}).session;
  const match=new LocalSurfaceMatchingStore(()=>store.snapshot(view),()=>getLocalModel(view),async q=>backend(q),()=>true);await match.calculate();assert.equal(match.refresh().status,'ready');const response=match.refresh().response;assert.equal(response.views[0].view,view);assert.deepEqual(response.views[0].candidates.map(c=>c.label),['L5']);
  store.dispatch(localToken(s),{type:'edit'});let s2=store.snapshot(view);store.dispatch(localToken(s2),{type:'delete',id:s2.state.completed[0].id});assert.notEqual(match.refresh().status,'ready');
 }
});
test('shared page opens soles, matches L5/S1, single/all highlight, focuses and switches without losing geometry',async()=>{
 const p=page(),body=annotationSession.snapshot();p.onLoad({view:'sole-left'});assert.equal(p.data.partName,'脚底');assert.equal(p.data.orientation,'大脚趾在左 · 足底');
 for(const point of [[.34,.20],[.36,.20],[.35,.22]])tap(p,...point);p.closePolygon();p.newRegion();for(const point of [[.54,.64],[.56,.64],[.55,.66]])tap(p,...point);p.closePolygon();p.finish();await p.calculate();
 assert.equal(p.data.resultMode,true,p.data.message);assert.deepEqual(p.data.labels.map(l=>l.label).sort(),['L5','S1']);assert.equal(p.data.atlasRegions.length,2);
 const data=JSON.stringify(p.data.session.state.completed);p.chooseCandidate({currentTarget:{dataset:{id:p.data.labels[0].id}}});assert.equal(p.data.atlasRegions.length,1);p.zoom();assert.ok(p.data.focusBounds);p.reset();p.showAll();assert.equal(p.data.atlasRegions.length,2);assert.equal(JSON.stringify(p.data.session.state.completed),data);
 p.switchView({currentTarget:{dataset:{view:'sole-right'}}});assert.equal(p.data.completedCount,0);assert.equal(p.data.orientation,'大脚趾在右 · 足底');p.switchView({currentTarget:{dataset:{view:'sole-left'}}});assert.equal(JSON.stringify(p.data.session.state.completed),data);assert.strictEqual(annotationSession.snapshot(),body);p.onUnload();
});
test('three screen sizes, focus/full body preserve sole coordinates and reject blank margins',()=>{
 for(const view of ['sole-left','sole-right']){const model=getLocalModel(view);assert.equal(pointInBody(P(.01,.5),model.body),false);
 for(const w of [320,375,430]){const full=fitViewport(w,400,model,12);for(const viewport of [full,focusViewport(full,{x:.3,y:.1,width:.4,height:.4}),full]){const source=P(.5,.3),p=canvasToNormalized(normalizedToCanvas(source,viewport),viewport);assert.ok(Math.abs(p.x-source.x)<1e-12&&Math.abs(p.y-source.y)<1e-12);assert.ok(pointInBody(p,model.body));}}
 }
});
test('late result after view exit or annotation change cannot restore ready state',async()=>{
 const store=new LocalSurfaceSessionStore();let s=close(store,'sole-left');s=store.dispatch(localToken(s),{type:'review'}).session;let resolve,q;
 const m=new LocalSurfaceMatchingStore(()=>store.snapshot('sole-left'),()=>getLocalModel('sole-left'),input=>{q=input;return new Promise(r=>resolve=r)},()=>true);
 const pending=m.calculate();m.cancelPending();resolve(backend(q));await pending;assert.notEqual(m.refresh().status,'ready');
});
test('source MultiPolygon and holes survive geometry packaging; no sole AI entry',()=>{
 for(const v of ['sole-left','sole-right']){const r=getLocalModel(v).atlas.regions.find(r=>r.labelId==='L5');assert.equal(r.geometry.type,'MultiPolygon');assert.equal(r.geometry.coordinates.reduce((n,p)=>n+p.length-1,0),2);}
 const markup=fs.readFileSync(path.join(root,'miniprogram/pages/local-surface/local-surface.wxml'),'utf8');assert.doesNotMatch(markup,/AI 辅助|放置到人体/);
});
test('toe gap cannot be enclosed even when all four sole vertices are on skin',()=>{
 const store=new LocalSurfaceSessionStore();let s=store.open('sole-left').session;
 for(const point of [P(.34,.14),P(.44,.14),P(.44,.23),P(.34,.23)]){const r=store.dispatch(localToken(s),{type:'add',point});assert.ok(r.ok,r.message);s=r.session;}
 const r=store.dispatch(localToken(s),{type:'close'});assert.equal(r.ok,false);assert.equal(store.snapshot('sole-left').state.draft.vertices.length,4);
});
