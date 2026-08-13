(() => {
  const STYLE_ID = "researchstat-ioc-default-style";
  const CONTROL_ID = "researchstat-ioc-default-control";

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ioc-default-control {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 36px;
        padding: 4px 7px 4px 9px;
        border: 1px solid #d9e2f2;
        border-radius: 9px;
        background: #f8fbff;
        color: #263653;
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
      }
      .ioc-default-control span { color: #52627d; }
      .ioc-default-control select {
        min-width: 94px;
        height: 28px;
        padding: 0 22px 0 8px;
        border: 1px solid #cbd7ea;
        border-radius: 7px;
        background: #fff;
        color: #17305d;
        font-weight: 700;
        cursor: pointer;
      }
      .ioc-default-control select:focus {
        outline: 2px solid rgba(49, 99, 220, .18);
        border-color: #3163dc;
      }
      @media (max-width: 520px) {
        .ioc-default-control { justify-content: space-between; }
      }
    `;
    document.head.appendChild(style);
  }

  function isIocPage() {
    const headings = [...document.querySelectorAll("h1, h2, h3")];
    return headings.some((node) => (node.textContent || "").includes("ความตรงเชิงเนื้อหา (IOC)"));
  }

  function setReactSelectValue(select, value) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set;
    if (setter) setter.call(select, value);
    else select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillAll(value) {
    const selects = [...document.querySelectorAll("select")].filter((select) => {
      const label = select.getAttribute("aria-label") || "";
      return /^ข้อ\s+\d+\s+/.test(label);
    });
    if (!selects.length) return;
    selects.forEach((select) => setReactSelectValue(select, value));
  }

  function installControl() {
    if (!isIocPage()) {
      document.getElementById(CONTROL_ID)?.remove();
      return;
    }
    if (document.getElementById(CONTROL_ID)) return;

    const actions = document.querySelector(".ioc-actions");
    if (!actions) return;

    addStyles();
    const wrapper = document.createElement("label");
    wrapper.id = CONTROL_ID;
    wrapper.className = "ioc-default-control";
    wrapper.innerHTML = `
      <span>กำหนดค่าเริ่มต้นทั้งหมด</span>
      <select aria-label="กำหนดค่าเริ่มต้น IOC ทั้งหมด">
        <option value="">— ไม่กำหนด —</option>
        <option value="1">+1</option>
        <option value="0">0</option>
        <option value="-1">-1</option>
      </select>
    `;
    const select = wrapper.querySelector("select");
    select.addEventListener("change", () => {
      if (select.value === "") return;
      fillAll(select.value);
    });
    actions.insertBefore(wrapper, actions.firstChild);
  }

  let scheduled = false;
  function scheduleInstall() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      installControl();
    });
  }

  const observer = new MutationObserver(scheduleInstall);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleInstall);
  window.addEventListener("hashchange", scheduleInstall);
  scheduleInstall();
})();
