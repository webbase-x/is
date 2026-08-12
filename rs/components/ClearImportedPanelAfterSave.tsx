"use client";

import { useEffect } from "react";

/**
 * Keeps the OCR/import verification panel visible while an imported dataset
 * is being reviewed, then removes it from the workspace after a successful
 * save. The saved source remains in the analysis record and can be restored
 * when the saved analysis is opened again.
 */
export default function ClearImportedPanelAfterSave() {
  useEffect(() => {
    const sync = () => {
      const saveStatus = Array.from(document.querySelectorAll(".analysis-filebar span"))
        .some((element) => element.textContent?.trim() === "บันทึกแล้ว");
      const panel = document.querySelector<HTMLElement>(".imported-data");
      if (panel) panel.style.display = saveStatus ? "none" : "";
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
