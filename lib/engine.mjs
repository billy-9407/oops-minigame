// Browser and server use this exact fixed-step simulation. No network score is trusted.
export const RULES = Object.freeze({version:3, hz:30, ticks:3600, size:2200, maxSpeed:310, lootScore:750, extractionScore:1500, extractionTick:3000, maxEvents:1000});
export function rng(seed) {let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const roads=[360,1100,1840];
export function isRoad(x,y){return roads.some(r=>Math.abs(x-r)<82||Math.abs(y-r)<82);}
export function generateWorld(seed){
 const random=rng(seed), buildings=[], trees=[], crates=[], enemies=[];
 for(let gx=0;gx<6;gx++)for(let gy=0;gy<6;gy++){
  const x=140+gx*365+(random()-.5)*70,y=140+gy*365+(random()-.5)*70;
  if(!isRoad(x,y)&&Math.hypot(x-1100,y-1280)>200&&Math.hypot(x-360,y-360)>220)
   buildings.push({x,y,w:90+random()*65,h:100+random()*80,height:35+random()*45,kind:Math.floor(random()*3)});
 }
 const points=[[550,1100],[1100,740],[1550,1100],[1840,600],[360,1550],[750,1840],[1650,1840],[1840,1450],[1100,350],[360,750],[750,360],[1100,1650],[1840,1840],[360,360]];
 points.forEach(([x,y],i)=>{crates.push({x:x+(random()-.5)*55,y:y+(random()-.5)*55,looted:false,progress:0,id:i});if(i!==13)enemies.push({x:x+110+(random()-.5)*50,y:y+120+(random()-.5)*50,cooldown:35+Math.floor(random()*60),angle:0});});
 for(let i=0;i<95;i++){const x=70+random()*2060,y=70+random()*2060;if(!isRoad(x,y)&&!buildings.some(b=>Math.abs(x-b.x)<b.w/2+45&&Math.abs(y-b.y)<b.h/2+45))trees.push({x,y,r:18+random()*14});}
 return {buildings,trees,crates,enemies,exit:{x:360,y:360}};
}
export function createGame(seed){return {seed,tick:0,x:1100,y:1280,angle:-Math.PI/2,speed:0,hp:100,meters:0,loot:0,lootPoints:0,extracted:false,extractProgress:0,done:false,reason:null,target:null,bullets:[],effects:[],damageFlash:0,world:generateWorld(seed)};}
export function score(g){return Math.floor(g.meters)+g.lootPoints+(g.extracted?RULES.extractionScore:0);}
export function command(g,event){if(event.stop){g.target=null;return;}g.target={x:clamp(event.x,20,RULES.size-20),y:clamp(event.y,20,RULES.size-20)};}
function blocked(g,x,y){return g.world.buildings.some(b=>Math.abs(x-b.x)<b.w/2+19&&Math.abs(y-b.y)<b.h/2+19);}
export function step(g){
 if(g.done)return;
 const dt=1/RULES.hz;g.tick++;g.damageFlash=Math.max(0,g.damageFlash-dt);g.effects=g.effects.filter(e=>(e.life-=dt)>0);
 let desired=0;
 if(g.target){const dx=g.target.x-g.x,dy=g.target.y-g.y,d=Math.hypot(dx,dy);if(d>14){const target=Math.atan2(dy,dx);let delta=Math.atan2(Math.sin(target-g.angle),Math.cos(target-g.angle));g.angle+=clamp(delta,-2.5*dt,2.5*dt);desired=Math.min(RULES.maxSpeed,d*2.4)*Math.max(.18,1-Math.abs(delta)/Math.PI);}else g.target=null;}
 g.speed+=(desired-g.speed)*Math.min(1,3.8*dt);
 let nx=clamp(g.x+Math.cos(g.angle)*g.speed*dt,25,RULES.size-25),ny=clamp(g.y+Math.sin(g.angle)*g.speed*dt,25,RULES.size-25);
 if(blocked(g,nx,ny)){if(g.speed>95&&g.damageFlash===0){g.hp-=3;g.damageFlash=.45;g.effects.push({x:g.x,y:g.y,kind:'hit',life:.35});}g.speed*=.45;g.target=null;}else{g.meters+=Math.hypot(nx-g.x,ny-g.y)/8;g.x=nx;g.y=ny;}
 for(const c of g.world.crates){if(c.looted)continue;if(distance(g,c)<90&&g.speed<55){c.progress+=dt;if(c.progress>=1.4){c.looted=true;g.loot++;g.lootPoints+=RULES.lootScore;g.hp=Math.min(100,g.hp+10);g.effects.push({x:c.x,y:c.y,kind:'loot',life:1.4});}}else c.progress=0;}
 for(const e of g.world.enemies){if(distance(e,g)>760)continue;e.cooldown--;e.angle=Math.atan2(g.y-e.y,g.x-e.x);if(e.cooldown<=0){e.cooldown=53+(g.tick%41);const spread=Math.sin(g.tick*1.17+e.x)*.20,a=e.angle+spread;g.bullets.push({x:e.x,y:e.y,vx:Math.cos(a)*430,vy:Math.sin(a)*430,life:1.9});g.effects.push({x:e.x,y:e.y,kind:'muzzle',life:.12});}}
 g.bullets=g.bullets.filter(b=>{b.life-=dt;let px=b.x,py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;const dx=b.x-px,dy=b.y-py,t=clamp(((g.x-px)*dx+(g.y-py)*dy)/(dx*dx+dy*dy),0,1);if(Math.hypot(px+dx*t-g.x,py+dy*t-g.y)<23){g.hp-=5;g.damageFlash=.2;b.life=0;}if(blocked(g,b.x,b.y))b.life=0;return b.life>0;});
 if(g.tick>2250){const inset=(g.tick-2250)/1350*290;if(g.x<inset||g.y<inset||g.x>RULES.size-inset||g.y>RULES.size-inset)g.hp-=2.5*dt;}
 if(g.tick>=RULES.extractionTick&&distance(g,g.world.exit)<95&&g.speed<55){g.extractProgress+=dt;if(g.extractProgress>=2){g.extracted=true;g.done=true;g.reason='extracted';}}else g.extractProgress=0;
 if(g.hp<=0){g.hp=0;g.done=true;g.reason='destroyed';}else if(g.tick>=RULES.ticks){g.done=true;g.reason='timeout';}
}
export function summary(g){return {score:score(g),meters:Math.floor(g.meters),loot:g.loot,lootPoints:g.lootPoints,extracted:g.extracted,ticks:g.tick,reason:g.reason,coins:Math.min(10,Math.floor(score(g)/1000))};}
export function replay(seed,events,endTick){
 if(!Array.isArray(events)||events.length>RULES.maxEvents||!Number.isInteger(endTick)||endTick<1||endTick>RULES.ticks)throw Error('잘못된 플레이 기록입니다.');
 let previous=-1;for(const e of events){if(!e||!Number.isInteger(e.t)||e.t<0||e.t>=endTick||e.t<previous||typeof e.stop!=='boolean'||(!e.stop&&(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<20||e.y<20||e.x>2180||e.y>2180)))throw Error('잘못된 조작 기록입니다.');previous=e.t;}
 const g=createGame(seed);let i=0;while(g.tick<endTick&&!g.done){while(i<events.length&&events[i].t===g.tick)command(g,events[i++]);step(g);}if(!g.done||g.tick!==endTick||i!==events.length)throw Error('완료되지 않은 플레이입니다.');return summary(g);
}
