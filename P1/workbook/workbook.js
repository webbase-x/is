(() => {
'use strict';
const $=s=>document.querySelector(s),th=n=>String(n).replace(/\d/g,d=>'๐๑๒๓๔๕๖๗๘๙'[d]),ns='http://www.w3.org/2000/svg';
const unit=Math.min(12,Math.max(1,Number(new URLSearchParams(location.search).get('unit'))||1));
let chapter,index=0,scope=P1Course.context().key,stroke=null,draw=true,color='#c72f4f',saveTimer,choiceAdvanceTimer,loaded=false;
function state(){return P1Course.read(unit).worksheets||{}}
function row(){return state()[index]||{ink:[],text:'',confirmed:false,done:false}}
function save(r){const data=P1Course.read(unit);data.worksheets=data.worksheets||{};data.worksheets[index]=r;if(index&&!r.done)data.workbook=false;return P1Course.write(unit,data)}
const WORKBOOK_GAMIFIED_VERSION=1;
function migrateGamifiedRows(){
 const data=P1Course.read(unit);data.worksheets=data.worksheets||{};let changed=false;
 chapter.pages.forEach((p,i)=>{
  const key=i+1,r=data.worksheets[key]||{};
  if(r.gamifiedVersion!==WORKBOOK_GAMIFIED_VERSION){
   r.gamifiedVersion=WORKBOOK_GAMIFIED_VERSION;r.done=false;r.confirmed=false;
   data.worksheets[key]=r;changed=true
  }
 });
 if(changed){data.workbook=false;P1Course.write(unit,data)}
}
function progress(){const rows=state(),done=chapter.pages.filter((_,i)=>rows[i+1]?.done).length;$('#progress').textContent=`⭐ ${th(done)} / ${th(chapter.pages.length)}`;$('#progress').setAttribute('aria-label',`ผ่านแล้ว ${done} จาก ${chapter.pages.length} ภารกิจ`);$('#owner').textContent='';return done}
function paint(){const svg=$('#ink');if(!svg)return;svg.replaceChildren();for(const s of [...row().ink,...(stroke?[stroke]:[])]){const p=document.createElementNS(ns,'path');p.setAttribute('d',s.points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' '));p.setAttribute('stroke',s.color);p.setAttribute('stroke-width','3');svg.append(p)}}
function flush(){clearTimeout(saveTimer);const input=$('#answer');if(input){const r=row();if(r.text!==input.value){r.text=input.value;r.done=false;save(r);$('#next').disabled=true;progress()}}}
function isUnit1MatchPage(){return unit===1&&index===1}
function isUnit1BuildWordPage(){return unit===1&&index===2}
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
     <span class="match-kicker">ข้อ ๑</span>
     <h2 id="matchTitle">ลากคำให้ตรงกับอวัยวะของช้าง</h2>
     <p>ลาก <strong>ตา หู งวง ขา</strong> ไปยังกรอบที่ลูกศรชี้</p>
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
         <line class="callout-line leg-line" x1="84" y1="84" x2="76" y2="62" marker-end="url(#calloutArrow)"></line>
         <circle class="callout-dot" cx="17" cy="36" r="1.2"></circle>
         <circle class="callout-dot" cx="31" cy="41" r="1.2"></circle>
         <circle class="callout-dot" cx="14" cy="61" r="1.2"></circle>
         <circle class="callout-dot" cx="76" cy="62" r="1.2"></circle>
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
 </section>`;

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

function renderUnit1BuildWord(){
 loaded=true;stroke=null;
 const r=row();
 if(r.buildWordVersion!==2){r.buildWordPlacements={};r.done=false;r.confirmed=false;r.buildWordVersion=2;save(r)}
 const placements=r.buildWordPlacements||{};
 $('#next').disabled=!r.done;

 const items=[
  {key:'eye',word:'ตา',chars:['ต','า'],label:'ตา'},
  {key:'ear',word:'หู',chars:['ห','ู'],label:'หู'},
  {key:'trunk',word:'งวง',chars:['ง','ว','ง'],label:'งวง'},
  {key:'leg',word:'ขา',chars:['ข','า'],label:'ขา'}
 ];
 const tiles=[
  {id:'t1',char:'ต'},{id:'aa1',char:'า'},{id:'h1',char:'ห'},{id:'uu1',char:'ู'},
  {id:'ng1',char:'ง'},{id:'w1',char:'ว'},{id:'ng2',char:'ง'},{id:'kh1',char:'ข'},{id:'aa2',char:'า'},
  {id:'d-k',char:'ก',distractor:true},{id:'d-n',char:'น',distractor:true},{id:'d-m',char:'ม',distractor:true},
  {id:'d-i',char:'ิ',distractor:true},{id:'d-e',char:'เ',distractor:true},{id:'d-o',char:'โ',distractor:true}
 ];
 const showChar=ch=>ch==='ู'?'◌ู':ch==='ิ'?'◌ิ':ch;

 $('#content').innerHTML=`
 <section class="build-word-activity elephant-word-builder" aria-labelledby="buildWordTitle">
   <div class="match-heading">
     <span class="match-kicker">ข้อ ๒</span>
     <h2 id="buildWordTitle">ลากตัวอักษรมาสร้างคำ</h2>
     <p>สร้างคำ <strong>ตา หู งวง ขา</strong> ให้ถูกต้อง มีตัวลวงปะปนอยู่</p>
   </div>

   <div class="letter-bank full-letter-bank" id="letterBank" aria-label="พยัญชนะ สระ และตัวลวงสำหรับลาก">
     ${tiles.map(tile=>`<button type="button" class="letter-chip${tile.distractor?' distractor-tile':''}" data-char="${tile.char}" data-id="${tile.id}" aria-label="ลากตัวอักษร ${showChar(tile.char)}">${showChar(tile.char)}</button>`).join('')}
   </div>

   <div class="elephant-body-board build-elephant-board" aria-label="ช้างใบบัวสำหรับสร้างคำ">
     <div class="elephant-crop build-elephant-crop">
       <img src="../img/ใบบัว.png" alt="ช้างใบบัวสีจากบทเรียนภาษาพาที" class="elephant-body-image" loading="eager">
       <svg class="callout-lines build-callout-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
         <defs>
           <marker id="buildCalloutArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
             <path d="M0,0 L7,3.5 L0,7 Z"></path>
           </marker>
         </defs>
         <line class="callout-line" x1="24" y1="17" x2="17" y2="36" marker-end="url(#buildCalloutArrow)"></line>
         <line class="callout-line" x1="62" y1="17" x2="31" y2="41" marker-end="url(#buildCalloutArrow)"></line>
         <line class="callout-line" x1="19" y1="76" x2="14" y2="61" marker-end="url(#buildCalloutArrow)"></line>
         <line class="callout-line" x1="83" y1="84" x2="76" y2="62" marker-end="url(#buildCalloutArrow)"></line>
         <circle class="callout-dot" cx="17" cy="36" r="1.2"></circle>
         <circle class="callout-dot" cx="31" cy="41" r="1.2"></circle>
         <circle class="callout-dot" cx="14" cy="61" r="1.2"></circle>
         <circle class="callout-dot" cx="76" cy="62" r="1.2"></circle>
       </svg>

       ${items.map(item=>`
         <div class="build-callout build-${item.key}" data-key="${item.key}" data-word="${item.word}" aria-label="กรอบสร้างคำที่ชี้ไปยังอวัยวะของช้าง">
           <div class="build-callout-label">สร้างคำ</div>
           <div class="build-letter-slots">
             ${item.chars.map((ch,i)=>`<div class="letter-slot" data-slot="${item.key}-${i}" data-answer="${ch}" role="button" tabindex="0" aria-label="ช่องที่ ${i+1} ของคำ ${item.label}"><span>?</span></div>`).join('')}
           </div>
           <div class="build-answer-preview" aria-live="polite">${item.chars.map(()=> '＿').join('')}</div>
         </div>`).join('')}
     </div>
   </div>

   <div class="match-actions">
     <button type="button" id="resetBuildWord">↻ เริ่มใหม่</button>
     <button type="button" class="primary" id="checkBuildWord">✓ ตรวจคำตอบ</button>
   </div>
   <p class="match-status" id="buildWordStatus" role="status" aria-live="polite">${r.done?'⭐ ถูกต้องครบทั้ง ๔ คำ เก่งมาก!':'ลากตัวอักษรลงช่องให้ครบทั้ง ๔ คำ แล้วกดตรวจคำตอบ'}</p>
 </section>`;

 const bank=$('#letterBank'),chips=[...document.querySelectorAll('.letter-chip')],slots=[...document.querySelectorAll('.letter-slot')],panels=[...document.querySelectorAll('.build-callout')];
 function slotPlaceholder(slot){if(!slot.querySelector('.letter-chip'))slot.innerHTML='<span>?</span>'}
 function collect(){const out={};for(const slot of slots){const chip=slot.querySelector('.letter-chip');if(chip)out[slot.dataset.slot]=chip.dataset.id}return out}
 function updatePreview(panel){
  const chars=[...panel.querySelectorAll('.letter-slot')].map(slot=>slot.querySelector('.letter-chip')?.dataset.char||'＿');
  panel.querySelector('.build-answer-preview').textContent=chars.join('');
 }
 function changed(){
  const rr=row();rr.buildWordPlacements=collect();rr.done=false;rr.confirmed=false;save(rr);$('#next').disabled=true;progress();
  panels.forEach(panel=>{panel.classList.remove('correct','wrong');updatePreview(panel)});
  $('#buildWordStatus').textContent='จัดตัวอักษรใหม่แล้ว กดตรวจคำตอบเมื่อพร้อม';
 }
 function place(chip,slot,markChanged=true){
  if(!chip||!slot)return;
  const oldSlot=chip.closest('.letter-slot'),occupant=slot.querySelector('.letter-chip');
  if(occupant&&occupant!==chip)bank.append(occupant);
  slot.replaceChildren(chip);
  if(oldSlot&&oldSlot!==slot)slotPlaceholder(oldSlot);
  if(markChanged)changed();
 }
 for(const slot of slots){
  const savedId=placements[slot.dataset.slot],chip=chips.find(x=>x.dataset.id===savedId);
  if(chip)place(chip,slot,false);
 }
 slots.forEach(slotPlaceholder);panels.forEach(updatePreview);
 if(r.done)panels.forEach(panel=>panel.classList.add('correct'));

 let selected=null,drag=null;
 function selectChip(chip){
  chips.forEach(x=>x.classList.remove('selected'));selected=chip||null;
  if(selected){selected.classList.add('selected');$('#buildWordStatus').textContent='เลือก “'+showChar(selected.dataset.char)+'” แล้ว แตะช่องที่ต้องการ หรือจะลากไปวางก็ได้'}
 }
 function finishDrag(e){
  if(!drag||e.pointerId!==drag.id)return;
  const target=document.elementFromPoint(e.clientX,e.clientY),slot=target?.closest?.('.letter-slot');
  drag.ghost.remove();drag.chip.classList.remove('drag-source');
  const moved=drag.moved,chip=drag.chip;drag=null;
  if(slot)place(chip,slot,true);
  if(moved){chip.dataset.skipClick='1';setTimeout(()=>delete chip.dataset.skipClick,0)}
 }
 for(const chip of chips){
  chip.addEventListener('click',()=>{if(chip.dataset.skipClick)return;selectChip(selected===chip?null:chip)});
  chip.addEventListener('pointerdown',e=>{
   if(e.isPrimary===false||e.button>0)return;
   e.preventDefault();selectChip(chip);
   const ghost=chip.cloneNode(true);ghost.className='letter-drag-ghost';document.body.append(ghost);
   ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';chip.classList.add('drag-source');
   drag={id:e.pointerId,chip,ghost,startX:e.clientX,startY:e.clientY,moved:false};
   try{chip.setPointerCapture(e.pointerId)}catch{}
  });
  chip.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.id)return;
   const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>7)drag.moved=true;
   drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
   const target=document.elementFromPoint(e.clientX,e.clientY),slot=target?.closest?.('.letter-slot');
   slots.forEach(s=>s.classList.toggle('over',s===slot));
  });
  chip.addEventListener('pointerup',e=>{slots.forEach(s=>s.classList.remove('over'));finishDrag(e)});
  chip.addEventListener('pointercancel',e=>{slots.forEach(s=>s.classList.remove('over'));if(drag&&e.pointerId===drag.id){drag.ghost.remove();drag.chip.classList.remove('drag-source');drag=null}});
 }
 for(const slot of slots){
  const useSelected=()=>{if(selected){place(selected,slot,true);selectChip(null)}};
  slot.addEventListener('click',e=>{if(!e.target.closest('.letter-chip'))useSelected()});
  slot.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&selected){e.preventDefault();useSelected()}});
 }
 $('#resetBuildWord').onclick=()=>{
  chips.forEach(chip=>bank.append(chip));slots.forEach(slot=>{slot.classList.remove('over');slotPlaceholder(slot)});
  panels.forEach(panel=>{panel.classList.remove('correct','wrong');updatePreview(panel)});selectChip(null);
  const rr=row();rr.buildWordPlacements={};rr.done=false;rr.confirmed=false;save(rr);$('#next').disabled=true;progress();
  $('#buildWordStatus').textContent='เริ่มใหม่แล้ว เลือกพยัญชนะและสระมาสร้างคำอีกครั้งนะ';
 };
 $('#checkBuildWord').onclick=()=>{
  let correct=0;
  for(const panel of panels){
   const panelSlots=[...panel.querySelectorAll('.letter-slot')];
   const ok=panelSlots.every(slot=>slot.querySelector('.letter-chip')?.dataset.char===slot.dataset.answer);
   panel.classList.toggle('correct',ok);panel.classList.toggle('wrong',!ok);if(ok)correct++;
   updatePreview(panel);
  }
  const rr=row();rr.buildWordPlacements=collect();
  if(correct===panels.length){
   rr.done=true;rr.confirmed=true;save(rr);progress();$('#next').disabled=false;
   $('#buildWordStatus').textContent='⭐ ถูกต้องครบทั้ง ๔ คำ เก่งมาก! ไปกิจกรรมถัดไปได้เลย';
   if(progress()===chapter.pages.length)P1Course.mark(unit,'workbook');
  }else{
   rr.done=false;rr.confirmed=false;save(rr);progress();$('#next').disabled=true;
   $('#buildWordStatus').textContent='ถูก '+th(correct)+' จาก '+th(panels.length)+' คำ ลองดูกรอบสีแดงและตัวลวง แล้วแก้ใหม่อีกครั้งนะ';
  }
 };
}

const HANDWRITING_TEXT={"1":["อา ตา มา หา กา","อา ตา มา หา ปู","อา ตา มา ดู กา","อา ตา มา ดู ปู"],"2":["ดู ดี ดี มี ปู นา","ดู ภูผา มา หา ตา","ภูผา หา ปูนา","อารี มา ดู ภูผา"],"3":["เด็ก เด็ก เป็น เพื่อน ลูกช้าง","ลูกช้าง เป็น เพื่อน เด็ก เด็ก","ลูกช้าง แม้ ตัว ยัง เล็ก","แต่ เด็ก เด็ก ตัว เล็ก กว่า ลูกช้าง"],"4":["หนึ่ง สอง สาม สี่ ห้า","มา ซิ มา เรียง เลข ตาม","ถอย หลัง อย่า นับ ข้าม","ห้า สี่ สาม สอง และ หนึ่ง"],"5":["ถือกระเป๋าไปโรงเรียน","หัดอ่านเขียนสะกดคำ","เรียนไปใจจดจำ","อ่านเป็นคำอ่านเป็นความ"],"6":["โรงเรียนให้ความรู้","คุณครูให้ความรัก","พ่อแม่ชื่นใจนัก","ลูกที่รักเป็นคนดี"],"7":["ฝนตกแดดออก","นกกระจอกแปลกใจ","เห็นช้างตัวใหญ่","เดินโซเซมา"],"8":["พวกเราเป็นคนไทย","ต่างรักใคร่สร้างไมตรี","พูดเพราะเพลินพาที","ผูกใจกันฉันและเธอ"],"9":["งูตัวยาวยาว","ช้างเชือกใหญ่ใหญ่","กระดาษแผ่นบางบาง","จานใบแบนแบน"],"10":["เราอ่านเราเขียน","เราเรียนเรื่องแมว","มาเรียนมารู้","ดูตัวอย่างแมว","มาเถิดมาร้อง","ทำนองเพลงแมว"],"11":["ใบโบกใบบัว","ช้างน้อยแสนรู้","ใบบัวโบกหู","อายจัง อายจัง"],"12":["ถึงวันปีใหม่ไทย","ต่างพร้อมใจไปทำบุญ","ขนทรายเข้าวัดหนุน","ชวนกันก่อพระเจดีย์","เพลินใจเล่นสงกรานต์","ล้วนเบิกบานอย่างเต็มที่","คนช้างแสนยินดี","สาดน้ำใส่กันและกัน","รดน้ำพ่อและแม่","พร้อมเพื่อนแท้สองเชือกนั้น","ขอพรพ่อแม่พลัน","ช้างขอด้วยคำอวยพร"]};
const HANDWRITING_PAGE_TEXT={
 "3-6":["๖ ๖ ๖ ๖ ๖","๖ ๖ ๖ ๖ ๖","๖ ๖ ๖ ๖ ๖"],
 "3-7":["๗ ๗ ๗ ๗ ๗","๗ ๗ ๗ ๗ ๗","๗ ๗ ๗ ๗ ๗"],
 "3-8":["๘ ๘ ๘ ๘ ๘","๘ ๘ ๘ ๘ ๘","๘ ๘ ๘ ๘ ๘"],
 "3-9":["๙ ๙ ๙ ๙ ๙","๙ ๙ ๙ ๙ ๙","๙ ๙ ๙ ๙ ๙"],
 "3-10":["๑๐ ๑๐ ๑๐ ๑๐","๑๐ ๑๐ ๑๐ ๑๐","๑๐ ๑๐ ๑๐ ๑๐"],
 "3-12":["เ- เ- เ- เ- เ-","เก เค เด เต","เบ เป เอ เพ"],
 "3-14":["แ- แ- แ- แ- แ-","แก แค แด แต","แบ แป แอ แพ"]
};
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function unitData(){return window.P1_BOOK_UNITS?.[unit]||{}}
function stableShuffle(items,seed){
 const a=[...items];let x=(seed*9301+49297)%233280;
 for(let i=a.length-1;i>0;i--){x=(x*9301+49297)%233280;const j=Math.floor(x/233280*(i+1));[a[i],a[j]]=[a[j],a[i]]}
 return a
}
function gameWords(){
 const raw=(unitData().words||[]).map(String).filter(Boolean);
 return raw.length?raw:[chapter.title,'ภาษาไทย','อ่าน','คำ']
}
function shortWords(){
 const a=gameWords().filter(w=>!/\s/.test(w)&&[...w].length>=2&&[...w].length<=8);
 return a.length?a:gameWords().filter(w=>!/\s/.test(w))
}
function sourcePreview(){return''}
function speakThai(textValue){
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(textValue).replaceAll('สระ','สะระ'));u.lang='th-TH';u.rate=.82;
 const v=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('th'));if(v)u.voice=v;speechSynthesis.speak(u)
}
function gameAttempt(ok,score=100,message=''){
 const r=row();r.gameAttempts=(r.gameAttempts||0)+1;r.gameScore=ok?Math.max(r.gameScore||0,score):(r.gameScore||0);
 if(ok){r.done=true;r.confirmed=true}save(r);progress();$('#next').disabled=!r.done;
 const status=$('#gameStatus')||$('#status');if(status)status.textContent=message||(ok?'⭐ ผ่านภารกิจแล้ว รับ ๑๐ XP':'ยังไม่ถูก ลองใหม่อีกครั้งนะ');
 if(ok&&progress()===chapter.pages.length)P1Course.mark(unit,'workbook')
}
function advanceChoiceAutomatically(){
 clearTimeout(choiceAdvanceTimer);
 choiceAdvanceTimer=setTimeout(()=>{
  if(index<chapter.pages.length){index++;render();scrollTo({top:0,behavior:'smooth'});return}
  if(progress()===chapter.pages.length&&P1Course.mark(unit,'workbook'))location.href=P1Course.route(unit,'review')
 },1400)
}
function submitChoiceAnswer(ok,correctAnswer,selectedButton){
 const buttons=[...document.querySelectorAll('.choice-btn')];
 buttons.forEach(b=>{b.disabled=true;if(b.dataset.value===correctAnswer)b.classList.add('correct')});
 if(!ok)selectedButton.classList.add('wrong');
 const r=row();r.gameAttempts=(r.gameAttempts||0)+1;r.gameScore=ok?100:0;r.gameCorrect=ok;r.selectedAnswer=selectedButton.dataset.value;r.correctAnswer=correctAnswer;r.done=true;r.confirmed=true;
 save(r);progress();$('#next').disabled=true;
 const status=$('#gameStatus')||$('#status');
 if(status){status.classList.toggle('result-correct',ok);status.classList.toggle('result-wrong',!ok);status.textContent=ok?'✅ ถูกต้อง · คะแนน ๑๐๐/๑๐๐ · กำลังไปข้อถัดไป…':`❌ ผิด · คะแนน ๐/๑๐๐ · คำตอบที่ถูก: ${correctAnswer} · กำลังไปข้อถัดไป…`}
 if(progress()===chapter.pages.length)P1Course.mark(unit,'workbook');
 advanceChoiceAutomatically()
}
function gameHeader(icon,title,prompt){
 const r=row();return `<div class="game-top"><span class="game-level">${icon} ${th(index)} / ${th(chapter.pages.length)}</span><span class="game-xp">${r.done?'⭐ ผ่านแล้ว':'⭐ ๑๐'}</span></div><h2>${esc(title)}</h2><p>${prompt}</p>`
}
function renderListenChoice(p){
 const words=gameWords(),target=words[(unit*7+index*3)%words.length];
 const others=stableShuffle(words.filter(w=>w!==target),unit*100+index).slice(0,3);
 const opts=stableShuffle([target,...others],unit*1000+index);
 $('#content').innerHTML=`<section class="game-card">${gameHeader('🔊','ฟังแล้วเลือกคำ','กดฟัง แล้วเลือกคำที่ได้ยินให้ถูกต้อง')}<button class="listen-button" id="listenTarget">🔊 ฟังคำ</button><div class="choice-grid">${opts.map(o=>`<button class="choice-btn" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div><p class="game-status" id="gameStatus">${row().done?'⭐ ทำแล้ว':'เลือกคำตอบ'}</p>${sourcePreview(p)}</section>`;
 $('#next').hidden=true;$('#listenTarget').onclick=()=>speakThai(target);
 let locked=false;
 document.querySelectorAll('.choice-btn').forEach(b=>b.onclick=()=>{if(locked)return;locked=true;submitChoiceAnswer(b.dataset.value===target,target,b)})
}
function renderQuizGame(p){
 const reviews=unitData().review||[],q=reviews[(index-1)%Math.max(1,reviews.length)]||{q:'คำใดอยู่ในบทเรียนนี้?',o:gameWords().slice(0,3),a:gameWords()[0]};
 $('#content').innerHTML=`<section class="game-card">${gameHeader('❓','ตอบคำถามพิชิตดาว',esc(q.q))}<div class="choice-grid">${q.o.map(o=>`<button class="choice-btn" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div><p class="game-status" id="gameStatus">${row().done?'⭐ ทำแล้ว':'เลือกคำตอบ'}</p>${sourcePreview(p)}</section>`;
 $('#next').hidden=true;let locked=false;
 document.querySelectorAll('.choice-btn').forEach(b=>b.onclick=()=>{if(locked)return;locked=true;submitChoiceAnswer(b.dataset.value===q.a,q.a,b)})
}
function renderSequenceGame(p,mode){
 const data=unitData(),r=row();let expected=[],speakText='',title='',prompt='';
 if(mode==='build'){
  const list=shortWords(),target=list[(unit*5+index*2)%list.length];expected=[...target];speakText=target;title='ประกอบคำให้สำเร็จ';prompt='ฟังคำ แล้วลากพยัญชนะและสระมาเรียงให้ถูกต้อง'
 }else{
  const lines=(data.readingPages||[]).flatMap(x=>x.lines||[]).filter(x=>x.trim().split(/\s+/).length>=3);
  const line=lines[(unit*3+index)%Math.max(1,lines.length)]||gameWords().slice(0,4).join(' ');
  expected=line.trim().split(/\s+/).slice(0,6);speakText=expected.join(' ');title='เรียงคำเป็นประโยค';prompt='ฟังประโยค แล้วเรียงคำให้ถูกลำดับ'
 }
 const pool=[...expected];
 if(mode==='build'){
  const extras=[...new Set(shortWords().join(''))].filter(ch=>!expected.includes(ch)).slice(0,2);
  pool.push(...extras)
 }
 const shuffled=stableShuffle(pool.map((token,i)=>({id:`${mode}-${index}-${i}`,token})),unit*997+index*37);
 if(r.sequenceMode!==mode){r.sequenceMode=mode;r.sequencePlacements={};r.done=false;r.confirmed=false;save(r)}
 const placements=r.sequencePlacements||{};
 $('#content').innerHTML=`<section class="game-card sequence-game">${gameHeader(mode==='build'?'🧩':'🚂',title,prompt)}<button class="listen-button" id="listenSequence">🔊 ฟัง${mode==='build'?'คำ':'ประโยค'}</button><div class="sequence-slots">${expected.map((_,i)=>`<div class="seq-slot" data-index="${i}" role="button" tabindex="0"><span>${th(i+1)}</span></div>`).join('')}</div><div class="tile-bank" id="tileBank">${shuffled.map(t=>`<button class="game-tile" data-id="${t.id}" data-token="${esc(t.token)}">${esc(t.token.match(/^[\u0E31-\u0E4E]$/)?'◌'+t.token:t.token)}</button>`).join('')}</div><div class="game-actions"><button id="resetSequence">↻ เริ่มใหม่</button><button class="primary" id="checkSequence">✓ ตรวจคำตอบ</button></div><p class="game-status" id="gameStatus">${r.done?'⭐ ผ่านภารกิจนี้แล้ว':'ลากหรือแตะตัวเลือกไปวางในช่อง'}</p>${sourcePreview(p)}</section>`;
 const bank=$('#tileBank'),tiles=[...document.querySelectorAll('.game-tile')],slots=[...document.querySelectorAll('.seq-slot')];
 function placeholder(s){if(!s.querySelector('.game-tile'))s.innerHTML=`<span>${th(Number(s.dataset.index)+1)}</span>`}
 function collect(){const out={};for(const s of slots){const t=s.querySelector('.game-tile');if(t)out[s.dataset.index]=t.dataset.id}return out}
 function savePartial(){const rr=row();rr.sequenceMode=mode;rr.sequencePlacements=collect();rr.done=false;rr.confirmed=false;save(rr);$('#next').disabled=true;slots.forEach(s=>s.classList.remove('correct','wrong'))}
 function place(tile,slot,write=true){
  if(!tile||!slot)return;const old=tile.closest('.seq-slot'),occ=slot.querySelector('.game-tile');if(occ&&occ!==tile)bank.append(occ);slot.replaceChildren(tile);if(old&&old!==slot)placeholder(old);if(write)savePartial()
 }
 for(const s of slots){const id=placements[s.dataset.index],tile=tiles.find(t=>t.dataset.id===id);if(tile)place(tile,s,false)}
 slots.forEach(placeholder);
 let selected=null,drag=null;
 function select(t){tiles.forEach(x=>x.classList.remove('selected'));selected=t||null;if(selected){selected.classList.add('selected');$('#gameStatus').textContent='เลือก “'+selected.dataset.token+'” แล้ว แตะช่องที่ต้องการ'}}
 function finish(e){if(!drag||drag.id!==e.pointerId)return;const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.seq-slot');drag.ghost.remove();drag.tile.classList.remove('drag-source');const tile=drag.tile,moved=drag.moved;drag=null;if(slot)place(tile,slot);if(moved){tile.dataset.skip='1';setTimeout(()=>delete tile.dataset.skip,0)}}
 tiles.forEach(t=>{
  t.onclick=()=>{if(t.dataset.skip)return;select(selected===t?null:t)};
  t.onpointerdown=e=>{if(e.isPrimary===false||e.button>0)return;e.preventDefault();select(t);const g=t.cloneNode(true);g.className='tile-drag-ghost';document.body.append(g);g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';t.classList.add('drag-source');drag={id:e.pointerId,tile:t,ghost:g,x:e.clientX,y:e.clientY,moved:false};try{t.setPointerCapture(e.pointerId)}catch{}};
  t.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)drag.moved=true;drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';const s=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.seq-slot');slots.forEach(x=>x.classList.toggle('over',x===s))};
  t.onpointerup=e=>{slots.forEach(x=>x.classList.remove('over'));finish(e)};
  t.onpointercancel=e=>{if(drag&&drag.id===e.pointerId){drag.ghost.remove();drag.tile.classList.remove('drag-source');drag=null}}
 });
 slots.forEach(s=>{const use=()=>{if(selected){place(selected,s);select(null)}};s.onclick=e=>{if(!e.target.closest('.game-tile'))use()};s.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&selected){e.preventDefault();use()}}});
 $('#listenSequence').onclick=()=>speakThai(speakText);
 $('#resetSequence').onclick=()=>{tiles.forEach(t=>bank.append(t));slots.forEach(s=>{s.classList.remove('correct','wrong');placeholder(s)});select(null);const rr=row();rr.sequencePlacements={};rr.done=false;rr.confirmed=false;save(rr);$('#next').disabled=true;$('#gameStatus').textContent='เริ่มใหม่แล้ว ลองอีกครั้งนะ'};
 $('#checkSequence').onclick=()=>{let ok=true;slots.forEach((s,i)=>{const good=s.querySelector('.game-tile')?.dataset.token===expected[i];s.classList.toggle('correct',good);s.classList.toggle('wrong',!good);if(!good)ok=false});if(ok)gameAttempt(true,100,'⭐ เรียงถูกทั้งหมด รับ ๑๐ XP');else gameAttempt(false,0,'ยังมีบางช่องไม่ถูก ดูช่องสีแดงแล้วลองใหม่')}
}
function renderGamifiedPage(){
 const p=chapter.pages[index-1],mode=p.activityType||['listen','build','order','quiz'][(index+unit)%4];
 $('#next').disabled=!row().done;
 if(mode==='listen')renderListenChoice(p);else if(mode==='quiz')renderQuizGame(p);else renderSequenceGame(p,mode)
}
function handwritingLines(){
 const pageKey=unit+'-'+index;
 if(HANDWRITING_PAGE_TEXT[pageKey])return HANDWRITING_PAGE_TEXT[pageKey];
 if(index===chapter.pages.length&&HANDWRITING_TEXT[unit])return HANDWRITING_TEXT[unit];
 const lines=(unitData().readingPages||[]).flatMap(x=>x.lines||[]).map(s=>String(s).trim()).filter(s=>s&&[...s].length<=34);
 const pick=lines.slice(0,4);return pick.length?pick:[chapter.title,'อ่าน เขียน ภาษาไทย','ตั้งใจ ฝึก ทุกวัน']
}
function renderHandwritingPage(){
 const r=row(),lines=handwritingLines();
 if(r.handwritingVersion!==2){r.handwritingVersion=2;r.handwritingStrokes=Array.from({length:lines.length},()=>[]);r.handwritingScores=[];r.done=false;r.confirmed=false;save(r)}
 if(!Array.isArray(r.handwritingStrokes)||r.handwritingStrokes.length!==lines.length)r.handwritingStrokes=Array.from({length:lines.length},(_,i)=>r.handwritingStrokes?.[i]||[]);
 $('#next').disabled=!r.done;
 const pageSpecific=Boolean(HANDWRITING_PAGE_TEXT[unit+'-'+index]),traceTitle=pageSpecific?'ฝึกคัดตัวอักษรและคำ':'คัดลายมือตัวบรรจงเต็มบรรทัด',tracePrompt=pageSpecific?'ลากนิ้วหรือปากกาตามตัวเลข สระ หรือคำต้นแบบจากหน้าฝึกเดิม':'ลากนิ้วหรือปากกาตามตัวอักษรจางให้ครบทุกบรรทัด';
 $('#content').innerHTML=`<section class="handwriting-game">${gameHeader('✍️',traceTitle,tracePrompt)}<div class="trace-list">${lines.map((line,i)=>{const size=Math.max(28,Math.min(56,760/Math.max(8,[...line].length)));return `<div class="trace-card"><div class="trace-toolbar"><button class="trace-speak" data-i="${i}">🔊 ฟัง</button><span id="traceScore${i}">${r.handwritingScores?.[i]!=null?'คะแนน '+th(r.handwritingScores[i]):'คัดตามแบบ'}</span></div><svg class="trace-pad" data-i="${i}" viewBox="0 0 900 140" aria-label="คัดลายมือ ${esc(line)}"><text class="trace-guide" x="28" y="92" style="font-size:${size}px">${esc(line)}</text><g class="trace-ink"></g></svg></div>`}).join('')}</div><div class="game-actions"><button id="undoTrace">↶ ย้อนเส้น</button><button id="resetTrace">↻ เริ่มใหม่</button><button class="primary" id="checkTrace">✓ ตรวจลายมือ</button></div><p class="game-status" id="gameStatus">${r.done?'⭐ ผ่านแล้ว':'คัดให้ครบ แล้วกดตรวจ'}</p></section>`;
 const pads=[...document.querySelectorAll('.trace-pad')];let active=null,lastLine=0;
 function paintPad(i){const g=pads[i].querySelector('.trace-ink');g.replaceChildren();for(const stroke of r.handwritingStrokes[i]||[]){const path=document.createElementNS(ns,'path');path.setAttribute('d',stroke.map(([x,y],j)=>(j?'L':'M')+x+' '+y).join(' '));path.setAttribute('class','trace-stroke');g.append(path)}}
 pads.forEach((svg,i)=>{
  paintPad(i);
  const point=e=>{const b=svg.getBoundingClientRect();return [Math.max(0,Math.min(900,(e.clientX-b.left)*900/b.width)),Math.max(0,Math.min(140,(e.clientY-b.top)*140/b.height))]};
  svg.onpointerdown=e=>{if(e.isPrimary===false||e.button>0)return;e.preventDefault();lastLine=i;active={id:e.pointerId,i,pts:[point(e)]};try{svg.setPointerCapture(e.pointerId)}catch{}};
  svg.onpointermove=e=>{if(!active||active.id!==e.pointerId||active.i!==i)return;if(active.pts.length<2500)active.pts.push(point(e));const temp=[...(r.handwritingStrokes[i]||[]),active.pts],g=svg.querySelector('.trace-ink');g.replaceChildren();for(const st of temp){const path=document.createElementNS(ns,'path');path.setAttribute('d',st.map(([x,y],j)=>(j?'L':'M')+x+' '+y).join(' '));path.setAttribute('class','trace-stroke');g.append(path)}};
  const end=e=>{if(!active||active.id!==e.pointerId||active.i!==i)return;active.pts.push(point(e));r.handwritingStrokes[i]=r.handwritingStrokes[i]||[];r.handwritingStrokes[i].push(active.pts);active=null;r.done=false;r.confirmed=false;save(r);$('#next').disabled=true;paintPad(i)};
  svg.onpointerup=end;svg.onpointercancel=()=>{active=null;paintPad(i)}
 });
 document.querySelectorAll('.trace-speak').forEach(b=>b.onclick=()=>speakThai(lines[Number(b.dataset.i)]));
 function lineScore(i){
  const strokes=r.handwritingStrokes[i]||[];let len=0,minX=900,maxX=0;
  for(const st of strokes)for(let j=1;j<st.length;j++){const [x1,y1]=st[j-1],[x2,y2]=st[j];len+=Math.hypot(x2-x1,y2-y1);minX=Math.min(minX,x2);maxX=Math.max(maxX,x2)}
  const chars=Math.max(1,[...lines[i].replace(/\s/g,'')].length),lengthPart=Math.min(1,len/(chars*42))*72,coveragePart=Math.min(1,Math.max(0,maxX-minX)/Math.min(820,chars*65))*28;
  return Math.round(lengthPart+coveragePart)
 }
 $('#undoTrace').onclick=()=>{const arr=r.handwritingStrokes[lastLine]||[];arr.pop();r.done=false;save(r);$('#next').disabled=true;paintPad(lastLine);$('#gameStatus').textContent='ย้อนเส้นล่าสุดแล้ว'};
 $('#resetTrace').onclick=()=>{r.handwritingStrokes=Array.from({length:lines.length},()=>[]);r.handwritingScores=[];r.done=false;r.confirmed=false;save(r);pads.forEach((_,i)=>paintPad(i));$('#next').disabled=true;$('#gameStatus').textContent='เริ่มใหม่แล้ว คัดตามตัวอักษรจางอีกครั้ง'};
 $('#checkTrace').onclick=()=>{const scores=lines.map((_,i)=>lineScore(i)),avg=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);r.handwritingScores=scores;r.handwritingScore=avg;scores.forEach((s,i)=>$('#traceScore'+i).textContent='คะแนน '+th(s));if(scores.every(s=>s>=50)&&avg>=60){r.done=true;r.confirmed=true;save(r);progress();$('#next').disabled=false;$('#gameStatus').textContent='⭐ ผ่านการคัดลายมือ '+th(avg)+' คะแนน รับ ๑๐ XP';if(progress()===chapter.pages.length)P1Course.mark(unit,'workbook')}else{r.done=false;save(r);$('#next').disabled=true;$('#gameStatus').textContent='ได้ '+th(avg)+' คะแนน ลองคัดตามแนวตัวอักษรให้ครบและต่อเนื่องขึ้นอีกนิดนะ'}}
}
function render(){
 clearTimeout(choiceAdvanceTimer);loaded=false;stroke=null;$('#status').textContent='';$('#next').hidden=false;$('#title').textContent=`บทที่ ${th(unit)} · ${chapter.title}`;document.title=`แบบฝึก ${$('#title').textContent}`;
 const done=progress();$('#counter').textContent=index?`${th(index)} / ${th(chapter.pages.length)}`:'หน้าปก';$('#prev').disabled=index===0;
 $('#next').disabled=index>0&&!row().done;$('#next').textContent=index===0?'เริ่มภารกิจ →':index===chapter.pages.length?'ไปทบทวนและเกม →':'ภารกิจถัดไป ›';
 $('#pageList').replaceChildren();for(let i=0;i<=chapter.pages.length;i++){const b=document.createElement('button');b.textContent=i?th(i):'ปก';if(state()[i]?.done)b.className='completed';b.onclick=()=>{flush();index=i;$('#menu').close();render()};$('#pageList').append(b)}
 if(!index){$('#content').innerHTML=`<section class="cover kid-cover"><div class="cover-book"><img src="${chapter.volume===1?'assets/thai-workbook-volume-1-cover.webp?v=20260925-kidui-1':'assets/volume-'+chapter.volume+'.webp'}" alt="ปกแบบฝึกทักษะภาษาไทย ป.๑ เล่ม ${th(chapter.volume)}"></div><h2>บทที่ ${th(unit)} · ${chapter.title}</h2><p class="cover-meta">${th(chapter.pages.length)} ภารกิจ</p>${done===chapter.pages.length?'<p class="reward">🏅</p><p class="complete-copy">เก่งมาก! ผ่านครบแล้ว</p>':''}</section>`;return}
 if(isUnit1MatchPage()){renderUnit1Match();return}
 if(isUnit1BuildWordPage()){renderUnit1BuildWord();return}
 if(chapter.pages[index-1]?.activityType==='handwriting'){renderHandwritingPage();return}
 renderGamifiedPage();
}
$('#prev').onclick=()=>{flush();if(index>0){index--;render();scrollTo(0,0)}};
$('#next').onclick=()=>{flush();if(index&& !row().done)return;if(index<chapter.pages.length){index++;render();scrollTo(0,0)}else{if(progress()!==chapter.pages.length){index=chapter.pages.findIndex((_,i)=>!state()[i+1]?.done)+1;render();$('#status').textContent='ทำหน้านี้ให้ครบก่อน แล้วไปทบทวนกัน';return}if(P1Course.mark(unit,'workbook'))location.href=P1Course.route(unit,'review')}};
$('#openMenu').onclick=()=>{flush();$('#menu').showModal()};$('#closeMenu').onclick=()=>$('#menu').close();
function switchContext(){const next=P1Course.context().key;if(next!==scope){clearTimeout(saveTimer);scope=next;stroke=null;index=0;if(chapter)render()}else if(chapter)progress()}
for(const event of ['p1-classroom-ready','p1-trace-context'])document.addEventListener(event,switchContext);
document.addEventListener('p1-course-storage-error',()=>$('#status').textContent='ยังบันทึกในเครื่องไม่ได้ พื้นที่อาจเต็ม กรุณาเก็บคำตอบก่อนปิดหน้า');window.addEventListener('pagehide',flush);
fetch('book.json?v=20260925-gamified-all-2').then(r=>{if(!r.ok)throw Error();return r.json()}).then(b=>{chapter=b.chapters.find(c=>c.unit===unit);migrateGamifiedRows();$('#reading').href=P1Course.route(unit,'reading');$('#literature').hidden=unit<4||unit>11;$('#literature').href=P1Course.route(unit,'literature');render()}).catch(()=>$('#status').textContent='เปิดแบบฝึกไม่สำเร็จ กรุณาลองโหลดใหม่');
})();
