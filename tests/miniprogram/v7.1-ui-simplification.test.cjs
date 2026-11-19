const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('V7.1 main page exposes only the core customer controls',()=>{
  const select=read('miniprogram/pages/select/select.wxml');
  assert.doesNotMatch(select,/神经匹配/);
  assert.doesNotMatch(select,/快捷定位/);
  assert.doesNotMatch(select,/自由标注（无需选择部位）/);
  assert.match(select,/bindtap="startAnnotation"[^>]*>手动标注/);
  assert.match(select,/bindtap="startAI"[^>]*>AI 辅助标注/);
  assert.match(select,/bindtap="openSpecialParts">特殊部位/);
  assert.doesNotMatch(select,/bindtap="showSource"/);
  assert.doesNotMatch(select,/bindtap="toggleDeveloper"/);
});

test('V7.1 result filters are conditional and front/back switch is an isolated layer',()=>{
  const wxml=read('miniprogram/packages/clinical/pages/annotate/annotate.wxml');
  const selectCss=read('miniprogram/pages/select/select.wxss');
  const annotateCss=read('miniprogram/packages/clinical/pages/annotate/annotate.wxss');
  const placementCss=read('miniprogram/packages/clinical/pages/placement/placement.wxss');
  assert.match(wxml,/wx:if="\{\{showScopeChoices\}\}"[^>]*scope-row/);
  assert.match(wxml,/wx:elif="\{\{showRegionChoices\}\}"[^>]*scope-row/);
  assert.match(wxml,/暂无匹配结果/);
  for(const css of [selectCss,annotateCss,placementCss]){
    assert.match(css,/\.(?:view-switch|switch-row)\{[^}]*position:relative[^}]*z-index:[56]/);
    assert.match(css,/\.(?:model-stage|result-stage|body-stage)\{[^}]*(?:z-index:1|overflow:hidden)/);
  }
  // The matching result must keep a real layout width. A zero-width custom
  // component can retain the correct height yet never produce a Canvas frame.
  assert.match(annotateCss,/\.p9-split\{[^}]*width:100%/);
  assert.match(annotateCss,/\.result-stage\{[^}]*width:100%[^}]*min-width:0/);
  assert.match(annotateCss,/\.canvas-area\{[^}]*flex:1 1 0[^}]*width:auto/);
  assert.match(annotateCss,/\.canvas-area>body-canvas\{[^}]*width:100%[^}]*height:100%/);
  assert.match(annotateCss,/@media \(min-width:680px\)[\s\S]*?\.annotation-page \.result-stage\{[^}]*flex:5 1 0[^}]*width:0/);
});
