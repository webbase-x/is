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
  url.searchParams.set("screen", "20260723-expert-level-2-1");
  if (frame.role === "expert-teacher") url.searchParams.set("autofill", "1");
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
$("#expertFullscreenButton").addEventListener("click", async () => {
  const workspace = $("#expertWorkspace");
  if (document.fullscreenElement) await document.exitFullscreen();
  else await workspace.requestFullscreen?.();
});

loadAll({ fresh: true });
