(() => {
'use strict';
const $=s=>document.querySelector(s), th=n=>String(n).replace(/\d/g,d=>'๐๑๒๓๔๕๖๗๘๙'[d]);
const letters=Array.from('กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ');
const names=['ไก่','ไข่','ขวด','ควาย','คน','ระฆัง','งู','จาน','ฉิ่ง','ช้าง','โซ่','เฌอ','หญิง','ชฎา','ปฏัก','ฐาน','มณโฑ','ผู้เฒ่า','เณร','เด็ก','เต่า','ถุง','ทหาร','ธง','หนู','ใบไม้','ปลา','ผึ้ง','ฝา','พาน','ฟัน','สำเภา','ม้า','ยักษ์','เรือ','ลิง','แหวน','ศาลา','ฤๅษี','เสือ','หีบ','จุฬา','อ่าง','นกฮูก'];
const sounds=['กอ','ขอ','ขอ','คอ','คอ','คอ','งอ','จอ','ฉอ','ชอ','ซอ','ชอ','ยอ','ดอร์','ตอ','ถอ','ทอ','ทอ','นอ','ดอร์','ตอ','ถอ','ทอ','ทอ','นอ','บอ','ปอ','ผอ','ฝอ','พอ','ฟอ','พอ','มอ','ยอ','รอ','ลอ','วอ','สอ','สอ','สอ','หอ','ลอ','ออ','ฮอ'];
const groups=[
 {title:'ลากเส้นขึ้น–ลง',pattern:'vertical',chars:'กถภงจว',pages:[3,4,5,6],printed:'๑–๔'},
 {title:'ลากเส้นเฉียง',pattern:'diagonal',chars:'คดตฆธรผฝพฟ',pages:[7,8,9,10,11],printed:'๕–๙'},
 {title:'ลากเส้นซ้าย–ขวา',pattern:'horizontal',chars:'บปญณฌ',pages:[12,14,15,16],printed:'๑๐–๑๓'},
 {title:'ลากเส้นโค้ง',pattern:'curve',chars:'ทศลสฉอฬฮษ',pages:[17,18,19,20,21],printed:'๑๔–๑๘'},
 {title:'ลากเส้นวงกลม',pattern:'circle',chars:'ยฅนมห',pages:[22,23,24,25],printed:'๑๙–๒๒'},
 {title:'ฝึกเขียนพยัญชนะ',pattern:'loop',chars:'ขฃชซฎฏฐฒฑ',pages:[26,27,28],printed:'๒๓–๒๕'}
];
const pages=[{kind:'cover',title:'เริ่มเตรียมความพร้อม'}];
for(let i=0;i<44;i++)pages.push({kind:'letters',title:`${letters[i]} ${names[i]}`,start:i,end:i+1});
groups.forEach((g,i)=>pages.push({...g,kind:'practice',group:i+1,title:`แบบฝึกชุดที่ ${th(i+1)} · ${g.title}`}));
[
 ['-ะ','-า','-ิ','-ี','-ึ','-ือ','-ุ','-ู'],
 ['เ-ะ','เ-','แ-ะ','แ-','โ-ะ','โ-'],
 ['เ-าะ','-อ','เ-อะ','เ-อ','เ-ีย','เ-ือ','-ัว'],
 ['-ำ','ไ-','ใ-','เ-า']
].forEach((chars,i)=>pages.push({kind:'practice',title:'ฝึกเขียนสระ · ชุดที่ '+th(i+1),chars,pages:[28,29],printed:'๒๕–๒๖',vowels:true}));
pages.push({kind:'practice',title:'ฝึกเขียนวรรณยุกต์',chars:['่','้','๊','๋'],pages:[30],printed:'๒๗'});
pages.push({kind:'practice',title:'ฝึกเขียนเลขไทย',chars:['๑','๒','๓','๔','๕','๖','๗','๘','๙','๑๐'],pages:[30],printed:'๒๗'});
pages.push({kind:'quiz',title:'เกมฟังเสียง เลือกพยัญชนะ'},{kind:'finish',title:'พร้อมเริ่มบทที่ ๑'});
let page=0,readId=0,reading=false,timer,selected='เส้น',ink=[],redo=[],stroke=null,pen='#245eae',quizIndex=0,quizSolved=false;
const drawings=new Map(), selections=new Map(),stars=new Set();
const quiz=[0,6,7,19,20,25,26,32];
const menu=$('#menu'),paper=$('#paper');
function safeGet(k){try{return sessionStorage.getItem(k)}catch{return null}}
function safeSet(k,v){try{sessionStorage.setItem(k,v)}catch{}}
function stop(){readId++;reading=false;clearTimeout(timer);window.speechSynthesis?.cancel();document.querySelectorAll('.speaking').forEach(e=>e.classList.remove('speaking'));$('#readPage').textContent='🔊';$('#readPage').setAttribute('aria-label','ฟังหน้านี้')}
function speak(items){
 stop();$('#speechStatus').textContent='';
 if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance){$('#speechStatus').textContent='เครื่องนี้ยังไม่มีเสียงอ่าน ลองเปิดด้วย Safari หรือ Chrome ที่ติดตั้งเสียงภาษาไทย';return}
 const id=readId;reading=true;$('#readPage').textContent='■';$('#readPage').setAttribute('aria-label','หยุดอ่าน');
 function next(i){
  if(id!==readId)return;
  if(i>=items.length){stop();return}
  const {text,el}=items[i],u=new SpeechSynthesisUtterance(text);
  u.lang='th-TH';u.rate=.85;const voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('th'));if(voice)u.voice=voice;
  el?.classList.add('speaking');
  u.onend=()=>{if(id!==readId)return;el?.classList.remove('speaking');timer=setTimeout(()=>next(i+1),220)};
  u.onerror=()=>{if(id!==readId)return;stop();$('#speechStatus').textContent='เสียงอ่านยังไม่พร้อม ลองแตะฟังอีกครั้ง'};
  speechSynthesis.speak(u);
 }
 next(0);
}
function letterText(i){return sounds[i]+' '+names[i]}
const vowelSpeech={'-ะ':'อะ','-า':'อา','-ิ':'อิ','-ี':'อี','-ึ':'อึ','-ือ':'อือ','-ุ':'อุ','-ู':'อู','เ-ะ':'เอะ','เ-':'เอ','แ-ะ':'แอะ','แ-':'แอ','โ-ะ':'โอะ','โ-':'โอ','เ-าะ':'เอาะ','-อ':'ออ','เ-อะ':'เออะ','เ-อ':'เออ','เ-ีย':'เอีย','เ-ือ':'เอือ','-ัว':'อัว','-ำ':'อำ','ไ-':'ไอ ไม้มลาย','ใ-':'ใอ ไม้ม้วน','เ-า':'เอา'};
function symbolText(c){const i=letters.indexOf(c);return i>=0?letterText(i):vowelSpeech[c]||({'่':'ไม้เอก','้':'ไม้โท','๊':'ไม้ตรี','๋':'ไม้จัตวา','๐':'ศูนย์','๑':'หนึ่ง','๒':'สอง','๓':'สาม','๔':'สี่','๕':'ห้า','๖':'หก','๗':'เจ็ด','๘':'แปด','๙':'เก้า','๑๐':'สิบ'}[c]||c)}
function symbol(c){return /^[\u0e48-\u0e4b]$/.test(c)?'\u00a0'+c:c.replaceAll('-','\u00a0')}
function symbolHTML(c){if(/^[\u0e48-\u0e4b]$/.test(c))return '<span class="empty-base">&nbsp;'+c+'</span>';return c.replace(/-([\u0e31\u0e34-\u0e39])?/g,(_,mark)=>'<span class="empty-base">&nbsp;'+(mark||'')+'</span>')}
function source(p){return `<div class="source">จากแบบฝึกทักษะภาษา เล่ม ๑ หน้า ${p.printed}<details><summary>ดูหน้าต้นฉบับ</summary>${p.pages.map(n=>`<button class="source-open" data-source="${n}">เปิดภาพต้นฉบับ ${th(n<=12?n-2:n-3)}</button>`).join('')}</details></div>`}
function render(){
 stop();paper.replaceChildren();$('#speechStatus').textContent='';const p=pages[page];paper.classList.toggle('single-letter-page',p.kind==='letters');
 const url=new URL(location.href);url.searchParams.set('page',String(page+1));history.replaceState(null,'',url);
 safeSet('p1-readiness-single-page',String(page));
 $('#sectionName').textContent=p.kind==='letters'?'ภาษาพาที · พยัญชนะ':p.kind==='practice'?'แบบฝึกเล่ม ๑ · ก่อนบทที่ ๑':'ก่อนเริ่มบทที่ ๑';
 $('#pageCount').textContent=`${th(page+1)} / ${th(pages.length)}`;$('#pagerLabel').textContent=`หน้า ${th(page+1)} จาก ${th(pages.length)}`;
 $('#previous').disabled=page===0;$('#next').disabled=page===pages.length-1;
 document.querySelectorAll('[data-go]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.go)===page?'page':'false'));
 if(p.kind==='cover')paper.innerHTML=`<div class="cover"><span class="badge">ก่อนบทที่ ๑</span><h2>เตรียมความพร้อม</h2><div class="cover-art"><img src="assets/letter-1.webp" alt="ไก่"><b>ก</b><img src="assets/letter-33.webp" alt="ม้า"></div><p>ดูภาพ · ฟังเสียง · ฝึกเขียน</p><p class="lead">เรียนทีละหน้า ค่อย ๆ ทำไปด้วยกัน</p><button class="primary" id="start">เริ่มเรียน →</button><p class="source">ภาษาพาที: พยัญชนะก่อนบทที่ ๑<br>แบบฝึกทักษะภาษา เล่ม ๑: เตรียมความพร้อม ๖ ชุด</p></div>`;
 if(p.kind==='letters'){
  paper.innerHTML=`<h2>รู้จักพยัญชนะ</h2><p class="lead">แตะฟังเสียง · ปัดเพื่อเปลี่ยนตัว</p><div class="letter-grid">${letters.slice(p.start,p.end).map((c,j)=>{const i=p.start+j;return `<button class="letter-card" data-letter="${i}" aria-label="ฟัง ${c} ${names[i]}"><img src="assets/letter-${i+1}.webp" alt=""><b>${c}</b><span>${names[i]}</span></button>`}).join('')}</div><p class="source">ตัวที่ ${th(p.start+1)} จาก ๔๔ · ภาพจากภาษาพาที</p>`;
 }
 if(p.kind==='practice')renderPractice(p);
 if(p.kind==='quiz')renderQuiz();
 if(p.kind==='finish')paper.innerHTML=`<div class="finish"><span class="badge">เก่งมาก</span><h2>พร้อมเริ่มบทที่ ๑ แล้ว</h2><p>รู้จักพยัญชนะ และฝึกเขียนด้วยกัน</p><p>กลับมาฝึกซ้ำได้ทุกเมื่อ</p><a class="primary" href="../lesson.html?unit=1&amp;start=1">อ่าน ใบโบก ใบบัว →</a><br><a href="../index.html">กลับสารบัญ</a></div>`;
 paper.querySelector('#start')?.addEventListener('click',()=>go(1));
 paper.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>speak([{text:letterText(+b.dataset.letter),el:b}]));
 paper.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>openSource(+b.dataset.source));
}
function go(n){if(n<0||n>=pages.length)return;page=n;render();window.scrollTo({top:0,behavior:'instant'})}
function renderPractice(p){
 const chars=Array.from(p.chars);selected=selections.get(page)||(p.pattern?'เส้น':chars[0]);
 paper.innerHTML=`<h2>${p.title}</h2><p class="lead">เลือกตัวอย่าง แล้วใช้นิ้วหรือปากกาเขียนตาม</p><div class="sample-picks">${(p.pattern?['เส้น',...chars]:chars).map(c=>`<button data-sample="${c}" aria-label="${c==='เส้น'?'ฝึกลากเส้น':symbolText(c)}" aria-pressed="${selected===c}">${c==='เส้น'?'เส้น':symbolHTML(c)}</button>`).join('')}</div><h3 id="practiceLabel" class="practice-title"></h3><div class="tools" data-swipe-ignore><label>สีปากกา <input id="penColor" type="color" value="${pen}" aria-label="สีปากกาฝึกเขียน"></label><button id="undoInk">↶ ย้อนกลับ</button><button id="redoInk">↷ ทำซ้ำ</button><button id="clearInk">ล้างลายเขียน</button></div><svg class="writing-area" id="writing" viewBox="0 0 720 340" role="img" aria-label="กระดานฝึกเขียน ใช้นิ้วหรือปากกาลากตามตัวอย่าง" data-swipe-ignore><g id="guides"></g><g id="ink"></g></svg><p class="write-help">เริ่มที่จุดสีเขียวสำหรับฝึกลากเส้น · ปัดเปลี่ยนหน้าบริเวณนอกกระดาน</p><button id="practiceDone">☆ ฝึกหน้านี้แล้ว</button><span id="practiceStar" class="done-note" role="status"></span><p class="toolbar-note">ครูหรือผู้ปกครองช่วยดูทิศทางและรูปตัวอักษร</p>${source(p)}`;
 paper.querySelectorAll('[data-sample]').forEach(b=>b.onclick=()=>{selected=b.dataset.sample;selections.set(page,selected);paper.querySelectorAll('[data-sample]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));loadInk();drawGuide(p);if(selected!=='เส้น')speak([{text:symbolText(selected),el:b}])});
 $('#penColor').oninput=e=>pen=e.target.value;
 $('#undoInk').onclick=()=>{if(ink.length)redo.push(ink.pop());saveInk();paintInk()};$('#redoInk').onclick=()=>{if(redo.length)ink.push(redo.pop());saveInk();paintInk()};
 $('#clearInk').onclick=()=>{if(!ink.length)return;redo.push(...ink.slice().reverse());ink=[];saveInk();paintInk()};
 $('#practiceDone').onclick=()=>{stars.add(page);$('#practiceStar').textContent=' ★ เยี่ยมมาก ฝึกต่อได้เลย';$('#practiceDone').textContent='★ ฝึกหน้านี้แล้ว'};
 if(stars.has(page))$('#practiceDone').textContent='★ ฝึกหน้านี้แล้ว';
 loadInk();drawGuide(p);const board=$('#writing');
 function point(e){const r=board.getBoundingClientRect();return [(e.clientX-r.left)/r.width*720,(e.clientY-r.top)/r.height*340]}
 board.onpointerdown=e=>{if(e.isPrimary===false||e.button>0)return;e.preventDefault();e.stopPropagation();board.setPointerCapture?.(e.pointerId);const a=point(e);stroke={color:pen,points:[a,[a[0]+.1,a[1]+.1]]};ink.push(stroke);redo=[];paintInk()};
 board.onpointermove=e=>{if(!stroke)return;e.preventDefault();stroke.points.push(point(e));paintInk()};
 board.onpointerup=board.onpointercancel=()=>{stroke=null;saveInk()};
}
function inkKey(){return page+':'+selected}
function loadInk(){stroke=null;redo=[];ink=drawings.get(inkKey())||[];paintInk()}
function saveInk(){drawings.set(inkKey(),ink)}
function paintInk(){const layer=$('#ink');if(!layer)return;layer.replaceChildren();for(const s of ink){const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',s.points.map(p=>p.join(',')).join(' '));line.setAttribute('stroke',s.color);line.setAttribute('stroke-width','5');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');line.setAttribute('fill','none');layer.append(line)}}
function drawGuide(p){
 $('#practiceLabel').textContent=selected==='เส้น'?p.title.replace(/^แบบฝึกชุดที่ . · /,''):`ฝึกเขียน ${p.vowels?'สระ'+symbolText(selected):(/^[\u0e48-\u0e4b]$/.test(selected)?symbolText(selected):selected)}`;
 $('.write-help').textContent=(selected==='เส้น'?'เริ่มที่จุดสีเขียว ค่อย ๆ ลากตามเส้น':'เขียนตามตัวอย่าง แล้วลองเขียนด้วยตนเอง')+' · ปัดเปลี่ยนหน้าบริเวณนอกกระดาน';
 let s='';for(const y of [85,155,230,300])s+=`<path d="M 20 ${y} H 700" stroke="#c6dae4" stroke-width="1.5"/>`;
 if(selected!=='เส้น')for(const y of [155,300])for(const x of [55,260,465]){
  const size=selected.length>3?80:112;
  s+=`<text x="${x}" y="${y}" class="guide" font-size="${size}" xml:space="preserve">${symbol(selected)}</text>`;
  if(selected.includes('-')||/^[\u0e48-\u0e4b]$/.test(selected)){
   const offset=selected.indexOf('-')>0?size*.42:0;
   s+=`<path d="M ${x+offset} ${y+5} h ${size*.28}" stroke="#a9b7bd" stroke-width="2"/>`;
  }
 }
 else{
  const patterns={vertical:'M 0 0 V 90',diagonal:'M 0 0 L 70 90',horizontal:'M 0 0 H 100',curve:'M 0 45 C 0 -25 100 -25 100 45 M 0 55 C 0 125 100 125 100 55',circle:'M 50 0 A 45 45 0 1 1 49.9 0',loop:'M 0 0 C 70 -40 110 30 60 60 C 20 80 10 30 45 25 L 80 100'};
  for(const y of [52,207])for(const x of [45,265,485]){
   const reverse=y===207, alt={vertical:'M 0 90 V 0',horizontal:'M 100 0 H 0',diagonal:'M 70 0 L 0 90'};
   const sx=p.pattern==='circle'?50:reverse&&p.pattern==='horizontal'?100:reverse&&p.pattern==='diagonal'?70:0;
   const sy=p.pattern==='curve'?45:reverse&&p.pattern==='vertical'?90:0;
   s+=`<g transform="translate(${x},${y})"><path d="${reverse&&alt[p.pattern]||patterns[p.pattern]}" fill="none" stroke="#9eafbd" stroke-width="5" stroke-dasharray="6 8"/><circle cx="${sx}" cy="${sy}" r="7" fill="#237b69"/></g>`;
  }
 }
 $('#guides').innerHTML=s;
}
function renderQuiz(){
 const i=quiz[quizIndex],options=[i,(i+7)%44,(i+19)%44].sort((a,b)=>a-b);quizSolved=false;
 paper.innerHTML=`<h2>ฟังเสียง เลือกพยัญชนะ</h2><p>ข้อ ${th(quizIndex+1)} จาก ${th(quiz.length)}</p><img class="quiz-image" src="assets/letter-${i+1}.webp" alt="${names[i]}"><div style="text-align:center"><button id="quizSound">🔊 ฟังเสียง</button></div><div class="choices">${options.map(j=>`<button data-answer="${j}" aria-label="เลือก ${letters[j]}">${letters[j]}</button>`).join('')}</div><p class="feedback" role="status" id="feedback">ฟังแล้วเลือกตัวที่ตรงกับภาพ</p><button id="quizNext" class="primary" hidden>ข้อต่อไป →</button>`;
 $('#quizSound').onclick=()=>speak([{text:letterText(i),el:$('#quizSound')}]);
 paper.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
  if(quizSolved)return;
  if(+b.dataset.answer!==i){b.classList.add('choice-wrong');$('#feedback').textContent='ลองฟังอีกครั้ง แล้วเลือกใหม่นะ';return}
  quizSolved=true;b.classList.add('choice-right');$('#feedback').textContent=`★ ถูกต้อง ${letters[i]} ${names[i]}`;paper.querySelectorAll('[data-answer]').forEach(x=>x.disabled=true);$('#quizNext').hidden=false;
  if(quizIndex===quiz.length-1)$('#quizNext').textContent='พร้อมเริ่มบทที่ ๑ →';speak([{text:letterText(i),el:b}]);
 });
 $('#quizNext').onclick=()=>{stop();if(quizIndex<quiz.length-1){quizIndex++;renderQuiz()}else go(page+1)};
}
function openSource(n){
 let dialog=$('#sourceDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='sourceDialog';dialog.className='source-view';dialog.innerHTML='<div class="menu-head"><h3>หน้าต้นฉบับแบบฝึก</h3><button id="closeSource" aria-label="ปิดภาพต้นฉบับ">✕</button></div><p class="source">ภาพจากไฟล์ที่ครูให้มา อาจมีรอยเขียนเดิม</p><img id="sourceImage" alt="หน้าต้นฉบับแบบฝึกเตรียมความพร้อม"><a id="sourceFull" target="_blank" rel="noopener">เปิดภาพขนาดเต็ม</a>';document.body.append(dialog);$('#closeSource').onclick=()=>dialog.close()}
 $('#sourceImage').src=`assets/workbook-${n}.webp`;$('#sourceFull').href=`assets/workbook-${n}.webp`;stop();dialog.showModal();
}
$('#readPage').onclick=()=>{
 if(reading){stop();return}
 const p=pages[page];if(p.kind==='letters')speak([...paper.querySelectorAll('[data-letter]')].map(el=>({text:letterText(+el.dataset.letter),el})));
 else if(p.kind==='practice')speak([{text:selected==='เส้น'?'ค่อย ๆ ลากเส้น ตามตัวอย่าง':symbolText(selected),el:paper.querySelector(`[data-sample="${selected}"]`)}]);
 else if(p.kind==='quiz')$('#quizSound').click();else speak([{text:p.kind==='cover'?'เตรียมความพร้อม ดูภาพ ฟังเสียง ฝึกเขียน':'เก่งมาก พร้อมเริ่มบทที่หนึ่งแล้ว',el:paper.querySelector('h2')}]);
};
$('#previous').onclick=()=>go(page-1);$('#next').onclick=()=>go(page+1);
$('#pageLinks').innerHTML=pages.map((p,i)=>`<button data-go="${i}">${th(i+1)} · ${p.title}</button>`).join('');
$('#pageLinks').onclick=e=>{const b=e.target.closest('[data-go]');if(!b)return;menu.close();go(+b.dataset.go)};
$('#openMenu').onclick=()=>{stop();menu.showModal();$('#openMenu').setAttribute('aria-expanded','true')};$('#closeMenu').onclick=()=>menu.close();menu.addEventListener('close',()=>$('#openMenu').setAttribute('aria-expanded','false'));
let swipe=null,suppressTapUntil=0;
paper.addEventListener('pointerdown',e=>{
 if(e.isPrimary===false||e.button>0||e.target.closest('[data-swipe-ignore],input,select,summary,a'))return;
 if(e.target.closest('button')&&!e.target.closest('.letter-card'))return;
 swipe={id:e.pointerId,x:e.clientX,y:e.clientY,t:Date.now()};
});
paper.addEventListener('pointerup',e=>{
 if(!swipe||swipe.id!==e.pointerId)return;
 const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y,dt=Date.now()-swipe.t;swipe=null;
 if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5&&dt<1300){suppressTapUntil=Date.now()+400;go(page+(dx<0?1:-1))}
});
paper.addEventListener('pointercancel',()=>swipe=null);
paper.addEventListener('click',e=>{if(Date.now()<suppressTapUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.target.closest('input,select,textarea,button,a'))return;if(e.key==='ArrowRight'){e.preventDefault();go(page+1)}if(e.key==='ArrowLeft'){e.preventDefault();go(page-1)}});
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
const initial=new URLSearchParams(location.search).get('page');page=Math.max(0,Math.min(pages.length-1,initial?Number(initial)-1:Number(safeGet('p1-readiness-single-page')||0)));if(!Number.isFinite(page))page=0;
render();
})();
