export const ACTIVITIES = Object.freeze([
  { key: "rhythm", icon: "🎵", title: "แท็ปจังหวะ แม่ ก กา", short: "แท็ปจังหวะ", minutes: 10 },
  { key: "wheel", icon: "🎡", title: "วงล้อเสี่ยงทาย", short: "วงล้อ", minutes: 10 },
  { key: "sound", icon: "🔊", title: "นักสืบเสียงท้ายคำ", short: "นักสืบเสียง", minutes: 7 },
  { key: "sort", icon: "🏠", title: "จัดบ้านให้คำ", short: "จัดบ้าน", minutes: 7 },
  { key: "train", icon: "🚂", title: "รถไฟประโยคแม่ ก กา", short: "รถไฟประโยค", minutes: 6 },
  { key: "vote", icon: "💗", title: "บอร์ดโหวตประโยคฮิต", short: "บอร์ดโหวต", minutes: 10 },
  { key: "exit", icon: "🗝️", title: "ไขกุญแจหีบสมบัติ", short: "Exit Ticket", minutes: 10 },
]);

export const PLAN_TITLES = Object.freeze([
  "รู้จักมาตราตัวสะกดและแม่ ก กา",
  "แผนการเรียนรู้ที่ 2",
  "แผนการเรียนรู้ที่ 3",
  "แผนการเรียนรู้ที่ 4",
  "แผนการเรียนรู้ที่ 5",
  "แผนการเรียนรู้ที่ 6",
  "แผนการเรียนรู้ที่ 7",
  "แผนการเรียนรู้ที่ 8",
]);

export const AVATARS = ["⭐", "🦉", "🐯", "🐳", "🐰", "🦊", "🐼", "🦁", "🐸", "🐙", "🦋", "🚀"];

export const GAME_STATE_EVENT = "game-state";

export function gameStateChannelName(sessionId) {
  return `game-session-${sessionId}`;
}

export function gameStatePayload(session, reason = "state-change") {
  return {
    event_id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    issued_at: Date.now(),
    reason,
    session,
  };
}

const MIRROR_TAGS = new Set(["SECTION", "DIV", "SPAN", "SMALL", "STRONG", "H1", "H2", "H3", "H4", "P", "BUTTON", "UL", "OL", "LI", "MARK", "I", "B", "LABEL", "OUTPUT"]);
const MIRROR_STYLE_PROPERTIES = ["width", "height", "transform", "text-align", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "left", "top", "opacity", "animation-duration", "--spark-x", "--spark-y", "--spark-delay", "--spark-size"];
const MIRROR_CLASS_PREFIXES = ["game-", "rhythm-", "karaoke-", "grammar-", "choice-", "word-", "falling-", "sort-", "train-", "vote-", "sentence-", "result-", "treasure-", "house-", "mini-", "sound-", "field-"];
const MIRROR_CLASS_NAMES = new Set(["wheel", "treasure", "button", "button-primary", "button-ghost", "button-row", "good", "bad", "hidden", "done", "active", "hot", "score-pop", "missed", "singing", "lyric-line", "correct", "wrong", "open", "empty-stage"]);

function sanitizeMirrorStyle(element, rawStyle) {
  const probe = document.createElement("span");
  probe.style.cssText = String(rawStyle || "").slice(0, 700);
  element.removeAttribute("style");
  MIRROR_STYLE_PROPERTIES.forEach(property => {
    const value = probe.style.getPropertyValue(property).trim();
    if (value && value.length <= 90 && !/url\s*\(|expression\s*\(/i.test(value)) element.style.setProperty(property, value);
  });
}

export function sanitizeGameMarkup(markup) {
  if (typeof markup !== "string" || !markup || markup.length > 48000) return "";
  const template = document.createElement("template");
  template.innerHTML = markup;
  [...template.content.querySelectorAll("*")].forEach(element => {
    if (!MIRROR_TAGS.has(element.tagName)) {
      element.remove();
      return;
    }
    const rawStyle = element.getAttribute("style");
    [...element.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const keep = name === "class" || name === "style" || name === "disabled" || name === "hidden" || name === "aria-hidden" || /^data-[a-z0-9-]{1,40}$/.test(name);
      if (!keep) element.removeAttribute(attribute.name);
    });
    if (element.hasAttribute("class")) {
      const safeClasses = element.className.split(/\s+/).filter(name => /^[a-zA-Z0-9_-]{1,60}$/.test(name) && (MIRROR_CLASS_NAMES.has(name) || MIRROR_CLASS_PREFIXES.some(prefix => name.startsWith(prefix)))).slice(0, 20);
      if (safeClasses.length) element.className = safeClasses.join(" ");
      else element.removeAttribute("class");
    }
    if (rawStyle) sanitizeMirrorStyle(element, rawStyle);
    if (element.matches("button")) element.setAttribute("disabled", "");
  });
  return template.innerHTML;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function show(element) { element?.classList.remove("hidden"); }
export function hide(element) { element?.classList.add("hidden"); }

export function setView(active, ...others) {
  show(active);
  others.forEach(hide);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

export function formatClass(classroom) {
  if (!classroom) return "—";
  return classroom.label || `ป.${classroom.grade}/${classroom.room_no}`;
}

export function randomAvatar(seed = "") {
  const total = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATARS[total % AVATARS.length];
}

export function debounce(callback, wait = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}

let toastTimer;
export function toast(message, tone = "default") {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
}

export function roomCodeFromUrl() {
  return new URLSearchParams(location.search).get("room")?.replace(/\D/g, "").slice(0, 6) || "";
}

export function modeLabel(mode) {
  return ({ practice: "รอบฝึก", test: "รอบทดสอบ", real: "รอบจริง" })[mode] || "รอบฝึก";
}

export function playerStatusLabel(status) {
  return ({ waiting: "รออนุมัติ", approved: "อนุมัติแล้ว", returned: "ส่งคืนแล้ว", removed: "นำออกแล้ว" })[status] || status;
}

export function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function renderPlanTimeline(container, activePlan = 1) {
  if (!container) return;
  container.innerHTML = PLAN_TITLES.map((title, index) => `
    <article class="plan-card ${index + 1 === activePlan ? "active" : ""}">
      <span class="plan-number">${index + 1}</span>
      <span class="lock">${index + 1 === activePlan ? "เปิดใช้งาน" : "🔒"}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${index === 0 ? "7 กิจกรรม · 60 นาที" : "ครูจะเปิดเมื่อถึงคาบเรียน"}</p>
    </article>
  `).join("");
}

export function updateConnectionBadge(element, online, label) {
  if (!element) return;
  element.classList.toggle("offline", !online);
  element.innerHTML = `<i></i> ${escapeHtml(label || (online ? "เชื่อมต่อแล้ว" : "ออฟไลน์"))}`;
}
