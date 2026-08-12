(() => {
  const hideImportedPanelAfterSave = () => {
    const statusNodes = document.querySelectorAll("span,div,p");
    let saved = false;
    for (const node of statusNodes) {
      if (node.textContent?.trim() === "บันทึกแล้ว") {
        saved = true;
        break;
      }
    }
    if (!saved) return;

    document.querySelectorAll("section.panel.imported-data").forEach((panel) => {
      panel.setAttribute("hidden", "");
      panel.style.setProperty("display", "none", "important");
    });

    document.querySelectorAll(".imported-data").forEach((panel) => {
      panel.setAttribute("hidden", "");
      panel.style.setProperty("display", "none", "important");
    });
  };

  const observer = new MutationObserver(hideImportedPanelAfterSave);
  const start = () => {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    hideImportedPanelAfterSave();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
