// Synthetic geometry and independently hand-calculated expected points; no medical labels.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const g=require(path.join(process.env.DERMATOME_BUILD_DIR,'utils/placement-geometry.js'));
const {getBodyModel}=require(path.join(process.env.DERMATOME_BUILD_DIR,'data/body-models.js'));
const {area,bodyGeometry}=require(path.join(process.env.DERMATOME_BUILD_DIR,'utils/annotation-geometry.js'));
const {fitViewport,focusViewport,normalizedToCanvas,canvasToNormalized}=require(path.join(process.env.DERMATOME_BUILD_DIR,'utils/coordinate.js'));
const model=getBodyModel('front'),P=(x,y)=>({x,y});
const rect=(x0,y0,x1,y1)=>[P(x0,y0),P(x1,y0),P(x1,y1),P(x0,y1),P(x0,y0)];
const raw=polys=>polys.map(poly=>poly.map(r=>r.map(p=>[p.x,p.y])));
const photo=(polys=[[rect(.2,.3,.6,.7)]],width=200,height=100)=>({schema_version:'confirmed-photo-segmentation-v1',confirmed_by_user:true,
 coordinate_space:'photo_oriented_normalized_v1',image:{width,height},geometry:{type:'MultiPolygon',coordinates:raw(polys)}});
const body=polys=>({type:'MultiPolygon',coordinateSpace:'body_template_normalized_v1',coordinates:polys});
const solid=[{outer:rect(0,0,1,1),holes:[]}];
const transform=(patch={})=>({target:{templateId:model.id,templateVersion:model.version,geometryId:model.geometryId,regionSetId:model.regionSetId,view:'front'},
 translation:P(.5,.4),photoCenter:P(80,50),baseScale:2,scale:1,rotationDegrees:0,...patch});
const near=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const filledArea=geometry=>geometry.coordinates.reduce((sum,poly)=>sum+area(poly[0])-poly.slice(1).reduce((v,r)=>v+area(r),0),0);

test('photo preparation copies oriented pixel metric, centers the whole group and does not mutate source',()=>{
 const source=photo(),before=JSON.stringify(source),prepared=g.preparePhotoGeometry(source);
 assert.deepEqual(prepared.center,P(80,50));near(prepared.bounds.x,40);near(prepared.bounds.y,30);near(prepared.bounds.width,80);near(prepared.bounds.height,40);
 assert.equal(prepared.coordinateSpace,'photo_oriented_normalized_v1');assert.equal(prepared.vertexCount,5);
 assert.equal(JSON.stringify(source),before);assert.equal(Object.isFrozen(prepared.polygons[0][0][0]),true);
 source.geometry.coordinates[0][0][0][0]=.1;assert.equal(prepared.polygons[0][0][0].x,.2);
});
for(const [degrees,x,y]of [[0,.3,320/900],[90,.6,280/900],[180,.7,400/900]])test('known photo pixels -> body normalized, angle '+degrees,()=>{
 const result=g.transformPhotoPolygonToBody(g.preparePhotoGeometry(photo()),transform({rotationDegrees:degrees}),model);
 const first=result.coordinates[0][0][0];near(first.x,x);near(first.y,y);assert.equal(result.coordinateSpace,'body_template_normalized_v1');
});
test('equal scale and rotation use original-image aspect and body logical aspect, never normalized-axis stretching',()=>{
 for(const [width,height,lw,lh]of [[200,100,400,900],[100,300,600,600],[2048,512,400,900]]){
  const custom={...model,logicalWidth:lw,logicalHeight:lh};const prepared=g.preparePhotoGeometry(photo([[rect(.2,.2,.4,.4)]],width,height));
  const result=g.transformPhotoPolygonToBody(prepared,transform({photoCenter:prepared.center,baseScale:.5,scale:2,rotationDegrees:90}),custom);
  const [a,b,c]=result.coordinates[0][0];near(Math.hypot((a.x-b.x)*lw,(a.y-b.y)*lh),.2*width,1e-9);
  near(Math.hypot((b.x-c.x)*lw,(b.y-c.y)*lh),.2*height,1e-9);
 }
});
test('combined scale/rotation/translation has independently calculated expected position',()=>{
 const t=transform({photoCenter:P(80,50),baseScale:1,scale:.5,rotationDegrees:90,translation:P(.4,.6)});
 const q=g.transformPhotoPolygonToBody(g.preparePhotoGeometry(photo()),t,model).coordinates[0][0][0];
 // (-40,-20) original px * .5 -> (-20,-10), rotate -> (10,-20), then (160,540) logical anchor.
 near(q.x,170/400);near(q.y,520/900);
});
test('whole MultiPolygon incl tiny piece, holes, ordering and area ratio survives shared similarity transform',()=>{
 const polys=[[rect(.1,.1,.3,.4),rect(.15,.2,.2,.25)],[rect(.6,.6,.8,.8)],[rect(.9,.9,.9001,.9001)]];
 const source=photo(polys,1000,500),original=JSON.stringify(source),prepared=g.preparePhotoGeometry(source);
 const first=g.transformPhotoPolygonToBody(prepared,transform({photoCenter:prepared.center,baseScale:.1}),model);
 const second=g.transformPhotoPolygonToBody(prepared,transform({photoCenter:prepared.center,baseScale:.1,scale:3,rotationDegrees:90}),model);
 assert.deepEqual(second.coordinates.map(p=>p.map(r=>r.length)),[[5,5],[5],[5]]);near(filledArea(second)/filledArea(first),9,1e-7);
 assert.equal(JSON.stringify(source),original);assert.equal(g.validatePlacementGeometry(second,solid).ok,true);
});
test('viewport focus/reset and different screen sizes cannot modify placement coordinates',()=>{
 const geometry=g.transformPhotoPolygonToBody(g.preparePhotoGeometry(photo()),transform(),model),q=geometry.coordinates[0][0][0],serialized=JSON.stringify(geometry);
 for(const [w,h]of [[320,430],[430,600],[768,800]]){
  const full=fitViewport(w,h,model),focus=focusViewport(full,{x:.2,y:.2,width:.6,height:.5});
  for(const viewport of [full,focus]){const displayed=normalizedToCanvas(q,viewport),restored=canvasToNormalized(displayed,viewport);near(restored.x,q.x);near(restored.y,q.y);}
 }
 assert.equal(JSON.stringify(geometry),serialized);
});
test('explicit initial baseline inherits selected view/basis and 100 percent edit scale',()=>{
 for(const view of ['front','back']){const m=getBodyModel(view),r=m.regions[2],prepared=g.preparePhotoGeometry(photo());
  const t=g.initialPlacement(prepared,m,r);assert.equal(t.target.view,view);assert.equal(t.target.templateVersion,m.version);assert.equal(t.scale,1);
  near(t.translation.x,r.bounds.x+r.bounds.width/2);near(t.translation.y,r.bounds.y+r.bounds.height/2);assert.ok(t.baseScale>0);
 }
});
test('bounds and hit tests retain holes and separate components',()=>{
 const geometry=body([[rect(.1,.1,.4,.4),rect(.2,.2,.3,.3)],[rect(.7,.7,.8,.8)]]);
 assert.equal(g.pointInPlacement(P(.15,.15),geometry),true);assert.equal(g.pointInPlacement(P(.25,.25),geometry),false);
 assert.equal(g.pointInPlacement(P(.55,.55),geometry),false);assert.equal(g.pointInPlacement(P(.75,.75),geometry),true);
 assert.equal(g.pointInPlacement(P(.2,.25),geometry),true);near(g.placementBounds(geometry).width,.7);
});
test('invalid photo result, coordinates, ring topology, empty and resource overrun fail explicitly',()=>{
 const inputs=[null,{...photo(),coordinate_space:'body_template_normalized_v1'},{...photo(),confirmed_by_user:false},photo([],100,100),photo(undefined,Infinity,100),photo(undefined,100000,100000)];
 for(const invalid of inputs)assert.throws(()=>g.preparePhotoGeometry(invalid),g.PlacementError);
 for(const ring of [[P(.1,.1),P(.8,.8),P(.1,.8),P(.8,.1),P(.1,.1)],rect(.1,.1,.1,.1),[P(.1,.1),P(.2,.1),P(.3,.1),P(.1,.1)],rect(-.1,.1,.2,.2)])
  assert.throws(()=>g.preparePhotoGeometry(photo([[ring]])),g.PlacementError);
 const bad=photo();bad.geometry.coordinates[0][0][0][0]=NaN;assert.throws(()=>g.preparePhotoGeometry(bad),g.PlacementError);
 const complex=photo([[Array(g.MAX_PLACEMENT_VERTICES+1).fill(P(.2,.2))]]);assert.throws(()=>g.preparePhotoGeometry(complex),e=>e.code==='COMPLEXITY');
});
test('invalid transformations and target binding cannot be silently normalized or adopted',()=>{
 const prepared=g.preparePhotoGeometry(photo());
 for(const patch of [{scale:0},{scale:-1},{scale:.001},{scale:10},{scale:NaN},{rotationDegrees:181},{rotationDegrees:Infinity},{baseScale:0},{translation:P(NaN,0)},{photoCenter:P(201,50)},
  {target:{...transform().target,view:'back'}},{target:{...transform().target,templateVersion:'obsolete'}}])
  assert.throws(()=>g.transformPhotoPolygonToBody(prepared,transform(patch),model),g.PlacementError);
 const outside=g.transformPhotoPolygonToBody(prepared,transform({translation:P(-.5,0)}),model);
 assert.ok(outside.coordinates[0][0][0].x<0);assert.equal(g.validatePlacementGeometry(outside,model).ok,false);
});
test('filled regions outside, bridges across notches and legs fail even when all outer vertices are inside',()=>{
 const notch=[{outer:[P(0,0),P(1,0),P(1,1),P(.6,1),P(.6,.4),P(.4,.4),P(.4,1),P(0,1),P(0,0)],holes:[]}];
 const bridge=body([[rect(.3,.3,.7,.7)]]);assert.equal(g.validatePlacementGeometry(bridge,notch).ok,false);
 const thin=[{outer:[P(0,0),P(1,0),P(1,1),P(.50002,1),P(.50002,.4),P(.5,.4),P(.5,1),P(0,1),P(0,0)],holes:[]}];
 assert.equal(g.validatePlacementGeometry(bridge,thin).ok,false);
 assert.equal(g.validatePlacementGeometry(body([[rect(-.5,-.5,-.3,-.3)]]),solid).ok,false);
 assert.equal(g.validatePlacementGeometry(body([[rect(.8,.8,1.1,1.1)]]),solid).ok,false);
});
test('body hole enclosed in a filled lesion is invalid; lesion hole may cover that excluded body hole',()=>{
 const holed=[{outer:rect(0,0,1,1),holes:[rect(.4,.4,.6,.6)]}];
 assert.equal(g.validatePlacementGeometry(body([[rect(.2,.2,.8,.8)]]),holed).ok,false);
 assert.equal(g.validatePlacementGeometry(body([[rect(.2,.2,.8,.8),rect(.35,.35,.65,.65)]]),holed).ok,true);
 assert.equal(g.validatePlacementGeometry(body([[rect(.2,.2,.8,.8),rect(.4,.4,.6,.6)]]),holed).ok,true);
 // Center-only hole checks would miss covered corners when a smaller lesion hole hides the center.
 assert.equal(g.validatePlacementGeometry(body([[rect(.2,.2,.8,.8),rect(.45,.45,.55,.55)]]),holed).ok,false);
});
test('opposite ring winding, isolated touching components, and island in another polygon hole are valid',()=>{
 for(const reversed of [false,true]){
  const polys=[[rect(.1,.1,.6,.6),rect(.2,.2,.5,.5)],[rect(.3,.3,.4,.4)],[rect(.6,.6,.7,.7)]];
  const geometry=body(reversed?polys.map(poly=>poly.map(r=>[...r].reverse())):polys);
  assert.equal(g.validatePlacementGeometry(geometry,solid).ok,true);
 }
});
test('invalid holes, overlapping components and edge-sharing components are rejected without changing geometry',()=>{
 const cases=[[[rect(.1,.1,.4,.4),rect(.5,.5,.6,.6)]],[[rect(.1,.1,.9,.9),rect(.2,.2,.5,.5),rect(.3,.3,.6,.6)]],
 [[rect(.1,.1,.5,.5)],[rect(.4,.4,.8,.8)]],[[rect(.1,.1,.5,.5)],[rect(.5,.1,.8,.5)]]];
 for(const polys of cases){const geometry=body(polys),before=JSON.stringify(geometry);assert.equal(g.validatePlacementGeometry(geometry,solid).ok,false);assert.equal(JSON.stringify(geometry),before);}
});
test('hole contact topology rejects disconnected interiors but preserves legitimate single/common point contacts',()=>{
 const outer=rect(.2,.2,.8,.8);
 const across=[P(.5,.2),P(.65,.5),P(.5,.8),P(.35,.5),P(.5,.2)];
 assert.equal(g.validatePlacementGeometry(body([[outer,across]]),solid).ok,false);
 const left=[P(.2,.5),P(.35,.35),P(.5,.5),P(.35,.65),P(.2,.5)];
 const right=[P(.5,.5),P(.65,.35),P(.8,.5),P(.65,.65),P(.5,.5)];
 assert.equal(g.validatePlacementGeometry(body([[outer,left,right]]),solid).ok,false);
 const oneContact=[P(.5,.2),P(.65,.4),P(.5,.5),P(.35,.4),P(.5,.2)];
 assert.equal(g.validatePlacementGeometry(body([[outer,oneContact]]),solid).ok,true);
 const common=[
  [P(.5,.5),P(.3,.3),P(.5,.3),P(.5,.5)],
  [P(.5,.5),P(.7,.3),P(.7,.5),P(.5,.5)],
  [P(.5,.5),P(.7,.7),P(.5,.7),P(.5,.5)],
 ];
 assert.equal(g.validatePlacementGeometry(body([[rect(.15,.15,.85,.85),...common]]),solid).ok,true);
});
test('tiny valid pieces are preserved, numerical body edge does not expand to hide real outside area',()=>{
 assert.equal(g.validatePlacementGeometry(body([[rect(.2,.2,.2000001,.2000001)]]),solid).ok,true);
 assert.equal(g.validatePlacementGeometry(body([[rect(0,.2,.3,.4)]]),solid).ok,true);
 assert.equal(g.validatePlacementGeometry(body([[rect(-1e-6,.2,.3,.4)]]),solid).ok,false);
});
test('actual front and back body reject arm/torso air bridge and legs gap, accept central chest/back',()=>{
 const fixture=require('../../backend/tests/fixtures/synthetic-annotation-geometry.json');
 for(const view of ['front','back']){const m=getBodyModel(view),b=bodyGeometry(m);
  for(const key of ['UI-A','UI-B']){const r=fixture.editor[key];assert.equal(g.validatePlacementGeometry(body([[[...r,r[0]]]]),b).ok,true,view+key);}
  const r=fixture.editor['UI-gap'];assert.equal(g.validatePlacementGeometry(body([[[...r,r[0]]]]),m).ok,false,view+' gap');
 }
});
