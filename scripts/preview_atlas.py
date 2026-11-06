"""Offline resource evidence, NOT a WeChat screenshot. No network or patient data."""
import base64,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ATLAS=ROOT/'data/atlas/goran-2022-preview-v1'
OUT=ROOT/'docs/validation-records/v3-atlas'
def image(path,x,y,w,h):
 return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/png;base64,{base64.b64encode(path.read_bytes()).decode()}"/>'
def overlay(view,labels=True):
 d=json.loads((ATLAS/(view+'.json')).read_text());s=image(ROOT/f'miniprogram/assets/body/commons-cc0/{view}.png',0,0,400,900)
 for r in d['regions']:
  for p in r['geometry']['coordinates']:
   path=' '.join('M'+' L'.join(f'{x*400:.5f},{y*900:.5f}' for x,y in ring)+' Z' for ring in p)
   s+=f'<path d="{path}" fill="{r["color"]}" fill-opacity=".29" stroke="{r["color"]}" stroke-width=".65"/>'
 if labels:
  for r in d['regions']:
   p=r['labelPoint'];s+=f'<text x="{p["x"]*400}" y="{p["y"]*900}" font-size="9" text-anchor="middle" paint-order="stroke" stroke="white" stroke-width="2" fill="#173d38">{r["labelId"]}</text>'
 return s
if __name__=='__main__':
 OUT.mkdir(parents=True,exist_ok=True)
 for v in ['front','back']:
  (OUT/(v+'-overlay.svg')).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 900">'+overlay(v)+'</svg>')
 panels=[]
 for i,v in enumerate(['front','back']):
  x=i*850
  panels.append(f'<text x="{x+15}" y="30">SOURCE: Goran_tek-en / CC BY-SA 4.0 / {v}</text>'+image(ROOT/f'docs/research/v3-atlas/goran-{v}-preview.png',x,50,420,900))
  panels.append(f'<text x="{x+440}" y="30">REGISTERED / engineering preview</text><g transform="translate({x+435},50)">'+overlay(v)+'</g>')
 (OUT/'source-registration-comparison.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1700 990"><rect width="1700" height="990" fill="#f8faf9"/><g font-family="sans-serif" font-size="15">'+''.join(panels)+'<text x="15" y="978">OFFLINE RESOURCE PREVIEW — not WeChat runtime evidence. Medical review pending. Excluded hands, feet, face and anterior perineum.</text></g></svg>')
 # Same unmodified source pixels and registered vectors; viewBox changes only the evidence viewport.
 sites=[('shoulder / axilla',{'front':((95,115,275,210),(70,155,260,190)),'back':((80,115,275,215),(75,140,250,210))}),
        ('forearm / excluded distal wrist',{'front':((75,330,310,180),(65,350,270,175)),'back':((65,330,310,180),(65,350,270,175))}),
        ('knee / ankle cutoff',{'front':((120,600,230,265),(110,590,180,245)),'back':((100,600,230,265),(110,590,180,245))})]
 panels=[]
 for row,(name,views) in enumerate(sites):
  for col,view in enumerate(['front','back']):
   src,tgt=views[view];x=col*850;y=row*340
   panels.append(f'<text x="{x+12}" y="{y+22}">{view}: {name} — source | registered</text>')
   for off,bounds,content in [(0,src,image(ROOT/f'docs/research/v3-atlas/goran-{view}-preview.png',0,0,440 if view=='front' else 424,955)),(425,tgt,overlay(view,False))]:
    panels.append(f'<svg x="{x+off}" y="{y+35}" width="415" height="295" viewBox="'+ ' '.join(map(str,bounds))+'" preserveAspectRatio="xMidYMid meet">'+content+'</svg>')
 (OUT/'key-sites-comparison.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1700 1060"><rect width="1700" height="1060" fill="#f8faf9"/><g font-family="sans-serif" font-size="16">'+''.join(panels)+'<text x="15" y="1050">OFFLINE RESOURCE COMPARISON / Goran_tek-en, CC BY-SA 4.0 / Medical review pending / Not WeChat screenshots.</text></g></svg>')
 print(OUT)
