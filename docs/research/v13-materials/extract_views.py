"""Extract licensed source groups for research previews; leave originals untouched."""
from pathlib import Path
import copy
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
SVG = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', 'http://www.w3.org/2000/svg')
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
for key in ('a-male', 'a-female', 'b-original'):
    original = ET.fromstring((ROOT / (key + '.svg')).read_bytes())
    if key.startswith('a-'):
        groups = [c for c in original if c.tag == SVG + 'g']
        selections = [('front', groups[0]), ('back', groups[1])]
    else:
        groups = {g.get('id'): g for g in original.find(SVG + 'g')}
        selections = [('front', groups['g5423']), ('back', groups['g4158'])]
    for view, selected in selections:
        document = copy.deepcopy(original)
        layer = document if key.startswith('a-') else document.find(SVG + 'g')
        for child in list(layer):
            if child.tag == SVG + 'g':
                layer.remove(child)
        layer.append(copy.deepcopy(selected))
        target = (key if key.startswith('a-') else 'b-male') + '-' + view + '-preview.svg'
        ET.ElementTree(document).write(ROOT / target, encoding='utf-8', xml_declaration=True)
print('Extracted six real source views. No redraw, mirroring, region data or runtime changes.')
