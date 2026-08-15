import assert from "node:assert/strict";
import test from "node:test";
import {
  assessNormality,
  oneSampleTTest,
  oneSampleWilcoxonTest,
  pairedTTest,
  pairedWilcoxonTest,
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
  assert.equal(result.probabilityMethod, "exact");
});

test("one-sample Wilcoxon drops zero differences and preserves tied ranks", () => {
  const result = oneSampleWilcoxonTest(post, 15, "greater", 0.05);
  assert.ok(result);
  assert.equal(result.n, 6);
  assert.equal(result.zeroDifferences, 2);
  assert.equal(result.wPlus, 19);
  assert.equal(result.wMinus, 2);
  closeTo(result.pValue, 0.0625);
});

test("distribution guidance recommends Wilcoxon for strongly skewed data", () => {
  const assessment = assessNormality([0, 0, 0, 0, 0, 0, 0, 0, 0, 100]);
  assert.equal(assessment.normalAt05, false);
  assert.equal(assessment.recommendedTest, "wilcoxon");
});
