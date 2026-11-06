const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {aiTransport}=require(path.join(process.env.DERMATOME_BUILD_DIR,'services/ai.js'));
function harness(){const calls=[],removed=[];const sid='a'.repeat(32),photo='b'.repeat(32);const image={width:100,height:80,oriented_rgb_sha256:'c'.repeat(64)};
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({platform:'devtools'}),
 request:o=>{calls.push(o);o.success({statusCode:o.method==='DELETE'?204:200,data:{session_id:sid,session_token:'secret',expires_at:12345}})},
 uploadFile:o=>{calls.push(o);o.success({statusCode:200,data:JSON.stringify({session_id:sid,photo_id:photo,image,expires_at:12345})})},
 downloadFile:o=>{calls.push(o);o.success({statusCode:200,tempFilePath:'temp.png'})},getImageInfo:o=>o.success(image),getFileSystemManager:()=>({unlink:o=>removed.push(o.filePath)})};return {calls,removed};}
test('upload normalized photo download carries secret only in header and deletes cache',async()=>{
 const {calls,removed}=harness();const s=await aiTransport.open('local.jpg');assert.equal(s.localPhoto,'temp.png');
 assert.equal(calls[1].header['x-ai-session-key'],'secret');assert.equal(calls[2].header['x-ai-session-key'],'secret');assert.ok(calls.every(x=>!x.url.includes('secret')));
 aiTransport.forget(s.localPhoto);assert.deepEqual(removed,['temp.png']);await aiTransport.remove(s);assert.equal(calls.at(-1).method,'DELETE');
});
test('upload mismatch removes new session and never yields photo',async()=>{
 const {calls}=harness();wx.getImageInfo=o=>o.success({width:1,height:1});await assert.rejects(aiTransport.open('local.jpg'),/尺寸不一致/);assert.equal(calls.at(-1).method,'DELETE');
});
test('unconfigured physical device fails safely; release remains disabled before upload',async t=>{const servers=require(path.join(process.env.DERMATOME_BUILD_DIR,'config/servers.js')),old=servers.SERVERS;servers.SERVERS={trialBaseUrl:'',releaseBaseUrl:''};t.after(()=>{servers.SERVERS=old});
 const {calls}=harness();wx.getSystemInfoSync=()=>({platform:'ios'});await assert.rejects(aiTransport.open('local.jpg'),/当前测试服务/);assert.equal(calls.length,0);
 wx.getSystemInfoSync=()=>({platform:'devtools'});wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});await assert.rejects(aiTransport.open('local.jpg'));assert.equal(calls.length,0);
});
test('network timeout and expired asset explicitly fail, never fake masks',async()=>{
 const {calls}=harness();wx.request=o=>o.fail({errMsg:'request:fail timeout'});await assert.rejects(aiTransport.open('local.jpg'),/超时/);
 harness();const s=await aiTransport.open('local.jpg');wx.downloadFile=o=>o.success({statusCode:410,tempFilePath:'expired.png'});await assert.rejects(aiTransport.asset(s,'candidate-0','r'),/过期/);
});
