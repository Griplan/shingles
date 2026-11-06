const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fromBuild = (file) => require(path.join(process.env.DERMATOME_BUILD_DIR, file));
let definition;
global.Component = (options) => { definition = options; };
fromBuild("components/body-canvas/body-canvas.js");
const { drawBody } = fromBuild("components/body-canvas/render.js");
const { fitViewport } = fromBuild("utils/coordinate.js");
const { getBodyModel } = fromBuild("data/body-models.js");
const BODY_MODEL=getBodyModel("front");
const { getBodyRegion } = fromBuild("data/body-regions.js");

// 明确的 Canvas 命令记录器；不宣称微信真实渲染。
function context() {
  const calls = [];
  let depth = 0;
  const ctx = { calls, depth: () => depth };
  for (const name of ["beginPath","moveTo","lineTo","bezierCurveTo","quadraticCurveTo",
    "drawImage","rect","arc","closePath","clip","stroke","clearRect","fillRect","translate","scale","setTransform","setLineDash"]) {
    ctx[name] = (...args) => calls.push([name,...args]);
  }
  ctx.fill = () => calls.push(["fill",ctx.fillStyle]);
  ctx.save = () => { depth++; calls.push(["save"]); };
  ctx.restore = () => { depth--; assert.ok(depth>=0); calls.push(["restore"]); };
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  return ctx;
}
function harness(width=343,height=540,dpr=2) {
  const ctx = context(), jobs = [], deferred = [];
  const state = { width, height, dpr, left:24, top:180, queryCount:0, fail:false, delay:false };
  state.imageFail=false;state.imageDelay=false;state.images=[];state.imageCallbacks=[];
  const node = { width:0, height:0, getContext:() => ctx,createImage(){
    const image={width:1200,height:2700,onload:null,onerror:null,_src:''};
    Object.defineProperty(image,'src',{get(){return this._src;},set(src){this._src=src;
      const fire=()=>state.imageFail?image.onerror():image.onload();
      state.images.push(image);if(state.imageDelay)state.imageCallbacks.push(fire);else jobs.push(fire);
    }});return image;
  } };
  global.wx = { nextTick:cb=>jobs.push(cb), getWindowInfo:()=>({pixelRatio:state.dpr}) };
  const instance = {
    data: {...definition.data}, properties:{view:"front",selectedRegion:"",zoomRegion:"",debugEnabled:false,interactionBlocked:false,layoutRevision:0},
    events: [], setData(change) { Object.assign(this.data,change); },
    triggerEvent(name,detail) { this.events.push({name,detail}); },
    createSelectorQuery() {
      let options;
      const q = { select(id) { assert.equal(id,"#body-canvas"); return q; },
        fields(value) { options=value; return q; },
        exec(callback) {
          state.queryCount++;
          const result = () => callback(state.fail ? [] : [{...(options.node?{node}:{}),width:state.width,height:state.height,left:state.left,top:state.top}]);
          if (state.delay) deferred.push(result); else result();
        } };
      return q;
    },
  };
  for (const [name,method] of Object.entries(definition.methods)) instance[name]=method.bind(instance);
  definition.lifetimes.created.call(instance);
  return {
    instance,state,node,ctx,jobs,deferred,
    flush() { while (jobs.length) jobs.shift()(); },
    ready() { definition.lifetimes.ready.call(instance); this.flush(); },
    property(change) {
      Object.assign(instance.properties,change);
      Object.values(definition.observers)[0].call(instance); this.flush();
    },
  };
}
test("Canvas 正背面使用不同PNG资源且绘图状态成对恢复", () => {
  const front=context(), back=context(), t=fitViewport(343,540,BODY_MODEL);
  drawBody(front,t,getBodyModel("front"),undefined,null,{src:getBodyModel("front").visual.imagePath}); drawBody(back,t,getBodyModel("back"),undefined,null,{src:getBodyModel("back").visual.imagePath});
  assert.notDeepEqual(front.calls,back.calls);
  assert.equal(front.depth(),0); assert.equal(back.depth(),0);
});
test("区域高亮裁剪于人体轮廓，跨视图区域不会误画", () => {
  const t=fitViewport(343,540,BODY_MODEL), r=getBodyRegion("front","front-chest");
  const selected=context(); drawBody(selected,t,getBodyModel("front"),r,null,{src:getBodyModel("front").visual.imagePath});
  assert.ok(selected.calls.some(c=>c[0]==="clip"));
  assert.ok(selected.calls.some(c=>c[0]==="fill" && String(c[1]).includes("rgba")));
  const wrong=context(); drawBody(wrong,t,getBodyModel("back"),r,null,{src:getBodyModel("back").visual.imagePath});
  assert.ok(!wrong.calls.some(c=>c[0]==="fill" && String(c[1]).includes("rgba")));
});
for (const [w,h,dpr] of [[280,460,1],[343,540,2],[700,570,3]]) {
  test("初始化/尺寸适配/DPR " + [w,h,dpr].join("×"), () => {
    const harn=harness(w,h,dpr); harn.ready();
    assert.equal(harn.node.width,Math.round(w*dpr));
    assert.equal(harn.node.height,Math.round(h*dpr));
    assert.equal(harn.instance.data.error,"");
    assert.deepEqual(harn.ctx.calls.find(c=>c[0]==="setTransform"),["setTransform",dpr,0,0,dpr,0,0]);
    assert.equal(lastViewport(harn).viewport.zoom,1);
  });
}
test("反复切换、区域放大与复位不累加 DPR/模型缩放", () => {
  const h=harness(); h.ready();
  for (let i=0;i<4;i++) {
    h.property({view:"back",selectedRegion:"back-upper-back",zoomRegion:"back-upper-back"});
    assert.ok(lastViewport(h).viewport.zoom>1);
    h.property({view:"front",selectedRegion:"",zoomRegion:""});
    assert.equal(lastViewport(h).viewport.zoom,1);
  }
  const transforms=h.ctx.calls.filter(c=>c[0]==="setTransform");
  assert.equal(transforms.length,9);
  assert.ok(transforms.every(c=>JSON.stringify(c)===JSON.stringify(["setTransform",2,0,0,2,0,0])));
  assert.equal(h.ctx.depth(),0);
});
test("hide/show、resize 重测尺寸；detached 后忽略异步结果", () => {
  const h=harness(); h.ready();
  definition.pageLifetimes.hide.call(h.instance);
  h.property({view:"back"});
  assert.equal(h.state.queryCount,1);
  h.state.width=280; h.state.height=460; h.state.dpr=3;
  definition.pageLifetimes.show.call(h.instance); h.flush();
  assert.equal(h.node.width,840); assert.equal(lastViewport(h).view,"back");
  h.state.width=700;
  definition.pageLifetimes.resize.call(h.instance); h.flush(); assert.equal(h.node.width,2100);
  h.state.delay=true; h.instance.refreshCanvas(); h.flush();
  const eventCount=h.instance.events.length;
  definition.lifetimes.detached.call(h.instance); h.deferred.shift()();
  assert.equal(h.instance.events.length,eventCount);
});
test("初始化失败有明确错误，重试可恢复；hide 后旧回调不污染新视口", () => {
  const h=harness(); h.state.fail=true; h.ready();
  assert.notEqual(h.instance.data.error,"");
  assert.equal(h.instance.events.at(-1).name,"rendererror");
  h.state.fail=false; h.instance.refreshCanvas(); h.flush();
  assert.equal(h.instance.data.error,"");
  h.state.delay=true; h.instance.refreshCanvas(); h.flush();
  definition.pageLifetimes.hide.call(h.instance);
  definition.pageLifetimes.show.call(h.instance); h.flush();
  h.deferred.shift()();
  const count=h.instance.events.filter(e=>e.name==='viewportchange').length;
  h.deferred.shift()(); assert.equal(h.instance.events.filter(e=>e.name==='viewportchange').length,count+1);
});
test("页面选择校验、换面清理、区域切换与复位状态", () => {
  let page;
  global.Page = options => { page=options; };
  fromBuild("pages/select/select.js");
  const instance={data:{...page.data},setData(change){Object.assign(this.data,change);}};
  for (const [key,value] of Object.entries(page)) if (typeof value==="function") instance[key]=value.bind(instance);
  const event=data=>({currentTarget:{dataset:data}});
  for(const key of ['head','neck']) {
    instance.selectRegion(event({id:'front-'+key}));instance.zoomIn();
    assert.equal(instance.data.selectedRegion,'front-'+key);
    assert.equal(instance.data.zoomRegion,'front-'+key);
    instance.showFullBody();assert.equal(instance.data.zoomRegion,'');
  }
  instance.selectRegion(event({id:"front-chest"})); instance.zoomIn();
  assert.equal(instance.data.zoomRegion,"front-chest");
  instance.showFullBody(); assert.equal(instance.data.zoomRegion,"");
  assert.equal(instance.data.selectedRegion,"front-chest");
  instance.zoomIn(); instance.selectRegion(event({id:"front-abdomen"}));
  assert.equal(instance.data.zoomRegion,"");
  instance.switchView(event({view:"back"}));
  assert.equal(instance.data.selectedRegion,""); assert.equal(instance.data.zoomRegion,"");
  assert.equal(instance.data.screenLeft,"人体左侧");
  instance.selectRegion(event({id:"front-chest"})); assert.equal(instance.data.selectedRegion,"");
  for(const key of ['head','neck']) {
    instance.selectRegion(event({id:'back-'+key}));instance.zoomIn();
    assert.equal(instance.data.selectedRegion,'back-'+key);assert.equal(instance.data.zoomRegion,'back-'+key);
    instance.showFullBody();assert.equal(instance.data.zoomRegion,'');
  }
  instance.selectRegion(event({id:"back-left-arm"})); instance.zoomIn();
  assert.equal(instance.data.zoomRegion,"back-left-arm");
  instance.switchView(event({view:"invalid"})); assert.equal(instance.data.view,"back");
});

const lastViewport=h=>h.instance.events.filter(e=>e.name==='viewportchange').at(-1).detail;
function touch(h,point,kind='canvas') {
  const t=kind==='canvas'?{x:point.x,y:point.y}:{clientX:point.x+h.state.left,clientY:point.y+h.state.top};
  const e={changedTouches:[t]};h.instance.onCanvasStart(e);h.instance.onCanvasEnd(e);h.flush();
}
const debugProbe=h=>h.instance.events.filter(e=>e.name==='debugprobe').at(-1)?.detail;

test('调试默认关闭，不采集坐标；开启后实际触点形成单个十字和真实事件',()=>{
  const h=harness();h.ready();touch(h,{x:171.5,y:170});
  assert.equal(debugProbe(h),undefined);
  h.property({debugEnabled:true});
  const {normalizedToCanvas}=fromBuild('utils/coordinate.js');
  const q=normalizedToCanvas({x:.5,y:.27},lastViewport(h).viewport);
  touch(h,q);const p=debugProbe(h);
  assert.equal(p.status,'valid');assert.equal(p.modelVersion,'4.0.1');
  assert.ok(Math.abs(p.normalized.y-.27)<1e-9);assert.equal(p.screen.x,q.x+24);
  assert.deepEqual(lastViewport(h).markerCanvas,q);
  assert.ok(h.ctx.calls.some(c=>c[0]==='moveTo'&&Math.abs(c[1]-(q.x-7))<1e-9&&c[2]===q.y));
  assert.equal(h.instance.properties.selectedRegion,'');
});
test('DPR1/2/3不会进入点击归一化，client触点与Canvas触点一致',()=>{
  const {normalizedToCanvas}=fromBuild('utils/coordinate.js');
  for(const dpr of [1,2,3]) {
    const h=harness(343,422,dpr);h.ready();h.property({debugEnabled:true});
    const q=normalizedToCanvas({x:.5,y:.1},lastViewport(h).viewport);
    touch(h,q,'client');assert.equal(debugProbe(h).status,'valid');
    assert.ok(Math.abs(debugProbe(h).normalized.y-.1)<1e-9);
    h.state.top=-120;touch(h,q);assert.ok(Math.abs(debugProbe(h).screen.y-(q.y-120))<1e-9);
    assert.ok(Math.abs(debugProbe(h).normalized.y-.1)<1e-9);
  }
});
test('十字随区域放大、复位及resize重投影；原标准坐标不变，出视口时隐藏',()=>{
  const {normalizedToCanvas}=fromBuild('utils/coordinate.js');
  const h=harness();h.ready();h.property({debugEnabled:true});
  touch(h,normalizedToCanvas({x:.5,y:.27},lastViewport(h).viewport));
  const p=debugProbe(h),initial=lastViewport(h).markerCanvas;
  for(let i=0;i<3;i++) {
    h.property({zoomRegion:'front-chest'});
    assert.deepEqual(lastViewport(h).markerCanvas,normalizedToCanvas(p.normalized,lastViewport(h).viewport));
    h.property({zoomRegion:''});assert.deepEqual(lastViewport(h).markerCanvas,initial);
  }
  h.property({zoomRegion:'front-head'});assert.equal(lastViewport(h).markerCanvas,null);
  h.property({zoomRegion:''});assert.deepEqual(lastViewport(h).markerCanvas,initial);
  h.state.width=280;h.state.height=284;definition.pageLifetimes.resize.call(h.instance);h.flush();
  assert.deepEqual(lastViewport(h).markerCanvas,normalizedToCanvas(p.normalized,lastViewport(h).viewport));
  assert.ok(Math.abs(p.normalized.y-.27)<1e-9);
});
test('留白及模型外点击清除旧十字，不伪造标准点，不改变所选区域',()=>{
  const {normalizedToCanvas}=fromBuild('utils/coordinate.js');
  const h=harness();h.ready();h.property({debugEnabled:true,selectedRegion:'front-chest'});
  const v=lastViewport(h).viewport;
  touch(h,normalizedToCanvas({x:.5,y:.27},v));assert.ok(lastViewport(h).markerCanvas);
  touch(h,normalizedToCanvas({x:.1,y:.1},v));
  assert.equal(debugProbe(h).status,'outside-body');assert.equal(debugProbe(h).normalized,null);
  assert.equal(lastViewport(h).markerCanvas,null);
  touch(h,{x:0,y:0});assert.equal(debugProbe(h).status,'outside-model');
  assert.equal(h.instance.properties.selectedRegion,'front-chest');
});
test('关闭调试或换面清除单点，重新开启/换回不复用另一视图的点',()=>{
  const {normalizedToCanvas}=fromBuild('utils/coordinate.js');
  const h=harness();h.ready();h.property({debugEnabled:true});
  const click=()=>touch(h,normalizedToCanvas({x:.5,y:.27},lastViewport(h).viewport));
  click();h.property({debugEnabled:false});assert.equal(lastViewport(h).markerCanvas,null);
  const count=h.instance.events.filter(e=>e.name==='debugprobe').length;touch(h,{x:100,y:100});assert.equal(h.instance.events.filter(e=>e.name==='debugprobe').length,count);
  h.property({debugEnabled:true});assert.equal(lastViewport(h).markerCanvas,null);
  click();h.property({view:'back'});assert.equal(lastViewport(h).markerCanvas,null);
  h.property({view:'front'});assert.equal(lastViewport(h).markerCanvas,null);
});
test('拖动/滚动、取消触摸和多触点不当作点击；不会创建病灶集合',()=>{
  const h=harness();h.ready();h.property({debugEnabled:true});
  const e={changedTouches:[{x:171,y:180}]};
  h.instance.onCanvasStart(e);h.instance.onCanvasMove({changedTouches:[{x:171,y:210}]});h.instance.onCanvasEnd(e);
  h.instance.onCanvasStart(e);h.instance.onCanvasCancel();h.instance.onCanvasEnd(e);
  h.instance.onCanvasStart({changedTouches:[{x:171,y:180},{x:171,y:200}]});h.instance.onCanvasEnd(e);
  h.flush();assert.equal(debugProbe(h),undefined);
  for(const key of Object.keys(h.instance.data))assert.ok(!/lesion|polygon|points/i.test(key));
});
test('点击查询期间切换视口或detach丢弃旧结果；查询失败明确提示且不保留标记',()=>{
  const {normalizedToCanvas}=fromBuild('utils/coordinate.js');
  const h=harness();h.ready();h.property({debugEnabled:true});
  const q=normalizedToCanvas({x:.5,y:.27},lastViewport(h).viewport);
  h.state.delay=true;touch(h,q);h.property({zoomRegion:'front-chest'});
  h.deferred.shift()();assert.equal(debugProbe(h),undefined);
  h.state.delay=false;h.state.fail=true;touch(h,q);
  assert.equal(debugProbe(h).status,'unavailable');assert.equal(debugProbe(h).normalized,null);
  h.state.fail=false;h.instance.refreshCanvas();h.flush();
  h.state.delay=true;touch(h,q);const count=h.instance.events.length;
  definition.lifetimes.detached.call(h.instance);h.deferred.shift()();assert.equal(h.instance.events.length,count);
});
test('调试面板显示四位标准坐标及实际运行状态；关闭、换面和错版事件隔离',()=>{
  global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})};
  let page;global.Page=options=>{page=options;};
  const modulePath=path.join(process.env.DERMATOME_BUILD_DIR,'pages/select/select.js');
  delete require.cache[require.resolve(modulePath)];require(modulePath);
  const instance={data:{...page.data},setData(change){Object.assign(this.data,change);}};
  for(const [key,value]of Object.entries(page))if(typeof value==='function')instance[key]=value.bind(instance);
  assert.equal(instance.data.debugEnabled,false);
  instance.toggleDebug({detail:{value:true}});
  const probe={status:'valid',view:'front',modelId:BODY_MODEL.id,modelVersion:BODY_MODEL.version,
    screen:{x:120.2,y:304.6},canvas:{x:96.2,y:124.6},normalized:{x:.42,y:.35}};
  instance.onDebugProbe({detail:probe});assert.equal(instance.data.normalizedX,'0.4200');
  assert.equal(instance.data.normalizedY,'0.3500');assert.equal(instance.data.screenY,'304.6');
  instance.onDebugProbe({detail:{...probe,view:'back'}});assert.equal(instance.data.normalizedX,'0.4200');
  const v=fitViewport(343,422,BODY_MODEL);
  instance.onViewportChange({detail:{view:'front',modelId:BODY_MODEL.id,modelVersion:BODY_MODEL.version,
    viewport:v,dpr:3,physicalWidth:1029,physicalHeight:1266,markerCanvas:{x:150,y:100}}});
  assert.equal(instance.data.dpr,3);assert.equal(instance.data.cssWidth,'343.0');assert.equal(instance.data.markerX,'150.0');
  instance.switchView({currentTarget:{dataset:{view:'back'}}});assert.equal(instance.data.normalizedX,'—');
  instance.toggleDebug({detail:{value:false}});instance.onDebugProbe({detail:{...probe,view:'back'}});
  assert.equal(instance.data.normalizedX,'—');assert.equal(instance.data.debugEnabled,false);
});

test('真实图片绘制分支：PNG未提供时拒绝画旧人体，正常帧确实调用drawImage',()=>{
 const m=getBodyModel('front'),v=fitViewport(343,422,m);
 assert.throws(()=>drawBody(context(),v,m),/尚未加载/);
 const h=harness();h.ready();
 const painted=h.ctx.calls.filter(c=>c[0]==='drawImage');assert.equal(painted.length,1);
 assert.equal(painted[0][1].src,m.visual.imagePath);assert.deepEqual(painted[0].slice(2),[0,0,400,900]);
 assert.equal(h.ctx.calls.some(c=>c[0]==='bezierCurveTo'),false);
});
test('本地PNG异步加载期间不产生视口，旧面onload不会误画，新面成功后可复用缓存',()=>{
 const h=harness();h.state.imageDelay=true;h.ready();
 assert.equal(h.instance.data.loading,true);assert.equal(h.instance.events.length,0);
 h.property({view:'back'});assert.equal(h.state.imageCallbacks.length,2);
 h.state.imageCallbacks.shift()();h.flush();assert.equal(h.instance.events.length,0);
 h.state.imageCallbacks.shift()();h.flush();assert.equal(lastViewport(h).view,'back');
 assert.equal(h.ctx.calls.filter(c=>c[0]==='drawImage').length,1);
 h.property({view:'front'});assert.equal(lastViewport(h).view,'front');assert.equal(h.state.images.length,2);
});
test('PNG加载失败明确报错且不回退，重试成功；detach后的图片事件被丢弃',()=>{
 const h=harness();h.state.imageFail=true;h.ready();assert.ok(h.instance.data.error);
 assert.equal(h.ctx.calls.filter(c=>c[0]==='drawImage').length,0);
 assert.equal(h.instance.events.at(-1).name,'rendererror');
 h.state.imageFail=false;h.instance.refreshCanvas();h.flush();assert.equal(h.instance.data.error,'');
 assert.equal(h.state.images.length,4);assert.equal(lastViewport(h).view,'front');
 const late=harness();late.state.imageDelay=true;late.ready();definition.lifetimes.detached.call(late.instance);
 late.state.imageCallbacks.shift()();late.flush();assert.equal(late.instance.events.length,0);
});

const regionProbe=h=>h.instance.events.filter(e=>e.name==='regionprobe').at(-1)?.detail;
test('真实组件正常轻触经rect与统一逆变换报告选区一次，不放大、不生成调试点',()=>{
 const h=harness(288,300,2);h.ready();
 // 手算：scale=(300-32)/900，offsetX=(288-400*scale)/2；胸参考(200,261)。
 const q={x:144,y:16+261*(268/900)};touch(h,q,'client');
 assert.deepEqual(regionProbe(h),{view:'front',modelId:BODY_MODEL.id,modelVersion:'4.0.1',status:'unique',regionIds:['front-chest']});
 assert.equal(debugProbe(h),undefined);assert.equal(lastViewport(h).markerCanvas,null);assert.equal(lastViewport(h).viewport.zoom,1);
 const count=h.instance.events.length;h.instance.onCanvasEnd({changedTouches:[q]});h.flush();assert.equal(h.instance.events.length,count);
 h.state.top=-80;touch(h,q,'client');assert.deepEqual(regionProbe(h).regionIds,['front-chest']);
});
test('选择、局部、调试与弹层优先级隔离；弹层中途打开会废弃待返回的触摸结果',()=>{
 const h=harness(288,300,3);h.ready();const q={x:144,y:16+261*(268/900)};
 h.property({zoomRegion:'front-chest'});const n=h.instance.events.length;touch(h,q);assert.equal(h.instance.events.length,n);
 h.property({debugEnabled:true});touch(h,{x:144,y:150});assert.ok(debugProbe(h));assert.equal(regionProbe(h),undefined);
 h.property({interactionBlocked:true});const count=h.instance.events.length;touch(h,q);assert.equal(h.instance.events.length,count);
 h.property({interactionBlocked:false,debugEnabled:false,zoomRegion:''});h.state.delay=true;touch(h,q);
 h.property({interactionBlocked:true});h.deferred.shift()();assert.equal(regionProbe(h),undefined);
 assert.equal(h.deferred.length,0);h.state.delay=false;h.property({interactionBlocked:false});touch(h,q);assert.equal(regionProbe(h).status,'unique');
});
test('正常模式拖动、多指、取消也不误选，布局变更后旧尺寸拒绝并重新测量',()=>{
 const h=harness(288,300,2);h.ready();const e={changedTouches:[{x:144,y:94}]};
 h.instance.onCanvasStart(e);h.instance.onCanvasMove({changedTouches:[{x:144,y:110}]});h.instance.onCanvasEnd(e);
 h.instance.onCanvasStart(e);h.instance.onCanvasCancel();h.instance.onCanvasEnd(e);
 h.instance.onCanvasStart(e);h.instance.onCanvasMove({changedTouches:[{x:144,y:94}],touches:[{},{}]});h.instance.onCanvasEnd(e);
 h.flush();assert.equal(regionProbe(h),undefined);
 h.state.height=400;touch(h,{x:144,y:94});assert.equal(regionProbe(h).status,'unavailable');assert.equal(lastViewport(h).viewport.viewportHeight,400);
 h.property({layoutRevision:1});assert.equal(lastViewport(h).viewport.viewportHeight,400);
});
test('正常选择区分重叠和人体外，查询失败不伪造选区；换面丢弃旧触点',()=>{
 const h=harness(288,300,2);h.ready();const scale=268/900;
 touch(h,{x:144,y:16+162*scale});assert.equal(regionProbe(h).status,'ambiguous');
 assert.deepEqual(regionProbe(h).regionIds,['front-head','front-neck']);
 touch(h,{x:144,y:16+700*scale});assert.equal(regionProbe(h).status,'outside-body');
 touch(h,{x:0,y:0});assert.equal(regionProbe(h).status,'outside-model');
 h.state.fail=true;touch(h,{x:144,y:94});assert.equal(regionProbe(h).status,'unavailable');
 h.state.fail=false;h.instance.refreshCanvas();h.flush();
 h.state.delay=true;touch(h,{x:144,y:94});h.property({view:'back'});
 const count=h.instance.events.filter(e=>e.name==='regionprobe').length;h.deferred.shift()();assert.equal(h.instance.events.filter(e=>e.name==='regionprobe').length,count);
});

test('320/375/430宽及矮屏节点重测：独立手算胸点选择、放大/复位和双侧无漂移',()=>{
 for(const [screenWidth,canvasHeight,dpr]of [[320,240,2],[375,330,2],[430,580,3],[375,240,3]]){
  const w=screenWidth-32,h=harness(w,canvasHeight,dpr);h.ready();
  const scale=Math.min((w-32)/400,(canvasHeight-32)/900),offsetX=(w-400*scale)/2,offsetY=(canvasHeight-900*scale)/2;
  touch(h,{x:offsetX+200*scale,y:offsetY+261*scale},'client');
  assert.deepEqual(regionProbe(h).regionIds,['front-chest']);assert.equal(h.node.width,Math.round(w*dpr));
  h.property({selectedRegion:'front-chest',zoomRegion:'front-chest'});assert.ok(lastViewport(h).viewport.zoom>1);
  h.property({zoomRegion:''});assert.equal(lastViewport(h).viewport.zoom,1);
  for(const [x,id]of [[100,'front-right-arm'],[300,'front-left-arm']]){
   touch(h,{x:offsetX+x*scale,y:offsetY+340*scale});assert.deepEqual(regionProbe(h).regionIds,[id]);
  }
 }
});

test('弹层隐藏期间停止测量绘图；关闭后同一模板、图片缓存、局部视口和调试标准点恢复',()=>{
 const h=harness(288,300,2);h.ready();h.property({debugEnabled:true,selectedRegion:'front-chest'});
 touch(h,{x:144,y:16+261*(268/900)});const point=debugProbe(h).normalized;
 h.property({zoomRegion:'front-chest'});const before=lastViewport(h),images=h.state.images.length;
 const queries=h.state.queryCount,frames=h.ctx.calls.filter(c=>c[0]==='drawImage').length;
 h.property({interactionBlocked:true});assert.equal(h.state.queryCount,queries);
 assert.equal(h.ctx.calls.filter(c=>c[0]==='drawImage').length,frames);
 h.property({interactionBlocked:false});const after=lastViewport(h);
 assert.equal(after.modelId,before.modelId);assert.equal(after.modelVersion,before.modelVersion);
 assert.deepEqual(after.viewport,before.viewport);assert.deepEqual(after.markerCanvas,before.markerCanvas);
 assert.equal(h.state.images.length,images);assert.deepEqual(debugProbe(h).normalized,point);
});


const {AnnotationSessionStore,sessionToken}=fromBuild('state/annotation-session.js');
const v2Fixture=require('../../backend/tests/fixtures/synthetic-annotation-geometry.json');
function annotationLayer() {
 const store=new AnnotationSessionStore();const s=store.open('front','front-chest').session;
 return {...sessionToken(s),...s.views.front};
}
const annotationProbe=h=>h.instance.events.filter(e=>e.name==='annotationpoint').at(-1)?.detail;
test('V2 focused annotation input is exclusive, same viewport and strict body; debug/readonly/block pause it',()=>{
 const h=harness(288,300,2);h.ready();h.property({interactionMode:'draw',annotation:annotationLayer()});
 // Independent full-view reference: logical (200,261) => (144,93.72) CSS, normalized (.5,.29).
 touch(h,{x:144,y:93.72},'client');assert.equal(annotationProbe(h).status,'valid');
 assert.ok(Math.abs(annotationProbe(h).normalized.x-.5)<1e-12);assert.ok(Math.abs(annotationProbe(h).normalized.y-.29)<1e-12);
 assert.equal(regionProbe(h),undefined);assert.equal(debugProbe(h),undefined);
 h.property({zoomRegion:'front-chest'});touch(h,{x:144,y:150});assert.equal(annotationProbe(h).status,'valid');
 let count=h.instance.events.filter(e=>e.name==='annotationpoint').length;
 h.property({debugEnabled:true});touch(h,{x:144,y:150});assert.equal(debugProbe(h).status,'valid');
 assert.equal(h.instance.events.filter(e=>e.name==='annotationpoint').length,count);
 h.property({debugEnabled:false,interactionMode:'readonly'});touch(h,{x:144,y:150});assert.equal(h.instance.events.filter(e=>e.name==='annotationpoint').length,count);
 h.property({interactionMode:'draw',interactionBlocked:true});touch(h,{x:144,y:150});assert.equal(h.instance.events.filter(e=>e.name==='annotationpoint').length,count);
 h.property({interactionBlocked:false,zoomRegion:''});touch(h,{x:0,y:0});assert.equal(annotationProbe(h).status,'outside-model');
 touch(h,{x:144,y:16+700*268/900});assert.equal(annotationProbe(h).status,'outside-body');
});
test('V2 gesture/repeated end/stale revision and modal callbacks cannot add points; rect refresh handles scrolling',()=>{
 const h=harness(288,300,3);h.ready();const layer=annotationLayer();h.property({interactionMode:'draw',annotation:layer});
 const e={changedTouches:[{clientX:168,clientY:273.72}]};
 h.instance.onCanvasStart(e);h.instance.onCanvasEnd(e);h.instance.onCanvasEnd(e);h.flush();
 assert.equal(h.instance.events.filter(e=>e.name==='annotationpoint').length,1);
 h.instance.onCanvasStart(e);h.instance.onCanvasMove({changedTouches:[{clientX:168,clientY:290}]});h.instance.onCanvasEnd(e);
 h.instance.onCanvasStart(e);h.instance.onCanvasCancel();h.instance.onCanvasEnd(e);
 h.instance.onCanvasStart({changedTouches:[{},{}]});h.instance.onCanvasEnd(e);h.flush();
 assert.equal(h.instance.events.filter(e=>e.name==='annotationpoint').length,1);
 h.state.top=-40;touch(h,{x:144,y:93.72},'client');assert.ok(Math.abs(annotationProbe(h).normalized.y-.29)<1e-12);
 const count=h.instance.events.filter(e=>e.name==='annotationpoint').length;
 h.state.delay=true;touch(h,{x:144,y:93.72});h.property({annotation:{...layer,revision:1}});
 h.deferred.shift()();assert.equal(h.instance.events.filter(e=>e.name==='annotationpoint').length,count);
 while(h.deferred.length)h.deferred.shift()();h.state.delay=false;h.flush();
 h.state.delay=true;touch(h,{x:144,y:93.72});h.property({interactionBlocked:true});h.deferred.shift()();
 assert.equal(h.instance.events.filter(e=>e.name==='annotationpoint').length,count);
});
test('V2 actual renderer uses same fixed CSS projection; open draft has no fill and selected fill precedes debug',()=>{
 const model=getBodyModel('front'),layer=annotationLayer(),vertices=v2Fixture.editor['UI-A'];
 const draft={...layer.draft,vertices};
 for(const [w,h] of [[288,300],[320,400],[375,540],[430,700],[320,240]]) {
  const base=fitViewport(w,h,model),focus=fromBuild('utils/coordinate.js').focusViewport(base,getBodyRegion('front','front-chest').bounds);
  for(const viewport of [base,focus]) {
   const ctx=context();drawBody(ctx,viewport,model,undefined,null,{}, {...layer,draft});
   const arcs=ctx.calls.filter(c=>c[0]==='arc');assert.equal(arcs.length,vertices.length);
   for(let i=0;i<vertices.length;i++) {
    const p=vertices[i];assert.ok(Math.abs(arcs[i][1]-(viewport.offsetX+p.x*400*viewport.scale))<1e-9);
    assert.ok(Math.abs(arcs[i][2]-(viewport.offsetY+p.y*900*viewport.scale))<1e-9);assert.equal(arcs[i][3],3.2);
   }
   assert.ok(!ctx.calls.some(c=>c[0]==='fill'&&String(c[1]).includes('rgba(182')));
   assert.equal(ctx.depth(),0);
  }
 }
 const polygon={...draft,ring:[...vertices,vertices[0]]};
 const ctx=context();drawBody(ctx,fitViewport(288,300,model),model,undefined,null,{}, {...layer,draft:null,completed:[polygon],selectedId:polygon.id});
 assert.equal(ctx.calls.filter(c=>c[0]==='fill'&&String(c[1]).includes('rgba(182')).length,1); // 单层填充，选中仅改变透明度和边线。
 const wrong=context();drawBody(wrong,fitViewport(288,300,model),model,undefined,null,{}, {...layer,view:'back',draft});
 assert.equal(wrong.calls.filter(c=>c[0]==='arc').length,0);
});

test('V3 actual body-canvas accepts independent atlas/focus props; readonly emits no lesion/selection input and null restores V1 defaults',()=>{
 const {ATLAS_MANIFEST:m,ATLAS_REGIONS}=fromBuild('data/atlas.generated.js');
 const {atlasFocusBounds}=fromBuild('utils/atlas-view.js');const rr=ATLAS_REGIONS.filter(r=>r.view==='front'&&r.labelId==='T5');
 const h=harness();h.ready();const prior=h.instance.events.length;
 const layer={atlasVersion:m.atlasVersion,templateId:m.templateId,templateVersion:m.templateVersion,geometryId:m.geometryId,view:'front',regions:rr,showLabels:false};
 h.property({interactionMode:'readonly',atlas:layer,focusBounds:atlasFocusBounds(rr)});
 assert.ok(lastViewport(h).viewport.zoom>1);assert.ok(h.ctx.calls.some(c=>c[0]==='fill'&&c[1]===rr[0].color));
 touch(h,{x:171,y:270});assert.ok(!h.instance.events.slice(prior).some(e=>['annotationpoint','regionprobe'].includes(e.name)));
 h.property({interactionMode:'select',atlas:null,focusBounds:null});assert.equal(lastViewport(h).viewport.zoom,1);assert.equal(h.ctx.depth(),0);
});

test('V4 stable node: preload each view once, no clear while waiting, no measurement on overlay changes or frames, cancel stale frames',()=>{
 const h=harness();let now=1000,id=0;const callbacks=new Map();h.node.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};h.node.cancelAnimationFrame=i=>callbacks.delete(i);
 const originalNow=Date.now;Date.now=()=>now;
 try{
  h.state.imageDelay=true;h.ready();assert.equal(h.ctx.calls.filter(c=>c[0]==='clearRect').length,0);assert.equal(h.state.images.length,2);
  for(const fire of h.state.imageCallbacks.splice(0))fire();h.flush();assert.equal(h.state.queryCount,1);
  const R=fromBuild('data/atlas.generated.js').ATLAS_REGIONS,front=R.filter(r=>r.view==='front').slice(0,2),r=front[0];
  const atlas={atlasVersion:r.atlasVersion,templateId:r.templateId,templateVersion:r.templateVersion,geometryId:r.geometryId,view:'front',regions:front,showLabels:false};
  h.property({atlas,motionEnabled:true,overlayKey:'request-A:front',sceneId:1});const stale=[...callbacks.values()][0];assert.ok(stale);
  const measures=h.state.queryCount,images=h.state.images.length;now+=80;callbacks.values().next().value();callbacks.clear();
  h.property({atlas:{...atlas,regions:[front[1]]},sceneId:2});const afterChange=h.ctx.calls.length;stale();assert.equal(h.ctx.calls.length,afterChange);
  now+=220;for(const cb of [...callbacks.values()])cb();callbacks.clear();
  assert.equal(h.state.queryCount,measures);assert.equal(h.state.images.length,images);assert.equal(h.instance.events.filter(e=>e.name==='renderstats').at(-1).detail.initializations,1);
  const finished=h.ctx.calls.length;stale();assert.equal(h.ctx.calls.length,finished);
  h.property({atlas,sceneId:3});const hidden=[...callbacks.values()][0];definition.pageLifetimes.hide.call(h.instance);const count=h.ctx.calls.length;if(hidden)hidden();assert.equal(h.ctx.calls.length,count);assert.equal(callbacks.size,0);
  definition.pageLifetimes.show.call(h.instance);h.flush();assert.equal(callbacks.size,0);assert.ok(h.ctx.calls.length>count);
  assert.equal(h.state.images.length,images);assert.equal(h.instance.events.filter(e=>e.name==='renderstats').at(-1).detail.initializations,1);
 }finally{Date.now=originalNow;definition.lifetimes.detached.call(h.instance);}
});

test('information overlay blocks native canvas without destroying cached scene or changing viewport',()=>{
 const h=harness();h.ready();h.property({zoomRegion:'front-chest',interactionMode:'draw',annotation:annotationLayer()});
 const viewport=lastViewport(h).viewport,images=h.state.images.length,queries=h.state.queryCount,draws=h.ctx.calls.length;
 h.property({interactionBlocked:true});touch(h,{x:170,y:270});assert.equal(h.ctx.calls.length,draws);assert.equal(annotationProbe(h),undefined);
 h.property({interactionBlocked:false});assert.deepEqual(lastViewport(h).viewport,viewport);assert.equal(h.state.images.length,images);assert.equal(h.state.queryCount,queries);
 const stats=h.instance.events.filter(e=>e.name==='renderstats').at(-1).detail;assert.equal(stats.initializations,1);
 definition.lifetimes.detached.call(h.instance);
});
