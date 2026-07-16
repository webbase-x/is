import { APP_CONFIG } from "./config.js";
import { supabase, ensureAnonymousAuth } from "./supabase.js";
import {
  $, ACTIVITIES, escapeHtml, hide, modeLabel, randomAvatar, roomCodeFromUrl,
  setView, show, shuffle, toast, updateConnectionBadge,
} from "./common.js";

const MAE_KO_KA = new Set(["กา", "ปลา", "เต่า", "มือ", "ตา", "ปู", "เสือ", "แมว", "หมู", "นา", "ใบไม้", "ขา", "ผีเสื้อ", "ดู", "พ่อ", "แม่"]);
const COMPARE_WORDS = new Set(["กบ", "นก", "เด็ก", "จาน", "ถ้วย", "เก้าอี้", "บ้าน", "ดิน"]);

const state = {
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
};

const views = {
  login: $("#loginView"),
  waiting: $("#waitingView"),
  game: $("#gameView"),
};

function connectionUpdate() {
  updateConnectionBadge($("#connectionStatus"), navigator.onLine, navigator.onLine ? "เชื่อมต่อแล้ว" : "ไม่มีอินเทอร์เน็ต");
}

function normalizeRoomCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

async function findRoom() {
  const button = $("#findRoomButton");
  const code = normalizeRoomCode($("#roomCode").value);
  $("#roomCode").value = code;
  if (code.length !== 6) return toast("กรุณากรอกรหัสห้องให้ครบ 6 ตัว", "warning");

  button.disabled = true;
  button.textContent = "กำลังค้นหา...";
  try {
    await ensureAnonymousAuth();
    const { data, error } = await supabase.rpc("get_open_session_roster", { p_room_code: code });
    if (error) throw error;
    if (!data?.length) throw new Error("ไม่พบห้องเรียน หรือครูยังไม่เปิดรับนักเรียน");

    state.roomCode = code;
    state.roster = data;
    state.sessionInfo = data[0];
    $("#roomFound").textContent = `พบห้อง ${data[0].class_label} · แผนที่ ${data[0].plan_id}`;
    $("#schoolSelect").innerHTML = `<option>${escapeHtml(data[0].school_name)}</option>`;
    $("#studentSelect").innerHTML = `<option value="">เลือกชื่อของฉัน</option>${data.map(student => `
      <option value="${student.student_id}">${escapeHtml(student.student_code)} · ${escapeHtml(student.full_name)} (${escapeHtml(student.nickname)})</option>
    `).join("")}`;
    show($("#rosterFields"));
    show($("#cameraFields"));
    toast("พบห้องเรียนแล้ว เลือกชื่อและถ่ายรูปได้เลย", "success");
  } catch (error) {
    toast(error.message || "ค้นหาห้องเรียนไม่สำเร็จ", "error");
  } finally {
    button.disabled = false;
    button.textContent = "ค้นหาห้องเรียน";
  }
}

async function openCamera() {
  const video = $("#cameraVideo");
  const unsupportedMessage = "เบราว์เซอร์นี้ไม่รองรับกล้องสด กรุณากด ‘ถ่าย/เลือกรูปแทน’";

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    $("#cameraHelp").textContent = unsupportedMessage;
    return toast(unsupportedMessage, "warning");
  }

  try {
    stopCamera();
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = state.stream;
    await video.play();
    state.selfieBlob = null;
    state.selfieDataUrl = "";
    updateJoinAvailability();
    show(video);
    hide($("#cameraPlaceholder"));
    hide($("#selfiePreview"));
    hide($("#openCameraButton"));
    show($("#captureButton"));
    hide($("#retakeButton"));
    $("#cameraHelp").textContent = "กล้องพร้อมแล้ว มองหน้าจอและกดถ่ายรูป";
  } catch (error) {
    stopCamera();
    hide(video);
    show($("#cameraPlaceholder"));
    show($("#openCameraButton"));
    hide($("#captureButton"));
    const messages = {
      NotAllowedError: "ยังไม่ได้อนุญาตใช้กล้อง กรุณาเปิดสิทธิ์กล้อง หรือกด ‘ถ่าย/เลือกรูปแทน’",
      NotFoundError: "ไม่พบกล้องในเครื่องนี้ กรุณากด ‘ถ่าย/เลือกรูปแทน’",
      NotReadableError: "กล้องกำลังถูกแอปอื่นใช้งาน กรุณาปิดแอปนั้น หรือกด ‘ถ่าย/เลือกรูปแทน’",
      OverconstrainedError: "กล้องไม่รองรับการตั้งค่านี้ กรุณากด ‘ถ่าย/เลือกรูปแทน’",
    };
    const message = messages[error?.name] || "เปิดกล้องสดไม่ได้ กรุณากด ‘ถ่าย/เลือกรูปแทน’";
    $("#cameraHelp").textContent = message;
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

async function useCanvasSelfie(canvas) {
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error("สร้างรูปไม่สำเร็จ");
  state.selfieBlob = blob;
  state.selfieDataUrl = canvas.toDataURL("image/jpeg", APP_CONFIG.selfieQuality);
  $("#selfiePreview").src = state.selfieDataUrl;
  show($("#selfiePreview"));
  hide($("#cameraVideo"));
  hide($("#cameraPlaceholder"));
  hide($("#captureButton"));
  hide($("#openCameraButton"));
  show($("#retakeButton"));
  $("#cameraHelp").textContent = "ได้รูปแล้ว หากยังไม่พอใจสามารถกดถ่ายใหม่ได้";
  stopCamera();
  updateJoinAvailability();
}

async function captureSelfie() {
  const video = $("#cameraVideo");
  const canvas = $("#cameraCanvas");
  if (!video.videoWidth) return toast("กล้องยังไม่พร้อม กรุณารอสักครู่", "warning");

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
    await useCanvasSelfie(canvas);
  } catch {
    toast("บันทึกรูปไม่สำเร็จ กรุณาถ่ายใหม่", "error");
  }
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    };
    image.src = objectUrl;
  });
}

async function usePhotoFile(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    input.value = "";
    return toast("กรุณาเลือกไฟล์รูปภาพ", "warning");
  }

  try {
    stopCamera();
    const image = await loadImageFile(file);
    const canvas = $("#cameraCanvas");
    const ratio = Math.min(1, APP_CONFIG.selfieMaxWidth / image.naturalWidth);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    await useCanvasSelfie(canvas);
    toast("รับรูปเรียบร้อยแล้ว", "success");
  } catch {
    toast("อ่านรูปไม่สำเร็จ กรุณาถ่ายหรือเลือกรูปใหม่", "error");
  } finally {
    input.value = "";
  }
}

function updateJoinAvailability() {
  const studentId = $("#studentSelect").value;
  $("#joinButton").disabled = !(studentId && state.selfieBlob);
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

async function submitJoin(event) {
  event.preventDefault();
  const button = $("#joinButton");
  const studentId = $("#studentSelect").value;
  if (!studentId || !state.selfieBlob) return;
  state.student = state.roster.find(item => item.student_id === studentId);
  if (!state.student) return toast("กรุณาเลือกชื่อใหม่", "error");

  button.disabled = true;
  button.textContent = "กำลังส่งให้ครู...";
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
      selfieDataUrl: state.selfieDataUrl,
    }));
    showWaiting();
    subscribeToPlayer();
  } catch (error) {
    if (state.selfiePath) await supabase.storage.from(APP_CONFIG.selfieBucket).remove([state.selfiePath]);
    state.selfiePath = "";
    toast(error.message || "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่", "error");
  } finally {
    button.disabled = false;
    button.textContent = "ส่งให้ครูตรวจสอบ";
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

  if (state.session.status === "closed") return resetJoin("คาบเรียนจบแล้ว ขอบคุณที่ร่วมผจญภัย!");
  if (state.session.status !== "active" || !activity) {
    state.renderedActivity = null;
    $("#gameCanvas").innerHTML = `<div class="empty-stage"><span>${state.session.status === "paused" ? "⏸️" : "🗺️"}</span><h2>${state.session.status === "paused" ? "พักเกมสักครู่" : "เตรียมพร้อม!"}</h2><p>เมื่อครูเปิดภารกิจ เกมจะปรากฏตรงนี้</p></div>`;
    return;
  }
  if (state.renderedActivity === activity.key) return;
  state.renderedActivity = activity.key;
  renderActivity(activity.key);
}

function renderActivity(key) {
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
  const percent = result?.percent ?? Math.round((score / maxScore) * 100);
  $("#gameCanvas").innerHTML = `<div class="game-inner"><div class="result-card"><div class="result-stars">${percent >= 80 ? "★★★" : percent >= 50 ? "★★☆" : "★☆☆"}</div><h2>${escapeHtml(title)}</h2><p>ได้ <strong>${score} / ${maxScore}</strong> คะแนน (${percent}%)</p><p>${result?.passed ? "ผ่านด่านแล้ว เก่งมาก!" : "ลองทบทวนแล้วพยายามใหม่นะ"}</p><button id="replayButton" class="button button-primary">เล่นอีกครั้ง</button></div></div>`;
  $("#replayButton")?.addEventListener("click", replay);
}

function renderRhythm() {
  gameShell("แท็ปจังหวะ แม่ ก กา", "แตะเฉพาะคำที่ไม่มีตัวสะกด เมื่อพร้อมแล้วกดเริ่ม", `<div class="game-status-row"><span class="mini-score" id="rhythmScore">คะแนน 0</span><button id="startRhythm" class="button button-primary">เริ่มเกม</button></div><div class="word-rain-stage" id="wordRain"><div class="empty-stage" style="min-height:350px;color:white"><span>🎵</span><p style="color:#dbe0f2">คำจะร่วงลงมาจากด้านบน</p></div></div>`);
  $("#startRhythm").addEventListener("click", () => {
    $("#startRhythm").disabled = true;
    const words = shuffle(["กา", "กบ", "ปลา", "นก", "เต่า", "มือ", "เด็ก", "ปู", "จาน", "เสือ", "นา", "ถ้วย"]);
    const maxScore = words.filter(word => MAE_KO_KA.has(word)).length;
    const answers = [];
    let score = 0;
    let completed = 0;
    $("#wordRain").innerHTML = "";
    words.forEach((word, index) => {
      setTimeout(() => {
        if (state.renderedActivity !== "rhythm") return;
        const button = document.createElement("button");
        button.className = "falling-word";
        button.textContent = word;
        button.style.left = `${5 + Math.random() * 78}%`;
        button.style.animationDuration = `${4.4 + Math.random() * 1.2}s`;
        let tapped = false;
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          completed += 1;
          if (completed === words.length) finish();
        };
        button.addEventListener("click", () => {
          if (tapped) return;
          tapped = true;
          const correct = MAE_KO_KA.has(word);
          if (correct) score += 1;
          answers.push({ word, tapped: true, correct });
          button.classList.add(correct ? "correct" : "wrong");
          button.remove();
          $("#rhythmScore").textContent = `คะแนน ${score}`;
          settle();
        });
        button.addEventListener("animationend", () => {
          if (!tapped) answers.push({ word, tapped: false, correct: !MAE_KO_KA.has(word) });
          button.remove();
          settle();
        }, { once: true });
        $("#wordRain").append(button);
      }, index * 720);
    });
    async function finish() {
      const result = await submitAttempt("rhythm", score, maxScore, answers);
      if (result) showResult("จบเพลงแล้ว!", score, maxScore, result, renderRhythm);
    }
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
  hide($("#selfiePreview"));
  hide($("#cameraVideo"));
  hide($("#captureButton"));
  show($("#cameraPlaceholder"));
  show($("#openCameraButton"));
  hide($("#retakeButton"));
  $("#cameraFileInput").value = "";
  $("#cameraHelp").textContent = "หากกล้องสดเปิดไม่ได้ สามารถกด ‘ถ่าย/เลือกรูปแทน’ ได้";
  $("#joinButton").disabled = true;
  setView(views.login, views.waiting, views.game);
}

function resetJoin(message) {
  toast(message, "default");
  sessionStorage.removeItem("thaiGameJoin");
  state.playerChannel?.unsubscribe();
  state.sessionChannel?.unsubscribe();
  state.presenceChannel?.unsubscribe();
  Object.assign(state, { player: null, session: null, renderedActivity: null, attempts: [] });
  retryJoin();
}

async function restoreSession() {
  const savedText = sessionStorage.getItem("thaiGameJoin");
  if (!savedText) return;
  try {
    const saved = JSON.parse(savedText);
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return;
    const { data: player } = await supabase.from("session_players").select("*").eq("id", saved.playerId).maybeSingle();
    if (!player) return;
    const { data: roster } = await supabase.rpc("get_open_session_roster", { p_room_code: saved.roomCode });
    state.roomCode = saved.roomCode;
    state.player = player;
    state.roster = roster || [];
    state.sessionInfo = state.roster[0] || null;
    state.student = state.roster.find(item => item.student_id === player.student_id) || saved.student;
    state.selfieDataUrl = saved.selfieDataUrl || "";
    subscribeToPlayer();
  } catch {
    sessionStorage.removeItem("thaiGameJoin");
  }
}

$("#roomCode").value = roomCodeFromUrl();
$("#findRoomButton").addEventListener("click", findRoom);
$("#roomCode").addEventListener("input", event => { event.target.value = normalizeRoomCode(event.target.value); });
$("#studentSelect").addEventListener("change", updateJoinAvailability);
$("#openCameraButton").addEventListener("click", openCamera);
$("#captureButton").addEventListener("click", captureSelfie);
$("#retakeButton").addEventListener("click", openCamera);
$("#photoFallbackButton").addEventListener("click", () => $("#cameraFileInput").click());
$("#cameraFileInput").addEventListener("change", usePhotoFile);
$("#joinForm").addEventListener("submit", submitJoin);
$("#retryJoinButton").addEventListener("click", retryJoin);
window.addEventListener("online", connectionUpdate);
window.addEventListener("offline", connectionUpdate);
window.addEventListener("beforeunload", stopCamera);
connectionUpdate();
restoreSession();
