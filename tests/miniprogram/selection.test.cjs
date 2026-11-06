const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {getBodyModel}=read('data/body-models.js');
let page;global.Page=o=>{page=o;};read('pages/select/select.js');
function harness(){global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:"develop"}})};const p={data:structuredClone(page.data),setData(c){Object.assign(this.data,c);}};
 for(const[k,v]of Object.entries(page))if(typeof v==='function')p[k]=v.bind(p);return p;}
function probe(status='unique',ids=['front-chest'],view='front') {const m=getBodyModel(view);
 return {detail:{status,regionIds:ids,view,modelId:m.id,modelVersion:m.version}};}
const event=dataset=>({currentTarget:{dataset}});
test('初始无默认选择、不可放大；人体唯一命中只高亮，确认后才进入focused',()=>{
 const p=harness();assert.equal(p.data.mode,'overview');assert.equal(p.data.selectedRegion,'');
 p.zoomIn();assert.equal(p.data.zoomRegion,'');p.onRegionProbe(probe());
 assert.equal(p.data.selectedRegion,'front-chest');assert.equal(p.data.zoomRegion,'');assert.equal(p.data.mode,'overview');
 p.zoomIn();assert.equal(p.data.mode,'focused');assert.equal(p.data.zoomRegion,'front-chest');
 p.onRegionProbe(probe('unique',['front-head']));assert.equal(p.data.selectedRegion,'front-chest');
 p.showFullBody();assert.equal(p.data.mode,'overview');assert.equal(p.data.zoomRegion,'');assert.equal(p.data.selectedName,'胸部');
});
test('从列表和人体选中相同状态，focused换部位回overview，取消弹层不改选择/视口',()=>{
 const a=harness(),b=harness();a.onRegionProbe(probe());b.openRegionPicker();b.chooseFromList({detail:{id:'front-chest'}});
 for(const k of ['selectedRegion','selectedName','zoomRegion','mode','sheetOpen'])assert.deepEqual(a.data[k],b.data[k]);
 b.zoomIn();b.openRegionPicker();b.closeRegionPicker();assert.equal(b.data.mode,'focused');assert.equal(b.data.zoomRegion,'front-chest');
 b.openRegionPicker();b.chooseFromList({detail:{id:'front-head'}});assert.equal(b.data.mode,'overview');assert.equal(b.data.zoomRegion,'');
 assert.equal(b.data.sheetOpen,false);assert.equal(b.data.selectedName,'头部');
 b.chooseFromList({detail:{id:'front-neck'}});assert.equal(b.data.selectedName,'头部');
});
test('人体外/未配置保留原选择并提示；边界弹候选，取消不抢占，候选选中后不放大',()=>{
 const p=harness();p.onRegionProbe(probe());
 for(const status of ['outside-body','outside-model','unconfigured','unavailable']){
  p.onRegionProbe(probe(status,[]));assert.equal(p.data.selectedRegion,'front-chest');assert.ok(p.data.selectionMessage);
 }
 assert.equal(p.data.sheetOpen,false);
 p.onRegionProbe(probe('unconfigured',[]));assert.equal(p.data.selectionMessage,'该位置暂未配置区域，可从列表选择');
 p.onRegionProbe(probe('ambiguous',['front-head','front-neck']));assert.equal(p.data.sheetOpen,true);
 assert.deepEqual(p.data.sheetRegions.map(r=>r.id),['front-head','front-neck']);assert.equal(p.data.selectedRegion,'front-chest');
 p.closeRegionPicker();assert.equal(p.data.selectedRegion,'front-chest');
 p.onRegionProbe(probe('ambiguous',['front-head','front-neck']));p.chooseFromList({detail:{id:'front-neck'}});
 assert.equal(p.data.selectedRegion,'front-neck');assert.equal(p.data.zoomRegion,'');
});
test('调试/弹层/说明/错版隔离正常选区，切面清空选择缩放与调试，拒绝跨面列表ID',()=>{
 const p=harness();p.toggleDebug({detail:{value:true}});p.onRegionProbe(probe());assert.equal(p.data.selectedRegion,'');
 p.toggleDebug({detail:{value:false}});p.openRegionPicker();p.onRegionProbe(probe());assert.equal(p.data.selectedRegion,'');
 p.closeRegionPicker();p.data.infoOpen=true;p.onRegionProbe(probe());assert.equal(p.data.selectedRegion,'');p.data.infoOpen=false;
 p.onRegionProbe({detail:Object.assign({},probe().detail,{modelVersion:'bad'})});assert.equal(p.data.selectedRegion,'');
 p.onRegionProbe(probe('unique',['back-upper-back'],'back'));assert.equal(p.data.selectedRegion,'');
 p.onRegionProbe(probe());p.zoomIn();p.switchView(event({view:'back'}));
 assert.equal(p.data.mode,'overview');assert.equal(p.data.selectedRegion,'');assert.equal(p.data.zoomRegion,'');assert.equal(p.data.normalizedX,'—');
 p.openRegionPicker();p.chooseFromList({detail:{id:'front-chest'}});assert.equal(p.data.selectedRegion,'');
 p.chooseFromList({detail:{id:'back-upper-back'}});assert.equal(p.data.selectedName,'上背部');assert.equal(p.data.zoomRegion,'');
});
test('开发调试低干扰入口可关闭并清点；说明是真实许可，不调用未来评估或标注接口',()=>{
 const p=harness();let modal;global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:"develop"}}),getSystemInfoSync:()=>({platform:"devtools"}),showModal:o=>{modal=o;}};
 p.toggleDeveloper();assert.equal(p.data.developerOpen,true);p.toggleDebug({detail:{value:true}});p.toggleDeveloper();
 assert.equal(p.data.developerOpen,false);assert.equal(p.data.debugEnabled,false);assert.equal(p.data.normalizedX,'—');
 p.showSource();assert.equal(p.data.infoOpen,true);assert.match(modal.content,/CC0 1.0/);assert.match(modal.content,/commons.wikimedia.org/);
 modal.complete();assert.equal(p.data.infoOpen,false);
});
test('region-picker只展示配置并发送已知ID，关闭/遮罩不偷偷选择',()=>{
 let picker;global.Component=o=>{picker=o;};read('components/region-picker/region-picker.js');
 const events=[],p={properties:{open:true,regions:getBodyModel('front').regions},triggerEvent:(name,detail)=>events.push({name,detail})};
 for(const[k,v]of Object.entries(picker.methods))p[k]=v.bind(p);
 p.choose(event({id:'back-head'}));assert.equal(events.length,0);p.choose(event({id:'front-neck'}));
 assert.deepEqual(events.pop(),{name:'choose',detail:{id:'front-neck'}});p.stopTouch();assert.equal(events.length,0);
 p.close();assert.deepEqual(events.pop(),{name:'close',detail:undefined});p.properties.open=false;p.choose(event({id:'front-head'}));assert.equal(events.length,0);
});
