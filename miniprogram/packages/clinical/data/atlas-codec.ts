import {AtlasGeometry,AtlasRegion} from "../../../types/atlas";

export interface PackedAtlasGeometry {
  readonly type:"MultiPolygon";
  readonly polygonRingCounts:readonly number[];
  readonly ringPointCounts:readonly number[];
  readonly doublesBase64:string;
}

export type CompactAtlasRegion=Omit<AtlasRegion,"geometry"|"polygonGeometry"|"labelPoint">&{
  readonly geometry:PackedAtlasGeometry;
  readonly polygonGeometry?:PackedAtlasGeometry;
  readonly labelPoint:readonly [number,number];
};

const BASE64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64(value:string):Uint8Array {
  const bytes=new Uint8Array(Math.floor(value.length*3/4));
  let buffer=0,bits=0,offset=0;
  for(const char of value) {
    if(char==="=") break;
    const digit=BASE64.indexOf(char);
    if(digit<0) throw new RangeError("图谱坐标编码无效");
    buffer=(buffer<<6)|digit;bits+=6;
    if(bits>=8) {bits-=8;bytes[offset++]=(buffer>>bits)&255;}
  }
  return bytes.subarray(0,offset);
}

function unpackGeometry(packed:PackedAtlasGeometry):AtlasGeometry {
  const bytes=decodeBase64(packed.doublesBase64);
  if(bytes.byteLength%8!==0) throw new RangeError("图谱坐标字节长度无效");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  type Point=readonly [number,number];
  const coordinates:Point[][][]=[];
  let ringIndex=0,doubleOffset=0;
  for(const ringCount of packed.polygonRingCounts) {
    const polygon:Point[][]=[];
    for(let index=0;index<ringCount;index++) {
      const pointCount=packed.ringPointCounts[ringIndex++];
      const ring:Point[]=[];
      for(let point=0;point<pointCount;point++) {
        ring.push([view.getFloat64(doubleOffset,false),view.getFloat64(doubleOffset+8,false)]);
        doubleOffset+=16;
      }
      polygon.push(ring);
    }
    coordinates.push(polygon);
  }
  if(ringIndex!==packed.ringPointCounts.length||doubleOffset!==bytes.byteLength) {
    throw new RangeError("图谱坐标结构不一致");
  }
  return {type:"MultiPolygon",coordinates};
}

/** 展开只改变传输表示，不量化或简化任何坐标。 */
export function unpackAtlasRegions(compact:readonly CompactAtlasRegion[]):readonly AtlasRegion[] {
  return compact.map(({geometry,polygonGeometry,labelPoint,...metadata})=>({
    ...metadata,
    geometry:unpackGeometry(geometry),
    ...(polygonGeometry?{polygonGeometry:unpackGeometry(polygonGeometry)}:{}),
    labelPoint:{x:labelPoint[0],y:labelPoint[1]},
  }));
}
