export function calculateE1E2(processScores: number[], processMax: number, postScores: number[], postMax: number) {
  if (!processScores.length || !postScores.length || processMax <= 0 || postMax <= 0) return null;
  const e1 = (processScores.reduce((a, b) => a + b, 0) / (processScores.length * processMax)) * 100;
  const e2 = (postScores.reduce((a, b) => a + b, 0) / (postScores.length * postMax)) * 100;
  return { e1, e2 };
}

