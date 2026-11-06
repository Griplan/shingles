// Research-only comparison. Never imports or edits the miniprogram model.
// Run: node preview.cjs /absolute/path/to/installed/sharp
const path=require('node:path');
const fs=require('node:fs');
const sharp=require(process.argv[2]);
const root=__dirname;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const labels=(w,h,lines)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines.map(([x,y,text,size=20,color='#294e42'])=>`<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="${color}">${esc(text)}</text>`).join('')}</svg>`);
(async()=>{
 const result=[];
 for(const key of ['a-male','a-female','b-male'])for(const view of ['front','back']){
  const source=path.join(root,`${key}-${view}-preview.svg`);
  const target=path.join(root,`${key}-${view}-preview.png`);
  // Trim alpha-only empty canvas, retain full original body without deforming curves.
  await sharp(source,{density:180}).trim({background:'#00000000',threshold:1}).resize({height:650}).png().toFile(target);
  const m=await sharp(target).metadata();result.push({key,view,width:m.width,height:m.height,bytes:fs.statSync(target).size});
 }
 const width=1980,height=1020,items=[],text=[[30,36,'V1.3 REAL ASSET REVIEW - TWO SOURCE FAMILIES / THREE DISPLAY OPTIONS',25]];
 const cards=[
  ['a-male','A1 - Goran tek-en / MALE','CC BY-SA 4.0 - attribution + ShareAlike','SVG source; soft shading; full hands and feet'],
  ['a-female','A2 - Goran tek-en / FEMALE','Same family as A1; CC BY-SA 4.0','Same artist and set; independent front and back'],
  ['b-male','B - Cdang / LINE ART','CC0 1.0 - source retained voluntarily','Original male views; no new anatomy drawn'],
 ];
 for(let i=0;i<cards.length;i++){
  const [key,title,license,note]=cards[i],x=i*660;
  items.push({input:Buffer.from(`<svg width="640" height="940"><rect width="640" height="940" rx="16" fill="white"/></svg>`),left:x+10,top:55});
  text.push([x+25,88,title,23],[x+25,116,license,17],[x+110,151,'FRONT',16],[x+436,151,'BACK',16]);
  for(const [j,view]of ['front','back'].entries()){
   const img=path.join(root,`${key}-${view}-preview.png`),m=await sharp(img).metadata();
   items.push({input:img,left:Math.round(x+16+j*320+(300-m.width)/2),top:170});
  }
  text.push([x+25,889,note,16],[x+25,920,key.startsWith('a-')?'Goran tek-en | Wikimedia Commons':'Christophe Dang Ngoc Chan | Wikimedia Commons',16],
   [x+25,947,'Changes: view extraction, empty-margin trim, equal-height layout',13],
   [x+25,974,key.startsWith('a-')?'creativecommons.org/licenses/by-sa/4.0/':'creativecommons.org/publicdomain/zero/1.0/',13]);
 }
 text.push([30,1010,'RESEARCH ONLY - NOT SELECTED OR INSTALLED. Source links, license conditions and changes: NOTICE.md. No body deformation.',14]);
 items.push({input:labels(width,height,text),left:0,top:0});
 await sharp({create:{width,height,channels:4,background:'#eef3f0'}}).composite(items).png().toFile(path.join(root,'candidate-comparison.png'));
 const cw=900,ch=1030,ci=[],ct=[[25,35,'C - SERVIER MUSCULATURE / EXCLUDED AS SURFACE BASE',23],[25,70,'CC BY 4.0; legally usable with credit, but muscle texture is unsuitable',17]];
 for(const [i,view]of ['front','back'].entries()){
  const image=await sharp(path.join(root,`c-servier-${view}.png`)).trim().resize({height:800}).png().toBuffer();
  const m=await sharp(image).metadata();ci.push({input:image,left:Math.round(i*450+(450-m.width)/2),top:125});
  ct.push([i*450+150,110,view.toUpperCase(),18]);
 }
 ct.push([25,970,'Servier Medical Art | smart.servier.com | creativecommons.org/licenses/by/4.0/',17],
  [25,1005,'Preview changes: equal-height layout only. Not a skin or dermatome atlas.',16]);
 ci.push({input:labels(cw,ch,ct),left:0,top:0});
 await sharp({create:{width:cw,height:ch,channels:4,background:'#ffffff'}}).composite(ci).png().toFile(path.join(root,'c-servier-excluded-preview.png'));
 const report={date:'2026-10-22',method:'original SVG group extraction; trim transparent margins; same 650px body height and white background; no redraw or nonuniform scaling',body_previews:result,comparison:{width,height},servier_preview:{width:cw,height:ch},wechat_render_test:'NOT_RUN'};
 fs.writeFileSync(path.join(root,'preview-record.json'),JSON.stringify(report,null,2)+'\n');
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
})().catch(e=>{process.stderr.write(String(e)+'\n');process.exitCode=1});
