import {RULES,isRoad,blueExposure} from './lib/engine.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class ChaseCamera{
 constructor(){this.reset();}
 reset(g){this.x=g?.x??1650;this.y=g?.y??1920;this.zoom=1;this.shake=0;this.kick=0;}
 impact(amount){this.shake=Math.min(16,Math.max(this.shake,amount));}
 update(g,dt,playing){
  dt=Math.min(dt,.06);const mix=1-Math.exp(-dt*6),targetZoom=playing?1-.12*clamp(Math.abs(g.speed)/RULES.maxSpeed,0,1):1;
  // Follow with inertia, and bias the target toward the actual direction of travel.
  this.x+=(g.x+(playing?g.vx*.45:0)-this.x)*mix;this.y+=(g.y+(playing?g.vy*.45:0)-this.y)*mix;
  this.zoom+=(targetZoom-this.zoom)*(1-Math.exp(-dt*3));this.shake*=Math.exp(-dt*15);this.kick+=dt*85;
  return {x:this.x,y:this.y,zoom:this.zoom,sx:Math.sin(this.kick*1.73)*this.shake,sy:Math.cos(this.kick*2.31)*this.shake*.65};
 }
}
export function drawProp(p,k){
 const kinds=['pole','wall','paddy','wreck','shed','rail','sign','bush','barrel','container'],index=kinds.indexOf(p.kind);
 const widths={pole:37,wall:112,paddy:215,wreck:95,shed:142,rail:123,sign:36,bush:62,barrel:25,container:142};
 const offsets={pole:3,wall:14,paddy:53,wreck:19,shed:29,rail:15,sign:3,bush:10,barrel:7,container:28};
 k.sprite('countryside',index,p.x,p.y,widths[p.kind]*k.scale,offsets[p.kind]*k.scale);
}
export class Effects{
 constructor(){this.reset();this.history=document.createElement('canvas');this.puffs={};for(const [kind,color] of Object.entries({dust:'182,173,131',smoke:'154,156,140',black:'30,34,29',fire:'255,149,38'})){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gradient=x.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,`rgba(${color},.9)`);gradient.addColorStop(.45,`rgba(${color},.4)`);gradient.addColorStop(1,`rgba(${color},0)`);x.fillStyle=gradient;x.fillRect(0,0,64,64);this.puffs[kind]=c;}}
 reset(){this.particles=[];this.tracks=[];this.hits=[];this.lastId=0;this.wheels=null;this.lastTick=-1;this.historyReady=false;}
 emit(x,y,kind,n=1){for(let i=0;i<n&&this.particles.length<360;i++){const a=Math.random()*Math.PI*2,v=kind==='spark'?90:kind==='debris'?70:22;this.particles.push({x,y,z:kind==='smoke'||kind==='black'?26:5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:kind==='spark'?40:kind==='debris'?55:kind==='grass'?30:18,kind,life:kind==='smoke'||kind==='black'?2.4:kind==='fire'?.45:kind==='debris'?1.1:.7,max:kind==='smoke'||kind==='black'?2.4:kind==='fire'?.45:kind==='debris'?1.1:.7,size:kind==='smoke'||kind==='black'?8:kind==='fire'?5:kind==='dust'?6:2});}}
 tick(g,audio,chase){
  const dt=1/RULES.hz;if(this.lastTick===g.tick)return;this.lastTick=g.tick;
  this.particles=this.particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z=Math.max(0,p.z+p.vz*dt);if(['debris','grass','spark'].includes(p.kind))p.vz-=95*dt;return p.life>0;});
  this.tracks=this.tracks.filter(t=>(t.life-=dt)>0);this.hits=this.hits.filter(h=>(h.life-=dt)>0);
  const speed=Math.hypot(g.vx,g.vy),rear={x:g.x-Math.cos(g.angle)*28,y:g.y-Math.sin(g.angle)*28};
  const wheels=[-1,1].map(side=>({x:rear.x-Math.sin(g.angle)*side*15,y:rear.y+Math.cos(g.angle)*side*15}));
  if(speed>45&&g.tick%3===0)for(const w of wheels)this.emit(w.x,w.y,isRoad(g.x,g.y)?'dust':g.tick%6?'dust':'grass');
  if(speed>100&&g.slip>15&&this.wheels){for(let i=0;i<2;i++)this.tracks.push({a:this.wheels[i],b:wheels[i],life:6});if(this.tracks.length>240)this.tracks.splice(0,this.tracks.length-240);}
  this.wheels=wheels;
  if(g.hp<=50&&g.tick%4===0)this.emit(g.x+Math.cos(g.angle)*22,g.y+Math.sin(g.angle)*22,g.hp<=20?'black':'smoke');
  if(g.hp<=20&&g.tick%3===0)this.emit(g.x+Math.cos(g.angle)*25,g.y+Math.sin(g.angle)*25,'fire',2);
  for(const e of g.effects){if(!e.id||e.id<=this.lastId)continue;this.lastId=e.id;const dist=Math.hypot(e.x-g.x,e.y-g.y),v=clamp(1-dist/1000,0,1),pan=clamp((e.x-e.y-g.x+g.y)/500,-1,1);
   if(e.kind==='hit'){this.emit(e.x,e.y,'spark',9);chase.impact(2.7);this.hits.push({angle:e.angle,life:.65});audio.event('hit',.7);}
   if(e.kind==='collision'){this.emit(e.x,e.y,'debris',12);this.emit(e.x,e.y,'dust',7);chase.impact(5+e.intensity/45);audio.event('collision',.8);}
   if(e.kind==='explosion'){if(dist<1100){this.emit(e.x,e.y,'black',18);this.emit(e.x,e.y,'fire',12);this.emit(e.x,e.y,'debris',9);chase.impact(13*v);}audio.event('explosion',v,pan);}
   if(e.kind==='ground'&&dist<800)this.emit(e.x,e.y,'dust',4);
   if(e.kind==='whizz')audio.event('whizz',.55,pan);
   if(e.kind==='loot')audio.event('loot',.7);
  }
  if(g.tick===RULES.extractionTick)audio.event('smoke',.6);
  if(g.tick>=RULES.redTick)for(const z of g.world.redZones)for(const s of z.strikes)if(g.tick===s.at-21)audio.event('shell',clamp(1-Math.hypot(s.x-g.x,s.y-g.y)/1200,0,1));
 }
 ground(k){for(const t of this.tracks){k.ctx.globalAlpha=t.life/6*.38;k.lineWorld(t.a.x,t.a.y,t.b.x,t.b.y,'#172018',3);}k.ctx.globalAlpha=1;}
 draw(k){const colors={dust:'#b6ad83',grass:'#85975d',smoke:'#9a9c8c',black:'#303530',fire:'#ff9c34',spark:'#ffe5a1',debris:'#7d7961'};for(const p of this.particles){const q=k.projected(p.x,p.y,p.z);if(q.x< -50||q.y< -100||q.x>k.width+50||q.y>k.height+50)continue;const age=1-p.life/p.max;k.ctx.globalAlpha=(p.kind==='smoke'||p.kind==='black'?.36:.65)*(1-age);k.ctx.fillStyle=colors[p.kind];const r=(p.size+(['smoke','black','dust'].includes(p.kind)?age*17:0))*k.scale;if(['spark','grass','debris'].includes(p.kind))k.ctx.fillRect(q.x,q.y,r*1.6,r);else if(this.puffs[p.kind])k.ctx.drawImage(this.puffs[p.kind],q.x-r,q.y-r,r*2,r*2);}k.ctx.globalAlpha=1;}
 screen(g,k,playing){
  const {ctx,width:w,height:h}=k;if(!playing)return;const blue=blueExposure(g),speed=clamp((Math.abs(g.speed)-200)/110,0,1);
  // Reproject a low-resolution previous frame only into thin edge strips.
  if(speed>0&&this.historyReady){ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.rect(28,25,w-56,h-50);ctx.clip('evenodd');ctx.globalAlpha=speed*.09;for(const z of [1.015,1.035])ctx.drawImage(this.history,(1-z)*w/2,(1-z)*h/2,w*z,h*z);ctx.restore();}
  if(speed>0){if(this.history.width!==Math.ceil(w/2)||this.history.height!==Math.ceil(h/2)){this.history.width=Math.ceil(w/2);this.history.height=Math.ceil(h/2);}this.history.getContext('2d').drawImage(ctx.canvas,0,0,this.history.width,this.history.height);this.historyReady=true;}else this.historyReady=false;
  if(blue>0){ctx.save();ctx.globalAlpha=blue;const glow=ctx.createRadialGradient(w/2,h/2,h*.32,w/2,h/2,Math.max(w,h)*.62);glow.addColorStop(0,'#387dff00');glow.addColorStop(1,'#278eff65');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.strokeStyle='#87d5ff';ctx.lineWidth=1;for(let j=0;j<4;j++){ctx.beginPath();for(let i=0;i<18;i++){const t=i/17,offset=8+Math.sin(g.tick*.8+i*2.7+j)*6;const x=j<2?t*w:j===2?offset:w-offset,y=j<2?j===0?offset:h-offset:t*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}ctx.globalAlpha=blue*.055;ctx.fillStyle='#d0e9fa';for(let i=0;i<45;i++){const x=(i*173+g.tick*47)%w,y=(i*97+g.tick*23)%h;ctx.fillRect(x,y,3+i%13,1);}ctx.restore();}
  for(const hit of this.hits){const angle=Math.atan2((Math.cos(hit.angle)+Math.sin(hit.angle))*.4,(Math.cos(hit.angle)-Math.sin(hit.angle))*.78),center=k.projected(g.x,g.y,25),r=Math.min(w,h)*.22;ctx.save();ctx.translate(center.x,center.y);ctx.rotate(angle);ctx.globalAlpha=clamp(hit.life*2,0,1);ctx.strokeStyle='#ff6046';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r,-.20,.20);ctx.stroke();ctx.fillStyle='#ff8062';ctx.beginPath();ctx.moveTo(r-8,0);ctx.lineTo(r+3,-5);ctx.lineTo(r+3,5);ctx.fill();ctx.restore();}
 }
}
