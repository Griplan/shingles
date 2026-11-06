// Reuse the unchanged P5 actual-page harness; only the case loop changes.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const original=path.resolve(__dirname,'../../scripts/placement_profile.cjs');
let source=fs.readFileSync(original,'utf8');
const start="report.cases.push(await run(10,false));",end='if(output)fs.writeFileSync';
const first=source.indexOf(start),last=source.indexOf(end);if(first<0||last<first)throw Error('P5 harness changed');
source=source.slice(0,first)+`for(let i=0;i<21;i++){report.cases.push(await run(2000,true));report.cases.at(-1).warmup=i===0;if(global.gc)global.gc();report.cases.at(-1).heapAfterGC=process.memoryUsage().heapUsed;}
 report.method='Same P5 command adapter, fresh stores; 21 repetitions, first warmup; 2000 vertices, five pieces/five holes, 375px. No network/native pixels.';
 `+source.slice(last);
const m=new Module(original,module);m.filename=original;m.paths=module.paths;m._compile(source,original);
