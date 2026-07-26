export const REVIEWER_ACCOUNTS = Object.freeze({
  expert1: Object.freeze({
    alias: "expert1",
    email: "expert1@webbase.example",
    label: "ผู้เชี่ยวชาญคนที่ 1",
    kind: "ผู้เชี่ยวชาญ",
  }),
  expert2: Object.freeze({
    alias: "expert2",
    email: "expert2@webbase.example",
    label: "ผู้เชี่ยวชาญคนที่ 2",
    kind: "ผู้เชี่ยวชาญ",
  }),
  expert3: Object.freeze({
    alias: "expert3",
    email: "expert3@webbase.example",
    label: "ผู้เชี่ยวชาญคนที่ 3",
    kind: "ผู้เชี่ยวชาญ",
  }),
  advisor: Object.freeze({
    alias: "advisor",
    email: "advisor@webbase.example",
    label: "อาจารย์ที่ปรึกษา",
    kind: "อาจารย์ที่ปรึกษา",
  }),
});

const LEGACY_REVIEWER_EMAIL = "expert@webbase.x";
const reviewersByEmail = new Map(
  Object.values(REVIEWER_ACCOUNTS).map(account => [account.email, account]),
);

export function reviewerByAlias(alias) {
  return REVIEWER_ACCOUNTS[String(alias || "").trim().toLowerCase()] || null;
}

export function reviewerByEmail(email) {
  return reviewersByEmail.get(String(email || "").trim().toLowerCase()) || null;
}

export function isReviewerEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized === LEGACY_REVIEWER_EMAIL || reviewersByEmail.has(normalized);
}

export function reviewerInviteFromHash(hash = window.location.hash) {
  const fragment = String(hash || "").replace(/^#/, "");
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access");
  if (!accessToken) return null;

  const separatorIndex = accessToken.indexOf(".");
  if (separatorIndex < 1) return null;

  const account = reviewerByAlias(accessToken.slice(0, separatorIndex));
  const password = accessToken.slice(separatorIndex + 1);
  if (!account || password.length < 12 || password.length > 128) return null;

  return Object.freeze({ account, password });
}

export const LEGACY_REVIEWER = Object.freeze({
  alias: "legacy",
  email: LEGACY_REVIEWER_EMAIL,
  label: "บัญชีผู้เชี่ยวชาญเดิม",
  kind: "ผู้เชี่ยวชาญ",
});
