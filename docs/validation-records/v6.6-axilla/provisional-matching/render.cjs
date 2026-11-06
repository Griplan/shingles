const fs=require('fs'),path=require('path'),sharp=require(process.env.DERMATOME_SHARP_MODULE||'sharp');
(async()=>{for(const f of fs.readdirSync(__dirname).filter(f=>f.endsWith('.svg')))await sharp(path.join(__dirname,f)).png().toFile(path.join(__dirname,f.replace('.svg','.png')));})().catch(e=>{console.error(e);process.exitCode=1});
