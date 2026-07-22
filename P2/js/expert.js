import { $, ACTIVITIES, escapeHtml } from "./common.js";
import { PLAN_CATALOG, getPlanById } from "./plan-catalog.js";

const STUDENT_SEED = [
  { id: "mali", name: "มะลิ", avatar: "🌻" },
  { id: "punn", name: "ปั้น", avatar: "🚀" },
  { id: "namfah", name: "น้ำฟ้า", avatar: "🦋" },
  { id: "tonkla", name: "ต้นกล้า", avatar: "🐯" },
];

const EXIT_QUESTIONS = [
  { prompt: "คำมาตราแม่ ก กา คือคำที่มีลักษณะอย่างไร", answer: "ไม่มีตัวสะกด", options: ["ไม่มีตัวสะกด", "มี ก เป็นตัวสะกด", "มีสระเสียงสั้นเท่านั้น", "มีพยัญชนะอยู่ท้ายคำ"] },
  { prompt: "คำที่ไม่มีพยัญชนะท้ายคำเรียกว่าอะไร", answer: "มาตราแม่ ก กา", options: ["มาตราแม่กม", "มาตราแม่ ก กา", "มาตราแม่กง", "มาตราแม่กน"] },
  { prompt: "ข้อใดคือคำในมาตราแม่ ก กา", answer: "ปลา", options: ["กบ", "จาน", "ปลา", "นก"] },
  { prompt: "สัตว์ในข้อใดมีชื่อเป็นคำมาตราแม่ ก กา", answer: "เต่า", options: ["ช้าง", "มด", "ลิง", "เต่า"] },
  { prompt: "คำในข้อใดมีตัวสะกด (ไม่ใช่แม่ ก กา)", answer: "ดาว", options: ["เรือ", "แพ", "ดาว", "ใบ"] },
  { prompt: "ข้อใดเป็นคำมาตราแม่ ก กา ทั้ง 2 คำ", answer: "ปู, ปลา", options: ["หมา, แมว", "ปู, ปลา", "นก, หนู", "เสือ, ช้าง"] },
  { prompt: "คำว่า มะละกอ มีลักษณะตรงกับข้อใด", answer: "เป็นคำมาตราแม่ ก กา ทั้งหมด", options: ["มีตัว ก สะกด", "เป็นคำมาตราแม่ ก กา ทั้งหมด", "เป็นคำที่มีตัวสะกดทุกพยางค์", "มีคำมาตราแม่ ก กา แค่ 1 คำ"] },
  { prompt: "ข้อใดไม่ใช่คำมาตราแม่ ก กา", answer: "พัดลม", options: ["ทะเล", "เวลา", "กระทะ", "พัดลม"] },
  { prompt: "คำในข้อใดไม่มีตัวสะกด", answer: "โต๊ะ", options: ["ข้าว", "นม", "โต๊ะ", "ยาง"] },
  { prompt: "จากลักษณะของคำ คำว่า เก้าอี้ จัดอยู่ในกลุ่มเดียวกับข้อใด", answer: "กระเป๋า", options: ["ดินสอ", "สมุด", "ไม้บรรทัด", "กระเป๋า"] },
];

const GAME_WORDS = {
  rhythm: ["กา", "กบ", "ปลา", "นก", "เต่า", "ลม"],
  wheel: ["ปลา", "นก", "มือ", "กบ", "เต่า", "จาน"],
  sound: [
    { word: "ปลา", emoji: "🐟", maeKaka: true }, { word: "นก", emoji: "🐦", maeKaka: false },
    { word: "เต่า", emoji: "🐢", maeKaka: true }, { word: "กบ", emoji: "🐸", maeKaka: false },
  ],
  sort: ["ปลา", "กบ", "เต่า", "นก", "มือ", "จาน"],
};

const state = {
  planId: new URL(location.href).searchParams.get("plan") || "01",
  activityKey: "rhythm",
  status: "ready",
  device: "landscape",
  activeStudentId: "mali",
  round: 0,
  answered: false,
  feedback: "ครูเลือกกิจกรรมแล้วกดเริ่มจำลองได้เลย",
  trainSelected: [],
  voteSelected: [],
  votePosts: [],
  students: STUDENT_SEED.map(student => ({ ...student, score: 0, completed: 0 })),
  events: [],
};

const currentPlan = () => getPlanById(state.planId) || PLAN_CATALOG[0];
const currentActivity = () => ACTIVITIES.find(activity => activity.key === state.activityKey) || ACTIVITIES[0];
const activeStudent = () => state.students.find(student => student.id === state.activeStudentId) || state.students[0];
const isActive = () => state.status === "active";
const maeKaka = word => ["กา", "ปลา", "เต่า", "มือ", "ตา", "ปู", "เสือ", "แมว", "หมู", "นา", "ใบไม้", "ขา", "ผีเสื้อ", "มะละกอ", "ทะเล", "เวลา", "กระทะ", "โต๊ะ", "กระเป๋า"].includes(word);

function event(message) {
  state.events.unshift({ message, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) });
  state.events = state.events.slice(0, 8);
}

function resetRound(message = "ครูเริ่มโจทย์ใหม่") {
  state.round += 1;
  state.answered = false;
  state.feedback = message;
  state.trainSelected = [];
  state.voteSelected = [];
}

function resetSimulation() {
  state.status = "ready";
  state.activityKey = "rhythm";
  state.activeStudentId = "mali";
  state.round = 0;
  state.answered = false;
  state.feedback = "เริ่มห้องจำลองใหม่แล้ว ครูกดเริ่มจำลองเพื่อให้จอนักเรียนใช้งานได้";
  state.trainSelected = [];
  state.voteSelected = [];
  state.votePosts = [];
  state.students = STUDENT_SEED.map(student => ({ ...student, score: 0, completed: 0 }));
  state.events = [];
  event("รีเซ็ตห้องจำลองแล้ว");
}

function setPlan(planId) {
  const plan = getPlanById(planId);
  if (!plan) return;
  state.planId = plan.id;
  resetSimulation();
  event(`เลือกแผนที่ ${plan.sequence}: ${plan.title}`);
  renderAll();
}

function setActivity(key) {
  state.activityKey = key;
  resetRound(`ครูเปิดกิจกรรม ${currentActivity().title}`);
  event(`ครูเปิดกิจกรรม ${currentActivity().title}`);
  renderAll();
}

function toggleSimulation() {
  state.status = state.status === "active" ? "paused" : "active";
  state.feedback = state.status === "active" ? "เริ่มกิจกรรมแล้ว ลองเล่นบนจอนักเรียนได้เลย" : "ครูพักกิจกรรมชั่วคราว";
  event(state.status === "active" ? "ครูเริ่ม/เล่นต่อกิจกรรม" : "ครูพักกิจกรรม");
  renderAll();
}

function markAnswer(correct, detail) {
  if (!isActive() || state.answered) return;
  const student = activeStudent();
  state.answered = true;
  student.completed += 1;
  if (correct) student.score += 10;
  state.feedback = correct ? `✓ ถูกต้อง! ${detail}` : `ลองใหม่ในรอบถัดไป · ${detail}`;
  event(`${student.name} ${correct ? "ตอบถูก" : "ตอบไม่ถูก"} · ${currentActivity().short}`);
  renderAll();
}

function speakThai(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = .76;
  const thaiVoice = window.speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith("th"));
  if (thaiVoice) utterance.voice = thaiVoice;
  window.speechSynthesis.speak(utterance);
}

function disabled() { return !isActive() || state.answered ? "disabled" : ""; }

function answerChoices(correctMaeKaka) {
  return `<div class="expert-answer-row"><button class="expert-answer-button mae" data-answer="mae" ${disabled()}>☀️ ไม่มีตัวสะกด<br><small>แม่ ก กา</small></button><button class="expert-answer-button final" data-answer="final" ${disabled()}>🔤 มีตัวสะกด<br><small>มีเสียงท้ายคำ</small></button></div>`;
}

function renderActivityGame() {
  const key = state.activityKey;
  if (key === "rhythm") {
    const word = GAME_WORDS.rhythm[state.round % GAME_WORDS.rhythm.length];
    return `<div class="expert-game-card rhythm"><span class="expert-game-icon">🎵</span><p>แตะคำตามจังหวะ แล้วบอกว่าเป็นคำแม่ ก กา หรือไม่</p><strong class="expert-big-word">${word}</strong>${answerChoices(maeKaka(word))}</div>`;
  }
  if (key === "wheel") {
    const word = GAME_WORDS.wheel[state.round % GAME_WORDS.wheel.length];
    const spun = state.feedback.startsWith("วงล้อเลือก");
    return `<div class="expert-game-card wheel"><div class="expert-wheel ${spun ? "is-spun" : ""}">🎡</div><p>${spun ? "คำที่วงล้อเลือก" : "กดหมุนวงล้อเพื่อสุ่มคำ"}</p><strong class="expert-big-word">${spun ? word : "?"}</strong>${spun ? answerChoices(maeKaka(word)) : `<button class="button button-primary" data-action="spin" ${isActive() ? "" : "disabled"}>หมุนวงล้อ</button>`}</div>`;
  }
  if (key === "sound") {
    const item = GAME_WORDS.sound[state.round % GAME_WORDS.sound.length];
    return `<div class="expert-game-card sound"><span class="expert-picture">${item.emoji}</span><p>กดฟัง แล้วสังเกตคำที่ได้ยิน</p><button class="expert-speak-button" data-action="speak" type="button">🔊 ฟังคำว่า “${item.word}”</button>${answerChoices(item.maeKaka)}</div>`;
  }
  if (key === "sort") {
    const word = GAME_WORDS.sort[state.round % GAME_WORDS.sort.length];
    return `<div class="expert-game-card sort"><p>พาคำไปอยู่บ้านที่ถูกต้อง</p><strong class="expert-big-word">${word}</strong><div class="expert-sort-row"><button data-sort="mae" ${disabled()}>🏡<strong>บ้านแม่ ก กา</strong><small>ไม่มีตัวสะกด</small></button><button data-sort="final" ${disabled()}>🏠<strong>บ้านมีตัวสะกด</strong><small>มีเสียงท้ายคำ</small></button></div></div>`;
  }
  if (key === "train") {
    const words = ["ตา", "ดู", "ปู", "นา"];
    const order = ["ปู", "ตา", "นา", "ดู"];
    return `<div class="expert-game-card train"><p>แตะโบกี้เพื่อเรียงเป็นประโยค</p><div class="expert-train-answer">${state.trainSelected.length ? state.trainSelected.map((word, index) => `<span>${index === 0 ? "🚂" : "🛞"} ${word}</span>`).join("") : "แตะคำเพื่อเริ่มต่อขบวน"}</div><div class="expert-train-words">${order.map(word => `<button data-train-word="${word}" ${disabled() || state.trainSelected.includes(word) ? "disabled" : ""}>${word}</button>`).join("")}</div><div class="button-row"><button class="button button-ghost" data-action="train-reset" ${isActive() ? "" : "disabled"}>เริ่มเรียงใหม่</button><button class="button button-primary" data-action="train-check" ${disabled() || state.trainSelected.length !== words.length ? "disabled" : ""}>ตรวจคำตอบ</button></div></div>`;
  }
  if (key === "vote") {
    const words = ["แม่", "ดู", "ปลา", "ปู", "นา"];
    return `<div class="expert-game-card vote"><p>เลือกคำมาแต่งประโยค แล้วส่งขึ้นบอร์ด</p><div class="expert-sentence">${state.voteSelected.length ? state.voteSelected.join("") : "เลือกคำจากคลังคำ"}</div><div class="expert-vote-words">${words.map(word => `<button data-vote-word="${word}" ${disabled()}>${word}</button>`).join("")}</div><div class="button-row"><button class="button button-ghost" data-action="vote-clear" ${isActive() ? "" : "disabled"}>ล้างคำ</button><button class="button button-primary" data-action="vote-send" ${disabled() || state.voteSelected.length < 2 ? "disabled" : ""}>ส่งประโยค</button></div><div class="expert-mini-board">${state.votePosts.length ? state.votePosts.map(item => `<span>${escapeHtml(item.sentence)} <b>💗 ${item.votes}</b></span>`).join("") : "บอร์ดประโยครอการส่ง"}</div></div>`;
  }
  const question = EXIT_QUESTIONS[state.round % EXIT_QUESTIONS.length];
  return `<div class="expert-game-card exit"><span class="expert-game-icon">🗝️</span><p>ไขกุญแจหีบสมบัติ · ข้อ ${(state.round % EXIT_QUESTIONS.length) + 1} / ${EXIT_QUESTIONS.length}</p><h3>${question.prompt}</h3><div class="expert-choice-grid">${question.options.map(option => `<button data-exit-option="${escapeHtml(option)}" ${disabled()}>${escapeHtml(option)}</button>`).join("")}</div></div>`;
}

function renderTeacher() {
  const plan = currentPlan();
  const panel = $("#expertTeacherScreen");
  if (!plan.published || !plan.activityKeys?.length) {
    panel.innerHTML = `<div class="expert-device-title"><span>🧑‍🏫</span><div><small>จอครูจำลอง</small><strong>ยังไม่มีสื่อเกมของแผนนี้</strong></div></div><div class="expert-locked-plan"><span>🔒</span><h2>${escapeHtml(plan.title)}</h2><p>พื้นที่จำลองพร้อมแล้ว รอเพิ่มรายละเอียดเกมของแผนที่ ${plan.sequence}</p></div>`;
    return;
  }
  const ranked = [...state.students].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "th"));
  panel.innerHTML = `<div class="expert-device-title"><span>🧑‍🏫</span><div><small>จอครูจำลอง · แผน ${plan.id}</small><strong>${escapeHtml(plan.title)}</strong></div><span class="expert-status ${state.status}">${state.status === "active" ? "● กำลังสอน" : state.status === "paused" ? "Ⅱ พักเกม" : "○ พร้อมเริ่ม"}</span></div>
    <div class="expert-teacher-controls"><button class="button button-primary" data-teacher-action="toggle">${state.status === "active" ? "⏸ พักกิจกรรม" : "▶ เริ่มจำลอง"}</button><button class="button button-ghost" data-teacher-action="round">↻ โจทย์ใหม่</button></div>
    <section class="expert-teacher-section"><div class="expert-section-label"><span>กิจกรรมในแผน</span><small>${ACTIVITIES.length} เกม</small></div><div class="expert-activity-grid">${ACTIVITIES.map((activity, index) => `<button class="${activity.key === state.activityKey ? "active" : ""}" data-activity="${activity.key}"><span>${activity.icon}</span><strong>${index + 1}. ${activity.short}</strong><small>${activity.minutes} นาที</small></button>`).join("")}</div></section>
    <section class="expert-teacher-section"><div class="expert-section-label"><span>นักเรียนจำลอง</span><small>คลิกเพื่อสลับจอ นร.</small></div><div class="expert-student-list">${state.students.map(student => `<button class="${student.id === state.activeStudentId ? "active" : ""}" data-student="${student.id}"><span>${student.avatar}</span><strong>${student.name}</strong><small>⭐ ${student.score}</small></button>`).join("")}</div></section>
    <section class="expert-teacher-section"><div class="expert-section-label"><span>ผลการแข่งขัน</span><small>เรียลไทม์จำลอง</small></div><ol class="expert-ranking">${ranked.map((student, index) => `<li><b>${index + 1}</b><span>${student.avatar}</span><strong>${student.name}</strong><em>${student.score} คะแนน</em></li>`).join("")}</ol></section>`;
  panel.querySelectorAll("[data-activity]").forEach(button => button.addEventListener("click", () => setActivity(button.dataset.activity)));
  panel.querySelectorAll("[data-student]").forEach(button => button.addEventListener("click", () => { state.activeStudentId = button.dataset.student; event(`สลับเป็นจอนักเรียน ${activeStudent().name}`); renderAll(); }));
  panel.querySelector("[data-teacher-action=toggle]")?.addEventListener("click", toggleSimulation);
  panel.querySelector("[data-teacher-action=round]")?.addEventListener("click", () => { resetRound("ครูส่งโจทย์ใหม่ให้จอนักเรียน"); event("ครูส่งโจทย์ใหม่"); renderAll(); });
}

function renderStudent() {
  const plan = currentPlan();
  const student = activeStudent();
  const panel = $("#expertStudentScreen");
  const activity = currentActivity();
  panel.innerHTML = `<div class="expert-ipad ${state.device === "portrait" ? "portrait" : ""}"><div class="expert-ipad-camera"></div><div class="expert-student-top"><span>${student.avatar}</span><div><small>นักเรียนจำลอง</small><strong>${student.name}</strong></div><em>⭐ ${student.score}</em></div><div class="expert-student-lesson"><span>${activity.icon}</span><div><small>เกมภาษาไทย · แผน ${plan.id}</small><strong>${activity.title}</strong></div></div><div class="expert-student-play ${state.status !== "active" ? "is-blocked" : ""}">${plan.published ? renderActivityGame() : `<div class="expert-game-card"><h2>รอสื่อของแผนนี้</h2></div>`}${state.status !== "active" ? `<div class="expert-student-overlay"><span>${state.status === "paused" ? "⏸️" : "🧑‍🏫"}</span><strong>${state.status === "paused" ? "ครูพักกิจกรรม" : "รอครูเริ่มจำลอง"}</strong><small>เมื่อครูกดเริ่ม จอนักเรียนจะใช้งานได้ทันที</small></div>` : ""}</div><div class="expert-feedback ${state.answered ? "answered" : ""}">${escapeHtml(state.feedback)}</div></div>`;
  panel.querySelectorAll("[data-answer]").forEach(button => button.addEventListener("click", () => {
    const key = state.activityKey;
    const word = key === "rhythm" ? GAME_WORDS.rhythm[state.round % GAME_WORDS.rhythm.length] : GAME_WORDS.wheel[state.round % GAME_WORDS.wheel.length];
    const item = GAME_WORDS.sound[state.round % GAME_WORDS.sound.length];
    const correctMae = key === "sound" ? item.maeKaka : maeKaka(word);
    markAnswer(button.dataset.answer === (correctMae ? "mae" : "final"), correctMae ? "คำนี้ไม่มีตัวสะกด" : "คำนี้มีตัวสะกด");
  }));
  panel.querySelector("[data-action=spin]")?.addEventListener("click", () => { state.feedback = `วงล้อเลือกคำ “${GAME_WORDS.wheel[state.round % GAME_WORDS.wheel.length]}” แล้ว`; renderAll(); });
  panel.querySelector("[data-action=speak]")?.addEventListener("click", () => speakThai(GAME_WORDS.sound[state.round % GAME_WORDS.sound.length].word));
  panel.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => { const word = GAME_WORDS.sort[state.round % GAME_WORDS.sort.length]; markAnswer(button.dataset.sort === (maeKaka(word) ? "mae" : "final"), `คำว่า “${word}”`); }));
  panel.querySelectorAll("[data-train-word]").forEach(button => button.addEventListener("click", () => { if (!isActive() || state.answered) return; state.trainSelected.push(button.dataset.trainWord); state.feedback = `ต่อโบกี้ “${button.dataset.trainWord}” แล้ว`; renderAll(); }));
  panel.querySelector("[data-action=train-reset]")?.addEventListener("click", () => { state.trainSelected = []; state.feedback = "เริ่มต่อขบวนใหม่"; renderAll(); });
  panel.querySelector("[data-action=train-check]")?.addEventListener("click", () => markAnswer(state.trainSelected.join("") === "ตาดูปูนา", "ประโยคที่ถูกคือ ตาดูปูนา"));
  panel.querySelectorAll("[data-vote-word]").forEach(button => button.addEventListener("click", () => { if (!isActive() || state.answered) return; state.voteSelected.push(button.dataset.voteWord); state.feedback = `เพิ่มคำ “${button.dataset.voteWord}” แล้ว`; renderAll(); }));
  panel.querySelector("[data-action=vote-clear]")?.addEventListener("click", () => { state.voteSelected = []; state.feedback = "ล้างคำแล้ว"; renderAll(); });
  panel.querySelector("[data-action=vote-send]")?.addEventListener("click", () => { const sentence = state.voteSelected.join(""); state.votePosts.unshift({ sentence, votes: 0 }); markAnswer(true, `ส่งประโยค “${sentence}” ขึ้นบอร์ดแล้ว`); });
  panel.querySelectorAll("[data-exit-option]").forEach(button => button.addEventListener("click", () => { const question = EXIT_QUESTIONS[state.round % EXIT_QUESTIONS.length]; markAnswer(button.dataset.exitOption === question.answer, `เฉลย: ${question.answer}`); }));
}

function renderEvents() {
  $("#expertEventLog").innerHTML = state.events.length ? state.events.map(item => `<li><time>${item.time}</time><span>${escapeHtml(item.message)}</span></li>`).join("") : "<li><span>ยังไม่มีเหตุการณ์</span></li>";
}

function renderAll() {
  const plan = currentPlan();
  $("#expertPlanSelect").value = plan.id;
  $("#expertPlanDocument").classList.toggle("hidden", !plan.document);
  if (plan.document) $("#expertPlanDocument").href = plan.document;
  $("#expertWorkspace").classList.toggle("is-portrait", state.device === "portrait");
  renderTeacher();
  renderStudent();
  renderEvents();
}

function setupToolbar() {
  const select = $("#expertPlanSelect");
  select.innerHTML = PLAN_CATALOG.map(plan => `<option value="${plan.id}" ${plan.published ? "" : "disabled"}>แผน ${plan.id} · ${escapeHtml(plan.title)}${plan.published ? "" : " (รอข้อมูล)"}</option>`).join("");
  if (!getPlanById(state.planId)?.published) state.planId = "01";
  select.value = state.planId;
  select.addEventListener("change", () => setPlan(select.value));
  $("#expertDeviceSelect").addEventListener("change", event => { state.device = event.target.value; renderAll(); });
  $("#expertResetButton").addEventListener("click", () => { resetSimulation(); renderAll(); });
  $("#expertFullscreenButton").addEventListener("click", async () => {
    const workspace = $("#expertWorkspace");
    if (document.fullscreenElement) await document.exitFullscreen();
    else await workspace.requestFullscreen?.();
  });
}

event("เปิดห้องจำลองสำหรับผู้เชี่ยวชาญ");
setupToolbar();
renderAll();
