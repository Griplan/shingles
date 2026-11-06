"""Record original SVG label/leader points for manual comparison; proximity is evidence, never automatic label assignment. No patient data."""
import sys,xml.etree.ElementTree as E,json,pathlib,re
sys.path.insert(0,str(pathlib.Path.cwd()/'scripts'));from svg_geometry import *
from shapely.geometry import Point
ns='{http://www.w3.org/2000/svg}'
for view,gi in [('front',9),('back',12)]:
 r=E.parse('docs/research/v3-atlas/goran-'+view+'.original.svg').getroot();g=list(r)[gi];from prepare_atlas import source_paths;items=source_paths(view);geoms=[item['geometry'] for item in items];last=''
 print('\n',view)
 for ei,e in enumerate(g):
  if e.tag==ns+'text':
   last=''.join(''.join(e.itertext()).split());
   if re.fullmatch('[TL][0-9]+',last):
    p=project((float(e.get('x')),float(e.get('y'))-5),multiply(transform(g.get('transform')),transform(e.get('transform'))));hits=[i for i in range(len(geoms)) if geoms[i].covers(Point(p))];print(ei,last,'direct',p,hits)
  elif e.tag==ns+'path' and 'marker-' in e.get('style',''):
   coords=path_rings(e.get('d'),transform(g.get('transform')))[0];p=coords[0] if 'marker-start' in e.get('style','') else coords[-1];hits=[(i,items[i]['color']) for i in range(len(geoms)) if geoms[i].distance(Point(p))<.5];print(ei,'preceding-text-context='+last+' (not necessarily the associated label)', 'leader',tuple(round(n,1) for n in p),hits)
