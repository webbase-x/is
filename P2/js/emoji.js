const TWEMOJI_ASSET_ROOT = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";
const EMOJI_SEQUENCE_PATTERN = /(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?\p{Emoji_Modifier}?)*\uFE0F?)/gu;
const SKIP_SELECTOR = "script, style, textarea, code, pre, svg, math, .portable-emoji, .emoji-image-fallback, [data-native-emoji]";

let emojiObserver = null;

function emojiCodepoints(value) {
  return [...value]
    .map(character => character.codePointAt(0))
    .filter(codepoint => codepoint !== 0xfe0e && codepoint !== 0xfe0f)
    .map(codepoint => codepoint.toString(16))
    .join("-");
}

function ensureEmojiStyles() {
  if (document.getElementById("portableEmojiStyles")) return;
  const styles = document.createElement("style");
  styles.id = "portableEmojiStyles";
  styles.textContent = `
    .portable-emoji {
      display: inline-block;
      width: 1em;
      height: 1em;
      margin: 0 .04em;
      object-fit: contain;
      vertical-align: -.14em;
    }
    .emoji-image-fallback {
      display: inline-grid;
      width: .82em;
      height: .82em;
      margin: 0 .08em;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      background: #6d5ce7;
      vertical-align: -.08em;
    }
  `;
  document.head.append(styles);
}

function makeEmojiImage(value) {
  const image = document.createElement("img");
  image.className = "portable-emoji";
  image.alt = value;
  image.decoding = "async";
  image.loading = "eager";
  image.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.className = "emoji-image-fallback";
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", value);
    fallback.title = value;
    image.replaceWith(fallback);
  }, { once: true });
  image.src = `${TWEMOJI_ASSET_ROOT}/${emojiCodepoints(value)}.svg`;
  return image;
}

function replaceEmojiText(textNode) {
  const parent = textNode.parentElement;
  if (!parent || parent.closest(SKIP_SELECTOR)) return;

  const text = textNode.nodeValue || "";
  const matches = [...text.matchAll(EMOJI_SEQUENCE_PATTERN)];
  if (!matches.length) return;

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    const index = match.index ?? 0;
    if (index > cursor) fragment.append(document.createTextNode(text.slice(cursor, index)));
    fragment.append(makeEmojiImage(match[0]));
    cursor = index + match[0].length;
  }
  if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
  textNode.replaceWith(fragment);
}

function renderEmojiImages(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    replaceEmojiText(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE && root.matches(SKIP_SELECTOR)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(replaceEmojiText);
}

export function installEmojiImages() {
  if (emojiObserver) return;
  ensureEmojiStyles();
  renderEmojiImages(document.body);

  emojiObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") renderEmojiImages(mutation.target);
      mutation.addedNodes.forEach(renderEmojiImages);
    }
  });
  emojiObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installEmojiImages, { once: true });
} else {
  installEmojiImages();
}
