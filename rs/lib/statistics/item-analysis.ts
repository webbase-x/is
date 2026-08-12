export interface ItemAnalysisResult {
  difficulty: number | null;
  discrimination: number | null;
  difficultyLabel: string;
  discriminationLabel: string;
}

export function analyzeItem(upperCorrect: number, lowerCorrect: number, groupSize: number): ItemAnalysisResult {
  if (groupSize <= 0) return { difficulty: null, discrimination: null, difficultyLabel: "ข้อมูลไม่ถูกต้อง", discriminationLabel: "ข้อมูลไม่ถูกต้อง" };
  const difficulty = (upperCorrect + lowerCorrect) / (2 * groupSize);
  const discrimination = (upperCorrect - lowerCorrect) / groupSize;
  const difficultyLabel = difficulty < 0.2 ? "ยากมาก" : difficulty <= 0.8 ? "ใช้ได้" : "ง่ายมาก";
  const discriminationLabel = discrimination >= 0.4 ? "ดีมาก" : discrimination >= 0.3 ? "ดี" : discrimination >= 0.2 ? "พอใช้" : "ควรปรับปรุง";
  return { difficulty, discrimination, difficultyLabel, discriminationLabel };
}

