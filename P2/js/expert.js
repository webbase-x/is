import { escapeHtml } from "./common.js?v=20260729-plan1-core-plan2-time-1";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const origin = window.location.origin;
const teacherFrame = $("#expertTeacherFrame");
const studentFrame = $("#expertStudentFrame");

const CANDIDATES = Object.freeze([
  { id: "demo-01", name: "เด็กหญิงพอใจ", avatar: "🌷", code: "D01" },
  { id: "demo-02", name: "เด็กชายภูมิ", avatar: "🚀", code: "D02" },
  { id: "demo-03", name: "เด็กหญิงน้ำใส", avatar: "🌈", code: "D03" },
  { id: "demo-04", name: "เด็กชายต้นกล้า", avatar: "🌱", code: "D04" },
  { id: "demo-05", name: "เด็กหญิงใบหม่อน", avatar: "🦋", code: "D05" },
  { id: "demo-06", name: "เด็กชายต้นน้ำ", avatar: "🐳", code: "D06" },
  { id: "demo-07", name: "เด็กหญิงฟ้าใส", avatar: "☀️", code: "D07" },
  { id: "demo-08", name: "เด็กชายแสนดี", avatar: "⭐", code: "D08" },
]);

const state = {
  credentials: null,
  roomCode: "000000",
  school: "โรงเรียนสาธิต (ข้อมูลจำลอง)",
  classroom: "ป.2/ห้องจำลอง",
  candidates: CANDIDATES,
  players: [],
  scores: [],
  activeStudentId: null,
  selectedPlanId: 1,
  lessonIndex: 0,
  currentStep: null,
  showOnStudents: false,
};

function randomDigits(length) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map(value => value % 10).join("");
}

function randomToken(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map(value => alphabet[value % alphabet.length]).join("");
}

function newCredentials() {
  return {
    username: `expert-${randomToken(5).toLowerCase()}@demo.local`,
    password: `L2-${randomToken(4)}-${randomDigits(3)}`,
  };
}

function snapshot() {
  return {
    credentials: state.credentials,
    roomCode: state.roomCode,
    school: state.school,
    classroom: state.classroom,
    candidates: state.candidates,
    players: state.players,
    scores: state.scores,
    activeStudentId: state.activeStudentId,
    selectedPlanId: state.selectedPlanId,
    lessonIndex: state.lessonIndex,
    currentStep: state.currentStep,
    showOnStudents: state.showOnStudents,
  };
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("show"), 2600);
}

function frameUrl(page, params = {}) {
  const url = new URL(page, window.location.href);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.href;
}

function loadEntryFrames() {
  teacherFrame.src = frameUrl("teacher.html", {
    expertDemo: 1,
    embed: "expert-teacher",
    build: "20260728-level2",
  });
  studentFrame.src = frameUrl("student.html", {
    expertDemo: 1,
    embed: "expert-student",
    build: "20260728-level2",
  });
}

function send(target, type, payload = snapshot()) {
  target?.contentWindow?.postMessage({ source: "expert-level2-parent", type, payload }, origin);
}

function broadcast() {
  send(teacherFrame, "expert-state");
  const isStudentEntry = new URL(studentFrame.src || window.location.href).searchParams.get("preview") !== "projector";
  if (isStudentEntry) send(studentFrame, "expert-state");
}

function paintCredentials() {
  $("#expertAccountEmail").textContent = state.credentials.username;
  $("#expertAccountPassword").textContent = state.credentials.password;
  $("#expertRoomCode").textContent = state.roomCode;
}

function resetSession() {
  state.credentials = newCredentials();
  state.roomCode = randomDigits(6);
  state.players = [];
  state.scores = [];
  state.activeStudentId = null;
  state.selectedPlanId = 1;
  state.lessonIndex = 0;
  state.currentStep = null;
  state.showOnStudents = false;
  paintCredentials();
  loadEntryFrames();
  $("#expertTeacherStatus").textContent = "พร้อมเข้าสู่ระบบ";
  $("#expertStudentStatus").textContent = "พร้อมเข้าห้อง";
  toast("สร้างบัญชีและห้องจำลองใหม่แล้ว");
}

function playerFromCandidate(studentId) {
  const candidate = state.candidates.find(item => item.id === studentId);
  if (!candidate) return null;
  return {
    id: `player-${candidate.id}`,
    studentId: candidate.id,
    name: candidate.name,
    avatar: candidate.avatar,
    code: candidate.code,
    status: "waiting",
    score: 0,
    stars: 0,
    percent: 0,
    attempts: 0,
  };
}

function updatePlayer(playerId, patch) {
  const player = state.players.find(item => item.id === playerId);
  if (player) Object.assign(player, patch);
}

function addStudent(studentId = null) {
  const candidate = studentId
    ? state.candidates.find(item => item.id === studentId)
    : state.candidates.find(item => !state.players.some(player => player.studentId === item.id));
  if (!candidate) {
    toast("นักเรียนจำลองเข้าห้องครบแล้ว");
    return;
  }
  let player = state.players.find(item => item.studentId === candidate.id);
  if (!player) {
    player = playerFromCandidate(candidate.id);
    state.players.push(player);
  }
  state.activeStudentId = player.id;
  $("#expertStudentStatus").textContent = "รอครูอนุมัติ";
  broadcast();
}

function approve(playerId) {
  updatePlayer(playerId, { status: "approved" });
  $("#expertStudentStatus").textContent = "เข้าห้องแล้ว";
  broadcast();
}

function remove(playerId) {
  state.players = state.players.filter(item => item.id !== playerId);
  if (state.activeStudentId === playerId) state.activeStudentId = null;
  broadcast();
}

function startStudentGame(step) {
  const player = state.players.find(item => item.id === state.activeStudentId && item.status === "approved")
    || state.players.find(item => item.status === "approved");
  if (!player) {
    $("#expertStudentStatus").textContent = "รออนุมัตินักเรียน";
    return;
  }
  state.activeStudentId = player.id;
  studentFrame.src = frameUrl("student.html", {
    preview: "projector",
    activity: step.activityKey,
    plan: state.selectedPlanId,
    round: `${Date.now()}-${randomToken(3)}`,
    expertDemo: 1,
    embed: "expert-student",
    demoPlayerId: player.id,
    demoName: player.name,
    demoAvatar: player.avatar,
    demoClass: state.classroom,
  });
  $("#expertStudentStatus").textContent = `กำลังเล่น · ${step.title}`;
}

function restoreStudentEntry() {
  studentFrame.src = frameUrl("student.html", {
    expertDemo: 1,
    embed: "expert-student",
    build: "20260728-level2",
  });
  $("#expertStudentStatus").textContent = state.players.some(player => player.status === "approved")
    ? "เข้าห้องแล้ว"
    : "พร้อมเข้าห้อง";
}

function recordResult(payload) {
  const player = state.players.find(item => item.id === payload.playerId)
    || state.players.find(item => item.id === state.activeStudentId);
  if (!player) return;
  player.score = Number(payload.score || 0);
  player.percent = Number(payload.percent || 0);
  player.stars = payload.percent >= 80 ? 3 : payload.percent >= 50 ? 2 : 1;
  player.attempts = Number(player.attempts || 0) + 1;
  state.scores.push({
    playerId: player.id,
    activityKey: payload.activityKey,
    score: player.score,
    maxScore: Number(payload.maxScore || 0),
    percent: player.percent,
  });
  $("#expertStudentStatus").textContent = `จบเกม · ${player.score}/${Number(payload.maxScore || 0)}`;
  broadcast();
}

function switchDevice(device) {
  $$("[data-device]").forEach(button => {
    const active = button.dataset.device === device;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$("[data-device-pane]").forEach(pane => pane.classList.toggle("mobile-active", pane.dataset.devicePane === device));
}

async function toggleFullscreen() {
  const workspace = $("#expertWorkspace");
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  try {
    await workspace.requestFullscreen();
  } catch {
    workspace.classList.toggle("expert-fullscreen-fallback");
    document.body.classList.toggle("expert-simulated-fullscreen");
  }
}

window.addEventListener("message", event => {
  if (event.origin !== origin || event.data?.source !== "expert-level2") return;
  const { role, type, payload = {} } = event.data;
  if (type === "teacher-ready") {
    send(teacherFrame, "expert-init");
    return;
  }
  if (type === "student-ready") {
    send(studentFrame, "expert-init");
    return;
  }
  if (role === "student" && type === "student-join") {
    addStudent(payload.studentId);
    return;
  }
  if (role === "student" && type === "student-reset") {
    if (state.activeStudentId) remove(state.activeStudentId);
    return;
  }
  if (role === "student" && type === "expert-game-result") {
    recordResult(payload);
    return;
  }
  if (role !== "teacher") return;
  if (type === "teacher-session-created") {
    $("#expertTeacherStatus").textContent = "สร้างห้องแล้ว";
  } else if (type === "teacher-approve") {
    approve(payload.playerId);
  } else if (type === "teacher-approve-all") {
    state.players.forEach(player => { player.status = "approved"; });
    $("#expertStudentStatus").textContent = "เข้าห้องแล้ว";
    broadcast();
  } else if (type === "teacher-remove") {
    remove(payload.playerId);
  } else if (type === "teacher-select-plan") {
    state.selectedPlanId = Number(payload.planId) || 1;
    state.lessonIndex = 0;
    broadcast();
  } else if (type === "teacher-step") {
    state.selectedPlanId = Number(payload.planId) || state.selectedPlanId;
    state.lessonIndex = Number(payload.lessonIndex) || 0;
    state.currentStep = payload.step || null;
    state.showOnStudents = payload.showOnStudents !== false;
    if (payload.step?.kind === "game") startStudentGame(payload.step);
    else restoreStudentEntry();
    broadcast();
  } else if (type === "teacher-visibility") {
    state.currentStep = payload.step || state.currentStep;
    state.showOnStudents = Boolean(payload.showOnStudents);
    restoreStudentEntry();
    broadcast();
  }
});

$("#expertResetButton").addEventListener("click", resetSession);
$("#expertAddStudentButton").addEventListener("click", () => addStudent());
$("#expertFullscreenButton").addEventListener("click", toggleFullscreen);
$("#expertFullscreenExitButton").addEventListener("click", toggleFullscreen);
$("#expertDeviceSwitcher").addEventListener("click", event => {
  const button = event.target.closest("[data-device]");
  if (button) switchDevice(button.dataset.device);
});
document.addEventListener("fullscreenchange", () => {
  $("#expertFullscreenButton").textContent = document.fullscreenElement ? "ออกจากเต็มจอ" : "เต็มจอสองจอ";
});

resetSession();
