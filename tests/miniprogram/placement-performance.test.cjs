// Production performance invariants, exact geometry and lifecycle. Not native FPS.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {syntheticPhoto}=require('./placement-fixtures.cjs');
const load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const g=load('utils/placement-geometry.js'),{PlacementPreview}=load('components/placement-overlay/preview.js');
const {PlacementSessionStore}=load('state/placement-session.js'),{AnnotationSessionStore}=load('state/annotation-session.js');
const {getBodyModel}=load('data/body-models.js'),{fitViewport,focusViewport,projectNormalizedToCanvas}=load('utils/coordinate.js');
const model=getBodyModel('back'),region=model.regions.find(r=>r.id==='back-upper-back');
const flush=async()=>{for(let i=0;i<50;i++)await Promise.resolve()};
function context(){const calls=[];const ctx=new Proxy({calls},{get(o,k){if(k in o)return o[k];return (...a)=>calls.push([k,...a])},set(o,k,v){o[k]=v;return true}});return ctx;}
for(const count of [100,500,2000])for(const multi of [false,true])test(`preview caches ${count} vertices / ${multi?'five pieces with five holes':'single piece'} without modifying source or final geometry`,()=>{
 const source=syntheticPhoto(count,multi),original=JSON.stringify(source),prepared=g.preparePhotoGeometry(source),cached=[];
 global.wx={createOffscreenCanvas({width,height}){const ctx=context(),node={width,height,getContext:()=>ctx};cached.push({ctx,node});return node}};
 const preview=new PlacementPreview(prepared);assert.equal(cached.length,1);assert.ok(cached[0].node.width<=2048&&cached[0].node.height<=2048);
 assert.equal(cached[0].ctx.calls.filter(c=>c[0]==='lineTo'||c[0]==='moveTo').length,count);
 assert.equal(cached[0].ctx.calls.filter(c=>c[0]==='closePath').length,multi?10:1);
 const base=g.initialPlacement(prepared,model,region),ctx=context();
 for(let i=0;i<120;i++)preview.draw(ctx,focusViewport(fitViewport(375,500,model),region.bounds),{...base,scale:.5+i/200,rotationDegrees:i-60},model,true);
 assert.equal(cached.length,1,'no cache recreation for translation/scale/rotation');assert.equal(ctx.calls.filter(c=>c[0]==='drawImage').length,120);
 assert.equal(ctx.calls.filter(c=>c[0]==='lineTo').length,360,'only 3 box edges each moving frame, never source rings');
 assert.equal(ctx.calls.filter(c=>c[0]==='fill').length,0);
 const settled=context();preview.draw(settled,fitViewport(320,500,model),base,model,false);
 assert.equal(settled.calls.filter(c=>c[0]==='lineTo'||c[0]==='moveTo').length,count,'settled preview draws every original vertex');
 assert.equal(settled.calls.filter(c=>c[0]==='closePath').length,multi?10:1);assert.equal(JSON.stringify(source),original);
 preview.dispose();assert.equal(cached[0].node.width,1);assert.equal(cached[0].node.height,1);
});
test('in-flight state changes only immutable scalar transform; settle validates once and confirm recomputes fully once',()=>{
 const annotations=new AnnotationSessionStore(),store=new PlacementSessionStore(annotations),source=syntheticPhoto(2000,true),r=store.open(source,'back',region.id,()=>true),id=r.draft.id,owner=store.acquire(id),before=annotations.snapshot(),initial=r.draft;
 let transforms=0,checks=0;const transform=g.transformPhotoPolygonToBody,validate=g.validatePlacementGeometry;
 g.transformPhotoPolygonToBody=(...a)=>{transforms++;return transform(...a)};g.validatePlacementGeometry=(...a)=>{checks++;return validate(...a)};
 try{
  for(let i=0;i<120;i++){const result=store.update(id,owner,{...initial.transform,scale:.5+i/400,rotationDegrees:i/5},false);assert.equal(result.ok,true);assert.equal(result.draft.geometry,initial.geometry);assert.equal(result.draft.prepared,initial.prepared);}
  assert.equal(transforms,0);assert.equal(checks,0);assert.equal(annotations.snapshot(),before);
  assert.equal(store.confirm(id,owner).ok,false,'in-flight cached geometry cannot commit');
  const d=store.read(id,owner).draft,t={...d.transform,scale:.7,rotationDegrees:25};const settled=store.update(id,owner,t,true);
  assert.equal(settled.draft.validation.ok,true);assert.equal(transforms,1);assert.equal(checks,1);assert.equal(settled.draft.geometryRevision,settled.draft.revision);
  store.update(id,owner,t,true);assert.equal(transforms,1,'duplicate end callback does not repeat checks');
  assert.equal(store.confirm(id,owner).ok,true);assert.equal(transforms,2);assert.equal(checks,2,'confirmation never trusts an earlier successful check');
  const saved=annotations.snapshot().views.back.completed[0];assert.deepEqual(saved.geometry,transform(initial.prepared,t,model));assert.equal(saved.geometry.coordinates.flat(2).length,2000);
  assert.equal(saved.geometry.coordinates.length,5);assert.equal(saved.geometry.coordinates.reduce((n,p)=>n+p.length-1,0),5);assert.deepEqual(saved.source.photo,source);
 }finally{g.transformPhotoPolygonToBody=transform;g.validatePlacementGeometry=validate;}
});
test('invalid scalar parameters still reject without an intermediate full transform',()=>{
 const store=new PlacementSessionStore(new AnnotationSessionStore()),r=store.open(syntheticPhoto(),'back',region.id,()=>true),owner=store.acquire(r.draft.id);
 for(const bad of [{scale:0},{scale:Infinity},{rotationDegrees:181},{translation:{x:NaN,y:0}},{target:{...r.draft.transform.target,view:'front'}}])
  assert.equal(store.update(r.draft.id,owner,{...r.draft.transform,...bad},false).ok,false);
});
test('preview affine coordinates match exact body transform at 320/375/430 widths, full and focused views; holes remain unfilled',()=>{
 const prepared=g.preparePhotoGeometry(syntheticPhoto(100,true)),base=g.initialPlacement(prepared,model,region);global.wx={};const preview=new PlacementPreview(prepared);
 for(const width of [320,375,430])for(const focus of [false,true])for(const degrees of [-180,-25,0,90,180]){
  const full=fitViewport(width,500,model),vp=focus?focusViewport(full,region.bounds):full,t={...base,scale:.71,rotationDegrees:degrees,translation:{x:.5,y:.28}},ctx=context();
  preview.draw(ctx,vp,t,model,false);
  const [a,b,c,d,tx,ty]=ctx.calls.find(c=>c[0]==='transform').slice(1),[cx,cy]=ctx.calls.find(c=>c[0]==='translate').slice(1);
  const exact=g.transformPhotoPolygonToBody(prepared,t,model).coordinates.flat(2).map(q=>projectNormalizedToCanvas(q,vp));
  const drawn=ctx.calls.filter(c=>c[0]==='moveTo'||c[0]==='lineTo').map(([,x,y])=>({x:a*(x+cx)+c*(y+cy)+tx,y:b*(x+cx)+d*(y+cy)+ty}));
  assert.equal(drawn.length,exact.length);for(const q of drawn)assert.ok(exact.some(p=>Math.hypot(p.x-q.x,p.y-q.y)<1e-9));
  const holeCenter={x:.2,y:.25},inside={x:.27,y:.25};
  const transformPoint=q=>{const k=t.baseScale*t.scale,rad=degrees*Math.PI/180,x=(q.x*prepared.width-t.photoCenter.x)*k,y=(q.y*prepared.height-t.photoCenter.y)*k;return {x:t.translation.x+(Math.cos(rad)*x-Math.sin(rad)*y)/model.logicalWidth,y:t.translation.y+(Math.sin(rad)*x+Math.cos(rad)*y)/model.logicalHeight}};
  assert.equal(preview.hit(transformPoint(holeCenter),t,model),false);assert.equal(preview.hit(transformPoint(inside),t,model),true);
 }
});
test('unsupported offscreen or failing cached draw falls back to complete vector preview',()=>{
 const p=g.preparePhotoGeometry(syntheticPhoto(100,true)),t=g.initialPlacement(p,model,region),v=fitViewport(375,500,model);
 for(const mode of ['missing','create-fails','draw-fails']){
  global.wx=mode==='missing'?{}:{createOffscreenCanvas(){if(mode==='create-fails')throw Error('unsupported');return {width:10,height:10,getContext:()=>context()}}};
  const preview=new PlacementPreview(p),ctx=context();if(mode==='draw-fails')ctx.drawImage=()=>{throw Error('canvas source unsupported')};
  preview.draw(ctx,v,t,model,true);assert.equal(ctx.calls.filter(c=>c[0]==='fill').length,5);assert.equal(ctx.calls.filter(c=>c[0]==='closePath').length,11);
 }
});
let def;global.Component=d=>def=d;load('components/placement-overlay/placement-overlay.js');
function overlayFixture(){
 const p=g.preparePhotoGeometry(syntheticPhoto(100,true)),t=g.initialPlacement(p,model,region),v=focusViewport(fitViewport(375,500,model),region.bounds);
 const ctx=context(),frames=new Map(),events=[],queries=[],caches=[];let id=0,delay=false;
 const node={width:0,height:0,getContext:()=>ctx,requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:n=>frames.delete(n)};
 global.wx={nextTick:queueMicrotask,getWindowInfo:()=>({pixelRatio:2}),createOffscreenCanvas:o=>{const node={...o,getContext:()=>context()};caches.push(node);return node}};
 const o={properties:{view:'back',prepared:p,transform:t,viewport:v,interactionKey:'A',revision:0,disabled:false},triggerEvent:(n,d)=>events.push({n,d}),
 createSelectorQuery(){let rect;const q={select:()=>q,fields:()=>q,boundingClientRect:f=>{rect=f;return q},exec(cb){const run=()=>rect?rect({left:20,top:50}):cb([{node}]);queries.push(run);if(!delay)run()}};return q;}};
 for(const[k,f]of Object.entries(def.methods))o[k]=f.bind(o);def.lifetimes.created.call(o);def.lifetimes.ready.call(o);
 const frame=async()=>{await flush();const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f());await flush()};
 return {o,node,frames,events,caches,ctx,queries,frame,t,setDelay:v=>delay=v};
}
test('one pending frame coalesces rapid scale/rotation, releases resources on exit, and does no idle looping',async()=>{
 const h=overlayFixture();await h.frame();assert.equal(h.caches.length,1);const initialEvents=h.events.length;h.ctx.calls.length=0;
 for(let i=1;i<=120;i++)h.o.previewTransform({...h.t,scale:.5+i/400,rotationDegrees:i/5},i,'A');
 assert.equal(h.frames.size,1);await h.frame();assert.equal(h.frames.size,0);assert.equal(h.events.length,initialEvents,'moving frames do not publish page renderstate');assert.equal(h.caches.length,1);assert.equal(h.ctx.calls.filter(c=>c[0]==='drawImage').length,1);
 h.o.previewTransform({...h.t,scale:.7},121,'A');def.pageLifetimes.hide.call(h.o);assert.equal(h.frames.size,0);const calls=h.ctx.calls.length;await h.frame();assert.equal(h.ctx.calls.length,calls);
 def.pageLifetimes.show.call(h.o);await h.frame();assert.equal(h.caches.length,1,'resume does not regenerate texture');
 h.o.previewTransform({...h.t,scale:.6},122,'A');def.lifetimes.detached.call(h.o);assert.equal(h.frames.size,0);assert.equal(h.caches[0].width,1);await h.frame();assert.equal(h.frames.size,0);
});
test('source change and late async start cannot mutate new source, lower revision starts correctly',async()=>{
 const h=overlayFixture();await h.frame();h.o.previewTransform({...h.t,scale:.7},50,'A');h.setDelay(true);
 const a=projectNormalizedToCanvas(h.t.translation,h.o.properties.viewport),event={touches:[{clientX:a.x+20,clientY:a.y+50}],changedTouches:[{clientX:a.x+20,clientY:a.y+50}]};
 const start=h.o.touchStart(event),end=h.o.touchEnd(event);const late=h.queries.at(-1);
 h.o.properties.interactionKey='B';h.o.properties.prepared=g.preparePhotoGeometry(syntheticPhoto(500,true));Object.values(def.observers)[0].call(h.o);
 late();await Promise.all([start,end]);assert.equal(h.events.filter(x=>x.n==='placementdrag').length,0);
 h.o.previewTransform({...h.t,scale:.6},1,'B');await h.frame();assert.equal(h.caches.length,2);assert.equal(h.caches[0].width,1);assert.ok(h.ctx.calls.some(c=>c[0]==='drawImage'));
 def.lifetimes.detached.call(h.o);
});

test('timer fallback still coalesces frames and a hidden page cancels the pending draw',async()=>{
 const h=overlayFixture();await h.frame();h.node.requestAnimationFrame=undefined;h.node.cancelAnimationFrame=undefined;h.ctx.calls.length=0;
 for(let i=1;i<=50;i++)h.o.previewTransform({...h.t,scale:.5+i/100},i,'A');
 await new Promise(r=>setTimeout(r,25));assert.equal(h.ctx.calls.filter(c=>c[0]==='drawImage').length,1);
 h.o.previewTransform({...h.t,scale:.6},51,'A');def.pageLifetimes.hide.call(h.o);const before=h.ctx.calls.length;
 await new Promise(r=>setTimeout(r,25));assert.equal(h.ctx.calls.length,before);def.lifetimes.detached.call(h.o);
});
