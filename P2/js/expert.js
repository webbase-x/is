const $ = selector => document.querySelector(selector);

const frames = {
  teacher: {
    element: $("#expertTeacherFrame"),
    status: $("#expertTeacherStatus"),
    link: $("#expertTeacherOpen"),
    page: "teacher.html",
    role: "expert-teacher",
    readyText: "พร้อมเริ่มคาบ",
  },
  student: {
    element: $("#expertStudentFrame"),
    status: $("#expertStudentStatus"),
    link: $("#expertStudentOpen"),
    page: "student.html",
    role: "expert-student",
    readyText: "พร้อมใส่รหัส",
  },
};

function sourceFor(frame, { fresh = false } = {}) {
  const url = new URL(frame.page, window.location.href);
  url.searchParams.set("embed", frame.role);
  url.searchParams.set("screen", "20260726-all-plans-responsive-3");
  if (fresh) url.searchParams.set("fresh", String(Date.now()));
  return url.href;
}

function setFrameStatus(frame, text, state = "") {
  frame.status.textContent = text;
  frame.status.className = `expert-real-status ${state}`.trim();
}

function loadFrame(frame, options) {
  setFrameStatus(frame, "กำลังเปิดจอ", "loading");
  const source = sourceFor(frame, options);
  frame.link.href = source;
  frame.element.src = source;
}

function loadAll(options = {}) {
  loadFrame(frames.teacher, options);
  loadFrame(frames.student, { ...options, fresh: true });
}

Object.values(frames).forEach(frame => {
  frame.element.addEventListener("load", () => setFrameStatus(frame, frame.readyText, "ready"));
});

$("#expertReloadButton").addEventListener("click", () => loadAll({ fresh: true }));
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

loadAll({ fresh: true });
