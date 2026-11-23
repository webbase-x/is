import {VOCAB_GROUPS,buildVocabulary,filterVocabulary,countProgress,shuffleDeck} from "./vocabulary.js";

const STORAGE_KEY="rt-tutor-2559-vocabulary-v1";
const LABEL={picture:"คำจับคู่ภาพ",oral:"คำอ่านออกเสียง",meaning:"คำจับคู่ความหมาย"};
const THAI_DIGITS="๐๑๒๓๔๕๖๗๘๙";
const thaiNumber=value=>String(value).replace(/[0-9]/g,digit=>THAI_DIGITS[Number(digit)]);
const make=(tag,className,txt)=>{
 const element=document.createElement(tag);
 if(className)element.className=className;
 if(txt!==undefined)element.textContent=txt;
 return element;
};
function add(parent,tag,className,txt){const node=make(tag,className,txt);parent.appendChild(node);return node}
function sourceImage(parent,card,sprite){
 const thumbnail=add(parent,"div","vocab-thumb");
 thumbnail.setAttribute("role","img");thumbnail.setAttribute("aria-label","ภาพประกอบคำว่า "+card.word);
 const image=add(thumbnail,"img","picture-sprite");
 image.src=sprite.path;image.alt="";image.setAttribute("aria-hidden","true");image.loading="lazy";
 const scale=1.25;
 image.style.top=(-2-card.position*sprite.rowHeight*scale)+"px";
 return thumbnail;
}
function loadProgress(validIds){
 try{
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
  const result={};
  if(stored&&typeof stored==="object"&&!Array.isArray(stored)){
   for(const [id,state] of Object.entries(stored)){
    if(validIds.has(id)&&["known","retry"].includes(state))result[id]=state;
   }
  }
  return result;
 }catch{return {}}
}
export function mountVocabulary(app,exam,sprite){
 const vocab=buildVocabulary(exam);
 const progress=loadProgress(new Set(vocab.map(item=>item.id)));
 const section=add(app,"section","vocab-wrapper");
 section.dataset.section="vocab";section.id="vocabulary";section.hidden=true;

 const heading=add(section,"header","vocab-header");
 add(heading,"span","vocab-kicker","พ.ศ. ๒๕๕๙ · ฝึกอ่านและจดจำ");
 add(heading,"h1","","คลังคำศัพท์");
 add(heading,"p","","คำจากข้อสอบการอ่านรู้เรื่องและการอ่านออกเสียงจริง จัดเป็นหมวดหมู่และมีเกมแฟลชการ์ดอยู่ท้ายรายการ");
 const stats=add(heading,"div","vocab-summary");
 add(stats,"strong","",vocab.length+" คำ");
 const statsDetail=add(stats,"span","","—");

 const controls=add(section,"div","vocab-controls");
 const searchLabel=add(controls,"label","vocab-search-label","ค้นหาคำศัพท์");
 const search=add(searchLabel,"input","vocab-search");
 search.type="search";search.placeholder="พิมพ์คำที่ต้องการค้นหา";search.autocomplete="off";
 const chips=add(controls,"div","vocab-groups");
 chips.setAttribute("role","group");chips.setAttribute("aria-label","เลือกหมวดคำศัพท์");
 const reference=add(section,"section","vocab-matching-reference");
 add(reference,"h2","","ตอนที่ ๑ การอ่านรู้เรื่องคำ · ข้อที่ ๑๑–๑๕");
 add(reference,"p","","ข้อความและคำตัวเลือกจากต้นฉบับที่ผู้ใช้ระบุ คงหมายเลขข้อและลำดับเดิม");
 const referenceColumns=add(reference,"div","vocab-meaning-columns");
 const definitionsColumn=add(referenceColumns,"div");
 add(definitionsColumn,"h3","","กลุ่มคำบอกความหมาย");
 const definitions=add(definitionsColumn,"ol");
 definitions.start=11;
 exam.comprehension.meaningMatching.definitions.forEach((definition,index)=>{
  add(definitions,"li","",definition).value=11+index;
 });
 const choicesColumn=add(referenceColumns,"div");
 add(choicesColumn,"h3","","คำตัวเลือกตามลำดับต้นฉบับ");
 const choicesBox=add(choicesColumn,"div","meaning-choices");
 exam.comprehension.meaningMatching.terms.forEach(word=>add(choicesBox,"span","",word));
  const listTop=add(section,"div","vocab-list-heading");
 add(listTop,"h2","","รายการคำศัพท์");
 const currentCount=add(listTop,"span","vocab-count","");
 const wordList=add(section,"div","vocab-grid");
 const note=add(section,"p","vocab-source-note",
  "ที่มา: ข้อสอบ RT พ.ศ. 2559 รูปแบบที่ 1 · คำในตัวเลือก 2 คำไม่มีนิยามจับคู่ในข้อสอบ จึงแสดงเป็นคำฝึกอ่านโดยไม่สร้างความหมายขึ้นใหม่");

 const game=add(section,"section","flash-game");
 game.id="flashcards";game.setAttribute("aria-label","เกมแฟลชการ์ดฝึกคำศัพท์");
 const gameHeading=add(game,"div","flash-header");
 add(gameHeading,"span","vocab-kicker","เกมท้ายคลังคำศัพท์");
 add(gameHeading,"h2","","เกมแฟลชการ์ด");
 add(gameHeading,"p","","ดูรูปภาพ อ่านคำ หรืออ่านข้อความอธิบาย แล้วลองตอบด้วยตนเองก่อนกดพลิกบัตร");
 const gameTools=add(game,"div","flash-tools");
 const randomBtn=add(gameTools,"button","flash-tool","สุ่มลำดับ");
 const retryBtn=add(gameTools,"button","flash-tool","ฝึกคำที่ยังไม่จำ");
 const allBtn=add(gameTools,"button","flash-tool","เริ่มทุกคำใหม่");
 for(const btn of [randomBtn,retryBtn,allBtn])btn.type="button";

 const stage=add(game,"div","flash-stage");
 const count=add(stage,"p","flash-count","");
 count.setAttribute("aria-live","polite");
 const flashButton=add(stage,"button","flash-card");
 flashButton.type="button";flashButton.setAttribute("aria-label","พลิกแฟลชการ์ด");
 flashButton.setAttribute("aria-pressed","false");
 const flashContent=add(flashButton,"span","flash-content");
 const flipHint=add(stage,"p","flash-hint","");
 const actions=add(stage,"div","flash-actions");
 const prev=add(actions,"button","flash-secondary","← ก่อนหน้า");
 const flip=add(actions,"button","flash-secondary","พลิกบัตร");
 const next=add(actions,"button","flash-secondary","ถัดไป →");
 const rate=add(stage,"div","flash-rate");
 const again=add(rate,"button","flash-again","ฝึกอีกครั้ง");
 const known=add(rate,"button","flash-known","จำได้แล้ว");
 for(const btn of [prev,flip,next,again,known])btn.type="button";
 const finishedView=add(game,"div","flash-finished");
 finishedView.hidden=true;
 const finishTitle=add(finishedView,"h3","","ทบทวนครบชุดแล้ว");
 const finishDetail=add(finishedView,"p","","");
 const finishAgain=add(finishedView,"button","flash-known","เล่นอีกครั้ง");finishAgain.type="button";

 let group="all",query="",visible=[...vocab],deck=[...vocab],at=0,flipped=false,finished=false;

 const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(progress))}catch{
  add(game,"p","vocab-source-note","เบราว์เซอร์ไม่อนุญาตให้บันทึกความคืบหน้า คะแนนยังใช้ได้ในหน้านี้");
 }};
 const updateStats=()=>{
  const state=countProgress(vocab,progress);
  statsDetail.textContent="จำได้ "+state.known+" · ฝึกอีกครั้ง "+state.retry+" · ยังไม่ทบทวน "+state.unrated;
 };
 function renderChips(){
  chips.replaceChildren();
  VOCAB_GROUPS.forEach(entry=>{
   const size=filterVocabulary(vocab,entry.id).length;
   const btn=add(chips,"button","vocab-chip",entry.label+" ("+size+")");
   btn.type="button";btn.setAttribute("aria-pressed",String(entry.id===group));
   btn.addEventListener("click",()=>{
    group=entry.id;renderChips();renderFiltered();
   });
  });
 }
 function renderList(){
  currentCount.textContent=visible.length+" คำ";
  reference.hidden=!!query.trim()||!(group==="all"||group==="meaning");
  const fragment=document.createDocumentFragment();
  let lastGroup=null;
  visible.forEach((card,index)=>{
   if(card.group!==lastGroup){
    const groupHeading=add(fragment,"h3","vocab-group-label",
      card.group==="picture"?"ตอนที่ ๑ การอ่านรู้เรื่องคำ · ข้อ ๑–๑๐":
      card.group==="meaning"?"ตอนที่ ๑ การอ่านรู้เรื่องคำ · คำตัวเลือกข้อ ๑๑–๑๕":
      "ตอนที่ ๑ การอ่านออกเสียงคำ · ข้อ ๑–๒๐");
    lastGroup=card.group;
   }
   const item=add(fragment,"article","vocab-entry");
   if(card.group==="picture")sourceImage(item,card,sprite);
   const body=add(item,"div","vocab-entry-body");
   const questionRef=card.group==="meaning"?
    "ตัวเลือก "+thaiNumber(card.choiceIndex)+(card.questionNo?" · ข้อ "+thaiNumber(card.questionNo):" · คำตัวเลือกเสริม"):
    "ข้อ "+thaiNumber(card.sourceNo);
   add(body,"span","vocab-entry-index",questionRef+" · "+LABEL[card.group]);
   add(body,"h3","",card.word);
   if(card.definition)add(body,"p","vocab-definition","ความหมายตามแบบทดสอบ: "+card.definition);
   else if(card.group==="meaning")add(body,"p","vocab-definition","คำตัวเลือกเสริม · ไม่มีนิยามจับคู่ในข้อสอบ");
   add(body,"small","vocab-source",card.source);
   const tag=add(item,"span","vocab-status");
   tag.textContent=progress[card.id]==="known"?"จำได้":progress[card.id]==="retry"?"ฝึกซ้ำ":"ยังไม่ฝึก";
   tag.classList.toggle("is-known",progress[card.id]==="known");
  });
  wordList.replaceChildren(fragment);
  if(!visible.length)add(wordList,"p","vocab-empty","ไม่พบคำศัพท์ที่ตรงกับการค้นหา");
 }
 function newDeck(cards){
  deck=[...cards];at=0;flipped=false;finished=false;renderFlash();
 }
 function renderFiltered(){
  query=search.value;
  visible=filterVocabulary(vocab,group,query);
  renderList();newDeck(visible);
 }
 function renderFlash(){
  const empty=!deck.length;
  stage.hidden=empty||finished;
  finishedView.hidden=!finished;
  if(finished){
   const result=countProgress(deck,progress);
   finishTitle.textContent="ทบทวนครบ "+deck.length+" ใบแล้ว";
   finishDetail.textContent="จำได้ "+result.known+" คำ · ฝึกอีกครั้ง "+result.retry+" คำ · ยังไม่ประเมิน "+result.unrated+" คำ";
   updateStats();renderList();return;
  }
  if(empty){finishedView.hidden=false;finishTitle.textContent="ไม่มีแฟลชการ์ดในชุดนี้";
   finishDetail.textContent="ลองเลือกหมวดใหม่หรือล้างคำค้นหา";return}
  const card=deck[at];
  count.textContent="บัตร "+(at+1)+" / "+deck.length+" · "+LABEL[card.group]+
   " · "+(progress[card.id]==="known"?"จำได้แล้ว":progress[card.id]==="retry"?"ควรฝึกอีกครั้ง":"ยังไม่ประเมิน");
  flashButton.setAttribute("aria-pressed",String(flipped));
  flashContent.replaceChildren();
  if(!flipped){
   add(flashContent,"span","flash-eyebrow",
    card.group==="picture"?"ดูภาพแล้วตอบว่าเป็นอะไร":card.group==="meaning"&&card.definition?"อ่านข้อความแล้วตอบคำศัพท์":"ลองอ่านคำนี้ออกเสียง");
   if(card.group==="picture")sourceImage(flashContent,card,sprite);
   else add(flashContent,"strong","flash-word",card.group==="meaning"&&card.definition?card.definition:card.word);
   add(flashContent,"span","flash-side-note","ด้านหน้า");
  }else{
   add(flashContent,"span","flash-eyebrow","คำตอบ / คำสำหรับทบทวน");
   add(flashContent,"strong","flash-answer",card.word);
   add(flashContent,"span","flash-source",card.source);
   if(card.group==="oral")add(flashContent,"span","flash-side-note","อ่านออกเสียงให้ครูฟังและตรวจจากข้อสอบต้นฉบับ");
   else if(card.group==="meaning"&&!card.definition)add(flashContent,"span","flash-side-note","คำตัวเลือกเสริม ไม่มีความหมายยืนยันในข้อนี้");
  }
  flipHint.textContent=flipped?"ประเมินตนเอง: จำได้แล้ว หรือ ฝึกอีกครั้ง":"แตะบัตรหรือกด «พลิกบัตร» เพื่อดูอีกด้าน";
  prev.disabled=at===0;next.textContent=at===deck.length-1?"จบชุด →":"ถัดไป →";
  known.disabled=!flipped;again.disabled=!flipped;
 }
 function toggleFlip(){if(!deck.length||finished)return;flipped=!flipped;renderFlash()}
 function advance(){if(!deck.length||finished)return;if(at>=deck.length-1){finished=true;renderFlash();return}at++;flipped=false;renderFlash()}
 function mark(state){
  if(!deck.length||!flipped||finished)return;
  progress[deck[at].id]=state;save();updateStats();renderList();advance();
 }
 search.addEventListener("input",renderFiltered);
 randomBtn.addEventListener("click",()=>newDeck(shuffleDeck(visible)));
 retryBtn.addEventListener("click",()=>newDeck(visible.filter(item=>progress[item.id]!=="known")));
 allBtn.addEventListener("click",()=>newDeck(visible));
 flashButton.addEventListener("click",toggleFlip);
 flip.addEventListener("click",toggleFlip);
 prev.addEventListener("click",()=>{if(at>0){at--;flipped=false;renderFlash()}});
 next.addEventListener("click",advance);
 again.addEventListener("click",()=>mark("retry"));
 known.addEventListener("click",()=>mark("known"));
 finishAgain.addEventListener("click",()=>newDeck(visible));
 renderChips();renderFiltered();updateStats();
 return section;
}
