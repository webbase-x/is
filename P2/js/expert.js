const $ = selector => document.querySelector(selector);

const channelId = `p2-expert-visitor-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
const frames = {
  teacher: {
    element: $("#expertTeacherFrame"),
    status: $("#expertTeacherStatus"),
    link: $("#expertTeacherOpen"),
    role: "teacher",
    readyText: "พร้อมเข้าสู่ระบบ",
  },
  student: {
    element: $("#expertStudentFrame"),
    status: $("#expertStudentStatus"),
    link: $("#expertStudentOpen"),
    role: "student",
    readyText: "พร้อมใส่รหัส",
  },
};

function sourceFor(frame, { fresh = false } = {}) {
  const url = new URL("expert-visitor.html", window.location.href);
  url.searchParams.set("role", frame.role);
  url.searchParams.set("room", "123456");
  url.searchParams.set("channel", channelId);
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
  Object.values(frames).forEach(frame => loadFrame(frame, options));
}

Object.values(frames).forEach(frame => {
  frame.element.addEventListener("load", () => setFrameStatus(frame, frame.readyText, "ready"));
});

$("#expertReloadButton").addEventListener("click", () => loadAll({ fresh: true }));
$("#expertFullscreenButton").addEventListener("click", async () => {
  const workspace = $("#expertWorkspace");
  if (document.fullscreenElement) await document.exitFullscreen();
  else await workspace.requestFullscreen?.();
});

loadAll({ fresh: true });
