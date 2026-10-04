// Byte-weighted network progress; completion waits for image decode and atlas preparation.
export async function loadAssets(ctx,onProgress){
 const res=await fetch('assets/manifest.json',{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('작전 지역 목록을 불러오지 못했습니다.');
 const manifest=await res.json(),received=new Map(),total=manifest.reduce((s,a)=>s+a.bytes,0),art={};let terrainPatterns;
 const progress=()=>onProgress(Math.min(99,Math.floor([...received.values()].reduce((a,b)=>a+b,0)/total*100)));
 await Promise.all(manifest.map(async asset=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);let blob;
  try{
   const response=await fetch(asset.url,{signal:controller.signal});if(!response.ok)throw Error(asset.name);
   if(response.body){const reader=response.body.getReader(),chunks=[];let bytes=0;while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);bytes+=value.byteLength;received.set(asset.name,Math.min(bytes,asset.bytes));progress();}blob=new Blob(chunks,{type:'image/webp'});}
   else{blob=await response.blob();received.set(asset.name,asset.bytes);progress();}
  }finally{clearTimeout(timeout);}
  const url=URL.createObjectURL(blob),img=new Image();try{img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}
  if(asset.name==='terrain'){
   terrainPatterns=Array.from({length:4},(_,i)=>{const tile=document.createElement('canvas');tile.width=tile.height=128;tile.getContext('2d').drawImage(img,i%2*img.width/2,Math.floor(i/2)*img.height/2,img.width/2,img.height/2,0,0,128,128);return ctx.createPattern(tile,'repeat');});
  }else{
   const off=document.createElement('canvas');off.width=img.width;off.height=img.height;const oc=off.getContext('2d',{willReadFrequently:true});oc.drawImage(img,0,0);
   if(asset.frames){art.uaz={img,frames:asset.frames.map(([x,y,w,h])=>({x,y,w,h,cellW:320,cellH:320}))};return;}
   const data=oc.getImageData(0,0,img.width,img.height).data,frames=[];
   for(let i=0;i<asset.cols*asset.rows;i++){
    const ox=Math.floor(i%asset.cols*img.width/asset.cols),oy=Math.floor(Math.floor(i/asset.cols)*img.height/asset.rows),cw=Math.floor(img.width/asset.cols),ch=Math.floor(img.height/asset.rows);
    let l=cw,t=ch,r=-1,b=-1;
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(data[((oy+y)*img.width+ox+x)*4+3]>24){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
    if(r<l)throw Error('빈 스프라이트: '+asset.name);
    frames.push({x:ox+l,y:oy+t,w:r-l+1,h:b-t+1,cellW:cw,cellH:ch});
   }
   art[asset.name==='uaz16'?'uaz':asset.name]={img,frames};
  }
 }));
 onProgress(100);return {art,terrainPatterns};
}
