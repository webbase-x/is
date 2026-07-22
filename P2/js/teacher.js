import { APP_CONFIG } from "./config.js";
import { supabase } from "./supabase.js";
import {
  $, $$, ACTIVITIES, downloadCsv, escapeHtml, hide, modeLabel, playerStatusLabel,
  GAME_STATE_EVENT, gameStateChannelName, gameStatePayload, randomAvatar,
  renderPlanTimeline, sanitizeGameMarkup, show, toast, updateConnectionBadge,
} from "./common.js?v=20260722-play-modes-1";

const state = {
  user: null,
  profile: null,
  classes: [],
  plans: [],
  session: null,
  players: [],
  attempts: [],
  leaderboard: [],
  sessionChannel: null,
  presenceChannel: null,
  displayChannel: null,
  importRows: [],
  rosterCounts: new Map(),
  flowStep: "class",
  selectedPlanId: null,
  playerSelfieUrls: new Map(),
  lobbyPage: 1,
  lobbyZoomStep: 0,
  celebrationActivityKey: null,
  celebrationReason: null,
  competitionSoundEnabled: true,
  activityTimerId: null,
  activityRemainingMs: 0,
  activityTimerLastTickAt: null,
  activityStartedAt: null,
  finishingActivity: false,
  studentScreens: new Map(),
  studentScreenView: "grid",
  selectedStudentScreenId: null,
  studentScreenFocusMarkup: "",
  watchedStudentScreenId: null,
  studentScreenWatchTimer: null,
  lateJoinMode: false,
  lateJoinResumeStatus: "paused",
};

const FLOW_STEPS = ["class", "qr", "lobby", "plan", "live", "summary"];
const FLOW_TITLES = {
  class: "เลือกโรงเรียนและห้องเรียน",
  qr: "QR และรหัสเข้าห้อง",
  lobby: "ตรวจนักเรียนเข้าห้อง",
  plan: "เลือกแผนการสอน",
  live: "ควบคุมเกมและผลการแข่งขัน",
  summary: "สรุปผลคาบเรียน",
};

const LOBBY_LAYOUTS = [
  { key: "overview", label: "ภาพรวม", minWidth: 108, rowHeight: 76 },
  { key: "compact", label: "กะทัดรัด", minWidth: 160, rowHeight: 92 },
  { key: "normal", label: "มาตรฐาน", minWidth: 250, rowHeight: 112 },
  { key: "large", label: "ใหญ่", minWidth: 350, rowHeight: 170 },
  { key: "xlarge", label: "ใหญ่มาก", minWidth: 480, rowHeight: 240 },
  { key: "inspect", label: "ตรวจใบหน้า", minWidth: 680, rowHeight: 310 },
];

function connectionUpdate() {
  updateConnectionBadge($("#teacherConnection"), navigator.onLine, navigator.onLine ? "เชื่อมต่อแล้ว" : "ไม่มีอินเทอร์เน็ต");
}

function selectedClassroom() {
  return state.classes.find(item => item.id === (state.session?.class_id || $("#classSelect")?.value));
}

function classContext(classroom = selectedClassroom()) {
  if (!classroom) return "ยังไม่ได้เลือกห้องเรียน";
  return `${classroom.school?.name || "โรงเรียน"} · ${classroom.label} · ครู${state.profile?.full_name || "ผู้สอน"}`;
}

function setTeacherFlowStep(step) {
  if (!FLOW_STEPS.includes(step)) return;
  state.flowStep = step;
  show($("#teacherFlowProgress"));
  hide($("#resumeSessionView"));
  $$("[data-flow-step]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.flowStep !== step));
  $$("[data-progress-step]").forEach((item, index) => {
    const targetIndex = FLOW_STEPS.indexOf(step);
    item.classList.toggle("active", index === targetIndex);
    item.classList.toggle("done", index < targetIndex);
  });
  $("#flowStepTitle").textContent = FLOW_TITLES[step];
  $("#flowContext").textContent = step === "class" ? "เริ่มจากโรงเรียนและห้องที่คุณครูรับผิดชอบ" : classContext();
  if (step === "lobby") {
    syncLateJoinControls();
    requestAnimationFrame(renderPlayerPage);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncLateJoinControls() {
  const active = Boolean(state.lateJoinMode || (state.session?.status === "lobby" && state.session?.current_activity_key));
  if (active) state.lateJoinMode = true;
  $("#lobbyBackButton").textContent = active ? "← ปิดรับและกลับไปเกม" : "← กลับไปหน้า QR";
  $("#lobbyNextButton").textContent = active ? "ปิดรับและกลับไปเกม →" : "ต่อไป: เลือกแผนการสอน →";
  $("#lateJoinRoomCode").textContent = state.session?.room_code || "------";
  $("#lateJoinNotice").classList.toggle("hidden", !active);
}

async function bootstrap() {
  connectionUpdate();
  renderPlanTimeline($("#planTimeline"), 1);
  const { data } = await supabase.auth.getSession();
  if (data.session && !data.session.user.is_anonymous) {
    state.user = data.session.user;
    await loadTeacherWorkspace();
  }
}

async function signIn(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "กำลังเข้าสู่ระบบ...";
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $("#teacherEmail").value.trim(),
      password: $("#teacherPassword").value,
    });
    if (error) throw error;
    state.user = data.user;
    await loadTeacherWorkspace();
  } catch (error) {
    toast(error.message || "เข้าสู่ระบบไม่สำเร็จ", "error");
  } finally {
    button.disabled = false;
    button.textContent = "เข้าสู่ระบบ";
  }
}

async function loadTeacherWorkspace() {
  const { data: profile, error } = await supabase.from("teacher_profiles").select("*").eq("user_id", state.user.id).maybeSingle();
  if (error || !profile?.active) {
    await supabase.auth.signOut();
    state.user = null;
    return toast("บัญชีนี้ยังไม่ได้รับสิทธิ์ครู กรุณาให้ผู้ดูแลเปิดสิทธิ์ก่อน", "error");
  }
  state.profile = profile;
  $("#teacherName").textContent = profile.full_name;
  hide($("#teacherLoginView"));
  show($("#teacherDashboard"));
  show($("#signOutButton"));
  await Promise.all([loadClasses(), loadPlans()]);
  await loadRoster();
  await restoreActiveSession();
}

async function signOut() {
  await supabase.auth.signOut();
  location.reload();
}

async function loadClasses() {
  const { data, error } = await supabase.rpc("get_teacher_classes");
  if (error) {
    state.classes = [];
    renderSchoolOptions();
    toast("กรุณารันไฟล์อัปเกรดฐานข้อมูลสำหรับหน้าครูก่อนใช้งาน", "error");
    return;
  }
  state.classes = (data || []).map(item => ({
    id: item.class_id,
    label: item.class_label,
    grade: item.grade,
    room_no: item.room_no,
    academic_year: item.academic_year,
    school_id: item.school_id,
    school: { id: item.school_id, name: item.school_name, code: item.school_code },
  }));
  renderSchoolOptions();
  const rosterOptions = `<option value="">เลือกห้อง</option>${state.classes.map(item => `<option value="${item.id}">${escapeHtml(item.school?.name)} · ${escapeHtml(item.label)}</option>`).join("")}`;
  $("#rosterClassSelect").innerHTML = rosterOptions;
}

async function loadPlans() {
  const { data, error } = await supabase.from("lesson_plans").select("*").order("sequence_no");
  if (error) return toast(error.message, "error");
  state.plans = data || [];
  state.selectedPlanId = state.plans.find(plan => plan.published)?.id || null;
  renderPlanChoices();
}

function renderSchoolOptions() {
  const schools = [...new Map(state.classes.map(item => [item.school?.id, item.school])).values()].filter(Boolean);
  $("#schoolSelect").innerHTML = `<option value="">เลือกโรงเรียน</option>${schools.map(school => `<option value="${school.id}">${escapeHtml(school.name)}</option>`).join("")}`;
  $("#classSelect").innerHTML = `<option value="">เลือกห้องเรียน</option>`;
  $("#classSelect").disabled = true;
  if (schools.length === 1) {
    $("#schoolSelect").value = schools[0].id;
    renderClassOptions(schools[0].id);
  }
  $("#classOwnershipNote").textContent = state.classes.length
    ? `🔒 บัญชีนี้รับผิดชอบ ${state.classes.length} ห้อง ระบบจะแยกข้อมูลแต่ละห้องให้อัตโนมัติ`
    : "ยังไม่มีห้องเรียนที่มอบหมายให้บัญชีนี้ กรุณาให้ผู้ดูแลกำหนดห้องก่อน";
}

function renderClassOptions(schoolId) {
  const classrooms = state.classes.filter(item => item.school?.id === schoolId);
  $("#classSelect").innerHTML = `<option value="">เลือกห้องเรียน</option>${classrooms.map(item => `<option value="${item.id}">${escapeHtml(item.label)} · ปี ${item.academic_year}</option>`).join("")}`;
  $("#classSelect").disabled = !classrooms.length;
  updateSelectedClassRosterNote();
}

function updateSelectedClassRosterNote() {
  const note = $("#classOwnershipNote");
  const classId = $("#classSelect").value;
  const classroom = state.classes.find(item => item.id === classId);
  if (!classroom) {
    note.textContent = state.classes.length
      ? `🔒 บัญชีนี้รับผิดชอบ ${state.classes.length} ห้อง เลือกห้องเพื่อดูจำนวนรายชื่อ`
      : "ยังไม่มีห้องเรียนที่มอบหมายให้บัญชีนี้ กรุณาให้ผู้ดูแลกำหนดห้องก่อน";
    note.classList.remove("warning", "success");
    return;
  }
  const count = state.rosterCounts.get(classId) || 0;
  note.textContent = count
    ? `✅ ${classroom.school?.name} · ${classroom.label} มีรายชื่อนักเรียนที่ใช้งาน ${count} คน พร้อมสร้าง QR`
    : `⚠️ ${classroom.school?.name} · ${classroom.label} ยังไม่มีรายชื่อนักเรียน กรุณาเพิ่มหรือนำเข้ารายชื่อก่อนสร้าง QR`;
  note.classList.toggle("warning", count === 0);
  note.classList.toggle("success", count > 0);
}

function renderPlanChoices() {
  const container = $("#planChoices");
  if (!container) return;
  container.innerHTML = state.plans.map(plan => `
    <button type="button" class="flow-plan-choice ${Number(state.selectedPlanId) === Number(plan.id) ? "selected" : ""}" data-plan-id="${plan.id}" ${plan.published ? "" : "disabled"}>
      <span>${plan.published ? `แผน ${plan.sequence_no}` : "🔒"}</span>
      <strong>${escapeHtml(plan.title)}</strong>
      <small>${plan.published ? `${ACTIVITIES.length} เกม · ประมาณ ${ACTIVITIES.reduce((sum, item) => sum + item.minutes, 0)} นาที` : "ยังไม่เปิดใช้งาน"}</small>
    </button>
  `).join("");
  container.querySelectorAll("[data-plan-id]").forEach(button => button.addEventListener("click", () => selectPlan(Number(button.dataset.planId))));
  if (state.selectedPlanId) selectPlan(Number(state.selectedPlanId), false);
}

function selectPlan(planId, rerender = true) {
  const plan = state.plans.find(item => Number(item.id) === Number(planId) && item.published);
  if (!plan) return;
  state.selectedPlanId = plan.id;
  $("#planSelect").value = plan.id;
  $("#selectedPlanTitle").textContent = `แผนที่ ${plan.sequence_no} · ${plan.title}`;
  $("#activityPreview").innerHTML = ACTIVITIES.map((activity, index) => `<article><span>${activity.icon}</span><div><small>เกมที่ ${index + 1}</small><strong>${escapeHtml(activity.title)}</strong><em>${activity.minutes} นาที</em></div></article>`).join("");
  if (rerender) renderPlanChoices();
}

async function setupSchool(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const { error } = await supabase.rpc("create_school_structure", {
      p_school_name: $("#schoolName").value.trim(),
      p_school_code: $("#schoolCode").value.trim(),
      p_academic_year: Number($("#academicYear").value),
    });
    if (error) throw error;
    toast("สร้างห้อง ป.1/1 ถึง ป.6/4 เรียบร้อย", "success");
    await loadClasses();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function createSession(event) {
  event.preventDefault();
  const button = event.submitter;
  if (state.session && state.session.status !== "closed") return toast("กรุณาปิดคาบเดิมก่อนเปิดคาบใหม่", "warning");
  const classId = $("#classSelect").value;
  if (!classId) return toast("กรุณาเลือกห้องเรียน", "warning");
  if (!(state.rosterCounts.get(classId) > 0)) return toast("ห้องนี้ยังไม่มีรายชื่อนักเรียน กรุณาเพิ่มหรือนำเข้ารายชื่อก่อนสร้าง QR", "warning");
  const firstPlan = state.plans.find(plan => plan.published);
  if (!firstPlan) return toast("ยังไม่มีแผนการสอนที่เปิดใช้งาน", "warning");
  button.disabled = true;
  button.textContent = "กำลังเปิดห้อง...";
  try {
    const attemptMode = $("#attemptMode").value;
    const maxAttempts = attemptMode === "single" ? 1 : Number($("#maxAttempts").value);
    const { data, error } = await supabase.rpc("create_class_session", {
      p_class_id: classId,
      p_plan_id: Number(firstPlan.id),
      p_play_mode: $("#playMode").value,
      p_attempt_mode: attemptMode,
      p_max_attempts: maxAttempts,
      p_score_policy: $("#scorePolicy").value,
      p_leaderboard_mode: $("#leaderboardMode").value,
      p_pass_percent: Number($("#passPercent").value),
    });
    if (error) throw error;
    state.session = data;
    state.selectedPlanId = firstPlan.id;
    await showLiveSession("qr");
    toast(`สร้างรหัสสำหรับ ${classContext()} แล้ว`, "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "สร้างห้องและแสดง QR →";
  }
}

async function restoreActiveSession() {
  const { data } = await supabase.from("class_sessions")
    .select("*")
    .eq("teacher_id", state.user.id)
    .neq("status", "closed")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return;
  state.session = data;
  state.selectedPlanId = data.plan_id;
  showResumeSession();
}

function showResumeSession() {
  const classroom = selectedClassroom();
  const activity = ACTIVITIES.find(item => item.key === state.session.current_activity_key);
  const statusLabels = { lobby: "กำลังรับนักเรียน", active: "กำลังเล่นเกม", paused: "พักเกมชั่วคราว" };
  state.flowStep = "resume";
  hide($("#teacherFlowProgress"));
  hide($("#sessionSetup"));
  hide($("#liveSession"));
  $$("[data-flow-step]").forEach(hide);
  show($("#resumeSessionView"));
  $("#flowStepTitle").textContent = "เลือกสิ่งที่ต้องการทำกับคาบเดิม";
  $("#flowContext").textContent = classContext(classroom);
  $("#resumeClassContext").textContent = classContext(classroom);
  $("#resumeRoomCode").textContent = state.session.room_code;
  $("#resumeStatus").textContent = statusLabels[state.session.status] || state.session.status;
  $("#resumeActivity").textContent = activity?.title || "ยังไม่เริ่มเกม";
  $("#resumeSessionButton").textContent = state.session.status === "lobby" ? "กลับไปหน้า QR →" : "กลับไปผลสด →";
  $("#resumeSummaryButton").classList.toggle("hidden", state.session.status === "lobby");
}

async function showLiveSession(step = "qr") {
  hide($("#sessionSetup"));
  hide($("#resumeSessionView"));
  show($("#liveSession"));
  $("#liveRoomCode").textContent = state.session.room_code;
  $("#qrClassContext").textContent = classContext();
  $("#liveClassContext").textContent = classContext();
  $("#summaryClassContext").textContent = classContext();
  await renderStudentAccess();
  $("#openDisplayButton").href = `display.html?room=${state.session.room_code}`;
  $("#pauseSessionButton").textContent = state.session.status === "paused" ? "เล่นต่อ" : "พักเกม";
  state.lateJoinMode = state.session.status === "lobby" && Boolean(state.session.current_activity_key);
  if (state.lateJoinMode) state.lateJoinResumeStatus = "paused";
  syncLateJoinControls();
  renderLiveModeSwitch();
  selectPlan(Number(state.session.plan_id || state.selectedPlanId), false);
  renderActivityControls();
  subscribeToSession();
  subscribePresence();
  await subscribeDisplay();
  await refreshSessionData();
  restoreActivityTimer();
  setTeacherFlowStep(step);
  if (step === "summary") renderSummary();
}

function studentJoinUrl() {
  const url = new URL("student.html", location.href);
  url.searchParams.set("room", state.session.room_code);
  return url.href;
}

async function renderStudentAccess() {
  const url = studentJoinUrl();
  $("#openStudentJoinButton").href = url;
  const image = $("#studentJoinQr");
  const frame = image.closest(".session-qr-frame");
  frame.dataset.state = "loading";
  image.removeAttribute("src");
  try {
    const { default: QRCode } = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm");
    image.src = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      width: 320,
      margin: 1,
      color: { dark: "#17203b", light: "#ffffff" },
    });
    frame.dataset.state = "ready";
  } catch {
    frame.dataset.state = "error";
    toast("สร้าง QR ไม่สำเร็จ ยังใช้รหัสห้องหรือลิงก์ได้ตามปกติ", "warning");
  }
}

function renderActivityControls() {
  $("#activityControls").innerHTML = ACTIVITIES.map((activity, index) => `
    <button class="activity-control ${activity.key === state.session.current_activity_key ? "active" : ""}" data-activity="${activity.key}">
      <span>${activity.icon}</span><span><strong>${index + 1}. ${escapeHtml(activity.title)}</strong><small>${activity.minutes} นาที</small></span><i>เริ่ม →</i>
    </button>
  `).join("");
  $("#activityControls").querySelectorAll("button").forEach(button => button.addEventListener("click", () => startActivity(button.dataset.activity)));
  const current = ACTIVITIES.find(item => item.key === state.session.current_activity_key);
  $("#currentActivityLabel").textContent = current ? current.title : "ยังไม่เริ่มกิจกรรม";
  updateNextActivityButton();
}

function renderLiveModeSwitch() {
  $$('[data-live-mode]').forEach(button => {
    const active = button.dataset.liveMode === state.session?.play_mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function setLivePlayMode(mode) {
  if (!state.session || !["practice", "real"].includes(mode) || state.session.play_mode === mode) return;
  const buttons = $$('[data-live-mode]');
  buttons.forEach(button => { button.disabled = true; });
  const { data, error } = await supabase.from("class_sessions").update({ play_mode: mode }).eq("id", state.session.id).select().single();
  buttons.forEach(button => { button.disabled = false; });
  if (error) return toast(error.message, "error");
  state.session = data;
  $("#playMode").value = mode;
  renderLiveModeSwitch();
  await broadcastDisplay("play-mode-changed");
  const labels = { practice: "โหมดทดลอง", real: "โหมดจริง" };
  toast(`เปลี่ยนเป็น${labels[mode]}แล้ว`, "success");
}

async function savePlanSettings() {
  const attemptMode = $("#attemptMode").value;
  const updates = {
    plan_id: Number(state.selectedPlanId),
    play_mode: $("#playMode").value,
    attempt_mode: attemptMode,
    max_attempts: attemptMode === "single" ? 1 : Number($("#maxAttempts").value),
    score_policy: $("#scorePolicy").value,
    leaderboard_mode: $("#leaderboardMode").value,
    pass_percent: Number($("#passPercent").value),
  };
  const { data, error } = await supabase.from("class_sessions").update(updates).eq("id", state.session.id).select().single();
  if (error) throw error;
  state.session = data;
  renderLiveModeSwitch();
}

function activityTimerStorageKey() {
  return state.session?.id ? `thai-game-activity-timer-${state.session.id}` : "";
}

function activityDurationMs(activityKey = state.session?.current_activity_key) {
  return (ACTIVITIES.find(item => item.key === activityKey)?.minutes || 10) * 60 * 1000;
}

function updateActivityCountdown(label) {
  const output = $("#activityCountdown");
  const card = $("#activityTimerCard");
  if (!output || !card) return;
  card.classList.remove("is-urgent", "is-paused", "is-finished");
  if (label) {
    output.textContent = label;
    if (label === "พักอยู่") card.classList.add("is-paused");
    if (label === "จบเกม") card.classList.add("is-finished");
    return;
  }
  const seconds = Math.max(0, Math.ceil(state.activityRemainingMs / 1000));
  output.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  card.classList.toggle("is-urgent", seconds > 0 && seconds <= 60);
}

function saveActivityTimer(running = state.session?.status === "active") {
  const key = activityTimerStorageKey();
  if (!key || !state.session?.current_activity_key) return;
  try {
    localStorage.setItem(key, JSON.stringify({
      activityKey: state.session.current_activity_key,
      remainingMs: Math.max(0, state.activityRemainingMs),
      startedAt: state.activityStartedAt,
      savedAt: Date.now(),
      running,
    }));
  } catch { /* The countdown still works if storage is unavailable. */ }
}

function removeSavedActivityTimer() {
  const key = activityTimerStorageKey();
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ }
}

function stopActivityTimer({ clearSaved = false, label = "" } = {}) {
  clearInterval(state.activityTimerId);
  state.activityTimerId = null;
  state.activityTimerLastTickAt = null;
  if (clearSaved) removeSavedActivityTimer();
  updateActivityCountdown(label);
}

function tickActivityTimer() {
  if (!state.session?.current_activity_key || state.celebrationActivityKey) return;
  if (state.session.status !== "active") {
    state.activityTimerLastTickAt = null;
    updateActivityCountdown("พักอยู่");
    saveActivityTimer(false);
    return;
  }
  const now = Date.now();
  if (state.activityTimerLastTickAt) state.activityRemainingMs -= now - state.activityTimerLastTickAt;
  state.activityTimerLastTickAt = now;
  updateActivityCountdown();
  saveActivityTimer(true);
  if (state.activityRemainingMs > 0) return;
  state.activityRemainingMs = 0;
  stopActivityTimer({ clearSaved: true });
  void finishActivity("time_up");
}

function startActivityTimer(activityKey, reset = true) {
  clearInterval(state.activityTimerId);
  if (reset) {
    state.activityRemainingMs = activityDurationMs(activityKey);
    state.activityStartedAt = new Date().toISOString();
  }
  state.activityTimerLastTickAt = Date.now();
  updateActivityCountdown();
  saveActivityTimer(true);
  state.activityTimerId = setInterval(tickActivityTimer, 1000);
}

function restoreActivityTimer() {
  if (!state.session?.current_activity_key || state.celebrationActivityKey) {
    updateActivityCountdown("--:--");
    return;
  }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(activityTimerStorageKey()) || "null"); } catch { saved = null; }
  if (saved?.activityKey === state.session.current_activity_key) {
    const elapsed = saved.running && state.session.status === "active" ? Date.now() - Number(saved.savedAt || Date.now()) : 0;
    state.activityRemainingMs = Math.max(0, Number(saved.remainingMs || 0) - elapsed);
    state.activityStartedAt = saved.startedAt || null;
  } else {
    state.activityRemainingMs = activityDurationMs();
    state.activityStartedAt = new Date().toISOString();
  }
  if (state.session.status !== "active") {
    updateActivityCountdown("พักอยู่");
    saveActivityTimer(false);
    return;
  }
  if (state.activityRemainingMs <= 0) {
    updateActivityCountdown("00:00");
    void finishActivity("time_up");
    return;
  }
  startActivityTimer(state.session.current_activity_key, false);
}

async function startSelectedPlan() {
  if (!state.selectedPlanId) return toast("กรุณาเลือกแผนการสอน", "warning");
  const button = $("#startPlanButton");
  button.disabled = true;
  button.textContent = "กำลังเริ่มเกม...";
  try {
    await savePlanSettings();
    const started = await startActivity(ACTIVITIES[0].key);
    if (!started) return;
    setTeacherFlowStep("live");
  } catch (error) {
    toast(error.message || "เริ่มแผนการสอนไม่สำเร็จ", "error");
  } finally {
    button.disabled = false;
    button.textContent = "▶ เริ่มเกมแรก";
  }
}

async function startActivity(activityKey) {
  prepareVictoryAudio();
  state.celebrationActivityKey = null;
  state.celebrationReason = null;
  const updates = { status: "active", current_activity_key: activityKey };
  if (!state.session.started_at) updates.started_at = new Date().toISOString();
  const { data, error } = await supabase.from("class_sessions").update(updates).eq("id", state.session.id).select().single();
  if (error) {
    toast(error.message, "error");
    return false;
  }
  state.session = data;
  startActivityTimer(activityKey, true);
  renderActivityControls();
  renderLiveModeSwitch();
  renderLiveResults();
  $("#pauseSessionButton").textContent = "พักเกม";
  await broadcastDisplay("activity-started");
  toast(`เริ่ม ${ACTIVITIES.find(item => item.key === activityKey)?.title}`, "success");
  return true;
}

function updateNextActivityButton() {
  const button = $("#nextActivityButton");
  if (!button || !state.session) return;
  const index = ACTIVITIES.findIndex(item => item.key === state.session.current_activity_key);
  button.textContent = index >= ACTIVITIES.length - 1 ? "สรุปผลคาบเรียน →" : `เกมถัดไป: ${ACTIVITIES[index + 1]?.short || ACTIVITIES[0].short} →`;
}

async function goToNextActivity() {
  const index = ACTIVITIES.findIndex(item => item.key === state.session.current_activity_key);
  if (index >= ACTIVITIES.length - 1) return showSessionSummary();
  await startActivity(ACTIVITIES[Math.max(index + 1, 0)].key);
}

function showSessionSummary() {
  renderSummary();
  setTeacherFlowStep("summary");
}

async function togglePause() {
  const wasCelebrating = state.celebrationActivityKey === state.session.current_activity_key;
  if (state.session.status === "active") tickActivityTimer();
  if (state.finishingActivity) return;
  const status = state.session.status === "paused" ? "active" : "paused";
  const { data, error } = await supabase.from("class_sessions").update({ status }).eq("id", state.session.id).select().single();
  if (error) return toast(error.message, "error");
  state.session = data;
  if (status === "active") {
    state.celebrationActivityKey = null;
    state.celebrationReason = null;
    if (wasCelebrating || state.activityRemainingMs <= 0) startActivityTimer(state.session.current_activity_key, true);
    else startActivityTimer(state.session.current_activity_key, false);
  } else {
    state.activityTimerLastTickAt = null;
    updateActivityCountdown("พักอยู่");
    saveActivityTimer(false);
  }
  $("#pauseSessionButton").textContent = status === "paused" ? "เล่นต่อ" : "พักเกม";
  renderLiveResults();
  broadcastDisplay();
}

async function openLateJoin() {
  if (!state.session?.current_activity_key || state.finishingActivity) return;
  if (state.session.status === "lobby") {
    state.lateJoinMode = true;
    syncLateJoinControls();
    setTeacherFlowStep("lobby");
    return;
  }
  if (state.session.status === "active") tickActivityTimer();
  if (state.finishingActivity) return;
  state.lateJoinResumeStatus = state.session.status === "active" ? "active" : "paused";
  const { data, error } = await supabase.from("class_sessions").update({ status: "lobby" }).eq("id", state.session.id).select().single();
  if (error) return toast(error.message, "error");
  state.session = data;
  state.lateJoinMode = true;
  state.activityTimerLastTickAt = null;
  updateActivityCountdown("รับนักเรียน");
  saveActivityTimer(false);
  syncLateJoinControls();
  renderLiveResults();
  broadcastDisplay();
  setTeacherFlowStep("lobby");
  toast("เปิดรับนักเรียนเพิ่มแล้ว ใช้รหัสห้องเดิมได้เลย", "success");
}

async function closeLateJoin() {
  if (!state.lateJoinMode) return false;
  const resumeStatus = state.lateJoinResumeStatus === "active" ? "active" : "paused";
  const { data, error } = await supabase.from("class_sessions").update({ status: resumeStatus }).eq("id", state.session.id).select().single();
  if (error) {
    toast(error.message, "error");
    return true;
  }
  state.session = data;
  state.lateJoinMode = false;
  if (resumeStatus === "active" && state.activityRemainingMs > 0) startActivityTimer(state.session.current_activity_key, false);
  else {
    state.activityTimerLastTickAt = null;
    updateActivityCountdown("พักอยู่");
    saveActivityTimer(false);
  }
  $("#pauseSessionButton").textContent = resumeStatus === "active" ? "พักเกม" : "เล่นต่อ";
  syncLateJoinControls();
  renderLiveResults();
  broadcastDisplay();
  setTeacherFlowStep("live");
  toast(resumeStatus === "active" ? "ปิดรับและกลับมาเล่นเกมแล้ว" : "ปิดรับแล้ว กดเล่นต่อเมื่อพร้อม", "success");
  return true;
}

async function handleLobbyBack() {
  if (await closeLateJoin()) return;
  setTeacherFlowStep("qr");
}

async function handleLobbyNext() {
  if (await closeLateJoin()) return;
  renderPlanChoices();
  setTeacherFlowStep("plan");
}

function subscribeToSession() {
  state.sessionChannel?.unsubscribe();
  state.sessionChannel = supabase.channel(`teacher-session-${state.session.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${state.session.id}` }, async payload => {
      const needsApproval = payload.new?.status === "waiting" && payload.old?.status !== "waiting";
      await refreshSessionData();
      if (needsApproval) {
        const player = state.players.find(item => item.id === payload.new.id);
        const name = player?.student?.full_name || "นักเรียน";
        toast(`🔔 ${name} ส่งรูปใหม่ รอคุณครูอนุมัติ`, "success");
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "game_attempts" }, payload => {
      const playerIds = new Set(state.players.map(player => player.id));
      if (playerIds.has(payload.new?.session_player_id || payload.old?.session_player_id)) refreshSessionData();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${state.session.id}` }, payload => {
      const activityChanged = state.session?.current_activity_key !== payload.new.current_activity_key;
      state.session = payload.new;
      if (state.session.status !== "lobby") state.lateJoinMode = false;
      if (activityChanged) {
        state.celebrationActivityKey = null;
        state.celebrationReason = null;
        restoreActivityTimer();
      }
      renderActivityControls();
      syncLateJoinControls();
      renderLiveModeSwitch();
      renderLiveResults();
    })
    .subscribe();
}

function screenTimestamp(screen) {
  const timestamp = Date.parse(String(screen?.updated_at || screen?.online_at || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeStudentScreen(previous, incoming) {
  if (!incoming?.player_id) return previous || null;
  if (previous && screenTimestamp(incoming) < screenTimestamp(previous)) return previous;
  return {
    ...previous,
    ...incoming,
    player_id: String(incoming.player_id),
    game_markup: incoming.game_markup || previous?.game_markup || "",
  };
}

function upsertStudentScreen(incoming) {
  const playerId = String(incoming?.player_id || "");
  if (!playerId) return;
  const merged = mergeStudentScreen(state.studentScreens.get(playerId), incoming);
  if (merged) state.studentScreens.set(playerId, merged);
}

function subscribePresence() {
  stopStudentScreenWatch();
  state.presenceChannel?.unsubscribe();
  state.presenceChannel = supabase.channel(`classroom-${state.session.id}`, { config: { presence: { key: `teacher-${state.user.id}` } } })
    .on("broadcast", { event: "student-screen" }, message => {
      const screen = message?.payload || message;
      if (screen?.role !== "student" || !screen.player_id) return;
      upsertStudentScreen(screen);
      $("#onlineCount").textContent = state.studentScreens.size;
      renderStudentScreens();
    })
    .on("presence", { event: "sync" }, () => {
      const presence = state.presenceChannel.presenceState();
      const students = Object.values(presence).flat().filter(item => item.role === "student");
      // Keep the most recent broadcast while Presence catches up. Presence
      // deliberately omits game_markup, so replacing the map wholesale can
      // make a live screen jump back to a stale placeholder.
      const latestScreens = new Map([...state.studentScreens].filter(([, screen]) => {
        const timestamp = screenTimestamp(screen);
        return timestamp > 0 && Date.now() - timestamp < 15000;
      }));
      students.forEach(screen => {
        const playerId = String(screen.player_id || "");
        if (!playerId) return;
        const previous = latestScreens.get(playerId) || state.studentScreens.get(playerId);
        const merged = mergeStudentScreen(previous, screen);
        if (merged) latestScreens.set(playerId, merged);
      });
      state.studentScreens = latestScreens;
      $("#onlineCount").textContent = latestScreens.size;
      renderStudentScreens();
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") state.presenceChannel.track({ role: "teacher", online_at: new Date().toISOString() });
    });
}

function studentScreenEntries() {
  const entries = state.players.filter(player => player.status === "approved").map(player => ({
    player,
    student: player.student || {},
    screen: state.studentScreens.get(String(player.id)) || null,
    online: state.studentScreens.has(String(player.id)),
  }));
  const knownPlayerIds = new Set(entries.map(entry => String(entry.player.id)));
  state.studentScreens.forEach((screen, playerId) => {
    if (knownPlayerIds.has(String(playerId))) return;
    entries.push({
      player: { id: playerId, student_id: screen.student_id, status: "approved" },
      student: {
        id: screen.student_id,
        full_name: screen.display_name || "นักเรียนออนไลน์",
        nickname: screen.display_name || "",
        avatar: screen.avatar || "🙂",
      },
      screen,
      online: true,
    });
  });
  return entries.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return String(a.student.full_name || a.student.nickname || "").localeCompare(String(b.student.full_name || b.student.nickname || ""), "th");
  });
}

function studentScreenModeLabel(mode) {
  return ({ practice: "ทดลอง", real: "จริง" })[mode] || "ทดลอง";
}

function studentScreenIcon(entry) {
  if (!entry.online) return "💤";
  return ({ result: "🏆", paused: "⏸️", playing: "🎮", ready: "🗺️", waiting: "⏳" })[entry.screen?.screen_state] || "📱";
}

function studentMirrorHtml(entry, large = false) {
  const screen = entry.screen || {};
  const activity = ACTIVITIES.find(item => item.key === screen.activity_key);
  const title = screen.activity_title || activity?.title || (entry.online ? "กำลังเชื่อมต่อจอ" : "ไม่ได้ออนไลน์");
  const label = entry.online ? (screen.screen_label || "อยู่หน้าเกม") : "ออฟไลน์";
  const detail = screen.detail || (entry.online ? "กำลังทำกิจกรรม" : "เมื่อนักเรียนกลับเข้าเกม จอจะเชื่อมต่อใหม่");
  const rawProgress = Number(screen.progress_percent || 0);
  const rawScore = Number(screen.score || 0);
  const progress = Number.isFinite(rawProgress) ? Math.min(100, Math.max(0, rawProgress)) : 0;
  const score = Number.isFinite(rawScore) ? rawScore : 0;
  const streamMarkup = large ? sanitizeGameMarkup(screen.game_markup) : "";
  const screenContent = streamMarkup
    ? `<div class="student-device-stream"><div class="display-student-mirror-canvas game-canvas" style="--game-zoom:${Math.max(.75, Math.min(1.3, Number(screen.game_zoom) || 1))}">${streamMarkup}</div></div>`
    : `<div class="student-device-stage" data-screen-state="${escapeHtml(screen.screen_state || "offline")}">
      <span class="student-device-icon">${studentScreenIcon(entry)}</span>
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(detail)}</p>
      <div class="student-device-progress"><i style="width:${progress}%"></i></div>
    </div>`;
  return `<div class="student-device ${large ? "student-device-large" : ""} ${entry.online ? "is-online" : "is-offline"}">
    <div class="student-device-top"><span>${entry.online ? "● สด" : "○ ออฟไลน์"}</span><small>${escapeHtml(studentScreenModeLabel(screen.mode || state.session?.play_mode))}</small></div>
    ${screenContent}
    <div class="student-device-bottom"><span>⭐ ${score}</span><span>${escapeHtml(screen.progress_text || "รอข้อมูลความคืบหน้า")}</span></div>
  </div>`;
}

function stopStudentScreenWatch() {
  clearInterval(state.studentScreenWatchTimer);
  state.studentScreenWatchTimer = null;
  const playerId = state.watchedStudentScreenId;
  state.watchedStudentScreenId = null;
  if (playerId && state.presenceChannel) {
    void state.presenceChannel.send({
      type: "broadcast",
      event: "screen-stream-control",
      payload: { role: "teacher", player_id: playerId, active: false },
    });
  }
}

function watchStudentScreen(playerId) {
  if (!playerId || !state.presenceChannel) return;
  if (state.watchedStudentScreenId === playerId && state.studentScreenWatchTimer) return;
  stopStudentScreenWatch();
  state.watchedStudentScreenId = playerId;
  const requestStream = () => void state.presenceChannel?.send({
    type: "broadcast",
    event: "screen-stream-control",
    payload: { role: "teacher", player_id: playerId, active: true, expires_at: Date.now() + 6500 },
  });
  requestStream();
  state.studentScreenWatchTimer = setInterval(requestStream, 4000);
}

function postStudentMirrorFrame(frame, markup) {
  if (!frame?.contentWindow || typeof markup !== "string") return;
  frame.contentWindow.postMessage({ type: "student-game-mirror-frame", markup }, window.location.origin);
}

window.addEventListener("message", event => {
  if (event.origin !== window.location.origin || event.data?.type !== "student-game-mirror-ready") return;
  const frame = $(".student-focus-game-frame", $("#studentScreenFocusContent"));
  if (frame?.contentWindow !== event.source) return;
  postStudentMirrorFrame(frame, state.studentScreenFocusMarkup);
});

function renderStudentScreenFocus(entries) {
  const selected = entries.find(entry => String(entry.player.id) === String(state.selectedStudentScreenId)) || entries[0];
  if (!selected) return;
  state.selectedStudentScreenId = String(selected.player.id);
  watchStudentScreen(String(selected.player.id));
  const screen = state.studentScreens.get(String(selected.player.id)) || selected.screen || {};
  const profileUrl = state.playerSelfieUrls.get(selected.player.id) || "";
  const profileVisual = profileUrl
    ? `<img src="${escapeHtml(profileUrl)}" alt="รูปโปรไฟล์ ${escapeHtml(selected.student.full_name || "นักเรียน")}">`
    : `<span>${escapeHtml(selected.student.avatar || randomAvatar(selected.student.nickname))}</span>`;
  const playerName = selected.student.full_name || selected.student.nickname || "นักเรียน";
  const streamMarkup = sanitizeGameMarkup(screen.game_markup);
  const focusContent = $("#studentScreenFocusContent");
  const existingFrame = $(".student-focus-game-frame", focusContent);
  const sameStudent = focusContent?.dataset.playerId === String(selected.player.id);
  // Keep a dedicated mirror document alive for the whole watch session. It
  // uses the student game's own full-screen CSS, so Broadcast updates never
  // inherit dashboard styles or restart an unchanged animation.
  if (sameStudent && existingFrame && streamMarkup) {
    if (state.studentScreenFocusMarkup !== streamMarkup) {
      state.studentScreenFocusMarkup = streamMarkup;
      postStudentMirrorFrame(existingFrame, streamMarkup);
    }
    $("#studentScreenPrevious").disabled = entries.length < 2;
    $("#studentScreenNext").disabled = entries.length < 2;
    return;
  }
  const gameContent = streamMarkup
    ? `<iframe class="student-focus-game-frame" data-player-id="${escapeHtml(String(selected.player.id))}" src="mirror.html" title="ถ่ายทอดสดหน้าจอ ${escapeHtml(playerName)}"></iframe>`
    : `<div class="student-focus-waiting"><span>${studentScreenIcon(selected)}</span><h2>${escapeHtml(screen.activity_title || "กำลังรอภาพเกม")}</h2><p>${escapeHtml(screen.detail || "ภาพเกมจะปรากฏอัตโนมัติ")}</p></div>`;
  focusContent.innerHTML = `<div class="student-focus-stream">
    <div class="student-focus-overlay">
      <button class="student-focus-back" type="button" aria-label="กลับไปดูนักเรียนทั้งหมด">‹</button>
      <div class="student-focus-player">${profileVisual}<strong>${escapeHtml(playerName)}</strong><i aria-label="ถ่ายทอดสด"></i></div>
    </div>
    <main class="student-focus-game-window">${gameContent}</main>
  </div>`;
  focusContent.dataset.playerId = String(selected.player.id);
  state.studentScreenFocusMarkup = streamMarkup;
  $(".student-focus-back", focusContent)?.addEventListener("click", () => setStudentScreenView("grid"));
  const mirrorFrame = $(".student-focus-game-frame", focusContent);
  mirrorFrame?.addEventListener("load", () => {
    if (mirrorFrame.dataset.playerId !== String(state.selectedStudentScreenId)) return;
    postStudentMirrorFrame(mirrorFrame, state.studentScreenFocusMarkup);
  });
  $("#studentScreenPrevious").disabled = entries.length < 2;
  $("#studentScreenNext").disabled = entries.length < 2;
}

function openStudentScreenFullscreen() {
  const focus = $("#studentScreenFocus");
  if (!focus) return;
  focus.classList.add("student-screen-full-window");
  if (!document.fullscreenElement) focus.requestFullscreen?.().catch(() => {});
}

function closeStudentScreenFullscreen() {
  $("#studentScreenFocus")?.classList.remove("student-screen-full-window");
  if (document.fullscreenElement?.id === "studentScreenFocus") document.exitFullscreen?.().catch(() => {});
}

function renderStudentScreens() {
  const entries = state.session ? studentScreenEntries() : [];
  const onlineCount = entries.filter(entry => entry.online).length;
  $("#studentScreensOnlineBadge").textContent = onlineCount;
  $("#studentScreensOnlineSummary").textContent = `ออนไลน์ ${onlineCount} จาก ${entries.length} คน`;
  $("#studentScreensContext").textContent = state.session ? `${classContext()} · รหัสห้อง ${state.session.room_code}` : "เปิดคาบเรียนก่อนเพื่อดูจอนักเรียน";
  $("#studentScreensGridButton").classList.toggle("active", state.studentScreenView === "grid");
  $("#studentScreensFocusButton").classList.toggle("active", state.studentScreenView === "focus");
  $("#studentScreensGridButton").setAttribute("aria-pressed", String(state.studentScreenView === "grid"));
  $("#studentScreensFocusButton").setAttribute("aria-pressed", String(state.studentScreenView === "focus"));
  if (!entries.length) {
    show($("#studentScreensEmpty"));
    hide($("#studentScreensGrid"));
    hide($("#studentScreenFocus"));
    $("#studentScreensFocusButton").disabled = true;
    return;
  }
  hide($("#studentScreensEmpty"));
  if (!state.selectedStudentScreenId || !entries.some(entry => String(entry.player.id) === String(state.selectedStudentScreenId))) state.selectedStudentScreenId = String(entries.find(entry => entry.online)?.player.id || entries[0].player.id);
  $("#studentScreensFocusButton").disabled = false;
  if (state.studentScreenView === "focus") {
    hide($("#studentScreensGrid"));
    show($("#studentScreenFocus"));
    renderStudentScreenFocus(entries);
    return;
  }
  hide($("#studentScreenFocus"));
  show($("#studentScreensGrid"));
  $("#studentScreensGrid").innerHTML = entries.map(entry => `<button class="student-screen-card ${entry.online ? "is-online" : "is-offline"}" type="button" data-screen-player="${entry.player.id}">
    ${studentMirrorHtml(entry)}
    <span class="student-screen-card-name"><strong>${escapeHtml(entry.student.full_name || "นักเรียน")}</strong><small>${entry.online ? "แตะเพื่อดูจอรายคน" : "ออฟไลน์"}</small></span>
  </button>`).join("");
  $("#studentScreensGrid").querySelectorAll("[data-screen-player]").forEach(button => button.addEventListener("click", () => {
    state.selectedStudentScreenId = String(button.dataset.screenPlayer);
    state.studentScreenView = "focus";
    renderStudentScreens();
    requestAnimationFrame(openStudentScreenFullscreen);
  }));
}

function setStudentScreenView(view) {
  if (!state.session) return toast("กรุณาเปิดคาบเรียนก่อน", "warning");
  state.studentScreenView = view === "focus" ? "focus" : "grid";
  if (state.studentScreenView === "grid") {
    stopStudentScreenWatch();
    state.studentScreenFocusMarkup = "";
    $("#studentScreenFocusContent")?.removeAttribute("data-player-id");
  }
  if (state.studentScreenView === "grid") closeStudentScreenFullscreen();
  renderStudentScreens();
}

function moveStudentScreen(direction) {
  const entries = studentScreenEntries();
  if (!entries.length) return;
  const currentIndex = Math.max(0, entries.findIndex(entry => String(entry.player.id) === String(state.selectedStudentScreenId)));
  state.selectedStudentScreenId = entries[(currentIndex + direction + entries.length) % entries.length].player.id;
  renderStudentScreens();
}

function subscribeDisplay() {
  state.displayChannel?.unsubscribe();
  return new Promise(resolve => {
    let settled = false;
    const finish = ready => {
      if (settled) return;
      settled = true;
      resolve(ready);
    };
    state.displayChannel = supabase.channel(gameStateChannelName(state.session.id), {
      config: { broadcast: { ack: true } },
    }).subscribe(status => {
      if (status === "SUBSCRIBED") finish(true);
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) finish(false);
    });
    setTimeout(() => finish(false), 5000);
  });
}

async function broadcastDisplay(reason = "state-change") {
  if (!state.displayChannel || !state.session) return;
  try {
    await state.displayChannel.send({
      type: "broadcast",
      event: GAME_STATE_EVENT,
      payload: gameStatePayload(state.session, reason),
    });
  } catch {
    // The durable database state remains the reconnect fallback.
  }
}

async function refreshSessionData() {
  if (!state.session) return;
  const [{ data: players }, { data: leaderboard }] = await Promise.all([
    supabase.from("session_players").select("*, student:students(*)").eq("session_id", state.session.id).order("joined_at"),
    supabase.rpc("get_session_leaderboard", { p_session_id: state.session.id }),
  ]);
  state.players = players || [];
  state.leaderboard = leaderboard || [];
  const playerIds = state.players.map(player => player.id);
  if (playerIds.length) {
    const { data: attempts } = await supabase.from("game_attempts").select("*").in("session_player_id", playerIds).order("completed_at");
    state.attempts = attempts || [];
  } else state.attempts = [];
  await renderPlayers();
  renderMetrics();
  renderLiveResults();
  renderStudentScreens();
  renderReport();
  if (state.flowStep === "summary") renderSummary();
  void finishWhenEveryoneSubmitted();
  broadcastDisplay();
}

async function selfieUrl(path) {
  if (!path) return "";
  const { data } = await supabase.storage.from(APP_CONFIG.selfieBucket).createSignedUrl(path, 900);
  return data?.signedUrl || "";
}

async function renderPlayers() {
  const urls = await Promise.all(state.players.map(player => selfieUrl(player.selfie_path)));
  state.playerSelfieUrls = new Map(state.players.map((player, index) => [player.id, urls[index]]));
  renderPlayerPage();
}

function lobbyViewportMetrics() {
  const list = $("#playerList");
  const pageWidth = document.documentElement.clientWidth || window.innerWidth || 1200;
  const fallbackWidth = pageWidth > 760 ? pageWidth - 360 : pageWidth - 26;
  const fallbackHeight = Math.min(760, Math.max(360, (window.innerHeight || 800) - 430));
  const measuredHeight = list.dataset.allOnPage === "true" ? 0 : list.clientHeight;
  return {
    width: Math.max(list.clientWidth || fallbackWidth, 260),
    height: Math.max(measuredHeight || fallbackHeight, 320),
    gap: 10,
  };
}

function lobbyCapacity(levelIndex) {
  const layout = LOBBY_LAYOUTS[levelIndex];
  const { width, height, gap } = lobbyViewportMetrics();
  const columns = Math.max(1, Math.floor((width + gap) / (layout.minWidth + gap)));
  const rows = Math.max(1, Math.floor((height + gap) / (layout.rowHeight + gap)));
  return { columns, rows, pageSize: columns * rows };
}

function autoLobbyLevel() {
  if (!state.players.length) return 2;
  for (let index = LOBBY_LAYOUTS.length - 2; index >= 0; index -= 1) {
    if (lobbyCapacity(index).pageSize >= state.players.length) return index;
  }
  return 0;
}

function lobbyView() {
  const baseLevel = autoLobbyLevel();
  const levelIndex = Math.min(baseLevel + state.lobbyZoomStep, LOBBY_LAYOUTS.length - 1);
  const capacity = lobbyCapacity(levelIndex);
  const isAutoFit = state.lobbyZoomStep === 0;
  const pageSize = isAutoFit ? Math.max(state.players.length, 1) : capacity.pageSize;
  const pageCount = Math.max(1, Math.ceil(state.players.length / pageSize));
  state.lobbyPage = Math.min(Math.max(state.lobbyPage, 1), pageCount);
  const start = (state.lobbyPage - 1) * pageSize;
  return {
    ...capacity,
    baseLevel,
    levelIndex,
    layout: LOBBY_LAYOUTS[levelIndex],
    isAutoFit,
    pageSize,
    pageCount,
    start,
    players: state.players.slice(start, start + pageSize),
  };
}

function renderPlayerPage() {
  const list = $("#playerList");
  if (!list) return;
  const view = lobbyView();
  const end = Math.min(view.start + view.players.length, state.players.length);
  const rangeText = state.players.length ? `แสดง ${view.start + 1}–${end} จาก ${state.players.length} คน` : "ยังไม่มีนักเรียน";

  $("#lobbySummary").textContent = state.players.length ? `${state.players.length} คนเข้าห้องแล้ว · ${rangeText}` : "ยังไม่มีนักเรียน";
  $("#lobbyZoomLabel").textContent = view.isAutoFit ? `${view.layout.label} · พอดีอัตโนมัติ` : view.layout.label;
  $("#lobbyPageSummary").textContent = `${rangeText} · หน้า ${state.lobbyPage}/${view.pageCount}`;
  $("#lobbyPageIndicator").textContent = `หน้า ${state.lobbyPage} จาก ${view.pageCount}`;
  $("#lobbyZoomOutButton").disabled = state.lobbyZoomStep === 0;
  $("#lobbyZoomInButton").disabled = view.levelIndex >= LOBBY_LAYOUTS.length - 1;
  $("#lobbyPrevPageButton").disabled = state.lobbyPage <= 1;
  $("#lobbyNextPageButton").disabled = state.lobbyPage >= view.pageCount;
  $("#lobbyPagination").classList.toggle("hidden", view.pageCount <= 1);
  list.dataset.size = view.layout.key;
  list.dataset.allOnPage = String(view.isAutoFit && lobbyCapacity(view.levelIndex).pageSize < state.players.length);
  const displayColumns = view.isAutoFit ? Math.min(view.columns, Math.max(view.players.length, 1)) : view.columns;
  const displayRows = view.isAutoFit ? Math.max(1, Math.ceil(view.players.length / displayColumns)) : view.rows;
  list.style.setProperty("--lobby-columns", displayColumns);
  list.style.setProperty("--lobby-rows", displayRows);
  list.style.setProperty("--lobby-row-height", `${view.layout.rowHeight}px`);

  const pendingOnPage = view.players.filter(player => ["waiting", "returned"].includes(player.status));
  const approveButton = $("#approveAllButton");
  approveButton.disabled = pendingOnPage.length === 0;
  approveButton.textContent = pendingOnPage.length ? `✓ อนุมัติ ${pendingOnPage.length} คนในหน้านี้` : "✓ หน้านี้อนุมัติครบแล้ว";

  if (!state.players.length) {
    list.innerHTML = `<div class="empty-report"><span>👋</span><h2>รอนักเรียนเข้าห้อง</h2><p>แสดงรหัส ${state.session.room_code} บนจอหน้าชั้น</p></div>`;
    return;
  }

  list.innerHTML = view.players.map(player => {
    const student = player.student || {};
    const statusClass = `status-${player.status}`;
    const fullName = escapeHtml(student.full_name || "ไม่พบชื่อ");
    const selfie = state.playerSelfieUrls.get(player.id);
    return `<article class="player-row" data-player-id="${player.id}">
      ${selfie ? `<img src="${selfie}" alt="รูปยืนยันตัวตนของ ${fullName}">` : `<span class="avatar-fallback">${escapeHtml(student.avatar || randomAvatar(student.nickname))}</span>`}
      <div class="player-info"><strong title="${fullName}">${fullName}</strong><small class="player-meta">${escapeHtml(student.nickname || "")} · ${escapeHtml(student.student_code || "")}</small><span class="player-status ${statusClass}">${escapeHtml(playerStatusLabel(player.status))}</span>${player.return_reason ? `<small class="player-return-reason">${escapeHtml(player.return_reason)}</small>` : ""}</div>
      <div class="player-row-actions">
        ${player.status !== "approved" ? `<button class="button button-small button-success" data-action="approve" aria-label="อนุมัติ ${fullName}" title="อนุมัติ"><span aria-hidden="true">✓</span><span class="player-action-label">อนุมัติ</span></button>` : ""}
        <button class="button button-small button-ghost" data-action="return" aria-label="ส่งคืน ${fullName}" title="ส่งคืน"><span aria-hidden="true">↩</span><span class="player-action-label">ส่งคืน</span></button>
        <button class="button button-small button-danger" data-action="remove" aria-label="นำ ${fullName} ออกจากห้อง" title="นำออก"><span aria-hidden="true">×</span><span class="player-action-label">นำออก</span></button>
      </div>
    </article>`;
  }).join("");
  list.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => {
    const playerId = button.closest("[data-player-id]").dataset.playerId;
    if (button.dataset.action === "approve") approvePlayer(playerId);
    if (button.dataset.action === "return") openReturnDialog(playerId);
    if (button.dataset.action === "remove") removePlayer(playerId);
  }));
}

function renderMetrics() {
  const approved = state.players.filter(player => player.status === "approved").length;
  $("#approvedCount").textContent = approved;
  $("#waitingCount").textContent = state.players.filter(player => ["waiting", "returned"].includes(player.status)).length;
  $("#liveApprovedCount").textContent = approved;
  const averages = state.leaderboard.map(item => Number(item.average_percent || 0));
  const average = averages.length ? Math.round(averages.reduce((sum, value) => sum + value, 0) / averages.length) : 0;
  $("#averageScore").textContent = `${average}%`;
  const currentPlayerIds = new Set(state.attempts.filter(item => item.activity_key === state.session.current_activity_key).map(item => item.session_player_id));
  $("#completedAttemptCount").textContent = currentPlayerIds.size;
}

async function finishWhenEveryoneSubmitted() {
  if (!state.session?.current_activity_key || state.session.status !== "active" || state.finishingActivity || state.celebrationActivityKey) return;
  const approvedIds = state.players.filter(player => player.status === "approved").map(player => player.id);
  if (!approvedIds.length) return;
  const roundStartedAt = state.activityStartedAt ? new Date(state.activityStartedAt).getTime() - 1000 : 0;
  const submittedIds = new Set(state.attempts
    .filter(attempt => attempt.activity_key === state.session.current_activity_key && new Date(attempt.completed_at).getTime() >= roundStartedAt)
    .map(attempt => attempt.session_player_id));
  if (approvedIds.every(playerId => submittedIds.has(playerId))) await finishActivity("all_submitted");
}

function currentCompetitionEntries() {
  const policy = state.session?.score_policy || "best";
  return state.players.filter(player => player.status === "approved").map(player => {
    const current = state.attempts
      .filter(item => item.session_player_id === player.id && item.activity_key === state.session.current_activity_key)
      .sort((a, b) => Number(a.attempt_no) - Number(b.attempt_no));
    let selected = null;
    if (current.length) {
      if (policy === "first") selected = current[0];
      else if (policy === "latest") selected = current[current.length - 1];
      else selected = current.reduce((best, attempt) => Number(attempt.percent) > Number(best.percent) ? attempt : best, current[0]);
    }
    const student = player.student || {};
    return {
      player,
      name: student.full_name || student.nickname || "นักเรียน",
      avatar: student.avatar || randomAvatar(student.nickname),
      percent: selected ? Number(selected.percent || 0) : null,
      completedAt: selected?.completed_at || "",
      attemptCount: current.length,
    };
  }).sort((a, b) => {
    if (a.percent === null && b.percent !== null) return 1;
    if (a.percent !== null && b.percent === null) return -1;
    if (a.percent !== b.percent) return Number(b.percent || 0) - Number(a.percent || 0);
    if (a.completedAt !== b.completedAt) return String(a.completedAt).localeCompare(String(b.completedAt));
    return a.name.localeCompare(b.name, "th");
  });
}

function rankMedal(rank) {
  return ["🥇", "🥈", "🥉"][rank - 1] || rank;
}

function renderLiveRanking(entries) {
  return `<ol class="competition-ranking-list">${entries.map((entry, index) => {
    const rank = entry.percent === null ? "—" : index + 1;
    return `<li class="competition-rank-row ${entry.percent === null ? "is-waiting" : "has-result"}" style="--rank-index:${index}">
      <span class="competition-rank">${entry.percent === null ? "⏳" : rankMedal(rank)}</span>
      <span class="competition-avatar">${escapeHtml(entry.avatar)}</span>
      <span class="competition-student"><strong>${escapeHtml(entry.name)}</strong><small>${entry.percent === null ? "กำลังทำเกม" : `ส่งแล้ว ${entry.attemptCount} รอบ`}</small></span>
      <strong class="competition-score">${entry.percent === null ? "รอผล" : `${Math.round(entry.percent)}%`}</strong>
    </li>`;
  }).join("")}</ol>`;
}

function celebrationConfetti() {
  const colors = ["#ffd65a", "#ff7185", "#6c5ce7", "#41c7a2", "#53b9f1", "#ffffff"];
  return Array.from({ length: 72 }, (_, index) => {
    const x = (index * 37) % 101;
    const delay = ((index * 13) % 28) / 20;
    const duration = 2.8 + ((index * 17) % 18) / 10;
    const drift = ((index * 29) % 180) - 90;
    return `<i style="--confetti-x:${x}%;--confetti-delay:${delay}s;--confetti-duration:${duration}s;--confetti-drift:${drift}px;--confetti-color:${colors[index % colors.length]}"></i>`;
  }).join("");
}

function renderPodiumPlace(entry, rank) {
  const labels = ["ชนะเลิศ", "รองชนะเลิศอันดับ 1", "รองชนะเลิศอันดับ 2"];
  if (!entry) return `<article class="podium-place podium-place-${rank} is-empty"><div class="podium-person"><span>⭐</span><strong>รอผู้เข้าแข่งขัน</strong></div><div class="podium-block"><strong>${rank}</strong><small>อันดับ</small></div></article>`;
  return `<article class="podium-place podium-place-${rank}">
    <div class="podium-person"><span class="podium-medal">${rankMedal(rank)}</span><span class="podium-avatar">${escapeHtml(entry.avatar)}</span><strong>${escapeHtml(entry.name)}</strong><em>${Math.round(entry.percent)}%</em><small>${labels[rank - 1]}</small></div>
    <div class="podium-block"><strong>${rank}</strong><small>อันดับ</small></div>
  </article>`;
}

function renderCelebration(entries) {
  const ranked = entries.filter(entry => entry.percent !== null);
  const waiting = entries.filter(entry => entry.percent === null);
  const podiumOrder = [[ranked[1], 2], [ranked[0], 1], [ranked[2], 3]];
  const runnersUp = ranked.slice(3);
  const reasonLabel = ({ all_submitted: "นักเรียนส่งครบทุกคน", time_up: "หมดเวลา", manual: "คุณครูจบเกม" })[state.celebrationReason] || "จบเกม";
  return `<div class="competition-celebration" aria-hidden="true">${celebrationConfetti()}</div>
    <div class="celebration-title"><span>✨ ${reasonLabel} · ประกาศผลการแข่งขัน ✨</span><h4>${escapeHtml(ACTIVITIES.find(item => item.key === state.session.current_activity_key)?.title || "เกมนี้")}</h4><p>ขอเสียงปรบมือให้ผู้เข้าแข่งขันทุกคน</p></div>
    <div class="competition-finale">
      <section class="podium-stage" aria-label="แท่นรับรางวัลอันดับ 1 ถึง 3">
        <div class="podium-list">${podiumOrder.map(([entry, rank]) => renderPodiumPlace(entry, rank)).join("")}</div>
      </section>
      <aside class="runnerup-board">
        <h5>อันดับ 4 เป็นต้นไป</h5>
        ${runnersUp.length ? `<ol start="4">${runnersUp.map((entry, index) => `<li style="--rank-index:${index}"><span>${index + 4}</span><span>${escapeHtml(entry.avatar)}</span><strong>${escapeHtml(entry.name)}</strong><em>${Math.round(entry.percent)}%</em></li>`).join("")}</ol>` : `<p class="runnerup-empty">ยังไม่มีอันดับเพิ่มเติม</p>`}
        ${waiting.length ? `<div class="competition-waiting"><strong>กำลังทำเกม ${waiting.length} คน</strong><span>${waiting.map(entry => escapeHtml(entry.name)).join(" · ")}</span></div>` : ""}
      </aside>
    </div>`;
}

function renderLiveResults() {
  const container = $("#liveResults");
  const arena = $("#competitionArena");
  const status = $("#competitionStatus");
  const finishButton = $("#finishActivityButton");
  const liveBadge = $("#competitionLiveBadge");
  const lastUpdate = $("#competitionLastUpdate");
  if (!container || !state.session) return;
  const entries = currentCompetitionEntries();
  const resultCount = entries.filter(entry => entry.percent !== null).length;
  const isCelebrating = state.celebrationActivityKey === state.session.current_activity_key;
  arena?.classList.toggle("is-celebrating", isCelebrating);
  if (liveBadge) {
    liveBadge.classList.toggle("is-finished", isCelebrating);
    liveBadge.innerHTML = isCelebrating ? "🏆 ผลประกาศแล้ว" : "<i></i> LIVE";
  }
  if (lastUpdate) lastUpdate.textContent = `อัปเดต ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  if (finishButton) {
    finishButton.disabled = isCelebrating || state.finishingActivity || !state.session.current_activity_key;
    finishButton.textContent = state.finishingActivity ? "กำลังจบเกม..." : isCelebrating ? "✓ จบเกมแล้ว" : "⏹ จบเกม";
  }
  if (status) status.textContent = isCelebrating
    ? `ประกาศผลแล้ว ${resultCount} คน · พร้อมไปเกมถัดไป`
    : state.session.status === "paused"
      ? `พักเกมอยู่ · ส่งคำตอบแล้ว ${resultCount}/${entries.length} คน`
      : `ส่งคำตอบแล้ว ${resultCount}/${entries.length} คน · จบอัตโนมัติเมื่อส่งครบหรือเวลาหมด`;
  if (!entries.length) {
    container.innerHTML = `<div class="flow-empty-state"><span>👥</span><strong>ยังไม่มีนักเรียนที่อนุมัติ</strong><small>กลับไปห้องรอเพื่อตรวจรายชื่อได้</small></div>`;
    return;
  }
  container.innerHTML = isCelebrating ? renderCelebration(entries) : renderLiveRanking(entries);
}

let victoryAudioContext;
function prepareVictoryAudio() {
  if (!state.competitionSoundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  victoryAudioContext ||= new AudioContextClass();
  if (victoryAudioContext.state === "suspended") victoryAudioContext.resume().catch(() => {});
  return victoryAudioContext;
}

function playVictorySound() {
  const context = prepareVictoryAudio();
  if (!context) return;
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  const now = context.currentTime;
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index < 3 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * .16);
    gain.gain.exponentialRampToValueAtTime(.16, now + index * .16 + .025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * .16 + .3);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + index * .16);
    oscillator.stop(now + index * .16 + .32);
  });
}

async function finishActivity(reason = "manual") {
  if (!state.session?.current_activity_key || state.finishingActivity || state.celebrationActivityKey) return;
  prepareVictoryAudio();
  state.finishingActivity = true;
  renderLiveResults();
  const { data, error } = await supabase.from("class_sessions").update({ status: "paused" }).eq("id", state.session.id).select().single();
  if (error) {
    state.finishingActivity = false;
    renderLiveResults();
    return toast(error.message, "error");
  }
  state.session = data;
  state.celebrationActivityKey = state.session.current_activity_key;
  state.celebrationReason = reason;
  state.finishingActivity = false;
  stopActivityTimer({ clearSaved: true, label: "จบเกม" });
  $("#pauseSessionButton").textContent = "เล่นรอบนี้ต่อ";
  renderLiveResults();
  playVictorySound();
  broadcastDisplay();
  const message = ({ all_submitted: "นักเรียนส่งครบทุกคน จบเกมอัตโนมัติแล้ว", time_up: "หมดเวลา จบเกมอัตโนมัติแล้ว", manual: "จบเกมและประกาศผลแล้ว" })[reason] || "จบเกมแล้ว";
  toast(message, "success");
  if (state.flowStep === "live") $("#competitionArena").scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleCompetitionExpanded() {
  const arena = $("#competitionArena");
  const button = $("#competitionFullscreenButton");
  const expanded = !arena.classList.contains("competition-expanded");
  arena.classList.toggle("competition-expanded", expanded);
  document.body.classList.toggle("competition-overlay-open", expanded);
  button.setAttribute("aria-pressed", String(expanded));
  button.innerHTML = expanded ? "✕ <span>ปิดเต็มจอ</span>" : "⛶ <span>เต็มจอ</span>";
}

function toggleCompetitionSound() {
  state.competitionSoundEnabled = !state.competitionSoundEnabled;
  const button = $("#competitionSoundButton");
  button.setAttribute("aria-pressed", String(state.competitionSoundEnabled));
  button.innerHTML = state.competitionSoundEnabled ? "🔊 <span>เสียง</span>" : "🔇 <span>ปิดเสียง</span>";
  toast(state.competitionSoundEnabled ? "เปิดเสียงประกาศผลแล้ว" : "ปิดเสียงประกาศผลแล้ว", "success");
}

function renderSummary() {
  if (!state.session) return;
  const approved = state.players.filter(player => player.status === "approved");
  const averages = state.leaderboard.map(item => Number(item.average_percent || 0));
  const average = averages.length ? Math.round(averages.reduce((sum, value) => sum + value, 0) / averages.length) : 0;
  const completedActivities = new Set(state.attempts.map(item => item.activity_key)).size;
  $("#summaryApproved").textContent = approved.length;
  $("#summaryAverage").textContent = `${average}%`;
  $("#summaryCompleted").textContent = `${completedActivities}/${ACTIVITIES.length}`;
  const rows = approved.map(player => {
    const groups = bestAttemptsForPlayer(player.id);
    const bestScores = [...groups.values()].map(items => Math.max(...items.map(item => Number(item.percent || 0))));
    const bestAverage = bestScores.length ? Math.round(bestScores.reduce((sum, value) => sum + value, 0) / bestScores.length) : 0;
    return { player, completed: groups.size, bestAverage };
  });
  $("#summaryContent").innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>นักเรียน</th><th>เกมที่ทำ</th><th>คะแนนดีที่สุดเฉลี่ย</th><th>ผล</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.player.student?.full_name || "—")}</td><td>${row.completed}/${ACTIVITIES.length}</td><td>${row.bestAverage}%</td><td><span class="summary-pass ${row.bestAverage >= state.session.pass_percent ? "passed" : "needs-work"}">${row.bestAverage >= state.session.pass_percent ? "ผ่าน" : "ควรเสริม"}</span></td></tr>`).join("")}</tbody></table></div>` : `<div class="flow-empty-state"><span>📊</span><strong>ยังไม่มีคะแนนในคาบนี้</strong><small>กลับไปเริ่มเกมหรือรอให้นักเรียนส่งคำตอบ</small></div>`;
}

async function approvePlayer(playerId) {
  const { error } = await supabase.from("session_players").update({ status: "approved", approved_at: new Date().toISOString(), return_reason: null }).eq("id", playerId);
  if (error) toast(error.message, "error");
}

async function approveAll() {
  const playerIds = lobbyView().players.filter(player => ["waiting", "returned"].includes(player.status)).map(player => player.id);
  if (!playerIds.length) return toast("นักเรียนในหน้านี้ได้รับการอนุมัติครบแล้ว", "warning");
  const button = $("#approveAllButton");
  button.disabled = true;
  const { error } = await supabase.from("session_players").update({ status: "approved", approved_at: new Date().toISOString(), return_reason: null }).eq("session_id", state.session.id).in("id", playerIds).in("status", ["waiting", "returned"]);
  if (error) {
    button.disabled = false;
    toast(error.message, "error");
  }
  else {
    toast(`อนุมัตินักเรียน ${playerIds.length} คนในหน้านี้แล้ว`, "success");
    await refreshSessionData();
  }
}

function openReturnDialog(playerId) {
  $("#returnPlayerId").value = playerId;
  show($("#returnDialog"));
}

async function returnPlayer(event) {
  event.preventDefault();
  const { error } = await supabase.from("session_players").update({ status: "returned", return_reason: $("#returnReason").value, approved_at: null }).eq("id", $("#returnPlayerId").value);
  hide($("#returnDialog"));
  if (error) toast(error.message, "error");
}

async function removePlayer(playerId) {
  const { error } = await supabase.from("session_players").update({ status: "removed" }).eq("id", playerId);
  if (error) toast(error.message, "error");
}

async function closeSession() {
  if (!confirm("ปิดคาบเรียนและลบรูปเซลฟี่ทั้งหมดใช่หรือไม่?")) return;
  const { data: storedPlayers, error: playerError } = await supabase.from("session_players").select("selfie_path").eq("session_id", state.session.id);
  if (playerError) return toast(`ตรวจรายการรูปไม่สำเร็จ: ${playerError.message}`, "error");
  const paths = (storedPlayers || []).map(player => player.selfie_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(APP_CONFIG.selfieBucket).remove(paths);
    if (storageError) return toast(`ยังลบรูปไม่สำเร็จ: ${storageError.message}`, "error");
    await supabase.from("session_players").update({ selfie_path: null }).eq("session_id", state.session.id);
  }
  const { error } = await supabase.from("class_sessions").update({ status: "closed", ended_at: new Date().toISOString() }).eq("id", state.session.id);
  if (error) return toast(error.message, "error");
  broadcastDisplay();
  stopStudentScreenWatch();
  state.sessionChannel?.unsubscribe();
  state.presenceChannel?.unsubscribe();
  state.displayChannel?.unsubscribe();
  stopActivityTimer({ clearSaved: true, label: "--:--" });
  state.session = null;
  state.players = [];
  state.attempts = [];
  state.leaderboard = [];
  state.playerSelfieUrls = new Map();
  state.studentScreens = new Map();
  state.studentScreenView = "grid";
  state.studentScreenFocusMarkup = "";
  state.selectedStudentScreenId = null;
  state.lateJoinMode = false;
  state.lateJoinResumeStatus = "paused";
  state.lobbyPage = 1;
  state.lobbyZoomStep = 0;
  state.celebrationActivityKey = null;
  state.celebrationReason = null;
  state.activityRemainingMs = 0;
  state.activityStartedAt = null;
  state.finishingActivity = false;
  renderStudentScreens();
  $("#competitionArena")?.classList.remove("competition-expanded", "is-celebrating");
  document.body.classList.remove("competition-overlay-open");
  hide($("#liveSession"));
  hide($("#resumeSessionView"));
  show($("#sessionSetup"));
  setTeacherFlowStep("class");
  toast("ปิดคาบและลบรูปเรียบร้อย", "success");
}

async function addStudent(event) {
  event.preventDefault();
  const selectedClass = state.classes.find(item => item.id === $("#rosterClassSelect").value);
  if (!selectedClass) return;
  const nickname = $("#studentNickname").value.trim();
  const { error } = await supabase.from("students").upsert({
    class_id: selectedClass.id,
    student_code: $("#studentCode").value.trim(),
    full_name: $("#studentFullName").value.trim(),
    nickname,
    avatar: randomAvatar(nickname),
    active: true,
  }, { onConflict: "class_id,student_code" });
  if (error) return toast(error.message, "error");
  event.target.reset();
  toast("บันทึกรายชื่อแล้ว", "success");
  await loadRoster();
}

async function loadRoster() {
  if (!state.profile) return;
  const classIds = state.classes.map(item => item.id);
  if (!classIds.length) {
    state.rosterCounts = new Map();
    $("#rosterCount").textContent = "0 คน";
    $("#rosterTableBody").innerHTML = `<tr><td colspan="5">ยังไม่มีห้องเรียนที่ได้รับมอบหมาย</td></tr>`;
    return;
  }
  const { data, error } = await supabase.from("students").select("*, classroom:classes(*, school:schools(name))").in("class_id", classIds).order("student_code");
  if (error) return toast(`โหลดรายชื่อนักเรียนไม่สำเร็จ: ${error.message}`, "error");
  const rows = data || [];
  state.rosterCounts = rows.filter(student => student.active).reduce((counts, student) => {
    counts.set(student.class_id, (counts.get(student.class_id) || 0) + 1);
    return counts;
  }, new Map());
  updateSelectedClassRosterNote();
  $("#rosterCount").textContent = `${rows.length} คน`;
  $("#rosterTableBody").innerHTML = rows.length ? rows.map(student => `<tr><td>${escapeHtml(student.classroom?.label || "—")}</td><td>${escapeHtml(student.student_code)}</td><td>${escapeHtml(student.full_name)}</td><td>${escapeHtml(student.nickname)}</td><td>${student.active ? "ใช้งาน" : "พักใช้"}</td></tr>`).join("") : `<tr><td colspan="5">ยังไม่มีรายชื่อนักเรียน</td></tr>`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if ((character === "," || character === "\t") && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const headers = rows.shift()?.map(header => header.replace(/^\ufeff/, "").trim()) || [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function valueFrom(row, keys) {
  const entry = Object.entries(row).find(([key]) => keys.includes(key.toLowerCase().trim()));
  return entry?.[1]?.toString().trim() || "";
}

async function parseImportFile(file) {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
}

function normalizeClassLabel(value) {
  const cleaned = String(value).replace(/\s/g, "").replace(/^ชั้น/, "");
  const match = cleaned.match(/(?:ป\.)?(\d)[\/-](\d+)/i);
  return match ? `ป.${Number(match[1])}/${Number(match[2])}` : cleaned;
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const rawRows = await parseImportFile(file);
    state.importRows = rawRows.map(row => ({
      classLabel: normalizeClassLabel(valueFrom(row, ["class", "classroom", "ห้อง", "ชั้น"])),
      studentCode: valueFrom(row, ["student_code", "student code", "เลขประจำตัว", "รหัสนักเรียน"]),
      fullName: valueFrom(row, ["full_name", "full name", "name", "ชื่อ-นามสกุล", "ชื่อ–นามสกุล", "ชื่อ"]),
      nickname: valueFrom(row, ["nickname", "nick name", "ชื่อเล่น"]),
    })).filter(row => row.classLabel && row.studentCode && row.fullName);
    $("#importPreview").innerHTML = state.importRows.length
      ? `<div class="room-found">พบข้อมูล ${state.importRows.length} คน</div><button id="confirmImport" class="button button-primary full" style="margin-top:10px">นำเข้ารายชื่อ</button>`
      : `<p class="field-help">ไม่พบคอลัมน์ที่ต้องการ กรุณาตรวจหัวตาราง</p>`;
    $("#confirmImport")?.addEventListener("click", importStudents);
  } catch (error) {
    toast(`อ่านไฟล์ไม่สำเร็จ: ${error.message}`, "error");
  }
}

async function importStudents() {
  const classMap = new Map(state.classes.map(item => [item.label, item.id]));
  const payload = state.importRows.map(row => ({
    class_id: classMap.get(row.classLabel),
    student_code: row.studentCode,
    full_name: row.fullName,
    nickname: row.nickname || row.fullName.split(/\s+/)[0],
    avatar: randomAvatar(row.nickname || row.studentCode),
    active: true,
  })).filter(row => row.class_id);
  if (!payload.length) return toast("ไม่พบชื่อห้องที่ตรงกับระบบ", "error");
  const { error } = await supabase.from("students").upsert(payload, { onConflict: "class_id,student_code" });
  if (error) return toast(error.message, "error");
  toast(`นำเข้าสำเร็จ ${payload.length} คน`, "success");
  state.importRows = [];
  $("#importPreview").innerHTML = "";
  $("#csvFile").value = "";
  await loadRoster();
}

function bestAttemptsForPlayer(playerId) {
  const grouped = new Map();
  state.attempts.filter(item => item.session_player_id === playerId).forEach(attempt => {
    const group = grouped.get(attempt.activity_key) || [];
    group.push(attempt);
    grouped.set(attempt.activity_key, group);
  });
  return grouped;
}

function renderReport() {
  if (!state.session) return;
  const rows = state.players.filter(player => player.status === "approved").map(player => {
    const groups = bestAttemptsForPlayer(player.id);
    const first = [...groups.values()].map(items => items.sort((a, b) => a.attempt_no - b.attempt_no)[0]?.percent || 0);
    const best = [...groups.values()].map(items => Math.max(...items.map(item => Number(item.percent))));
    return { player, activities: groups.size, first: first.length ? Math.round(first.reduce((a, b) => a + Number(b), 0) / first.length) : 0, best: best.length ? Math.round(best.reduce((a, b) => a + b, 0) / best.length) : 0 };
  });
  $("#reportContent").innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>นักเรียน</th><th>ทำแล้ว</th><th>คะแนนครั้งแรกเฉลี่ย</th><th>คะแนนดีที่สุดเฉลี่ย</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.player.student?.full_name || "—")}</td><td>${row.activities}/${ACTIVITIES.length}</td><td>${row.first}%</td><td>${row.best}%</td></tr>`).join("")}</tbody></table></div>` : `<span>📊</span><h2>ยังไม่มีคะแนนในคาบนี้</h2><p>ผลจะปรากฏเมื่อนักเรียนเริ่มทำกิจกรรม</p>`;
}

function exportCurrentReport() {
  if (!state.session) return toast("ยังไม่มีคาบเรียนให้ส่งออก", "warning");
  const rows = [["ห้อง", "เลขประจำตัว", "ชื่อ-นามสกุล", "ชื่อเล่น", "กิจกรรม", "ครั้งที่", "คะแนน", "คะแนนเต็ม", "ร้อยละ", "ผ่าน", "เวลา"]];
  state.attempts.forEach(attempt => {
    const player = state.players.find(item => item.id === attempt.session_player_id);
    const student = player?.student || {};
    rows.push([
      state.classes.find(item => item.id === state.session.class_id)?.label || "",
      student.student_code, student.full_name, student.nickname,
      ACTIVITIES.find(item => item.key === attempt.activity_key)?.title || attempt.activity_key,
      attempt.attempt_no, attempt.score, attempt.max_score, attempt.percent,
      attempt.passed ? "ผ่าน" : "ไม่ผ่าน", attempt.completed_at,
    ]);
  });
  downloadCsv(`รายงาน-${state.session.room_code}.csv`, rows);
}

function switchPanel(panelId) {
  $$("#dashboardNav button").forEach(button => button.classList.toggle("active", button.dataset.panel === panelId));
  $$(".dashboard-panel").forEach(panel => panel.classList.toggle("active", panel.id === panelId));
  if (panelId === "studentScreensPanel") {
    state.studentScreenView = "grid";
    stopStudentScreenWatch();
    renderStudentScreens();
  } else stopStudentScreenWatch();
}

$("#teacherLoginForm").addEventListener("submit", signIn);
$("#signOutButton").addEventListener("click", signOut);
$("#sessionSetup").addEventListener("submit", createSession);
$("#schoolSelect").addEventListener("change", event => renderClassOptions(event.target.value));
$("#classSelect").addEventListener("change", updateSelectedClassRosterNote);
$("#schoolSetupForm").addEventListener("submit", setupSchool);
$("#manualStudentForm").addEventListener("submit", addStudent);
$("#csvFile").addEventListener("change", handleImportFile);
$("#approveAllButton").addEventListener("click", approveAll);
$("#lobbyZoomOutButton").addEventListener("click", () => {
  if (state.lobbyZoomStep <= 0) return;
  state.lobbyZoomStep -= 1;
  state.lobbyPage = 1;
  renderPlayerPage();
});
$("#lobbyZoomInButton").addEventListener("click", () => {
  const view = lobbyView();
  if (view.levelIndex >= LOBBY_LAYOUTS.length - 1) return;
  state.lobbyZoomStep += 1;
  state.lobbyPage = 1;
  renderPlayerPage();
});
$("#lobbyPrevPageButton").addEventListener("click", () => {
  state.lobbyPage = Math.max(1, state.lobbyPage - 1);
  renderPlayerPage();
  $("#playerList").scrollIntoView({ behavior: "smooth", block: "nearest" });
});
$("#lobbyNextPageButton").addEventListener("click", () => {
  state.lobbyPage = Math.min(lobbyView().pageCount, state.lobbyPage + 1);
  renderPlayerPage();
  $("#playerList").scrollIntoView({ behavior: "smooth", block: "nearest" });
});
$("#pauseSessionButton").addEventListener("click", togglePause);
$("#openLateJoinButton").addEventListener("click", openLateJoin);
$("#closeSessionButton").addEventListener("click", closeSession);
$("#qrCloseButton").addEventListener("click", closeSession);
$("#qrNextButton").addEventListener("click", () => setTeacherFlowStep("lobby"));
$("#lobbyBackButton").addEventListener("click", handleLobbyBack);
$("#lobbyNextButton").addEventListener("click", handleLobbyNext);
$("#planBackButton").addEventListener("click", () => setTeacherFlowStep("lobby"));
$("#startPlanButton").addEventListener("click", startSelectedPlan);
$("#finishActivityButton").addEventListener("click", () => finishActivity("manual"));
$("#nextActivityButton").addEventListener("click", goToNextActivity);
$("#competitionFullscreenButton").addEventListener("click", toggleCompetitionExpanded);
$("#competitionSoundButton").addEventListener("click", toggleCompetitionSound);
$$('[data-live-mode]').forEach(button => button.addEventListener("click", () => setLivePlayMode(button.dataset.liveMode)));
$("#showSummaryButton").addEventListener("click", showSessionSummary);
$("#summaryBackButton").addEventListener("click", () => setTeacherFlowStep("live"));
$("#summaryExportButton").addEventListener("click", exportCurrentReport);
$("#resumeSessionButton").addEventListener("click", () => showLiveSession(state.session.status === "lobby" ? (state.session.current_activity_key ? "lobby" : "qr") : "live"));
$("#resumeSummaryButton").addEventListener("click", () => showLiveSession("summary"));
$("#restartSessionButton").addEventListener("click", closeSession);
$("#copyRoomCode").addEventListener("click", async () => { await navigator.clipboard.writeText(state.session.room_code); toast("คัดลอกรหัสห้องแล้ว", "success"); });
$("#copyStudentLink").addEventListener("click", async () => { await navigator.clipboard.writeText(studentJoinUrl()); toast("คัดลอกลิงก์นักเรียนแล้ว", "success"); });
$("#returnForm").addEventListener("submit", returnPlayer);
$("#cancelReturn").addEventListener("click", () => hide($("#returnDialog")));
$("#exportCsvButton").addEventListener("click", exportCurrentReport);
$("#backToSessionButton").addEventListener("click", () => switchPanel("sessionPanel"));
$("#studentScreensGridButton").addEventListener("click", () => setStudentScreenView("grid"));
$("#studentScreensFocusButton").addEventListener("click", () => {
  setStudentScreenView("focus");
  requestAnimationFrame(openStudentScreenFullscreen);
});
$("#studentScreenBackToGrid").addEventListener("click", () => setStudentScreenView("grid"));
$("#studentScreenPrevious").addEventListener("click", () => moveStudentScreen(-1));
$("#studentScreenNext").addEventListener("click", () => moveStudentScreen(1));
$("#studentScreenFullscreen").addEventListener("click", openStudentScreenFullscreen);
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) $("#studentScreenFocus")?.classList.remove("student-screen-full-window");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && $("#studentScreenFocus")?.classList.contains("student-screen-full-window")) setStudentScreenView("grid");
});
$("#newSessionButton").addEventListener("click", () => { if (state.session) toast("ปิดคาบปัจจุบันก่อนเปิดคาบใหม่", "warning"); else { show($("#sessionSetup")); $("#sessionSetup").scrollIntoView({ behavior: "smooth" }); } });
$("#attemptMode").addEventListener("change", event => { $("#maxAttempts").disabled = event.target.value !== "limited"; if (event.target.value === "single") $("#maxAttempts").value = 1; });
$$('#dashboardNav button').forEach(button => button.addEventListener("click", () => switchPanel(button.dataset.panel)));
window.addEventListener("online", connectionUpdate);
window.addEventListener("offline", connectionUpdate);
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && $("#competitionArena")?.classList.contains("competition-expanded")) toggleCompetitionExpanded();
});
let lobbyResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(lobbyResizeTimer);
  lobbyResizeTimer = setTimeout(() => {
    if (state.flowStep === "lobby") renderPlayerPage();
  }, 120);
});
bootstrap();
