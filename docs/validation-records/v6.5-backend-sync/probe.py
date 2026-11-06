"""Bounded version probe on already configured endpoints; no credentials logged."""
import httpx,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
m=json.loads((root/'data/atlas/goran-2022-preview-v3/manifest.json').read_text());b=(root/'data/body/commons-template4-hands-v2.json').read_bytes()
i={'template_id':m['templateId'],'template_version':m['templateVersion'],'geometry_id':m['geometryId'],'region_set_id':json.loads(b)['views']['front']['regionSetId'],'atlas_id':'goran-2022','atlas_version':m['atlasVersion'],'atlas_content_sha256':m['contentSHA256'],'body_content_sha256':hashlib.sha256(b).hexdigest(),'coordinate_system':'normalized_2d_top_left'}
p={'request_id':'version-check','annotation_revision':1,'identity':i,'lesions':[{'id':'synthetic-check','view':'front','vertices':[{'x':.48,'y':.32},{'x':.49,'y':.32},{'x':.49,'y':.33}]}]}
output=[]
for base in ['http://127.0.0.1:8000','http://212.64.26.206/dermatome-test']:
 headers={};client=httpx.Client(base_url=base,trust_env=False,timeout=15);row={'endpoint':base}
 try:
  row['health_status']=client.get('/api/v1/health').status_code
  if '212.64.' in base:
   q=client.post('/api/v1/access/session',json={});row['access_status']=q.status_code
   if q.status_code==200:headers={'authorization':'Bearer '+q.json()['access_token']}
  q=client.get('/api/v1/ready',headers=headers);d=q.json();row['ready']={'status':q.status_code,**{k:d[k] for k in ['identity','error'] if k in d}}
  q=client.post('/api/v1/evaluate',headers=headers,json=p);d=q.json();row['evaluate']={'status':q.status_code,'error':d.get('error'),'identity':d.get('identity'),'labels':[c['label'] for c in d.get('lesions',[{}])[0].get('candidates',[])]}
 except Exception as e:row['connection_error']=type(e).__name__+': '+str(e)[:160]
 finally:
  if headers:row['revoke_status']=client.delete('/api/v1/access/session',headers=headers).status_code
  client.close()
 output.append(row)
print(json.dumps(output,ensure_ascii=False,indent=2))
