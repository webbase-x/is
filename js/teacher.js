import { APP_CONFIG } from "./config.js";
import { supabase } from "./supabase.js";
import {
  $, $$, ACTIVITIES, downloadCsv, escapeHtml, hide, modeLabel, playerStatusLabel,
  randomAvatar, renderPlanTimeline, show, toast, updateConnectionBadge,
} from "./common.js";

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
};

function connectionUpdate() {
  updateConnectionBadge($("#teacherConnection"), navigator.onLine, navigator.onLine ? "เชื่อมต่อแล้ว" : "ไม่มีอินเทอร์เน็ต");
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
  await Promise.all([loadClasses(), loadPlans(), loadRoster()]);
  await restoreActiveSession();
}

async function signOut() {
  await supabase.auth.signOut();
  location.reload();
}

async function loadClasses() {
  const { data, error } = await supabase.from("classes").select("*, school:schools(id,name,code)").eq("active", true).order("grade").order("room_no");
  if (error) return toast(error.message, "error");
  state.classes = data || [];
  const options = `<option value="">เลือกห้อง</option>${state.classes.map(item => `<option value="${item.id}">${escapeHtml(item.school?.name)} · ${escapeHtml(item.label)}</option>`).join("")}`;
  $("#classSelect").innerHTML = options;
  $("#rosterClassSelect").innerHTML = options;
}

async function loadPlans() {
  const { data, error } = await supabase.from("lesson_plans").select("*").order("sequence_no");
  if (error) return toast(error.message, "error");
  state.plans = data || [];
  $("#planSelect").innerHTML = state.plans.map(plan => `<option value="${plan.id}" ${plan.published ? "" : "disabled"}>แผนที่ ${plan.sequence_no} · ${escapeHtml(plan.title)}${plan.published ? "" : " (ยังไม่เปิด)"}</option>`).join("");
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
  button.disabled = true;
  button.textContent = "กำลังเปิดห้อง...";
  try {
    const attemptMode = $("#attemptMode").value;
    const maxAttempts = attemptMode === "single" ? 1 : Number($("#maxAttempts").value);
    const { data, error } = await supabase.rpc("create_class_session", {
      p_class_id: $("#classSelect").value,
      p_plan_id: Number($("#planSelect").value),
      p_play_mode: $("#playMode").value,
      p_attempt_mode: attemptMode,
      p_max_attempts: maxAttempts,
      p_score_policy: $("#scorePolicy").value,
      p_leaderboard_mode: $("#leaderboardMode").value,
      p_pass_percent: Number($("#passPercent").value),
    });
    if (error) throw error;
    state.session = data;
    await showLiveSession();
    toast("เปิดห้องเรียนแล้ว", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "สร้างรหัสห้องเรียน";
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
  await showLiveSession();
}

async function showLiveSession() {
  hide($("#sessionSetup"));
  show($("#liveSession"));
  $("#liveRoomCode").textContent = state.session.room_code;
  await renderStudentAccess();
  $("#openDisplayButton").href = `display.html?room=${state.session.room_code}`;
  $("#pauseSessionButton").textContent = state.session.status === "paused" ? "เล่นต่อ" : "พักเกม";
  renderActivityControls();
  subscribeToSession();
  subscribePresence();
  subscribeDisplay();
  await refreshSessionData();
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
}

async function startActivity(activityKey) {
  const updates = { status: "active", current_activity_key: activityKey };
  if (!state.session.started_at) updates.started_at = new Date().toISOString();
  const { data, error } = await supabase.from("class_sessions").update(updates).eq("id", state.session.id).select().single();
  if (error) return toast(error.message, "error");
  state.session = data;
  renderActivityControls();
  $("#pauseSessionButton").textContent = "พักเกม";
  broadcastDisplay();
  toast(`เริ่ม ${ACTIVITIES.find(item => item.key === activityKey)?.title}`, "success");
}

async function togglePause() {
  const status = state.session.status === "paused" ? "active" : "paused";
  const { data, error } = await supabase.from("class_sessions").update({ status }).eq("id", state.session.id).select().single();
  if (error) return toast(error.message, "error");
  state.session = data;
  $("#pauseSessionButton").textContent = status === "paused" ? "เล่นต่อ" : "พักเกม";
  broadcastDisplay();
}

function subscribeToSession() {
  state.sessionChannel?.unsubscribe();
  state.sessionChannel = supabase.channel(`teacher-session-${state.session.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${state.session.id}` }, refreshSessionData)
    .on("postgres_changes", { event: "*", schema: "public", table: "game_attempts" }, payload => {
      const playerIds = new Set(state.players.map(player => player.id));
      if (playerIds.has(payload.new?.session_player_id || payload.old?.session_player_id)) refreshSessionData();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${state.session.id}` }, payload => {
      state.session = payload.new;
      renderActivityControls();
    })
    .subscribe();
}

function subscribePresence() {
  state.presenceChannel?.unsubscribe();
  state.presenceChannel = supabase.channel(`classroom-${state.session.id}`, { config: { presence: { key: `teacher-${state.user.id}` } } })
    .on("presence", { event: "sync" }, () => {
      const presence = state.presenceChannel.presenceState();
      const students = Object.values(presence).flat().filter(item => item.role === "student");
      $("#onlineCount").textContent = new Set(students.map(item => item.player_id)).size;
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") state.presenceChannel.track({ role: "teacher", online_at: new Date().toISOString() });
    });
}

function subscribeDisplay() {
  state.displayChannel?.unsubscribe();
  state.displayChannel = supabase.channel(`display-${state.session.id}`).subscribe();
}

function broadcastDisplay() {
  state.displayChannel?.send({ type: "broadcast", event: "state-change", payload: { at: Date.now() } });
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
  renderReport();
  broadcastDisplay();
}

async function selfieUrl(path) {
  if (!path) return "";
  const { data } = await supabase.storage.from(APP_CONFIG.selfieBucket).createSignedUrl(path, 900);
  return data?.signedUrl || "";
}

async function renderPlayers() {
  const list = $("#playerList");
  $("#lobbySummary").textContent = state.players.length ? `${state.players.length} คนเข้าห้องแล้ว` : "ยังไม่มีนักเรียน";
  if (!state.players.length) {
    list.innerHTML = `<div class="empty-report" style="min-height:230px"><span>👋</span><h2>รอนักเรียนเข้าห้อง</h2><p>แสดงรหัส ${state.session.room_code} บนจอหน้าชั้น</p></div>`;
    return;
  }
  const urls = await Promise.all(state.players.map(player => selfieUrl(player.selfie_path)));
  list.innerHTML = state.players.map((player, index) => {
    const student = player.student || {};
    const statusClass = `status-${player.status}`;
    return `<article class="player-row" data-player-id="${player.id}">
      ${urls[index] ? `<img src="${urls[index]}" alt="รูปยืนยันตัวตนของ ${escapeHtml(student.full_name)}">` : `<span class="avatar-fallback">${escapeHtml(student.avatar || randomAvatar(student.nickname))}</span>`}
      <div><strong>${escapeHtml(student.full_name || "ไม่พบชื่อ")}</strong><small>${escapeHtml(student.nickname || "")} · ${escapeHtml(student.student_code || "")}</small><span class="player-status ${statusClass}">${escapeHtml(playerStatusLabel(player.status))}</span>${player.return_reason ? `<small>${escapeHtml(player.return_reason)}</small>` : ""}</div>
      <div class="player-row-actions">
        ${player.status !== "approved" ? `<button class="button button-small button-success" data-action="approve">อนุมัติ</button>` : ""}
        <button class="button button-small button-ghost" data-action="return">ส่งคืน</button>
        <button class="button button-small button-danger" data-action="remove">นำออก</button>
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
  const averages = state.leaderboard.map(item => Number(item.average_percent || 0));
  $("#averageScore").textContent = averages.length ? `${Math.round(averages.reduce((sum, value) => sum + value, 0) / averages.length)}%` : "0%";
}

async function approvePlayer(playerId) {
  const { error } = await supabase.from("session_players").update({ status: "approved", approved_at: new Date().toISOString(), return_reason: null }).eq("id", playerId);
  if (error) toast(error.message, "error");
}

async function approveAll() {
  const { error } = await supabase.from("session_players").update({ status: "approved", approved_at: new Date().toISOString(), return_reason: null }).eq("session_id", state.session.id).in("status", ["waiting", "returned"]);
  if (error) toast(error.message, "error");
  else toast("อนุมัตินักเรียนทั้งหมดแล้ว", "success");
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
  const paths = state.players.map(player => player.selfie_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(APP_CONFIG.selfieBucket).remove(paths);
    if (storageError) return toast(`ยังลบรูปไม่สำเร็จ: ${storageError.message}`, "error");
    await supabase.from("session_players").update({ selfie_path: null }).eq("session_id", state.session.id);
  }
  const { error } = await supabase.from("class_sessions").update({ status: "closed", ended_at: new Date().toISOString() }).eq("id", state.session.id);
  if (error) return toast(error.message, "error");
  broadcastDisplay();
  state.sessionChannel?.unsubscribe();
  state.presenceChannel?.unsubscribe();
  state.displayChannel?.unsubscribe();
  state.session = null;
  hide($("#liveSession"));
  show($("#sessionSetup"));
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
  const { data, error } = await supabase.from("students").select("*, classroom:classes(*, school:schools(name))").order("student_code");
  if (error) return;
  const rows = data || [];
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
}

$("#teacherLoginForm").addEventListener("submit", signIn);
$("#signOutButton").addEventListener("click", signOut);
$("#sessionSetup").addEventListener("submit", createSession);
$("#schoolSetupForm").addEventListener("submit", setupSchool);
$("#manualStudentForm").addEventListener("submit", addStudent);
$("#csvFile").addEventListener("change", handleImportFile);
$("#approveAllButton").addEventListener("click", approveAll);
$("#pauseSessionButton").addEventListener("click", togglePause);
$("#closeSessionButton").addEventListener("click", closeSession);
$("#copyRoomCode").addEventListener("click", async () => { await navigator.clipboard.writeText(state.session.room_code); toast("คัดลอกรหัสห้องแล้ว", "success"); });
$("#copyStudentLink").addEventListener("click", async () => { await navigator.clipboard.writeText(studentJoinUrl()); toast("คัดลอกลิงก์นักเรียนแล้ว", "success"); });
$("#returnForm").addEventListener("submit", returnPlayer);
$("#cancelReturn").addEventListener("click", () => hide($("#returnDialog")));
$("#exportCsvButton").addEventListener("click", exportCurrentReport);
$("#newSessionButton").addEventListener("click", () => { if (state.session) toast("ปิดคาบปัจจุบันก่อนเปิดคาบใหม่", "warning"); else { show($("#sessionSetup")); $("#sessionSetup").scrollIntoView({ behavior: "smooth" }); } });
$("#attemptMode").addEventListener("change", event => { $("#maxAttempts").disabled = event.target.value !== "limited"; if (event.target.value === "single") $("#maxAttempts").value = 1; });
$$('#dashboardNav button').forEach(button => button.addEventListener("click", () => switchPanel(button.dataset.panel)));
window.addEventListener("online", connectionUpdate);
window.addEventListener("offline", connectionUpdate);
bootstrap();
