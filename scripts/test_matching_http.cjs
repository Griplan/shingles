// Production page + real local HTTP; wx/Canvas events are adapters, NOT native GUI acceptance.
const assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os');
const root=path.resolve(__dirname,'..'),out=mkdtempSync(path.join(tmpdir(),'v4-http-'));
async function main(){
 const compile=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',out],{stdio:'inherit'});assert.equal(compile.status,0);
 const fixture=require('../backend/tests/fixtures/synthetic-annotation-geometry.json').editor;
 let networkFailure=false,requests=0;const routes=[];
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getWindowInfo:()=>({windowHeight:603}),getSystemInfoSync:()=>({platform:'devtools'}),
  navigateTo:o=>routes.push(o.url),navigateBack:()=>routes.push('back'),redirectTo:o=>routes.push(o.url),
  request:o=>{requests++;if(networkFailure){queueMicrotask(()=>o.fail({}));return;}
   fetch(o.url,{method:o.method,headers:o.header,body:JSON.stringify(o.data)}).then(async r=>o.success({statusCode:r.status,data:await r.json()})).catch(()=>o.fail({}));}};
 const load=f=>require(path.join(out,f));let def;global.Page=o=>{def=o;};load('pages/annotate/annotate.js');
 const page=()=>{const p={data:structuredClone(def.data),setData(c){Object.assign(this.data,c);}};for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);return p;};
 const {annotationSession:store}=load('state/annotation-session.js'),{matchingSession}=load('state/matching-session.js');
 const {fitViewport}=load('utils/coordinate.js'),{getBodyModel}=load('data/body-models.js');
 const response=()=>matchingSession.refresh().response;
 const event=dataset=>({currentTarget:{dataset}});
 const opened=store.open('front','front-chest');assert.equal(opened.ok,true);
 const p=page();p.onLoad({sessionId:opened.session.sessionId});p.onShow();
 const ready=()=>{const model=getBodyModel(p.data.view);p.onViewportChange({detail:{view:p.data.view,modelId:model.id,modelVersion:model.version,viewport:fitViewport(207,p.data.stageHeight,model)}});p.onSceneReady({detail:{sceneId:p.data.sceneId,view:p.data.view}});};
 const draw=key=>{for(const point of fixture[key])p.onAnnotationPoint({detail:{...p.data.layer,status:'valid',normalized:point}});p.closePolygon();};
 draw('UI-A');assert.equal(p.data.frontCount,1);const zoom=p.data.zoomRegion,height=p.data.stageHeight;p.finish();const firstRequest=p.calculate();
 assert.equal(p.data.layer.fillMode,'filled');assert.equal(p.data.zoomRegion,zoom);assert.equal(p.data.stageHeight,height);assert.equal(routes.length,0);
 await firstRequest;ready();assert.equal(p.data.matchStatus,'ready',p.data.matchMessage);assert.equal(requests,1);assert.ok(p.data.candidates.length);assert.equal(p.data.selected,'');
 p.openInfo();console.log('Actual first-request adapter timing (ms; NOT native first-frame/FPS): '+p.data.performanceText);p.closeInfo();
 const expectedIds=[...new Set(response().views[0].candidates.flatMap(c=>c.region_ids))].sort();assert.deepEqual(p.data.atlas.regions.map(r=>r.id).sort(),expectedIds);
 const firstResult=response(),firstPolygon=store.snapshot().views.front.completed[0];
 p.chooseCandidate(event({id:p.data.candidates[0].id}));assert.ok(p.data.atlas.regions.length);assert.deepEqual(p.data.layer.completed,[firstPolygon]);
 p.focusSelected();const bounds=p.data.focusBounds;assert.ok(bounds);p.showAll();assert.equal(p.data.focusBounds,bounds);p.onResize();p.fullBody();
 assert.deepEqual(p.data.atlas.regions.map(r=>r.id).sort(),expectedIds);await p.calculate();assert.equal(requests,1);assert.equal(response(),firstResult);
 console.log('PASS real HTTP: confirmed polygon -> one calculation, no route change, stable zoom/stage -> ALL exact instances -> focus/all/reset/resize');
 p.backToEdit();assert.equal(p.data.atlas,null);assert.equal(p.data.layer.fillMode,'filled');p.newRegion();draw('UI-B');assert.equal(p.data.frontCount,2);assert.equal(matchingSession.refresh().status,'stale');
 p.finish();const second=p.calculate();assert.equal(p.data.atlas,null);await second;ready();assert.equal(requests,2);assert.equal(p.data.matchStatus,'ready');assert.equal(response().lesions.length,2);
 p.chooseScope(event({id:firstPolygon.id}));assert.equal(p.data.layer.completed.length,1);assert.equal(p.data.scope,firstPolygon.id);
 console.log('PASS real HTTP: return edit/add -> stale colors cleared -> one calculation -> independent lesions + union summary + single scope');
 p.backToEdit();p.switchView(event({view:'back'}));p.newRegion();draw('UI-A');p.finish();await p.calculate();ready();assert.equal(requests,3);assert.equal(response().views.length,2);assert.ok(p.data.candidates.length);
 p.chooseCandidate(event({id:p.data.candidates[0].id}));assert.ok(p.data.atlas.regions.every(a=>a.view==='back'));p.switchView(event({view:'front'}));ready();
 assert.equal(p.data.selected,'');assert.ok(p.data.atlas.regions.length);assert.ok(p.data.atlas.regions.every(a=>a.view==='front'));
 console.log('PASS real HTTP: back polygon -> isolated back response/overlay -> switch front defaults to ALL front candidates');
 p.backToEdit();p.newRegion();for(const point of [{x:.495,y:.045},{x:.505,y:.045},{x:.5,y:.055}])p.onAnnotationPoint({detail:{...p.data.layer,status:'valid',normalized:point}});
 p.closePolygon();const hair=p.data.selectedId;p.finish();const before=store.snapshot();networkFailure=true;await p.calculate();
 assert.equal(p.data.matchStatus,'error');assert.equal(p.data.atlas,null);assert.equal(p.data.layer.fillMode,'filled');assert.equal(store.snapshot(),before);
 networkFailure=false;await p.calculate();ready();assert.equal(p.data.matchStatus,'ready');assert.equal(store.snapshot(),before);
 console.log('PASS injected network failure: old colors cleared, annotation retained, retry returns real HTTP result');
 p.chooseScope(event({id:hair}));assert.equal(p.data.coverageStatus,'none');assert.equal(p.data.candidates.length,0);assert.equal(p.data.atlas.regions.length,0);assert.equal(p.data.uncoveredText,'100%');
 const sent=requests;p.showAll();p.fullBody();p.onHide();p.onUnload();const q=page();q.onLoad({sessionId:store.snapshot().sessionId});q.onShow();await q.calculate();
 assert.equal(requests,sent);assert.equal(q.data.matchStatus,'ready');assert.equal(routes.length,0);q.openInfo();
 console.log('PASS real HTTP: unconfigured hair -> none, no invented candidate; unchanged revision reentry uses response; no navigation');
 console.log('Actual adapter timing (ms; NOT native first-frame/FPS): '+q.data.performanceText);
 q.onUnload();console.log('All integration assertions PASSED. Synthetic markers, local HTTP; no patient data.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>rmSync(out,{recursive:true,force:true}));
