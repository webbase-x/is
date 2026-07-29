import { $ } from "./common.js?v=20260729-plan1-core-plan2-time-1";
import { PLAN_CATALOG, getPlanById } from "./plan-catalog.js?v=20260729-plan1-core-plan2-time-1";

let activePlanId = "01";

function wordChips(words, tone) {
  return words.map(word => `<span class="plan-word-chip ${tone}">${word}</span>`).join("");
}

const WORD_GROUP_META = Object.freeze({
  maeKaka: ["คำมาตราแม่ ก กา", "mae-kaka"],
  finalSound: ["คำที่มีตัวสะกด เพื่อเปรียบเทียบ", "final-sound"],
  maeKong: ["คำมาตราแม่กง", "mae-kaka"],
  maeKom: ["คำมาตราแม่กม", "mae-kaka"],
  maeKoei: ["คำมาตราแม่เกย", "mae-kaka"],
  maeKoew: ["คำมาตราแม่เกอว", "final-sound"],
  direct: ["คำสะกดตรงมาตรา", "mae-kaka"],
  irregular: ["คำสะกดไม่ตรงมาตรา", "final-sound"],
  primary: ["คำตัวอย่างในมาตรานี้", "mae-kaka"],
  compare: ["คำมาตราอื่น เพื่อเปรียบเทียบ", "final-sound"],
});

function renderWordGroups(words = {}) {
  return Object.entries(words)
    .filter(([, items]) => Array.isArray(items) && items.length)
    .map(([key, items]) => {
      const [label, tone] = WORD_GROUP_META[key] || [key, "mae-kaka"];
      return `<p class="plan-word-label">${label}</p><div class="plan-word-list">${wordChips(items, tone)}</div>`;
    })
    .join("");
}

function renderPlanDetail(plan) {
  const stage = $("#planDetail");
  if (!plan.published) {
    stage.innerHTML = `<section class="plan-detail-empty"><span>🔒</span><h2>${plan.title}</h2><p>เตรียมพื้นที่ของแผนนี้ไว้แล้ว เมื่อมีเอกสารและเกมของแผนที่ ${plan.sequence} ให้เพิ่มข้อมูลในชุดแผนกลางเพียงครั้งเดียว</p></section>`;
    return;
  }
  const documentAction = plan.document ? `<a class="button button-primary" href="${plan.document}" target="_blank" rel="noopener">เปิดเอกสารแผน ${plan.id} ↗</a>` : "";
  const gameAction = plan.game ? `<a class="button button-primary" href="${plan.game}">🎮 เล่นเกมแผนที่ ${plan.sequence}</a>` : "";
  const worksheetAction = plan.worksheet ? `<a class="button button-ghost" href="${plan.worksheet}" target="_blank" rel="noopener">📝 เปิดใบงาน ${plan.sequence}</a>` : "";
  stage.innerHTML = `
    <section class="plan-detail-heading">
      <div><span class="eyebrow">แผนการจัดการเรียนรู้ที่ ${plan.sequence}</span><h2>${plan.title}</h2><p>${plan.course}</p><p>${plan.grade}</p><p>${plan.unit} · เวลา ${plan.duration} · หน่วยรวม ${plan.unitDuration}</p></div>
      <div class="plan-detail-actions">${gameAction}${worksheetAction}${documentAction}<a class="button button-ghost" href="teacher.html">เปิดห้องเรียนสด</a><a class="button button-ghost" href="expert.html?plan=${plan.id}">ห้องตรวจสื่อผู้เชี่ยวชาญ</a></div>
    </section>
    <article class="plan-detail-card plan-live-ready"><h3>สถานะการใช้งาน</h3><p>✅ ห้องเรียนสดพร้อม ${plan.activityKeys.length} กิจกรรม · ✅ ใบงานพร้อม · ${plan.document ? "✅ เอกสารต้นฉบับรวมในชุด" : "⚠️ ยังไม่มีเอกสารต้นฉบับในชุด"} · สื่อประกอบ: ${plan.mediaStatus || "สื่อในเว็บ"}</p></article>
    <article class="plan-detail-card plan-summary-card"><h3>สาระสำคัญ / ความคิดรวบยอด</h3><p>${plan.summary}</p></article>
    <div class="plan-detail-grid">
      <article class="plan-detail-card"><h3>มาตรฐานการเรียนรู้</h3><ul>${plan.standards.map(item => `<li>${item}</li>`).join("")}</ul></article>
      <article class="plan-detail-card"><h3>ตัวชี้วัด</h3><ul>${plan.indicators.map(item => `<li>${item}</li>`).join("")}</ul></article>
    </div>
    <article class="plan-detail-card"><h3>จุดประสงค์การเรียนรู้</h3><div class="plan-objective-grid">${plan.objectives.map(item => `<section><strong>${item.label}</strong><p>${item.text}</p></section>`).join("")}</div></article>
    <div class="plan-detail-grid">
      <article class="plan-detail-card"><h3>สาระการเรียนรู้</h3><ul>${plan.learning.map(item => `<li>${item}</li>`).join("")}</ul></article>
      <article class="plan-detail-card"><h3>คลังคำประกอบกิจกรรม</h3>${renderWordGroups(plan.words)}</article>
    </div>`;
}

function renderPlanCards() {
  const list = $("#planCatalog");
  list.innerHTML = PLAN_CATALOG.map(plan => `<button class="plan-catalog-card ${plan.id === activePlanId ? "active" : ""} ${plan.published ? "is-ready" : "is-waiting"}" data-plan-id="${plan.id}" type="button">
    <span class="plan-catalog-number">${String(plan.sequence).padStart(2, "0")}</span>
    <span class="plan-catalog-status">${plan.liveReady ? "ห้องสดพร้อม" : plan.published ? "สื่อเดี่ยวพร้อม" : "รอข้อมูล"}</span>
    <strong>${plan.title}</strong><small>${plan.published ? `${plan.activityKeys.length} กิจกรรม · ${plan.duration}` : "เพิ่มเอกสารและรายละเอียดภายหลัง"}</small>
  </button>`).join("");
  list.querySelectorAll("[data-plan-id]").forEach(button => button.addEventListener("click", () => {
    activePlanId = button.dataset.planId;
    renderPlanCards();
    renderPlanDetail(getPlanById(activePlanId));
    if (matchMedia("(max-width: 980px)").matches) {
      requestAnimationFrame(() => $("#planDetail").scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }));
}

renderPlanCards();
renderPlanDetail(getPlanById(activePlanId));
