import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,createGame,command,step,summary,replay} from '../lib/engine.mjs';
import {makeSession,validateResult,sign,kstDay,equal,checkAccess} from '../lib/server.mjs';
process.env.GAME_ACCESS='public';
process.env.GAME_SECRET_KEY='test-only-secret-for-pony-game-0123456789';
const uid='123456789012345678',now=Date.UTC(2026,8,30,10,0);
function drive(seed){const g=createGame(seed),events=[];const points=[[1100,730],[1100,360],[740,360],[360,360],[360,1100],[550,1100],[1100,1100],[1840,1100],[1840,1840],[1100,1840],[1100,350],[360,360]];let j=0;while(!g.done){if(g.tick%280===0){const [x,y]=points[j++%points.length];const event={t:g.tick,stop:false,x,y};events.push(event);command(g,event);}step(g);}return{g,events};}
function link(){const exp=Math.floor(now/1000)+7200;return{uid,exp,sig:sign(`link:pony3:${uid}:${exp}`)};}
test('recorded drive exactly matches server replay over 12 maps',()=>{for(let seed=1;seed<=12;seed++){const {g,events}=drive(seed);assert.deepEqual(replay(seed,events,g.tick),summary(g));assert.ok(g.tick<=3600);assert.ok(summary(g).coins<=10);}});
test('no movement gives no distance score and ends within 120 seconds',()=>{const g=createGame(1);while(!g.done)step(g);assert.equal(g.meters,0);assert.equal(summary(g).coins,0);assert.equal(g.tick,3600);});
test('supply crate awards points once and restores health',()=>{const g=createGame(1);g.world.enemies=[];g.x=g.world.crates[0].x;g.y=g.world.crates[0].y;g.hp=70;for(let i=0;i<120;i++)step(g);assert.equal(g.loot,1);assert.equal(g.lootPoints,750);assert.equal(g.hp,80);});
test('extraction opens only in final 20 seconds and requires two seconds stopped',()=>{const g=createGame(1);g.world.enemies=[];g.x=360;g.y=360;g.tick=2930;for(let i=0;i<69;i++)step(g);assert.equal(g.extractProgress,0);for(let i=0;i<62;i++)step(g);assert.equal(g.extracted,true);assert.equal(g.reason,'extracted');assert.equal(summary(g).score,2250);});
test('wall collision cannot score distance through buildings',()=>{const g=createGame(1);g.world.enemies=[];g.world.buildings=[{x:1100,y:1200,w:200,h:80}];command(g,{x:1100,y:1000});for(let i=0;i<300;i++)step(g);assert.ok(g.y>=1259);assert.ok(g.meters<10);});
test('rejects malformed, unfinished, unsorted and oversized input logs',()=>{assert.throws(()=>replay(1,[],30));assert.throws(()=>replay(1,[{t:0,stop:false,x:NaN,y:100}],3600));assert.throws(()=>replay(1,[{t:10,stop:true},{t:0,stop:true}],3600));assert.throws(()=>replay(1,Array(1001).fill({t:0,stop:true}),3600));assert.throws(()=>replay(1,[{t:3600,stop:true}],3600));});
test('signed personal links validate and obsolete game links fail',()=>{assert.equal(makeSession(link(),now).authenticated,true);const old={...link(),sig:sign(`link:${uid}:${link().exp}`)};assert.throws(()=>makeSession(old,now));assert.throws(()=>makeSession({...link(),uid:'999999999999999999'},now));assert.throws(()=>makeSession({...link(),exp:Math.floor(now/1000)-1},now));});
test('server computes score, signs OOPS3 code, ignores fabricated score',()=>{const s=makeSession(link(),now),{g,events}=drive(s.seed),body={token:s.token,events,endTick:g.tick,score:999999,coins:10};const out=validateResult(body,now+125000);assert.deepEqual(out.result,summary(g));if(out.result.coins>0){assert.match(out.code,/^OOPS3-/);const parts=out.code.split('-');assert.equal(parts[2],String(out.result.coins));assert.equal(parts[5],sign(`reward:pony3:${uid}:${parts[2]}:${parts[3]}:${parts[4]}`));}});
test('tampering, accelerated submission and expired sessions fail',()=>{const s=makeSession(link(),now),{g,events}=drive(s.seed),body={token:s.token,events,endTick:g.tick};assert.throws(()=>validateResult(body,now+1000));assert.throws(()=>validateResult({...body,token:s.token.slice(0,-1)+'X'},now+125000));assert.throws(()=>validateResult(body,now+601000));});
test('KST midnight and practice mode use correct reward policy',()=>{assert.equal(kstDay(Date.UTC(2026,8,30,14,59,59)),'20260930');assert.equal(kstDay(Date.UTC(2026,8,30,15,0,0)),'20261001');const s=makeSession({},now),{g,events}=drive(s.seed);const out=validateResult({token:s.token,events,endTick:g.tick},now+125000);assert.equal(out.code,null);assert.equal(s.authenticated,false);});
test('secret never appears in session token or client module',()=>{const s=makeSession(link(),now);assert.ok(!s.token.includes(process.env.GAME_SECRET_KEY));assert.equal(equal('A'.repeat(64),'B'.repeat(64)),false);});

test('private preview refuses public visits and ordinary links; admin test never issues coins',()=>{
 process.env.GAME_ACCESS='admin';
 try {
  assert.throws(()=>checkAccess({},now));assert.throws(()=>makeSession(link(),now));
  const exp=Math.floor(now/1000)+7200,adminLink={uid,exp,access:'admin',sig:sign(`link:pony3:admin:${uid}:${exp}`)};
  assert.equal(checkAccess(adminLink,now).test,true);
  const s=makeSession(adminLink,now),{g,events}=drive(s.seed),out=validateResult({token:s.token,events,endTick:g.tick},now+125000);
  assert.equal(out.session.test,true);assert.equal(out.code,null);
  assert.throws(()=>makeSession({...link(),access:'admin'},now));
 } finally {process.env.GAME_ACCESS='public';}
});
