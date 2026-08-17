export const SATISFACTION_SCALE = Object.freeze([
  Object.freeze({ value: 3, label: "มาก", icon: "😄", helper: "ชอบมาก / เห็นด้วยมาก" }),
  Object.freeze({ value: 2, label: "ปานกลาง", icon: "🙂", helper: "รู้สึกปานกลาง" }),
  Object.freeze({ value: 1, label: "น้อย", icon: "😐", helper: "ชอบน้อย / เห็นด้วยน้อย" }),
]);

export function satisfactionLevel(mean) {
  if (mean === null || mean === undefined || mean === "") return { label: "ยังไม่มีข้อมูล", className: "is-empty" };
  const value = Number(mean);
  if (!Number.isFinite(value)) return { label: "ยังไม่มีข้อมูล", className: "is-empty" };
  if (value >= 2.51) return { label: "ระดับมาก", className: "is-high" };
  if (value >= 1.51) return { label: "ระดับปานกลาง", className: "is-medium" };
  return { label: "ระดับน้อย", className: "is-low" };
}
