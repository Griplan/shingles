const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),build=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {ATLAS_MANIFEST:M,ATLAS_REGIONS:R}=build('data/atlas.generated.js');
const {isAtlasPreviewEnvironment,canPreviewAtlas}=build('config/development.js');
const {atlasRegionsForView:regions,atlasFocusBounds:bounds,atlasLabelOptions:options,atlasLabelName:labelName,atlasLocalFocusBounds:localBounds}=build('utils/atlas-view.js');
const {drawAtlas}=build('components/body-canvas/atlas-render.js');
const {getBodyModel}=build('data/body-models.js');
const {fitViewport,focusViewport,normalizedToCanvas,canvasToNormalized}=build('utils/coordinate.js');
const fixture=require('../../backend/tests/fixtures/synthetic-atlas-render.json');
function page(env='develop'){
 let def;global.Page=o=>{def=o;};const route=path.join(process.env.DERMATOME_BUILD_DIR,'pages/atlas-debug/atlas-debug.js');delete require.cache[require.resolve(route)];require(route);
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:env}})};
 const p={data:structuredClone(def.data),setData(c){Object.assign(this.data,c);}};
 for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);
 p.onLoad({debug:true,enable:true,env:'develop'});p.onShow();return p;
}
const event=dataset=>({currentTarget:{dataset}});
function ctx(){let depth=0;const calls=[],c={calls,measureText:s=>({width:s.length*5})};
 for(const n of ['beginPath','rect','clip','setLineDash','moveTo','lineTo','closePath','stroke','strokeText','fillText'])c[n]=(...a)=>calls.push([n,...a]);
 c.fill=()=>calls.push(['fill',c.fillStyle,c.globalAlpha,c.lineWidth]);
 c.save=()=>{depth++;};c.restore=()=>{depth--;};c.depth=()=>depth;return c;}
const layer=(rr,more={})=>({atlasVersion:M.atlasVersion,templateId:M.templateId,templateVersion:M.templateVersion,geometryId:M.geometryId,view:'front',regions:rr,showLabels:false,...more});
test('V3 environment fails closed for trial/release/missing/errors and master disable; query cannot grant access',()=>{
 for(const env of ['develop','trial','release','',undefined,'development'])assert.equal(isAtlasPreviewEnvironment({miniProgram:{envVersion:env}}),env==='develop');
 for(const a of [null,undefined,{},[],{envVersion:'develop'},{miniProgram:null}])assert.equal(isAtlasPreviewEnvironment(a),false);
 assert.equal(isAtlasPreviewEnvironment({miniProgram:{envVersion:'develop'}},false),false);
 global.wx={getAccountInfoSync(){throw Error('not available');}};assert.equal(canPreviewAtlas(),false);
 for(const env of ['release','trial',null]){const p=page(env);assert.equal(p.data.allowed,false);assert.equal(p.data.layer,null);p.switchView(event({view:'back'}));p.focusSelected();assert.equal(p.data.layer,null);}
});
test('V3 packaged local geometry equals canonical source and hash, not demo numbering or clinical state',()=>{
 const dir=path.join(root,'data/atlas/goran-2022-preview-v3');const canonical=['front','back'].flatMap(v=>JSON.parse(fs.readFileSync(path.join(dir,v+'.json'))).regions);assert.deepEqual(R,canonical);
 const h=crypto.createHash('sha256');for(const n of ['front.json','back.json','source-map.json','registration.json','sources.json','coverage.json','local-registration.json','hand-registration.json'])h.update(n+'\0').update(fs.readFileSync(path.join(dir,n))).update('\0');assert.equal(M.contentSHA256,h.digest('hex'));
 assert.equal(M.mappingEnabled,false);assert.equal(M.medicalReviewStatus,'pending');assert.ok(R.length>100);assert.ok(!R.some(r=>['C1','Co1'].includes(r.labelId)));
 assert.equal(M.atlasVersion,'goran-2022-commons-template4-preview.3');
 assert.ok(!regions(R,'front','both','all','').some(r=>r.labelId==='C7'));assert.ok(regions(R,'back','both','single','C7').length);
 const source=JSON.parse(fs.readFileSync(path.join(dir,'source-map.json')));
 for(const r of R)assert.ok(r.sourcePathIndices.every(i=>source.views[r.view][i].labelId===r.labelId));
});
test('V3 actual labels aggregate all islands, per-view and anatomical-side filtering never mirrors',()=>{
 for(const view of ['front','back'])for(const opt of options(R,view,'both').slice(1)){
  const all=regions(R,view,'both','single',opt.id),left=regions(R,view,'left','single',opt.id),right=regions(R,view,'right','single',opt.id);
  assert.equal(all.length,left.length+right.length);assert.ok(left.every(r=>r.side==='left'&&r.view===view));assert.ok(right.every(r=>r.side==='right'&&r.view===view));
 }
 assert.deepEqual(regions(R,'front','both','hidden','T5'),[]);assert.deepEqual(regions(R,'front','both','single','S5'),[]);
 const before=JSON.stringify(R);regions(R,'back','left','single','T5');assert.equal(JSON.stringify(R),before);
});
test('V3 page full/single/hide, label persistence, absent view, side, focus/reset, label toggle and reentry',()=>{
 const p=page();assert.ok(p.data.allowed);assert.equal(p.data.shownCount,regions(R,'front','both','all','').length);
 let i=p.data.options.findIndex(o=>o.id==='T5');p.chooseLabel({detail:{value:String(i)}});assert.equal(p.data.displayMode,'single');assert.equal(p.data.layer.regions.length,2);assert.equal(p.data.focusBounds,null);
 p.focusSelected();const focus=p.data.focusBounds;assert.ok(focus);i=p.data.options.findIndex(o=>o.id==='T6');p.chooseLabel({detail:{value:String(i)}});assert.equal(p.data.focusBounds,focus);
 p.changeSide(event({side:'left'}));assert.equal(p.data.focusBounds,null);assert.ok(p.data.layer.regions.every(r=>r.side==='left'));
 p.toggleLabels({detail:{value:true}});assert.equal(p.data.layer.showLabels,true);p.changeMode(event({mode:'hidden'}));assert.deepEqual(p.data.layer.regions,[]);
 p.switchView(event({view:'back'}));assert.equal(p.data.labelId,'T6');assert.equal(p.data.screenLeft,'人体左侧');
 i=p.data.options.findIndex(o=>o.id==='S5');p.chooseLabel({detail:{value:String(i)}});assert.ok(p.data.shownCount>0);p.switchView(event({view:'front'}));assert.equal(p.data.labelId,'S5');assert.equal(p.data.shownCount,0);assert.equal(p.data.message,'此视图暂无该区域');
 p.clearSelection();assert.equal(p.data.displayMode,'all');p.fullBody();assert.equal(p.data.focusBounds,null);
 const again=page();assert.equal(again.data.view,'front');assert.equal(again.data.labelId,'');
 global.wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});p.onShow();assert.equal(p.data.allowed,false);assert.equal(p.data.layer,null);
});
test('V3 atlas operations neither read nor write an existing V2 authority, including an unfinished draft',()=>{
 const {annotationSession:s,sessionToken}=build('state/annotation-session.js');s.open('front','front-chest');let x=s.snapshot();s.dispatch(sessionToken(x),{type:'add',point:{x:.5,y:.3}});x=s.snapshot();const json=JSON.stringify(x);
 const names=['snapshot','read','open','dispatch'],saved=Object.fromEntries(names.map(n=>[n,s[n]]));for(const n of names)s[n]=()=>{throw Error('V3 touched V2 '+n);};
 try{const p=page();const i=p.data.options.findIndex(o=>o.id==='T5');p.chooseLabel({detail:{value:String(i)}});p.changeSide(event({side:'right'}));p.switchView(event({view:'back'}));p.focusSelected();p.fullBody();p.clearSelection();
  p.changeGroup(event({group:'trigeminal'}));p.chooseFace(event({label:'V1'}));p.focusLocal(event({focus:'face'}));p.switchView(event({view:'front'}));p.focusLocal(event({focus:'face'}));p.changeGroup(event({group:'spinal'}));p.focusLocal(event({focus:'left-foot'}));p.focusLocal(event({focus:'right-foot'}));page();}
 finally{for(const n of names)s[n]=saved[n];}
 assert.equal(s.snapshot(),x);assert.equal(JSON.stringify(s.snapshot()),json);
 for(const f of ['pages/atlas-debug/atlas-debug.ts','utils/atlas-view.ts','components/body-canvas/atlas-render.ts'])assert.doesNotMatch(fs.readFileSync(path.join(root,'miniprogram',f),'utf8'),/annotationSession|\.snapshot\(|\/evaluate|services\/api/);
});
test('V3 draw MultiPolygon/hole uses closed paths from the same normalized coordinates; bbox only focuses',()=>{
 const r={...R.find(r=>r.view==='front'),id:'synthetic-UI-ISLAND',labelId:fixture.label,geometry:{type:'MultiPolygon',coordinates:fixture.coordinates}};
 const t=fitViewport(343,540,getBodyModel('front')),c=ctx();drawAtlas(c,t,getBodyModel('front'),layer([r]));
 assert.equal(c.calls.filter(x=>x[0]==='fill').length,2);assert.equal(c.calls.filter(x=>x[0]==='moveTo').length,3);assert.equal(c.calls.filter(x=>x[0]==='closePath').length,3);
 const first=normalizedToCanvas({x:.2,y:.2},t);assert.deepEqual(c.calls.find(x=>x[0]==='moveTo'),['moveTo',first.x,first.y]);assert.equal(c.calls.filter(x=>x[0]==='rect').length,1);assert.equal(c.depth(),0);
 const b=bounds([r]);assert.ok(b.x<=.2&&b.x+b.width>=.7);assert.equal(bounds([]),null);
});
test('V3 wrong template/version/view/atlas identity fails closed; default null draws nothing',()=>{
 const t=fitViewport(343,540,getBodyModel('front'));
 for(const l of [null,layer(R,{view:'back'}),layer(R,{templateVersion:'old'}),layer(R,{geometryId:'other'})]){const c=ctx();drawAtlas(c,t,getBodyModel('front'),l);assert.equal(c.calls.length,0);}
 for(const field of ['templateId','templateVersion','geometryId','atlasVersion','view']){const c=ctx();drawAtlas(c,t,getBodyModel('front'),layer([{...R[0],[field]:'invalid'}],{showLabels:true}));assert.ok(!c.calls.some(x=>x[0]==='fill'||x[0]==='fillText'));}
});
test('V3 overlay follows existing full/focus/resize transform and CSS stroke width remains fixed',()=>{
 for(const view of ['front','back'])for(const size of [[280,460],[343,540],[700,570]]){
  const rr=regions(R,view,'both','single','T5'),model=getBodyModel(view),base=fitViewport(...size,model),focus=focusViewport(base,bounds(rr));
  for(const t of [base,focus]){const c=ctx();drawAtlas(c,t,model,layer(rr,{view}));assert.ok(c.calls.some(x=>x[0]==='fill'));assert.ok(c.calls.filter(x=>x[0]==='fill').every(x=>x[3]===.8));assert.equal(c.depth(),0);for(const r of rr){const q=canvasToNormalized(normalizedToCanvas(r.labelPoint,t),t);assert.ok(Math.abs(q.x-r.labelPoint.x)<1e-9&&Math.abs(q.y-r.labelPoint.y)<1e-9);}}
 }
});
test('V3 label collisions suppressed, label switch leaves geometry unchanged',()=>{
 const t=fitViewport(343,540,getBodyModel('front')),r=R.find(r=>r.view==='front'&&r.labelId==='T5');const a=ctx(),b=ctx();drawAtlas(a,t,getBodyModel('front'),layer([r,r],{showLabels:false}));drawAtlas(b,t,getBodyModel('front'),layer([r,r],{showLabels:true}));
 assert.equal(b.calls.filter(x=>x[0]==='fillText').length,1);assert.deepEqual(a.calls.filter(x=>x[0]==='fill'),b.calls.filter(x=>x[0]==='fill'));
});
test('V3.1 group lists use actual labels, retain complete branch names, and disjointly partition all configured geometry',()=>{
 for(const [id,name] of [['V1','三叉神经眼支 V1'],['V2','三叉神经上颌支 V2'],['V3','三叉神经下颌支 V3']]){
  assert.equal(labelName(R,id),name);
  const rr=regions(R,'front','both','single',id,'trigeminal');assert.equal(rr.length,2);
  assert.ok(rr.every(r=>r.partitionType==='trigeminal_sensory'&&r.sourcePathIndices.length>0));
  assert.deepEqual(regions(R,'back','both','single',id,'trigeminal'),[]);
 }
 for(const view of ['front','back'])for(const side of ['both','left','right']){
  const all=regions(R,view,side,'all',''),face=regions(R,view,side,'all','','trigeminal'),spinal=regions(R,view,side,'all','','spinal');
  assert.deepEqual(new Set([...face,...spinal].map(r=>r.id)),new Set(all.map(r=>r.id)));
  assert.ok(!face.some(r=>spinal.includes(r)));
  assert.deepEqual(options(R,view,side,'trigeminal').slice(1).map(o=>o.id),['V1','V2','V3']);
  assert.ok(options(R,view,side,'trigeminal').slice(1).every(o=>o.name.startsWith('三叉神经')));
  assert.ok(!options(R,view,side,'spinal').some(o=>o.id.startsWith('V')));
 }
});
test('V3.1 face direct selection, anatomical side, back no-data and group changes remain consistent with picker geometry',()=>{
 const p=page();p.changeGroup(event({group:'trigeminal'}));assert.equal(p.data.shownCount,6);
 for(const id of ['V1','V2','V3']){
  p.chooseFace(event({label:id}));assert.equal(p.data.selectedText,labelName(R,id));assert.equal(p.data.shownCount,2);
  const direct=p.data.layer.regions;p.chooseLabel({detail:{value:String(p.data.options.findIndex(o=>o.id===id))}});assert.deepEqual(p.data.layer.regions,direct);
  p.changeSide(event({side:'left'}));assert.equal(p.data.shownCount,1);assert.ok(p.data.layer.regions.every(r=>r.side==='left'));
  p.changeSide(event({side:'right'}));assert.equal(p.data.shownCount,1);assert.ok(p.data.layer.regions.every(r=>r.side==='right'));
  p.changeSide(event({side:'both'}));
 }
 p.switchView(event({view:'back'}));assert.equal(p.data.labelId,'V3');assert.equal(p.data.shownCount,0);assert.equal(p.data.message,'此视图暂无该区域');
 p.focusLocal(event({focus:'face'}));assert.equal(p.data.focusBounds,null);assert.match(p.data.message,/背面未配置/);
 p.clearSelection();assert.match(p.data.message,/未配置面部三叉神经/);p.changeGroup(event({group:'spinal'}));assert.ok(p.data.layer.regions.length>0);
 p.switchView(event({view:'front'}));p.chooseFace(event({label:'V1'}));p.changeGroup(event({group:'spinal'}));assert.equal(p.data.labelId,'');assert.equal(p.data.displayMode,'all');
 const before=JSON.stringify(p.data);p.changeGroup(event({group:'invented'}));p.chooseFace(event({label:'C1'}));assert.equal(JSON.stringify(p.data),before);
 const again=page();assert.equal(again.data.group,'all');assert.equal(again.data.labelId,'');
});
test('V3.1 local viewing presets use frozen model coordinates, retain selection and map anatomical feet correctly on each view',()=>{
 const p=page();p.chooseFace(event({label:'V1'}));const before=JSON.stringify(p.data.layer);
 p.focusLocal(event({focus:'face'}));assert.deepEqual(p.data.focusBounds,getBodyModel('front').regions.find(r=>r.id==='front-head').bounds);
 p.fullBody();assert.equal(p.data.focusBounds,null);assert.equal(JSON.stringify(p.data.layer),before);
 for(const view of ['front','back']){
  p.switchView(event({view}));const stable=JSON.stringify(p.data.layer);
  for(const side of ['left','right']){
   p.focusLocal(event({focus:side+'-foot'}));const b=p.data.focusBounds;assert.ok(b&&b.y>.85&&b.y+b.height<=1);
   assert.equal(b.x+b.width/2>.5,(side==='left')===(view==='front'));assert.equal(JSON.stringify(p.data.layer),stable);
   for(const size of [[280,460],[343,540],[700,570]]){
    const t=focusViewport(fitViewport(...size,getBodyModel(view)),b),point={x:b.x+b.width/2,y:b.y+b.height/2};
    const round=canvasToNormalized(normalizedToCanvas(point,t),t);assert.ok(Math.abs(round.x-point.x)<1e-9&&Math.abs(round.y-point.y)<1e-9);
   }
  }
 }
 assert.equal(localBounds({...getBodyModel('front'),version:'unknown'},'left-foot'),null);
});
test('V3.1 full-body suppresses small face/foot text only; local zoom restores labels without changing painted polygons',()=>{
 const model=getBodyModel('front'),base=fitViewport(343,540,model),face=regions(R,'front','both','single','V1')[0];assert.ok(face);
 const foot={...R.find(r=>r.view==='front'&&r.labelId==='T5'),id:'synthetic-UI-FOOT',labelId:'UI-ISLAND',labelPoint:{x:.62,y:.95},
  geometry:{type:'MultiPolygon',coordinates:fixture.coordinates.map(p=>p.map(r=>r.map(([x,y])=>[.55+x*.15,.93+y*.05])))}};
 for(const [r,focus] of [[face,'face'],[foot,'left-foot']]){
  const a=ctx(),b=ctx(),c=ctx();drawAtlas(a,base,model,layer([r]));drawAtlas(b,base,model,layer([r],{showLabels:true}));
  assert.deepEqual(a.calls.filter(x=>['fill','moveTo','lineTo'].includes(x[0])),b.calls.filter(x=>['fill','moveTo','lineTo'].includes(x[0])));
  assert.equal(b.calls.filter(x=>x[0]==='fillText').length,0);
  drawAtlas(c,focusViewport(base,localBounds(model,focus)),model,layer([r],{showLabels:true}));assert.equal(c.calls.filter(x=>x[0]==='fillText').length,1);
  assert.equal(c.calls.filter(x=>x[0]==='fill').length,a.calls.filter(x=>x[0]==='fill').length);
 }
});
test('V3.1 every added action rechecks development access and cannot retain a previously visible overlay',()=>{
 for(const [method,arg] of [['changeGroup',event({group:'trigeminal'})],['chooseFace',event({label:'V1'})],['focusLocal',event({focus:'face'})],['focusLocal',event({focus:'left-foot'})]]){
  const p=page();p.chooseFace(event({label:'V1'}));p.focusLocal(event({focus:'face'}));assert.ok(p.data.layer&&p.data.focusBounds);
  global.wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});p[method](arg);assert.equal(p.data.allowed,false);assert.equal(p.data.layer,null);assert.equal(p.data.focusBounds,null);
 }
});
test('V3 homepage hides production entry and rechecks a stale visible button before navigation',()=>{
 let def,route='';global.Page=o=>{def=o;};const f=path.join(process.env.DERMATOME_BUILD_DIR,'pages/index/index.js');delete require.cache[require.resolve(f)];require(f);
 let env='release';global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),navigateTo:o=>{route=o.url;}};
 const p={data:structuredClone(def.data),setData(c){Object.assign(this.data,c);}};for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);
 p.onShow();assert.equal(p.data.atlasPreviewAllowed,false);p.openAtlasPreview();assert.equal(route,'');env='develop';p.onShow();assert.equal(p.data.atlasPreviewAllowed,true);
 env='release';p.openAtlasPreview();assert.equal(route,'');env='develop';p.openAtlasPreview();assert.equal(route,'/pages/atlas-debug/atlas-debug');
 global.wx.getAccountInfoSync=()=>{throw Error('unavailable');};p.onShow();assert.equal(p.data.atlasPreviewAllowed,false);
});
