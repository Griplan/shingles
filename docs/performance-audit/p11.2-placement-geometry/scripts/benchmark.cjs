// Paired P11.2 benchmark: pinned pre-change module vs current production build.
// This measures Node.js geometry work only, not WeChat bridge latency or frame rate.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../../..");
const output = path.resolve(process.argv[2] || path.join(__dirname, "../evidence/benchmark.json"));
const baselineCommit = "27b41f6744c264fbabb3af1bf08ac0b99075cfda";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dermatome-p11.2-"));

function run(args) {
  const result = spawnSync(args[0], args.slice(1), { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
function time(fn) {
  const started = performance.now();
  const value = fn();
  return { ms: performance.now() - started, value };
}
function rounded(ms) {
  return Number(ms.toFixed(3));
}
function ring(cx, cy, rx, ry, count) {
  const points = Array.from({ length: count - 1 }, (_, index) => {
    const angle = 2 * Math.PI * index / (count - 1);
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
  return [...points, points[0].slice()];
}
function photo(id, coordinates, width = 700, height = 460) {
  return {
    schema_version: "confirmed-photo-segmentation-v1",
    session_id: id,
    photo_id: `photo-${id}`,
    result_id: `result-${id}`,
    candidate_id: "candidate-0",
    prompt_revision: 1,
    coordinate_space: "photo_oriented_normalized_v1",
    confirmed_by_user: true,
    confirmed_at: Date.now() / 1000 - 1,
    expires_at: Date.now() / 1000 + 1200,
    image: { width, height, oriented_rgb_sha256: "a".repeat(64) },
    model: { name: "P11.2 synthetic geometry fixture" },
    prompts: { coordinate_space: "photo_oriented_normalized_v1", points: [], box: null },
    mask_asset: "candidate-0.png",
    mask_sha256: "b".repeat(64),
    geometry: { type: "MultiPolygon", coordinates },
  };
}
function holeGrid(count) {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const x0 = 0.04, y0 = 0.04, width = 0.92, height = 0.92;
  const cellWidth = width / columns, cellHeight = height / rows;
  const holes = Array.from({ length: count }, (_, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    const cx = x0 + (column + 0.5) * cellWidth;
    const cy = y0 + (row + 0.5) * cellHeight;
    const rx = cellWidth * 0.22, ry = cellHeight * 0.22;
    const points = [[cx - rx, cy - ry], [cx - rx, cy + ry], [cx + rx, cy + ry], [cx + rx, cy - ry]];
    return [...points.reverse(), points[0].slice()];
  });
  const outer = [[0.01, 0.01], [0.99, 0.01], [0.99, 0.99], [0.01, 0.99], [0.01, 0.01]];
  return [[outer, ...holes]];
}
function nodeMeasure(module, source, model) {
  const preparedTime = time(() => module.preparePhotoGeometry(source));
  const prepared = preparedTime.value;
  const transformTime = time(() => module.initialPlacement(prepared, model));
  // Keep every edge inside valid back-body skin so the containment phase must
  // traverse the full geometry instead of exiting after an early outside edge.
  const transform = { ...transformTime.value, scale: 0.1, translation: { x: 0.4, y: 0.25 } };
  const geometryTime = time(() => module.transformPhotoPolygonToBody(prepared, transform, model));
  const geometry = geometryTime.value;
  const fullValidationTime = time(() => module.validatePlacementGeometry(geometry, model));
  const fastValidation = module.validateTransformedPlacementGeometry
    ? time(() => module.validateTransformedPlacementGeometry(geometry, model))
    : null;
  const cachedPrepare = module.preparedPhotoMatchesSource
    ? time(() => {
      assert.equal(module.preparePhotoGeometry(source), prepared);
      return prepared;
    })
    : null;
  return {
    components: prepared.polygons.length,
    rings: prepared.polygons.reduce((sum, polygon) => sum + polygon.length, 0),
    holes: prepared.polygons.reduce((sum, polygon) => sum + polygon.length - 1, 0),
    vertices: prepared.vertexCount,
    prepareMs: rounded(preparedTime.ms),
    cachedPrepareMs: cachedPrepare ? rounded(cachedPrepare.ms) : null,
    transformMs: rounded(geometryTime.ms),
    fullValidationMs: rounded(fullValidationTime.ms),
    fastValidationMs: fastValidation ? rounded(fastValidation.ms) : null,
    totalMs: rounded(preparedTime.ms + geometryTime.ms + (fastValidation || fullValidationTime).ms),
    validation: (fastValidation || fullValidationTime).value,
    fullValidation: fullValidationTime.value,
  };
}

try {
  const currentBuild = path.join(temp, "current");
  const baselineBuild = path.join(temp, "baseline");
  run([
    process.execPath,
    path.join(root, "miniprogram/node_modules/typescript/bin/tsc"),
    "--project", path.join(root, "miniprogram/tsconfig.json"),
    "--noEmit", "false",
    "--outDir", currentBuild,
  ]);
  fs.cpSync(currentBuild, baselineBuild, { recursive: true });
  const baselineSource = spawnSync("git", [
    "show", `${baselineCommit}:miniprogram/utils/placement-geometry.ts`,
  ], { cwd: root, encoding: "utf8" });
  assert.equal(baselineSource.status, 0, baselineSource.stderr);
  const ts = require(path.join(root, "miniprogram/node_modules/typescript"));
  const baselineJs = ts.transpileModule(baselineSource.stdout, {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
    fileName: "placement-geometry.ts",
  }).outputText;
  fs.writeFileSync(path.join(baselineBuild, "utils/placement-geometry.js"), baselineJs);

  const baseline = require(path.join(baselineBuild, "utils/placement-geometry.js"));
  const current = require(path.join(currentBuild, "utils/placement-geometry.js"));
  const model = require(path.join(currentBuild, "data/body-models.js")).getBodyModel("back");
  const complexResult = JSON.parse(fs.readFileSync(path.join(
    root,
    "ai/experiments/outputs/overseg-20261101-final/H_synthetic_disconnected/full_image/result.json",
  ), "utf8"));
  const complexCandidate = complexResult.candidates.find(candidate => candidate.candidate_id === "candidate-2");
  assert.ok(complexCandidate);
  const complexSource = {
    ...photo("P11-COMPLEX", complexCandidate.geometry.coordinates, complexResult.image.width, complexResult.image.height),
    result_id: complexResult.result_id,
    model: complexResult.model,
    prompts: complexResult.prompts,
    mask_asset: complexCandidate.mask_ref,
  };
  const samples = [
    ["50 vertices", photo("P11-50", [[ring(0.5, 0.5, 0.35, 0.35, 50)]])],
    ["2000 vertices", photo("P11-2000", [[ring(0.5, 0.5, 0.35, 0.35, 2000)]])],
    ["real 6018 vertices / 389 pieces / 301 holes", complexSource],
    ["500 holes", photo("P11-HOLES-500", holeGrid(500))],
    ["1000 holes", photo("P11-HOLES-1000", holeGrid(1000))],
    ["2000 holes", photo("P11-HOLES-2000", holeGrid(2000))],
  ];
  const rows = [],memoryStart=process.memoryUsage();let memoryPeak={...memoryStart};
  for (const [name, source] of samples) {
    const before = nodeMeasure(baseline, source, model);
    const after = nodeMeasure(current, source, model);
    assert.deepEqual(after.validation, after.fullValidation, `${name} fast/full validation mismatch`);
    rows.push({
      name,
      before,
      after,
      improvement: {
        prepare: before.prepareMs ? rounded(before.prepareMs / Math.max(after.prepareMs, 0.001)) : null,
        validation: before.fullValidationMs / Math.max(after.fastValidationMs ?? after.fullValidationMs, 0.001),
        total: before.totalMs / Math.max(after.totalMs, 0.001),
      },
    });
    const currentMemory=process.memoryUsage();
    for(const key of ["rss","heapUsed","heapTotal","external"])memoryPeak[key]=Math.max(memoryPeak[key],currentMemory[key]);
  }
  const memoryEnd=process.memoryUsage();
  const report = {
    schema: "p11.2-placement-geometry-benchmark-v1",
    generatedAt: new Date().toISOString(),
    baselineCommit,
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpu: os.cpus()[0]?.model || "unknown",
      logicalCpus: os.cpus().length,
      memoryBytes: {start: memoryStart, peakObserved: memoryPeak, end: memoryEnd},
    },
    method: {
      repetitions: 1,
      note: "Each sample is transformed from photo pixels with the same initial placement and validated against the real back-body model. Native WeChat device timing and frame rate are NOT_RUN.",
    },
    rows,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
