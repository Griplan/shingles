const FORMAL_TOKEN='dm1.'+'c'.repeat(60)+'.'+'s'.repeat(43);
const FORMAL_RESPONSE=Object.freeze({
  access_token:FORMAL_TOKEN,
  token_type:'Bearer',
  access_kind:'production',
  expires_at:9999999999,
});

function login(options){
  options.success({code:'synthetic-wechat-code'});
  options.complete?.();
}

function wrapRequest(handler){
  return options=>{
    if(options.url.endsWith('/api/v1/access/wechat')){
      options.success({statusCode:200,data:{...FORMAL_RESPONSE,expires_at:Date.now()/1000+900}});
      options.complete?.();
      return;
    }
    handler(options);
  };
}

module.exports={FORMAL_TOKEN,FORMAL_RESPONSE,login,wrapRequest};
