const $ = selector => document.querySelector(selector);
const words = [
  { word:"ช้าง", emoji:"🐘", target:true }, { word:"กอง", emoji:"🪙", target:true },
  { word:"ธง", emoji:"🚩", target:true }, { word:"ผึ้ง", emoji:"🐝", target:true },
  { word:"กางเกง", emoji:"👖", target:true }, { word:"ทุ่ง", emoji:"🌾", target:true },
  { word:"นก", emoji:"🐦", target:false }, { word:"ขนม", emoji:"🍪", target:false },
  { word:"ปู", emoji:"🦀", target:false }, { word:"กุหลาบ", emoji:"🌹", target:false },
];
const sentences = [
  ["ช้าง","มี","งวง"], ["ผึ้ง","บิน","กลับ","รัง"], ["เด็ก","ถือ","ธง","สีแดง"],
  ["พ่อ","มอง","ทาง","โค้ง"], ["น้อง","ใส่","กางเกง","สีม่วง"],
];
const exitQuestions = [
  { q:"คำใดอยู่ในมาตราแม่กง", choices:["กา","ช้าง","นก"], answer:"ช้าง" },
  { q:"ตัวสะกดของมาตราแม่กงคือข้อใด", choices:["ง","ก","บ"], answer:"ง" },
  { q:"ประโยคใดมีคำแม่กง", choices:["ปูอยู่ในนา","ช้างเดินในทุ่ง","แมวกินปลา"], answer:"ช้างเดินในทุ่ง" },
];
const missionMeta = [
  { title:"กล่องคำแม่กง", total:words.length },
  { title:"จรวดประโยคพุ่งทะยาน", total:sentences.length },
  { title:"ด่านดาวพิชิตแม่กง", total:exitQuestions.length },
];
const lessonTitles = ["เข้าห้องเรียน","คาราโอเกะแม่กง","สำรวจคำศัพท์","สรุปหลักแม่กง","สาธิตเกม","เริ่ม 2 ภารกิจ","กระดานคะแนน","แกลเลอรี่ประโยค","สรุปและ Exit Ticket","มอบรางวัลและใบงาน"];
const state = { mission:0,index:0,score:0,answers:[],selected:[],busy:false,roundTimer:null,slide:0,classTimer:null,classSeconds:600,karaokeTimer:null,karaokeLine:0 };

function shuffle(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="th-TH";utterance.rate=.75;speechSynthesis.speak(utterance)}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),1700)}
function addScore(points){state.score+=points;$("#score").textContent=state.score}
function stopTransient(){clearInterval(state.roundTimer);clearInterval(state.classTimer);clearInterval(state.karaokeTimer);if("speechSynthesis" in window)window.speechSynthesis.cancel()}
function updateHeader(){const meta=missionMeta[state.mission];$("#missionLabel").textContent=`ภารกิจ ${state.mission+1} จาก 3`;$("#missionTitle").textContent=meta.title;$("#roundLabel").textContent=`ข้อ ${Math.min(state.index+1,meta.total)} / ${meta.total}`;$("#progressBar").style.width=`${state.index/meta.total*100}%`}
function next(){clearInterval(state.roundTimer);state.index++;if(state.index>=missionMeta[state.mission].total){state.mission++;state.index=0;if(state.mission>=missionMeta.length)return renderResult();toast("ผ่านภารกิจแล้ว! รับดาวโบนัส ⭐");addScore(5)}render()}
function render(){state.busy=false;updateHeader();if(state.mission===0)renderSort();if(state.mission===1)renderSentence();if(state.mission===2)renderExit()}

function resolveSort(item, choseTarget, source){
  if(state.busy)return;state.busy=true;clearInterval(state.roundTimer);
  const correct=choseTarget===item.target;source?.classList.add(correct?"correct":"wrong");
  state.answers.push({mission:"sort",word:item.word,correct});
  if(correct){addScore(10);toast("ถูกต้อง! ได้ 10 ดาว ⭐");speak("เก่งมาก")}
  else toast(item.target?`${item.word} มี ง เป็นตัวสะกด`:`${item.word} ไม่ใช่คำแม่กง`);
  setTimeout(next,1100);
}
function renderSort(){
  const item=words[state.index];
  $("#stage").innerHTML=`<p class="instruction">ลากเฉพาะคำแม่กงลงกล่อง หรือใช้ปุ่มช่วยสำหรับจอสัมผัส</p><div id="roundClock" class="round-clock">⏱️ 10 วินาที</div>
    <div class="conveyor"><article id="movingWord" class="word-card" draggable="true"><span class="picture">${item.emoji}</span><strong>${item.word}</strong><br><button class="speak-button" type="button">🔊 ฟังคำ</button></article></div>
    <div id="maeKongBox" class="drop-box">📦 กล่องคำแม่กง<br><small>ลากคำที่มี ง เป็นตัวสะกดมาวาง</small></div>
    <div class="button-row"><button id="sendBox" class="primary-button">ใส่กล่องแม่กง</button><button id="passWord" class="secondary-button">ส่งคำนี้ต่อ</button></div>`;
  const card=$("#movingWord"),box=$("#maeKongBox");$(".speak-button").addEventListener("click",event=>{event.stopPropagation();speak(item.word)});
  card.addEventListener("dragstart",event=>event.dataTransfer.setData("text/plain",item.word));
  box.addEventListener("dragover",event=>{event.preventDefault();box.classList.add("drag-over")});
  box.addEventListener("dragleave",()=>box.classList.remove("drag-over"));
  box.addEventListener("drop",event=>{event.preventDefault();box.classList.remove("drag-over");resolveSort(item,true,box)});
  $("#sendBox").addEventListener("click",()=>resolveSort(item,true,$("#sendBox")));
  $("#passWord").addEventListener("click",()=>resolveSort(item,false,$("#passWord")));
  let remaining=10;state.roundTimer=setInterval(()=>{remaining--;$("#roundClock").textContent=`⏱️ ${remaining} วินาที`;if(remaining<=0)resolveSort(item,false,null)},1000);
}
function renderSentence(){
  const sentence=sentences[state.index],bank=shuffle(sentence);state.selected=[];
  $("#stage").innerHTML=`<p class="sentence-prompt">แตะหรือลากคำตามลำดับ เพื่อเติมท่อนเชื้อเพลิงให้จรวด</p><div class="rocket-scene"><span id="rocket" class="rocket">🚀</span><div id="sentenceOutput" class="sentence-output">เลือกคำเพื่อเริ่มสร้างประโยค</div></div><div class="word-bank">${bank.map((word,i)=>`<button class="word-button" draggable="true" data-i="${i}" data-word="${word}">${word}</button>`).join("")}</div><div class="button-row"><button id="resetSentence" class="secondary-button">เริ่มใหม่</button><button id="checkSentence" class="primary-button">ตรวจและปล่อยจรวด</button></div>`;
  const output=$("#sentenceOutput");
  function choose(button){if(button.disabled)return;button.disabled=true;state.selected.push({word:button.dataset.word,index:button.dataset.i});paint()}
  function paint(){output.innerHTML=state.selected.length?state.selected.map(x=>`<span>${x.word}</span>`).join(""):"เลือกคำเพื่อเริ่มสร้างประโยค"}
  document.querySelectorAll(".word-button").forEach(button=>{button.addEventListener("click",()=>choose(button));button.addEventListener("dragstart",event=>event.dataTransfer.setData("text/plain",button.dataset.i))});
  output.addEventListener("dragover",event=>event.preventDefault());output.addEventListener("drop",event=>{event.preventDefault();const button=document.querySelector(`[data-i="${event.dataTransfer.getData("text/plain")}"]`);if(button)choose(button)});
  $("#resetSentence").addEventListener("click",()=>{state.selected=[];document.querySelectorAll(".word-button").forEach(b=>b.disabled=false);paint()});
  $("#checkSentence").addEventListener("click",()=>{if(state.busy||state.selected.length!==sentence.length){toast("เลือกคำให้ครบทุกคำก่อนนะ");return}state.busy=true;const correct=state.selected.map(x=>x.word).join("")===sentence.join("");if(correct){state.answers.push({mission:"sentence",sentence:sentence.join(" "),correct:true});addScore(20);output.style.borderColor="#16a36a";$("#rocket").classList.add("launch");toast("จรวดพุ่งทะยาน! ได้ 20 ดาว 🚀");speak(sentence.join(" "));setTimeout(next,1500)}else{output.style.borderColor="#e45454";toast("ลำดับยังไม่ถูก ลองอีกครั้ง");state.busy=false;setTimeout(()=>$("#resetSentence").click(),700)}});
}
function renderExit(){const item=exitQuestions[state.index];$("#stage").innerHTML=`<article class="exit-question"><span class="eyebrow">Exit Ticket ข้อที่ ${state.index+1}</span><h2>${item.q}</h2><div class="exit-options">${item.choices.map(choice=>`<button data-choice="${choice}">${choice}</button>`).join("")}</div></article>`;document.querySelectorAll("[data-choice]").forEach(button=>button.addEventListener("click",()=>{if(state.busy)return;state.busy=true;const correct=button.dataset.choice===item.answer;button.classList.add(correct?"correct":"wrong");state.answers.push({mission:"exit",question:item.q,correct});if(correct){addScore(15);toast("ตอบถูก! รับ 15 ดาว ⭐")}else{document.querySelector(`[data-choice="${item.answer}"]`).classList.add("correct");toast(`คำตอบคือ ${item.answer}`)}setTimeout(next,1100)}))}
function renderResult(){
  $("#missionLabel").textContent="จบการผจญภัย";$("#missionTitle").textContent="สรุปผล";$("#roundLabel").textContent="สำเร็จ";$("#progressBar").style.width="100%";
  const exitAnswers=state.answers.filter(x=>x.mission==="exit"),exitCorrect=exitAnswers.filter(x=>x.correct).length,passed=exitCorrect>=2;
  $("#stage").innerHTML=`<section class="result"><div class="result-medal">${passed?"🏆":"🌟"}</div><h2>${passed?"ผู้พิชิตมาตราแม่กง":"เก่งขึ้นอีกก้าวแล้ว"}</h2><p>Exit Ticket ถูก ${exitCorrect} จาก 3 ข้อ · เกณฑ์ผ่าน 2 ข้อ</p><div class="result-score">⭐ คะแนนรวม ${state.score}</div><p>${passed?"ได้รับสติกเกอร์ดาวดิจิทัล! หนูจำได้แล้วว่า คำแม่กงมี ง เป็นตัวสะกด":"ลองอีกครั้งเพื่อรับสติกเกอร์ดาวนะ"}</p><button id="restartButton" class="primary-button" type="button">เล่นอีกครั้ง ↻</button></section>`;
  $("#restartButton").addEventListener("click",()=>{Object.assign(state,{mission:0,index:0,score:0,answers:[],selected:[],busy:false});$("#score").textContent="0";render()});
}

const slideTemplates = [
  ()=>`<span class="slide-icon">🔐</span><h2>เตรียมพร้อม<br><em>เข้าห้องเรียน</em></h2><p>ฉายรหัสห้องจาก Teacher Dashboard ให้นักเรียนกรอก แล้วตรวจรายชื่อที่เชื่อมต่อให้ครบ</p><div class="room-demo"><span>0</span><span>0</span><span>0</span><span>0</span><span>0</span><span>0</span></div><div class="slide-actions"><a class="primary-button" href="teacher.html">เปิด Teacher Dashboard</a><a class="secondary-button" href="display.html">เปิดจอโปรเจกเตอร์</a></div>`,
  ()=>`<div class="karaoke-box"><span class="slide-icon">🎤</span><h2>คาราโอเกะ <em>แม่กง</em></h2><div id="karaokeLyrics"><p class="karaoke-line"><span class="karaoke-word target">ธง</span> คาง <span class="karaoke-word target">ผึ้ง</span> ส่งเสียง ง ง</p><p class="karaoke-line">กำแพง กางเกง รัง และทุ่ง</p><p class="karaoke-line">มี ง อยู่ท้าย มาร้องพร้อมกัน</p></div><button id="karaokePlay" class="primary-button">▶ ร้องและไล่คำ</button></div>`,
  ()=>`<span class="slide-icon">🔎</span><h2>อ่าน ฟัง และ<em>สังเกต</em></h2><p>แตะบัตรคำเพื่อฟังเสียง แล้วช่วยกันบอกความหมาย</p><div class="vocab-grid">${[{w:"กำแพง",e:"🧱",t:1},{w:"กางเกง",e:"👖",t:1},{w:"รัง",e:"🪹",t:1},{w:"ผึ้ง",e:"🐝",t:1},{w:"ขนม",e:"🍪"},{w:"กุหลาบ",e:"🌹"},{w:"ปู",e:"🦀"},{w:"นก",e:"🐦"}].map(x=>`<button class="vocab-card ${x.t?"target":""}" data-speak="${x.w}"><span>${x.e}</span><strong>${x.w}</strong><small>${x.t?"มีเสียง ง ท้ายคำ":"คำเปรียบเทียบ"}</small></button>`).join("")}</div>`,
  ()=>`<span class="slide-icon">💡</span><h2>มาตรา<em>แม่กง</em></h2><div class="rule-card">คำที่มี <strong>ง</strong> เป็นตัวสะกด<br>เมื่ออ่านจะมีเสียง <strong>“ง”</strong> อยู่ท้ายคำ</div><div class="demo-row"><span class="demo-word">รอ + อะ + งอ = รัง</span><button class="speak-button" data-speak="รัง">🔊 ฟังคำว่า รัง</button></div>`,
  ()=>`<span class="slide-icon">🧑‍🏫</span><h2>สาธิตก่อนเล่น<br><em>หนึ่งรอบ</em></h2><p>คำว่า “ช้าง” มี ง เป็นตัวสะกด จึงลากลงกล่องแม่กง ส่วนคำว่า “นก” ให้กดส่งต่อ</p><div class="demo-row"><span class="demo-word">🐘 ช้าง</span><span>→</span><span class="drop-box">📦 กล่องแม่กง</span></div>`,
  ()=>`<span class="slide-icon">🎮</span><h2>เริ่มภารกิจ<br><em>30 นาที</em></h2><p>ภารกิจ 1 กล่องคำแม่กง และภารกิจ 2 จรวดประโยคพุ่งทะยาน</p><div class="slide-actions"><button id="launchStudentGame" class="primary-button">เปิดเกมนักเรียน</button><a class="secondary-button" href="teacher.html">ควบคุมคาบจากจอครู</a></div>`,
  ()=>`<span class="slide-icon">🏅</span><h2>กระดาน<em>คะแนนรวม</em></h2><p>ฉายเป็นระยะเพื่อสร้างแรงจูงใจ และใช้ Teacher Dashboard ช่วยนักเรียนที่คะแนนต่ำกว่าเกณฑ์</p><div class="slide-actions"><a class="primary-button" href="display.html">เปิด Leaderboard</a><a class="secondary-button" href="teacher.html">ดูรายละเอียดนักเรียน</a></div>`,
  ()=>`<span class="slide-icon">🖍️</span><h2>แกลเลอรี่<br><em>ประโยคแม่กง</em></h2><p>กลุ่มละ 3–4 คน เลือกคำแม่กง แต่งหนึ่งประโยค เขียนตัวโตบน A4 แล้วติดรอบห้อง</p><div id="classTimer" class="timer-card">10:00</div><div class="slide-actions"><button id="timerStart" class="primary-button">▶ เริ่มจับเวลา</button><button id="timerReset" class="secondary-button">↻ เริ่มใหม่</button></div><ul class="checklist"><li>□ กระดาษ A4 และปากกาเมจิก</li><li>□ สติกเกอร์ดาวสำหรับ Gallery Walk</li><li>□ ตัวแทนกลุ่มอ่านประโยคให้เพื่อนฟัง</li></ul>`,
  ()=>`<span class="slide-icon">🗝️</span><h2>สรุปและ<br><em>Exit Ticket</em></h2><div class="rule-card">มาตราแม่กง คือ คำที่มี <strong>ง</strong> เป็นตัวสะกด และนำมาเรียงเป็นประโยคสื่อความหมายได้</div><p>ให้นักเรียนทำ Exit Ticket 3 ข้อ เกณฑ์ผ่านอย่างน้อย 2 ข้อ</p><button id="launchExit" class="primary-button">เปิดเกมและทำ Exit Ticket</button>`,
  ()=>`<span class="slide-icon">🎉</span><h2>ปรบมือให้<br><em>ผู้พิชิตแม่กง</em></h2><div class="award-row">🥇 🥈 🥉</div><p>ฉายคะแนนรวม มอบดาวดิจิทัล และแจกใบงานที่ 2 กลับไปทบทวน</p><div class="slide-actions"><a class="primary-button" href="display.html">ฉายผลคะแนนท้ายคาบ</a><a class="secondary-button" href="worksheet-plan-2.html" target="_blank">เปิดและพิมพ์ใบงานที่ 2</a></div>`,
];
function renderLessonNav(){$("#lessonSteps").innerHTML=lessonTitles.map((title,index)=>`<li class="${index===state.slide?"active":""}" data-slide="${index}">${index+1}. ${title}</li>`).join("");document.querySelectorAll("[data-slide]").forEach(item=>item.addEventListener("click",()=>{state.slide=Number(item.dataset.slide);renderSlide()}))}
function startClassTimer(){clearInterval(state.classTimer);state.classTimer=setInterval(()=>{state.classSeconds=Math.max(0,state.classSeconds-1);paintClassTimer();if(!state.classSeconds)clearInterval(state.classTimer)},1000)}
function paintClassTimer(){const timer=$("#classTimer");if(timer)timer.textContent=`${String(Math.floor(state.classSeconds/60)).padStart(2,"0")}:${String(state.classSeconds%60).padStart(2,"0")}`}
function startKaraoke(){const lines=["ธง คาง ผึ้ง ส่งเสียง ง ง","กำแพง กางเกง รัง และทุ่ง","มี ง อยู่ท้าย มาร้องพร้อมกัน"];let line=0;speak(lines[line]);clearInterval(state.karaokeTimer);state.karaokeTimer=setInterval(()=>{line++;if(line>=lines.length){clearInterval(state.karaokeTimer);return}document.querySelectorAll(".karaoke-line").forEach((item,index)=>item.style.opacity=index===line?"1":".35");speak(lines[line])},3500)}
function renderSlide(){
  stopTransient();$("#slideCounter").textContent=`${state.slide+1} / ${slideTemplates.length}`;$("#prevSlide").disabled=state.slide===0;$("#nextSlide").textContent=state.slide===slideTemplates.length-1?"จบการสอน ✓":"ถัดไป →";$("#lessonStage").innerHTML=slideTemplates[state.slide]();renderLessonNav();
  document.querySelectorAll("[data-speak]").forEach(button=>button.addEventListener("click",()=>speak(button.dataset.speak)));
  $("#karaokePlay")?.addEventListener("click",startKaraoke);$("#timerStart")?.addEventListener("click",startClassTimer);$("#timerReset")?.addEventListener("click",()=>{state.classSeconds=600;paintClassTimer()});
  $("#launchStudentGame")?.addEventListener("click",openGame);$("#launchExit")?.addEventListener("click",()=>{openGame();state.mission=2;state.index=0;render()});
}
function openGame(){stopTransient();$("#hero").classList.add("hidden");$("#lesson").classList.add("hidden");$("#game").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});render()}
function openLesson(){stopTransient();$("#hero").classList.add("hidden");$("#game").classList.add("hidden");$("#lesson").classList.remove("hidden");state.slide=0;renderSlide();window.scrollTo({top:0,behavior:"smooth"})}

$("#startButton").addEventListener("click",openGame);
$("#teachButton").addEventListener("click",openLesson);
$("#closeLesson").addEventListener("click",()=>{stopTransient();$("#lesson").classList.add("hidden");$("#hero").classList.remove("hidden")});
$("#prevSlide").addEventListener("click",()=>{if(state.slide>0){state.slide--;renderSlide()}});
$("#nextSlide").addEventListener("click",()=>{if(state.slide<slideTemplates.length-1){state.slide++;renderSlide()}else{$("#lesson").classList.add("hidden");$("#hero").classList.remove("hidden")}});
$("#fullscreenButton").addEventListener("click",()=>document.fullscreenElement?document.exitFullscreen():$("#lesson").requestFullscreen());
