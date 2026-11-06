// Production page/store/component timings with deterministic wx/Canvas adapters.
// Canvas numbers are JS command submission, NOT raster/GPU time or native FPS.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const {performance}=require('node:perf_hooks'),{syntheticPhoto}=require('../tests/miniprogram/placement-fixtures.cjs');
const build=path.resolve(process.argv[2]),output=process.argv[3],load=p=>require(path.join(build,p));
let pageDef,componentDef;global.Page=d=>pageDef=d;global.Component=d=>componentDef=d;
const geo=load('utils/placement-geometry.js');let active=null;
function timed(name,fn){const start=performance.now();try{return fn()}finally{if(active){(active.times[name]??=[]).push(performance.now()-start);active.counts[name]=(active.counts[name]||0)+1}}}
for(const name of ['transformPhotoPolygonToBody','validatePlacementGeometry','preparePhotoGeometry']){const original=geo[name];geo[name]=(...args)=>timed(name,()=>original(...args));}
load('pages/placement/placement.js');load('components/placement-overlay/placement-overlay.js');
const {placementSession}=load('state/placement-session.js'),{annotationSession}=load('state/annotation-session.js');
const {getBodyModel}=load('data/body-models.js'),{fitViewport,focusViewport,normalizedToCanvas}=load('utils/coordinate.js');
const flush=async()=>{for(let i=0;i<50;i++)await Promise.resolve()};
const summary=a=>{a=[...a].sort((x,y)=>x-y);return {count:a.length,total_ms:a.reduce((x,y)=>x+y,0),median_ms:a.length?a[Math.floor(a.length/2)]:0,p95_ms:a.length?a[Math.min(a.length-1,Math.floor(a.length*.95))]:0,max_ms:a.length?a.at(-1):0}};
async function run(vertices,multi,width=375){
 let frameID=0,overlay,p;const frames=new Map(),counters={},times={},phaseResults=[];
 const count=k=>counters[k]=(counters[k]||0)+1;
 const context=()=>new Proxy({},{get(o,k){return k in o?o[k]:(..._args)=>count('canvas.'+k)},set(o,k,v){o[k]=v;return true}});
 const makeNode=(offscreen=false)=>{let w=0,h=0;const ctx=context();return {get width(){return w},set width(v){w=v;count(offscreen?'cache.width':'canvas.width')},get height(){return h},set height(v){h=v;count(offscreen?'cache.height':'canvas.height')},getContext(){count(offscreen?'cache.context':'canvas.context');return ctx},requestAnimationFrame(cb){count('frame.request');frames.set(++frameID,cb);return frameID},cancelAnimationFrame(id){count('frame.cancel');frames.delete(id)}}};
 const node=makeNode();
 global.wx={nextTick:f=>queueMicrotask(f),getWindowInfo:()=>({pixelRatio:2}),getPerformance:()=>performance,
 createOffscreenCanvas:o=>{count('cache.create');const n=makeNode(true);n.width=o.width;n.height=o.height;return n},
 enableAlertBeforeUnload(){},disableAlertBeforeUnload(){}};
 const observer=()=>Object.values(componentDef.observers)[0].call(overlay);
 const sync=()=>{if(!overlay)return;const d=p.data,props={view:d.view,prepared:d.prepared,transform:d.transform,viewport:d.viewport,interactionKey:d.interactionKey,revision:d.revision,disabled:d.dialog||!!d.error};
  const changed=Object.entries(props).some(([k,v])=>overlay.properties[k]!==v);Object.assign(overlay.properties,props);if(changed)observer();};
 active={times:{},counts:{}};const initStart=performance.now();
 const source=syntheticPhoto(vertices,multi),r=placementSession.open(source,'back','back-upper-back',()=>true);assert.equal(r.ok,true,r.message);
 p={data:structuredClone(pageDef.data),selectComponent:()=>overlay,setData(c){timed('page.setData.serialize',()=>{JSON.stringify(c);Object.assign(this.data,c);count('page.setData');sync()})}};
 for(const[k,f]of Object.entries(pageDef))if(typeof f==='function')p[k]=(...a)=>timed('page.'+k,()=>f.apply(p,a));
 p.onLoad({draftId:r.draft.id});p.onShow();
 overlay={properties:{},triggerEvent(n,d){count('event.'+n);if(n==='placementdrag')p.onDrag({detail:d});if(n==='renderstate')p.onOverlayReady({detail:d})},createSelectorQuery(){let bound;const q={select:()=>q,fields:()=>q,boundingClientRect:f=>{bound=f;return q},exec(cb){if(bound){count('bounds.query');queueMicrotask(()=>bound({left:25,top:80,width,height:500}))}else{count('canvas.query');cb([{node,width,height:500}])}}};return q}};
 for(const[k,f]of Object.entries(componentDef.methods))overlay[k]=(...a)=>timed('overlay.'+k,()=>f.apply(overlay,a));
 componentDef.lifetimes.created.call(overlay);sync();componentDef.lifetimes.ready.call(overlay);
 const model=getBodyModel('back'),region=model.regions.find(r=>r.id==='back-upper-back'),vp=focusViewport(fitViewport(width,500,model),region.bounds);
 const frame=async()=>{await flush();const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(performance.now());await flush()};
 p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});await frame();await frame();
 const initialCounts={...counters};
 phaseResults.push({name:'initialization',wall_ms:performance.now()-initStart,counters:{...counters},calls:{...active.counts},timings:Object.fromEntries(Object.entries(active.times).map(([k,v])=>[k,summary(v)]))});active=null;
 async function phase(name,fn){active={times:{},counts:{}};for(const k of Object.keys(counters))delete counters[k];const start=performance.now();await fn();await frame();
  phaseResults.push({name,wall_ms:performance.now()-start,counters:{...counters},calls:{...active.counts},timings:Object.fromEntries(Object.entries(active.times).map(([k,v])=>[k,summary(v)]))});active=null;}
 const handle=normalizedToCanvas(p.data.transform.translation,vp);
 const event=(dx=0,dy=0)=>({touches:[{clientX:handle.x+25+dx,clientY:handle.y+80+dy}],changedTouches:[{clientX:handle.x+25+dx,clientY:handle.y+80+dy}]});
 await phase('continuous-drag-60-events-60-frame-opportunities',async()=>{await overlay.touchStart(event());for(let i=0;i<60;i++){await overlay.touchMove(event(Math.sin(i/12)*3,Math.cos(i/12)*3));await frame()}});
 await phase('continuous-drag-end-validation',async()=>overlay.touchEnd(event()));
 await phase('drag-120-events-30-frame-opportunities',async()=>{await overlay.touchStart(event());for(let i=0;i<120;i++){await overlay.touchMove(event(Math.sin(i/12)*3,Math.cos(i/12)*3));if(i%4===3)await frame()}});
 await phase('drag-end-validation',async()=>{await overlay.touchEnd(event(2,2))});
 await phase('scale-120-events-30-frame-opportunities',async()=>{for(let i=0;i<120;i++){p.scaleChanging({detail:{value:65+i%20}});if(i%4===3)await frame()}});
 await phase('scale-end-validation',async()=>p.scaleChanged({detail:{value:70}}));
 await phase('rotate-120-events-30-frame-opportunities',async()=>{for(let i=0;i<120;i++){p.angleChanging({detail:{value:-30+i%60}});if(i%4===3)await frame()}});
 await phase('rotate-end-validation',async()=>p.angleChanged({detail:{value:25}}));
 const before=placementSession.read(p.data.draftId).draft,expected=geo.transformPhotoPolygonToBody(before.prepared,before.transform,model);
 await phase('viewport-full-focus',async()=>{p.toggleFocus();p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:fitViewport(width,500,model)}});await frame();p.toggleFocus();p.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:vp}});await frame()});
 assert.deepEqual(placementSession.read(p.data.draftId).draft.geometry,expected);
 await phase('confirm',async()=>{p.confirmPosition();assert.equal(p.data.confirmed,true,p.data.message)});
 assert.deepEqual(annotationSession.snapshot().views.back.completed.at(-1).geometry,expected);
 componentDef.lifetimes.detached.call(overlay);p.onUnload();
 return {vertices,multi,width,height:500,dpr:2,initialCounts,phases:phaseResults};
}
(async()=>{const report={date:new Date().toISOString(),environment:{node:process.version,platform:os.platform(),cpu:os.cpus()[0].model,memory:os.totalmem()},kind:'production JS with wx/Canvas command recorder; no raster/GPU/bridge latency/FPS; nested method times not additive',cases:[]};
 for(const n of [100,500,2000])for(const multi of [false,true])report.cases.push(await run(n,multi));
 for(const width of [320,430])report.cases.push(await run(2000,true,width));
 if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');else console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
