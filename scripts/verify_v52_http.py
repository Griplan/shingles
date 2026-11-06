"""Explicit local-only real MobileSAM HTTP experiment; public CDC image only.
No credentials, raw photos or server paths are printed. Outputs are ignored.
"""
import argparse,hashlib,io,json,time
from pathlib import Path
import httpx
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8000/api/v1/ai/sessions'
photo=ROOT/'ai/experiments/inputs/cdc-21505.jpg'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,default=ROOT/'ai/experiments/outputs'/time.strftime('v52-http-%Y%m%d-%H%M%S'),help='New output directory; existing paths are rejected')
output=parser.parse_args().output
output.mkdir(exist_ok=False,parents=True)
log={'sample':'CDC PHIL 21505, same public image as V5.1','medical_accuracy':'NOT_MEASURED','runs':[]}
with httpx.Client(timeout=65,trust_env=False) as c:
    r=c.post(BASE);r.raise_for_status();session=r.json();url=BASE+'/'+session['session_id'];h={'x-ai-session-key':session['session_token']}
    try:
        with photo.open('rb') as file:r=c.post(url+'/photo',headers=h,files={'file':('public-test.jpg',file,'image/jpeg')})
        r.raise_for_status();p=r.json();w,ht=p['image']['width'],p['image']['height'];log['image']=p['image']
        original=c.get(url+'/assets/photo.png',headers=h);original.raise_for_status();(output/'original.png').write_bytes(original.content)
        prompts={'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':215/w,'yMin':245/ht,'xMax':495/w,'yMax':385/ht}}
        for revision in [1,2]:
            if revision==2:prompts['points']=[{'x':430/w,'y':328/ht,'label':1},{'x':500/w,'y':350/ht,'label':0}]
            start=time.perf_counter();r=c.post(url+'/segment',headers=h,json={'photo_id':p['photo_id'],'request_id':f'http-test-{revision}','prompt_revision':revision,'prompts':prompts})
            r.raise_for_status();result=r.json();elapsed=time.perf_counter()-start
            log['runs'].append({'revision':revision,'seconds':elapsed,'status':result['status'],'candidates':result['candidates']})
            for candidate in result['candidates']:
                name=candidate['candidate_id'];q={'result_id':result['result_id']}
                for asset in ['mask','alpha']:
                    a=c.get(url+f'/assets/{name}-{asset}.png',headers=h,params=q);a.raise_for_status();(output/f'r{revision}-{name}-{asset}.png').write_bytes(a.content)
                image=Image.open(io.BytesIO(original.content)).convert('RGBA');alpha=Image.open(output/f'r{revision}-{name}-alpha.png').convert('RGBA')
                assert image.size==alpha.size==(w,ht);Image.alpha_composite(image,alpha).convert('RGB').save(output/f'r{revision}-{name}-overlay.jpg')
        # Explicit test user action selects candidate 1, not a score-ranked choice.
        selected='candidate-1'
        assert next(x for x in result['candidates'] if x['candidate_id']==selected)['status']=='ok'
        r=c.post(url+'/confirm',headers=h,json={'photo_id':p['photo_id'],'result_id':result['result_id'],'candidate_id':selected,'prompt_revision':2});r.raise_for_status();confirmed=r.json()
        assert confirmed['coordinate_space']=='photo_oriented_normalized_v1' and confirmed['confirmed_by_user']
        assert hashlib.sha256((output/f'r2-{selected}-mask.png').read_bytes()).hexdigest()==confirmed['mask_sha256']
        (output/'confirmed.json').write_text(json.dumps(confirmed,ensure_ascii=False,indent=2))
        log['confirmation']={'status':'PASSED','candidate_id':selected,'coordinate_space':confirmed['coordinate_space'],'polygon_count':len(confirmed['geometry']['coordinates']),'model':confirmed['model']}
        image=Image.open(output/'original.png').convert('RGB');draw=ImageDraw.Draw(image)
        for poly in confirmed['geometry']['coordinates']:
            for ring in poly:draw.line([(x*w,y*ht) for x,y in ring],fill='#13875f',width=2)
        image.save(output/'confirmed-polygons.jpg')
    finally:
        deleted=c.delete(url,headers=h);log['delete_status']=deleted.status_code
        gone=c.get(url+'/assets/photo.png',headers=h);log['after_delete_status']=gone.status_code
log['output']='See this run directory; public test artifacts only'
(output/'summary.json').write_text(json.dumps(log,ensure_ascii=False,indent=2))
print(json.dumps(log,ensure_ascii=False,indent=2))
