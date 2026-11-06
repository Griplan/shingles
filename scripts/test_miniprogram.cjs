// 编译到临时目录并使用 Node 内置测试器，无新增测试依赖或小程序运行时依赖。
const { spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, readdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = mkdtempSync(path.join(tmpdir(), "dermatome-v1-test-"));
try {
  const compile = spawnSync(process.execPath, [
    path.join(root, "miniprogram/node_modules/typescript/bin/tsc"),
    "--project", path.join(root, "miniprogram/tsconfig.json"),
    "--noEmit", "false", "--outDir", output,
  ], { stdio: "inherit" });
  if (compile.status !== 0) process.exitCode = compile.status || 1;
  else {
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
