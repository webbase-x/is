(() => {
'use strict';
const $=s=>document.querySelector(s),th=n=>String(n).replace(/\d/g,d=>'๐๑๒๓๔๕๖๗๘๙'[d]),ns='http://www.w3.org/2000/svg';
const unit=Math.min(12,Math.max(1,Number(new URLSearchParams(location.search).get('unit'))||1));
let chapter,index=0,scope=P1Course.context().key,stroke=null,draw=true,color='#c72f4f',saveTimer,loaded=false;
function state(){return P1Course.read(unit).worksheets||{}}
function row(){return state()[index]||{ink:[],text:'',confirmed:false,done:false}}
function save(r){const data=P1Course.read(unit);data.worksheets=data.worksheets||{};data.worksheets[index]=r;if(index&&!r.done)data.workbook=false;return P1Course.write(unit,data)}
function progress(){const rows=state(),done=chapter.pages.filter((_,i)=>rows[i+1]?.done).length;$('#progress').textContent=`⭐ ทำแล้ว ${th(done)} / ${th(chapter.pages.length)} กิจกรรม`;$('#owner').textContent=P1Course.context().label+' · คำตอบและความคืบหน้าเก็บในเครื่องนี้ · ดาวแสดงการทำครบ ส่วนความถูกต้องให้ครูตรวจ';return done}
function paint(){const svg=$('#ink');if(!svg)return;svg.replaceChildren();for(const s of [...row().ink,...(stroke?[stroke]:[])]){const p=document.createElementNS(ns,'path');p.setAttribute('d',s.points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' '));p.setAttribute('stroke',s.color);p.setAttribute('stroke-width','3');svg.append(p)}}
function flush(){clearTimeout(saveTimer);const input=$('#answer');if(input){const r=row();if(r.text!==input.value){r.text=input.value;r.done=false;save(r);$('#next').disabled=true;progress()}}}
function isUnit1MatchPage(){return unit===1&&index===1}
const matchItems=[
 {word:'ตา',image:'../img/ตา.png',alt:'ภาพตาของช้าง'},
 {word:'หู',image:'../img/หู.png',alt:'ภาพหูของช้าง'},
 {word:'งวง',image:'../img/งวง.png',alt:'ภาพงวงของช้าง'},
 {word:'ขา',image:'../img/ขา.png',alt:'ภาพขาของช้าง'}
];
function renderUnit1Match(){
 loaded=true;stroke=null;
 const r=row();
 if(r.matchVersion!==3){r.matchPlacements={};r.done=false;r.confirmed=false;r.matchVersion=3;save(r)}
 const placements=r.matchPlacements||{};
 $('#next').disabled=!r.done;
 $('#content').innerHTML=`
 <section class="match-activity elephant-body-match" aria-labelledby="matchTitle">
   <div class="match-heading">
     <span class="match-kicker">กิจกรรมที่ ๑ · รู้จักอวัยวะของช้าง</span>
     <h2 id="matchTitle">ลากคำไปวางในกรอบที่ชี้ไปยังอวัยวะของช้าง</h2>
     <p>ลากคำ <strong>ตา หู งวง ขา</strong> ไปวางในกรอบคำพูด โดยดูเส้นชี้ไปยังอวัยวะที่ถูกต้องของช้างใบบัว</p>
   </div>
   <div class="match-word-bank" id="matchWordBank" aria-label="คำสำหรับลาก">
     ${matchItems.map(x=>`<button type="button" class="match-word" data-word="${x.word}" aria-label="ลากคำ ${x.word}">${x.word}</button>`).join('')}
   </div>
   <div class="elephant-body-board callout-board" aria-label="ภาพช้างสำหรับจับคู่อวัยวะ">
     <div class="elephant-crop">
       <img src="../img/ใบบัว.png" alt="ช้างใบบัวสีจากบทเรียนภาษาพาที" class="elephant-body-image" loading="eager">
       <svg class="callout-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
         <defs>
           <marker id="calloutArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
             <path d="M0,0 L7,3.5 L0,7 Z"></path>
           </marker>
         </defs>
         <line class="callout-line eye-line" x1="24" y1="16" x2="17" y2="36" marker-end="url(#calloutArrow)"></line>
         <line class="callout-line ear-line" x1="58" y1="17" x2="31" y2="41" marker-end="url(#calloutArrow)"></line>
         <line class="callout-line trunk-line" x1="18" y1="72" x2="14" y2="61" marker-end="url(#calloutArrow)"></line>
         <line class="callout-line leg-line" x1="84" y1="84" x2="78" y2="77" marker-end="url(#calloutArrow)"></line>
         <circle class="callout-dot" cx="17" cy="36" r="1.2"></circle>
         <circle class="callout-dot" cx="31" cy="41" r="1.2"></circle>
         <circle class="callout-dot" cx="14" cy="61" r="1.2"></circle>
         <circle class="callout-dot" cx="78" cy="77" r="1.2"></circle>
       </svg>
       <div class="match-slot body-slot callout-bubble slot-eye" data-answer="ตา" role="button" tabindex="0" aria-label="กรอบคำชี้ไปยังตาของช้าง"><span class="match-placeholder">วางคำ</span></div>
       <div class="match-slot body-slot callout-bubble slot-ear" data-answer="หู" role="button" tabindex="0" aria-label="กรอบคำชี้ไปยังหูของช้าง"><span class="match-placeholder">วางคำ</span></div>
       <div class="match-slot body-slot callout-bubble slot-trunk" data-answer="งวง" role="button" tabindex="0" aria-label="กรอบคำชี้ไปยังงวงของช้าง"><span class="match-placeholder">วางคำ</span></div>
       <div class="match-slot body-slot callout-bubble slot-leg" data-answer="ขา" role="button" tabindex="0" aria-label="กรอบคำชี้ไปยังขาของช้าง"><span class="match-placeholder">วางคำ</span></div>
     </div>
   </div>
   <div class="match-actions">
     <button type="button" id="resetMatch">↻ เริ่มใหม่</button>
     <button type="button" class="primary" id="checkMatch">✓ ตรวจคำตอบ</button>
   </div>
   <p class="match-status" id="matchStatus" role="status" aria-live="polite">${r.done?'⭐ ทำถูกครบแล้ว เก่งมาก!':'ลากคำไปวางในกรอบคำพูดให้ครบทั้ง ๔ จุด แล้วกดตรวจคำตอบ'}</p>
 </section>
 <p class="note center-note">ใช้ภาพช้างสีจากภาษาพาที และรองรับการลากด้วยนิ้วบน iPhone/iPad</p>`;

 const bank=$('#matchWordBank'),slots=[...document.querySelectorAll('.match-slot')],wordButtons=[...document.querySelectorAll('.match-word')];
 function placeholder(slot){if(!slot.querySelector('.match-word'))slot.innerHTML='<span class="match-placeholder">วางคำ</span>'}
 function collect(){const out={};for(const slot of slots){const w=slot.querySelector('.match-word');if(w)out[slot.dataset.answer]=w.dataset.word}return out}
 function changed(){
  const rr=row();rr.matchPlacements=collect();rr.done=false;rr.confirmed=false;save(rr);$('#next').disabled=true;progress();
  slots.forEach(s=>s.classList.remove('correct','wrong'));$('#matchStatus').textContent='จัดคำใหม่แล้ว กดตรวจคำตอบเมื่อพร้อม';
 }
 function place(word,slot,markChanged=true){
  if(!word||!slot)return;
  const oldSlot=word.closest('.match-slot');
  const occupant=slot.querySelector('.match-word');
  if(occupant&&occupant!==word)bank.append(occupant);
  slot.replaceChildren(word);
  if(oldSlot&&oldSlot!==slot)placeholder(oldSlot);
  if(markChanged)changed();
 }
 for(const slot of slots){
  const saved=placements[slot.dataset.answer],word=wordButtons.find(w=>w.dataset.word===saved);
  if(word)place(word,slot,false);
 }
 slots.forEach(placeholder);
 if(r.done)slots.forEach(s=>s.classList.add('correct'));

 let selected=null,drag=null;
 function selectWord(word){
  wordButtons.forEach(w=>w.classList.remove('selected'));selected=word||null;
  if(selected){selected.classList.add('selected');$('#matchStatus').textContent='เลือกคำ “'+selected.dataset.word+'” แล้ว แตะช่องภาพที่ต้องการ หรือจะลากไปวางก็ได้'}
 }
 function finishDrag(e){
  if(!drag||e.pointerId!==drag.id)return;
  const target=document.elementFromPoint(e.clientX,e.clientY),slot=target?.closest?.('.match-slot');
  drag.ghost.remove();drag.word.classList.remove('drag-source');
  const moved=drag.moved,word=drag.word;drag=null;
  if(slot)place(word,slot,true);
  if(moved){word.dataset.skipClick='1';setTimeout(()=>delete word.dataset.skipClick,0)}
 }
 for(const word of wordButtons){
  word.addEventListener('click',()=>{if(word.dataset.skipClick)return;selectWord(selected===word?null:word)});
  word.addEventListener('pointerdown',e=>{
   if(e.isPrimary===false||e.button>0)return;
   e.preventDefault();selectWord(word);
   const ghost=word.cloneNode(true);ghost.className='match-drag-ghost';document.body.append(ghost);
   ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';word.classList.add('drag-source');
   drag={id:e.pointerId,word,ghost,startX:e.clientX,startY:e.clientY,moved:false};
   try{word.setPointerCapture(e.pointerId)}catch{}
  });
  word.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.id)return;
   const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>7)drag.moved=true;
   drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
   const target=document.elementFromPoint(e.clientX,e.clientY),slot=target?.closest?.('.match-slot');
   slots.forEach(s=>s.classList.toggle('over',s===slot));
  });
  word.addEventListener('pointerup',e=>{slots.forEach(s=>s.classList.remove('over'));finishDrag(e)});
  word.addEventListener('pointercancel',e=>{slots.forEach(s=>s.classList.remove('over'));if(drag&&e.pointerId===drag.id){drag.ghost.remove();drag.word.classList.remove('drag-source');drag=null}});
 }
 for(const slot of slots){
  const useSelected=()=>{if(selected){place(selected,slot,true);selectWord(null)}};
  slot.addEventListener('click',e=>{if(!e.target.closest('.match-word'))useSelected()});
  slot.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&selected){e.preventDefault();useSelected()}});
 }
 $('#resetMatch').onclick=()=>{
  wordButtons.forEach(w=>bank.append(w));slots.forEach(s=>{s.classList.remove('correct','wrong','over');placeholder(s)});
  selectWord(null);const rr=row();rr.matchPlacements={};rr.done=false;rr.confirmed=false;save(rr);$('#next').disabled=true;progress();$('#matchStatus').textContent='เริ่มใหม่แล้ว ลากคำไปจับคู่กับภาพอีกครั้งนะ';
 };
 $('#checkMatch').onclick=()=>{
  let correct=0;
  for(const slot of slots){
   const w=slot.querySelector('.match-word'),ok=w?.dataset.word===slot.dataset.answer;
   slot.classList.toggle('correct',ok);slot.classList.toggle('wrong',!ok);if(ok)correct++;
  }
  const rr=row();rr.matchPlacements=collect();
  if(correct===slots.length){
   rr.done=true;rr.confirmed=true;save(rr);progress();$('#next').disabled=false;$('#matchStatus').textContent='⭐ ถูกต้องครบทั้ง ๔ คำ เก่งมาก! ไปกิจกรรมถัดไปได้เลย';
   if(progress()===chapter.pages.length)P1Course.mark(unit,'workbook');
  }else{
   rr.done=false;rr.confirmed=false;save(rr);progress();$('#next').disabled=true;$('#matchStatus').textContent='ถูก '+th(correct)+' จาก '+th(slots.length)+' คำ ลองดูช่องสีแดงแล้วแก้ใหม่อีกครั้งนะ';
  }
 };
}
function render(){
 loaded=false;stroke=null;$('#status').textContent='';$('#title').textContent=`แบบฝึกบทที่ ${th(unit)} · ${chapter.title}`;document.title=$('#title').textContent;
 const done=progress();$('#counter').textContent=index?`${th(index)} / ${th(chapter.pages.length)}`:'หน้าปก';$('#prev').disabled=index===0;
 $('#next').disabled=index>0&&!row().done;$('#next').textContent=index===0?'เริ่มกิจกรรม →':index===chapter.pages.length?'ไปทบทวนและเกม →':'กิจกรรมถัดไป ›';
 $('#pageList').replaceChildren();for(let i=0;i<=chapter.pages.length;i++){const b=document.createElement('button');b.textContent=i?th(i):'ปก';if(state()[i]?.done)b.className='completed';b.onclick=()=>{flush();index=i;$('#menu').close();render()};$('#pageList').append(b)}
 if(!index){$('#content').innerHTML=`<section class="cover"><span class="cover-kicker">แบบฝึกทักษะภาษาไทย ป.๑</span><div class="cover-book"><img src="assets/volume-${chapter.volume}.webp" alt="ปกแบบฝึกทักษะภาษาไทย ป.๑ เล่ม ${th(chapter.volume)}"></div><h2>บทที่ ${th(unit)} · ${chapter.title}</h2><p class="cover-meta">เล่ม ${th(chapter.volume)} · ${th(chapter.pages.length)} กิจกรรม</p><div class="cover-steps"><span>✎ เขียน</span><span>◯ วงกลม</span><span>⌁ โยงเส้น</span><span>⌨ พิมพ์ตอบ</span></div><p class="cover-help">อ่านคำสั่งจากหน้าหนังสือ แล้วทำทีละกิจกรรม<br>ทำครบกดรับดาว ⭐ ก่อนเปิดหน้าถัดไป</p>${done===chapter.pages.length?'<p class="reward">🏅</p><p class="complete-copy">ทำแบบฝึกบทนี้ครบแล้ว เก่งมาก!</p>':''}</section><p class="note center-note">แบบฝึกทุกหน้ามาจากต้นฉบับ และบันทึกงานของเด็กไว้ในเครื่องนี้</p>`;return}
 if(isUnit1MatchPage()){renderUnit1Match();return}
 const p=chapter.pages[index-1],r=row();
 $('#content').innerHTML=`<h2>ภารกิจที่ ${th(index)}</h2><p>อ่านคำสั่งบนหน้าแบบฝึก แล้วลงมือทำ</p><div class="tools"><button id="drawMode" aria-pressed="${draw}">${draw?'✎ กำลังเขียน':'↕ เลื่อนดูหน้า'}</button><label>สี <input id="color" type="color" value="${color}"></label><button id="undo">↶ ย้อนกลับ</button><button id="clear">ล้างเส้นหน้านี้</button></div><div class="sheet ${p.rotation===180?'rotated':''}"><img id="sourceImage" src="${p.image}" alt="แบบฝึกบท ${th(unit)} กิจกรรม ${th(index)}"><svg id="ink" aria-label="เขียนคำตอบบนแบบฝึก" class="${draw?'':'pan'}" data-swipe-ignore></svg></div><p class="note">แบบฝึกเล่ม ${th(chapter.volume)} · หน้า PDF ${th(p.pdfPage)} · แตะ “เลื่อนดูหน้า” เพื่อเลื่อนบนภาพ</p><label class="response">พิมพ์คำตอบหรือบันทึกกิจกรรมเพิ่มเติม<textarea id="answer" maxlength="6000" placeholder="ใช้แทนการเขียนบนภาพได้"></textarea></label><label class="confirm"><input type="checkbox" id="confirmed">ฉันทำตามคำสั่งครบหน้านี้แล้ว (กิจกรรมพูด อ่าน หรือทำในสมุด ให้ครูหรือผู้ปกครองช่วยยืนยัน)</label><button class="primary" id="submit">${r.done?'✓ ทำหน้านี้แล้ว':'ทำครบแล้ว · รับดาว ☆'}</button>`;
 $('#answer').value=r.text;$('#confirmed').checked=r.confirmed;
 const img=$('#sourceImage'),svg=$('#ink');function ready(){if(!img.naturalWidth)return;loaded=true;svg.setAttribute('viewBox',`0 0 720 ${720*img.naturalHeight/img.naturalWidth}`);paint()};img.onload=ready;img.onerror=()=>{loaded=false;$('#status').textContent='โหลดหน้าแบบฝึกไม่สำเร็จ กรุณาโหลดใหม่ก่อนทำกิจกรรม';$('#submit').disabled=true};if(img.complete)ready();
 $('#drawMode').onclick=()=>{draw=!draw;svg.classList.toggle('pan',!draw);$('#drawMode').setAttribute('aria-pressed',String(draw));$('#drawMode').textContent=draw?'✎ กำลังเขียน':'↕ เลื่อนดูหน้า'};$('#color').oninput=e=>color=e.target.value;
 function update(r){r.done=false;save(r);$('#next').disabled=true;$('#submit').textContent='ทำครบแล้ว · รับดาว ☆';progress();paint()}
 $('#answer').oninput=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const r=row();r.text=$('#answer').value;update(r)},180)};
 $('#confirmed').onchange=()=>{const r=row();r.confirmed=$('#confirmed').checked;update(r)};
 $('#undo').onclick=()=>{const r=row();r.ink.pop();update(r)};$('#clear').onclick=()=>{const r=row();r.ink=[];update(r)};
 function point(e){const b=svg.getBoundingClientRect(),h=720*img.naturalHeight/img.naturalWidth;let x=Math.max(0,Math.min(720,(e.clientX-b.left)*720/b.width)),y=Math.max(0,Math.min(h,(e.clientY-b.top)*720/b.width));if(p.rotation===180){x=720-x;y=h-y}return [Math.round(x*10)/10,Math.round(y*10)/10]}
 svg.onpointerdown=e=>{if(!loaded||!draw||e.isPrimary===false||e.button>0)return;e.preventDefault();svg.setPointerCapture(e.pointerId);stroke={color,points:[point(e)],id:e.pointerId}};
 svg.onpointermove=e=>{if(!stroke||stroke.id!==e.pointerId)return;if(stroke.points.length<3000)stroke.points.push(point(e));paint()};
 function end(e){if(!stroke||stroke.id!==e.pointerId)return;stroke.points.push(point(e));const r=row();r.ink.push({color:stroke.color,points:stroke.points});stroke=null;update(r)}svg.onpointerup=end;svg.onpointercancel=()=>{stroke=null;paint()};
 let swipe=null;const sheet=$('.sheet');sheet.onpointerdown=e=>{if(draw||e.target===svg)return;swipe={x:e.clientX,y:e.clientY,t:Date.now()}};sheet.onpointerup=e=>{if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y,dt=Date.now()-swipe.t;swipe=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5&&dt<1300){dx<0?$('#next').click():$('#prev').click()}};
 $('#submit').onclick=()=>{flush();if(!loaded){$('#status').textContent='รอภาพแบบฝึกโหลดครบก่อนนะ';return}const r=row();if(!r.confirmed){$('#status').textContent='ทำตามคำสั่งให้ครบ แล้วติ๊กยืนยันก่อนรับดาวนะ';return}r.done=true;if(!save(r))return;const done=progress();$('#submit').textContent='✓ ทำหน้านี้แล้ว';$('#status').textContent='⭐ รับดาวการทำกิจกรรมแล้ว · คำตอบรอครูตรวจ';$('#next').disabled=false;if(done===chapter.pages.length)P1Course.mark(unit,'workbook')};
}
$('#prev').onclick=()=>{flush();if(index>0){index--;render();scrollTo(0,0)}};
$('#next').onclick=()=>{flush();if(index&& !row().done)return;if(index<chapter.pages.length){index++;render();scrollTo(0,0)}else{if(progress()!==chapter.pages.length){index=chapter.pages.findIndex((_,i)=>!state()[i+1]?.done)+1;render();$('#status').textContent='ทำหน้านี้ให้ครบก่อน แล้วไปทบทวนกัน';return}if(P1Course.mark(unit,'workbook'))location.href=P1Course.route(unit,'review')}};
$('#openMenu').onclick=()=>{flush();$('#menu').showModal()};$('#closeMenu').onclick=()=>$('#menu').close();
function switchContext(){const next=P1Course.context().key;if(next!==scope){clearTimeout(saveTimer);scope=next;stroke=null;index=0;if(chapter)render()}else if(chapter)progress()}
for(const event of ['p1-classroom-ready','p1-trace-context'])document.addEventListener(event,switchContext);
document.addEventListener('p1-course-storage-error',()=>$('#status').textContent='ยังบันทึกในเครื่องไม่ได้ พื้นที่อาจเต็ม กรุณาเก็บคำตอบก่อนปิดหน้า');window.addEventListener('pagehide',flush);
fetch('book.json?v=1').then(r=>{if(!r.ok)throw Error();return r.json()}).then(b=>{chapter=b.chapters.find(c=>c.unit===unit);$('#reading').href=P1Course.route(unit,'reading');$('#literature').hidden=unit<4||unit>11;$('#literature').href=P1Course.route(unit,'literature');render()}).catch(()=>$('#status').textContent='เปิดแบบฝึกไม่สำเร็จ กรุณาลองโหลดใหม่');
})();
