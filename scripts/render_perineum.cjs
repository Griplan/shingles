const fs = require("node:fs");
const path = require("node:path");
const sharp = require(process.env.DERMATOME_SHARP_MODULE || "sharp");

const root = path.resolve(__dirname, "..");
const evidence = path.join(root, "docs/validation-records/v6.7-perineum/evidence");

(async () => {
  const assetSvg = path.join(root, "miniprogram/packages/special/assets/perineum/perineum-overview.svg");
  await sharp(assetSvg, { density: 144 })
    .resize(800, 1120, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "miniprogram/packages/special/assets/perineum/perineum-overview.png"));

  for (const name of fs.readdirSync(evidence).filter((name) => name.endsWith(".svg"))) {
    const source = path.join(evidence, name);
    const target = source.replace(/\.svg$/, ".png");
    await sharp(source, { density: 120 }).png({ compressionLevel: 9 }).toFile(target);
  }
  console.log("Rendered perineum PNG runtime asset and evidence previews");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
