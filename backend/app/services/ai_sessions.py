"""Optional, bounded, local-development service. No torch/ai import at startup."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import threading
import time
from app.services.access import controlled, feature_enabled, upload_limit

ROOT = Path(__file__).resolve().parents[3]
MAX_UPLOAD = 20 * 1024 * 1024
TTL = 30 * 60
MAX_SESSIONS = 8
TIMEOUT = 45

class AIError(Exception):
    def __init__(self, code, message, status=422):
        self.code, self.message, self.status = code, message, status

def enabled():
    return feature_enabled('ENABLE_AI_SEGMENTATION')

def load_model():
    from ai.inference.mobile_sam import MobileSAM
    import torch
    device = os.getenv('AI_DEVICE','cpu')
    if device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    checkpoint = Path(os.getenv('AI_CHECKPOINT', str(ROOT/'ai/models/MobileSAM-source/weights/mobile_sam.pt')))
    return MobileSAM(checkpoint, device=device, threads=1 if controlled() else 4)

class AISessions:
    def __init__(self, root=None, model_factory=load_model, clock=time.time, ttl=TTL):
        self.root = Path(root or os.getenv('AI_TEMP_ROOT',str(ROOT/'private-data'))) / 'v5-ai-sessions'
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.root.chmod(0o700)
        # One worker owns this dedicated directory. A second process fails closed.
        import fcntl
        self.lock_file = (self.root/'.owner-lock').open('a')
        try: fcntl.flock(self.lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.lock_file.close(); raise
        self.clock, self.ttl = clock, ttl
        self.sessions = {}
        self.lock = threading.RLock()
        self.worker = threading.Lock()
        self.model_factory, self.model = model_factory, None
        self.closed = False
        self.persistent = controlled()
        for p in self.root.iterdir():
            if not re.fullmatch('[a-f0-9]{32}',p.name) or not p.is_dir() or p.is_symlink(): continue
            try:
                if not self.persistent: raise ValueError('ephemeral')
                state=p/'session.json'
                if state.is_symlink() or state.stat().st_size > 40*1024*1024: raise ValueError('invalid state')
                s=json.loads(state.read_bytes())
                if s['expires_at'] <= self.clock(): raise ValueError('expired')
                s['token_hash']=bytes.fromhex(s['token_hash'])
                if len(s['token_hash']) != 32: raise ValueError('invalid token hash')
                s['operation']=None
                self.sessions[p.name]=s
            except (OSError,ValueError,KeyError,TypeError): shutil.rmtree(p)

    def _persist(self,sid,s):
        if not self.persistent: return
        path=self.root/sid/'session.json'
        encoded=json.dumps({**s,'token_hash':s['token_hash'].hex()},allow_nan=False).encode()
        temporary=path.with_suffix('.tmp')
        temporary.write_bytes(encoded);temporary.chmod(0o600);temporary.replace(path)

    def sweep(self):
        with self.lock:
            for sid in list(self.sessions):
                if self.sessions[sid]['expires_at'] <= self.clock(): self._delete(sid)

    def _delete(self,sid):
        self.sessions.pop(sid,None)
        shutil.rmtree(self.root/sid,ignore_errors=False)

    def close(self):
        with self.lock:
            self.closed = True
            for sid in list(self.sessions):
                if self.persistent: self._persist(sid,self.sessions[sid])
                else: self._delete(sid)
            self.lock_file.close()

    def create(self,owner_id=None):
        with self.lock:
            self.sweep()
            if self.closed: raise AIError('AI_UNAVAILABLE','AI服务已停止',503)
            if len(self.sessions) >= (2 if controlled() else MAX_SESSIONS): raise AIError('AI_CAPACITY','临时分析已满，请取消旧照片或稍后重试',429)
            sid, token = secrets.token_hex(16), secrets.token_urlsafe(32)
            (self.root/sid).mkdir(mode=0o700)
            self.sessions[sid] = {'token_hash':hashlib.sha256(token.encode()).digest(), 'expires_at':self.clock()+self.ttl,
                                 'photo_id':None,'result':None,'revision':-1,'operation':None,'confirmed':None,'owner_id':owner_id}
            self._persist(sid,self.sessions[sid])
            return {'session_id':sid,'session_token':token,'expires_at':self.sessions[sid]['expires_at'],'development_only':True}

    def get(self,sid,token):
        self.sweep()
        s = self.sessions.get(sid)
        # Missing, expired, foreign and invalid tokens share an error; no enumeration.
        if not s or not token or not hmac.compare_digest(s['token_hash'],hashlib.sha256(token.encode()).digest()):
            raise AIError('AI_SESSION_GONE','照片会话无效或已过期，请重新上传',410)
        return s

    def delete(self,sid,token):
        with self.lock:
            self.get(sid,token); self._delete(sid)

    def upload(self,sid,token,data):
        from ai.preprocessing.image import prepare_image
        from ai.errors import SegmentationError
        from PIL import Image
        with self.lock:
            s=self.get(sid,token)
            if s['photo_id']: raise AIError('PHOTO_EXISTS','请为新照片建立新会话',409)
            if len(data)>upload_limit(): raise AIError('IMAGE_TOO_LARGE','照片超过当前服务大小限制',413)
            p=self.root/sid/'upload.bin'
            try:
                p.write_bytes(data)
                image=prepare_image(p,max_bytes=upload_limit(),max_pixels=3_000_000 if controlled() else 12_000_000)
                image_meta={**image.metadata,'oriented_rgb_sha256':hashlib.sha256(image.rgb.tobytes()).hexdigest()}
                Image.fromarray(image.rgb).save(self.root/sid/'photo.png')
                s.update(photo_id=secrets.token_hex(16),image=image_meta)
                self._persist(sid,s)
            except SegmentationError as e: raise AIError(e.code,'照片格式、大小或内容不符合要求，请更换照片') from None
            finally: p.unlink(missing_ok=True)
            return {'session_id':sid,'photo_id':s['photo_id'],'image':s['image'],'expires_at':s['expires_at']}

    def segment(self,sid,token,payload):
        # Global inference guard: one stateful Predictor, no unbounded work queue.
        if not self.worker.acquire(blocking=False): raise AIError('AI_BUSY','AI正在处理，请稍后重试',429)
        operation=secrets.token_hex(16)
        deadline=self.clock()+TIMEOUT
        try:
            with self.lock:
                s=self.get(sid,token)
                if payload.photo_id != s['photo_id']: raise AIError('PHOTO_MISMATCH','照片已更换，请重新分割',409)
                if payload.prompt_revision < s['revision']: raise AIError('STALE_RESULT','提示已更新，请重新分割',409)
                s.update(revision=payload.prompt_revision,operation=operation,request_id=payload.request_id,result=None,confirmed=None)
                self._persist(sid,s)
                shutil.rmtree(self.root/sid/'result',ignore_errors=True)
                w,h=s['image']['width'],s['image']['height']
                # Decode while holding the session lock; deletion cannot race the open.
                import numpy as np
                from PIL import Image
                from ai.preprocessing.image import PreparedImage
                with Image.open(self.root/sid/'photo.png') as photo:
                    prepared = PreparedImage(np.array(photo.convert('RGB')), dict(s['image']))
            from ai.segmentation import segment_image
            from ai.errors import SegmentationError
            try:
                if self.model is None: self.model=self.model_factory()
                box=payload.prompts.box
                prompts={'coordinate_space':'photo_oriented_pixels_v1',
                         'points':[[p.x*w,p.y*h,p.label] for p in payload.prompts.points],
                         'box':[box.xMin*w,box.yMin*h,box.xMax*w,box.yMax*h] if box else None}
                prompts['additional_boxes']=[[b.xMin*w,b.yMin*h,b.xMax*w,b.yMax*h] for b in payload.prompts.additional_boxes]
                result=segment_image(prepared,prompts,model=self.model,strategy=payload.strategy)
            except SegmentationError as e: raise AIError(e.code,'AI暂未完成分割，请调整提示或稍后重试',503) from None
            except ImportError: raise AIError('AI_UNAVAILABLE','AI运行环境尚未安装，仍可使用手动标注',503) from None
            with self.lock:
                s=self.get(sid,token)
                if s['operation']!=operation: raise AIError('STALE_RESULT','本次请求已失效',409)
                if self.clock()>deadline: raise AIError('AI_TIMEOUT','AI处理超时，请稍后重试',504)
                return self._publish(sid,s,payload,result)
        except ImportError:
            raise AIError('AI_UNAVAILABLE','AI运行环境尚未安装，仍可使用手动标注',503) from None
        except MemoryError:
            raise AIError('OUT_OF_MEMORY','内存不足，请使用较小照片重试',503) from None
        finally:
            self.worker.release()

    def invalidate(self,sid,token,request_id):
        with self.lock:
            try:
                s=self.get(sid,token)
                if s.get('request_id') == request_id:
                    s.update(operation=None,result=None,confirmed=None)
                    self._persist(sid,s)
            except AIError: pass

    def _publish(self,sid,s,payload,result):
        import numpy as np
        from PIL import Image
        summary=[]; masks=result.masks
        w,h=s['image']['width'],s['image']['height']
        for c in result.record['candidates']:
            q=c['quality']
            summary.append({'candidate_id':c['candidate_id'],'status':c['status'],
                'area_ratio':q['area_ratio'],'outside_box_ratio':q['outside_box_ratio'],
                'component_count':c.get('component_count',0),'hole_count':c.get('hole_count',0),
                'warnings':q['warnings'],'quality':q,'display_priority':c['display_priority'],'edit_revision':0})
        encoded=json.dumps(result.record,ensure_ascii=False,allow_nan=False).encode()
        if len(encoded)>8*1024*1024: raise AIError('RESULT_TOO_COMPLEX','轮廓过于复杂，请缩小目标或调整提示；没有删减轮廓',422)
        folder=self.root/sid/'result';folder.mkdir(mode=0o700)
        try:
            for c,mask in zip(result.record['candidates'],masks):
                name=c['candidate_id']
                Image.fromarray(mask.astype(np.uint8)*255).save(folder/(name+'-mask.png'))
                rgba=np.zeros((h,w,4),np.uint8);rgba[mask]=(0,180,130,95)
                Image.fromarray(rgba).save(folder/(name+'-alpha.png'))
            (folder/'record.json').write_bytes(encoded)
        except Exception:
            shutil.rmtree(folder,ignore_errors=True);raise
        s['result']={'record':result.record,'prompts':payload.prompts.model_dump(),'summary':summary,
                     'request_id':payload.request_id,'revision':payload.prompt_revision,'edits':{}}
        self._persist(sid,s)
        return {'session_id':sid,'photo_id':s['photo_id'],'result_id':result.record['result_id'],
                'request_id':payload.request_id,'prompt_revision':payload.prompt_revision,
                'coordinate_space':'photo_oriented_normalized_v1','status':result.record['status'],
                'candidates':summary,'expires_at':s['expires_at']}

    def edit(self,sid,token,p):
        """Replay bounded user strokes from raw AI mask; inference is never called."""
        if not self.worker.acquire(blocking=False):raise AIError('AI_BUSY','AI正在处理，请稍后重试',429)
        deadline=self.clock()+TIMEOUT
        try:
            import numpy as np
            from PIL import Image
            from ai.errors import SegmentationError
            from ai.postprocessing.brush import apply_strokes
            from ai.postprocessing.polygons import mask_to_polygons
            from ai.postprocessing.quality import inspect_mask
            from ai.errors import SegmentationError
            strokes=[v.model_dump() for v in p.strokes]
            with self.lock:
                s=self.get(sid,token);r=s['result']
                if not r or p.photo_id!=s['photo_id'] or p.result_id!=r['record']['result_id'] or p.prompt_revision!=r['revision']:
                    raise AIError('STALE_RESULT','照片或识别结果已变化，请重新识别',409)
                raw=next((c for c in r['record']['candidates'] if c['candidate_id']==p.candidate_id),None)
                if not raw or raw['status']!='ok':raise AIError('INVALID_CANDIDATE','没有可修正的原始候选')
                previous=r['edits'].get(p.candidate_id)
                if previous and p.edit_revision<=previous['revision']:
                    if p.edit_revision==previous['revision'] and strokes==previous['strokes']:return previous['response']
                    raise AIError('STALE_RESULT','修正版本已变化，请重试最新修正',409)
                with Image.open(self.root/sid/'result'/(p.candidate_id+'-mask.png')) as image:
                    original=np.array(image)==255
            corrected=apply_strokes(original,strokes);converted=mask_to_polygons(corrected)
            q=inspect_mask(corrected,r['record']['prompts'],converted.get('component_count',0))
            candidate={'candidate_id':p.candidate_id,**converted,'quality':q}
            summary={'candidate_id':p.candidate_id,'status':converted['status'],'area_ratio':q['area_ratio'],
                'outside_box_ratio':q['outside_box_ratio'],'component_count':converted.get('component_count',0),
                'hole_count':converted.get('hole_count',0),'warnings':q['warnings'],'quality':q,
                'display_priority':raw['display_priority'],'edit_revision':p.edit_revision}
            response={'session_id':sid,'photo_id':p.photo_id,'result_id':p.result_id,'prompt_revision':p.prompt_revision,
                'coordinate_space':'photo_oriented_normalized_v1','candidate':summary}
            encoded=json.dumps({'candidate':candidate,'strokes':strokes},allow_nan=False).encode()
            if len(encoded)>8*1024*1024:raise AIError('RESULT_TOO_COMPLEX','修正轮廓过于复杂，请缩短笔画；原结果保留')
            with self.lock:
                s=self.get(sid,token)
                if s['result'] is not r:raise AIError('STALE_RESULT','识别结果已变化，修正未应用',409)
                if self.clock()>deadline:raise AIError('AI_TIMEOUT','修正处理超时，请重试',504)
                folder=self.root/sid/'result';prefix=p.candidate_id+f'-edit-{p.edit_revision}'
                Image.fromarray(corrected.astype(np.uint8)*255).save(folder/(prefix+'-mask.png'))
                rgba=np.zeros((*corrected.shape,4),np.uint8);rgba[corrected]=(0,180,130,95)
                Image.fromarray(rgba).save(folder/(prefix+'-alpha.png'))
                (folder/(prefix+'.json')).write_bytes(encoded)
                r['edits'][p.candidate_id]={'revision':p.edit_revision,'strokes':strokes,'candidate':candidate,'response':response}
                s['confirmed']=None
                self._persist(sid,s)
                if previous:
                    for suffix in ('-mask.png','-alpha.png','.json'):
                        (folder/(p.candidate_id+f'-edit-{previous["revision"]}'+suffix)).unlink(missing_ok=True)
                return response
        except ImportError:raise AIError('AI_UNAVAILABLE','AI修正组件不可用，原结果保留',503) from None
        except SegmentationError as e:raise AIError(e.code,'修正未能应用，原范围保留，请缩短笔画或撤销') from None
        except MemoryError:raise AIError('OUT_OF_MEMORY','修正内存不足，原范围保留',503) from None
        finally:self.worker.release()

    def confirm(self,sid,token,p):
        with self.lock:
            s=self.get(sid,token);r=s['result']
            if not r or p.photo_id!=s['photo_id'] or p.result_id!=r['record']['result_id'] or p.prompt_revision!=r['revision']:
                raise AIError('STALE_RESULT','结果已失效，请重新分割后确认',409)
            c=next((c for c in r['record']['candidates'] if c['candidate_id']==p.candidate_id),None)
            if not c or c['status']!='ok' or not c['geometry']: raise AIError('INVALID_CANDIDATE','候选为空或轮廓无效，请重新分割')
            edit=r['edits'].get(p.candidate_id)
            if p.edit_revision != (edit['revision'] if edit else 0):
                raise AIError('STALE_RESULT','修正版本已变化，请重试修正并查看最新范围',409)
            if edit: c=edit['candidate']
            if c['status']!='ok' or not c['geometry']:raise AIError('INVALID_CANDIDATE','修正后范围为空或轮廓无效，请撤销或补充区域')
            mask_asset=(p.candidate_id+f'-edit-{edit["revision"]}' if edit else p.candidate_id)+'-mask.png' 
            s['confirmed']={'schema_version':'confirmed-photo-segmentation-v1','session_id':sid,'photo_id':s['photo_id'],
                'result_id':p.result_id,'candidate_id':p.candidate_id,'prompt_revision':p.prompt_revision,
                'coordinate_space':'photo_oriented_normalized_v1','confirmed_by_user':True,'confirmed_at':self.clock(),
                'expires_at':s['expires_at'],'image':s['image'],'model':r['record']['model'],
                'prompts':r['prompts'],'geometry':c['geometry'],'mask_asset':mask_asset,
                'correction':({'edit_revision':edit['revision'],'stroke_count':len(edit['strokes']),
                    'strokes':edit['strokes'],'coordinate_space':'photo_oriented_normalized_v1',
                    'original_mask_asset':p.candidate_id+'-mask.png',
                    'original_mask_sha256':hashlib.sha256((self.root/sid/'result'/(p.candidate_id+'-mask.png')).read_bytes()).hexdigest(),
                    'policy':'user_brush_pixel_centers_v1'} if edit else None),
                'mask_sha256':hashlib.sha256((self.root/sid/'result'/mask_asset).read_bytes()).hexdigest()}
            self._persist(sid,s)
            return s['confirmed']

    def asset(self,sid,token,name,result_id=None):
        with self.lock:
            s=self.get(sid,token)
            if name=='photo.png' and s['photo_id']: p=self.root/sid/name
            elif re.fullmatch(r'candidate-[0-2]-(mask|alpha)\.png',name) and s['result'] and result_id==s['result']['record']['result_id']:
                p=self.root/sid/'result'/name
            elif (m:=re.fullmatch(r'(candidate-[0-2])-edit-([0-9]+)-(mask|alpha)\.png',name)) and s['result'] and result_id==s['result']['record']['result_id']:
                edit=s['result']['edits'].get(m[1])
                if not edit or edit['revision']!=int(m[2]):raise AIError('ASSET_NOT_FOUND','修正预览已失效',404)
                p=self.root/sid/'result'/name
            else: raise AIError('ASSET_NOT_FOUND' ,'图片已失效，请重新分割',404)
            # Read under lock; deletion cannot race a delayed FileResponse open.
            return p.read_bytes()
