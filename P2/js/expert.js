import {
  LEGACY_REVIEWER,
  reviewerInviteFromHash,
} from "./reviewer-access.js?v=20260727-reviewer-links-1";

const $ = selector => document.querySelector(selector);
const EXPERT_BUILD_VERSION = "20260727-reviewer-links-1";
const IPAD_VIEWPORT = Object.freeze({ width: 1024, height: 768 });
const reviewerInvite = reviewerInviteFromHash();
const activeReviewer = reviewerInvite?.account || LEGACY_REVIEWER;
const reviewerPassword = reviewerInvite?.password || "";

const frames = {
  teacher: {
    element: $("#expertTeacherFrame"),
    status: $("#expertTeacherStatus"),
    link: $("#expertTeacherOpen"),
    page: "teacher.html",
    authScope: `reviewer-${activeReviewer.alias}-teacher`,
    readyText: "พร้อมเริ่มคาบ",
  },
  student: {
    element: $("#expertStudentFrame"),
    status: $("#expertStudentStatus"),
    link: $("#expertStudentOpen"),
    page: "student.html",
    authScope: `reviewer-${activeReviewer.alias}-student`,
    readyText: "พร้อมใส่รหัส",
  },
};

function sourceFor(frame, { fresh = false } = {}) {
  const url = new URL(frame.page, window.location.href);
  url.searchParams.set("authScope", frame.authScope);
  url.searchParams.set("expertReview", "1");
  url.searchParams.set("reviewer", activeReviewer.email);
  if (frame === frames.teacher) url.searchParams.set("embed", "expert-teacher");
  url.searchParams.set("appBuild", EXPERT_BUILD_VERSION);
  if (fresh) url.searchParams.set("fresh", String(Date.now()));
  return url.href;
}

function setFrameStatus(frame, text, state = "") {
  frame.status.textContent = text;
  frame.status.className = `expert-real-status ${state}`.trim();
}

function fitIpadViewport(frame) {
  const screen = frame.element.closest(".expert-real-device-screen");
  if (!screen) return;
  const scale = screen.clientWidth / IPAD_VIEWPORT.width;
  screen.style.setProperty("--expert-ipad-scale", String(scale));
  screen.dataset.viewport = `${IPAD_VIEWPORT.width}×${IPAD_VIEWPORT.height}`;
}

function loadFrame(frame, options) {
  fitIpadViewport(frame);
  setFrameStatus(frame, "กำลังเปิดจอจริง", "loading");
  const source = sourceFor(frame, options);
  frame.link.href = source;
  frame.element.src = source;
}

function loadAll(options = {}) {
  loadFrame(frames.teacher, options);
  loadFrame(frames.student, { ...options, fresh: true });
}

function markCredentials(message, state = "") {
  const status = $("#expertCredentialStatus");
  status.textContent = message;
  status.className = state;
}

function renderReviewerIdentity() {
  $("#expertAccountBadge").textContent = reviewerInvite
    ? `✓ ${activeReviewer.label} · พร้อมเข้าสู่ระบบ`
    : "บัญชีผู้ตรวจสื่อเดิม";
  $("#expertAccountEmail").textContent = activeReviewer.email;
  $("#expertAccountPassword").textContent = reviewerInvite ? "พร้อมใช้จากลิงก์ส่วนตัว" : "กรอกด้วยตนเอง";
  $("#expertFillLoginButton").textContent = reviewerInvite
    ? "✉️ กรอก USER และ PASSWORD ในจอครู"
    : "✉️ กรอก USER ในจอครู";
  markCredentials(
    reviewerInvite
      ? `ลิงก์ส่วนตัวของ ${activeReviewer.label} พร้อมแล้ว ระบบจะกรอกข้อมูลในจอครูอัตโนมัติ`
      : "เปิดจากลิงก์ส่วนตัวเพื่อให้ระบบกรอกบัญชีและรหัสผ่านในจอครูอัตโนมัติ",
    reviewerInvite ? "ready" : "",
  );
}

function fillTeacherCredentials() {
  try {
    const documentRef = frames.teacher.element.contentDocument;
    const email = documentRef?.querySelector("#teacherEmail");
    const password = documentRef?.querySelector("#teacherPassword");
    const dashboard = documentRef?.querySelector("#teacherDashboard");
    if (dashboard && !dashboard.classList.contains("hidden")) {
      markCredentials("จอครูเข้าสู่ระบบผู้เชี่ยวชาญแล้ว และอยู่ในโหมดไม่บันทึกคะแนน", "ready");
      setFrameStatus(frames.teacher, "เข้าสู่ระบบแล้ว", "ready");
      return true;
    }
    if (!email || !password) {
      markCredentials("กำลังรอแบบฟอร์มเข้าสู่ระบบจอครู…", "loading");
      return false;
    }
    email.value = activeReviewer.email;
    password.value = reviewerPassword;
    [email, password].forEach(field => {
      ["input", "change"].forEach(type => field.dispatchEvent(new Event(type, { bubbles: true })));
    });
    markCredentials(
      reviewerInvite
        ? `กรอก USER และ PASSWORD ของ ${activeReviewer.label} ในจอครูแล้ว กด “เข้าสู่ระบบ” ได้ทันที`
        : "กรอก USER ในจอครูแล้ว กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบ",
      "ready",
    );
    setFrameStatus(frames.teacher, reviewerInvite ? "พร้อมกดเข้าสู่ระบบ" : "รอรหัสผ่าน", "ready");
    (reviewerInvite ? documentRef?.querySelector("#teacherLoginForm button[type='submit']") : password)
      ?.focus({ preventScroll: true });
    return true;
  } catch {
    markCredentials("เปิดจอครูเต็มแท็บเพื่อกรอกบัญชีผู้เชี่ยวชาญ", "warning");
    return false;
  }
}

Object.entries(frames).forEach(([key, frame]) => {
  frame.element.addEventListener("load", () => {
    fitIpadViewport(frame);
    setFrameStatus(frame, frame.readyText, "ready");
    if (key === "teacher") window.setTimeout(fillTeacherCredentials, 250);
  });
});

const ipadResizeObserver = new ResizeObserver(entries => {
  entries.forEach(entry => {
    const frame = Object.values(frames).find(item => item.element.closest(".expert-real-device-screen") === entry.target);
    if (frame) fitIpadViewport(frame);
  });
});
Object.values(frames).forEach(frame => {
  const screen = frame.element.closest(".expert-real-device-screen");
  if (screen) ipadResizeObserver.observe(screen);
});

$("#expertReloadButton").addEventListener("click", () => loadAll({ fresh: true }));
$("#expertFillLoginButton").addEventListener("click", () => {
  if (!fillTeacherCredentials()) frames.teacher.element.focus();
});
window.setInterval(() => {
  try {
    const dashboard = frames.teacher.element.contentDocument?.querySelector("#teacherDashboard");
    if (!dashboard || dashboard.classList.contains("hidden")) return;
    markCredentials("จอครูเข้าสู่ระบบผู้เชี่ยวชาญแล้ว และอยู่ในโหมดไม่บันทึกคะแนน", "ready");
    setFrameStatus(frames.teacher, "เข้าสู่ระบบแล้ว", "ready");
  } catch {
    // จอเต็มแท็บหรือเบราว์เซอร์บางรุ่นอาจไม่อนุญาตให้หน้าหลักอ่านสถานะของ iframe
  }
}, 1_000);
const workspace = $("#expertWorkspace");
const fullscreenButton = $("#expertFullscreenButton");
const fullscreenExitButton = $("#expertFullscreenExitButton");

function setFullscreenFallback(enabled) {
  workspace.classList.toggle("expert-fullscreen-fallback", enabled);
  document.body.classList.toggle("expert-simulated-fullscreen", enabled);
  fullscreenButton.textContent = enabled ? "↙ ออกจากเต็มจอ" : "⛶ เต็มจอสองจอ";
}

async function toggleFullscreen() {
  if (workspace.classList.contains("expert-fullscreen-fallback")) {
    setFullscreenFallback(false);
    return;
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  try {
    if (typeof workspace.requestFullscreen !== "function") throw new Error("Fullscreen API unavailable");
    await workspace.requestFullscreen();
    if (!document.fullscreenElement) setFullscreenFallback(true);
  } catch {
    setFullscreenFallback(true);
  }
}

fullscreenButton.addEventListener("click", toggleFullscreen);
fullscreenExitButton.addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) fullscreenButton.textContent = "↙ ออกจากเต็มจอ";
  else if (!workspace.classList.contains("expert-fullscreen-fallback")) fullscreenButton.textContent = "⛶ เต็มจอสองจอ";
});

renderReviewerIdentity();
loadAll({ fresh: true });
