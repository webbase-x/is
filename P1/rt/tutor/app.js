import {YEARS,GROUPS,buildTypeOneDeck,selectQuestions,summarize,csvCell} from "./core.js";

const $ = id => document.getElementById(id);
const KIND = Object.fromEntries(GROUPS.map(group => [group.id,group.label]));
let bankDeck=[],visibleDeck=[],answers={},year=2568,group="all",index=0,token=0;

function announce(text){$("feedback").textContent=text}
function storageKey(){return "rt-tutor-text-type1-"+year}
function readAnswers(){
  try {
    const value=JSON.parse(localStorage.getItem(storageKey())||"{}");
    if(!value||typeof value!=="object"||Array.isArray(value))return {};
    const cleaned={};
    bankDeck.forEach(q=>{if(Number.isInteger(value[q.id])&&value[q.id]>=0&&value[q.id]<=q.maxPoints)cleaned[q.id]=value[q.id]});
    return cleaned;
  } catch {return {}}
}
function persist(){
  try {localStorage.setItem(storageKey(),JSON.stringify(answers));return true}
  catch {announce("คะแนนใช้ได้ระหว่างเปิดหน้านี้ แต่เบราว์เซอร์ไม่อนุญาตให้บันทึกบนเครื่อง");return false}
}
function createOption(value,label){
  const option=document.createElement("option");option.value=String(value);option.textContent=label;return option;
}
function renderGroups(){
  $("groups").replaceChildren();
  for(const entry of GROUPS){
    const count=selectQuestions(bankDeck,entry.id).length;
    const btn=document.createElement("button");
    btn.type="button";btn.className="group-button";btn.dataset.group=entry.id;
    btn.setAttribute("aria-pressed",entry.id===group?"true":"false");
    btn.textContent=entry.label+" ("+count+")";
    btn.addEventListener("click",()=>setGroup(entry.id));
    $("groups").appendChild(btn);
  }
}
function setGroup(next){
  if(!GROUPS.some(item=>item.id===next))return;
  group=next;index=0;visibleDeck=selectQuestions(bankDeck,group);
  renderGroups();$("summary").hidden=true;
  if(!visibleDeck.length){
    $("stage").hidden=true;$("loading").hidden=false;
    $("loading").textContent="ปีนี้ไม่มีข้อสอบข้อความในหมวดนี้ กรุณาเลือกหมวดอื่น";
  }else{
    $("loading").hidden=true;$("stage").hidden=false;renderQuestion();
  }
  $("export").disabled=!bankDeck.length;
}
function renderQuestion(){
  const q=visibleDeck[index];if(!q)return;
  $("question-kind").textContent=KIND[q.group]||"อ่านออกเสียง";
  $("question-source").textContent="พ.ศ. "+q.year+" · ต้นฉบับข้อ "+q.no+(q.sourcePage?" · หน้า "+q.sourcePage:"");
  $("question-count").textContent="ข้อ "+(index+1)+" / "+visibleDeck.length;
  $("progress-bar").style.width=((index+1)/visibleDeck.length*100)+"%";
  const text=$("question-text");
  text.textContent=q.text;
  text.className="reading-text"+(q.group==="oral-passage"?" passage":q.group==="oral-sentence"?" sentence":"");
  $("question-hint").textContent="ข้อความจากข้อสอบรูปแบบที่ 1 • "+KIND[q.group]+" • ครูประเมินการอ่านจริง";
  $("score").replaceChildren(createOption("","ยังไม่ประเมิน"));
  for(let i=0;i<=q.maxPoints;i++)$("score").appendChild(createOption(i,i+" คะแนน"));
  $("score-max").textContent="(เต็ม "+q.maxPoints+" คะแนน)";
  $("score").value=Object.hasOwn(answers,q.id)?String(answers[q.id]):"";
  $("previous").disabled=index===0;
  $("next").textContent=index===visibleDeck.length-1?"ดูสรุป →":"ข้อต่อไป →";
  announce(Object.hasOwn(answers,q.id)?"บันทึกไว้แล้ว "+answers[q.id]+" / "+q.maxPoints+" คะแนน":"ยังไม่ได้ประเมินข้อนี้");
}
function scoreCurrent(){
  const q=visibleDeck[index];if(!q)return;
  const raw=$("score").value;
  if(raw===""){
    delete answers[q.id];
    persist();announce("ล้างคะแนนข้อนี้แล้ว");return;
  }
  const value=Number(raw);
  if(!Number.isInteger(value)||value<0||value>q.maxPoints){announce("คะแนนไม่ถูกต้อง");return}
  answers[q.id]=value;
  const saved=persist();
  if(saved)announce("บันทึก "+value+" / "+q.maxPoints+" คะแนนแล้ว");
}
function showSummary(){
  if(!visibleDeck.length)return;
  $("stage").hidden=true;$("summary").hidden=false;
  const totals=summarize(visibleDeck,answers);
  $("summary-context").textContent="พ.ศ. "+year+" · ประเภทที่ 1 · "+KIND[group]+" · "+totals.total+" ข้อ";
  $("summary-completed").textContent=totals.answered+" / "+totals.total;
  $("summary-score").textContent=totals.points+" / "+totals.maxPoints;
  $("summary-percent").textContent=totals.percent+"%";
  $("summary-items").replaceChildren();
  visibleDeck.forEach((q,i)=>{
    const row=document.createElement("div");row.className="summary-item";
    const num=document.createElement("b");num.textContent="ข้อ "+(i+1);
    const name=document.createElement("span");name.textContent=q.text.length>80?q.text.slice(0,80)+"…":q.text;
    const score=document.createElement("em");
    score.textContent=Object.hasOwn(answers,q.id)?answers[q.id]+" / "+q.maxPoints:"ยังไม่ประเมิน";
    row.append(num,name,score);$("summary-items").appendChild(row);
  });
  $("summary").scrollIntoView({behavior:"smooth",block:"start"});
}
function downloadCSV(){
  if(!bankDeck.length)return;
  const rows=[["ปี","ประเภท","หมวด","ข้อ","ข้อความ","คะแนนที่ได้","คะแนนเต็ม","ไฟล์ต้นฉบับ","หน้าต้นฉบับ"]];
  for(const q of bankDeck){
    rows.push([year,1,KIND[q.group],q.no,q.text,Object.hasOwn(answers,q.id)?answers[q.id]:"",q.maxPoints,q.sourceFile,q.sourcePage??""]);
  }
  const csv="\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");
  link.href=url;link.download="RT-Tutor-ประเภท1-"+year+".csv";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadYear(selected){
  const myToken=++token;
  year=selected;group="all";index=0;
  $("stage").hidden=true;$("summary").hidden=true;$("loading").hidden=false;
  $("loading").textContent="กำลังโหลดข้อสอบ พ.ศ. "+year+"…";
  $("export").disabled=true;
  try{
    if(!YEARS.includes(year))throw new Error("ปีไม่ถูกต้อง");
    const response=await fetch("../data/"+year+"-1.json",{cache:"no-cache"});
    if(!response.ok)throw new Error("ไม่พบข้อสอบปีนี้ ("+response.status+")");
    const raw=await response.json();
    if(myToken!==token)return;
    bankDeck=buildTypeOneDeck(raw);
    answers=readAnswers();
    if(!bankDeck.length)throw new Error("ปีนี้ไม่มีข้อสอบที่ใช้ข้อความอย่างเดียว");
    setGroup("all");
  }catch(err){
    if(myToken!==token)return;
    bankDeck=[];visibleDeck=[];answers={};renderGroups();
    $("loading").hidden=false;
    $("loading").textContent="เปิดชุดข้อสอบไม่ได้: "+err.message;
  }
}
for(const value of YEARS)$("year").appendChild(createOption(value,"พ.ศ. "+value));
$("year").value=String(year);
$("year").addEventListener("change",()=>loadYear(Number($("year").value)));
$("previous").addEventListener("click",()=>{if(index>0){index--;renderQuestion()}});
$("next").addEventListener("click",()=>{if(index<visibleDeck.length-1){index++;renderQuestion()}else showSummary()});
$("summary-button").addEventListener("click",showSummary);
$("return-question").addEventListener("click",()=>{$("summary").hidden=true;$("stage").hidden=false;renderQuestion()});
$("save-score").addEventListener("click",scoreCurrent);
$("export").addEventListener("click",downloadCSV);
$("reset").addEventListener("click",()=>{
  if(!bankDeck.length)return;
  if(!confirm("เริ่มแบบทดสอบปี "+year+" ใหม่ และลบคะแนนของปีนี้ที่บันทึกบนเครื่องใช่หรือไม่?"))return;
  answers={};persist();index=0;
  $("summary").hidden=true;$("stage").hidden=false;
  renderQuestion();
});
loadYear(year);
