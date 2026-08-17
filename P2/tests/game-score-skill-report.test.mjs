import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const teacher = readFileSync(new URL("../js/teacher.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/game-score-skill-backfill.sql", import.meta.url), "utf8");

test("teacher report separates game scores from the four-skill Exit Ticket", () => {
  assert.match(teacher, /get_complete_game_score_report/);
  assert.match(teacher, /get_exit_ticket_skill_report/);
  assert.match(teacher, /ครบทุกด่านและทุกเกม/);
  assert.match(teacher, /คะแนนดิบ 4 ทักษะ/);
  assert.match(teacher, /เลือกใช้คำตามบริบท/);
  assert.doesNotMatch(teacher, /อ่าน\/ออกเสียง \(P2\)/);
});

test("teacher can clear imported scores without deleting observed gameplay", () => {
  const clearMigration = readFileSync(new URL("../supabase/clear-imported-game-scores.sql", import.meta.url), "utf8");
  assert.match(teacher, /data-clear-imported-game-scores/);
  assert.match(teacher, /clear_imported_game_scores/);
  assert.match(clearMigration, /source_kind='derived_from_posttest'/);
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

test("research report distinguishes imported data and uses correct statistical wording", () => {
  assert.match(teacher, /pText\.startsWith\("<"\) \? `p \$\{pText\}`/);
  assert.match(teacher, /แผนที่มีข้อมูล/);
  assert.match(teacher, /เล่นจริง/);
  assert.match(teacher, /คะแนนนำเข้า/);
  assert.match(teacher, /คำนวณจากคำตอบจริงท้ายแผนเท่านั้น/);
  assert.doesNotMatch(teacher, /<th>แผนที่เล่น<\/th>/);
  assert.doesNotMatch(teacher, /<th>เกมที่เล่น<\/th>/);
});

test("backfill remains distinguishable from observed gameplay", () => {
  assert.match(migration, /derived_from_posttest/);
  assert.match(migration, /observed_gameplay/);
  assert.match(migration, /not exists \(\s*select 1 from observed/);
});

test("skill rubric implements the attached 12-point quality bands", () => {
  assert.match(migration, />=10 then 'ดี'/);
  assert.match(migration, />=7 then 'พอใช้ \(ผ่านเกณฑ์\)'/);
  assert.match(migration, /'ควรปรับปรุง \(ไม่ผ่านเกณฑ์\)'/);
});
