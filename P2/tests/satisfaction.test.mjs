import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SATISFACTION_SCALE, satisfactionLevel } from "../js/satisfaction-survey.js";

test("satisfaction scale matches the approved three-point questionnaire", () => {
  assert.deepEqual(SATISFACTION_SCALE.map(item => [item.value, item.label]), [
    [3, "มาก"],
    [2, "ปานกลาง"],
    [1, "น้อย"],
  ]);
});

test("satisfaction averages receive the expected Thai interpretation", () => {
  assert.equal(satisfactionLevel(2.51).label, "ระดับมาก");
  assert.equal(satisfactionLevel(2.5).label, "ระดับปานกลาง");
  assert.equal(satisfactionLevel(1.51).label, "ระดับปานกลาง");
  assert.equal(satisfactionLevel(1.5).label, "ระดับน้อย");
  assert.equal(satisfactionLevel(null).label, "ยังไม่มีข้อมูล");
  assert.equal(satisfactionLevel(undefined).label, "ยังไม่มีข้อมูล");
});

test("teacher plan selection shows an independent ten-item survey after post-test", () => {
  const teacherHtml = readFileSync(new URL("../teacher.html", import.meta.url), "utf8");
  const posttestIndex = teacherHtml.indexOf('data-assessment-phase="posttest"');
  const surveyIndex = teacherHtml.indexOf("data-satisfaction-plan-entry");

  assert.ok(posttestIndex >= 0, "post-test entry should exist");
  assert.ok(surveyIndex > posttestIndex, "survey entry should follow post-test");
  assert.match(teacherHtml, /แบบประเมินความพึงพอใจ/);
  assert.match(teacherHtml, /data-assessment-phase="satisfaction"/);
  assert.match(teacherHtml, /กิจกรรมอิสระ/);
  assert.doesNotMatch(teacherHtml, /เริ่มอัตโนมัติเมื่อนักเรียนส่งแบบทดสอบหลังเรียน/);
});

test("student and database routes keep the survey separate from post-test", () => {
  const studentJs = readFileSync(new URL("../js/student.js", import.meta.url), "utf8");
  const migrationSql = readFileSync(new URL("../supabase/independent-satisfaction-survey.sql", import.meta.url), "utf8");

  assert.match(studentJs, /key === "satisfaction"/);
  assert.match(studentJs, /afterSubmit: null/);
  assert.match(migrationSql, /'pretest', 'posttest', 'satisfaction'/);
  assert.match(migrationSql, /assessment_phase <> 'satisfaction'/);
  assert.doesNotMatch(migrationSql, /กรุณาส่งแบบทดสอบหลังเรียนก่อนทำแบบประเมิน/);
});
