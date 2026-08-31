import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeItem,
  analyzeTestMatrix,
} from "../lib/statistics/item-analysis.ts";
import { kr20 } from "../lib/statistics/reliability.ts";

test("item analysis matches the documented p and r example", () => {
  const result = analyzeItem(8, 2, 10);

  assert.equal(result.difficulty, 0.5);
  assert.equal(result.discrimination, 0.6);
  assert.equal(result.difficultyLabel, "ปานกลาง");
  assert.equal(result.discriminationLabel, "ดีมาก");
});

test("matrix analysis ranks respondents and calculates equal high-low groups", () => {
  const matrix = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const result = analyzeTestMatrix(matrix, 0.25);

  assert.equal(result.valid, true);
  assert.equal(result.groupSize, 2);
  assert.deepEqual(result.upperIndexes, [0, 1]);
  assert.deepEqual(result.lowerIndexes, [6, 7]);
  assert.equal(result.middleCount, 4);
  assert.equal(result.items[0].difficulty, 0.5);
  assert.equal(result.items[0].discrimination, 1);
  assert.deepEqual(result.selectedItems, [1, 2, 3]);
});

test("50 percent grouping never overlaps when respondent count is odd", () => {
  const result = analyzeTestMatrix(
    [[1], [1], [0], [0], [0]],
    0.5,
  );

  assert.equal(result.groupSize, 2);
  assert.equal(result.middleCount, 1);
  assert.equal(
    result.upperIndexes.some((index) => result.lowerIndexes.includes(index)),
    false,
  );
});

test("negative discrimination is explicitly flagged for review", () => {
  const result = analyzeItem(2, 8, 10);

  assert.equal(result.discrimination, -0.6);
  assert.match(result.discriminationLabel, /ติดลบ/);
});

test("KR-20 uses total-score sample variance with n - 1", () => {
  const matrix = [
    [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1],
    [1, 1, 0, 0], [1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, 1],
  ];

  const result = kr20(matrix);

  assert.equal(result, 0.875);
  assert.equal(result?.toFixed(2), "0.88");
});
