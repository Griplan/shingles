"""Read-only runtime regression and real WeChat static compilers; not a UI run."""
import hashlib,json,subprocess,tempfile
from pathlib import Path
R=Path.cwd();O=R/'docs/validation-records/v6.6-axilla/full-simulation/evidence';records=[]
for name,args,cwd in [
 ('typecheck',['npm','run','typecheck'],R/'miniprogram'),
 ('old-axilla-reproduction',[str(R/'ai/.venv/bin/python'),'scripts/build_axilla.py'],R),
 ('sole-reproduction',[str(R/'ai/.venv/bin/python'),'scripts/build_sole_atlas.py'],R),
 ('wholebody-atlas',[str(R/'ai/.venv/bin/python'),'scripts/check_preview_atlas.py'],R)]:
 p=subprocess.run(args,cwd=cwd,capture_output=True,text=True);(O/(name+'.log')).write_text(p.stdout+p.stderr);records.append(dict(name=name,exitCode=p.returncode));assert p.returncode==0,(name,p.stdout,p.stderr)
compiler=Path('/Applications/wechatwebdevtools.app/Contents/Resources/package.nw/node_modules/wcc-exec')
with tempfile.TemporaryDirectory() as tmp:
 for tool,ext in [('wcc','wxml'),('wcsc','wxss')]:
  dest=Path(tmp)/tool;files=[f'pages/local-surface/local-surface.{ext}',f'components/local-surface-canvas/local-surface-canvas.{ext}']
  p=subprocess.run([str(compiler/tool),*files,'-o',str(dest)],cwd=R/'miniprogram',capture_output=True,text=True);(O/(tool+'.log')).write_text(p.stdout+p.stderr);records.append(dict(name=tool,exitCode=p.returncode,bytes=dest.stat().st_size if dest.exists() else 0));assert p.returncode==0
before=json.loads((R/'docs/validation-records/v6.6-axilla/medical-review/evidence/protected-before.json').read_text())
changed=[f for f,h in before.items() if hashlib.sha256((R/f).read_bytes()).hexdigest()!=h]
assert not any(f.startswith('data/') or f.startswith('miniprogram/assets/') or f.endswith('dermatome_matcher.py') or f.endswith('annotation-geometry.ts') for f in changed)
(O/'checks.json').write_text(json.dumps(dict(commands=records,protectedFiles=len(before),intentionalChangedFiles=changed,unchangedProtectedFiles=len(before)-len(changed),medicalReview='NOT_RUN',wechatRuntime='NOT_RUN'),ensure_ascii=False,indent=2))
print(records,changed)
