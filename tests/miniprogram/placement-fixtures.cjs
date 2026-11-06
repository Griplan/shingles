// Deterministic synthetic geometry. No clinical image or nerve-region data.
function syntheticPhoto(vertices=100,multi=false){
 const ring=(cx,cy,rx,ry,n)=>{
  const points=Array.from({length:n-1},(_,i)=>{const a=2*Math.PI*i/(n-1);return [cx+rx*Math.cos(a),cy+ry*Math.sin(a)];});
  return [...points,points[0].slice()];
 };
 const coordinates=multi?[[.2,.25],[.5,.25],[.8,.25],[.35,.7],[.65,.7]].map(([x,y])=>[
  ring(x,y,.11,.18,vertices/10),ring(x,y,.03,.05,vertices/10).reverse()
 ]):[[ring(.5,.5,.35,.35,vertices)]];
 return {schema_version:'confirmed-photo-segmentation-v1',session_id:'SYNTHETIC',photo_id:'SYNTHETIC',result_id:'SYNTHETIC',candidate_id:'candidate-0',prompt_revision:1,
 coordinate_space:'photo_oriented_normalized_v1',confirmed_by_user:true,confirmed_at:Date.now()/1000-1,expires_at:Date.now()/1000+1200,
 image:{width:700,height:460,oriented_rgb_sha256:'a'.repeat(64)},model:{name:'synthetic-performance-fixture'},
 prompts:{coordinate_space:'photo_oriented_normalized_v1',points:[],box:null},mask_asset:'candidate-0.png',mask_sha256:'b'.repeat(64),geometry:{type:'MultiPolygon',coordinates}};
}
module.exports={syntheticPhoto};
