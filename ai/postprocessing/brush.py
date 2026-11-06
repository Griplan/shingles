"""Explicit user edits on pixel centers, always replayed from immutable AI mask."""
import numpy as np
from ai.errors import SegmentationError


def apply_strokes(original, strokes):
    if original.dtype != np.bool_ or original.ndim != 2 or not 0 < original.size <= 12_000_000:
        raise SegmentationError('INVALID_MASK','Invalid source mask.')
    if not isinstance(strokes,list) or len(strokes)>32 or any(not isinstance(s,dict) or not isinstance(s.get('points'),list) for s in strokes) or sum(len(s['points']) for s in strokes)>4096:
        raise SegmentationError('BRUSH_LIMIT','Too many brush points; original mask retained.')
    h,w=original.shape; result=original.copy();work=0
    for s in strokes:
        radius=s.get('radius');points=s.get('points',[]);mode=s.get('mode')
        if (mode not in ('add','erase') or type(radius) not in (int,float) or not np.isfinite(radius)
                or not .001<=radius<=.1 or not 1<=len(points)<=256
                or any(not isinstance(p,dict) or set(p)!={'x','y'} or any(type(v) not in (int,float) or not np.isfinite(v) or not 0<=v<=1 for v in p.values()) for p in points)):
            raise SegmentationError('INVALID_BRUSH','Invalid photo-space brush stroke.')
        r=radius*min(w,h);pairs=list(zip(points,points[1:])) or [(points[0],points[0])]
        for a,b in pairs:
            ax,ay=a['x']*w,a['y']*h;bx,by=b['x']*w,b['y']*h
            x0=max(0,int(np.floor(min(ax,bx)-r)));x1=min(w,int(np.ceil(max(ax,bx)+r)))
            y0=max(0,int(np.floor(min(ay,by)-r)));y1=min(h,int(np.ceil(max(ay,by)+r)))
            work+=(x1-x0)*(y1-y0)
            if work>50_000_000:raise SegmentationError('BRUSH_LIMIT','Brush work limit; use shorter strokes.')
            yy,xx=np.ogrid[y0:y1,x0:x1];dx,dy=bx-ax,by-ay;den=dx*dx+dy*dy
            t=np.clip(((xx+.5-ax)*dx+(yy+.5-ay)*dy)/den,0,1) if den else 0
            covered=(xx+.5-ax-t*dx)**2+(yy+.5-ay-t*dy)**2<=r*r
            result[y0:y1,x0:x1][covered]=mode=='add'
    return result
