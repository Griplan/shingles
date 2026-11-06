const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const root=path.resolve(__dirname,'../..'),out=process.env.DERMATOME_BUILD_DIR;
const ts=require(path.join(root,'miniprogram/node_modules/typescript'));
const base=path.join(root,'docs/performance-audit/p6/baseline');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'))).sha256;
function loadBaseline(name,overrides={}){
 const file=path.join(base,name+'.ts.txt'),src=fs.readFileSync(file,'utf8');
 assert.equal(crypto.createHash('sha256').update(src).digest('hex'),manifest['miniprogram/utils/'+name+'.ts']);
 const filename=path.join(out,'utils',name+'.baseline.js'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
 const normal=m.require.bind(m);m.require=id=>id in overrides?overrides[id]:normal(id);
 m._compile(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);return m.exports;
}
const before=loadBaseline('annotation-geometry'),after=require(path.join(out,'utils/annotation-geometry'));
const oldPlacement=loadBaseline('placement-geometry',{'./annotation-geometry':before}),newPlacement=require(path.join(out,'utils/placement-geometry'));
const {getBodyModel}=require(path.join(out,'data/body-models'));
const {syntheticPhoto}=require('./placement-fixtures.cjs');
const P=(x,y)=>({x,y});
const rect=(x,y,w,h)=>[P(x,y),P(x+w,y),P(x+w,y+h),P(x,y+h),P(x,y)];
const bodyGeometry=coordinates=>({type:'MultiPolygon',coordinateSpace:'body_template_normalized_v1',coordinates});
const freeze=r=>Object.freeze(r.map(p=>Object.freeze({...p})));
let seed=0x61103;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const view of ['front','back'])test('indexed '+view+' body equals original at random, edge, vertex and epsilon-offset points',()=>{
 const model=getBodyModel(view),body=after.bodyGeometry(model);let count=0;
 const check=p=>{assert.equal(after.pointInBody(p,body),before.pointInBody(p,body),JSON.stringify(p));count++};
 for(let i=0;i<10000;i++)check(P(random(),random()));
 for(const [a,b]of before.edges(body[0].outer)){
  for(const t of [0,.5,1])for(const e of [-2e-12,-1e-12,-.5e-12,0,.5e-12,1e-12,2e-12]){
   const p=P(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);check(P(p.x+e,p.y));check(P(p.x,p.y+e));
  }
 }
 assert.ok(count>10000);
});
test('frozen long rings with holes, winding, horizontal edges and bucket-boundary contact keep exact semantics',()=>{
 const ring=[];for(let i=0;i<64;i++){const t=i/64;ring.push(P(.1+.8*t,.1))}for(let i=0;i<64;i++)ring.push(P(.9,.1+.8*i/64));for(let i=0;i<64;i++)ring.push(P(.9-.8*i/64,.9));for(let i=0;i<64;i++)ring.push(P(.1,.9-.8*i/64));ring.push(ring[0]);
 for(const reversed of [false,true]){
  const r=reversed?[...ring].reverse():ring;const body=[{outer:freeze(r),holes:[freeze(r.map(p=>P(.25+p.x/2,.25+p.y/2)))]}];
  for(let i=0;i<=100;i++)for(let j=0;j<=100;j++)assert.equal(after.pointInBody(P(i/100,j/100),body),before.pointInBody(P(i/100,j/100),body));
 }
});
test('mutable and shallow-frozen rings never acquire stale indexes; replacement immutable body is independent',()=>{
 const ring=Array.from({length:64},(_,i)=>P(.5+.3*Math.cos(i/64*2*Math.PI),.5+.3*Math.sin(i/64*2*Math.PI)));
 const body=[{outer:Object.freeze(ring),holes:[]}];assert.equal(after.pointInBody(P(.5,.5),body),true);
 for(const p of ring)p.x+=.5;
 assert.equal(after.pointInBody(P(.5,.5),body),false);
 const fixed=[{outer:freeze(ring.map(p=>P(p.x-.5,p.y))),holes:[]}];assert.equal(after.pointInBody(P(.5,.5),fixed),true);
 assert.equal(after.pointInBody(P(.5,.5),body),false);
});
test('complete placement decision and transformed geometry match frozen baseline for full-scale scenarios',()=>{
 let checks=0;
 for(const view of ['front','back']){
  const model=getBodyModel(view);
  for(const n of [10,100,500,2000])for(const multi of n===10?[false]:[false,true]){
   const source=syntheticPhoto(n,multi),prepared=newPlacement.preparePhotoGeometry(source),old=oldPlacement.preparePhotoGeometry(source);
   const initial=newPlacement.initialPlacement(prepared,model,model.regions.find(r=>r.id===(view==='front'?'front-chest':'back-upper-back')));
   for(const patch of [{},{rotationDegrees:43},{scale:.7},{scale:4},{translation:P(.01,.01)},{translation:P(.5,.82)}]){
    const transform={...initial,...patch};const a=oldPlacement.transformPhotoPolygonToBody(old,transform,model),b=newPlacement.transformPhotoPolygonToBody(prepared,transform,model);
    assert.deepEqual(b,a);assert.deepEqual(newPlacement.validatePlacementGeometry(b,model),oldPlacement.validatePlacementGeometry(a,model));checks++;
   }
  }
  for(let i=0;i<160;i++){
   const geometry=bodyGeometry([[rect(random()*.9,random()*.9,.002+random()*.15,.002+random()*.15)]]);
   assert.deepEqual(newPlacement.validatePlacementGeometry(geometry,model),oldPlacement.validatePlacementGeometry(geometry,model));checks++;
  }
  for(const rings of [[[P(.4,.3),P(.6,.5),P(.4,.5),P(.6,.3),P(.4,.3)]],[rect(.45,.3,.08,.05),rect(.46,.31,.02,.02)]]){
   const geometry=bodyGeometry([rings]);assert.deepEqual(newPlacement.validatePlacementGeometry(geometry,model),oldPlacement.validatePlacementGeometry(geometry,model));checks++;
  }
 }
 assert.equal(checks,408);
});
