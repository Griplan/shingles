from pathlib import Path
import json,statistics,collections,hashlib,datetime
ROOT=Path(__file__).resolve().parents[3];D=ROOT/'docs/performance-audit/evidence'
def read(n):return json.loads((D/n).read_text())
def stats(a):
 a=sorted(a);return {'n':len(a),'mean_ms':statistics.mean(a),'median_ms':statistics.median(a),'min_ms':min(a),'max_ms':max(a),'p95_ms':a[min(len(a)-1,int(len(a)*.95))] if len(a)>=20 else None}
out={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'definitions':'P95 only n>=20; fixed synthetic scenario, not user population; nested timers not additive','placement':{},'frontend':{},'backend':{},'ai':{},'server':{}}
groups=collections.defaultdict(list)
for i in [1,2,3]:
 for c in read(f'placement-isolated-{i}.json')['cases']:
  for p in c['phases']:groups[f"{c['vertices']}/{c['multi']}/{c['width']}/{c.get('exitDuringDrag',False)}/{p['name']}"].append(p['wall_ms'])
out['placement']={k:stats(v) for k,v in groups.items()}
f=read('frontend-final.json');out['atlas']=f['complexity'];out['manual_setData']=f['manualPages']
for stage in {r['stage'] for r in f['rows']}:out['frontend'][stage]=stats([r['ms'] for r in f['rows'] if r['stage']==stage])
for count in [1,5]:
 r=[r for r in read('backend-local-detailed.json')['rows'] if r['lesion_objects']==count]
 out['backend'][str(count)]={k:stats([v['phases_ms'][k] for v in r]) for k in r[0]['phases_ms']}
 out['backend'][str(count)]['total']=stats([v['wall_ms'] for v in r]);out['backend'][str(count)]['coverage_union']=stats([sum(v['nested_match_ms']['coverage.unary_union']) for v in r])
a=[read(n) for n in ['ai-local.json','ai-local-2.json','ai-local-3.json']];out['ai']['load']=stats([v['load_ms'] for v in a]);out['ai']['first']=stats([v['rows'][0]['wall_ms'] for v in a]);out['ai']['warm']=stats([r['wall_ms'] for v in a for r in v['rows'][1:]])
for k in ['encode_seconds','decode_seconds','polygon_seconds']:out['ai'][k]=stats([r['model_timings'][k]*1000 for v in a for r in v['rows'][1:]])
out['ai']['highwater_range_bytes']=[min(r['process_highwater_bytes'] for v in a for r in v['rows']),max(r['process_highwater_bytes'] for v in a for r in v['rows'])]
b=read('server-baseline.json')['samples'][-1];a=read('server-after.json')['samples'][-1]
def kv(s):return {x.split()[0]:int(x.split()[1]) for x in s.splitlines()}
for unit in ['acupuncture.service','dermatome.service','nginx.service']:
 x,y=b['services'][unit],a['services'][unit];c1,c2=kv(x['cpu.stat']),kv(y['cpu.stat']);out['server'][unit]={'pid_before':x['MainPID'],'pid_after':y['MainPID'],'active':y['ActiveState'],'restart_before':x['NRestarts'],'restart_after':y['NRestarts'],'rss':y['process'].get('VmRSS'),'cgroup_current':y['memory.current'],'cgroup_peak':y['memory.peak'],'cpu_delta':{k:c2[k]-c1[k] for k in c2 if k in c1},'memory_events_delta':{k:kv(y['memory.events'])[k]-v for k,v in kv(x['memory.events']).items()}}
out['server']['observation_seconds']=a['monotonic']-b['monotonic'];out['server']['memory_before']=b['memory'];out['server']['memory_after']=a['memory']
out['server']['note']='counters cover observation window including background activity; not exclusive attribution to audit requests'
# Whitelisted protected files: no credential/private configuration reading.
before=read('core-before.json');changes=[p for p,h in before.items() if not (ROOT/p).exists() or hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
out['core_protection']={'checked':len(before),'changed':changes};(D/'core-after-check.json').write_text(json.dumps(out['core_protection'],indent=2)+'\n')
(D/'summary.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n');print(json.dumps({k:out[k] for k in ['backend','ai','server','core_protection']},indent=2))
