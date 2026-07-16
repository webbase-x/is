import { APP_CONFIG } from "./config.js";
import { supabase, ensureAnonymousAuth } from "./supabase.js";
import {
  $, ACTIVITIES, escapeHtml, hide, modeLabel, randomAvatar, roomCodeFromUrl,
  setView, show, shuffle, toast, updateConnectionBadge,
} from "./common.js";

const MAE_KO_KA = new Set(["กา", "ปลา", "เต่า", "มือ", "ตา", "ปู", "เสือ", "แมว", "หมู", "นา", "ใบไม้", "ขา", "ผีเสื้อ", "ดู", "พ่อ", "แม่", "วัว", "หมี", "งู", "ไก่", "ปลาโลมา", "ม้า", "ลา", "จระเข้"]);
const COMPARE_WORDS = new Set(["กบ", "นก", "เด็ก", "จาน", "ถ้วย", "เก้าอี้", "บ้าน", "ดิน"]);
const RHYTHM_CUE_TEMPLATE = Object.freeze([
  { word: "เต่า", start: 28.0, end: 28.9 },
  { word: "วัว", start: 28.9, end: 29.8 },
  { word: "เสือ", start: 29.8, end: 30.7 },
  { word: "หมี", start: 30.7, end: 31.6 },
  { word: "งู", start: 31.6, end: 32.5 },
  { word: "ไก่", start: 32.5, end: 33.4 },
  { word: "กา", start: 33.4, end: 34.4 },
  { word: "ปลาโลมา", start: 34.5, end: 36.8 },
  { word: "ม้า", start: 36.8, end: 38.1 },
  { word: "ลา", start: 38.1, end: 39.4 },
  { word: "จระเข้", start: 39.4, end: 41.0 },
  { word: "เต่า", start: 82.0, end: 82.9 },
  { word: "วัว", start: 82.9, end: 83.8 },
  { word: "เสือ", start: 83.8, end: 84.7 },
  { word: "หมี", start: 84.7, end: 85.6 },
  { word: "งู", start: 85.6, end: 86.5 },
  { word: "ไก่", start: 86.5, end: 87.4 },
  { word: "กา", start: 87.4, end: 88.4 },
  { word: "ปลาโลมา", start: 88.5, end: 90.8 },
  { word: "ม้า", start: 90.8, end: 92.1 },
  { word: "ลา", start: 92.1, end: 93.4 },
  { word: "จระเข้", start: 93.4, end: 95.0 },
]);
const RHYTHM_LYRIC_TEMPLATE = Object.freeze([
  { text: "เด็กทั้งหลาย ยังจำได้ไหม", start: 4.0, end: 10.4 },
  { text: "แม่ ก กา ในมาตราไทย", start: 10.4, end: 16.8 },
  { text: "เป็นคำไทย ไม่มีตัวสะกด", start: 16.8, end: 23.2 },
  { text: "เราต้องจดจำ", start: 23.2, end: 27.9 },
  { text: "เต่า วัว เสือ หมี งู ไก่ กา", start: 28.0, end: 34.4 },
  { text: "ปลาโลมา ม้า ลา จระเข้", start: 34.5, end: 41.0 },
  { text: "คำเหล่านี้ ไม่มีตัวสะกด", start: 41.1, end: 47.5 },
  { text: "นั่นคือ แม่ ก กา", start: 47.5, end: 53.9 },
  { text: "เด็กทั้งหลาย ยังจำได้ไหม", start: 56.0, end: 62.4 },
  { text: "แม่ ก กา ในมาตราไทย", start: 62.4, end: 68.8 },
  { text: "เป็นคำไทย ไม่มีตัวสะกด", start: 68.8, end: 75.2 },
  { text: "เราต้องจดจำ", start: 75.2, end: 81.9 },
  { text: "เต่า วัว เสือ หมี งู ไก่ กา", start: 82.0, end: 88.4 },
  { text: "ปลาโลมา ม้า ลา จระเข้", start: 88.5, end: 95.0 },
  { text: "คำเหล่านี้ ไม่มีตัวสะกด", start: 95.1, end: 101.5 },
  { text: "นั่นคือ แม่ ก กา", start: 101.5, end: 108.5 },
]);
const RHYTHM_WORDS = Object.freeze(RHYTHM_CUE_TEMPLATE.map(cue => cue.word));
const RHYTHM_REFERENCE_DURATION = 112.01;
const RHYTHM_CONTENT_START = 22;
const RHYTHM_TEMPLATE_START = 4;
const RHYTHM_TEMPLATE_END = 108.5;
const GAME_ZOOM_LEVELS = Object.freeze([.75, .9, 1, 1.15, 1.3]);

const state = {
  joinStep: "code",
  joinBusy: false,
  roomCode: "",
  sessionInfo: null,
  roster: [],
  student: null,
  selfieBlob: null,
  selfieDataUrl: "",
  selfiePath: "",
  stream: null,
  player: null,
  session: null,
  playerChannel: null,
  sessionChannel: null,
  presenceChannel: null,
  renderedActivity: null,
  attempts: [],
  gameZoomIndex: 2,
  rhythmRun: null,
};

const views = {
  login: $("#loginView"),
  waiting: $("#waitingView"),
  game: $("#gameView"),
};

function connectionUpdate() {
  updateConnectionBadge($("#connectionStatus"), navigator.onLine, navigator.onLine ? "เชื่อมต่อแล้ว" : "ไม่มีอินเทอร์เน็ต");
}

function applyGameZoom(index = state.gameZoomIndex) {
  state.gameZoomIndex = Math.min(Math.max(index, 0), GAME_ZOOM_LEVELS.length - 1);
  const zoom = GAME_ZOOM_LEVELS[state.gameZoomIndex];
  $("#gameCanvas").style.setProperty("--game-zoom", zoom);
  $("#gameZoomLabel").textContent = `${Math.round(zoom * 100)}%`;
  $("#gameZoomOutButton").disabled = state.gameZoomIndex === 0;
  $("#gameZoomInButton").disabled = state.gameZoomIndex === GAME_ZOOM_LEVELS.length - 1;
}

function setGameFocus(enabled) {
  views.game.classList.toggle("game-focus-mode", enabled);
  $("#gameFocusToggleButton").textContent = enabled ? "แสดงเส้นทาง" : "เต็มพื้นที่";
}

function cleanupRhythm() {
  const run = state.rhythmRun;
  if (!run) return;
  run.cancelled = true;
  if (run.frame) cancelAnimationFrame(run.frame);
  run.audio?.pause();
  run.audioContext?.close().catch(() => {});
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  state.rhythmRun = null;
}

const JOIN_STEPS = {
  code: { number: 1, label: "ใส่รหัสห้อง" },
  name: { number: 2, label: "เลือกชื่อของหนู" },
  camera: { number: 3, label: "ถ่ายรูปสดแล้วส่ง" },
};
let roomLookupTimer;

function normalizeRoomCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function setJoinStep(step) {
  const details = JOIN_STEPS[step];
  if (!details) return;
  if (state.joinStep === "camera" && step !== "camera") stopCamera();
  state.joinStep = step;
  document.querySelectorAll(".join-step").forEach(panel => panel.classList.toggle("hidden", panel.dataset.step !== step));
  $("#joinStepNumber").textContent = details.number;
  $("#joinStepLabel").textContent = details.label;
  $("#joinProgressBar").style.width = `${Math.round((details.number / 3) * 100)}%`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setStepStatus(element, message, tone = "default") {
  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.toggle("hidden", !message);
}

function createChoiceButton(title, subtitle, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `student-choice-button ${className}`.trim();
  const strong = document.createElement("strong");
  strong.textContent = title;
  button.append(strong);
  if (subtitle) {
    const small = document.createElement("small");
    small.textContent = subtitle;
    button.append(small);
  }
  return button;
}

function studentDisplayName(student) {
  return String(student.full_name || student.nickname || "นักเรียน").trim().replace(/\s+/g, " ");
}

function renderStudentChoices() {
  const container = $("#studentChoices");
  const students = [...state.roster].sort((a, b) => studentDisplayName(a).localeCompare(studentDisplayName(b), "th"));
  const nameCounts = students.reduce((counts, student) => {
    const name = studentDisplayName(student).toLocaleLowerCase("th");
    counts.set(name, (counts.get(name) || 0) + 1);
    return counts;
  }, new Map());
  container.innerHTML = "";
  students.forEach(student => {
    const name = studentDisplayName(student);
    const duplicated = nameCounts.get(name.toLocaleLowerCase("th")) > 1;
    const extra = duplicated ? (student.nickname ? `ชื่อเล่น ${student.nickname}` : `เลขประจำตัว ${student.student_code}`) : "";
    const button = createChoiceButton(name, extra, "student-name-button");
    button.addEventListener("click", () => selectStudent(student));
    container.append(button);
  });
  setStepStatus($("#nameStatus"), students.length ? "" : "ห้องนี้ยังไม่มีรายชื่อนักเรียน", students.length ? "default" : "warning");
}

async function loadRoster(roomCode) {
  const code = normalizeRoomCode(roomCode);
  if (code.length !== 6) throw new Error("รหัสห้องไม่ถูกต้อง");
  await ensureAnonymousAuth();
  const { data, error } = await supabase.rpc("get_open_session_roster", { p_room_code: code });
  if (error) throw error;
  if (!data?.length) throw new Error("ห้องนี้ยังไม่มีรายชื่อ หรือครูปิดห้องแล้ว กรุณาแจ้งคุณครูตรวจห้องเรียน");
  if (data[0].session_status !== "lobby") throw new Error("ครูปิดรับนักเรียนแล้ว กรุณาแจ้งคุณครู");
  state.roomCode = code;
  state.roster = data;
  state.sessionInfo = data[0];
  state.student = null;
  $("#selectedClassName").textContent = `${data[0].school_name} · ${data[0].class_label}`;
  renderStudentChoices();
}

async function findRoom() {
  const button = $("#findRoomButton");
  if (button.disabled) return;
  clearTimeout(roomLookupTimer);
  const code = normalizeRoomCode($("#roomCode").value);
  $("#roomCode").value = code;
  if (code.length !== 6) {
    setStepStatus($("#codeStatus"), "กรอกรหัสให้ครบ 6 ตัวก่อนนะ", "warning");
    return;
  }
  button.disabled = true;
  button.textContent = "กำลังเปิดห้อง...";
  setStepStatus($("#codeStatus"), "กำลังค้นหาห้องเรียน...", "loading");
  try {
    await loadRoster(code);
    setStepStatus($("#codeStatus"), "");
    setJoinStep("name");
  } catch (error) {
    setStepStatus($("#codeStatus"), error.message || "ไม่พบห้องนี้ ตรวจรหัสแล้วลองใหม่", "error");
    $("#roomCode").focus();
    $("#roomCode").select();
  } finally {
    button.disabled = false;
    button.textContent = "ไปต่อ";
  }
}

function selectStudent(student) {
  state.student = student;
  state.selfieBlob = null;
  state.selfieDataUrl = "";
  $("#cameraStudentName").textContent = studentDisplayName(student);
  $("#cameraClassName").textContent = state.sessionInfo?.class_label || "—";
  setJoinStep("camera");
  window.setTimeout(openCamera, 180);
}

async function openCamera() {
  if (state.joinBusy) return;
  const video = $("#cameraVideo");
  const placeholder = $("#cameraPlaceholder");
  stopCamera();
  hide(video);
  hide($("#captureAndSendButton"));
  hide($("#retryCameraButton"));
  show(placeholder);
  placeholder.querySelector("p").textContent = "กำลังเปิดกล้องสด...";
  $("#cameraHelp").textContent = "กดอนุญาตใช้กล้อง แล้วรอสักครู่นะ";
  state.selfieBlob = null;
  state.selfieDataUrl = "";

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const message = "อุปกรณ์นี้เปิดกล้องสดไม่ได้ กรุณาใช้โทรศัพท์หรือแท็บเล็ตที่มีกล้อง";
    placeholder.querySelector("p").textContent = "เปิดกล้องสดไม่ได้";
    $("#cameraHelp").textContent = message;
    show($("#retryCameraButton"));
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = state.stream;
    await video.play();
    show(video);
    hide(placeholder);
    const button = $("#captureAndSendButton");
    button.disabled = false;
    button.textContent = "📸 ถ่ายรูปและส่งเลย";
    show(button);
    $("#cameraHelp").textContent = "เห็นหน้าหนูแล้ว กดปุ่มสีม่วงเพียงครั้งเดียว";
  } catch (error) {
    stopCamera();
    hide(video);
    show(placeholder);
    placeholder.querySelector("p").textContent = "เปิดกล้องสดไม่ได้";
    const messages = {
      NotAllowedError: "ยังไม่ได้อนุญาตกล้อง แตะสัญลักษณ์กล้องด้านบนแล้วเลือก ‘อนุญาต’ จากนั้นกดลองใหม่",
      NotFoundError: "ไม่พบกล้อง กรุณาใช้โทรศัพท์หรือแท็บเล็ตที่มีกล้อง",
      NotReadableError: "กล้องกำลังถูกแอปอื่นใช้ ปิดแอปนั้นแล้วกดลองใหม่",
      OverconstrainedError: "กล้องนี้ยังไม่พร้อม กดลองเปิดกล้องอีกครั้ง",
    };
    const message = messages[error?.name] || "เปิดกล้องสดไม่ได้ กดลองอีกครั้งหรือเปลี่ยนอุปกรณ์";
    $("#cameraHelp").textContent = message;
    show($("#retryCameraButton"));
    toast(message, "warning");
  }
}

function stopCamera() {
  state.stream?.getTracks().forEach(track => track.stop());
  state.stream = null;
  $("#cameraVideo").srcObject = null;
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", APP_CONFIG.selfieQuality));
}

async function captureAndSend() {
  if (state.joinBusy) return;
  const video = $("#cameraVideo");
  const canvas = $("#cameraCanvas");
  if (!video.videoWidth) return toast("กล้องยังไม่พร้อม กรุณารอสักครู่", "warning");
  const button = $("#captureAndSendButton");
  button.disabled = true;
  button.textContent = "กำลังส่งให้ครู...";
  const ratio = Math.min(1, APP_CONFIG.selfieMaxWidth / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * ratio);
  canvas.height = Math.round(video.videoHeight * ratio);
  const context = canvas.getContext("2d");
  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error("สร้างรูปไม่สำเร็จ");
    state.selfieBlob = blob;
    state.selfieDataUrl = canvas.toDataURL("image/jpeg", APP_CONFIG.selfieQuality);
    stopCamera();
    const sent = await submitJoin();
    if (!sent) await openCamera();
  } catch (error) {
    toast(error.message || "บันทึกรูปไม่สำเร็จ กรุณาลองใหม่", "error");
    button.disabled = false;
    button.textContent = "📸 ถ่ายรูปและส่งเลย";
  }
}

async function uploadSelfie(sessionId, userId) {
  const path = `${sessionId}/${userId}/selfie-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(APP_CONFIG.selfieBucket).upload(path, state.selfieBlob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

async function submitJoin() {
  const studentId = state.student?.student_id;
  if (!studentId || !state.selfieBlob || !state.sessionInfo) return false;
  state.joinBusy = true;
  try {
    const session = await ensureAnonymousAuth();
    state.selfiePath = await uploadSelfie(state.sessionInfo.session_id, session.user.id);
    const { data: playerId, error } = await supabase.rpc("join_session", {
      p_room_code: state.roomCode,
      p_student_id: studentId,
      p_selfie_path: state.selfiePath,
    });
    if (error) throw error;

    const { data: player, error: playerError } = await supabase.from("session_players").select("*").eq("id", playerId).single();
    if (playerError) throw playerError;
    state.player = player;
    sessionStorage.setItem("thaiGameJoin", JSON.stringify({
      roomCode: state.roomCode,
      playerId,
      student: state.student,
      sessionInfo: state.sessionInfo,
      selfieDataUrl: state.selfieDataUrl,
    }));
    showWaiting();
    subscribeToPlayer();
    return true;
  } catch (error) {
    if (state.selfiePath) await supabase.storage.from(APP_CONFIG.selfieBucket).remove([state.selfiePath]);
    state.selfiePath = "";
    toast(error.message || "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่", "error");
    return false;
  } finally {
    state.joinBusy = false;
  }
}

function showWaiting() {
  stopCamera();
  $("#waitingSelfie").src = state.selfieDataUrl;
  $("#waitingAvatar").textContent = state.student?.avatar || randomAvatar(state.student?.nickname);
  $("#waitingName").textContent = state.student?.full_name || "—";
  $("#waitingClass").textContent = state.sessionInfo?.class_label || "—";
  $("#waitingTitle").textContent = state.player?.status === "returned" ? "ครูส่งข้อมูลกลับมา" : "รอครูอนุมัติ";
  $("#waitingMessage").textContent = state.player?.return_reason || "ครูเห็นชื่อและรูปของหนูแล้ว กรุณารอสักครู่นะ";
  $("#retryJoinButton").classList.toggle("hidden", state.player?.status !== "returned");
  setView(views.waiting, views.login, views.game);
}

function subscribeToPlayer() {
  state.playerChannel?.unsubscribe();
  state.playerChannel = supabase.channel(`player-${state.player.id}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "session_players", filter: `id=eq.${state.player.id}` }, payload => {
      state.player = payload.new;
      handlePlayerStatus();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "session_players", filter: `id=eq.${state.player.id}` }, () => resetJoin("ครูนำชื่อออกจากห้อง กรุณาเข้าสู่ระบบใหม่"))
    .subscribe();
  handlePlayerStatus();
}

function handlePlayerStatus() {
  if (state.player.status === "approved") enterGame();
  else if (state.player.status === "returned") showWaiting();
  else if (state.player.status === "removed") resetJoin("ครูนำชื่อออกจากห้องแล้ว");
  else showWaiting();
}

async function enterGame() {
  const { data: session, error } = await supabase.from("class_sessions").select("*").eq("id", state.player.session_id).single();
  if (error) return toast(error.message, "error");
  state.session = session;
  $("#playerAvatar").textContent = state.student?.avatar || randomAvatar(state.student?.nickname);
  $("#playerName").textContent = state.student?.nickname || state.student?.full_name || "นักเรียน";
  $("#attemptBadge").textContent = modeLabel(session.play_mode);
  renderTimeline();
  setView(views.game, views.login, views.waiting);
  await loadAttempts();
  subscribeToSession();
  subscribePresence();
  applySessionState();
}

function renderTimeline() {
  $("#activityTimeline").innerHTML = ACTIVITIES.map((activity, index) => `
    <li data-activity="${activity.key}"><span>${activity.icon}</span><strong>${index + 1}. ${escapeHtml(activity.short)}</strong></li>
  `).join("");
}

async function loadAttempts() {
  const { data } = await supabase.from("game_attempts").select("*").eq("session_player_id", state.player.id).order("completed_at");
  state.attempts = data || [];
  const bestByActivity = new Map();
  state.attempts.forEach(attempt => {
    const best = bestByActivity.get(attempt.activity_key);
    if (!best || attempt.score > best.score) bestByActivity.set(attempt.activity_key, attempt);
  });
  const total = [...bestByActivity.values()].reduce((sum, attempt) => sum + attempt.score, 0);
  $("#playerScore").textContent = total;
  ACTIVITIES.forEach(activity => {
    const item = $(`[data-activity="${activity.key}"]`, $("#activityTimeline"));
    item?.classList.toggle("done", bestByActivity.has(activity.key));
  });
}

function subscribeToSession() {
  state.sessionChannel?.unsubscribe();
  state.sessionChannel = supabase.channel(`session-state-${state.session.id}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${state.session.id}` }, payload => {
      state.session = payload.new;
      applySessionState();
    })
    .subscribe();
}

function subscribePresence() {
  state.presenceChannel?.unsubscribe();
  state.presenceChannel = supabase.channel(`classroom-${state.session.id}`, { config: { presence: { key: state.player.id } } });
  state.presenceChannel.subscribe(status => {
    if (status === "SUBSCRIBED") {
      state.presenceChannel.track({ role: "student", player_id: state.player.id, student_id: state.player.student_id, online_at: new Date().toISOString() });
    }
  });
}

function applySessionState() {
  const activity = ACTIVITIES.find(item => item.key === state.session.current_activity_key);
  $("#stageStep").textContent = activity ? `ภารกิจ ${ACTIVITIES.indexOf(activity) + 1} จาก ${ACTIVITIES.length}` : "เตรียมพร้อม";
  $("#stageTitle").textContent = activity?.title || "รอครูเริ่มกิจกรรม";
  $("#attemptBadge").textContent = modeLabel(state.session.play_mode);
  ACTIVITIES.forEach(item => $(`[data-activity="${item.key}"]`, $("#activityTimeline"))?.classList.toggle("active", item.key === activity?.key));

  if (state.session.status === "closed") {
    cleanupRhythm();
    return resetJoin("คาบเรียนจบแล้ว ขอบคุณที่ร่วมผจญภัย!");
  }
  if (state.session.status !== "active" || !activity) {
    cleanupRhythm();
    state.renderedActivity = null;
    $("#gameCanvas").innerHTML = `<div class="empty-stage"><span>${state.session.status === "paused" ? "⏸️" : "🗺️"}</span><h2>${state.session.status === "paused" ? "พักเกมสักครู่" : "เตรียมพร้อม!"}</h2><p>เมื่อครูเปิดภารกิจ เกมจะปรากฏตรงนี้</p></div>`;
    return;
  }
  if (state.renderedActivity === activity.key) return;
  state.renderedActivity = activity.key;
  renderActivity(activity.key);
}

function renderActivity(key) {
  cleanupRhythm();
  const renderers = { rhythm: renderRhythm, wheel: renderWheel, sound: renderSound, sort: renderSort, train: renderTrain, vote: renderVote, exit: renderExit };
  renderers[key]?.();
}

function gameShell(title, instruction, content) {
  $("#gameCanvas").innerHTML = `<div class="game-inner"><div class="game-instruction"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(instruction)}</p></div>${content}</div>`;
}

async function submitAttempt(activityKey, score, maxScore, answers) {
  const { data, error } = await supabase.rpc("record_game_attempt", {
    p_session_player_id: state.player.id,
    p_activity_key: activityKey,
    p_score: score,
    p_max_score: maxScore,
    p_answers: answers,
  });
  if (error) {
    toast(error.message, "error");
    return null;
  }
  await loadAttempts();
  return data?.[0];
}

function showResult(title, score, maxScore, result, replay) {
  cleanupRhythm();
  const percent = result?.percent ?? Math.round((score / maxScore) * 100);
  $("#gameCanvas").innerHTML = `<div class="game-inner"><div class="result-card"><div class="result-stars">${percent >= 80 ? "★★★" : percent >= 50 ? "★★☆" : "★☆☆"}</div><h2>${escapeHtml(title)}</h2><p>ได้ <strong>${score} / ${maxScore}</strong> คะแนน (${percent}%)</p><p>${result?.passed ? "ผ่านด่านแล้ว เก่งมาก!" : "ลองทบทวนแล้วพยายามใหม่นะ"}</p><button id="replayButton" class="button button-primary">เล่นอีกครั้ง</button></div></div>`;
  $("#replayButton")?.addEventListener("click", replay);
}

function alignRhythmTime(time, duration) {
  const contentStart = RHYTHM_CONTENT_START * (duration / RHYTHM_REFERENCE_DURATION);
  const progress = (time - RHYTHM_TEMPLATE_START) / (RHYTHM_TEMPLATE_END - RHYTHM_TEMPLATE_START);
  return contentStart + (progress * (duration - contentStart));
}

function buildRhythmCues(duration) {
  return RHYTHM_CUE_TEMPLATE.map(cue => ({
    word: cue.word,
    start: alignRhythmTime(cue.start, duration),
    end: alignRhythmTime(cue.end, duration),
  }));
}

function buildRhythmLyrics(duration) {
  return RHYTHM_LYRIC_TEMPLATE.map(line => ({
    text: line.text,
    start: alignRhythmTime(line.start, duration),
    end: alignRhythmTime(line.end, duration),
  }));
}

function playFallbackBeat(run, index) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  run.audioContext ||= new AudioContextClass();
  if (run.audioContext.state === "suspended") run.audioContext.resume().catch(() => {});
  const oscillator = run.audioContext.createOscillator();
  const gain = run.audioContext.createGain();
  oscillator.frequency.value = [392, 440, 523, 659][index % 4];
  oscillator.type = "sine";
  gain.gain.setValueAtTime(.0001, run.audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.14, run.audioContext.currentTime + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, run.audioContext.currentTime + .32);
  oscillator.connect(gain).connect(run.audioContext.destination);
  oscillator.start();
  oscillator.stop(run.audioContext.currentTime + .34);
}

function renderRhythm() {
  const sparkles = Array.from({ length: 28 }, (_, index) => `<i style="--spark-x:${(index * 37) % 96}%;--spark-y:${(index * 53) % 92}%;--spark-delay:${(index % 7) * -.38}s;--spark-size:${12 + (index % 5) * 5}px">✦</i>`).join("");
  const wordButtons = RHYTHM_WORDS.map((word, index) => `<button class="karaoke-word" type="button" data-index="${index}">${escapeHtml(word)}</button>`).join("");
  gameShell(
    "แท็ปจังหวะ แม่ ก กา",
    "คำตัวอย่างเรียงตามเพลง แตะคำที่เปล่งแสงให้ทันจังหวะ",
    `<section class="rhythm-karaoke">
      <div class="game-status-row rhythm-status-row"><span class="mini-score" id="rhythmScore">คะแนน 0</span><div class="rhythm-start-tools"><span id="rhythmAudioStatus">กำลังตรวจเพลง…</span><button id="startRhythm" class="button button-primary" type="button">▶ เริ่มเพลง</button></div></div>
      <div class="karaoke-stage" id="karaokeStage">
        <div class="grammar-sparkles" aria-hidden="true">${sparkles}</div>
        <div class="karaoke-now"><small>คำที่กำลังร้อง</small><strong id="karaokeCurrentWord">พร้อม!</strong><div class="karaoke-progress"><i id="karaokeProgressBar"></i></div></div>
        <div class="karaoke-word-grid" id="karaokeWords">${wordButtons}</div>
        <p class="rhythm-feedback" id="rhythmFeedback">ร้องตามเพลง แล้วแตะคำแม่ ก กา เมื่อคำนั้นเปล่งแสง</p>
      </div>
      <audio id="rhythmAudio" class="rhythm-audio" src="sounds/01-01.mp3" preload="metadata" controls></audio>
    </section>`,
  );

  const audio = $("#rhythmAudio");
  const startButton = $("#startRhythm");
  const status = $("#rhythmAudioStatus");
  const feedback = $("#rhythmFeedback");
  const currentWord = $("#karaokeCurrentWord");
  const progressBar = $("#karaokeProgressBar");
  const buttons = [...$("#karaokeWords").querySelectorAll("button")];
  const maxScore = RHYTHM_WORDS.length;
  const run = {
    audio,
    audioContext: null,
    answers: [],
    settled: new Set(),
    activeIndex: -1,
    score: 0,
    frame: null,
    cancelled: false,
    finished: false,
    started: false,
    useFallback: false,
    duration: 36,
    startedAt: 0,
    cues: [],
    lyrics: [],
    lyricIndex: -2,
    lyricCueIndex: -2,
  };
  state.rhythmRun = run;

  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) status.textContent = `เพลงพร้อม · คำเรียงตามเพลง · ${Math.ceil(audio.duration)} วินาที`;
  });
  audio.addEventListener("error", () => {
    status.textContent = "ไฟล์เพลงยังไม่มีข้อมูล · ใช้เสียงจังหวะสำรองได้";
    audio.classList.add("rhythm-audio-error");
  });

  function settleCue(index) {
    if (index < 0 || run.settled.has(index)) return;
    const word = RHYTHM_WORDS[index];
    run.settled.add(index);
    run.answers.push({ word, tapped: false, correct: false });
    buttons[index].classList.remove("singing");
    buttons[index].classList.add("missed");
  }

  function activateCue(index) {
    if (run.activeIndex === index) return;
    settleCue(run.activeIndex);
    run.activeIndex = index;
    if (index < 0) return;
    const word = RHYTHM_WORDS[index];
    buttons[index].classList.add("singing");
    buttons[index].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    if (run.useFallback) {
      playFallbackBeat(run, index);
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      speakThai(word);
    }
  }

  function renderLyric(time, cueIndex) {
    const lyricIndex = run.lyrics.findIndex(line => time >= line.start && time < line.end);
    if (lyricIndex === run.lyricIndex && cueIndex === run.lyricCueIndex) return;
    run.lyricIndex = lyricIndex;
    run.lyricCueIndex = cueIndex;
    currentWord.classList.toggle("lyric-line", lyricIndex >= 0);
    if (lyricIndex < 0) {
      currentWord.textContent = time < (run.lyrics[0]?.start ?? 0) ? "เตรียมร้อง…" : "ดนตรี…";
      return;
    }
    const line = run.lyrics[lyricIndex];
    if (cueIndex < 0) {
      currentWord.textContent = line.text;
      return;
    }
    const activeWord = RHYTHM_WORDS[cueIndex];
    currentWord.innerHTML = line.text.split(" ").map(word => (
      word === activeWord ? `<mark>${escapeHtml(word)}</mark>` : escapeHtml(word)
    )).join(" ");
  }

  async function finishRhythm() {
    if (run.finished || run.cancelled) return;
    settleCue(run.activeIndex);
    run.finished = true;
    audio.pause();
    startButton.textContent = "กำลังสรุปคะแนน…";
    const result = await submitAttempt("rhythm", run.score, maxScore, run.answers);
    if (run.cancelled || state.renderedActivity !== "rhythm") return;
    if (result) showResult("จบเพลงแล้ว!", run.score, maxScore, result, renderRhythm);
    else renderRhythm();
  }

  function tick() {
    if (run.cancelled || run.finished || state.renderedActivity !== "rhythm") return;
    const time = run.useFallback ? (performance.now() - run.startedAt) / 1000 : audio.currentTime;
    const cueIndex = run.cues.findIndex(cue => time >= cue.start && time < cue.end);
    activateCue(cueIndex);
    renderLyric(time, cueIndex);
    progressBar.style.width = `${Math.min(100, Math.max(0, (time / run.duration) * 100))}%`;
    if (time >= run.duration || (!run.useFallback && audio.ended)) return finishRhythm();
    run.frame = requestAnimationFrame(tick);
  }

  buttons.forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.index);
    if (!run.started) return feedback.textContent = "กดเริ่มเพลงก่อน แล้วรอให้คำเปล่งแสง";
    if (index !== run.activeIndex) return feedback.textContent = "รอให้คำนี้เปล่งแสงก่อนนะ";
    if (run.settled.has(index)) return;
    const word = RHYTHM_WORDS[index];
    const correct = true;
    run.settled.add(index);
    run.answers.push({ word, tapped: true, correct });
    button.classList.remove("singing");
    button.classList.add(correct ? "correct" : "wrong");
    if (correct) {
      run.score += 1;
      $("#rhythmScore").textContent = `คะแนน ${run.score}`;
      feedback.textContent = `เก่งมาก! “${word}” เป็นคำแม่ ก กา`;
    }
  }));

  startButton.addEventListener("click", async () => {
    if (run.started) return;
    run.started = true;
    startButton.disabled = true;
    currentWord.textContent = "เตรียมฟัง…";
    let audioStarted = false;
    try {
      audio.currentTime = 0;
      await audio.play();
      audioStarted = true;
    } catch {
      run.useFallback = true;
      status.textContent = "กำลังใช้เสียงคำและจังหวะสำรอง";
      toast("ไฟล์เพลงยังไม่มีเสียง ระบบใช้จังหวะสำรองแทน", "warning");
    }
    const validAudio = audioStarted && Number.isFinite(audio.duration) && audio.duration > 5;
    if (!validAudio) {
      run.useFallback = true;
      audio.pause();
      status.textContent = "กำลังใช้เสียงคำและจังหวะสำรอง";
    }
    run.duration = validAudio ? audio.duration : 36;
    run.cues = buildRhythmCues(run.duration);
    run.lyrics = buildRhythmLyrics(run.duration);
    run.startedAt = performance.now();
    tick();
  });
}

function runQuestionGame({ key, title, instruction, questions, renderPrompt, choices, replay }) {
  let index = 0;
  let score = 0;
  const answers = [];
  const render = () => {
    const question = questions[index];
    gameShell(title, instruction, `<div class="game-status-row"><span>ข้อ ${index + 1} / ${questions.length}</span><span class="mini-score">คะแนน ${score}</span></div><div id="questionPrompt"></div><div class="choice-grid" id="questionChoices"></div>`);
    renderPrompt(question, $("#questionPrompt"));
    $("#questionChoices").innerHTML = choices(question).map(choice => `<button class="choice-button" data-value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</button>`).join("");
    [...$("#questionChoices").children].forEach(button => button.addEventListener("click", async () => {
      const chosen = button.dataset.value;
      const correct = chosen === question.answer;
      if (correct) score += 1;
      answers.push({ prompt: question.word || question.prompt, chosen, correct });
      button.classList.add(correct ? "correct" : "wrong");
      [...$("#questionChoices").children].forEach(item => item.disabled = true);
      setTimeout(async () => {
        index += 1;
        if (index < questions.length) render();
        else {
          const result = await submitAttempt(key, score, questions.length, answers);
          if (result) showResult("ทำภารกิจสำเร็จ", score, questions.length, result, replay);
        }
      }, 650);
    }));
  };
  render();
}

function renderWheel() {
  const questions = shuffle([...MAE_KO_KA].slice(0, 5).concat([...COMPARE_WORDS].slice(0, 3))).map(word => ({ word, answer: MAE_KO_KA.has(word) ? "none" : "has" }));
  runQuestionGame({
    key: "wheel", title: "วงล้อเสี่ยงทาย", instruction: "คำนี้มีตัวสะกดหรือไม่",
    questions,
    renderPrompt(question, container) { container.innerHTML = `<div class="wheel" style="transform:rotate(${Math.random() * 540 + 360}deg)"><span style="transform:rotate(-${Math.random() * 20}deg)">${escapeHtml(question.word)}</span></div>`; },
    choices: () => [{ value: "none", label: "ไม่มีตัวสะกด" }, { value: "has", label: "มีตัวสะกด" }],
    replay: renderWheel,
  });
}

function speakThai(word) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "th-TH";
  utterance.rate = .78;
  speechSynthesis.speak(utterance);
}

function renderSound() {
  const questions = shuffle(["กา", "ปลา", "มือ", "กบ", "นก", "จาน"]).map(word => ({ word, answer: MAE_KO_KA.has(word) ? "yes" : "no" }));
  runQuestionGame({
    key: "sound", title: "นักสืบเสียงท้ายคำ", instruction: "กดฟังเสียง แล้วตอบว่าเป็นคำแม่ ก กา หรือไม่",
    questions,
    renderPrompt(question, container) { container.innerHTML = `<div style="text-align:center;margin:15px 0 30px"><button class="sound-button" id="speakWord" aria-label="ฟังคำ">🔊</button></div>`; $("#speakWord").addEventListener("click", () => speakThai(question.word)); setTimeout(() => speakThai(question.word), 300); },
    choices: () => [{ value: "yes", label: "ใช่ แม่ ก กา" }, { value: "no", label: "ไม่ใช่" }],
    replay: renderSound,
  });
}

function renderSort() {
  const words = shuffle(["กา", "ปลา", "เต่า", "มือ", "ปู", "เสือ", "กบ", "นก", "เด็ก", "จาน"]);
  gameShell("จัดบ้านให้คำ", "ลากคำไปใส่บ้านที่ถูกต้อง หรือแตะคำแล้วแตะบ้าน", `<div class="sort-area"><div class="word-bank" id="sortWordBank"></div><div class="word-house good" data-house="none"><h3>🏡 บ้านแม่ ก กา</h3><div class="house-dropzone" id="noneHouse"></div></div><div class="word-house bad" data-house="has"><h3>🏠 บ้านมีตัวสะกด</h3><div class="house-dropzone" id="hasHouse"></div></div></div><button id="checkSort" class="button button-primary" style="margin-top:22px" disabled>ตรวจคำตอบ</button>`);
  let selected = null;
  const bank = $("#sortWordBank");
  words.forEach(word => {
    const token = document.createElement("button");
    token.className = "word-token";
    token.textContent = word;
    token.draggable = true;
    token.dataset.word = word;
    token.addEventListener("click", () => { selected?.classList.remove("active"); selected = token; token.classList.add("active"); });
    token.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", word));
    bank.append(token);
  });
  $(".sort-area").querySelectorAll(".word-house").forEach(house => {
    house.addEventListener("dragover", event => event.preventDefault());
    const move = word => {
      const token = [...document.querySelectorAll(".word-token")].find(item => item.dataset.word === word && !item.dataset.placed);
      if (!token) return;
      token.dataset.placed = house.dataset.house;
      house.querySelector(".house-dropzone").append(token);
      selected = null;
      $("#checkSort").disabled = document.querySelectorAll(".word-token:not([data-placed])").length > 0;
    };
    house.addEventListener("drop", event => { event.preventDefault(); move(event.dataTransfer.getData("text/plain")); });
    house.addEventListener("click", () => { if (selected) move(selected.dataset.word); });
  });
  $("#checkSort").addEventListener("click", async () => {
    const answers = [...document.querySelectorAll(".word-token")].map(token => ({ word: token.dataset.word, chosen: token.dataset.placed, correct: token.dataset.placed === (MAE_KO_KA.has(token.dataset.word) ? "none" : "has") }));
    const score = answers.filter(answer => answer.correct).length;
    const result = await submitAttempt("sort", score, answers.length, answers);
    if (result) showResult("จัดบ้านเรียบร้อย", score, answers.length, result, renderSort);
  });
}

function renderTrain() {
  const sentences = [
    { words: ["ตา", "ดู", "ปู", "นา"], answer: "ตาดูปูนา" },
    { words: ["แม่", "พา", "ปู", "นา"], answer: "แม่พาปูนา" },
    { words: ["พ่อ", "ดู", "ปลา"], answer: "พ่อดูปลา" },
  ];
  let index = 0;
  let score = 0;
  const answers = [];
  const render = () => {
    const item = sentences[index];
    let selected = [];
    gameShell("รถไฟประโยคแม่ ก กา", "แตะโบกี้ตามลำดับเพื่อเรียงเป็นประโยค", `<div class="game-status-row"><span>ขบวน ${index + 1} / ${sentences.length}</span><span class="mini-score">คะแนน ${score}</span></div><div class="sentence-output" id="sentenceOutput">แตะคำเพื่อเริ่มต่อขบวน</div><div class="train-track" id="trainTrack"></div><div class="button-row"><button id="resetTrain" class="button button-ghost">เริ่มเรียงใหม่</button><button id="checkTrain" class="button button-primary">ตรวจประโยค</button></div>`);
    $("#trainTrack").innerHTML = shuffle(item.words).map((word, position) => `<button class="train-car" data-word="${escapeHtml(word)}" data-position="${position}">${escapeHtml(word)}</button>`).join("");
    $("#trainTrack").querySelectorAll("button").forEach(button => button.addEventListener("click", () => { button.disabled = true; selected.push(button.dataset.word); $("#sentenceOutput").textContent = selected.join(""); }));
    $("#resetTrain").addEventListener("click", render);
    $("#checkTrain").addEventListener("click", async () => {
      const sentence = selected.join("");
      const correct = sentence === item.answer;
      if (correct) score += 1;
      answers.push({ sentence, correct, answer: item.answer });
      index += 1;
      if (index < sentences.length) setTimeout(render, 500);
      else {
        const result = await submitAttempt("train", score, sentences.length, answers);
        if (result) showResult("ต่อขบวนครบแล้ว", score, sentences.length, result, renderTrain);
      }
    });
  };
  render();
}

async function renderVote() {
  const wordBank = ["ตา", "ยาย", "พ่อ", "แม่", "ดู", "พา", "ปู", "ปลา", "นา", "มา", "หา", "เสือ"];
  let selected = [];
  gameShell("บอร์ดโหวตประโยคฮิต", "เลือกคำมาแต่งประโยค ส่งขึ้นบอร์ด แล้วมอบหัวใจให้เพื่อน", `<div class="sentence-output" id="voteSentence">เลือกคำจากคลังคำ</div><div class="word-bank-large" id="voteWordBank"></div><div class="button-row" style="margin:18px 0"><button id="clearSentence" class="button button-ghost">ล้างคำ</button><button id="submitSentence" class="button button-primary">ส่งประโยค</button></div><div class="vote-board" id="voteBoard"></div>`);
  $("#voteWordBank").innerHTML = wordBank.map(word => `<button class="word-token" data-word="${word}">${word}</button>`).join("");
  $("#voteWordBank").querySelectorAll("button").forEach(button => button.addEventListener("click", () => { selected.push(button.dataset.word); $("#voteSentence").textContent = selected.join(""); }));
  $("#clearSentence").addEventListener("click", () => { selected = []; $("#voteSentence").textContent = "เลือกคำจากคลังคำ"; });
  $("#submitSentence").addEventListener("click", async () => {
    const sentence = selected.join("");
    if (selected.length < 2) return toast("เลือกอย่างน้อย 2 คำก่อนส่ง", "warning");
    const { error } = await supabase.from("sentence_submissions").insert({ session_id: state.session.id, session_player_id: state.player.id, sentence });
    if (error) return toast(error.message, "error");
    const attempt = await submitAttempt("vote", 1, 1, [{ sentence }]);
    if (attempt) toast("ส่งประโยคขึ้นบอร์ดแล้ว", "success");
    selected = [];
    $("#voteSentence").textContent = "เลือกคำจากคลังคำ";
    loadVoteBoard();
  });
  await loadVoteBoard();
}

async function loadVoteBoard() {
  const board = $("#voteBoard");
  if (!board) return;
  const { data, error } = await supabase.from("sentence_submissions").select("id,sentence,session_player_id,sentence_votes(emoji)").eq("session_id", state.session.id).order("created_at");
  if (error) return;
  board.innerHTML = data?.length ? data.map(item => `<div class="vote-entry"><strong>${escapeHtml(item.sentence)}</strong><button class="vote-button" data-id="${item.id}">💗 ${item.sentence_votes?.length || 0}</button></div>`).join("") : `<p class="field-help">ยังไม่มีประโยคบนบอร์ด</p>`;
  board.querySelectorAll("button").forEach(button => button.addEventListener("click", async () => {
    const { error: voteError } = await supabase.from("sentence_votes").insert({ submission_id: button.dataset.id, voter_player_id: state.player.id, emoji: "💗" });
    if (voteError) toast("โหวตประโยคนี้แล้ว", "warning");
    else loadVoteBoard();
  }));
}

function renderExit() {
  const questions = [
    { prompt: "ข้อใดเป็นคำแม่ ก กา", answer: "ปลา", options: ["ปลา", "กบ", "นก", "จาน"] },
    { prompt: "คำแม่ ก กา มีลักษณะอย่างไร", answer: "ไม่มีตัวสะกด", options: ["ไม่มีตัวสะกด", "มี ก สะกด", "มีเสียงท้าย", "อ่านไม่ได้"] },
    { prompt: "ประโยคใดเรียงได้ถูกต้อง", answer: "ตาดูปูนา", options: ["ดูตาปูนา", "ตาดูปูนา", "ปูนาตาดู", "นาดูปูตา"] },
  ];
  runQuestionGame({
    key: "exit", title: "ไขกุญแจหีบสมบัติ", instruction: "ตอบให้ถูกอย่างน้อย 2 ใน 3 ข้อ เพื่อเปิดหีบสมบัติ",
    questions,
    renderPrompt(question, container) { container.innerHTML = `<div class="treasure"><span class="treasure-icon">🔒</span><h2>${escapeHtml(question.prompt)}</h2></div>`; },
    choices: question => question.options.map(option => ({ value: option, label: option })),
    replay: renderExit,
  });
}

function retryJoin() {
  stopCamera();
  state.selfieBlob = null;
  state.selfieDataUrl = "";
  state.selfiePath = "";
  state.playerChannel?.unsubscribe();
  state.playerChannel = null;
  setView(views.login, views.waiting, views.game);
  if (state.roster.length) {
    renderStudentChoices();
    setJoinStep("name");
  } else {
    initializeJoinFlow();
  }
}

function resetJoin(message) {
  toast(message, "default");
  cleanupRhythm();
  sessionStorage.removeItem("thaiGameJoin");
  state.playerChannel?.unsubscribe();
  state.sessionChannel?.unsubscribe();
  state.presenceChannel?.unsubscribe();
  stopCamera();
  Object.assign(state, {
    joinStep: "code", joinBusy: false,
    roomCode: "", roster: [], sessionInfo: null, student: null,
    selfieBlob: null, selfieDataUrl: "", selfiePath: "",
    player: null, session: null, playerChannel: null, sessionChannel: null,
    presenceChannel: null, renderedActivity: null, attempts: [], gameZoomIndex: 2, rhythmRun: null,
  });
  setView(views.login, views.waiting, views.game);
  initializeJoinFlow();
}

async function restoreSession() {
  const savedText = sessionStorage.getItem("thaiGameJoin");
  if (!savedText) return false;
  try {
    const saved = JSON.parse(savedText);
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return false;
    const { data: player } = await supabase.from("session_players").select("*").eq("id", saved.playerId).maybeSingle();
    if (!player) return false;
    const { data: roster } = await supabase.rpc("get_open_session_roster", { p_room_code: saved.roomCode });
    state.roomCode = saved.roomCode;
    state.player = player;
    state.roster = roster || [];
    state.sessionInfo = state.roster[0] || saved.sessionInfo || null;
    state.student = state.roster.find(item => item.student_id === player.student_id) || saved.student;
    state.selfieDataUrl = saved.selfieDataUrl || "";
    subscribeToPlayer();
    return true;
  } catch {
    sessionStorage.removeItem("thaiGameJoin");
    return false;
  }
}

$("#joinForm").addEventListener("submit", event => { event.preventDefault(); findRoom(); });
$("#findRoomButton").addEventListener("click", findRoom);
$("#roomCode").addEventListener("input", event => {
  event.target.value = normalizeRoomCode(event.target.value);
  setStepStatus($("#codeStatus"), "");
  clearTimeout(roomLookupTimer);
  if (event.target.value.length === 6) roomLookupTimer = window.setTimeout(findRoom, 350);
});
$("#backToCodeButton").addEventListener("click", () => {
  setJoinStep("code");
  window.setTimeout(() => $("#roomCode").focus(), 100);
});
$("#backToNamesButton").addEventListener("click", () => setJoinStep("name"));
$("#retryCameraButton").addEventListener("click", openCamera);
$("#captureAndSendButton").addEventListener("click", captureAndSend);
$("#retryJoinButton").addEventListener("click", retryJoin);
$("#gameZoomOutButton").addEventListener("click", () => applyGameZoom(state.gameZoomIndex - 1));
$("#gameZoomInButton").addEventListener("click", () => applyGameZoom(state.gameZoomIndex + 1));
$("#gameZoomResetButton").addEventListener("click", () => applyGameZoom(2));
$("#gameFocusToggleButton").addEventListener("click", () => setGameFocus(!views.game.classList.contains("game-focus-mode")));
window.addEventListener("online", connectionUpdate);
window.addEventListener("offline", connectionUpdate);
window.addEventListener("beforeunload", stopCamera);
window.addEventListener("beforeunload", cleanupRhythm);

async function initializeStudentPage() {
  connectionUpdate();
  applyGameZoom();
  setGameFocus(true);
  const restored = await restoreSession();
  if (!restored) await initializeJoinFlow();
}

async function initializeJoinFlow() {
  setJoinStep("code");
  const code = normalizeRoomCode(roomCodeFromUrl());
  $("#roomCode").value = code;
  setStepStatus($("#codeStatus"), "");
  if (code.length === 6) await findRoom();
  else window.setTimeout(() => $("#roomCode").focus(), 100);
}

initializeStudentPage();
