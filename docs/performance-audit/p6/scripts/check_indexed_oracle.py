"""Run the existing independent Shapely oracle with deeply frozen JS body inputs.

The original oracle uses mutable JSON and exercises the non-indexed fallback.
Only input immutability changes here; cases and expected Shapely values do not.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[4]
path=root/'scripts/check_placement_geometry.py'
source=path.read_text()
needle="process.stdout.write(JSON.stringify(d.cases.map(c=>{"
assert source.count(needle)==1
source=source.replace(needle,"const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}};freeze(d.bodies);"+needle)
exec(compile(source,str(path),'exec'),{'__file__':str(path),'__name__':'__main__'})
