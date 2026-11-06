"""Read-only audit of sources and current atlas. Writes ONLY this audit directory."""
import collections, csv, hashlib, json, re, sys, xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
from prepare_atlas import source_paths, source_outline
from svg_geometry import flatten_geometry, path_rings, multiply, transform, IDENTITY
OUT=ROOT/'docs/goran-full-atlas-audit/evidence'
ATLAS=ROOT/'data/atlas/goran-2022-preview-v2'
NS='{http://www.w3.org/2000/svg}'
INSET={'front':{0,22,23,24,25,26,27},'back':{0,1,2,3,4,5,45}}
INSET_LABELS={'front':{0:'C5',22:'C2',23:'C3',24:'V3',25:'V1',26:'V2',27:'C4'},'back':{0:'C3',1:'C4',2:'C2',3:'V1',4:'V2',5:'C5',45:'V3'}}
def read(p):return json.loads(p.read_text())
def write(name,d): (OUT/name).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def route_node(root,route):
    for i in route.split('/')[1:]:root=root[int(i)]
    return root
def svg_tree(path):
    root=ET.parse(path).getroot();nodes=[];texts=[]
    def walk(e,route,hidden=False,defs=False):
        style=e.get('style','');hidden=hidden or 'display:none' in style or e.get('display')=='none'
        defs=defs or e.tag==NS+'defs'
        local=e.tag.split('}')[-1]
        record={'route':route,'tag':local,'id':e.get('id'),'hiddenByDisplay':hidden,'inDefs':defs,'transform':e.get('transform'),'style':style}
        if local in ('g','use','image','clipPath','mask','text'):
            if local=='text':
                record['text']=''.join(e.itertext()).strip();texts.append(record.copy())
            if local=='image':
                href=e.get('{http://www.w3.org/1999/xlink}href',e.get('href',''))
                record['hrefType']='embedded' if href.startswith('data:') else href
            nodes.append(record)
        for i,c in enumerate(e):walk(c,route+'/'+str(i),hidden,defs)
    walk(root,'root')
    return {'file':str(path.relative_to(ROOT)),'sha256':sha(path),'svg':root.attrib,
        'tagCounts':dict(collections.Counter(e.tag.split('}')[-1] for e in root.iter())),
        'nodes':nodes,'texts':texts}

def main():
    source_map=read(ATLAS/'source-map.json');body=read(ROOT/'data/body/commons-template4.json')
    summary={};rows=[];all_labels=collections.defaultdict(lambda:{'front':[],'back':[]});views={}
    for view in ('front','back'):
        original=ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg';root=ET.parse(original).getroot()
        tree=svg_tree(original);write(view+'-svg-tree.json',tree)
        items=source_paths(view);visible={};painted=None
        for item in reversed(items):
            i=item['index']
            if i in INSET[view]:continue
            raw=item['geometry'];visible[i]=raw if painted is None else raw.difference(painted)
            painted=raw if painted is None else raw.union(painted)
        exported=read(ATLAS/(view+'.json'))['regions'];geoms=[shape(r['geometry']) for r in exported]
        refs=collections.defaultdict(list)
        for region in exported:
            for i in region['sourcePathIndices']: refs[i].append(region['id'])
        keep=box(-100,-100,600,842)
        a,b=(133,333) if view=='front' else (115,320)
        keep=keep.difference(box(-100,440,a,842)).difference(box(b,440,600,842))
        used={};tiny=[]
        for item,cfg in zip(items,source_map['views'][view]):
            i=item['index'];inset=i in INSET[view];label=INSET_LABELS[view].get(i,cfg['labelId'])
            if view=='back' and i==35:label='C1 (source literal; meaning UNKNOWN)'
            g=item['geometry'] if inset else visible[i]
            retained=g.intersection(keep) if cfg['labelId'] and not inset else g.difference(g)
            if view=='front' and i in (13,14,16): retained=g.intersection(box(185,9,282,130))
            if view=='front' and i in (29,30,31,39,40):retained=g.difference(g)
            if view=='back' and i==21:retained=g.difference(g)
            if view=='front' and i in (36,37,38,41):retained=unary_union([retained,g.intersection(box(-100,842,600,945.5))])
            used[i]=retained
            if not inset:
                all_labels[label][view].append(i)
                tiny.extend({'path':i,'area':p.area} for p in flatten_geometry(retained) if 0<p.area<=.001)
            sides=[]
            # Source-specific midline between both original limbs; not target x=.5.
            mid=233 if view=='front' else 218
            for label_side,half in [('right' if view=='front' else 'left',box(-100,-100,mid,1000)),('left' if view=='front' else 'right',box(mid,-100,600,1000))]:
                if not inset and g.intersection(half).area>1e-8:sides.append(label_side)
            e=route_node(root,item['elementRoute'])
            rows.append({'view':view,'index':i,'route':item['elementRoute'],'elementId':e.get('id'),
                'label':label,'scope':'lateral-head-inset' if inset else 'main-body','sourceMapLabel':cfg['labelId'],
                'color':item['color'],'pathD_SHA256':hashlib.sha256(e.get('d','').encode()).hexdigest(),
                'sourceBounds':list(g.bounds),'rawParts':len(flatten_geometry(item['geometry'])),
                'visibleParts':len(flatten_geometry(g)),'visibleArea':g.area,'valid':g.is_valid,
                'sides':sides,'currentRegionIds':refs[i],
                'sourceDomainRetainedArea':retained.area,'sourceDomainExcludedArea':g.difference(retained).area,
                'sourceDomainNote':'Source-domain eligibility only; later target-surface cuts/sampling/simplification are separate.',
                'geometry':mapping(g)})
        union=unary_union(geoms);surface=shape(body['views'][view]['geometry'])
        main=[r for r in rows if r['view']==view and r['scope']=='main-body']
        summary[view]={'paintedPathsIncludingInset':len(items),'mainBodyPaths':len(main),
            'mainKnownLabels':len([x for x in all_labels if all_labels[x][view] and not x.startswith('C1 ')]),
            'currentRegions':len(exported),'currentLabels':len({r['labelId'] for r in exported}),
            'currentPolygonParts':sum(len(g.geoms) for g in geoms),
            'currentHoles':sum(len(p.interiors) for g in geoms for p in g.geoms),
            'currentAllValid':all(g.is_valid for g in geoms),
            'representedMainPaths':len([r for r in main if r['currentRegionIds']]),
            'whollyUnrepresentedMainPaths':[r['index'] for r in main if not r['currentRegionIds']],
            'visibleSourceParts':sum(r['visibleParts'] for r in main),
            'sourceDomainUsedFraction':unary_union(list(used.values())).area/unary_union(list(visible.values())).area,
            'sourceSmallFragmentsBelowExistingThreshold':tiny,
            'targetVisibleSurfaceArea':surface.area,'targetAtlasUnionArea':union.area,
            'targetSurfaceCoveredFraction':union.intersection(surface).area/surface.area,
            'targetOutsideArea':union.difference(surface).area,
            'internalOverlapAreaSumMinusUnion':sum(g.area for g in geoms)-union.area,
            'notMedicalCoverage':True}
        # Raw source-space evidence only, never a production atlas.
        write(view+'-raw-source-regions.json',{'coordinateSpace':'original_svg_user_units','view':view,'auditOnly':True,'regions':[r for r in rows if r['view']==view]})
        views[view]={'items':items,'used':used,'visible':visible}
    labels=[]
    for label,indices in all_labels.items():
        entry={'label':label,'frontPaths':indices['front'],'backPaths':indices['back']}
        entry['sourceSideInstances']=sum(len(r['sides']) for r in rows if r['scope']=='main-body' and r['label']==label)
        entry['currentRegionCount']=sum(len([r for r in read(ATLAS/(v+'.json'))['regions'] if r['labelId']==label]) for v in ('front','back'))
        labels.append(entry)
    write('summary.json',summary);write('label-inventory.json',labels)
    with (OUT/'path-inventory.csv').open('w') as f:
        fields=['view','index','route','elementId','scope','label','sides','visibleParts','visibleArea','sourceDomainRetainedArea','sourceDomainExcludedArea','currentRegionIds','pathD_SHA256']
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows({k:r[k] for k in fields} for r in rows)
    trees=[]
    for p in sorted((OUT/'originals').glob('*.svg')):trees.append(svg_tree(p))
    write('downloaded-svg-structures.json',trees)
    # All leader endpoints, not only the first subpath as in the historical helper.
    leaders=[]
    for view,gi in [('front',9),('back',12)]:
        r=ET.parse(ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg').getroot();g=r[gi]
        for i,e in enumerate(g):
            if e.tag==NS+'path' and 'marker-' in e.get('style',''):
                mat=multiply(transform(g.get('transform')),transform(e.get('transform')))
                rings=path_rings(e.get('d'),mat)
                for j,ring in enumerate(rings):
                    if not ring:continue
                    from shapely.geometry import Point
                    p=ring[0] if 'marker-start' in e.get('style','') else ring[-1]
                    hits=[it['index'] for it in views[view]['items'] if it['geometry'].distance(Point(p))<.5]
                    leaders.append({'view':view,'route':f'root/{gi}/{i}','subpath':j,'endpoint':p,'pathCandidates':hits,'note':'Geometric evidence, label association still visually audited.'})
    write('all-leader-endpoints.json',leaders)
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
