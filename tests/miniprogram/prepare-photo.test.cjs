const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
const {preparePhoto,fitUploadSize,photoAxes,withoutPhotoOrientation,PHOTO_LIMITS,ORIGINAL_PHOTO_LIMITS}=require(path.join(process.env.DERMATOME_BUILD_DIR,'packages/clinical/utils/prepare-photo.js'));
const signatures={jpeg:[255,216,255],png:[137,80,78,71,13,10,26,10],webp:[82,73,70,70,4,0,0,0,87,69,66,80]};
function fixture({width=4032,height=3024,size=50000,format='jpeg',orientation='up',sizes=[100000],bad=false,sdk='3.17.4',native=null,input,dataMode='array-buffer'}={}){
 const deleted=[],exports=[],transforms=[],reads=[],draws=[],opened=[],writes=[],nativeCalls=[],outputs=new Map();
 const buf=Uint8Array.from(input||signatures[format]||[0]);
 const fs={stat:o=>o.success({stats:{size:outputs.get(o.path)?.size||size,isFile:()=>true}}),
  readFile:o=>{reads.push(o.length);const data=o.filePath==='native-photo'?Uint8Array.from(signatures[outputs.get(o.filePath).format]):buf;
   const part=data.slice(o.position,o.length===undefined?undefined:o.position+o.length);
   const value=dataMode==='binary-string'?String.fromCharCode(...part):dataMode==='view'?part:dataMode==='cross-realm'?
    vm.runInNewContext(`Uint8Array.from(${JSON.stringify([...part])}).buffer`):part.buffer;
   o.success({data:value});},unlink:o=>deleted.push(o.filePath),
  copyFile:o=>{opened.push(o.destPath);o.success();},
  open:o=>o.success({fd:'copy'}),close:o=>o.complete(),write:o=>{writes.push([o.position,...new Uint8Array(o.data)]);o.success({bytesWritten:1});},
  writeFile:o=>o.success(),readdir:o=>o.success({files:[]})};
 global.wx={env:{USER_DATA_PATH:'/private'},getFileSystemManager:()=>fs,getAppBaseInfo:()=>({SDKVersion:sdk}),
  compressImage:o=>{nativeCalls.push(o);const done=opts=>{outputs.set('native-photo',{width:o.compressedWidth,height:o.compressedHeight,size:120000,orientation:'up',format,...opts});
   o.success({tempFilePath:'native-photo'});}; if(native)native(o,done);else done();},
  getImageInfo:o=>{if(bad)o.fail();else o.success(outputs.get(o.src)||{width,height,orientation});},
  canvasToTempFilePath:o=>{const file='prepared-'+exports.length;exports.push([o.width,o.height,o.quality]);
   outputs.set(file,{width:o.destWidth,height:o.destHeight,size:sizes.shift(),orientation:'up'});o.success({tempFilePath:file});}};
 const canvas={getContext:()=>({fillRect(){},setTransform(...a){transforms.push(a);},drawImage(_, ...args){draws.push(args);}}),createImage(){
  return {width,height,set src(v){if(outputs.has(v))Object.assign(this,outputs.get(v));queueMicrotask(()=>this.onload());}};}};
 let canvasCalls=0;
 return {run:(active=()=>true)=>preparePhoto('source',async()=>{canvasCalls++;return canvas;},active),deleted,exports,reads,canvas,transforms,draws,opened,writes,nativeCalls,get canvasCalls(){return canvasCalls;}};
}
for(const [w,h,ew,eh] of [[1000,1000,1000,1000],[1920,1080,1920,1080],[3000,2000,1920,1280],[4032,3024,1920,1440],[3024,4032,1440,1920],[4000,4000,1732,1732]])test(`photo dimensions ${w}x${h} safely fit`,async()=>{
 assert.deepEqual(fitUploadSize(w,h),{width:ew,height:eh});
 const f=fixture({width:w,height:h});const result=await f.run();assert.equal(result.path,w===ew?'source':'prepared-0');
 if(w!==ew){assert.deepEqual(f.exports,[[ew,eh,.94]]);assert.equal(f.canvas.width,1);result.release();assert.deepEqual(f.deleted,['prepared-0']);}
 assert.ok(ew*eh<=PHOTO_LIMITS.pixels);assert.ok(Math.abs(eh-ew*h/w)<1.5);
});
test('high-byte small photo is encoded from the original again at lower quality, deleting both temp files',async()=>{
 const f=fixture({width:1000,height:1000,size:9*1024*1024,sizes:[9*1024*1024,700000]});
 const r=await f.run();assert.equal(r.path,'prepared-1');r.release();
 assert.deepEqual(f.exports,[[1000,1000,.94],[1000,1000,.86]]);assert.deepEqual(f.draws,[[0,0,1000,1000],[0,0,1000,1000]]);
 assert.deepEqual(f.deleted,['prepared-0','prepared-1']);
});
test('oversize, unsupported signatures and failed decoding never create a canvas file',async()=>{
 for(const [config,error] of [[{width:10001,height:5000},/5000 万/],[{size:50*1024*1024+1},/50 MiB/],[{format:'fake'},/HEIC/],[{bad:true},/无法解码/]]){
  const f=fixture(config);await assert.rejects(f.run(),error);assert.equal(f.exports.length,0);
 }
});
test('PNG and WebP are recognized by signature, not the supplied filename',async()=>{
 for(const format of ['png','webp'])assert.equal((await fixture({width:1000,height:1000,format}).run()).path,'source');
});
test('readFile binary compatibility accepts cross-realm buffers, views and binary strings',async()=>{
 for(const dataMode of ['cross-realm','view','binary-string'])
  assert.equal((await fixture({width:1000,height:1000,dataMode}).run()).path,'source');
});
test('EXIF axes preserve all eight rotations and mirrors on an asymmetric reference point',()=>{
 const expected=[[.2,.3],[.8,.3],[.8,.7],[.2,.7],[.3,.2],[.7,.2],[.7,.8],[.3,.8]];
 for(const [i,o] of ['up','up-mirrored','down','down-mirrored','left-mirrored','right','right-mirrored','left'].entries()){
  const {matrix:[a,b,c,d,x,y],swapped}=photoAxes(o);
  assert.deepEqual([+(a*.2+c*.3+x).toFixed(5),+(b*.2+d*.3+y).toFixed(5)],expected[i]);assert.equal(swapped,i>=4);
 }
 const raw=Uint8Array.of(255,216,255,225,0,4,1,2,255,219,0,3,99,255,218,0,2,18,255,217);
 assert.deepEqual([...new Uint8Array(withoutPhotoOrientation(raw.buffer,'jpeg'))],[255,216,255,219,0,3,99,255,218,0,2,18,255,217]);
});
test('cancel after export deletes generated photo; a failed preparation cannot upload',async()=>{
 const f=fixture();await assert.rejects(f.run(()=>!f.exports.length),/取消/);
 assert.deepEqual(f.deleted,['prepared-0']);assert.equal(f.canvas.width,1);
});
for(const [width,height,size,ew,eh] of [[6000,4000,50000,1920,1280],[8064,6048,50000,1920,1440],[10000,5000,ORIGINAL_PHOTO_LIMITS.bytes,1920,960],[1000,1000,35*1024*1024,1000,1000]])test(`native bounded processing ${width}×${height} (${size} bytes)`,async()=>{
 const f=fixture({width,height,size});const out=await f.run();
 assert.deepEqual(f.nativeCalls.map(o=>[o.compressedWidth,o.compressedHeight,o.quality]),[[ew,eh,92]]);
 assert.equal(f.canvasCalls,0);assert.ok(f.reads.every(n=>n<=16));
 assert.equal(out.path,'native-photo');out.release();assert.deepEqual(f.deleted,['native-photo']);
});
test('large EXIF JPEG is neutralized by a bounded header patch, then only the thumbnail rotates',async()=>{
 const f=fixture({width:6048,height:8064,orientation:'right',input:[255,216,255,225,0,4,1,2,255,219,0,3,99,255,218,0,2,18,255,217]});
 const out=await f.run();
 assert.equal(f.opened.length,1);assert.equal(f.nativeCalls[0].src,f.opened[0]);assert.deepEqual(f.writes,[[3,239]]);
 assert.deepEqual(f.nativeCalls.map(o=>[o.compressedWidth,o.compressedHeight]),[[1440,1920]]);
 assert.deepEqual(f.exports,[[1920,1440,.94]]);assert.deepEqual(f.transforms.at(-1),[0,1,-1,0,1920,0]);
 assert.ok(f.reads.every(n=>n<=16));out.release();assert.deepEqual(f.deleted,[f.opened[0],'native-photo','prepared-0']);
});
test('large native failures, unsupported SDK, wrong dimensions and unsupported PNG never decode the original with Canvas',async()=>{
 for(const [config,error,deleted] of [
  [{sdk:'2.25.9'},/更新微信/,[]],
  [{native:o=>o.fail({errMsg:'out of memory'})},/裁剪/,[]],
  [{native:(_o,done)=>done({width:8064,height:6048})},/尺寸或方向/,['native-photo']],
  [{native:(_o,done)=>done({orientation:'right'})},/尺寸或方向/,['native-photo']],
  [{format:'png',input:[...signatures.png,0,0,0,0,73,68,65,84,0,0,0,0],native:o=>o.fail({})},/裁剪/,[]],
 ]){
  const f=fixture({width:8064,height:6048,...config});await assert.rejects(f.run(),error);
  assert.equal(f.canvasCalls,0);assert.deepEqual(f.deleted,deleted);
 }
});
test('large PNG is resized only as static PNG and rejects APNG before invoking the compressor',async()=>{
 const png=[...signatures.png,0,0,0,0,73,68,65,84,0,0,0,0];
 const f=fixture({width:6000,height:4000,format:'png',input:png});
 const r=await f.run();assert.equal(r.path,'native-photo');assert.equal(f.canvasCalls,0);r.release();
 const animated=fixture({width:6000,height:4000,format:'png',input:[...signatures.png,0,0,0,0,97,99,84,76,0,0,0,0]});
 await assert.rejects(animated.run(),/动图/);assert.equal(animated.nativeCalls.length,0);
});
test('large output over the byte budget is re-encoded only from the bounded thumbnail',async()=>{
 const f=fixture({width:8064,height:6048,native:(_o,done)=>done({size:9*1024*1024})});
 const r=await f.run();assert.deepEqual(f.exports,[[1920,1440,.94]]);
 assert.deepEqual(f.deleted,['native-photo']);r.release();assert.deepEqual(f.deleted,['native-photo','prepared-0']);
});
test('large preparation serializes across callers and deletes a cancelled native result',async()=>{
 let finish,active=true;
 const f=fixture({width:8064,height:6048,native:(_o,done)=>{finish=done;}});
 const pending=f.run(()=>active);
 for(let i=0;!finish&&i<30;i++)await Promise.resolve();
 assert.ok(finish);await assert.rejects(f.run(),/另一张/);active=false;finish();
 await assert.rejects(pending,/取消/);assert.deepEqual(f.deleted,['native-photo']);assert.equal(f.canvasCalls,0);
});
test('timed-out native request blocks new decodes until its late result has been deleted',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let finish;
 const f=fixture({width:8064,height:6048,native:(_o,done)=>{finish=done;}});
 const pending=f.run();
 for(let i=0;!finish&&i<30;i++)await Promise.resolve();
 assert.ok(finish);
 const rejected=assert.rejects(pending,/超时/);
 t.mock.timers.tick(30_000);
 await rejected;await assert.rejects(f.run(),/另一张/);
 finish();assert.deepEqual(f.deleted,['native-photo']);
 assert.equal(f.nativeCalls.length,1);assert.equal(f.canvasCalls,0);
});
