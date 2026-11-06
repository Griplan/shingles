const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fromBuild = (file) => require(path.join(process.env.DERMATOME_BUILD_DIR, file));
const { fitViewport, focusViewport, resetViewport, normalizedToCanvas, canvasToNormalized } = fromBuild("utils/coordinate.js");
const { getBodyModel } = fromBuild("data/body-models.js");
const BODY_MODEL = getBodyModel("front");
const { BODY_REGIONS, getBodyRegion } = fromBuild("data/body-regions.js");
const EPSILON = 1e-9;
function close(actual, expected) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= EPSILON,
    String(actual) + " != " + String(expected) + " (tolerance 1e-9)");
}
function samePoint(actual, expected) {
  assert.notEqual(actual, null); close(actual.x, expected.x); close(actual.y, expected.y);
}
const screens = [[280, 460], [343, 540], [700, 570]];

test("A 标准坐标正向转换：独立手算 0.5 比例与 16px 留白", () => {
  const t = fitViewport(232, 482, BODY_MODEL);
  close(t.scale, .5);
  samePoint(normalizedToCanvas({ x: .25, y: .75 }, t), { x: 66, y: 353.5 });
});
test("B CSS 坐标逆向转换：手算容器中心", () => {
  samePoint(canvasToNormalized({ x: 116, y: 241 }, fitViewport(232, 482, BODY_MODEL)),
    { x: .5, y: .5 });
});
test("C 三种尺寸 11×11 参考点往返，最大允许误差 1e-9", () => {
  for (const [width, height] of screens) {
    const t = fitViewport(width, height, BODY_MODEL);
    for (let x = 0; x <= 10; x++) for (let y = 0; y <= 10; y++) {
      const point = { x: x / 10, y: y / 10 };
      samePoint(canvasToNormalized(normalizedToCanvas(point, t), t), point);
    }
  }
});
test("D 宽/窄容器始终等比例，分别产生上下和左右留白", () => {
  const narrow = fitViewport(200, 1000, BODY_MODEL, 0);
  close(narrow.scale, .5); close(narrow.offsetX, 0); close(narrow.offsetY, 275);
  const wide = fitViewport(1000, 450, BODY_MODEL, 0);
  close(wide.scale, .5); close(wide.offsetX, 400); close(wide.offsetY, 0);
});
test("E 留白、Canvas 外部以及非有限点击拒绝，不吸附边缘", () => {
  const t = fitViewport(232, 482, BODY_MODEL);
  for (const point of [{x:15.99,y:200},{x:200,y:15.99},{x:-1,y:200},
    {x:233,y:200},{x:100,y:483},{x:NaN,y:10},{x:10,y:Infinity}]) {
    assert.equal(canvasToNormalized(point, t), null);
  }
});
test("F 区域放大居中、四角留在容器内，标准位置保持一致", () => {
  for (const [width, height] of screens) {
    const base = fitViewport(width, height, BODY_MODEL);
    const r = BODY_REGIONS.front[0].bounds;
    const zoom = focusViewport(base, r);
    const center = { x:r.x+r.width/2, y:r.y+r.height/2 };
    samePoint(normalizedToCanvas(center, zoom), { x:width/2, y:height/2 });
    for (const p of [center,{x:r.x,y:r.y},{x:r.x+r.width,y:r.y+r.height}]) {
      const pixel = normalizedToCanvas(p, zoom);
      assert.ok(pixel.x >= 16-EPSILON && pixel.x <= width-16+EPSILON);
      assert.ok(pixel.y >= 16-EPSILON && pixel.y <= height-16+EPSILON);
      samePoint(canvasToNormalized(pixel, zoom), p);
      samePoint(canvasToNormalized(normalizedToCanvas(p, base), base), p);
    }
    assert.ok(zoom.zoom > 1);
  }
});
test("G 复位恢复原全身视口，放大不会修改原始点或区域", () => {
  const base = fitViewport(343, 540, BODY_MODEL), r = BODY_REGIONS.front[1].bounds;
  const before = JSON.stringify(r);
  assert.deepEqual(resetViewport(focusViewport(base, r)), base);
  assert.equal(JSON.stringify(r), before);
  assert.equal(base.zoom, 1); assert.ok(Object.isFrozen(base));
});
for (const value of [0, -1, NaN, Infinity, -Infinity]) {
  test("H 拒绝非法容器尺寸 " + String(value), () => {
    assert.throws(() => fitViewport(value, 500, BODY_MODEL), RangeError);
    assert.throws(() => fitViewport(300, value, BODY_MODEL), RangeError);
  });
}
test("H 拒绝异常模型、留白、区域和标准点数值", () => {
  assert.throws(() => fitViewport(300,500,{...BODY_MODEL,logicalWidth:0}), RangeError);
  for (const pad of [-1, 150, Infinity, NaN]) {
    assert.throws(() => fitViewport(300,500,BODY_MODEL,pad), RangeError);
  }
  const t = fitViewport(300,500,BODY_MODEL);
  for (const rect of [{x:-.01,y:0,width:.5,height:.5},{x:.5,y:0,width:.6,height:.5},
    {x:0,y:0,width:0,height:.5},{x:0,y:NaN,width:.5,height:.5}]) {
    assert.throws(() => focusViewport(t,rect), RangeError);
  }
  for (const p of [{x:NaN,y:0},{x:1.01,y:0},{x:0,y:Infinity},{x:-.01,y:.5}]) {
    assert.throws(() => normalizedToCanvas(p,t), RangeError);
  }
});
test("I 边界点 (0,0)、(1,1) 与全画布放大复位", () => {
  for (const size of screens) {
    const t = fitViewport(...size, BODY_MODEL);
    for (const p of [{x:0,y:0},{x:1,y:1}]) {
      samePoint(canvasToNormalized(normalizedToCanvas(p,t),t), p);
    }
    assert.deepEqual(focusViewport(t,{x:0,y:0,width:1,height:1}),t);
  }
});
test("H 拒绝调用方构造的无效视口，不返回 NaN 或伪造坐标", () => {
  const base = fitViewport(343,540,BODY_MODEL);
  for (const invalid of [{scale:0},{scale:NaN},{offsetX:Infinity},{logicalHeight:-1},
    {viewportWidth:0},{zoom:Infinity},{padding:-1}]) {
    const t = {...base,...invalid};
    assert.throws(() => normalizedToCanvas({x:.5,y:.5},t),RangeError);
    assert.equal(canvasToNormalized({x:100,y:100},t),null);
    assert.throws(() => resetViewport(t),RangeError);
  }
});
test("J 正背面区域独立、ID唯一、解剖学左右正确，区域中心可往返", () => {
  assert.notEqual(BODY_REGIONS.front,BODY_REGIONS.back);
  const all = [...BODY_REGIONS.front,...BODY_REGIONS.back];
  assert.equal(new Set(all.map(r=>r.id)).size,16);
  assert.ok(getBodyRegion("front","front-left-arm").bounds.x > .5);
  assert.ok(getBodyRegion("back","back-left-arm").bounds.x < .5);
  assert.ok(getBodyRegion("front","front-left-leg").outline.every(p=>p.x>=.5));
  assert.ok(getBodyRegion("back","back-left-leg").outline.some(p=>p.x<.5));
  assert.equal(getBodyRegion("back","front-chest"),undefined);
  for (const r of all) for (const size of screens) {
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.outline));
    const t = focusViewport(fitViewport(...size,BODY_MODEL),r.bounds);
    const p = {x:r.bounds.x+r.bounds.width/2,y:r.bounds.y+r.bounds.height/2};
    samePoint(canvasToNormalized(normalizedToCanvas(p,t),t),p);
    for (const p of r.outline) assert.ok(p.x>=0 && p.x<=1 && p.y>=0 && p.y<=1);
  }
});
