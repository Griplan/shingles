// Historical V1.2 geometry regression; active Commons registration is in commons-registration.test.cjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const read=file=>require(path.join(process.env.DERMATOME_BUILD_DIR,file));
const {validateBodyModel,withBodyVisual}=read('data/body-models.js');
const {BODY_MODELS,getBodyModel}=require('./fixtures/v3-model.cjs');
const {BODY_LANDMARKS:L}=read('assets/body/neutral-v3.js');
const oldVisual=read('assets/body/neutral-v2.js').FRONT_VISUAL;
const oldRegions=read('data/body-regions-v2.js').BODY_REGIONS;
const {flattenOutline,pointInOutline}=read('utils/body-path.js');
const {fitViewport,focusViewport,resetViewport,normalizedToCanvas,canvasToNormalized}=read('utils/coordinate.js');
const {probeTouch,projectDebugPoint}=read('utils/body-debug.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9,`${a} != ${b}`);
// 独立的区域多边形包含检查；不使用被测的人体轮廓命中函数生成预期。
function polygonContains(p,polygon) {
  let crossings=0;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    if((a.y>p.y)!==(b.y>p.y)&&a.x+(p.y-a.y)*(b.x-a.x)/(b.y-a.y)>p.x)crossings++;
  }
  return crossings%2===1;
}
const norm=p=>({x:p.x/400,y:p.y/900});
const sizes=[[280,284],[343,422],[700,466]];
function torsoWidth(outline,y) {
  const crossings=[];
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length];
    if((a.y>y)!==(b.y>y))crossings.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
  }
  crossings.sort((a,b)=>a-b);
  for(let i=0;i<crossings.length;i+=2)if(crossings[i]<200&&crossings[i+1]>200)return crossings[i+1]-crossings[i];
  throw Error('No central torso section at '+y);
}

test('V1.2历史：新几何独立版本；前后同骨架、旧视觉与旧区域不静默迁移',()=>{
  const m=getBodyModel('front');assert.equal(m.id,'neutral-body-v3');assert.equal(m.version,'3.0.0');
  assert.equal(m.regionGeometryId,'neutral-body-v3');
  assert.notDeepEqual(m.visual.outline,oldVisual.outline);
  assert.deepEqual(m.visual.outline,getBodyModel('back').visual.outline);
  assert.deepEqual(m.hitOutline,getBodyModel('back').hitOutline);
  assert.notDeepEqual(m.regions,oldRegions.front);
  assert.throws(()=>validateBodyModel({...m,regionGeometryId:'neutral-body-v2'}),RangeError);
  assert.throws(()=>withBodyVisual(m,oldVisual),RangeError);
  const oldPoint={modelId:'neutral-body-v2',modelVersion:'2.0.0',view:'front',normalized:{x:.5,y:.5}};
  assert.equal(projectDebugPoint(oldPoint,m,fitViewport(343,422,m)),null);
});
test('V1.2历史：设计比例单独检查：约7.5～8头身、裆50～54%、膝72～76%，不是医学准确率',()=>{
  const points=getBodyModel('front').hitOutline;
  const top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y)),height=bottom-top;
  near(top,30);assert.ok(bottom>=870&&bottom<=873);
  const heads=height/(L.chin.y-top),crotch=(L.crotch.y-top)/height,knee=(L.knee.y-top)/height;
  assert.ok(heads>=7.5&&heads<=8);assert.ok(crotch>=.50&&crotch<=.54);assert.ok(knee>=.72&&knee<=.76);
  // 独立设计目标：裆474、膝650、踝825；与旧可见腿段116/200相比重建长度。
  assert.equal(L.crotch.y,474);assert.equal(L.knee.y,650);assert.equal(L.ankle.y,825);
  assert.ok((L.knee.y-L.crotch.y)/(L.ankle.y-L.knee.y)>.95);
  assert.ok((L.knee.y-L.crotch.y)/(L.ankle.y-L.knee.y)<1.1);
  assert.ok((L.knee.y-L.hip.y)/(L.ankle.y-L.knee.y)>1.1);
  assert.ok((L.knee.y-L.hip.y)/(L.ankle.y-L.knee.y)<1.35);
  assert.ok(Math.abs(L.fingertips.y-(L.hip.y+L.knee.y)/2)<25);
});
test('V1.2历史：轮廓本身胸肩加宽、腰髋收放：不只修改参考点或全图缩放',t=>{
  const current=getBodyModel('front').hitOutline,old=flattenOutline(oldVisual.outline);
  // 胸廓截面选腋窝以下y270；y236仍与上臂连通，不能误算为胸廓宽度。
  const chest=torsoWidth(current,270),waist=torsoWidth(current,331),hip=torsoWidth(current,432);
  t.diagnostic(JSON.stringify({chestY:270,oldChest:torsoWidth(old,270),chest,waist,hip}));
  assert.ok(chest>torsoWidth(old,270)*1.1);
  assert.ok(torsoWidth(current,195)>torsoWidth(old,195)*1.15);
  assert.ok(chest>waist*1.2);assert.ok(hip>waist*1.35);
  assert.ok(chest>125&&chest<155);assert.ok(waist>90&&waist<115);assert.ok(hip>145&&hip<170);
  // 同头顶/头高，不同裆和肩胸，故不可能是对旧资源的一次整体缩放。
  assert.ok(current.some(p=>p.x===200&&p.y===474));
  assert.ok(old.some(p=>p.x===200&&p.y===510));
});
test('V1.2历史：躯干、髋膝踝、肘腕与手足参考点在两面同源轮廓内；关节高度有序',()=>{
  for(const m of Object.values(BODY_MODELS)) {
    for(const key of ['neck','chest','waist','pelvis','shoulder','elbow','wrist','fingertips','hip','knee','ankle','foot']) {
      const p=L[key];
      assert.ok(pointInOutline(p,m.hitOutline),m.view+' '+key);
      assert.ok(pointInOutline({x:400-p.x,y:p.y},m.hitOutline),m.view+' mirrored '+key);
    }
  }
  assert.ok(L.shoulder.y<L.elbow.y&&L.elbow.y<L.wrist.y&&L.wrist.y<L.fingertips.y);
  assert.ok(L.waist.y<L.hip.y&&L.hip.y<L.knee.y&&L.knee.y<L.ankle.y&&L.ankle.y<L.foot.y);
});
test('V1.2历史：16区域与新几何配准：肩肘腕手指、髋膝踝足均落在应属UI多边形内',()=>{
  for(const view of ['front','back']) {
    const m=getBodyModel(view);
    const region=id=>m.regions.find(r=>r.id===view+'-'+id);
    const check=(r,p)=>{
      const n=norm(p),b=r.bounds;
      assert.ok(n.x>=b.x&&n.x<=b.x+b.width&&n.y>=b.y&&n.y<=b.y+b.height,r.id+' bounds');
      assert.ok(polygonContains(n,r.outline),r.id+' outline '+JSON.stringify(n));
    };
    check(region('head'),{x:200,y:84});check(region('neck'),L.neck);
    check(region(view==='front'?'chest':'upper-back'),L.chest);
    check(region(view==='front'?'abdomen':'lower-back'),{x:200,y:360});
    for(const side of ['left','right']) {
      const screenRight=(view==='front'&&side==='left')||(view==='back'&&side==='right');
      const point=p=>({x:screenRight?p.x:400-p.x,y:p.y});
      for(const key of ['shoulder','elbow','wrist','fingertips'])check(region(side+'-arm'),point(L[key]));
      for(const key of ['hip','knee','ankle','foot'])check(region(side+'-leg'),point(L[key]));
    }
  }
  // 旧范围确实不能覆盖新位置：新指尖低于旧上肢bounds，髋点高于旧腿部bounds。
  assert.ok(norm(L.fingertips).y>oldRegions.front.find(r=>r.id==='front-left-arm').bounds.y+
    oldRegions.front.find(r=>r.id==='front-left-arm').bounds.height);
  assert.ok(norm(L.hip).y<oldRegions.front.find(r=>r.id==='front-left-leg').bounds.y);
});
test('V1.2历史：前后膝部实际细节路径靠近同一设计关节，避免只下移膝标签',()=>{
  for(const m of Object.values(BODY_MODELS)) {
    const candidates=m.visual.details.filter(p=>p[0][0]==='M'&&p[0][1]>=210&&p[0][1]<=220&&p[0][2]>620&&p[0][2]<670);
    assert.equal(candidates.length,1);
    const [a,b]=candidates[0];assert.equal(b[0],'Q');
    const midpoint={x:(a[1]+2*b[1]+b[3])/4,y:(a[2]+2*b[2]+b[4])/4};
    assert.ok(Math.hypot(midpoint.x-L.knee.x,midpoint.y-L.knee.y)<7);
  }
});
test('V1.2历史：新关节参考点实际探测→十字重投影：三尺寸、前后、放大复位保持同一标准位置',()=>{
  for(const view of ['front','back'])for(const [w,h]of sizes) {
    const m=getBodyModel(view),base=fitViewport(w,h,m);
    for(const [key,regionKey]of [['chest',view==='front'?'chest':'upper-back'],['elbow',view==='front'?'left-arm':'right-arm'],
      ['wrist',view==='front'?'left-arm':'right-arm'],['hip',view==='front'?'left-leg':'right-leg'],
      ['knee',view==='front'?'left-leg':'right-leg'],['ankle',view==='front'?'left-leg':'right-leg']]) {
      const n=norm(L[key]),r=m.regions.find(r=>r.id===view+'-'+regionKey),zoom=focusViewport(base,r.bounds);
      const point={modelId:m.id,modelVersion:m.version,view,normalized:n};
      for(const viewport of [base,zoom,resetViewport(zoom)]) {
        const q=normalizedToCanvas(n,viewport),inverse=canvasToNormalized(q,viewport);
        near(inverse.x,n.x);near(inverse.y,n.y);
        assert.deepEqual(projectDebugPoint(point,m,viewport),q);
        const probe=probeTouch({kind:'canvas',point:q},{left:27,top:-80,width:w,height:h},viewport,m);
        assert.equal(probe.status,'valid');near(probe.normalized.x,n.x);near(probe.normalized.y,n.y);
      }
    }
  }
});
