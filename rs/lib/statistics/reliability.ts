import { mean, sampleStandardDeviation } from "./descriptive";

export function cronbachAlpha(matrix: number[][]): number | null {
  if (matrix.length < 2 || matrix[0]?.length < 2) return null;
  const k = matrix[0].length;
  if (matrix.some((row) => row.length !== k)) return null;
  const itemVariances = Array.from({ length: k }, (_, column) => {
    const sd = sampleStandardDeviation(matrix.map((row) => row[column]));
    return sd === null ? 0 : sd ** 2;
  });
  const totals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalSd = sampleStandardDeviation(totals);
  if (!totalSd || totalSd === 0) return null;
  return (k / (k - 1)) * (1 - itemVariances.reduce((sum, value) => sum + value, 0) / totalSd ** 2);
}

export function kr20(matrix: number[][]): number | null {
  if (matrix.length < 2 || matrix[0]?.length < 2 || matrix.some((row) => row.some((value) => value !== 0 && value !== 1))) return null;
  const k = matrix[0].length;
  const sumPQ = Array.from({ length: k }, (_, column) => {
    const p = mean(matrix.map((row) => row[column])) ?? 0;
    return p * (1 - p);
  }).reduce((sum, value) => sum + value, 0);
  const totals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalSd = sampleStandardDeviation(totals);
  if (!totalSd || totalSd === 0) return null;
  return (k / (k - 1)) * (1 - sumPQ / totalSd ** 2);
}

export function parseMatrix(text: string): number[][] {
  return text.trim().split(/\n+/).map((row) => row.trim().split(/[\s,;\t]+/).map(Number)).filter((row) => row.length && row.every(Number.isFinite));
}

