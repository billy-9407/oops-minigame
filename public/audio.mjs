// Original procedural effects, not extracted PUBG recordings. No external downloads.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class GameAudio{
 constructor(){this.enabled=false;this.loops=[];this.active=new Set();this.last=new Map();this.bgm=null;this.musicWanted=false;}
 async unlock(){
  try{if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();const c=this.ctx;this.master=c.createGain();this.master.gain.value=0;const compressor=c.createDynamicsCompressor();this.master.connect(compressor);compressor.connect(c.destination);this.makeBuffers();this.makeLoops();}
   if(this.bgm){this.musicWanted=true;this.bgm.play().catch(()=>{});}await this.ctx.resume();this.enabled=true;this.master.gain.setTargetAtTime(.45,this.ctx.currentTime,.05);return true;
  }catch{return false;}
 }
 buffer(seconds,fn){const b=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*seconds),this.ctx.sampleRate),a=b.getChannelData(0);let seed=1777;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};for(let i=0;i<a.length;i++)a[i]=clamp(fn(i/this.ctx.sampleRate,i/a.length,noise),-1,1);return b;}
 makeBuffers(){
  this.buffers={};
  for(const [name,hz] of [['idle',36],['low',64],['high',108]])this.buffers[name]=this.buffer(1,(t,_,n)=>{const phase=2*Math.PI*hz*t;return .28*Math.sin(phase)+.18*Math.sin(phase*2)+.07*Math.sin(phase*5)+n()*.08*(.6+.4*Math.sin(phase));});
  this.buffers.dirt=this.buffer(1,(t,_,n)=>n()*.26*(.6+.4*Math.sin(t*2*Math.PI*17)));
  this.buffers.blue=this.buffer(1,(t,_,n)=>.1*Math.sin(2*Math.PI*90*t)+n()*.05);
  this.buffers.start=this.buffer(.85,(t,u,n)=>(Math.sin(2*Math.PI*(25*t+38*t*t))*.34+n()*.2)*Math.sin(Math.PI*u));
  this.buffers.decel=this.buffer(.45,(t,u,n)=>(Math.sin(2*Math.PI*(100*t-80*t*t))*.18+n()*.035)*(1-u));
  this.buffers.collision=this.buffer(.65,(t,u,n)=>(n()*.65*Math.exp(-u*12)+Math.sin(2*Math.PI*57*t)*.35*Math.exp(-u*7)));
  this.buffers.hit=this.buffer(.22,(t,u,n)=>(n()*.65+Math.sin(2*Math.PI*1400*t)*.2)*Math.exp(-u*17));
  this.buffers.whizz=this.buffer(.3,(t,u,n)=>(n()*.16+Math.sin(2*Math.PI*(1400*t-1300*t*t))*.08)*Math.sin(Math.PI*u));
  this.buffers.loot=this.buffer(.65,(t,u)=>Math.sin(2*Math.PI*(t<.2?660:t<.4?880:1100)*t)*.17*Math.sin(Math.PI*u));
  this.buffers.explosion=this.buffer(1.7,(t,u,n)=>(n()*.55+Math.sin(2*Math.PI*(45*t-8*t*t))*.4)*Math.exp(-u*5));
  this.buffers.shell=this.buffer(.7,(t,u,n)=>(n()*.08+Math.sin(2*Math.PI*(450*t+500*t*t))*.08)*Math.sin(Math.PI*u));
  this.buffers.smoke=this.buffer(1.4,(t,u,n)=>n()*.23*Math.sin(Math.PI*u));
  this.buffers.success=this.buffer(1.2,(t,u)=>{const f=[523,659,784,1046][Math.min(3,Math.floor(u*4))];return Math.sin(2*Math.PI*f*t)*.18*Math.sin(Math.PI*u);});
 }
 makeLoops(){for(const name of ['idle','low','high','dirt','blue']){const src=this.ctx.createBufferSource(),gain=this.ctx.createGain();src.buffer=this.buffers[name];src.loop=true;gain.gain.value=0;src.connect(gain);gain.connect(this.master);src.start();this.loops.push({name,src,gain});}}
 setEnabled(on){this.enabled=on;if(this.ctx)this.master.gain.setTargetAtTime(on?.45:0,this.ctx.currentTime,.035);if(this.bgm)this.bgm.muted=!on;}
 event(kind,volume=1,pan=0){if(volume<=.01||!this.enabled||!this.ctx||this.ctx.state!=='running'||!this.buffers[kind])return;const now=this.ctx.currentTime;if(now-(this.last.get(kind)??-99)<(kind==='hit'?.065:.1)||this.active.size>=20)return;this.last.set(kind,now);
  const src=this.ctx.createBufferSource(),gain=this.ctx.createGain(),panner=this.ctx.createStereoPanner();src.buffer=this.buffers[kind];gain.gain.value=clamp(volume,0,1);panner.pan.value=clamp(pan,-1,1);src.connect(gain);gain.connect(panner);panner.connect(this.master);this.active.add(src);src.onended=()=>{this.active.delete(src);src.disconnect();gain.disconnect();panner.disconnect();};src.start();
 }
 update(g,playing,blue,onRoad){if(!this.ctx)return;const now=this.ctx.currentTime,s=clamp(Math.abs(g.speed)/310,0,1),running=playing&&!document.hidden;
  for(const l of this.loops){const v=!running?0:l.name==='idle'?.28*(1-s):l.name==='low'?.36*Math.sin(s*Math.PI):l.name==='high'?.34*s*s:l.name==='dirt'?(onRoad?.04:.25)*s:blue*.22;l.gain.gain.setTargetAtTime(v,now,.12);if(['idle','low','high','dirt'].includes(l.name))l.src.playbackRate.setTargetAtTime(.72+s*.95,now,.15);}
  if(running&&this.oldSpeed-Math.abs(g.speed)>5)this.event('decel',.45);this.oldSpeed=Math.abs(g.speed);
  if(this.bgm){const wanted=running&&this.enabled;this.bgm.volume=.06;this.bgm.muted=!wanted;if(wanted!==this.musicWanted){this.musicWanted=wanted;if(wanted)this.bgm.play().catch(()=>{});else this.bgm.pause();}}
 }
 async loadMusic(url){if(!url)return;this.bgm=new Audio(url);this.bgm.loop=true;this.bgm.volume=.06;this.bgm.preload='auto';}
 suspend(){if(this.ctx)this.ctx.suspend().catch(()=>{});if(this.bgm){this.musicWanted=false;this.bgm.pause();}}
 async resume(){if(this.enabled&&this.ctx)await this.ctx.resume().catch(()=>{});}
}
