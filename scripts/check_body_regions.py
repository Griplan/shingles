"""V1.6 engineering geometry audit. Existing TS compiler and Shapely only; no medical atlas."""
import json
from pathlib import Path
import subprocess
import tempfile
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]

def main():
    with tempfile.TemporaryDirectory(prefix="dermatome-region-audit-") as build:
        subprocess.run(["node", str(ROOT/"miniprogram/node_modules/typescript/bin/tsc"),
                        "--project", str(ROOT/"miniprogram/tsconfig.json"), "--noEmit", "false", "--outDir", build], check=True)
        source = "const p=process.argv[1];process.stdout.write(JSON.stringify({models:require(p+'/data/body-models.js').BODY_MODELS,old:require(p+'/data/body-regions-v15.js').BODY_REGIONS}));"
        data = json.loads(subprocess.check_output(["node", "-e", source, build],text=True))
    for view, model in data["models"].items():
        body = Polygon([(p['x'],p['y']) for p in model['hitOutline']])
        def polygon(region):
            return Polygon([(p['x']*400,p['y']*900) for p in region['outline']])
        current = [(r,polygon(r)) for r in model['regions']]
        for r,p in current:
            assert p.is_valid and p.area>0 and p.exterior.is_closed, r['id']
            assert 3<=len(r['outline'])<=40, r['id']
            b=r['bounds']
            assert all(0<=q['x']<=1 and 0<=q['y']<=1 and b['x']-1e-12<=q['x']<=b['x']+b['width']+1e-12 and b['y']-1e-12<=q['y']<=b['y']+b['height']+1e-12 for q in r['outline']), r['id']
        for i,(r,p) in enumerate(current):
            for s,q in current[i+1:]:
                assert p.intersection(q).area<1e-7,(r['id'],s['id'],p.intersection(q).area)
        missing=body.difference(unary_union([p for _,p in current])).area
        assert missing<1e-7,(view,'unassigned source-body area',missing)
        torso='chest' if view=='front' else 'upper-back'
        old={r['id']:polygon(r) for r in data['old'][view]}
        new={r['id']:p for r,p in current}
        for side in ['left','right']:
            a=view+'-'+torso;b=view+'-'+side+'-arm'
            before=old[a].intersection(old[b]).intersection(body).area
            after=new[a].intersection(new[b]).intersection(body).area
            print(f'{view} {side} torso/arm source-body overlap: old={before:.6f}, new={after:.6f} logical square units')
            assert new[a].boundary.intersection(new[b].boundary).length>45
        print(f'PASSED: {view}: 8 valid closed simple polygons, 28 pairs zero interior overlap, shared torso/arm edges, focus containment, source-body coverage (unassigned area={missing:.8f}).')
    print('Engineering UI geometry only; no medical or real-WeChat acceptance claim.')

if __name__=='__main__':
    main()
