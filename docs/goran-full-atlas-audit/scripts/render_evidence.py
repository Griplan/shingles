"""Audit-only vector viewports: original fills/labels/gradients unchanged."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT/'scripts'))
from preview_atlas_extensions import source, panel
OUT=ROOT/'docs/goran-full-atlas-audit/evidence'

def save(name,w,h,content,footer='Goran_tek-en / CC BY-SA 4.0. Original vector crop, no reconstructed boundaries. Offline audit; not clinical validation.'):
    (OUT/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" font-size="16" fill="#23333a">'+content+f'<text x="16" y="{h-14}" font-size="13">{footer}</text></g></svg>')

def main():
    for view,width in [('front',439.97),('back',423.6)]:
        save('original-'+view,700,1450,panel(0,0,700,1400,(0,0,width,954.58),f'Original {view} / labels and leader lines',source(view)))
    for side in ['left','right']:
        # Anatomical laterality: front screen-left is right; back screen-left is left.
        front_x=285 if side=='left' else 0
        back_x=0 if side=='left' else 260
        content=panel(0,0,580,760,(front_x,360,155,220),f'{side.upper()} hand / FRONT original (palm)',source('front'))
        content+=panel(580,0,580,760,(back_x,360,164,220),f'{side.upper()} hand / BACK original (dorsum)',source('back'))
        save(side+'-hand-original',1160,800,content)
        front_x=205 if side=='left' else 0
        back_x=0 if side=='left' else 205
        content=panel(0,0,580,650,(front_x,785,220,170),f'{side.upper()} foot / FRONT original',source('front'))
        content+=panel(580,0,580,650,(back_x,785,220,170),f'{side.upper()} foot / BACK original',source('back'))
        save(side+'-foot-original',1160,690,content)
    save('perineum-original',1150,720,panel(0,0,575,670,(110,440,220,220),'FRONT / groin and inner thighs',source('front'))+panel(575,0,575,670,(100,440,220,220),'BACK / sacral and perineal labels',source('back')))

if __name__=='__main__': main()
