import { supabase, ensureAnonymousAuth } from "./supabase.js";
import {
  $, ACTIVITIES, escapeHtml, GAME_STATE_EVENT, gameStateChannelName, hide,
  roomCodeFromUrl, sanitizeGameMarkup, show, toast,
} from "./common.js";

const state = {
  roomCode: "",
  snapshot: null,
  broadcastChannel: null,
  presenceChannel: null,
  presenceKey: `display-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
  studentScreens: new Map(),
  leaderboard: [],
  view: "screens",
};

const activityMessages = {
  rhythm: "แตะเฉพาะคำแม่ ก กา ให้ตรงจังหวะ",
  wheel: "สังเกตเสียงท้ายคำ แล้วเลือกคำตอบ",
  sound: "ฟังให้ชัด แล้วสืบหาคำที่ไม่มีตัวสะกด",
  sort: "พาคำแต่ละคำกลับบ้านให้ถูกหลัง",
  train: "เรียงโบกี้คำให้เป็นประโยคที่สมบูรณ์",
  vote: "ช่วยกันสร้างประโยคและมอบหัวใจให้เพื่อน",
  exit: "ตอบให้ถูกอย่างน้อย 2 ใน 3 ข้อ เพื่อเปิดหีบสมบัติ",
};

const screenStateMeta = {
  ready: { icon: "🗺️", label: "รอเริ่มเกม" },
  paused: { icon: "⏸️", label: "พักเกม" },
  result: { icon: "🏁", label: "ส่งผลแล้ว" },
  playing: { icon: "🎮", label: "กำลังเล่น" },
};

function modeLabel(mode) {
  return ({ practice: "ทดลอง", real: "รอบจริง", retry: "ทำซ้ำ", single: "รอบเดียว" })[mode] || "ทดลอง";
}

function setDisplayView(view) {
  state.view = view === "activity" ? "activity" : "screens";
  $("#displayViewSwitch")?.querySelectorAll("[data-display-view]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.displayView === state.view));
  });
  $("#displayActivityView").classList.toggle("hidden", state.view !== "activity");
  $("#displayScreensView").classList.toggle("hidden", state.view !== "screens");
}

async function connectDisplay(event) {
  event?.preventDefault();
  const code = String($("#displayRoomInput").value).replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) return;
  try {
    await ensureAnonymousAuth();
    state.roomCode = code;
    const found = await refreshBoard();
    if (!found) throw new Error("ไม่พบห้องเรียน หรือครูปิดคาบแล้ว");
    localStorage.setItem("thaiGameDisplayRoom", code);
    hide($("#displayJoinView"));
    show($("#displayBoard"));
    show($("#displayViewSwitch"));
    setDisplayView("screens");
    subscribeBroadcast();
    subscribePresence();
  } catch (error) {
    toast(error.message || "เชื่อมต่อจอไม่สำเร็จ", "error");
  }
}

async function refreshBoard() {
  if (!state.roomCode) return false;
  const previousSessionId = state.snapshot?.session_id;
  const [{ data: snapshots, error }, { data: leaderboard }] = await Promise.all([
    supabase.rpc("get_display_snapshot", { p_room_code: state.roomCode }),
    supabase.rpc("get_display_leaderboard", { p_room_code: state.roomCode }),
  ]);
  if (error || !snapshots?.length) {
    if (state.snapshot) showClosed();
    return false;
  }
  state.snapshot = snapshots[0];
  state.leaderboard = leaderboard || [];
  renderSnapshot(state.leaderboard);
  if (previousSessionId && previousSessionId !== state.snapshot.session_id) {
    subscribeBroadcast();
    subscribePresence();
  }
  return true;
}

function renderSnapshot(leaderboard) {
  const snapshot = state.snapshot;
  const activity = ACTIVITIES.find(item => item.key === snapshot.current_activity_key);
  $("#displayRoomCode").textContent = snapshot.room_code;
  $("#displayClassName").textContent = `${snapshot.school_name} · ${snapshot.class_label}`;
  $("#displayStageStep").textContent = `แผนที่ ${snapshot.plan_id}${activity ? ` · ภารกิจ ${ACTIVITIES.indexOf(activity) + 1}/${ACTIVITIES.length}` : ""}`;
  $("#displayStageTitle").textContent = snapshot.session_status === "paused" ? "พักเกมสักครู่" : activity?.title || "รอนักเรียนเข้าห้อง";
  $("#displayStageMessage").textContent = snapshot.session_status === "paused" ? "ครูจะเปิดเกมต่อในอีกสักครู่" : activityMessages[activity?.key] || "เมื่อทุกคนพร้อม ครูจะเริ่มกิจกรรมแรก";
  $("#displayActivityVisual").innerHTML = `<span>${snapshot.session_status === "paused" ? "⏸️" : activity?.icon || "🗺️"}</span>`;
  $("#displayApproved").textContent = snapshot.approved_count;
  const progress = snapshot.total_students ? Math.min(100, (snapshot.approved_count / snapshot.total_students) * 100) : 0;
  $("#displayProgressBar").style.width = `${progress}%`;
  renderLeaderboard(leaderboard, snapshot.leaderboard_mode);
  renderStudentScreens();
}

function renderLeaderboard(items, mode) {
  const list = $("#leaderboardList");
  if (mode === "hidden") {
    $("#leaderboardTitle").textContent = "ความก้าวหน้าของทั้งห้อง";
    list.innerHTML = `<li class="empty-leaderboard">ครูเลือกซ่อนรายชื่อนักเรียนในคาบนี้</li>`;
    $("#leaderboardModeCaption").textContent = "ไม่แสดงรายชื่อและอันดับ";
    return;
  }
  $("#leaderboardTitle").textContent = "นักผจญภัยดาวเด่น";
  $("#leaderboardModeCaption").textContent = ({ nickname_avatar: "แสดงชื่อเล่นและอวตาร", real_name: "แสดงชื่อจริง", student_code: "แสดงรหัสนักเรียน" })[mode] || "";
  list.innerHTML = items.length
    ? items.map((item, index) => `<li><span class="rank">${index + 1}</span><strong>${escapeHtml(item.avatar || "⭐")} ${escapeHtml(item.display_name)}</strong><span class="score">${Number(item.total_score) || 0} ★</span></li>`).join("")
    : `<li class="empty-leaderboard">ยังไม่มีคะแนน</li>`;
}

function screenIdentity(screen, index) {
  if (state.snapshot?.leaderboard_mode === "hidden") return { name: `นักผจญภัย ${index + 1}`, avatar: "⭐" };
  return {
    name: String(screen.display_name || `นักเรียน ${index + 1}`).slice(0, 60),
    avatar: String(screen.avatar || "🙂").slice(0, 8),
  };
}

function renderStudentScreens() {
  const grid = $("#displayStudentScreens");
  if (!grid) return;
  const screens = [...state.studentScreens.values()].sort((a, b) => {
    const nameCompare = String(a.display_name || "").localeCompare(String(b.display_name || ""), "th");
    return nameCompare || String(a.player_id).localeCompare(String(b.player_id));
  });
  $("#displayOnlineCount").textContent = screens.length;
  const sanitizedMarkups = screens.map(screen => sanitizeGameMarkup(screen.game_markup));
  grid.classList.toggle("is-single", screens.length === 1);
  grid.classList.toggle("has-live-mirrors", sanitizedMarkups.some(Boolean));
  $("#displayScreensView").classList.toggle("is-single-screen", screens.length === 1 && Boolean(sanitizedMarkups[0]));
  if (!screens.length) {
    grid.innerHTML = `<div class="display-students-empty"><span>📡</span><h2>กำลังรอนักเรียนออนไลน์</h2><p>เมื่อนักเรียนได้รับอนุมัติและเปิดหน้าเกม จอจะปรากฏที่นี่ทันที</p></div>`;
    return;
  }
  grid.innerHTML = screens.map((screen, index) => {
    const identity = screenIdentity(screen, index);
    const screenState = screenStateMeta[screen.screen_state] ? screen.screen_state : "ready";
    const meta = screenStateMeta[screenState];
    const activity = ACTIVITIES.find(item => item.key === screen.activity_key);
    const percent = Math.max(0, Math.min(100, Number(screen.progress_percent) || 0));
    const score = Math.max(0, Number(screen.score) || 0);
    const gameMarkup = sanitizedMarkups[index];
    const gameZoom = Math.max(.75, Math.min(1.3, Number(screen.game_zoom) || 1));
    const screenContent = gameMarkup
      ? `<div class="display-student-mirror"><div class="display-student-mirror-canvas game-canvas" style="--game-zoom:${gameZoom}">${gameMarkup}</div></div>`
      : `<div class="display-student-stage"><span class="display-student-icon">${activity?.icon || meta.icon}</span><small>${escapeHtml(screen.screen_label || meta.label)}</small><h2>${escapeHtml(screen.activity_title || activity?.title || "รอครูเริ่มกิจกรรม")}</h2><p>${escapeHtml(screen.detail || "กำลังเตรียมพร้อม")}</p></div>`;
    return `<article class="display-student-card${gameMarkup ? " has-live-mirror" : ""}" data-screen-state="${screenState}">
      <header>
        <span class="display-student-avatar">${escapeHtml(identity.avatar)}</span>
        <div><strong>${escapeHtml(identity.name)}</strong><small><i></i> หน้าจอสด</small></div>
        <span class="display-student-score">${score} ★</span>
      </header>
      ${screenContent}
      <footer>
        <div class="display-student-progress"><i style="width:${percent}%"></i></div>
        <span>${escapeHtml(screen.progress_text || `${Math.round(percent)}%`)}</span>
        <b>${escapeHtml(modeLabel(screen.mode))}</b>
      </footer>
    </article>`;
  }).join("");
}

function syncStudentPresence() {
  if (!state.presenceChannel) return;
  const latest = new Map();
  Object.values(state.presenceChannel.presenceState()).flat().forEach(screen => {
    if (screen.role !== "student" || !screen.player_id) return;
    const current = latest.get(screen.player_id) || state.studentScreens.get(screen.player_id);
    latest.set(screen.player_id, !current || String(screen.updated_at || "") > String(current.updated_at || "") ? screen : current);
  });
  state.studentScreens = latest;
  renderStudentScreens();
}

function receiveStudentScreen(message) {
  const screen = message?.payload || message;
  if (screen?.role !== "student" || !screen.player_id) return;
  const current = state.studentScreens.get(screen.player_id);
  if (!current || String(screen.updated_at || "") >= String(current.updated_at || "")) state.studentScreens.set(screen.player_id, screen);
  renderStudentScreens();
}

function subscribeBroadcast() {
  state.broadcastChannel?.unsubscribe();
  state.broadcastChannel = supabase.channel(gameStateChannelName(state.snapshot.session_id))
    .on("broadcast", { event: GAME_STATE_EVENT }, message => {
      const update = message?.payload || message;
      const session = update?.session;
      if (!session || session.id !== state.snapshot?.session_id) return;
      state.snapshot = {
        ...state.snapshot,
        session_status: session.status,
        current_activity_key: session.current_activity_key,
        plan_id: session.plan_id,
        leaderboard_mode: session.leaderboard_mode,
      };
      // Render the command immediately; refresh scores in the background.
      renderSnapshot(state.leaderboard);
      void refreshBoard();
    })
    .subscribe(status => {
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) void refreshBoard();
    });
}

function subscribePresence() {
  state.presenceChannel?.unsubscribe();
  state.studentScreens.clear();
  renderStudentScreens();
  state.presenceChannel = supabase.channel(`classroom-${state.snapshot.session_id}`, {
    config: { presence: { key: state.presenceKey } },
  })
    .on("broadcast", { event: "student-screen" }, receiveStudentScreen)
    .on("presence", { event: "sync" }, syncStudentPresence)
    .on("presence", { event: "join" }, syncStudentPresence)
    .on("presence", { event: "leave" }, syncStudentPresence)
    .subscribe(status => {
      if (status === "SUBSCRIBED") {
        void state.presenceChannel.track({ role: "display", room_code: state.roomCode, online_at: new Date().toISOString() });
      }
    });
}

function showClosed() {
  state.broadcastChannel?.unsubscribe();
  state.presenceChannel?.unsubscribe();
  state.studentScreens.clear();
  renderStudentScreens();
  $("#displayStageTitle").textContent = "จบคาบเรียนแล้ว";
  $("#displayStageMessage").textContent = "ขอบคุณนักผจญภัยทุกคน แล้วพบกันในแผนถัดไป";
  $("#displayActivityVisual").innerHTML = `<span>🎉</span>`;
}

function updateClock() {
  $("#displayClock").textContent = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
}

$("#displayJoinForm").addEventListener("submit", connectDisplay);
$("#displayRoomInput").addEventListener("input", event => { event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6); });
$("#displayViewSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-display-view]");
  if (button) setDisplayView(button.dataset.displayView);
});
const initialRoom = roomCodeFromUrl() || localStorage.getItem("thaiGameDisplayRoom") || "";
$("#displayRoomInput").value = initialRoom;
if (initialRoom) void connectDisplay();
setInterval(updateClock, 1000);
updateClock();
