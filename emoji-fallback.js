/*
 * Device-safe emoji rendering.
 *
 * Some classroom devices do not include a colour emoji font and render an
 * emoji as a tofu square.  This small, dependency-free layer replaces emoji
 * text nodes with inline SVG icons.  It runs on every page (including content
 * rendered later by a game) and therefore does not require changes to each
 * individual activity.
 */
(function installEmojiFallback() {
  "use strict";

  const ICONS = {
    generic: '<path fill="currentColor" d="M32 4 38 24 60 32 38 40 32 60 26 40 4 32 26 24Z"/><circle cx="32" cy="32" r="8" fill="#fff" opacity=".9"/>',
    star: '<path fill="#f7bd47" d="m32 4 7.1 18.1L58 24l-15 12.2L47.5 56 32 45.7 16.5 56 21 36.2 6 24l18.9-1.9Z"/>',
    trophy: '<path fill="#f7bd47" d="M22 8h20v10c0 9-4 15-10 18-6-3-10-9-10-18Z"/><path fill="#c88720" d="M22 12H10v5c0 8 5 13 14 14l2-5c-6 0-10-3-10-8v-1h6Zm20 0h12v5c0 8-5 13-14 14l-2-5c6 0 10-3 10-8v-1h-6Z"/><path fill="#c88720" d="M28 36h8v12h8v8H20v-8h8Z"/>',
    game: '<path fill="#5b3fd0" d="M8 25c2-8 8-13 16-13h16c8 0 14 5 16 13l5 18c2 8-8 13-13 7l-8-9H24l-8 9c-5 6-15 1-13-7Z"/><path fill="#fff" d="M18 27h6v-6h5v6h6v5h-6v6h-5v-6h-6Z"/><circle cx="46" cy="27" r="3" fill="#f7bd47"/><circle cx="53" cy="34" r="3" fill="#f7bd47"/>',
    phone: '<rect x="17" y="5" width="30" height="54" rx="6" fill="#4b6fd7"/><rect x="21" y="11" width="22" height="38" rx="2" fill="#eef5ff"/><circle cx="32" cy="54" r="2.5" fill="#eef5ff"/>',
    speaker: '<path fill="#5b3fd0" d="M8 25h12l14-12v38L20 39H8Z"/><path fill="none" stroke="#5b3fd0" stroke-linecap="round" stroke-width="5" d="M42 23c5 4 5 14 0 18M49 16c10 8 10 24 0 32"/>',
    camera: '<rect x="8" y="16" width="48" height="36" rx="7" fill="#5b3fd0"/><path fill="#8f7bea" d="m20 16 4-7h16l4 7Z"/><circle cx="32" cy="34" r="11" fill="#fff"/><circle cx="32" cy="34" r="6" fill="#5b3fd0"/>',
    lock: '<rect x="13" y="27" width="38" height="29" rx="5" fill="#5b3fd0"/><path fill="none" stroke="#5b3fd0" stroke-linecap="round" stroke-width="7" d="M21 28V18c0-15 22-15 22 0v10"/><circle cx="32" cy="41" r="4" fill="#fff"/>',
    map: '<path fill="#35bf8d" d="m8 12 16-6 16 6 16-6v46l-16 6-16-6-16 6Z"/><path fill="none" stroke="#fff" stroke-width="3" d="M24 6v46M40 12v46"/><path fill="#f7bd47" d="m32 17 3.5 8.5L45 29l-7.5 6L40 45l-8-5-8 5 2.5-10L19 29l9.5-3.5Z"/>',
    pause: '<rect x="13" y="10" width="14" height="44" rx="3" fill="#5b3fd0"/><rect x="37" y="10" width="14" height="44" rx="3" fill="#5b3fd0"/>',
    hourglass: '<path fill="#5b3fd0" d="M14 7h36v7c0 8-5 13-11 18 6 5 11 10 11 18v7H14v-7c0-8 5-13 11-18-6-5-11-10-11-18Z"/><path fill="#f7bd47" d="M22 15h20c-1 5-5 8-10 12-5-4-9-7-10-12Zm0 34h20c-1-5-5-8-10-12-5 4-9 7-10 12Z"/>',
    heart: '<path fill="#ef668d" d="M32 55S8 41 8 24C8 13 21 8 29 18c1 1 2 3 3 4 1-1 2-3 3-4 8-10 21-5 21 6 0 17-24 31-24 31Z"/>',
    people: '<circle cx="24" cy="22" r="9" fill="#5b3fd0"/><circle cx="44" cy="25" r="8" fill="#8f7bea"/><path fill="#5b3fd0" d="M8 55c1-14 7-22 16-22s15 8 16 22Z"/><path fill="#8f7bea" d="M35 55c1-12 5-19 12-19s10 7 11 19Z"/>',
    home: '<path fill="#ef7a57" d="m6 29 26-22 26 22v27H38V39H26v17H6Z"/><path fill="#f7bd47" d="M32 7 6 29h8L32 15l18 14h8Z"/>',
    train: '<path fill="#5b3fd0" d="M15 10h34c6 0 10 5 10 11v22c0 5-4 9-9 9H14c-5 0-9-4-9-9V21c0-6 4-11 10-11Z"/><rect x="13" y="18" width="14" height="12" rx="2" fill="#eef5ff"/><rect x="37" y="18" width="14" height="12" rx="2" fill="#eef5ff"/><circle cx="20" cy="43" r="5" fill="#f7bd47"/><circle cx="44" cy="43" r="5" fill="#f7bd47"/><path fill="none" stroke="#5b3fd0" stroke-linecap="round" stroke-width="4" d="M20 52 14 59M44 52l6 7"/>',
    medal: '<circle cx="32" cy="36" r="20" fill="#f7bd47"/><path fill="#5b3fd0" d="m32 22 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z"/><path fill="#5b3fd0" d="M19 6h10l3 13-8-4-8 4Zm26 0H35l-3 13 8-4 8 4Z"/>',
    chart: '<rect x="8" y="8" width="48" height="48" rx="8" fill="#eef5ff"/><path fill="none" stroke="#5b3fd0" stroke-linecap="round" stroke-width="6" d="M18 44V32M32 44V20M46 44V27"/>',
    flag: '<path fill="#5b3fd0" d="M14 7h5v50h-5Z"/><path fill="#ef668d" d="M19 10h33l-8 11 8 11H19Z"/>',
    fire: '<path fill="#ef7a57" d="M33 5c5 11-2 15 7 23 6 5 8 10 8 16 0 10-7 17-17 17S14 54 14 44c0-7 4-13 11-19 1 6 4 8 7 9 4-9-3-15 1-29Z"/><path fill="#f7bd47" d="M33 31c4 7 8 8 8 15 0 6-4 10-10 10s-10-4-10-10c0-4 3-8 7-11 1 3 3 4 5 4 2-3-1-5 0-8Z"/>',
    microphone: '<rect x="23" y="7" width="18" height="31" rx="9" fill="#5b3fd0"/><path fill="none" stroke="#5b3fd0" stroke-linecap="round" stroke-width="5" d="M16 28c0 11 7 18 16 18s16-7 16-18M32 46v11M23 57h18"/>',
    eye: '<path fill="#5b3fd0" d="M5 32s10-17 27-17 27 17 27 17-10 17-27 17S5 32 5 32Z"/><circle cx="32" cy="32" r="9" fill="#fff"/><circle cx="32" cy="32" r="4" fill="#5b3fd0"/>',
    avatar: '<circle cx="32" cy="32" r="27" fill="#8f7bea"/><circle cx="32" cy="25" r="9" fill="#fff"/><path fill="#fff" d="M15 53c2-11 8-17 17-17s15 6 17 17Z"/>',
  };

  const ICON_BY_EMOJI = {
    "⭐": "star", "🌟": "star", "🏆": "trophy", "🥇": "medal", "🥈": "medal", "🥉": "medal",
    "🎮": "game", "📱": "phone", "📲": "phone", "🔊": "speaker", "🔇": "speaker", "📣": "speaker",
    "📷": "camera", "📸": "camera", "🔐": "lock", "🔑": "lock", "🔒": "lock", "🗝️": "lock", "🗝": "lock",
    "🗺️": "map", "🗺": "map", "⏸️": "pause", "⏸": "pause", "⏳": "hourglass", "💗": "heart", "💞": "heart",
    "👥": "people", "🙋": "people", "🏠": "home", "🏡": "home", "🚂": "train", "📊": "chart", "🏁": "flag",
    "🔥": "fire", "🎤": "microphone", "🎶": "microphone", "🎵": "microphone", "🎧": "speaker", "👂": "eye",
    "📡": "eye", "👋": "people", "🎯": "star", "🎉": "star", "🎈": "star", "🖨": "chart", "📄": "chart",
    "🦉": "avatar", "🐯": "avatar", "🐳": "avatar", "🐰": "avatar", "🦊": "avatar", "🐼": "avatar", "🦁": "avatar",
    "🐸": "avatar", "🐙": "avatar", "🦋": "avatar", "🚀": "avatar", "🐘": "avatar", "🐢": "avatar", "🐄": "avatar",
    "🐻": "avatar", "🐍": "avatar", "🐔": "avatar", "🐦": "avatar", "🐬": "avatar", "🐴": "avatar", "🫏": "avatar",
    "🐊": "avatar", "🧒": "avatar", "🙂": "avatar", "😊": "avatar", "🟫": "avatar", "🍽️": "avatar", "🍽": "avatar",
    "🍭": "star", "🌈": "star", "🎁": "star", "💦": "star", "💬": "star", "📦": "chart", "🎒": "chart", "🏫": "home",
    "🤝": "people", "🔎": "eye", "🔤": "chart", "💤": "hourglass", "🔔": "speaker", "🖊️": "chart", "🖊": "chart",
  };

  const emojiPattern = /(?:[\u{1F1E6}-\u{1F1FF}][\u{1F1E6}-\u{1F1FF}]|[\u{1F000}-\u{1FAFF}][\u{FE0E}\u{FE0F}]?(?:\u{200D}[\u{1F000}-\u{1FAFF}][\u{FE0E}\u{FE0F}]?)*|[\u{2300}-\u{23FF}][\u{FE0E}\u{FE0F}]?|[\u{2600}-\u{27BF}][\u{FE0E}\u{FE0F}]?|[#*0-9]\u{FE0F}?\u{20E3})/gu;

  function iconFor(token) {
    const normalized = token.replace(/\uFE0F/g, "");
    return ICONS[ICON_BY_EMOJI[token] || ICON_BY_EMOJI[normalized] || "generic"];
  }

  function replaceTextNode(node) {
    if (!node.nodeValue || !node.parentElement || node.parentElement.closest("script,style,svg,textarea,input,.emoji-fallback,[contenteditable='true']")) return;
    emojiPattern.lastIndex = 0;
    if (!emojiPattern.test(node.nodeValue)) return;
    emojiPattern.lastIndex = 0;
    const text = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let match;
    while ((match = emojiPattern.exec(text))) {
      if (match.index > cursor) fragment.append(document.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      const span = document.createElement("span");
      span.className = "emoji-fallback";
      span.setAttribute("role", "img");
      span.setAttribute("aria-label", token);
      span.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${iconFor(token)}</svg>`;
      fragment.append(span);
      cursor = match.index + token.length;
    }
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      replaceTextNode(root);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    nodes.forEach(replaceTextNode);
  }

  function start() {
    if (!document.body || document.body.dataset.emojiFallbackInstalled) return;
    document.body.dataset.emojiFallbackInstalled = "true";
    const style = document.createElement("style");
    style.textContent = ".emoji-fallback{display:inline-flex;align-items:center;justify-content:center;width:1.18em;height:1.18em;line-height:1;vertical-align:-.18em;flex:0 0 auto}.emoji-fallback>svg{display:block;width:100%;height:100%;overflow:visible}.emoji-fallback[role=img]{speak:never}";
    document.head.append(style);
    scan(document.body);
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => scan(node))));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
