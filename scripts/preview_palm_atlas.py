"""Static preview of the actual shipped palm geometry; not a WeChat screenshot."""
from pathlib import Path
import base64
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'data/sources/servier-palm-v1/palm-atlas-preview.svg'
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="980" height="820" viewBox="0 0 980 820">',
         '<rect width="980" height="820" fill="#f8faf8"/>',
         '<g font-family="Arial, sans-serif" fill="#274c42">',
         '<text x="30" y="28" font-size="18">SOURCE-DERIVED REFERENCE PREVIEW — medical review pending</text>']
for index, view in enumerate(['palm-left', 'palm-right']):
    xoff = 30+index*490
    parts.append(f'<text x="{xoff+155}" y="60" font-size="20">{view}</text>')
    parts.append(f'<g transform="translate({xoff} 70)">')
    image = base64.b64encode((ROOT/f'miniprogram/assets/palm/{view}.png').read_bytes()).decode()
    parts.append(f'<image width="440" height="700" href="data:image/png;base64,{image}"/>')
    regions = json.loads((ROOT/f'data/atlas/palm-v1/{view}.json').read_text())['regions']
    for r in regions:
        path = ' '.join('M'+' L'.join(f'{x*440:.9f} {y*700:.9f}' for x, y in ring)+' Z'
                        for poly in r['geometry']['coordinates'] for ring in poly)
        parts.append(f'<path d="{path}" fill="{r["color"]}" fill-opacity=".38" fill-rule="evenodd" stroke="{r["color"]}" stroke-width=".7"/>')
        point = r['labelPoint']
        parts.append(f'<text x="{point["x"]*440:.5f}" y="{point["y"]*700:.5f}" text-anchor="middle" font-size="18">{r["labelId"]}</text>')
    parts.append('</g>')
parts += ['<text x="30" y="790" font-size="13">Boundaries: adapted from Servier Medical Art, CC BY 4.0. Surface: Gray1237, public domain.</text>',
          '<text x="30" y="810" font-size="13">Static resource render only; not clinical validation or a device screenshot.</text></g></svg>']
OUT.write_text('\n'.join(parts))
print(OUT.relative_to(ROOT))
