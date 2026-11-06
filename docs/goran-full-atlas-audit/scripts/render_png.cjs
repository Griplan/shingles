// Existing optional audit renderer; never used by the mini-program.
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.AUDIT_SHARP_MODULE || '/Users/griplan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir = path.resolve(__dirname, '../evidence');
(async () => {
  let count = 0;
  for (const file of fs.readdirSync(dir).filter(x => x.endsWith('.svg'))) {
    await sharp(path.join(dir, file)).png().toFile(path.join(dir, file.replace(/\.svg$/, '.png')));
    count++;
  }
  console.log(`Rendered ${count} vector audit images`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
