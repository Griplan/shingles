// Native page lifecycle adapters with synthetic geometry; no model/clinical expectations.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=p=>require(path.join(process.env.DERMATOME_BUILD_DIR,p));
const {placementSession}=load('state/placement-session.js');
const {annotationSession}=load('state/annotation-session.js');
const {aiTransport}=load('services/ai.js');
let aiDef,annotationDef;global.Page=d=>aiDef=d;load('pages/ai-annotate/ai-annotate.js');global.Page=d=>annotationDef=d;load('pages/annotate/annotate.js');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
const instance=def=>{const p={data:structuredClone(def.data),setData(c){Object.assign(this.data,c)}};for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);return p;};
function source(){return {schema_version:'confirmed-photo-segmentation-v1',session_id:'A',photo_id:'photo-A',result_id:'result-A',candidate_id:'candidate-0',prompt_revision:1,
 coordinate_space:'photo_oriented_normalized_v1',confirmed_by_user:true,confirmed_at:Date.now()/1000-1,expires_at:Date.now()/1000+9000,image:{width:100,height:100,oriented_rgb_sha256:'a'.repeat(64)},model:{name:'synthetic-fixture'},prompts:{coordinate_space:'photo_oriented_normalized_v1',points:[],box:null},mask_asset:'candidate-0.png',mask_sha256:'b'.repeat(64),geometry:{type:'MultiPolygon',coordinates:[[[[.3,.3],[.7,.3],[.7,.7],[.3,.7],[.3,.3]]]]}};}
for(const action of ['cancel','replace','manual','ttl'])test('AI '+action+' releases pending placement before clearing the old photo session',async t=>{
 let file='A',tick;const interval=global.setInterval,clock=Date.now;
 global.setInterval=(cb,delay)=>{tick=cb;return interval(cb,delay)};
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({platform:'devtools'}),nextTick:f=>queueMicrotask(f),showModal:o=>o.success({confirm:true}),chooseMedia:o=>o.success({tempFiles:[{tempFilePath:file,size:5}]}),navigateBack(){},redirectTo(){}};
 aiTransport.open=async id=>({session_id:id,session_token:'test-only',photo_id:'photo-'+id,expires_at:clock()/1000+1000,image:{width:100,height:100,oriented_rgb_sha256:'a'.repeat(64)},localPhoto:id+'.png'});aiTransport.remove=async()=>{};aiTransport.forget=()=>{};
 const p=instance(aiDef);p.onLoad({view:'front',region:'front-chest'});global.setInterval=interval;t.after(()=>{Date.now=clock;global.setInterval=interval;p.onUnload()});
 p.choosePhoto('album');await flush();const r=placementSession.open(source(),'front','front-chest',()=>true);assert.equal(r.ok,true,r.message);assert.equal(placementSession.read(r.draft.id).ok,true);
 if(action==='cancel')p.cancel();if(action==='replace'){file='B';p.choosePhoto('album');}if(action==='manual')p.backManual();
 if(action==='ttl'){Date.now=()=>clock()+2000000;tick();Date.now=clock;}
 await flush();assert.equal(placementSession.read(r.draft.id).ok,false,'explicit deletion must release cached pending geometry, even if its source callback remains true');
 if(action==='replace')assert.equal(p.data.photo,'B.png');else assert.equal(p.data.photo,'');
});
test('V2 return-to-selection skips the intermediate AI page while preserving the original manual route',t=>{
 const saved=global.getCurrentPages;t.after(()=>{if(saved)global.getCurrentPages=saved;else delete global.getCurrentPages;});
 let last;global.wx={navigateBack:o=>{last={kind:'back',delta:o.delta}},redirectTo:o=>{last={kind:'redirect',url:o.url}}};
 const p=instance(annotationDef);
 for(const [routes,delta]of [[['pages/select/select','pages/annotate/annotate'],1],[['pages/select/select','pages/ai-annotate/ai-annotate','pages/annotate/annotate'],2]]){
  global.getCurrentPages=()=>routes.map(route=>({route}));p.backToSelection();assert.deepEqual(last,{kind:'back',delta});
 }
 global.getCurrentPages=()=>[{route:'pages/ai-annotate/ai-annotate'},{route:'pages/annotate/annotate'}];p.backToSelection();assert.deepEqual(last,{kind:'redirect',url:'/pages/select/select'});
 delete global.getCurrentPages;p.backToSelection();assert.deepEqual(last,{kind:'back',delta:1});assert.ok(annotationSession.snapshot());
});
