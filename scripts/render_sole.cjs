// Explicit existing sharp dependency; SVG editing sources remain lossless.
const path=require('node:path');
const sharp=require(process.env.DERMATOME_SHARP_MODULE||'sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
 for(const side of ['left','right'])await sharp(path.join(root,`miniprogram/assets/sole/sole-${side}.svg`),{density:144}).png({palette:true,colours:128,dither:.2,effort:10}).toFile(path.join(root,`miniprogram/assets/sole/sole-${side}.png`));
 for(const name of ['models','atlas','L5','S1'])await sharp(path.join(root,`docs/validation-records/v6.4/${name}.svg`),{density:120}).png().toFile(path.join(root,`docs/validation-records/v6.4/${name}.png`));
})().catch(e=>{console.error(e);process.exitCode=1});
