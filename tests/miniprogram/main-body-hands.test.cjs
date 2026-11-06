const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..'),load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {getBodyModel}=load('data/body-models.js'),g=load('utils/annotation-geometry.js');
const coords=load('utils/coordinate.js'),{drawAtlas}=load('components/body-canvas/atlas-render.js');
const {ATLAS_REGIONS:R,ATLAS_MANIFEST:M}=load('data/atlas.generated.js');
const refs=JSON.parse(fs.readFileSync(path.join(root,'docs/validation-records/v6.5-main-body-hand/evidence/reference-points.json')));
test('V6.5 original SVG reference points share front/back body validation with V2; finger air rejected',()=>{
 for(const r of refs){const p={x:r.normalized[0],y:r.normalized[1]},b=g.bodyGeometry(getBodyModel(r.view));assert.equal(g.pointInBody(p,b),r.expectedSkin,r.id);}
 for(const v of ['front','back']){const m=getBodyModel(v),b=g.bodyGeometry(m),s=refs.find(r=>r.view===v&&r.position==='palm'||r.view===v&&r.position==='dorsum'),[x,y]=s.normalized;
  const poly=[{x:x-.001,y:y-.001},{x:x+.001,y:y-.001},{x,y:y+.001}];assert.equal(g.validatePolygon(poly,b).ok,true);}
});
test('V6.5 hand coordinates survive 320/375/430 screens, full/focus/reset without changing their identity',()=>{
 for(const r of refs.filter(r=>r.expectedSkin))for(const w of [320,375,430]){const m=getBodyModel(r.view),base=coords.fitViewport(w,560,m),p={x:r.normalized[0],y:r.normalized[1]};
  const local={x:Math.max(0,p.x-.08),y:p.y-.06,width:.16,height:.12};for(const v of [base,coords.focusViewport(base,local),coords.resetViewport(base)]){const q=coords.canvasToNormalized(coords.normalizedToCanvas(p,v),v);assert.ok(Math.abs(q.x-p.x)<1e-10&&Math.abs(q.y-p.y)<1e-10);}}
});
test('V6.5 actual composite hand paths draw selected/all through unchanged renderer and restore canvas state',()=>{
 for(const view of ['front','back']){const m=getBodyModel(view),t=coords.fitViewport(375,560,m),hand=R.filter(r=>r.view===view&&r.id.includes('-hand-'));
  assert.equal(hand.length,view==='front'?10:12);
  for(const rr of [hand,hand.filter(r=>r.labelId==='C6-C8'),hand.filter(r=>r.labelId==='C8/T1')]){let fills=0,moves=0,depth=0;const c={save(){depth++;},restore(){depth--;},beginPath(){},closePath(){},rect(){},clip(){},moveTo(){moves++;},lineTo(){},fill(){fills++;},stroke(){},setLineDash(){}};
   drawAtlas(c,t,m,{atlasId:M.atlasId,atlasVersion:M.atlasVersion,templateId:m.id,templateVersion:m.version,geometryId:m.geometryId,view,regions:rr,showLabels:false});
   assert.equal(fills,rr.reduce((s,r)=>s+r.geometry.coordinates.length,0));assert.equal(moves,rr.reduce((s,r)=>s+r.geometry.coordinates.reduce((s,p)=>s+p.length,0),0));assert.equal(depth,0);}
 }
});
test('V6.5 retired palms have no route, canvas, runtime assets or registry; soles remain independent',()=>{
 const mp=path.join(root,'miniprogram'),app=JSON.parse(fs.readFileSync(path.join(mp,'app.json')));assert.ok(!app.pages.includes('pages/palm/palm'));assert.ok(app.pages.includes('pages/local-surface/local-surface'));
 for(const p of ['pages/palm','assets/palm','components/palm-canvas','data/palm-models.ts','state/palm-session.ts'])assert.ok(!fs.existsSync(path.join(mp,p)),p);
 const local=load('data/local-models.js');for(const id of ['palm-left','palm-right'])assert.throws(()=>local.getLocalModel(id));
 for(const id of ['sole-left','sole-right']){const m=local.getLocalModel(id);assert.equal(m.view,id);assert.notEqual(m.id,M.templateId);}
 const ui=fs.readFileSync(path.join(mp,'pages/special-parts/special-parts.wxml'),'utf8');assert.doesNotMatch(ui,/左手掌|右手掌|palm-left|palm-right/);assert.match(ui,/左脚底/);assert.match(ui,/右脚底/);
});
