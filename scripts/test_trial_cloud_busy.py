"""One real inference plus one simultaneous rejection; explicit direct SSH loopback."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,time,httpx
root=Path(__file__).resolve().parents[1];base='http://127.0.0.1:18001/api/v1';output=root/'docs/validation-records/p4-wechat-trial-20261101/trial-busy.json'
code=json.loads((root/'private-data/p4-busy-invitation.json').read_text())['invitation']
client=httpx.Client(trust_env=False,timeout=60)
h={};url=None;report={'transport':'direct loopback through admin SSH; not phone or HTTPS'}
try:
 r=client.post(base+'/access/exchange',json={'invitation':code});assert r.status_code==200
 h={'authorization':'Bearer '+r.json()['access_token']}
 s=client.post(base+'/ai/sessions',headers=h,json={});assert s.status_code==200
 session=s.json();url=base+'/ai/sessions/'+session['session_id'];h['x-ai-session-key']=session['session_token']
 p=client.post(url+'/photo',headers=h,files={'file':('CDC21505.jpg',(root/'ai/experiments/inputs/cdc-21505.jpg').read_bytes())});assert p.status_code==200
 payload={'photo_id':p.json()['photo_id'],'request_id':'busy-primary','prompt_revision':1,'prompts':{'coordinate_space':'photo_oriented_normalized_v1','points':[],'box':{'xMin':215/700,'yMin':245/460,'xMax':495/700,'yMax':385/460}}}
 with ThreadPoolExecutor(2) as ex:
  first=ex.submit(client.post,url+'/segment',headers=h,json=payload)
  time.sleep(.25)
  second=client.post(url+'/segment',headers=h,json={**payload,'request_id':'busy-secondary'})
  result=first.result()
 assert result.status_code==200 and second.status_code==429 and second.json()['error']['code']=='AI_BUSY'
 report.update(status='PASSED',primary_status=result.status_code,concurrent_status=second.status_code,code='AI_BUSY',image='public CDC21505',one_real_inference=True)
except Exception as e:
 report.update(status='FAILED',error_type=type(e).__name__)
 raise
finally:
 if url:
  try:report['photo_delete_status']=client.delete(url,headers=h).status_code
  except httpx.HTTPError:report['photo_cleanup']='TTL fallback; transport unavailable'
 if h:
  try:report['access_revoke_status']=client.delete(base+'/access/session',headers=h).status_code
  except httpx.HTTPError:report['access_cleanup']='Fixed expiry fallback; transport unavailable'
 output.write_text(json.dumps(report,indent=2)+'\n');client.close()
 if report.get('status')=='PASSED':print(json.dumps(report))
