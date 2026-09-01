import { mean, median, sampleStandardDeviation } from "./descriptive.ts";

export type AlternativeHypothesis = "greater" | "less" | "two-sided";
export type ComparisonTest = "t-test" | "wilcoxon" | "sign-test";
export type DistributionShape = "approximately-symmetric" | "asymmetric" | "undetermined";

export interface NormalityAssessment {
  n: number;
  test: "Shapiro–Wilk";
  statistic: number | null;
  pValue: number | null;
  skewness: number | null;
  excessKurtosis: number | null;
  bowleySkewness: number | null;
  outlierCount: number;
  shape: DistributionShape;
  normalAt05: boolean | null;
  recommendedTest: ComparisonTest;
  note: string;
  warnings: string[];
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
  totalN: number;
  n: number;
  zeroDifferences: number;
  positiveCount: number;
  negativeCount: number;
  tiedDifferences: number;
  wPlus: number;
  wMinus: number;
  statistic: number;
  z: number | null;
  effectR: number | null;
  rankBiserial: number | null;
  probabilityMethod: "exact-conditional" | "normal-approximation";
  normality: NormalityAssessment;
}

export interface SignTestResult extends SignificanceResult {
  method: "paired-sign-test" | "one-sample-sign-test";
  totalN: number;
  n: number;
  zeroDifferences: number;
  positiveCount: number;
  negativeCount: number;
  statistic: number;
  positiveProportion: number;
  signEffect: number;
  probabilityMethod: "exact-binomial";
  medianDifference: number;
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

/** Acklam's rational approximation of the standard-normal quantile. */
export function standardNormalQuantile(probability: number) {
  if (probability <= 0) return Number.NEGATIVE_INFINITY;
  if (probability >= 1) return Number.POSITIVE_INFINITY;
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const low = 0.02425;
  const high = 1 - low;
  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability > high) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = probability - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function polynomial(coefficients: number[], value: number) {
  return coefficients.reduceRight((result, coefficient) => result * value + coefficient, 0);
}

/** Royston's AS R94 approximation used for the Shapiro–Wilk W test. */
export function shapiroWilk(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 3 || n > 5000 || sorted[n - 1] - sorted[0] <= EPSILON) {
    return { statistic: null, pValue: null };
  }
  const half = Math.floor(n / 2);
  const coefficients = Array.from({ length: half }, (_, index) =>
    standardNormalQuantile((index + 1 - 0.375) / (n + 0.25)),
  );
  const sumSquares = 2 * coefficients.reduce((sum, value) => sum + value * value, 0);
  const rootSumSquares = Math.sqrt(sumSquares);
  const inverseRootN = 1 / Math.sqrt(n);
  const c1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
  const c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
  const originalFirst = coefficients[0];
  const first = polynomial(c1, inverseRootN) - originalFirst / rootSumSquares;
  let start = 1;
  let factor: number;
  coefficients[0] = first;
  if (n > 5) {
    const originalSecond = coefficients[1];
    const second = polynomial(c2, inverseRootN) - originalSecond / rootSumSquares;
    factor = Math.sqrt(
      (sumSquares - 2 * originalFirst ** 2 - 2 * originalSecond ** 2) /
        (1 - 2 * first ** 2 - 2 * second ** 2),
    );
    coefficients[1] = second;
    start = 2;
  } else {
    factor = Math.sqrt((sumSquares - 2 * originalFirst ** 2) / (1 - 2 * first ** 2));
  }
  for (let index = start; index < coefficients.length; index += 1) {
    coefficients[index] /= -factor;
  }
  if (n === 3) coefficients[0] = Math.SQRT1_2;
  const numerator = coefficients.reduce(
    (sum, coefficient, index) => sum + coefficient * (sorted[n - 1 - index] - sorted[index]),
    0,
  );
  const average = mean(sorted)!;
  const denominator = sorted.reduce((sum, value) => sum + (value - average) ** 2, 0);
  const statistic = clampProbability((numerator * numerator) / denominator);
  let pValue: number;
  if (n === 3) {
    pValue = clampProbability((6 / Math.PI) * (Math.asin(Math.sqrt(statistic)) - Math.PI / 3));
  } else {
    let transformed = Math.log1p(-statistic);
    let location: number;
    let scale: number;
    if (n <= 11) {
      const gamma = polynomial([-2.273, 0.459], n);
      if (transformed >= gamma) return { statistic, pValue: 0 };
      transformed = -Math.log(gamma - transformed);
      location = polynomial([0.544, -0.39978, 0.025054, -0.0006714], n);
      scale = Math.exp(polynomial([1.3822, -0.77857, 0.062767, -0.0020322], n));
    } else {
      const logN = Math.log(n);
      location = polynomial([-1.5861, -0.31082, -0.083751, 0.0038915], logN);
      scale = Math.exp(polynomial([-0.4803, -0.082676, 0.0030302], logN));
    }
    pValue = clampProbability(1 - normalCdf((transformed - location) / scale));
  }
  return { statistic, pValue };
}

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
  const sorted = [...clean].sort((a, b) => a - b);
  const quantile = (probability: number) => {
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * probability;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  };
  const q1 = quantile(0.25);
  const q2 = quantile(0.5);
  const q3 = quantile(0.75);
  const iqr = q1 === null || q3 === null ? null : q3 - q1;
  const outlierCount = iqr === null || iqr <= EPSILON
    ? 0
    : clean.filter((value) => value < q1! - 1.5 * iqr || value > q3! + 1.5 * iqr).length;
  const bowleySkewness =
    q1 === null || q2 === null || q3 === null || iqr === null || iqr <= EPSILON
      ? null
      : (q3 + q1 - 2 * q2) / iqr;
  const baseWarnings: string[] = [];
  if (n < 8) baseWarnings.push("กลุ่มตัวอย่างน้อยกว่า 8 ค่า การประเมินรูปทรงการแจกแจงมีความไม่แน่นอนสูง");
  if (outlierCount) baseWarnings.push(`พบค่าผิดปกติตามเกณฑ์ 1.5×IQR จำนวน ${outlierCount} ค่า`);

  if (!n) {
    return {
      n,
      test: "Shapiro–Wilk",
      statistic: null,
      pValue: null,
      skewness: null,
      excessKurtosis: null,
      bowleySkewness,
      outlierCount,
      shape: "undetermined",
      normalAt05: null,
      recommendedTest: "sign-test",
      note: "ยังไม่มีข้อมูลเพียงพอสำหรับประเมินการแจกแจง",
      warnings: baseWarnings,
    };
  }
  const average = mean(clean)!;
  const centered = clean.map((value) => value - average);
  const secondMoment = centered.reduce((sum, value) => sum + value ** 2, 0) / n;
  if (secondMoment <= EPSILON) {
    const warnings = [...baseWarnings, "ข้อมูลไม่มีความแปรปรวน"];
    return {
      n,
      test: "Shapiro–Wilk",
      statistic: null,
      pValue: null,
      skewness: 0,
      excessKurtosis: null,
      bowleySkewness,
      outlierCount,
      shape: "undetermined",
      normalAt05: false,
      recommendedTest: "sign-test",
      note: "ข้อมูลไม่มีความแปรปรวนเพียงพอสำหรับการทดสอบการกระจาย",
      warnings,
    };
  }
  const thirdMoment = centered.reduce((sum, value) => sum + value ** 3, 0) / n;
  const fourthMoment = centered.reduce((sum, value) => sum + value ** 4, 0) / n;
  const skewness = thirdMoment / secondMoment ** 1.5;
  const excessKurtosis = fourthMoment / secondMoment ** 2 - 3;
  const shapiro = shapiroWilk(clean);
  const statistic = shapiro.statistic;
  const pValue = shapiro.pValue;
  const normalAt05 = pValue === null ? null : pValue >= 0.05;
  const asymmetric =
    Math.abs(skewness) > 1 ||
    (bowleySkewness !== null && Math.abs(bowleySkewness) > 0.3);
  const shape: DistributionShape = asymmetric
    ? "asymmetric"
    : n >= 5
      ? "approximately-symmetric"
      : "undetermined";
  const outlierProblem = outlierCount > 0;
  const recommendedTest: ComparisonTest =
    asymmetric
      ? "sign-test"
      : normalAt05 === true && !outlierProblem
        ? "t-test"
        : "wilcoxon";
  const warnings = [...baseWarnings];
  if (asymmetric) warnings.push("การแจกแจงของผลต่างมีแนวโน้มไม่สมมาตร จึงควรพิจารณา Sign Test");
  if (n < 20) warnings.push("กลุ่มตัวอย่างขนาดเล็ก ควรพิจารณา Shapiro–Wilk ร่วมกับ Q–Q plot ความสมมาตร และค่าผิดปกติ");
  const note = normalAt05 === null
    ? "จำนวนข้อมูลยังน้อย จึงใช้ความสมมาตรและค่าผิดปกติประกอบคำแนะนำ"
    : normalAt05
      ? "ยังไม่พบหลักฐานว่าข้อมูลเบี่ยงเบนจากการแจกแจงปกติที่ระดับ .05"
      : "พบหลักฐานว่าข้อมูลเบี่ยงเบนจากการแจกแจงปกติที่ระดับ .05";
  return {
    n,
    test: "Shapiro–Wilk",
    statistic,
    pValue,
    skewness,
    excessKurtosis,
    bowleySkewness,
    outlierCount,
    shape,
    normalAt05,
    recommendedTest,
    note,
    warnings,
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
  const positiveCount = nonZero.filter((value) => value > 0).length;
  const negativeCount = n - positiveCount;
  // Conditional variance of W+ after assigning midranks. This is equivalent
  // to the Wilcoxon tie correction and remains valid when absolute differences repeat.
  const variance = ranks.reduce((sum, rank) => sum + rank * rank, 0) / 4;
  const standardDeviation = variance > 0 ? Math.sqrt(variance) : null;
  const differenceFromExpected = wPlus - expected;
  const z = standardDeviation
    ? alternative === "greater"
      ? (differenceFromExpected - 0.5) / standardDeviation
      : alternative === "less"
        ? (differenceFromExpected + 0.5) / standardDeviation
        : Math.sign(differenceFromExpected) *
          (Math.max(0, Math.abs(differenceFromExpected) - 0.5) / standardDeviation)
    : null;
  const probabilityMethod = n <= 30 ? "exact-conditional" : "normal-approximation";
  let pValue: number | null;
  if (probabilityMethod === "exact-conditional") {
    pValue = exactSignedRankProbability(ranks, wPlus, alternative);
  } else if (z !== null) {
    pValue = alternative === "greater"
      ? 1 - normalCdf(z)
      : alternative === "less"
        ? normalCdf(z)
        : 2 * (1 - normalCdf(Math.abs(z)));
    pValue = clampProbability(pValue);
  } else {
    pValue = null;
  }
  const validAlpha = sanitizedAlpha(alpha);
  return {
    method,
    totalN: clean.length,
    n,
    zeroDifferences: clean.length - nonZero.length,
    positiveCount,
    negativeCount,
    tiedDifferences: tieSizes.reduce((sum, size) => sum + (size > 1 ? size : 0), 0),
    wPlus,
    wMinus,
    statistic: Math.min(wPlus, wMinus),
    z,
    effectR: z === null ? null : Math.min(1, Math.abs(z) / Math.sqrt(n)),
    rankBiserial: totalRank > 0 ? (wPlus - wMinus) / totalRank : null,
    probabilityMethod,
    pValue,
    alpha: validAlpha,
    alternative,
    significant: pValue === null ? null : pValue < validAlpha,
    normality: assessNormality(clean),
  };
}

function binomialHalfCdf(k: number, n: number) {
  if (k < 0) return 0;
  if (k >= n) return 1;
  return regularizedBeta(0.5, n - k, k + 1);
}

function exactSignProbability(
  positiveCount: number,
  n: number,
  alternative: AlternativeHypothesis,
) {
  const lower = binomialHalfCdf(positiveCount, n);
  const upper = 1 - binomialHalfCdf(positiveCount - 1, n);
  if (alternative === "greater") return clampProbability(upper);
  if (alternative === "less") return clampProbability(lower);
  return clampProbability(2 * Math.min(lower, upper));
}

function signTest(
  differences: number[],
  method: SignTestResult["method"],
  alternative: AlternativeHypothesis,
  alpha: number,
): SignTestResult | null {
  const clean = differences.filter(Number.isFinite);
  const nonZero = clean.filter((value) => Math.abs(value) > EPSILON);
  if (!nonZero.length) return null;
  const positiveCount = nonZero.filter((value) => value > 0).length;
  const negativeCount = nonZero.length - positiveCount;
  const n = nonZero.length;
  const pValue = exactSignProbability(positiveCount, n, alternative);
  const validAlpha = sanitizedAlpha(alpha);
  return {
    method,
    totalN: clean.length,
    n,
    zeroDifferences: clean.length - n,
    positiveCount,
    negativeCount,
    statistic: Math.min(positiveCount, negativeCount),
    positiveProportion: positiveCount / n,
    signEffect: (positiveCount - negativeCount) / n,
    probabilityMethod: "exact-binomial",
    medianDifference: median(clean)!,
    pValue,
    alpha: validAlpha,
    alternative,
    significant: pValue < validAlpha,
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

export function pairedSignTest(
  pre: number[],
  post: number[],
  alternative: AlternativeHypothesis = "greater",
  alpha = 0.05,
) {
  if (pre.length !== post.length || !pre.length) return null;
  return signTest(
    post.map((value, index) => value - pre[index]),
    "paired-sign-test",
    alternative,
    alpha,
  );
}

export function oneSampleSignTest(
  values: number[],
  criterion: number,
  alternative: AlternativeHypothesis = "greater",
  alpha = 0.05,
) {
  if (!Number.isFinite(criterion)) return null;
  return signTest(
    values.map((value) => value - criterion),
    "one-sample-sign-test",
    alternative,
    alpha,
  );
}
