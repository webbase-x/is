(() => {
  const TAB_TEXT = "ขนาดอิทธิพล (Effect Size)";
  const PANEL_ID = "effect-size-shared-data-panel";

  const parseNumbers = (text) =>
    String(text || "")
      .split(/[\s,;]+/)
      .map((value) => Number(value))
      .filter(Number.isFinite);

  const mean = (values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  const sampleSd = (values) => {
    if (values.length < 2) return null;
    const average = mean(values);
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  };

  const format = (value, digits = 3) =>
    value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);

  const interpretD = (value) => {
    if (value === null || !Number.isFinite(value)) return "ยังแปลผลไม่ได้";
    const d = Math.abs(value);
    if (d < 0.20) return "เล็กมาก";
    if (d < 0.50) return "เล็ก";
    if (d < 0.80) return "ปานกลาง";
    return "ใหญ่";
  };

  const interpretR = (value) => {
    if (value === null || !Number.isFinite(value)) return "ยังแปลผลไม่ได้";
    const r = Math.abs(value);
    if (r < 0.10) return "เล็กมาก";
    if (r < 0.30) return "เล็ก";
    if (r < 0.50) return "ปานกลาง";
    return "ใหญ่";
  };

  const getMetricValue = (root, labelText) => {
    const metrics = [...root.querySelectorAll("article.metric")];
    const metric = metrics.find((item) => item.querySelector("span")?.textContent?.trim() === labelText);
    return metric?.querySelector("strong")?.textContent?.trim() || null;
  };

  const metricCard = (label, value, note = "") => `
    <article class="metric metric-green">
      <span>${label}</span>
      <strong>${value}</strong>
      ${note ? `<small>${note}</small>` : ""}
    </article>`;

  const restoreNormalView = (tabs, selectedButton) => {
    const parent = tabs.parentElement;
    if (!parent) return;
    [...parent.children].forEach((child) => {
      if (child === tabs) return;
      if (child.id === PANEL_ID) {
        child.style.display = "none";
      } else if (child.dataset.effectSizeHidden === "1") {
        child.style.display = child.dataset.effectSizeDisplay || "";
        delete child.dataset.effectSizeHidden;
        delete child.dataset.effectSizeDisplay;
      }
    });
    [...tabs.querySelectorAll('[role="tab"]')].forEach((button) => {
      const active = button === selectedButton;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  };

  const showEffectPanel = (tabs) => {
    const parent = tabs.parentElement;
    if (!parent) return;

    const regularTabs = [...tabs.querySelectorAll('[role="tab"]')].filter(
      (button) => button.textContent?.trim() !== TAB_TEXT,
    );
    const pairedTab = regularTabs.find((button) => button.textContent?.includes("ก่อนเรียน–หลังเรียน"));
    if (pairedTab && pairedTab.getAttribute("aria-selected") !== "true") {
      pairedTab.click();
      window.setTimeout(() => {
        const refreshedTabs = document.querySelector('.analysis-tabs[role="tablist"]');
        if (refreshedTabs) showEffectPanel(refreshedTabs);
      }, 80);
      return;
    }

    const textareas = [...parent.querySelectorAll("textarea")];
    const pre = parseNumbers(textareas[0]?.value);
    const post = parseNumbers(textareas[1]?.value);
    const validPairs = Math.min(pre.length, post.length);
    const differences = Array.from({ length: validPairs }, (_, index) => post[index] - pre[index]);
    const meanDiff = mean(differences);
    const sdDiff = sampleSd(differences);
    const cohenDz = sdDiff && sdDiff > 0 && meanDiff !== null ? meanDiff / sdDiff : null;

    const wilcoxonCombined = getMetricValue(parent, "Z โดยประมาณ / effect r");
    const wilcoxonR = wilcoxonCombined && wilcoxonCombined.includes("/")
      ? Number(wilcoxonCombined.split("/").at(-1)?.trim())
      : null;
    const rankBiserialText = getMetricValue(parent, "Rank-biserial r");
    const rankBiserial = rankBiserialText ? Number(rankBiserialText) : null;

    let panel = parent.querySelector(`#${PANEL_ID}`);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = PANEL_ID;
      panel.className = "panel";
      tabs.insertAdjacentElement("afterend", panel);
    }

    panel.innerHTML = `
      <div class="panel-head">
        <div>
          <span class="eyebrow">ใช้คะแนนชุดเดียวกับก่อนเรียน–หลังเรียน</span>
          <h3>ขนาดอิทธิพล (Effect Size)</h3>
          <p>ไม่ต้องกรอกข้อมูลซ้ำ ระบบคำนวณจากคะแนนก่อนเรียนและหลังเรียนที่กรอกไว้แล้ว</p>
        </div>
      </div>
      <div class="metrics analysis-metrics">
        ${metricCard("n คู่", String(validPairs), "จำนวนคู่คะแนนที่ใช้คำนวณ")}
        ${metricCard("ผลต่างเฉลี่ย", format(meanDiff), "หลังเรียน − ก่อนเรียน")}
        ${metricCard("S.D. ของผลต่าง", format(sdDiff), "ส่วนเบี่ยงเบนมาตรฐานของคะแนนผลต่าง")}
        ${metricCard("Cohen’s dz", format(cohenDz), `ขนาดอิทธิพลระดับ${interpretD(cohenDz)}`)}
        ${Number.isFinite(wilcoxonR) ? metricCard("Wilcoxon effect r", format(wilcoxonR), `ขนาดอิทธิพลระดับ${interpretR(wilcoxonR)}`) : ""}
        ${Number.isFinite(rankBiserial) ? metricCard("Rank-biserial r", format(rankBiserial), "ขนาดและทิศทางของความแตกต่างเชิงอันดับ") : ""}
      </div>
      <div class="formula">
        <div><b>สูตรสำหรับข้อมูลก่อน–หลังกลุ่มเดิม:</b> Cohen’s d<sub>z</sub> = d̄ / S<sub>d</sub></div>
        <small>เกณฑ์โดยประมาณของ Cohen (1988): |d| ≈ 0.20 เล็ก, 0.50 ปานกลาง, 0.80 ขึ้นไป ใหญ่</small>
      </div>
      <div class="notice analysis-recommendation">
        <b>การแปลผล</b>
        <p>ค่า Effect Size บอกว่าความเปลี่ยนแปลงมีขนาดมากน้อยเพียงใด ไม่ใช่ร้อยละประสิทธิภาพ และไม่ใช่ค่า p-value</p>
      </div>`;

    [...parent.children].forEach((child) => {
      if (child === tabs || child === panel) return;
      if (child.dataset.effectSizeHidden !== "1") {
        child.dataset.effectSizeHidden = "1";
        child.dataset.effectSizeDisplay = child.style.display || "";
      }
      child.style.display = "none";
    });
    panel.style.display = "";

    [...tabs.querySelectorAll('[role="tab"]')].forEach((button) => {
      const active = button.textContent?.trim() === TAB_TEXT;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  };

  const enhanceTabs = () => {
    document.querySelectorAll('.analysis-tabs[role="tablist"]').forEach((tabs) => {
      if (tabs.querySelector('[data-effect-size-tab="1"]')) return;
      const pairedTab = [...tabs.querySelectorAll('[role="tab"]')].find((button) =>
        button.textContent?.includes("ก่อนเรียน–หลังเรียน"),
      );
      if (!pairedTab) return;

      const effectButton = document.createElement("button");
      effectButton.type = "button";
      effectButton.setAttribute("role", "tab");
      effectButton.setAttribute("aria-selected", "false");
      effectButton.dataset.effectSizeTab = "1";
      effectButton.title = "ดูขนาดอิทธิพลจากข้อมูลก่อนเรียน–หลังเรียนชุดเดียวกัน";
      effectButton.textContent = TAB_TEXT;
      effectButton.addEventListener("click", () => showEffectPanel(tabs));
      tabs.appendChild(effectButton);

      [...tabs.querySelectorAll('[role="tab"]')]
        .filter((button) => button !== effectButton)
        .forEach((button) => {
          button.addEventListener("click", () => restoreNormalView(tabs, button));
        });
    });
  };

  const observer = new MutationObserver(() => enhanceTabs());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceTabs();
})();
