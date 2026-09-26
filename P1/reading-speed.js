/* One persisted reading speed for all P1 readers and recorded songs. */
(() => {
'use strict';
const choices=[['0.5','ช้า'],['0.75','ช้าพอดี'],['1','ปกติ'],['1.5','เร็ว'],['2','เร็วมาก']],key='p1-reading-speed';
const legacy={'0.65':'0.5','0.85':'0.75','1.2':'1.5','1.45':'2'};
let rate=.75;try{const stored=localStorage.getItem(key),saved=legacy[stored]||stored;if(choices.some(([v])=>v===saved))rate=Number(saved)}catch{}
// Pace short Thai words as well as the synthesized voice itself.
const pauses={'0.5':240,'0.75':100,'1':40,'1.5':15,'2':0};
window.P1ReadingSpeed={get:()=>rate,gap:(base=120)=>Math.round(pauses[String(rate)]*base/120)};

let thaiVoice=null;
function refreshThaiVoice(){
 try{
  const voices=window.speechSynthesis?.getVoices?.()||[];
  thaiVoice=voices.find(v=>String(v.lang||'').toLowerCase().startsWith('th'))||voices.find(v=>/thai/i.test(v.name||''))||null;
 }catch{thaiVoice=null}
 return thaiVoice;
}
refreshThaiVoice();
try{window.speechSynthesis?.addEventListener?.('voiceschanged',refreshThaiVoice)}catch{}
document.addEventListener('pointerdown',()=>{try{window.speechSynthesis?.resume?.();refreshThaiVoice()}catch{}},{capture:true});

window.P1Speech={
 prepare(utterance){
  if(!utterance)return utterance;
  utterance.lang='th-TH';
  const voice=refreshThaiVoice();
  if(voice)utterance.voice=voice;
  return utterance;
 },
 speak(utterance){
  const synth=window.speechSynthesis;
  if(!synth||!utterance)return false;
  try{
   synth.resume?.();
   this.prepare(utterance);
   synth.speak(utterance);
   return true;
  }catch(error){
   console.warn('P1 speech unavailable',error);
   return false;
  }
 },
 voice:()=>refreshThaiVoice()
};
function media(){document.querySelectorAll('audio').forEach(a=>{a.defaultPlaybackRate=rate;a.playbackRate=rate;a.preservesPitch=true})}
function init(){
 let select=document.querySelector('#speed');
 if(!select){const label=document.createElement('label');label.className='p1-speed-control';label.textContent='ความเร็วอ่าน ';select=document.createElement('select');select.id='p1ReadingSpeed';label.append(select);(document.querySelector('main')||document.body).prepend(label)}
 select.setAttribute('aria-label','ความเร็วอ่าน');select.replaceChildren();for(const [value,text] of choices){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)}select.value=String(rate);
 function update(value){value=legacy[value]||value;if(!choices.some(([v])=>v===value))return;rate=Number(value);select.value=value;media();document.dispatchEvent(new CustomEvent('p1-reading-speed-change',{detail:rate}))}
 select.addEventListener('change',()=>{update(select.value);try{localStorage.setItem(key,select.value)}catch{}});
 window.addEventListener('storage',e=>{if(e.key===key)update(e.newValue)});
 media();new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('audio')||n.querySelector('audio')))))media()}).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
