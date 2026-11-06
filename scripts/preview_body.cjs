// 从实际版本化资源导出离线SVG预览；不是微信截图，不增加小程序依赖。
const {spawnSync}=require('node:child_process');
const {mkdtempSync,rmSync,writeFileSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=process.argv[2];
const comparison=process.argv[3]==='--comparison';
if(!output)throw Error('Usage: node scripts/preview_body.cjs <new-output.svg>');
const temporary=mkdtempSync(path.join(tmpdir(),'dermatome-preview-'));
try {
  const r=spawnSync(process.execPath,[path.join(root,'miniprogram/node_modules/typescript/bin/tsc'),
    '--project',path.join(root,'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',temporary],{stdio:'inherit'});
  if(r.status!==0)throw Error('TypeScript compile failed');
  const {BODY_MODELS}=require(path.join(temporary,'data/body-models.js'));
  const {BODY_LANDMARKS}=require(path.join(temporary,'assets/body/commons-v1.js'));
  const old=require(path.join(temporary,'assets/body/neutral-v3.js'));
  const d=commands=>commands.map(c=>c.join(' ')).join(' ');
  const entries=comparison ? [
    {visual:old.FRONT_VISUAL,label:'OLD / V1.2 FRONT'},
    {visual:BODY_MODELS.front.visual,label:'NEW / COMMONS FRONT'},
    {visual:BODY_MODELS.back.visual,label:'NEW / COMMONS BACK'},
    {visual:BODY_MODELS.front.visual,label:'ENGINEERING REFERENCES',references:true},
  ] : Object.values(BODY_MODELS).map(m=>({visual:m.visual,label:m.view.toUpperCase()}));
  const width=entries.length*420+20;
  const panels=entries.map((m,i)=>{
    const a=m.visual,p=a.palette;
    const body=a.imagePath ? `<image width="400" height="900" href="data:image/png;base64,${readFileSync(path.join(root,'miniprogram',a.imagePath)).toString('base64')}"/>` : `
      <path d="${d(a.outline)}" fill="url(#skin-${i})" stroke="${p.edge}" stroke-width="1.1"/>
      <g clip-path="url(#body-${i})" stroke-linecap="round" stroke-linejoin="round">
        ${a.shadows.map(s=>`<path d="${d(s)}" fill="${p.shade}" opacity=".18"/>`).join('')}
        ${a.details.map(s=>`<path d="${d(s)}" fill="none" stroke="${p.edge}" stroke-width=".7" opacity=".65"/>`).join('')}
      </g>`;
    return `<g transform="translate(${i*420+20} 70)">
      <defs><linearGradient id="skin-${i}"><stop stop-color="${p.skin}"/>
        <stop offset=".45" stop-color="${p.light}"/><stop offset="1" stop-color="${p.skin}"/></linearGradient>
        <clipPath id="body-${i}"><path d="${d(a.outline)}"/></clipPath></defs>
      <rect width="400" height="900" rx="18" fill="#faf8f4"/>
      ${body}${m.references ? references(BODY_LANDMARKS.front) : ''}
      <text x="200" y="-18" text-anchor="middle" fill="#456456" font-size="16">${m.label}</text></g>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1020" viewBox="0 0 ${width} 1020">
    <rect width="${width}" height="1020" fill="#f0f4f0"/>
    <text x="${width/2}" y="26" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#294e42">${BODY_MODELS.front.id} / ${BODY_MODELS.front.version}${comparison?' - REAL COMMONS ASSET REPLACEMENT':''}</text>
    ${panels}<text x="${width/2}" y="1000" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#758178">OFFLINE ASSET PREVIEW - ILLUSTRATION REFERENCES, NOT A WECHAT SCREENSHOT OR MEDICAL ATLAS</text></svg>`;
  writeFileSync(path.resolve(output),svg,{flag:'wx'});
  console.log('Wrote offline resource preview:',output);
} finally {rmSync(temporary,{recursive:true,force:true});}

function references(points) {
  const rows=[['chin','Chin'],['shoulder','Shoulder'],['chest','Chest'],
    ['waist','Waist'],['hip','Hip'],['crotch','Crotch'],['knee','Knee'],['ankle','Ankle']];
  const levels=rows.map(([key,label])=>{
    const p=points[key];return `<line x1="12" y1="${p.y}" x2="388" y2="${p.y}" stroke="#426f9c" opacity=".55" stroke-dasharray="4 5"/>
      <text x="${key==='crotch'?388:15}" text-anchor="${key==='crotch'?'end':'start'}" y="${p.y-5}" font-family="sans-serif" font-size="12" fill="#315d88" stroke="#faf8f4" stroke-width="3" paint-order="stroke">${label} y=${p.y}</text>`;
  }).join('');
  const joints=['shoulder','elbow','wrist','hip','knee','ankle'].map(key=>{
    const p=points[key];return `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#315d88"/>`+
      `<circle cx="${400-p.x}" cy="${p.y}" r="3.5" fill="#315d88"/>`;
  }).join('');
  return `<g>${levels}${joints}<text x="390" y="${points.elbow.y-7}" text-anchor="end" font-size="12" fill="#315d88">Elbow ${points.elbow.y}</text>
    <text x="390" y="${points.wrist.y-7}" text-anchor="end" font-size="12" fill="#315d88">Wrist ${points.wrist.y}</text></g>`;
}
