// Real production page/component/state/transport + localhost MobileSAM.
// wx networking and Canvas calls are adapters; this is NOT a native WeChat screenshot/test.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {spawnSync}=require('node:child_process'),{tmpdir}=require('node:os');
const root=path.resolve(__dirname,'..'),build=fs.mkdtempSync(path.join(tmpdir(),'v52-simple-'));
const source=path.join(root,'ai/experiments/inputs/cdc-21505.jpg');
const evidenceDir=path.resolve(process.argv[2]||path.join(root,'docs/validation-records/v5.2-simple-runs',String(Date.now())));
fs.mkdirSync(evidenceDir,{recursive:true});
const report={kind:'production page/component + real local model HTTP, wx adapters; not native GUI',sample:'CDC PHIL 21505, public V5.1 test image',inferences:[],medical_accuracy:'NOT_MEASURED'};
const base='http://127.0.0.1:8000/api/v1/ai/sessions';
let p,canvas,created,confirmed,downloads=0,segments=0,deletes=0;const requests=[],frames=[];
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve()};
async function until(predicate,label){const start=Date.now();while(!predicate()){if(Date.now()-start>65000)throw Error('Timeout: '+label);await new Promise(r=>setTimeout(r,20));}}
function imageSize(file){const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};}
function syncCanvas(){if(!canvas)return;const d=p.data;
 const props={source:d.photo,mask:d.mask,photoWidth:d.photoWidth,photoHeight:d.photoHeight,mode:d.mode,points:d.points,box:d.box,showPrompts:d.selecting||d.adjusting,disabled:d.phase==='confirming'||d.phase==='confirmed'||(!d.selecting&&!d.adjusting),layoutRevision:d.layoutRevision};
 if(JSON.stringify(canvas.properties)!==JSON.stringify(props)){canvas.properties=props;void canvas.redraw();}
}
async function main(){
 const compile=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',build],{stdio:'inherit'});assert.equal(compile.status,0);
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({platform:'devtools'}),getWindowInfo:()=>({pixelRatio:2}),nextTick:f=>queueMicrotask(f),
 showModal:o=>o.success?.({confirm:true}),chooseMedia:o=>o.success({tempFiles:[{tempFilePath:source,size:fs.statSync(source).size}]}),showToast:()=>{},
 getFileSystemManager:()=>({unlink:o=>{try{fs.unlinkSync(o.filePath)}catch{o.fail?.({})}}}),
 getImageInfo:o=>{try{o.success(imageSize(o.src))}catch{o.fail({})}},
 request:o=>{assert.ok(o.url.startsWith(base));requests.push(o.url.replace(base,''));const start=performance.now();
  if(o.url.endsWith('/segment'))segments++;
  fetch(o.url,{method:o.method,headers:o.header,body:JSON.stringify(o.data),signal:AbortSignal.timeout(o.timeout)}).then(async r=>{
   const data=r.status===204?{}:await r.json();
   if(o.url===base&&r.ok)created=data;
   if(o.url.endsWith('/confirm')&&r.ok)confirmed=data;
   if(o.url.endsWith('/segment'))report.inferences.push({status:r.status,seconds:(performance.now()-start)/1000,candidates:data.candidates?.map(c=>({id:c.candidate_id,status:c.status,area_ratio:c.area_ratio}))});
   if(o.method==='DELETE'&&r.status===204)deletes++;
   o.success({statusCode:r.status,data});
  }).catch(()=>o.fail({errMsg:'network error'}));},
 uploadFile:o=>{assert.ok(o.url.startsWith(base));const form=new FormData();form.append('file',new Blob([fs.readFileSync(o.filePath)],{type:'image/jpeg'}),'public-test.jpg');
  fetch(o.url,{method:'POST',headers:o.header,body:form,signal:AbortSignal.timeout(o.timeout)}).then(async r=>o.success({statusCode:r.status,data:await r.text()})).catch(()=>o.fail({}));},
 downloadFile:o=>{assert.ok(o.url.startsWith(base));fetch(o.url,{headers:o.header,signal:AbortSignal.timeout(o.timeout)}).then(async r=>{
  const tempFilePath=path.join(build,'download-'+(++downloads)+'.png');fs.writeFileSync(tempFilePath,Buffer.from(await r.arrayBuffer()));o.success({statusCode:r.status,tempFilePath});}).catch(()=>o.fail({}));},
 navigateBack:()=>{},redirectTo:()=>{}};
 let pageDef,componentDef;global.Page=o=>pageDef=o;global.Component=o=>componentDef=o;
 require(path.join(build,'pages/ai-annotate/ai-annotate.js'));require(path.join(build,'components/photo-canvas/photo-canvas.js'));
 p={data:structuredClone(pageDef.data),setData(c){Object.assign(this.data,c);if(this.data.working)assert.ok(this.data.photo,'photo remains during analysis/preview');syncCanvas();}};
 for(const[k,v]of Object.entries(pageDef))if(typeof v==='function')p[k]=v.bind(p);
 p.onLoad({view:'front',region:'front-chest'});p.choosePhoto('album');await until(()=>p.data.photo||p.data.error,'upload');assert.equal(p.data.error,'');assert.equal(p.data.selecting,true);
 const ctx={};for(const k of ['clearRect','setTransform','strokeRect','setLineDash','beginPath','arc','fill','stroke','moveTo','lineTo'])ctx[k]=()=>{};
 ctx.drawImage=(img,...rect)=>frames.push({path:img.path,rect});
 const node={width:0,height:0,getContext:()=>ctx,createImage(){const image={};Object.defineProperty(image,'src',{set(file){image.path=file;Object.assign(image,imageSize(file));queueMicrotask(()=>image.onload())}});return image}};
 canvas={properties:{},setData(){},triggerEvent(name,detail){if(name==='prompt')p.onPrompt({detail});else if(name==='renderstate')p.renderState({detail});},
 createSelectorQuery(){let bounds;const q={select:()=>q,fields:()=>q,boundingClientRect:cb=>{bounds=cb;return q},exec:cb=>{if(bounds)setTimeout(()=>bounds({left:24,top:70,width:320,height:380}),0);else cb([{node,width:320,height:380}]);}};return q;}};
 for(const[k,v]of Object.entries(componentDef.methods))canvas[k]=v.bind(canvas);
 componentDef.lifetimes.created.call(canvas);syncCanvas();componentDef.lifetimes.ready.call(canvas);await until(()=>p.data.renderReady,'original frame');
 const fit=require(path.join(build,'utils/photo-coordinate.js')).fitPhoto(700,460,320,380);
 const event=(x,y)=>({touches:[{clientX:24+fit.left+x/700*fit.width,clientY:70+fit.top+y/460*fit.height}],changedTouches:[{clientX:24+fit.left+x/700*fit.width,clientY:70+fit.top+y/460*fit.height}]});
 await canvas.touchStart(event(215,245));await canvas.touchEnd(event(216,246));await flush();assert.equal(segments,0,'tiny gesture does not infer');
 await canvas.touchStart(event(215,245));const move1=canvas.touchMove(event(340,310)),move2=canvas.touchMove(event(495,385));assert.equal(segments,0,'moves never infer');
 const end=canvas.touchEnd(event(495,385)),duplicate=canvas.touchEnd(event(495,385));await Promise.all([move1,move2,end,duplicate]);
 report.touch_dispatch='overlapping client-coordinate events with asynchronous bounds queries';
 await until(()=>p.data.hasResult&&!p.data.working&&p.data.renderReady||p.data.failed,'automatic analysis');assert.equal(p.data.failed,false,p.data.error);assert.equal(segments,1);assert.equal(confirmed,undefined);
 const firstMask=p.data.mask;p.nextResult();await until(()=>!p.data.working&&p.data.renderReady,'candidate cycle');assert.notEqual(p.data.mask,firstMask);assert.equal(segments,1,'cycling does not infer');
 p.openAdjustment();await flush();await canvas.touchStart(event(430,328));await canvas.touchEnd(event(430,328));await flush();
 p.setMode({currentTarget:{dataset:{mode:'background'}}});await flush();await canvas.touchStart(event(500,350));await canvas.touchEnd(event(500,350));await flush();assert.equal(p.data.points.length,2);assert.equal(segments,1);
 p.refine();await until(()=>p.data.hasResult&&!p.data.working&&p.data.renderReady||p.data.failed,'fine analysis');assert.equal(p.data.failed,false,p.data.error);assert.equal(segments,2);assert.equal(p.data.adjusting,false);
 p.nextResult();await until(()=>!p.data.working&&p.data.renderReady,'second candidate cycle');p.confirm();await until(()=>p.data.phase==='confirmed'||p.data.error,'confirmation');assert.equal(p.data.phase,'confirmed',p.data.error);
 assert.equal(confirmed.coordinate_space,'photo_oriented_normalized_v1');assert.equal(confirmed.geometry.type,'MultiPolygon');assert.ok(confirmed.confirmed_by_user);assert.equal(confirmed.candidate_id,'candidate-1');
 report.confirmation={schema:confirmed.schema_version,coordinate_space:confirmed.coordinate_space,candidate:confirmed.candidate_id,polygons:confirmed.geometry.coordinates.length,holes:confirmed.geometry.coordinates.reduce((n,p)=>n+p.length-1,0),mask_sha256:confirmed.mask_sha256};
 report.segment_requests=segments;report.frame_draws=frames.length;report.confirmation_requests=requests.filter(x=>x.endsWith('/confirm')).length;
 p.cancel();await until(()=>deletes===1,'cleanup');
 const after=await fetch(base+'/'+created.session_id+'/assets/photo.png',{headers:{'x-ai-session-key':created.session_token}});assert.equal(after.status,410);report.after_delete_status=after.status;
 report.status='PASSED';console.log(JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(evidenceDir,'real-page-http.json'),JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{p?.onUnload();if(created&&!deletes){try{await fetch(base+'/'+created.session_id,{method:'DELETE',headers:{'x-ai-session-key':created.session_token}})}catch{}}fs.rmSync(build,{recursive:true,force:true});});
