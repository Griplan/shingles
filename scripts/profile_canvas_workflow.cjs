// Deterministic Canvas adapter counters; no pixels/GPU/network/WeChat frame-rate claims.
// Optional baseline is the saved pre-change component source; both use today's draw helpers.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'v4-canvas-profile-'));
try{
 const r=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',out],{stdio:'inherit'});assert.equal(r.status,0);
 const load=f=>require(path.join(out,f));
 const {ATLAS_MANIFEST:M,ATLAS_REGIONS:R}=load('data/atlas.generated.js');
 function run(file){
  let def;global.Component=d=>{def=d};load(file);
  const jobs=[],events=[],stats={selectorMeasurements:0,contextAcquisitions:0,imageLoads:0,widthWrites:0,heightWrites:0,bodyDraws:0,clearBeforeReady:0,setDataCalls:0};
  let loaded=false,w=0,h=0;
  const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get(o,k){if(k in o)return o[k];return ()=>{if(k==='drawImage')stats.bodyDraws++;if(k==='clearRect'&&!loaded)stats.clearBeforeReady++;};},set(o,k,v){o[k]=v;return true;}});
  const node={getContext(){stats.contextAcquisitions++;return ctx;},createImage(){stats.imageLoads++;const i={width:1200,height:2700};Object.defineProperty(i,'src',{set(){jobs.push(()=>{loaded=true;i.onload();});}});return i;}};
  Object.defineProperties(node,{width:{get:()=>w,set:v=>{w=v;stats.widthWrites++;}},height:{get:()=>h,set:v=>{h=v;stats.heightWrites++;}}});
  global.wx={nextTick:f=>jobs.push(f),getWindowInfo:()=>({pixelRatio:2})};
  const p={data:{...def.data},properties:{},setData(c){Object.assign(this.data,c);stats.setDataCalls++;},triggerEvent(name,detail){events.push({name,detail});},createSelectorQuery(){const q={select:()=>q,fields:()=>q,exec(cb){stats.selectorMeasurements++;cb([{node,width:207,height:363}]);}};return q;}};
  for(const[k,v]of Object.entries(def.properties))p.properties[k]=v.value;
  for(const[k,v]of Object.entries(def.methods))p[k]=v.bind(p);
  const flush=()=>{let n=0;while(jobs.length){assert.ok(n++<100);jobs.shift()();}};
  def.lifetimes.created.call(p);def.lifetimes.ready.call(p);flush();
  const regions=R.filter(r=>r.view==='front');
  const atlas=rs=>({atlasVersion:M.atlasVersion,templateId:M.templateId,templateVersion:M.templateVersion,geometryId:M.geometryId,view:'front',regions:rs,showLabels:false});
  for(let i=0;i<20;i++){p.properties.atlas=atlas(i%2?regions:[regions[0]]);Object.values(def.observers)[0].call(p);flush();}
  assert.equal(p.data.error,'');def.lifetimes.detached.call(p);
  return stats;
 }
 const report={environment:{node:process.version,kind:'deterministic adapter; 207x363, DPR2, init + 20 same-view all/single changes, animation off; NOT native rendering'},after:run('components/body-canvas/body-canvas.js')};
 if(process.argv[2]){const ts=require(path.join(root,'miniprogram/node_modules/typescript'));const src=fs.readFileSync(process.argv[2],'utf8');
  fs.writeFileSync(path.join(out,'components/body-canvas/before.js'),ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  report.before=run('components/body-canvas/before.js');}
 assert.equal(report.after.selectorMeasurements,1);assert.equal(report.after.contextAcquisitions,1);assert.equal(report.after.imageLoads,2);assert.equal(report.after.clearBeforeReady,0);
 console.log(JSON.stringify(report,null,2));
}finally{fs.rmSync(out,{recursive:true,force:true});}
