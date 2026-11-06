"""Render source/current vector evidence; NOT native WeChat screenshots."""
import json
from pathlib import Path
from preview_atlas_extensions import source,target,panel
from prepare_hand_atlas import ROOT,ATLAS
OUT=ROOT/'docs/validation-records/v6.5-main-body-hand/evidence'
def save(name,w,h,content):
 (OUT/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="17">'+content+f'<text x="12" y="{h-15}" font-size="13">OFFLINE SVG / resource evidence, NOT WeChat. Source: Goran_tek-en CC BY-SA 4.0; body CC0. Medical review pending.</text></g></svg>')
def main():
 d=json.loads((ATLAS/'hand-registration.json').read_text())
 for key,h in d['hands'].items():
  view,side=key.split('-');screenleft=(side=='right')==(view=='front')
  s=h['source'];xs=[p[0] for p in s];ys=[p[1] for p in s];sb=(min(xs)-5,420,max(xs)-min(xs)+10,max(ys)-410)
  p=h['oldTarget'];xs=[p[0] for p in p];ys=[p[1] for p in p];tb=(min(xs)-5,420,max(xs)-min(xs)+10,max(ys)-410)
  c=panel(0,0,480,720,sb,'Goran '+view+' / '+side+' / original',source(view))
  c+=panel(480,0,480,720,tb,'BEFORE / preview.2',target(view,'v2'))
  c+=panel(960,0,480,720,tb,'AFTER / preview.3',target(view,'v3'))
  save(key+'-comparison',1440,760,c)
 c=''.join(panel(i*430,0,430,970,(0,0,400,900),v+' / preview.3',target(v,'v3')) for i,v in enumerate(['front','back']))
 save('full-body-after',860,1010,c)
if __name__=='__main__':main()
