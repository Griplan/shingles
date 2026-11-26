// Network transport tests use synthetic data only. The historical public-IP
// trial protocol must no longer exist in any runtime build.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=process.env.DERMATOME_BUILD_DIR,load=f=>require(path.join(root,f));
const environment=load('config/environment.js'),servers=load('config/servers.js'),api=load('config/api.js');
const controlled=load('config/controlled.js'),online=load('services/online-access.js');
const {canUseAI,canPlaceAI}=load('config/ai.js'),{canMatchReference,canPreviewAtlas}=load('config/development.js');
const formal=require('./formal-auth-fixtures.cjs');

function setup(t){
  const old=servers.SERVERS;
  servers.SERVERS={formalBaseUrl:'https://formal.example.test'};
  controlled.clearControlledServer();
  t.after(()=>{controlled.clearControlledServer();servers.SERVERS=old;});
  global.wx={
    getAccountInfoSync:()=>({miniProgram:{envVersion:'trial'}}),
    getSystemInfoSync:()=>({platform:'ios'}),
    getWindowInfo:()=>({windowHeight:844}),
    nextTick:f=>queueMicrotask(f),
    getStorageSync:()=>assert.fail('网络鉴权不得读取旧缓存'),
    setStorageSync:()=>assert.fail('网络鉴权不得持久化令牌或服务器地址'),
  };
}

test('explicit environment matrix keeps business features on and unknown environments closed',()=>{
  for(const env of ['develop','trial','release','unknown','',undefined,'production']){
    const c=environment.capabilities({miniProgram:{envVersion:env}}),business=['develop','trial','release'].includes(env);
    assert.equal(c.bodyView,true);assert.equal(c.manualAnnotation,true);
    for(const feature of ['referenceMatching','aiSegmentation','aiPlacement'])assert.equal(c[feature],business);
    for(const feature of ['atlasDebug','coordinateDebug'])assert.equal(c[feature],env==='develop');
  }
  for(const input of [null,undefined,{},[],{miniProgram:null},{envVersion:'trial'}])assert.equal(environment.capabilities(input).aiSegmentation,false);
});

test('develop, trial and release resolve to one HTTPS service; only an explicit local key can select localhost',t=>{
  setup(t);
  for(const env of ['develop','trial','release']){
    wx.getAccountInfoSync=()=>({miniProgram:{envVersion:env}});
    assert.equal(api.apiBaseUrl(),'https://formal.example.test');
  }
  wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'unknown'}});assert.throws(()=>api.apiBaseUrl(),/暂不支持在线服务/);
  wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'develop'}});wx.getSystemInfoSync=()=>({platform:'devtools'});
  controlled.useControlledServer('synthetic-test-access-key-0123456789');
  assert.equal(api.apiBaseUrl(),'http://127.0.0.1:18001');
  controlled.clearControlledServer();
  assert.equal(api.apiBaseUrl(),'https://formal.example.test');
});

test('formal HTTPS base rejects HTTP, IPs, credentials, ports, paths and query strings',t=>{
  setup(t);
  for(const value of ['','http://formal.example.test','https://127.0.0.1','https://192.168.1.2','https://localhost',
    'https://demo.local','https://user:password@formal.example.test','https://formal.example.test:8001',
    'https://formal.example.test/path','https://formal.example.test?key=secret','https://formal..test']){
    assert.throws(()=>servers.validatedHttpsBase(value));
  }
  servers.SERVERS={formalBaseUrl:''};
  wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});
  assert.throws(()=>api.apiBaseUrl(),/当前测试服务/);
});

test('all normal environments silently use wx.login and never POST the retired trial session route',async t=>{
  setup(t);
  const urls=[],codes=[];let logins=0;
  wx.login=o=>{logins++;codes.push('synthetic-login-'+logins);o.success({code:codes.at(-1)});};
  wx.request=o=>{
    urls.push(o.url);
    assert.equal(o.url,'https://formal.example.test/api/v1/access/wechat');
    assert.equal(o.method,'POST');assert.ok(codes.includes(o.data.code));
    o.success({statusCode:200,data:{...formal.FORMAL_RESPONSE,expires_at:Date.now()/1000+900}});
  };
  for(const env of ['develop','trial','release']){
    wx.getAccountInfoSync=()=>({miniProgram:{envVersion:env}});
    const headers=await online.onlineHeaders();
    assert.deepEqual(headers,{authorization:'Bearer '+formal.FORMAL_TOKEN});
    online.invalidateOnlineAccess(headers.authorization);
  }
  assert.equal(logins,3);assert.equal(urls.length,3);
  assert.ok(urls.every(url=>url.startsWith('https://')));
  assert.ok(urls.every(url=>!url.includes('/access/session')));
});

test('explicit local development key bypasses WeChat login but remains in memory',async t=>{
  setup(t);
  wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'develop'}});
  wx.getSystemInfoSync=()=>({platform:'devtools'});
  controlled.useControlledServer('synthetic-test-access-key-0123456789');
  let logins=0,requests=0;wx.login=()=>{logins++;};wx.request=()=>{requests++;};
  assert.deepEqual(await online.onlineHeaders(),{'x-test-access-key':'synthetic-test-access-key-0123456789'});
  assert.equal(logins,0);assert.equal(requests,0);
  controlled.clearControlledServer();assert.deepEqual(controlled.accessHeaders(),{});
});

test('formal login failures never fall back to HTTP or the old test-token protocol',async t=>{
  setup(t);
  const urls=[];wx.login=formal.login;
  wx.request=o=>{urls.push(o.url);o.success({statusCode:403,data:{error:{code:'PRODUCTION_ACCESS_DENIED'}}});};
  wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});
  await assert.rejects(online.onlineHeaders(),/微信登录未通过/);
  assert.deepEqual(urls,['https://formal.example.test/api/v1/access/wechat']);
  assert.ok(urls.every(url=>!url.includes('/access/session')));
});

test('trial and release expose enabled business capabilities without developer controls',t=>{
  setup(t);
  assert.ok(canUseAI()&&canPlaceAI()&&canMatchReference());assert.equal(canPreviewAtlas(),false);assert.equal(environment.canUseDeveloperTools(),false);
  wx.getSystemInfoSync=()=>({platform:'android'});assert.equal(canUseAI(),true);
  wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});assert.equal(canUseAI(),true);assert.equal(canPlaceAI(),true);assert.equal(canMatchReference(),true);
  wx.getAccountInfoSync=()=>{throw Error('not available')};assert.equal(canUseAI(),false);
});

test('source and runtime contain no old public HTTP address or retired trial-access module',()=>{
  const sourceRoot=path.resolve(__dirname,'../../miniprogram');
  assert.equal(fs.existsSync(path.join(sourceRoot,'services/trial-access.ts')),false);
  assert.equal(fs.existsSync(path.join(root,'services/trial-access.js')),false);
  for(const relative of ['config/servers.ts','config/api.ts','services/online-access.ts']){
    const source=fs.readFileSync(path.join(sourceRoot,relative),'utf8');
    assert.doesNotMatch(source,/212\.64\.26\.206/);assert.doesNotMatch(source,/dermatome-test/);assert.doesNotMatch(source,/access\/session/);
  }
});

test('homepage still has no invitation input or activation action',t=>{
  setup(t);const base=path.resolve(__dirname,'../../miniprogram/pages/index/index');
  for(const suffix of ['.ts','.wxml'])assert.doesNotMatch(fs.readFileSync(base+suffix,'utf8'),/connectTrial|开通体验访问|邀请码/);
});
