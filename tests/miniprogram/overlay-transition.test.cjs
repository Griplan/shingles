const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {OverlayTransition}=require(path.join(process.env.DERMATOME_BUILD_DIR,'utils/overlay-transition.js'));
function clock(){let time=0,next=0;const pending=new Map();return {pending,now:()=>time,request:f=>{pending.set(++next,f);return next;},cancel:id=>pending.delete(id),step(ms){time+=ms;const batch=[...pending.values()];pending.clear();batch.forEach(f=>f());}};}
test('overlay fade retains common IDs, cancels interrupted tasks, terminates and supports immediate fallback',()=>{
 const c=clock(),t=new OverlayTransition(),frames=[];const paint=(v,done)=>frames.push({v:new Map(v),done});
 t.start(['A','B'],false,200,c,paint);assert.equal(t.values.get('A'),0);c.step(100);assert.ok(t.values.get('A')>0&&t.values.get('A')<1);
 const obsolete=[...c.pending.values()][0];t.start(['B'],true,200,c,paint);const start=t.values.get('B');assert.ok(start>0);const count=frames.length;obsolete();assert.equal(frames.length,count);
 c.step(200);assert.deepEqual([...t.values],[['B',1]]);assert.equal(c.pending.size,0);assert.equal(frames.at(-1).done,true);
 t.start(['A','B'],true,200,c,paint);assert.equal(t.values.get('B'),1);c.step(50);t.cancel(true);const cancelled=frames.length;c.step(1000);assert.equal(frames.length,cancelled);assert.equal(t.values.size,0);
 t.start(['NEW_VIEW'],false,200,null,paint);assert.deepEqual([...t.values],[['NEW_VIEW',1]]);assert.equal(c.pending.size,0);
 t.start(['REDUCED_MOTION'],false,0,c,paint);assert.deepEqual([...t.values],[['REDUCED_MOTION',1]]);assert.equal(c.pending.size,0);
});
