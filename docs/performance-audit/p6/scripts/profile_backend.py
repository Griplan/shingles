"""Alternating old/new single-process timings; synthetic inputs and no HTTP."""
import sys,time,json,platform,statistics,resource
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];sys.path[:0]=[str(ROOT/'backend'),str(ROOT/'backend/tests'),str(ROOT)]
import psutil,shapely
from test_match_union_equivalence import baseline,cases,outcome
from app.services import dermatome_matcher as current
from app.services.atlas_service import load_dataset
modules={'before':baseline(),'after':current};rows=[]
scenarios=[c for c in cases() if c[0].startswith('real-atlas')]
for name,q,ds in scenarios:
    assert outcome(modules['before'],q,ds)==outcome(current,q,ds)
    for label,m in modules.items():
        original=m.unary_union
        def measured_union(*a,_fn=original,_label=label,**kw):
            caller=sys._getframe(1).f_code.co_name
            start=time.perf_counter()
            try:return _fn(*a,**kw)
            finally:measurements[_label].append({'caller':caller,'inputs':len(a[0]),'ms':(time.perf_counter()-start)*1000})
        m.unary_union=measured_union
    for repetition in range(21):
        for label in (('before','after') if repetition%2==0 else ('after','before')):
            measurements={'before':[],'after':[]};m=modules[label];process=psutil.Process();rss=process.memory_info().rss
            t=time.perf_counter();loaded=load_dataset(q.identity);load_ms=(time.perf_counter()-t)*1000
            t=time.perf_counter();result=m.evaluate(q,loaded);match_ms=(time.perf_counter()-t)*1000
            t=time.perf_counter();result.model_dump_json();serialize_ms=(time.perf_counter()-t)*1000
            rows.append({'case':name,'variant':label,'repetition':repetition,'warmup':repetition==0,'load_ms':load_ms,'match_ms':match_ms,'serialize_ms':serialize_ms,'total_ms':load_ms+match_ms+serialize_ms,'rss_before':rss,'rss_after':process.memory_info().rss,'union_calls':measurements[label]})
    # A fresh baseline and reloaded current module have no old closure wrappers.
    import importlib
    modules={'before':baseline(),'after':importlib.reload(current)}
report={'date':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'environment':{'python':sys.version,'platform':platform.platform(),'cpu':platform.machine(),'shapely':shapely.__version__},'method':'21 alternating pairs per case; first pair labelled warmup; no HTTP; all exact response comparisons passed; RSS includes both variants in one process','max_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024),'rows':rows}
Path(sys.argv[1]).write_text(json.dumps(report,indent=2)+'\n');print('Wrote',len(rows),'measurements')
