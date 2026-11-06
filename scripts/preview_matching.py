"""Offline actual reference geometry + synthetic annotations; NOT a GUI screenshot."""
import base64, hashlib, json, sys
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.schemas.evaluate import EvaluateRequest
from app.services.atlas_service import ATLAS_DIR,BODY_FILE,ATLAS_ID,ATLAS_VERSION,load_dataset
from app.services.dermatome_matcher import evaluate
OUT=ROOT/'docs/validation-records/v4'
m=json.loads((ATLAS_DIR/'manifest.json').read_text());b=json.loads(BODY_FILE.read_text())
identity=dict(template_id=m['templateId'],template_version=m['templateVersion'],geometry_id=m['geometryId'],region_set_id=b['views']['front']['regionSetId'],atlas_id=ATLAS_ID,atlas_version=ATLAS_VERSION,atlas_content_sha256=m['contentSHA256'],body_content_sha256=hashlib.sha256(BODY_FILE.read_bytes()).hexdigest(),coordinate_system='normalized_2d_top_left')
fixture=json.loads((ROOT/'backend/tests/fixtures/synthetic-annotation-geometry.json').read_text())['editor']
markers=[('TEST_FRONT','front',fixture['UI-A']),('TEST_BACK','back',fixture['UI-B']),('TEST_HAIR','front',[{'x':.495,'y':.045},{'x':.505,'y':.045},{'x':.5,'y':.055}])]
request=EvaluateRequest(request_id='SYNTHETIC_OFFLINE_PREVIEW',annotation_revision=1,identity=identity,lesions=[dict(id=id,view=view,vertices=points) for id,view,points in markers])
dataset=load_dataset(request.identity);result=evaluate(request,dataset)
(OUT/'synthetic-request.json').write_text(request.model_dump_json(indent=2)+'\n')
(OUT/'synthetic-response.json').write_text(result.model_dump_json(indent=2)+'\n')
def path(ring):return 'M'+' L'.join(f'{x*400},{y*900}' for x,y in ring)+' Z'
def panel(index,marker,viewbox,title):
 id,view,points=marker;c=next(c for c in result.lesions if c.lesion_ids==[id]);candidate=c.candidates[0] if c.candidates else None
 image=base64.b64encode((ROOT/f'miniprogram/assets/body/commons-cc0/{view}.png').read_bytes()).decode()
 content=f'<image width="400" height="900" href="data:image/png;base64,{image}"/>'
 if candidate:
  for region in dataset.regions:
   if region['id'] in candidate.region_ids:
    for poly in region['geometry']['coordinates']:
     content+=f'<path d="{" ".join(path(r) for r in poly)}" fill="{region["color"]}" fill-opacity=".29" stroke="{region["color"]}" stroke-width=".8"/>'
 content+=f'<path d="{path([(p["x"],p["y"]) for p in points])}" fill="#ac5239" fill-opacity=".15" stroke="#ac5239" stroke-width="1.5"/>'
 name=candidate.display_name+' / '+candidate.side if candidate else 'No configured reference region'
 ratio=f'{candidate.lesion_coverage_ratio:.6%}' if candidate else '0%'
 return f'<g transform="translate({index*350+10},0)"><text x="10" y="48">{escape(title)}</text><svg x="0" y="65" width="330" height="710" viewBox="{viewbox}" preserveAspectRatio="xMidYMid meet">{content}</svg><text x="10" y="805">{escape(name)}: {ratio}</text><text x="10" y="830">Uncovered: {c.uncovered_ratio:.6%}</text></g>'
content=panel(0,markers[0],'0 0 400 900','Front / actual top reference')+panel(1,markers[1],'0 0 400 900','Back / independent result')+panel(2,markers[0],'115 180 170 180','Same front annotation / detail')+panel(3,markers[2],'145 20 110 145','Unconfigured hair / no candidate')
(OUT/'matching-preview.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1420" height="910" font-family="sans-serif" font-size="14" fill="#263e35"><rect width="100%" height="100%" fill="#f4f8f6"/><text x="20" y="22">OFFLINE RESOURCE + REAL MATCHER PREVIEW / SYNTHETIC MARKERS / NOT A WECHAT SCREENSHOT</text>'+content+'<text x="20" y="868">Brown: manually specified test annotation. Color: full selected reference region, not a lesion estimate.</text><text x="20" y="892">Goran_tek-en / CC BY-SA 4.0; Commons body / CC0. Medical review pending. No clinical conclusions.</text></svg>')
print('Offline matching evidence generated from unchanged canonical atlas; no GUI/clinical claim.')
