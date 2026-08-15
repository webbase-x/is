import assert from "node:assert/strict";
import test from "node:test";
import {
  assessNormality,
  oneSampleSignTest,
  oneSampleTTest,
  oneSampleWilcoxonTest,
  pairedTTest,
  pairedSignTest,
  pairedWilcoxonTest,
  shapiroWilk,
} from "../lib/statistics/paired-test";

const pre = [10, 12, 11, 14, 9, 13, 12, 10];
const post = [16, 17, 15, 18, 14, 17, 16, 15];

function closeTo(actual: number | null, expected: number, tolerance = 1e-10) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual as number) - expected) <= tolerance);
}

test("paired t-test matches a reference calculation", () => {
  const result = pairedTTest(pre, post, "greater", 0.05);
  assert.ok(result);
  closeTo(result.t, 17.582065642525187);
  closeTo(result.pValue, 2.371345285518468e-7, 1e-12);
  assert.equal(result.significant, true);
  assert.equal(result.df, 7);
});

test("one-sample t-test supports a directional criterion hypothesis", () => {
  const result = oneSampleTTest(post, 15, "greater", 0.05);
  assert.ok(result);
  closeTo(result.t, 2.160246899469287);
  closeTo(result.pValue, 0.033791646911684986, 1e-12);
  assert.equal(result.significant, true);
});

test("paired Wilcoxon uses the exact signed-rank distribution for small n", () => {
  const result = pairedWilcoxonTest(pre, post, "greater", 0.05);
  assert.ok(result);
  assert.equal(result.wPlus, 36);
  assert.equal(result.wMinus, 0);
  closeTo(result.pValue, 0.00390625);
  assert.equal(result.probabilityMethod, "exact-conditional");
  assert.equal(result.totalN, 8);
});

test("one-sample Wilcoxon drops zero differences and preserves tied ranks", () => {
  const result = oneSampleWilcoxonTest(post, 15, "greater", 0.05);
  assert.ok(result);
  assert.equal(result.n, 6);
  assert.equal(result.zeroDifferences, 2);
  assert.equal(result.wPlus, 19);
  assert.equal(result.wMinus, 2);
  closeTo(result.pValue, 0.0625);
  assert.equal(result.tiedDifferences, 5);
  assert.equal(result.positiveCount, 5);
  assert.equal(result.negativeCount, 1);
});

test("Wilcoxon normal approximation applies the midrank tie variance", () => {
  const values = Array.from({ length: 52 }, (_, index) => 10 + ((index * 7) % 13) - 6);
  const result = oneSampleWilcoxonTest(values, 10, "greater", 0.05);
  assert.ok(result);
  assert.equal(result.probabilityMethod, "normal-approximation");
  closeTo(result.z, -0.005145351037341284, 1e-12);
  closeTo(result.pValue, 0.5020526890189326, 2e-7);
});

test("distribution guidance recommends Sign Test for strongly skewed data", () => {
  const assessment = assessNormality([0, 0, 0, 0, 0, 0, 0, 0, 0, 100]);
  assert.equal(assessment.normalAt05, false);
  assert.equal(assessment.recommendedTest, "sign-test");
  assert.equal(assessment.shape, "asymmetric");
});

test("Shapiro-Wilk matches a reference calculation for n = 13", () => {
  const result = shapiroWilk([2.1, 2.9, 3, 3.1, 3.2, 3.4, 3.8, 4, 4.2, 4.5, 4.9, 5.1, 5.2]);
  closeTo(result.statistic, 0.9584633776273292, 1e-8);
  closeTo(result.pValue, 0.7298010040313975, 1e-6);
});

test("one-sample Sign Test matches the exact binomial distribution", () => {
  const result = oneSampleSignTest([26, 25, 24, 28, 22, 27, 23], 24, "greater", 0.05);
  assert.ok(result);
  assert.equal(result.totalN, 7);
  assert.equal(result.n, 6);
  assert.equal(result.zeroDifferences, 1);
  assert.equal(result.positiveCount, 4);
  assert.equal(result.negativeCount, 2);
  closeTo(result.pValue, 0.34375);
  closeTo(result.signEffect, 1 / 3);
});

test("two-sided Sign Test doubles the smaller exact tail", () => {
  const result = oneSampleSignTest([26, 25, 24, 28, 22, 27, 23], 24, "two-sided", 0.05);
  assert.ok(result);
  closeTo(result.pValue, 0.6875);
});

test("paired Sign Test uses post-minus-pre signs", () => {
  const result = pairedSignTest(pre, post, "greater", 0.05);
  assert.ok(result);
  assert.equal(result.positiveCount, 8);
  assert.equal(result.negativeCount, 0);
  closeTo(result.pValue, 0.00390625);
});
