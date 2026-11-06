"""Prompt adherence diagnostics, never clinical quality or automatic acceptance."""
import numpy as np


def inspect_mask(mask, prompts, component_count=0):
    h, w = mask.shape
    area = int(mask.sum())
    boxes = ([prompts['box']] if prompts.get('box') else []) + prompts.get('additional_boxes', [])
    inside = np.zeros_like(mask)
    xs, ys = np.arange(w) + .5, np.arange(h) + .5
    for x0, y0, x1, y1 in boxes:
        inside |= (ys[:, None] >= y0) & (ys[:, None] < y1) & (xs[None, :] >= x0) & (xs[None, :] < x1)
    box_area = int(inside.sum())
    fg = [bool(mask[int(y), int(x)]) for x, y, label in prompts['points'] if label == 1]
    bg = [not bool(mask[int(y), int(x)]) for x, y, label in prompts['points'] if label == 0]
    outside = int((mask & ~inside).sum()) / area if boxes and area else None
    ratio = area / box_area if box_area else None
    warnings = []
    if not area: warnings.append('EMPTY_MASK')
    if area / (w*h) > .65: warnings.append('LARGE_MASK')
    if outside is not None and outside > .25: warnings.append('OUTSIDE_BOX')
    if ratio is not None and ratio > 2: warnings.append('BOX_AREA_EXCESS')
    if fg and not all(fg): warnings.append('FOREGROUND_MISSED')
    if bg and not all(bg): warnings.append('BACKGROUND_INCLUDED')
    if component_count > 100: warnings.append('FRAGMENTED')
    # No area-based deletion, shrinking, clipping or selection by SAM score.
    penalty = 100*(fg.count(False)+bg.count(False)) + 20*('OUTSIDE_BOX' in warnings) + 10*('BOX_AREA_EXCESS' in warnings) + 5*('LARGE_MASK' in warnings) + ('FRAGMENTED' in warnings)
    return {'area_ratio': area/(w*h), 'box_pixel_area': box_area or None, 'mask_to_box_ratio': ratio,
            'outside_box_ratio': outside, 'foreground_contained': fg, 'background_excluded': bg,
            'prompt_penalty': penalty, 'warnings': warnings,
            'policy': 'prompt_adherence_v1_not_medical_quality'}


def inspect_candidates(candidates, masks, prompts):
    for c, mask in zip(candidates, masks):
        c['quality'] = inspect_mask(mask, prompts, c.get('component_count', 0))
        c['quality']['candidate_differences'] = []
        if c['status'] not in ('ok', 'empty_mask'): c['quality']['warnings'].append('CONTOUR_FAILED')
    for i, a in enumerate(masks):
        for j in range(i):
            b=masks[j]; union=int((a|b).sum()); iou=int((a&b).sum())/union if union else 1.0
            for index, other in ((i,j),(j,i)):
                q=candidates[index]['quality']
                q['candidate_differences'].append({'candidate_id': candidates[other]['candidate_id'], 'mask_iou': iou})
                if iou > .95 and 'SIMILAR_CANDIDATES' not in q['warnings']: q['warnings'].append('SIMILAR_CANDIDATES')
    order=sorted(range(len(candidates)), key=lambda i:(candidates[i]['status']!='ok', candidates[i]['quality']['prompt_penalty'], i))
    for rank, i in enumerate(order): candidates[i]['display_priority']=rank
    return [candidates[i]['candidate_id'] for i in order]
