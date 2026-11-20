const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('V7.1 main page exposes only the core customer controls',()=>{
  const select=read('miniprogram/pages/select/select.wxml');
  assert.doesNotMatch(select,/神经匹配/);
  assert.doesNotMatch(select,/快捷定位/);
  assert.doesNotMatch(select,/自由标注（无需选择部位）/);
  assert.match(select,/bindtap="startAnnotation"[\s\S]{0,500}?<text class="card-title">手动标注<\/text>/);
  assert.match(select,/bindtap="startAI"[\s\S]{0,500}?<text class="card-title">AI 辅助标注<\/text>/);
  assert.match(select,/bindtap="openSpecialParts">特殊部位/);
  assert.doesNotMatch(select,/bindtap="showSource"/);
  assert.doesNotMatch(select,/bindtap="toggleDeveloper"/);
});

test('V7.1 result filters are conditional and front/back switch is an isolated layer',()=>{
  const wxml=read('miniprogram/packages/clinical/pages/annotate/annotate.wxml');
  const selectCss=read('miniprogram/pages/select/select.wxss');
  const annotateCss=read('miniprogram/packages/clinical/pages/annotate/annotate.wxss');
  const placementCss=read('miniprogram/packages/clinical/pages/placement/placement.wxss');
  assert.match(wxml,/wx:if="\{\{showScopeChoices\}\}"[\s\S]{0,160}?scope-(?:segmented|wrap)/);
  assert.match(wxml,/wx:elif="\{\{showRegionChoices\}\}"[\s\S]{0,160}?scope-(?:segmented|wrap)/);
  assert.match(wxml,/暂无匹配结果/);
  for(const css of [selectCss,annotateCss,placementCss]){
    assert.match(css,/\.stage-switch-row\s*\{[^}]*position:\s*relative[^}]*z-index:\s*\d+/);
    assert.match(css,/\.(?:model-stage|result-stage|body-stage)\s*\{[^}]*(?:z-index:\s*1|overflow:\s*hidden)/);
  }
  // The matching result must keep a real layout width. A zero-width custom
  // component can retain the correct height yet never produce a Canvas frame.
  assert.match(annotateCss,/\.annotate-workspace\s*\{[^}]*width:\s*100%/);
  assert.match(annotateCss,/\.result-stage\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/);
  assert.match(annotateCss,/\.canvas-area\s*\{[^}]*flex:\s*1 1 0[^}]*width:\s*0/);
  assert.match(annotateCss,/\.canvas-area\s*>\s*body-canvas\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
  assert.match(annotateCss,/@media\s*\(min-width:\s*680px\)[\s\S]*?\.result-stage\s*\{[^}]*flex:\s*52 1 0[^}]*width:\s*0/);
});
