// Page and Canvas command adapters only. Synthetic hand rectangles are NOT shipped resources/medical expectations.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const P=(x,y)=>({x,y}),ring=[P(.1,.1),P(.9,.1),P(.9,.9),P(.1,.9),P(.1,.1)];
const modelModule=load('data/local-models.js');
const model=view=>({id:'SYNTHETIC_PALM',name:view,version:'test',geometryId:'synthetic',regionSetId:'synthetic',view,logicalWidth:400,logicalHeight:600,imagePath:'/synthetic/'+view+'.png',sourcePath:'synthetic.svg',
 body:Object.freeze([Object.freeze({outer:Object.freeze(ring.map(p=>Object.freeze({...p}))),holes:Object.freeze([])})]),
 resource:{title:'Synthetic test only',url:'https://example.invalid',author:'Test',license:'Test',attribution:'Test fixture'},
 atlas:{identity:{template_id:'SYNTHETIC_PALM',template_version:'test',geometry_id:'synthetic',region_set_id:'synthetic',atlas_id:'SYNTHETIC',atlas_version:'1',atlas_content_sha256:'a'.repeat(64),body_content_sha256:'b'.repeat(64),coordinate_system:'normalized_2d_top_left'},regions:[],technicalReady:false,blockedReason:'Synthetic unavailable atlas',sourceTitle:'Test',sourceUrl:'',attribution:'Test',medicalReviewStatus:'pending',coverageNote:'Not medical'}});
const models={'sole-left':model('sole-left'),'sole-right':model('sole-right')};
modelModule.getLocalModel=v=>models[v];
let pageDef,selectDef,componentDef,chooserDef;
global.Page=d=>pageDef=d;load('pages/local-surface/local-surface.js');global.Page=d=>selectDef=d;load('pages/select/select.js');global.Page=d=>chooserDef=d;load('pages/special-parts/special-parts.js');global.Component=d=>componentDef=d;load('components/local-surface-canvas/local-surface-canvas.js');
const sessions=load('state/local-surface-session.js'),matching=load('state/local-surface-matching-session.js'),bodySessions=load('state/annotation-session.js');
const {fitViewport,focusViewport,normalizedToCanvas}=load('utils/coordinate.js');
const instance=def=>{const p={data:structuredClone(def.data),setData(v){Object.assign(this.data,v)}};for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);return p;};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
function setup(){sessions.localSession=new sessions.LocalSurfaceSessionStore(v=>models[v]);global.wx={getWindowInfo:()=>({pixelRatio:2,windowHeight:700}),getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})};}
function probe(p,x,y){return {sessionId:p.data.session.sessionId,revision:p.data.session.revision,view:p.data.view,templateId:'SYNTHETIC_PALM',templateVersion:'test',geometryId:'synthetic',status:'valid',point:P(x,y)}}
function tap(p,x,y){p.onPoint({detail:probe(p,x,y)});}
test('special entry navigation preserves body view selection and authoritative session',()=>{
 setup();const p=instance(selectDef);p.data.view='back';p.data.selectedRegion='back-upper-back';
 const previous=bodySessions.annotationSession.snapshot();let url;wx.navigateTo=o=>{url=o.url;o.complete?.()};
 p.openSpecialParts();assert.equal(url,'/pages/special-parts/special-parts');assert.equal(p.data.view,'back');assert.equal(p.data.selectedRegion,'back-upper-back');assert.strictEqual(bodySessions.annotationSession.snapshot(),previous);
 const chooser=instance(chooserDef);chooser.choose({currentTarget:{dataset:{view:'sole-right'}}});assert.equal(url,'/pages/local-surface/local-surface?view=sole-right');
 chooser.choose({currentTarget:{dataset:{view:'foot'}}});assert.equal(url,'/pages/local-surface/local-surface?view=sole-right');
});
test('manual page closes, selects, adds, deletes, reviews; left/right data and body data remain isolated',()=>{
 setup();const previous=bodySessions.annotationSession.snapshot(),p=instance(pageDef);p.onLoad({view:'sole-left'});
 tap(p,.2,.2);tap(p,.3,.2);tap(p,.25,.3);p.closePolygon();assert.equal(p.data.completedCount,1);const first=JSON.stringify(p.data.session.state.completed[0].geometry);
 p.switchView({currentTarget:{dataset:{view:'sole-right'}}});assert.equal(p.data.completedCount,0);tap(p,.6,.6);tap(p,.7,.6);tap(p,.65,.7);p.closePolygon();assert.equal(p.data.rightCount,1);
 p.switchView({currentTarget:{dataset:{view:'sole-left'}}});assert.equal(p.data.completedCount,1);assert.equal(JSON.stringify(p.data.session.state.completed[0].geometry),first);
 p.newRegion();tap(p,.6,.2);tap(p,.7,.2);p.undo();assert.equal(p.data.pointCount,1);tap(p,.7,.2);tap(p,.65,.3);p.closePolygon();assert.equal(p.data.completedCount,2);p.deleteSelected();assert.equal(p.data.completedCount,1);
 p.finish();assert.equal(p.data.phase,'review');p.edit();assert.equal(p.data.phase,'editing');assert.strictEqual(bodySessions.annotationSession.snapshot(),previous);p.onUnload();
});
test('stale/wrong view probes rejected, whole-surface validation remains active, focus/reset never alter coordinates',()=>{
 setup();const p=instance(pageDef);p.onLoad({view:'sole-left'});
 p.onPoint({detail:{view:'sole-right',templateId:'SYNTHETIC_PALM',templateVersion:'test',geometryId:'synthetic',status:'valid',point:P(.2,.2)}});assert.equal(p.data.pointCount,0);
 tap(p,.01,.01);assert.equal(p.data.pointCount,0);assert.ok(p.data.message);
 tap(p,.2,.2);tap(p,.3,.2);tap(p,.25,.3);p.closePolygon();const geometry=JSON.stringify(p.data.session.state.completed);
 p.zoom();assert.ok(p.data.focusBounds);p.reset();assert.equal(p.data.focusBounds,null);assert.equal(JSON.stringify(p.data.session.state.completed),geometry);p.onUnload();
});
test('unconfigured reference atlas shows no invented labels and cannot call evaluate',async()=>{
 setup();const p=instance(pageDef);p.onLoad({view:'sole-left'});tap(p,.2,.2);tap(p,.3,.2);tap(p,.25,.3);p.closePolygon();p.finish();
 let calls=0;const store=matching.localMatching.forView('sole-left'),original=store.calculate;store.calculate=async()=>{calls++};
 try{await p.calculate();assert.equal(calls,0);assert.equal(p.data.resultMode,false);assert.equal(p.data.message,'Synthetic unavailable atlas');p.togglePreview();assert.deepEqual(p.data.labels,[]);assert.deepEqual(p.data.atlasRegions,[]);}finally{store.calculate=original;p.onUnload();}
});
test('same-view stale session or revision point cannot enter a replacement draft',()=>{
 setup();const p=instance(pageDef);p.onLoad({view:'sole-left'});const before=probe(p,.3,.3);
 tap(p,.2,.2);p.onPoint({detail:before});assert.equal(p.data.pointCount,1);
 p.onPoint({detail:{...probe(p,.3,.3),sessionId:'old-palm-session'}});assert.equal(p.data.pointCount,1);
 p.cancelDraft();p.newRegion();p.onPoint({detail:before});assert.equal(p.data.pointCount,0);p.onUnload();
});
test('synthetic ready response shows all actual instances, single candidate keeps every piece, edit invalidates result',async()=>{
 setup();const saved=models['sole-left'].atlas,original=matching.localMatching.forView;
 const region=(id,label,x)=>({id,labelId:label,displayName:label,sourceLabel:label,view:'sole-left',side:'left',partitionType:'spinal_dermatome',templateId:'SYNTHETIC_PALM',templateVersion:'test',geometryId:'synthetic',atlasVersion:'1',color:'#23865b',labelPoint:P(x,.3),geometry:{type:'MultiPolygon',coordinates:[[[[x,.2],[x+.04,.2],[x+.04,.4],[x,.4],[x,.2]]]]}});
 const regions=[region('A1','TEST_A',.2),region('A2','TEST_A',.3),region('B1','TEST_B',.6)];
 models['sole-left'].atlas={...saved,technicalReady:true,blockedReason:'',regions};
 const candidates=[{candidate_id:'A',region_ids:['A1','A2'],label:'TEST_A',display_name:'Test A',side:'left',view:'sole-left',partition_type:'spinal_dermatome',lesion_coverage_ratio:.6},{candidate_id:'B',region_ids:['B1'],label:'TEST_B',display_name:'Test B',side:'left',view:'sole-left',partition_type:'spinal_dermatome',lesion_coverage_ratio:.4}];
 let ready=false;const fake={refresh:()=>({status:ready?'ready':'idle',message:'',response:ready?{views:[{view:'sole-left',candidates,covered_ratio:1,uncovered_ratio:0}]}:null}),calculate:async()=>{ready=true},cancelPending(){}};
 matching.localMatching.forView=()=>fake;const p=instance(pageDef);
 try{p.onLoad({view:'sole-left'});tap(p,.2,.2);tap(p,.3,.2);tap(p,.25,.3);p.closePolygon();p.finish();await p.calculate();
  assert.equal(p.data.resultMode,true);assert.deepEqual(p.data.atlasRegions.map(r=>r.id),['A1','A2','B1']);assert.equal(p.data.labels.length,2);
  p.chooseCandidate({currentTarget:{dataset:{id:'A'}}});assert.deepEqual(p.data.atlasRegions.map(r=>r.id),['A1','A2']);p.showAll();assert.equal(p.data.atlasRegions.length,3);
  p.edit();assert.equal(p.data.resultMode,false);assert.equal(p.data.atlasRegions.length,0);
 }finally{p.onUnload();models['sole-left'].atlas=saved;matching.localMatching.forView=original;}
});
test('return to body skips chooser and preserves stacked select state',()=>{
 setup();const p=instance(pageDef),old=global.getCurrentPages;let delta;global.getCurrentPages=()=>['pages/index/index','pages/select/select','pages/special-parts/special-parts','pages/local-surface/local-surface'].map(route=>({route}));wx.navigateBack=o=>delta=o.delta;
 try{p.returnBody();assert.equal(delta,2);}finally{global.getCurrentPages=old;}
});
async function canvas(width=320,height=400){
 setup();const frames=new Map(),events=[];let seq=0,queries=0,images=0,pendingBounds=null;
 const ctx=new Proxy({},{get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});
 const node={width:0,height:0,getContext:()=>ctx,requestAnimationFrame(cb){frames.set(++seq,cb);return seq},cancelAnimationFrame(id){frames.delete(id)},createImage(){images++;return {set src(v){this._src=v;queueMicrotask(()=>this.onload())}}}};
 const basis={templateId:'SYNTHETIC_PALM',templateVersion:'test',geometryId:'synthetic',regionSetId:'synthetic'};
 const c={data:structuredClone(componentDef.data),properties:{view:'sole-left',layer:{sessionId:'canvas-session',revision:1,view:'sole-left',basis,completed:[],draft:null,selectedId:null},atlasRegions:[],focusBounds:null,disabled:false,layoutRevision:0,interactionBlocked:false},setData(v){Object.assign(this.data,v)},triggerEvent(n,d){events.push([n,d])},createSelectorQuery(){let bounds;const q={select:()=>q,fields:()=>q,boundingClientRect(f){bounds=f;return q},exec(cb){queries++;if(bounds){if(pendingBounds)pendingBounds(()=>bounds({left:20,top:30,width,height}));else queueMicrotask(()=>bounds({left:20,top:30,width,height}));}else queueMicrotask(()=>cb([{node,width,height}]))}};return q}};
 for(const[k,v]of Object.entries(componentDef.methods))c[k]=v.bind(c);componentDef.lifetimes.created.call(c);componentDef.lifetimes.ready.call(c);await flush();
 const frame=async()=>{const calls=[...frames.values()];frames.clear();for(const f of calls)f();await flush()};await frame();
 return {c,node,events,frames,frame,counts:()=>({queries,images}),delayBounds:f=>pendingBounds=f,detach:()=>componentDef.lifetimes.detached.call(c)};
}
test('local-surface Canvas uses shared viewport on three sizes and preserves normalized touch after zoom/reset',async()=>{
 for(const width of [320,375,430]){const h=await canvas(width,400),model=models['sole-left'];
  for(const target of [null,{x:.15,y:.15,width:.4,height:.5},null]){h.c.properties.focusBounds=target;h.c.queueDraw();await h.frame();const full=fitViewport(width,400,model,12),v=target?focusViewport(full,target):full,q=normalizedToCanvas(P(.3,.3),v),e={changedTouches:[{x:q.x,y:q.y}]};
   h.c.touchStart(e);await h.c.touchEnd(e);const probe=h.events.filter(([n])=>n==='point').at(-1)[1];assert.equal(probe.view,'sole-left');assert.ok(Math.abs(probe.point.x-.3)<1e-12&&Math.abs(probe.point.y-.3)<1e-12);
  }
  assert.equal(h.counts().images,1);h.detach();assert.equal(h.frames.size,0);
 }
});
test('local-surface Canvas coalesces draw requests, rejects air, drag gestures and stale asynchronous hand touches',async()=>{
 const h=await canvas();for(let i=0;i<20;i++)h.c.queueDraw();assert.equal(h.frames.size,1);await h.frame();assert.equal(h.counts().queries,1);
 const v=fitViewport(320,400,models['sole-left'],12),q=normalizedToCanvas(P(.02,.02),v),e={changedTouches:[{x:q.x,y:q.y}]};h.c.touchStart(e);await h.c.touchEnd(e);assert.equal(h.events.at(-1)[1].status,'outside');
 const n=h.events.length;h.c.touchStart({changedTouches:[{x:100,y:100}]});h.c.touchMove({changedTouches:[{x:150,y:100}]});await h.c.touchEnd({changedTouches:[{x:150,y:100}]});assert.equal(h.events.length,n);
 let release;h.delayBounds(fn=>release=fn);const p=normalizedToCanvas(P(.3,.3),v),client={changedTouches:[{clientX:p.x+20,clientY:p.y+30}]};h.c.touchStart(client);const pending=h.c.touchEnd(client);h.c.properties.view='sole-right';release();await pending;assert.equal(h.events.length,n);
 h.c.properties.view='sole-left';h.c.touchStart({changedTouches:[{x:100,y:100}]});h.c.properties.view='sole-right';await h.c.touchEnd({changedTouches:[{x:100,y:100}]});assert.equal(h.events.length,n);
 h.c.queueDraw();h.detach();assert.equal(h.frames.size,0);
});
test('routes retain soles with explicit axilla entries, no retired palms or AI placement entry',()=>{
 const root=path.resolve(__dirname,'../..'),app=JSON.parse(fs.readFileSync(path.join(root,'miniprogram/app.json')));for(const name of ['special-parts/special-parts','local-surface/local-surface'])assert.ok(app.pages.includes('pages/'+name));
 const markup=fs.readFileSync(path.join(root,'miniprogram/pages/special-parts/special-parts.wxml'),'utf8');for(const v of ['sole-left','sole-right','axilla-left','axilla-right'])assert.ok(markup.includes(v));assert.doesNotMatch(markup,/palm-left|palm-right|perineum|thigh/);
 const palm=fs.readFileSync(path.join(root,'miniprogram/pages/local-surface/local-surface.wxml'),'utf8');assert.doesNotMatch(palm,/AI 辅助/);assert.match(palm,/!atlasReady/);
});
test('Canvas preserves touch-start session/revision across touchend and delayed rectangle lookup',async()=>{
 const h=await canvas(),v=fitViewport(320,400,models['sole-left'],12),q=normalizedToCanvas(P(.3,.3),v),e={changedTouches:[{x:q.x,y:q.y}]},client={changedTouches:[{clientX:q.x+20,clientY:q.y+30}]};
 const count=()=>h.events.filter(([n])=>n==='point').length;
 h.c.touchStart(e);h.c.properties.layer={...h.c.properties.layer,revision:2};await h.c.touchEnd(e);assert.equal(count(),0);
 for(const change of [{revision:3},{sessionId:'replacement-session'}]){
  let release;h.delayBounds(fn=>release=fn);h.c.touchStart(client);const pending=h.c.touchEnd(client);h.c.properties.layer={...h.c.properties.layer,...change};release();await pending;assert.equal(count(),0);
 }
 h.c.touchStart(e);await h.c.touchEnd(e);const probe=h.events.at(-1)[1];assert.equal(count(),1);assert.equal(probe.sessionId,'replacement-session');assert.equal(probe.revision,3);h.detach();
});
