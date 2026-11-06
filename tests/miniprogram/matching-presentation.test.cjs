// Synthetic protocol responses; real packaged geometry / page / renderer, not clinical tests or native GUI.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {ATLAS_REGIONS:R}=load('data/atlas.generated.js');
const {presentation,placeLabels,screenSide,stageHeight}=load('utils/matching-presentation.js');
const {fitViewport,focusViewport}=load('utils/coordinate.js'),{getBodyModel}=load('data/body-models.js');
const event=dataset=>({currentTarget:{dataset}});
function candidates(view){
 const keys=new Set();return R.filter(r=>r.view===view).flatMap(r=>{
  const k=JSON.stringify([r.partitionType,r.labelId,r.side,r.view]);if(keys.has(k))return [];keys.add(k);
  return [{candidate_id:k,region_ids:R.filter(a=>a.view===view&&a.labelId===r.labelId&&a.partitionType===r.partitionType&&a.side===r.side).map(a=>a.id),
   partition_type:r.partitionType,label:r.labelId,display_name:r.displayName||r.labelId,source_label:r.sourceLabel,side:r.side,view,intersection_area:.01,lesion_coverage_ratio:.01}];
 });
}
const C=candidates('front');
test('all mode maps every stable ID once; single retains original MultiPolygon and holes, sides remain distinct',()=>{
 const saved=JSON.stringify(C),all=presentation(C,R,'front','');assert.equal(all.regions.length,R.filter(r=>r.view==='front').length);
 assert.equal(new Set(all.regions.map(r=>r.id)).size,all.regions.length);assert.equal(JSON.stringify(C),saved);
 const withHole=C.find(c=>c.region_ids.some(id=>R.find(r=>r.id===id).geometry.coordinates.some(p=>p.length>1)));
 const single=presentation(C,R,'front',withHole.candidate_id);assert.deepEqual(single.regions.map(r=>r.id),withHole.region_ids);
 for(const r of single.regions)assert.equal(r,R.find(a=>a.id===r.id));
 const other=C.find(c=>c.label===withHole.label&&c.side!==withHole.side);assert.ok(other);
 assert.ok(!single.regions.some(r=>other.region_ids.includes(r.id)));
 assert.throws(()=>presentation([{...withHole,region_ids:[...withHole.region_ids,'UNKNOWN']}],R,'front',''),/不一致/);
 assert.throws(()=>presentation([withHole],R,'back',''),/不一致/);
});
test('front/back side rules and geometric height order preserve backend candidate order and long labels',()=>{
 assert.equal(screenSide('left','front'),'right');assert.equal(screenSide('right','front'),'left');
 assert.equal(screenSide('left','back'),'left');assert.equal(screenSide('right','back'),'right');assert.equal(screenSide('unspecified','back'),'unspecified');
 const labels=presentation([...C].reverse(),R,'front','').labels,saved=JSON.stringify(labels),vp=fitViewport(207,360,getBodyModel('front'));
 const rail=placeLabels(labels,316,vp);assert.equal(JSON.stringify(labels),saved);assert.equal(rail.items.length,labels.length);
 assert.ok(rail.items.every((x,i)=>!i||x.y>=rail.items[i-1].y));
 for(const l of labels){assert.equal(l.label,C.find(c=>c.candidate_id===l.id).label);assert.equal(l.color,R.find(r=>r.id===C.find(c=>c.candidate_id===l.id).region_ids[0]).color);}
});
test('320/375/430 widths and short screen: disjoint rails, uniform body scale, 7/30 labels accessible without overlap; focus reprojection',()=>{
 for(const [width,windowHeight]of [[320,568],[375,603],[430,760],[320,480]]){
  const height=stageHeight(windowHeight),rail=width<=350?64:72,canvas=width-16-2*rail-6;
  const model=getBodyModel('front'),vp=fitViewport(canvas,height,model),area=height-44;
  assert.ok(canvas>=154);assert.ok(vp.scale*model.logicalWidth<=canvas-32+1e-9);
  assert.ok(vp.scale*model.logicalHeight<=height-32+1e-9);
  for(const count of [7,30])for(const viewport of [vp,focusViewport(vp,{x:.4,y:.6,width:.2,height:.2}),vp]){
   const labels=Array.from({length:count},(_,i)=>({id:String(i),name:'三叉神经上颌支 V2',label:'C8/T1',side:'left',color:'#aaa',ratio:'0.01%',y:.2+i/count*.65}));
   const placed=placeLabels(labels,area,viewport);assert.equal(placed.items.length,count);
   assert.ok(placed.items.every((x,i)=>x.top>=0&&x.top+44<=placed.height&&(!i||x.top>=placed.items[i-1].top+48)));
   assert.equal(placed.overflow,count*48-4>area);
  }
 }
});
function harness(){
 for(const file of ['state/annotation-session.js','state/matching-session.js','pages/annotate/annotate.js'])delete require.cache[require.resolve(path.join(process.env.DERMATOME_BUILD_DIR,file))];
 const state=load('state/annotation-session.js'),store=state.annotationSession;
 // Fresh module isolates singleton from other tests; production store session itself stays immutable.
 store.clear?.();
 let def;global.Page=d=>{def=d;};const file=path.join(process.env.DERMATOME_BUILD_DIR,'pages/annotate/annotate.js');delete require.cache[require.resolve(file)];require(file);
 const requests=[],replies=[],routes=[];
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getWindowInfo:()=>({windowHeight:603}),getSystemInfoSync:()=>({platform:'devtools'}),
  request:o=>{requests.push(o);replies.push(()=>{const req=o.data;
   const cov=(view,ids)=>({view,lesion_ids:ids,annotation_area:1,covered_area:.8,uncovered_area:.2,covered_ratio:.8,uncovered_ratio:.2,coverage_status:'partial',
    candidates:candidates(view).slice(0,8)});
   o.success({statusCode:200,data:{request_id:req.request_id,annotation_revision:req.annotation_revision,identity:req.identity,
    method:'manual_annotation_reference_geometry',area_unit:'normalized_template_area',source:{preview:true,medical_review_status:'pending',attribution:'SYNTHETIC UI TEST',coverage_note:'test'},warnings:[],
    lesions:req.lesions.map(l=>cov(l.view,[l.id])),views:[...new Set(req.lesions.map(l=>l.view))].map(v=>cov(v,req.lesions.filter(l=>l.view===v).map(l=>l.id)))}});});},
  navigateBack:()=>routes.push('back'),redirectTo:o=>routes.push(o.url)};
 const make=()=>{const p={data:structuredClone(def.data),setData(c){Object.assign(this.data,c);}};for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);return p;};
 const act=a=>{const r=store.dispatch(state.sessionToken(store.snapshot()),a);assert.ok(r.ok,r.message);};
 const draw=()=>{for(const point of [{x:.48,y:.3},{x:.52,y:.3},{x:.5,y:.32}])act({type:'add',point});act({type:'close'});};
 if(!store.snapshot()){assert.ok(store.open('front','front-chest').ok);draw();act({type:'review'});}
 const open=()=>{const p=make();p.onLoad({sessionId:store.snapshot().sessionId});p.onShow();return p;};
 return {store,act,draw,open,requests,replies};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('one canvas workflow: calculate once, keep viewport, all/single/scope, edit invalidation and cache reentry',async()=>{
 const h=harness(),p=h.open();assert.equal(h.requests.length,0);
 const focus=p.data.zoomRegion,height=p.data.stageHeight;
 const a=p.calculate();p.onShow();void p.calculate();assert.equal(h.requests.length,1);
 assert.equal(p.data.atlas,null);assert.equal(p.data.layer.fillMode,'filled');assert.equal(p.data.zoomRegion,focus);assert.equal(p.data.stageHeight,height);
 h.replies.shift()();await a;assert.equal(p.data.matchStatus,'ready');assert.equal(p.data.selected,'');assert.ok(p.data.atlas.regions.length>1);
 p.onViewportChange({detail:{view:'front',modelId:getBodyModel('front').id,modelVersion:getBodyModel('front').version,viewport:fitViewport(207,height,getBodyModel('front'))}});
 p.onSceneReady({detail:{sceneId:p.data.sceneId,view:p.data.view}});
 const first=h.store.snapshot().views.front.completed[0],allIds=p.data.atlas.regions.map(r=>r.id),candidate=p.data.candidates[0],rails=JSON.stringify(p.data.leftRail);
 p.chooseCandidate(event({id:candidate.id}));assert.equal(p.data.selected,candidate.id);assert.equal(p.data.candidates.length,8);assert.equal(JSON.stringify(p.data.leftRail),rails);
 p.focusSelected();const bounds=p.data.focusBounds;assert.ok(bounds);p.showAll();assert.equal(p.data.focusBounds,bounds);
 p.chooseCandidate(event({id:candidate.id}));p.chooseCandidate(event({id:candidate.id}));assert.equal(p.data.selected,'');assert.equal(p.data.focusBounds,bounds);
 p.chooseScope(event({id:p.data.scopes[0].id}));assert.equal(p.data.layer.completed.length,1);assert.equal(p.data.focusBounds,bounds);
 p.onResize();await p.calculate();assert.equal(h.requests.length,1);assert.equal(p.data.stageHeight,height);
 p.backToEdit();assert.equal(p.data.atlas,null);assert.equal(p.data.layer.fillMode,'filled');assert.equal(p.data.focusBounds,bounds);assert.deepEqual(h.store.snapshot().views.front.completed,[first]);
 p.finish();await p.calculate();assert.equal(h.requests.length,1);assert.ok(p.data.atlas.regions.length);
 p.backToEdit();p.newRegion();assert.equal(p.data.atlas,null);h.draw();p.syncSession();p.finish();const b=p.calculate();assert.equal(h.requests.length,2);h.replies.shift()();await b;
 assert.equal(p.data.matchStatus,'ready');assert.equal(p.data.scopes.length,2);assert.ok(p.data.atlas.regions.length);
 p.switchView(event({view:'back'}));assert.equal(p.data.atlas.regions.length,0);p.switchView(event({view:'front'}));assert.ok(p.data.atlas.regions.length);assert.equal(h.requests.length,2);
 p.onHide();p.onUnload();const q=h.open();q.finish();await q.calculate();assert.equal(h.requests.length,2);q.onUnload();
});
test('prepared view race, request during view switch, stale frame and information/motion controls',async()=>{
 const h=harness(),p=h.open();const started=p.calculate();h.replies.shift()();await started;
 const pending=[];p.selectComponent=()=>({prepareView:view=>new Promise(resolve=>pending.push({view,resolve}))});
 p.switchView(event({view:'back'}));assert.equal(p.data.preparingView,true);assert.equal(p.data.view,'front');
 p.switchView(event({view:'front'}));pending[0].resolve(true);await flush();assert.equal(p.data.view,'front');assert.equal(p.data.preparingView,false);
 p.switchView(event({view:'back'}));pending[1].resolve(true);await flush();assert.equal(p.data.view,'back');assert.equal(p.data.atlas.regions.length,0);
 p.onSceneReady({detail:{sceneId:p.data.sceneId-1,view:'front'}});assert.equal(p.data.sceneReady,false);
 p.onRenderStats({detail:{sceneId:p.data.sceneId,width:209,height:363,transitionMs:205,completedFrameReadyMs:218}});
 p.onRenderStats({detail:{sceneId:p.data.sceneId,width:209,height:363,transitionMs:3,completedFrameReadyMs:4}});
 p.updatePerformance();assert.equal(JSON.parse(p.data.performanceText).transitionMs,205);
 p.openInfo();assert.equal(p.data.infoOpen,true);p.toggleMotion({detail:{value:true}});assert.equal(p.data.motionEnabled,false);
 const beforeBlocked=JSON.stringify({result:p.data.resultMode,focus:p.data.focusBounds,session:p.data.session});
 p.continueEditing();p.fullBody();assert.equal(JSON.stringify({result:p.data.resultMode,focus:p.data.focusBounds,session:p.data.session}),beforeBlocked);
 let copied='';wx.setClipboardData=o=>{copied=o.data;o.success();};p.copySource(event({id:'license'}));assert.match(copied,/creativecommons.org\/licenses\/by-sa\/4.0/);p.closeInfo();
 p.onHide();p.onUnload();
});
test('confirmed polygons fill immediately once each, result outline mode preserves rings and stroke across viewports',()=>{
 const {drawLesions}=load('components/body-canvas/lesion-render.js'),{modelBasis}=load('state/annotation-session.js'),model=getBodyModel('front');
 const completed=[{id:'SYNTHETIC_A',view:'front',ring:[{x:.48,y:.3},{x:.52,y:.3},{x:.5,y:.32},{x:.48,y:.3}]},
  {id:'SYNTHETIC_B',view:'front',ring:[{x:.49,y:.35},{x:.51,y:.35},{x:.5,y:.37},{x:.49,y:.35}]}];
 const layer={basis:modelBasis(model),view:'front',completed,selectedId:completed[0].id,draft:null};
 const context=()=>{const calls=[],c={};for(const n of ['save','restore','beginPath','rect','clip','moveTo','lineTo','closePath','stroke','setLineDash'])c[n]=(...args)=>calls.push([n,...args]);c.fill=()=>calls.push(['fill',c.fillStyle]);return {c,calls};};
 for(const vp of [fitViewport(160,320,model),focusViewport(fitViewport(207,360,model),{x:.4,y:.2,width:.2,height:.3})]){
  const filled=context(),outlined=context();drawLesions(filled.c,vp,model,layer);drawLesions(outlined.c,vp,model,{...layer,fillMode:'outline'});
  assert.equal(filled.calls.filter(c=>c[0]==='fill').length,2);assert.equal(outlined.calls.filter(c=>c[0]==='fill').length,0);
  assert.deepEqual(outlined.calls.filter(c=>['moveTo','lineTo','closePath','stroke'].includes(c[0])),filled.calls.filter(c=>['moveTo','lineTo','closePath','stroke'].includes(c[0])));
 }
});
test('in-flight calculation follows current view; hide cancels response; release gate clears cached colors but attribution stays accessible',async()=>{
 const h=harness(),p=h.open();const work=p.calculate();p.switchView(event({view:'back'}));h.replies.shift()();await work;
 assert.equal(p.data.view,'back');assert.equal(p.data.matchStatus,'ready');assert.equal(p.data.atlas.regions.length,0);
 p.switchView(event({view:'front'}));assert.ok(p.data.atlas.regions.length);
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});p.focusSelected();assert.equal(p.data.atlas,null);assert.equal(p.data.candidates.length,0);
 p.openInfo();assert.equal(p.data.infoOpen,true);assert.ok(p.data.source.attribution);p.closeInfo();await p.calculate();assert.equal(h.requests.length,1);p.onUnload();
 const h2=harness(),q=h2.open();const pending=q.calculate();q.onHide();h2.replies.shift()();await pending;q.onShow();
 assert.equal(q.data.atlas,null);assert.notEqual(q.data.matchStatus,'ready');q.onUnload();
});
