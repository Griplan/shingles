/** Export actual source-derived SVG resources, without browser DOM or AI image generation.
 * Pass an installed sharp module path via SHARP_MODULE when sharp is not on module search path.
 */
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const at = p => path.join(root, p);
(async () => {
  for (const v of ['palm-left', 'palm-right']) {
    await sharp(at(`miniprogram/assets/palm/${v}.svg`)).resize(880, 1400).png()
      .toFile(at(`miniprogram/assets/palm/${v}.png`));
  }
  await sharp(at('data/sources/palm-v1/gray1237.original.svg')).resize({height:1000})
    .flatten({background:'#fff'}).png().toFile(at('data/sources/palm-v1/gray1237.preview.png'));
  const labels = Buffer.from('<svg width="1320" height="840"><rect width="1320" height="840" fill="#f4f8f5"/><g fill="#244b3f" font-size="24" font-family="sans-serif" text-anchor="middle"><text x="220" y="35">原始 Gray1237 掌面图</text><text x="660" y="35">左掌 · 原轮廓</text><text x="1100" y="35">右掌 · 同源镜像</text></g><text x="660" y="810" text-anchor="middle" fill="#637169" font-size="18" font-family="sans-serif">静态资源预览，非微信运行截图；未绘制神经分区</text></svg>');
  const imgs = await Promise.all(['data/sources/palm-v1/gray1237.preview.png',
    'miniprogram/assets/palm/palm-left.png', 'miniprogram/assets/palm/palm-right.png']
    .map(p => sharp(at(p)).resize({width:420,height:700,fit:'inside'}).toBuffer()));
  await sharp(labels).composite(imgs.map((input,i)=>({input,left:i*440+10,top:60})))
    .png().toFile(at('data/sources/palm-v1/palm-comparison.png'));
})().catch(e => { console.error(e.message); process.exitCode=1; });
