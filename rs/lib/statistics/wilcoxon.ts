import { median } from "./descriptive";

export interface OneSampleWilcoxonResult {
  /** Number of non-zero differences included in the signed-rank test. */
  n: number;
  excludedZeros: number;
  hypothesizedMedian: number;
  sampleMedian: number;
  medianDifference: number;
  wPlus: number;
  wMinus: number;
  w: number;
  pValue: number;
  z: number | null;
  rankBiserial: number;
  method: "exact" | "normal approximation";
}

type RankedDifference = { difference: number; rank: number };

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t) *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function rankAbsoluteDifferences(differences: number[]): RankedDifference[] {
  const ordered = differences
    .map((difference) => ({ difference, absolute: Math.abs(difference) }))
    .sort((a, b) => a.absolute - b.absolute);
  const ranked: RankedDifference[] = [];

  for (let start = 0; start < ordered.length; ) {
    let end = start + 1;
    while (end < ordered.length && ordered[end].absolute === ordered[start].absolute)
      end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1)
      ranked.push({ difference: ordered[index].difference, rank });
    start = end;
  }
  return ranked;
}

function exactTwoSidedPValue(ranks: number[], observedWPlus: number) {
  const totalRank = ranks.reduce((sum, rank) => sum + rank, 0);
  const observedDistance = Math.abs(observedWPlus - totalRank / 2);
  const outcomes = 2 ** ranks.length;
  let asOrMoreExtreme = 0;

  for (let mask = 0; mask < outcomes; mask += 1) {
    let wPlus = 0;
    for (let index = 0; index < ranks.length; index += 1) {
      if (mask & (1 << index)) wPlus += ranks[index];
    }
    if (Math.abs(wPlus - totalRank / 2) >= observedDistance - 1e-12)
      asOrMoreExtreme += 1;
  }
  return asOrMoreExtreme / outcomes;
}

/**
 * Two-sided one-sample Wilcoxon signed-rank test for a population median.
 * Zero differences are excluded; tied absolute differences receive mean ranks.
 */
export function oneSampleWilcoxon(
  values: number[],
  hypothesizedMedian = 0,
): OneSampleWilcoxonResult | null {
  const validValues = values.filter(Number.isFinite);
  if (!Number.isFinite(hypothesizedMedian) || validValues.length < 2) return null;
  const differences = validValues.map((value) => value - hypothesizedMedian);
  const nonZero = differences.filter((difference) => difference !== 0);
  if (nonZero.length < 2) return null;

  const ranked = rankAbsoluteDifferences(nonZero);
  const wPlus = ranked
    .filter(({ difference }) => difference > 0)
    .reduce((sum, { rank }) => sum + rank, 0);
  const totalRank = ranked.reduce((sum, { rank }) => sum + rank, 0);
  const wMinus = totalRank - wPlus;
  const w = Math.min(wPlus, wMinus);
  const useExact = ranked.length <= 20;
  const rankSquares = ranked.reduce((sum, { rank }) => sum + rank ** 2, 0);
  const standardDeviation = Math.sqrt(rankSquares / 4);
  const distance = Math.max(0, Math.abs(wPlus - totalRank / 2) - 0.5);
  const z = standardDeviation > 0 ? Math.sign(wPlus - totalRank / 2) * distance / standardDeviation : null;
  const pValue = useExact
    ? exactTwoSidedPValue(ranked.map(({ rank }) => rank), wPlus)
    : z === null
      ? 1
      : Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));

  return {
    n: ranked.length,
    excludedZeros: differences.length - ranked.length,
    hypothesizedMedian,
    sampleMedian: median(validValues)!,
    medianDifference: median(nonZero)!,
    wPlus,
    wMinus,
    w,
    pValue,
    z: useExact ? null : z,
    rankBiserial: totalRank ? (wPlus - wMinus) / totalRank : 0,
    method: useExact ? "exact" : "normal approximation",
  };
}

