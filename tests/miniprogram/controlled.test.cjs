const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.DERMATOME_BUILD_DIR;
const control=require(path.join(root,'config/controlled.js')),api=require(path.join(root,'config/api.js'));
test('受控云端凭据只在内存生效，清除后回线上测试入口；真机不能借此绕过HTTPS门禁',()=>{
 global.wx={getSystemInfoSync:()=>({platform:'devtools'}),getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})};
 assert.equal(api.apiBaseUrl(),'http://212.64.26.206/dermatome-test');
 assert.throws(()=>control.useControlledServer('short'));
 control.useControlledServer('synthetic-test-access-key-0123456789');
 assert.equal(api.apiBaseUrl(),'http://127.0.0.1:18001');
 assert.deepEqual(control.accessHeaders(),{'x-test-access-key':'synthetic-test-access-key-0123456789'});
 control.clearControlledServer();assert.deepEqual(control.accessHeaders(),{});assert.equal(api.apiBaseUrl(),'http://212.64.26.206/dermatome-test');
 wx.getSystemInfoSync=()=>({platform:'ios'});assert.throws(()=>control.useControlledServer('synthetic-test-access-key-0123456789'));
});
