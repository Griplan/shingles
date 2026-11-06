// Regression: Gray1237.png is captioned LEFT palm. Fingers up, palm toward viewer:
// thumb on screen-left = left hand; the old implementation incorrectly overrode the source caption.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pngAlpha}=require('./helpers/png-alpha.cjs');
const root=path.resolve(__dirname,'../..'),load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {getPalmModel}=load('data/palm-models.js'),{pointInBody}=load('utils/annotation-geometry.js');
const {PalmSessionStore,palmToken}=load('state/palm-session.js');
const {palmSnapshotKey}=load('state/palm-matching-session.js');
test('source LEFT palm stays unmirrored; mirrored resource is RIGHT palm with correct web cleft',()=>{
 const source=JSON.parse(fs.readFileSync(path.join(root,'data/body/palm-resource.json')));
 assert.equal(source.views['palm-left'].mirroredFrom,null);assert.equal(source.views['palm-right'].mirroredFrom,'palm-left');
 assert.equal(source.views['palm-left'].thumbScreenSide,'left');assert.equal(source.views['palm-right'].thumbScreenSide,'right');
 const left=getPalmModel('palm-left'),right=getPalmModel('palm-right');
 const a=pngAlpha(path.join(root,'miniprogram',left.imagePath)),b=pngAlpha(path.join(root,'miniprogram',right.imagePath));
 // Visible thumb/index web at x=.28 for the ORIGINAL left palm; opposite right view at x=.72.
 for(const[m,png,gap,skin]of [[left,a,.28,.72],[right,b,.72,.28]]){
  assert.equal(png.at(Math.round(gap*png.w),Math.round(.45*png.h)),0);
  assert.equal(png.at(Math.round(skin*png.w),Math.round(.45*png.h)),255);
  assert.equal(pointInBody({x:gap,y:.45},m.body),false);assert.equal(pointInBody({x:skin,y:.45},m.body),true);
 }
 const svg=fs.readFileSync(path.join(root,'miniprogram',left.sourcePath),'utf8');
 assert.match(svg,/matrix\(1 0 0 1 0 0\)/);assert.doesNotMatch(svg,/matrix\(-1 0 0 1 440 0\)/);
 assert.match(fs.readFileSync(path.join(root,'miniprogram',right.sourcePath),'utf8'),/matrix\(-1 0 0 1 440 0\)/);
});
test('corrected template refuses reversed 1.0.0 session without moving or relabeling saved geometry',()=>{
 const current=getPalmModel('palm-left');let active={...current,version:'1.0.0',geometryId:'commons-palm-outline-v1',regionSetId:'commons-palm-ui-v1',atlas:{...current.atlas,identity:{...current.atlas.identity,template_version:'1.0.0',geometry_id:'commons-palm-outline-v1',region_set_id:'commons-palm-ui-v1',atlas_version:'palm-dermatomes-preview.1'}}};
 const store=new PalmSessionStore(()=>active);let s=store.open('palm-left').session;
 for(const p of [{x:.5,y:.6},{x:.6,y:.6},{x:.55,y:.7}]){const out=store.dispatch(palmToken(s),{type:'add',point:p});assert.equal(out.ok,true);s=out.session;}
 s=store.dispatch(palmToken(s),{type:'close'}).session;const saved=JSON.stringify(s);active=current;
 assert.equal(current.version,'1.1.0');assert.equal(current.geometryId,'commons-palm-outline-v2');
 assert.equal(store.open('palm-left').ok,false);assert.equal(store.read('palm-left',s.sessionId).ok,false);assert.equal(JSON.stringify(store.snapshot('palm-left')),saved);
 assert.throws(()=>palmSnapshotKey(s,current));
});
