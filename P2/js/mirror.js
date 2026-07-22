import { sanitizeGameMarkup } from "./common.js";

const canvas = document.querySelector("#gameCanvas");
let lastMarkup = "";

function renderFrame(markup) {
  const safeMarkup = sanitizeGameMarkup(markup);
  if (safeMarkup === lastMarkup) return;
  lastMarkup = safeMarkup;
  canvas.innerHTML = safeMarkup || `<div class="empty-stage"><span>📡</span><h2>กำลังรอภาพเกม</h2><p>จอของนักเรียนจะปรากฏอัตโนมัติ</p></div>`;
}

window.addEventListener("message", event => {
  if (event.origin !== window.location.origin) return;
  const payload = event.data;
  if (payload?.type !== "student-game-mirror-frame" || typeof payload.markup !== "string") return;
  renderFrame(payload.markup);
});

window.parent?.postMessage({ type: "student-game-mirror-ready" }, window.location.origin);
