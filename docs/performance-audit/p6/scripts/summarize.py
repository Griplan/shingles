"""Aggregate P6 measurements without modifying P5 evidence."""
import json,math,statistics,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'docs/performance-audit/p6/evidence'
def read(name):return json.loads((OUT/name).read_text())
def stat(values):
    a=sorted(values);n=len(a)
    return {'n':n,'p50_ms':statistics.median(a),'p95_ms':a[math.ceil(.95*n)-1] if n>=20 else None,'max_ms':max(a),'min_ms':min(a)}
result={'statistics':'Median; P95 nearest-rank ceil(0.95*n)-1 only for n>=20; warmup excluded. Not FPS/HTTP latency.','placement':{},'placement_all_scenarios':{},'backend':{},'memory':{}}
for variant in ('before','after'):
    doc=read(f'placement-focused-{variant}.json');cases=[c for c in doc['cases'] if not c['warmup']]
    phases={}
    for name in [p['name'] for p in cases[0]['phases']]:
        rows=[next(p for p in c['phases'] if p['name']==name) for c in cases]
        phases[name]={'wall':stat([p['wall_ms'] for p in rows]),'nested':{k:stat([p['timings'].get(k,{}).get('total_ms',0) for p in rows]) for k in ('validatePlacementGeometry','transformPhotoPolygonToBody','preparePhotoGeometry','page.setData.serialize','overlay.redraw')},'geometry_calls':[p['calls'].get('validatePlacementGeometry',0) for p in rows]}
    result['placement'][variant]=phases
    result['memory'][variant]={'heap_after_gc_first_warm':cases[0]['heapAfterGC'],'heap_after_gc_last_warm':cases[-1]['heapAfterGC'],'heap_growth':cases[-1]['heapAfterGC']-cases[0]['heapAfterGC'],'pending_frames_after_exit':sorted(set(c['pendingFramesAfterExit'] for c in doc['cases']))}
    full=[c for i in (1,2,3) for c in read(f'placement-{variant}-{i}.json')['cases']]
    for key in dict.fromkeys((c['vertices'],c['multi'],c['width'],c.get('exitDuringDrag',False)) for c in full):
        rows=[c for c in full if (c['vertices'],c['multi'],c['width'],c.get('exitDuringDrag',False))==key]
        result['placement_all_scenarios'].setdefault(str(key),{})[variant]={name:stat([p['wall_ms'] for c in rows for p in c['phases'] if p['name']==name]) for name in ('exit-during-drag',) if key[-1]}
        if not key[-1]:result['placement_all_scenarios'][str(key)][variant]={name:stat([next(p['wall_ms'] for p in c['phases'] if p['name']==name) for c in rows]) for name in ('drag-end-validation','confirm')}
backend=read('backend-paired.json')
for case in dict.fromkeys(r['case'] for r in backend['rows']):
    result['backend'][case]={}
    for variant in ('before','after'):
        rows=[r for r in backend['rows'] if r['case']==case and r['variant']==variant and not r['warmup']]
        # Real atlas has 54/60 candidate objects; these fixtures have <=20 lesions.
        # Exclude candidate-group unions and lesion-summary unions using recorded caller/input counts.
        full=lambda r:[c for c in r['union_calls'] if c['caller']=='coverage' or (variant=='after' and c['caller']=='evaluate' and c['inputs'] in (54,60))]
        result['backend'][case][variant]={**{k:stat([r[k] for r in rows]) for k in ('load_ms','match_ms','serialize_ms','total_ms')},'atlas_union_ms':stat([sum(c['ms'] for c in full(r)) for r in rows]),'atlas_union_counts':sorted(set(len(full(r)) for r in rows)),'rss_after_min':min(r['rss_after'] for r in rows),'rss_after_max':max(r['rss_after'] for r in rows)}
result['memory']['backend_max_rss_bytes']=backend['max_rss_bytes']
result['embedding']=read('embedding-memory.json')
manifest=json.loads((OUT.parent/'baseline/manifest.json').read_text())['sha256']
changed=[name for name,h in manifest.items() if not (ROOT/name).exists() or hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=h]
p5=json.loads((ROOT/'docs/performance-audit/evidence/core-before.json').read_text())
p5changed=[name for name,h in p5.items() if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=h]
result['integrity']={'baseline_files_checked':len(manifest),'changed':changed,'p5_protected_files_checked':len(p5),'p5_protected_changed':p5changed,'old_reports_and_evidence_unchanged':not any(n.startswith('docs/performance-audit/') for n in changed)}
assert sorted(changed)==sorted(['miniprogram/utils/annotation-geometry.ts','backend/app/services/dermatome_matcher.py']),changed
(OUT/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Summary and integrity PASS; modified production files:',changed)
