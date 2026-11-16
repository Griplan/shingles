// 编译到临时目录并使用 Node 内置测试器，无新增测试依赖或小程序运行时依赖。
const { spawnSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, rmSync, readdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = mkdtempSync(path.join(tmpdir(), "dermatome-v1-test-"));
const legacyBuildAliases = {
  "pages/annotate/annotate.js": "packages/clinical/pages/annotate/annotate.js",
  "pages/result/result.js": "packages/clinical/pages/result/result.js",
  "pages/atlas-debug/atlas-debug.js": "packages/clinical/pages/atlas-debug/atlas-debug.js",
  "pages/ai-annotate/ai-annotate.js": "packages/clinical/pages/ai-annotate/ai-annotate.js",
  "pages/placement/placement.js": "packages/clinical/pages/placement/placement.js",
  "pages/special-parts/special-parts.js": "packages/special/pages/special-parts/special-parts.js",
  "pages/local-surface/local-surface.js": "packages/special/pages/local-surface/local-surface.js",
  "components/photo-canvas/photo-canvas.js": "packages/clinical/components/photo-canvas/photo-canvas.js",
  "components/placement-overlay/placement-overlay.js": "packages/clinical/components/placement-overlay/placement-overlay.js",
  "components/local-surface-canvas/local-surface-canvas.js": "packages/special/components/local-surface-canvas/local-surface-canvas.js",
  "data/atlas.generated.js": "packages/clinical/data/atlas.generated.js",
  "data/matching-body.generated.js": "packages/clinical/data/matching-body.generated.js",
  "data/local-models.js": "packages/special/data/local-models.js",
  "data/sole.generated.js": "packages/special/data/sole.generated.js",
  "data/axilla-schematic.generated.js": "packages/special/data/axilla-schematic.generated.js",
  "data/perineum-schematic.generated.js": "packages/special/data/perineum-schematic.generated.js",
  "state/matching-session.js": "packages/clinical/state/matching-session.js",
  "state/ai-session.js": "packages/clinical/state/ai-session.js",
  "state/placement-session.js": "packages/clinical/state/placement-session.js",
  "state/placement-navigation.js": "packages/clinical/state/placement-navigation.js",
  "state/local-surface-session.js": "packages/special/state/local-surface-session.js",
  "state/local-surface-matching-session.js": "packages/special/state/local-surface-matching-session.js",
  "utils/atlas-view.js": "packages/clinical/utils/atlas-view.js",
};
function writeLegacyBuildAliases() {
  for (const [legacy, target] of Object.entries(legacyBuildAliases)) {
    const alias = path.join(output, legacy);
    mkdirSync(path.dirname(alias), { recursive: true });
    const targetPath = path.join(output, target);
    writeFileSync(alias, `const target=${JSON.stringify(targetPath)};delete require.cache[target];module.exports=require(target);\n`);
  }
}
try {
  const compile = spawnSync(process.execPath, [
    path.join(root, "miniprogram/node_modules/typescript/bin/tsc"),
    "--project", path.join(root, "miniprogram/tsconfig.json"),
    "--noEmit", "false", "--outDir", output,
  ], { stdio: "inherit" });
  if (compile.status !== 0) process.exitCode = compile.status || 1;
  else {
    writeLegacyBuildAliases();
    const tests = readdirSync(path.join(root, "tests/miniprogram"))
      .filter((file) => file.endsWith(".test.cjs"))
      .map((file) => path.join(root, "tests/miniprogram", file));
    const run = spawnSync(process.execPath, ["--test", ...tests], {
      stdio: "inherit", env: { ...process.env, DERMATOME_BUILD_DIR: output },
    });
    process.exitCode = run.status || (run.signal ? 1 : 0);
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
