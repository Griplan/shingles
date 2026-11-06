"""Independent Shapely oracle for V5.3 whole-MultiPolygon/body coverage.

Only generated, non-medical geometry is used. This does not evaluate AI quality,
anatomical registration, WeChat gestures, or clinical accuracy.
"""
import json
import math
from pathlib import Path
import random
import subprocess
import tempfile

from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SEED = 20261031


def points(ring):
    return [{"x": float(x), "y": float(y)} for x, y in ring]


def coordinates(shape):
    parts = [shape] if shape.geom_type == "Polygon" else list(shape.geoms)
    result = []
    for part in parts:
        part = orient(part, sign=1.0)
        result.append([points(part.exterior.coords), *[points(h.coords) for h in part.interiors]])
    return result


def body_part(outer, holes=()):
    return {"outer": points(outer), "holes": [points(h) for h in holes]}


def box(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]


def shape_from_parts(parts):
    return unary_union([Polygon([(p["x"], p["y"]) for p in part["outer"]],
                                [[(p["x"], p["y"]) for p in hole] for hole in part["holes"]])
                        for part in parts])


def main():
    with tempfile.TemporaryDirectory(prefix="dermatome-v53-oracle-") as build:
        subprocess.run(["node", str(ROOT / "miniprogram/node_modules/typescript/bin/tsc"),
                        "--project", str(ROOT / "miniprogram/tsconfig.json"), "--noEmit", "false",
                        "--outDir", build], check=True)
        loader = """const root=process.argv[1],g=require(root+'/utils/annotation-geometry.js'),
          models=require(root+'/data/body-models.js').BODY_MODELS;
          process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(models).map(([v,m])=>[v,g.bodyGeometry(m)]))));"""
        actual = json.loads(subprocess.check_output(["node", "-e", loader, build], text=True))
        bodies = {
            "solid": [body_part(box(.1, .1, .9, .9))],
            "notch": [body_part([(.1,.1),(.9,.1),(.9,.9),(.6,.9),(.6,.4),(.4,.4),(.4,.9),(.1,.9),(.1,.1)])],
            "hole": [body_part(box(.1,.1,.9,.9), [box(.4,.4,.6,.6)])],
            "multipart": [body_part(box(.1,.1,.4,.9)),body_part(box(.6,.1,.9,.9))],
            **actual,
        }
        shapes = {name: shape_from_parts(parts) for name, parts in bodies.items()}
        assert all(s.is_valid and s.area > 0 for s in shapes.values())
        cases = []

        def add(name, body, shape):
            coords = coordinates(shape)
            normalized = all(0 <= p["x"] <= 1 and 0 <= p["y"] <= 1
                             for poly in coords for ring in poly for p in ring)
            parts = [shape] if shape.geom_type == "Polygon" else list(shape.geoms)
            # Random/explicit input avoids numerical degeneracy; explicit invalid
            # topology remains invalid even if a unary union would repair it.
            expected = bool(normalized and not shape.is_empty and shape.is_valid and
                            all(p.area > 0 for p in parts) and shapes[body].covers(shape))
            cases.append({"name": name, "body": body, "geometry": {
                "type": "MultiPolygon", "coordinateSpace": "body_template_normalized_v1",
                "coordinates": coords}, "expected": expected})

        add("single-inside", "solid", Polygon(box(.2,.2,.3,.3)))
        add("two-disjoint", "solid", MultiPolygon([Polygon(box(.2,.2,.3,.3)), Polygon(box(.7,.7,.8,.8))]))
        add("lesion-hole-preserved", "solid", Polygon(box(.2,.2,.8,.8), [box(.4,.4,.6,.6)]))
        add("all-vertices-in-body-but-edge-crosses-notch", "notch", Polygon([(.2,.8),(.8,.8),(.5,.2),(.2,.8)]))
        add("all-vertices-in-body-but-fill-covers-body-hole", "hole", Polygon(box(.2,.2,.8,.8)))
        add("lesion-hole-excludes-exact-body-hole", "hole", Polygon(box(.2,.2,.8,.8), [box(.4,.4,.6,.6)]))
        add("lesion-hole-larger-than-body-hole", "hole", Polygon(box(.2,.2,.8,.8), [box(.35,.35,.65,.65)]))
        add("lesion-hole-smaller-than-body-hole", "hole", Polygon(box(.2,.2,.8,.8), [box(.45,.45,.55,.55)]))
        add("one-component-outside", "solid", MultiPolygon([Polygon(box(.2,.2,.3,.3)), Polygon(box(.91,.91,.96,.96))]))
        add("one-component-per-body-part", "multipart", MultiPolygon([Polygon(box(.2,.2,.3,.3)), Polygon(box(.7,.7,.8,.8))]))
        add("bridge-between-body-parts", "multipart", Polygon(box(.2,.2,.8,.3)))
        add("shared-body-boundary", "solid", Polygon(box(.1,.1,.3,.3)))
        add("fully-outside", "solid", Polygon(box(.01,.01,.05,.05)))
        add("invalid-crossed-ring", "solid", Polygon([(.2,.2),(.8,.8),(.2,.8),(.8,.2),(.2,.2)]))
        add("invalid-hole-outside-shell", "solid", Polygon(box(.2,.2,.4,.4), [box(.6,.6,.7,.7)]))
        add("invalid-hole-crossing-shell", "solid", Polygon(box(.2,.2,.5,.5), [box(.4,.4,.7,.7)]))
        add("invalid-overlapping-parts", "solid", MultiPolygon([Polygon(box(.2,.2,.5,.5)),Polygon(box(.4,.4,.7,.7))]))
        add("valid-hole-touches-shell-once", "solid", Polygon(box(.2,.2,.8,.8),
            [[(.5,.2),(.65,.5),(.5,.6),(.35,.5),(.5,.2)]]))
        add("invalid-hole-disconnects-interior", "solid", Polygon(box(.2,.2,.8,.8),
            [[(.5,.2),(.65,.5),(.5,.8),(.35,.5),(.5,.2)]]))
        add("invalid-hole-chain-disconnects-interior", "solid", Polygon(box(.2,.2,.8,.8),
            [[(.2,.5),(.35,.35),(.5,.5),(.35,.65),(.2,.5)],
             [(.5,.5),(.65,.35),(.8,.5),(.65,.65),(.5,.5)]]))
        add("valid-three-holes-share-one-point", "solid", Polygon(box(.15,.15,.85,.85),
            [[(.5,.5),(.3,.3),(.5,.3),(.5,.5)],
             [(.5,.5),(.7,.3),(.7,.5),(.5,.5)],
             [(.5,.5),(.7,.7),(.5,.7),(.5,.5)]]))

        generator = random.Random(SEED)
        for body in bodies:
            for index in range(220):
                parts = []
                for _ in range(generator.choice([1, 1, 2])):
                    cx,cy = generator.uniform(.05,.95),generator.uniform(.05,.95)
                    radius = generator.uniform(.008,.2)
                    sides = generator.randint(3,10)
                    theta = generator.uniform(-math.pi, math.pi)
                    shell = [(cx+radius*math.cos(theta+2*math.pi*i/sides),
                              cy+radius*math.sin(theta+2*math.pi*i/sides)) for i in range(sides)]
                    holes = []
                    if generator.random() < .4:
                        # A concentric 1/3-size ring lies strictly inside this
                        # regular convex polygon for all generated side counts.
                        holes = [[(cx+(x-cx)/3,cy+(y-cy)/3) for x,y in shell]]
                    parts.append(Polygon(shell, holes))
                shape = parts[0] if len(parts)==1 else MultiPolygon(parts)
                add(f"seed-{SEED}-{body}-{index}",body,shape)

        source = """const fs=require('fs'),g=require(process.argv[1]+'/utils/placement-geometry.js'),
          d=JSON.parse(fs.readFileSync(0,'utf8'));
          process.stdout.write(JSON.stringify(d.cases.map(c=>{
            try{return g.validatePlacementGeometry(c.geometry,d.bodies[c.body]);}
            catch(e){return {ok:false,thrown:String(e.message)}}
          })));"""
        results=json.loads(subprocess.check_output(["node","-e",source,build],
                           input=json.dumps({"bodies":bodies,"cases":cases}),text=True))
        mismatches=[]
        for case,result in zip(cases,results):
            if result.get("ok") != case["expected"]:
                mismatches.append({"name":case["name"],"expected":case["expected"],"actual":result,
                                   "geometry":case["geometry"],"body":case["body"]})
        if mismatches:
            print(json.dumps({"status":"FAILED","mismatches":mismatches},ensure_ascii=False,indent=2))
            raise SystemExit(1)
        print(f"PASSED: {len(cases)} MultiPolygon validity/covers cases agree with independent Shapely; "
              f"seed {SEED}, {len(bodies)} bodies including actual front/back, 220 generated cases/body.")
        print("Includes disconnected pieces, preserved holes, hidden background bridges, invalid topology and boundary contact.")
        print("Synthetic engineering oracle only; not AI segmentation accuracy, anatomical registration, or WeChat runtime.")


if __name__ == "__main__":
    main()
