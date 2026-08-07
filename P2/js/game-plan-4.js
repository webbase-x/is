import "./emoji.js?v=20260805-emoji-images-1";

const $ = selector => document.querySelector(selector);
const sortWords = shuffle([
  ["กล้วย","แม่เกย","🍌"],["กลาย","แม่เกย","🔄"],["จ่าย","แม่เกย","💵"],["เฉย","แม่เกย","🙂"],["ด้าย","แม่เกย","🧵"],
  ["ทราย","แม่เกย","🏖️"],["ฝ้าย","แม่เกย","☁️"],["ลอย","แม่เกย","🎈"],["สบาย","แม่เกย","😌"],["เหนื่อย","แม่เกย","😮‍💨"],
  ["ข้าว","แม่เกอว","🍚"],["เขียว","แม่เกอว","🟢"],["ชาว","แม่เกอว","👨‍🌾"],["เดียว","แม่เกอว","1️⃣"],["แถว","แม่เกอว","🚶"],
  ["แนว","แม่เกอว","📏"],["นิ้ว","แม่เกอว","☝️"],["พร้าว","แม่เกอว","🥥"],["ว่าว","แม่เกอว","🪁"],["เอว","แม่เกอว","🧍"],
].map(([word,category,emoji]) => ({ word, category, emoji })));
const pictureQuestions = [
  { emoji:"🍌", words:["แม่","ซื้อ","กล้วย"], target:"กล้วย", category:"แม่เกย" },
  { emoji:"🏆", words:["พี่","ถือ","ถ้วย"], target:"ถ้วย", category:"แม่เกย" },
  { emoji:"🪁", words:["น้อง","เล่น","ว่าว"], target:"ว่าว", category:"แม่เกอว" },
  { emoji:"🍚", words:["ยาย","หุง","ข้าว"], target:"ข้าว", category:"แม่เกอว" },
  { emoji:"🚶", words:["เด็ก","เข้า","แถว"], target:"แถว", category:"แม่เกอว" },
  { emoji:"🌱", words:["พ่อ","ปลูก","อ้อย"], target:"อ้อย", category:"แม่เกย" },
  { emoji:"🐃", words:["ชาวนา","เลี้ยง","ควาย"], target:"ควาย", category:"แม่เกย" },
  { emoji:"🌟", words:["ดาว","บนฟ้า","สวย"], target:"ดาว", category:"แม่เกอว" },
  { emoji:"👕", words:["พี่สาว","ใส่","เสื้อ","สีเขียว"], target:"สีเขียว", category:"แม่เกอว" },
  { emoji:"🍜", words:["น้อง","กิน","ก๋วยเตี๋ยว","อร่อย"], target:"ก๋วยเตี๋ยว", category:"แม่เกอว" },
];
const exitQuestions = [
  { q:"คำมาตราแม่เกยมีลักษณะอย่างไร", choices:["มี ย เป็นตัวสะกด","มี ว เป็นตัวสะกด","ไม่มีตัวสะกด"], answer:"มี ย เป็นตัวสะกด" },
  { q:"คำมาตราแม่เกอวมีลักษณะอย่างไร", choices:["มี ว เป็นตัวสะกด","มี ย เป็นตัวสะกด","มี ม เป็นตัวสะกด"], answer:"มี ว เป็นตัวสะกด" },
  { q:"คำใดอยู่ในมาตราแม่เกย", choices:["กล้วย","ดาว","ลม"], answer:"กล้วย" },
  { q:"ข้อใดเป็นคำมาตราแม่เกอวทั้ง 2 คำ", choices:["ข้าว, ว่าว","ทราย, ดาว","สบาย, นิ้ว"], answer:"ข้าว, ว่าว" },
  { q:"ข้อใดอธิบายคำว่า “บัว” ได้ถูกต้อง", choices:["ว เป็นส่วนหนึ่งของสระอัว","ว เป็นตัวสะกดแม่เกอว","ย เป็นตัวสะกดแม่เกย"], answer:"ว เป็นส่วนหนึ่งของสระอัว" },
];
const missions = [
  { title:"คู่หู ย ว", total:sortWords.length },
  { title:"เลือกให้ใช่", total:pictureQuestions.length },
  { title:"แบบทดสอบท้ายคาบ", total:exitQuestions.length },
];
const lessonTitles = ["เข้าห้องเรียน","เพลงแม่เกย","เพลงแม่เกอว","แฟลชการ์ด ย–ว","สรุปหลักและสาธิต","เริ่ม 2 ภารกิจ","กระดานคะแนน","ภาพคู่หูของฉัน","สรุปและแบบทดสอบ","มอบรางวัลและใบงาน"];
const state = { mission:0,index:0,score:0,answers:[],busy:false,slide:0,selected:[],firstTry:true,classTimer:null,classSeconds:900 };

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index],copy[pick]] = [copy[pick],copy[index]];
  }
  return copy;
}
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH"; utterance.rate = .68;
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(voice => /^th(?:-|_)TH$/i.test(voice.lang)) || voices.find(voice => /^th/i.test(voice.lang)) || null;
  speechSynthesis.speak(utterance);
}
function toast(message) {
  const element = $("#toast");
  element.textContent = message; element.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove("show"),1700);
}
function stopTransient() { clearInterval(state.classTimer); window.speechSynthesis?.cancel?.(); }
function addScore(points) { state.score += points; $("#score").textContent = state.score; }
function updateHeader() {
  const meta = missions[state.mission];
  $("#missionLabel").textContent = `ภารกิจ ${state.mission + 1} จาก 3`;
  $("#missionTitle").textContent = meta.title;
  $("#roundLabel").textContent = `ข้อ ${Math.min(state.index + 1,meta.total)} / ${meta.total}`;
  $("#progressBar").style.width = `${state.index / meta.total * 100}%`;
}
function next() {
  state.index += 1; state.busy = false;
  if (state.index >= missions[state.mission].total) {
    state.mission += 1; state.index = 0;
    if (state.mission >= missions.length) return renderResult();
    addScore(5); toast("ผ่านภารกิจ! รับดาวโบนัส ⭐");
  }
  render();
}
function render() {
  updateHeader();
  if (state.mission === 0) renderSort();
  if (state.mission === 1) renderPicture();
  if (state.mission === 2) renderExit();
}
function renderSort() {
  const item = sortWords[state.index];
  $("#stage").innerHTML = `<section class="yw-basket-game">
    <div class="game-status-row"><span>คำที่ ${state.index + 1} / ${sortWords.length}</span><span class="mini-score">คะแนน ${state.score}</span></div>
    <article class="yw-word-card"><span>${item.emoji}</span><strong>${item.word}</strong><button class="speak-button" data-speak>🔊 ฟังคำ</button></article>
    <p class="instruction" data-feedback>สังเกตพยัญชนะตัวสุดท้าย แล้วเลือกตะกร้า</p>
    <div class="yw-basket-grid"><button class="yw-basket koei" data-answer="แม่เกย"><span>🧺</span><strong>ตะกร้า ย</strong><small>มาตราแม่เกย</small></button><button class="yw-basket koew" data-answer="แม่เกอว"><span>🧺</span><strong>ตะกร้า ว</strong><small>มาตราแม่เกอว</small></button></div>
  </section>`;
  $("[data-speak]").onclick = () => speak(item.word);
  document.querySelectorAll("[data-answer]").forEach(button => button.onclick = () => {
    if (state.busy) return;
    state.busy = true;
    document.querySelectorAll("[data-answer]").forEach(candidate => { candidate.disabled = true; });
    const correct = button.dataset.answer === item.category;
    button.classList.add(correct ? "correct" : "wrong");
    document.querySelector(`[data-answer="${item.category}"]`)?.classList.add("correct");
    if (correct) addScore(10);
    const finalLetter = item.category === "แม่เกย" ? "ย" : "ว";
    $("[data-feedback]").textContent = `${item.word} มี ${finalLetter} เป็นตัวสะกด จึงเป็น${item.category}`;
    state.answers.push({ mission:"sort",correct,word:item.word });
    setTimeout(next,1050);
  });
}
function renderPicture() {
  const item = pictureQuestions[state.index];
  const bank = shuffle(item.words.map((word,index) => ({ word,id:`${state.index}-${index}` })));
  state.selected = []; state.firstTry = true;
  $("#stage").innerHTML = `<p class="instruction">ดูภาพ แล้วแตะหรือลากคำตามลำดับเพื่อเรียงเป็นประโยค</p>
    <div class="rocket-scene yw-picture-scene"><span class="picture" style="font-size:86px">${item.emoji}</span><div id="sentenceOutput" class="sentence-output">แตะคำเพื่อเรียงประโยค</div></div>
    <div class="word-bank">${bank.map(entry => `<button class="word-button" draggable="true" data-id="${entry.id}" data-word="${entry.word}">${entry.word}</button>`).join("")}</div>
    <p class="instruction" id="pictureFeedback" style="margin-top:10px">คำแม่เกยหรือแม่เกอวจะแสดงเป็นสีพิเศษเมื่อตอบถูก</p>
    <div class="button-row"><button id="resetPicture" class="secondary-button">เริ่มเรียงใหม่</button><button id="checkPicture" class="primary-button">ตรวจคำตอบ</button></div>`;
  const output = $("#sentenceOutput");
  const paint = showTarget => {
    output.innerHTML = state.selected.length
      ? state.selected.map(entry => `<span class="${showTarget && entry.word === item.target ? "is-yw-target" : ""}">${entry.word}</span>`).join("")
      : "แตะคำเพื่อเรียงประโยค";
  };
  const choose = button => {
    if (!button || button.disabled) return;
    button.disabled = true; state.selected.push({ id:button.dataset.id,word:button.dataset.word }); paint(false);
  };
  const reset = () => {
    state.selected = []; document.querySelectorAll("[data-id]").forEach(button => { button.disabled = false; });
    output.style.borderColor = ""; paint(false);
  };
  document.querySelectorAll("[data-id]").forEach(button => {
    button.onclick = () => choose(button);
    button.ondragstart = event => event.dataTransfer.setData("text/plain",button.dataset.id);
  });
  output.ondragover = event => event.preventDefault();
  output.ondrop = event => { event.preventDefault(); choose(document.querySelector(`[data-id="${CSS.escape(event.dataTransfer.getData("text/plain"))}"]`)); };
  $("#resetPicture").onclick = reset;
  $("#checkPicture").onclick = () => {
    if (state.selected.length !== item.words.length) return toast("เลือกคำให้ครบทุกคำก่อนนะ");
    const answer = item.words.join(" ");
    const response = state.selected.map(entry => entry.word).join(" ");
    if (response !== answer) {
      state.firstTry = false; output.style.borderColor = "#e45454";
      toast("ลำดับยังไม่ถูก ลองใหม่อีกครั้ง"); navigator.vibrate?.([90,55,90]);
      return setTimeout(reset,700);
    }
    if (state.firstTry) addScore(20);
    paint(true); output.style.borderColor = "#16a36a";
    $("#pictureFeedback").textContent = `ถูกต้อง! “${item.target}” เป็นคำ${item.category}`;
    state.answers.push({ mission:"picture",correct:state.firstTry,sentence:answer });
    speak(answer); setTimeout(next,1200);
  };
}
function renderExit() {
  const item = exitQuestions[state.index];
  $("#stage").innerHTML = `<article class="exit-question"><span class="eyebrow">แบบทดสอบท้ายคาบ ข้อที่ ${state.index + 1}</span><h2>${item.q}</h2><div class="exit-options">${shuffle(item.choices).map(choice => `<button data-choice="${choice}">${choice}</button>`).join("")}</div></article>`;
  document.querySelectorAll("[data-choice]").forEach(button => button.onclick = () => {
    if (state.busy) return;
    state.busy = true;
    const correct = button.dataset.choice === item.answer;
    button.classList.add(correct ? "correct" : "wrong");
    document.querySelector(`[data-choice="${CSS.escape(item.answer)}"]`)?.classList.add("correct");
    if (correct) addScore(15);
    state.answers.push({ mission:"exit",correct });
    toast(correct ? "ตอบถูก! รับดาว ⭐" : `คำตอบคือ ${item.answer}`);
    setTimeout(next,1050);
  });
}
function renderResult() {
  const exitCorrect = state.answers.filter(answer => answer.mission === "exit" && answer.correct).length;
  const skill = state.answers.filter(answer => answer.mission !== "exit");
  const skillSummary = skill.length ? `${Math.round(skill.filter(answer => answer.correct).length / skill.length * 100)}%` : "ยังไม่ได้ทำ";
  const passed = exitCorrect >= 3;
  $("#missionLabel").textContent = "จบการผจญภัย"; $("#missionTitle").textContent = "สรุปผล"; $("#roundLabel").textContent = "สำเร็จ"; $("#progressBar").style.width = "100%";
  $("#stage").innerHTML = `<section class="result"><div class="result-medal">${passed ? "🏆" : "🌟"}</div><h2>${passed ? "ผ่านเกณฑ์แล้ว เก่งมาก!" : "ฝึกอีกนิดนะ"}</h2><p>แบบทดสอบท้ายคาบถูก ${exitCorrect}/5 · กิจกรรมหลัก ${skillSummary}</p><div class="result-score">⭐ คะแนนรวม ${state.score}</div><p>${passed ? "ได้รับดาวแล้ว!" : "เกณฑ์ผ่านคืออย่างน้อย 3 ข้อ"}</p><button id="restartButton" class="primary-button">เล่นอีกครั้ง ↻</button></section>`;
  $("#restartButton").onclick = () => {
    sortWords.splice(0,sortWords.length,...shuffle(sortWords));
    Object.assign(state,{ mission:0,index:0,score:0,answers:[],busy:false,selected:[],firstTry:true });
    $("#score").textContent = "0"; render();
  };
}

const slides = [
  () => `<span class="slide-icon">🔐</span><h2>เตรียมพร้อม<br><em>เข้าห้องเรียน</em></h2><p>ฉายรหัสห้องให้นักเรียนกรอก และตรวจรายชื่อที่เชื่อมต่อให้ครบ</p><div class="room-demo">${"000000".split("").map(number => `<span>${number}</span>`).join("")}</div><div class="slide-actions"><a class="primary-button" href="teacher.html">เปิดจอครู</a><a class="secondary-button" href="display.html">เปิดจอโปรเจกเตอร์</a></div>`,
  () => `<div class="karaoke-box"><span class="slide-icon">🎵</span><h2>เพลง <em>มาตราแม่เกย</em></h2><div class="plan-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/HeEXQmLrDa8?rel=0&playsinline=1" title="เพลงมาตราแม่เกย" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p>ชู 2 นิ้วเมื่อได้ยินคำที่มี ย เป็นตัวสะกด</p></div>`,
  () => `<div class="karaoke-box"><span class="slide-icon">🎵</span><h2>เพลง <em>มาตราแม่เกอว</em></h2><div class="plan-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/NvOyTLEUSFs?rel=0&playsinline=1" title="เพลงมาตราแม่เกอว" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p>ทำมือเป็นวงกลมเมื่อได้ยินคำที่มี ว เป็นตัวสะกด</p></div>`,
  () => `<span class="slide-icon">🔎</span><h2>สังเกตคำศัพท์<br><em>ตัวสะกดเป็น ย หรือ ว</em></h2><div class="vocab-grid">${[["ควาย","แม่เกย"],["ถ้วย","แม่เกย"],["ดาว","แม่เกอว"],["แก้ว","แม่เกอว"],["บัว","ไม่มีตัวสะกด"],["ลม","แม่กม"]].map(([word,hint]) => `<button class="vocab-card" data-speak="${word}"><strong>${word}</strong><small>${hint}</small></button>`).join("")}</div>`,
  () => `<span class="slide-icon">💡</span><h2>คู่หูตัวสะกด<br><em>ย และ ว</em></h2><div class="rule-card">แม่เกยมี <strong>ย</strong> เป็นตัวสะกด<br>แม่เกอวมี <strong>ว</strong> เป็นตัวสะกด</div><div class="demo-row"><span class="demo-word">🍌 กล้วย → ย</span><span class="demo-word">🍚 ข้าว → ว</span></div>`,
  () => `<span class="slide-icon">🎮</span><h2>เริ่มสองภารกิจ<br><em>25 นาที</em></h2><p>1. คู่หู ย ว 10 นาที　2. เลือกให้ใช่ 15 นาที</p><button id="launchGame" class="primary-button">เปิดเกมนักเรียน</button>`,
  () => `<span class="slide-icon">🏅</span><h2>กระดาน<em>คะแนนรวม</em></h2><p>ฉายหลังจบแต่ละภารกิจ ชื่นชมความพยายาม และช่วยนักเรียนที่ยังสับสน</p><div class="slide-actions"><a class="primary-button" href="display.html">เปิดกระดานคะแนน</a><a class="secondary-button" href="teacher.html">ดูรายละเอียดนักเรียน</a></div>`,
  () => `<span class="slide-icon">🖍️</span><h2>กิจกรรม<br><em>ภาพคู่หูของฉัน</em></h2><p>เลือกแม่เกย 2 คำ และแม่เกอว 2 คำ วาดภาพ เขียนคำ แล้ววงกลมตัวสะกด</p><div id="classTimer" class="timer-card">15:00</div><div class="slide-actions"><button id="timerStart" class="primary-button">▶ เริ่มจับเวลา</button><button id="timerReset" class="secondary-button">↻ เริ่มใหม่</button></div>`,
  () => `<span class="slide-icon">🗝️</span><h2>สรุปและ<br><em>แบบทดสอบท้ายคาบ</em></h2><div class="rule-card">แม่เกยมี <strong>ย</strong> สะกด · แม่เกอวมี <strong>ว</strong> สะกด</div><p>ทำแบบทดสอบ 5 ข้อ เกณฑ์ผ่านอย่างน้อย 3 ข้อ</p><button id="launchExit" class="primary-button">เปิดแบบทดสอบท้ายคาบ</button>`,
  () => `<span class="slide-icon">🎉</span><h2>ปรบมือให้<br><em>เพื่อนทุกคน</em></h2><div class="award-row">🥇 🥈 🥉</div><p>ฉายผลการแข่งขัน มอบดาว แล้วแจกใบงานที่ 4</p><div class="slide-actions"><a class="primary-button" href="display.html">ฉายผลท้ายคาบ</a><a class="secondary-button" href="worksheet-plan-4.html" target="_blank">พิมพ์ใบงานที่ 4</a></div>`,
];
function renderNav() {
  $("#lessonSteps").innerHTML = lessonTitles.map((title,index) => `<li class="${index === state.slide ? "active" : ""}" data-slide="${index}">${index + 1}. ${title}</li>`).join("");
  document.querySelectorAll("[data-slide]").forEach(item => item.onclick = () => { state.slide = Number(item.dataset.slide); renderSlide(); });
}
function paintTimer() {
  const element = $("#classTimer");
  if (element) element.textContent = `${String(Math.floor(state.classSeconds / 60)).padStart(2,"0")}:${String(state.classSeconds % 60).padStart(2,"0")}`;
}
function renderSlide() {
  stopTransient();
  $("#slideCounter").textContent = `${state.slide + 1} / ${slides.length}`;
  $("#prevSlide").disabled = state.slide === 0;
  $("#nextSlide").textContent = state.slide === slides.length - 1 ? "จบการสอน ✓" : "ถัดไป →";
  $("#lessonStage").innerHTML = slides[state.slide]();
  renderNav();
  document.querySelectorAll("[data-speak]").forEach(item => item.onclick = () => speak(item.dataset.speak));
  $("#launchGame")?.addEventListener("click",openGame);
  $("#launchExit")?.addEventListener("click",() => { openGame(); state.mission = 2; state.index = 0; render(); });
  $("#timerStart")?.addEventListener("click",() => {
    clearInterval(state.classTimer);
    state.classTimer = setInterval(() => { state.classSeconds = Math.max(0,state.classSeconds - 1); paintTimer(); if (!state.classSeconds) clearInterval(state.classTimer); },1000);
  });
  $("#timerReset")?.addEventListener("click",() => { state.classSeconds = 900; paintTimer(); });
}
function openGame() { stopTransient(); $("#hero").classList.add("hidden"); $("#lesson").classList.add("hidden"); $("#game").classList.remove("hidden"); render(); scrollTo({ top:0,behavior:"smooth" }); }
function openLesson() { stopTransient(); $("#hero").classList.add("hidden"); $("#game").classList.add("hidden"); $("#lesson").classList.remove("hidden"); state.slide = 0; renderSlide(); scrollTo({ top:0,behavior:"smooth" }); }

$("#startButton").onclick = openGame;
$("#teachButton").onclick = openLesson;
$("#closeLesson").onclick = () => { stopTransient(); $("#lesson").classList.add("hidden"); $("#hero").classList.remove("hidden"); };
$("#prevSlide").onclick = () => { if (state.slide > 0) { state.slide -= 1; renderSlide(); } };
$("#nextSlide").onclick = () => { if (state.slide < slides.length - 1) { state.slide += 1; renderSlide(); } else { $("#lesson").classList.add("hidden"); $("#hero").classList.remove("hidden"); } };
$("#fullscreenButton").onclick = () => document.fullscreenElement ? document.exitFullscreen() : $("#lesson").requestFullscreen();
