"""Compare sampled filled geometry, not SVG string formatting, in equal container coordinates."""
import sys,json,re,xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'scripts'))
from svg_geometry import IDENTITY,multiply,transform,path_rings,filled_geometry
P=ROOT/'docs/goran-full-atlas-audit/evidence';ORIG=P/'originals'
def geoms(e):
    out=[]
    def walk(e,m):
        m=multiply(m,transform(e.get('transform')))
        if e.tag.endswith('}path') and re.search(r'fill:#[0-9a-f]{6}',e.get('style','')):
            out.append(filled_geometry(path_rings(e.get('d'),m),'evenodd' if 'fill-rule:evenodd' in e.get('style','') else 'nonzero'))
        for c in e:walk(c,m)
    walk(e,IDENTITY);return out
def main():
    parent=E.parse(ORIG/'Dermatomes_labeled,_female-male_front-back_3d-shaded.svg').getroot();result=[]
    for name,pairs in [('Dermatomes_unlabeled,_male_front-back_3d-shaded.svg',[(4,10),(7,14)]),('Dermatomes_unlabeled,_female-male_front-back_3d-shaded.svg',[(2,2),(5,6),(8,10),(11,14)]),('Dermatomes_labeled,_male_front-back_3d-shaded.svg',[(6,10),(10,14)])]:
        r=E.parse(ORIG/name).getroot()
        for gi,pi in pairs:
            a,b=geoms(r[gi][1]),geoms(parent[pi][1]);assert len(a)==len(b)>0
            diffs=[x.symmetric_difference(y).area for x,y in zip(a,b)]
            assert max(diffs)<1e-9
            result.append({'file':name,'group':f'root/{gi}/1','parentGroup':f'root/{pi}/1','paths':len(a),
                'maxSymmetricDifferenceArea':max(diffs),'sumSymmetricDifferenceArea':sum(diffs),
                'comparisonSpace':'Same container coordinates; layout translation excluded; existing adaptive sampler .12 source units.'})
    (P/'unlabeled-geometry-comparison.json').write_text(json.dumps(result,indent=2)+'\n');print('PASSED',len(result),'group comparisons')
if __name__=='__main__':main()
