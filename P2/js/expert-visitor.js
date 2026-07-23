const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const params = new URLSearchParams(location.search);
const role = params.get("role") === "teacher" ? "teacher" : "student";
const roomCode = params.get("room")?.replace(/\D/g, "").slice(0, 6) || "123456";
const channelName = params.get("channel") || `p2-expert-visitor-${roomCode}`;
const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : null;

const ACTIVITIES = [
  { key: "rhythm", icon: "🎵", title: "เพลง มาตรา ก กา", prompt: "แตะคำแม่ ก กาให้ทันเพลง" },
  { key: "wheel", icon: "🎡", title: "วงล้อคำมหัศจรรย์", prompt: "หมุนวงล้อแล้วเลือกคำตอบ" },
  { key: "sound", icon: "🔊", title: "นักสืบเสียงท้ายคำ", prompt: "ฟังเสียงแล้วเลือกคำที่ถูกต้อง" },
  { key: "sort", icon: "🏠", title: "จัดบ้านให้คำ", prompt: "แยกคำตามมาตราตัวสะกด" },
  { key: "train", icon: "🚂", title: "รถไฟประโยคแม่ ก กา", prompt: "เรียงคำให้เป็นประโยค" },
  { key: "vote", icon: "💗", title: "บอร์ดโหวตประโยคฮิต", prompt: "เลือกประโยคที่ชอบ" },
  { key: "exit", icon: "🗝️", title: "ไขกุญแจหีบสมบัติ", prompt: "ตอบคำถามก่อนจบคาบ" },
];

const state = {
  signedIn: false,
  joined: false,
  school: "โรงเรียนตัวอย่าง",
  classroom: "ป.2/4",
  activityKey: "rhythm",
  status: "waiting",
  score: 0,
  notice: "รอครูเริ่มกิจกรรม",
};

function activity() { return ACTIVITIES.find(item => item.key === state.activityKey) || ACTIVITIES[0]; }
function publish(type, extra = {}) { channel?.postMessage({ type, ...extra }); }

function renderTeacherLogin() {
  $("#visitorApp").innerHTML = `
    <section class="visitor-login" aria-label="เข้าสู่ระบบจำลอง">
      <div class="visitor-login-card">
        <span class="visitor-symbol">ก</span>
        <span class="visitor-badge">บัญชีจำลอง · ผู้เยี่ยมชม</span>
        <h1>สำหรับครูผู้สอน</h1><p>เข้าสู่จอควบคุม</p>
        <label>อีเมล<input value="expert.visitor@demo.local" readonly aria-label="อีเมลจำลอง"></label>
        <label>รหัสผ่าน<input value="visitor123" type="password" readonly aria-label="รหัสผ่านจำลอง"></label>
        <button id="visitorTeacherLogin" class="visitor-primary" type="button">เข้าสู่ระบบ</button>
        <small>บัญชีนี้มีสิทธิ์ <strong>ผู้เยี่ยมชม</strong> ใช้ตรวจสื่อเท่านั้น ไม่มีการบันทึกข้อมูลจริง</small>
      </div>
    </section>`;
  $("#visitorTeacherLogin").addEventListener("click", () => { state.signedIn = true; renderTeacher(); });
}

function renderTeacher() {
  const current = activity();
  $("#visitorApp").innerHTML = `
    <section class="visitor-shell visitor-teacher-shell">
      <header class="visitor-topbar"><div><span class="visitor-symbol small">ก</span><strong>คำไทยผจญภัย</strong><small>จอควบคุมครู</small></div><span class="visitor-guest">ผู้เยี่ยมชม</span></header>
      <main class="visitor-teacher-main">
        <section class="visitor-class-card"><div><span>คาบเรียนปัจจุบัน</span><strong>${escapeHtml(state.school)} · ${escapeHtml(state.classroom)}</strong></div><span class="visitor-live-dot">ห้อง ${roomCode}</span></section>
        <section class="visitor-setup-card"><label>โรงเรียน<select id="visitorSchool"><option>${escapeHtml(state.school)}</option></select></label><label>ห้องเรียน<select id="visitorClassroom"><option>${escapeHtml(state.classroom)}</option></select></label><span>ข้อมูลตัวอย่าง</span></section>
        <section class="visitor-teacher-live"><div><span>${current.icon}</span><div><small>กิจกรรมที่ส่งถึงนักเรียน</small><h1>${escapeHtml(current.title)}</h1><p>${state.status === "active" ? "กำลังเล่นพร้อมกันในห้องทดลอง" : "เลือกกิจกรรม แล้วกดเริ่มเกม"}</p></div></div><button id="visitorStart" class="visitor-primary" type="button">${state.status === "active" ? "พักเกม" : "เริ่มเกม"}</button></section>
        <section class="visitor-activity-list"><h2>กิจกรรมในแผนการสอน</h2><div>${ACTIVITIES.map((item, index) => `<button class="${item.key === current.key ? "active" : ""}" data-activity="${item.key}" type="button"><b>${index + 1}</b><span>${item.icon}</span><strong>${escapeHtml(item.title)}</strong></button>`).join("")}</div></section>
        <section class="visitor-score-card"><span>ผลการแข่งขันจำลอง</span><strong id="visitorScore">นักเรียนตัวอย่าง · ${state.score} คะแนน</strong><small>คะแนนนี้อยู่ในหน้านี้ชั่วคราวและจะหายเมื่อโหลดใหม่</small></section>
      </main>
    </section>`;
  $("#visitorStart").addEventListener("click", () => {
    state.status = state.status === "active" ? "paused" : "active";
    publish("lesson", { activityKey: state.activityKey, status: state.status });
    renderTeacher();
  });
  document.querySelectorAll("[data-activity]").forEach(button => button.addEventListener("click", () => {
    state.activityKey = button.dataset.activity;
    state.status = "waiting";
    publish("lesson", { activityKey: state.activityKey, status: state.status });
    renderTeacher();
  }));
}

function renderStudentJoin() {
  $("#visitorApp").innerHTML = `
    <section class="visitor-login visitor-student-join" aria-label="เข้าห้องทดลอง">
      <div class="visitor-login-card"><span class="visitor-symbol">ก</span><span class="visitor-badge">นักเรียน · ห้องทดลอง</span><h1>เข้าห้องเรียน</h1><p>ใส่รหัสห้องเพื่อร่วมกิจกรรม</p><label>รหัสห้อง<input id="visitorRoom" value="${roomCode}" inputmode="numeric" maxlength="6" aria-label="รหัสห้อง"></label><button id="visitorStudentJoin" class="visitor-primary" type="button">เข้าห้องทดลอง</button><small>รหัสนี้กำหนดไว้สำหรับการตรวจสื่อเท่านั้น · ไม่มีการบันทึกคะแนนจริง</small></div>
    </section>`;
  $("#visitorStudentJoin").addEventListener("click", () => { state.joined = true; publish("student-joined"); renderStudent(); });
}

function renderStudent() {
  const current = activity();
  const isActive = state.status === "active";
  $("#visitorApp").innerHTML = `
    <section class="visitor-shell visitor-student-shell">
      <header class="visitor-student-top"><div><span class="visitor-avatar">น</span><div><small>นักเรียนผู้เยี่ยมชม · ห้อง ${roomCode}</small><strong>เด็กชายตัวอย่าง</strong></div></div><span>${state.score} ★</span></header>
      <main class="visitor-game-stage">
        <span class="visitor-game-label">เกมภาษาไทย · ตรวจสื่อ</span><h1>${current.icon} ${escapeHtml(current.title)}</h1><p>${escapeHtml(current.prompt)}</p>
        <section class="visitor-game-card ${isActive ? "is-active" : ""}"><span>${current.icon}</span><h2>${isActive ? "เริ่มเกมแล้ว!" : state.status === "paused" ? "ครูพักเกมชั่วคราว" : "รอครูเริ่มเกม"}</h2><p>${isActive ? "เลือกคำตอบเพื่อดูคะแนนจำลอง" : "จอนี้จะเปลี่ยนพร้อมครูเมื่อกดเริ่มเกม"}</p><div><button data-answer="correct" type="button" ${isActive ? "" : "disabled"}>ไม่มีตัวสะกด</button><button data-answer="wrong" type="button" ${isActive ? "" : "disabled"}>มีตัวสะกด</button></div></section>
        <span class="visitor-sync"><i></i>${escapeHtml(state.notice)}</span>
      </main>
    </section>`;
  document.querySelectorAll("[data-answer]").forEach(button => button.addEventListener("click", () => {
    const correct = button.dataset.answer === "correct";
    if (correct) state.score += 10;
    state.notice = correct ? "ตอบถูก! ได้ 10 คะแนน (จำลอง)" : "ลองใหม่นะ";
    publish("score", { score: state.score });
    renderStudent();
  }));
}

channel?.addEventListener("message", event => {
  const message = event.data || {};
  if (message.type === "lesson" && role === "student") {
    state.activityKey = message.activityKey || state.activityKey;
    state.status = message.status || "waiting";
    state.notice = state.status === "active" ? "ครูเริ่มเกมแล้ว · เล่นพร้อมกันได้เลย" : state.status === "paused" ? "ครูพักเกมชั่วคราว" : "ครูเลือกกิจกรรมใหม่ · รอเริ่มเกม";
    if (state.joined) renderStudent();
  }
  if (message.type === "score" && role === "teacher" && state.signedIn) {
    state.score = Number(message.score) || 0;
    renderTeacher();
  }
});

if (role === "teacher") renderTeacherLogin();
else renderStudentJoin();
