/* BOYANG RUN 2.5D: mobile-friendly procedural footsteps and action sounds.
   Audio starts only after a player gesture (Safari / iOS requirement). */
(()=>{'use strict';
const KEY='boyang-run-sound-enabled-v1',Context=window.AudioContext||window.webkitAudioContext;
let enabled=true,ctx=null,master=null,noise=null,travel=0,lastRun=null,side=0;
try{const saved=localStorage.getItem(KEY);if(saved!==null)enabled=saved==='true';}catch(_){}
function unlock(){
 if(!enabled||!Context)return false;
 try{
  if(!ctx){
   ctx=new Context();master=ctx.createGain();master.gain.value=.42;master.connect(ctx.destination);
   noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.45),ctx.sampleRate);
   const pixels=noise.getChannelData(0);
   for(let i=0;i<pixels.length;i++)pixels[i]=Math.random()*2-1;
  }
  if(ctx.state==='suspended'){const p=ctx.resume();if(p&&p.catch)p.catch(()=>{});}
  return true;
 }catch(_){return false;}
}
const audible=()=>Boolean(enabled&&ctx&&master&&ctx.state==='running');
function tone(from,to,duration,volume,type='sine'){
 if(!audible())return;
 const at=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=type;
 osc.frequency.setValueAtTime(from,at);
 osc.frequency.exponentialRampToValueAtTime(Math.max(30,to),at+duration);
 gain.gain.setValueAtTime(.0001,at);
 gain.gain.linearRampToValueAtTime(volume,at+.008);
 gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 osc.connect(gain);gain.connect(master);osc.start(at);osc.stop(at+duration+.015);
}
function burst(duration,volume,cutoff,kind='lowpass'){
 if(!audible()||!noise)return;
 const at=ctx.currentTime,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 src.buffer=noise;filter.type=kind;filter.frequency.value=cutoff;
 gain.gain.setValueAtTime(.0001,at);
 gain.gain.linearRampToValueAtTime(volume,at+.007);
 gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 src.connect(filter);filter.connect(gain);gain.connect(master);
 src.start(at);src.stop(at+duration+.01);
}
function step(running){
 if(!audible())return;
 side=1-side;
 const variation=side?1.06:.93;
 burst(running?.095:.075,(running?.19:.115)*variation,running?1650:1120);
 tone(running?135:105,running?68:58,running?.095:.083,(running?.105:.068)*variation);
}
function stop(){travel=0;lastRun=null;}
function tick(speed,running,airborne,dt){
 if(!enabled||airborne||speed<.27||!Number.isFinite(dt)||dt<=0){stop();return;}
 if(lastRun!==running){lastRun=running;travel=0;}
 const stride=running?1.18:.72;
 travel+=Math.min(dt,.06)*Math.max(0,Math.min(8,speed));
 let limit=2;
 while(travel>=stride&&limit-->0){travel-=stride;step(running);}
}
function jump(){stop();if(!audible())return;tone(290,640,.22,.13,'triangle');burst(.12,.075,2700,'highpass');}
function land(){stop();if(!audible())return;tone(125,58,.15,.22);burst(.13,.15,940);}
function slide(){stop();if(!audible())return;burst(.36,.15,1750,'highpass');tone(310,105,.31,.10,'triangle');}
function setEnabled(value){
 enabled=Boolean(value);stop();
 try{localStorage.setItem(KEY,String(enabled));}catch(_){}
 if(enabled){unlock();if(master)master.gain.value=.42;}
 else if(master)master.gain.value=0;
 return enabled;
}
window.BoyangSFX25D={get enabled(){return enabled;},get supported(){return Boolean(Context);},unlock,tick,stop,jump,land,slide,setEnabled};
})();