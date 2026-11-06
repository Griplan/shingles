"""Exact source vector evidence; no new medical geometry or production writes."""
import base64,json,sys,xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import shape,box
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'scripts'))
sys.path.insert(0,str(Path(__file__).parent))
from preview_atlas_extensions import source,panel,target
from render_evidence import save
from svg_geometry import flatten_geometry
OUT=ROOT/'docs/goran-full-atlas-audit/evidence'
def load(v):return json.loads((OUT/f'{v}-raw-source-regions.json').read_text())['regions']
def path(g,fill,opacity=1):
    s=''
    for p in flatten_geometry(g):
        d=' '.join('M'+' L'.join(f'{x:.6f},{y:.6f}' for x,y in ring.coords)+'Z' for ring in [p.exterior,*p.interiors])
        s+=f'<path d="{d}" fill="{fill}" fill-opacity="{opacity}" fill-rule="evenodd" stroke="#334044" stroke-width=".18"/>'
    return s
def cropgeo(v,bounds):
    contents='';records=[];window=box(bounds[0],bounds[1],bounds[0]+bounds[2],bounds[1]+bounds[3])
    for r in load(v):
        if r['scope']!='main-body':continue
        g=shape(r['geometry']).intersection(window)
        if g.area<1e-6:continue
        contents+=path(g,r['color']);records.append((r['index'],r['label']))
        p=max(flatten_geometry(g),key=lambda p:p.area).representative_point()
        contents+=f'<text x="{p.x:.3f}" y="{p.y:.3f}" font-size="4.5" text-anchor="middle" fill="black">p{r["index"]}</text>'
    return contents,records
def body_source_domains(v):
    contents='';a,b=(133,333) if v=='front' else (115,320)
    keep=box(-100,-100,600,842).difference(box(-100,440,a,842)).difference(box(b,440,600,842))
    for r in load(v):
        if r['scope']!='main-body':continue
        i=r['index'];g=shape(r['geometry']);retained=g.intersection(keep) if r['sourceMapLabel'] else g.difference(g)
        if v=='front' and i in (13,14,16):retained=g.intersection(box(185,9,282,130))
        if (v=='front' and i in (29,30,31,39,40)) or (v=='back' and i==21):retained=g.difference(g)
        if v=='front' and i in (36,37,38,41):retained=unary_union([retained,g.intersection(box(-100,842,600,945.5))])
        contents+=path(retained,'#58ab91',.8)+path(g.difference(retained),'#ed9c52',.9)
    return contents
def main():
    evidence=[]
    for v,w in [('front',439.97),('back',423.6)]:
        c=panel(0,0,500,1100,(0,0,w,954.58),v.upper()+' / original SVG',source(v))
        c+=panel(500,0,500,1100,(0,0,w,954.58),'Green retained input / orange excluded',body_source_domains(v))
        c+=panel(1000,0,440,1100,(0,0,400,900),'Current atlas on current template',target(v))
        c+='<text x="510" y="1128">Eligibility before target cuts; colours do not represent clinical coverage.</text>'
        save('coverage-'+v,1440,1175,c,'Goran_tek-en / CC BY-SA 4.0 source and derived atlas; CC0 display template. Offline comparison, not clinical validation.')
    for side in ('left','right'):
        fh=(315,420,124,135) if side=='left' else (20,420,124,135)
        bh=(10,420,124,135) if side=='left' else (300,420,124,135)
        ff=(235,835,110,115) if side=='left' else (120,835,110,115)
        bf=(110,835,110,115) if side=='left' else (235,835,110,115)
        for part,front,back in [('hand',fh,bh),('foot',ff,bf)]:
            c=''
            for k,(v,bounds) in enumerate([('front',front),('back',back)]):
                raw,records=cropgeo(v,bounds)
                c+=panel(k*600,0,600,640,bounds,side.upper()+' '+part+' / '+v+' raw vector fills',raw)
                c+=f'<text x="{k*600+12}" y="670" font-size="13">'+', '.join(f'p{i}: {l}' for i,l in records)+'</text>'
                evidence.append({'figure':side+'-'+part+'-paths','view':v,'viewport':bounds,'paths':records,'routes':'See path-inventory.csv; crop edges are not nerve boundaries.'})
            save(side+'-'+part+'-paths',1200,720,c)
    # Parallel panes preserve each source coordinate system and each native posture.
    bounds=(20,420,124,135);g,rec=cropgeo('front',bounds)
    c=panel(0,0,400,610,bounds,'Goran RIGHT palm: original',source('front'))
    c+=panel(400,0,400,610,bounds,'Goran: C6-8 + C8/T1 paths',g)
    serv=ET.parse(ROOT/'docs/validation-records/v6.1-recheck/servier-right-palm-source.svg').getroot()
    c+=panel(800,0,400,610,(1650,2180,420,550),'Servier RIGHT palm: source PPTX',''.join(ET.tostring(e,encoding='unicode') for e in serv))
    for k,side in enumerate(('left','right')):
        b64=base64.b64encode((ROOT/f'miniprogram/assets/palm/palm-{side}.png').read_bytes()).decode()
        drawing=f'<image width="440" height="700" href="data:image/png;base64,{b64}"/>'
        for r in json.loads((ROOT/f'data/atlas/palm-v1/palm-{side}.json').read_text())['regions']:
            from shapely.affinity import scale
            drawing+=path(scale(shape(r['geometry']),xfact=440,yfact=700,origin=(0,0)),r['color'],.48)
            p=scale(shape(r['geometry']),xfact=440,yfact=700,origin=(0,0)).representative_point()
            drawing+=f'<text x="{p.x}" y="{p.y}" font-size="18">{r["labelId"]}</text>'
        c+=panel(k*600,635,600,680,(0,0,440,700),'Current Gray '+side.upper()+' / registered Servier',drawing)
    c+='<text x="20" y="1340">Top: source poses kept. Bottom: current palm template, fingers up. No Goran replacement performed.</text>'
    c+='<text x="20" y="1364">Servier Medical Art: CC BY 4.0; Gray display: public domain; Goran panels: CC BY-SA 4.0.</text>'
    save('goran-servier-palms',1200,1410,c,'Separate source panels and existing registered data. No merged medical atlas. Offline comparison; medical review pending.')
    (OUT/'figure-index.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
