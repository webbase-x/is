import { mean, median, sampleStandardDeviation } from "./descriptive";

export type AlternativeHypothesis = "greater" | "less" | "two-sided";
export type ComparisonTest = "t-test" | "wilcoxon";

export interface NormalityAssessment {
  n: number;
  test: "Jarque–Bera";
  statistic: number | null;
  pValue: number | null;
  skewness: number | null;
  excessKurtosis: number | null;
  normalAt05: boolean | null;
  recommendedTest: ComparisonTest;
  note: string;
}

interface SignificanceResult {
  pValue: number | null;
  alpha: number;
  alternative: AlternativeHypothesis;
  significant: boolean | null;
}

export interface PairedResult extends SignificanceResult {
  method: "paired-t-test";
  n: number;
  preMean: number;
  postMean: number;
  meanDifference: number;
  t: number | null;
  df: number;
  cohenDz: number | null;
  normality: NormalityAssessment;
}

export interface OneSampleTResult extends SignificanceResult {
  method: "one-sample-t-test";
  n: number;
  mean: number;
  median: number;
  criterion: number;
  meanDifference: number;
  standardDeviation: number | null;
  t: number | null;
  df: number;
  cohenD: number | null;
  normality: NormalityAssessment;
}

export interface WilcoxonResult extends SignificanceResult {
  method: "paired-wilcoxon" | "one-sample-wilcoxon";
  n: number;
  zeroDifferences: number;
  wPlus: number;
  wMinus: number;
  statistic: number;
  z: number | null;
  rankBiserial: number | null;
  probabilityMethod: "exact" | "normal-approximation";
  normality: NormalityAssessment;
}

const EPSILON = 1e-12;
const clampProbability = (value: number) => Math.max(0, Math.min(1, value));

function erf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const approximation =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t) *
      Math.exp(-x * x);
  return sign * approximation;
}

const normalCdf = (value: number) => 0.5 * (1 + erf(value / Math.SQRT2));

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  const shifted = value - 1;
  let series = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => {
    series += coefficient / (shifted + index + 1);
  });
  const total = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(total) - total + Math.log(series);
}

function betaContinuedFraction(a: number, b: number, x: number) {
  const maxIterations = 200;
  const precision = 3e-14;
  const minimum = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < minimum) d = minimum;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const even = 2 * iteration;
    let coefficient = (iteration * (b - iteration) * x) / ((qam + even) * (a + even));
    d = 1 + coefficient * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + coefficient / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    result *= d * c;
    coefficient = -((a + iteration) * (qab + iteration) * x) / ((a + even) * (qap + even));
    d = 1 + coefficient * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + coefficient / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < precision) break;
  }
  return result;
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (factor * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (factor * betaContinuedFraction(b, a, 1 - x)) / b;
}

function studentTCdf(value: number, df: number) {
  if (!Number.isFinite(value) || df <= 0) return null;
  if (value === 0) return 0.5;
  const beta = regularizedBeta(df / (df + value * value), df / 2, 0.5);
  return value > 0 ? 1 - beta / 2 : beta / 2;
}

function probabilityFromCdf(cdf: number | null, alternative: AlternativeHypothesis) {
  if (cdf === null) return null;
  if (alternative === "greater") return clampProbability(1 - cdf);
  if (alternative === "less") return clampProbability(cdf);
  return clampProbability(2 * Math.min(cdf, 1 - cdf));
}

function sanitizedAlpha(alpha: number) {
  return Number.isFinite(alpha) && alpha > 0 && alpha < 1 ? alpha : 0.05;
}

export function assessNormality(values: number[]): NormalityAssessment {
  const clean = values.filter(Number.isFinite);
  const n = clean.length;
  if (n < 8) {
    return {
      n,
      test: "Jarque–Bera",
      statistic: null,
      pValue: null,
      skewness: null,
      excessKurtosis: null,
      normalAt05: null,
      recommendedTest: "wilcoxon",
      note: "ข้อมูลน้อยกว่า 8 ค่า จึงยังประเมินการกระจายแบบปกติได้ไม่มั่นคง",
    };
  }
  const average = mean(clean)!;
  const centered = clean.map((value) => value - average);
  const secondMoment = centered.reduce((sum, value) => sum + value ** 2, 0) / n;
  if (secondMoment <= EPSILON) {
    return {
      n,
      test: "Jarque–Bera",
      statistic: null,
      pValue: null,
      skewness: 0,
      excessKurtosis: null,
      normalAt05: false,
      recommendedTest: "wilcoxon",
      note: "ข้อมูลไม่มีความแปรปรวนเพียงพอสำหรับการทดสอบการกระจาย",
    };
  }
  const thirdMoment = centered.reduce((sum, value) => sum + value ** 3, 0) / n;
  const fourthMoment = centered.reduce((sum, value) => sum + value ** 4, 0) / n;
  const skewness = thirdMoment / secondMoment ** 1.5;
  const excessKurtosis = fourthMoment / secondMoment ** 2 - 3;
  const statistic = (n / 6) * (skewness ** 2 + excessKurtosis ** 2 / 4);
  const pValue = Math.exp(-statistic / 2);
  const normalAt05 = pValue >= 0.05;
  return {
    n,
    test: "Jarque–Bera",
    statistic,
    pValue,
    skewness,
    excessKurtosis,
    normalAt05,
    recommendedTest: normalAt05 ? "t-test" : "wilcoxon",
    note: normalAt05
      ? "ยังไม่พบหลักฐานว่าข้อมูลเบี่ยงเบนจากการแจกแจงปกติที่ระดับ .05"
      : "พบหลักฐานว่าข้อมูลเบี่ยงเบนจากการแจกแจงปกติที่ระดับ .05",
  };
}

export function oneSampleTTest(
  values: number[],
  criterion: number,
  alternative: AlternativeHypothesis = "greater",
  alpha = 0.05,
): OneSampleTResult | null {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2 || !Number.isFinite(criterion)) return null;
  const average = mean(clean)!;
  const standardDeviation = sampleStandardDeviation(clean);
  const meanDifference = average - criterion;
  const t = standardDeviation && standardDeviation > EPSILON
    ? meanDifference / (standardDeviation / Math.sqrt(clean.length))
    : null;
  const df = clean.length - 1;
  const pValue = probabilityFromCdf(t === null ? null : studentTCdf(t, df), alternative);
  const validAlpha = sanitizedAlpha(alpha);
  return {
    method: "one-sample-t-test",
    n: clean.length,
    mean: average,
    median: median(clean)!,
    criterion,
    meanDifference,
    standardDeviation,
    t,
    df,
    cohenD: standardDeviation && standardDeviation > EPSILON ? meanDifference / standardDeviation : null,
    pValue,
    alpha: validAlpha,
    alternative,
    significant: pValue === null ? null : pValue < validAlpha,
    normality: assessNormality(clean),
  };
}

export function pairedTTest(
  pre: number[],
  post: number[],
  alternative: AlternativeHypothesis = "greater",
  alpha = 0.05,
): PairedResult | null {
  if (pre.length !== post.length || pre.length < 2) return null;
  const differences = post.map((value, index) => value - pre[index]);
  const oneSample = oneSampleTTest(differences, 0, alternative, alpha);
  if (!oneSample) return null;
  return {
    method: "paired-t-test",
    n: pre.length,
    preMean: mean(pre)!,
    postMean: mean(post)!,
    meanDifference: oneSample.meanDifference,
    t: oneSample.t,
    df: oneSample.df,
    cohenDz: oneSample.cohenD,
    pValue: oneSample.pValue,
    alpha: oneSample.alpha,
    alternative,
    significant: oneSample.significant,
    normality: assessNormality(differences),
  };
}

function averageRanks(values: number[]) {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array<number>(values.length);
  const tieSizes: number[] = [];
  let start = 0;
  while (start < indexed.length) {
    let end = start + 1;
    while (end < indexed.length && Math.abs(indexed[end].value - indexed[start].value) <= EPSILON) end += 1;
    const averageRank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) ranks[indexed[index].index] = averageRank;
    tieSizes.push(end - start);
    start = end;
  }
  return { ranks, tieSizes };
}

function exactSignedRankProbability(
  ranks: number[],
  observedWPlus: number,
  alternative: AlternativeHypothesis,
) {
  const scaledRanks = ranks.map((rank) => Math.round(rank * 2));
  const observed = Math.round(observedWPlus * 2);
  let probabilities = new Map<number, number>([[0, 1]]);
  scaledRanks.forEach((rank) => {
    const next = new Map<number, number>();
    probabilities.forEach((probability, sum) => {
      next.set(sum, (next.get(sum) ?? 0) + probability / 2);
      next.set(sum + rank, (next.get(sum + rank) ?? 0) + probability / 2);
    });
    probabilities = next;
  });
  let lower = 0;
  let upper = 0;
  probabilities.forEach((probability, sum) => {
    if (sum <= observed) lower += probability;
    if (sum >= observed) upper += probability;
  });
  if (alternative === "greater") return clampProbability(upper);
  if (alternative === "less") return clampProbability(lower);
  return clampProbability(2 * Math.min(lower, upper));
}

function signedRankTest(
  differences: number[],
  method: WilcoxonResult["method"],
  alternative: AlternativeHypothesis,
  alpha: number,
): WilcoxonResult | null {
  const clean = differences.filter(Number.isFinite);
  const nonZero = clean.filter((value) => Math.abs(value) > EPSILON);
  if (!nonZero.length) return null;
  const { ranks, tieSizes } = averageRanks(nonZero.map(Math.abs));
  const wPlus = ranks.reduce((sum, rank, index) => sum + (nonZero[index] > 0 ? rank : 0), 0);
  const totalRank = ranks.reduce((sum, rank) => sum + rank, 0);
  const wMinus = totalRank - wPlus;
  const expected = totalRank / 2;
  const n = nonZero.length;
  const tieCorrection = tieSizes.reduce(
    (sum, size) => sum + size * (size - 1) * (2 * size + 5),
    0,
  );
  const variance = (n * (n + 1) * (2 * n + 1) - tieCorrection) / 24;
  const standardDeviation = variance > 0 ? Math.sqrt(variance) : null;
  const z = standardDeviation ? (wPlus - expected) / standardDeviation : null;
  const probabilityMethod = n <= 30 ? "exact" : "normal-approximation";
  let pValue: number | null;
  if (probabilityMethod === "exact") {
    pValue = exactSignedRankProbability(ranks, wPlus, alternative);
  } else if (standardDeviation) {
    if (alternative === "greater") {
      pValue = 1 - normalCdf((wPlus - expected - 0.5) / standardDeviation);
    } else if (alternative === "less") {
      pValue = normalCdf((wPlus - expected + 0.5) / standardDeviation);
    } else {
      pValue = 2 * (1 - normalCdf(Math.max(0, Math.abs(wPlus - expected) - 0.5) / standardDeviation));
    }
    pValue = clampProbability(pValue);
  } else {
    pValue = null;
  }
  const validAlpha = sanitizedAlpha(alpha);
  return {
    method,
    n,
    zeroDifferences: clean.length - nonZero.length,
    wPlus,
    wMinus,
    statistic: Math.min(wPlus, wMinus),
    z,
    rankBiserial: totalRank > 0 ? (wPlus - wMinus) / totalRank : null,
    probabilityMethod,
    pValue,
    alpha: validAlpha,
    alternative,
    significant: pValue === null ? null : pValue < validAlpha,
    normality: assessNormality(clean),
  };
}

export function pairedWilcoxonTest(
  pre: number[],
  post: number[],
  alternative: AlternativeHypothesis = "greater",
  alpha = 0.05,
) {
  if (pre.length !== post.length || !pre.length) return null;
  return signedRankTest(
    post.map((value, index) => value - pre[index]),
    "paired-wilcoxon",
    alternative,
    alpha,
  );
}

export function oneSampleWilcoxonTest(
  values: number[],
  criterion: number,
  alternative: AlternativeHypothesis = "greater",
  alpha = 0.05,
) {
  if (!Number.isFinite(criterion)) return null;
  return signedRankTest(
    values.map((value) => value - criterion),
    "one-sample-wilcoxon",
    alternative,
    alpha,
  );
}
