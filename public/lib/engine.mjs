// Authoritative fixed-step simulation shared by browser and reward server.
export const RULES = Object.freeze({version:6,hz:30,ticks:3600,size:3300,roadHalfWidth:123,maxSpeed:310,reverseSpeed:135,reverseTicks:30,lootScore:750,extractionScore:1500,extractionTick:3000,maxEvents:1000,blueTick:900,blueDuration:900,blueRadius:330,coverTick:1800,coverDrop:30,coverDuration:300,redTick:2700,redDuration:180,redRadius:480,redCount:3});
export const ROADS=Object.freeze([540,1650,2760]);
export function rng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function isRoad(x,y){return ROADS.some(r=>Math.abs(x-r)<RULES.roadHalfWidth||Math.abs(y-r)<RULES.roadHalfWidth);}
function roadPoint(random){const road=ROADS[Math.floor(random()*ROADS.length)],along=380+random()*(RULES.size-760);return random()<.5?{x:road,y:along}:{x:along,y:road};}
export function coverVertices(c){const a=c.angle||0;return [[-57,-57],[57,-57],[57,57],[-57,57]].map(([x,y])=>({x:c.x+x*Math.cos(a)-y*Math.sin(a),y:c.y+x*Math.sin(a)+y*Math.cos(a)}));}
export function coverContains(c,x,y,r=19){const v=coverVertices(c);let inside=true;for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length],dx=b.x-a.x,dy=b.y-a.y;if(dx*(y-a.y)-dy*(x-a.x)<0)inside=false;const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1);if(Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<r)return true;}return inside;}
export function generateWorld(seed){
 const random=rng(seed),buildings=[],trees=[],crates=[],enemies=[];
 const spawn={x:1650,y:1920};
 for(let gx=0;gx<6;gx++)for(let gy=0;gy<6;gy++){
  const x=210+gx*547.5+(random()-.5)*105,y=210+gy*547.5+(random()-.5)*105,w=105+random()*75,h=115+random()*90;
  if(!ROADS.some(r=>Math.abs(x-r)<123+w/2+12||Math.abs(y-r)<123+h/2+12)&&distance({x,y},spawn)>250)buildings.push({x,y,w,h,height:55+random()*55,kind:Math.floor(random()*3)});
 }
 const points=[[550,1100],[1100,740],[1550,1100],[1840,600],[360,1550],[750,1840],[1650,1840],[1840,1450],[1100,350],[360,750],[750,360],[1100,1650],[1840,1840],[360,360]];
 points.forEach(([px,py],i)=>{const x=px*1.5+(random()-.5)*60,y=py*1.5+(random()-.5)*60;crates.push({x,y,looted:false,progress:0,id:i});if(i!==13){let e={x:x+100+(random()-.5)*50,y:y+105+(random()-.5)*50,cooldown:35+Math.floor(random()*60),angle:0};if(buildings.some(b=>Math.abs(e.x-b.x)<b.w/2+20&&Math.abs(e.y-b.y)<b.h/2+20)){e.x=x;e.y=y+60;}enemies.push(e);}});
 for(let i=0;i<160;i++){const x=80+random()*3140,y=80+random()*3140;if(!isRoad(x,y)&&!buildings.some(b=>Math.abs(x-b.x)<b.w/2+45&&Math.abs(y-b.y)<b.h/2+45))trees.push({x,y,r:18+random()*14});}
 // Every candidate is on the connected road network and outside the final edge zone.
 const exits=ROADS.flatMap(x=>ROADS.map(y=>({x,y}))).filter(p=>distance(p,spawn)>600);
 const exit=exits[Math.floor(random()*exits.length)];
 const blueZones=[],covers=[];
 for(let i=0;i<3;i++){let p;do{p=roadPoint(random);}while(blueZones.some(z=>distance(z,p)<380));blueZones.push({...p,r:RULES.blueRadius});}
 for(let i=0;i<3;i++){let p;do{p=roadPoint(random);}while(covers.some(c=>distance(c,p)<240)||distance(p,exit)<200||crates.some(c=>distance(c,p)<140));covers.push({...p,angle:0});}
 const redZones=[];
 for(let i=0;i<RULES.redCount;i++){
  let p;do{p=roadPoint(random);}while(redZones.some(z=>distance(z,p)<RULES.redRadius*2));
  const z={...p,r:RULES.redRadius,strikes:[]};
  for(let j=0;j<7;j++){const a=random()*Math.PI*2,r=Math.sqrt(random())*370;z.strikes.push({x:z.x+Math.cos(a)*r,y:z.y+Math.sin(a)*r,at:RULES.redTick+45+j*18,r:60});}
  redZones.push(z);
 }
 // Separate seeded stream keeps gameplay landmarks stable. Roads, loot and spawn stay clear.
 const decor=rng(seed^0x55415a),props=[];
 const types=[['pole',14,14,88],['wall',112,18,22],['paddy',155,130,0],['wreck',65,34,25],['shed',90,74,55],['rail',125,12,20],['sign',14,14,47],['bush',44,38,0],['barrel',20,20,22],['container',108,45,39]];
 for(const [kind,w,h,height] of types)for(let n=0;n<(kind==='bush'?24:kind==='paddy'?10:8);n++){
  for(let attempt=0;attempt<100;attempt++){
   const x=110+decor()*(RULES.size-220),y=110+decor()*(RULES.size-220),r=Math.hypot(w,h)/2+30;
   if(ROADS.some(v=>Math.abs(x-v)<RULES.roadHalfWidth+w/2+12||Math.abs(y-v)<RULES.roadHalfWidth+h/2+12)||distance({x,y},spawn)<230||distance({x,y},exit)<180||crates.some(c=>distance(c,{x,y})<r+115)||enemies.some(e=>distance(e,{x,y})<r+40)||buildings.some(b=>Math.abs(x-b.x)<(w+b.w)/2+40&&Math.abs(y-b.y)<(h+b.h)/2+40)||props.some(p=>Math.abs(x-p.x)<(w+p.w)/2+24&&Math.abs(y-p.y)<(h+p.h)/2+24))continue;
   props.push({x,y,w,h,height,kind,solid:!['paddy','bush'].includes(kind),variant:decor()});break;
  }
 }
 return{buildings,trees:trees.filter(t=>!props.some(p=>Math.abs(t.x-p.x)<p.w/2+30&&Math.abs(t.y-p.y)<p.h/2+30)),crates,enemies,exit,blueZones,covers,redZones,props};
}
export function createGame(seed){return{seed,tick:0,x:1650,y:1920,angle:-Math.PI/2,speed:0,vx:0,vy:0,steer:0,lean:0,slip:0,effectId:0,hp:100,meters:0,loot:0,lootPoints:0,extracted:false,extractProgress:0,done:false,reason:null,target:null,reverseUntil:0,collisionUntil:0,bullets:[],effects:[],damageFlash:0,world:generateWorld(seed)};}
export function score(g){return Math.floor(g.meters)+g.lootPoints+(g.extracted?RULES.extractionScore:0);}
export const coinsForScore=points=>Math.min(10,Math.max(0,Math.floor(points/1000)));
export function command(g,event){
 if(event.reverse){g.target=null;g.reverseUntil=g.tick+RULES.reverseTicks+Math.ceil(Math.max(0,g.speed)/350*RULES.hz);return;}
 g.reverseUntil=0;
 if(event.stop){g.target=null;return;}
 g.target={x:clamp(event.x,20,RULES.size-20),y:clamp(event.y,20,RULES.size-20)};
}
export function coversActive(g){return g.tick>=RULES.coverTick+RULES.coverDrop&&g.tick<RULES.coverTick+RULES.coverDrop+RULES.coverDuration;}
export function blocked(g,x,y,r=19){return x<25||y<25||x>RULES.size-25||y>RULES.size-25||g.world.buildings.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(y-b.y)<b.h/2+r)||g.world.props.some(p=>p.solid&&Math.abs(x-p.x)<p.w/2+r&&Math.abs(y-p.y)<p.h/2+r)||(coversActive(g)&&g.world.covers.some(c=>coverContains(c,x,y,r)));}
function effect(g,kind,x,y,life,extra={}){g.effects.push({id:++g.effectId,tick:g.tick,x,y,kind,life,...extra});}
function damage(g,amount,kind='hit',source=null){g.hp-=amount;effect(g,kind,g.x,g.y,.55,{angle:source?Math.atan2(source.y-g.y,source.x-g.x):g.angle,intensity:amount});}
export function blueExposure(g){
 const local=g.tick>=RULES.blueTick&&g.tick<RULES.blueTick+RULES.blueDuration?Math.max(0,...g.world.blueZones.map(z=>clamp((z.r+120-distance(g,z))/120,0,1))):0;
 const inset=g.tick>2250?(g.tick-2250)/1350*290:0;
 const edge=inset?clamp((inset+100-Math.min(g.x,g.y,RULES.size-g.x,RULES.size-g.y))/100,0,1):0;
 return Math.max(local,edge);
}
export function step(g){
 if(g.done)return;
 const dt=1/RULES.hz;g.tick++;g.damageFlash=Math.max(0,g.damageFlash-dt);g.effects=g.effects.filter(e=>(e.life-=dt)>0);
 // Do not drop a solid cover on the car: move its landing spot to a nearby clear road.
 if(g.tick===RULES.coverTick){for(const c of g.world.covers){if(distance(g,c)<160){for(const d of [240,-240,420,-420]){const p={...c,x:clamp(c.x+d,160,RULES.size-160)};if(distance(g,p)>180&&!g.world.buildings.some(b=>Math.abs(p.x-b.x)<b.w/2+110&&Math.abs(p.y-b.y)<b.h/2+110)&&distance(p,g.world.exit)>200&&!g.world.covers.some(o=>o!==c&&distance(p,o)<220)){c.x=p.x;break;}}}}}
 if(g.tick===RULES.coverTick+RULES.coverDrop&&blocked(g,g.x,g.y)){
  let resolved=false;for(let radius=8;radius<=220&&!resolved;radius+=8)for(let i=0;i<24;i++){const a=i*Math.PI/12,x=g.x+Math.cos(a)*radius,y=g.y+Math.sin(a)*radius;if(!blocked(g,x,y)){g.x=x;g.y=y;g.speed=0;g.vx=0;g.vy=0;g.target=null;g.reverseUntil=0;resolved=true;break;}}
 }
 let desired=0,turn=0;
 const speedRatio=clamp(Math.abs(g.speed)/RULES.maxSpeed,0,1);
 if(g.tick<g.reverseUntil){desired=-RULES.reverseSpeed;}
 else if(g.target){
  const dx=g.target.x-g.x,dy=g.target.y-g.y,d=Math.hypot(dx,dy);
  if(d>14){
   const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-g.angle),Math.cos(Math.atan2(dy,dx)-g.angle));
   // Lateral acceleration is limited at speed, widening the turning circle.
   const turnRate=(2.7-1.55*speedRatio)*clamp(Math.abs(g.speed)/35,.18,1);
   turn=clamp(delta*3,-turnRate,turnRate);
   desired=Math.min(RULES.maxSpeed,Math.sqrt(2*180*Math.max(0,d-9)))*Math.max(.3,1-Math.abs(delta)/Math.PI*.7);
  }else g.target=null;
 }else if(g.reverseUntil)g.reverseUntil=0;
 const rate=desired*g.speed<0?350:Math.abs(desired)<Math.abs(g.speed)?240:desired<0?170:140;
 g.speed+=clamp(desired-g.speed,-rate*dt,rate*dt);
 if(Math.abs(g.speed)<.1&&desired===0)g.speed=0;
 g.steer+=(turn-g.steer)*.28;g.angle+=g.steer*dt;
 g.lean+=(-g.steer*speedRatio*.065-g.lean)*.18;
 const forwardX=Math.cos(g.angle),forwardY=Math.sin(g.angle);
 // Retain lateral velocity briefly during sharp high-speed steering (rear slip).
 const grip=8.5-5.8*speedRatio*Math.min(1,Math.abs(g.steer));
 const forward=g.vx*forwardX+g.vy*forwardY,lateral=(-g.vx*forwardY+g.vy*forwardX)*Math.exp(-grip*dt);
 g.slip=Math.abs(lateral);
 const longitudinal=forward+(g.speed-forward)*.65;
 g.vx=forwardX*longitudinal-forwardY*lateral;g.vy=forwardY*longitudinal+forwardX*lateral;
 const dx=g.vx*dt,dy=g.vy*dt,nx=g.x+dx,ny=g.y+dy;
 if(blocked(g,nx,ny)){
  const impact=Math.hypot(g.vx,g.vy),blockX=blocked(g,nx,g.y),blockY=blocked(g,g.x,ny);
  if(impact>25&&g.tick>=g.collisionUntil){damage(g,3,'collision');g.effects[g.effects.length-1].intensity=impact;g.collisionUntil=g.tick+15;}
  let mx=g.x,my=g.y;if(!blockX&&!blocked(g,nx,my))mx=nx;if(!blockY&&!blocked(g,mx,ny))my=ny;
  // Small outward impulse, with a clear-space check: no teleporting through corners.
  if(blockX||(!blockX&&!blockY)){g.vx*=-.22;const bx=mx+g.vx*dt;if(!blocked(g,bx,my))mx=bx;}
  if(blockY||(!blockX&&!blockY)){g.vy*=-.22;const by=my+g.vy*dt;if(!blocked(g,mx,by))my=by;}
  g.meters+=Math.min(Math.hypot(mx-g.x,my-g.y),impact*dt)/8;g.x=mx;g.y=my;
  g.speed=g.vx*forwardX+g.vy*forwardY;
  if(blockX&&blockY||impact>25){g.target=null;g.reverseUntil=0;}
 }else{g.meters+=Math.hypot(dx,dy)/8;g.x=nx;g.y=ny;}
 for(const c of g.world.crates){if(c.looted)continue;if(distance(g,c)<90&&Math.abs(g.speed)<55){c.progress+=dt;if(c.progress>=1.4){c.looted=true;g.loot++;g.lootPoints+=RULES.lootScore;effect(g,'loot',c.x,c.y,1.4);}}else c.progress=0;}
 for(const e of g.world.enemies){if(distance(e,g)>760)continue;e.cooldown--;e.angle=Math.atan2(g.y-e.y,g.x-e.x);if(e.cooldown<=0){e.cooldown=53+(g.tick%41);const spread=Math.sin(g.tick*1.17+e.x)*.20,a=e.angle+spread;g.bullets.push({x:e.x,y:e.y,vx:Math.cos(a)*430,vy:Math.sin(a)*430,life:1.9});effect(g,'muzzle',e.x+Math.cos(a)*23,e.y+Math.sin(a)*23,.12);}}
 g.bullets=g.bullets.filter(b=>{
  b.life-=dt;const px=b.x,py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
  const dx=b.x-px,dy=b.y-py,t=clamp(((g.x-px)*dx+(g.y-py)*dy)/(dx*dx+dy*dy),0,1),near=Math.hypot(px+dx*t-g.x,py+dy*t-g.y);
  if(blocked(g,b.x,b.y,0)){effect(g,'ground',b.x,b.y,.45);return false;}
  if(near<23){damage(g,5,'hit',{x:g.x-b.vx,y:g.y-b.vy});return false;}
  if(near<85&&!b.whizzed){effect(g,'whizz',b.x,b.y,.15);b.whizzed=true;}
  if(b.life<=0)effect(g,'ground',b.x,b.y,.45);
  return b.life>0;
 });
 if(g.tick>=RULES.blueTick&&g.tick<RULES.blueTick+RULES.blueDuration&&g.world.blueZones.some(z=>distance(g,z)<z.r)){g.hp-=dt;g.damageFlash=Math.max(g.damageFlash,.08);}
 for(const z of g.world.redZones)for(const s of z.strikes){if(g.tick===s.at){effect(g,'explosion',s.x,s.y,2.6);if(distance(g,s)<s.r+19)damage(g,5,'hit',s);}}
 if(g.tick>2250){const inset=(g.tick-2250)/1350*290;if(g.x<inset||g.y<inset||g.x>RULES.size-inset||g.y>RULES.size-inset)g.hp-=2.5*dt;}
 if(g.tick>=RULES.extractionTick&&distance(g,g.world.exit)<95&&Math.abs(g.speed)<55){g.extractProgress+=dt;if(g.extractProgress>=2){g.extracted=true;g.done=true;g.reason='extracted';}}else g.extractProgress=0;
 if(g.hp<=0){g.hp=0;g.done=true;g.reason='destroyed';}else if(g.tick>=RULES.ticks){g.done=true;g.reason='timeout';}
}
export function summary(g){return{score:score(g),meters:Math.floor(g.meters),loot:g.loot,lootPoints:g.lootPoints,extracted:g.extracted,ticks:g.tick,reason:g.reason,coins:coinsForScore(score(g))};}
export function replay(seed,events,endTick){
 if(!Array.isArray(events)||events.length>RULES.maxEvents||!Number.isInteger(endTick)||endTick<1||endTick>RULES.ticks)throw Error('잘못된 플레이 기록입니다.');
 let previous=-1;for(const e of events){if(!e||!Number.isInteger(e.t)||e.t<0||e.t>=endTick||e.t<previous||typeof e.stop!=='boolean'||(e.reverse!==undefined&&typeof e.reverse!=='boolean')||(e.reverse&&e.stop)||(!e.stop&&!e.reverse&&(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<20||e.y<20||e.x>RULES.size-20||e.y>RULES.size-20)))throw Error('잘못된 조작 기록입니다.');previous=e.t;}
 const g=createGame(seed);let i=0;while(g.tick<endTick&&!g.done){while(i<events.length&&events[i].t===g.tick)command(g,events[i++]);step(g);}if(!g.done||g.tick!==endTick||i!==events.length)throw Error('완료되지 않은 플레이입니다.');return summary(g);
}
