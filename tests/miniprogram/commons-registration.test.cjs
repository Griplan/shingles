const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {getBodyModel,withBodyVisual}=read('data/body-models.js');
const {BODY_LANDMARKS}=read('assets/body/commons-v1.js');
const {BODY_REGIONS:oldRegions}=read('data/body-regions-v3.js');
const {pointInOutline}=read('utils/body-path.js');
const {fitViewport,focusViewport,resetViewport,normalizedToCanvas}=read('utils/coordinate.js');
const {probeTouch,projectDebugPoint}=read('utils/body-debug.js');
const dir=path.resolve(__dirname,'../../miniprogram/assets/body/commons-cc0');
const source=fs.readFileSync(path.join(dir,'source.svg'));
// Independent PNG decoder using Node core. No Sharp dependency or generated geometry as expected data.
const {pngAlpha}=require('./helpers/png-alpha.cjs');
const images=Object.fromEntries(['front','back'].map(v=>[v,pngAlpha(path.join(dir,v+'.png'))]));
const contains=(p,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[j],b=poly[i];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
}return inside;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);

test('实际启用Commons新模板与真实PNG，原SVG和许可来源可核对，拒绝旧几何',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'486cdc8a89fbfe0ff0a4bb4104efc19bb5c708337c37768be6f9120c4837753a');
 assert.equal(manifest.license,'CC0-1.0');assert.ok(manifest.sourceURL.endsWith('Human_body_with_blank_labels.svg'));
 for(const view of ['front','back']){
  const m=getBodyModel(view);assert.equal(m.id,'commons-neutral-v1');assert.equal(m.version,'4.0.1');
  assert.equal(m.geometryId,'commons-blank-cc0-hands-v2');assert.equal(m.regionGeometryId,m.geometryId);
  assert.equal(m.visual.imagePath,'/assets/body/commons-cc0/'+view+'.png');
  const svg=fs.readFileSync(path.join(dir,view+'.svg'),'utf8');assert.ok(svg.includes(view==='front'?'g5692':'g5815'));
  assert.equal((svg.match(/<path\b/g)||[]).length,view==='front'?71:49);
  for(const file of ['source.svg',view+'.svg',view+'.png','geometry.generated.ts']){
   assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex'),manifest.files[file]);
  }
  assert.throws(()=>withBodyVisual(m,read('assets/body/neutral-v3.js').FRONT_VISUAL),RangeError);
 }
});
test('16个新区域独立配准源图参考点；旧头部边界不能直接复用',()=>{
 for(const view of ['front','back']){
  const m=getBodyModel(view),L=BODY_LANDMARKS[view];assert.equal(m.regions.length,8);
  const check=(suffix,p)=>{
   const n={x:p.x/400,y:p.y/900},r=m.regions.find(r=>r.id===view+'-'+suffix),b=r.bounds;
   assert.ok(n.x>=b.x&&n.x<=b.x+b.width&&n.y>=b.y&&n.y<=b.y+b.height,r.id+' bounds');
   assert.ok(contains(n,r.outline),r.id+' region');assert.ok(pointInOutline(p,m.hitOutline),r.id+' hit');
   assert.ok(images[view].at(Math.floor(p.x*3),Math.floor(p.y*3))>127,r.id+' actual PNG');
  };
  for(const [key,id]of [['head','head'],['neck','neck'],['chest',view==='front'?'chest':'upper-back'],['waist',view==='front'?'abdomen':'lower-back']])check(id,L[key]);
  for(const side of ['left','right']){
   const right=(view==='front'&&side==='left')||(view==='back'&&side==='right');
   const p=q=>({x:right?q.x:400-q.x,y:q.y});
   for(const k of ['shoulder','elbow','wrist','fingertips'])check(side+'-arm',p(L[k]));
   for(const k of ['hip','knee','ankle','foot'])check(side+'-leg',p(L[k]));
  }
 }
 const oldHead=oldRegions.front.find(r=>r.id==='front-head').bounds;
 assert.ok(BODY_LANDMARKS.front.chin.y/900>oldHead.y+oldHead.height);
 assert.notDeepEqual(getBodyModel('front').regions,oldRegions.front);
});
test('实际PNG透明度与命中轮廓密集抽样一致，含四肢间隙，不能仅用矩形命中',()=>{
 for(const view of ['front','back']){
  const m=getBodyModel(view),im=images[view];assert.equal(im.w,1200);assert.equal(im.h,2700);
  let samples=0;
  for(let y=8;y<892;y+=7)for(let x=8;x<392;x+=7){
   // The old neutral PNG matte filled narrow finger gaps. V6.5 hand validity
   // is checked against original SVG ink and independent hand landmarks instead.
   if((x<108||x>292)&&y>439&&y<540)continue;
   const px=x*3,py=y*3,expected=im.at(px,py)>127;
   // Exclude the <=1 logical-unit raster/antialias boundary band only.
   if([-3,0,3].some(dx=>[-3,0,3].some(dy=>(im.at(px+dx,py+dy)>127)!==expected)))continue;
   assert.equal(pointInOutline({x,y},m.hitOutline),expected,view+' source pixel '+[x,y]);samples++;
  }
  assert.ok(samples>5000);
  for(const [x,y]of [[200,700],[270,340],[130,340],[30,30]]){
   assert.equal(im.at(x*3,y*3),0);assert.equal(pointInOutline({x,y},m.hitOutline),false);
  }
 }
 assert.notDeepEqual(getBodyModel('front').hitOutline,getBodyModel('back').hitOutline);
});
test('头颈胸腹背及四肢全部放大范围，三种容器/DPR下同点探测与复位不变',()=>{
 for(const view of ['front','back'])for(const [w,h,dpr]of [[280,284,2],[343,422,3],[700,466,3]]){
  const m=getBodyModel(view),base=fitViewport(w,h,m);
  for(const r of m.regions){
   const zoom=focusViewport(base,r.bounds);assert.ok(zoom.zoom>1);
   for(const n of [{x:r.bounds.x,y:r.bounds.y},{x:r.bounds.x+r.bounds.width,y:r.bounds.y+r.bounds.height}]){
    const q=normalizedToCanvas(n,zoom);assert.ok(q.x>=16-1e-9&&q.x<=w-16+1e-9&&q.y>=16-1e-9&&q.y<=h-16+1e-9);
   }
  }
  for(const key of ['head','neck','chest','elbow','wrist','hip','knee','ankle','foot']){
   const p=BODY_LANDMARKS[view][key],n={x:p.x/400,y:p.y/900};
   const side=view==='front'?'left':'right';
   const id=key==='head'?'head':key==='neck'?'neck':key==='chest'?(view==='front'?'chest':'upper-back'):
    ['elbow','wrist'].includes(key)?side+'-arm':side+'-leg';
   const r=m.regions.find(r=>r.id===view+'-'+id),point={modelId:m.id,modelVersion:m.version,view,normalized:n};
   for(const v of [base,focusViewport(base,r.bounds),resetViewport(base)]){
    const q=normalizedToCanvas(n,v),probe=probeTouch({kind:'client',point:{x:q.x+23,y:q.y-81}},{left:23,top:-81,width:w,height:h},v,m);
    assert.equal(probe.status,'valid');near(probe.normalized.x,n.x);near(probe.normalized.y,n.y);
    assert.deepEqual(projectDebugPoint(point,m,v),q);assert.ok(dpr>=2);
   }
  }
 }
});
test('前后使用同一尺度与画布，保持原视图差异，历史点明确失效',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),n=manifest.normalization;
 assert.equal(n.logicalWidth,400);assert.equal(n.logicalHeight,900);assert.equal(n.rasterScale,3);
 near(n.scale,840/731);assert.notEqual(n.views.front.translateX,n.views.back.translateX);
 assert.ok(Math.abs(manifest.geometry.front.bounds[1]-manifest.geometry.back.bounds[1])<2);
 assert.ok(Math.abs(manifest.geometry.front.bounds[3]-manifest.geometry.back.bounds[3])<2);
 const m=getBodyModel('front');assert.equal(projectDebugPoint({modelId:'neutral-body-v3',modelVersion:'3.0.0',view:'front',normalized:{x:.5,y:.5}},m,fitViewport(343,422,m)),null);
});
