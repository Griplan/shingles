// Compile current TS, then replace only two baseline modules in a separate temp build.
// No source-tree edit, no download, no production files written.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'dermatome-p6-reproduce-'));
const after=path.join(temp,'after'),before=path.join(temp,'before');
const result=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',after],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
fs.cpSync(after,before,{recursive:true});
const ts=require(path.join(root,'miniprogram/node_modules/typescript')),base=path.resolve(__dirname,'../baseline'),manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'))).sha256;
for(const name of ['annotation-geometry','placement-geometry']){
 const source=fs.readFileSync(path.join(base,name+'.ts.txt'),'utf8');
 if(crypto.createHash('sha256').update(source).digest('hex')!==manifest['miniprogram/utils/'+name+'.ts'])throw Error('Baseline digest mismatch');
 fs.writeFileSync(path.join(before,'utils',name+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText);
}
console.log(JSON.stringify({before,after,scope:'Current unchanged dependencies with hash-locked P5 geometry sources; temporary compilation only'}));
