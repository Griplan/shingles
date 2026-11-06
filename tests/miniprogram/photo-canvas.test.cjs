// Canvas command recorder: component behavior, not a real WeChat screenshot.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
let def;global.Component=o=>def=o;require(path.join(process.env.DERMATOME_BUILD_DIR,'components/photo-canvas/photo-canvas.js'));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function harness(w=320,h=300,dpr=2){
 const calls=[],events=[],pending=[],boundsPending=[];let delay=false,delayBounds=false;const ctx={};for(const k of ['clearRect','setTransform','drawImage','strokeRect','setLineDash','beginPath','arc','fill','stroke','moveTo','lineTo'])ctx[k]=(...a)=>calls.push([k,...a]);
 const node={width:0,height:0,getContext:()=>ctx,createImage(){const img={width:700,height:460};Object.defineProperty(img,'src',{set(v){img.path=v;const cb=()=>img.onload();if(delay)pending.push(cb);else queueMicrotask(cb)}});return img}};
 global.wx={getWindowInfo:()=>({pixelRatio:dpr})};
 const obj={data:{},properties:{source:'photo',mask:'alpha',photoWidth:700,photoHeight:460,mode:'box',points:[],box:null,disabled:false},setData(c){Object.assign(this.data,c)},triggerEvent(n,d){events.push({n,d})},createSelectorQuery(){let cb;const q={select:()=>q,fields:()=>q,boundingClientRect:c=>{cb=c;return q},exec:done=>{if(cb){const run=()=>cb({left:24,top:70,width:w,height:h});if(delayBounds)boundsPending.push(run);else run();}else done([{node,width:w,height:h}])}};return q}};
 for(const[k,v]of Object.entries(def.methods))obj[k]=v.bind(obj);def.lifetimes.created.call(obj);def.lifetimes.ready.call(obj);
 return {obj,node,calls,events,pending,boundsPending,setDelay:v=>delay=v,setBoundsDelay:v=>delayBounds=v};
}
for(const [w,h,dpr]of [[320,300,1],[375,360,2],[768,600,3]])test('photo and alpha use identical contain transform '+[w,h,dpr],async()=>{
 const t=harness(w,h,dpr);await flush();const draws=t.calls.filter(x=>x[0]==='drawImage');assert.equal(draws.length,2);assert.deepEqual(draws[0].slice(2),draws[1].slice(2));
 assert.equal(t.node.width,w*dpr);assert.equal(t.node.height,h*dpr);assert.equal(t.events.at(-1).d.ready,true);
});
test('component native/client touch box, foreground/background and whitespace',async()=>{
 const t=harness();await flush();const e=(x,y)=>({touches:[{x,y}],changedTouches:[{x,y}]});
 await t.obj.touchStart(e(50,100));await t.obj.touchMove(e(220,200));await flush();await t.obj.touchEnd(e(220,200));await flush();
 const prompt=t.events.filter(x=>x.n==='prompt').at(-1).d;assert.ok(prompt.box.xMin<prompt.box.xMax);assert.equal(prompt.point,null);
 t.obj.properties.mode='foreground';await t.obj.touchStart(e(160,150));await t.obj.touchEnd(e(160,150));assert.deepEqual(t.events.at(-1).d.point,{x:.5,y:.5,label:1});
 t.obj.properties.mode='background';const client={touches:[{clientX:184,clientY:220}],changedTouches:[{clientX:184,clientY:220}]};await t.obj.touchStart(client);await t.obj.touchEnd(client);assert.deepEqual(t.events.at(-1).d.point,{x:.5,y:.5,label:0});
 const count=t.events.filter(x=>x.n==='prompt').length;await t.obj.touchStart(e(10,1));await t.obj.touchEnd(e(20,2));assert.equal(t.events.filter(x=>x.n==='prompt').length,count);
});
test('stale loaded mask never paints after source replacement',async()=>{
 const t=harness();await flush();t.setDelay(true);t.obj.properties.mask='old-alpha';const a=t.obj.redraw();await flush();
 t.obj.properties.source='new-photo';t.obj.properties.mask='';const b=t.obj.redraw();await flush();
 t.pending.splice(0).forEach(fn=>fn());await Promise.all([a,b]);const last=t.calls.filter(x=>x[0]==='drawImage').at(-1);assert.equal(last[1].path,'new-photo');assert.equal(t.events.at(-1).d.mask,'');
});
test('cancel never commits a partial box',async()=>{
 const t=harness();await flush();const e=(x,y)=>({changedTouches:[{x,y}]});await t.obj.touchStart(e(20,100));await t.obj.touchMove(e(200,200));await flush();t.obj.touchCancel();await t.obj.touchEnd(e(200,200));assert.equal(t.events.filter(x=>x.n==='prompt').length,0);
});

test('loading next mask never clears the current photo before an atomic completed frame',async()=>{
 const t=harness();await flush();t.calls.length=0;t.setDelay(true);t.obj.properties.mask='next-alpha';const pending=t.obj.redraw();await flush();
 assert.equal(t.pending.length,1);assert.equal(t.calls.filter(c=>c[0]==='clearRect').length,0);assert.equal(t.calls.filter(c=>c[0]==='drawImage').length,0);
 t.pending.shift()();await pending;const draws=t.calls.filter(c=>c[0]==='drawImage');assert.deepEqual(draws.map(c=>c[1].path),['photo','next-alpha']);
 assert.equal(t.calls.filter(c=>c[0]==='clearRect').length,1);assert.deepEqual(draws[0].slice(2),draws[1].slice(2));
});
test('drag moves emit no prompt, release emits once; tiny screen box and cancellation never submit',async()=>{
 const t=harness();await flush();const e=(x,y)=>({touches:[{x,y}],changedTouches:[{x,y}]});
 await t.obj.touchStart(e(60,100));for(const pos of [[100,130],[150,160],[200,180]]){await t.obj.touchMove(e(...pos));await flush();}
 assert.equal(t.events.filter(x=>x.n==='prompt').length,0);await t.obj.touchEnd(e(200,180));await t.obj.touchEnd(e(200,180));
 assert.equal(t.events.filter(x=>x.n==='prompt').length,1);
 await t.obj.touchStart(e(70,100));await t.obj.touchEnd(e(78,180));assert.equal(t.events.filter(x=>x.n==='prompt').length,1);assert.equal(t.events.filter(x=>x.n==='boxinvalid').length,1);
});
test('review mode hides prompting decorations but draws the identical photo and mask',async()=>{
 const t=harness();await flush();t.calls.length=0;t.obj.properties.showPrompts=false;t.obj.properties.box={xMin:.2,yMin:.2,xMax:.6,yMax:.6};t.obj.properties.points=[{x:.3,y:.3,label:1}];
 await t.obj.redraw();assert.equal(t.calls.filter(c=>c[0]==='strokeRect'||c[0]==='arc').length,0);assert.equal(t.calls.filter(c=>c[0]==='drawImage').length,2);
});

// WeChat dispatches successive touch events without awaiting prior selector queries.
const clientTouch=(x,y)=>({touches:[{clientX:x+24,clientY:y+70}],changedTouches:[{clientX:x+24,clientY:y+70}]});
test('client release survives a move redraw while its bounds query is pending',async()=>{
 const t=harness();await flush();await t.obj.touchStart(clientTouch(60,100));t.setBoundsDelay(true);
 const move=t.obj.touchMove(clientTouch(140,150)),end=t.obj.touchEnd(clientTouch(220,200));
 t.boundsPending.shift()();await flush();t.boundsPending.shift()();await Promise.all([move,end]);await flush();
 const prompts=t.events.filter(e=>e.n==='prompt');assert.equal(prompts.length,1);assert.ok(prompts[0].d.box.xMax>.65);
});
test('cancel during an asynchronous start cannot resurrect the gesture',async()=>{
 const t=harness();await flush();t.setBoundsDelay(true);const start=t.obj.touchStart(clientTouch(60,100));
 t.obj.touchCancel();t.boundsPending.shift()();await start;t.setBoundsDelay(false);await t.obj.touchEnd(clientTouch(220,200));
 assert.equal(t.events.filter(e=>e.n==='prompt').length,0);
});
test('unchanged mode and disabled notifications preserve an active gesture',async()=>{
 const t=harness();await flush();def.observers['mode,disabled'].call(t.obj);await flush();
 await t.obj.touchStart(clientTouch(60,100));def.observers['mode,disabled'].call(t.obj);await flush();
 await t.obj.touchEnd(clientTouch(220,200));assert.equal(t.events.filter(e=>e.n==='prompt').length,1);
});

test('native dispatch order survives out-of-order client query completion',async()=>{
 const t=harness();await flush();t.setBoundsDelay(true);
 const start=t.obj.touchStart(clientTouch(60,100)),move=t.obj.touchMove(clientTouch(140,150)),end=t.obj.touchEnd(clientTouch(220,200));
 const callbacks=t.boundsPending.splice(0);callbacks[2]();callbacks[1]();await flush();assert.equal(t.events.filter(e=>e.n==='prompt').length,0);
 callbacks[0]();await Promise.all([start,move,end]);assert.equal(t.events.filter(e=>e.n==='prompt').length,1);
});
test('photo replacement and disabling invalidate pending client gestures',async()=>{
 for(const change of ['source','disabled']){
  const t=harness();await flush();await t.obj.touchStart(clientTouch(60,100));t.setBoundsDelay(true);const end=t.obj.touchEnd(clientTouch(220,200));
  t.obj.properties[change]=change==='source'?'new-photo':true;
  if(change==='source')await t.obj.redraw();else def.observers['mode,disabled'].call(t.obj);
  t.boundsPending.shift()();await end;assert.equal(t.events.filter(e=>e.n==='prompt').length,0);
 }
});

for(const[w,h,dpr]of [[320,300,1],[375,360,2],[768,600,3]])test('brush commits one photo-space stroke on release, consistent at '+[w,h,dpr],async()=>{
 const t=harness(w,h,dpr);await flush();t.obj.properties.mode='paint-erase';t.obj.properties.brushRadius=.02;
 const fit=require(path.join(process.env.DERMATOME_BUILD_DIR,'utils/photo-coordinate.js')).fitPhoto(700,460,w,h);
 const touch=(x,y)=>clientTouch(fit.left+x*fit.width,fit.top+y*fit.height);
 await t.obj.touchStart(touch(.2,.4));await t.obj.touchMove(touch(.3,.5));assert.equal(t.events.filter(e=>e.n==='stroke').length,0);
 await t.obj.touchEnd(touch(.4,.6));await t.obj.touchEnd(touch(.4,.6));
 const strokes=t.events.filter(e=>e.n==='stroke');assert.equal(strokes.length,1);assert.equal(strokes[0].d.mode,'erase');assert.equal(strokes[0].d.radius,.02);
 assert.ok(Math.abs(strokes[0].d.points[0].x-.2)<1e-12);assert.ok(Math.abs(strokes[0].d.points.at(-1).y-.6)<1e-12);
 assert.equal(t.events.filter(e=>e.n==='prompt').length,0);
});
test('brush cancel, outside-photo path and page detachment cannot commit',async()=>{
 for(const action of ['cancel','outside','detach']){const t=harness();await flush();t.obj.properties.mode='paint-add';
 await t.obj.touchStart(clientTouch(100,150));
 if(action==='cancel')t.obj.touchCancel();else if(action==='outside')await t.obj.touchMove(clientTouch(100,1));else def.lifetimes.detached.call(t.obj);
 await t.obj.touchEnd(clientTouch(130,160));assert.equal(t.events.filter(e=>e.n==='stroke').length,0);}
});
