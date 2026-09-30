import { createHmac, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import { RULES, replay } from './engine.mjs';
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const secret=()=>{const key=process.env.GAME_SECRET_KEY||'';if(key.length<32)throw new HttpError(503,'보상 연결 준비 중입니다. 연습 플레이는 가능합니다.');return key;};
export const sign=(payload)=>createHmac('sha256',secret()).update(payload).digest('hex').toUpperCase();
export function equal(a,b){return typeof a==='string'&&typeof b==='string'&&/^[A-Fa-f0-9]{64}$/.test(a)&&/^[A-Fa-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function kstDay(now=Date.now()){return new Date(now+9*3600000).toISOString().slice(0,10).replaceAll('-','');}
export const accessMode=()=>process.env.GAME_ACCESS==='public'?'public':'admin';
export function verifyLink(link,now=Date.now()){
 const mode=accessMode(),hasLink=Boolean(link?.uid||link?.exp||link?.sig),admin=link?.access==='admin';
 if(!hasLink){if(mode==='admin')throw new HttpError(403,'관리자 테스트 중입니다. 운영진에게 발급된 개인 링크로 접속해 주세요.');return {uid:null,admin:false};}
 const payload=admin?`link:pony3:admin:${link.uid}:${link.exp}`:`link:pony3:${link.uid}:${link.exp}`;
 if(!/^\d{17,20}$/.test(String(link.uid))||!/^\d{10}$/.test(String(link.exp))||!Number.isSafeInteger(Number(link.exp))||Number(link.exp)<Math.floor(now/1000)||Number(link.exp)>Math.floor(now/1000)+7205||!equal(sign(payload),String(link.sig).toUpperCase()))throw new HttpError(401,'개인 링크가 만료되었거나 유효하지 않습니다. !미니게임으로 새 링크를 받아 주세요.');
 if(mode==='admin'&&!admin)throw new HttpError(403,'현재 관리자 테스트 중입니다. 일반 이용은 준비가 끝난 후 열립니다.');return {uid:String(link.uid),admin};
}
export function checkAccess(link,now=Date.now()){const identity=verifyLink(link,now);return {allowed:true,mode:accessMode(),test:identity.admin,authenticated:Boolean(identity.uid)};}
export function makeSession(link, now=Date.now()){
 const identity=verifyLink(link,now);
 const session={v:RULES.version,uid:identity.uid,test:identity.admin,seed:randomBytes(4).readUInt32LE(),started:now,until:now+10*60000,nonce:randomBytes(12).toString('hex')};
 const payload=Buffer.from(JSON.stringify(session)).toString('base64url');return {token:payload+'.'+sign('session:'+payload),seed:session.seed,rulesVersion:RULES.version,authenticated:Boolean(identity.uid),test:identity.admin};
}
export function validateResult(body,now=Date.now()){
 if(body?.rulesVersion!==RULES.version)throw new HttpError(409,'게임이 업데이트되었습니다. 페이지를 새로고침해 주세요.');
 const token=String(body?.token||'');if(token.length>1500)throw new HttpError(400,'잘못된 게임 정보입니다.');const [payload,signature,...extra]=token.split('.');if(extra.length||!payload||!equal(sign('session:'+payload),signature))throw new HttpError(401,'게임 정보가 유효하지 않습니다.');
 let session;try{session=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw new HttpError(400,'잘못된 게임 정보입니다.');}
 if(session.v!==RULES.version||!Number.isInteger(session.seed)||!Number.isFinite(session.started)||now>session.until||now<session.started)throw new HttpError(401,'플레이 제출 시간이 지났습니다. 다시 출발해 주세요.');
 if(accessMode()==='admin'&&!session.test)throw new HttpError(403,'관리자 테스트 중에는 일반 게임 기록을 제출할 수 없습니다.');
 let result;try{result=replay(session.seed,body.events,body.endTick);}catch(e){throw new HttpError(400,e.message);}
 if(now-session.started<result.ticks/RULES.hz*1000-2000)throw new HttpError(400,'실제 플레이 시간이 부족합니다.');
 const issued=Math.floor(now/1000),day=kstDay(now),coins=result.coins;let code=null;
 if(session.uid&&!session.test&&coins>0){const message=`reward:pony3:${session.uid}:${coins}:${day}:${issued}`;code=`OOPS3-${session.uid}-${coins}-${day}-${issued}-${sign(message)}`;}
 return {session,result,code,day};
}
export async function redis(...command){const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;if(!url||!token)return null;const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('기록 서버 연결 실패');const data=await response.json();if(data.error)throw Error(data.error);return data.result;}
export const hasRanking=()=>Boolean(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
export async function saveRanking(session,result){
 if(!session.uid||session.test||!hasRanking())return;
 const id=createHash('sha256').update('pony:'+session.uid).digest('hex').slice(0,12),name='드라이버 '+id.slice(0,4).toUpperCase();
 const record={id,name,...result};
 const script="local old=redis.call('ZSCORE',KEYS[1],ARGV[1]); if (not old) or tonumber(ARGV[2])>tonumber(old) then redis.call('ZADD',KEYS[1],ARGV[2],ARGV[1]); redis.call('HSET',KEYS[2],ARGV[1],ARGV[3]); end; return 1";
 await redis('EVAL',script,2,'pony3:scores','pony3:records',id,result.score,JSON.stringify(record));
}
export async function ranking(){if(!hasRanking())return {enabled:false,entries:[]};const ids=await redis('ZREVRANGE','pony3:scores',0,9);if(!ids?.length)return {enabled:true,entries:[]};const rows=await redis('HMGET','pony3:records',...ids);return {enabled:true,entries:rows.filter(Boolean).map(x=>{const r=JSON.parse(x);return {name:r.name,score:r.score,meters:r.meters,loot:r.loot,extracted:r.extracted};})};}
export function respond(res,status,data){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');return res.status(status).json(data);}
export function endpoint(method,fn){return async(req,res)=>{if(req.method!==method){res.setHeader('Allow',method);return respond(res,405,{error:'지원하지 않는 요청입니다.'});}try{let body=req.body;if(typeof body==='string'){if(Buffer.byteLength(body)>180000)throw new HttpError(413,'플레이 기록이 너무 큽니다.');body=JSON.parse(body);}return respond(res,200,await fn(body,req));}catch(e){if(e instanceof SyntaxError)return respond(res,400,{error:'잘못된 요청입니다.'});return respond(res,e.status||500,{error:e.status?e.message:'연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'});}};}
