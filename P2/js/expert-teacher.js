import { PLAN_CATALOG } from "./plan-catalog.js?v=20260727-plan8-mae-kon-1";
import {
  activitiesForPlan,
  escapeHtml,
  lessonFlowForPlan,
} from "./common.js?v=20260728-expert-level2-1";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const parentOrigin = window.location.origin;

const state = {
  credentials: null,
  roomCode: "------",
  school: "โรงเรียนจำลอง",
  classroom: "ป.2/ห้องจำลอง",
  players: [],
  scores: [],
  selectedPlanId: 1,
  lessonIndex: 0,
  loggedIn: false,
  timerId: null,
  remainingSeconds: 0,
};

document.body.classList.add("expert-embed", "expert-teacher-embed", "expert-level2-frame");

function post(type, payload = {}) {
  window.parent.postMessage({ source: "expert-level2", role: "teacher", type, payload }, parentOrigin);
}

function show(element) { element?.classList.remove("hidden"); }
function hide(element) { element?.classList.add("hidden"); }

function showFlowStep(name) {
  hide($("#sessionSetup"));
  hide($("#resumeSessionView"));
  $$("[data-flow-step]").forEach(section => hide(section));
  if (name === "class") {
    hide($("#liveSession"));
    show($("#sessionSetup"));
  } else {
    show($("#liveSession"));
    show($(`[data-flow-step="${name}"]`));
  }
  const order = ["class", "qr", "lobby", "plan", "live", "summary"];
  const activeIndex = order.indexOf(name);
  $$("[data-progress-step]").forEach((item, index) => {
    item.classList.toggle("active", index === activeIndex);
    item.classList.toggle("done", index < activeIndex);
  });
  const headings = {
    class: ["เลือกห้องเรียนจำลอง", "บัญชี Level 2 เห็นเฉพาะโรงเรียนและนักเรียนสมมติ"],
    qr: ["QR และรหัสห้องจำลอง", "ใช้สำหรับจอนักเรียนในหน้าผู้เชี่ยวชาญนี้เท่านั้น"],
    lobby: ["ตรวจและอนุมัตินักเรียนจำลอง", "ไม่มีรูปถ่ายหรือข้อมูลนักเรียนจริง"],
    plan: ["เลือกแผนการสอน", "แผนและกิจกรรมเหมือนห้องเรียนจริงทุกลำดับ"],
    live: ["ควบคุมการสอนและผลการแข่งขัน", "เกมจริงทำงานในหน่วยความจำและไม่บันทึกคะแนน"],
    summary: ["สรุปผลการทดลอง", "ข้อมูลทั้งหมดจะหายเมื่อปิดหน้าผู้เชี่ยวชาญ"],
  };
  const [title, context] = headings[name] || headings.class;
  $("#flowStepTitle").textContent = title;
  $("#flowContext").textContent = context;
}

function renderClassSetup() {
  $("#schoolSelect").innerHTML = `<option value="demo-school">${escapeHtml(state.school)}</option>`;
  $("#classSelect").disabled = false;
  $("#classSelect").innerHTML = `<option value="demo-class">${escapeHtml(state.classroom)} · นักเรียนสมมติ 8 คน</option>`;
  $("#classOwnershipNote").textContent = "✅ โหมดผู้เชี่ยวชาญ Level 2 · ใช้โรงเรียน ห้อง และรายชื่อนักเรียนสมมติเท่านั้น";
  $("#classOwnershipNote").classList.add("success");
}

function roomCodeElements() {
  return [
    "#liveRoomCode", "#lobbyRoomCode", "#lateJoinRoomCode", "#liveHeaderRoomCode",
    "#liveJoinRoomCode", "#resumeRoomCode",
  ].map(selector => $(selector)).filter(Boolean);
}

function renderRoom() {
  roomCodeElements().forEach(element => { element.textContent = state.roomCode; });
  $("#qrClassContext").textContent = `${state.school} · ${state.classroom}`;
  $("#liveClassContext").textContent = `${state.school} · ${state.classroom}`;
  $("#summaryClassContext").textContent = `${state.school} · ${state.classroom}`;
  $("#studentJoinQr")?.classList.add("hidden");
  const qrFrame = $(".session-qr-frame");
  if (qrFrame) {
    qrFrame.innerHTML = `<div class="expert-demo-qr" aria-label="รหัสห้องจำลอง"><span>DEMO</span><strong>${escapeHtml(state.roomCode)}</strong><small>Level 2</small></div>`;
  }
}

function renderPlayers() {
  const waiting = state.players.filter(player => player.status === "waiting");
  const approved = state.players.filter(player => player.status === "approved");
  $("#onlineCount").textContent = state.players.length;
  $("#waitingCount").textContent = waiting.length;
  $("#approvedCount").textContent = approved.length;
  $("#liveApprovedCount").textContent = approved.length;
  $("#lobbySummary").textContent = state.players.length
    ? `${state.players.length} คนเข้าห้องแล้ว · รออนุมัติ ${waiting.length} คน`
    : "ยังไม่มีนักเรียนจำลอง";
  $("#lobbyPageSummary").textContent = state.players.length ? `แสดงทั้งหมด ${state.players.length} คน` : "หน้า 1/1";
  $("#lobbyPageIndicator").textContent = "หน้า 1 จาก 1";
  $("#lobbyPagination").classList.add("hidden");
  $("#approveAllButton").disabled = waiting.length === 0;
  $("#approveAllButton").textContent = waiting.length ? `✓ อนุมัติ ${waiting.length} คน` : "✓ อนุมัติครบแล้ว";

  const list = $("#playerList");
  if (!state.players.length) {
    list.innerHTML = `<div class="empty-report"><span>👋</span><h2>รอนักเรียนจำลองเข้าห้อง</h2><p>ให้นักเรียนใช้รหัส ${escapeHtml(state.roomCode)} จากจอด้านข้าง</p></div>`;
  } else {
    list.innerHTML = state.players.map(player => `
      <article class="player-row" data-player-id="${player.id}">
        <span class="avatar-fallback">${escapeHtml(player.avatar || "⭐")}</span>
        <div class="player-info">
          <strong>${escapeHtml(player.name)}</strong>
          <small class="player-meta">ข้อมูลสมมติ · ${escapeHtml(player.code)}</small>
          <span class="player-status status-${player.status}">${player.status === "approved" ? "อนุมัติแล้ว" : "รอตรวจ"}</span>
        </div>
        <div class="player-row-actions">
          ${player.status === "waiting" ? `<button class="button button-small button-success" data-action="approve">✓ <span class="player-action-label">อนุมัติ</span></button>` : ""}
          <button class="button button-small button-danger" data-action="remove">× <span class="player-action-label">นำออก</span></button>
        </div>
      </article>
    `).join("");
  }
  $("#liveJoinRequestCount").textContent = `${waiting.length} คน`;
  $("#liveJoinRequests").classList.toggle("hidden", waiting.length === 0);
  $("#liveJoinRequestList").innerHTML = waiting.map(player => `
    <article><span>${escapeHtml(player.avatar || "⭐")}</span><div><strong>${escapeHtml(player.name)}</strong><small>นักเรียนจำลอง</small></div><button class="button button-success button-small" data-live-approve="${player.id}">อนุมัติ</button></article>
  `).join("");
}

function planRecord(planId = state.selectedPlanId) {
  return PLAN_CATALOG.find(plan => Number(plan.sequence) === Number(planId)) || PLAN_CATALOG[0];
}

function renderPlanChoices() {
  $("#planChoices").innerHTML = PLAN_CATALOG.map(plan => {
    const planId = Number(plan.sequence);
    const flow = lessonFlowForPlan(planId);
    const totalMinutes = flow.reduce((sum, step) => sum + Number(step.minutes || 0), 0);
    return `<button type="button" class="flow-plan-choice ${planId === state.selectedPlanId ? "selected" : ""}" data-plan-id="${planId}">
      <span>แผน ${planId}</span><strong>${escapeHtml(plan.title)}</strong><small>${flow.length} ขั้น · ${totalMinutes} นาที</small>
    </button>`;
  }).join("");
  renderSelectedPlan();
}

function renderSelectedPlan() {
  const plan = planRecord();
  $("#planSelect").value = String(state.selectedPlanId);
  $("#selectedPlanTitle").textContent = `แผนที่ ${state.selectedPlanId} · ${plan.title}`;
  $("#activityPreview").innerHTML = lessonFlowForPlan(state.selectedPlanId).map((step, index) => `
    <article><span>${step.icon}</span><div><small>${step.kind === "game" ? "เกมนักเรียน" : step.kind === "results" ? "ประกาศผล" : "สื่อ/คำสั่งครู"} · ลำดับ ${index + 1}</small><strong>${escapeHtml(step.title)}</strong><em>${step.kind === "results" ? "หลังจบเกม" : `${step.minutes} นาที`}</em></div></article>
  `).join("");
}

function selectPlan(planId, notify = true) {
  state.selectedPlanId = Math.min(8, Math.max(1, Number(planId) || 1));
  state.lessonIndex = 0;
  renderPlanChoices();
  if (notify) post("teacher-select-plan", { planId: state.selectedPlanId });
}

function currentFlow() {
  return lessonFlowForPlan(state.selectedPlanId);
}

function currentStep() {
  return currentFlow()[state.lessonIndex] || currentFlow()[0];
}

function renderLessonMedia(step) {
  hide($("#lessonGamePreview"));
  hide($("#competitionArena"));
  show($("#lessonScreenPreview"));
  const screen = step.screen || {};
  const bullets = (screen.bullets || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const cards = (screen.cards || []).slice(0, 10).map(card => `<span><strong>${escapeHtml(card.word)}</strong><small>${escapeHtml(card.detail || "")}</small></span>`).join("");
  $("#lessonScreenPreview").innerHTML = `
    <span>${escapeHtml(screen.icon || step.icon || "🗺️")}</span>
    <div><small>${escapeHtml(screen.eyebrow || "สื่อการสอน")}</small><strong>${escapeHtml(screen.title || step.title)}</strong><p>${escapeHtml(screen.message || "")}</p>
    ${bullets ? `<ul>${bullets}</ul>` : ""}${cards ? `<div class="expert-demo-flashcards">${cards}</div>` : ""}</div>`;
}

function renderGamePreview(step) {
  hide($("#lessonScreenPreview"));
  hide($("#competitionArena"));
  show($("#lessonGamePreview"));
  const player = state.players.find(item => item.status === "approved");
  const url = new URL("student.html", window.location.href);
  url.searchParams.set("preview", "projector");
  url.searchParams.set("activity", step.activityKey);
  url.searchParams.set("plan", String(state.selectedPlanId));
  url.searchParams.set("round", `${Date.now()}`);
  url.searchParams.set("expertDemo", "1");
  url.searchParams.set("demoMuted", "1");
  url.searchParams.set("demoName", player?.name || "นักเรียนจำลอง");
  url.searchParams.set("demoAvatar", player?.avatar || "⭐");
  url.searchParams.set("demoClass", state.classroom);
  $("#lessonGamePreviewFrame").src = url.href;
}

function renderResults(step) {
  hide($("#lessonScreenPreview"));
  hide($("#lessonGamePreview"));
  show($("#competitionArena"));
  $("#competitionStatus").textContent = "ผลคะแนนจากการทดลองในหน่วยความจำ · ไม่บันทึกฐานข้อมูล";
  $("#competitionLiveBadge").innerHTML = "<i></i> ประกาศผลจำลอง";
  $("#competitionLastUpdate").textContent = "อัปเดตภายในหน้านี้";
  const ranked = [...state.players].filter(player => player.status === "approved").sort((a, b) => (b.score || 0) - (a.score || 0));
  $("#liveResults").innerHTML = ranked.length ? `<div class="competition-podium">${ranked.map((player, index) => `
    <article><span>${index + 1}</span><i>${escapeHtml(player.avatar || "⭐")}</i><strong>${escapeHtml(player.name)}</strong><small>${Number(player.score || 0)} คะแนน · ${Number(player.stars || 0)} ดาว</small></article>
  `).join("")}</div>` : `<div class="empty-report"><span>🏆</span><h2>รอผลการเล่น</h2><p>เมื่อนักเรียนเล่นจบ คะแนนจำลองจะแสดงที่นี่</p></div>`;
}

function stopTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
}

function paintTimer() {
  const minutes = Math.floor(state.remainingSeconds / 60);
  const seconds = state.remainingSeconds % 60;
  $("#activityCountdown").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  $("#activityTimerCard").classList.toggle("expired", state.remainingSeconds <= 0);
}

function startTimer() {
  stopTimer();
  state.remainingSeconds = Math.max(0, Number(currentStep()?.minutes || 0) * 60);
  paintTimer();
  state.timerId = window.setInterval(() => {
    if (state.remainingSeconds > 0) state.remainingSeconds -= 1;
    paintTimer();
    if (state.remainingSeconds <= 0) stopTimer();
  }, 1000);
}

function renderLessonStep(notify = true) {
  const flow = currentFlow();
  const step = currentStep();
  if (!step) return;
  $("#lessonStageLabel").textContent = step.screen?.eyebrow || `ขั้นที่ ${step.stage}`;
  $("#lessonStepTitle").textContent = step.title;
  $("#lessonStepMeta").textContent = `${state.lessonIndex + 1} จาก ${flow.length} · ${step.minutes} นาที · ครูเป็นผู้เปลี่ยนหน้า`;
  $("#lessonStepKind").textContent = step.kind === "game" ? "เกมนักเรียน" : step.kind === "results" ? "ประกาศผล" : "สื่อ/คำสั่ง";
  $("#currentActivityLabel").textContent = step.title;
  $("#projectorModeLabel").textContent = step.kind === "game" ? "เกมพร้อมทดลอง" : step.kind === "results" ? "ประกาศผลการแข่งขัน" : "สื่อพร้อมฉาย";
  $("#lessonTeacherNotes").innerHTML = (step.teacherNotes || []).map(note => `<li>${escapeHtml(note)}</li>`).join("");
  $("#previousLessonStepButton").disabled = state.lessonIndex === 0;
  $("#previousLessonStepButton").querySelector(".lesson-nav-title").textContent = flow[state.lessonIndex - 1]?.title || "เริ่มต้น";
  $("#nextActivityButton").disabled = state.lessonIndex >= flow.length - 1;
  $("#nextActivityButton").querySelector(".lesson-nav-title").textContent = flow[state.lessonIndex + 1]?.title || "จบแผน";
  $("#finishActivityButton").classList.toggle("hidden", step.kind !== "game");
  $("#shareLessonToStudents").checked = step.kind === "game" || Boolean(step.studentVisibleDefault);
  $("#shareLessonToStudents").disabled = step.kind === "game";

  if (step.kind === "game") renderGamePreview(step);
  else if (step.kind === "results") renderResults(step);
  else renderLessonMedia(step);

  $("#activityControls").innerHTML = flow.map((item, index) => `
    <button type="button" class="${index === state.lessonIndex ? "active" : ""}" data-lesson-index="${index}">
      <span>${item.icon}</span><div><small>ลำดับ ${index + 1} · ${item.kind === "game" ? "เกม" : item.kind === "results" ? "ผลการแข่งขัน" : "สื่อ"}</small><strong>${escapeHtml(item.title)}</strong></div><em>${item.kind === "results" ? "ผล" : `${item.minutes} นาที`}</em>
    </button>
  `).join("");
  startTimer();
  if (notify) post("teacher-step", {
    planId: state.selectedPlanId,
    lessonIndex: state.lessonIndex,
    step,
    showOnStudents: $("#shareLessonToStudents").checked,
  });
}

function renderScores() {
  const approved = state.players.filter(player => player.status === "approved");
  const average = approved.length
    ? Math.round(approved.reduce((sum, player) => sum + Number(player.percent || 0), 0) / approved.length)
    : 0;
  $("#averageScore").textContent = `${average}%`;
  $("#completedAttemptCount").textContent = approved.filter(player => Number(player.attempts || 0) > 0).length;
  $("#summaryApproved").textContent = approved.length;
  $("#summaryAverage").textContent = `${average}%`;
  $("#summaryCompleted").textContent = new Set(state.scores.map(score => score.activityKey)).size;
  if (currentStep()?.kind === "results") renderResults(currentStep());
}

function applySnapshot(snapshot) {
  state.credentials = snapshot.credentials;
  state.roomCode = snapshot.roomCode;
  state.school = snapshot.school;
  state.classroom = snapshot.classroom;
  state.players = snapshot.players || [];
  state.scores = snapshot.scores || [];
  state.selectedPlanId = Number(snapshot.selectedPlanId) || state.selectedPlanId;
  state.lessonIndex = Math.max(0, Number(snapshot.lessonIndex) || 0);
  $("#teacherEmail").value = state.credentials.username;
  $("#teacherPassword").value = state.credentials.password;
  renderClassSetup();
  renderRoom();
  renderPlayers();
  renderPlanChoices();
  renderScores();
}

function login(event) {
  event.preventDefault();
  const valid = $("#teacherEmail").value.trim() === state.credentials?.username
    && $("#teacherPassword").value === state.credentials?.password;
  if (!valid) {
    $("#teacherPassword").setCustomValidity("บัญชีจำลองไม่ถูกต้อง");
    $("#teacherPassword").reportValidity();
    return;
  }
  $("#teacherPassword").setCustomValidity("");
  state.loggedIn = true;
  hide($("#teacherLoginView"));
  show($("#teacherDashboard"));
  $("#teacherName").textContent = "ผู้เชี่ยวชาญ · Level 2";
  $("#teacherConnection").innerHTML = "<i></i> DEMO Level 2";
  show($("#signOutButton"));
  showFlowStep("class");
}

$("#teacherLoginForm").addEventListener("submit", login);
$("#sessionSetup").addEventListener("submit", event => {
  event.preventDefault();
  renderRoom();
  showFlowStep("qr");
  post("teacher-session-created");
});
$("#qrNextButton").addEventListener("click", () => showFlowStep("lobby"));
$("#lobbyBackButton").addEventListener("click", () => showFlowStep("qr"));
$("#lobbyNextButton").addEventListener("click", () => showFlowStep("plan"));
$("#planBackButton").addEventListener("click", () => showFlowStep("lobby"));
$("#startPlanButton").addEventListener("click", () => {
  state.lessonIndex = 0;
  showFlowStep("live");
  renderLessonStep();
});
$("#previousLessonStepButton").addEventListener("click", () => {
  if (state.lessonIndex <= 0) return;
  state.lessonIndex -= 1;
  renderLessonStep();
});
$("#nextActivityButton").addEventListener("click", () => {
  if (state.lessonIndex >= currentFlow().length - 1) return;
  state.lessonIndex += 1;
  renderLessonStep();
});
$("#restartLessonTimerButton").addEventListener("click", startTimer);
$("#shareLessonToStudents").addEventListener("change", event => {
  post("teacher-visibility", {
    step: currentStep(),
    showOnStudents: event.target.checked,
  });
});
$("#finishActivityButton").addEventListener("click", () => {
  const next = currentFlow()[state.lessonIndex + 1];
  if (next?.kind === "results") {
    state.lessonIndex += 1;
    renderLessonStep();
  }
});
$("#approveAllButton").addEventListener("click", () => post("teacher-approve-all"));
$("#playerList").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  const row = button?.closest("[data-player-id]");
  if (!button || !row) return;
  if (button.dataset.action === "approve") post("teacher-approve", { playerId: row.dataset.playerId });
  if (button.dataset.action === "remove") post("teacher-remove", { playerId: row.dataset.playerId });
});
$("#liveJoinRequestList").addEventListener("click", event => {
  const button = event.target.closest("[data-live-approve]");
  if (button) post("teacher-approve", { playerId: button.dataset.liveApprove });
});
$("#planChoices").addEventListener("click", event => {
  const button = event.target.closest("[data-plan-id]");
  if (button) selectPlan(Number(button.dataset.planId));
});
$("#activityControls").addEventListener("click", event => {
  const button = event.target.closest("[data-lesson-index]");
  if (!button) return;
  state.lessonIndex = Number(button.dataset.lessonIndex);
  renderLessonStep();
});
$("#showSummaryButton").addEventListener("click", () => {
  showFlowStep("summary");
  renderScores();
  $("#summaryContent").innerHTML = `<div class="expert-level2-summary"><h3>ผลการทดลองชั่วคราว</h3>${state.players.filter(player => player.status === "approved").map(player => `<p><span>${escapeHtml(player.avatar || "⭐")} ${escapeHtml(player.name)}</span><strong>${Number(player.score || 0)} คะแนน</strong></p>`).join("") || "<p>ยังไม่มีผลคะแนน</p>"}</div>`;
});
$("#summaryBackButton").addEventListener("click", () => {
  showFlowStep("live");
  renderLessonStep(false);
});
$("#signOutButton").addEventListener("click", () => window.location.reload());

window.addEventListener("message", event => {
  if (event.origin !== parentOrigin || event.data?.source !== "expert-level2-parent") return;
  if (event.data.type === "expert-init" || event.data.type === "expert-state") applySnapshot(event.data.payload);
});

window.setInterval(() => {
  const clock = $("#projectorWallClock");
  if (clock) clock.textContent = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date());
}, 1000);

$("#teacherConnection").innerHTML = "<i></i> รอข้อมูลจำลอง";
post("teacher-ready");
