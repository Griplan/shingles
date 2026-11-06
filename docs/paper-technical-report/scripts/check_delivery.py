"""Validate this documentation package; never mutates core code or resources."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parents[1]
def save(name,value):
 (OUT/'audit'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def main():
 before=json.loads((OUT/'audit/protected-files-before.json').read_text())
 changed=[p for p,h in before.items() if not (ROOT/p).is_file() or hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
 now=subprocess.check_output(['rg','--files','backend','ai','miniprogram','data','scripts','tests','deployment'],cwd=ROOT,text=True).splitlines()
 additions=sorted(set(now)-set(before))
 check={'protected_files':len(before),'changed':changed,'added_core_files':additions,'passed':not changed and not additions}
 save('protected-files-check.json',check)
 problems=[];links=0
 for f in OUT.rglob('*.md'):
  for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',f.read_text()):
   if link.startswith(('http:','https:','#','mailto:')):continue
   path=link.split('#')[0];links+=1
   if path and not (f.parent/path).exists():problems.append({'file':str(f.relative_to(OUT)),'target':link})
 figs=json.loads((OUT/'figures/figure-index.json').read_text())
 for fig in figs:
  for ext in ('mmd','md','png','svg'):
   q=OUT/'figures'/(fig['stem']+'.'+ext)
   if not q.is_file() or q.stat().st_size==0:problems.append({'missing_figure':str(q)})
 stat=json.loads((OUT/'audit/atlas-statistics.json').read_text())
 instances=json.loads((OUT/'audit/atlas-instances.json').read_text())
 assert len(instances)==114 and len({r['label'] for r in instances})==35
 for view,n,t in [('front',54,27),('back',60,30)]:
  rows=[r for r in instances if r['view']==view];assert len(rows)==n and len({r['label'] for r in rows})==t
 render=json.loads((OUT/'figures/render-log.json').read_text());assert len(render)==18 and all(x['exit_code']==0 for x in render)
 required=['阅读指南.md','技术结论与证据索引.md','附录-完整神经区域清单.md','附录-神经标签统计.csv']
 required.extend(p.name for p in OUT.glob('[0-9][0-9]-*.md'))
 for name in required:
  assert (OUT/name).is_file(), name
 assert len(list(OUT.glob('[0-9][0-9]-*.md')))==10
 record={'links_checked':links,'link_or_figure_problems':problems,'chapters':10,'editable_figures':len(figs),'render_jobs_passed':len(render),'labels':35,'instances':114,'core_protection':check,'passed':not problems and check['passed']}
 save('delivery-check.json',record)
 assert record['passed'],record
 manifest=[{'path':str(f.relative_to(OUT)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(OUT.rglob('*')) if f.is_file() and f.name!='delivery-manifest.json' and '__pycache__' not in f.parts]
 save('delivery-manifest.json',manifest)
 print(json.dumps(record,ensure_ascii=False))
if __name__=='__main__':main()
