const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {AIPhotoFlow}=read('state/ai-session.js'),{fitPhoto,photoTouch,dragBox}=read('utils/photo-coordinate.js');
const {PHOTO_SPACE}=read('types/ai.js');
const box={xMin:.1,yMin:.2,xMax:.7,yMax:.8};
const session=id=>({session_id:id,session_token:'secret'+id,photo_id:'photo'+id,expires_at:Date.now()/1000+1000,image:{width:100,height:80,oriented_rgb_sha256:id},localPhoto:id+'.png'});
const candidate=(i,status='ok')=>({candidate_id:'candidate-'+i,status,area_ratio:.2,outside_box_ratio:0,component_count:1,hole_count:0,warnings:[]});
const result=(s,revision,id)=>({session_id:s.session_id,photo_id:s.photo_id,result_id:'result'+id,request_id:id,prompt_revision:revision,coordinate_space:PHOTO_SPACE,status:'needs_confirmation',candidates:[candidate(0),candidate(1),candidate(2,'empty_mask')]});
function fixture(){const removed=[],forgot=[];let confirms=0;
 const api={open:async id=>session(id),segment:async(s,p,rev,id)=>result(s,rev,id),asset:async(s,id,r)=>s.photo_id+id+r,
 confirm:async(s,r,id)=>{confirms++;return {schema_version:'confirmed-photo-segmentation-v1',session_id:s.session_id,photo_id:s.photo_id,result_id:r.result_id,candidate_id:id,prompt_revision:r.prompt_revision,
 coordinate_space:PHOTO_SPACE,confirmed_by_user:true,image:s.image,geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[1,0],[1,1],[0,0]]]]}};},
 remove:async s=>{removed.push(s.session_id);},forget:p=>forgot.push(p)};
 return {api,f:new AIPhotoFlow(api,()=>{}),removed,forgot,count:()=>confirms};}
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
async function prepared(){const v=fixture();await v.f.replace('A');v.f.edit(box,null);return v;}
for(const size of [[320,380],[390,520],[768,700],[220,240]])test('photo contain coordinates '+size,()=>{
 for(const dims of [[1000,500],[500,1000],[700,700]]){
  const r=fitPhoto(...dims,...size);assert.ok(r.left>=0&&r.top>=0);
  for(const p of [{x:.1,y:.2},{x:.5,y:.5},{x:.99,y:.99}]){
   const q=photoTouch(r.left+p.x*r.width,r.top+p.y*r.height,r);assert.ok(Math.abs(q.x-p.x)<1e-12&&Math.abs(q.y-p.y)<1e-12);
  }
  assert.equal(photoTouch(r.left-1,r.top,r),null);assert.equal(photoTouch(r.left,r.top+r.height+1,r),null);
 }
});
test('box sorted, degenerate rejected; DPR is not photo coordinate input',()=>{
 assert.deepEqual(dragBox({x:.7,y:.8},{x:.1,y:.2}),box);assert.equal(dragBox({x:0,y:0},{x:.001,y:.6}),null);
 assert.throws(()=>fitPhoto(0,100,320,400));
});
test('default preview is not confirmation, chosen candidate alone confirms',async()=>{
 const {f,count}=await prepared();await f.segment();assert.equal(f.selected,'candidate-0');assert.equal(f.confirmed,null);assert.equal(count(),0);
 await f.preview('candidate-1');assert.equal(count(),0);await f.confirm();assert.equal(f.confirmed.candidate_id,'candidate-1');assert.equal(f.phase,'confirmed');
 await f.preview('candidate-0');assert.equal(f.selected,'candidate-1');f.reset();assert.equal(f.confirmed,null);assert.equal(f.phase,'ready');
});
test('foreground/background/undo preserve box; reject bad points, reset invalidates results',async()=>{
 const {f}=await prepared();f.edit(null,{x:.4,y:.4,label:1});f.edit(null,{x:.8,y:.8,label:0});assert.equal(f.prompts.points.length,2);
 f.undo();assert.deepEqual(f.prompts.points,[{x:.4,y:.4,label:1}]);assert.deepEqual(f.prompts.box,box);
 f.edit(null,{x:1,y:.5,label:1});f.edit({xMin:.8,yMin:.2,xMax:.2,yMax:.8},null);assert.equal(f.prompts.points.length,1);
 await f.segment();f.reset();assert.equal(f.result,null);assert.equal(f.canConfirm(),false);assert.equal(f.prompts.box,null);assert.equal(f.history.length,0);
});
test('no valid prompt does not call inference',async()=>{
 const {f,api}=fixture();let calls=0;api.segment=async()=>{calls++};await f.replace('A');await f.segment();assert.equal(calls,0);
 f.edit(null,{x:.4,y:.4,label:0});await f.segment();assert.equal(calls,0);assert.ok(f.error);
});
test('late A inference cannot overwrite B photo',async()=>{
 const {f,api,removed}=await prepared();const wait=defer();let old;api.segment=(s,p,r,id)=>{old=result(s,r,id);return wait.promise;};
 const pending=f.segment();await f.replace('B');wait.resolve(old);await pending;
 assert.equal(f.session.photo_id,'photoB');assert.equal(f.result,null);assert.equal(f.maskPath,'');assert.ok(removed.includes('A'));
});
test('late A upload cleaned after B upload',async()=>{
 const {f,api,removed}=fixture();const wait=defer();api.open=id=>id==='A'?wait.promise:Promise.resolve(session(id));
 const pending=f.replace('A');await f.replace('B');wait.resolve(session('A'));await pending;
 assert.equal(f.session.photo_id,'photoB');assert.ok(removed.includes('A'));
});
test('late inference after changed prompts cannot restore obsolete candidates',async()=>{
 const {f,api}=await prepared();const wait=defer();let old;api.segment=(s,p,r,id)=>{old=result(s,r,id);return wait.promise;};
 const pending=f.segment();f.edit(null,{x:.3,y:.5,label:0});wait.resolve(old);await pending;assert.equal(f.result,null);assert.equal(f.canConfirm(),false);
});
test('late candidate preview cannot replace current preview or confirm wrong mask',async()=>{
 const {f,api,forgot}=await prepared();await f.segment();const wait=defer();api.asset=async(s,id)=>id==='candidate-0'?wait.promise:'one.png';
 const pending=f.preview('candidate-0');await f.preview('candidate-1');wait.resolve('zero.png');await pending;
 assert.equal(f.selected,'candidate-1');assert.equal(f.maskPath,'one.png');assert.ok(forgot.includes('zero.png'));await f.confirm();assert.equal(f.confirmed.candidate_id,'candidate-1');
});
test('empty mask cannot confirm; warning preserves raw full-image candidate',async()=>{
 const {f,api}=await prepared();api.segment=async(s,p,r,id)=>{const v=result(s,r,id);Object.assign(v.candidates[1],{area_ratio:1,warnings:['LARGE_MASK','OUTSIDE_BOX']});return v;};
 await f.segment();await f.preview('candidate-2');assert.equal(f.canConfirm(),false);await f.preview('candidate-1');assert.equal(f.canConfirm(),true);assert.equal(f.result.candidates[1].area_ratio,1);
});
for(const message of ['请求超时','模型失败','照片已过期'])test(message+' retains prompts and allows retry',async()=>{
 const {f,api}=await prepared();api.segment=async()=>{throw Error(message)};await f.segment();assert.equal(f.error,message);assert.deepEqual(f.prompts.box,box);assert.equal(f.result,null);
 api.segment=async(s,p,r,id)=>result(s,r,id);await f.segment();assert.equal(f.canConfirm(),true);
});
test('cancel invalidates confirmation in flight and deletes temporary photo',async()=>{
 const {f,api,removed}=await prepared();await f.segment();const wait=defer();api.confirm=()=>wait.promise;const pending=f.confirm();await f.cancel();wait.resolve({});await pending;
 assert.equal(f.confirmed,null);assert.equal(f.session,null);assert.equal(f.phase,'empty');assert.ok(removed.includes('A'));
});
test('mismatched result and confirmation rejected',async()=>{
 const {f,api}=await prepared();api.segment=async(s,p,r,id)=>({...result(s,r,id),photo_id:'foreign'});await f.segment();assert.ok(f.error);assert.equal(f.canConfirm(),false);
 api.segment=async(s,p,r,id)=>result(s,r,id);await f.segment();api.confirm=async()=>({photo_id:'foreign'});await f.confirm();assert.equal(f.confirmed,null);assert.ok(f.error);
});
test('temporary cleanup failure is explicit',async()=>{
 const {f,api}=await prepared();api.remove=async()=>{throw Error()};await f.cancel();assert.match(f.cleanupWarning,/删除尚未确认/);
});

test('page render acknowledgement is deferred, ignores stale photos and unchanged state',()=>{
 let page;global.Page=o=>page=o;read('pages/ai-annotate/ai-annotate.js');const ticks=[];
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({platform:'devtools'}),nextTick:f=>ticks.push(f)};
 const p={data:structuredClone(page.data),patches:[],setData(c){this.patches.push(c);Object.assign(this.data,c)}};for(const[k,v]of Object.entries(page))if(typeof v==='function')p[k]=v.bind(p);
 p.onLoad({view:'front',region:'front-chest'});p.data.photo='new';p.data.mask='mask';p.patches=[];
 p.renderState({detail:{source:'new',mask:'mask',ready:true}});assert.equal(p.patches.length,0);ticks.shift()();assert.equal(p.data.renderReady,true);
 p.renderState({detail:{source:'new',mask:'mask',ready:true}});ticks.shift()();assert.equal(p.patches.length,1);
 p.renderState({detail:{source:'old',mask:'old',ready:false}});ticks.shift()();assert.equal(p.data.renderReady,true);p.onUnload();
});
