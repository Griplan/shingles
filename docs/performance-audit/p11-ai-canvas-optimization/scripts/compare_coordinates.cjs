/*
 * Compares final box-selection coordinates between the frozen P11 baseline
 * build and the optimized build. The component code under test is unchanged;
 * only the deterministic selector/Canvas adapter is shared.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const beforeBuild = path.resolve(process.argv[2]);
const afterBuild = path.resolve(process.argv[3]);
const output = path.resolve(process.argv[4]);

function loadDefinition(build) {
  let definition;
  global.Component = (value) => {
    definition = value;
  };
  const target = path.join(build, "packages/clinical/components/photo-canvas/photo-canvas.js");
  delete require.cache[target];
  require(target);
  return definition;
}

function instantiate(definition, width, height, photoWidth, photoHeight) {
  const events = [];
  const context = new Proxy({}, {
    get: () => () => {},
    set: () => true,
  });
  const node = {
    width: 0,
    height: 0,
    getContext: () => context,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    createImage() {
      const image = { width: photoWidth, height: photoHeight };
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
      mask: "",
      photoWidth,
      photoHeight,
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
      Object.assign(this.data, update);
    },
    triggerEvent(name, detail) {
      events.push({ name, detail });
    },
    createSelectorQuery() {
      let bounds;
      const query = {
        select: () => query,
        fields: () => query,
        boundingClientRect(callback) {
          bounds = callback;
          return query;
        },
        exec(callback) {
          if (bounds) bounds({ left: 24, top: 70, width, height });
          else callback([{ node, width, height }]);
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
  return { component, events };
}

async function select(definition, screen, photo, direction, coordinateKind) {
  const { component, events } = instantiate(
    definition,
    screen[0],
    screen[1],
    photo[0],
    photo[1],
  );
  await component.redraw();
  const [startX, startY, endX, endY] = direction;
  const event = (x, y) => {
    const touch = coordinateKind === "client"
      ? { clientX: x + 24, clientY: y + 70 }
      : { x, y };
    return { touches: [touch], changedTouches: [touch] };
  };
  const start = component.touchStart(event(startX, startY));
  const moves = [];
  for (let index = 0; index < 120; index += 1) {
    moves.push(component.touchMove(event(
      startX + (endX - startX) * ((index + 1) / 121),
      startY + (endY - startY) * ((index + 1) / 121),
    )));
  }
  const end = component.touchEnd(event(endX, endY));
  await Promise.all([start, ...moves, end]);
  const prompt = events.find((item) => item.name === "prompt");
  assert.ok(prompt, JSON.stringify({ screen, photo, direction, coordinateKind, events }));
  definition.lifetimes.detached.call(component);
  return prompt.detail.box;
}

function difference(left, right) {
  return Math.max(...Object.keys(left).map((key) => Math.abs(left[key] - right[key])));
}

(async () => {
  const before = loadDefinition(beforeBuild);
  const after = loadDefinition(afterBuild);
  const records = [];
  const screens = [[320, 300], [375, 360], [430, 540]];
  const photos = [[700, 460], [460, 700]];
  const directions = [
    [80, 150, 230, 220],
    [230, 220, 80, 150],
    [230, 150, 80, 220],
    [80, 220, 230, 150],
  ];
  for (const screen of screens) {
    for (const photo of photos) {
      for (const coordinateKind of ["client", "native"]) {
        for (const direction of directions) {
          const beforeBox = await select(before, screen, photo, direction, coordinateKind);
          const afterBox = await select(after, screen, photo, direction, coordinateKind);
          const maxDifference = difference(beforeBox, afterBox);
          assert.ok(maxDifference <= 1e-12, JSON.stringify({
            screen, photo, coordinateKind, direction, beforeBox, afterBox, maxDifference,
          }));
          records.push({
            screen,
            photo,
            coordinateKind,
            direction,
            before: beforeBox,
            after: afterBox,
            max_abs_difference: maxDifference,
          });
        }
      }
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({
    schema_version: "p11-coordinate-equivalence-v1",
    comparisons: records.length,
    max_abs_difference: Math.max(...records.map((record) => record.max_abs_difference)),
    records,
  }, null, 2)}\n`);
  console.log(`PASS: ${records.length} coordinate-equivalence comparisons`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
