import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,ROADS,createGame,command,step,summary,replay,blocked,blueExposure} from '../lib/engine.mjs';
import {makeSession,validateResult,sign,kstDay,equal,checkAccess} from '../lib/server.mjs';
process.env.GAME_ACCESS='public';
process.env.GAME_SECRET_KEY='test-only-secret-for-pony-game-0123456789';
const uid='123456789012345678',now=Date.UTC(2026,8,30,10,0);
function drive(seed){const g=createGame(seed),events=[];const points=[[1100,730],[1100,360],[740,360],[360,360],[360,1100],[550,1100],[1100,1100],[1840,1100],[1840,1840],[1100,1840],[1100,350],[360,360]];let j=0;while(!g.done){if(g.tick%280===0){const [x,y]=points[j++%points.length];const event={t:g.tick,stop:false,x,y};events.push(event);command(g,event);}step(g);}return{g,events};}
function link(){const exp=Math.floor(now/1000)+7200;return{uid,exp,sig:sign(`link:pony3:${uid}:${exp}`)};}
test('recorded drive exactly matches server replay over 12 maps',()=>{for(let seed=1;seed<=12;seed++){const {g,events}=drive(seed);assert.deepEqual(replay(seed,events,g.tick),summary(g));assert.ok(g.tick<=3600);assert.ok(summary(g).coins<=10);}});
test('no movement gives no distance score and ends within 120 seconds',()=>{const g=createGame(1);while(!g.done)step(g);assert.equal(g.meters,0);assert.equal(summary(g).coins,0);assert.equal(g.tick,3600);});
test('supply crate awards points once without changing current health policy',()=>{const g=createGame(1);g.world.enemies=[];g.x=g.world.crates[0].x;g.y=g.world.crates[0].y;g.hp=70;for(let i=0;i<120;i++)step(g);assert.equal(g.loot,1);assert.equal(g.lootPoints,750);assert.equal(g.hp,70);});
test('extraction opens only in final 20 seconds and requires two seconds stopped',()=>{const g=createGame(1);g.world.enemies=[];g.x=g.world.exit.x;g.y=g.world.exit.y;g.tick=2930;for(let i=0;i<69;i++)step(g);assert.equal(g.extractProgress,0);for(let i=0;i<62;i++)step(g);assert.equal(g.extracted,true);assert.equal(g.reason,'extracted');assert.equal(summary(g).score,RULES.extractionScore);});
test('wall collision cannot score distance through buildings',()=>{const g=createGame(1);g.world.enemies=[];g.x=1100;g.y=1310;g.world.props=[];g.world.buildings=[{x:1100,y:1200,w:200,h:80}];command(g,{x:1100,y:1000});for(let i=0;i<300;i++)step(g);assert.ok(g.y>=1259);assert.ok(g.meters<10);});
test('rejects malformed, unfinished, unsorted and oversized input logs',()=>{assert.throws(()=>replay(1,[],30));assert.throws(()=>replay(1,[{t:0,stop:false,x:NaN,y:100}],3600));assert.throws(()=>replay(1,[{t:10,stop:true},{t:0,stop:true}],3600));assert.throws(()=>replay(1,Array(1001).fill({t:0,stop:true}),3600));assert.throws(()=>replay(1,[{t:3600,stop:true}],3600));});
test('signed personal links validate and obsolete game links fail',()=>{assert.equal(makeSession(link(),now).authenticated,true);const old={...link(),sig:sign(`link:${uid}:${link().exp}`)};assert.throws(()=>makeSession(old,now));assert.throws(()=>makeSession({...link(),uid:'999999999999999999'},now));assert.throws(()=>makeSession({...link(),exp:Math.floor(now/1000)-1},now));});
test('server computes score, signs OOPS3 code, ignores fabricated score',()=>{const s=makeSession(link(),now),{g,events}=drive(s.seed),body={token:s.token,events,endTick:g.tick,rulesVersion:RULES.version,score:999999,coins:10};const out=validateResult(body,now+125000);assert.deepEqual(out.result,summary(g));if(out.result.coins>0){assert.match(out.code,/^OOPS3-/);const parts=out.code.split('-');assert.equal(parts[2],String(out.result.coins));assert.equal(parts[5],sign(`reward:pony3:${uid}:${parts[2]}:${parts[3]}:${parts[4]}`));}});
test('tampering, accelerated submission and expired sessions fail',()=>{const s=makeSession(link(),now),{g,events}=drive(s.seed),body={token:s.token,events,endTick:g.tick,rulesVersion:RULES.version};assert.throws(()=>validateResult(body,now+1000));assert.throws(()=>validateResult({...body,token:s.token.slice(0,-1)+'X'},now+125000));assert.throws(()=>validateResult(body,now+601000));});
test('KST midnight and practice mode use correct reward policy',()=>{assert.equal(kstDay(Date.UTC(2026,8,30,14,59,59)),'20260930');assert.equal(kstDay(Date.UTC(2026,8,30,15,0,0)),'20261001');const s=makeSession({},now),{g,events}=drive(s.seed);const out=validateResult({token:s.token,events,endTick:g.tick,rulesVersion:RULES.version},now+125000);assert.equal(out.code,null);assert.equal(s.authenticated,false);});
test('secret never appears in session token or client module',()=>{const s=makeSession(link(),now);assert.ok(!s.token.includes(process.env.GAME_SECRET_KEY));assert.equal(equal('A'.repeat(64),'B'.repeat(64)),false);});

test('private preview refuses public visits and ordinary links; admin test never issues coins',()=>{
 process.env.GAME_ACCESS='admin';
 try {
  assert.throws(()=>checkAccess({},now));assert.throws(()=>makeSession(link(),now));
  const exp=Math.floor(now/1000)+7200,adminLink={uid,exp,access:'admin',sig:sign(`link:pony3:admin:${uid}:${exp}`)};
  assert.equal(checkAccess(adminLink,now).test,true);
  const s=makeSession(adminLink,now),{g,events}=drive(s.seed),out=validateResult({token:s.token,events,endTick:g.tick,rulesVersion:RULES.version},now+125000);
  assert.equal(out.session.test,true);assert.equal(out.code,null);
  assert.throws(()=>makeSession({...link(),access:'admin'},now));
 } finally {process.env.GAME_ACCESS='public';}
});

function clearGame(){const g=createGame(37);g.world.enemies=[];g.world.buildings=[];g.world.props=[];return g;}
test('acceleration is progressive and reverse brakes through zero',()=>{
 const g=clearGame();command(g,{x:1650,y:100});step(g);assert.ok(g.speed>0&&g.speed<10);
 for(let i=0;i<90;i++)step(g);assert.ok(g.speed>280);const before=g.speed;command(g,{reverse:true});assert.equal(g.speed,before);step(g);assert.ok(g.speed>0&&g.speed<before);
 let crossed=false;for(let i=0;i<55;i++){const previous=g.speed;step(g);assert.ok(Math.abs(g.speed-previous)<=350/RULES.hz+.001);if(g.speed<0)crossed=true;}assert.ok(crossed);
});
test('high-speed turning is wider and produces bounded slip and body roll',()=>{
 function turn(speed){const g=clearGame();g.angle=0;g.speed=speed;g.vx=speed;command(g,{x:g.x,y:g.y+900});step(g);return g;}
 const low=turn(60),high=turn(300);assert.ok(high.steer<low.steer);assert.ok(high.slip>0);assert.ok(Math.abs(high.lean)>0&&Math.abs(high.lean)<.15);
});
test('wall impact rebounds without penetrating or repeatedly dealing damage',()=>{
 const g=clearGame();g.x=100;g.y=500;g.angle=Math.PI;g.speed=310;g.vx=-310;command(g,{x:20,y:500});let hit=false;
 for(let i=0;i<30;i++){step(g);assert.ok(g.x>=25);if(g.effects.some(e=>e.kind==='collision'))hit=true;}
 assert.ok(hit);assert.ok(g.x>25);assert.equal(g.hp,97);
});
test('map props are deterministic, all ten types occur, and objectives and roads remain open',()=>{
 for(let seed=1;seed<=40;seed++){
  const g=createGame(seed);assert.deepEqual(g.world,createGame(seed).world);assert.equal(new Set(g.world.props.map(p=>p.kind)).size,10);
  assert.ok(!blocked(g,g.x,g.y));assert.ok(!blocked(g,g.world.exit.x,g.world.exit.y));
  for(const p of g.world.props){assert.ok(!ROADS.some(r=>Math.abs(p.x-r)<123+p.w/2||Math.abs(p.y-r)<123+p.h/2));for(const c of g.world.crates)assert.ok(Math.hypot(p.x-c.x,p.y-c.y)>115);}
 }
});
test('bullet hits retain source direction, near misses emit once, blue proximity ramps',()=>{
 const g=clearGame();g.bullets=[{x:g.x-30,y:g.y,vx:430,vy:0,life:1}];step(g);assert.equal(g.hp,95);const hit=g.effects.find(e=>e.kind==='hit');assert.equal(Math.abs(hit.angle),Math.PI);
 g.bullets=[{x:g.x-20,y:g.y+50,vx:430,vy:0,life:1}];for(let i=0;i<4;i++)step(g);assert.equal(g.effects.filter(e=>e.kind==='whizz').length,1);
 g.tick=RULES.blueTick;const z=g.world.blueZones[0];g.x=z.x;g.y=z.y;assert.equal(blueExposure(g),1);g.x=z.x+z.r+60;assert.ok(blueExposure(g)>=.5);
});
test('new reverse and stop input replay matches authoritative result',()=>{
 const seed=12,g=createGame(seed),events=[];while(!g.done){if(g.tick%100===0){const e={t:g.tick,stop:false,x:1650,y:540};events.push(e);command(g,e);}if(g.tick%100===40){const e={t:g.tick,stop:false,reverse:true};events.push(e);command(g,e);}if(g.tick%100===85){const e={t:g.tick,stop:true};events.push(e);command(g,e);}step(g);}assert.deepEqual(replay(seed,events,g.tick),summary(g));
});
test('server rejects both stale rule versions and stale signed sessions',()=>{
 const s=makeSession({},now),{g,events}=drive(s.seed);assert.throws(()=>validateResult({token:s.token,events,endTick:g.tick,rulesVersion:RULES.version-1},now+125000),/업데이트/);
 const payload=Buffer.from(JSON.stringify({v:RULES.version-1,seed:1,started:now,until:now+600000})).toString('base64url');assert.throws(()=>validateResult({token:payload+'.'+sign('session:'+payload),events,endTick:g.tick,rulesVersion:RULES.version},now+125000));
});
