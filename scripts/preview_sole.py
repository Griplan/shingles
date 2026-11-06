"""Offline resource/geometry previews. Never presented as WeChat screenshots."""
import json, xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import shape
from shapely.affinity import scale
from build_sole_atlas import svg_path, ROOT, WIDTH, HEIGHT
OUT=ROOT/'docs/validation-records/v6.4'

def panel(side,x,labels):
 view='sole-'+side
 svg=ET.parse(ROOT/f'miniprogram/assets/sole/{view}.svg').getroot()
 svg.set('x',str(x));svg.set('y','38')
 rows=json.loads((ROOT/f'data/atlas/sole-v1/{view}.json').read_text())['regions']
 for r in rows:
  if r['labelId'] not in labels:continue
  g=scale(shape(r['geometry']),WIDTH,HEIGHT,origin=(0,0))
  ET.SubElement(svg,'{http://www.w3.org/2000/svg}path',{'d':svg_path(g),'fill':r['color'],'fill-opacity':'.52','stroke':r['color'],'stroke-width':'1','fill-rule':'evenodd'})
 return ET.tostring(svg,encoding='unicode')

def main():
 for name,labels in [('models',[]),('atlas',['L5','S1']),('L5',['L5']),('S1',['S1'])]:
  # Prefix each panel IDs because SVG gradient IDs are document scoped.
  left=panel('left',0,labels);right=panel('right',340,labels)
  import re
  right=re.sub(r'id="([^"]+)"',r'id="r-\1"',right);right=re.sub(r'url\(#([^)]+)\)',r'url(#r-\1)',right);right=re.sub(r'(href=")#',r'\1#r-',right)
  (OUT/(name+'.svg')).write_text('<svg xmlns="http://www.w3.org/2000/svg" width="660" height="725"><rect width="100%" height="100%" fill="#f4f8f6"/><g font-family="sans-serif" font-size="17" fill="#294e40"><text x="95" y="27">LEFT / SOLE</text><text x="435" y="27">RIGHT / SOLE</text></g>'+left+right+f'<text x="12" y="701" font-family="sans-serif" font-size="11">Goran_tek-en / CC BY-SA 4.0 | {name} | Offline resources, not WeChat | Medical review pending</text></svg>')
if __name__=='__main__':main()
