import { APP_CONFIG } from "./config.js";
import { supabase, ensureAnonymousAuth } from "./supabase.js";
import {
  $, ACTIVITIES, escapeHtml, GAME_STATE_EVENT, gameStateChannelName, hide,
  modeLabel, randomAvatar, roomCodeFromUrl, setView, show, shuffle, toast,
  updateConnectionBadge,
} from "./common.js?v=20260722-play-modes-1";

const TEXTBOOK_VOCABULARY = Object.freeze({
  // คำจากชุด "รู้จักคำ นำเรื่อง" บทที่ 1-5 ในไฟล์ พาที วรรณคดลำนำ ป.2
  none: Object.freeze([
    "โบ", "ไข่", "เล้า", "ไหว้", "แคร่", "เกา", "แฉะ", "บ่อ", "หัว",
    "ไฟ", "แกะ", "งอ", "ห่อ", "กลัว", "คู่", "ตู้", "ซื้อ", "ก้าว", "กะทิ",
  ]),
  has: Object.freeze([
    "ราด", "บิน", "ปีก", "ยิ้ม", "มอง", "รูป", "ถ้วย", "ข่าว", "แอ่ง", "ท้อง", "โอบ", "กอด", "ตัด", "ขัง", "เสียม",
    "ย่าง", "สูง", "นึ่ง", "ทิ้ง", "ผัก", "นก", "บน", "โยน", "ทาง", "ฟืน", "ยุง", "พัด", "เต็นท์", "ผ้าม่าน", "สุมไฟ", "ก้อนหิน", "ไฟฉาย", "ตะเกียง",
    "อ่าน", "ชิม", "เงิน", "ส้ม", "น้องชาย", "มะม่วง",
  ]),
  sentences: Object.freeze([
    { words: ["แม่", "ไก่", "ออก", "ไข่"], answer: "แม่ไก่ออกไข่" },
    { words: ["น้ำใส", "วิ่ง", "นำหน้า", "ภูผา"], answer: "น้ำใสวิ่งนำหน้าภูผา" },
    { words: ["ภูผา", "และ", "น้ำใส", "หัวเราะ", "ดังลั่น"], answer: "ภูผาและน้ำใสหัวเราะดังลั่น" },
    { words: ["น้ำใส", "ป้อน", "น้ำแข็งกด", "ให้", "ใบโบก"], answer: "น้ำใสป้อนน้ำแข็งกดให้ใบโบก" },
    { words: ["ใบโบก", "ใบบัว", "โบกหู", "แกว่งหาง"], answer: "ใบโบกใบบัวโบกหูแกว่งหาง" },
    { words: ["วันนี้", "ลม", "พัด", "แรง"], answer: "วันนี้ลมพัดแรง" },
    { words: ["น้ำใส", "ไม่ต้อง", "กลัว"], answer: "น้ำใสไม่ต้องกลัว" },
    { words: ["ลุงวัน", "พา", "เด็ก", "กลับบ้าน"], answer: "ลุงวันพาเด็กกลับบ้าน" },
    { words: ["ขบวนช้าง", "เดินทาง", "มาถึง", "ชายป่า"], answer: "ขบวนช้างเดินทางมาถึงชายป่า" },
    { words: ["ใบโบก", "ใบบัว", "เป็น", "ดาราช้างน้อย"], answer: "ใบโบกใบบัวเป็นดาราช้างน้อย" },
    { words: ["เด็กๆ", "ชอบกิน", "ไอศกรีม", "รสต่างๆ"], answer: "เด็กๆชอบกินไอศกรีมรสต่างๆ" },
  ]),
});
const MAE_KO_KA = new Set(["กา", "ปลา", "เต่า", "มือ", "ตา", "ปู", "เสือ", "แมว", "หมู", "นา", "ใบไม้", "ขา", "ผีเสื้อ", "ดู", "พ่อ", "แม่", "วัว", "หมี", "งู", "ไก่", "ปลาโลมา", "ม้า", "ลา", "จระเข้", ...TEXTBOOK_VOCABULARY.none]);
const HAS_FINAL_WORDS = new Set(["กบ", "นก", "เด็ก", "จาน", "ถ้วย", "เก้าอี้", "บ้าน", "ดิน", "มด", "เข็ม", "ลิง", "กลอง", "ขนม", "ดอกไม้", ...TEXTBOOK_VOCABULARY.has]);
const WHEEL_WORDS = Object.freeze({
  none: ["กา", "ปู", "มือ", "งา", "ชา", "แพ", "รู", "นา", "วัว", "เสือ", "ม้า", "ไผ่", ...TEXTBOOK_VOCABULARY.none],
  has: ["กบ", "นก", "เด็ก", "จาน", "บ้าน", "ดิน", "มด", "เข็ม", "ลิง", "กลอง", "ขนม", "ดอกไม้", ...TEXTBOOK_VOCABULARY.has],
});
const WHEEL_SPIN_DURATION = 3000;
const RHYTHM_CUE_TEMPLATE = Object.freeze([
  { word: "เต่า", start: 38.00, end: 38.55 },
  { word: "วัว", start: 38.55, end: 39.10 },
  { word: "เสือ", start: 39.10, end: 39.65 },
  { word: "หมี", start: 39.65, end: 40.20 },
  { word: "งู", start: 40.20, end: 40.75 },
  { word: "ไก่", start: 40.75, end: 41.30 },
  { word: "กา", start: 41.30, end: 42.00 },
  { word: "ปลาโลมา", start: 42.00, end: 43.40 },
  { word: "ม้า", start: 43.40, end: 44.20 },
  { word: "ลา", start: 44.20, end: 45.00 },
  { word: "จระเข้", start: 45.00, end: 46.00 },
  { word: "เต่า", start: 85.00, end: 85.67 },
  { word: "วัว", start: 85.67, end: 86.34 },
  { word: "เสือ", start: 86.34, end: 87.00 },
  { word: "หมี", start: 87.00, end: 87.65 },
  { word: "งู", start: 87.65, end: 88.30 },
  { word: "ไก่", start: 88.30, end: 89.00 },
  { word: "กา", start: 89.00, end: 90.00 },
  { word: "ปลาโลมา", start: 90.00, end: 91.40 },
  { word: "ม้า", start: 91.40, end: 92.20 },
  { word: "ลา", start: 92.20, end: 93.00 },
  { word: "จระเข้", start: 93.00, end: 94.00 },
]);
const RHYTHM_LYRIC_TEMPLATE = Object.freeze([
  { text: "เด็กทั้งหลาย ยังจำได้ไหม", start: 22, end: 26 },
  { text: "แม่ ก กา ในมาตราไทย", start: 26, end: 30 },
  { text: "เป็นคำไทย ไม่มีตัวสะกด", start: 30, end: 34 },
  { text: "เราต้องจดจำ", start: 34, end: 38 },
  { text: "เต่า วัว เสือ หมี งู ไก่ กา", start: 38, end: 42 },
  { text: "ปลาโลมา ม้า ลา จระเข้", start: 42, end: 46 },
  { text: "คำเหล่านี้ ไม่มีตัวสะกด", start: 46, end: 49 },
  { text: "นั่นคือ แม่ ก กา", start: 49, end: 51 },
  { text: "เด็กทั้งหลาย ยังจำได้ไหม", start: 70, end: 74 },
  { text: "แม่ ก กา ในมาตราไทย", start: 74, end: 78 },
  { text: "เป็นคำไทย ไม่มีตัวสะกด", start: 78, end: 82 },
  { text: "เราต้องจดจำ", start: 82, end: 85 },
  { text: "เต่า วัว เสือ", start: 85, end: 87 },
  { text: "หมี งู ไก่ กา", start: 87, end: 90 },
  { text: "ปลาโลมา ม้า ลา จระเข้", start: 90, end: 94 },
  { text: "คำเหล่านี้ ไม่มีตัวสะกด", start: 94, end: 98 },
  { text: "นั่นคือ แม่ ก กา", start: 98, end: 100 },
]);
const RHYTHM_WORDS = Object.freeze(RHYTHM_CUE_TEMPLATE.map(cue => cue.word));
const RHYTHM_REFERENCE_DURATION = 112.01;
const RHYTHM_PRACTICE_COUNT = 11;
const RHYTHM_PHASE_TEMPLATE = Object.freeze({
  introEnd: 22,
  practiceStart: 38,
  breakStart: 51,
  secondRoundStart: 70,
  challengeStart: 85,
  lyricEnd: 100,
});
const RHYTHM_BREAK_CARDS = Object.freeze([
  { word: "เต่า", target: true }, { word: "หมี", target: true },
  { word: "กา", target: true }, { word: "ม้า", target: true },
  { word: "กบ", target: false }, { word: "นก", target: false },
  { word: "บ้าน", target: false }, { word: "จาน", target: false },
]);
const RHYTHM_CHALLENGE_TEMPLATE = Object.freeze([
  { start: 85, end: 87, prompt: "เต่า วัว ___", answer: "เสือ", options: ["เสือ", "นก", "จาน"] },
  { start: 87, end: 90, prompt: "หมี งู ___", answer: "ไก่", options: ["ไก่", "กบ", "บ้าน"] },
  { start: 90, end: 94, prompt: "ปลาโลมา ม้า ลา ___", answer: "จระเข้", options: ["จระเข้", "เด็ก", "ดิน"] },
]);
const RHYTHM_EMOJI = Object.freeze({
  "เต่า": "🐢", "วัว": "🐄", "เสือ": "🐯", "หมี": "🐻", "งู": "🐍", "ไก่": "🐔",
  "กา": "🐦", "ปลาโลมา": "🐬", "ม้า": "🐴", "ลา": "🫏", "จระเข้": "🐊",
  "กบ": "🐸", "นก": "🐦", "บ้าน": "🏠", "จาน": "🍽️", "เด็ก": "🧒", "ดิน": "🟫",
});
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
  lastGameStateEventId: null,
  renderedActivity: null,
  attempts: [],
  gameZoomIndex: 2,
  rhythmRun: null,
  presenceReady: false,
  presenceTracked: false,
  screenPresenceTimer: null,
  screenPresencePublishing: false,
  screenPresencePending: false,
  presenceOnlineAt: null,
  screenWatchUntil: 0,
  screenWatchInterval: null,
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
  const lookup = supabase.rpc("get_open_session_roster", { p_room_code: code });
  let lookupTimer;
  const timeout = new Promise((_, reject) => { lookupTimer = window.setTimeout(() => reject(new Error("ตรวจห้องเรียนนานเกินไป กรุณาตรวจอินเทอร์เน็ตแล้วกดไปต่ออีกครั้ง")), 12000); });
  let response;
  try { response = await Promise.race([lookup, timeout]); }
  finally { window.clearTimeout(lookupTimer); }
  const { data, error } = response;
  if (error) throw error;
  if (!data?.length) throw new Error("ไม่พบห้องที่เปิดรับด้วยรหัสนี้ รหัสคาบเดิมอาจปิดแล้ว กรุณาดูรหัสใหม่จากหน้า QR ของคุณครู");
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

    // Do not coerce the REST response with `.single()`: an RLS propagation
    // delay can briefly return an empty result immediately after the RPC.
    // Reading the first row lets us show a useful retry message instead of
    // exposing PostgREST's "Cannot coerce ... single JSON object" error.
    const { data: playerRows, error: playerError } = await supabase.from("session_players").select("*").eq("id", playerId).limit(1);
    if (playerError) throw playerError;
    const player = playerRows?.[0];
    if (!player) throw new Error("ยังไม่พบข้อมูลการเข้าห้อง กรุณากดส่งข้อมูลอีกครั้ง");
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
  $("#waitingMessage").textContent = state.player?.return_reason || "ส่งชื่อและรูปใหม่ให้ครูแล้ว กรุณารอคุณครูกดอนุมัติอีกครั้งนะ";
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
  const { data: sessionRows, error } = await supabase.from("class_sessions").select("*").eq("id", state.player.session_id).limit(1);
  if (error) return toast(error.message, "error");
  const session = sessionRows?.[0];
  if (!session) return toast("ไม่พบข้อมูลคาบเรียน กรุณาเข้าห้องใหม่อีกครั้ง", "error");
  state.session = session;
  const avatar = state.student?.avatar || randomAvatar(state.student?.nickname);
  const displayName = state.student?.full_name || state.student?.nickname || "นักเรียน";
  const classLabel = state.sessionInfo?.class_label || "นักเรียน";
  $("#playerAvatar").textContent = avatar;
  $("#playerName").textContent = state.student?.nickname || displayName;
  $("#studentLiveAvatar").textContent = avatar;
  $("#studentLiveName").textContent = displayName;
  $("#studentLiveClass").textContent = classLabel;
  const profilePhoto = $("#playerProfilePhoto");
  profilePhoto.classList.toggle("hidden", !state.selfieDataUrl);
  $("#playerAvatar").classList.toggle("hidden", Boolean(state.selfieDataUrl));
  const liveProfilePhoto = $("#studentLiveProfilePhoto");
  liveProfilePhoto.classList.toggle("hidden", !state.selfieDataUrl);
  $("#studentLiveAvatar").classList.toggle("hidden", Boolean(state.selfieDataUrl));
  const useAvatarOnImageError = (image, fallback) => image?.addEventListener("error", () => {
    image.classList.add("hidden");
    fallback?.classList.remove("hidden");
  }, { once: true });
  useAvatarOnImageError(profilePhoto, $("#playerAvatar"));
  useAvatarOnImageError(liveProfilePhoto, $("#studentLiveAvatar"));
  profilePhoto.src = state.selfieDataUrl || "";
  liveProfilePhoto.src = state.selfieDataUrl || "";
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
  state.sessionChannel = supabase.channel(gameStateChannelName(state.session.id))
    .on("broadcast", { event: GAME_STATE_EVENT }, message => {
      const update = message?.payload || message;
      if (!update?.session || update.session.id !== state.session.id) return;
      if (update.event_id && update.event_id === state.lastGameStateEventId) return;
      state.lastGameStateEventId = update.event_id || null;
      state.session = update.session;
      applySessionState();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${state.session.id}` }, payload => {
      // Durable fallback for reconnects; Broadcast is the immediate render path.
      state.session = payload.new;
      applySessionState();
    })
    .subscribe();
}

function studentPresenceIdentity() {
  const mode = state.session?.leaderboard_mode || "nickname_avatar";
  if (mode === "hidden") return { displayName: "นักผจญภัย", avatar: "⭐" };
  if (mode === "real_name") return { displayName: state.student?.full_name || "นักเรียน", avatar: state.student?.avatar || "🙂" };
  if (mode === "student_code") return { displayName: state.student?.student_code || "ไม่ระบุรหัส", avatar: state.student?.avatar || "🙂" };
  return {
    displayName: state.student?.nickname || state.student?.full_name || "นักเรียน",
    avatar: state.student?.avatar || randomAvatar(state.student?.nickname),
  };
}

function studentGameMirrorMarkup() {
  const source = $("#gameCanvas");
  if (!source) return "";
  const clone = source.cloneNode(true);
  clone.querySelectorAll("audio, video, source, script, iframe, object, embed, select, option, input, textarea").forEach(element => element.remove());
  clone.querySelectorAll("*").forEach(element => {
    element.removeAttribute("id");
    element.removeAttribute("name");
    element.removeAttribute("for");
    element.removeAttribute("aria-live");
    [...element.attributes].forEach(attribute => {
      if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
    });
    if (element.matches("button")) {
      element.setAttribute("disabled", "");
      element.setAttribute("tabindex", "-1");
    }
  });
  let markup = clone.innerHTML.replace(/>\s+</g, "><").trim();
  if (markup.length > 48000) {
    clone.querySelectorAll(".grammar-sparkles, .rhythm-audio, .rhythm-control-row").forEach(element => element.remove());
    markup = clone.innerHTML.replace(/>\s+</g, "><").trim();
  }
  return markup.length <= 48000 ? markup : "";
}

function studentScreenPresencePayload() {
  const activity = ACTIVITIES.find(item => item.key === state.session?.current_activity_key);
  const identity = studentPresenceIdentity();
  const resultVisible = Boolean($("#gameCanvas .result-card"));
  const completedActivities = new Set(state.attempts.map(attempt => attempt.activity_key)).size;
  const currentAttempts = state.attempts.filter(attempt => attempt.activity_key === activity?.key).length;
  let screenState = "ready";
  let screenLabel = "รอครูเริ่มเกม";
  if (state.session?.status === "paused") { screenState = "paused"; screenLabel = "พักเกม"; }
  else if (resultVisible) { screenState = "result"; screenLabel = "ส่งผลแล้ว"; }
  else if (state.session?.status === "active" && activity) { screenState = "playing"; screenLabel = "กำลังเล่นเกม"; }
  const detailElement = $("#rhythmFeedback") || $("#gameCanvas .result-card p") || $("#gameCanvas .game-instruction p") || $("#gameCanvas .empty-stage p");
  const detail = (detailElement?.textContent || "กำลังทำกิจกรรม").trim().slice(0, 120);
  const score = Number($("#playerScore")?.textContent || 0);
  const progressPercent = resultVisible || currentAttempts ? 100 : activity ? 30 : 0;
  return {
    role: "student",
    player_id: state.player?.id,
    student_id: state.player?.student_id,
    display_name: identity.displayName,
    avatar: identity.avatar,
    screen_state: screenState,
    screen_label: screenLabel,
    activity_key: activity?.key || null,
    activity_title: activity?.title || "รอครูเริ่มกิจกรรม",
    detail,
    mode: state.session?.play_mode || "practice",
    score,
    progress_percent: progressPercent,
    progress_text: `ทำแล้ว ${completedActivities}/${ACTIVITIES.length} เกม`,
    game_markup: studentGameMirrorMarkup(),
    game_zoom: Math.max(.75, Math.min(1.3, Number($("#gameCanvas")?.style.getPropertyValue("--game-zoom")) || 1)),
    updated_at: new Date().toISOString(),
    online_at: state.presenceOnlineAt || new Date().toISOString(),
  };
}

async function publishStudentScreenPresence() {
  if (!state.presenceReady || !state.presenceChannel || !state.player || !state.session) return;
  if (state.screenPresencePublishing) {
    state.screenPresencePending = true;
    return;
  }
  state.screenPresencePublishing = true;
  try {
    const payload = studentScreenPresencePayload();
    if (!state.presenceTracked) {
      const { game_markup: gameMarkup, ...presencePayload } = payload;
      await state.presenceChannel.track(presencePayload);
      state.presenceTracked = true;
      if (gameMarkup) await state.presenceChannel.send({ type: "broadcast", event: "student-screen", payload });
    } else {
      await state.presenceChannel.send({ type: "broadcast", event: "student-screen", payload });
    }
  }
  catch { /* Realtime will publish the latest screen again after reconnecting. */ }
  finally {
    state.screenPresencePublishing = false;
    if (state.screenPresencePending) {
      state.screenPresencePending = false;
      scheduleStudentScreenPresence();
    }
  }
}

function scheduleStudentScreenPresence(immediate = false) {
  if (state.screenPresenceTimer) return;
  const streaming = state.screenWatchUntil > Date.now();
  state.screenPresenceTimer = setTimeout(() => {
    state.screenPresenceTimer = null;
    void publishStudentScreenPresence();
  }, immediate ? 0 : streaming ? 180 : 2500);
}

function observeStudentScreenChanges() {
  const observer = new MutationObserver(() => scheduleStudentScreenPresence());
  [$("#gameCanvas"), $("#stageTitle"), $("#attemptBadge"), $("#playerScore")].filter(Boolean).forEach(element => observer.observe(element, { childList: true, subtree: true, characterData: true, attributes: true }));
}

function subscribePresence() {
  state.presenceChannel?.unsubscribe();
  state.presenceReady = false;
  state.presenceTracked = false;
  state.presenceChannel = supabase.channel(`classroom-${state.session.id}`, { config: { presence: { key: state.player.id } } })
    .on("broadcast", { event: "screen-stream-control" }, message => {
      const control = message?.payload || message;
      if (control?.role !== "teacher" || control.player_id !== state.player.id) return;
      if (control.active === false) {
        state.screenWatchUntil = 0;
        clearInterval(state.screenWatchInterval);
        state.screenWatchInterval = null;
        setStudentBroadcasting(false);
        return;
      }
      // Streaming starts automatically. The student never sees an approval prompt.
      state.screenWatchUntil = Math.max(Date.now(), Number(control.expires_at) || 0);
      setStudentBroadcasting(true);
      clearTimeout(state.screenPresenceTimer);
      state.screenPresenceTimer = null;
      scheduleStudentScreenPresence(true);
      if (!state.screenWatchInterval) {
        state.screenWatchInterval = setInterval(() => {
          if (state.screenWatchUntil <= Date.now()) {
            clearInterval(state.screenWatchInterval);
            state.screenWatchInterval = null;
            setStudentBroadcasting(false);
            return;
          }
          void publishStudentScreenPresence();
        }, 300);
      }
    });
  state.presenceChannel.subscribe(status => {
    if (status === "SUBSCRIBED") {
      state.presenceReady = true;
      state.presenceOnlineAt = new Date().toISOString();
      scheduleStudentScreenPresence(true);
    }
  });
}

function setStudentBroadcasting(active) {
  $("#studentBroadcastBadge")?.classList.toggle("hidden", !active);
  document.body.classList.toggle("student-is-broadcasting", active);
}

function applySessionState() {
  const activity = ACTIVITIES.find(item => item.key === state.session.current_activity_key);
  const gameIsLive = state.session.status === "active" && Boolean(activity);
  document.body.classList.toggle("student-game-live", gameIsLive);
  if (gameIsLive) setGameFocus(true);
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
  const gameKey = state.renderedActivity || "game";
  $("#gameCanvas").innerHTML = `<div class="game-inner game-layout" data-game="${escapeHtml(gameKey)}"><header class="game-instruction"><div><small>เกมภาษาไทย</small><h2>${escapeHtml(title)}</h2></div><p>${escapeHtml(instruction)}</p></header><div class="game-play-area">${content}</div></div>`;
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

function buildRhythmCues(duration) {
  const scale = duration / RHYTHM_REFERENCE_DURATION;
  return RHYTHM_CUE_TEMPLATE.map(cue => ({
    word: cue.word,
    start: cue.start * scale,
    end: cue.end * scale,
  }));
}

function buildRhythmLyrics(duration) {
  const scale = duration / RHYTHM_REFERENCE_DURATION;
  return RHYTHM_LYRIC_TEMPLATE.map(line => ({
    text: line.text,
    start: line.start * scale,
    end: line.end * scale,
  }));
}

function buildRhythmTimeline(duration) {
  const scale = duration / RHYTHM_REFERENCE_DURATION;
  return Object.fromEntries(Object.entries(RHYTHM_PHASE_TEMPLATE).map(([key, time]) => [key, time * scale]));
}

function buildRhythmChallenges(duration) {
  const scale = duration / RHYTHM_REFERENCE_DURATION;
  return RHYTHM_CHALLENGE_TEMPLATE.map(challenge => ({
    ...challenge,
    start: challenge.start * scale,
    end: challenge.end * scale,
    options: shuffle(challenge.options),
  }));
}

function rhythmClock(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
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
  const breakTargetCount = RHYTHM_BREAK_CARDS.filter(card => card.target).length;
  const maxScore = (RHYTHM_PRACTICE_COUNT * 15) + (breakTargetCount * 10) + (RHYTHM_CHALLENGE_TEMPLATE.length * 20);
  gameShell(
    "เพลง มาตรา ก กา",
    "ร้องตาม แตะคำตามจังหวะ คัดคำช่วงดนตรี และเติมคำที่หายไป",
    `<section class="rhythm-karaoke">
      <div class="game-status-row rhythm-status-row">
        <div class="rhythm-scoreboard">
          <span class="mini-score">⭐ <strong id="rhythmScore">0</strong> / ${maxScore}</span>
          <span class="rhythm-streak" id="rhythmStreak">🔥 ต่อเนื่อง 0</span>
          <span class="rhythm-phase" id="rhythmPhase">เตรียมพร้อม</span>
        </div>
        <div class="rhythm-start-tools"><span id="rhythmAudioStatus">เกมจะเริ่มอัตโนมัติ…</span><button id="startRhythm" class="button button-primary" type="button" disabled>⏳ กำลังเริ่มพร้อมกัน</button></div>
      </div>
      <div class="rhythm-control-row">
        <label>ความเร็ว <select id="rhythmSpeed"><option value="0.8">0.8× ฝึกช้า</option><option value="1" selected>1× ปกติ</option></select></label>
        <div class="rhythm-timing-control" aria-label="ปรับเวลาเนื้อเพลง">
          <span>ปรับคำ</span><button id="rhythmTimingDown" type="button" title="ให้คำช้าลง">−0.5</button><output id="rhythmTimingLabel">ตรงเวลา</output><button id="rhythmTimingUp" type="button" title="ให้คำเร็วขึ้น">+0.5</button>
        </div>
        <span class="rhythm-clock" id="rhythmClock">00:00 / 01:52</span>
      </div>
      <div class="karaoke-stage" id="karaokeStage">
        <div class="grammar-sparkles" aria-hidden="true">${sparkles}</div>
        <div class="karaoke-now"><small>คำที่กำลังร้อง</small><strong id="karaokeCurrentWord">พร้อม!</strong><div class="karaoke-progress"><i id="karaokeProgressBar"></i></div></div>
        <div class="rhythm-interaction" id="rhythmInteraction"><div class="rhythm-guide-panel"><span>🎤</span><strong>คาราโอเกะเริ่มที่วินาที 22</strong><small>ครูกดเริ่มแล้ว เกมของทุกคนจะเดินพร้อมกันอัตโนมัติ</small></div></div>
        <p class="rhythm-feedback" id="rhythmFeedback" aria-live="polite">รอบแรกมีแสงช่วย รอบสองฟังแล้วเลือกเอง</p>
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
  const interaction = $("#rhythmInteraction");
  const stage = $("#karaokeStage");
  const scoreLabel = $("#rhythmScore");
  const streakLabel = $("#rhythmStreak");
  const phaseLabel = $("#rhythmPhase");
  const clockLabel = $("#rhythmClock");
  const speedSelect = $("#rhythmSpeed");
  const timingDown = $("#rhythmTimingDown");
  const timingUp = $("#rhythmTimingUp");
  const timingLabel = $("#rhythmTimingLabel");
  const run = {
    audio,
    audioContext: null,
    answers: [],
    practiceResults: new Map(),
    breakResults: new Map(),
    challengeResults: new Map(),
    breakCards: shuffle(RHYTHM_BREAK_CARDS),
    breakFinished: false,
    activeCueIndex: -2,
    activeChallengeIndex: -2,
    phase: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    frame: null,
    cancelled: false,
    finished: false,
    started: false,
    useFallback: false,
    duration: RHYTHM_REFERENCE_DURATION,
    startedAt: 0,
    fallbackBaseTime: 0,
    speed: 1,
    timingOffset: 0,
    cues: [],
    lyrics: [],
    timeline: {},
    challenges: [],
    lyricRenderKey: "",
  };
  state.rhythmRun = run;

  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      status.textContent = `เพลงพร้อม · ${Math.ceil(audio.duration)} วินาที`;
      clockLabel.textContent = `00:00 / ${rhythmClock(audio.duration)}`;
    }
  });
  audio.addEventListener("error", () => {
    status.textContent = "ไฟล์เพลงยังไม่มีข้อมูล · ใช้เสียงจังหวะสำรองได้";
    audio.classList.add("rhythm-audio-error");
  });

  function updateScoreboard() {
    scoreLabel.textContent = run.score;
    streakLabel.textContent = `🔥 ต่อเนื่อง ${run.streak}`;
    streakLabel.classList.toggle("hot", run.streak >= 3);
  }

  function reward(points, message, onBeat = false) {
    run.score += points;
    run.streak += 1;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    updateScoreboard();
    feedback.textContent = `${message}${onBeat ? " · ตรงจังหวะ! +5" : ""}`;
    stage.classList.remove("score-pop");
    requestAnimationFrame(() => stage.classList.add("score-pop"));
  }

  function resetStreak() {
    if (!run.streak) return;
    run.streak = 0;
    updateScoreboard();
  }

  function getPlaybackTime() {
    if (!run.useFallback) return audio.currentTime || 0;
    if (!run.started) return 0;
    return run.fallbackBaseTime + (((performance.now() - run.startedAt) / 1000) * run.speed);
  }

  function getGameTime() {
    return Math.min(run.duration, Math.max(0, getPlaybackTime() + run.timingOffset));
  }

  function phaseForTime(time) {
    if (time < run.timeline.introEnd) return "intro";
    if (time < run.timeline.practiceStart) return "sing-one";
    if (time < run.timeline.breakStart) return "practice";
    if (time < run.timeline.secondRoundStart) return "break";
    if (time < run.timeline.challengeStart) return "sing-two";
    if (time < run.timeline.lyricEnd) return "challenge";
    return "outro";
  }

  function phaseTitle(phase) {
    return ({
      intro: "เตรียมพร้อม",
      "sing-one": "ร้องตามรอบแรก",
      practice: "รอบฝึก · แตะตามแสง",
      break: "ช่วงดนตรี · คัดคำ",
      "sing-two": "ร้องตามรอบสอง",
      challenge: "รอบท้าทาย · เติมคำ",
      outro: "ร้องจบแล้ว",
    })[phase];
  }

  function emojiFor(word) {
    return RHYTHM_EMOJI[word] || "🔤";
  }

  function practiceCardsHtml() {
    return run.cues.slice(0, RHYTHM_PRACTICE_COUNT).map((cue, index) => {
      const result = run.practiceResults.get(index) || "";
      return `<button class="rhythm-picture-card ${result}" type="button" data-practice-index="${index}"><span>${emojiFor(cue.word)}</span><strong>${escapeHtml(cue.word)}</strong></button>`;
    }).join("");
  }

  function breakCardsHtml() {
    return run.breakCards.map(card => {
      const result = run.breakResults.get(card.word) || "";
      return `<button class="rhythm-picture-card rhythm-sort-card ${result}" type="button" data-break-word="${escapeHtml(card.word)}" ${result ? "disabled" : ""}><span>${emojiFor(card.word)}</span><strong>${escapeHtml(card.word)}</strong></button>`;
    }).join("");
  }

  function challengeHtml(index) {
    const challenge = run.challenges[index];
    if (!challenge) return `<div class="rhythm-guide-panel"><span>👂</span><strong>ฟังให้ดี คำถามกำลังมา</strong><small>เลือกคำที่หายไปจาก 3 ตัวเลือก</small></div>`;
    const result = run.challengeResults.get(index);
    return `<div class="rhythm-challenge-panel"><small>ฟังเสียงแล้วเติมคำที่หายไป</small><div class="rhythm-choice-grid">${challenge.options.map(option => {
      const stateClass = result ? (option === challenge.answer ? "correct" : option === result.chosen ? "wrong" : "") : "";
      return `<button type="button" class="rhythm-choice ${stateClass}" data-challenge-index="${index}" data-answer="${escapeHtml(option)}" ${result ? "disabled" : ""}><span>${emojiFor(option)}</span><strong>${escapeHtml(option)}</strong></button>`;
    }).join("")}</div></div>`;
  }

  function renderPhase(phase) {
    if (run.phase === phase) return;
    run.phase = phase;
    run.activeChallengeIndex = -2;
    stage.dataset.phase = phase;
    phaseLabel.textContent = phaseTitle(phase);
    if (phase === "intro") interaction.innerHTML = `<div class="rhythm-guide-panel"><span>🎤</span><strong>เตรียมร้องคาราโอเกะ<br>เพลง มาตรา ก กา</strong><small class="rhythm-credit-inline">คำร้อง: รศ.ปิตินันธ์ สุทธสาร</small><small>เนื้อเพลงเริ่มที่วินาที 22</small></div>`;
    if (phase === "sing-one") interaction.innerHTML = `<div class="rhythm-guide-panel"><span>🎶</span><strong>ร้องตามให้เต็มเสียง</strong><small>อีกสักครู่การ์ดคำจะปรากฏ</small></div>`;
    if (phase === "practice") interaction.innerHTML = `<div class="rhythm-mode-heading"><strong>รอบฝึก</strong><span>แตะการ์ดที่เปล่งแสง · ตรงจังหวะได้โบนัส</span></div><div class="rhythm-picture-grid">${practiceCardsHtml()}</div>`;
    if (phase === "break") interaction.innerHTML = `<div class="rhythm-mode-heading"><strong>ช่วงดนตรี</strong><span>แตะเฉพาะคำแม่ ก กาให้ครบ 4 คำ</span></div><div class="rhythm-picture-grid rhythm-sort-grid">${breakCardsHtml()}</div>`;
    if (phase === "sing-two") interaction.innerHTML = `<div class="rhythm-guide-panel"><span>🎧</span><strong>รอบสองกำลังเริ่ม</strong><small>ครั้งนี้ต้องฟังแล้วเลือกคำเอง</small></div>`;
    if (phase === "challenge") interaction.innerHTML = challengeHtml(-1);
    if (phase === "outro") interaction.innerHTML = `<div class="rhythm-guide-panel"><span>🌟</span><strong>ยอดเยี่ยม! ร้องจบแล้ว</strong><small>รอฟังดนตรีท้ายเพลงและสรุปคะแนน</small></div>`;
  }

  function settlePractice(time, force = false) {
    const grace = .7 * (run.duration / RHYTHM_REFERENCE_DURATION);
    run.cues.slice(0, RHYTHM_PRACTICE_COUNT).forEach((cue, index) => {
      if (run.practiceResults.has(index) || (!force && time <= cue.end + grace)) return;
      run.practiceResults.set(index, "missed");
      run.answers.push({ mode: "practice", word: cue.word, tapped: false, correct: false, points: 0 });
      interaction.querySelector(`[data-practice-index="${index}"]`)?.classList.add("missed");
      resetStreak();
    });
  }

  function finishBreak(force = false) {
    if (run.breakFinished || (!force && getGameTime() < run.timeline.secondRoundStart)) return;
    run.breakFinished = true;
    RHYTHM_BREAK_CARDS.filter(card => card.target && !run.breakResults.has(card.word)).forEach(card => {
      run.breakResults.set(card.word, "missed");
      run.answers.push({ mode: "break", word: card.word, tapped: false, correct: false, points: 0 });
    });
  }

  function settleChallenges(time, force = false) {
    run.challenges.forEach((challenge, index) => {
      if (run.challengeResults.has(index) || (!force && time < challenge.end)) return;
      run.challengeResults.set(index, { chosen: "", correct: false });
      run.answers.push({ mode: "challenge", prompt: challenge.prompt, chosen: "", correct: false, points: 0 });
      resetStreak();
    });
  }

  function updateCue(cueIndex) {
    if (run.activeCueIndex === cueIndex) return;
    run.activeCueIndex = cueIndex;
    if (cueIndex >= 0 && run.useFallback) {
      playFallbackBeat(run, cueIndex);
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      speakThai(RHYTHM_WORDS[cueIndex]);
    }
  }

  function updatePracticeGlow(cueIndex) {
    if (run.phase !== "practice") return;
    interaction.querySelectorAll("[data-practice-index]").forEach(card => card.classList.remove("singing"));
    if (cueIndex >= 0 && cueIndex < RHYTHM_PRACTICE_COUNT && !run.practiceResults.has(cueIndex)) {
      interaction.querySelector(`[data-practice-index="${cueIndex}"]`)?.classList.add("singing");
    }
  }

  function updateChallenge(index) {
    if (run.phase !== "challenge" || run.activeChallengeIndex === index) return;
    run.activeChallengeIndex = index;
    interaction.innerHTML = challengeHtml(index);
  }

  function renderLyric(time, cueIndex, challengeIndex) {
    if (run.phase === "challenge" && challengeIndex >= 0) {
      const challenge = run.challenges[challengeIndex];
      const key = `challenge-${challengeIndex}`;
      if (run.lyricRenderKey === key) return;
      run.lyricRenderKey = key;
      currentWord.classList.add("lyric-line");
      currentWord.innerHTML = challenge.prompt.split(" ").map(word => word === "___" ? "<mark>___</mark>" : escapeHtml(word)).join(" ");
      return;
    }
    const lyricIndex = run.lyrics.findIndex(line => time >= line.start && time < line.end);
    const introCount = run.phase === "intro" ? Math.max(0, Math.ceil(run.timeline.introEnd - time)) : -1;
    const key = `${run.phase}-${lyricIndex}-${cueIndex}-${introCount}`;
    if (run.lyricRenderKey === key) return;
    run.lyricRenderKey = key;
    currentWord.classList.toggle("lyric-line", lyricIndex >= 0);
    if (lyricIndex < 0) {
      if (run.phase === "intro") currentWord.textContent = introCount > 0 ? `เริ่มร้องใน ${introCount}` : "เตรียมร้อง…";
      else if (run.phase === "break") currentWord.textContent = "ดนตรี · เลือกคำแม่ ก กา!";
      else if (run.phase === "outro") currentWord.textContent = "จบคำร้องแล้ว 🌟";
      else currentWord.textContent = "ดนตรี…";
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
    settlePractice(run.duration, true);
    finishBreak(true);
    settleChallenges(run.duration, true);
    run.finished = true;
    audio.pause();
    startButton.textContent = "กำลังสรุปคะแนน…";
    run.answers.push({ mode: "summary", bestStreak: run.bestStreak, timingOffset: run.timingOffset, speed: run.speed });
    const result = await submitAttempt("rhythm", run.score, maxScore, run.answers);
    if (run.cancelled || state.renderedActivity !== "rhythm") return;
    if (result) showResult("จบเพลงแล้ว!", run.score, maxScore, result, renderRhythm);
    else renderRhythm();
  }

  function tick() {
    if (run.cancelled || run.finished || state.renderedActivity !== "rhythm") return;
    const playbackTime = getPlaybackTime();
    const time = getGameTime();
    const phase = phaseForTime(time);
    settlePractice(time);
    finishBreak();
    settleChallenges(time);
    renderPhase(phase);
    const cueIndex = run.cues.findIndex(cue => time >= cue.start && time < cue.end);
    const challengeIndex = run.challenges.findIndex(challenge => time >= challenge.start && time < challenge.end);
    updateCue(cueIndex);
    updatePracticeGlow(cueIndex);
    updateChallenge(challengeIndex);
    renderLyric(time, cueIndex, challengeIndex);
    progressBar.style.width = `${Math.min(100, Math.max(0, (playbackTime / run.duration) * 100))}%`;
    clockLabel.textContent = `${rhythmClock(playbackTime)} / ${rhythmClock(run.duration)}`;
    if (playbackTime >= run.duration || (!run.useFallback && audio.ended)) return finishRhythm();
    run.frame = requestAnimationFrame(tick);
  }

  interaction.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || !run.started) return;
    if (button.dataset.practiceIndex !== undefined) {
      const index = Number(button.dataset.practiceIndex);
      if (run.practiceResults.has(index)) return;
      const cue = run.cues[index];
      const time = getGameTime();
      const scale = run.duration / RHYTHM_REFERENCE_DURATION;
      if (time < cue.start - (.45 * scale) || time > cue.end + (.7 * scale)) {
        feedback.textContent = `รอให้ “${cue.word}” เปล่งแสงก่อนนะ`;
        return;
      }
      const onBeat = Math.abs(time - ((cue.start + cue.end) / 2)) <= (.34 * scale);
      const points = onBeat ? 15 : 10;
      run.practiceResults.set(index, "correct");
      run.answers.push({ mode: "practice", word: cue.word, tapped: true, correct: true, onBeat, points });
      button.classList.remove("singing");
      button.classList.add("correct");
      reward(points, `เก่งมาก! “${cue.word}”`, onBeat);
      return;
    }
    if (button.dataset.breakWord !== undefined) {
      const word = button.dataset.breakWord;
      if (run.breakResults.has(word)) return;
      const card = RHYTHM_BREAK_CARDS.find(item => item.word === word);
      const correct = Boolean(card?.target);
      run.breakResults.set(word, correct ? "correct" : "wrong");
      run.answers.push({ mode: "break", word, tapped: true, correct, points: correct ? 10 : 0 });
      button.classList.add(correct ? "correct" : "wrong");
      button.disabled = true;
      if (correct) reward(10, `ถูกต้อง “${word}” เป็นคำแม่ ก กา`);
      else {
        resetStreak();
        feedback.textContent = `“${word}” มีตัวสะกด ลองเลือกคำอื่นนะ`;
      }
      return;
    }
    if (button.dataset.challengeIndex !== undefined) {
      const index = Number(button.dataset.challengeIndex);
      if (run.challengeResults.has(index)) return;
      const challenge = run.challenges[index];
      const chosen = button.dataset.answer;
      const correct = chosen === challenge.answer;
      const scale = run.duration / RHYTHM_REFERENCE_DURATION;
      const onBeat = correct && (getGameTime() - challenge.start <= (1 * scale));
      const points = correct ? (onBeat ? 20 : 15) : 0;
      run.challengeResults.set(index, { chosen, correct });
      run.answers.push({ mode: "challenge", prompt: challenge.prompt, chosen, correct, onBeat, points });
      interaction.querySelectorAll("[data-challenge-index]").forEach(choice => {
        choice.disabled = true;
        if (choice.dataset.answer === challenge.answer) choice.classList.add("correct");
        else if (choice === button) choice.classList.add("wrong");
      });
      if (correct) reward(points, `ถูกต้อง! คำที่หายไปคือ “${challenge.answer}”`, onBeat);
      else {
        resetStreak();
        feedback.textContent = `คำตอบคือ “${challenge.answer}” ฟังคำต่อไปนะ`;
      }
    }
  });

  function setSpeed(value) {
    const nextSpeed = Number(value) || 1;
    if (run.useFallback && run.started) {
      run.fallbackBaseTime = getPlaybackTime();
      run.startedAt = performance.now();
    }
    run.speed = nextSpeed;
    audio.playbackRate = nextSpeed;
    status.textContent = nextSpeed < 1 ? "กำลังเล่นแบบฝึกช้า 0.8×" : "กำลังเล่นความเร็วปกติ";
  }

  speedSelect.addEventListener("change", () => setSpeed(speedSelect.value));
  [timingDown, timingUp].forEach((button, direction) => button.addEventListener("click", () => {
    run.timingOffset = Math.max(-2, Math.min(2, run.timingOffset + (direction ? .5 : -.5)));
    timingLabel.textContent = run.timingOffset === 0 ? "ตรงเวลา" : run.timingOffset > 0 ? `คำเร็ว +${run.timingOffset.toFixed(1)} วิ` : `คำช้า ${Math.abs(run.timingOffset).toFixed(1)} วิ`;
    run.lyricRenderKey = "";
  }));

  async function startRhythmAutomatically() {
    if (run.started) return;
    run.started = true;
    startButton.disabled = true;
    startButton.textContent = "♫ เกมเริ่มแล้ว";
    currentWord.textContent = "เตรียมฟัง…";
    let audioStarted = false;
    try {
      audio.currentTime = 0;
      await audio.play();
      audioStarted = true;
    } catch {
      run.useFallback = true;
      status.textContent = "เกมกำลังเดินด้วยจังหวะสำรอง";
    }
    const validAudio = audioStarted && Number.isFinite(audio.duration) && audio.duration > 5;
    if (!validAudio) {
      run.useFallback = true;
      audio.pause();
      status.textContent = "กำลังใช้เสียงคำและจังหวะสำรอง";
    }
    run.duration = validAudio ? audio.duration : 60;
    run.cues = buildRhythmCues(run.duration);
    run.lyrics = buildRhythmLyrics(run.duration);
    run.timeline = buildRhythmTimeline(run.duration);
    run.challenges = buildRhythmChallenges(run.duration);
    run.fallbackBaseTime = 0;
    run.startedAt = performance.now();
    setSpeed(speedSelect.value);
    updateScoreboard();
    tick();
  }

  // The teacher's Realtime Broadcast renders this activity on every student
  // device. Start immediately after rendering; no per-student start click.
  queueMicrotask(() => void startRhythmAutomatically());
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
  const questions = shuffle([
    ...shuffle(WHEEL_WORDS.none).slice(0, 5).map(word => ({ word, answer: "none" })),
    ...shuffle(WHEEL_WORDS.has).slice(0, 5).map(word => ({ word, answer: "has" })),
  ]);
  let index = 0;
  let score = 0;
  let streak = 0;
  const answers = [];

  const renderQuestion = () => {
    const question = questions[index];
    const sparkles = Array.from({ length: 18 }, (_, item) => `<i style="--x:${(item * 47) % 97}%;--y:${(item * 31) % 91}%;--delay:${(item % 6) * -.32}s">✦</i>`).join("");
    gameShell("วงล้อคำมหัศจรรย์", "หมุนแล้วสังเกตคำให้ดี คำนี้มีตัวสะกดหรือไม่", `
      <section class="premium-wheel-game">
        <div class="wheel-sparkles" aria-hidden="true">${sparkles}</div>
        <div class="wheel-hud"><span>ด่าน <b>${index + 1}</b> / ${questions.length}</span><span>⭐ ${score}</span><span>🔥 ${streak}</span></div>
        <div class="wheel-machine">
          <div class="wheel-pointer" aria-hidden="true">▼</div>
          <div class="premium-wheel-disc" style="--wheel-turn:${720 + Math.round(Math.random() * 360)}deg" aria-hidden="true">
            <span>🌟</span><span>🎈</span><span>🦋</span><span>🍭</span><span>🚀</span><span>🌈</span><span>🐘</span><span>🎁</span>
          </div>
          <div class="wheel-word"><small>คำที่ได้</small><strong id="wheelWord" aria-live="polite">กำลังสุ่ม...</strong><button id="wheelSpeak" type="button" aria-label="ฟังเสียงคำว่า ${escapeHtml(question.word)}">🔊 ฟังคำ</button></div>
        </div>
        <p id="wheelFeedback" class="wheel-feedback">วงล้อกำลังเลือกคำ...</p>
        <div id="wheelChoices" class="wheel-answer-grid">
          <button type="button" data-value="none" disabled><span>☀️</span><strong>ไม่มีตัวสะกด</strong><small>แม่ ก กา</small></button>
          <button type="button" data-value="has" disabled><span>🔤</span><strong>มีตัวสะกด</strong><small>มีเสียงพยัญชนะท้าย</small></button>
        </div>
      </section>
    `);
    const disc = $(".premium-wheel-disc");
    const wordLabel = $("#wheelWord");
    const choiceButtons = [...$("#wheelChoices").children];
    const previewWords = shuffle([...new Set([...WHEEL_WORDS.none, ...WHEEL_WORDS.has])]);
    let spinStep = 0;
    const spinStartedAt = performance.now();
    $("#wheelSpeak").addEventListener("click", () => speakThai(question.word));
    const finishSpin = () => {
      if (state.renderedActivity !== "wheel") return;
      wordLabel.textContent = question.word;
      wordLabel.classList.remove("wheel-word-shuffling");
      choiceButtons.forEach(button => { button.disabled = false; });
      $("#wheelFeedback").textContent = "เลือกคำตอบได้เลย!";
      speakThai(question.word);
    };
    const spinTick = () => {
      if (state.renderedActivity !== "wheel") return;
      const elapsed = performance.now() - spinStartedAt;
      if (elapsed >= WHEEL_SPIN_DURATION) {
        finishSpin();
        return;
      }
      wordLabel.textContent = previewWords[spinStep % previewWords.length];
      wordLabel.classList.remove("wheel-word-shuffling");
      void wordLabel.offsetWidth;
      wordLabel.classList.add("wheel-word-shuffling");
      playWheelTick(spinStep);
      spinStep += 1;
      const progress = elapsed / WHEEL_SPIN_DURATION;
      window.setTimeout(spinTick, 65 + Math.round(progress * 220));
    };
    requestAnimationFrame(() => {
      disc.classList.add("is-spinning");
      spinTick();
    });
    choiceButtons.forEach(button => button.addEventListener("click", () => {
      const chosen = button.dataset.value;
      const correct = chosen === question.answer;
      if (correct) { score += 1; streak += 1; } else streak = 0;
      answers.push({ prompt: question.word, chosen, correct });
      choiceButtons.forEach(item => {
        item.disabled = true;
        if (item.dataset.value === question.answer) item.classList.add("correct");
      });
      if (!correct) button.classList.add("wrong");
      $("#wheelFeedback").textContent = correct ? "ยอดเยี่ยม! ตอบถูกแล้ว ⭐" : `คำตอบคือ ${question.answer === "none" ? "ไม่มีตัวสะกด" : "มีตัวสะกด"} ลองจำไว้นะ`;
      $(".premium-wheel-game").classList.add(correct ? "answer-correct" : "answer-wrong");
      setTimeout(async () => {
        if (state.renderedActivity !== "wheel") return;
        index += 1;
        if (index < questions.length) renderQuestion();
        else {
          const result = await submitAttempt("wheel", score, questions.length, answers);
          if (result) showResult("พิชิตวงล้อคำมหัศจรรย์", score, questions.length, result, renderWheel);
        }
      }, 1050);
    }));
  };
  renderQuestion();
}

function speakThai(word) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "th-TH";
  utterance.rate = .78;
  speechSynthesis.speak(utterance);
}

let wheelAudioContext;
function playWheelTick(step) {
  if (step % 2) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    wheelAudioContext ||= new AudioContextClass();
    if (wheelAudioContext.state === "suspended") wheelAudioContext.resume().catch(() => {});
    const oscillator = wheelAudioContext.createOscillator();
    const gain = wheelAudioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 260 + (step % 6) * 45;
    gain.gain.setValueAtTime(.0001, wheelAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.045, wheelAudioContext.currentTime + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, wheelAudioContext.currentTime + .065);
    oscillator.connect(gain).connect(wheelAudioContext.destination);
    oscillator.start();
    oscillator.stop(wheelAudioContext.currentTime + .07);
  } catch {
    // Audio is optional; the visual spin continues on restricted devices.
  }
}

function renderSound() {
  const questions = shuffle([
    ...shuffle([...MAE_KO_KA]).slice(0, 6).map(word => ({ word, answer: "yes" })),
    ...shuffle([...HAS_FINAL_WORDS]).slice(0, 6).map(word => ({ word, answer: "no" })),
  ]);
  runQuestionGame({
    key: "sound", title: "นักสืบเสียงท้ายคำ", instruction: "กดฟังเสียง แล้วตอบว่าเป็นคำแม่ ก กา หรือไม่",
    questions,
    renderPrompt(question, container) { container.innerHTML = `<div style="text-align:center;margin:15px 0 30px"><button class="sound-button" id="speakWord" aria-label="ฟังคำ">🔊</button></div>`; $("#speakWord").addEventListener("click", () => speakThai(question.word)); setTimeout(() => speakThai(question.word), 300); },
    choices: () => [{ value: "yes", label: "ใช่ แม่ ก กา" }, { value: "no", label: "ไม่ใช่" }],
    replay: renderSound,
  });
}

function renderSort() {
  const words = shuffle([
    ...shuffle([...MAE_KO_KA]).slice(0, 6),
    ...shuffle([...HAS_FINAL_WORDS]).slice(0, 6),
  ]);
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
  const coreSentences = [
    { words: ["ตา", "ดู", "ปู", "นา"], answer: "ตาดูปูนา" },
    { words: ["แม่", "พา", "ปู", "นา"], answer: "แม่พาปูนา" },
    { words: ["พ่อ", "ดู", "ปลา"], answer: "พ่อดูปลา" },
  ];
  const sentences = [...coreSentences, ...shuffle(TEXTBOOK_VOCABULARY.sentences).slice(0, 5)];
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
  const wordBank = [...new Set([
    "ตา", "ยาย", "พ่อ", "แม่", "ดู", "พา", "ปู", "ปลา", "นา", "มา", "หา", "เสือ",
    ...TEXTBOOK_VOCABULARY.none.slice(0, 8),
    ...TEXTBOOK_VOCABULARY.has.slice(0, 10),
  ])];
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
    { prompt: "ประโยคจากบทเรียนข้อใดเรียงถูกต้อง", answer: "แม่ไก่ออกไข่", options: ["ไข่แม่ไก่ออก", "แม่ไก่ออกไข่", "ไก่แม่ไข่ออก", "ออกไข่แม่ไก่"] },
    { prompt: "คำใดมีตัวสะกด", answer: "ยิ้ม", options: ["ยิ้ม", "โบ", "กะทิ", "ก้าว"] },
  ];
  runQuestionGame({
    key: "exit", title: "ไขกุญแจหีบสมบัติ", instruction: "ตอบให้ถูกอย่างน้อย 3 ใน 5 ข้อ เพื่อเปิดหีบสมบัติ",
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
  clearTimeout(state.screenPresenceTimer);
  clearInterval(state.screenWatchInterval);
  setStudentBroadcasting(false);
  document.body.classList.remove("student-game-live");
  stopCamera();
  Object.assign(state, {
    joinStep: "code", joinBusy: false,
    roomCode: "", roster: [], sessionInfo: null, student: null,
    selfieBlob: null, selfieDataUrl: "", selfiePath: "",
    player: null, session: null, playerChannel: null, sessionChannel: null,
    presenceChannel: null, renderedActivity: null, attempts: [], gameZoomIndex: 2, rhythmRun: null,
    presenceReady: false, presenceTracked: false, screenPresenceTimer: null, screenPresencePublishing: false,
    screenPresencePending: false, presenceOnlineAt: null, lastGameStateEventId: null,
    screenWatchUntil: 0, screenWatchInterval: null,
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleStudentScreenPresence(true); });

async function initializeStudentPage() {
  connectionUpdate();
  applyGameZoom();
  setGameFocus(true);
  observeStudentScreenChanges();
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
