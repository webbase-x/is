// Type 1 text-only RT reading practice. Source banks in ../data/ remain authoritative.
export const YEARS = Object.freeze([2559,2560,2561,2562,2563,2564,2565,2566,2567,2568]);
export const GROUPS = Object.freeze([
  {id:"all",label:"ทุกหมวด"},
  {id:"oral-word",label:"อ่านคำ"},
  {id:"oral-sentence",label:"อ่านประโยค"},
  {id:"oral-passage",label:"อ่านเรื่อง"}
]);
const VALID_GROUPS = new Set(GROUPS.map(group => group.id).filter(id => id !== "all"));

export function buildTypeOneDeck(bank) {
  if (!bank || !YEARS.includes(bank.year) || bank.id !== bank.year + "-1" || bank.form !== 1 || !Array.isArray(bank.questions)) {
    throw new Error("คลังข้อสอบรูปแบบที่ 1 ไม่ถูกต้อง");
  }
  const seen = new Set();
  return bank.questions.filter(q => {
    // Text-only: do not pretend that image-based items were transcribed.
    return q && q.year === bank.year && q.form === 1 && q.subject === "oral" &&
      VALID_GROUPS.has(q.category) && !q.image &&
      typeof q.prompt === "string" && q.prompt.trim().length > 0 &&
      Number.isInteger(q.maxPoints) && q.maxPoints > 0 && q.maxPoints <= 20;
  }).map(q => {
    if (seen.has(q.id)) throw new Error("พบรหัสข้อสอบซ้ำ");
    seen.add(q.id);
    return {
      id:q.id, year:q.year, form:1, no:q.no, group:q.category,
      text:q.prompt.trim(), maxPoints:q.maxPoints,
      sourcePage:Number.isInteger(q.source?.page) ? q.source.page : null,
      sourceFile:typeof q.source?.file === "string" ? q.source.file : ""
    };
  });
}

export function selectQuestions(deck, group) {
  if (group === "all") return [...deck];
  if (!VALID_GROUPS.has(group)) return [];
  return deck.filter(q => q.group === group);
}

export function summarize(deck, answers) {
  let answered=0, points=0, maxPoints=0;
  for (const q of deck) {
    maxPoints += q.maxPoints;
    const value=answers?.[q.id];
    if (Number.isInteger(value) && value>=0 && value<=q.maxPoints) {
      answered++; points+=value;
    }
  }
  return {total:deck.length,answered,points,maxPoints,percent:maxPoints ? Math.round(points/maxPoints*100) : 0};
}

export function csvCell(value) {
  let s=String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
