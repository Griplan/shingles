"""V6.6.1 documentation-only review boards. Never writes runtime assets/atlas.
Observation windows are hand-authored review aids, NOT dermatomes.
"""
import base64,copy,csv,hashlib,html,json,math,re,sys,xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import Point,Polygon,LineString,box,mapping,shape
from shapely.affinity import scale,affine_transform
from shapely.ops import unary_union
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
from build_sole_atlas import at,matrix,geo,svg_path
from svg_geometry import flatten_geometry
NS='{http://www.w3.org/2000/svg}'
ET.register_namespace('',NS[1:-1])
SELECT={'front':[(1,'T1'),(2,'T2'),(3,'T3'),(19,'T1'),(20,'T2')],'back':[(6,'T1'),(7,'T2'),(8,'T3'),(41,'T1/T2')]}
INSETS={'front':{0,22,23,24,25,26,27},'back':{0,1,2,3,4,5,45}}
SHA={'front':'d20be473843591779be22c102e193d8c1407861d','back':'261566ce5128fdc2cc536945c148ac1c8f62e66d'}
NAMES={'front/1':'上胸近肩的斜向带，双侧跨胸投影','front/2':'前上胸第二斜向带，臂躯干连接附近','front/3':'前上胸第三带，向较低胸壁过渡','front/19':'上臂/躯干交界的可见纵向片，非完整腋窝','front/20':'内臂近胸侧可见片，与中央隐藏面不同','back/6':'上背与肩臂交界横斜带','back/7':'上背较低相邻带','back/8':'再低一带的背侧胸壁投影','back/41':'背侧内臂的长条组合区域，向远端延伸，不仅腋缘'}

def write(name,data):
    p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def t(x,y,text,size=22,color='#263f3a',weight='normal'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}">{html.escape(text)}</text>'
def lines(x,y,rows,size=21,gap=32,color='#263f3a'):
    return ''.join(t(x,y+i*gap,row,size,color) for i,row in enumerate(rows))
def frame(x,y,w,h,title):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#fff" stroke="#c5d6d0"/>'+t(x+22,y+36,title,24,weight='bold')
def emit(name,w,h,content):
    (OUT/'figures'/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="#f7faf8"/><g font-family="PingFang SC,Arial,sans-serif">{content}</g></svg>')
def prefixed(node,prefix):
    text=ET.tostring(node,encoding='unicode')
    text=re.sub(r'id="([^"]+)"',lambda m:'id="'+prefix+m[1]+'"',text)
    text=re.sub(r'url\(#([^)]+)\)',lambda m:'url(#'+prefix+m[1]+')',text)
    return re.sub(r'href="#([^"]+)"',lambda m:'href="#'+prefix+m[1]+'"',text)
def source_panel(view,side,x,y,w=340,h=340):
    # Viewports only: not correspondence matrices. Front and back switch
    # screen halves for the SAME anatomical side.
    left=(side=='right') if view=='front' else (side=='left')
    bounds=(80 if left else 250,175,110,210)
    e=ET.parse(ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg').getroot()
    e.set('viewBox',' '.join(map(str,bounds)))
    for k,v in dict(x=x,y=y,width=w,height=h).items():e.set(k,str(v))
    return prefixed(e,f'{view}-{side}-{x}-')

def audit():
    records=[];cards='';all_originals={}
    for view,selections in SELECT.items():
        blob=(ROOT/f'docs/research/v3-atlas/goran-{view}.original.svg').read_bytes();assert hashlib.sha1(blob).hexdigest()==SHA[view]
        root=ET.fromstring(blob);assert not any(e.tag in [NS+'mask',NS+'clipPath',NS+'use'] for e in root.iter())
        parent='root/'+('6' if view=='front' else '9')+'/1';parent_node=at(root,parent)
        raw={i:geo(root,parent+'/'+str(i),.02) for i in range(len(parent_node)) if i not in INSETS[view]}
        visible={};painted=None
        for i in sorted(raw,reverse=True):
            visible[i]=raw[i] if painted is None else raw[i].difference(painted)
            painted=raw[i] if painted is None else unary_union([painted,raw[i]])
        all_originals[view]=root
        prior=json.loads((ROOT/f'docs/goran-full-atlas-audit/evidence/{view}-raw-source-regions.json').read_text())['regions']
        for i,label in selections:
            route=parent+'/'+str(i);e=at(root,route);old=next(p for p in prior if p['route']==route)
            path_sha=hashlib.sha256(e.get('d').encode()).hexdigest()
            assert old['label']==label and old['pathD_SHA256']==path_sha
            g=visible[i];assert raw[i].is_valid and g.is_valid and not g.is_empty
            mid=233 if view=='front' else 218
            halves={'right' if view=='front' else 'left':box(-100,-100,mid,1000),'left' if view=='front' else 'right':box(mid,-100,600,1000)}
            sides={side:{'areaSVGUnits2':g.intersection(half).area,'boundsSVG':list(g.intersection(half).bounds)} for side,half in halves.items()}
            fill_rule='evenodd' if 'fill-rule:evenodd' in e.get('style','') else 'nonzero'
            row=dict(key=f'{view}-p{i}',view=view,route=route,sourceElementId=e.get('id'),sourceLabel=label,sourceSHA1=SHA[view],pathD_SHA256=path_sha,accumulatedMatrix=matrix(root,route),fillRule=fill_rule,mask=None,clipPath=None,
                rawAreaSVGUnits2=raw[i].area,paintVisibleAreaSVGUnits2=g.area,rawParts=len(flatten_geometry(raw[i])),paintVisibleParts=len(flatten_geometry(g)),boundsSVG=list(g.bounds),sides=sides,description=NAMES[f'{view}/{i}'],
                sourceCoordinatesReusable=True,targetRegistration='NOT_ESTABLISHED',targetBoundary=None,hiddenSurface='No source path for the unfolded axillary floor; visibility extent on target UNKNOWN',
                visibleGeometry=mapping(g),rawGeometry=mapping(raw[i]),sourceLicense='CC BY-SA 4.0',labelEvidence='Prior audited source-map + pinned original visible glyph/leader context; no text nodes; review source panels, not array index alone.')
            records.append(row)
            n=len(records)-1;x=30+(n%3)*450;y=120+(n//3)*510
            cards+=frame(x,y,425,490,f'{view} p{i} · {label}')
            panel=copy.deepcopy(root);panel.set('viewBox','70 150 310 330')
            for k,v in dict(x=x+12,y=y+60,width=400,height=330).items():panel.set(k,str(v))
            cards+=prefixed(panel,f'card{n}-')
            cards+=f'<svg x="{x+12}" y="{y+60}" width="400" height="330" viewBox="70 150 310 330"><path d="{svg_path(g)}" fill-rule="evenodd" fill="#256e8a" fill-opacity=".45" stroke="#073e5d" stroke-width="1.2"/></svg>'
            cards+=lines(x+18,y+417,[route,'深色：该源元素的可见填充轮廓','仅源姿态成立；未配准到腋下'],18,26)
    write('evidence/goran-paths-rechecked.json',dict(auditOnly=True,coordinateSpace='original_svg_user_units',toleranceSVGUnits=.02,visibilityMethod='subtract later flat dermatomal paint paths, exclude separate head insets; shading/outlines retained only in source context panels; not a 3D occlusion reconstruction',registeredTargetRegions=0,paths=records))
    with (OUT/'原始Goran路径对应表.csv').open('w',newline='') as f:
        fields=['key','sourceLabel','route','description','rawAreaSVGUnits2','paintVisibleAreaSVGUnits2','boundsSVG','sourceCoordinatesReusable','targetRegistration','pathD_SHA256']
        w=csv.DictWriter(f,fields);w.writeheader();w.writerows({k:r[k] for k in fields} for r in records)
    emit('03-Goran九路径源图对照.svg',1400,1715,t(30,48,'Goran 九个源路径 · 可见投影逐项复核',32,weight='bold')+t(30,85,'源图可复现 ≠ 抬臂腋窝可配准；原始曲线和组合标签均保留',21)+cards+lines(30,1680,['Goran_tek-en / CC BY-SA 4.0；裁切、采样及突出显示为本项目修改。非医学审核结论。'],18))
    return records

def drafts():
    body=json.loads((ROOT/'data/body/axilla-v1.json').read_text());right=shape(body['views']['axilla-right']['geometry'])
    # Discussion windows deliberately overlap. No segment labels/area allocation.
    windows=[('O1','腋窝中央',scale(Point(.55,.45).buffer(1,resolution=24),.085,.07,origin=(.55,.45))),
        ('O2','腋前褶',LineString([(.645,.17),(.66,.32),(.67,.4),(.645,.46)]).buffer(.025)),
        ('O3','腋后褶',LineString([(.36,.50),(.46,.49),(.55,.43),(.62,.34)]).buffer(.024)),
        ('O4','上臂近端内侧',Polygon([(.27,.17),(.55,.17),(.57,.32),(.42,.40),(.32,.32)])),
        ('O5','邻近胸壁',Polygon([(.57,.57),(.82,.48),(.90,.58),(.90,.79),(.55,.79)]))]
    labelpos={'O1':(.54,.47),'O2':(.73,.30),'O3':(.425,.535),'O4':(.41,.255),'O5':(.74,.685)}
    out={}
    for side in ['left','right']:
        m=lambda g:scale(g,-1,1,origin=(.5,0)) if side=='left' else g
        rows=[dict(id=i,name=n,category='anatomical_observation_window',status='review-draft',geometry=mapping(m(g.intersection(right))),segmentLabel=None,
            labelPoint=[1-labelpos[i][0],labelpos[i][1]] if side=='left' else list(labelpos[i]),
            boundaryMeaning='editor-selected discussion window, not anatomical ground-truth nor dermatome; overlap allowed',sourceRefs=['D1','M5'],reviewDecision=None) for i,n,g in windows]
        out[side]=dict(status='review-draft',runtimeEligible=False,viewId='axilla-'+side,templateId=body['templateId'],templateVersion=body['templateVersion'],geometryId=body['geometryId'],coordinateSpace='review_template_normalized_v1',
            bodyContentSHA256=hashlib.sha256((ROOT/'data/body/axilla-v1.json').read_bytes()).hexdigest(),observationWindows=rows,
            landmarks=[dict(id='K2',type='key_sensory_point',sourceRefs=['M1','M2'],description='T2 key sensory point: apex of axilla; an examination point, not a boundary',confirmedNormalizedPoint=None,
                displayQuestionMarker=[.42,.395] if side=='left' else [.58,.395],markerMeaning='UI callout only; NOT a proposed or verified anatomical coordinate',reviewDecision=None),
                dict(id='K1',type='key_sensory_point',sourceRefs=['M1'],description='T1: medial antecubital fossa; outside this crop',confirmedNormalizedPoint=None),
                dict(id='K3',type='key_sensory_point',sourceRefs=['M1'],description='T3: midclavicular third intercostal space; landmarks not visible in this crop',confirmedNormalizedPoint=None)],
            dermatomeDrafts=[],knownDermatomeBoundariesOnTemplate=[],hiddenSurfaceMask=None,
            missingSurfaceNote='H1 qualitative annotation at O1: Goran arms-down source does not unfold axillary floor. No exact hidden-surface polygon can be inferred.',approval=None)
        write('review-draft/'+side+'-observation-windows.json',out[side])
        # Editable 400x360 worksheet: empty review layer; no neural geometry.
        sheet=ET.parse(ROOT/f'miniprogram/assets/axilla/axilla-{side}.svg').getroot()
        metadata=ET.SubElement(sheet,NS+'metadata')
        metadata.text=json.dumps(dict(status='review-draft',runtimeEligible=False,viewId='axilla-'+side,
            templateId=body['templateId'],templateVersion=body['templateVersion'],
            logicalSize=[400,360],coordinateSpace='template_logical_pixels_for_review',
            purpose='Empty layer for clinician-supplied boundaries; no approval or dermatome regions'),ensure_ascii=False)
        ET.SubElement(sheet,NS+'g',{'id':'clinician-boundaries-review-draft'})
        ET.ElementTree(sheet).write(OUT/f'review-draft/{side}-annotation-sheet.svg',encoding='unicode')
    return out

def boards(ds):
    for side,d in ds.items():
        cn='左' if side=='left' else '右';name='01-左腋下待审核参考图.svg' if side=='left' else '02-右腋下待审核参考图.svg'
        current=ET.parse(ROOT/f'miniprogram/assets/axilla/axilla-{side}.svg').getroot()
        current.set('x','50');current.set('y','190');current.set('width','780');current.set('height','702')
        body=shape(json.loads((ROOT/'data/body/axilla-v1.json').read_text())['views']['axilla-'+side]['geometry'])
        transform=lambda g:affine_transform(g,[780,0,0,702,50,190])
        defs='<defs><pattern id="uncertain" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="16" stroke="#bd8d36" stroke-width="1" opacity=".35"/></pattern><pattern id="missing" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0L12 12 M12 0L0 12" stroke="#b35b55" opacity=".45" stroke-width="1"/></pattern></defs>'
        s=defs+t(40,55,cn+'腋下 · 医学审核参考图',38,weight='bold')+t(40,93,'V6.6.1 / review-draft / 2026-11-05     只供审阅，不可用于面积匹配',23,'#9b492e')
        s+=t(50,145,('前侧 / 胸壁 ←    左腋下    → 后侧 / 上臂' if side=='left' else '后侧 / 上臂 ←    右腋下    → 前侧 / 胸壁'),22)
        s+=t(50,178,'朝向与褶线名称待审核；肩、肘未入图，非完整展开面',18,'#586b66')
        s+=ET.tostring(current,encoding='unicode')+f'<path d="{svg_path(transform(body))}" fill="url(#uncertain)"/>'
        for row in d['observationWindows']:
            g=transform(shape(row['geometry']));fill='url(#missing)' if row['id']=='O1' else 'none'
            s+=f'<path d="{svg_path(g)}" fill="{fill}" stroke="#326d87" stroke-width="2.2" stroke-dasharray="9 7"/>'
            x,y=row['labelPoint'];s+=t(50+780*x-20,190+702*y,row['id'],26,'#174c66','bold')
        x,y=d['landmarks'][0]['displayQuestionMarker'];x=50+780*x;y=190+702*y
        s+=f'<path d="M{x} {y-12}L{x+12} {y}L{x} {y+12}L{x-12} {y}Z" fill="white" stroke="#2455a0" stroke-width="2"/>'+t(x+20,y+8,'K2?',23,'#2455a0')
        s+=lines(55,910,['棕线：源照片可见褶线；不是皮节边界。','虚线O1–O5：观察窗口，可重叠；不是五块神经分区。','H1红网纹：提示中央底面在Goran垂臂图未展开，范围仅示意。'],20,31)
        s+=frame(875,150,485,820,'审核图例与待确认事项')
        s+=lines(900,225,['蓝色虚线：观察区域草案','棕色实线：有照片来源的皮肤线','橙色斜线：目标皮节边界未知','红色网纹：原姿态未展开表面','K2?：待定位检查点提示，不是坐标'],21,37)
        for i,row in enumerate(d['observationWindows']):
            s+=t(900,440+i*57,row['id']+'  '+row['name'],23,weight='bold')
            s+=t(900,466+i*57,'确认位置 / 修改范围 / 否决，均需留理由',17,'#586b66')
        s+=lines(900,760,['K2：T2腋窝顶检查点有资料依据[M1]','请医生在原图上定位；坐标目前为null','K1：T1检查点在肘部，本窗外','K3：T3检查点须锁骨中线及第3肋间','本模板不能靠照片推定K1/K3位置'],20,35)
        s+=frame(40,1030,1320,570,'Goran 原始可见面 — 同一解剖侧，保持垂臂姿态，不拉伸到上图')
        s+=source_panel('front',side,65,1115,300,360)+source_panel('back',side,385,1115,300,360)
        s+=t(105,1100,'正面可见边缘',22)+t(435,1100,'背面可见边缘',22)
        s+=lines(740,1120,['G1正面：p1/p2/p3（T1/T2/T3）','及p19/p20（T1/T2臂躯干侧缘）','G2背面：p6/p7/p8（T1/T2/T3）','及p41（T1/T2组合内臂条带）','已复核源曲线，目标配准数仍为0。','','不得把检查点扩成面。','不得把ICBN外周神经分布当作T2皮节。','下图的颜色边界只在原图坐标成立。'],21,36)
        s+=lines(65,1510,['完整肩帽、肘标志、锁骨中线/肋间缺失；需要先决定模板是否足够用于目标审核。','审核空白：□模板可用  □需换姿态/扩展模板  □证据不足；审核人/日期：________________'],21,37)
        s+=lines(40,1645,['D1：Roquex / MaleArmpit1，CC0衍生；G1/G2：Goran_tek-en，CC BY-SA4.0，裁切保持原形。','M1：ISNCSCI Revised 2019检查点文字事实；不复制ASIA图。M2：Rajendran等2025；M5：UAMS解剖表。','完整来源和链接：医学依据清单.md。左右镜像、褶线命名及全部边界均待专业审核。','这不是医学审核通过图，也不是微信截图。运行图谱仍为0区域 / ATLAS_NOT_READY。'],18,30)
        emit(name,1400,1800,s)

def candidate():
    s=t(40,55,'模板改良候选 B · 取景与标志需求图',36,weight='bold')+t(40,95,'设计草案，尚无新皮肤几何；不覆盖 commons-axilla-v1 / 1.0.0',23,'#9b492e')
    s+=frame(40,135,1280,270,'缺失肩部的实际影响')+lines(65,200,['现有模板足以指认局部圈选，但缺少稳定的肩/肘/胸壁标志，限制跨姿态配准和神经边界复核。','补一个“圆肩膀”不能解决依据不足。优先要求同一姿态下可见肩峰/肩臂连接、肘内侧和胸壁定位线索。','扩展需有许可的新源或专业插画；抬臂角度、视向、遮挡、左右与个体差异由审核者确定。','当前只设计取景要求；下方灰区不是待计算皮肤，更不表示解剖尺度或具体位置。'],23,43)
    s+=f'<rect x="80" y="455" width="750" height="620" rx="12" fill="#e9efec" stroke="#9eaaa5" stroke-dasharray="12 8"/>'+t(110,495,'候选取景范围（示意，不是新人体轮廓）',23)
    e=ET.parse(ROOT/'miniprogram/assets/axilla/axilla-right.svg').getroot()
    for k,v in dict(x=210,y=600,width=400,height=360).items():e.set(k,str(v))
    s+=ET.tostring(e,encoding='unicode')+t(280,995,'旧窗口仅作上下文定位示例',21)
    s+=lines(865,520,['新增参考标志清单','□肩峰及肩臂连接','□近端上臂至内侧肘部','□前/后腋褶完整走向','□胸壁肋间或其他可验证标志','□统一抬臂姿态、左右原侧证据','□前后斜视是否需分别取景'],23,49)
    s+=lines(80,1140,['候选 A（左右审核图）：保留旧400×360皮肤和原坐标，仅添加独立审核标记。','候选 B：只记录新增模板的取景规范。新模板若采用，必须新ID/版本；旧标注留在旧模板，','不能用整体缩放、自动镜像或按相同归一化坐标无提示迁移。需专门配准与人工复核。','审核选择：□ A足够支持限定范围  □ 先制作B  □ 两者均否决。理由：_________________'],22,40)
    emit('04-模板改良候选与定位缺口.svg',1360,1340,s)

if __name__=='__main__':
    audit();boards(drafts());candidate()
    print('Medical-review only: 9 source paths, 2 boards, 10 observation windows, 0 dermatome drafts/target regions.')
