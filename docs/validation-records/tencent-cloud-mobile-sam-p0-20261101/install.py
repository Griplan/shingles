import subprocess,sys,json,importlib.metadata as m,pathlib,time,hashlib
root=pathlib.Path.cwd();start=time.monotonic();wheelhouse=root/'model/wheelhouse';wheelhouse.mkdir(exist_ok=True)
requirements=['torch==2.5.1+cpu','torchvision==0.20.1+cpu','timm==1.0.12','numpy==2.1.3','Pillow==11.1.0','shapely==2.1.2','psutil==6.1.1','setuptools==75.8.0','wheel==0.45.1']
base=[sys.executable,'-m','pip','--disable-pip-version-check']
# Persist one CPU wheel per package here; repeated attempts reuse it. No global cache.
if not (list(wheelhouse.glob('torch-2.5.1+cpu-*.whl')) and list(wheelhouse.glob('torchvision-0.20.1+cpu-*.whl'))):
 subprocess.run([*base,'download','--timeout','90','--retries','2','--no-cache-dir','--no-deps','--only-binary=:all:','--index-url','https://download.pytorch.org/whl/cpu','--dest',str(wheelhouse),*requirements[:2]],check=True)
subprocess.run([*base,'download','--timeout','90','--retries','2','--no-cache-dir','--only-binary=:all:','--index-url','https://mirrors.cloud.tencent.com/pypi/simple','--find-links',str(wheelhouse),'--dest',str(wheelhouse),*requirements],check=True)
subprocess.run([*base,'install','--no-cache-dir','--no-index','--find-links',str(wheelhouse),*requirements],check=True)
subprocess.run([*base,'install','--no-deps','--no-build-isolation','--no-cache-dir',str(root/'model/MobileSAM-source')],check=True)
subprocess.run([*base,'check'],check=True)
versions={d.metadata['Name']:d.version for d in m.distributions()};files=[{'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in wheelhouse.iterdir() if p.is_file()]
(root/'logs/packages.json').write_text(json.dumps({'python':sys.version,'packages':versions,'elapsed_seconds':time.monotonic()-start,'direct_requirements':requirements,'wheelhouse':files},indent=2))
print('ISOLATED_INSTALL_COMPLETE',flush=True)
