"""Independent Shapely oracle for V2 whole-polygon coverage. Synthetic inputs only, no medical claims."""
import json
from pathlib import Path
import random
import math
import subprocess
import tempfile
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]

def polygon(points):
    return Polygon([(p['x'], p['y']) for p in points])

def main():
    fixture = json.loads((ROOT/'backend/tests/fixtures/synthetic-annotation-geometry.json').read_text())
    assert fixture['synthetic'] is True
    with tempfile.TemporaryDirectory(prefix='dermatome-v2-oracle-') as build:
        subprocess.run(['node',str(ROOT/'miniprogram/node_modules/typescript/bin/tsc'),'--project',str(ROOT/'miniprogram/tsconfig.json'),'--noEmit','false','--outDir',build], check=True)
        loader = "const p=process.argv[1],g=require(p+'/utils/annotation-geometry.js'),m=require(p+'/data/body-models.js').BODY_MODELS;process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(m).map(([v,m])=>[v,g.bodyGeometry(m)]))));"
        bodies = dict(fixture['bodies'])
        actual = json.loads(subprocess.check_output(['node','-e',loader,build],text=True))
        bodies.update(actual)
        shapes = {}
        for name,parts in bodies.items():
            components = [Polygon([(p['x'],p['y']) for p in part['outer']], [[(p['x'],p['y']) for p in h] for h in part['holes']]) for part in parts]
            assert all(s.is_valid and s.area>0 for s in components), name
            combined = unary_union(components)
            assert combined.is_valid, name
            shapes[name] = combined
            if name in actual:
                assert len(parts)==1 and not parts[0]['holes'] and combined.geom_type=='Polygon'
                print(f'PASSED actual {name}: valid simple single outer body, no holes; {len(parts[0]["outer"])} source vertices')
        cases = list(fixture['cases'])
        generator = random.Random(20261023)
        for name in bodies:
            for _ in range(400):
                cx,cy = generator.uniform(.12,.88),generator.uniform(.12,.88)
                angles = sorted(generator.uniform(0,2*math.pi) for _ in range(generator.randint(3,12)))
                points = []
                for angle in angles:
                    radius = generator.uniform(.015,.12)
                    points.append({'x':cx+radius*math.cos(angle),'y':cy+radius*math.sin(angle)})
                shape = polygon(points)
                expected = all(0<=p['x']<=1 and 0<=p['y']<=1 for p in points) and shape.is_valid and shape.area>1e-10 and shapes[name].covers(shape)
                cases.append({'name':name,'body':name,'vertices':points,'expected':expected})
        source = "const fs=require('fs'),g=require(process.argv[1]+'/utils/annotation-geometry.js'),d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(d.cases.map(c=>g.validatePolygon(c.vertices,d.bodies[c.body]).ok)));"
        results=json.loads(subprocess.check_output(['node','-e',source,build], input=json.dumps({'bodies':bodies,'cases':cases}),text=True))
        for case,result in zip(cases,results):
            assert result==case['expected'], (case['name'],case['expected'],result)
        for view,body in actual.items():
            for name in ['UI-A','UI-B','UI-cross-navigation']:
                assert shapes[view].covers(polygon(fixture['editor'][name])), (view,name)
        print(f'PASSED: {len(cases)} deterministic fixture/random cases agree with independent Shapely validity and covers; seed 20261023, 400 cases/body, {len(bodies)} bodies.')
        print('Node geometry audit only; not WeChat runtime, clinical accuracy or handset performance.')

if __name__=='__main__':
    main()
