(() => {
  const THAI_DIGITS = ["๐","๑","๒","๓","๔","๕","๖","๗","๘","๙"];
  const SKIP_TAGS = new Set(["SCRIPT","STYLE","NOSCRIPT","TEXTAREA","CODE","PRE"]);
  const VISIBLE_ATTRS = ["title","placeholder","aria-label","aria-valuetext","alt"];

  function toThaiDigits(value) {
    return String(value ?? "").replace(/[0-9]/g, d => THAI_DIGITS[Number(d)]);
  }

  function shouldSkip(node) {
    const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return !el || SKIP_TAGS.has(el.tagName) || !!el.closest("[data-no-thai-digits]");
  }

  function convertTextNode(node) {
    if (!node || shouldSkip(node) || !/[0-9]/.test(node.nodeValue || "")) return;
    node.nodeValue = toThaiDigits(node.nodeValue);
  }

  function convertVisibleAttrs(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE || shouldSkip(el)) return;
    for (const name of VISIBLE_ATTRS) {
      if (!el.hasAttribute(name)) continue;
      const oldValue = el.getAttribute(name);
      const newValue = toThaiDigits(oldValue);
      if (newValue !== oldValue) el.setAttribute(name, newValue);
    }
    if (/^(BUTTON|INPUT)$/.test(el.tagName)) {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (el.tagName === "BUTTON" || ["button","submit","reset"].includes(type)) {
        if (el.hasAttribute("value")) {
          const oldValue = el.getAttribute("value");
          const newValue = toThaiDigits(oldValue);
          if (newValue !== oldValue) el.setAttribute("value", newValue);
        }
      }
    }
  }

  function convertTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      convertTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) convertVisibleAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) convertTextNode(node);
      else convertVisibleAttrs(node);
    }
  }

  function refresh() {
    document.title = toThaiDigits(document.title);
    convertTree(document.body);
  }

  function start() {
    refresh();
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          convertTextNode(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) convertTree(node);
      }
    });
    observer.observe(document.body, {subtree:true, childList:true, characterData:true});
    window.P1ThaiDigits = {toThaiDigits, refresh};
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once:true});
  } else {
    start();
  }
})();
