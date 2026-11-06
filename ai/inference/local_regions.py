"""Context crops with integer offsets; exact binary-mask paste, no resampling."""
import math
import numpy as np
from ai.errors import SegmentationError
from ai.postprocessing.quality import inspect_mask


def checked_predict(model, rgb, prompts):
    masks, scores, timings, transform = model.predict(rgb, prompts)
    if (not isinstance(masks,np.ndarray) or masks.dtype != np.bool_ or masks.ndim != 3
            or masks.shape[1:] != rgb.shape[:2] or not 1 <= len(masks) <= 3
            or len(masks) != len(scores) or not np.isfinite(scores).all()):
        raise SegmentationError('MODEL_OUTPUT_INVALID','Model returned invalid candidate data.')
    return masks, scores, timings, transform


def predict_regions(model, rgb, prompts, strategy):
    if strategy not in ('full_image','context_crop'):
        raise SegmentationError('INVALID_STRATEGY','Unknown inference strategy.')
    boxes=([prompts['box']] if prompts.get('box') else [])+prompts.get('additional_boxes',[])
    if strategy=='full_image' or not boxes:
        if len(boxes)>1: raise SegmentationError('INVALID_STRATEGY','Multiple regions require context crops.')
        m,s,t,x=checked_predict(model,rgb,prompts)
        return m,s,t,{**x,'strategy':'full_image','requested_strategy':strategy},[]
    h,w=rgb.shape[:2]; assigned=[[] for _ in boxes]
    # Every foreground prompt is assigned; outside-context background points are
    # already excluded by zero-fill and are reported in the crop metadata.
    for p in prompts['points']:
        x,y,label=p
        if label:
            distances=[max(b[0]-x,0,x-b[2])**2+max(b[1]-y,0,y-b[3])**2 for b in boxes]
            assigned[int(np.argmin(distances))].append(p)
    groups=[]; regions=[]; total={}; local_masks=[]
    for index,b in enumerate(boxes):
        padding=max(16., .2*max(b[2]-b[0],b[3]-b[1]))
        # Stabilize normalized->pixel roundoff at integral crop edges, not a pixel shift.
        pts=assigned[index]
        x0=max(0,math.floor(min([b[0]]+[p[0] for p in pts])-padding+1e-8))
        y0=max(0,math.floor(min([b[1]]+[p[1] for p in pts])-padding+1e-8))
        x1=min(w,math.ceil(max([b[2]]+[p[0]+1 for p in pts])+padding-1e-8))
        y1=min(h,math.ceil(max([b[3]]+[p[1]+1 for p in pts])+padding-1e-8))
        # Include all prompts visible in this crop; do not erase other local targets.
        points=[[x-x0,y-y0,label] for x,y,label in prompts['points'] if x0<=x<x1 and y0<=y<y1]
        local={'coordinate_space':'photo_oriented_pixels_v1','points':points,'box':[b[0]-x0,b[1]-y0,b[2]-x0,b[3]-y0]}
        masks,scores,t,transform=checked_predict(model,np.ascontiguousarray(rgb[y0:y1,x0:x1]),local)
        qs=[inspect_mask(m,local) for m in masks]
        order=sorted(range(len(masks)),key=lambda i:(not masks[i].any(),qs[i]['prompt_penalty'],i))
        groups.append((masks,scores,order,(x0,y0,x1,y1)))
        local_masks.append(list(masks))
        regions.append({'region_index':index,'box_original_pixels':b,'crop_xyxy':[x0,y0,x1,y1],
                        'context_padding_pixels':padding,'prompts_local':local,'model_transform':transform,
                        'candidate_order':order,'model_scores':[float(v) for v in scores],
                        'local_quality':qs,'excluded_background_count':sum(1 for x,y,l in prompts['points'] if not l and not(x0<=x<x1 and y0<=y<y1))})
        for k,v in t.items(): total[k]=total.get(k,0)+v
    count=max(len(g[0]) for g in groups); combined=np.zeros((count,h,w),dtype=bool); scores=[]; composition=[]
    for rank in range(count):
        selected=[]; values=[]
        for masks,s,order,(x0,y0,x1,y1) in groups:
            i=order[min(rank,len(order)-1)];combined[rank,y0:y1,x0:x1] |= masks[i]
            selected.append(i);values.append(float(s[i]))
        scores.append(sum(values)/len(values));composition.append(selected)
    return combined,np.array(scores),total,{'strategy':'context_crop','original_hw':[h,w],
        'regions':regions,'composition':composition,'composition_policy':'rank_aligned_alternatives_not_exhaustive',
        'outside_crop':'not_inferred_zero','mask_mapping':'integer_offset_no_resize','score_policy':'mean_of_selected_local_sam_scores_not_quality',
        'crop_boundary_candidates':[any((x0>0 and masks[order[min(rank,len(order)-1)],:,0].any()) or (x1<w and masks[order[min(rank,len(order)-1)],:,-1].any()) or (y0>0 and masks[order[min(rank,len(order)-1)],0,:].any()) or (y1<h and masks[order[min(rank,len(order)-1)],-1,:].any()) for masks,_,order,(x0,y0,x1,y1) in groups) for rank in range(count)]},local_masks
