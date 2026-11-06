"""Reproducible public-image engineering comparison; no medical ground truth."""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import shape
from shapely import contains_xy
from ai.inference.mobile_sam import MobileSAM
from ai.segmentation import segment_image
from ai.export import export_result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
    root=Path(__file__).resolve().parents[2];out=Path(args.output)
    if out.exists(): raise FileExistsError('Use a new experiment directory.')
    out.mkdir(parents=True)
    cases=json.loads((root/'ai/experiments/cases.json').read_text())['cases']
    # Additional boxes authored against the existing original preview, not model output.
    cases += [{'id':'J_three_local_boxes','image':'cdc-21505.jpg','box':[215,245,495,385],
               'additional_boxes':[[125,250,200,335],[400,40,505,135]],'points':[],
               'intent':'Three explicitly chosen local clusters; never a convex hull.'}]
    model=MobileSAM(root/'ai/models/MobileSAM-source/weights/mobile_sam.pt',device='cpu')
    summary={'model':model.metadata,'medical_accuracy':'NOT_MEASURED_NO_EXPERT_MASKS','cases':[]}
    for case in cases:
        prompts={'coordinate_space':'photo_oriented_pixels_v1',**{k:case[k] for k in ('points','box','additional_boxes') if k in case}}
        entry={'id':case['id'],'image':case['image'],'intent':case['intent'],'runs':{}}
        for strategy in ('full_image','context_crop'):
            if case.get('additional_boxes') and strategy=='full_image': continue
            result=segment_image(root/'ai/experiments/inputs'/case['image'],prompts,model=model,strategy=strategy)
            folder=out/case['id']/strategy;export_result(result,folder)
            h,w=result.image.shape[:2];ys,xs=np.indices((h,w));checks=[]
            for c,mask in zip(result.record['candidates'],result.masks):
                if c['geometry']:
                    g=shape(c['geometry']);back=contains_xy(g,(xs+.5)/w,(ys+.5)/h)
                    checks.append({'candidate':c['candidate_id'],'same_pixels':bool(np.array_equal(mask,back)),
                                   'area_error_pixels':abs(g.area*w*h-int(mask.sum()))})
                    assert np.array_equal(mask,back)
            entry['runs'][strategy]={'display_order':result.record['display_order'],'timings':result.record['timings'],
               'transform':result.record['model_transform'],'candidates':result.record['candidates'],'roundtrip':checks}
        panels=[]
        original=Image.open(root/'ai/experiments/inputs'/case['image']).convert('RGB')
        for title,im in [('original',original)]+[(strategy+' / '+run['display_order'][0],Image.open(out/case['id']/strategy/(run['display_order'][0]+'-overlay.png'))) for strategy,run in entry['runs'].items()]:
            panel=Image.new('RGB',(420,460),'white');im.thumbnail((400,415));panel.paste(im,((420-im.width)//2,30));ImageDraw.Draw(panel).text((10,8),title,fill='black');panels.append(panel)
        board=Image.new('RGB',(420*len(panels),485),'white')
        for i,panel in enumerate(panels):board.paste(panel,(i*420,0))
        ImageDraw.Draw(board).text((10,465),'CDC PHIL / NIAID or synthetic; engineering preview, no agency endorsement or clinical ground truth.',fill='black')
        board.save(out/(case['id']+'-comparison.jpg'))
        summary['cases'].append(entry);print(case['id'],[(k,round(v['timings']['total_seconds'],3)) for k,v in entry['runs'].items()],flush=True)
    (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
