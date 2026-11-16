// V5.4: real photo -> production placement -> V2 -> existing evaluate, plus saved editing.
// wx networking and Canvas calls are adapters; this is NOT a native WeChat screenshot/test.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {spawnSync}=require('node:child_process'),{tmpdir}=require('node:os');
const root=path.resolve(__dirname,'..'),build=fs.mkdtempSync(path.join(tmpdir(),'v53-placement-'));
let source=path.join(root,'ai/experiments/inputs/cdc-21505.jpg');
const evidenceDir=path.resolve(process.argv[2]||path.join(root,'docs/validation-records/v5.3-runs',String(Date.now())));
fs.mkdirSync(evidenceDir,{recursive:true});
const brushTest=process.env.DERMATOME_TEST_BRUSH==='1';
const p10Profile=process.env.DERMATOME_P10_PROFILE==='1',p10Timing={};
const report={brush_test:brushTest,kind:'page/component + real backend HTTP, wx adapters; not native GUI',sample:'CDC PHIL 21505, public V5.1 test image',inferences:[],medical_accuracy:'NOT_MEASURED'};
const exif=process.env.DERMATOME_TEST_HD_EXIF==='1',large=process.env.DERMATOME_TEST_P81_SIZE||'',hd=!!large||exif||process.env.DERMATOME_TEST_HD==='1';
assert.ok(['','6000x4000','8064x6048'].includes(large));
const [sourceW,sourceH]=(large||'4032x3024').split('x').map(Number);
const contentH=Math.round(sourceW*460/700),padY=Math.floor((sourceH-contentH)/2);
const uploadW=1920,uploadH=Math.floor(sourceH*uploadW/sourceW);
const pillow=path.join(root,'ai/.venv/bin/python');
let sourceInfo,outputInfo,resizeStarted;
const python=(code,...args)=>{const r=spawnSync(pillow,['-c',code,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
const inspect=file=>JSON.parse(python("from PIL import Image; import sys,json; i=Image.open(sys.argv[1]); print(json.dumps(dict(width=i.width,height=i.height,orientation={6:'right'}.get(i.getexif().get(274),'up'))))",file));
if(hd){
 const file=path.join(build,'hd-fixture.jpg');
 python("from PIL import Image; import sys; w,h,content,pad=map(int,sys.argv[4:]); im=Image.open(sys.argv[1]).resize((w,content),Image.Resampling.LANCZOS); out=Image.new('RGB',(w,h),'white'); out.paste(im,(0,pad)); exif=Image.Exif(); rotated=sys.argv[3]=='rotate'; exif[274]=6 if rotated else 1; out=out.transpose(Image.Transpose.ROTATE_90) if rotated else out; out.save(sys.argv[2],quality=96,exif=exif)",source,file,exif?'rotate':'up',sourceW,sourceH,contentH,padY);
 source=file;report.sample=`${sourceW}×${sourceH} synthetic resize and pad of public CDC PHIL 21505 (not a new clinical sample)`;
}
sourceInfo=inspect(source);
const origin=process.env.DERMATOME_TEST_BASE||'http://127.0.0.1:8000';
if(large)assert.equal(origin,'http://127.0.0.1:8000','P8.1 large-image evidence is loopback-only');
const publicDebug=origin==='http://212.64.26.206/dermatome-test';
assert.ok(publicDebug||['http://127.0.0.1:8000','http://127.0.0.1:18001'].includes(origin),'Only explicitly authorized test endpoints');
const trialMode=process.env.DERMATOME_TEST_ENV==='trial';
const access=!trialMode&&origin.endsWith(':18001')?JSON.parse(fs.readFileSync(path.join(root,'private-data/cloud-access.json'),'utf8')).access_key:'';
const auth=access?{'x-test-access-key':access}:{};
const base=origin+'/api/v1/ai/sessions';
report.endpoint=origin;report.controlled_access=!!access||trialMode;report.client_environment=trialMode?'trial (reliable wx test double)':'develop';
report.https_and_phone=publicDebug?'HTTP public-IP test, unencrypted; native phone NOT_RUN':trialMode?'NOT_RUN: explicit test adapter to SSH loopback; not a shipping trial URL':'NOT_RUN: loopback test';
let placementPage,navigated,analysisGestureEndedAt=0,segmentRequestStartedAt=0;let p,canvas,created,confirmed,downloads=0,segments=0,deletes=0;const requests=[],frames=[],matchRequests=[];let lastMatch;
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve()};
async function until(predicate,label){const start=Date.now();while(!predicate()){if(Date.now()-start>65000)throw Error('Timeout: '+label);await new Promise(r=>setTimeout(r,20));}}
function imageSize(file){const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};}
function syncCanvas(){if(!canvas)return;const d=p.data;
 const props={source:d.photo,mask:d.mask,photoWidth:d.photoWidth,photoHeight:d.photoHeight,mode:d.mode,points:d.points,box:d.box,additionalBoxes:d.additionalBoxes,brushRadius:d.brushRadius,showPrompts:d.selecting||d.adjusting,disabled:d.phase==='confirming'||d.phase==='confirmed'||d.phase==='correcting'||d.previewing||d.pendingBrush||(!d.selecting&&!d.adjusting&&!d.editingMask),layoutRevision:d.layoutRevision};
 if(JSON.stringify(canvas.properties)!==JSON.stringify(props)){canvas.properties=props;void canvas.redraw();}
}
async function main(){
 const compile=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',build],{stdio:'inherit'});assert.equal(compile.status,0);
 global.wx={env:{USER_DATA_PATH:build},getAppBaseInfo:()=>({SDKVersion:'3.17.4'}),getAccountInfoSync:()=>({miniProgram:{envVersion:trialMode?'trial':'develop'}}),getSystemInfoSync:()=>({platform:trialMode?'ios':'devtools'}),getWindowInfo:()=>({pixelRatio:2,windowHeight:800}),nextTick:f=>queueMicrotask(f),
 showModal:o=>{assert.notEqual(o.editable,true,'No invitation input in public testing');o.success?.({confirm:true});},chooseMedia:o=>o.success({tempFiles:[{tempFilePath:source,size:fs.statSync(source).size}]}),showToast:()=>{},
 getFileSystemManager:()=>({unlink:o=>{try{fs.unlinkSync(o.filePath)}catch{o.fail?.({})}},
  stat:o=>o.success({stats:fs.statSync(o.path)}),
  copyFile:o=>{fs.copyFileSync(o.srcPath,o.destPath);o.success();},
  open:o=>o.success({fd:String(fs.openSync(o.filePath,o.flag))}),
  close:o=>{fs.closeSync(Number(o.fd));o.complete();},
  write:o=>o.success({bytesWritten:fs.writeSync(Number(o.fd),Buffer.from(o.data),0,o.data.byteLength,o.position)}),
  writeFile:o=>{fs.writeFileSync(o.filePath,Buffer.from(o.data));o.success();},
  readdir:o=>o.success({files:fs.readdirSync(o.dirPath)}),
  readFile:o=>{let bytes;
   if(o.length===undefined)bytes=fs.readFileSync(o.filePath).subarray(o.position);
   else{const fd=fs.openSync(o.filePath,'r');try{const buffer=Buffer.alloc(o.length);bytes=buffer.subarray(0,fs.readSync(fd,buffer,0,o.length,o.position));}finally{fs.closeSync(fd);}}o.success({data:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});}}),
 compressImage:o=>{
  assert.ok(large);const start=performance.now(),file=path.join(build,'native-photo.jpg');
  assert.deepEqual([o.compressedWidth,o.compressedHeight],exif?[uploadH,uploadW]:[uploadW,uploadH]);
  const rss=Number(python("from PIL import Image; import resource,sys; im=Image.open(sys.argv[1]); assert im.getexif().get(274,1)==1; im.thumbnail((int(sys.argv[3]),int(sys.argv[4])),Image.Resampling.LANCZOS); assert im.size==(int(sys.argv[3]),int(sys.argv[4])); im.save(sys.argv[2],quality=int(sys.argv[5])); print(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1024**2 if sys.platform=='darwin' else 1024))",o.src,file,o.compressedWidth,o.compressedHeight,o.quality));
  report.native_resize_adapter={kind:'Pillow, not native WeChat',elapsed_ms:performance.now()-start,peak_rss_mib:rss,thumbnail_bytes:fs.statSync(file).size};
  outputInfo=inspect(file);o.success({tempFilePath:file});
 },
 canvasToTempFilePath:o=>{
  const file=path.join(build,'prepared.jpg');if(large)assert.ok(exif&&o.canvas.source.endsWith('native-photo.jpg'),'Canvas must never decode the large original');assert.deepEqual(o.canvas.transform,exif?[0,1,-1,0,uploadW,0]:[1,0,0,1,0,0]);
  python("from PIL import Image; import sys; im=Image.open(sys.argv[1]); assert im.getexif().get(274,1)==1; im=im.transpose(Image.Transpose.ROTATE_270) if sys.argv[6]=='rotate' else im; im.convert('RGB').resize((int(sys.argv[3]),int(sys.argv[4])),Image.Resampling.LANCZOS).save(sys.argv[2],quality=int(sys.argv[5]))",o.canvas.source,file,''+o.width,''+o.height,''+Math.round(o.quality*100),exif?'rotate':'up');
  outputInfo=inspect(file);o.success({tempFilePath:file});},
 getImageInfo:o=>{try{o.success(o.src===source?sourceInfo:o.src.endsWith('prepared.jpg')||o.src.endsWith('native-photo.jpg')?inspect(o.src):imageSize(o.src))}catch{o.fail({})}},
 request:o=>{assert.ok(o.url.startsWith(origin+'/api/v1/'));requests.push(o.url.replace(base,''));const start=performance.now();
  if(o.url.endsWith('/evaluate'))matchRequests.push(o.data);
  if(o.url.endsWith('/segment')){segments++;if(p10Profile&&!segmentRequestStartedAt){segmentRequestStartedAt=start;p10Timing.segment_request_started_ms=start-analysisGestureEndedAt;}if(hd&&segments===1)report.prompt=o.data.prompts.box;}
  fetch(o.url,{method:o.method,headers:o.header,body:JSON.stringify(o.data),signal:AbortSignal.timeout(o.timeout)}).then(async r=>{
   const data=r.status===204?{}:await r.json();
   if(o.url.endsWith('/evaluate')){lastMatch=data;report.matches??=[];report.matches.push({status:r.status,http_ms:performance.now()-start,views:data.views?.map(v=>({view:v.view,candidates:v.candidates.length,covered_ratio:v.covered_ratio,uncovered_ratio:v.uncovered_ratio}))});}
   if(o.url.endsWith('/access/session')&&o.method==='POST'&&r.ok){auth.authorization='Bearer '+data.access_token;assert.equal(data.access_kind,'public_test');report.automatic_test_session=true;}
   if(o.url===base&&r.ok)created=data;
   if(o.url.endsWith('/confirm')&&r.ok)confirmed=data;
   if(o.url.endsWith('/segment'))report.inferences.push({status:r.status,seconds:(performance.now()-start)/1000,candidates:data.candidates?.map(c=>({id:c.candidate_id,status:c.status,area_ratio:c.area_ratio}))});
   if(o.method==='DELETE'&&r.status===204)deletes++;
   o.success({statusCode:r.status,data});
  }).catch(()=>o.fail({errMsg:'network error'}));},
 uploadFile:o=>{
  assert.ok(o.url.startsWith(base));const form=new FormData();
  if(hd){
   report.preparation={orientation:sourceInfo.orientation,elapsed_ms:performance.now()-resizeStarted,before:[sourceInfo.width,sourceInfo.height,fs.statSync(source).size],after:[outputInfo.width,outputInfo.height,fs.statSync(o.filePath).size]};
   assert.ok(outputInfo.width*outputInfo.height<=3_000_000&&Math.max(outputInfo.width,outputInfo.height)<=1920&&fs.statSync(o.filePath).size<=8*1024*1024);
   report.reference_upright_rgb_mean_error=Number(python("from PIL import Image,ImageOps; import numpy as np,sys; out=Image.open(sys.argv[2]).convert('RGB'); ref=ImageOps.exif_transpose(Image.open(sys.argv[1])).convert('RGB').resize(out.size,Image.Resampling.LANCZOS); print(np.mean(np.abs(np.asarray(out,dtype=np.int16)-np.asarray(ref,dtype=np.int16))))",source,o.filePath));
   assert.ok(report.reference_upright_rgb_mean_error<5,'processed photo must match the independently oriented original');
  }
  const start=performance.now();form.append('file',new Blob([fs.readFileSync(o.filePath)],{type:'image/jpeg'}),'public-test.jpg');
  fetch(o.url,{method:'POST',headers:o.header,body:form,signal:AbortSignal.timeout(o.timeout)}).then(async r=>{const data=await r.text();report.upload_http_ms=performance.now()-start;o.success({statusCode:r.status,data});}).catch(()=>o.fail({}));},
 downloadFile:o=>{assert.ok(o.url.startsWith(base));fetch(o.url,{headers:o.header,signal:AbortSignal.timeout(o.timeout)}).then(async r=>{
  const tempFilePath=path.join(build,'download-'+(++downloads)+'.png');fs.writeFileSync(tempFilePath,Buffer.from(await r.arrayBuffer()));o.success({statusCode:r.status,tempFilePath});}).catch(()=>o.fail({}));},
 navigateBack:()=>{},redirectTo:o=>{navigated=o.url},navigateTo:o=>{navigated=o.url},enableAlertBeforeUnload:()=>{},disableAlertBeforeUnload:()=>{}};
 if(trialMode){const config=require(path.join(build,'config/api.js'));
  if(publicDebug)assert.equal(config.apiBaseUrl(),origin,'Use shipping address without a network configuration override');
  else config.apiBaseUrl=()=>origin; // Explicit loopback adapter retained for earlier SSH-only regression.
 }else if(access)require(path.join(build,'config/controlled.js')).useControlledServer(access);
 let pageDef,componentDef;global.Page=o=>pageDef=o;global.Component=o=>componentDef=o;
 require(path.join(build,'packages/clinical/pages/ai-annotate/ai-annotate.js'));require(path.join(build,'packages/clinical/components/photo-canvas/photo-canvas.js'));
 p={data:structuredClone(pageDef.data),setData(c){Object.assign(this.data,c);if(this.data.working)assert.ok(this.data.photo,'photo remains during analysis/preview');syncCanvas();}};
 for(const[k,v]of Object.entries(pageDef))if(typeof v==='function')p[k]=v.bind(p);
 const prepCanvas={createImage(){const image={};Object.defineProperty(image,'src',{set(file){prepCanvas.source=file;Object.assign(image,file===source?sourceInfo:inspect(file));queueMicrotask(()=>image.onload());}});return image;},
  getContext:()=>({fillRect(){},setTransform(...args){prepCanvas.transform=args;},drawImage(){}})};
 p.createSelectorQuery=()=>{const q={select:()=>q,fields:()=>q,exec:cb=>cb([{node:prepCanvas}])};return q;};
 p.onLoad({view:'back',region:'back-upper-back'});const selectionStarted=performance.now();resizeStarted=selectionStarted;p.choosePhoto('album');await until(()=>p.data.photo||p.data.error||p.data.preparationError,'upload');assert.equal(p.data.preparationError,'');assert.equal(p.data.error,'');assert.equal(p.data.selecting,true);
 if(p10Profile)p10Timing.selected_to_image_ready_ms=performance.now()-selectionStarted;
 const ctx={};for(const k of ['clearRect','setTransform','strokeRect','setLineDash','beginPath','arc','fill','stroke','moveTo','lineTo'])ctx[k]=()=>{};
 ctx.drawImage=(img,...rect)=>frames.push({path:img.path,rect});
 const node={width:0,height:0,getContext:()=>ctx,createImage(){const image={};Object.defineProperty(image,'src',{set(file){image.path=file;Object.assign(image,imageSize(file));queueMicrotask(()=>image.onload())}});return image}};
 canvas={properties:{},setData(){},triggerEvent(name,detail){if(name==='prompt')p.onPrompt({detail});else if(name==='stroke')p.onStroke({detail});else if(name==='renderstate')p.renderState({detail});},
 createSelectorQuery(){let bounds;const q={select:()=>q,fields:()=>q,boundingClientRect:cb=>{bounds=cb;return q},exec:cb=>{if(bounds)setTimeout(()=>bounds({left:24,top:70,width:320,height:380}),0);else cb([{node,width:320,height:380}]);}};return q;}};
 for(const[k,v]of Object.entries(componentDef.methods))canvas[k]=v.bind(canvas);
 componentDef.lifetimes.created.call(canvas);syncCanvas();componentDef.lifetimes.ready.call(canvas);await until(()=>p.data.renderReady,'original frame');
 const fit=require(path.join(build,'utils/photo-coordinate.js')).fitPhoto(p.data.photoWidth,p.data.photoHeight,320,380);
 const yNorm=y=>hd?(padY+y/460*contentH)/sourceH:y/460;
 const event=(x,y)=>({touches:[{clientX:24+fit.left+x/700*fit.width,clientY:70+fit.top+yNorm(y)*fit.height}],changedTouches:[{clientX:24+fit.left+x/700*fit.width,clientY:70+fit.top+yNorm(y)*fit.height}]});
 await canvas.touchStart(event(215,245));await canvas.touchEnd(event(216,246));await flush();assert.equal(segments,0,'tiny gesture does not infer');
 await canvas.touchStart(event(215,245));const move1=canvas.touchMove(event(340,310)),move2=canvas.touchMove(event(495,385));assert.equal(segments,0,'moves never infer');
 const analysisStarted=performance.now();analysisGestureEndedAt=performance.now();const end=canvas.touchEnd(event(495,385)),duplicate=canvas.touchEnd(event(495,385));await Promise.all([move1,move2,end,duplicate]);
 report.touch_dispatch='overlapping client-coordinate events with asynchronous bounds queries';
 await until(()=>p.data.hasResult&&!p.data.working&&p.data.renderReady||p.data.failed,'automatic analysis');if(p10Profile){p10Timing.gesture_end_to_first_mask_interactive_ms=performance.now()-analysisStarted;p10Timing.segment_request_wall_to_mask_interactive_ms=performance.now()-segmentRequestStartedAt;}assert.equal(p.data.failed,false,p.data.error);assert.equal(segments,1);assert.equal(confirmed,undefined);
 if(hd){
  assert.equal(p.data.photoWidth,uploadW);assert.equal(p.data.photoHeight,uploadH);
  const intended=[215/700,yNorm(245),495/700,yNorm(385)];
  const actual=["xMin","yMin","xMax","yMax"].map(k=>report.prompt[k]);
  report.max_prompt_error_px=Math.max(...actual.map((v,i)=>Math.abs(v-intended[i])*(i%2?uploadH:uploadW)));
  assert.ok(report.max_prompt_error_px<1e-8);
  const maskFrames=frames.filter(f=>f.path===p.data.mask),photoFrames=frames.filter(f=>f.path===p.data.photo);
  assert.deepEqual(maskFrames.at(-1).rect,photoFrames.at(-1).rect);
  report.photo_mask_rect_equal=true;
 }
 const firstMask=p.data.mask,candidateStarted=performance.now();p.nextResult();await until(()=>!p.data.working&&p.data.renderReady,'candidate cycle');if(p10Profile)p10Timing.candidate_switch_to_mask_interactive_ms=performance.now()-candidateStarted;assert.notEqual(p.data.mask,firstMask);assert.equal(segments,1,'cycling does not infer');
 p.openAdjustment();await flush();await canvas.touchStart(event(430,328));await canvas.touchEnd(event(430,328));await flush();
 p.setMode({currentTarget:{dataset:{mode:'background'}}});await flush();await canvas.touchStart(event(500,350));await canvas.touchEnd(event(500,350));await flush();assert.equal(p.data.points.length,2);assert.equal(segments,1);
 p.refine();await until(()=>p.data.hasResult&&!p.data.working&&p.data.renderReady||p.data.failed,'fine analysis');assert.equal(p.data.failed,false,p.data.error);assert.equal(segments,2);assert.equal(p.data.adjusting,false);
 p.nextResult();await until(()=>!p.data.working&&p.data.renderReady,'second candidate cycle');
 if(brushTest){
  p.openBrush();const initial=fs.readFileSync(p.data.mask);const count=segments;report.brush_operations=[];
  const run=async(label,action)=>{const at=performance.now();await action();await until(()=>!p.data.working&&p.data.renderReady,'brush '+label);assert.equal(p.data.error,'');report.brush_operations.push({label,http_and_frame_ms:performance.now()-at});};
  await run('erase',async()=>{await canvas.touchStart(event(355,290));await canvas.touchEnd(event(365,310));});
  assert.notDeepEqual(fs.readFileSync(p.data.mask),initial);
  await run('undo',()=>p.undoBrush());assert.deepEqual(fs.readFileSync(p.data.mask),initial);
  await run('erase-again',async()=>{await canvas.touchStart(event(355,290));await canvas.touchEnd(event(365,310));});
  p.brushMode({currentTarget:{dataset:{mode:'paint-add'}}});
  await run('add',async()=>{await canvas.touchStart(event(280,330));await canvas.touchEnd(event(286,336));});
  assert.equal(segments,count,'brush never invokes MobileSAM');p.finishBrush();assert.equal(p.data.editingMask,false);
 }
 const confirmationStarted=performance.now();p.confirm();await until(()=>p.data.phase==='confirmed'||p.data.error,'confirmation');if(p10Profile)p10Timing.photo_confirm_ms=performance.now()-confirmationStarted;assert.equal(p.data.phase,'confirmed',p.data.error);
 assert.equal(confirmed.coordinate_space,'photo_oriented_normalized_v1');assert.equal(confirmed.geometry.type,'MultiPolygon');assert.ok(confirmed.confirmed_by_user);assert.match(confirmed.candidate_id,/^candidate-[0-2]$/);if(brushTest){assert.equal(confirmed.correction.stroke_count,2);assert.equal(confirmed.correction.edit_revision,4);}
 if(hd){
  const geometryPath=path.join(build,'geometry.json');fs.writeFileSync(geometryPath,JSON.stringify(confirmed.geometry));
  report.mask_pixel_disagreement=Number(python("from PIL import Image; from shapely import contains_xy; from shapely.geometry import shape; import json,numpy as np,sys; g=shape(json.load(open(sys.argv[1]))); m=np.array(Image.open(sys.argv[2]).convert('RGBA'))[:,:,3]>0; h,w=m.shape; y,x=np.mgrid[:h,:w]; print(np.count_nonzero(m!=contains_xy(g,(x+.5)/w,(y+.5)/h)))",geometryPath,p.data.mask));
  assert.equal(report.mask_pixel_disagreement,0);
  assert.equal(fs.readdirSync(build).some(f=>f.startsWith('p8-photo-decode-')),false);
 }
 report.confirmation={schema:confirmed.schema_version,coordinate_space:confirmed.coordinate_space,candidate:confirmed.candidate_id,polygons:confirmed.geometry.coordinates.length,holes:confirmed.geometry.coordinates.reduce((n,p)=>n+p.length-1,0),mask_sha256:confirmed.mask_sha256,correction:confirmed.correction};
 const {annotationSession:annotations,sessionToken}=require(path.join(build,'state/annotation-session.js'));
 const fixture=require(path.join(root,'backend/tests/fixtures/synthetic-annotation-geometry.json')).editor['UI-A'];
 assert.equal(annotations.open('front','front-chest').ok,true);
 for(const point of fixture)assert.equal(annotations.dispatch(sessionToken(annotations.snapshot()),{type:'add',point}).ok,true);
 assert.equal(annotations.dispatch(sessionToken(annotations.snapshot()),{type:'close'}).ok,true);
 const manual=annotations.snapshot().views.front.completed[0],sourceCopy=JSON.stringify(confirmed),beforeRequests=requests.length;
 const placementOpenStarted=performance.now();p.placeOnBody();if(p10Profile)p10Timing.photo_confirm_to_navigation_call_ms=performance.now()-placementOpenStarted;assert.match(navigated,/pages\/placement\/placement\?draftId=/);
 const draftId=decodeURIComponent(navigated.split('draftId=')[1]);
 require(path.join(build,'packages/clinical/pages/placement/placement.js'));const placementDef=pageDef;
 require(path.join(build,'packages/clinical/components/placement-overlay/placement-overlay.js'));const overlayDef=componentDef;
 let overlay;
 const syncOverlay=()=>{if(!overlay)return;const d=placementPage.data;const props={view:d.view,prepared:d.prepared,transform:d.transform,viewport:d.viewport,interactionKey:d.interactionKey,revision:d.revision,disabled:d.dialog||!!d.error};
  if(JSON.stringify(props)!==JSON.stringify(overlay.properties)){overlay.properties=props;overlay.syncInput();overlay.queueDraw();}};
 placementPage={data:structuredClone(placementDef.data),selectComponent:()=>overlay,setData(c){Object.assign(this.data,c);syncOverlay();}};
 for(const[k,v]of Object.entries(placementDef))if(typeof v==='function')placementPage[k]=v.bind(placementPage);
 const placementPageStarted=performance.now();placementPage.onLoad({draftId});placementPage.onShow();assert.equal(placementPage.data.view,'back');assert.equal(placementPage.data.zoomRegion,'back-upper-back');
 const overlayCtx={};for(const k of ['save','restore','clearRect','setTransform','transform','translate','drawImage','beginPath','rect','clip','moveTo','lineTo','closePath','fill','stroke','arc','setLineDash','strokeRect'])overlayCtx[k]=()=>{};
 const overlayNode={width:0,height:0,getContext:()=>overlayCtx,requestAnimationFrame:cb=>setTimeout(cb,16),cancelAnimationFrame:clearTimeout};
 global.wx.createOffscreenCanvas=o=>({...o,getContext:()=>overlayCtx});
 overlay={properties:{},triggerEvent(name,detail){if(name==='placementdrag')placementPage.onDrag({detail});if(name==='renderstate')placementPage.onOverlayReady({detail});},
  createSelectorQuery(){let bounds;const q={select:()=>q,fields:()=>q,boundingClientRect:cb=>{bounds=cb;return q},exec:cb=>{if(bounds)setTimeout(()=>bounds({left:24,top:70,width:375,height:500}),0);else cb([{node:overlayNode,width:375,height:500}]);}};return q;}};
 for(const[k,v]of Object.entries(overlayDef.methods))overlay[k]=v.bind(overlay);
 overlayDef.lifetimes.created.call(overlay);syncOverlay();overlayDef.lifetimes.ready.call(overlay);
 const model=require(path.join(build,'data/body-models.js')).getBodyModel('back'),coords=require(path.join(build,'utils/coordinate.js'));
 const full=coords.fitViewport(375,500,model),focused=coords.focusViewport(full,model.regions.find(r=>r.id==='back-upper-back').bounds);
 const viewport=v=>placementPage.onViewport({detail:{view:'back',modelId:model.id,modelVersion:model.version,viewport:v}});
 viewport(focused);await until(()=>placementPage.data.overlayReady,'initial placement frame');if(p10Profile)p10Timing.navigation_to_placement_interactive_ms=performance.now()-placementPageStarted;
 const anchor=coords.normalizedToCanvas(placementPage.data.transform.translation,focused),touch=(x,y)=>({touches:[{clientX:24+anchor.x+x,clientY:70+anchor.y+y}],changedTouches:[{clientX:24+anchor.x+x,clientY:70+anchor.y+y}]});
 const beforeSave=annotations.snapshot();
 await overlay.touchStart(touch(0,0));await Promise.all([overlay.touchMove(touch(6,8)),overlay.touchEnd(touch(12,12))]);
 assert.equal(annotations.snapshot(),beforeSave,'drag never commits');
 placementPage.scaleChanging({detail:{value:70}});placementPage.scaleChanged({detail:{value:70}});placementPage.angleChanged({detail:{value:25}});
 assert.equal(placementPage.data.valid,true,placementPage.data.message);const transformCopy=JSON.stringify(placementPage.data.transform);
 placementPage.toggleFocus();viewport(full);await until(()=>placementPage.data.overlayReady,'full body frame');assert.equal(JSON.stringify(placementPage.data.transform),transformCopy);
 assert.equal(requests.length,beforeRequests,'adjustment performs zero backend calls');
 const confirmStart=performance.now(),work=placementPage.confirmPosition();report.confirm_sync_ms=performance.now()-confirmStart;placementPage.confirmPosition();await work;if(p10Profile)p10Timing.placement_confirm_to_match_complete_ms=performance.now()-confirmStart;assert.equal(placementPage.data.confirmed,true,placementPage.data.message);
 assert.equal(matchRequests.length,1);assert.match(navigated,/result=1/);assert.equal(lastMatch.views.length,2);
 const saved=annotations.snapshot(),group=saved.views.back.completed[0];assert.equal(saved.views.back.completed.length,1);assert.deepEqual(saved.views.front.completed[0],manual);
 assert.equal(group.geometry.coordinates.length,confirmed.geometry.coordinates.length);assert.equal(group.geometry.coordinates.reduce((n,p)=>n+p.length-1,0),confirmed.geometry.coordinates.reduce((n,p)=>n+p.length-1,0));
 assert.equal(JSON.stringify(confirmed),sourceCopy);assert.equal(requests.length,beforeRequests+1,'only one evaluate call on confirmation');assert.deepEqual(matchRequests[0].lesions.find(l=>l.id===group.id).geometry,group.geometry);
 require(path.join(build,'packages/clinical/pages/annotate/annotate.js'));const annotateDef=pageDef;
 const original={data:structuredClone(annotateDef.data),setData(c){Object.assign(this.data,c)}};
 for(const[k,v]of Object.entries(annotateDef))if(typeof v==='function')original[k]=v.bind(original);
 original.onLoad({sessionId:saved.sessionId,result:'1'});assert.equal(original.data.view,'back');assert.equal(original.data.layer.completed[0].id,group.id);assert.equal(original.data.matchingAllowed,true);assert.ok(original.data.atlas.regions.length);assert.equal(original.data.selected,'');
 original.onSceneReady({detail:{sceneId:original.data.sceneId,view:'back'}});const all=original.data.atlas.regions.length;
 original.chooseCandidate({currentTarget:{dataset:{id:original.data.candidates[0].id}}});assert.ok(original.data.selected);original.showAll();assert.equal(original.data.atlas.regions.length,all);assert.equal(matchRequests.length,1);
 report.results={all_regions:all,labels:original.data.candidates.length,automatic_all:true,label_and_show_all_no_request:true,retained_camera:JSON.stringify(original.data.retainedViewport)===JSON.stringify(full)};
 original.onUnload();
 report.placement={view:'back',coordinate_space:group.geometry.coordinateSpace,polygons:group.geometry.coordinates.length,holes:group.geometry.coordinates.reduce((n,p)=>n+p.length-1,0),vertices:group.geometry.coordinates.flat(2).length,
  scale:group.source.transform.scale,angle:group.source.transform.rotationDegrees,formal_annotations_front:saved.views.front.completed.length,formal_annotations_back:saved.views.back.completed.length,
  duplicate_confirm_count:1,network_requests_during_adjustment:0,manual_preserved:true,full_view_transform_unchanged:true,v2_restored:true,photo_source_unchanged:true};
 overlayDef.lifetimes.detached.call(overlay);placementPage.onUnload();placementPage=null;
 const {placementSession}=require(path.join(build,'packages/clinical/state/placement-session.js')), {matchingSession}=require(path.join(build,'packages/clinical/state/matching-session.js'));
 const edit=placementSession.edit(group.id);assert.equal(edit.ok,true,edit.message);
 placementPage={data:structuredClone(placementDef.data),selectComponent:()=>({previewTransform(){}}),setData(c){Object.assign(this.data,c)}};
 for(const[k,v]of Object.entries(placementDef))if(typeof v==='function')placementPage[k]=v.bind(placementPage);
 placementPage.onLoad({draftId:edit.draft.id});placementPage.onShow();viewport(full);
 placementPage.scaleChanged({detail:{value:55}});placementPage.angleChanged({detail:{value:-15}});placementPage.setData({overlayReady:true});
 assert.equal(matchRequests.length,1);assert.equal(annotations.snapshot().views.back.completed[0],group);assert.ok(matchingSession.refresh().response);
 const edited=placementPage.confirmPosition();placementPage.confirmPosition();await edited;assert.equal(matchRequests.length,2);assert.match(navigated,/result=1/);
 const revised=annotations.snapshot().views.back.completed[0];assert.equal(revised.id,group.id);assert.equal(annotations.snapshot().views.back.completed.length,1);assert.notDeepEqual(revised.geometry,group.geometry);assert.deepEqual(revised.source.photo,group.source.photo);
 assert.deepEqual(annotations.snapshot().views.front.completed[0],manual);assert.deepEqual(matchRequests[1].lesions.find(l=>l.id===group.id).geometry,revised.geometry);
 report.edited={stable_id:true,formal_count:1,geometry_changed:true,original_photo_preserved:true,request_count:2};
 placementPage.onUnload();placementPage=null;
 if(p10Profile)report.p10_timing_ms=p10Timing;
 report.segment_requests=segments;report.frame_draws=frames.length;report.confirmation_requests=requests.filter(x=>x.endsWith('/confirm')).length;
 if(hd)for(const file of ['prepared.jpg','native-photo.jpg'])assert.equal(fs.existsSync(path.join(build,file)),false,'client output deleted after upload');
 p.cancel();await until(()=>deletes===1,'cleanup');
 const after=await fetch(base+'/'+created.session_id+'/assets/photo.png',{headers:{...auth,'x-ai-session-key':created.session_token}});assert.equal(after.status,410);report.after_delete_status=after.status;
 assert.equal(annotations.snapshot().views.back.completed.length,1,'photo deletion does not delete saved body geometry');
 // Matching remains possible without the photo service; source is only metadata.
 const aiRequest=matchRequests.at(-1),manualRequest=structuredClone(aiRequest);manualRequest.lesions.forEach(l=>l.source='manual');
 const evaluateUrl=origin+'/api/v1/evaluate';
 const same=await fetch(evaluateUrl,{method:'POST',headers:{'content-type':'application/json',...auth},body:JSON.stringify(manualRequest)});assert.equal(same.status,200);assert.deepEqual(await same.json(),lastMatch);
 const afterCleanup=await fetch(evaluateUrl,{method:'POST',headers:{'content-type':'application/json',...auth},body:JSON.stringify(aiRequest)});assert.equal(afterCleanup.status,200);assert.deepEqual(await afterCleanup.json(),lastMatch);
 report.equivalence={same_body_manual_ai:'exact response equality',after_photo_cleanup:'PASSED',photo_sent_to_evaluate:false};
 if(trialMode){const revoke=await fetch(origin+'/api/v1/access/session',{method:'DELETE',headers:auth});assert.equal(revoke.status,204);
  const expired=await fetch(origin+'/api/v1/ready',{headers:auth});assert.equal(expired.status,401);report.access_revoked_status=expired.status;}
 report.status='PASSED';console.log(JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(evidenceDir,large?`real-page-http-${large}${exif?'-exif':''}.json`:exif?'real-page-http-exif.json':'real-page-http.json'),JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{placementPage?.onUnload();p?.onUnload();if(created&&!deletes){try{await fetch(base+'/'+created.session_id,{method:'DELETE',headers:{...auth,'x-ai-session-key':created.session_token}})}catch{}}fs.rmSync(build,{recursive:true,force:true});});
