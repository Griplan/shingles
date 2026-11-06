const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {getBodyModel}=read('data/body-models.js');
const {BODY_REGIONS:previous}=read('data/body-regions-v15.js');
const {hitTestRegion}=read('utils/body-hit-test.js');
const {fitViewport,focusViewport,normalizedToCanvas}=read('utils/coordinate.js');
const {probeTouch}=read('utils/body-debug.js');
const {drawBody}=read('components/body-canvas/render.js');
const refs=require('./fixtures/commons-region-references.json');
const {pngAlpha}=require('./helpers/png-alpha.cjs');
const images=Object.fromEntries(['front','back'].map(v=>[v,pngAlpha(path.resolve(__dirname,'../../miniprogram/assets/body/commons-cc0/'+v+'.png'))]));
// Ray casting is independent of the production hit test, and observes the actual path sent to fill().
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[j],b=poly[i];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
}return yes;}
function recorder(){
 const fills=[],strokes=[];let path=[],clips=0,depth=0;
 const c={fills,strokes,clips:()=>clips,depth:()=>depth,beginPath(){path=[];},moveTo(x,y){path.push({x,y});},lineTo(x,y){path.push({x,y});},
 closePath(){},fill(){fills.push({path:[...path],style:c.fillStyle});},stroke(){strokes.push({width:c.lineWidth,dash:c.dash});},
 setLineDash(v){c.dash=v;},save(){depth++;},restore(){depth--;},clip(){clips++;}};
 for(const k of ['clearRect','fillRect','drawImage','translate','scale','bezierCurveTo','quadraticCurveTo'])c[k]=()=>{};
 return c;
}
test('V1.6源图人工参考点：胸侧/双上臂/肩界两侧/颈腹与公共边界，不从命中函数产生期望',()=>{
 for(const r of refs.cases){const m=getBodyModel(r.view),[x,y]=r.logical;
  assert.equal(m.regionSetId,refs.regionSetId);assert.equal(m.version,'4.0.1');
  assert.deepEqual(r.normalized,{x:x/400,y:y/900});
  const opaque=images[r.view].at(x*3,y*3)>127;
  assert.equal(opaque,r.expectedStatus!=='outside-body',r.label+' source PNG');
  assert.deepEqual(hitTestRegion(r.normalized,m),{status:r.expectedStatus,regionIds:r.expectedRegionIds},r.label);
 }
});
test('旧胸/上背上臂混选复现；新配置同点只属对应上肢，focus留白不参与最终判定',()=>{
 for(const r of refs.cases.filter(r=>r.label.includes('old-bleed'))){
  const m=getBodyModel(r.view),old=Object.assign({},m,{regions:previous[r.view]});
  const torso=r.view+'-'+(r.view==='front'?'chest':'upper-back');
  assert.ok(hitTestRegion(r.normalized,old).regionIds.includes(torso),r.label+' reproduces');
  assert.deepEqual(hitTestRegion(r.normalized,m).regionIds,r.expectedRegionIds);
  const enlarged=Object.assign({},m,{regions:m.regions.map(a=>Object.assign({},a,{bounds:{x:0,y:0,width:1,height:1}}))});
  assert.deepEqual(hitTestRegion(r.normalized,enlarged),hitTestRegion(r.normalized,m));
 }
});
test('高亮实际fill路径就是命中outline，轻实线宽度始终1 CSS px；源图裁切状态恢复',()=>{
 for(const view of ['front','back'])for(const suffix of [view==='front'?'chest':'upper-back','left-arm','right-arm']){
  const m=getBodyModel(view),region=m.regions.find(r=>r.id===view+'-'+suffix),base=fitViewport(343,422,m);
  for(const viewport of [base,focusViewport(base,region.bounds),base]){
   const c=recorder();drawBody(c,viewport,m,region,null,{});
   assert.equal(c.depth(),0);assert.equal(c.clips(),1);
   const fill=c.fills.find(f=>String(f.style).includes('rgba'));
   assert.deepEqual(fill.path,region.outline.map(p=>({x:p.x*400,y:p.y*900})));
   for(const r of refs.cases.filter(r=>r.view===view&&r.expectedStatus==='unique')){
    const expected=r.expectedRegionIds.includes(region.id);
    assert.equal(inside({x:r.logical[0],y:r.logical[1]},fill.path),expected,region.id+' / '+r.label);
   }
   assert.ok(c.strokes.some(s=>Math.abs(s.width*viewport.scale-1)<1e-9&&s.dash.length===0));
  }
 }
});
test('手工源图参考点跨全身/胸部focus/复位及320/375/430/矮容器归属不变',()=>{
 for(const [w,h]of [[288,300],[343,422],[398,630],[288,240]])for(const view of ['front','back']){
  const m=getBodyModel(view),base=fitViewport(w,h,m),torso=m.regions.find(r=>r.id===view+'-'+(view==='front'?'chest':'upper-back'));
  for(const viewport of [base,focusViewport(base,torso.bounds),base])for(const r of refs.cases.filter(r=>r.view===view)){
   const css=normalizedToCanvas(r.normalized,viewport);
   // Points outside the focused visible viewport cannot receive native taps; pure region identity still checked above.
   if(css.x<0||css.x>w||css.y<0||css.y>h)continue;
   const p=probeTouch({kind:'client',point:{x:css.x+17,y:css.y-83}},{left:17,top:-83,width:w,height:h},viewport,m);
   if(r.expectedStatus==='outside-body'){assert.equal(p.status,'outside-body');continue;}
   assert.equal(p.status,'valid');assert.deepEqual(hitTestRegion(p.normalized,m),{status:r.expectedStatus,regionIds:r.expectedRegionIds},r.label);
  }
 }
});
