// Technical atlas packing: isolate the ten generated alpha components, preserving their pixels.
const sharp=require('sharp');
module.exports=async function pack(){
 const {data,info}=await sharp('public/assets/countryside.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});const {width:w,height:h}=info,labels=new Int32Array(w*h),queue=new Int32Array(w*h),components=[];let id=0;
 for(let i=0;i<w*h;i++){if(labels[i]||data[i*4+3]<=24)continue;const label=++id;let head=0,tail=1;queue[0]=i;labels[i]=label;let l=w,t=h,r=0,b=0;
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!labels[n]&&data[n*4+3]>24){labels[n]=label;queue[tail++]=n;}}
  if(tail>2000)components.push({id:label,l,t,r,b});
 }
 if(components.length!==10)throw Error(`Expected 10 isolated props, found ${components.length}`);
 const ordered=[...components.filter(c=>c.t<390).sort((a,b)=>a.l-b.l),...components.filter(c=>c.t>=390).sort((a,b)=>a.l-b.l)];const images=[];
 for(let i=0;i<ordered.length;i++){const c=ordered[i],cw=c.r-c.l+1,ch=c.b-c.t+1,raw=Buffer.alloc(cw*ch*4);for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const src=(c.t+y)*w+c.l+x;if(labels[src]===c.id)data.copy(raw,(y*cw+x)*4,src*4,src*4+4);}
  const input=await sharp(raw,{raw:{width:cw,height:ch,channels:4}}).resize(360,360,{fit:'inside'}).extend({top:12,bottom:12,left:12,right:12,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();const m=await sharp(input).metadata();images.push({input,left:i%5*384+Math.floor((384-m.width)/2),top:Math.floor(i/5)*384+Math.floor((384-m.height)/2)});
 }
 await sharp({create:{width:1920,height:768,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(images).webp({quality:85,alphaQuality:100,effort:6}).toFile('public/assets/countryside.webp');
};
if(require.main===module)module.exports();
