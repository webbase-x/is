import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const student = readFileSync(new URL("../js/student.js", import.meta.url), "utf8");

test("question games use task difficulty instead of item position", () => {
  assert.match(student, /function questionDifficulty\(question\)/);
  assert.match(student, /function questionsByDifficulty\(questions, seedText\)/);
  assert.match(student, /ระดับความยาก: พื้นฐาน/);
  assert.match(student, /ระดับความยาก: ฝึกใช้/);
  assert.match(student, /ระดับความยาก: ท้าทาย/);
  assert.doesNotMatch(student, /index < Math\.ceil\(questions\.length \/ 3\)/);
});

test("difficulty, progress, and first-attempt mastery are shown separately", () => {
  assert.match(student, /ความก้าวหน้า \$\{index \+ 1\}/);
  assert.match(student, /คะแนนครั้งแรก/);
  assert.match(student, /difficultyDescriptor\(questionDifficulty\(question\)\)/);
});

test("sort and train give immediate feedback and permit correction", () => {
  assert.match(student, /sortFeedback/);
  assert.match(student, /firstPlacements/);
  assert.match(student, /ยังไม่ถูกนะ ลองสังเกตเสียงและพยัญชนะท้ายคำ/);
  assert.match(student, /trainFeedback/);
  assert.match(student, /ลำดับที่ถูกคือ/);
  assert.match(student, /corrected: tries > 1/);
});
