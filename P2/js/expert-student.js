import { escapeHtml } from "./common.js?v=20260728-expert-level2-1";

const $ = selector => document.querySelector(selector);
const parentOrigin = window.location.origin;

const state = {
  roomCode: "------",
  school: "โรงเรียนจำลอง",
  classroom: "ป.2/ห้องจำลอง",
  candidates: [],
  players: [],
  activeStudentId: null,
};

document.body.classList.add("expert-embed", "expert-student-embed", "expert-level2-frame");

function post(type, payload = {}) {
  window.parent.postMessage({ source: "expert-level2", role: "student", type, payload }, parentOrigin);
}

function show(element) {
  element?.classList.remove("hidden");
}

function hide(element) {
  element?.classList.add("hidden");
}

function setJoinStep(step) {
  ["#codeStep", "#nameStep", "#cameraStep"].forEach(selector => hide($(selector)));
  show($(`#${step}Step`));
  const details = step === "code"
    ? ["1", "ใส่รหัสห้อง", "33%"]
    : ["2", "เลือกชื่อนักเรียนจำลอง", "66%"];
  $("#joinStepNumber").textContent = details[0];
  $("#joinStepLabel").textContent = details[1];
  $("#joinProgressBar").style.width = details[2];
}

function setView(view) {
  ["#loginView", "#waitingView", "#gameView"].forEach(selector => hide($(selector)));
  show($(view));
}

function activePlayer() {
  return state.players.find(player => player.id === state.activeStudentId) || null;
}

function renderCandidates() {
  $("#selectedClassName").textContent = `${state.school} · ${state.classroom}`;
  $("#studentChoices").innerHTML = state.candidates.map(candidate => {
    const joined = state.players.some(player => player.studentId === candidate.id);
    return `
      <button class="student-name-option expert-student-name-option" type="button"
        data-student-id="${candidate.id}" ${joined ? "disabled" : ""}>
        <span>${escapeHtml(candidate.avatar || "⭐")}</span>
        <strong>${escapeHtml(candidate.name)}</strong>
        <small>${joined ? "อยู่ในห้องแล้ว" : "ข้อมูลนักเรียนสมมติ"}</small>
      </button>`;
  }).join("");
}

function showWaiting(player) {
  setView("#waitingView");
  $("#waitingSelfie").classList.add("hidden");
  $("#waitingAvatar").textContent = player.avatar || "⭐";
  $("#waitingName").textContent = player.name;
  $("#waitingClass").textContent = state.classroom;
  $("#waitingTitle").textContent = "รอครูอนุมัติ";
  $("#waitingMessage").textContent = "คำขอจำลองส่งถึงจอครูแล้ว กรุณากดอนุมัติที่จอครู";
}

function showApproved(player) {
  setView("#gameView");
  document.body.classList.add("student-game-live");
  $("#playerAvatar").textContent = player.avatar || "⭐";
  $("#studentLiveAvatar").textContent = player.avatar || "⭐";
  $("#playerName").textContent = player.name;
  $("#studentLiveName").textContent = player.name;
  $("#studentLiveClass").textContent = `${state.classroom} · ข้อมูลจำลอง`;
  $("#playerScore").textContent = Number(player.score || 0);
  $("#attemptBadge").textContent = "Level 2";
  $("#timerBadge").textContent = "รอครู";
  $("#stageStep").textContent = "เข้าห้องแล้ว";
  $("#stageTitle").textContent = "รอครูเริ่มกิจกรรม";
  $("#activityTimeline").innerHTML = `
    <li class="active"><span>1</span><div><strong>พร้อมเรียน</strong><small>เกมจริงจะแสดงเมื่อครูกดเริ่ม</small></div></li>`;
  $("#gameCanvas").innerHTML = `
    <div class="empty-stage expert-student-ready-stage">
      <span>✅</span>
      <h2>เข้าห้องจำลองเรียบร้อย</h2>
      <p>เมื่อครูเปิดกิจกรรม จอนี้จะเปลี่ยนเป็นเกมจริงตามแผนการสอนโดยอัตโนมัติ</p>
    </div>`;
}

function applySnapshot(snapshot) {
  state.roomCode = snapshot.roomCode || state.roomCode;
  state.school = snapshot.school || state.school;
  state.classroom = snapshot.classroom || state.classroom;
  state.candidates = snapshot.candidates || [];
  state.players = snapshot.players || [];
  if (snapshot.activeStudentId) state.activeStudentId = snapshot.activeStudentId;

  $("#roomCode").value = state.roomCode;
  renderCandidates();
  const player = activePlayer();
  if (!player) {
    setView("#loginView");
    setJoinStep("code");
  } else if (player.status === "approved") {
    showApproved(player);
  } else {
    showWaiting(player);
  }
}

function findRoom() {
  const code = $("#roomCode").value.replace(/\D/g, "").slice(0, 6);
  if (code !== state.roomCode) {
    $("#codeStatus").textContent = "ไม่พบห้องนี้ กรุณาใช้รหัส 6 ตัวจากจอครู";
    $("#codeStatus").classList.remove("hidden");
    return;
  }
  $("#codeStatus").classList.add("hidden");
  setJoinStep("name");
}

$("#joinForm").addEventListener("submit", event => {
  event.preventDefault();
  findRoom();
});
$("#findRoomButton").addEventListener("click", findRoom);
$("#roomCode").addEventListener("input", event => {
  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
  $("#codeStatus").classList.add("hidden");
});
$("#backToCodeButton").addEventListener("click", () => setJoinStep("code"));
$("#studentChoices").addEventListener("click", event => {
  const button = event.target.closest("[data-student-id]");
  if (!button || button.disabled) return;
  state.activeStudentId = button.dataset.studentId;
  post("student-join", { studentId: state.activeStudentId });
});
$("#retryJoinButton").addEventListener("click", () => {
  state.activeStudentId = null;
  post("student-reset");
  setView("#loginView");
  setJoinStep("name");
});
$("#gameFocusToggleButton").addEventListener("click", () => {
  $("#gameView").classList.toggle("game-focus-mode");
});

window.addEventListener("message", event => {
  if (event.origin !== parentOrigin || event.data?.source !== "expert-level2-parent") return;
  if (event.data.type === "expert-init" || event.data.type === "expert-state") {
    applySnapshot(event.data.payload || {});
  }
});

$("#connectionStatus").innerHTML = "<i></i> โหมดจำลองปลอดภัย";
$("#connectionStatus").classList.add("online");
setView("#loginView");
setJoinStep("code");
post("student-ready");
