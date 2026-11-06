// Offline conversion only: no SVG decoding dependency is added to the miniprogram.
const sharp=require(process.argv[2]);
const fs=require('node:fs'),path=require('node:path');
const dir=process.argv[3]+path.sep;
const target=path.resolve(__dirname,'../miniprogram/assets/body/commons-cc0')+path.sep;
(async()=>{
 if(process.argv[4]==='compose') {
  for(const view of ['front','back']) {
   await sharp(fs.readFileSync(dir+view+'-matte.rgba'),{raw:{width:1200,height:2700,channels:4}})
    .composite([{input:dir+view+'-line.png'}]).png().toFile(target+view+'.png');
  }
  return;
 }
 const bounds={};
 for(const view of ['front','back']) {
  const raw=await sharp(dir+view+'-extracted.svg',{density:72}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=raw.info.width,y0=raw.info.height,x1=0,y1=0;
  for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>32){
   x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
  }
  bounds[view]={x0,y0,x1,y1};
 }const top=Math.min(...Object.values(bounds).map(b=>b.y0)),bottom=Math.max(...Object.values(bounds).map(b=>b.y1));
 const s=840/(bottom-top),ty=30-top*s,record={logicalWidth:400,logicalHeight:900,rasterScale:3,sourceTop:top,sourceBottom:bottom,scale:s,translateY:ty,views:{}};
 for(const view of ['front','back']){
  const b=bounds[view],tx=200-(b.x0+b.x1)/2*s;
  const nested=fs.readFileSync(dir+view+'-extracted.svg','utf8').replace(/<\?xml[^>]*>/,'');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="900" viewBox="0 0 400 900"><g transform="translate(${tx} ${ty}) scale(${s})">${nested}</g></svg>`;
  fs.writeFileSync(target+view+'.svg',svg);
  const line=await sharp(Buffer.from(svg)).resize(1200,2700).ensureAlpha().png().toBuffer();
  fs.writeFileSync(dir+view+'-line.png',line);
  let mask=await sharp(line).extractChannel(3).threshold(24).raw().toBuffer();
  // Raster-only 3x3 closing bridges sub-logical-unit gaps in the original separate stroke segments.
  mask=await sharp(mask,{raw:{width:1200,height:2700,channels:1}}).convolve({width:3,height:3,kernel:Array(9).fill(1),scale:1}).threshold(1).toColourspace('b-w').raw().toBuffer();
  mask=await sharp(mask,{raw:{width:1200,height:2700,channels:1}}).convolve({width:3,height:3,kernel:Array(9).fill(1),scale:9}).threshold(254).toColourspace('b-w').raw().toBuffer();
  fs.writeFileSync(dir+view+'-ink.raw',mask);
  record.views[view]={translateX:tx,bounds:b};
 }
 fs.writeFileSync(dir+'normalization.json',JSON.stringify(record,null,2));process.stdout.write(JSON.stringify(record));
})().catch(e=>{process.stderr.write(String(e));process.exitCode=1});
