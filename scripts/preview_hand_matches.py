"""Actual evaluate results on synthetic lesions; static resource rendering only."""
import sys,json,base64
from pathlib import Path
from preview_atlas_extensions import panel
from preview_main_hands import save,main,ROOT,OUT,ATLAS

def run():
 examples=json.loads((OUT/'hand-matching-examples.json').read_text());content=''
 for i,e in enumerate(examples):
  v,s=e['name'].split('-');regions=json.loads((ATLAS/(v+'.json')).read_text())['regions'];c=e['response']['lesions'][0];candidates=c['candidates'];assert len(candidates)>=2
  left=(s=='right')==(v=='front');bounds=(20 if left else 292,432,90,96)
  for row,chosen in enumerate([candidates,[candidates[0]]]):
   ids={r for x in chosen for r in x['region_ids']};blob=base64.b64encode((ROOT/f'miniprogram/assets/body/commons-cc0/{v}.png').read_bytes()).decode();g=f'<image width="400" height="900" href="data:image/png;base64,{blob}"/>'
   for r in regions:
    if r['id'] not in ids:continue
    for polygon in r['geometry']['coordinates']:
     path=' '.join('M'+' L'.join(f'{x*400},{y*900}' for x,y in ring)+' Z' for ring in polygon)
     g+=f'<path d="{path}" fill="{r["color"]}" fill-opacity=".4" stroke="{r["color"]}" stroke-width=".2"/>'
   ring=e['request']['lesions'][0]['vertices'];p='M'+' L'.join(f'{p["x"]*400},{p["y"]*900}' for p in ring)+' Z';g+=f'<path d="{p}" fill="none" stroke="#aa4f30" stroke-width=".7"/>'
   title=e['name']+' / '+('ALL ' if row==0 else 'SINGLE ')+','.join(x['label'] for x in chosen)
   content+=panel(i*410,row*510,410,500,bounds,title,g)
 save('hand-matching-examples',1640,1050,content)
if __name__=='__main__':main();run()
