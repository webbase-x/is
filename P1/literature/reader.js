(() => {
'use strict';
const $=s=>document.querySelector(s),ns='http://www.w3.org/2000/svg',th=n=>String(n).replace(/\d/g,d=>'๐๑๒๓๔๕๖๗๘๙'[d]);
let book,chapter,index=0,plain=false,readId=0,reading=false,timer,renderId=0,words=[];
const fonts=new Set();
function el(tag,attrs={},text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e}
function stop(){readId++;reading=false;clearTimeout(timer);window.speechSynthesis?.cancel();document.querySelectorAll('.speaking').forEach(e=>e.classList.remove('speaking'));$('#read').textContent='🔊';$('#read').setAttribute('aria-label','ฟังหน้านี้')}
function speak(items){
 stop();$('#status').textContent='';if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){$('#status').textContent='เครื่องนี้ยังไม่มีเสียงอ่านภาษาไทย';return}
 const id=readId;reading=true;$('#read').textContent='■';$('#read').setAttribute('aria-label','หยุดอ่าน');
 function next(n){
  if(id!==readId)return;if(n>=items.length){stop();return}
  const item=items[n],u=new SpeechSynthesisUtterance(item.text.replaceAll('สระ','สะระ'));
  u.lang='th-TH';u.rate=Number($('#speed').value);const voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('th'));if(voice)u.voice=voice;
  item.node?.classList.add('speaking');u.onend=()=>{if(id!==readId)return;item.node?.classList.remove('speaking');timer=setTimeout(()=>next(n+1),item.lineEnd?300:120)};
  u.onerror=()=>{if(id!==readId)return;stop();$('#status').textContent='เสียงอ่านยังไม่พร้อม ลองแตะฟังอีกครั้ง'};speechSynthesis.speak(u);
 }next(0);
}
function readable(w){return /[ก-๛A-Za-z0-9]/.test(w.text)}
async function render(){
 stop();const ticket=++renderId,isCover=index<2,source=chapter.pages[index];
 const top=chapter.id===7?49:52;
 const p=isCover?{...chapter.pages[0],width:1052,height:739,lines:chapter.pages.slice(0,2).flatMap((pg,i)=>pg.lines.map(l=>({...l,words:l.words.map(w=>({...w,box:w.box.map((v,k)=>v+(k%2===0?526*i-34:-top)),highlightBox:(w.highlightBox||w.box).map((v,k)=>v+(k%2===0?526*i-34:-top)),chars:w.chars.map(c=>[c[0],c[1]+526*i-34,c[2]-top,...c.slice(3)])}))})))}:source;words=[];
 $('#paper').classList.toggle('cover-spread',isCover);
 const url=new URL(location.href);url.searchParams.set('chapter',chapter.id);url.searchParams.set('page',index+1);history.replaceState(null,'',url);
 $('#chapterTitle').textContent=`บทที่ ${th(chapter.id)} · ${chapter.title}`;document.title=chapter.title+' · วรรณคดีลำนำ ป.๑';
 $('#paired').textContent=`ภาษาพาที ${th(chapter.pairedUnit)} · ${chapter.pairedTitle}`;$('#paired').href=`../lesson.html?unit=${chapter.pairedUnit}&start=1`;
 $('#counter').textContent=`${th(isCover?1:index)} / ${th(chapter.pages.length-1)}`;$('#prev').disabled=index===0;$('#next').disabled=false;
 $('#next').textContent=index===chapter.pages.length-1?'»':'›';$('#next').setAttribute('aria-label',index===chapter.pages.length-1?'ไปแบบฝึกบทนี้':'หน้าถัดไป');
 $('#source').textContent=`วรรณคดีลำนำ · ${p.printedPage?`หน้าหนังสือ ${th(p.printedPage)}`:'หน้าปกบทที่ '+th(chapter.id)} · คู่บทตามแบบฝึกเล่ม ${th(chapter.workbook)}`;
 $('#pageContent').replaceChildren();$('#status').textContent=plain?'':'กำลังเปิดหน้า…';$('#read').disabled=!plain;
 $('#pages').replaceChildren();chapter.pages.forEach((pg,i)=>{if(i===1)return;const b=document.createElement('button');b.textContent=i===0?'หน้าบท':`หน้า ${th(i)}${pg.printedPage?' · หนังสือ '+th(pg.printedPage):''}`;b.setAttribute('aria-current',index===i?'page':'false');b.onclick=()=>{$('#menu').close();go(i)};$('#pages').append(b)});
 document.querySelectorAll('[data-chapter]').forEach(b=>b.setAttribute('aria-current',+b.dataset.chapter===chapter.id?'page':'false'));
 if(plain){
  const wrap=document.createElement('div');wrap.className='plain';
  for(const line of p.lines.filter(l=>l.read)){const para=document.createElement('p');for(const w of line.words.filter(readable)){const b=document.createElement('button');b.textContent=w.text;const item={text:w.text,node:b};b.onclick=()=>speak([item]);words.push(item);para.append(b)}if(para.childElementCount){words[words.length-1].lineEnd=true;wrap.append(para)}}
  if(!words.length){const img=document.createElement('img');img.src=isCover?`assets/cover-${chapter.id}.webp?v=2`:`assets/page-${p.pdfPage}.webp`;img.className='plain-cover';img.alt='ภาพประกอบ '+chapter.title;wrap.append(img);const title=document.createElement('h2');title.textContent=chapter.title;wrap.append(title)}
  $('#pageContent').append(wrap);return;
 }
 const svg=el('svg',{viewBox:`0 0 ${p.width||595} ${p.height||842}`,class:'source-page','aria-label':chapter.title+' หน้าที่ '+(index+1)});svg.style.visibility='hidden';
 for(const [i,pg] of (isCover?chapter.pages.slice(0,2):[p]).entries()){
  const attrs={href:`assets/page-${pg.pdfPage}.webp`,x:isCover?526*i-34:0,y:isCover?-top:0,width:595,height:842,'aria-hidden':'true'};
  if(isCover){const clip=el('clipPath',{id:`coverClip${i}`});clip.append(el('rect',{x:526*i,y:0,width:526,height:739}));svg.append(clip);attrs['clip-path']=`url(#coverClip${i})`}
  svg.append(el('image',attrs));
 }
 const needed=new Map();
 for(const line of p.lines){
  for(const w of line.words){
   const interactive=line.read&&readable(w),group=el('g',interactive?{class:'word',role:'button',tabindex:0,'aria-label':'ฟัง '+w.text}:{'aria-hidden':'true'});
   if(interactive){const [x,y,x2,y2]=w.highlightBox||w.box;group.append(el('rect',{x:x,y:y,width:Math.max(2,x2-x),height:Math.max(2,y2-y)}));const item={text:w.text,node:group};group.addEventListener('click',()=>speak([item]));group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();speak([item])}});words.push(item)}
   for(const [raw,x,y,f,size,color] of w.chars){
    needed.set(f,(needed.get(f)||'')+raw);
    group.append(el('text',{x,y,'font-family':f,'font-size':size,fill:color,'aria-hidden':'true'},raw));
   }
   svg.append(group);
  }
  if(line.read&&words.length)words[words.length-1].lineEnd=true;
 }
 $('#pageContent').append(svg);
 try{
  if(!document.fonts||!window.FontFace)throw Error('font');
  await Promise.all([...needed].map(async([name])=>{if(fonts.has(name))return;const face=new FontFace(name,`url(fonts/${name}.otf)`);await face.load();document.fonts.add(face);fonts.add(name)}));
  const check=new Image();check.src=`assets/page-${p.pdfPage}.webp`;await check.decode();if(isCover){const right=new Image();right.src=`assets/page-${chapter.pages[1].pdfPage}.webp`;await right.decode()}
  if(ticket!==renderId)return;svg.style.visibility='visible';$('#read').disabled=false;$('#status').textContent=words.length?'แตะคำเพื่อฟัง หรือกดลำโพงอ่านทั้งหน้า':'ภาพประกอบ · ปัดซ้ายเพื่ออ่านต่อ';
 }catch{if(ticket!==renderId)return;plain=true;$('#viewMode').setAttribute('aria-pressed','true');await render();$('#status').textContent='เปิดข้อความใหญ่ให้แล้ว เนื่องจากโหลดภาพหรือแบบอักษรไม่สำเร็จ'}
}
function go(n){if(n<0||n>=chapter.pages.length)return;index=n===1?0:n;render();window.scrollTo({top:0,behavior:'instant'})}
function pageSequence(){
 if(chapter.pages[index].pdfPage!==13)return words;
 const start=words.findIndex(w=>w.text==='ปู่'),center=words.filter(w=>w.text==='ฉัน'||w.text==='รัก');
 if(start<0||center.length!==2)return words;
 const sequence=words.slice(0,start);for(const name of ['ปู่','ย่า','ตา','ยาย','พ่อ','แม่','ครู','ลุง','ป้า','น้า','อา','พี่','น้อง','เพื่อน']){const item=words.find(w=>w.text===name);if(item)sequence.push(...center,item)}return sequence;
}
$('#read').onclick=()=>{if(reading){stop();return}speak(words.length?pageSequence():[{text:chapter.title}])};$('#speed').onchange=stop;
$('#prev').onclick=()=>go(index===2?0:index-1);$('#next').onclick=()=>{if(index<chapter.pages.length-1)go(index===0?2:index+1);else{stop();P1Course.mark(chapter.pairedUnit,'literature');location.href=P1Course.route(chapter.pairedUnit,'workbook')}};
$('#viewMode').onclick=()=>{plain=!plain;$('#viewMode').setAttribute('aria-pressed',String(plain));render()};
$('#openMenu').onclick=()=>{stop();$('#menu').showModal()};$('#closeMenu').onclick=()=>$('#menu').close();
let swipe,suppress=0;$('#paper').addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button>0||e.target.closest('[data-swipe-ignore]'))return;swipe={x:e.clientX,y:e.clientY,id:e.pointerId,t:Date.now()}});
$('#paper').addEventListener('pointerup',e=>{if(!swipe||swipe.id!==e.pointerId)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y,dt=Date.now()-swipe.t;swipe=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5&&dt<1300){suppress=Date.now()+400;dx<0?$('#next').click():$('#prev').click()}});
$('#paper').addEventListener('pointercancel',()=>swipe=null);$('#paper').addEventListener('click',e=>{if(Date.now()<suppress){e.preventDefault();e.stopImmediatePropagation()}},true);
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.target.closest('button,select,a,[role=button]'))return;if(e.key==='ArrowRight')$('#next').click();if(e.key==='ArrowLeft')$('#prev').click()});
fetch('book.json?v=1').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
 book=data;const q=new URLSearchParams(location.search);chapter=book.chapters.find(c=>c.id===Number(q.get('chapter')))||book.chapters[0];index=Math.max(0,Math.min(chapter.pages.length-1,(Number(q.get('page'))||1)-1));
 if(index===1)index=0;
 for(const c of book.chapters){const b=document.createElement('button');b.dataset.chapter=c.id;b.textContent=`${th(c.id)} · ${c.title}`;b.onclick=()=>{chapter=c;$('#menu').close();go(0)};$('#chapters').append(b)}render();
}).catch(()=>{$('#status').textContent='เปิดหนังสือไม่สำเร็จ กรุณาลองโหลดหน้าใหม่';$('#read').disabled=true;$('#prev').disabled=true;$('#next').disabled=true});
})();
