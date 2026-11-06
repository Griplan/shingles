"""Inventory all official gallery files; unavailable bytes remain UNKNOWN."""
import collections, copy, hashlib, json, sys, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'docs/goran-full-atlas-audit/evidence'
sys.path.insert(0,str(Path(__file__).parent))
from audit_geometry import svg_tree
NS='{http://www.w3.org/2000/svg}'
ET.register_namespace('',NS[1:-1])
def main():
    pages=json.loads((OUT/'metadata/commons-imageinfo.json').read_text())['query']['pages']
    inventory=[]
    for page in pages.values():
        ii=page['imageinfo'][0];name=page['title'][5:].replace(' ','_');p=OUT/'originals'/name
        if name in ['Dermatomes_labeled,_male_front_3d-shaded.svg','Dermatomes_labeled,_male_back_3d-shaded.svg']:
            view='front' if '_front_' in name else 'back';local=ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg'
            assert hashlib.sha1(local.read_bytes()).hexdigest()==ii['sha1']
            if not p.exists():p.write_bytes(local.read_bytes())
        entry={'file':name,'page':ii['descriptionurl'],'url':ii['url'],'author':ii['extmetadata'].get('Artist',{}).get('value'),
            'date':ii['extmetadata'].get('DateTimeOriginal',{}).get('value'),'timestamp':ii['timestamp'],
            'fileHistory':[{'timestamp':x['timestamp'],'sha1':x['sha1']} for x in page['imageinfo']],
            'license':ii['extmetadata'].get('LicenseShortName',{}).get('value'),
            'dimensions':[ii['width'],ii['height']],'sha1_official':ii['sha1'],'sha256':'UNKNOWN',
            'status':'DOWNLOAD_LIMITED_429','relation':'same official gallery; original content unverified here'}
        if p.exists():
            blob=p.read_bytes();assert hashlib.sha1(blob).hexdigest()==ii['sha1'];entry['sha256']=hashlib.sha256(blob).hexdigest();entry['status']='BYTES_VERIFIED'
            tree=svg_tree(p);entry['svg']=tree['svg'];entry['tagCounts']=tree['tagCounts'];entry['topGroups']=[n for n in tree['nodes'] if n['tag']=='g' and n['route'].count('/')==1]
            entry['visibleLabels']=sorted(set(n['text'] for n in tree['texts'] if not n['hiddenByDisplay']))
            entry['relation']='shared male/female family; source geometry comparison in version-path-comparison.json'
        inventory.append(entry)
    (OUT/'metadata/all-22-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
    parent=ET.parse(OUT/'originals/Dermatomes_labeled,_female-male_front-back_3d-shaded.svg').getroot()
    comparison=[]
    for view,idx,pi in [('front',6,10),('back',9,14)]:
        r=ET.parse(ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg').getroot()
        def ds(e):return [x.get('d') for x in e.iter() if x.tag==NS+'path']
        comparison.append({'view':view,'standaloneGroup':f'root/{idx}/1','parentGroup':f'root/{pi}/1',
            'standalonePaths':len(ds(r[idx][1])),'parentPaths':len(ds(parent[pi][1])),
            'orderedPathDataIdentical':ds(r[idx][1])==ds(parent[pi][1]),
            'standaloneTransform':r[idx].get('transform'),'parentTransform':parent[pi].get('transform')})
    (OUT/'version-path-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
    family=[]
    for entry in inventory:
        if entry['status']!='BYTES_VERIFIED':continue
        r=ET.parse(OUT/'originals'/entry['file']).getroot()
        ds_all={e.get('d') for e in r.iter() if e.tag==NS+'path'}
        matches={}
        for title,gi in [('female-front',2),('female-back',6),('male-front',10),('male-back',14)]:
            seq=ds(parent[gi][1]);matches[title]={'exactPathStringsPresent':sum(d in ds_all for d in seq),'sourcePaths':len(seq)}
        family.append({'file':entry['file'],'parentFillPathStringMatches':matches,'note':'Exact d-string inclusion is structural evidence only; active transforms and observation surface separately checked.'})
    (OUT/'family-path-comparison.json').write_text(json.dumps(family,indent=2)+'\n')
    # Every obtained version is rendered directly; thumbnails are audit index views.
    for p in (OUT/'originals').glob('*.svg'):
        r=ET.parse(p).getroot();r.set('width','1100');r.set('height',str(1100*float(r.get('viewBox').split()[3])/float(r.get('viewBox').split()[2])))
        r.insert(1,ET.Element(NS+'rect',{'width':'100%','height':'100%','fill':'white'}))
        (OUT/(p.stem+'.preview.svg')).write_text(ET.tostring(r,encoding='unicode'))
    # Inspect hidden vector drafts on the complete parent canvas, separate from final art.
    sheets=[]
    for i in (3,7,11,15):
        r=ET.Element(NS+'svg',{'width':'1500','height':'825','viewBox':parent.get('viewBox')})
        r.append(copy.deepcopy(parent[0]));r.append(ET.Element(NS+'rect',{'width':'100%','height':'100%','fill':'white'}));g=copy.deepcopy(parent[i]);g.set('style','display:inline');r.append(g)
        (OUT/f'parent-hidden-layer-{i}.svg').write_text(ET.tostring(r,encoding='unicode'))
        sheets.append({'route':f'root/{i}','status':'hidden draft explicitly enabled for audit; NOT final medical boundary','image':f'parent-hidden-layer-{i}.png'})
    # Hidden embedded image is a head reference, not hand or sole; no output into production.
    (OUT/'hidden-layer-review.json').write_text(json.dumps(sheets,indent=2)+'\n')
    print('Official files',len(inventory),'bytes verified',sum(x['status']=='BYTES_VERIFIED' for x in inventory));print(comparison)
if __name__=='__main__':main()
