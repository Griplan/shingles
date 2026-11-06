const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {hitTestRegion}=read('utils/body-hit-test.js');
const {getBodyModel}=read('data/body-models.js');
const fixture=require('../../backend/tests/fixtures/synthetic-ui-hit.json');
const points=a=>a.map(([x,y])=>({x,y}));
const synthetic=Object.assign({},getBodyModel('front'),{logicalWidth:1000,logicalHeight:1000,
 hitOutline:points(fixture.body).map(p=>({x:p.x*1000,y:p.y*1000})),
 regions:fixture.regions.map(r=>Object.assign({},r,{view:'front',side:'midline',outline:points(r.outline)}))});
test('人工非医学夹具：唯一、重叠、边界、人体外和人体内无配置分别报告',()=>{
 assert.equal(fixture.synthetic,true);
 for(const [x,y,status,ids] of [[.2,.2,'unique',['ui-a']],[.45,.3,'ambiguous',['ui-a','ui-b']],
   [.5,.5,'ambiguous',['ui-a','ui-b']],[.1,.1,'unique',['ui-a']],
   [.75,.7,'unconfigured',[]],[.9,.9,'unconfigured',[]],[0,0,'outside-body',[]]]) {
  const result=hitTestRegion({x,y},synthetic);assert.deepEqual(result,{status,regionIds:ids});
  assert.deepEqual(hitTestRegion({x,y},Object.assign({},synthetic,{regions:[...synthetic.regions].reverse()})),result);
 }
 for(const p of [{x:NaN,y:.3},{x:.3,y:Infinity},{x:1.1,y:.3}])assert.equal(hitTestRegion(p,synthetic).status,'outside-body');
});
test('真实区域使用多边形且保留独立前后与解剖学左右，唯一点不会串面',()=>{
 const cases={front:[['head',.5,.1],['neck',.5,.2],['chest',.5,.29],['abdomen',.5,.41],
  ['left-arm',.75,.378],['right-arm',.25,.378],['left-leg',.63,.712],['right-leg',.37,.712]],
 back:[['head',.5,.09],['neck',.5,.18],['upper-back',.5,.27],['lower-back',.5,.41],
  ['right-arm',.75,.378],['left-arm',.25,.378],['right-leg',.63,.71],['left-leg',.37,.71]]};
 for(const [view,rows] of Object.entries(cases))for(const [id,x,y]of rows)
  assert.deepEqual(hitTestRegion({x,y},getBodyModel(view)),{status:'unique',regionIds:[view+'-'+id]});
 const mixed=Object.assign({},getBodyModel('front'),{regions:getBodyModel('back').regions});
 assert.equal(hitTestRegion({x:.5,y:.27},mixed).status,'unconfigured');
});
test('真实头颈/颈胸/胸腹边界有明确候选，不通过扩大包围盒吞掉人体间隙',()=>{
 const m=getBodyModel('front');
 for(const [y,ids] of [[162/900,['front-head','front-neck']],[194/900,['front-chest','front-neck']],
  [.35,['front-abdomen','front-chest']]])assert.deepEqual(hitTestRegion({x:.5,y},m),{status:'ambiguous',regionIds:ids});
 for(const [x,y]of [[.5,.78],[270/400,340/900],[130/400,340/900],[.1,.1]])
  assert.deepEqual(hitTestRegion({x,y},m),{status:'outside-body',regionIds:[]});
});
