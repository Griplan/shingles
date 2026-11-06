// All network replies in this file are synthetic transport doubles, never clinical evidence.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.DERMATOME_BUILD_DIR,load=f=>require(path.join(root,f));
const environment=load('config/environment.js'),servers=load('config/servers.js'),api=load('config/api.js');
const access=load('services/trial-access.js'),{canUseAI,canPlaceAI}=load('config/ai.js'),{canMatchReference,canPreviewAtlas}=load('config/development.js');
const instance=def=>{const p={data:structuredClone(def.data),setData(c){Object.assign(this.data,c)},selectComponent:()=>({previewTransform(){}})};for(const[k,v]of Object.entries(def))if(typeof v==='function')p[k]=v.bind(p);return p;};
function setup(t){const old=servers.SERVERS;servers.SERVERS={trialBaseUrl:'https://trial.example.test',releaseBaseUrl:'https://release.example.test'};access.invalidateTrialAccess();
 t.after(()=>{access.invalidateTrialAccess();servers.SERVERS=old;});
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'trial'}}),getSystemInfoSync:()=>({platform:'ios'}),getWindowInfo:()=>({windowHeight:844}),nextTick:f=>queueMicrotask(f)};
}
const token='SYNTHETIC_SESSION_0123456789abcdefghijklmnop';
const response=()=>({access_token:token,token_type:'Bearer',access_kind:'public_test',expires_at:Date.now()/1000+3600});
test('explicit environment matrix keeps trial business on, debug off, release/unknown network off',()=>{
 for(const env of ['develop','trial','release','unknown','',undefined,'production']){
  const c=environment.capabilities({miniProgram:{envVersion:env}}),business=['develop','trial'].includes(env);
  assert.equal(c.bodyView,true);assert.equal(c.manualAnnotation,true);
  for(const feature of ['referenceMatching','aiSegmentation','aiPlacement'])assert.equal(c[feature],business);
  for(const feature of ['atlasDebug','coordinateDebug'])assert.equal(c[feature],env==='develop');
 }
 for(const input of [null,undefined,{},[],{miniProgram:null},{envVersion:'trial'}])assert.equal(environment.capabilities(input).aiSegmentation,false);
});
test('ordinary trial configuration requires HTTPS and rejects arbitrary IP or URL additions',t=>{
 setup(t);assert.equal(api.apiBaseUrl(),'https://trial.example.test');wx.getSystemInfoSync=()=>({platform:'devtools'});assert.equal(api.apiBaseUrl(),'https://trial.example.test');
 for(const value of ['', 'http://trial.example.test','https://127.0.0.1','https://192.168.1.2','https://localhost','https://demo.local','https://user:password@trial.example.test','https://trial.example.test:8001','https://trial.example.test/path','https://trial.example.test?key=secret','https://trial..test'])assert.throws(()=>servers.validatedHttpsBase(value));
 servers.SERVERS={trialBaseUrl:'',releaseBaseUrl:''};assert.throws(()=>api.apiBaseUrl(),/当前测试服务/);
});
test('temporary IP debugging permits only the exact verified address; release and unknown stay closed',t=>{
 setup(t);const base='http://212.64.26.206/dermatome-test';
 servers.SERVERS={trialBaseUrl:base,trialPublicIpDebug:true,releaseBaseUrl:''};
 assert.equal(api.apiBaseUrl(),base);assert.equal(servers.usingPublicIpDebug(),true);
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'develop'}});assert.equal(api.apiBaseUrl(),base);
 wx.getSystemInfoSync=()=>({platform:'devtools'});assert.equal(api.apiBaseUrl(),'http://127.0.0.1:8000');
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'trial'}});
 for(const invalid of [base+'/',base+'?key=secret',base+'/api/v1','http://212.64.26.206:8001/dermatome-test','http://other.test/dermatome-test','http://user:pass@212.64.26.206/dermatome-test']){
  servers.SERVERS={trialBaseUrl:invalid,trialPublicIpDebug:true,releaseBaseUrl:''};assert.throws(()=>api.apiBaseUrl());
 }
 servers.SERVERS={trialBaseUrl:base,trialPublicIpDebug:false,releaseBaseUrl:''};assert.throws(()=>api.apiBaseUrl());
 servers.SERVERS={trialBaseUrl:base,trialPublicIpDebug:true,releaseBaseUrl:base};
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});assert.throws(()=>api.apiBaseUrl());
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'unknown'}});assert.throws(()=>api.apiBaseUrl());
});
test('failed automatic session is reported as unavailable',async t=>{
 setup(t);for(const status of [500,502,503,504]){wx.request=o=>o.success({statusCode:status});await assert.rejects(access.ensureTrialAccess(),/服务暂不可用/);assert.equal(access.trialAccessActive(),false);}
});
test('trial mobile enables AI, placement and matching but hides atlas/debug tools; release remains closed',t=>{
 setup(t);assert.ok(canUseAI()&&canPlaceAI()&&canMatchReference());assert.equal(canPreviewAtlas(),false);assert.equal(environment.canUseDeveloperTools(),false);
 wx.getSystemInfoSync=()=>({platform:'android'});assert.equal(canUseAI(),true);
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});assert.equal(canUseAI(),false);assert.equal(canPlaceAI(),false);assert.equal(canMatchReference(),false);
 wx.getAccountInfoSync=()=>{throw Error('not available')};assert.equal(canUseAI(),false);
});
test('concurrent business actions open one silent session without invitation or environment identity',async t=>{
 setup(t);let reply,opens=0;
 wx.showModal=()=>assert.fail('No access dialog should be shown');
 wx.request=o=>{opens++;reply=o;assert.equal(o.url,'https://trial.example.test/api/v1/access/session');assert.equal(o.method,'POST');assert.deepEqual(o.data,{});assert.equal(o.header.authorization,undefined);};
 const a=access.ensureTrialAccess(),b=access.ensureTrialAccess();assert.equal(a,b);assert.equal(opens,1);
 reply.success({statusCode:200,data:response()});await Promise.all([a,b]);assert.equal(access.trialAccessActive(),true);
 await access.ensureTrialAccess();assert.equal(opens,1);assert.deepEqual(access.trialHeaders(),{authorization:'Bearer '+token});
});
test('late session response or unauthorized response cannot resurrect or clear a newer session',async t=>{
 setup(t);let reply;wx.request=o=>reply=o;
 const pending=access.ensureTrialAccess();access.invalidateTrialAccess();reply.success({statusCode:200,data:response()});await assert.rejects(pending,/取消/);assert.deepEqual(access.trialHeaders(),{});
 wx.request=o=>o.success({statusCode:200,data:response()});await access.ensureTrialAccess();
 access.invalidateTrialAccess('Bearer OLD');assert.equal(access.trialAccessActive(),true);
 access.invalidateTrialAccess('Bearer '+token);assert.equal(access.trialAccessActive(),false);
});
test('matching and photo request/upload/download all carry expiring bearer and photo capability',async t=>{
 setup(t);wx.request=o=>o.success({statusCode:200,data:response()});await access.ensureTrialAccess();
 const calls=[],sid='a'.repeat(32),photo='b'.repeat(32),image={width:100,height:80,oriented_rgb_sha256:'c'.repeat(64)};
 wx.request=o=>{calls.push(o);o.success({statusCode:o.method==='DELETE'?204:200,data:o.url.endsWith('/evaluate')?{synthetic:true}:{session_id:sid,session_token:'SYNTHETIC_PHOTO_CAPABILITY',expires_at:Date.now()/1000+1800}})};
 let expires;wx.request=o=>{calls.push(o);expires??=Date.now()/1000+1800;o.success({statusCode:o.method==='DELETE'?204:200,data:o.url.endsWith('/evaluate')?{synthetic:true}:{session_id:sid,session_token:'SYNTHETIC_PHOTO_CAPABILITY',expires_at:expires}})};
 wx.uploadFile=o=>{calls.push(o);o.success({statusCode:200,data:JSON.stringify({session_id:sid,photo_id:photo,image,expires_at:expires})})};
 wx.downloadFile=o=>{calls.push(o);o.success({statusCode:200,tempFilePath:'SYNTHETIC.png'})};wx.getImageInfo=o=>o.success(image);wx.getFileSystemManager=()=>({unlink(){}});
 const s=await load('services/ai.js').aiTransport.open('SYNTHETIC.jpg');await load('services/api.js').evaluateAnnotations({});await load('services/ai.js').aiTransport.remove(s);
 assert.equal(calls.length,5);assert.ok(calls.every(c=>c.header.authorization==='Bearer '+token&&!c.url.includes(token)&&!c.header['x-test-access-key']));
 assert.equal(calls[1].header['x-ai-session-key'],'SYNTHETIC_PHOTO_CAPABILITY');assert.equal(calls[2].header['x-ai-session-key'],'SYNTHETIC_PHOTO_CAPABILITY');
});
test('trial entry and AI page are usable while raw coordinate toggles are blocked; release direct placement rejected',t=>{
 setup(t);let def,route;global.Page=o=>def=o;
 function page(name){const p=path.join(root,'pages',name,name+'.js');delete require.cache[require.resolve(p)];require(p);return instance(def);}
 wx.navigateTo=o=>{route=o.url};const select=page('select');select.onShow();assert.equal(select.data.aiAllowed,true);assert.equal(select.data.debugAllowed,false);
 select.toggleDeveloper();select.toggleDebug({detail:{value:true}});assert.equal(select.data.developerOpen,false);assert.equal(select.data.debugEnabled,false);
 select.applySelection('front-chest');select.startAI();assert.match(route,/ai-annotate/);
 const ai=page('ai-annotate');ai.onLoad({view:'front',region:'front-chest'});ai.onShow();assert.equal(ai.data.available,true);t.after(()=>ai.onUnload());
 const fs=require('node:fs');assert.match(fs.readFileSync(path.resolve(__dirname,'../../miniprogram/pages/annotate/annotate.wxml'),'utf8'),/matchingAllowed/);
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});const placement=page('placement');placement.onLoad({draftId:'synthetic'});assert.match(placement.data.error,/未开放/);placement.onUnload();
});
test('malformed or failed automatic session never grants access',async t=>{
 setup(t);wx.request=o=>o.success({statusCode:401,data:{error:{code:'INVITATION_INVALID'}}});await assert.rejects(access.ensureTrialAccess(),/暂不可用/);assert.equal(access.trialAccessActive(),false);
 for(const data of [null,'unexpected html',{...response(),expires_at:0},{...response(),access_kind:'invited_trial'}]){wx.request=o=>o.success({statusCode:200,data});await assert.rejects(access.ensureTrialAccess(),/未完成/);assert.deepEqual(access.trialHeaders(),{});}
});

test('automatic session expiry renews silently; network failure retries only after user action',async t=>{
 setup(t);let now=Date.now(),calls=0;const oldNow=Date.now;Date.now=()=>now;t.after(()=>{Date.now=oldNow;});
 wx.showModal=()=>assert.fail('No credential dialog');wx.request=o=>{calls++;o.success({statusCode:200,data:response()});};
 await access.ensureTrialAccess();now+=3601*1000;assert.equal(access.trialAccessActive(),false);assert.deepEqual(access.trialHeaders(),{});
 await access.ensureTrialAccess();assert.equal(calls,2);
 access.invalidateTrialAccess();wx.request=o=>{calls++;o.fail({errMsg:'timeout'})};await assert.rejects(access.ensureTrialAccess(),/超时/);assert.equal(calls,3);assert.deepEqual(access.trialHeaders(),{});
 wx.request=o=>{calls++;o.success({statusCode:200,data:response()})};await access.ensureTrialAccess();assert.equal(calls,4);
});
test('homepage has no invitation input or activation action',t=>{
 setup(t);const fs=require('node:fs'),base=path.resolve(__dirname,'../../miniprogram/pages/index/index');
 for(const suffix of ['.ts','.wxml'])assert.doesNotMatch(fs.readFileSync(base+suffix,'utf8'),/connectTrial|开通体验访问|邀请码/);
});
