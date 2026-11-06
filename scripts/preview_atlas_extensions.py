"""True source/target vector evidence, explicitly NOT a WeChat runtime screenshot."""
import base64
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'docs/validation-records/v3.1-atlas'
ET.register_namespace('', 'http://www.w3.org/2000/svg')


def source(view):
    root = ET.parse(ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg').getroot()
    content = ''.join(ET.tostring(c, encoding='unicode') for c in root)
    # Multiple real SVGs share gradient/clip IDs. Namespace them per source so
    # a combined evidence sheet cannot accidentally borrow the other drawing.
    for element in root.iter():
        key = element.get('id')
        if key:
            content = content.replace('id="'+key+'"', 'id="'+view+'-'+key+'"').replace('url(#'+key+')', 'url(#'+view+'-'+key+')').replace('href="#'+key+'"', 'href="#'+view+'-'+key+'"')
    return content


def target(view, version='v2', selected=None):
    blob = base64.b64encode((ROOT/f'miniprogram/assets/body/commons-cc0/{view}.png').read_bytes()).decode()
    result = f'<image width="400" height="900" href="data:image/png;base64,{blob}"/>'
    data = json.loads((ROOT/f'data/atlas/goran-2022-preview-{version}/{view}.json').read_text())
    for r in data['regions']:
        if selected and r['labelId'] != selected:
            continue
        for polygon in r['geometry']['coordinates']:
            path = ' '.join('M'+' L'.join(f'{x*400:.8f},{y*900:.8f}' for x,y in ring)+' Z' for ring in polygon)
            result += f'<path d="{path}" fill="{r["color"]}" fill-opacity=".50" stroke="{r["color"]}" stroke-width=".3"/>'
    return result


def panel(x, y, width, height, bounds, title, contents):
    return f'<text x="{x+8}" y="{y+22}">{title}</text><svg x="{x}" y="{y+32}" width="{width}" height="{height-32}" viewBox="'+ ' '.join(map(str,bounds))+'" preserveAspectRatio="xMidYMid meet">'+contents+'</svg>'


def save(name, width, height, content):
    (OUT/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="15" fill="#23333a">'+content+f'<text x="10" y="{height-12}">OFFLINE SOURCE / RESOURCE PREVIEW. NOT WeChat screenshots. Goran_tek-en, CC BY-SA 4.0. Medical review pending.</text></g></svg>')


def main():
    OUT.mkdir(exist_ok=True, parents=True)
    face = (150, 25, 102, 145)
    content = panel(0,0,500,620,(135,0,154,165),'Original main face + original label leaders',source('front'))
    content += panel(500,0,400,620,face,'BEFORE / preview.1',target('front','v1'))
    content += panel(900,0,400,620,face,'AFTER / preview.2',target('front'))
    save('face-before-after',1300,660,content)
    content = ''.join(panel(i*400,0,400,590,face, f'{label} / actual source-derived geometry',target('front',selected=label)) for i,label in enumerate(('V1','V2','V3')))
    save('face-single-branches',1200,630,content)
    feet = (95,805,210,72)
    content = panel(0,0,660,350,(0,790,440,165),'Original FRONT / dorsum + toes / labels and leaders',source('front'))
    content += panel(660,0,660,350,feet,'BEFORE / front / preview.1',target('front','v1'))
    content += panel(0,350,660,350,feet,'AFTER / front / preview.2 / L4 L5 S1',target('front'))
    content += panel(660,350,330,350,(0,800,424,155),'Original BACK / plantar surface',source('back'))
    content += panel(990,350,330,350,feet,'Target BACK / heel / unconfigured',target('back'))
    save('feet-before-after',1320,740,content)
    content = ''.join(panel(i*400,0,400,920,(0,0,400,900),v+' / preview.2',target(v)) for i,v in enumerate(('front','back')))
    save('full-model-preview',800,960,content)
    print(OUT)


if __name__=='__main__':
    main()
