import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const teacher = readFileSync(new URL("../js/teacher.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/game-score-skill-backfill.sql", import.meta.url), "utf8");

test("teacher report combines every game with four skills from tagged answers", () => {
  assert.match(teacher, /get_p2_score_report/);
  assert.match(teacher, /คะแนนดิบทุกเกม ทุกแผน/);
  assert.match(teacher, /คะแนนเกมและทักษะ 4 ด้าน/);
  assert.match(teacher, /ใช้คำตามบริบท/);
  assert.doesNotMatch(teacher, /อ่าน\/ออกเสียง \(P2\)/);
});

test("teacher supports constrained SQL backup export and preview import", () => {
  assert.match(teacher, /export_p2_score_backup/);
  assert.match(teacher, /import_p2_score_backup/);
  assert.match(teacher, /P2_SCORE_BACKUP_JSON_BEGIN/);
  assert.match(teacher, /ตรวจพบชุดสำรองคะแนน P2/);
});

test("new report ignores legacy inferred backfills", () => {
  const reportMigration = readFileSync(new URL("../supabase/score-report-sql-backup.sql", import.meta.url), "utf8");
  assert.match(reportMigration, /legacy_score_backup_v1/);
  assert.match(reportMigration, /p2_score_imports/);
  assert.match(reportMigration, /บันทึกจากการเล่น/);
});

test("class reports load even when no teaching session is open", () => {
  assert.match(teacher, /if \(!state\.session\) \{\s*\$\("#reportContent"\)\.innerHTML = learningReports/);
  assert.match(teacher, /panelId === "reportsPanel" && sessionRecordsScores\(\)/);
  assert.doesNotMatch(teacher, /panelId === "reportsPanel" && state\.session && sessionRecordsScores\(\)/);
});

test("class report shows latest room code and scores for plans one to eight", () => {
  assert.match(teacher, /get_class_report_context/);
  assert.match(teacher, /รหัสห้อง/);
  assert.match(teacher, /คะแนนเกมและทักษะ 4 ด้าน/);
  assert.match(teacher, /planId <= 8/);
  assert.match(teacher, /if \(\$\("#classSelect"\)\.value\) void loadAssessmentReport\(\)/);
});

test("research report uses correct statistical wording and labels score sources", () => {
  const reportMigration = readFileSync(new URL("../supabase/score-report-sql-backup.sql", import.meta.url), "utf8");
  assert.match(teacher, /pText\.startsWith\("<"\) \? `p \$\{pText\}`/);
  assert.doesNotMatch(teacher, /<th>แหล่งข้อมูล<\/th>/);
  assert.match(reportMigration, /บันทึกจากการเล่น/);
  assert.match(reportMigration, /นำเข้าจากชุดสำรอง SQL/);
  assert.match(teacher, /ติดป้ายจริงเท่านั้น/);
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
