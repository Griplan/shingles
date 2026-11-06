"""Bounded single-request audit. Never prints credentials or payloads. No parallel inference.
Checks A before every work request; deletes only this probe's session, never other users' data.
"""
import sys,json,time,subprocess,pathlib,uuid,datetime
import httpx
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=ROOT/'docs/performance-audit/evidence'
BASE='http://212.64.26.206/dermatome-test/api/v1'
report={'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':'local HTTP client to Tencent existing HTTP public test entrance; not phone; no transport encryption','operations':[],'cleanup':{}}
client=httpx.Client(timeout=65,trust_env=False);headers={};sid=None

def guard():
 for p in ['/health','/ready']:
  r=client.get('http://212.64.26.206'+p);r.raise_for_status()
  if r.json().get('ai_ready') is not True:raise RuntimeError('A not ready; stopped')

def run(name,method,path,**kw):
 trace='p5-'+uuid.uuid4().hex[:12];t=time.perf_counter();r=client.request(method,BASE+path,**kw);elapsed=(time.perf_counter()-t)*1000
 report['operations'].append({'traceId':trace,'stage':name,'ms':elapsed,'status':r.status_code,'response_bytes':len(r.content)})
 r.raise_for_status();return r
try:
 guard();run('HEALTH','GET','/health')
 r=run('ACCESS_SESSION','POST','/access/session',json={});headers={'authorization':'Bearer '+r.json()['access_token']}
 payload=json.loads((ROOT/'docs/paper-technical-report/audit/example-evaluate.json').read_text())['request']
 for i in range(3):
  guard();payload['request_id']='p5-cloud-match-'+str(i);run('MATCH_HTTP','POST','/evaluate',headers=headers,json=payload);time.sleep(.6)
 guard();s=run('AI_CREATE','POST','/ai/sessions',headers=headers).json();sid=s['session_id'];ai_headers={**headers,'x-ai-session-key':s['session_token']}
 photo=ROOT/'ai/experiments/inputs/cdc-21505.jpg'
 with photo.open('rb') as f:r=run('IMAGE_UPLOAD','POST',f'/ai/sessions/{sid}/photo',headers=ai_headers,files={'file':('public-test.jpg',f,'image/jpeg')})
 photo_id=r.json()['photo_id']
 for i in range(2):
  guard();p={'photo_id':photo_id,'request_id':f'p5-cloud-ai-{i}','prompt_revision':i,'strategy':'context_crop','prompts':{'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':215/700,'yMin':245/460,'xMax':495/700,'yMax':385/460}}}
  result=run('AI_SEGMENT_HTTP','POST',f'/ai/sessions/{sid}/segment',headers=ai_headers,json=p).json()
  report['operations'][-1]['candidate_count']=len(result['candidates'])
  if i==1:
   c=sorted(result['candidates'],key=lambda v:v['display_priority'])[0]
   run('MASK_DOWNLOAD','GET',f'/ai/sessions/{sid}/assets/'+c['candidate_id']+'-alpha.png',headers=ai_headers,params={'result_id':result['result_id']})
  time.sleep(1)
 guard();report['status']='PASSED'
except Exception as e:
 report['status']='FAILED';report['error_type']=type(e).__name__
finally:
 if sid:
  try:report['cleanup']['photo_delete_status']=client.delete(BASE+f'/ai/sessions/{sid}',headers=ai_headers).status_code
  except Exception as e:report['cleanup']['photo_delete_error']=type(e).__name__
 if headers:
  try:report['cleanup']['access_revoke_status']=client.delete(BASE+'/access/session',headers=headers).status_code
  except Exception as e:report['cleanup']['revoke_error']=type(e).__name__
 client.close();(OUT/'cloud-http.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
 if report.get('status')!='PASSED':sys.exit(1)
