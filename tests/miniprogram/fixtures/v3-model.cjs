// V1.2 historical fixture. Active V1.3 is tested separately; do not assert v3 is still active.
const path=require('node:path');
const read=f=>require(path.join(process.env.DERMATOME_BUILD_DIR,f));
const {FRONT_VISUAL,BACK_VISUAL,GEOMETRY_ID}=read('assets/body/neutral-v3.js');
const {BODY_REGIONS,BODY_REGION_SET_ID}=read('data/body-regions-v3.js');
const {flattenOutline}=read('utils/body-path.js');
const model=view=>{const visual=view==='front'?FRONT_VISUAL:BACK_VISUAL;return Object.freeze({
 id:'neutral-body-v3',version:'3.0.0',geometryId:GEOMETRY_ID,view,logicalWidth:400,logicalHeight:900,
 visual,regionSetId:BODY_REGION_SET_ID,regionGeometryId:GEOMETRY_ID,regions:BODY_REGIONS[view],hitOutline:flattenOutline(visual.outline)});};
const BODY_MODELS={front:model('front'),back:model('back')};
module.exports={BODY_MODELS,getBodyModel:view=>BODY_MODELS[view]};
