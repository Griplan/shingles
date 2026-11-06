"""Offline evidence only. No screenshots, fabricated atlas or match results."""
import base64,json,xml.etree.ElementTree as ET
from pathlib import Path
from build_axilla import OUTLINE,DETAILS
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/validation-records/v6.6-axilla/evidence'

def svg(name,width,height,content):
    (OUT/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}"><rect width="100%" height="100%" fill="#faf8f4"/><g font-family="sans-serif" fill="#23483d">{content}</g></svg>')
def model(side,x=0,y=0):
    node=ET.fromstring((ROOT/f'miniprogram/assets/axilla/axilla-{side}.svg').read_text());node.set('x',str(x));node.set('y',str(y));return ET.tostring(node,encoding='unicode')

if __name__=='__main__':
    svg('models',840,460,'<text x="24" y="28" font-size="20">V6.6 左右腋下局部示意 · 静态资源预览</text>'+model('left',10,65)+model('right',430,65)+
        '<text x="160" y="62">左腋下 · 胸前在左</text><text x="580" y="62">右腋下 · 胸前在右</text><text x="24" y="432" font-size="13">Roquex / MaleArmpit1 · CC0 衍生线稿；虚线为观察窗裁切边，不是人体自然边缘。</text><text x="24" y="452" font-size="13">局部可见褶线，完整肩部不在源照片内。0 个已配准皮节区域；非微信截图。</text>')
    refs=[('central','腋窝中央',500,320),('anterior-fold','前褶参考',610,250),('posterior-fold','后褶参考',420,330),('proximal-arm','上臂近端',340,130),('lateral-chest','胸壁外侧',650,490)]
    points=[dict(id=i,name=n,sourceWorkingPoint=[x,y],rightNormalized=[(x*.42+10)/400,(y*.42+30)/360],leftNormalized=[1-(x*.42+10)/400,(y*.42+30)/360],evidence='manually located on original source photo; fold naming requires anatomical review; not neural boundaries') for i,n,x,y in refs]
    (OUT/'reference-points.json').write_text(json.dumps(points,ensure_ascii=False,indent=2)+'\n')
    content='<text x="24" y="28" font-size="20">右腋下：可标注皮肤与未配置的参考图谱</text>'+model('right',0,40)
    for i,(_,n,x,y) in enumerate(refs):
        px=x*.42+10;py=y*.42+70
        content+=f'<circle cx="{px}" cy="{py}" r="3" fill="#2d7960"/><text x="{px+7}" y="{py-7}" font-size="11">{i+1}</text><text x="420" y="{90+28*i}" font-size="14">{i+1}. {n}：未配置皮节</text>'
    # Synthetic examples follow real display coordinates; do not resemble a match fill.
    content+='<path d="M212 202 L234 205 L224 220 Z M267 260 L283 267 L275 281 Z" fill="#b85a3420" stroke="#9b4b2b" stroke-width="2"/>'
    content+='<text x="420" y="270" font-size="14">棕色：合成病灶圈选示例</text><text x="420" y="300" font-size="14">计算：ATLAS_NOT_READY</text><text x="420" y="326" font-size="14">无配准成功或神经高亮结果</text><text x="24" y="418" font-size="12">底图 Roquex / CC0 衍生；观察窗外和隐蔽深部不外推。静态证据，非微信截图。</text>'
    svg('annotation-unconfigured',790,440,content)
    data=base64.b64encode((ROOT/'docs/research/v6.6-axilla/male-preview.png').read_bytes()).decode()
    paths=f'<path d="{OUTLINE}" fill="none" stroke="#216c55" stroke-width="3"/>'+''.join(f'<path d="{d}" fill="none" stroke="#ac4b31" stroke-width="3"/>' for _,d in DETAILS)
    svg('trace-comparison',960,460,'<text x="20" y="26" font-size="18">授权原照片与同一画框的描摹对照 · 仅皮肤表面</text>'+f'<image x="20" y="48" width="450" height="337.5" href="data:image/png;base64,{data}"/><g transform="translate(490 48) scale(.5)"><image width="900" height="675" href="data:image/png;base64,{data}"/>{paths}</g><text x="20" y="412" font-size="13">MaleArmpit1 / Roquex / CC0。右侧：绿线为观察窗内皮肤轮廓，棕线为可见褶线。</text><text x="20" y="438" font-size="13">没有神经区域；胸壁与上臂作裁切，肩部超出源照片。离线预览，非微信截图。</text>')
