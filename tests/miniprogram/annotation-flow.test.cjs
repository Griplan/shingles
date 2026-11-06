const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=f=>path.join(process.env.DERMATOME_BUILD_DIR,f);
const fixture=require('../../backend/tests/fixtures/synthetic-annotation-geometry.json').editor;
const event=dataset=>({currentTarget:{dataset}});
function setup(){
 for(const f of ['state/annotation-session.js','pages/annotate/annotate.js','pages/select/select.js'])delete require.cache[require.resolve(build(f))];
 let definition,selectDefinition;global.Page=o=>{definition=o;};require(build('pages/annotate/annotate.js'));const annotateDefinition=definition;
 global.Page=o=>{selectDefinition=o;};require(build('pages/select/select.js'));
 const state={sheet:null,modal:null,route:'',backs:0};
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:"develop"}}),getSystemInfoSync:()=>({platform:"devtools"}),showActionSheet:o=>{state.sheet=o;},showModal:o=>{state.modal=o;},
  navigateTo:o=>{state.route=o.url;o.complete?.();},navigateBack:()=>{state.backs++;},redirectTo:o=>{state.route=o.url;}};
 const instance=def=>{const p={data:structuredClone(def.data),setData(c){Object.assign(this.data,c);}};
  for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);return p;};
 const select=instance(selectDefinition),store=require(build('state/annotation-session.js')).annotationSession;
 const enter=()=>{select.applySelection('front-chest');select.startAnnotation();const page=instance(annotateDefinition);
  page.onLoad({sessionId:new URL('https://local.invalid'+state.route).searchParams.get('sessionId')});page.onShow();return page;};
 const choose=index=>{const sheet=state.sheet;assert.ok(sheet);sheet.success({tapIndex:index});sheet.complete();};
 return {state,select,store,enter,choose,page:instance(annotateDefinition)};
}
function draw(page,key='UI-A'){for(const point of fixture[key])page.onAnnotationPoint({detail:{...page.data.layer,status:'valid',normalized:point}});}
test('V2 entry rejects no selection/debug; route holds only session identifier, starts focused without coarse highlight',()=>{
 const h=setup();h.select.startAnnotation();assert.equal(h.state.route,'');
 h.select.applySelection('front-chest');h.select.toggleDebug({detail:{value:true}});h.select.startAnnotation();assert.equal(h.state.route,'');
 h.select.toggleDebug({detail:{value:false}});const p=h.enter();assert.match(h.state.route,/\?sessionId=session-/);assert.ok(!h.state.route.includes('vertices'));
 assert.equal(p.data.mode,'draw');assert.equal(p.data.zoomRegion,'front-chest');assert.equal(p.data.pointCount,0);
 h.page.onLoad({sessionId:'expired'});assert.match(h.page.data.error,/会话已结束/);
});
test('V2 automated page workflow: two front polygons/delete second/reenter/back polygon/review/edit',()=>{
 const h=setup(),p=h.enter();draw(p);p.closePolygon();const first=p.data.session.views.front.completed[0];
 assert.equal(p.data.mode,'readonly');assert.equal(p.data.frontCount,1);
 const snapshot=h.store.snapshot();p.onAnnotationPoint({detail:{...p.data.layer,status:'valid',normalized:fixture['UI-A'][0]}});assert.equal(h.store.snapshot(),snapshot);
 p.newRegion();draw(p,'UI-B');p.closePolygon();assert.equal(p.data.frontCount,2);
 const second=p.data.selectedId;p.deleteSelected();assert.equal(p.data.dialogOpen,true);h.state.modal.success({confirm:false});h.state.modal.complete();assert.equal(p.data.frontCount,2);
 p.deleteSelected();h.state.modal.success({confirm:true});h.state.modal.complete();assert.equal(p.data.frontCount,1);
 assert.ok(!p.data.session.views.front.completed.some(x=>x.id===second));assert.deepEqual(p.data.session.views.front.completed[0],first);
 p.fullBody();assert.equal(p.data.zoomRegion,'');p.backToSelection();assert.equal(h.state.backs,1);p.onHide();p.onUnload();
 const again=h.enter();assert.deepEqual(again.data.session.views.front.completed[0],first);
 again.switchView(event({view:'back'}));again.newRegion();draw(again);again.closePolygon();assert.equal(again.data.backCount,1);
 again.switchView(event({view:'front'}));assert.deepEqual(again.data.session.views.front.completed[0],first);
 const focusBeforeReview=again.data.zoomRegion;again.finish();assert.equal(again.data.phase,'review');assert.equal(again.data.zoomRegion,focusBeforeReview);assert.equal(again.data.mode,'readonly');
 again.continueEditing();assert.equal(again.data.phase,'editing');assert.deepEqual(again.data.session.views.front.completed[0],first);
});
test('V2 page preserves invalid closure and draft switching choices; debug and modal pause input',()=>{
 const h=setup(),p=h.enter();draw(p,'UI-self-cross');const snapshot=h.store.snapshot();p.closePolygon();assert.equal(h.store.snapshot(),snapshot);assert.match(p.data.message,/自交/);
 p.switchView(event({view:'back'}));assert.equal(p.data.dialogOpen,true);
 p.onAnnotationPoint({detail:{...p.data.layer,status:'valid',normalized:fixture['UI-A'][0]}});assert.equal(h.store.snapshot(),snapshot);
 h.choose(2);assert.equal(p.data.view,'front');assert.equal(p.data.pointCount,4);
 p.switchView(event({view:'back'}));h.choose(0);assert.equal(p.data.view,'front');
 p.switchView(event({view:'back'}));h.choose(1);assert.equal(p.data.view,'back');assert.equal(p.data.session.views.front.draft,null);
 p.newRegion();draw(p);const before=h.store.snapshot();p.toggleDebug({detail:{value:true}});
 p.onAnnotationPoint({detail:{...p.data.layer,status:'valid',normalized:fixture['UI-A'][0]}});assert.equal(h.store.snapshot(),before);
 p.toggleDebug({detail:{value:false}});p.switchView(event({view:'front'}));h.choose(2);assert.equal(p.data.view,'front');assert.equal(p.data.backCount,1);
});
test('V2 finish draft choices and return retain/discard; system hide/unload preserve immediate authority',()=>{
 const h=setup(),p=h.enter();p.finish();assert.match(p.data.message,/至少闭合/);draw(p);p.closePolygon();p.newRegion();draw(p);
 p.finish();h.choose(0);assert.equal(p.data.mode,'draw');p.finish();h.choose(2);assert.equal(p.data.mode,'draw');
 p.backToSelection();h.choose(2);assert.equal(h.state.backs,0);
 p.backToSelection();h.choose(0);assert.equal(h.state.backs,1);const draft=p.data.session.views.front.draft;
 p.onHide();p.onUnload();const again=h.enter();assert.deepEqual(again.data.session.views.front.draft,draft);
 again.finish();h.choose(1);assert.equal(again.data.phase,'review');assert.equal(again.data.pointCount,0);assert.equal(again.data.frontCount,1);
 again.continueEditing();again.newRegion();draw(again);again.backToSelection();h.choose(1);
 assert.equal(h.store.snapshot().views.front.draft,null);assert.equal(h.store.snapshot().views.front.completed.length,1);
});
test('V2 pending confirmation and point cannot mutate after hide or another revision',()=>{
 const h=setup(),p=h.enter();draw(p);const eventPoint={detail:{...p.data.layer,status:'valid',normalized:fixture['UI-B'][0]}};
 p.undo();const snapshot=h.store.snapshot();p.onAnnotationPoint(eventPoint);assert.equal(h.store.snapshot(),snapshot);
 p.cancelDraft();p.onHide();h.choose(1);assert.equal(h.store.snapshot(),snapshot);p.onShow();assert.equal(p.data.dialogOpen,false);
 p.cancelDraft();p.fullBody();h.choose(1); // focus is blocked while modal, confirmation remains on same revision.
 assert.equal(p.data.pointCount,0);assert.equal(p.data.session.views.front.draft,null);
});
