"""Local verification only; no server access or WeChat upload."""
import hashlib,json,subprocess,tempfile,datetime,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent/'evidence'
records=[]
def run(name,args,cwd=ROOT):
    p=subprocess.run(args,cwd=cwd,capture_output=True,text=True)
    (OUT/(name+'.log')).write_text(p.stdout+p.stderr)
    records.append(dict(name=name,command=args,exitCode=p.returncode))
    return p

for name,script in [('axilla-reproduction','build_axilla.py'),('source-audit','audit_axilla_sources.py'),('sole-reproduction','build_sole_atlas.py'),('wholebody-atlas-check','check_preview_atlas.py'),('project-check','check_project.py')]:
    run(name,[str(ROOT/'ai/.venv/bin/python'),str(ROOT/'scripts'/script)])
compiler=Path('/Applications/wechatwebdevtools.app/Contents/Resources/package.nw/node_modules/wcc-exec')
compiler_records=[]
with tempfile.TemporaryDirectory(prefix='v66-wx-') as tmp:
    for tool,ext in [('wcc','wxml'),('wcsc','wxss')]:
        files=[f'pages/{name}/{name}.{ext}' for name in ['special-parts','local-surface']]+[f'components/local-surface-canvas/local-surface-canvas.{ext}']
        dest=Path(tmp)/(tool+'.js')
        p=run('wechat-'+tool,[str(compiler/tool),*files,'-o',str(dest)],ROOT/'miniprogram')
        compiler_records.append(dict(compiler=tool,files=files,exitCode=p.returncode,outputBytes=dest.stat().st_size if dest.exists() else 0,outputSHA256=hashlib.sha256(dest.read_bytes()).hexdigest() if dest.exists() else None))
(OUT/'wechat-compiler.json').write_text(json.dumps(compiler_records,indent=2)+'\n')
before=json.loads((OUT/'protected-before.json').read_text());after={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() if (ROOT/name).is_file() else 'missing' for name in before}
changes=[name for name in before if before[name]!=after[name]]
(OUT/'protected-after.json').write_text(json.dumps(dict(checkedFiles=len(before),changedFiles=changes,hashes=after),indent=2)+'\n')
(OUT/'checks.json').write_text(json.dumps(dict(time=datetime.datetime.now().astimezone().isoformat(),commands=records,protectedFiles=len(before),protectedChanges=changes),indent=2)+'\n')
print(json.dumps(dict(checks=records,protectedFiles=len(before),protectedChanges=changes),indent=2))
sys.exit(1 if changes or any(r['exitCode'] for r in records) else 0)
