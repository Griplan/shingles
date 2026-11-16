/*
 * P11 photo-canvas profile.
 *
 * Runs the production TypeScript output through a deterministic wx/Canvas
 * adapter. It counts selector queries, page-data updates, RAF callbacks and
 * Canvas commands. It does not measure native raster, touch latency or FPS.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");

const build = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
let definition;
global.Component = (value) => {
  definition = value;
};
require(path.join(build, "packages/clinical/components/photo-canvas/photo-canvas.js"));

const flushMicrotasks = async () => {
  for (let index = 0; index < 24; index += 1) await Promise.resolve();
};

async function run(width, repetition) {
  const counts = {};
  const phases = [];
  const frames = new Map();
  let frameId = 0;
  let backingWidth = 0;
  let backingHeight = 0;

  const count = (name) => {
    counts[name] = (counts[name] || 0) + 1;
  };
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
    get width() {
      return backingWidth;
    },
    set width(value) {
      backingWidth = value;
      count("widthWrites");
    },
    get height() {
      return backingHeight;
    },
    set height(value) {
      backingHeight = value;
      count("heightWrites");
    },
    getContext() {
      count("context");
      return context;
    },
    requestAnimationFrame(callback) {
      count("rafScheduled");
      const id = ++frameId;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      count("rafCancelled");
      frames.delete(id);
    },
    createImage() {
      count("images");
      const image = { width: 700, height: 460 };
      Object.defineProperty(image, "src", {
        set() {
          queueMicrotask(() => image.onload());
        },
      });
      return image;
    },
  };
  global.wx = {
    getWindowInfo: () => ({ pixelRatio: 2 }),
    nextTick: queueMicrotask,
  };
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
    triggerEvent(name, detail) {
      count(`event.${name}`);
      counts.lastEvent = name;
      counts.lastEventDetail = detail;
    },
    createSelectorQuery() {
      let bounds;
      const query = {
        select: () => query,
        fields: () => query,
        boundingClientRect(callback) {
          bounds = callback;
          count("boundsQueries");
          return query;
        },
        exec(callback) {
          if (bounds) {
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
  for (const [name, method] of Object.entries(definition.methods)) {
    component[name] = method.bind(component);
  }
  definition.lifetimes.created.call(component);
  definition.lifetimes.ready.call(component);
  await flushMicrotasks();
  // The first measurement runs before a Canvas node exists and uses the 16 ms fallback.
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushMicrotasks();

  async function flushFrames() {
    for (let guard = 0; guard < 10; guard += 1) {
      await flushMicrotasks();
      if (!frames.size) return;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) {
        callback();
        await flushMicrotasks();
      }
    }
    throw new Error("RAF queue did not settle");
  }

  await flushFrames();

  async function phase(name, action) {
    for (const key of Object.keys(counts)) delete counts[key];
    const started = performance.now();
    await action();
    await flushFrames();
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
      await component.touchMove(event(80 + index, 210 + (index % 11)));
    }
    await component.touchEnd(event(250, 230));
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

  component.properties.mode = "box";
  component.syncInput();
  await phase("fast-drag-immediate-release", async () => {
    const start = component.touchStart(event(70, 160));
    const moves = [];
    for (let index = 0; index < 120; index += 1) {
      moves.push(component.touchMove(event(100 + index, 190 + (index % 7))));
    }
    const end = component.touchEnd(event(260, 240));
    await Promise.all([start, ...moves, end]);
  });
  assert.equal(
    phases.at(-1).counts["event.prompt"],
    1,
    JSON.stringify(phases.at(-1).counts),
  );

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
    schema_version: "p11-photo-canvas-profile-v1",
    environment: {
      node: process.version,
      platform: process.platform,
      kind: "production JS with deterministic wx/Canvas adapter",
      native_bridge_raster_fps_latency: "NOT_MEASURED",
    },
    cases,
  }, null, 2)}\n`);
  console.log(`PASS: ${cases.length} P11 photo-canvas cases`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
