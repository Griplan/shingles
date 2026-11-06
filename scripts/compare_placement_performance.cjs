// Reproducible paired production-JS benchmarks, using preserved pre-change sources.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),record=path.join(root,'docs/validation-records/v5.3-performance');
const dest=path.resolve(process.argv[2]||path.join(record,'paired')),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'placement-perf-'));
fs.mkdirSync(dest,{recursive:true});
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);}
try{
 const after=path.join(tmp,'after'),before=path.join(tmp,'before');
 run([path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project','miniprogram/tsconfig.json','--noEmit','false','--outDir',after]);fs.cpSync(after,before,{recursive:true});
 const ts=require(path.join(root,'miniprogram/node_modules/typescript'));
 for(const [target,source]of [['components/placement-overlay/placement-overlay.js','placement-overlay'],['pages/placement/placement.js','placement'],['state/placement-session.js','placement-session'],['utils/placement-geometry.js','placement-geometry']]){
  fs.writeFileSync(path.join(before,target),ts.transpileModule(fs.readFileSync(path.join(record,source+'-before.ts.txt'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS}}).outputText);
 }
 const pairs=[];
 for(let repeat=1;repeat<=3;repeat++){
  const pair={};for(const version of repeat%2?['before','after']:['after','before']){const file=path.join(dest,version+'-'+repeat+'.json');run([path.join(root,'scripts/profile_placement.cjs'),version==='before'?before:after,file]);pair[version]=path.basename(file);}pairs.push(pair);
 }
 fs.writeFileSync(path.join(dest,'runs.json'),JSON.stringify({pairs,kind:'paired JS/wx adapter; same synthetic geometry, environment, event schedule; native Canvas raster, bridge latency and FPS NOT_RUN'},null,2)+'\n');console.log('PASSED: three paired runs, 8 cases each, exact confirmation geometry verified. Evidence: '+dest);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
