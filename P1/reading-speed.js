/* One persisted reading speed for all P1 readers and recorded songs. */
(() => {
'use strict';
const choices=[['0.65','ช้า'],['0.85','ช้าพอดี'],['1','ปกติ'],['1.2','เร็ว'],['1.45','เร็วมาก']],key='p1-reading-speed';
let rate=.85;try{const saved=localStorage.getItem(key);if(choices.some(([v])=>v===saved))rate=Number(saved)}catch{}
window.P1ReadingSpeed={get:()=>rate};
function media(){document.querySelectorAll('audio').forEach(a=>{a.defaultPlaybackRate=rate;a.playbackRate=rate;a.preservesPitch=true})}
function init(){
 let select=document.querySelector('#speed');
 if(!select){const label=document.createElement('label');label.className='p1-speed-control';label.textContent='ความเร็วอ่าน ';select=document.createElement('select');select.id='p1ReadingSpeed';label.append(select);(document.querySelector('main')||document.body).prepend(label)}
 select.setAttribute('aria-label','ความเร็วอ่าน');select.replaceChildren();for(const [value,text] of choices){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)}select.value=String(rate);
 function update(value){if(!choices.some(([v])=>v===value))return;rate=Number(value);select.value=value;media();document.dispatchEvent(new CustomEvent('p1-reading-speed-change',{detail:rate}))}
 select.addEventListener('change',()=>{update(select.value);try{localStorage.setItem(key,select.value)}catch{}});
 window.addEventListener('storage',e=>{if(e.key===key)update(e.newValue)});
 media();new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('audio')||n.querySelector('audio')))))media()}).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
