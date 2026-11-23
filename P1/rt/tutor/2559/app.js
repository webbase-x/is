import {PICTURE_LABELS,PICTURE_SPRITE,verifyPictureOrder} from "./color-pictures.js";
const app=document.querySelector("#app");
let exam=null,assets=null,mode="comp",isTeacher=false;
const SAVED="rt-tutor-exam-2559-v1";
let answerState={picture:{},meaning:{},multiple:{}};
try {const data=JSON.parse(localStorage.getItem(SAVED)||"null");if(data&&typeof data==="object"&&!Array.isArray(data))answerState={picture:data.picture||{},meaning:data.meaning||{},multiple:data.multiple||{}}}catch{}
const nThai=n=>String(n).replace(/[0-9]/g,c=>"๐๑๒๓๔๕๖๗๘๙"[Number(c)]);
function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x}
function add(parent,tag,cls,text){const x=el(tag,cls,text);parent.appendChild(x);return x}
function makePage(pageno,section){
 const sheet=add(app,"section","sheet");sheet.dataset.section=section;sheet.dataset.page=String(pageno);
 add(sheet,"div","sheet-top","แบบทดสอบการอ่านออกเขียนได้ ชั้นประถมศึกษาปีที่ ๑ ปีการศึกษา ๒๕๕๙ ภาคเรียนที่ ๒ "+(section==="comp"?"การอ่านรู้เรื่อง":"การอ่านออกเสียง"));
 if(pageno!==0){const footer=add(sheet,"div","page-footer");add(footer,"span","",nThai(pageno));add(footer,"span","","สำนักทดสอบทางการศึกษา สพฐ.")}
 return sheet;
}
function cover(section){
 const p=makePage(0,section);p.classList.add("cover");
 add(p,"h1","","แบบทดสอบ"+(section==="comp"?"การอ่านรู้เรื่อง":"การอ่านออกเสียง"));
 add(p,"h2","","ชั้นประถมศึกษาปีที่ ๑");
 add(p,"h2","","ปีการศึกษา ๒๕๕๙ ภาคเรียนที่ ๒");
 add(p,"p","","สำนักทดสอบทางการศึกษา");
 add(p,"p","","สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน");
 return p;
}
function candidate(p){
 const area=add(p,"div","candidate");
 [["ชื่อ-สกุล",24],["โรงเรียน",18],["ชั้น",5],["เลขที่",5]].forEach(([label])=>{
  const wrap=add(area,"label","",label+" ");
  const input=add(wrap,"input");input.setAttribute("aria-label",label);
  input.value=sessionStorage.getItem("rt59-"+label)||"";
  input.addEventListener("input",()=>{try{sessionStorage.setItem("rt59-"+label,input.value)}catch{}});
 });
}
function heading(p,title,description){
 add(p,"h2","exam-part",title);
 if(description)add(p,"p","directions indent",description);
}
function createMatching(board,group,leftItems,rightItems,visual=false){
 board.classList.add("matching-board",visual?"picture-board":"meaning-board");
 board.dataset.group=group;
 const left=add(board,"div","match-left");
 leftItems.forEach((word,i)=>{
  const row=add(left,"div","match-word");
  add(row,"span","",nThai((visual?1:11)+i)+". "+word);
  const btn=add(row,"button","anchor","");btn.type="button";btn.dataset.side="left";btn.dataset.match=String(i+1);
  btn.setAttribute("aria-label","เลือกข้อ "+(i+1));btn.title="คลิกแล้วเลือกคู่ทางขวา";
 });
 const right=add(board,"div","match-right");

 rightItems.forEach((word,i)=>{
   const row=add(right,"div",visual?"picture-slot":"meaning-right-row");
   if(visual){
     const illustration=add(row,"div","picture-card");
     illustration.setAttribute("role","img");
     illustration.setAttribute("aria-label",PICTURE_LABELS[i]);
     const img=add(illustration,"img","picture-sprite");
     img.src=PICTURE_SPRITE.path;
     img.alt="";
     img.setAttribute("aria-hidden","true");
     img.width=PICTURE_SPRITE.width*1.25;
     img.height=PICTURE_SPRITE.height*1.25;
     img.style.top=(-2-i*PICTURE_SPRITE.rowHeight*1.25)+"px";
     img.addEventListener("error",()=>{illustration.textContent="ไม่สามารถเปิดภาพได้"});
   }
   const btn=add(row,"button","anchor","");btn.type="button";btn.dataset.side="right";btn.dataset.match=String(i+1);
   btn.setAttribute("aria-label",visual?"เลือกรูปภาพลำดับที่ "+(i+1):"เลือกคำ "+word);btn.title=visual?"รูปภาพที่ "+(i+1):word;
   if(!visual)add(row,"span","",word);
   else row.addEventListener("click",evt=>{if(!evt.target.closest(".anchor"))btn.click()});
 });
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("class","matching-lines");svg.setAttribute("aria-hidden","true");board.appendChild(svg);
 let from=null;
 board.addEventListener("click",evt=>{
   const btn=evt.target.closest(".anchor");if(!btn||!board.contains(btn))return;
   if(btn.dataset.side==="left"){from=Number(btn.dataset.match);board.querySelectorAll(".anchor.active").forEach(e=>e.classList.remove("active"));btn.classList.add("active");return}
   if(from===null)return;
   answerState[group][from]=Number(btn.dataset.match);from=null;board.querySelectorAll(".anchor.active").forEach(e=>e.classList.remove("active"));
   persist();drawLines(board);
 });
 drawLines(board);requestAnimationFrame(()=>drawLines(board));
}
function drawLines(board){
 const group=board.dataset.group,svg=board.querySelector("svg");if(!svg)return;
 svg.replaceChildren();svg.setAttribute("viewBox","0 0 "+board.clientWidth+" "+board.clientHeight);
 board.querySelectorAll(".anchor.connected").forEach(e=>e.classList.remove("connected"));
 const box=board.getBoundingClientRect();
 Object.entries(answerState[group]||{}).forEach(([from,to])=>{
  const left=board.querySelector('.match-left .anchor[data-match="'+from+'"]');
  const right=board.querySelector('.match-right .anchor[data-match="'+to+'"]');
  if(!left||!right)return;
  const a=left.getBoundingClientRect(),b=right.getBoundingClientRect();
  const line=document.createElementNS("http://www.w3.org/2000/svg","line");
  line.setAttribute("x1",a.left+a.width/2-box.left);line.setAttribute("y1",a.top+a.height/2-box.top);
  line.setAttribute("x2",b.left+b.width/2-box.left);line.setAttribute("y2",b.top+b.height/2-box.top);
  svg.appendChild(line);left.classList.add("connected");right.classList.add("connected");
 });
}
function question(p,q){
 const div=add(p,"div","question-block");
 const top=add(div,"div","question-top");
 add(top,"div","question-number",nThai(q.no)+".");
 add(top,"div","passage-box",q.passage);
 const body=add(div,"div","question-body");
 add(body,"p","",q.question);
 const group=add(body,"div","options");
 q.choices.forEach((choice,i)=>{
  const label=add(group,"label","option");
  const radio=add(label,"input");radio.type="radio";radio.name="q-"+q.no;radio.value=String(i+1);
  radio.checked=Number(answerState.multiple[q.no])===i+1;
  radio.addEventListener("change",()=>{answerState.multiple[q.no]=i+1;persist();showAnswerStyles()});
  add(label,"span","",nThai(i+1)+") "+choice);
 });
 const key=add(div,"div","teacher-key","เฉลย: "+nThai(q.answer)+") "+q.choices[q.answer-1]);
 key.dataset.correct=String(q.answer);
}
function renderComp(){
 cover("comp");
 let p=makePage(1,"comp");candidate(p);
 add(p,"p","directions","คำชี้แจง ข้อสอบมีทั้งหมด ๓ ตอน เวลา ๓๐ นาที");
 heading(p,"ตอนที่ ๑ การอ่านรู้เรื่องคำ","ข้อที่ ๑ – ๑๐ ให้นักเรียนอ่านคำที่กำหนด แล้วลากเส้นโยงคำให้ตรงกับรูปภาพที่มีความสัมพันธ์กัน ๑ คำ ต่อ ๑ ภาพ");
 const scroll=add(p,"div","board-scroll");const board=add(scroll,"div");
 createMatching(board,"picture",exam.comprehension.pictureMatching.words,Array.from({length:12},()=>""),true);
 add(p,"p","teacher-key","เฉลยลำดับภาพจากบนลงล่าง: "+exam.comprehension.pictureMatching.answers.join(" · "));
 p=makePage(2,"comp");
 heading(p,"ตอนที่ ๑ การอ่านรู้เรื่องคำ","ข้อที่ ๑๑ – ๑๕ ให้นักเรียนอ่านกลุ่มคำที่กำหนด แล้วลากเส้นโยงกลุ่มคำที่เป็นความหมายของคำกับคำให้สัมพันธ์กัน");
 const scroll2=add(p,"div","board-scroll");const board2=add(scroll2,"div");
 createMatching(board2,"meaning",exam.comprehension.meaningMatching.definitions,exam.comprehension.meaningMatching.terms);
 add(p,"p","teacher-key","เฉลยข้อ ๑๑–๑๕: "+exam.comprehension.meaningMatching.answers.map((idx,i)=>nThai(11+i)+". "+exam.comprehension.meaningMatching.terms[idx-1]).join(" · "));
 for(let page=3;page<=6;page++){
  p=makePage(page,"comp");
  if(page===3)heading(p,"ตอนที่ ๒ การอ่านรู้เรื่องประโยค","ข้อที่ ๑๖ – ๒๑ ให้นักเรียนอ่านประโยค แล้วทำเครื่องหมาย ✕ ทับตัวเลือกที่เป็นคำตอบที่ถูกที่สุดเพียงข้อเดียว");
  if(page===5)heading(p,"ตอนที่ ๓ การอ่านรู้เรื่องข้อความ","ข้อที่ ๒๒ – ๒๕ ให้นักเรียนอ่านข้อความ แล้วทำเครื่องหมาย ✕ ทับตัวเลือกที่เป็นคำตอบที่ถูกที่สุดเพียงข้อเดียว");
  exam.comprehension.choices.filter(q=>q.page===page).forEach(q=>question(p,q));
 }
 const score=add(app,"div","scorebox");score.dataset.section="comp";score.id="comp-score";
}
function renderOral(){
 cover("oral");
 let p=makePage(1,"oral");
 add(p,"p","directions","คำชี้แจง ข้อสอบมีทั้งหมด ๓ ตอน ให้เวลาอ่านภายใน ๑๐ นาที");
 heading(p,"ตอนที่ ๑ การอ่านออกเสียงคำ","ข้อที่ ๑ – ๒๐ ให้นักเรียนอ่านออกเสียงคำที่กำหนดให้ถูกต้อง");
 const list=add(p,"div","oral-list");
 for(let i=0;i<10;i++)for(const at of [i,i+10]){
  const item=add(list,"div");add(item,"span","num",nThai(at+1)+".");add(item,"span","",exam.oral.words[at]);
 }
 p=makePage(2,"oral");
 heading(p,"ตอนที่ ๒ การอ่านออกเสียงประโยค","ข้อที่ ๒๑ – ๒๖ ให้นักเรียนอ่านออกเสียงประโยคให้ถูกต้อง");
 const sent=add(p,"ol","sentence-list");
 exam.oral.sentences.forEach((line,i)=>{
  const li=add(sent,"li");add(li,"b","",nThai(i+21)+".");add(li,"span","",line);
 });
 heading(p,"ตอนที่ ๓ การอ่านออกเสียงข้อความ","ให้นักเรียนอ่านข้อความต่อไปนี้ให้ถูกต้อง");
 add(p,"div","oral-passage",exam.oral.passage);
}
function persist(){try{localStorage.setItem(SAVED,JSON.stringify(answerState))}catch{}}
function showAnswerStyles(){
 const qs=app.querySelectorAll(".question-block");
 qs.forEach(node=>{
  const answer=Number(node.querySelector(".teacher-key")?.dataset.correct);
  node.querySelectorAll(".option").forEach((option,i)=>{
   option.classList.toggle("correct-option",isTeacher&&i+1===answer);
   option.classList.toggle("incorrect-option",isTeacher&&option.querySelector("input").checked&&i+1!==answer);
  });
 });
 const pieces=[
  {group:"picture",correct:exam.comprehension.pictureMatching.answers,weight:1},
  {group:"meaning",correct:exam.comprehension.meaningMatching.answers,weight:1}
 ];
 let points=0,attempted=0;
 pieces.forEach(set=>set.correct.forEach((answer,i)=>{
  const actual=answerState[set.group][i+1];
  if(actual!==undefined)attempted++;
  if(Number(actual)===answer)points+=set.weight;
 }));
 exam.comprehension.choices.forEach(q=>{
  if(answerState.multiple[q.no]!==undefined)attempted++;
  if(Number(answerState.multiple[q.no])===q.answer)points+=2;
 });
 const result=document.getElementById("comp-score");
 if(result)result.textContent="ผลตรวจสำหรับครู (คำตอบที่บันทึกในเครื่องนี้): "+points+" / ๓๕ คะแนน · ตอบแล้ว "+attempted+" / ๒๕ ข้อ";
}
function applyMode(){
 document.body.classList.toggle("show-key",isTeacher);
 document.querySelector("#teacher").setAttribute("aria-pressed",String(isTeacher));
 document.querySelectorAll(".tab").forEach(btn=>btn.classList.toggle("selected",btn.dataset.tab===mode));
 document.querySelectorAll("[data-section]").forEach(node=>node.hidden=node.dataset.section!==mode);
 showAnswerStyles();
 requestAnimationFrame(()=>document.querySelectorAll(".matching-board").forEach(drawLines));
}
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{mode=btn.dataset.tab;applyMode();scrollTo({top:0,behavior:"smooth"})}));
document.querySelector("#teacher").addEventListener("click",()=>{isTeacher=!isTeacher;applyMode()});
document.querySelector("#print").addEventListener("click",()=>window.print());
window.addEventListener("resize",()=>document.querySelectorAll(".matching-board").forEach(drawLines));
async function start(){
 try{
  const [j,b]=await Promise.all([fetch("./data.json"),fetch("../../data/2559-1.json")]);
  if(!j.ok||!b.ok)throw Error("ไม่พบข้อมูลข้อสอบต้นฉบับ");
  exam=await j.json();const bank=await b.json();
  if(exam.year!==2559||exam.comprehension.choices.length!==10||bank.id!=="2559-1"||!bank.assets?.grid)throw Error("ไฟล์ข้อสอบไม่ถูกต้อง");
  verifyPictureOrder(exam.comprehension.pictureMatching.answers);
  assets=bank.assets;app.replaceChildren();
  renderComp();renderOral();app.setAttribute("aria-busy","false");applyMode();
 }catch(err){app.setAttribute("aria-busy","false");app.replaceChildren();add(app,"p","empty","ไม่สามารถแสดงข้อสอบได้: "+err.message)}
}
start();
