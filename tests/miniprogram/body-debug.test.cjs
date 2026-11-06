const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const build=file=>require(path.join(process.env.DERMATOME_BUILD_DIR,file));
const {BODY_MODELS,getBodyModel,validateBodyModel,withBodyVisual}=build('data/body-models.js');
const {BODY_REGIONS,getBodyRegion}=build('data/body-regions.js');
const {flattenOutline,pointInOutline,PATH_FLATNESS,HIT_EDGE_TOLERANCE}=build('utils/body-path.js');
const {readTouch,probeTouch,projectDebugPoint}=build('utils/body-debug.js');
const {fitViewport,focusViewport,resetViewport,normalizedToCanvas}=build('utils/coordinate.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9,`${a} != ${b}`);
const {BODY_LANDMARKS}=build('assets/body/commons-v1.js');
const sizes=[[280,284],[343,422],[700,466]];

test('新模板正背面资源、逻辑比例、版本及区域显式绑定，源文件存在',()=>{
  assert.notEqual(BODY_MODELS.front.visual,BODY_MODELS.back.visual);
  assert.notEqual(BODY_MODELS.front.visual.imagePath,BODY_MODELS.back.visual.imagePath);
  assert.notDeepEqual(BODY_MODELS.front.visual.outline,BODY_MODELS.back.visual.outline);
  for(const view of ['front','back']) {
    const m=getBodyModel(view);validateBodyModel(m);
    assert.equal(m.id,'commons-neutral-v1');assert.equal(m.version,'4.0.1');
    assert.equal(m.logicalWidth/m.logicalHeight,4/9);
    assert.equal(m.regions,BODY_REGIONS[view]);assert.equal(m.geometryId,m.visual.geometryId);
    assert.equal(m.regionGeometryId,m.geometryId);assert.ok(m.visual.outline.length>80);
    assert.ok(fs.existsSync(path.resolve(__dirname,'../../miniprogram',m.visual.sourcePath.slice(1))));
    for(const p of m.hitOutline)assert.ok(p.x>=0&&p.x<=400&&p.y>=0&&p.y<=900);
    assert.ok(Math.min(...m.hitOutline.map(p=>p.y))>=25);
    assert.ok(Math.max(...m.hitOutline.map(p=>p.y))<=880);
  }
});
test('每面8个独立UI区域、16个唯一ID，头颈存在且能居中放大',()=>{
  const all=Object.values(BODY_REGIONS).flat();assert.equal(new Set(all.map(r=>r.id)).size,16);
  for(const view of ['front','back']) {
    const m=getBodyModel(view);assert.equal(m.regions.length,8);
    for(const key of ['head','neck']) {
      const r=getBodyRegion(view,view+'-'+key);assert.ok(r);
      const p={x:r.bounds.x+r.bounds.width/2,y:r.bounds.y+r.bounds.height/2};
      assert.ok(pointInOutline({x:p.x*400,y:p.y*900},m.hitOutline));
      for(const [w,h]of sizes) {
        const v=focusViewport(fitViewport(w,h,m),r.bounds), q=normalizedToCanvas(p,v);
        near(q.x,w/2);near(q.y,h/2);assert.ok(v.zoom>1);
      }
    }
    for(const r of m.regions) {
      assert.ok(r.outline.every(p=>p.x>=r.bounds.x-1e-9&&p.x<=r.bounds.x+r.bounds.width+1e-9&&
        p.y>=r.bounds.y-1e-9&&p.y<=r.bounds.y+r.bounds.height+1e-9));
    }
  }
});
test('几何不变可更换配色/线条资源；几何、视图、尺寸或区域错版明确拒绝',()=>{
  const m=getBodyModel('front');
  const style={...m.visual,id:'alternate-ink',palette:{...m.visual.palette,skin:'#eeeeee'}};
  const alternate=withBodyVisual(m,style);
  assert.equal(alternate.hitOutline,m.hitOutline);assert.equal(alternate.regions,m.regions);
  assert.equal(alternate.version,m.version);assert.equal(m.visual.id,'commons-blank-front-png1');
  for(const visual of [{...style,logicalWidth:500},{...style,geometryId:'wrong'},
    {...style,view:'back'},{...style,outline:[['M',0,0],['L',400,0],['L',200,900],['Z']]}]) {
    assert.throws(()=>withBodyVisual(m,visual),RangeError);
  }
  assert.throws(()=>validateBodyModel({...m,regionGeometryId:'old-v1'}),RangeError);
  assert.throws(()=>validateBodyModel({...m,regions:[...m.regions,m.regions[0]]}),RangeError);
  assert.throws(()=>validateBodyModel({...m,regions:BODY_REGIONS.back}),RangeError);
});
test('连续人体轮廓命中头颈躯干/双臂手/双腿足，拒绝臂躯间隙与腿间留白',()=>{
  for(const m of Object.values(BODY_MODELS)) {
    const landmarks=BODY_LANDMARKS[m.view];
    for(const key of ['head','neck','chest','waist','shoulder','elbow','wrist','fingertips','hip','knee','ankle','foot']) {
      const p=landmarks[key];assert.ok(pointInOutline(p,m.hitOutline),m.view+' '+key);
      assert.ok(pointInOutline({x:400-p.x,y:p.y},m.hitOutline),m.view+' mirrored '+key);
    }
    for(const p of [[200,700],[270,340],[130,340],[40,50],[0,0],[400,900]]) {
      assert.equal(pointInOutline({x:p[0],y:p[1]},m.hitOutline),false,'outside '+p);
    }
  }
});
test('外部素材保留自然非对称及独立正背面，全身轮廓适配Canvas',()=>{
  const m=getBodyModel('front');
  assert.notDeepEqual(m.hitOutline,getBodyModel('back').hitOutline);
  for(const size of sizes) {
    const v=fitViewport(...size,m);
    for(const p of m.hitOutline) {
      const q=normalizedToCanvas({x:p.x/400,y:p.y/900},v);
      assert.ok(q.x>=16&&q.x<=size[0]-16&&q.y>=16&&q.y<=size[1]-16);
    }
  }
});
test('同一二次曲线路径细分命中，边缘容差不吸附，开放路径拒绝',()=>{
  const outline=flattenOutline([['M',0,0],['Q',50,100,100,0],['L',0,0],['Z']]);
  assert.ok(outline.length>10);assert.equal(PATH_FLATNESS,.2);assert.equal(HIT_EDGE_TOLERANCE,.25);
  assert.ok(pointInOutline({x:50,y:49},outline));assert.equal(pointInOutline({x:50,y:51},outline),false);
  assert.ok(pointInOutline({x:50,y:50.1},outline));
  assert.equal(pointInOutline({x:NaN,y:20},outline),false);
  assert.throws(()=>flattenOutline([['M',0,0],['L',10,0],['L',0,10]]),RangeError);
});
test('原生Canvas本地触点和client触点识别，不猜测page坐标或DPR',()=>{
  assert.deepEqual(readTouch({changedTouches:[{x:12,y:24}]}),{kind:'canvas',point:{x:12,y:24}});
  assert.deepEqual(readTouch({changedTouches:[{clientX:32,clientY:44,pageX:332,pageY:444}]}),
    {kind:'client',point:{x:32,y:44}});
  for(const e of [null,{}, {changedTouches:[]},{changedTouches:[{},{}]},
    {changedTouches:[{pageX:100,pageY:200}]},{changedTouches:[{x:NaN,y:1}]},
    {changedTouches:[{x:12,y:24}],touches:[{},{}]}])assert.equal(readTouch(e),null);
});
test('真实矩形处理页面滚动：两种事件基准得到相同标准点',()=>{
  const m=getBodyModel('front'),v=fitViewport(343,422,m),p={x:.5,y:.27},q=normalizedToCanvas(p,v);
  for(const top of [300,-120,0]) {
    const rect={left:23.5,top,width:343,height:422};
    for(const input of [{kind:'canvas',point:q},{kind:'client',point:{x:q.x+23.5,y:q.y+top}}]) {
      const probe=probeTouch(input,rect,v,m);assert.equal(probe.status,'valid');
      near(probe.normalized.x,p.x);near(probe.normalized.y,p.y);
      near(probe.screen.y,q.y+top);near(probe.canvas.y,q.y);
    }
  }
});
test('三种尺寸区分有效人体、逻辑画布内留白、模型范围外；无效点不产生标准点',()=>{
  const m=getBodyModel('front');
  for(const size of sizes) {
    const v=fitViewport(...size,m),rect={left:12,top:50,width:size[0],height:size[1]};
    const input=p=>({kind:'canvas',point:p});
    const inBody=normalizedToCanvas({x:.5,y:.1},v);
    assert.equal(probeTouch(input(inBody),rect,v,m).status,'valid');
    const blank=probeTouch(input(normalizedToCanvas({x:.1,y:.1},v)),rect,v,m);
    assert.equal(blank.status,'outside-body');assert.equal(blank.normalized,null);
    const outside=probeTouch(input({x:0,y:0}),rect,v,m);
    assert.equal(outside.status,'outside-model');assert.equal(outside.normalized,null);
    assert.equal(probeTouch(input(inBody),{...rect,width:rect.width+2},v,m).status,'unavailable');
  }
});
test('归一化单点在放大、复位、尺寸变化时重投影；超出可见范围隐藏，不贴边',()=>{
  const m=getBodyModel('front'),point={modelId:m.id,modelVersion:m.version,view:m.view,normalized:{x:.5,y:.27}};
  const original=JSON.stringify(point);
  for(const size of sizes) {
    const base=fitViewport(...size,m),zoom=focusViewport(base,getBodyRegion('front','front-chest').bounds);
    for(const v of [base,zoom,resetViewport(zoom)]) {
      const q=projectDebugPoint(point,m,v);assert.ok(q);
      const result=probeTouch({kind:'canvas',point:q},{left:10,top:20,width:size[0],height:size[1]},v,m);
      near(result.normalized.x,.5);near(result.normalized.y,.27);
    }
    const head=focusViewport(base,getBodyRegion('front','front-head').bounds);
    assert.equal(projectDebugPoint(point,m,head),null);
  }
  assert.equal(JSON.stringify(point),original);
  assert.equal(projectDebugPoint(point,getBodyModel('back'),fitViewport(343,422,m)),null);
  assert.equal(projectDebugPoint({...point,modelVersion:'1.0.0'},m,fitViewport(343,422,m)),null);
});
