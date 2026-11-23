import {isCorrectPictureAnswer,pictureBookCards,pictureBookStats,makeScrambledHint,bookVocabularyCards} from "./picture-book-core.js";
import {installBookFullscreen} from "./fullscreen-book.js";

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
export function mountPictureBook(parent,allCards,sprite,{onSolved=()=>{},onPracticed=()=>{},getOralProgress=()=>null,onResetOral=()=>{}}={}){
 const original=bookVocabularyCards(allCards);
 const pictures=original.filter(card=>card.group==="picture");
 const oral=original.filter(card=>card.group==="oral");
 if(pictures.length!==10||oral.length!==20)throw Error("ข้อมูลหนังสือเล่ม ๑ ไม่ครบ");
 const solved=readSolved(pictures);
 let cards=[...original],position=0,revealed=false,soundOn=true,incorrectAttempts=0;
 let turning=false,activeTurn=null,turnTimer=null;
 let coverClosed=true,coverOpening=false,coverTimer=null;
 const host=add(parent,"section","picture-book");
 host.id="picture-book";host.setAttribute("aria-label","หนังสือภาพทายคำ เล่ม ๑");
 host.classList.add("is-cover-closed");
 const coverStage=add(host,"div","book-cover-stage");
 const coverPages=add(coverStage,"div","book-cover-page-stack");
 coverPages.setAttribute("aria-hidden","true");
 const coverFront=add(coverStage,"button","book-cover-front");
 coverFront.type="button";
 coverFront.setAttribute("aria-label","เปิดหนังสือภาพทายคำ เล่ม ๑ · RT ปี ๒๕๕๙ · ผู้ผลิตหนังสือ ครูไพรัช  อินควรชุม");
 const coverArt=add(coverFront,"img","book-cover-art");
 // The artwork already contains the complete title and producer credit.
 coverArt.src="./assets/rt2559-book-cover-volume-1-revised.webp";
 coverArt.alt="";coverArt.setAttribute("aria-hidden","true");
 coverArt.loading="eager";coverArt.decoding="async";
 const coverOpen=add(coverStage,"button","book-cover-open","เปิดหนังสือ →");
 coverOpen.type="button";
 add(coverStage,"p","book-cover-index","ภายในเล่ม · จับคู่ภาพ ๑๐ คำ · ฝึกอ่านออกเสียง ๒๐ คำ");
 const header=add(host,"header","picture-book-heading");
 const title=add(header,"div");
 const chapterHeading=add(title,"span","picture-book-kicker","ตอนที่ ๑ · คำจับคู่ภาพ");
 add(title,"h2","","หนังสือภาพทายคำ · เล่ม ๑");
 const chapterDesc=add(title,"p","","พลิกหน้าอ่านทั้งคำจับคู่ภาพและคำอ่านออกเสียง");
 const tools=add(header,"div","picture-book-tools");
 const expandButton=add(tools,"button","book-small-btn book-expand-btn","⛶ เต็มจอ");
 expandButton.type="button";expandButton.setAttribute("aria-pressed","false");
 const fullscreen=installBookFullscreen(host,expandButton);
 const sound=add(tools,"button","book-small-btn","เสียง: เปิด");
 sound.type="button";sound.setAttribute("aria-pressed","true");sound.title="เปิดหรือปิดเสียงแสดงความยินดี";
 const reset=add(tools,"button","book-small-btn","เริ่มใหม่");reset.type="button";
 const closeCover=add(tools,"button","book-small-btn book-close-cover","ปิดหนังสือ");closeCover.type="button";
 const stats=add(host,"div","book-topline");
 const counter=add(stats,"span","book-counter","");
 counter.setAttribute("aria-live","polite");
 const progress=add(stats,"span","book-progress","");
 const progressTrack=add(host,"div","book-progress-track");
 const bar=add(progressTrack,"div","book-progress-bar");
 const chapters=add(host,"nav","book-chapter-nav");
 chapters.setAttribute("aria-label","เลือกตอนในหนังสือ");
 const jumpPicture=add(chapters,"button","book-chapter-btn","ตอนที่ ๑ · จับคู่ภาพ");
 jumpPicture.type="button";
 const jumpOral=add(chapters,"button","book-chapter-btn","ตอนที่ ๒ · อ่านออกเสียง");
 jumpOral.type="button";
 const spread=add(host,"div","book-spread");
 spread.setAttribute("aria-label","หนังสือภาพเปิดสองหน้า");
 const left=add(spread,"div","book-page book-page-picture");
 const leftHeading=add(left,"span","book-page-kicker","หน้าซ้าย • ภาพ");
 const visualArea=add(left,"div","book-picture-area");
 add(left,"p","book-picture-caption","ดูภาพแล้วตอบว่าเป็นคำใด");
 add(left,"span","book-corner","✦");
 const right=add(spread,"div","book-page book-page-word");
 const rightHeading=add(right,"span","book-page-kicker","หน้าขวา • คำศัพท์");
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
 const hints=add(right,"div","book-hints");
 const showHints=add(hints,"button","book-hint-toggle","คำใบ้ · เรียงตัวอักษร");
 showHints.type="button";showHints.setAttribute("aria-expanded","false");
 showHints.setAttribute("aria-controls","book-hint-panel");
 const hintPanel=add(hints,"div","book-hint-panel");
 hintPanel.id="book-hint-panel";hintPanel.hidden=true;
 add(hintPanel,"p","book-hint-instruction","ตัวอักษรสลับตำแหน่งอยู่! แตะทีละแผ่นตามลำดับที่ถูกต้องเพื่อเติมช่องคำตอบ");
 const hintTiles=add(hintPanel,"div","book-hint-tiles");
 hintTiles.setAttribute("role","group");hintTiles.setAttribute("aria-label","ตัวอักษรคำใบ้ที่สลับลำดับ");
 const hintActions=add(hintPanel,"div","book-hint-actions");
 const undoHint=add(hintActions,"button","book-hint-action","ย้อนตัวล่าสุด");
 undoHint.type="button";
 const clearHint=add(hintActions,"button","book-hint-action","ล้างคำตอบ");
 clearHint.type="button";
 const feedback=add(right,"p","book-feedback","");
 feedback.id="book-answer-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 input.setAttribute("aria-describedby","book-answer-feedback");
 const oralPanel=add(right,"section","book-oral-panel");
 oralPanel.hidden=true;
 add(oralPanel,"h3","","ฝึกอ่านออกเสียง");
 add(oralPanel,"p","book-oral-instructions","อ่านคำบนหน้าซ้ายให้ชัดเจน แล้วให้ครูหรือผู้ปกครองฟัง");
 const oralStatus=add(oralPanel,"p","book-oral-state","ยังไม่ฝึก");
 oralStatus.setAttribute("role","status");oralStatus.setAttribute("aria-live","polite");
 const oralActions=add(oralPanel,"div","book-oral-actions");
 const oralKnown=add(oralActions,"button","book-oral-known","อ่านได้แล้ว");
 oralKnown.type="button";
 const oralRetry=add(oralActions,"button","book-oral-retry","ฝึกอีกครั้ง");
 oralRetry.type="button";
 add(oralPanel,"p","book-oral-footnote","บันทึกผลการฝึกด้วยตนเอง ไม่ใช่การตรวจเสียงอัตโนมัติ");
 const nav=add(host,"nav","book-navigation");
 nav.setAttribute("aria-label","เปลี่ยนหน้าหนังสือ");
 const previous=add(nav,"button","book-nav-btn","← หน้าก่อน");previous.type="button";
 const dots=add(nav,"div","book-page-dots");
 const next=add(nav,"button","book-nav-btn book-nav-primary","หน้าถัดไป →");next.type="button";
 const footer=add(host,"p","book-footer","เล่ม ๑ · คำศัพท์และภาพอ้างอิงจากแบบทดสอบ RT ปี ๒๕๕๙ · ผู้ผลิตหนังสือ ครูไพรัช อินควรชุม");
 const empty=add(host,"p","book-empty","ไม่พบคำศัพท์ในหนังสือตามตัวกรอง");
 empty.hidden=true;
 let current=null,hintPieces=[],insertedPieces=[];
 function resetHints(){
  hintPanel.hidden=true;
  showHints.textContent="คำใบ้ · เรียงตัวอักษร";
  showHints.setAttribute("aria-expanded","false");
  hintTiles.replaceChildren();
  hintPieces=[];insertedPieces=[];
 }
 function fillHintTiles(){
  hintTiles.replaceChildren();
  if(!current)return;
  hintPieces=makeScrambledHint(current.word,current.id).map(item=>({...item,used:false}));
  insertedPieces=[];
  for(const tile of hintPieces){
   const button=add(hintTiles,"button","book-hint-tile",tile.text);
   button.type="button";
   button.setAttribute("aria-label","เติมตัวอักษร "+tile.text+" ลงในช่องคำตอบ");
   button.dataset.tileId=tile.id;
   button.addEventListener("click",()=>{
    if(tile.used||solved[current?.id]===true)return;
    tile.used=true;insertedPieces.push({id:tile.id,text:tile.text});
    button.disabled=true;button.setAttribute("aria-pressed","true");
    // Append to current answer, retaining what the pupil has typed.
    input.value+=tile.text;
    feedback.classList.remove("is-error");
    feedback.textContent="จัดเรียงตัวอักษรแล้ว กดตรวจคำตอบเมื่อพร้อม";
    input.focus();
   });
  }
 }
 function undoLastHint(){
  const last=insertedPieces.pop();if(!last)return;
  const tile=hintPieces.find(item=>item.id===last.id);
  if(tile)tile.used=false;
  const button=Array.from(hintTiles.children).find(el=>el.dataset.tileId===last.id);
  if(button){button.disabled=false;button.setAttribute("aria-pressed","false")}
  const currentValue=input.value;
  if(currentValue.endsWith(last.text))input.value=currentValue.slice(0,-last.text.length);
  else {
   const i=currentValue.lastIndexOf(last.text);
   if(i>=0)input.value=currentValue.slice(0,i)+currentValue.slice(i+last.text.length);
  }
  input.focus();
 }
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
   dot.addEventListener("click",()=>turnTo(index,index>=position?"forward":"backward"));
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
 function render(){
  const noCards=!cards.length;
  spread.hidden=noCards;nav.hidden=noCards;counter.hidden=noCards;progressTrack.hidden=noCards;empty.hidden=!noCards;
  updateProgress();
  if(noCards){counter.textContent="ไม่มีหน้าหนังสือในชุดนี้";return}
  current=cards[position];
  visualArea.replaceChildren();
  attachPicture(visualArea,current,sprite);
  add(visualArea,"p","book-picture-caption","ดูภาพแล้วตอบว่าเป็นคำใด");
  word.textContent=current.word;
  counter.textContent="เปิดหน้า "+digit(position+1)+" / "+digit(cards.length)+" · ข้อ "+digit(current.sourceNo);
  input.value="";incorrectAttempts=0;
  resetHints();
  const complete=solved[current.id]===true;
  showAnswer(complete);
  answerForm.hidden=complete;
  hints.hidden=complete;
  feedback.textContent=complete?"ตอบถูกแล้ว เปิดดูคำศัพท์ได้": "ลองพิมพ์คำตอบ หรือแตะป้ายเพื่อเปิดดูคำศัพท์";
  feedback.classList.toggle("is-success",complete);
  feedback.classList.remove("is-error");
  previous.disabled=position===0;
  next.textContent=position===cards.length-1?"กลับหน้าแรก ↻":"หน้าถัดไป →";
  renderDots();
 }

 // The stationary leaf holds the currently visible page while an actual
 // paper leaf turns on the book spine. The opposite face is the destination.
 function cleanSnapshot(node){
  const clone=node.cloneNode(true);
  clone.removeAttribute?.("id");
  clone.querySelectorAll?.("[id]").forEach(el=>el.removeAttribute("id"));
  clone.querySelectorAll?.("input,button,textarea,select").forEach(el=>{
   el.disabled=true;el.setAttribute("tabindex","-1");
  });
  return clone;
 }
 function stopTurning(){
  if(turnTimer!==null){window.clearTimeout(turnTimer);turnTimer=null}
  activeTurn?.remove();
  activeTurn=null;turning=false;host.classList.remove("is-turning");
 }
 function turnTo(nextIndex,direction){
  if(turning||!cards.length||nextIndex<0||nextIndex>=cards.length||nextIndex===position)return;
  if(reducedMotion()){
   position=nextIndex;render();return;
  }
  const mobile=window.matchMedia?.("(max-width: 780px)")?.matches===true;
  // Snapshots are noninteractive. Old forms cannot steal focus or submit.
  const oldLeft=cleanSnapshot(left),oldRight=cleanSnapshot(right);
  const oldSpread=mobile?cleanSnapshot(spread):null;
  position=nextIndex;
  render();
  const newLeft=cleanSnapshot(left),newRight=cleanSnapshot(right);
  const newSpread=mobile?cleanSnapshot(spread):null;

  const forward=direction!=="backward";
  const layer=add(spread,"div","book-turn-layer"+(mobile?" is-mobile":""));
  layer.setAttribute("aria-hidden","true");
  layer.inert=true;
  if(!mobile){
   const stationary=add(layer,"div","book-turn-stationary "+(forward?"is-left":"is-right"));
   stationary.appendChild(forward?oldLeft:oldRight);
  }
  const leaf=add(layer,"div","book-turn-leaf "+(forward?"go-forward":"go-backward"));
  const front=add(leaf,"div","book-turn-face book-turn-front");
  const back=add(leaf,"div","book-turn-face book-turn-back");
  front.appendChild(mobile?oldSpread:(forward?oldRight:oldLeft));
  back.appendChild(mobile?newSpread:(forward?newLeft:newRight));
  turning=true;activeTurn=layer;host.classList.add("is-turning");
  // Complete even when the browser suppresses animationend (background tab).
  const finish=()=>{
   if(activeTurn!==layer)return;
   stopTurning();
  };
  leaf.addEventListener("animationend",event=>{
   if(event.target===leaf)finish();
  });
  turnTimer=window.setTimeout(finish,1150);
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
  hints.hidden=true;
  feedback.classList.remove("is-error");feedback.classList.add("is-success");
  feedback.textContent="ถูกต้อง! "+current.word+" · เก่งมาก!";
  store();renderDots();updateProgress();
  onSolved(current);
  fireworks(host);playSuccessSound(soundOn);
 }
 showHints.addEventListener("click",()=>{
  if(!current||solved[current.id]===true)return;
  const showing=hintPanel.hidden;
  hintPanel.hidden=!showing;
  showHints.setAttribute("aria-expanded",String(showing));
  showHints.textContent=showing?"ซ่อนคำใบ้":"คำใบ้ · เรียงตัวอักษร";
  if(showing&&!hintPieces.length)fillHintTiles();
 });
 undoHint.addEventListener("click",undoLastHint);
 clearHint.addEventListener("click",()=>{
  input.value="";insertedPieces=[];
  hintPieces.forEach(tile=>tile.used=false);
  Array.from(hintTiles.children).forEach(el=>{
   el.disabled=false;el.setAttribute("aria-pressed","false");
  });
  input.focus();
 });
 answerForm.addEventListener("submit",submit);
 plaque.addEventListener("click",peek);
 hideWord.addEventListener("click",peek);
 previous.addEventListener("click",()=>turnTo(position-1,"backward"));
 next.addEventListener("click",()=>turnTo(position<cards.length-1?position+1:0,"forward"));
 sound.addEventListener("click",()=>{
  soundOn=!soundOn;sound.textContent="เสียง: "+(soundOn?"เปิด":"ปิด");
  sound.setAttribute("aria-pressed",String(soundOn));
 });
 reset.addEventListener("click",()=>{
  if(!confirm("เริ่มเกมหนังสือคำจับคู่ภาพใหม่ทั้งหมด และล้างคำตอบถูกที่บันทึกไว้หรือไม่?"))return;
  Object.keys(solved).forEach(key=>delete solved[key]);
  store();stopTurning();position=0;render();
 });
 function finishCoverOpen(){
  if(coverTimer!==null){window.clearTimeout(coverTimer);coverTimer=null}
  coverOpening=false;coverClosed=false;
  coverStage.classList.remove("is-opening");
  coverStage.hidden=true;
  host.classList.remove("is-cover-closed");
  host.classList.add("is-cover-opened");
 }
 function openBook(){
  if(!coverClosed||coverOpening||!cards.length)return;
  coverOpening=true;
  coverStage.classList.add("is-opening");
  if(reducedMotion()){finishCoverOpen();return}
  coverTimer=window.setTimeout(finishCoverOpen,980);
 }
 function closeBook(){
  if(coverTimer!==null){window.clearTimeout(coverTimer);coverTimer=null}
  stopTurning();
  coverOpening=false;coverClosed=true;
  coverStage.classList.remove("is-opening");
  coverStage.hidden=false;
  host.classList.remove("is-cover-opened");
  host.classList.add("is-cover-closed");
 }
 coverFront.addEventListener("click",openBook);
 coverOpen.addEventListener("click",openBook);
 closeCover.addEventListener("click",closeBook);
 function setCards(subset){
  stopTurning();
  const allowed=new Set(original.map(c=>c.id));
  cards=pictureBookCards(subset).filter(card=>allowed.has(card.id));
  position=0;render();
  host.hidden=false;
 }
 setCards(original);
 return {root:host,setCards,openBook,closeBook,isCoverClosed:()=>coverClosed,getProgress:()=>pictureBookStats(original,solved)};
}
