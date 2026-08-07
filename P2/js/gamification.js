export const MASTERY_LEVELS = Object.freeze([
  Object.freeze({ key: "explorer", min: 0, title: "เริ่มฝึก", icon: "🧭", message: "รู้แล้วว่าควรฝึกตรงไหน ลองใหม่ได้นะ" }),
  Object.freeze({ key: "practitioner", min: 50, title: "กำลังพัฒนา", icon: "🌱", message: "ทำได้ดีขึ้นแล้ว ฝึกอีกนิดนะ" }),
  Object.freeze({ key: "master", min: 80, title: "ทำได้ดี", icon: "🏅", message: "ทำคะแนนผ่านเกณฑ์ของกิจกรรมแล้ว" }),
  Object.freeze({ key: "perfect", min: 100, title: "ยอดเยี่ยม", icon: "🌟", message: "ตอบถูกครบทุกข้อเลย" }),
]);

const ASSESSMENT_KEYS = new Set(["pretest", "posttest"]);

function boundedPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function parsedAnswers(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function masteryLevelForPercent(value) {
  const percent = boundedPercent(value);
  const level = [...MASTERY_LEVELS].reverse().find(item => percent >= item.min) || MASTERY_LEVELS[0];
  const next = MASTERY_LEVELS.find(item => item.min > percent) || null;
  const levelStart = level.min;
  const levelEnd = next?.min ?? 100;
  const progress = next
    ? Math.round(((percent - levelStart) / Math.max(1, levelEnd - levelStart)) * 100)
    : 100;
  return Object.freeze({ ...level, percent, next, progress: Math.max(0, Math.min(100, progress)) });
}

export function earnedBadgesForAttempt(attempt = {}) {
  const percent = boundedPercent(attempt.percent);
  const passed = attempt.passed === true || percent >= Number(attempt.passPercent || 80);
  const attemptNo = Math.max(1, Number(attempt.attempt_no || attempt.attemptNo || 1));
  const answers = parsedAnswers(attempt.answers);
  const firstTryPerfect = percent === 100 && answers.every(answer => Number(answer?.tries || 1) <= 1);
  const badges = [
    { key: "completed", icon: "🎯", title: "ทำกิจกรรมครบ", detail: "ทำกิจกรรมจนจบ" },
  ];
  if (passed) badges.push({ key: "passed", icon: "🏅", title: "ผ่านเกณฑ์", detail: "ทำคะแนนถึงเกณฑ์ของกิจกรรม" });
  if (firstTryPerfect) badges.push({ key: "perfect", icon: "🌟", title: "ตอบถูกทุกข้อ", detail: "ตอบถูกครบตั้งแต่ครั้งแรก" });
  if (attemptNo > 1 && passed) badges.push({ key: "persistent", icon: "💪", title: "พยายามจนสำเร็จ", detail: "ลองใหม่จนทำคะแนนผ่านเกณฑ์" });
  return badges;
}

export function collectAchievementBadges(attempts = [], passPercent = 80) {
  const groups = new Map();
  attempts.forEach(attempt => {
    const key = String(attempt?.activity_key || "");
    if (!key || ASSESSMENT_KEYS.has(key)) return;
    const group = groups.get(key) || [];
    group.push(attempt);
    groups.set(key, group);
  });

  const earned = new Set();
  groups.forEach((group, activityKey) => {
    const ordered = [...group].sort((a, b) => Number(a.attempt_no || 0) - Number(b.attempt_no || 0));
    earned.add(`completed:${activityKey}`);
    if (ordered.some(item => boundedPercent(item.percent) >= passPercent)) earned.add(`passed:${activityKey}`);
    if (ordered.some(item => boundedPercent(item.percent) === 100)) earned.add(`perfect:${activityKey}`);
    const firstPassIndex = ordered.findIndex(item => boundedPercent(item.percent) >= passPercent);
    if (firstPassIndex > 0) earned.add(`persistent:${activityKey}`);
  });
  return [...earned];
}

export function learningHintForQuestion(question = {}) {
  if (question.hint) return String(question.hint);
  if (question.explanation) return String(question.explanation);
  const focus = String(question.word || question.prompt || "คำนี้").trim();
  return `ยังไม่ถูกนะ อ่าน “${focus}” ช้า ๆ แล้วฟังเสียงท้ายคำ จากนั้นลองตอบอีกครั้ง`;
}

export function classTeamGoal(entries = [], passPercent = 80) {
  const total = entries.length;
  const submitted = entries.filter(entry => {
    const value = entry?.percent;
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }).length;
  const mastered = entries.filter(entry => Number(entry?.percent) >= passPercent).length;
  const required = total ? Math.max(1, Math.ceil(total * 0.8)) : 0;
  const progress = required ? Math.min(100, Math.round((mastered / required) * 100)) : 0;
  return Object.freeze({
    total,
    submitted,
    mastered,
    required,
    progress,
    unlocked: total > 0 && mastered >= required,
  });
}
