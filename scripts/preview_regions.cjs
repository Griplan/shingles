// Real production drawBody -> SVG command recorder -> optional PNG. Offline evidence, never a WeChat screenshot.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),prefix=process.argv[2],sharpPath=process.argv[3];
if(!prefix)throw Error('Usage: node scripts/preview_regions.cjs <new-output-prefix> [installed-sharp-module-path]');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dermatome-regions-preview-'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const defs=[],counter={n:0};
function context(){
 let commands=[],clip='',stack=[];const out=[];
 const c={out,globalAlpha:1,lineWidth:1,lineJoin:'miter',lineCap:'butt',dash:[],
  clearRect(){},translate(x,y){if(x||y)throw Error('Preview expects logical origin');},scale(x,y){if(x!==1||y!==1)throw Error('Preview expects logical scale');},
  save(){stack.push([clip,c.fillStyle,c.strokeStyle,c.globalAlpha,c.lineWidth,c.lineJoin,c.lineCap,c.dash]);},
  restore(){[clip,c.fillStyle,c.strokeStyle,c.globalAlpha,c.lineWidth,c.lineJoin,c.lineCap,c.dash]=stack.pop();},
  beginPath(){commands=[];},moveTo(x,y){commands.push(`M ${x} ${y}`);},lineTo(x,y){commands.push(`L ${x} ${y}`);},
  bezierCurveTo(...a){commands.push('C '+a.join(' '));},quadraticCurveTo(...a){commands.push('Q '+a.join(' '));},closePath(){commands.push('Z');},
  clip(){clip='body-'+counter.n++;defs.push(`<clipPath id="${clip}"><path d="${commands.join(' ')}"/></clipPath>`);},
  fill(){out.push(`<path d="${commands.join(' ')}" fill="${esc(c.fillStyle)}" ${attr()}/>`);},
  stroke(){out.push(`<path d="${commands.join(' ')}" fill="none" stroke="${esc(c.strokeStyle)}" stroke-width="${c.lineWidth}" stroke-linejoin="${c.lineJoin}" stroke-linecap="${c.lineCap}" stroke-dasharray="${c.dash.join(' ')}" ${attr()}/>`);},
  fillRect(x,y,w,h){out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(c.fillStyle)}"/>`);},
  drawImage(image){out.push(`<image width="400" height="900" href="data:image/png;base64,${fs.readFileSync(path.join(root,'miniprogram',image.src)).toString('base64')}"/>`);},
  setLineDash(a){c.dash=a;},};
 function attr(){return `opacity="${c.globalAlpha}" ${clip?`clip-path="url(#${clip})"`:''}`;}
 return c;
}
(async()=>{try{
 const r=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',dir],{stdio:'inherit'});
 if(r.status!==0)throw Error('TypeScript compilation failed');
 const {getBodyModel}=require(path.join(dir,'data/body-models.js')),{BODY_REGIONS:old}=require(path.join(dir,'data/body-regions-v15.js'));
 const {drawBody}=require(path.join(dir,'components/body-canvas/render.js'));
 const viewport={logicalWidth:400,logicalHeight:900,viewportWidth:400,viewportHeight:900,offsetX:0,offsetY:0,scale:1,zoom:1,padding:0};
 function draw(model,selected){const c=context();drawBody(c,viewport,model,selected,null,{src:model.visual.imagePath});return c.out.join('');}
 const panels=[];for(const [row,view]of ['front','back'].entries()){
  const m=getBodyModel(view),torso=view==='front'?'chest':'upper-back',prev=Object.assign({},m,{regions:old[view]});
  const entries=[['OLD '+view.toUpperCase(),prev,view+'-'+torso],['NEW '+view.toUpperCase(),m,view+'-'+torso],['NEW ANATOMICAL LEFT ARM',m,view+'-left-arm'],['NEW ANATOMICAL RIGHT ARM',m,view+'-right-arm']];
  entries.forEach(([label,model,id],col)=>{panels.push(`<text x="${20+col*300+140}" y="${50+row*490}" text-anchor="middle" font-size="12">${label}</text><svg x="${20+col*300}" y="${60+row*490}" width="280" height="430" viewBox="60 130 280 430">${draw(model,model.regions.find(r=>r.id===id))}</svg>`);});
 }
 const boundary=[];for(const [i,view]of ['front','back'].entries()){
  const m=getBodyModel(view),base=draw(m,undefined);
  const paths=m.regions.filter(r=>!r.id.endsWith('head')&&!r.id.includes('leg')).map((r,j)=>{
   const points=r.outline.map(p=>`${p.x*400},${p.y*900}`).join(' ');return `<polygon points="${points}" clip-path="url(#${view}-clip)" fill="none" stroke="${['#3272af','#21845e','#be6442','#8c559e','#b28c26'][j]}" stroke-width=".65"/>`;
  }).join('');
  defs.push(`<clipPath id="${view}-clip"><polygon points="${m.hitOutline.map(p=>p.x+','+p.y).join(' ')}"/></clipPath>`);
  const refs=require(path.join(root,'tests/miniprogram/fixtures/commons-region-references.json')).cases.filter(r=>r.view===view&&r.logical[1]<=320);
  const dots=refs.map((r,j)=>`<circle cx="${r.logical[0]}" cy="${r.logical[1]}" r="1.2" fill="#a32225"/><text x="${r.logical[0]+2}" y="${r.logical[1]-2}" font-size="4" fill="#a32225">${r.label.split('-').slice(1).join('-')}</text>`).join('');
  boundary.push(`<text x="${260+i*520}" y="50" text-anchor="middle" font-size="16">${view.toUpperCase()} / SHARED UI BOUNDARIES</text><svg x="${20+i*520}" y="65" width="480" height="480" viewBox="80 120 240 240">${base}${paths}${dots}</svg>`);
 }
 const svg=(w,h,content)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="sans-serif" fill="#254c3e"><defs>${defs.join('')}</defs><rect width="${w}" height="${h}" fill="#eef3ef"/><text x="${w/2}" y="23" text-anchor="middle" font-size="13">V1.6 OFFLINE PRODUCTION DRAW COMMANDS / SAME SOURCE, CROP AND SCALE</text>${content}<text x="${w/2}" y="${h-12}" text-anchor="middle" font-size="11">NOT A WECHAT SCREENSHOT / PRODUCT UI REGIONS, NOT A MEDICAL ATLAS</text></svg>`;
 for(const [suffix,w,h,content]of [['comparison',1240,1040,panels.join('')],['boundaries',1060,580,boundary.join('')]]){
  const file=path.resolve(prefix+'-'+suffix+'.svg'),data=svg(w,h,content);fs.writeFileSync(file,data,{flag:'wx'});console.log('Offline SVG:',file);
  if(sharpPath){await require(path.resolve(sharpPath))(Buffer.from(data)).png().toFile(file.replace(/\.svg$/,'.png'));console.log('Offline PNG:',file.replace(/\.svg$/,'.png'));}
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
