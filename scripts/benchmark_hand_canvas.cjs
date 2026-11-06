// Node method-dispatch/coordinate cost only; not native Canvas paint time or FPS.
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process'),{performance}=require('perf_hooks');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'v65-canvas-'));
try{
 const c=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',out],{stdio:'inherit'});if(c.status)throw Error('compile failed');
 const load=f=>require(path.join(out,f));const g=load('utils/annotation-geometry.js'),{drawAtlas}=load('components/body-canvas/atlas-render.js'),{getBodyModel}=load('data/body-models.js'),{fitViewport}=load('utils/coordinate.js');
 const refs=JSON.parse(fs.readFileSync(path.join(root,'docs/validation-records/v6.5-main-body-hand/evidence/reference-points.json')));const rows={};
 for(const ver of ['v2','v3']){const bp=ver==='v2'?'commons-template4.json':'commons-template4-hands-v2.json',b=JSON.parse(fs.readFileSync(path.join(root,'data/body',bp)));rows[ver]={};
  for(const v of ['front','back']){const m=getBodyModel(v),rr=JSON.parse(fs.readFileSync(path.join(root,`data/atlas/goran-2022-preview-${ver}/${v}.json`))).regions.map(r=>({...r,templateVersion:m.version,geometryId:m.geometryId,atlasVersion:'benchmark'}));
   const p=b.views[v].geometry.coordinates,body=Object.freeze([{outer:Object.freeze(p[0].map(([x,y])=>Object.freeze({x,y}))),holes:Object.freeze([])}]);
   const vp=fitViewport(375,560,m),layer={templateId:m.id,templateVersion:m.version,geometryId:m.geometryId,atlasVersion:'benchmark',view:v,regions:rr,showLabels:false};
   rows[ver][v]={body,vp,layer,model:m};}}
 const ctx={save(){},restore(){},beginPath(){},closePath(){},rect(){},clip(){},moveTo(){},lineTo(){},fill(){},stroke(){},setLineDash(){}};
 const raw={v2:{hit46Points:[],renderDispatch:[]},v3:{hit46Points:[],renderDispatch:[]}};
 for(let k=0;k<60;k++)for(const ver of ['v2','v3']){let t=performance.now();for(const r of refs)g.pointInBody({x:r.normalized[0],y:r.normalized[1]},rows[ver][r.view].body);let hit=performance.now()-t;
  t=performance.now();for(const v of ['front','back']){const a=rows[ver][v];drawAtlas(ctx,a.vp,a.model,a.layer);}let draw=performance.now()-t;
  if(k>=10){raw[ver].hit46Points.push(hit);raw[ver].renderDispatch.push(draw);}}
 const stats=x=>{const y=[...x].sort((a,b)=>a-b);return{n:x.length,medianMs:(y[24]+y[25])/2,p95Ms:y[47],maxMs:y[49]}};
 const report={node:process.version,cpu:os.cpus()[0].model,method:'Same-process alternating data v2/v3, 10 warmups + 50 measured loops, 46 fixed points and both full atlas views; frozen P6 index and renderer WeakMap reused. No native Canvas.',statistics:Object.fromEntries(Object.entries(raw).map(([v,fields])=>[v,Object.fromEntries(Object.entries(fields).map(([k,x])=>[k,stats(x)]))])),raw};
 fs.writeFileSync(path.join(root,'docs/validation-records/v6.5-main-body-hand/evidence/canvas-performance.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.statistics,null,2));
}finally{fs.rmSync(out,{recursive:true,force:true});}
