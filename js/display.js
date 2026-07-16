import { supabase, ensureAnonymousAuth } from "./supabase.js";
import { $, ACTIVITIES, escapeHtml, hide, roomCodeFromUrl, show, toast } from "./common.js";

const state = { roomCode: "", snapshot: null, channel: null, pollTimer: null };

const activityMessages = {
  rhythm: "แตะเฉพาะคำแม่ ก กา ให้ตรงจังหวะ",
  wheel: "สังเกตเสียงท้ายคำ แล้วเลือกคำตอบ",
  sound: "ฟังให้ชัด แล้วสืบหาคำที่ไม่มีตัวสะกด",
  sort: "พาคำแต่ละคำกลับบ้านให้ถูกหลัง",
  train: "เรียงโบกี้คำให้เป็นประโยคที่สมบูรณ์",
  vote: "ช่วยกันสร้างประโยคและมอบหัวใจให้เพื่อน",
  exit: "ตอบให้ถูกอย่างน้อย 2 ใน 3 ข้อ เพื่อเปิดหีบสมบัติ",
};

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
    subscribeBroadcast();
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(refreshBoard, 4000);
  } catch (error) {
    toast(error.message || "เชื่อมต่อจอไม่สำเร็จ", "error");
  }
}

async function refreshBoard() {
  if (!state.roomCode) return false;
  const [{ data: snapshots, error }, { data: leaderboard }] = await Promise.all([
    supabase.rpc("get_display_snapshot", { p_room_code: state.roomCode }),
    supabase.rpc("get_display_leaderboard", { p_room_code: state.roomCode }),
  ]);
  if (error || !snapshots?.length) {
    if (state.snapshot) showClosed();
    return false;
  }
  state.snapshot = snapshots[0];
  renderSnapshot(leaderboard || []);
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
  list.innerHTML = items.length ? items.map((item, index) => `<li><span class="rank">${index + 1}</span><strong>${escapeHtml(item.avatar || "⭐")} ${escapeHtml(item.display_name)}</strong><span class="score">${item.total_score} ★</span></li>`).join("") : `<li class="empty-leaderboard">ยังไม่มีคะแนน</li>`;
}

function subscribeBroadcast() {
  state.channel?.unsubscribe();
  state.channel = supabase.channel(`display-${state.snapshot.session_id}`)
    .on("broadcast", { event: "state-change" }, refreshBoard)
    .subscribe();
}

function showClosed() {
  clearInterval(state.pollTimer);
  state.channel?.unsubscribe();
  $("#displayStageTitle").textContent = "จบคาบเรียนแล้ว";
  $("#displayStageMessage").textContent = "ขอบคุณนักผจญภัยทุกคน แล้วพบกันในแผนถัดไป";
  $("#displayActivityVisual").innerHTML = `<span>🎉</span>`;
}

function updateClock() {
  $("#displayClock").textContent = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
}

$("#displayJoinForm").addEventListener("submit", connectDisplay);
$("#displayRoomInput").addEventListener("input", event => { event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6); });
const initialRoom = roomCodeFromUrl() || localStorage.getItem("thaiGameDisplayRoom") || "";
$("#displayRoomInput").value = initialRoom;
if (initialRoom) connectDisplay();
setInterval(updateClock, 1000);
updateClock();
