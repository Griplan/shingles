// Offline SVG exports, not WeChat screenshots. Use the existing Sharp installation.
const path=require('node:path'),fs=require('node:fs');
const sharp=require(process.env.DERMATOME_SHARP_MODULE||'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/validation-records/v6.6-axilla/evidence');
(async()=>{
 for(const side of ['left','right'])await sharp(path.join(root,`miniprogram/assets/axilla/axilla-${side}.svg`),{density:144}).png().toFile(path.join(root,`miniprogram/assets/axilla/axilla-${side}.png`));
 for(const name of ['models','annotation-unconfigured','goran-axilla-original','goran-source-curves','trace-comparison']){
  const file=path.join(out,name+'.svg');if(fs.existsSync(file))await sharp(file).png().toFile(path.join(out,name+'.png'));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
