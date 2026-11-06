const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{performance}=require('perf_hooks');let def;global.Component=d=>def=d;require(path.resolve(process.argv[2],'components/photo-canvas/photo-canvas.js'));
const flush=async()=>{for(let i=0;i<14;i++)await Promise.resolve()};
async function run(w,rep){
 const counts={},phases=[];let width=0,height=0;const count=k=>counts[k]=(counts[k]||0)+1;
 const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:()=>count(k),set:(o,k,v)=>(o[k]=v,true)});
 const node={get width(){return width},set width(v){width=v;count('widthWrites')},get height(){return height},set height(v){height=v;count('heightWrites')},getContext(){count('context');return ctx},createImage(){count('images');const i={width:700,height:460};Object.defineProperty(i,'src',{set(){queueMicrotask(()=>i.onload())}});return i}};
 global.wx={getWindowInfo:()=>({pixelRatio:2})};
 const obj={data:{},properties:{source:'synthetic-photo',mask:'synthetic-alpha',photoWidth:700,photoHeight:460,mode:'box',points:[],box:null,disabled:false},setData(c){count('setData');counts.setDataBytes=(counts.setDataBytes||0)+Buffer.byteLength(JSON.stringify(c));Object.assign(this.data,c)},triggerEvent(n){count('event.'+n)},createSelectorQuery(){let cb;const q={select:()=>q,fields:()=>q,boundingClientRect:c=>(cb=c,q),exec:f=>{if(cb){count('bounds');cb({left:24,top:70,width:w,height:400})}else{count('measure');f([{node,width:w,height:400}])}}};return q}};
 for(const[k,v]of Object.entries(def.methods))obj[k]=v.bind(obj);def.lifetimes.created.call(obj);def.lifetimes.ready.call(obj);await flush();
 const initial={...counts};
 async function phase(name,fn){for(const k of Object.keys(counts))delete counts[k];const t=performance.now();await fn();await flush();phases.push({traceId:`photo-${w}-${rep}-${name}`,name,wall_ms:performance.now()-t,counts:{...counts}})}
 const event=(x,y)=>({touches:[{clientX:x+24,clientY:y+70}],changedTouches:[{clientX:x+24,clientY:y+70}]});
 await phase('box-120-moves',async()=>{await obj.touchStart(event(50,150));for(let i=0;i<120;i++){await obj.touchMove(event(100+i,210));await flush()};await obj.touchEnd(event(220,210))});assert.equal(phases.at(-1).counts['event.prompt'],1);
 obj.properties.mode='paint-erase';obj.syncInput();
 await phase('brush-120-moves',async()=>{await obj.touchStart(event(60,160));for(let i=0;i<120;i++){await obj.touchMove(event(60+i,180));await flush()};await obj.touchEnd(event(180,180))});assert.equal(phases.at(-1).counts['event.stroke'],1);
 await phase('candidate-switch-10',async()=>{for(let i=0;i<10;i++){obj.properties.mask='synthetic-alpha-'+i%3;await obj.redraw()}});
 def.lifetimes.detached.call(obj);
 return {width:w,rep,initial,phases};
}
(async()=>{const cases=[];for(const w of [320,375,430])for(let i=0;i<3;i++)cases.push(await run(w,i));fs.writeFileSync(process.argv[3],JSON.stringify({kind:'Node wx adapter; images synthetic dimension objects, no image decode/raster/native bridge; no backend request',cases},null,2)+'\n');console.log('photo cases',cases.length)})().catch(e=>{console.error(e);process.exitCode=1});
