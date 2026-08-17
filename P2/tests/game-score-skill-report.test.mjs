import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const teacher = readFileSync(new URL("../js/teacher.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/game-score-skill-backfill.sql", import.meta.url), "utf8");

test("teacher report loads complete per-game and four-skill reports", () => {
  assert.match(teacher, /get_complete_game_score_report/);
  assert.match(teacher, /get_skill_assessment_report/);
  assert.match(teacher, /ครบทุกด่านและทุกเกม/);
  assert.match(teacher, /จำแนกคำ \(P1\)/);
  assert.match(teacher, /อ่าน\/ออกเสียง \(P2\)/);
});

test("teacher can clear restored scores without deleting attempts retained in the database", () => {
  const clearMigration = readFileSync(new URL("../supabase/clear-imported-game-scores.sql", import.meta.url), "utf8");
  assert.match(teacher, /data-clear-imported-game-scores/);
  assert.match(teacher, /clear_imported_game_scores/);
  assert.match(clearMigration, /restored_from_saved_record/);
  assert.doesNotMatch(clearMigration, /delete from public\.game_attempts/);
});

test("class reports load even when no teaching session is open", () => {
  assert.match(teacher, /if \(!state\.session\) \{\s*\$\("#reportContent"\)\.innerHTML = learningReports/);
  assert.match(teacher, /panelId === "reportsPanel" && sessionRecordsScores\(\)/);
  assert.doesNotMatch(teacher, /panelId === "reportsPanel" && state\.session && sessionRecordsScores\(\)/);
});

test("class report shows latest room code and scores for plans one to eight", () => {
  assert.match(teacher, /get_class_report_context/);
  assert.match(teacher, /รหัสห้อง/);
  assert.match(teacher, /คะแนนเกมรายแผน 1–8/);
  assert.match(teacher, /Array\.from\(\{length:8\}/);
  assert.match(teacher, /if \(\$\("#classSelect"\)\.value\) void loadAssessmentReport\(\)/);
});

test("research report describes restored experimental data accurately", () => {
  assert.match(teacher, /pText\.startsWith\("<"\) \? `p \$\{pText\}`/);
  assert.match(teacher, /แผนที่มีข้อมูล/);
  assert.match(teacher, /ข้อมูลทั้งหมดเป็นคะแนนจากการทดลองจริง/);
  assert.match(teacher, /กู้คืนจากคะแนนที่บันทึกไว้หลังฐานข้อมูลเสียหาย/);
  assert.doesNotMatch(teacher, /คำนวณจากหลังเรียน/);
  assert.doesNotMatch(teacher, /คะแนนนำเข้า/);
  assert.match(teacher, /ครูผู้สอนต้องสังเกตและยืนยันผลตามรูบริก/);
  assert.doesNotMatch(teacher, /<th>แผนที่เล่น<\/th>/);
  assert.doesNotMatch(teacher, /<th>เกมที่เล่น<\/th>/);
});

test("backfill remains distinguishable from observed gameplay", () => {
  assert.match(migration, /derived_from_posttest/);
  assert.match(migration, /observed_gameplay/);
  assert.match(migration, /not exists \(\s*select 1 from observed/);
});

test("provenance reconciliation records the teacher-confirmed restoration source", () => {
  const reconciliation = readFileSync(new URL("../supabase/restore-game-score-provenance.sql", import.meta.url), "utf8");
  assert.match(reconciliation, /restored_from_saved_record/);
  assert.match(reconciliation, /source_kind='derived_from_posttest'/);
  assert.doesNotMatch(reconciliation, /delete from public\.game_attempts/);
});

test("skill rubric implements the attached 12-point quality bands", () => {
  assert.match(migration, />=10 then 'ดี'/);
  assert.match(migration, />=7 then 'พอใช้ \(ผ่านเกณฑ์\)'/);
  assert.match(migration, /'ควรปรับปรุง \(ไม่ผ่านเกณฑ์\)'/);
});
