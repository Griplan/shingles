// Render only review SVG files using the already installed Sharp; no runtime writes.
const fs=require('node:fs'),path=require('node:path');
const sharp=require(process.env.DERMATOME_SHARP_MODULE||'sharp');
(async()=>{for(const f of fs.readdirSync(path.join(__dirname,'figures')).filter(f=>f.endsWith('.svg'))){const p=path.join(__dirname,'figures',f);await sharp(p).png().toFile(p.replace(/\.svg$/,'.png'));}})().catch(e=>{console.error(e);process.exitCode=1});
