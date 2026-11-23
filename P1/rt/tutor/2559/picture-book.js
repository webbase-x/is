import {isCorrectPictureAnswer,pictureBookCards,pictureBookStats} from "./picture-book-core.js";

const BOOK_STORAGE="rt-tutor-2559-picture-book-v1";
const digit=n=>String(n).replace(/[0-9]/g,c=>"๐๑๒๓๔๕๖๗๘๙"[Number(c)]);
const create=(tag,cls,text)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
};
const add=(parent,tag,cls,text)=>{
 const node=create(tag,cls,text);
 parent.appendChild(node);
 return node;
};
const reducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
function readSolved(allCards){
 const allowed=new Set(allCards.map(card=>card.id));
 try{
  const source=JSON.parse(localStorage.getItem(BOOK_STORAGE)||"{}");
  const result={};
  if(source&&typeof source==="object"&&!Array.isArray(source))
   for(const [key,flag] of Object.entries(source))
    if(allowed.has(key)&&flag===true)result[key]=true;
  return result;
 }catch{return {}}
}
function playSuccessSound(enabled){
 if(!enabled)return;
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)return;
 try{
  const ctx=new Context();
  Promise.resolve(ctx.resume()).catch(()=>{});
  const at=ctx.currentTime+0.015;
  // Short, original positive feedback effect, not a playback of a published melody.
  [523.25,659.25,783.99,1046.5].forEach((frequency,index)=>{
   const oscillator=ctx.createOscillator(),gain=ctx.createGain();
   oscillator.type="sine";oscillator.frequency.value=frequency;
   oscillator.connect(gain);gain.connect(ctx.destination);
   const begin=at+index*0.095;
   gain.gain.setValueAtTime(0.0001,begin);
   gain.gain.exponentialRampToValueAtTime(0.13,begin+0.018);
   gain.gain.exponentialRampToValueAtTime(0.0001,begin+0.25);
   oscillator.start(begin);oscillator.stop(begin+0.27);
  });
  window.setTimeout(()=>ctx.close().catch(()=>{}),1200);
 }catch{/* Sound is optional; keep the question functional. */}
}
function fireworks(host){
 if(reducedMotion())return;
 const field=add(host,"div","picture-book-fireworks");
 field.setAttribute("aria-hidden","true");
 const palette=["#f9735f","#ffd85f","#42d7c5","#77acfa","#c58afa","#fd9ac9"];
 const spots=[[26,34],[72,28],[48,57],[19,73],[80,73]];
 for(let burst=0;burst<spots.length;burst++){
  const [x,y]=spots[burst];
  for(let i=0;i<18;i++){
   const spark=add(field,"i","picture-book-spark");
   const angle=(i/18)*Math.PI*2;
   const distance=(50+(i%3)*16)+(burst%2)*12;
   spark.style.setProperty("--x",x+"%");
   spark.style.setProperty("--y",y+"%");
   spark.style.setProperty("--dx",Math.cos(angle)*distance+"px");
   spark.style.setProperty("--dy",Math.sin(angle)*distance+"px");
   spark.style.setProperty("--hue",palette[(i+burst)%palette.length]);
   spark.style.setProperty("--delay",(burst*0.12)+"s");
  }
 }
 window.setTimeout(()=>field.remove(),2400);
}
function attachPicture(parent,card,sprite){
 const frame=add(parent,"div","picture-book-illustration");
 frame.setAttribute("role","img");
 // Do not reveal the answer in the accessible label before submitting.
 frame.setAttribute("aria-label","ภาพคำศัพท์ ข้อที่ "+digit(card.sourceNo));
 frame.style.backgroundImage='url("'+sprite.path.replace(/"/g,"")+'")';
 frame.style.backgroundPosition="center "+(card.position/11*100)+"%";
 return frame;
}
export function mountPictureBook(parent,allCards,sprite,{onSolved=()=>{}}={}){
 const original=pictureBookCards(allCards);
 if(original.length!==10)throw Error("หนังสือคำจับคู่ภาพต้องมี 10 คำ");
 const solved=readSolved(original);
 let cards=[...original],position=0,revealed=false,soundOn=true,incorrectAttempts=0;
 const host=add(parent,"section","picture-book");
 host.id="picture-book";host.setAttribute("aria-label","หนังสือคำจับคู่ภาพ");
 const header=add(host,"header","picture-book-heading");
 const title=add(header,"div");
 add(title,"span","picture-book-kicker","ตอนที่ ๑ · คำจับคู่ภาพ");
 add(title,"h2","","หนังสือภาพทายคำ");
 add(title,"p","","เปิดทีละหน้า ดูภาพด้านซ้าย แล้วพิมพ์คำศัพท์ด้านขวาให้ถูกต้อง");
 const tools=add(header,"div","picture-book-tools");
 const sound=add(tools,"button","book-small-btn","เสียง: เปิด");
 sound.type="button";sound.setAttribute("aria-pressed","true");sound.title="เปิดหรือปิดเสียงแสดงความยินดี";
 const reset=add(tools,"button","book-small-btn","เริ่มใหม่");reset.type="button";
 const stats=add(host,"div","book-topline");
 const counter=add(stats,"span","book-counter","");
 const progress=add(stats,"span","book-progress","");
 const progressTrack=add(host,"div","book-progress-track");
 const bar=add(progressTrack,"div","book-progress-bar");
 const spread=add(host,"div","book-spread");
 const left=add(spread,"div","book-page book-page-picture");
 add(left,"span","book-page-kicker","หน้าซ้าย • ภาพ");
 const visualArea=add(left,"div","book-picture-area");
 add(left,"p","book-picture-caption","ดูภาพแล้วตอบว่าเป็นคำใด");
 add(left,"span","book-corner","✦");
 const right=add(spread,"div","book-page book-page-word");
 add(right,"span","book-page-kicker","หน้าขวา • คำศัพท์");
 const revealArea=add(right,"div","book-reveal-area");
 const word=add(revealArea,"strong","book-hidden-word");
 const plaque=add(revealArea,"button","book-plaque");
 plaque.type="button";plaque.setAttribute("aria-pressed","false");
 plaque.setAttribute("aria-label","พลิกป้ายแนวนอนเพื่อเปิดดูคำศัพท์");
 const plaqueInside=add(plaque,"span","book-plaque-inner");
 const front=add(plaqueInside,"span","book-plaque-front");
 add(front,"span","book-plaque-symbol","?");
 add(front,"span","","แตะป้ายเพื่อเปิดคำศัพท์");
 const back=add(plaqueInside,"span","book-plaque-back","กำลังเปิดเผยคำศัพท์");
 add(right,"p","book-plaque-tip","แตะป้ายเพื่อพลิกดูคำศัพท์ที่ซ่อนอยู่");
 const hideWord=add(right,"button","book-peek-toggle","พลิกป้ายกลับ / ซ่อนคำ");hideWord.type="button";hideWord.hidden=true;
 const answerForm=add(right,"form","book-answer-form");
 const answerLabel=add(answerForm,"label","book-answer-label","เขียนคำตอบจากภาพ");
 const input=add(answerLabel,"input","book-answer");
 input.type="text";input.placeholder="พิมพ์คำศัพท์ภาษาไทยที่นี่";
 input.autocomplete="off";input.spellcheck=false;input.enterKeyHint="done";input.maxLength=80;
 const check=add(answerForm,"button","book-check","ตรวจคำตอบ");
 check.type="submit";
 const feedback=add(right,"p","book-feedback","");
 feedback.id="book-answer-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 input.setAttribute("aria-describedby","book-answer-feedback");
 const nav=add(host,"nav","book-navigation");
 nav.setAttribute("aria-label","เปลี่ยนหน้าหนังสือ");
 const previous=add(nav,"button","book-nav-btn","← หน้าก่อน");previous.type="button";
 const dots=add(nav,"div","book-page-dots");
 const next=add(nav,"button","book-nav-btn book-nav-primary","หน้าถัดไป →");next.type="button";
 const footer=add(host,"p","book-footer","คำศัพท์และภาพอ้างอิงจากแบบทดสอบ RT ปี 2559 · ความคืบหน้าบันทึกในเบราว์เซอร์");
 const empty=add(host,"p","book-empty","ไม่พบคำจับคู่ภาพตามตัวกรอง");
 empty.hidden=true;
 let current=null;
 function store(){try{localStorage.setItem(BOOK_STORAGE,JSON.stringify(solved))}catch{
  feedback.textContent="ตอบถูกแล้ว แต่เบราว์เซอร์ไม่อนุญาตให้บันทึกความคืบหน้า";
 }}
 function renderDots(){
  dots.replaceChildren();
  cards.forEach((card,index)=>{
   const dot=add(dots,"button","book-dot",digit(card.sourceNo));
   dot.type="button";dot.title="เปิดข้อ "+digit(card.sourceNo);
   dot.setAttribute("aria-label","เปิดข้อ "+digit(card.sourceNo)+(solved[card.id]?" ตอบถูกแล้ว":""));
   dot.setAttribute("aria-current",String(position===index));
   if(solved[card.id])dot.classList.add("is-complete");
   dot.addEventListener("click",()=>{position=index;render(true)});
  });
 }
 function updateProgress(){
  const counts=pictureBookStats(original,solved);
  progress.textContent="ตอบถูก "+digit(counts.solved)+" / "+digit(counts.total)+" คำ";
  bar.style.width=(counts.total?counts.solved/counts.total*100:0)+"%";
 }
 function showAnswer(isRevealed){
  revealed=isRevealed;
  revealArea.classList.toggle("is-revealed",isRevealed);
  plaque.setAttribute("aria-pressed",String(isRevealed));
  plaque.setAttribute("aria-label",isRevealed?"พลิกป้ายเพื่อปิดคำศัพท์":"พลิกป้ายเพื่อเปิดดูคำศัพท์");
  word.setAttribute("aria-hidden",String(!isRevealed));
  hideWord.hidden=!isRevealed||solved[current?.id]===true;
 }
 function render(animate=false){
  const noCards=!cards.length;
  spread.hidden=noCards;nav.hidden=noCards;counter.hidden=noCards;progressTrack.hidden=noCards;empty.hidden=!noCards;
  updateProgress();
  if(noCards){counter.textContent="ไม่มีหน้าหนังสือในชุดนี้";return}
  current=cards[position];
  if(animate&&!reducedMotion()){
   spread.classList.remove("page-turn");void spread.offsetWidth;spread.classList.add("page-turn");
  }
  visualArea.replaceChildren();
  attachPicture(visualArea,current,sprite);
  add(visualArea,"p","book-picture-caption","ดูภาพแล้วตอบว่าเป็นคำใด");
  word.textContent=current.word;
  counter.textContent="เปิดหน้า "+digit(position+1)+" / "+digit(cards.length)+" · ข้อ "+digit(current.sourceNo);
  input.value="";incorrectAttempts=0;
  const complete=solved[current.id]===true;
  showAnswer(complete);
  answerForm.hidden=complete;
  feedback.textContent=complete?"ตอบถูกแล้ว เปิดดูคำศัพท์ได้": "ลองพิมพ์คำตอบ หรือแตะป้ายเพื่อเปิดดูคำศัพท์";
  feedback.classList.toggle("is-success",complete);
  feedback.classList.remove("is-error");
  previous.disabled=position===0;
  next.textContent=position===cards.length-1?"กลับหน้าแรก ↻":"หน้าถัดไป →";
  renderDots();
 }
 function peek(){
  if(!current||solved[current.id])return;
  showAnswer(!revealed);
  feedback.classList.remove("is-error");
  feedback.textContent=revealed?"เปิดดูคำศัพท์แล้ว ลองพิมพ์เพื่อตรวจความจำ":"ปิดป้ายแล้ว ลองเขียนคำตอบ";
 }
 function submit(event){
  event.preventDefault();
  if(!current||solved[current.id])return;
  if(!input.value.trim()){feedback.textContent="กรุณาพิมพ์คำตอบก่อนตรวจ";feedback.classList.add("is-error");input.focus();return}
  if(!isCorrectPictureAnswer(current.word,input.value)){
   incorrectAttempts++;
   feedback.textContent="ยังไม่ถูกต้อง ลองอ่านภาพและสะกดคำอีกครั้ง";
   feedback.classList.remove("is-success");feedback.classList.add("is-error");
   if(!reducedMotion()){answerForm.classList.remove("book-shake");void answerForm.offsetWidth;answerForm.classList.add("book-shake")}
   input.focus();input.select();return;
  }
  solved[current.id]=true;
  showAnswer(true);
  answerForm.hidden=true;
  feedback.classList.remove("is-error");feedback.classList.add("is-success");
  feedback.textContent="ถูกต้อง! "+current.word+" · เก่งมาก!";
  store();renderDots();updateProgress();
  onSolved(current);
  fireworks(host);playSuccessSound(soundOn);
 }
 answerForm.addEventListener("submit",submit);
 plaque.addEventListener("click",peek);
 hideWord.addEventListener("click",peek);
 previous.addEventListener("click",()=>{if(position>0){position--;render(true)}});
 next.addEventListener("click",()=>{position=position<cards.length-1?position+1:0;render(true)});
 sound.addEventListener("click",()=>{
  soundOn=!soundOn;sound.textContent="เสียง: "+(soundOn?"เปิด":"ปิด");
  sound.setAttribute("aria-pressed",String(soundOn));
 });
 reset.addEventListener("click",()=>{
  if(!confirm("เริ่มเกมหนังสือคำจับคู่ภาพใหม่ทั้งหมด และล้างคำตอบถูกที่บันทึกไว้หรือไม่?"))return;
  Object.keys(solved).forEach(key=>delete solved[key]);
  store();position=0;render(true);
 });
 function setCards(subset){
  const allowed=new Set(original.map(c=>c.id));
  cards=pictureBookCards(subset).filter(card=>allowed.has(card.id));
  position=0;render();
  host.hidden=false;
 }
 setCards(original);
 return {root:host,setCards,getProgress:()=>pictureBookStats(original,solved)};
}
