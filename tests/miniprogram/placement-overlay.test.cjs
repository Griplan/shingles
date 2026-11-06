const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const {getBodyModel}=load('data/body-models.js'),{fitViewport,focusViewport,normalizedToCanvas}=load('utils/coordinate.js');
const {preparePhotoGeometry,initialPlacement}=load('utils/placement-geometry.js');
let def;global.Component=o=>def=o;load('components/placement-overlay/placement-overlay.js');
const flush=async()=>{for(let i=0;i<50;i++)await Promise.resolve()};
function harness(){
 const model=getBodyModel('back'),region=model.regions.find(r=>r.id==='back-upper-back');
 const prepared=preparePhotoGeometry({schema_version:'confirmed-photo-segmentation-v1',coordinate_space:'photo_oriented_normalized_v1',confirmed_by_user:true,image:{width:100,height:100},geometry:{type:'MultiPolygon',coordinates:[[[[.1,.1],[.9,.1],[.9,.9],[.1,.9],[.1,.1]],[[.3,.3],[.3,.7],[.7,.7],[.7,.3],[.3,.3]]]]}});
 const transform=initialPlacement(prepared,model,region),viewport=focusViewport(fitViewport(375,500,model),region.bounds),calls=[],events=[],bounds=[];
 const ctx={};for(const k of ['save','restore','clearRect','setTransform','transform','translate','drawImage','beginPath','rect','clip','moveTo','lineTo','closePath','fill','stroke','arc','setLineDash','strokeRect'])ctx[k]=(...a)=>calls.push([k,...a]);
 const node={width:0,height:0,getContext:()=>ctx,requestAnimationFrame:f=>{queueMicrotask(f);return 1},cancelAnimationFrame(){}};let delay=false;
 global.wx={nextTick:f=>queueMicrotask(f),getWindowInfo:()=>({pixelRatio:2})};
 const obj={properties:{view:'back',prepared,transform,viewport,interactionKey:'test:1',revision:0,disabled:false},triggerEvent(n,d){events.push({n,d})},
 createSelectorQuery(){let bound;const q={select:()=>q,fields:()=>q,boundingClientRect:cb=>{bound=cb;return q},exec:cb=>{if(bound){const f=()=>bound({left:25,top:80,width:375,height:500});if(delay)bounds.push(f);else f();}else cb([{node,width:375,height:500}]);}};return q;}};
 for(const[k,v]of Object.entries(def.methods))obj[k]=v.bind(obj);def.lifetimes.created.call(obj);def.lifetimes.ready.call(obj);
 const center=normalizedToCanvas(transform.translation,viewport),event=(dx=0,dy=0)=>({touches:[{clientX:center.x+25+dx,clientY:center.y+80+dy}],changedTouches:[{clientX:center.x+25+dx,clientY:center.y+80+dy}]});
 return {obj,node,calls,events,bounds,event,setDelay:v=>delay=v};
}
test('transparent placement canvas draws all rings, a visible move handle, and CSS-sized strokes',async()=>{
 const h=harness();await flush();assert.equal(h.node.width,750);assert.equal(h.node.height,1000);assert.equal(h.calls.filter(c=>c[0]==='moveTo').length,4);assert.ok(h.calls.some(c=>c[0]==='arc'&&c[3]===14));assert.equal(h.events.at(-1).d.ready,true);
});
test('handle drags an entire multi-ring patch with ordered async touch events, without a body selection or vertex event',async()=>{
 const h=harness();await flush();h.setDelay(true);const start=h.obj.touchStart(h.event()),move=h.obj.touchMove(h.event(10,20)),end=h.obj.touchEnd(h.event(30,40));
 const callbacks=h.bounds.splice(0);assert.equal(callbacks.length,1,'one layout measurement shared by ordered touch events');await flush();assert.equal(h.events.filter(e=>e.n==='placementdrag').length,0);callbacks[0]();await Promise.all([start,move,end]);
 const drags=h.events.filter(e=>e.n==='placementdrag');assert.deepEqual(drags.map(e=>e.d.phase),['start','move','end']);assert.ok(drags[2].d.delta.x>0);assert.ok(drags[2].d.delta.y>0);
 assert.equal(h.events.filter(e=>e.n==='annotationpoint'||e.n==='regionprobe').length,0);
});
test('new source key, cancel and viewport changes invalidate old drag queries',async()=>{
 for(const change of ['key','cancel','viewport']){
  const h=harness();await flush();h.setDelay(true);const start=h.obj.touchStart(h.event()),end=h.obj.touchEnd(h.event(30,40));
  if(change==='key')h.obj.properties.interactionKey='new:2';if(change==='viewport')h.obj.properties.viewport=fitViewport(375,500,getBodyModel('back'));
  if(change==='cancel')h.obj.touchCancel();else def.observers['view,prepared,transform,viewport,interactionKey,revision,disabled'].call(h.obj);
  h.bounds.shift()();await Promise.all([start,end]);assert.equal(h.events.filter(e=>e.n==='placementdrag'&&e.d.phase==='end').length,0);
 }
});
test('background touch does not start dragging and repeated same-value redraw keeps the current gesture',async()=>{
 const h=harness();await flush();const e={changedTouches:[{x:2,y:2}]};await h.obj.touchStart(e);await h.obj.touchEnd(e);assert.equal(h.events.filter(e=>e.n==='placementdrag').length,0);
 await h.obj.touchStart(h.event());def.observers['view,prepared,transform,viewport,interactionKey,revision,disabled'].call(h.obj);await flush();await h.obj.touchEnd(h.event(15,15));
 assert.equal(h.events.filter(e=>e.n==='placementdrag'&&e.d.phase==='end').length,1);
});
