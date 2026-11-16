/*
 * P10 frontend command-count profile.
 *
 * Runs the production photo-canvas JS through a deterministic wx/Canvas adapter.
 * It measures JS work and selector/redraw counts only. Native bridge, raster,
 * FPS, input latency and phone memory remain NOT_MEASURED.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");

const build = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
let definition;
global.Component = (value) => { definition = value; };
require(path.join(build, "packages/clinical/components/photo-canvas/photo-canvas.js"));

const flush = async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
};

async function run(width, repetition) {
  const counts = {};
  const phases = [];
  let backingWidth = 0;
  let backingHeight = 0;
  const count = (name) => { counts[name] = (counts[name] || 0) + 1; };
  const context = new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name];
      return () => count(name);
    },
    set(target, name, value) {
      target[name] = value;
      return true;
    },
  });
  const node = {
    get width() { return backingWidth; },
    set width(value) { backingWidth = value; count("widthWrites"); },
    get height() { return backingHeight; },
    set height(value) { backingHeight = value; count("heightWrites"); },
    getContext() { count("context"); return context; },
    createImage() {
      count("images");
      const image = { width: 700, height: 460 };
      Object.defineProperty(image, "src", {
        set() { queueMicrotask(() => image.onload()); },
      });
      return image;
    },
  };
  global.wx = { getWindowInfo: () => ({ pixelRatio: 2 }) };
  const component = {
    data: {},
    properties: {
      source: "synthetic-photo",
      mask: "synthetic-alpha",
      photoWidth: 700,
      photoHeight: 460,
      mode: "box",
      points: [],
      box: null,
      additionalBoxes: [],
      brushRadius: 0.02,
      showPrompts: true,
      disabled: false,
      layoutRevision: 0,
    },
    setData(update) {
      count("setData");
      counts.setDataBytes = (counts.setDataBytes || 0) + Buffer.byteLength(JSON.stringify(update));
      Object.assign(this.data, update);
    },
    triggerEvent(name) { count(`event.${name}`); },
    createSelectorQuery() {
      let bounds;
      const query = {
        select: () => query,
        fields: () => query,
        boundingClientRect(callback) { bounds = callback; return query; },
        exec(callback) {
          if (bounds) {
            count("boundsQueries");
            bounds({ left: 24, top: 70, width, height: 400 });
          } else {
            count("canvasMeasureQueries");
            callback([{ node, width, height: 400 }]);
          }
        },
      };
      return query;
    },
  };
  for (const [name, method] of Object.entries(definition.methods)) component[name] = method.bind(component);
  definition.lifetimes.created.call(component);
  definition.lifetimes.ready.call(component);
  await flush();

  async function phase(name, action) {
    for (const key of Object.keys(counts)) delete counts[key];
    const started = performance.now();
    await action();
    await flush();
    phases.push({
      name,
      wall_ms: performance.now() - started,
      counts: { ...counts },
    });
  }

  const event = (x, y) => ({
    touches: [{ clientX: x + 24, clientY: y + 70 }],
    changedTouches: [{ clientX: x + 24, clientY: y + 70 }],
  });

  await phase("box-120-client-coordinate-moves", async () => {
    await component.touchStart(event(50, 150));
    for (let index = 0; index < 120; index += 1) {
      await component.touchMove(event(100 + index, 210));
      await flush();
    }
    await component.touchEnd(event(220, 210));
  });
  assert.equal(
    phases.at(-1).counts["event.prompt"],
    1,
    JSON.stringify(phases.at(-1).counts),
  );

  component.properties.mode = "paint-erase";
  component.syncInput();
  await phase("brush-120-client-coordinate-moves", async () => {
    await component.touchStart(event(60, 160));
    for (let index = 0; index < 120; index += 1) {
      await component.touchMove(event(60 + index, 180));
      await flush();
    }
    await component.touchEnd(event(180, 180));
  });
  assert.equal(phases.at(-1).counts["event.stroke"], 1);

  await phase("candidate-switch-10", async () => {
    for (let index = 0; index < 10; index += 1) {
      component.properties.mask = `synthetic-alpha-${index % 3}`;
      await component.redraw();
    }
  });

  definition.lifetimes.detached.call(component);
  return { width, repetition, phases };
}

(async () => {
  const cases = [];
  for (const width of [320, 375, 430]) {
    for (let repetition = 0; repetition < 3; repetition += 1) {
      cases.push(await run(width, repetition));
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({
    schema_version: "p10-photo-canvas-profile-v1",
    environment: {
      node: process.version,
      platform: process.platform,
      kind: "production JS with deterministic wx/Canvas adapter",
      native_bridge_raster_fps_latency: "NOT_MEASURED",
    },
    cases,
  }, null, 2)}\n`);
  console.log(`PASS: ${cases.length} photo-canvas cases`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
