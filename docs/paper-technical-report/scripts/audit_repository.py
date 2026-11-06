"""Read source/data and write only this report's derived inventories. No inference/network."""
from pathlib import Path
import collections
import csv
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/paper-technical-report'


def read(path):
    return json.loads((ROOT / path).read_text())


def save(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def key(label):
    return ('VCTLS'.index(label[0]), int(re.search(r'\d+', label)[0]), label)


def meaning(label):
    if label in ('V1', 'V2', 'V3'):
        return {'V1': '三叉神经眼支感觉参考区', 'V2': '三叉神经上颌支感觉参考区', 'V3': '三叉神经下颌支感觉参考区'}[label]
    if '/' in label or '-' in label:
        return f'源图组合标签 {label}；整体保留，不拆分贡献'
    return {'C': '颈', 'T': '胸', 'L': '腰', 'S': '骶'}[label[0]] + f'神经第{label[1:]}节段皮节参考区'


def main():
    prefix = 'data/atlas/goran-2022-preview-v2/'
    views = {v: read(prefix + v + '.json')['regions'] for v in ('front', 'back')}
    all_regions = [r for rs in views.values() for r in rs]
    stats = {}
    for v, rs in views.items():
        stats[v] = {'labels': len({r['labelId'] for r in rs}), 'instances': len(rs),
                    'polygon_parts': sum(len(r['geometry']['coordinates']) for r in rs),
                    'holes': sum(len(p) - 1 for r in rs for p in r['geometry']['coordinates']),
                    'vertices_including_closure': sum(len(ring) for r in rs for p in r['geometry']['coordinates'] for ring in p),
                    'types': dict(collections.Counter(r['partitionType'] for r in rs))}
    stats['distinct_labels_across_views'] = len({r['labelId'] for r in all_regions})
    stats['total_instances'] = len(all_regions)
    stats['manifest'] = read(prefix + 'manifest.json')
    stats['body_sha256'] = hashlib.sha256((ROOT / 'data/body/commons-template4.json').read_bytes()).hexdigest()
    save('audit/atlas-statistics.json', stats)
    labels = []
    for label in sorted({r['labelId'] for r in all_regions}, key=key):
        rs = [r for r in all_regions if r['labelId'] == label]
        labels.append({'label': label, 'partition_type': rs[0]['partitionType'], 'meaning': meaning(label),
                       'front_instances': sum(r['view'] == 'front' for r in rs),
                       'back_instances': sum(r['view'] == 'back' for r in rs),
                       'sides': '/'.join(sorted({r['side'] for r in rs})), 'instances': len(rs),
                       'sources': ';'.join(sorted({s for r in rs for s in r['sourceRefs']})),
                       'medical_review': '/'.join(sorted({r['medicalReviewStatus'] for r in rs}))})
    with (OUT / '附录-神经标签统计.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=labels[0].keys()); writer.writeheader(); writer.writerows(labels)
    title = '# 全部神经参考标签与实例清单\n\n2026-11-02；由当前规范 JSON 只读重统计，不从历史报告抄数量。中文含义仅解释编号，不推导身体边界。\n\n'
    title += '每个左右侧实例可含多片和孔洞；实例数不等于节段数、病例数或病灶数。三叉神经与脊神经分开；未配置不等于没有神经支配。\n\n'
    title += '| 标签 ID | 分区类型 | 中文含义 | 正面实例 | 背面实例 | 解剖侧别 | 合计实例 | 来源 | 医审 |\n|---|---|---|---:|---:|---|---:|---|---|\n'
    for r in labels:
        title += f"| {r['label']} | {r['partition_type']} | {r['meaning']} | {r['front_instances']} | {r['back_instances']} | 左、右 | {r['instances']} | {'正/背' if r['front_instances'] and r['back_instances'] else '正' if r['front_instances'] else '背'} | pending |\n"
    title += '\n来源：Goran_tek-en 2022 同套[正面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg)与[背面](https://commons.wikimedia.org/wiki/File:Dermatomes_labeled,_male_back_3d-shaded.svg)，CC BY-SA 4.0；经本项目提取与配准，非作者原图坐标。详细[许可](08-文献来源与版权.md)。\n\n'
    title += '## 全部 114 个实例\n\n下表的来源路径索引为生成器零基索引，非 DOM ID。精确坐标仍以规范 JSON 为准。\n\n| 实例 ID | 标签 | 面/侧 | 片数 | 孔数 | 顶点（含闭合） | 原路径索引 |\n|---|---|---|---:|---:|---:|---|\n'
    instance_rows = []
    for r in sorted(all_regions, key=lambda r: (r['view'], key(r['labelId']), r['side'])):
        ps = r['geometry']['coordinates']
        row = {'id': r['id'], 'label': r['labelId'], 'view': r['view'], 'side': r['side'],
               'parts': len(ps), 'holes': sum(len(p)-1 for p in ps), 'vertices': sum(len(s) for p in ps for s in p),
               'source_refs': r['sourceRefs'], 'source_path_indices': r.get('sourcePathIndices', []),
               'medical_review': r['medicalReviewStatus']}
        instance_rows.append(row)
        title += f"| {row['id']} | {row['label']} | {row['view']}/{row['side']} | {row['parts']} | {row['holes']} | {row['vertices']} | {','.join(map(str,row['source_path_indices']))} |\n"
    (OUT / '附录-完整神经区域清单.md').write_text(title)
    save('audit/atlas-instances.json', instance_rows)
    save('audit/coverage-limitations.json', {k:v for k,v in read(prefix+'coverage.json').items() if k!='entries'})
    records = subprocess.check_output(['rg','--files','backend','ai','miniprogram','data','scripts','tests','deployment','docs'], cwd=ROOT, text=True).splitlines()
    # Published evidence files only; never inspect runtime, credentials, environment secrets or arbitrary home files.
    paths = [p for p in records if not p.startswith('docs/paper-technical-report/') and Path(p).suffix in ('.py','.ts','.cjs','.json','.md','.txt','.toml','.svg','.png','.jpg','.conf','.service')]
    paths += ['AGENTS.md','README.md','task.md','miniprogram/package-lock.json']
    paths += ['ai/models/MobileSAM-source/' + p for p in ('LICENSE','mobile_sam/build_sam.py','mobile_sam/predictor.py','mobile_sam/modeling/sam.py','mobile_sam/modeling/prompt_encoder.py','mobile_sam/modeling/mask_decoder.py','mobile_sam/modeling/tiny_vit_sam.py','weights/mobile_sam.pt')]
    manifest = []
    symbols = []
    for rel in sorted(set(paths)):
        file = ROOT / rel
        if not file.is_file(): continue
        blob = file.read_bytes()
        manifest.append({'path':rel,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()})
        if file.suffix in ('.py','.ts') and not rel.startswith('docs/'):
            for n,line in enumerate(blob.decode().splitlines(),1):
                if re.match(r'^(?:export )?(?:async )?(?:def |class |function )',line) or re.match(r'^    (?:async )?def ',line):
                    symbols.append({'path':rel,'line':n,'declaration':line.strip()[:220]})
    save('audit/source-manifest.json',manifest); save('audit/symbol-index.json',symbols)
    p0 = read('docs/validation-records/tencent-cloud-mobile-sam-p0-20261101/final-state-and-summary.json')['tests']
    reduced = {k:{x:v[x] for x in ('status','image','load_seconds','model_inference_seconds','segment_seconds','export_seconds','ru_maxrss_bytes','monitor_summary') if x in v} for k,v in p0.items()}
    save('audit/linux-performance-extract.json',reduced)
    print(json.dumps({k:v for k,v in stats.items() if k!='manifest'},ensure_ascii=False))


if __name__ == '__main__':
    main()
