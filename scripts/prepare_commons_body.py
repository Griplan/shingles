"""Rebuild licensed Commons PNGs and source-derived hit geometry, never draw an invented body.

Requires the existing backend venv (Shapely) and an installed Sharp path; no downloads/install.
Usage: backend/.venv/bin/python scripts/prepare_commons_body.py --sharp /path/to/sharp
"""
from pathlib import Path
from collections import deque, defaultdict
import argparse, copy, hashlib, json, subprocess, tempfile
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'miniprogram/assets/body/commons-cc0'
SOURCE_SHA='486cdc8a89fbfe0ff0a4bb4104efc19bb5c708337c37768be6f9120c4837753a'
SVG='{http://www.w3.org/2000/svg}'

def extract(directory):
    source=(DEST/'source.svg').read_bytes()
    if hashlib.sha256(source).hexdigest()!=SOURCE_SHA:
        raise ValueError('Source SHA-256 does not match reviewed CC0 SVG')
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    original=ET.fromstring(source);layer=original.find(SVG+'g')
    for view,gid in [('front','g5692'),('back','g5815')]:
        result=ET.Element(SVG+'svg',{'width':'750','height':'768','viewBox':'-4 267 750 768'})
        for child in original:
            if child.tag==SVG+'defs':result.append(copy.deepcopy(child))
        selected=ET.SubElement(result,SVG+'g',{'transform':layer.get('transform')})
        selected.append(copy.deepcopy(next(g for g in layer if g.get('id')==gid)))
        ET.ElementTree(result).write(directory/(view+'-extracted.svg'),encoding='utf-8',xml_declaration=True)

def fill_enclosed(directory):
    w,h=1200,2700
    for view in ['front','back']:
        ink=(directory/(view+'-ink.raw')).read_bytes()
        if len(ink)!=w*h:raise ValueError('Mask must be single-channel')
        outside=bytearray(w*h);q=deque()
        for x in range(w):q.extend([x,(h-1)*w+x])
        for y in range(1,h-1):q.extend([y*w,y*w+w-1])
        while q:
            i=q.popleft()
            if outside[i] or ink[i]:continue
            outside[i]=1;y,x=divmod(i,w)
            if x:q.append(i-1)
            if x<w-1:q.append(i+1)
            if y:q.append(i-w)
            if y<h-1:q.append(i+w)
        (directory/(view+'-body.raw')).write_bytes(bytes(0 if v else 255 for v in outside))

def trace_geometry(D):
    dest=DEST;W,H,S=1200,2700,3
    outlines={};report={}
    for view in ['front','back']:
     mask=(D/(view+'-body.raw')).read_bytes();edges=defaultdict(list);stride=W+1
     for y in range(H):
      for x in range(W):
       i=y*W+x
       if not mask[i]:continue
       a=y*stride+x;b=a+1;c=a+stride+1;d=a+stride
       if y==0 or not mask[i-W]:edges[a].append(b)
       if x==W-1 or not mask[i+1]:edges[b].append(c)
       if y==H-1 or not mask[i+W]:edges[c].append(d)
       if x==0 or not mask[i-1]:edges[d].append(a)
     loops=[]
     while edges:
      start=next(iter(edges));current=start;pts=[]
      while True:
       pts.append((current%stride/S,current//stride/S));targets=edges[current];nxt=targets.pop()
       if not targets:del edges[current]
       current=nxt
       if current==start:break
       assert current in edges,'Open raster boundary'
      if len(pts)>3:loops.append(Polygon(pts))
     poly=max(loops,key=lambda p:p.area);assert poly.is_valid
     simple=poly.simplify(.3,preserve_topology=True);assert simple.is_valid
     pts=[[round(x,4),round(y,4)] for x,y in list(simple.exterior.coords)[:-1]]
     outlines[view]=[['M',*pts[0]]]+[['L',*p] for p in pts[1:]]+[['Z']]
     report[view]={'rawBoundaryVertices':len(poly.exterior.coords)-1,'simplifiedVertices':len(pts),'area':simple.area,'bounds':simple.bounds,'valid':simple.is_valid,'rasterClosingPixels':3,'logicalSimplificationTolerance':.3}
     # Flat neutral fill from the source raster's enclosed area, retaining original black ink on top.
     rgba=bytearray(W*H*4)
     for i,v in enumerate(mask):
      if v:rgba[i*4:i*4+4]=bytes((249,244,238,255))
     (D/(view+'-matte.rgba')).write_bytes(rgba)
    lines=['// GENERATED from the licensed source raster, not hand-drawn human geometry.',
           '// Source groups g5692/front and g5815/back; source.svg SHA-256 in manifest.json.',
           'import { PathCommand } from "../../../types/dermatome";',
           'const freezePath=(p:readonly PathCommand[]):readonly PathCommand[]=>Object.freeze(p.map(c=>Object.freeze(c)));']
    for v,data in outlines.items():lines.append('export const '+v.upper()+'_OUTLINE=freezePath('+json.dumps(data,separators=(',',':'))+');')
    (dest/'geometry.generated.ts').write_text('\n'.join(lines)+'\n')
    return report


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--sharp',required=True);args=parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='dermatome-commons-') as temporary:
        directory=Path(temporary);extract(directory)
        command=['node',str(ROOT/'scripts/prepare_commons_body.cjs'),args.sharp,str(directory)]
        subprocess.run(command+['rasterize'],check=True,cwd=ROOT)
        fill_enclosed(directory);geometry=trace_geometry(directory)
        subprocess.run(command+['compose'],check=True,cwd=ROOT)
        manifest={'templateId':'commons-neutral-v1','templateVersion':'4.0.0','geometryId':'commons-blank-cc0-v1',
          'sourceURL':'https://commons.wikimedia.org/wiki/File:Human_body_with_blank_labels.svg',
          'authors':['Šlomo','Michael W Harris (Digital Nomad)','Christophe Dang Ngoc Chan (Cdang)'],
          'license':'CC0-1.0','licenseURL':'https://creativecommons.org/publicdomain/zero/1.0/',
          'sourceSHA256':SOURCE_SHA,'sourceGroups':{'front':'g5692','back':'g5815'},
          'normalization':json.loads((directory/'normalization.json').read_text()),'geometry':geometry,
          'changes':['Removed label/leader elements by selecting original body groups only',
             'Same uniform scale for both views; translation and transparent interaction margins',
             '3x PNG with flat neutral interior under original ink; no body deformation',
             'Source raster boundary, 3x3 raster closing, 0.3 logical-unit simplification'],
          'files':{name:hashlib.sha256((DEST/name).read_bytes()).hexdigest() for name in
             ['source.svg','front.svg','back.svg','front.png','back.png','geometry.generated.ts']}}
        (DEST/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'result':'generated','sourceSHA256':SOURCE_SHA,'geometry':geometry}))

if __name__=='__main__':main()
