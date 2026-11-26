const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {AIPhotoFlow}=load('packages/clinical/state/ai-session.js'),{PHOTO_SPACE}=load('types/ai.js');
const {usablePhotoBox}=load('utils/photo-coordinate.js');
const box={xMin:.1,yMin:.2,xMax:.7,yMax:.8};
const changed={xMin:.2,yMin:.3,xMax:.6,yMax:.7};
const latest={xMin:.3,yMin:.4,xMax:.65,yMax:.75};
const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const session=id=>({session_id:id,session_token:'test-only',photo_id:'photo'+id,expires_at:Date.now()/1000+1000,image:{width:700,height:460,oriented_rgb_sha256:id},localPhoto:id+'.png'});
const candidate=(i,status='ok')=>({candidate_id:'candidate-'+i,status,area_ratio:.2,outside_box_ratio:0,component_count:2,hole_count:1,warnings:[]});
const response=(s,rev,id)=>({session_id:s.session_id,photo_id:s.photo_id,result_id:'r'+id,request_id:id,prompt_revision:rev,coordinate_space:PHOTO_SPACE,status:'needs_confirmation',candidates:[candidate(0),candidate(1),candidate(2)]});
function fixture(){const calls=[],confirms=[],forgot=[],removed=[];
 const api={open:async id=>session(id),segment:async(s,p,rev,id)=>{calls.push({s,p:structuredClone(p),rev,id});return response(s,rev,id)},asset:async(s,id,r)=>s.photo_id+id+r,
 confirm:async(s,r,id)=>{confirms.push(id);return {schema_version:'confirmed-photo-segmentation-v1',session_id:s.session_id,photo_id:s.photo_id,result_id:r.result_id,candidate_id:id,prompt_revision:r.prompt_revision,coordinate_space:PHOTO_SPACE,confirmed_by_user:true,confirmed_at:Date.now()/1000-1,expires_at:s.expires_at,image:s.image,model:{name:'synthetic-fixture'},prompts:{coordinate_space:PHOTO_SPACE,points:[],box:null},mask_asset:'candidate-0.png',mask_sha256:'b'.repeat(64),geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[1,0],[1,1],[0,0]],[[.2,.2],[.3,.2],[.3,.3],[.2,.2]]],[[[.1,.7],[.2,.7],[.2,.8],[.1,.7]]]]}}},
 remove:async s=>removed.push(s.session_id),forget:p=>forgot.push(p)};
 return {api,calls,confirms,forgot,removed,f:new AIPhotoFlow(api,()=>{})};
}
test('effective released box triggers one inference; duplicate and tiny/nonfinite boxes do not',async()=>{
 const v=fixture();await v.f.replace('A');
 for(const b of [{...box,xMax:.105},{...box,yMax:.201},{xMin:.1,yMin:.1,xMax:.12,yMax:.12},{...box,xMin:NaN},{...box,xMin:-.1}]){assert.equal(usablePhotoBox(b),false);await v.f.selectBox(b);}
 assert.equal(v.calls.length,0);await Promise.all([v.f.selectBox(box),v.f.selectBox({...box})]);
 assert.equal(v.calls.length,1);assert.equal(v.f.canConfirm(),true);assert.equal(v.f.confirmed,null);
 await v.f.selectBox(box);assert.equal(v.calls.length,1);
});
test('latest replacement box waits for active request, intermediate boxes coalesced',async()=>{
 const v=fixture(),hold=deferred();await v.f.replace('A');const normal=v.api.segment;
 v.api.segment=async(...args)=>{const r=await normal(...args);if(v.calls.length===1){await hold.promise;}return r;};
 const work=v.f.selectBox(box);await flush();v.f.selectBox(changed);v.f.selectBox(latest);v.f.selectBox(latest);
 assert.equal(v.calls.length,1);assert.equal(v.f.session.localPhoto,'A.png');assert.equal(v.f.phase,'segmenting');assert.equal(v.f.maskPath,'');
 hold.resolve();await work;assert.equal(v.calls.length,2);assert.deepEqual(v.calls[1].p.box,latest);assert.equal(v.f.result.prompt_revision,v.f.revision);
});
test('changing photo while auto analysis runs keeps only B prompts and B result',async()=>{
 const v=fixture(),hold=deferred();await v.f.replace('A');const normal=v.api.segment;
 v.api.segment=async(...args)=>{const r=await normal(...args);if(args[0].session_id==='A')await hold.promise;return r;};
 const work=v.f.selectBox(box);await flush();v.f.selectBox(changed);await v.f.replace('B');v.f.selectBox(latest);
 assert.equal(v.f.maskPath,'');assert.equal(v.f.session.localPhoto,'B.png');hold.resolve();await work;
 assert.deepEqual(v.calls.map(c=>c.s.session_id),['A','B']);assert.deepEqual(v.calls[1].p.box,latest);assert.equal(v.f.result.photo_id,'photoB');assert.ok(v.removed.includes('A'));
});
test('reset or cancel removes queued auto request and late mask',async()=>{
 for(const action of ['reset','cancel']){const v=fixture(),hold=deferred();await v.f.replace('A');const normal=v.api.segment;
 v.api.segment=async(...args)=>{const r=await normal(...args);await hold.promise;return r;};
 const work=v.f.selectBox(box);v.f.selectBox(changed);await v.f[action]();hold.resolve();await work;
 assert.equal(v.calls.length,1);assert.equal(v.f.result,null);assert.equal(v.f.maskPath,'');assert.equal(v.f.prompts.box,null);
 }
});
test('preview keeps the old frame while loading but blocks confirmation until the new candidate arrives',async()=>{
 const v=fixture(),hold=deferred();await v.f.replace('A');await v.f.selectBox(box);const before=v.f.maskPath;
 v.api.asset=()=>hold.promise;const work=v.f.preview('candidate-1');assert.equal(v.f.maskPath,before);assert.equal(v.f.previewing,true);
 await v.f.confirm();assert.equal(v.confirms.length,0);hold.resolve('second.png');await work;
 assert.equal(v.f.maskPath,'second.png');assert.equal(v.f.previewing,false);await v.f.confirm();assert.deepEqual(v.confirms,['candidate-1']);
 assert.equal(v.f.confirmed.geometry.coordinates.length,2);assert.equal(v.f.confirmed.geometry.coordinates[0].length,2);
});
test('default preview skips unusable candidates without deleting their source records or ranking scores',async()=>{
 const v=fixture();await v.f.replace('A');v.api.segment=async(s,p,rev,id)=>({...response(s,rev,id),candidates:[candidate(0,'empty_mask'),candidate(1),candidate(2,'contour_failed')]});
 await v.f.selectBox(box);assert.equal(v.f.selected,'candidate-1');assert.equal(v.f.result.candidates.length,3);assert.equal(v.f.confirmed,null);
});
test('all candidates unusable -> explicit failure; reselect can retry the same location',async()=>{
 const v=fixture();await v.f.replace('A');v.api.segment=async(s,p,rev,id)=>({...response(s,rev,id),candidates:[candidate(0,'empty_mask'),candidate(1,'contour_failed')]});
 await v.f.selectBox(box);assert.match(v.f.error,/轮廓提取失败，请重新圈选/);assert.equal(v.f.canConfirm(),false);assert.equal(v.f.maskPath,'');
 v.f.reset();v.api.segment=async(s,p,rev,id)=>response(s,rev,id);await v.f.selectBox(box);assert.equal(v.f.canConfirm(),true);
});
let definition;global.Page=o=>definition=o;load('packages/clinical/pages/ai-annotate/ai-annotate.js');
function pageFixture(t){const v=fixture();Object.assign(load('services/ai.js').aiTransport,v.api);let path='A';const navigation=[];
 global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getSystemInfoSync:()=>({platform:'devtools'}),nextTick:f=>queueMicrotask(f),
 showModal:o=>o.success?.({confirm:true}),getFileSystemManager:()=>({stat:o=>o.success({stats:{size:16,isFile:()=>true}}),readFile:o=>o.success({data:Uint8Array.of(255,216,255,...Array(13).fill(0)).buffer})}),
 getImageInfo:o=>o.success({width:100,height:100,orientation:"up"}),chooseMedia:o=>o.success({tempFiles:[{size:10,tempFilePath:path}]}),showToast:()=>{},navigateBack:()=>navigation.push('back')};
 const p={data:structuredClone(definition.data),setData(c){Object.assign(this.data,c)}};
 for(const[k,f]of Object.entries(definition))if(typeof f==='function')p[k]=f.bind(p);
 p.onLoad({view:'front',region:'front-chest'});t.after(()=>p.onUnload());
 return {...v,p,navigation,choose:async id=>{path=id;p.choosePhoto('album');await flush();}};
}
test('page upload -> auto box -> cycle -> explicit confirmation; no manual segment control',async t=>{
 const v=pageFixture(t),p=v.p;await v.choose('A');assert.equal(p.data.mode,'box');assert.equal(p.data.adjusting,false);assert.equal(p.data.selecting,true);
 p.onPrompt({detail:{box,point:null}});await flush();assert.equal(v.calls.length,1);assert.equal(p.data.hasResult,true);assert.equal(p.data.selecting,false);assert.equal(v.confirms.length,0);
 p.nextResult();await flush();assert.equal(v.calls.length,1);assert.equal(v.confirms.length,0);assert.match(p.data.mask,/candidate-1/);
 p.confirm();await flush();assert.equal(v.confirms.length,0); // actual canvas must acknowledge current frame
 p.renderState({detail:{source:p.data.photo,mask:p.data.mask,ready:true}});await flush();p.confirm();await flush();
 assert.equal(p.data.phase,'confirmed');assert.deepEqual(v.confirms,['candidate-1']);
 assert.equal(p.data.hasPendingPlacement,false,'invalid placement geometry cannot create a draft');
 assert.deepEqual(v.removed,[],'keep the backend photo if draft preparation fails');
});
test('confirmation releases the backend photo before navigation and keeps the self-contained draft',async t=>{
 const v=pageFixture(t),p=v.p,transport=load('services/ai.js').aiTransport;
 const deletion=deferred();
 transport.remove=async s=>{v.removed.push(s.session_id);await deletion.promise;};
 transport.confirm=async(s,r,id)=>({schema_version:'confirmed-photo-segmentation-v1',session_id:s.session_id,photo_id:s.photo_id,result_id:r.result_id,candidate_id:id,
  prompt_revision:r.prompt_revision,coordinate_space:PHOTO_SPACE,confirmed_by_user:true,confirmed_at:Date.now()/1000-1,expires_at:s.expires_at,image:s.image,
  model:{name:'synthetic-fixture'},prompts:{coordinate_space:PHOTO_SPACE,points:[],box:null},mask_asset:'candidate-0.png',mask_sha256:'b'.repeat(64),
  geometry:{type:'MultiPolygon',coordinates:[[[[.2,.3],[.6,.3],[.6,.7],[.2,.7],[.2,.3]]]]}});
 await v.choose('A');p.onPrompt({detail:{box,point:null}});await flush();
 p.renderState({detail:{source:p.data.photo,mask:p.data.mask,ready:true}});await flush();p.confirm();await flush();
 assert.deepEqual(v.removed,['A'],'delete starts at confirmation before navigation');
 let url='';global.wx.navigateTo=o=>{url=o.url;o.success?.();};
 p.placeOnBody();await flush();
 assert.match(url,/packages\/clinical\/pages\/placement\/placement\?draftId=/);assert.deepEqual(v.removed,['A']);
 const id=decodeURIComponent(url.split('draftId=')[1]),draft=load('packages/clinical/state/placement-session.js').placementSession.read(id);
 assert.equal(draft.ok,true,draft.message);assert.equal(draft.draft.sourceDetached,true);
 assert.equal(p.data.photo,'A.png','local preview remains available if the user returns');
 assert.equal(p.data.phase,'confirmed');assert.equal(p.data.hasPendingPlacement,true);
 deletion.resolve();await flush();
});
test('failed placement navigation retries from a detached draft after deleting the server photo',async t=>{
 const v=pageFixture(t),p=v.p,transport=load('services/ai.js').aiTransport;
 transport.confirm=async(s,r,id)=>({schema_version:'confirmed-photo-segmentation-v1',session_id:s.session_id,photo_id:s.photo_id,result_id:r.result_id,candidate_id:id,
  prompt_revision:r.prompt_revision,coordinate_space:PHOTO_SPACE,confirmed_by_user:true,confirmed_at:Date.now()/1000-1,expires_at:s.expires_at,image:s.image,
  model:{name:'synthetic-fixture'},prompts:{coordinate_space:PHOTO_SPACE,points:[],box:null},mask_asset:'candidate-0.png',mask_sha256:'b'.repeat(64),
  geometry:{type:'MultiPolygon',coordinates:[[[[.2,.3],[.6,.3],[.6,.7],[.2,.7],[.2,.3]]]]}});
 await v.choose('A');p.onPrompt({detail:{box,point:null}});await flush();
 p.renderState({detail:{source:p.data.photo,mask:p.data.mask,ready:true}});await flush();p.confirm();await flush();
 let id='';global.wx.navigateTo=o=>{id=decodeURIComponent(o.url.split('draftId=')[1]);o.fail?.({});};
 p.placeOnBody();await flush();
 assert.deepEqual(v.removed,['A']);assert.match(p.data.error,/放置草稿仍保留/);assert.equal(p.data.openingPlacement,false);
 const draft=load('packages/clinical/state/placement-session.js').placementSession.read(id);
 assert.equal(draft.ok,true,draft.message);assert.equal(draft.draft.sourceDetached,true);
 let replay='';global.wx.navigateTo=o=>{replay=decodeURIComponent(o.url.split('draftId=')[1]);o.success?.();};
 await p.placeOnBody();
 assert.equal(replay,id);assert.deepEqual(v.removed,['A']);
});
test('fine adjustment is opt-in; foreground/background/undo and manual refine stay available',async t=>{
 const v=pageFixture(t),p=v.p;await v.choose('A');p.openAdjustment();assert.equal(p.data.adjusting,false);
 p.onPrompt({detail:{box,point:null}});await flush();p.openAdjustment();assert.equal(p.data.adjusting,true);
 p.onPrompt({detail:{box:null,point:{x:.4,y:.4,label:1}}});p.setMode({currentTarget:{dataset:{mode:'background'}}});p.onPrompt({detail:{box:null,point:{x:.8,y:.8,label:0}}});
 assert.equal(p.data.points.length,2);assert.equal(v.calls.length,1);p.undo();assert.equal(p.data.points.length,1);
 p.onPrompt({detail:{box:null,point:{x:.8,y:.8,label:0}}});p.refine();await flush();assert.equal(v.calls.length,2);assert.equal(v.calls[1].p.points.length,2);assert.equal(p.data.adjusting,false);assert.equal(p.data.hasResult,true);
 p.reselect();assert.equal(p.data.points.length,0);assert.equal(p.data.mask,'');assert.equal(p.data.selecting,true);
});
test('failed auto request retains photo and supports reselect or manual return',async t=>{
 const v=pageFixture(t),p=v.p;await v.choose('A');load('services/ai.js').aiTransport.segment=async()=>{throw Error('模型暂不可用')};
 p.onPrompt({detail:{box,point:null}});await flush();assert.equal(p.data.photo,'A.png');assert.equal(p.data.failed,true);assert.equal(p.data.hasResult,false);
 p.openAdjustment();assert.equal(p.data.adjusting,false);p.reselect();assert.equal(p.data.failed,false);assert.equal(p.data.selecting,true);
 p.backManual();await flush();assert.deepEqual(v.navigation,['back']);assert.ok(v.removed.includes('A'));
});
test('new photo resets result, fine controls and mode',async t=>{
 const v=pageFixture(t),p=v.p;await v.choose('A');p.onPrompt({detail:{box,point:null}});await flush();p.openAdjustment();
 await v.choose('B');assert.equal(p.data.photo,'B.png');assert.equal(p.data.mask,'');assert.equal(p.data.hasResult,false);assert.equal(p.data.adjusting,false);assert.equal(p.data.mode,'box');assert.equal(p.data.selecting,true);
});

function editable(v){const edits=[];v.api.edit=async(s,r,id,revision,strokes)=>{edits.push({id,revision,strokes:structuredClone(strokes)});return {session_id:s.session_id,photo_id:s.photo_id,result_id:r.result_id,prompt_revision:r.prompt_revision,coordinate_space:PHOTO_SPACE,candidate:{...candidate(+id.slice(-1)),edit_revision:revision}}};
 const confirm=v.api.confirm;v.api.confirm=async(s,r,id,revision)=>({...await confirm(s,r,id),correction:revision?{edit_revision:revision}:null});
 v.api.asset=async(s,id,r,revision)=>`${s.photo_id}-${id}-${revision}.png`;return edits;}
const brush={mode:'erase',radius:.02,points:[{x:.3,y:.4},{x:.4,y:.5}]};
test('prompt-adherence priority controls preview; confirmation remains explicit',async()=>{
 const v=fixture();v.api.segment=async(s,p,rev,id)=>({...response(s,rev,id),candidates:[{...candidate(0),display_priority:2},{...candidate(1),display_priority:0},{...candidate(2),display_priority:1}]});
 await v.f.replace('A');await v.f.selectBox(box);assert.equal(v.f.selected,'candidate-1');assert.equal(v.f.confirmed,null);
});
test('brush applies authoritative mask, replays undo and restore; explicit confirmation retains holes',async()=>{
 const v=fixture(),edits=editable(v);await v.f.replace('A');await v.f.selectBox(box);const hold=deferred(),edit=v.api.edit,before=v.f.maskPath;
 v.api.edit=async(...args)=>{await hold.promise;return edit(...args)};const work=v.f.brush(brush);
 assert.equal(v.f.phase,'correcting');assert.equal(v.f.maskPath,before);assert.equal(v.f.session.localPhoto,'A.png');assert.equal(v.f.canConfirm(),false);
 hold.resolve();await work;assert.match(v.f.maskPath,/-1.png$/);assert.equal(v.f.canConfirm(),true);
 await v.f.brush({...brush,mode:'add'});await v.f.undoBrush();assert.deepEqual(edits.map(e=>e.strokes.length),[1,2,1]);
 await v.f.confirm();assert.equal(v.f.confirmed.correction.edit_revision,3);assert.equal(v.f.confirmed.geometry.coordinates[0].length,2);
});
test('brush timeout blocks confirmation/candidate switching; retry same revision or restore higher revision',async()=>{
 for(const action of ['retryBrush','restoreBrush']){const v=fixture(),edits=editable(v);await v.f.replace('A');await v.f.selectBox(box);const edit=v.api.edit;
 v.api.edit=async(...args)=>{await edit(...args);throw Error('请求超时')};await v.f.brush(brush);assert.equal(v.f.canConfirm(),false);assert.equal(v.f.pendingCorrection.revision,1);
 await v.f.preview('candidate-1');assert.equal(v.f.selected,'candidate-0');await v.f.confirm();assert.equal(v.confirms.length,0);
 v.api.edit=edit;await v.f[action]();assert.equal(v.f.pendingCorrection,null);assert.equal(v.f.canConfirm(),true);
 assert.equal(edits[1].revision,action==='retryBrush'?1:2);assert.equal(edits[1].strokes.length,action==='retryBrush'?1:0);}
});
test('late brush A cannot modify photo B or its candidate; malformed edit/confirmation revisions fail',async()=>{
 const v=fixture();editable(v);await v.f.replace('A');await v.f.selectBox(box);const hold=deferred(),edit=v.api.edit;
 v.api.edit=async(...args)=>{await hold.promise;return edit(...args)};const work=v.f.brush(brush);await v.f.replace('B');await v.f.selectBox(box);const pathB=v.f.maskPath;
 hold.resolve();await work;assert.equal(v.f.maskPath,pathB);assert.equal(v.f.corrections.size,0);
 v.api.edit=async(...args)=>{const r=await edit(...args);r.candidate.edit_revision++;return r};await v.f.brush(brush);assert.equal(v.f.canConfirm(),false);
 v.api.edit=edit;await v.f.restoreBrush();v.api.confirm=async(...args)=>{const r=await fixture().api.confirm(...args);return {...r,correction:{edit_revision:999}}};
 await v.f.confirm();assert.equal(v.f.phase,'ready');assert.equal(v.f.confirmed,null);
});
test('additional ROI performs real segment request; full-image fallback explicit and incompatible with multiple boxes',async()=>{
 const v=fixture();await v.f.replace('A');await v.f.selectBox(box);await v.f.changeStrategy();assert.equal(v.f.strategy,'full_image');
 await v.f.addBox(changed);assert.equal(v.f.strategy,'context_crop');assert.deepEqual(v.calls.at(-1).p.additional_boxes,[changed]);const n=v.calls.length;
 await v.f.changeStrategy();assert.equal(v.calls.length,n);assert.match(v.f.error,/多处圈选/);await v.f.replace('B');assert.equal(v.f.strategy,'context_crop');assert.equal(v.f.prompts.additional_boxes,undefined);
});
test('page brush is optional, canvas acknowledgment required; correction can return to normal confirm',async t=>{
 const v=pageFixture(t);const edits=editable(v);Object.assign(load('services/ai.js').aiTransport,v.api);
 await v.choose('A');v.p.onPrompt({detail:{box,point:null}});await flush();v.p.openBrush();assert.equal(v.p.data.editingMask,true);assert.equal(v.p.data.mode,'paint-erase');
 v.p.onStroke({detail:brush});await flush();assert.equal(edits.length,1);v.p.confirm();assert.equal(v.confirms.length,0);
 v.p.renderState({detail:{source:v.p.data.photo,mask:v.p.data.mask,ready:true}});await flush();v.p.finishBrush();assert.equal(v.p.data.editingMask,false);
 v.p.confirm();await flush();assert.equal(v.p.data.phase,'confirmed');
});
