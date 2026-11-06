// Offline command replay of the production renderer. Synthetic UI fixture only; never a runtime screenshot.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=process.argv[2],sharpPath=process.argv[3];
if(!output||!sharpPath)throw Error('Usage: node scripts/preview_annotations.cjs <new-output.png> <installed-sharp-path>');
const build=fs.mkdtempSync(path.join(os.tmpdir(),'dermatome-v2-preview-'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const defs=[];let sequence=0;
function context(){
 let commands=[],clip='',stack=[];const out=[];
 const c={out,globalAlpha:1,lineWidth:1,lineJoin:'round',lineCap:'round',dash:[],clearRect(){},
  save(){stack.push([clip,c.fillStyle,c.strokeStyle,c.globalAlpha,c.lineWidth]);},
  restore(){[clip,c.fillStyle,c.strokeStyle,c.globalAlpha,c.lineWidth]=stack.pop();},
  translate(x,y){if(x||y)throw Error('Expected origin');},scale(x,y){if(x!==1||y!==1)throw Error('Expected unit scale');},
  beginPath(){commands=[];},moveTo(x,y){commands.push(`M${x},${y}`);},lineTo(x,y){commands.push(`L${x},${y}`);},closePath(){commands.push('Z');},
  rect(x,y,w,h){commands.push(`M${x},${y}h${w}v${h}h${-w}Z`);},
  arc(x,y,r){commands.push(`M${x-r},${y}a${r},${r} 0 1 0 ${2*r},0a${r},${r} 0 1 0 ${-2*r},0`);},
  clip(){clip=`clip-${sequence++}`;defs.push(`<clipPath id="${clip}"><path d="${commands.join(' ')}"/></clipPath>`);},
  fill(){out.push(`<path d="${commands.join(' ')}" fill="${esc(c.fillStyle)}" ${attr()}/>`);},
  stroke(){out.push(`<path d="${commands.join(' ')}" fill="none" stroke="${esc(c.strokeStyle)}" stroke-width="${c.lineWidth}" stroke-linejoin="round" stroke-linecap="round" ${attr()}/>`);},
  fillRect(x,y,w,h){out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(c.fillStyle)}"/>`);},
  drawImage(image){out.push(`<image width="400" height="900" href="data:image/png;base64,${fs.readFileSync(path.join(root,'miniprogram',image.src)).toString('base64')}"/>`);},setLineDash(a){c.dash=a;}};
 function attr(){return `opacity="${c.globalAlpha}" ${clip?`clip-path="url(#${clip})"`:''}`;}
 return c;
}
(async()=>{try{
 const compile=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),'--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',build],{stdio:'inherit'});
 if(compile.status!==0)throw Error('Compilation failed');
 const {getBodyModel}=require(path.join(build,'data/body-models.js')),
 {AnnotationSessionStore,sessionToken}=require(path.join(build,'state/annotation-session.js')),
 {drawBody}=require(path.join(build,'components/body-canvas/render.js')),
 f=require(path.join(root,'backend/tests/fixtures/synthetic-annotation-geometry.json')).editor;
 const store=new AnnotationSessionStore();store.open('front','front-chest');
 const act=a=>{const result=store.dispatch(sessionToken(store.snapshot()),a);if(!result.ok)throw Error(result.message);};
 const viewport={logicalWidth:400,logicalHeight:900,viewportWidth:400,viewportHeight:900,offsetX:0,offsetY:0,scale:1,zoom:1,padding:0};
 const panels=[];
 function panel(label){const s=store.snapshot(),model=getBodyModel(s.currentView),ctx=context();
  drawBody(ctx,viewport,model,undefined,null,{src:model.visual.imagePath},{...sessionToken(s),...s.views[s.currentView]});
  const x=12+panels.length*240;panels.push(`<text x="${x+110}" y="56" text-anchor="middle" font-size="13">${label}</text><svg x="${x}" y="70" width="220" height="580" viewBox="0 0 400 900">${ctx.out.join('')}</svg>`);}
 for(const point of f['UI-A'])act({type:'add',point});panel('OPEN DRAFT / 3 POINTS');act({type:'close'});panel('ONE CLOSED REGION');
 act({type:'start'});for(const point of f['UI-B'])act({type:'add',point});act({type:'close'});panel('TWO INDEPENDENT REGIONS');
 act({type:'switch',view:'back'});act({type:'start'});for(const point of f['UI-small'])act({type:'add',point});act({type:'close'});act({type:'review'});panel('REVIEW / BACK');
 act({type:'switch',view:'front'});panel('REVIEW / FRONT');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="710" font-family="sans-serif" fill="#254c3e"><defs>${defs.join('')}</defs><rect width="1220" height="710" fill="#eef3ef"/><text x="610" y="23" text-anchor="middle" font-size="14">V2 OFFLINE PRODUCTION RENDER / SYNTHETIC UI TEST SHAPES</text>${panels.join('')}<text x="610" y="685" text-anchor="middle" font-size="13">NOT A WECHAT SCREENSHOT / NO MEDICAL OR PATIENT DATA</text></svg>`;
 if(fs.existsSync(output))throw Error('Output exists; refusing overwrite');
 await require(path.resolve(sharpPath))(Buffer.from(svg)).png().toFile(output);
 console.log('Offline production-render preview:',path.resolve(output));
 }finally{fs.rmSync(build,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
