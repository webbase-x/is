import { $ } from "./common.js";
import { PLAN_CATALOG, getPlanById } from "./plan-catalog.js";

let activePlanId = "01";

function wordChips(words, tone) {
  return words.map(word => `<span class="plan-word-chip ${tone}">${word}</span>`).join("");
}

function renderPlanDetail(plan) {
  const stage = $("#planDetail");
  if (!plan.published) {
    stage.innerHTML = `<section class="plan-detail-empty"><span>🔒</span><h2>${plan.title}</h2><p>เตรียมพื้นที่ของแผนนี้ไว้แล้ว เมื่อมีเอกสารและเกมของแผนที่ ${plan.sequence} ให้เพิ่มข้อมูลในชุดแผนกลางเพียงครั้งเดียว</p></section>`;
    return;
  }
  stage.innerHTML = `
    <section class="plan-detail-heading">
      <div><span class="eyebrow">แผนการจัดการเรียนรู้ที่ ${plan.sequence}</span><h2>${plan.title}</h2><p>${plan.course}</p><p>${plan.grade}</p><p>${plan.unit} · เวลา ${plan.duration} · หน่วยรวม ${plan.unitDuration}</p></div>
      <a class="button button-primary" href="${plan.document}" target="_blank" rel="noopener">เปิดเอกสารแผน 01 ↗</a>
    </section>
    <article class="plan-detail-card plan-summary-card"><h3>สาระสำคัญ / ความคิดรวบยอด</h3><p>${plan.summary}</p></article>
    <div class="plan-detail-grid">
      <article class="plan-detail-card"><h3>มาตรฐานการเรียนรู้</h3><ul>${plan.standards.map(item => `<li>${item}</li>`).join("")}</ul></article>
      <article class="plan-detail-card"><h3>ตัวชี้วัด</h3><ul>${plan.indicators.map(item => `<li>${item}</li>`).join("")}</ul></article>
    </div>
    <article class="plan-detail-card"><h3>จุดประสงค์การเรียนรู้</h3><div class="plan-objective-grid">${plan.objectives.map(item => `<section><strong>${item.label}</strong><p>${item.text}</p></section>`).join("")}</div></article>
    <div class="plan-detail-grid">
      <article class="plan-detail-card"><h3>สาระการเรียนรู้</h3><ul>${plan.learning.map(item => `<li>${item}</li>`).join("")}</ul></article>
      <article class="plan-detail-card"><h3>คลังคำประกอบกิจกรรม</h3><p class="plan-word-label">คำแม่ ก กา</p><div class="plan-word-list">${wordChips(plan.words.maeKaka, "mae-kaka")}</div><p class="plan-word-label">คำที่มีตัวสะกด เพื่อเปรียบเทียบ</p><div class="plan-word-list">${wordChips(plan.words.finalSound, "final-sound")}</div></article>
    </div>`;
}

function renderPlanCards() {
  const list = $("#planCatalog");
  list.innerHTML = PLAN_CATALOG.map(plan => `<button class="plan-catalog-card ${plan.id === activePlanId ? "active" : ""} ${plan.published ? "is-ready" : "is-waiting"}" data-plan-id="${plan.id}" type="button">
    <span class="plan-catalog-number">${String(plan.sequence).padStart(2, "0")}</span>
    <span class="plan-catalog-status">${plan.published ? "พร้อมใช้" : "รอข้อมูล"}</span>
    <strong>${plan.title}</strong><small>${plan.published ? `${plan.unit} · ${plan.duration}` : "เพิ่มเอกสารและรายละเอียดภายหลัง"}</small>
  </button>`).join("");
  list.querySelectorAll("[data-plan-id]").forEach(button => button.addEventListener("click", () => {
    activePlanId = button.dataset.planId;
    renderPlanCards();
    renderPlanDetail(getPlanById(activePlanId));
  }));
}

renderPlanCards();
renderPlanDetail(getPlanById(activePlanId));
