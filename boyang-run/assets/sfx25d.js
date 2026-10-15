/* BOYANG RUN: Web Audio sounds with Safari/iPad explicit unlock and recovery.
   No samples or network downloads. Audio begins only after a user gesture. */
(()=>{'use strict';
const KEY='boyang-run-sound-enabled-v1';
const Context=window.AudioContext||window.webkitAudioContext;
let enabled=true,ctx=null,master=null,noise=null,travel=0,lastRun=null,foot=0;
const listeners=new Set();
try{const saved=localStorage.getItem(KEY);if(saved!==null)enabled=saved==='true';}catch(_){}
function status(){
 if(!Context)return 'unsupported';
 if(!enabled)return 'muted';
 if(!ctx)return 'locked';
 if(ctx.state==='running')return 'ready';
 if(ctx.state==='interrupted')return 'interrupted';
 return 'locked';
}
function notify(){for(const cb of listeners){try{cb(status());}catch(_){}}}
function subscribe(cb){if(typeof cb!=='function')return ()=>{};listeners.add(cb);cb(status());return ()=>listeners.delete(cb);}
function stop(){travel=0;lastRun=null;}
function createContext(){
 ctx=new Context();
 master=ctx.createGain();master.gain.value=enabled?.68:0;master.connect(ctx.destination);
 noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.45),ctx.sampleRate);
 const samples=noise.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 // Start a one-frame silent source synchronously from the user's gesture:
 // this helps older WebKit versions activate their audio output route.
 const prime=ctx.createBufferSource();
 prime.buffer=ctx.createBuffer(1,1,ctx.sampleRate);
 prime.connect(master);prime.start(0);
 ctx.onstatechange=notify;
 notify();
}
function unlock(){
 if(!Context||!enabled)return Promise.resolve(false);
 try{
  if(!ctx||ctx.state==='closed')createContext();
  if(master)master.gain.value=.68;
  if(ctx.state==='running'){notify();return Promise.resolve(true);}
  const requested=ctx.resume();
  return Promise.resolve(requested).then(()=>{
   notify();
   return ctx.state==='running';
  }).catch(()=>{notify();return false;});
 }catch(_){notify();return Promise.resolve(false);}
}
const audible=()=>enabled&&ctx&&master&&ctx.state==='running';
function tone(from,to,duration,volume,type='sine',delay=0){
 if(!audible())return;
 const at=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=type;osc.frequency.setValueAtTime(from,at);
 osc.frequency.exponentialRampToValueAtTime(Math.max(30,to),at+duration);
 gain.gain.setValueAtTime(.0001,at);
 gain.gain.linearRampToValueAtTime(volume,at+.008);
 gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 osc.connect(gain);gain.connect(master);osc.start(at);osc.stop(at+duration+.016);
}
function burst(duration,volume,cutoff,kind='lowpass'){
 if(!audible()||!noise)return;
 const at=ctx.currentTime,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 src.buffer=noise;filter.type=kind;filter.frequency.value=cutoff;
 gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(volume,at+.007);
 gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 src.connect(filter);filter.connect(gain);gain.connect(master);
 src.start(at);src.stop(at+duration+.01);
}
function step(running){
 if(!audible())return;
 foot=1-foot;
 const variance=foot?1.05:.95;
 burst(running?.1:.085,(running?.23:.16)*variance,running?1800:1300);
 tone(running?145:112,running?72:58,running?.10:.09,(running?.13:.09)*variance);
}
function tick(speed,running,airborne,dt){
 if(!enabled||!audible()||airborne||speed<.27||!Number.isFinite(dt)||dt<=0){stop();return;}
 if(lastRun!==running){lastRun=running;travel=0;}
 const stride=running?1.18:.72;
 travel+=Math.min(dt,.06)*Math.max(0,Math.min(8,speed));
 let limit=2;while(travel>=stride&&limit-->0){travel-=stride;step(running);}
}
function jump(){stop();if(!audible())return;tone(290,640,.22,.18,'triangle');burst(.12,.09,2700,'highpass');}
function land(){stop();if(!audible())return;tone(125,58,.15,.27);burst(.13,.20,940);}
function slide(){stop();if(!audible())return;burst(.36,.21,1750,'highpass');tone(310,105,.31,.14,'triangle');}
function demo(){
 if(!audible())return;
 tone(530,710,.14,.26,'triangle');
 tone(710,940,.17,.23,'triangle',.16);
}
function test(){
 // Called directly by the speaker button's trusted click event on iPad.
 // 'ready' confirms Web Audio is running, not actual hardware volume.
 return unlock().then(ok=>{
  if(ok&&enabled)demo();
  return Boolean(ok&&enabled);
 });
}
function setEnabled(value){
 enabled=Boolean(value);stop();
 try{localStorage.setItem(KEY,String(enabled));}catch(_){}
 if(master)master.gain.value=enabled?.68:0;
 notify();return enabled;
}
if(typeof document!=='undefined'){
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&enabled&&ctx&&ctx.state!=='running')void unlock();
 });
 window.addEventListener('pageshow',()=>{
  if(enabled&&ctx&&ctx.state!=='running')void unlock();
 });
}
window.BoyangSFX25D={
 get enabled(){return enabled;},
 get supported(){return Boolean(Context);},
 get status(){return status();},
 subscribe,unlock,test,tick,stop,jump,land,slide,setEnabled
};
})();