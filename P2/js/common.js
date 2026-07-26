export const ACTIVITIES = Object.freeze([
  { key: "rhythm", icon: "🎵", title: "เพลง มาตรา ก กา", short: "เพลง มาตรา", minutes: 10 },
  { key: "wheel", icon: "🎡", title: "วงล้อเสี่ยงทาย", short: "วงล้อ", minutes: 10 },
  { key: "sound", icon: "🔊", title: "นักสืบเสียงท้ายคำ", short: "นักสืบเสียง", minutes: 7 },
  { key: "sort", icon: "🏠", title: "จัดบ้านให้คำ", short: "จัดบ้าน", minutes: 7 },
  { key: "train", icon: "🚂", title: "รถไฟประโยคแม่ ก กา", short: "รถไฟประโยค", minutes: 6 },
  { key: "vote", icon: "💗", title: "บอร์ดโหวตประโยคฮิต", short: "บอร์ดโหวต", minutes: 10 },
  { key: "exit", icon: "🗝️", title: "ไขกุญแจหีบสมบัติ", short: "แบบทดสอบท้ายคาบ", minutes: 10 },
]);

const freezeActivitySet = activities => Object.freeze(activities.map(activity => Object.freeze(activity)));

export const PLAN_ACTIVITIES = Object.freeze({
  1: ACTIVITIES,
  2: freezeActivitySet([
    { key: "mae-kong-box", icon: "📦", title: "กล่องคำแม่กง", short: "กล่องคำ", minutes: 12 },
    { key: "mae-kong-rocket", icon: "🚀", title: "จรวดประโยคแม่กง", short: "จรวดประโยค", minutes: 12 },
    { key: "mae-kong-exit", icon: "🗝️", title: "ด่านดาวพิชิตแม่กง", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  3: freezeActivitySet([
    { key: "mae-kom-box", icon: "📦", title: "กล่องคำแม่กม", short: "กล่องคำ", minutes: 12 },
    { key: "picture-word", icon: "🖼️", title: "ภาพนี้คำอะไร", short: "ทายคำจากภาพ", minutes: 12 },
    { key: "mae-kom-exit", icon: "🗝️", title: "ด่านพิชิตแม่กม", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  4: freezeActivitySet([
    { key: "yw-sort", icon: "👯", title: "คู่หู ย–ว", short: "แยกแม่เกย–เกอว", minutes: 12 },
    { key: "picture-choice", icon: "🖼️", title: "เลือกคำให้ใช่", short: "เลือกจากภาพ", minutes: 12 },
    { key: "exit", icon: "🗝️", title: "ด่านคู่หู ย–ว", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  5: freezeActivitySet([
    { key: "cave-door", icon: "🗝️", title: "เปิดประตูถ้ำแม่กก", short: "ประตูถ้ำ", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "จริงหรือไม่ แม่กก", short: "จริงหรือไม่", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กก", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  6: freezeActivitySet([
    { key: "treasure-hunt", icon: "💎", title: "ล่าสมบัติแม่กด", short: "ล่าสมบัติ", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "ถอดรหัสแม่กด", short: "ถอดรหัส", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กด", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  7: freezeActivitySet([
    { key: "island-supply", icon: "🏝️", title: "เก็บเสบียงแม่กบ", short: "เก็บเสบียง", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "ปริศนาชาวเกาะแม่กบ", short: "ปริศนาชาวเกาะ", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กบ", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  8: freezeActivitySet([
    { key: "space-fuel", icon: "🚀", title: "เติมเชื้อเพลิงแม่กน", short: "เติมเชื้อเพลิง", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "รหัสลับต่างดาวแม่กน", short: "รหัสลับ", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กน", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
});

export function activitiesForPlan(planId = 1) {
  return PLAN_ACTIVITIES[Number(planId)] || ACTIVITIES;
}

export function activityForKey(activityKey, planId) {
  const planActivities = activitiesForPlan(planId);
  return planActivities.find(activity => activity.key === activityKey)
    || Object.values(PLAN_ACTIVITIES).flat().find(activity => activity.key === activityKey)
    || null;
}

export const PLAN_TITLES = Object.freeze([
  "รู้จักมาตราตัวสะกดและแม่ ก กา",
  "มาตราแม่กง",
  "มาตราแม่กม",
  "มาตราแม่เกยและแม่เกอว",
  "มาตราแม่กก",
  "มาตราแม่กด",
  "มาตราแม่กบ",
  "มาตราแม่กน",
]);

export const AVATARS = ["⭐", "🦉", "🐯", "🐳", "🐰", "🦊", "🐼", "🦁", "🐸", "🐙", "🦋", "🚀"];

export const GAME_STATE_EVENT = "game-state";
// Expert sessions intentionally keep scores out of the database. These events
// carry only the in-memory, live scoreboard for the current class session.
export const EXPERT_SCORE_EVENT = "expert-live-score";
export const EXPERT_SCOREBOARD_EVENT = "expert-live-scoreboard";
export const EXPERT_SCOREBOARD_REQUEST_EVENT = "expert-live-scoreboard-request";

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

const MIRROR_TAGS = new Set(["SECTION", "HEADER", "DIV", "SPAN", "SMALL", "STRONG", "H1", "H2", "H3", "H4", "P", "BUTTON", "UL", "OL", "LI", "MARK", "I", "B", "LABEL", "OUTPUT"]);
const MIRROR_STYLE_PROPERTIES = ["width", "height", "transform", "text-align", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "left", "top", "opacity", "animation-duration"];
const MIRROR_CLASS_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,60}$/;
const MIRROR_CUSTOM_PROPERTY_PATTERN = /^--[a-zA-Z][a-zA-Z0-9-]{0,48}$/;

function sanitizeMirrorStyle(element, rawStyle) {
  const probe = document.createElement("span");
  probe.style.cssText = String(rawStyle || "").slice(0, 700);
  element.removeAttribute("style");
  const properties = new Set(MIRROR_STYLE_PROPERTIES);
  for (let index = 0; index < probe.style.length; index += 1) {
    const property = probe.style[index];
    if (MIRROR_CUSTOM_PROPERTY_PATTERN.test(property)) properties.add(property);
  }
  properties.forEach(property => {
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
      // Script/event attributes are removed and controls are disabled. Keeping
      // safe CSS classes lets every current and future game retain its visual
      // design without a fragile per-game class allow-list.
      const safeClasses = element.className.split(/\s+/).filter(name => MIRROR_CLASS_PATTERN.test(name)).slice(0, 30);
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
let legacyThaiByteMap;

function repairThaiMojibake(text) {
  try {
    const legacyDecoder = new TextDecoder("windows-874");
    if (!legacyThaiByteMap) {
      legacyThaiByteMap = new Map();
      for (let byte = 0; byte < 256; byte += 1) {
        const character = legacyDecoder.decode(Uint8Array.of(byte));
        if (character && character !== "\ufffd") legacyThaiByteMap.set(character, byte);
      }
    }
    const bytes = [];
    for (const character of text) {
      const byte = legacyThaiByteMap.get(character);
      if (byte === undefined) return null;
      bytes.push(byte);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

function readableToastMessage(message) {
  const text = String(message || "").trim();
  if (!text) return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  // Some database messages were saved after UTF-8 bytes were decoded as
  // Windows-874. Repair the original Thai message instead of hiding its cause.
  if (/(?:เน€|เน|เธฃ|เธ|เธ|เธ|เธญ|à¸|à¹|Ã|�)/.test(text)) {
    return repairThaiMojibake(text) || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  }
  return text;
}

export function toast(message, tone = "default") {
  const element = $("#toast");
  if (!element) return;
  element.textContent = readableToastMessage(message);
  element.dataset.tone = tone;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
}

export function roomCodeFromUrl() {
  return new URLSearchParams(location.search).get("room")?.replace(/\D/g, "").slice(0, 6) || "";
}

export function modeLabel(mode) {
  return ({ practice: "รอบทดลอง", real: "รอบจริง" })[mode] || "รอบทดลอง";
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
      <span class="lock">${index + 1 === activePlan ? "กำลังใช้" : "พร้อมใช้"}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${activitiesForPlan(index + 1).length} กิจกรรม · ${activitiesForPlan(index + 1).reduce((sum, activity) => sum + activity.minutes, 0)} นาที</p>
    </article>
  `).join("");
}

export function updateConnectionBadge(element, online, label) {
  if (!element) return;
  element.classList.toggle("offline", !online);
  element.innerHTML = `<i></i> ${escapeHtml(label || (online ? "เชื่อมต่อแล้ว" : "ออฟไลน์"))}`;
}
