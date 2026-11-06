"""Export ONLY a session whose oriented pixels match our public CDC21505 input."""
import json,hashlib,argparse
from pathlib import Path
from time import perf_counter
import numpy as np
from PIL import Image,ImageDraw
from shapely import contains_xy
from shapely.geometry import shape
from ai.preprocessing.image import prepare_image
from ai.postprocessing.brush import apply_strokes
from ai.postprocessing.polygons import mask_to_polygons

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);a=ap.parse_args();root=Path(__file__).resolve().parents[2]
    out=Path(a.output);out.mkdir(parents=True,exist_ok=False)
    expected=prepare_image(root/'ai/experiments/inputs/cdc-21505.jpg').rgb;found=[]
    for recordfile in (root/'private-data/v5-ai-sessions').glob('*/result/record.json'):
        record=json.loads(recordfile.read_text());folder=recordfile.parent
        if record['image']['oriented_rgb_sha256']!=hashlib.sha256(expected.tobytes()).hexdigest():continue
        for f in folder.glob('candidate-*-edit-*.json'):found.append((f,record))
    if len(found)!=1:raise RuntimeError('Expected exactly one explicitly public corrected candidate.')
    f,record=found[0];edit=json.loads(f.read_text());c=edit['candidate'];id=c['candidate_id'];source=f.parent/(id+'-mask.png')
    raw=np.asarray(Image.open(source))==255;mask=np.asarray(Image.open(f.with_name(f.stem+'-mask.png')))==255
    t=perf_counter();replay=apply_strokes(raw,edit['strokes']);seconds=perf_counter()-t;assert np.array_equal(replay,mask)
    before=mask_to_polygons(raw);h,w=mask.shape;yy,xx=np.mgrid[:h,:w]
    for candidate,m in [(before,raw),(c,mask)]:assert np.array_equal(contains_xy(shape(candidate['geometry']),(xx+.5)/w,(yy+.5)/h),m)
    original=Image.fromarray(expected);original.save(out/'original.png');panels=[]
    for title,m,geometry in [('Original',None,None),('AI raw',raw,before['geometry']),('User brush (not expert annotation)',mask,c['geometry'])]:
        im=original.copy()
        if m is not None:
            rgba=np.zeros((h,w,4),np.uint8);rgba[m]=(0,180,130,95);layer=Image.fromarray(rgba);im=Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')
            name='before' if title=='AI raw' else 'after';Image.fromarray(m.astype(np.uint8)*255).save(out/(name+'-mask.png'));layer.save(out/(name+'-alpha.png'));im.save(out/(name+'-overlay.png'))
            poly=original.copy();pen=ImageDraw.Draw(poly)
            for p in geometry['coordinates']:
                for i,r in enumerate(p):pen.line([(x*w,y*h) for x,y in r],fill='green' if i==0 else 'orange',width=2)
            poly.save(out/(name+'-polygons.png'))
        im.thumbnail((560,380));panel=Image.new('RGB',(580,420),'white');panel.paste(im,(10,30));ImageDraw.Draw(panel).text((10,8),title,fill='black');panels.append(panel)
    board=Image.new('RGB',(1740,445),'white')
    for i,p in enumerate(panels):board.paste(p,(i*580,0))
    ImageDraw.Draw(board).text((12,423),'Source CDC PHIL 21505 / K.L. Herrmann. Public image; experimental overlays added here. No CDC endorsement.',fill='black');board.save(out/'brush-comparison.jpg')
    report={'source':'https://wwwn.cdc.gov/phil/Details.aspx?pid=21505','kind':'actual WeChat pointer strokes; engineer review, no expert truth',
      'model':record['model'],'prompts':record['prompts'],'crop_transform':record['model_transform'],'original_candidate':next(x for x in record['candidates'] if x['candidate_id']==id),
      'corrected_candidate':c,'strokes':edit['strokes'],'raw_area_pixels':int(raw.sum()),'edited_area_pixels':int(mask.sum()),'added_pixels':int((mask&~raw).sum()),'removed_pixels':int((raw&~mask).sum()),
      'replay_seconds':seconds,'pixel_polygon_roundtrip_exact':True,'clinical_accuracy':'NOT_MEASURED','operator_time':'NOT_MEASURED; interrupted engineering verification'}
    (out/'correction.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:report[k] for k in ['raw_area_pixels','edited_area_pixels','added_pixels','removed_pixels','replay_seconds','pixel_polygon_roundtrip_exact']}))
if __name__=='__main__':main()
