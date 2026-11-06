const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const g=load('utils/annotation-geometry.js'),{getBodyModel}=load('data/body-models.js');
const fixture=require('../../backend/tests/fixtures/synthetic-annotation-geometry.json');
assert.equal(fixture.synthetic,true);
for(const c of fixture.cases)test(`V2 geometry ${c.name}`,()=>{
 const original=JSON.stringify(c.vertices),result=g.validatePolygon(c.vertices,fixture.bodies[c.body]);
 assert.equal(result.ok,c.expected,result.message);
 assert.equal(JSON.stringify(c.vertices),original);
 if(result.ok){assert.equal(result.ring.length,c.vertices.length+1);assert.deepEqual(result.ring[0],result.ring.at(-1));
  assert.deepEqual(result.ring.slice(0,-1),c.vertices);
  assert.equal(g.validatePolygon([...c.vertices].reverse(),fixture.bodies[c.body]).ok,true);}
});
test('V2 malformed finite/type/range, unsupported nested/explicit closure and resource limits',()=>{
 const triangle=fixture.cases[0].vertices;
 for(const value of [NaN,Infinity,-Infinity,'0.3',true,null,undefined,-1,1.01]){
  assert.equal(g.validatePolygon([{x:value,y:.3},...triangle.slice(1)],fixture.bodies.solid).ok,false);
 }
 for(const points of [[],null,[[triangle]],triangle.concat(triangle[0]),Array(129).fill(triangle[0])])
  assert.equal(g.validatePolygon(points,fixture.bodies.solid).ok,false);
});
test('V2 actual bound body: central shape and crossing entry chest→abdomen accepted; air bridge rejected',()=>{
 for(const view of ['front','back']) {
  const body=g.bodyGeometry(getBodyModel(view));
  for(const key of ['UI-A','UI-B','UI-cross-navigation'])assert.equal(g.validatePolygon(fixture.editor[key],body).ok,true,view+key);
  assert.equal(g.validatePolygon(fixture.editor['UI-gap'],body).ok,false);
  assert.equal(g.pointInBody(fixture.editor.outside,body),false);
 }
});
test('V2 full interval containment finds a narrow notch missed by sparse edge samples',()=>{
 // Tight notch is derived from the explicit fixture, with both entry intersections retained.
 const part=fixture.bodies.notch[0];
 const body=[{outer:part.outer.map(p=>({...p,x:p.x===.4?.49991:p.x===.6?.49993:p.x})),holes:[]}];
 assert.equal(g.validatePolygon(fixture.cases.find(c=>c.name==='UI-J-background-edge').vertices,body).ok,false);
});
