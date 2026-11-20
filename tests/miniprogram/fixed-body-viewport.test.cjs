const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("V7.1.1 fixed body pages disable document scroll and isolate result controls", () => {
  for (const file of [
    "miniprogram/pages/select/select.json",
    "miniprogram/packages/clinical/pages/annotate/annotate.json",
    "miniprogram/packages/clinical/pages/placement/placement.json",
  ]) {
    assert.equal(JSON.parse(read(file)).disableScroll, true, file);
  }

  const selectCss = read("miniprogram/pages/select/select.wxss");
  const annotateCss = read("miniprogram/packages/clinical/pages/annotate/annotate.wxss");
  const placementCss = read("miniprogram/packages/clinical/pages/placement/placement.wxss");
  const placement = read("miniprogram/packages/clinical/pages/placement/placement.wxml");
  const widePlacementCss = placementCss.slice(placementCss.search(/@media\s*\(min-width:\s*680px\)/));
  assert.match(selectCss, /\.body-page\s*\{[^}]*height:\s*100vh[^}]*overflow:\s*hidden/);
  assert.match(selectCss, /\.model-stage\s*\{[^}]*flex:\s*1 1 0[^}]*min-height:\s*0/);
  assert.match(selectCss, /\.stage-switch-row\s*\{[^}]*position:\s*relative[^}]*z-index:\s*2/);
  assert.match(annotateCss, /\.annotation-page\s*\{[^}]*height:\s*100vh[^}]*display:\s*flex[^}]*overflow:\s*hidden/);
  assert.match(annotateCss, /\.result-stage\s*\{[^}]*flex:\s*1 1 0[^}]*overflow:\s*hidden/);
  assert.match(annotateCss, /\.inspector-scroll\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(placementCss, /\.placement-page\s*\{[^}]*height:\s*100vh[^}]*overflow:\s*hidden/);
  assert.match(placementCss, /\.body-stage\s*\{[^}]*flex:\s*1 1 0[^}]*overflow:\s*hidden/);
  assert.match(placementCss, /\.placement-workspace\s*\{[^}]*align-items:\s*stretch/);
  assert.match(placementCss, /\.body-canvas-slot\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
  assert.match(placementCss, /\.overlay\s*>\s*placement-overlay[^}]*width:\s*100%[^}]*height:\s*100%/);
  assert.match(placementCss, /\.placement-canvas-instance\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
  assert.match(placementCss, /\.stage-body-fallback\s*\{[^}]*pointer-events:\s*none/);
  assert.doesNotMatch(placementCss, /\bmin\(/);
  assert.match(placementCss, /\.placement-scroll\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/);
  // Placement uses a stable local body image plus one lesion Canvas. This avoids
  // native multi-Canvas compositing races where both layers report ready while
  // the simulator paints an empty stage.
  assert.doesNotMatch(placementCss, /\.placement-loading\s*\{/);
  assert.match(placementCss, /\.stage-loading\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/);
  assert.match(widePlacementCss, /\.placement-workspace\s*\{[^}]*flex-direction:\s*row/);
  assert.match(widePlacementCss, /\.body-stage\s*\{[^}]*flex:\s*52 1 0[^}]*height:\s*100%/);
  assert.match(widePlacementCss, /\.placement-inspector\s*\{[^}]*flex:\s*48 1 0/);
  assert.match(read("miniprogram/components/body-canvas/body-canvas.wxss"), /\.canvas-shell\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0/);
  assert.match(read("miniprogram/components/body-canvas/body-canvas.wxss"), /\.body-fallback\s*\{[^}]*pointer-events:\s*none/);
  assert.match(read("miniprogram/components/body-canvas/body-canvas.wxml"), /class="body-fallback"[^>]*binderror="onFallbackError"[^>]*bindload="onFallbackLoad"/);
  assert.match(placement, /<view class="body-canvas-slot">\s*<image wx:if="\{\{bodyImagePath && viewport\}\}" class="stage-body-fallback"/);
  assert.match(placement, /<image wx:elif="\{\{bodyImagePath\}\}" class="stage-body-preview"/);
  assert.doesNotMatch(placement, /<body-canvas\b/);
  assert.match(placement, /<view[^>]*class="overlay"[^>]*>\s*<placement-overlay\s+id="placement-preview"/);
  assert.doesNotMatch(read("miniprogram/packages/clinical/pages/placement/placement.ts"),
    /人体画布加载失败|点击画布内的“重新显示”/);
});

test("placement never converts a region hint into an automatic local-body viewport", () => {
  const placementTs = read("miniprogram/packages/clinical/pages/placement/placement.ts");
  assert.match(placementTs, /zoomRegion:"",focusBounds:null/);
  assert.doesNotMatch(placementTs, /target=model\.regions\.find\(region=>region\.id===this\.data\.zoomRegion\)/);
});

test("V7.1.1 result and placement controls are native vertical scroll views", () => {
  const annotate = read("miniprogram/packages/clinical/pages/annotate/annotate.wxml");
  const placement = read("miniprogram/packages/clinical/pages/placement/placement.wxml");
  assert.match(annotate, /<scroll-view[^>]*class="inspector-scroll wide-only-table"[^>]*scroll-y enhanced/);
  assert.match(placement, /<scroll-view class="placement-scroll" scroll-y enhanced/);
  assert.match(read("miniprogram/components/body-canvas/body-canvas.wxml"), /catchtouchmove="onCanvasMove"/);
});

test("V7.1.1 six target window sizes preserve exact body projection and inverse mapping", () => {
  const { fitViewport, normalizedToCanvas, canvasToNormalized, panViewport, zoomViewportAt } =
    require(path.join(process.env.DERMATOME_BUILD_DIR, "utils/coordinate.js"));
  const { getBodyModel } = require(path.join(process.env.DERMATOME_BUILD_DIR, "data/body-models.js"));
  const model = getBodyModel("front");
  // Approximate the fixed annotation workspace after the two 72px rails and page gaps.
  const windows = [[360,780,194,460],[390,844,224,460],[430,932,264,460],
    [720,760,270,640],[800,720,320,600],[900,800,382,680]];
  const point = { x: .43, y: .61 };
  for (const [windowWidth, windowHeight, width, height] of windows) {
    const base = fitViewport(width, height, model);
    const anchor = { x: width * .58, y: height * .43 };
    const normalizedAnchor = canvasToNormalized(anchor, base);
    let viewport = base;
    for (let index = 0; index < 20; index++) {
      const factor = index % 2 === 0 ? 1.08 : .94;
      viewport = zoomViewportAt(viewport, anchor, factor, model);
      const restored = canvasToNormalized(normalizedToCanvas(normalizedAnchor, viewport), viewport);
      assert.ok(Math.abs(restored.x - normalizedAnchor.x) < 1e-10);
      assert.ok(Math.abs(restored.y - normalizedAnchor.y) < 1e-10);
    }
    const panned = panViewport(base, 21, -13);
    const projected = normalizedToCanvas(point, panned);
    const restored = canvasToNormalized(projected, panned);
    assert.ok(Math.abs(restored.x - point.x) < 1e-10);
    assert.ok(Math.abs(restored.y - point.y) < 1e-10);
    assert.equal(viewport.viewportWidth, width);
    assert.equal(viewport.viewportHeight, height);
    assert.ok(width <= windowWidth && height <= windowHeight);
  }
});
