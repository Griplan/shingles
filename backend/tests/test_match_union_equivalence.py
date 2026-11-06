"""P6 exact differential against the hash-locked pre-optimization implementation."""
import copy
import hashlib
import json
from pathlib import Path
import types
import pytest
from shapely.geometry import box, Polygon
from app.schemas.evaluate import EvaluateRequest
from app.services.atlas_service import load_dataset
from app.services import dermatome_matcher as current
from app.utils.geometry import EvaluationError
from test_matching import dataset, region, request

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/performance-audit/p6/baseline'
def baseline():
    path=BASE/'dermatome_matcher.py.txt';blob=path.read_bytes()
    expected=json.loads((BASE/'manifest.json').read_text())['sha256']['backend/app/services/dermatome_matcher.py']
    assert hashlib.sha256(blob).hexdigest()==expected
    module=types.ModuleType('p6_baseline_matcher')
    exec(compile(blob,str(path),'exec'),module.__dict__)
    return module

def cases():
    base=json.loads((ROOT/'docs/paper-technical-report/audit/example-evaluate.json').read_text())['request']
    # The historical specimen coordinates stay unchanged; bind this differential
    # to the currently registered atlas, while old-version rejection is tested separately.
    from test_evaluate_api import identity
    base['identity']=identity()
    real=load_dataset(EvaluateRequest.model_validate(base).identity)
    result=[]
    for count in (1,2,5,20):
        p=copy.deepcopy(base);p['request_id']='P6_SYNTHETIC'
        p['lesions']=[{**p['lesions'][0],'id':f'SYNTHETIC-{i}'} for i in range(count)]
        result.append((f'real-atlas-overlap-{count}',EvaluateRequest.model_validate(p),real))
    for view,x,y,name in [('front',.5,.05,'uncovered'),('back',.5,.3,'back')]:
        p=copy.deepcopy(base);p['lesions']=[{'id':'SYNTHETIC','view':view,'vertices':[{'x':x,'y':y} for x,y in box(x-.001,y-.001,x+.001,y+.001).exterior.coords]}]
        result.append(('real-atlas-'+name,EvaluateRequest.model_validate(p),real))
    p=copy.deepcopy(base);p['lesions']=[*result[0][1].model_dump()['lesions'],{**result[-1][1].model_dump()['lesions'][0],'id':'SYNTHETIC-BACK'}]
    result.append(('real-atlas-both-views',EvaluateRequest.model_validate(p),real))
    rr=[region('TEST_OVERLAP',box(0,0,.6,1)),region('TEST_OTHER',box(.4,0,1,1),side='right'),region('TEST_BACK',box(0,0,.5,1),view='back')]
    ds=dataset(rr)
    result.append(('synthetic-two-views',request([('A','front',box(.1,.1,.8,.8)),('B','front',box(.3,.3,.9,.9)),('C','back',box(.2,.2,.8,.8))]),ds))
    q=request([('A','front',box(.1,.1,.8,.8))]);p=q.model_dump()
    ring=lambda b:[{'x':x,'y':y} for x,y in box(*b).exterior.coords]
    p['lesions'][0]={'id':'AI','view':'front','source':'ai_assisted','geometry':{'type':'MultiPolygon','coordinateSpace':'body_template_normalized_v1','coordinates':[[ring((.1,.1,.6,.6)),ring((.2,.2,.3,.3))],[ring((.7,.7,.8,.8))]]}}
    result.append(('synthetic-multi-hole',EvaluateRequest.model_validate(p),ds))
    result.append(('synthetic-empty-atlas',q,dataset([])))
    result.append(('synthetic-boundary',request([('A','front',box(.5,0,1,1))]),dataset([region('TEST_TOUCH',box(0,0,.5,1))])))
    result.append(('synthetic-tiny',request([('A','front',box(0,0,1,1))]),dataset([region('TEST_TINY',box(0,0,1e-10,1))])))
    result.append(('error-duplicate',request([('A','front',box(.1,.1,.2,.2))]*2),ds))
    result.append(('error-limit',request([(str(i),'front',box(.1,.1,.2,.2)) for i in range(21)]),ds))
    result.append(('error-body-hole',q,type(ds)(ds.identity,ds.manifest,ds.regions,{'front':Polygon(box(0,0,1,1).exterior.coords,[box(.4,.4,.5,.5).exterior.coords])})))
    result.append(('error-view',request([('A','back',box(.1,.1,.2,.2))]),type(ds)(ds.identity,ds.manifest,ds.regions,{'front':box(0,0,1,1)})))
    return result

def outcome(module,q,ds):
    try:return ('result',module.evaluate(q,ds).model_dump(mode='json'))
    except EvaluationError as error:return ('error',vars(error),str(error))

@pytest.mark.parametrize('name,q,ds',cases(),ids=lambda x:x if isinstance(x,str) else None)
def test_complete_response_exactly_matches_baseline(name,q,ds):
    before=q.model_dump_json()
    assert outcome(current,q,ds)==outcome(baseline(),q,ds),name
    assert q.model_dump_json()==before

def test_union_once_per_view_and_never_reused_across_requests(monkeypatch):
    captured=[];original=current.coverage
    def record(*args,**kwargs):
        captured.append((args[1],args[4]))
        return original(*args,**kwargs)
    monkeypatch.setattr(current,'coverage',record)
    _,q,ds=next(c for c in cases() if c[0]=='synthetic-two-views')
    current.evaluate(q,ds)
    per_view={v:[a for view,a in captured if view==v] for v in ('front','back')}
    assert all(all(a is values[0] for a in values) for values in per_view.values())
    assert per_view['front'][0] is not per_view['back'][0]
    previous=per_view['front'][0];captured.clear()
    # Same nominal identity, changed content: request-local union must still be new.
    changed=dataset([region('TEST_CHANGED',box(0,0,.2,1))]);current.evaluate(q,changed)
    now=next(a for view,a in captured if view=='front')
    assert now is not previous and now.area != previous.area
