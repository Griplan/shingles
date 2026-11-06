// Independent RGBA PNG alpha decoder, Node core only. Used as source-pixel oracle.
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict');
function pngAlpha(file){
 const png=fs.readFileSync(file),w=png.readUInt32BE(16),h=png.readUInt32BE(20);
 assert.equal(png[24],8);assert.equal(png[25],6);assert.equal(png[28],0);
 const chunks=[];for(let i=8;i<png.length;){const n=png.readUInt32BE(i),t=png.toString('ascii',i+4,i+8);if(t==='IDAT')chunks.push(png.subarray(i+8,i+8+n));i+=n+12;}
 const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=w*4,alpha=Buffer.alloc(w*h);let prev=Buffer.alloc(stride),offset=0;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<h;y++){
  const filter=raw[offset++],row=Buffer.alloc(stride);
  for(let x=0;x<stride;x++){
   const a=x>=4?row[x-4]:0,b=prev[x],c=x>=4?prev[x-4]:0;
   const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];assert.notEqual(predictor,undefined);
   row[x]=(raw[offset++]+predictor)&255;
  }
  for(let x=0;x<w;x++)alpha[y*w+x]=row[x*4+3];prev=row;
 }
 return {w,h,at(x,y){return x>=0&&x<w&&y>=0&&y<h?alpha[y*w+x]:0;}};
}

module.exports={pngAlpha};
