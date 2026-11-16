const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../../..");
const output = path.resolve(process.argv[2]);
const compile = spawnSync(process.execPath, [
  path.join(root, "miniprogram/node_modules/typescript/bin/tsc"),
  "--project", path.join(root, "miniprogram/tsconfig.json"),
  "--noEmit", "false",
  "--outDir", output,
], { stdio: "inherit" });
if (compile.status !== 0) process.exit(compile.status || 1);
console.log(output);
