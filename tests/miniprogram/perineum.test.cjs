const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const load = (name) => require(path.join(process.env.DERMATOME_BUILD_DIR, name));
const P = (x, y) => ({ x, y });
const VIEW = "perineum-overview";
const localModels = load("packages/special/data/local-models.js");
const sessions = load("packages/special/state/local-surface-session.js");
const matching = load("packages/special/state/local-surface-matching-session.js");
const annotationSessions = load("state/annotation-session.js");
const { pointInBody, validatePolygon } = load("utils/annotation-geometry.js");
const { fitViewport, focusViewport, normalizedToCanvas, canvasToNormalized } = load("utils/coordinate.js");

function close(harness, points) {
  for (const point of points) harness.act({ type: "add", point });
  harness.act({ type: "close" });
}

function harness() {
  const store = new sessions.LocalSurfaceSessionStore();
  let session = store.open(VIEW).session;
  const act = (action) => {
    const result = store.dispatch(sessions.localToken(session), action);
    assert.equal(result.ok, true, result.message);
    session = result.session;
    return session;
  };
  return {
    store,
    act,
    get session() {
      return session;
    },
  };
}

function responseFor(request) {
  const model = localModels.getLocalModel(VIEW);
  const region = model.atlas.regions.find((item) => item.labelId === "S4");
  const lesion = request.lesions[0];
  const coverage = {
    view: VIEW,
    lesion_ids: [lesion.id],
    annotation_area: 0.001,
    covered_area: 0.001,
    uncovered_area: 0,
    covered_ratio: 1,
    uncovered_ratio: 0,
    coverage_status: "full",
    candidates: [
      {
        candidate_id: "perineum-s4",
        region_ids: [region.id],
        partition_type: "schematic_region",
        label: "S4",
        source_label: "S4",
        display_name: "模拟 S4",
        side: "unspecified",
        view: VIEW,
        intersection_area: 0.001,
        lesion_coverage_ratio: 1,
      },
    ],
  };
  return {
    request_id: request.request_id,
    annotation_revision: request.annotation_revision,
    identity: request.identity,
    method: "manual_annotation_reference_geometry",
    area_unit: "normalized_template_area",
    source: {
      title: model.atlas.sourceTitle,
      url: model.atlas.sourceUrl,
      attribution: model.atlas.attribution,
      license: "CC0-1.0",
      atlas_type: "SCHEMATIC",
      review_status: "NOT_MEDICALLY_VALIDATED",
      intended_use: "INTERACTIVE_SIMULATION",
      source_type: "ARTIFICIALLY_CONSTRUCTED",
      disclaimer: model.atlas.coverageNote,
      medical_review_status: "pending",
      preview: true,
      coverage_note: model.atlas.coverageNote,
    },
    lesions: [structuredClone(coverage)],
    views: [structuredClone(coverage)],
    warnings: [model.atlas.coverageNote],
  };
}

let pageDefinition;
global.Page = (definition) => {
  pageDefinition = definition;
};
load("packages/special/pages/local-surface/local-surface.js");

function page() {
  const instance = {
    data: structuredClone(pageDefinition.data),
    setData(values) {
      Object.assign(this.data, values);
    },
  };
  for (const [key, value] of Object.entries(pageDefinition)) {
    if (typeof value === "function") instance[key] = value.bind(instance);
  }
  return instance;
}

function tap(instance, point) {
  const session = instance.data.session;
  instance.onPoint({
    detail: {
      ...sessions.localToken(session),
      templateId: session.basis.templateId,
      templateVersion: session.basis.templateVersion,
      geometryId: session.basis.geometryId,
      status: "valid",
      point,
    },
  });
}

function setup() {
  sessions.localSession = new sessions.LocalSurfaceSessionStore();
  global.wx = {
    getWindowInfo: () => ({ windowHeight: 760 }),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
    setNavigationBarTitle() {},
  };
}

test("neutral perineum model is explicit, single-view, local and fully covered", () => {
  const model = localModels.getLocalModel(VIEW);
  assert.equal(localModels.isLocalSurfaceView(VIEW), true);
  assert.equal(model.id, "neutral-perineum-overview-v1");
  assert.equal(model.version, "1.0.0");
  assert.equal(model.logicalWidth, 400);
  assert.equal(model.logicalHeight, 560);
  assert.equal(model.aiPhotoSupported, false);
  assert.equal(model.atlas.atlasType, "SCHEMATIC");
  assert.equal(model.atlas.reviewStatus, "NOT_MEDICALLY_VALIDATED");
  assert.equal(model.atlas.intendedUse, "INTERACTIVE_SIMULATION");
  assert.equal(model.atlas.sourceType, "ARTIFICIALLY_CONSTRUCTED");
  assert.equal(model.atlas.regions.length, 5);
  assert.deepEqual(
    [...new Set(model.atlas.regions.map((region) => region.labelId))].sort(),
    ["S2", "S3", "S4", "S5", "UNDEFINED"],
  );
  assert.ok(model.atlas.regions.every((region) => region.side === "unspecified"));
  assert.equal(
    model.atlas.regions.find((region) => region.labelId === "UNDEFINED").displayName,
    "模拟未定区",
  );
  assert.ok(fs.existsSync(path.join(root, "miniprogram", model.imagePath)));
  assert.ok(fs.existsSync(path.join(root, "miniprogram", model.sourcePath)));
  const presentation = localModels.localViewPresentation(VIEW);
  assert.equal(presentation.partName, "会阴区域");
  assert.equal(presentation.showSideSwitch, false);
  assert.match(presentation.orientation, /解剖左/);
});

test("represented skin has an anal opening and reference locations are annotatable", () => {
  const model = localModels.getLocalModel(VIEW);
  assert.equal(pointInBody(P(0.5, 0.495), model.body), false);
  for (const point of [P(0.14, 0.2), P(0.2, 0.72), P(0.5, 0.435), P(0.522, 0.495), P(0.5, 0.325)]) {
    assert.equal(pointInBody(point, model.body), true);
  }
  const triangle = [P(0.49, 0.40), P(0.51, 0.40), P(0.50, 0.44)];
  assert.equal(validatePolygon(triangle, model.body).ok, true);
  assert.equal(
    validatePolygon([P(0.01, 0.01), P(0.1, 0.01), P(0.1, 0.1)], model.body).ok,
    false,
  );
});

test("perineum session is independent from sole, axilla and full-body sessions", () => {
  const before = annotationSessions.annotationSession.snapshot();
  const store = new sessions.LocalSurfaceSessionStore();
  let perineum = store.open(VIEW).session;
  for (const point of [P(0.49, 0.40), P(0.51, 0.40), P(0.50, 0.44)]) {
    perineum = store.dispatch(sessions.localToken(perineum), { type: "add", point }).session;
  }
  perineum = store.dispatch(sessions.localToken(perineum), { type: "close" }).session;
  const saved = JSON.stringify(perineum.state.completed);
  for (const view of ["sole-left", "sole-right", "axilla-left", "axilla-right"]) {
    const other = store.open(view);
    assert.equal(other.ok, true);
    assert.equal(other.session.state.completed.length, 0);
    assert.notEqual(other.session.sessionId, perineum.sessionId);
  }
  assert.equal(JSON.stringify(store.snapshot(VIEW).state.completed), saved);
  assert.strictEqual(annotationSessions.annotationSession.snapshot(), before);
});

test("multi-region, undo, delete, zoom and reset preserve final perineum geometry", () => {
  const h = harness();
  const areas = [
    [P(0.49, 0.40), P(0.51, 0.40), P(0.50, 0.44)],
    [P(0.18, 0.68), P(0.22, 0.68), P(0.20, 0.72)],
    [P(0.47, 0.46), P(0.49, 0.46), P(0.48, 0.48)],
  ];
  close(h, areas[0]);
  h.act({ type: "start" });
  h.act({ type: "add", point: areas[1][0] });
  h.act({ type: "undo" });
  for (const point of areas[1]) h.act({ type: "add", point });
  h.act({ type: "close" });
  h.act({ type: "start" });
  close(h, areas[2]);
  assert.equal(h.session.state.completed.length, 3);
  const first = h.session.state.completed[0].id;
  h.act({ type: "select", id: first });
  h.act({ type: "delete", id: first });
  assert.equal(h.session.state.completed.length, 2);
  h.act({ type: "review" });
  const saved = JSON.stringify(h.session.state.completed);
  const model = localModels.getLocalModel(VIEW);
  for (const width of [320, 375, 430]) {
    const full = fitViewport(width, 440, model, 12);
    for (const target of [null, { x: 0.35, y: 0.30, width: 0.30, height: 0.32 }, null]) {
      const viewport = target ? focusViewport(full, target) : full;
      const point = P(0.5, 0.44);
      const back = canvasToNormalized(normalizedToCanvas(point, viewport), viewport);
      assert.ok(Math.abs(back.x - point.x) < 1e-12);
      assert.ok(Math.abs(back.y - point.y) < 1e-12);
    }
  }
  assert.equal(JSON.stringify(h.session.state.completed), saved);
});

test("matching store and page expose real schematic state, label filtering and AI-disabled notice", async () => {
  setup();
  const originalForView = matching.localMatching.forView;
  let sent = 0;
  let instance;
  const fakeStore = {
    response: null,
    refresh() {
      return {
        status: this.response ? "ready" : "idle",
        message: "",
        response: this.response,
      };
    },
    async calculate() {
      sent += 1;
      const session = instance.data.session;
      const request = {
        request_id: "frontend-perineum",
        annotation_revision: session.revision,
        identity: session.atlasIdentity,
        lesions: session.state.completed.map((lesion) => ({
          id: lesion.id,
          view: lesion.view,
          geometry: lesion.geometry,
        })),
      };
      this.response = responseFor(request);
    },
    cancelPending() {},
  };
  matching.localMatching.forView = () => fakeStore;
  try {
    instance = page();
    instance.onLoad({ view: VIEW });
    assert.equal(instance.data.showSideSwitch, false);
    assert.equal(instance.data.aiPhotoSupported, false);
    assert.equal(instance.data.schematic, true);
    assert.match(instance.data.provisionalNotice, /未经医学审核/);
    for (const point of [P(0.49, 0.40), P(0.51, 0.40), P(0.50, 0.44)]) tap(instance, point);
    instance.closePolygon();
    instance.finish();
    await instance.calculate();
    assert.equal(sent, 1);

    assert.equal(instance.data.resultMode, true);
    assert.equal(instance.data.labels.length, 1);
    assert.equal(instance.data.labels[0].label, "模拟 S4");
    assert.equal(instance.data.atlasRegions.length, 1);
    instance.showAll();
    assert.equal(instance.data.atlasRegions.length, 1);
    instance.edit();
    assert.equal(instance.data.resultMode, false);
    assert.equal(instance.data.atlasRegions.length, 0);
    instance.onUnload();
  } finally {
    matching.localMatching.forView = originalForView;
  }
});

test("response guard requires every perineum schematic status field", () => {
  const { checkedResponse } = load("packages/clinical/state/matching-session.js");
  const model = localModels.getLocalModel(VIEW);
  const request = {
    request_id: "guard",
    annotation_revision: 1,
    identity: model.atlas.identity,
    lesions: [
      {
        id: "GUARD",
        view: VIEW,
        vertices: [P(0.49, 0.4), P(0.51, 0.4), P(0.5, 0.44)],
      },
    ],
  };
  const response = responseFor(request);
  assert.equal(
    checkedResponse(response, request, model.atlas.regions).source.atlas_type,
    "SCHEMATIC",
  );
  for (const field of [
    "atlas_type",
    "review_status",
    "intended_use",
    "source_type",
    "disclaimer",
  ]) {
    const broken = structuredClone(response);
    delete broken.source[field];
    assert.throws(() => checkedResponse(broken, request, model.atlas.regions));
  }
});

test("special chooser includes one perineum entry while retired palm stays absent", () => {
  const chooser = fs.readFileSync(
    path.join(root, "miniprogram/packages/special/pages/special-parts/special-parts.wxml"),
    "utf8",
  );
  assert.match(chooser, /data-view="perineum-overview"/);
  assert.doesNotMatch(chooser, /palm-left|palm-right/);
  const pageMarkup = fs.readFileSync(
    path.join(root, "miniprogram/packages/special/pages/local-surface/local-surface.wxml"),
    "utf8",
  );
  assert.match(pageMarkup, /wx:if="\{\{showSideSwitch\}\}"/);
  assert.match(pageMarkup, /wx:if="\{\{!aiPhotoSupported\}\}"[^>]*>此视图仅支持手动标注/);
});
