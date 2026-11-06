"""Rebuild the independent development atlas from licensed SVG paths + audited source-map/registration.
Uses existing TypeScript + Shapely only. No network, patient annotations, matching or automatic medical boundaries.
"""
import bisect
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, LineString, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.validation import explain_validity
from svg_geometry import transform, multiply, path_rings, filled_geometry, flatten_geometry, distance

ROOT=Path(__file__).resolve().parents[1]
ATLAS=ROOT/'data/atlas/goran-2022-preview-v1'
RESEARCH=ROOT/'docs/research/v3-atlas'
VERSION='goran-2022-commons-template4-preview.1'
NS='{http://www.w3.org/2000/svg}'
EXPECTED_SHA1={'front':'d20be473843591779be22c102e193d8c1407861d','back':'261566ce5128fdc2cc536945c148ac1c8f62e66d'}

def read(name):return json.loads((ATLAS/name).read_text())
def write(name,data): (ATLAS/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def interpolate(x,rows):
    i=max(0,min(len(rows)-2,bisect.bisect_right([p[0] for p in rows],x)-1));a,b=rows[i:i+2]
    return a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0])
def spans(poly,y):
    cut=poly.intersection(LineString([(-100,y),(600,y)]));out=[]
    def walk(g):
        if g.geom_type=='LineString' and g.length>2:out.append((g.bounds[0],g.bounds[2]))
        elif hasattr(g,'geoms'):
            for child in g.geoms:walk(child)
    walk(cut);out.sort()
    # Only close sub-unit rendering seams between source flat shapes, not arm/body background.
    merged=[]
    for a,b in out:
        if merged and a-merged[-1][1]<.4:merged[-1]=(merged[-1][0],b)
        else:merged.append((a,b))
    return merged

def source_paths(view):
    path=RESEARCH/f'goran-{view}.original.svg';blob=path.read_bytes()
    assert hashlib.sha1(blob).hexdigest()==EXPECTED_SHA1[view], 'Source version changed'
    r=ET.fromstring(blob);g=list(r)[6 if view=='front' else 9];container=g[1]
    base=multiply(transform(g.get('transform')),transform(container.get('transform')));items=[]
    def walk(e,m,route):
        import re
        m=multiply(m,transform(e.get('transform')))
        fill=re.search(r'(?:^|;)fill:(#[0-9a-f]{6})(?:;|$)',e.get('style',''))
        if e.tag==NS+'path' and fill:
            items.append({'index':len(items),'elementRoute':route,'color':fill.group(1),'geometry':filled_geometry(path_rings(e.get('d'),m),'evenodd' if 'fill-rule:evenodd' in e.get('style','') else 'nonzero')})
        for i,c in enumerate(e):walk(c,m,route+'/'+str(i))
    for i,c in enumerate(container):walk(c,base,f'root/{6 if view=="front" else 9}/1/{i}')
    return items

def source_outline(view):
    r=ET.parse(RESEARCH/f'goran-{view}.original.svg').getroot();g=list(r)[6 if view=='front' else 9];path=g[0][0]
    m=multiply(transform(g.get('transform')),transform(path.get('transform')))
    return filled_geometry(path_rings(path.get('d'),m),'evenodd')

def models():
    with tempfile.TemporaryDirectory(prefix='dermatome-v3-model-') as build:
        # Compile only the frozen body dependency graph. Rebuilding does not depend
        # on an existing generated atlas package or import annotation-session.
        subprocess.run(['node',str(ROOT/'miniprogram/node_modules/typescript/bin/tsc'),str(ROOT/'miniprogram/data/body-models.ts'),'--target','ES2017','--module','commonjs','--lib','ES2020','--strict','--outDir',build],check=True)
        source="process.stdout.write(JSON.stringify(require(process.argv[1]+'/data/body-models.js').BODY_MODELS));"
        return json.loads(subprocess.check_output(['node','-e',source,build],text=True))

def main():
    source_map=read('source-map.json');registration=read('registration.json');model_data=models();report={};coverage=[]
    for view in ['front','back']:
        items=source_paths(view);assert len(items)==len(source_map['views'][view])
        inset=set([0,22,23,24,25,26,27] if view=='front' else [0,1,2,3,4,5,45])
        # Use the source's original whole-body silhouette for surface correspondence;
        # flat dermatome paths have narrow manufacturing seams, which are not body gaps.
        source_body=source_outline(view)
        model=model_data[view];body=Polygon([(p['x'],p['y']) for p in model['hitOutline']]);assert body.is_valid
        midline=registration['targetMidline'][view][0][1]
        assert all(p[1]==midline for p in registration['targetMidline'][view]), 'Only this explicitly registered vertical template midline is supported'
        rows=registration['sourceRows'][view]
        source_keep=box(-100,-100,600,842);left,right=registration['excludedSourceSurface']['hands']['keepX'][view]
        source_keep=source_keep.difference(box(-100,440,left,842)).difference(box(right,440,600,842))
        source_domain=source_body.intersection(source_keep)
        target_domain=body.intersection(box(0,0,400,820))
        target_domain=target_domain.difference(box(0,450,108,820)).difference(box(292,450,400,820))
        trusted=[]
        for k in range(21,1684):
            y=k*.5;ty=interpolate(y,rows);a,b=spans(source_domain,y),spans(target_domain,ty)
            if a and len(a)==len(b):
                controls=[]
                for src,tgt in zip(a,b):
                    controls.extend([(src[0],tgt[0]),((src[0]+src[1])/2,(tgt[0]+tgt[1])/2),(src[1],tgt[1])])
                if all(controls[i][0]>controls[i-1][0] and controls[i][1]>controls[i-1][1] for i in range(1,len(controls))):trusted.append((y,controls))
        assert len(trusted)>500,(view,'Too few compatible surface rows')
        row_ys=[r[0] for r in trusted]
        def warp(x,y):
            i=max(0,min(len(trusted)-2,bisect.bisect_right(row_ys,y)-1));a,b=trusted[i:i+2]
            t=(y-a[0])/(b[0]-a[0]);xx=interpolate(x,a[1])*(1-t)+interpolate(x,b[1])*t
            return (xx,interpolate(y,rows))
        def map_ring(ring):
            coords=list(ring.coords);out=[]
            def sample(a,b,depth=0):
                wa,wb=warp(*a),warp(*b);mid=((a[0]+b[0])/2,(a[1]+b[1])/2);wm=warp(*mid)
                if depth<16 and distance(wm,wa,wb)>.001:
                    sample(a,mid,depth+1);sample(mid,b,depth+1)
                else:out.append(wa)
            for a,b in zip(coords,coords[1:]):
                count=max(1,math.ceil(math.dist(a,b)/registration['mappingSampleSpacing']))
                for i in range(count):sample((a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count),(a[0]+(b[0]-a[0])*(i+1)/count,a[1]+(b[1]-a[1])*(i+1)/count))
            out.append(out[0]);return out
        def map_polygon(p):return Polygon(map_ring(p.exterior),[map_ring(r) for r in p.interiors])
        # Resolve visible source layers in their actual SVG paint order, not label order.
        visible={};painted=None
        for it in reversed(items):
            if it['index'] in inset:continue
            raw=it['geometry'];visible[it['index']]=raw if painted is None else raw.difference(painted)
            painted=raw if painted is None else painted.union(raw)
        mapped_by_label={};raw_outside={};source_records=[];sampling_nodes=[]
        for config,it in zip(source_map['views'][view],items):
            label=config['labelId'];index=it['index']
            if not label:continue
            if view=='front' and index in registration['excludedSourceSurface']['frontPerineumPathIndices']:
                source_records.append({'sourcePath':index,'label':label,'status':'unconfigured','reason':'Anterior perineum is not reliably visible on the neutral template.'});continue
            if view=='front' and index in registration['excludedSourceSurface']['frontDistalHandPathIndices']:
                source_records.append({'sourcePath':index,'label':label,'status':'unconfigured','reason':'Distal hand/wrist surface has incompatible palm orientation; excluded entirely, including residual slivers.'});continue
            src=visible[index].intersection(source_keep)
            polys=[map_polygon(p) for p in flatten_geometry(src) if p.area>.001]
            if not polys:
                source_records.append({'sourcePath':index,'label':label,'status':'unconfigured','reason':'Only excluded distal hand/foot surface remains.'});continue
            assert all(p.is_valid for p in polys),(view,index,[explain_validity(p) for p in polys if not p.is_valid],'Fix registration/sampling; no automatic target-path repair')
            raw=unary_union(polys);outside=raw.difference(body).area
            raw_outside[str(index)]={'rawArea':raw.area,'outsideArea':outside,'outsideFraction':outside/raw.area if raw.area else 0}
            # Explicit target-surface adaptation, with all pre-adaptation loss exposed in validation.json.
            mapped=raw.intersection(body)
            if mapped.is_empty:continue
            mapped_by_label.setdefault(label,[]).append((index,mapped,it['color']))
            source_records.append({'sourcePath':index,'elementRoute':it['elementRoute'],'label':label,'status':'registered','sourceVisibleArea':src.area,'mappedArea':mapped.area})
        regions=[];simplification=[]
        for label,entries in mapped_by_label.items():
            geometry=unary_union([e[1] for e in entries]);color=entries[0][2]
            for side,half in [('right' if view=='front' else 'left',box(0,0,midline,900)),('left' if view=='front' else 'right',box(midline,0,400,900))]:
                parts=flatten_geometry(geometry.intersection(half));parts=[p for p in parts if p.area>.00001]
                if not parts:continue
                normalized=[]
                for p in parts:
                    reduced=p.simplify(.01,preserve_topology=True)
                    if p.hausdorff_distance(reduced)>.01:reduced=p.simplify(.003,preserve_topology=True)
                    if p.hausdorff_distance(reduced)>.01:reduced=p
                    simplification.append({'label':label,'side':side,'areaDelta':abs(reduced.area-p.area),'hausdorff':p.hausdorff_distance(reduced),'verticesBefore':len(p.exterior.coords)+sum(len(h.coords) for h in p.interiors),'verticesAfter':len(reduced.exterior.coords)+sum(len(h.coords) for h in reduced.interiors)})
                    p=reduced
                    p=orient(p,sign=1.0)
                    normalized.append([[[round(x/400,10),round(y/900,10)] for x,y in ring.coords] for ring in [p.exterior,*p.interiors]])
                label_point=max(parts,key=lambda p:p.area).representative_point()
                source_label=next(c['sourceLabel'] for c in source_map['views'][view] if c['labelId']==label)
                regions.append({'id':view+'-'+side+'-'+label.replace('/','_').replace('-','_'),'atlasVersion':VERSION,'templateId':model['id'],'templateVersion':model['version'],'geometryId':model['geometryId'],'partitionType':'spinal_dermatome_composite' if ('/' in label or '-' in label) else 'spinal_dermatome','labelId':label,'sourceLabel':source_label,'view':view,'side':side,'color':color,'geometry':{'type':'MultiPolygon','coordinates':normalized},'labelPoint':{'x':label_point.x/400,'y':label_point.y/900},'sourceRefs':['commons-goran-2022-'+view],'sourcePathIndices':[e[0] for e in entries],'productionStatus':'registered_development_preview','medicalReviewStatus':'pending','derivation':'Both source sides independently retained; visible SVG fills -> monotone surface registration -> documented target-surface adaptation; no lesion inputs or mirroring.'})
        write(view+'.json',{'atlasVersion':VERSION,'view':view,'regions':regions})
        report[view]={'compatibleSurfaceRows':len(trusted),'preAdaptationBySourcePath':raw_outside,'samplingNoding':sampling_nodes,'simplificationToleranceLogicalPx':.01,'simplification':simplification,'sourcePaths':source_records,'regionCount':len(regions),'labelCount':len(mapped_by_label),'rawOutsideTotal':sum(r['outsideArea'] for r in raw_outside.values()),'note':'All raw outside losses are exposed. Clipping cannot certify anatomical registration; medical review pending.'}
        labels=sorted(set(c['labelId'] for c in source_map['views'][view] if c['labelId']))
        for label in labels:
            records=[r for r in source_records if r['label']==label]
            coverage.append({'labelId':label,'sourceLabel':next(c['sourceLabel'] for c in source_map['views'][view] if c['labelId']==label),'view':view,'sourcePresent':True,'sourcePathIndices':[c['pathIndex'] for c in source_map['views'][view] if c['labelId']==label],'configuredSides':[r['side'] for r in regions if r['labelId']==label],'partCount':sum(len(r['geometry']['coordinates']) for r in regions if r['labelId']==label),'status':'registered_preview' if any(r['labelId']==label for r in regions) else 'unconfigured','excludedPathReasons':[r['reason'] for r in records if r['status']=='unconfigured'],'surfaceLimit':'Only the visible surface before the documented hand/foot cutoff; source seams remain unconfigured. No inferred continuation to another surface.','medicalReviewStatus':'pending'})
        print(view,len(regions),'regions; compatible source rows',len(trusted),'pre-adaptation outside',report[view]['rawOutsideTotal'])
    write('coverage.json',{'atlasVersion':VERSION,'entries':coverage,'unconfigured':['Cranial V1/V2/V3, head inset, ambiguous source C1/Co1, distal hands/fingers, feet/toes and anterior perineum.','Blank coverage is not a statement of absent sensation.']})
    write('registration-report.json',report)

if __name__=='__main__':main()
