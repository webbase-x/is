import {
  PLAN_ACTIVITIES,
  PLAN_TITLES,
  escapeHtml,
} from "./common.js?v=20260728-public-expert-sandbox-1";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const SCHOOL_NAMES = [
  "โรงเรียนสาธิตคำไทยผจญภัย",
  "โรงเรียนต้นกล้าภาษาไทย",
  "โรงเรียนบ้านอักษรสนุก",
  "โรงเรียนสายรุ้งแห่งการเรียนรู้",
];

const STUDENT_NAMES = [
  "น้องต้นกล้า",
  "น้องใบหม่อน",
  "น้องฟ้าใส",
  "น้องภูผา",
  "น้องข้าวหอม",
  "น้องน้ำใส",
  "น้องตะวัน",
  "น้องอักษร",
  "น้องใบบัว",
  "น้องใบโบก",
];

const AVATARS = ["🌱", "🦉", "🐯", "🐳", "🐰", "🦊", "🐼", "🦁", "🐸", "🦋"];

const QUESTION_BANK = Object.freeze({
  1: [
    { icon: "🐦", word: "กา", prompt: "คำนี้มีตัวสะกดหรือไม่?", answer: "ไม่มีตัวสะกด", options: ["ไม่มีตัวสะกด", "มี ก สะกด", "มี น สะกด"] },
    { icon: "🐟", word: "ปลา", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่ ก กา", options: ["แม่ ก กา", "แม่กง", "แม่กม"] },
    { icon: "🐢", word: "เต่า", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่ ก กา", options: ["แม่กน", "แม่ ก กา", "แม่กก"] },
  ],
  2: [
    { icon: "🐒", word: "ลิง", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กง", options: ["แม่กง", "แม่กม", "แม่กน"] },
    { icon: "🐘", word: "ช้าง", prompt: "เสียงท้ายของคำตรงกับมาตราใด?", answer: "แม่กง", options: ["แม่กด", "แม่กง", "แม่กบ"] },
    { icon: "👖", word: "กางเกง", prompt: "คำนี้มีเสียงตัวสะกดใด?", answer: "เสียง ง", options: ["เสียง ม", "เสียง ง", "เสียง น"] },
  ],
  3: [
    { icon: "🌬️", word: "ลม", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กม", options: ["แม่กม", "แม่กง", "แม่กน"] },
    { icon: "😊", word: "ยิ้ม", prompt: "คำนี้มีเสียงตัวสะกดใด?", answer: "เสียง ม", options: ["เสียง น", "เสียง ม", "เสียง ง"] },
    { icon: "🥄", word: "ชิม", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กม", options: ["แม่กบ", "แม่กม", "แม่กด"] },
  ],
  4: [
    { icon: "👵", word: "ยาย", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่เกย", options: ["แม่เกย", "แม่เกอว", "แม่กน"] },
    { icon: "⭐", word: "ดาว", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่เกอว", options: ["แม่กง", "แม่เกย", "แม่เกอว"] },
    { icon: "✨", word: "สวย", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่เกย", options: ["แม่เกย", "แม่เกอว", "แม่กม"] },
  ],
  5: [
    { icon: "🐦", word: "นก", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กก", options: ["แม่กก", "แม่กด", "แม่กบ"] },
    { icon: "☁️", word: "เมฆ", prompt: "คำนี้มีเสียงตัวสะกดใด?", answer: "เสียง ก", options: ["เสียง ด", "เสียง ก", "เสียง บ"] },
    { icon: "🔢", word: "เลข", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กก", options: ["แม่กน", "แม่กง", "แม่กก"] },
  ],
  6: [
    { icon: "🐜", word: "มด", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กด", options: ["แม่กด", "แม่กบ", "แม่กก"] },
    { icon: "🚗", word: "รถ", prompt: "คำนี้มีเสียงตัวสะกดใด?", answer: "เสียง ด", options: ["เสียง ก", "เสียง ด", "เสียง น"] },
    { icon: "😠", word: "โกรธ", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กด", options: ["แม่กม", "แม่กด", "แม่กน"] },
  ],
  7: [
    { icon: "🐸", word: "กบ", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กบ", options: ["แม่กบ", "แม่กด", "แม่กก"] },
    { icon: "🖼️", word: "ภาพ", prompt: "คำนี้มีเสียงตัวสะกดใด?", answer: "เสียง บ", options: ["เสียง ม", "เสียง บ", "เสียง ด"] },
    { icon: "🎁", word: "ลาภ", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กบ", options: ["แม่กน", "แม่กง", "แม่กบ"] },
  ],
  8: [
    { icon: "🍽️", word: "จาน", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กน", options: ["แม่กน", "แม่กง", "แม่กม"] },
    { icon: "📚", word: "เรียน", prompt: "คำนี้มีเสียงตัวสะกดใด?", answer: "เสียง น", options: ["เสียง ง", "เสียง น", "เสียง ม"] },
    { icon: "🙏", word: "บุญ", prompt: "คำนี้อยู่ในมาตราใด?", answer: "แม่กน", options: ["แม่กด", "แม่กบ", "แม่กน"] },
  ],
});

let state;

function secureNumber(maximum) {
  if (maximum <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % maximum;
}

function randomDigits(length) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map(value => String(value % 10)).join("");
}

function randomToken(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map(value => alphabet[value % alphabet.length]).join("");
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = secureNumber(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function simulatedStudents() {
  return shuffled(STUDENT_NAMES).slice(0, 8).map((name, index) => ({
    id: `demo-student-${randomToken(5)}`,
    name: `${name} (จำลอง)`,
    avatar: AVATARS[(index + secureNumber(AVATARS.length)) % AVATARS.length],
    status: index < 2 ? "approved" : "available",
    score: index === 0 ? 20 : index === 1 ? 10 : 0,
    stars: index === 0 ? 2 : index === 1 ? 1 : 0,
  }));
}

function createSession() {
  const students = simulatedStudents();
  return {
    username: `expert-demo-${randomToken(6).toLowerCase()}@local.invalid`,
    password: `DEMO-${randomToken(10)}`,
    roomCode: String(100000 + secureNumber(900000)),
    school: `${SCHOOL_NAMES[secureNumber(SCHOOL_NAMES.length)]} (ข้อมูลจำลอง)`,
    classroom: `ป.2/ห้องจำลอง ${1 + secureNumber(3)}`,
    planId: 1,
    students,
    selectedStudentId: students.find(student => student.status === "available")?.id || students[0].id,
    activeStudentId: null,
    activeActivityIndex: 0,
    questionIndex: 0,
    answered: false,
    gameFinished: false,
  };
}

function studentById(id) {
  return state.students.find(student => student.id === id) || null;
}

function activeStudent() {
  return studentById(state.activeStudentId);
}

function planTitle(planId = state.planId) {
  return PLAN_TITLES[Number(planId) - 1] || `แผนการสอนที่ ${planId}`;
}

function activitiesForPlan(planId = state.planId) {
  return PLAN_ACTIVITIES[Number(planId)] || [];
}

function questionsForPlan(planId = state.planId) {
  return QUESTION_BANK[Number(planId)] || QUESTION_BANK[1];
}

function toast(message) {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("show"), 2400);
}

function showOnly(view) {
  [
    "#expertStudentJoinView",
    "#expertStudentWaitingView",
    "#expertStudentLobbyView",
    "#expertStudentGameView",
    "#expertStudentResultView",
  ].forEach(selector => $(selector)?.classList.toggle("hidden", selector !== view));
}

function renderCredentials() {
  $("#expertAccountEmail").textContent = state.username;
  $("#expertAccountPassword").textContent = state.password;
  $("#expertRoomCode").textContent = state.roomCode;
  $$("[data-room-code]").forEach(element => {
    element.textContent = state.roomCode;
  });
  $("#expertStudentRoomInput").value = state.roomCode;
  $("#expertCredentialStatus").textContent = "บัญชีและรหัสนี้เป็นข้อมูลชั่วคราวในหน่วยความจำ ไม่ได้สร้างใน Auth หรือฐานข้อมูล";
}

function renderPlanSelect() {
  $("#expertPlanSelect").innerHTML = PLAN_TITLES.map((title, index) => (
    `<option value="${index + 1}">แผนที่ ${index + 1} · ${escapeHtml(title)}</option>`
  )).join("");
  $("#expertPlanSelect").value = String(state.planId);
}

function renderActivities() {
  const activities = activitiesForPlan();
  $("#expertActivityCount").textContent = `${activities.length} กิจกรรม`;
  $("#expertActivityList").innerHTML = activities.map((activity, index) => `
    <button class="expert-demo-activity${index === state.activeActivityIndex ? " current" : ""}" type="button" data-activity-index="${index}">
      <span class="expert-demo-activity-number">${index + 1}</span>
      <span><strong>${escapeHtml(activity.icon || "🎮")} ${escapeHtml(activity.title)}</strong><small>${escapeHtml(String(activity.minutes || 5))} นาที · ทดลองแบบไม่บันทึกคะแนน</small></span>
      <i>เริ่ม</i>
    </button>
  `).join("");
}

function renderRoster() {
  const visibleStudents = state.students.filter(student => student.status !== "available");
  const waiting = visibleStudents.filter(student => student.status === "waiting").length;
  $("#expertRosterCount").textContent = `${visibleStudents.length} คน${waiting ? ` · รอ ${waiting}` : ""}`;
  $("#expertRoster").innerHTML = visibleStudents.length ? visibleStudents.map(student => `
    <div class="expert-demo-roster-row">
      <span class="expert-demo-avatar">${student.avatar}</span>
      <span><strong>${escapeHtml(student.name)}</strong><small>${student.status === "waiting" ? "รอครูอนุมัติ" : "อยู่ในห้องจำลอง"}</small></span>
      ${student.status === "waiting"
        ? `<button type="button" data-approve-student="${student.id}">อนุมัติ</button>`
        : `<b class="approved">พร้อม</b>`}
    </div>
  `).join("") : `<p class="expert-demo-empty">ยังไม่มีนักเรียนจำลองเข้าห้อง</p>`;
}

function renderLeaderboard() {
  const ranked = state.students
    .filter(student => student.status === "approved")
    .sort((a, b) => b.score - a.score || b.stars - a.stars || a.name.localeCompare(b.name, "th"));
  $("#expertLeaderboard").innerHTML = ranked.length ? ranked.map((student, index) => `
    <li>
      <span>${index + 1}</span>
      <i>${student.avatar}</i>
      <strong>${escapeHtml(student.name)}</strong>
      <small>${student.score} คะแนน · ${student.stars} ดาว</small>
    </li>
  `).join("") : `<li class="expert-demo-empty">ยังไม่มีคะแนนในห้องจำลอง</li>`;
}

function renderStudentSelect() {
  const selectable = state.students.filter(student => student.status === "available");
  $("#expertStudentSelect").innerHTML = selectable.length
    ? selectable.map(student => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join("")
    : `<option value="">นักเรียนจำลองเข้าห้องครบแล้ว</option>`;
  $("#expertStudentSelect").value = selectable.some(student => student.id === state.selectedStudentId)
    ? state.selectedStudentId
    : selectable[0]?.id || "";
}

function renderHeaders() {
  $("#expertTeacherClass").textContent = `${state.school} · ${state.classroom}`;
  $("#expertTeacherPlanTitle").textContent = `แผนที่ ${state.planId} · ${planTitle()}`;
  $("#expertStudentPlanLabel").textContent = `แผนที่ ${state.planId} · ${planTitle()}`;
}

function renderAll() {
  renderCredentials();
  renderHeaders();
  renderPlanSelect();
  renderActivities();
  renderRoster();
  renderLeaderboard();
  renderStudentSelect();
}

function joinSelectedStudent() {
  const roomCode = $("#expertStudentRoomInput").value.replace(/\D/g, "").slice(0, 6);
  if (roomCode !== state.roomCode) {
    $("#expertStudentStatus").textContent = "รหัสห้องไม่ถูกต้อง";
    toast("รหัสห้องจำลองไม่ถูกต้อง");
    return;
  }
  const selectedId = $("#expertStudentSelect").value;
  const student = studentById(selectedId);
  if (!student || student.status !== "available") {
    toast("กรุณาเลือกนักเรียนจำลองที่ยังไม่ได้เข้าห้อง");
    return;
  }
  student.status = "waiting";
  state.activeStudentId = student.id;
  state.selectedStudentId = student.id;
  $("#expertWaitingStudentName").textContent = student.name;
  $("#expertStudentStatus").textContent = "รอครูอนุมัติ";
  showOnly("#expertStudentWaitingView");
  renderRoster();
  renderStudentSelect();
  switchDevice("teacher", { onSmallScreenOnly: true });
  toast(`${student.name} ส่งคำขอเข้าห้องแล้ว`);
}

function approveStudent(studentId) {
  const student = studentById(studentId);
  if (!student || student.status !== "waiting") return;
  student.status = "approved";
  if (student.id === state.activeStudentId) {
    $("#expertApprovedStudentName").textContent = student.name;
    $("#expertStudentStatus").textContent = "เข้าห้องแล้ว";
    showOnly("#expertStudentLobbyView");
  }
  renderRoster();
  renderLeaderboard();
  toast(`อนุมัติ ${student.name} แล้ว`);
}

function approveAll() {
  const waiting = state.students.filter(student => student.status === "waiting");
  waiting.forEach(student => {
    student.status = "approved";
  });
  const current = activeStudent();
  if (current?.status === "approved") {
    $("#expertApprovedStudentName").textContent = current.name;
    $("#expertStudentStatus").textContent = "เข้าห้องแล้ว";
    showOnly("#expertStudentLobbyView");
  }
  renderRoster();
  renderLeaderboard();
  toast(waiting.length ? `อนุมัตินักเรียนจำลอง ${waiting.length} คนแล้ว` : "ไม่มีนักเรียนที่รออนุมัติ");
}

function ensureActiveStudent() {
  let student = activeStudent();
  if (!student) {
    student = state.students.find(item => item.status === "approved")
      || state.students.find(item => item.status === "available")
      || state.students[0];
    state.activeStudentId = student.id;
  }
  student.status = "approved";
  $("#expertApprovedStudentName").textContent = student.name;
  return student;
}

function startActivity(activityIndex = 0) {
  const activities = activitiesForPlan();
  if (!activities.length) {
    toast("แผนนี้ยังไม่มีกิจกรรมจำลอง");
    return;
  }
  state.activeActivityIndex = Math.max(0, Math.min(Number(activityIndex) || 0, activities.length - 1));
  state.questionIndex = 0;
  state.answered = false;
  state.gameFinished = false;
  const student = ensureActiveStudent();
  $("#expertStudentStatus").textContent = "กำลังเล่นเกมจำลอง";
  $("#expertGameTitle").textContent = activities[state.activeActivityIndex].title;
  $("#expertApprovedStudentName").textContent = student.name;
  showOnly("#expertStudentGameView");
  renderActivities();
  renderRoster();
  renderQuestion();
  switchDevice("student", { onSmallScreenOnly: true });
  toast(`เริ่ม ${activities[state.activeActivityIndex].title}`);
}

function renderQuestion() {
  const questions = questionsForPlan();
  const question = questions[state.questionIndex];
  const student = ensureActiveStudent();
  const activity = activitiesForPlan()[state.activeActivityIndex];
  $("#expertGameMission").textContent = `ภารกิจ ${state.activeActivityIndex + 1} จาก ${activitiesForPlan().length}`;
  $("#expertGameTitle").textContent = activity?.title || "กิจกรรมจำลอง";
  $("#expertStudentStars").textContent = student.stars;
  $("#expertStudentScore").textContent = student.score;
  $("#expertQuestionNumber").textContent = `ข้อ ${state.questionIndex + 1} / ${questions.length}`;
  $("#expertQuestionIcon").textContent = question.icon;
  $("#expertQuestionWord").textContent = question.word;
  $("#expertQuestionPrompt").textContent = question.prompt;
  $("#expertGameProgress").style.width = `${((state.questionIndex + (state.answered ? 1 : 0)) / questions.length) * 100}%`;
  $("#expertQuestionFeedback").className = "expert-demo-feedback";
  $("#expertQuestionFeedback").textContent = "เลือกคำตอบที่ถูกต้อง";
  $("#expertNextQuestionButton").classList.add("hidden");
  $("#expertNextQuestionButton").textContent = state.questionIndex === questions.length - 1 ? "ดูผลการเล่น" : "ข้อต่อไป";
  $("#expertQuestionOptions").innerHTML = shuffled(question.options).map(option => `
    <button type="button" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>
  `).join("");
}

function answerQuestion(answer, button) {
  if (state.answered) return;
  state.answered = true;
  const question = questionsForPlan()[state.questionIndex];
  const student = ensureActiveStudent();
  const correct = answer === question.answer;
  $$("#expertQuestionOptions button").forEach(optionButton => {
    optionButton.disabled = true;
    if (optionButton.dataset.answer === question.answer) optionButton.classList.add("correct");
  });
  if (correct) {
    student.score += 10;
    student.stars += 1;
    button.classList.add("correct");
    $("#expertQuestionFeedback").textContent = "✓ ถูกต้อง! ได้ 10 คะแนนและ 1 ดาว";
    $("#expertQuestionFeedback").classList.add("success");
  } else {
    button.classList.add("wrong");
    $("#expertQuestionFeedback").textContent = `✕ ยังไม่ถูก คำตอบคือ “${question.answer}”`;
    $("#expertQuestionFeedback").classList.add("error");
  }
  $("#expertStudentStars").textContent = student.stars;
  $("#expertStudentScore").textContent = student.score;
  $("#expertGameProgress").style.width = `${((state.questionIndex + 1) / questionsForPlan().length) * 100}%`;
  $("#expertNextQuestionButton").classList.remove("hidden");
  renderLeaderboard();
}

function nextQuestion() {
  const questions = questionsForPlan();
  if (!state.answered) return;
  if (state.questionIndex < questions.length - 1) {
    state.questionIndex += 1;
    state.answered = false;
    renderQuestion();
    return;
  }
  finishGame();
}

function finishGame() {
  state.gameFinished = true;
  const student = ensureActiveStudent();
  $("#expertFinalScore").textContent = student.score;
  $("#expertFinalStars").textContent = student.stars;
  $("#expertStudentStatus").textContent = "จบเกมจำลองแล้ว";
  showOnly("#expertStudentResultView");
  renderLeaderboard();
}

function addSimulatedStudent() {
  let student = state.students.find(item => item.status === "available");
  if (!student) {
    const index = state.students.length;
    student = {
      id: `demo-student-${randomToken(5)}`,
      name: `นักเรียนสมมติ ${index + 1} (จำลอง)`,
      avatar: AVATARS[index % AVATARS.length],
      status: "available",
      score: 0,
      stars: 0,
    };
    state.students.push(student);
  }
  student.status = "waiting";
  renderRoster();
  renderStudentSelect();
  toast(`${student.name} ขอเข้าห้องแล้ว`);
}

function resetSession() {
  state = createSession();
  renderAll();
  $("#expertTeacherStatus").textContent = "เข้าสู่ระบบจำลองแล้ว";
  $("#expertStudentStatus").textContent = "พร้อมเข้าห้อง";
  showOnly("#expertStudentJoinView");
  switchDevice("teacher", { onSmallScreenOnly: true });
  toast("สร้างบัญชีและรหัสห้องจำลองชุดใหม่แล้ว");
}

function switchDevice(device, { onSmallScreenOnly = false } = {}) {
  if (onSmallScreenOnly && window.matchMedia("(min-width: 761px)").matches) return;
  $$("[data-device]").forEach(button => {
    const active = button.dataset.device === device;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$("[data-device-pane]").forEach(pane => {
    pane.classList.toggle("mobile-active", pane.dataset.devicePane === device);
  });
}

function setFullscreenFallback(enabled) {
  const workspace = $("#expertWorkspace");
  workspace.classList.toggle("expert-fullscreen-fallback", enabled);
  document.body.classList.toggle("expert-simulated-fullscreen", enabled);
  $("#expertFullscreenButton").textContent = enabled ? "ออกจากเต็มจอ" : "เต็มจอสองจอ";
}

async function toggleFullscreen() {
  const workspace = $("#expertWorkspace");
  if (workspace.classList.contains("expert-fullscreen-fallback")) {
    setFullscreenFallback(false);
    return;
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  try {
    if (typeof workspace.requestFullscreen !== "function") throw new Error("Fullscreen API unavailable");
    await workspace.requestFullscreen();
  } catch {
    setFullscreenFallback(true);
  }
}

$("#expertResetButton").addEventListener("click", resetSession);
$("#expertAddStudentButton").addEventListener("click", addSimulatedStudent);
$("#expertFullscreenButton").addEventListener("click", toggleFullscreen);
$("#expertFullscreenExitButton").addEventListener("click", toggleFullscreen);
$("#expertStudentJoinButton").addEventListener("click", joinSelectedStudent);
$("#expertApproveAllButton").addEventListener("click", approveAll);
$("#expertStartFirstActivityButton").addEventListener("click", () => startActivity(0));
$("#expertNextQuestionButton").addEventListener("click", nextQuestion);
$("#expertPlayAgainButton").addEventListener("click", () => startActivity(state.activeActivityIndex));

$("#expertPlanSelect").addEventListener("change", event => {
  state.planId = Number(event.target.value) || 1;
  state.activeActivityIndex = 0;
  state.questionIndex = 0;
  state.answered = false;
  renderHeaders();
  renderActivities();
  $("#expertStudentPlanLabel").textContent = `แผนที่ ${state.planId} · ${planTitle()}`;
  if (activeStudent()?.status === "approved") showOnly("#expertStudentLobbyView");
  toast(`เลือกแผนที่ ${state.planId} แล้ว`);
});

$("#expertStudentRoomInput").addEventListener("input", event => {
  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
});

$("#expertStudentSelect").addEventListener("change", event => {
  state.selectedStudentId = event.target.value;
});

$("#expertActivityList").addEventListener("click", event => {
  const button = event.target.closest("[data-activity-index]");
  if (button) startActivity(Number(button.dataset.activityIndex));
});

$("#expertRoster").addEventListener("click", event => {
  const button = event.target.closest("[data-approve-student]");
  if (button) approveStudent(button.dataset.approveStudent);
});

$("#expertQuestionOptions").addEventListener("click", event => {
  const button = event.target.closest("[data-answer]");
  if (button) answerQuestion(button.dataset.answer, button);
});

$("#expertDeviceSwitcher").addEventListener("click", event => {
  const button = event.target.closest("[data-device]");
  if (button) switchDevice(button.dataset.device);
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    setFullscreenFallback(false);
  } else {
    $("#expertFullscreenButton").textContent = "ออกจากเต็มจอ";
  }
});

function fitMirroredScreens() {
  $$(".expert-real-device-screen").forEach(screen => {
    const scale = Math.max(0.1, screen.clientWidth / 1024);
    screen.style.setProperty("--expert-demo-scale", String(scale));
  });
}

const mirroredScreenObserver = typeof ResizeObserver === "function"
  ? new ResizeObserver(fitMirroredScreens)
  : null;

$$(".expert-real-device-screen").forEach(screen => mirroredScreenObserver?.observe(screen));
window.addEventListener("resize", fitMirroredScreens, { passive: true });

state = createSession();
renderAll();
showOnly("#expertStudentJoinView");
fitMirroredScreens();
