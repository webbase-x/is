(()=>{"use strict";
const units=window.P1_BOOK_UNITS||{};
const params=new URLSearchParams(location.search);
let unitNo=Math.min(Math.max(...Object.keys(units).map(Number)),Math.max(1,Number(params.get("unit"))||1));
let unit=units[unitNo];
if(!unit){location.href="index.html";return}
document.documentElement.style.setProperty("--unit",unit.color);
document.title=`หน่วยที่ ${unitNo} ${unit.title} | เพลินภาษา ป.1`;
const $=s=>document.querySelector(s);
const stage=$("#activityStage");
const stepNames=["หน้าบท","รู้จักคำ","ฝึกอ่านคำ","อ่านครบทุกหน้า","ทบทวน","เกม"];
const stepHelp=[
 "ดูภาพเปิดบทแบบคู่ 2 หน้าจากหนังสือต้นฉบับ แล้วเตรียมตัวเริ่มเรียน",
 "ดูภาพและคำในการ์ดเดียวกัน แตะการ์ดเพื่อฟัง แล้วอ่านตาม",
 "ฝึกอ่านคำทีละคำ ฟังเสียง แล้วอ่านตามให้ชัด",
 "การ์ดข้อความคาราโอเกะ เรียงบรรทัดตามต้นฉบับ แตะคำเพื่อฟัง หรืออ่านทีละการ์ดและทั้งหน้า",
 "ตอบคำถามสั้น ๆ เพื่อทบทวนความเข้าใจ",
 "ทำภารกิจสะสมดาวและปลดล็อกเหรียญนักอ่าน"
];
let soundOn=true,step=Number(sessionStorage.getItem(`p1-book-step-${unitNo}`)||0),stars=Number(localStorage.getItem(`p1-book-stars-${unitNo}`)||0);
const fullBook=window.P1_COMPLETE_PAGES[unitNo];
let fullIndex=Math.max(0,Math.min(fullBook.pages.length-1,Number(sessionStorage.getItem(`p1-full-page-${unitNo}`))||0)),originalMode=false;
let wordIndex=0,readingIndex=0,quizIndex=0,quizScore=0,gameIndex=0,gameScore=0;
const completed=new Set(JSON.parse(localStorage.getItem(`p1-book-done-${unitNo}`)||"[]"));

let speakingEl=null,speechSeq=0,karaokeRun=0,finishSpeech=null;
function pictureMarkup(word,cls=""){const idx=unit.pictures?.[word];if(idx===undefined)return "";const x=(idx%3)*50,y=Math.floor(idx/3)*50;return `<span class="word-picture ${cls}" role="img" aria-label="ภาพประกอบคำ ${word}" style="background-image:url('book/word-img/unit${unitNo}-words.webp');background-position:${x}% ${y}%"></span>`}
function clearSpeechVisual(){if(speakingEl){speakingEl.classList.remove("speaking-now");speakingEl=null}}
function stopSpeech(){clearNativeHighlights();karaokeRun++;speechSeq++;window.speechSynthesis?.cancel?.();if(finishSpeech)finishSpeech();clearSpeechVisual();stage.querySelectorAll(".line-reading").forEach(el=>el.classList.remove("line-reading"));const btn=$("#readPageKaraoke");if(btn){btn.disabled=false;btn.textContent="🔊 อ่านทั้งหน้า"}}
function keepReadingVisible(target){if(![1,3].includes(step)||!target?.getBoundingClientRect)return;const r=target.getBoundingClientRect();if(r.top<165||r.bottom>window.innerHeight-32)target.scrollIntoView({block:"center",behavior:"smooth"})}
const NORMAL_SPEECH_RATE=1.38;
function speak(text,target=null){if(!soundOn||!("speechSynthesis" in window)){clearSpeechVisual();return Promise.resolve()}const token=++speechSeq;if(window.speechSynthesis.speaking||window.speechSynthesis.pending)window.speechSynthesis.cancel();if(finishSpeech)finishSpeech();clearSpeechVisual();if(target){keepReadingVisible(target);speakingEl=target;target.classList.add("speaking-now")}return new Promise(resolve=>{const u=new SpeechSynthesisUtterance(text);u.lang="th-TH";u.rate=NORMAL_SPEECH_RATE;u.pitch=1.04;let settled=false;const done=()=>{if(settled)return;settled=true;if(token===speechSeq)clearSpeechVisual();if(finishSpeech===done)finishSpeech=null;resolve()};finishSpeech=done;u.onend=done;u.onerror=done;window.speechSynthesis.speak(u)})}
function speakQueued(items){
 const list=(items||[]).filter(x=>x&&x.text);
 if(!list.length||!soundOn||!("speechSynthesis" in window)){clearSpeechVisual();return Promise.resolve()}
 const token=++speechSeq;
 if(window.speechSynthesis.speaking||window.speechSynthesis.pending)window.speechSynthesis.cancel();
 if(finishSpeech)finishSpeech();
 clearSpeechVisual();
 const sep="\u200B",starts=[];let pos=0;
 for(const item of list){starts.push(pos);pos+=item.text.length+sep.length}
 const activate=index=>{if(token!==speechSeq||index<0||index>=list.length)return;const item=list[index];clearSpeechVisual();if(item.onStart)item.onStart();if(item.target){keepReadingVisible(item.target);speakingEl=item.target;item.target.classList.add("speaking-now")}};
 return new Promise(resolve=>{let settled=false,last=-1;const done=()=>{if(settled)return;settled=true;if(token===speechSeq){clearSpeechVisual();clearNativeHighlights()}if(finishSpeech===done)finishSpeech=null;resolve()};finishSpeech=done;const u=new SpeechSynthesisUtterance(list.map(x=>x.text).join(sep));u.lang="th-TH";u.rate=NORMAL_SPEECH_RATE;u.pitch=1.04;u.onstart=()=>{last=0;activate(0)};u.onboundary=e=>{if(token!==speechSeq)return;let idx=0;for(let i=1;i<starts.length;i++){if(starts[i]<=e.charIndex)idx=i;else break}if(idx!==last){last=idx;activate(idx)}};u.onend=done;u.onerror=done;window.speechSynthesis.speak(u)})
}
function speechToken(token){const map={"เ-":"เอ","แ-":"แอ","โ-":"โอ","ไ-":"ไอ","ใ-":"ใอ","_ือ":"อือ","เ-ีย":"เอีย","-ัว":"อัว","+":""};return map[token]??token.replace(/[“”"]/g,"")}
function bookTokenClass(token){return token==="ใบโบก"?"book-blue":token==="ใบบัว"?"book-orange":""}
function readingTokens(line){const parts=line.trim().split(/\s+/).filter(Boolean);if(unitNo<7||typeof Intl.Segmenter!=="function")return parts;const segmenter=new Intl.Segmenter("th",{granularity:"word"});return parts.flatMap(part=>part.split(/(ใบโบก|ใบบัว|ภูผา|พลายมะปิน|พลายมะค่า|พลายทะแนะ)/).filter(Boolean).flatMap(t=>/^(ใบโบก|ใบบัว|ภูผา|พลายมะปิน|พลายมะค่า|พลายทะแนะ)$/.test(t)?[t]:Array.from(segmenter.segment(t),x=>x.segment).filter(x=>x.trim())))}
function karaokeLineMarkup(line,lineIndex){const tokens=readingTokens(line);return `<div class="karaoke-line reading-card" data-k-line="${lineIndex}" role="group" aria-label="การ์ดที่ ${lineIndex+1}"><span class="reading-card-number" aria-hidden="true">${lineIndex+1}</span>${tokens.map((t,i)=>`<span class="karaoke-token" data-k-token="${i}" data-speech="${speechToken(t).replace(/"/g,"&quot;")}">${t}</span>`).join(" ")}<button type="button" class="line-speaker" aria-label="อ่านการ์ดที่ ${lineIndex+1}">🔊 อ่านการ์ดนี้</button></div>`}
function beginKaraoke(){stopSpeech();return karaokeRun}
async function readKaraokeLine(lineEl,runId=null){if(!lineEl)return;const run=runId??beginKaraoke();const tokens=[...lineEl.querySelectorAll("[data-k-token]")];lineEl.classList.add("line-reading");if(karaokeRun===run&&step===3)await speakQueued(tokens.filter(el=>document.body.contains(el)).map(el=>({text:el.dataset.speech||"",target:el})));lineEl.classList.remove("line-reading")}
async function readKaraokeTitle(titleEl,runId=null){if(!titleEl)return;const run=runId??beginKaraoke();if(karaokeRun!==run||step!==3)return;const tokens=[...titleEl.querySelectorAll("[data-k-title-token]")].filter(el=>document.body.contains(el));await speakQueued(tokens.map(el=>({text:el.dataset.speech||"",target:el})))}
async function readKaraokePage(){const run=beginKaraoke(),title=stage.querySelector("[data-k-title]"),lines=[...stage.querySelectorAll("[data-k-line]")],btn=$("#readPageKaraoke");if(btn){btn.disabled=true;btn.textContent="🔊 กำลังอ่าน..."}const els=[...(title?[...title.querySelectorAll("[data-k-title-token]")]:[]),...lines.flatMap(line=>[...line.querySelectorAll("[data-k-token]")])].filter(el=>document.body.contains(el));if(run===karaokeRun&&step===3)await speakQueued(els.map(el=>({text:el.dataset.speech||"",target:el})));if(run===karaokeRun&&btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent="🔊 อ่านทั้งหน้า"}}
function pagePictureWords(page){const text=(page?.lines||[]).join(" ");return unit.words.filter(w=>unit.pictures?.[w]!==undefined&&text.includes(w))}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function save(){localStorage.setItem(`p1-book-stars-${unitNo}`,stars);localStorage.setItem(`p1-book-done-${unitNo}`,JSON.stringify([...completed]));sessionStorage.setItem(`p1-book-step-${unitNo}`,step)}
function addStar(n=1){stars+=n;save();$("#starCount").textContent=`⭐ ${stars}`;for(let i=0;i<n;i++){const s=document.createElement("span");s.className="star-pop";s.textContent="⭐";s.style.left=`${40+Math.random()*20}%`;s.style.top=`${48+Math.random()*8}%`;document.body.append(s);setTimeout(()=>s.remove(),950)}}
function crop(segment,cls=""){const pct=(segment.y/unit.sprite.h)*100;return `<div class="book-crop ${cls}" style="aspect-ratio:${unit.sprite.w}/${segment.h}"><img src="${unit.asset}" alt="ภาพจากหนังสือภาษาพาที หน่วยที่ ${unitNo}" style="--page-y:${pct}%;" loading="eager"></div>`}
function zoomButton(segment,label="ขยายภาพ"){return `<button class="secondary-action" type="button" data-zoom="${unit.segments.indexOf(segment)}">🔎 ${label}</button>`}
function spread(indices=[0,1],cls=""){const src=`book/unit${unitNo}-cover.webp`,alt=`ภาพเปิดบทแบบคู่ 2 หน้า หน่วยที่ ${unitNo}`;if(unitNo>=7)return `<div class="stitched-cover seamless-cover ${cls}"><span class="cover-half"><img src="${src}" alt="${alt}" loading="eager"></span><span class="cover-half cover-right" aria-hidden="true"><img src="${src}" alt="" loading="eager"></span></div>`;return `<div class="stitched-cover ${cls}"><img src="${src}" alt="${alt}" loading="eager"></div>`}
function spreadZoomButton(indices=[0,1],label="ขยายภาพคู่ 2 หน้า"){return `<button class="secondary-action" type="button" data-zoom-spread="${indices.join(",")}">🔎 ${label}</button>`}
function sourceNote(){return '<span class="source-note">📘 ภาพจากหนังสือภาษาพาทีต้นฉบับ</span>'}
function setHead(){$("#unitKicker").textContent=`หน่วยที่ ${unitNo} · ภาษาพาที`;$("#unitTitle").textContent=unit.title;$("#unitLead").textContent=unit.lead;$("#activityKicker").textContent=`กิจกรรมที่ ${step+1}`;$("#activityTitle").textContent=stepNames[step];$("#activityHelp").textContent=stepHelp[step];$("#stepCount").textContent=`${step+1} / 6`;$("#starCount").textContent=`⭐ ${stars}`;$("#progressBar").style.width=`${((step+1)/6)*100}%`;$("#prevStep").disabled=step===0;$("#nextStep").textContent=step===5?"กลับสารบัญ ✓":"ถัดไป ›"}
function renderNav(){const nav=$("#stepNav");nav.innerHTML=stepNames.map((n,i)=>`<button type="button" data-step="${i}" class="${i===step?"active":""} ${completed.has(i)?"done":""}"><span>${completed.has(i)?"✓":i+1}</span><small>${n}</small></button>`).join("");nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{step=Number(b.dataset.step);render()})}
function markDone(){completed.add(step);save();renderNav()}

function renderCover(){stage.innerHTML=`<div class="center-stage cover-reading-card">${sourceNote()}<div class="spread-heading"><strong>ภาพเปิดบทแบบคู่ 2 หน้า</strong><span>หน้าซ้ายและหน้าขวาจากหนังสือต้นฉบับ</span></div>${spread([0,1],"cover-spread")}<div class="cover-title-karaoke">${unit.title.split(/\s+/).map(w=>`<button class="native-word" type="button" data-cover-word="${escapeText(w)}">${escapeText(w)}</button>`).join(' ')}</div><div class="word-controls"><button class="big-action" id="readCoverTitle">🔊 อ่านชื่อบท</button><button class="secondary-action" id="stopCoverTitle">⏹ หยุด</button>${spreadZoomButton([0,1])}<button class="big-action" id="coverStart">เริ่มเรียนหน่วยนี้ →</button></div></div>`;
 const words=[...stage.querySelectorAll('[data-cover-word]')];words.forEach(b=>b.onclick=()=>{beginKaraoke();speak(b.dataset.coverWord,b)});
 $('#readCoverTitle').onclick=async e=>{const run=beginKaraoke(),btn=e.currentTarget;btn.disabled=true;if(run===karaokeRun&&step===0)await speakQueued(words.map(w=>({text:w.dataset.coverWord,target:w})));if(document.body.contains(btn))btn.disabled=false};$('#stopCoverTitle').onclick=stopSpeech;
 $("#coverStart").onclick=()=>{markDone();step=3;fullIndex=0;render()}}
function vocabMarkup(){return (unit.vocabIndices||[2]).map(i=>`<div class="center-stage">${crop(unit.segments[i],"reading")}${zoomButton(unit.segments[i],"ขยายหน้าคำศัพท์")}</div>`).join("")}
function renderVocab(){const pages=fullBook.pages.filter(p=>window.P1_VOCAB_CARDS?.[p.page]);stage.innerHTML=`<div class="vocab-activity"><div class="karaoke-controls"><button class="big-action" id="readAllWords">🔊 ฟังคำทั้งหมด</button><button class="secondary-action" id="stopVocabCards">⏹ หยุด</button></div>${pages.map(vocabCardsMarkup).join('')}</div>`;bindVocabularyCards();$('#readAllWords').onclick=readAllVocabulary;$('#stopVocabCards').onclick=stopSpeech}
function renderWordPractice(){const w=unit.words[wordIndex];stage.innerHTML=`<div class="word-practice"><div class="word-stage"><span class="word-number">คำที่ ${wordIndex+1} จาก ${unit.words.length}</span><div class="practice-visual">${pictureMarkup(w,"practice-picture")}</div><strong id="practiceWord">${w}</strong><p>ฟัง → อ่านตาม → กด “อ่านได้แล้ว”</p><div class="word-controls"><button class="secondary-action" id="speakWord">🔊 ฟังคำ</button><button class="big-action" id="wordDone">✓ อ่านได้แล้ว</button></div></div><div class="instruction-card">${sourceNote()}<h3>มองหาคำในภาพต้นฉบับ</h3><p>ถ้าคำนี้มีภาพประกอบ ระบบจะแสดงภาพจากหน้ารู้จักคำ นำเรื่องให้ด้วย</p><div style="margin-top:14px">${crop(unit.segments[2],"compact")}</div></div></div>`;$("#speakWord").onclick=()=>speak(w,$("#practiceWord"));$("#wordDone").onclick=()=>{addStar(1);wordIndex++;if(wordIndex>=unit.words.length){wordIndex=0;markDone();stage.innerHTML=`<div class="completion"><div><div class="medal">🌟</div><h3>อ่านครบทุกคำแล้ว</h3><p>เก่งมาก ได้ฝึกคำสำคัญครบ ${unit.words.length} คำ</p><button class="big-action" id="goReading">ไปบทฝึกอ่าน →</button></div></div>`;$("#goReading").onclick=()=>{step=3;render()}}else renderWordPractice()}}
function pctStyle(box){return `left:${box.x}%;top:${box.y}%;width:${box.w}%;height:${box.h}%;`}
function karaokeExactLineMarkup(line,lineIndex){const tokens=line.trim().split(/\s+/).filter(Boolean);return `<button type="button" class="karaoke-line exact-k-line" data-k-line="${lineIndex}" aria-label="ฟังบรรทัด ${lineIndex+1}">${tokens.map((t,i)=>`<span class="karaoke-token ${bookTokenClass(t)}" data-k-token="${i}" data-speech="${speechToken(t).replace(/"/g,"&quot;")}">${t}</span>`).join(" ")}</button>`}
function karaokeTitleMarkup(title,box){const tokens=title.trim().split(/\s+/).filter(Boolean),maxChars=Math.max(1,title.replace(/\s+/g,"").length),byW=Math.min(5.2,Math.max(2.4,box.w/(maxChars*.55))),byH=Math.min(5.2,Math.max(2.4,box.h*.82)),fs=Math.min(byW,byH);const titleClass=title.includes("อธิบายเพิ่ม")?" knowledge-title":"";return `<button type="button" class="exact-page-title${titleClass}" data-k-title style="${pctStyle(box)}--tfs:${fs.toFixed(2)}cqw;" aria-label="ฟังชื่อเรื่อง">${tokens.map((t,i)=>`<span class="exact-title-token ${bookTokenClass(t)}" data-k-title-token="${i}" data-speech="${speechToken(t).replace(/"/g,"&quot;")}">${t}</span>`).join(" ")}</button>`}
function pageCropMarkup(src,rect,cls=""){if(!src||!rect)return "";const [x,y,w,h]=rect,imgW=10000/w;return `<div class="exact-page-crop ${cls}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"><img src="${src}" alt="" aria-hidden="true" style="width:${imgW.toFixed(3)}%;transform:translate(-${x}%,-${y}%);"></div>`}
function readingArtMarkup(rect,index){
 const segment=unit.segments[3+readingIndex];
 if(!segment)return "";
 const [x,y,w,h]=rect;
 const cropWidth=unit.sprite.w*w/100;
 const cropHeight=segment.h*h/100;
 const top=(segment.y+segment.h*y/100)/cropHeight*100;
 return `<div class="reading-art-crop" style="width:${w}%;aspect-ratio:${cropWidth}/${cropHeight}"><img src="${unit.asset}" alt="ภาพประกอบบทอ่าน ${index+1}" style="width:${10000/w}%;left:${-x/w*100}%;top:${-top}%" loading="eager"></div>`;
}
function renderExactBookPage(page){
 const crops=window.P1_READING_CROPS?.[unitNo]?.[readingIndex];
 const arts=page.illustration?`<img class="reading-illustration" src="${page.illustration}" alt="ภาพประกอบ${page.title} ${page.bookPage}" loading="eager">`:(page.fullPage?[]:(crops?.arts||[])).map(readingArtMarkup).join("");
 const titleTokens=page.title.trim().split(/\s+/).filter(Boolean);
 const title=`<div class="reading-flow-title" data-k-title role="group" aria-label="ชื่อเรื่อง">${titleTokens.map((t,i)=>`<span class="exact-title-token ${bookTokenClass(t)}" data-k-title-token="${i}" data-speech="${speechToken(t).replace(/"/g,"&quot;")}">${t}</span>`).join(" ")}<button type="button" class="title-speaker" aria-label="ฟังชื่อเรื่อง">🔊</button></div>`;
 return `<article class="reading-flow-page" aria-label="บทอ่าน ${page.bookPage}">${title}${arts?`<div class="reading-art-gallery illustration-card">${arts}</div>`:`<div class="native-context-picture illustration-card">${spread([0,1])}<small>ภาพประกอบประจำบท</small></div>`}<div class="karaoke-text">${page.lines.map((line,i)=>karaokeLineMarkup(line,i)).join("")}</div><p class="reading-flow-page-number">${page.bookPage}</p></article>`;
}
function fullPageMarkup(p){return `<div class="complete-original original-layout-card" style="aspect-ratio:${fullBook.w}/${p.h}"><img src="${fullBook.asset}" alt="ต้นฉบับ หน่วยที่ ${unitNo} ${p.label}" style="top:${-p.y/p.h*100}%" loading="eager"></div>`}
function changeFullPage(index){stopSpeech();fullIndex=Math.max(0,Math.min(fullBook.pages.length-1,index));originalMode=false;renderReading();stage.scrollIntoView({block:"start",behavior:"smooth"})}
function vocabCardArt(p,rect,word,index){const ratio=fullBook.w*rect[2]/(p.h*rect[3]);return nativeArtMarkup(p,rect,index).replace('<div class="native-art"','<span class="native-art vocab-card-art"').replace('</div>','</span>').replace('style="aspect-ratio:',`style="max-width:${Math.round(145*ratio)}px;aspect-ratio:`).replace(`alt="ภาพประกอบหน้านี้ ${index+1}"`,`alt="ภาพประกอบคำ ${escapeText(word)}"`)}
function vocabCardsMarkup(p){const data=window.P1_VOCAB_CARDS?.[p.page];if(!data)return '';
 const card=(item,i)=>{const illustrated=i<data.illustratedCount;const art=item.wordSprite?pictureMarkup(item.word,'vocab-card-sprite'):item.pictures.map((r,j)=>vocabCardArt(p,r,item.word,j)).join('');return `<button type="button" class="${illustrated?'vocab-picture-card':'vocab-extra-card'}" data-vocab-card="${i}" data-vocab-page="${p.page}" aria-label="อ่านคำ ${escapeText(item.word)}">${illustrated?`<span class="vocab-card-pictures">${art}</span>`:''}<span class="vocab-card-label">${escapeText(item.word)}</span><span class="vocab-card-audio" aria-hidden="true">🔊</span></button>`};
 return `<section class="vocab-card-section" aria-label="การ์ดคำศัพท์ ${escapeText(p.label)}"><h3>รู้จักคำ นำเรื่อง</h3><p class="vocab-card-hint">แตะการ์ดเพื่อฟังคำ แล้วอ่านตาม</p><div class="vocab-picture-grid">${data.cards.slice(0,data.illustratedCount).map(card).join('')}</div>${data.cards.length>data.illustratedCount?`<h4 class="vocab-extras-title">คำเพิ่มเติม</h4><div class="vocab-extra-grid">${data.cards.slice(data.illustratedCount).map((c,i)=>card(c,i+data.illustratedCount)).join('')}</div>`:''}</section>`;
}
async function readVocabularyCard(b,run=null){const id=run??beginKaraoke(),card=window.P1_VOCAB_CARDS?.[b.dataset.vocabPage]?.cards[Number(b.dataset.vocabCard)];if(!card||id!==karaokeRun||!document.body.contains(b))return;await speak(card.word,b)}
function bindVocabularyCards(){stage.querySelectorAll('[data-vocab-card]').forEach(b=>b.onclick=()=>readVocabularyCard(b))}
async function readAllVocabulary(){const run=beginKaraoke(),buttons=[...stage.querySelectorAll('[data-vocab-card]')],btn=$('#readPageKaraoke')||$('#readAllWords'),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='🔊 กำลังอ่าน...'}if(run===karaokeRun){const items=buttons.filter(b=>document.body.contains(b)).map(b=>{const card=window.P1_VOCAB_CARDS?.[b.dataset.vocabPage]?.cards[Number(b.dataset.vocabCard)];return {text:card?.word||'',target:b}});await speakQueued(items)}if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent=old}}

function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function currentNative(){return window.P1_PAGE_KARAOKE[fullBook.pages[fullIndex].page]}
function nativeWordMarkup(t,r,i,hotspot=false){const b=t.b;return `<button type="button" class="native-word ${bookTokenClass(t.t)} ${hotspot?'native-hotspot':''}" data-native-word="${r}:${i}" aria-label="อ่านคำ ${escapeText(t.t)}" title="อ่าน ${escapeText(t.t)}" ${hotspot?`style="left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%"`:''}>${hotspot?'<span class="visually-hidden">'+escapeText(t.t)+'</span>':escapeText(t.t)}</button>`}
function nativeRowsMarkup(data){
 const left=Math.min(...data.rows.flat().map(t=>t.b[0]));
 return `<div class="native-reading-lines source-text-cards">${data.rows.map((row,r)=>{
  const indent=Math.max(0,row[0].b[0]-left);
  const words=row.map((t,i)=>{
   const prev=row[i-1],gap=prev?Math.max(0,t.b[0]-prev.b[0]-prev.b[2]):0;
   const space=gap<.3?0:Math.min(6,gap/Math.max(1,t.b[3]) * 1.35);
   return nativeWordMarkup(t,r,i).replace(' title=',` style="margin-inline-start:${space.toFixed(3)}em" title=`);
  }).join('');
  return `<div class="native-reading-row reading-card" role="group" aria-label="การ์ดที่ ${r+1}"><span class="reading-card-number" aria-hidden="true">${r+1}</span><button type="button" class="native-read-row" data-native-line="${r}" aria-label="อ่านการ์ดที่ ${r+1}: ${escapeText(row.map(t=>t.t).join(' '))}">🔊 อ่านการ์ดนี้</button><div class="native-row-words" style="--source-indent:${Math.min(35,indent)}%">${words}</div></div>`;
 }).join('')}</div>`;
}
function nativeArtMarkup(p,rect,i){const [x,y,w,h]=rect,cw=fullBook.w*w/100,ch=p.h*h/100;return `<div class="native-art" style="aspect-ratio:${cw}/${ch}"><img src="${fullBook.asset}" alt="ภาพประกอบหน้านี้ ${i+1}" style="width:${10000/w}%;left:${-x/w*100}%;top:${-(p.y+p.h*y/100)/ch*100}%" loading="eager"></div>`}
function nativePlacedArtMarkup(p,rect,i){const [x,y,w,h]=rect,cw=fullBook.w*w/100,ch=p.h*h/100;return `<div class="native-layout-art" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;aspect-ratio:${cw}/${ch}"><img src="${fullBook.asset}" alt="ภาพประกอบหน้านี้ ${i+1}" style="width:${10000/w}%;left:${-x/w*100}%;top:${-(p.y+p.h*y/100)/ch*100}%" loading="eager"></div>`}
function nativePlacedArtCopyMarkup(p,sourceRect,placeRect,alt="ภาพประกอบหน้านี้"){const [sx,sy,sw,sh]=sourceRect,[x,y,w,h]=placeRect,cw=fullBook.w*sw/100,ch=p.h*sh/100;return `<div class="native-layout-art" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;aspect-ratio:${cw}/${ch}"><img src="${fullBook.asset}" alt="${alt}" style="width:${10000/sw}%;left:${-sx/sw*100}%;top:${-(p.y+p.h*sy/100)/ch*100}%" loading="eager"></div>`}
function nativeSourceRowMarkup(p,row,r){
 const x1=Math.min(...row.map(t=>t.b[0])),y1=Math.min(...row.map(t=>t.b[1]));
 const x2=Math.max(...row.map(t=>t.b[0]+t.b[2])),y2=Math.max(...row.map(t=>t.b[1]+t.b[3]));
 const w=Math.max(2,x2-x1),h=Math.max(3.7,y2-y1);
 const words=row.map((t,i)=>{const b=t.b,left=(b[0]-x1)/w*100,top=(b[1]-y1)/h*100,fs=Math.max(2.15,Math.min(4.45,b[3]*p.h/fullBook.w*.72));return `<button type="button" class="native-word native-layout-word ${bookTokenClass(t.t)}" data-native-word="${r}:${i}" aria-label="อ่านคำ ${escapeText(t.t)}" title="อ่าน ${escapeText(t.t)}" style="left:${left.toFixed(3)}%;top:${top.toFixed(3)}%;--native-fs:${fs.toFixed(2)}cqw">${escapeText(t.t)}</button>`}).join('');
 const phonicsClass=nativePhonicsSectionRow(r)?' native-phonics-row':'';
 return `<div class="native-layout-row reading-card${phonicsClass}" data-native-row="${r}" style="left:${x1}%;top:${y1}%;width:${w}%;height:${h}%"><button type="button" class="native-layout-speaker" data-native-line="${r}" aria-label="อ่านการ์ดที่ ${r+1}: ${escapeText(row.map(t=>t.t).join(' '))}" title="อ่านการ์ดนี้">🔊</button>${words}</div>`;
}
function nativeGridArtMarkup(p,rect,alt){const [x,y,w,h]=rect,cw=fullBook.w*w/100,ch=p.h*h/100;return `<span class="native-grid-art" style="aspect-ratio:${cw}/${ch}"><img src="${fullBook.asset}" alt="${escapeText(alt)}" style="width:${10000/w}%;left:${-x/w*100}%;top:${-(p.y+p.h*y/100)/ch*100}%" loading="eager"></span>`}
function nativePage19GridMarkup(p,data){
 const pairs=[
  [[19.44,37.179,15.586,11.52],[78.193,26.315,10.269,11.556]],
  [[27.116,26.906,18.968,9.947],[78.193,26.315,10.269,11.556]],
  [[19.44,37.179,15.586,11.52],[64.408,37.741,14.19,10.027]],
  [[27.116,49.148,18.968,10.159],[77.439,50.188,8.436,10.115]],
  [[19.44,59.445,15.268,11.52],[63.867,60.772,12.447,9.553]],
  [[27.116,71.555,18.968,10.079],[78.089,71.538,8.436,10.115]]
 ];
 return `<div class="native-three-col-grid" aria-label="รูปซ้าย ข้อความ และรูปขวา จัดตรงกัน 3 คอลัมน์">${data.rows.map((row,r)=>`<div class="native-grid-row reading-card" data-native-row="${r}"><div class="native-grid-cell native-grid-left">${nativeGridArtMarkup(p,pairs[r][0],`ภาพประกอบด้านซ้ายแถวที่ ${r+1}`)}</div><div class="native-grid-cell native-grid-text"><button type="button" class="native-grid-speaker" data-native-line="${r}" aria-label="อ่านการ์ดที่ ${r+1}: ${escapeText(row.map(t=>t.t).join(' '))}" title="อ่านการ์ดนี้">🔊</button><div class="native-grid-words">${row.map((t,i)=>`<button type="button" class="native-word native-grid-word ${bookTokenClass(t.t)}" data-native-word="${r}:${i}" aria-label="อ่านคำ ${escapeText(t.t)}" title="อ่าน ${escapeText(t.t)}">${escapeText(t.t)}</button>`).join('')}</div></div><div class="native-grid-cell native-grid-right">${nativeGridArtMarkup(p,pairs[r][1],`ภาพประกอบด้านขวาแถวที่ ${r+1}`)}</div></div>`).join('')}</div>`;
}
function nativeSourceLayoutMarkup(p,data){
 if(p.page===19)return nativePage19GridMarkup(p,data);
 const seen=new Set(),arts=(data.arts||[]).filter(r=>{const k=r.map(n=>Number(n).toFixed(3)).join(':');if(seen.has(k))return false;seen.add(k);return true});
 // Page 18: restore the illustrations for the first row "ใบโบก มี ตา".
 // The artwork detector starts from the second row, so copy the matching
 // blue-elephant and eye crops already present later on the same source page.
 const firstRowMissingArt=p.page===18
  ? nativePlacedArtCopyMarkup(p,[16.98,37.178,15.586,11.52],[16.98,15.00,15.586,11.52],"ภาพใบโบกประกอบข้อความ ใบโบก มี ตา")
   +nativePlacedArtCopyMarkup(p,[64.95,25.803,16.434,9.15],[64.95,16.18,16.434,9.15],"ภาพตาประกอบข้อความ ใบโบก มี ตา")
  : '';
 return `<div class="native-source-layout-wrap"><div class="native-source-layout" style="aspect-ratio:${fullBook.w}/${p.h}" aria-label="ข้อความและภาพจัดวางตามต้นฉบับ">${firstRowMissingArt}${arts.map((r,i)=>nativePlacedArtMarkup(p,r,i)).join('')}${data.rows.map((row,r)=>nativeSourceRowMarkup(p,row,r)).join('')}</div></div>`;
}
function nativePageMarkup(p,original){if(!original&&window.P1_VOCAB_CARDS?.[p.page])return vocabCardsMarkup(p);const data=currentNative();if(original){const plain=fullPageMarkup(p);return plain.replace('</div>',`<div class="native-hotspots">${data.rows.map((row,r)=>row.map((t,i)=>nativeWordMarkup(t,r,i,true)).join('')).join('')}</div></div>`)+`<details class="native-word-details"><summary>รายการคำและชุดคำที่กดอ่านได้</summary>${nativeRowsMarkup(data)}</details>`}
 return `<article class="native-flow-page source-faithful-page" aria-label="คาราโอเกะ ${escapeText(p.label)}"><p class="native-instruction">แตะคำเพื่อฟังทีละคำ หรือกด 🔊 ข้างบรรทัด เพื่ออ่านตามทีละชุด · ภาพและข้อความจัดวางตามต้นฉบับ</p>${nativeSourceLayoutMarkup(p,data)}</article>`;
}
function clearNativeHighlights(){stage.querySelectorAll('.native-reading-active,.native-row-active').forEach(el=>el.classList.remove('native-reading-active','native-row-active'))}
async function readNativeWord(r,i,run=null,highlightRow=true){const id=run??beginKaraoke(),token=currentNative()?.rows[r]?.[i];if(!token||id!==karaokeRun||step!==3)return;clearNativeHighlights();const peers=[...stage.querySelectorAll(`[data-native-word="${r}:${i}"]`)];const showRow=highlightRow&&!nativePhonicsSectionRow(r);peers.forEach(el=>{el.classList.add('native-reading-active');if(showRow)el.closest('.reading-card,.native-layout-row')?.classList.add('native-row-active')});const target=peers.find(el=>!el.closest('details:not([open])'))||peers[0];await speak(token.s,target);if(id===karaokeRun)clearNativeHighlights()}
const nativeVowelSounds=new Set(["อะ","อา","อิ","อี","อึ","อือ","อุ","อู","เอ","แอ","โอ","ไอ","ใอ","อำ","เอา","เอะ","แอะ","เอีย","อัว","โอะ","เอาะ","ออ","เออะ","เออ","เอือ"]);
function nativeTokenCenter(t){return [t.b[0]+t.b[2]/2,t.b[1]+t.b[3]/2]}
function nativeConsonantToken(t){return /^[ก-ฮ]$/.test(t?.t||"")}
function nativeVowelMarkerToken(t){return !!t&&nativeVowelSounds.has(t.s)&&t.t!==t.s&&!nativeConsonantToken(t)}
function nativePhonicsSectionRow(r){
 const rows=currentNative()?.rows||[];
 let start=-1;
 for(let i=0;i<r;i++){const ts=rows[i].map(t=>t.t);if(ts.includes("แจก")&&ts.includes("ลูก"))start=i}
 if(start<0||r<=start)return false;
 for(let i=start+1;i<=r&&i<rows.length;i++){
  const ts=rows[i].map(t=>t.t);
  if((ts.includes("อ่าน")&&ts.includes("สะกด")&&ts.includes("คำ"))||ts.includes("ฝึก"))return false;
 }
 return true;
}
function nativePhonicsSteps(r){
 const data=currentNative(),rows=data?.rows||[],row=rows[r];
 if(!row)return null;
 let start=-1;
 for(let i=0;i<r;i++){const ts=rows[i].map(t=>t.t);if(ts.includes("แจก")&&ts.includes("ลูก"))start=i}
 if(start<0||r<=start)return null;
 let end=rows.length;
 for(let i=start+1;i<rows.length;i++){
  const ts=rows[i].map(t=>t.t);
  if((ts.includes("อ่าน")&&ts.includes("สะกด")&&ts.includes("คำ"))||ts.includes("ฝึก")){end=i;break}
 }
 if(r>=end)return null;
 const markers=[];
 for(let rr=start+1;rr<end;rr++)for(let i=0;i<rows[rr].length;i++){const t=rows[rr][i];if(nativeVowelMarkerToken(t))markers.push({r:rr,i,t})}
 if(!markers.length)return null;
 const consonants=row.map((t,i)=>nativeConsonantToken(t)?i:-1).filter(i=>i>=0);
 if(!consonants.length)return null;
 const steps=[];
 for(let g=0;g<consonants.length;g++){
  const ci=consonants[g],next=consonants[g+1]??row.length;
  const results=[];
  for(let i=ci+1;i<next;i++){const t=row[i];if(!nativeVowelMarkerToken(t)&&!["อ่าน","แจก","ลูก"].includes(t.t))results.push({i,t})}
  if(!results.length)continue;
  steps.push({r,i:ci});
  for(const result of results){
   let marker=null;
   for(let i=ci+1;i<result.i;i++)if(nativeVowelMarkerToken(row[i]))marker={r,i,t:row[i]};
   if(!marker){
    const [x,y]=nativeTokenCenter(result.t);
    let best=Infinity;
    for(const m of markers){const [mx,my]=nativeTokenCenter(m.t),score=Math.abs(x-mx)*2+Math.abs(y-my);if(score<best){best=score;marker=m}}
   }
   if(marker)steps.push({r:marker.r,i:marker.i});
   steps.push({r,i:result.i});
  }
 }
 return steps.length>=3?steps:null;
}
function nativeRowSpeechItems(r){
 const rows=currentNative()?.rows||[],row=rows[r];
 if(!row)return [];
 const phonics=!!nativePhonicsSteps(r),activeSteps=phonics?nativePhonicsSteps(r):row.map((_,i)=>({r,i}));
 return activeSteps.map(item=>{const token=rows[item.r]?.[item.i],peers=[...stage.querySelectorAll(`[data-native-word="${item.r}:${item.i}"]`)],target=peers.find(el=>!el.closest('details:not([open])'))||peers[0];return {text:token?.s||"",target,onStart:()=>{clearNativeHighlights();peers.forEach(el=>{el.classList.add('native-reading-active');if(!phonics)el.closest('.reading-card,.native-layout-row')?.classList.add('native-row-active')})}}}).filter(x=>x.text)
}
async function readNativeRow(r,run=null){const id=run??beginKaraoke();if(id!==karaokeRun||step!==3)return;await speakQueued(nativeRowSpeechItems(r));if(id===karaokeRun)clearNativeHighlights()}
async function readNativePage(){const id=beginKaraoke(),rows=currentNative()?.rows||[],btn=$('#readPageKaraoke');if(btn){btn.disabled=true;btn.textContent='🔊 กำลังอ่าน...'}const items=rows.flatMap((_,r)=>nativeRowSpeechItems(r));if(id===karaokeRun&&step===3)await speakQueued(items);if(id===karaokeRun&&document.body.contains(btn)){btn.disabled=false;btn.textContent='🔊 อ่านทั้งหน้า'}}
function bindNative(){stage.querySelectorAll('[data-native-word]').forEach(b=>b.onclick=()=>{const [r,i]=b.dataset.nativeWord.split(':').map(Number);readNativeWord(r,i)});stage.querySelectorAll('[data-native-line]').forEach(b=>b.onclick=()=>readNativeRow(Number(b.dataset.nativeLine)))}
function bindFlowWords(){stage.querySelectorAll('[data-k-token],[data-k-title-token]').forEach(el=>{el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label','อ่านคำ '+el.textContent);const read=e=>{e.stopPropagation();beginKaraoke();speak(el.dataset.speech,el)};el.onclick=read;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();read(e)}}})}
function renderReading(){
 stopSpeech();sessionStorage.setItem(`p1-full-page-${unitNo}`,fullIndex);
 const p=fullBook.pages[fullIndex],cover=p.kind==='cover',page=p.readingIndex!==undefined?unit.readingPages[p.readingIndex]:null;
 if(page)readingIndex=p.readingIndex;
 // Real text cards follow the source row boundaries and spacing on every page.
 const reviewed=false;
 const useNative=!cover&&(!reviewed||originalMode);
 const controls=`<div class="karaoke-controls exact-controls"><button class="big-action" id="readPageKaraoke">🔊 อ่านทั้งหน้า</button><button class="secondary-action" id="stopKaraoke">⏹ หยุด</button><button class="secondary-action" id="restartKaraoke">↻ อ่านใหม่</button></div>`;
 const content=cover?`<article class="cover-reading-card" aria-label="การ์ดหน้าปก">${spread([0,1],'cover-spread')}<div class="karaoke-text cover-karaoke">${karaokeLineMarkup('บทที่ '+unitNo,0)}${karaokeLineMarkup(unit.title,1)}</div></article>`:useNative?nativePageMarkup(p,originalMode):renderExactBookPage(page);
 stage.innerHTML=`<div class="reading-sim-wrap complete-reader"><div class="complete-page-toolbar"><label for="fullPageSelect">เลือกหน้าในบท</label><select id="fullPageSelect">${fullBook.pages.map((item,i)=>`<option value="${i}" ${i===fullIndex?'selected':''}>${item.label}</option>`).join('')}</select><p class="complete-count">ครบ ${fullBook.end-fullBook.start+1} หน้าต้นฉบับ · ${fullIndex+1} / ${fullBook.pages.length} ช่วงอ่าน · ทุกหน้ากดฟังได้</p></div><div class="complete-nav"><button class="secondary-action" data-page-prev ${fullIndex===0?'disabled':''}>‹ หน้าก่อน</button><strong>${p.label}</strong><button class="secondary-action" data-page-next ${fullIndex===fullBook.pages.length-1?'disabled':''}>หน้าถัดไป ›</button></div><div class="complete-view-tools">${cover?'':`<button class="secondary-action" id="toggleFullOriginal">${originalMode?'🃏 กลับการ์ดข้อความ':'📖 ดูภาพต้นฉบับ'}</button>`}<button class="secondary-action" id="zoomFullPage">🔎 ขยายหน้าต้นฉบับ</button></div>${controls}<p class="complete-hint">อ่านทั้งหน้า หรือแตะคำเพื่อฟังเฉพาะคำ · ${cover?'อ่านชื่อบททีละการ์ด':useNative?(window.P1_VOCAB_CARDS?.[p.page]&&!originalMode?'แตะการ์ดเพื่อฟังคำพร้อมดูภาพ':(originalMode?'ข้อความเรียงตามต้นฉบับ · เปิดรายการคำด้านล่างเพื่ออ่านทีละบรรทัด':'กดอ่านการ์ดนี้ เพื่อฟังชุดคำ / ประโยค')):'กดอ่านการ์ดนี้ เพื่อฟังทั้งประโยค / วรรค'}</p>${content}<div class="complete-nav bottom-page-nav"><button class="secondary-action" data-page-prev ${fullIndex===0?'disabled':''}>‹ หน้าก่อน</button><span>${fullIndex+1} / ${fullBook.pages.length}</span><button class="big-action" data-page-next ${fullIndex===fullBook.pages.length-1?'disabled':''}>หน้าถัดไป ›</button></div>${fullIndex===fullBook.pages.length-1?'<div class="word-controls"><button class="big-action" id="finishFullChapter">อ่านจบบทแล้ว ไปทบทวน →</button></div>':''}</div>`;
 $('#fullPageSelect').onchange=e=>changeFullPage(Number(e.target.value));
 stage.querySelectorAll('[data-page-prev]').forEach(b=>b.onclick=()=>changeFullPage(fullIndex-1));
 stage.querySelectorAll('[data-page-next]').forEach(b=>b.onclick=()=>changeFullPage(fullIndex+1));
 const toggle=$('#toggleFullOriginal');if(toggle)toggle.onclick=()=>{originalMode=!originalMode;renderReading()};
 $('#zoomFullPage').onclick=()=>{stopSpeech();if(cover){zoomSpread([0,1]);return}$('#zoomContent').innerHTML=fullPageMarkup(p);$('#zoomDialog').showModal()};
 if(useNative){bindNative();bindVocabularyCards()}else{stage.querySelectorAll('[data-k-line]').forEach(line=>line.onclick=()=>readKaraokeLine(line));const title=stage.querySelector('[data-k-title]');if(title)title.onclick=()=>readKaraokeTitle(title);bindFlowWords()}
 const readPage=useNative?(window.P1_VOCAB_CARDS?.[p.page]&&!originalMode?readAllVocabulary:readNativePage):readKaraokePage;$('#readPageKaraoke').onclick=readPage;$('#stopKaraoke').onclick=stopSpeech;$('#restartKaraoke').onclick=readPage;
 const finish=$('#finishFullChapter');if(finish)finish.onclick=()=>{markDone();step=4;render()};
}
function renderQuiz(){if(quizIndex>=unit.review.length){markDone();stage.innerHTML=`<div class="completion"><div><div class="medal">🏅</div><h3>ทบทวนจบแล้ว</h3><p>ตอบถูก ${quizScore} จาก ${unit.review.length} ข้อ</p><button class="big-action" id="toGame">ไปเกมสะสมดาว →</button></div></div>`;$("#toGame").onclick=()=>{step=5;render()};return}const q=unit.review[quizIndex];stage.innerHTML=`<div class="quiz"><div class="quiz-box"><div class="quiz-meta"><span>ข้อ ${quizIndex+1} / ${unit.review.length}</span><span>คะแนน ${quizScore}</span></div><h3>${q.q}</h3><div class="quiz-options">${shuffle(q.o).map(o=>`<button class="quiz-option ${unit.pictures?.[o]!==undefined?"has-picture":""}" data-answer="${o.replace(/"/g,"&quot;")}">${pictureMarkup(o,"option-picture")}<span>${o}</span></button>`).join("")}</div><p id="quizFeedback" class="feedback"></p></div><div class="instruction-card"><strong>ทบทวนจากภาพต้นฉบับ</strong><p>คำที่มีภาพประกอบจะแสดงภาพจากหนังสือเพื่อช่วยเชื่อมโยงความหมาย</p><div style="margin-top:13px">${crop(unit.segments[2],"compact")}</div></div></div>`;stage.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{const buttons=[...stage.querySelectorAll("[data-answer]")],ok=b.dataset.answer===q.a;buttons.forEach(x=>x.disabled=true);b.classList.add(ok?"correct":"wrong");const correct=buttons.find(x=>x.dataset.answer===q.a);if(!ok&&correct)correct.classList.add("correct");const fb=$("#quizFeedback");fb.textContent=ok?"✓ ถูกต้อง เก่งมาก!":`คำตอบที่ถูกคือ “${q.a}”`;fb.className=`feedback ${ok?"good":"bad"}`;if(ok){quizScore++;addStar(1)}speak(q.a,ok?b:correct).then(()=>setTimeout(()=>{quizIndex++;renderQuiz()},220))})}
function gameQuestion(){const qs=unit.review;if(gameIndex>=qs.length){completed.add(5);save();const perfect=gameScore===qs.length;if(perfect)addStar(2);stage.innerHTML=`<div class="completion"><div><div class="medal">${perfect?"🏆":"🎖️"}</div><h3>${perfect?"นักอ่านดาวทอง!":"ผ่านด่านแล้ว!"}</h3><p>ภารกิจเกม ${gameScore}/${qs.length} · ดาวสะสมทั้งหมด ${stars}</p><div class="unit-links"><button class="big-action" id="playAgain">เล่นเกมอีกครั้ง</button><a class="secondary-action" href="index.html">กลับสารบัญ</a>${unitNo<Math.max(...Object.keys(units).map(Number))?`<a class="secondary-action" href="lesson.html?unit=${unitNo+1}">ไปหน่วยถัดไป →</a>`:""}</div></div></div>`;$("#playAgain").onclick=()=>{gameIndex=0;gameScore=0;renderGame()};renderNav();return}const q=qs[gameIndex];stage.innerHTML=`<div class="game-shell"><div class="reward-card"><div class="trophy">⭐</div><h3>ภารกิจนักอ่าน</h3><div class="xp">${stars} ดาว</div><p>ตอบให้ถูกเพื่อสะสมดาว<br>ครบทุกข้อรับเหรียญผ่านด่าน</p><div class="book-mini">${crop(unit.segments[2],"compact")}</div></div><div class="mission"><span class="kicker">ภารกิจ ${gameIndex+1} / ${qs.length}</span><h3>${q.q}</h3><div class="mission-options">${shuffle(q.o).map(o=>`<button class="${unit.pictures?.[o]!==undefined?"has-picture":""}" data-game-answer="${o.replace(/"/g,"&quot;")}">${pictureMarkup(o,"option-picture")}<span>${o}</span></button>`).join("")}</div><p id="gameFeedback" class="feedback"></p></div></div>`;stage.querySelectorAll("[data-game-answer]").forEach(b=>b.onclick=()=>{const buttons=[...stage.querySelectorAll("[data-game-answer]")],ok=b.dataset.gameAnswer===q.a;buttons.forEach(x=>x.disabled=true);b.classList.add(ok?"correct":"wrong");const correct=buttons.find(x=>x.dataset.gameAnswer===q.a);if(!ok&&correct)correct.classList.add("correct");const fb=$("#gameFeedback");fb.textContent=ok?"⭐ ได้ดาว!":`คำตอบคือ “${q.a}”`;fb.className=`feedback ${ok?"good":"bad"}`;if(ok){gameScore++;addStar(1)}speak(q.a,ok?b:correct).then(()=>setTimeout(()=>{gameIndex++;gameQuestion()},220))})}
function renderGame(){gameQuestion()}
function zoomSegment(index){const seg=unit.segments[index];$("#zoomContent").innerHTML=crop(seg,"reading");$("#zoomDialog").showModal()}
function zoomSpread(indices){$("#zoomContent").innerHTML=spread(indices,"zoom-spread");$("#zoomDialog").showModal()}
function bindZoom(){stage.querySelectorAll("[data-zoom]").forEach(b=>b.onclick=()=>zoomSegment(Number(b.dataset.zoom)));stage.querySelectorAll("[data-zoom-spread]").forEach(b=>b.onclick=()=>zoomSpread(b.dataset.zoomSpread.split(",").map(Number)))}
function resetStep(){stopSpeech();if(step===2)wordIndex=0;if(step===3){readingIndex=0;fullIndex=0;originalMode=false}if(step===4){quizIndex=0;quizScore=0}if(step===5){gameIndex=0;gameScore=0}render()}
function render(){stopSpeech();step=Math.max(0,Math.min(5,step));save();setHead();renderNav();if(step===0)renderCover();if(step===1)renderVocab();if(step===2)renderWordPractice();if(step===3)renderReading();if(step===4)renderQuiz();if(step===5)renderGame();bindZoom();window.scrollTo({top:0,behavior:"smooth"})}
$("#prevStep").onclick=()=>{if(step>0){step--;render()}};
$("#nextStep").onclick=()=>{markDone();if(step<5){step++;render()}else location.href="index.html"};
$("#restartStep").onclick=resetStep;
$("#soundToggle").onclick=e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?"🔊":"🔇";e.currentTarget.setAttribute("aria-pressed",String(soundOn));if(!soundOn)stopSpeech()};
$("#closeZoom").onclick=()=>$("#zoomDialog").close();
$("#zoomDialog").addEventListener("click",e=>{if(e.target===$("#zoomDialog"))$("#zoomDialog").close()});
$("#unitHero").style.setProperty("--unit",unit.color);
$("#heroBookImage").innerHTML=spread([0,1],"hero-spread");
render();
})();



