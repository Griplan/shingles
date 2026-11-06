// Isolated production modules. No browser raster, native bridge, FPS or clinical payload logging.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'../../..'),build=process.argv[2],out=process.argv[3],load=f=>require(path.resolve(build,f));
const rows=[],mem=[];const time=(name,fn,meta={})=>{const t=performance.now(),v=fn();rows.push({traceId:`node-${rows.length}`,stage:name,ms:performance.now()-t,...meta});return v};
const atlas=time('APP_MODULE_ATLAS_REQUIRE',()=>load('data/atlas.generated.js'));
const models=time('APP_MODULE_BODY_REQUIRE',()=>load('data/body-models.js'));
const {ATLAS_MANIFEST:M,ATLAS_REGIONS:R}=atlas,{getBodyModel}=models;
const {fitViewport,focusViewport}=load('utils/coordinate.js'),{hitTestRegion}=load('utils/body-hit-test.js');
const {AnnotationSessionStore,sessionToken}=load('state/annotation-session.js');
const {bodyGeometry,validatePolygon,area}=load('utils/annotation-geometry.js');
const {drawLesions}=load('components/body-canvas/lesion-render.js');
const presentation=load('utils/matching-presentation.js');
let def;global.Component=d=>def=d;load('components/body-canvas/body-canvas.js');
const complexity=Object.fromEntries(['front','back'].map(view=>{const rs=R.filter(r=>r.view===view);return [view,{instances:rs.length,parts:rs.reduce((s,r)=>s+r.geometry.coordinates.length,0),holes:rs.reduce((s,r)=>s+r.geometry.coordinates.reduce((v,p)=>v+p.length-1,0),0),vertices:rs.reduce((s,r)=>s+r.geometry.coordinates.flat(1).reduce((v,p)=>v+p.length,0),0)}]}));
const circle=n=>Array.from({length:n},(_,i)=>({x:.5+.025*Math.cos(i*2*Math.PI/n),y:.32+.012*Math.sin(i*2*Math.PI/n)}));
// Real manual dispatch for legal inputs. Above cap: isolated path submission + guard rejection only.
for(const n of [10,100,500,2000])for(let rep=0;rep<3;rep++){
 const points=circle(n),model=getBodyModel('front'),store=new AnnotationSessionStore(),open=store.open('front','front-chest');assert(open.ok);
 if(n<=128){for(const point of points){const r=time('LESION_POINT_ADD',()=>store.dispatch(sessionToken(store.snapshot()),{type:'add',point}),{vertices:n,rep});assert(r.ok,r.message)}
 const r=time('POLYGON_CLOSE',()=>store.dispatch(sessionToken(store.snapshot()),{type:'close'}),{vertices:n,rep});assert(r.ok,r.message);
 }else{const r=time('POLYGON_CAP_REJECTION',()=>validatePolygon(points,bodyGeometry(model)),{vertices:n,rep});assert(!r.ok);assert.equal(r.code,'LIMIT');}
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 time('ISOLATED_LESION_DRAW',()=>drawLesions(ctx,fitViewport(375,500,model),model,{...sessionToken(store.snapshot()),completed:[],draft:{view:'front',vertices:points},selectedId:null}),{vertices:n,rep});
}
for(let i=0;i<100;i++){
 const model=getBodyModel(i%2?'front':'back');time('REGION_HIT_TEST',()=>hitTestRegion({x:.5,y:.32},model));time('REGION_FOCUS',()=>focusViewport(fitViewport(375,500,model),model.regions[0].bounds));
}
let pageDef;global.Page=d=>pageDef=d;load('pages/annotate/annotate.js');
const annotationModule=load('state/annotation-session.js');
const manualPages=[];
for(const n of [10,100]){
 global.wx={getWindowInfo:()=>({windowHeight:800}),getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({platform:'devtools'})};
 annotationModule.annotationSession=new AnnotationSessionStore();const annotationSession=annotationModule.annotationSession;
 const opened=annotationSession.open('front','front-chest');assert(opened.ok);
 const updates=[];const p={data:structuredClone(pageDef.data),setData(c){updates.push({bytes:Buffer.byteLength(JSON.stringify(c)),keys:Object.keys(c)});Object.assign(this.data,c)}};
 for(const [k,v]of Object.entries(pageDef))if(typeof v==='function')p[k]=v.bind(p);
 p.onLoad({sessionId:opened.session.sessionId});p.onShow();updates.length=0;
 for(const point of circle(n))time('MANUAL_PAGE_ADD',()=>p.act({type:'add',point}),{vertices:n});
 time('MANUAL_PAGE_CLOSE',()=>p.act({type:'close'}),{vertices:n});
 manualPages.push({vertices:n,setDataCalls:updates.length,totalBytes:updates.reduce((v,x)=>v+x.bytes,0),maxBytes:Math.max(...updates.map(x=>x.bytes)),keys:[...new Set(updates.flatMap(x=>x.keys))]});p.onUnload();
}
const response=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/paper-technical-report/audit/example-evaluate.json'))).response;
for(let i=0;i<30;i++){
 const candidates=i===0?response.views[0].candidates:response.views[0].candidates;
 const p=time('MATCH_INSTANCE_MAP',()=>presentation.presentation(candidates,R,'front',i%2?'':candidates[0].candidate_id),{warm:i>0});
 time('MATCH_LABEL_LAYOUT',()=>presentation.placeLabels(p.labels,400,fitViewport(375,500,getBodyModel('front'))));
 time('MATCH_CLIENT_JSON_PARSE',()=>JSON.parse(JSON.stringify(response)));
}
function canvasRun(width,repeat){
 const jobs=[],frames=new Map(),stats={measure:0,context:0,images:0,widthWrites:0,heightWrites:0,setDataCalls:0,setDataBytes:0},commands={};let frameId=0,fakeNow=0;
 const count=k=>commands[k]=(commands[k]||0)+1;
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:(()=>count(k)),set:(o,k,v)=>(o[k]=v,true)});
 const node={getContext(){stats.context++;return ctx},createImage(){stats.images++;const i={width:1200,height:2700};Object.defineProperty(i,'src',{set(){jobs.push(()=>i.onload())}});return i},requestAnimationFrame(cb){frames.set(++frameId,cb);return frameId},cancelAnimationFrame(id){frames.delete(id)}};
 let backingW=0,backingH=0;Object.defineProperties(node,{width:{get:()=>backingW,set(v){backingW=v;stats.widthWrites++}},height:{get:()=>backingH,set(v){backingH=v;stats.heightWrites++}}});
 global.wx={nextTick:f=>jobs.push(f),getWindowInfo:()=>({pixelRatio:2})};
 const p={properties:{},data:{...def.data},setData(c){stats.setDataCalls++;stats.setDataBytes+=Buffer.byteLength(JSON.stringify(c));Object.assign(this.data,c)},triggerEvent(){},createSelectorQuery(){const q={select:()=>q,fields:()=>q,exec:cb=>{stats.measure++;cb([{node,width,height:500}])}};return q}};
 for(const[k,v]of Object.entries(def.properties))p.properties[k]=v.value;for(const[k,v]of Object.entries(def.methods))p[k]=v.bind(p);
 const flush=()=>{let limit=0;while(jobs.length||frames.size){assert(++limit<1000);while(jobs.length)jobs.shift()();fakeNow+=16;const cbs=[...frames.values()];frames.clear();for(const f of cbs)f(fakeNow)}};
 const change=()=>{Object.values(def.observers)[0].call(p);flush()};
 const savedNow=Date.now;Date.now=()=>fakeNow; // virtual animation cadence, measured CPU still performance.now
 try{
 time('CANVAS_INIT_ADAPTER',()=>{def.lifetimes.created.call(p);def.lifetimes.ready.call(p);flush()},{width,repeat});
 const initialization={...stats};
 for(let i=0;i<10;i++){p.properties.view=i%2?'front':'back';time('BODY_FRONT_BACK_SWITCH',change,{width,repeat,iteration:i})}
 p.properties.view='front';change();
 const rs=R.filter(r=>r.view==='front');const layer=regions=>({atlasVersion:M.atlasVersion,templateId:M.templateId,templateVersion:M.templateVersion,geometryId:M.geometryId,view:'front',regions,showLabels:false});
 for(let i=0;i<20;i++){p.properties.atlas=layer(i%2?rs:[rs[0]]);time('ATLAS_ALL_SINGLE_SUBMIT',change,{width,repeat,iteration:i})}
 const noMotion={...commands};p.properties.motionEnabled=true;p.properties.atlas=layer(rs);change();
 const start={...commands};p.properties.atlas=layer([rs[0]]);time('ATLAS_ANIMATION_COMMANDS',change,{width,repeat});
 const animation=Object.fromEntries(Object.entries(commands).map(([k,v])=>[k,v-(start[k]||0)]));
 p.properties.atlas=layer(rs);Object.values(def.observers)[0].call(p);while(jobs.length)jobs.shift()(); // exit with active RAF
 def.pageLifetimes.hide.call(p);assert.equal(frames.size,0);def.lifetimes.detached.call(p);flush();assert.equal(frames.size,0);
 assert.equal(stats.images,2);assert.equal(stats.context,1);assert.equal(stats.measure,1);
 assert.equal(commands.save,commands.restore);
 return {width,repeat,initialization,stats,commands,noMotion,animation,pendingFramesAfterHide:frames.size};
 }finally{Date.now=savedNow;}
}
const canvases=[];for(const w of [320,375,430])for(let rep=0;rep<3;rep++)canvases.push(canvasRun(w,rep));
// Reentry using fresh components. GC-enabled Node heap is not WeChat/native image memory.
for(let i=0;i<10;i++){canvasRun(375,i);global.gc?.();mem.push({iteration:i,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss})}
fs.writeFileSync(out,JSON.stringify({environment:{node:process.version,platform:process.platform,kind:'production JS with wx/Canvas command adapter; virtual RAF cadence, no native frame/bridge/raster time'},complexity,manualPages,rows,canvases,memoryReentry:mem},null,2)+'\n');
console.log('frontend completed',rows.length,'timed calls');
