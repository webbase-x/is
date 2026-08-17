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
  assert.match(teacher, /p2_full_report_backup_v2/);
  assert.match(teacher, /แม่แบบ SQL ว่าง/);
  assert.match(teacher, /assessment_scores: \[\]/);
  assert.match(teacher, /game_scores: \[\]/);
  assert.match(teacher, /satisfaction_responses: \[\]/);
  assert.match(teacher, /session_activity_results: \[\]/);
});

test("full report backup covers achievement, games, skills, satisfaction, and session activity", () => {
  const fullBackup = readFileSync(new URL("../supabase/full-report-backup-v2.sql", import.meta.url), "utf8");
  assert.match(fullBackup, /p2_full_report_backup_v2/);
  assert.match(fullBackup, /get_assessment_comparison/);
  assert.match(fullBackup, /get_p2_score_report/);
  assert.match(fullBackup, /get_satisfaction_report/);
  assert.match(fullBackup, /assessment_imported/);
  assert.match(fullBackup, /game_imported/);
  assert.match(fullBackup, /satisfaction_imported/);
  assert.match(fullBackup, /get_p2_session_activity_report/);
  assert.match(fullBackup, /p2_session_result_imports/);
  assert.match(fullBackup, /session_activity_results/);
  assert.match(fullBackup, /session_results_imported/);
});

test("session activity results are visible and included in backup import preview", () => {
  assert.match(teacher, /ผลกิจกรรมรายคาบ/);
  assert.match(teacher, /get_p2_session_activity_report/);
  assert.match(teacher, /ผลกิจกรรมรายคาบ: \$\{sessions\.length\} รายการ/);
  assert.match(teacher, /session_results_imported/);
  assert.match(teacher, /data-export-session-sql/);
  assert.match(teacher, /data-import-session-sql/);
  assert.match(teacher, /สำรองผลรายคาบ SQL/);
  assert.match(teacher, /นำเข้าผลรายคาบ SQL/);
  assert.match(teacher, /sessionOnlyPayload/);
});

test("SQL file pickers work on iOS without MIME filtering", () => {
  assert.doesNotMatch(teacher, /input\.accept\s*=/);
  assert.match(teacher, /document\.body\.appendChild\(input\)/);
  assert.match(teacher, /input\.addEventListener\("cancel", \(\) => input\.remove\(\)/);
  assert.match(teacher, /finally \{\s*input\.remove\(\)/);
});

test("teacher prints four-skill assessment forms from tagged answer scores", () => {
  assert.match(teacher, /data-print-skill-assessment/);
  assert.match(teacher, /function printSkillAssessmentForms\(\)/);
  assert.match(teacher, /ส่งออกแบบประเมิน Word \/ PDF/);
  assert.match(teacher, /score \* 100 \/ max/);
  assert.match(teacher, /percent >= 80 \? 3 : percent >= 60 \? 2 : 1/);
  assert.match(teacher, /คะแนนรวมทั้งหมด: \$\{total === null \? "—" : total\} \/ 12 คะแนน/);
  assert.match(teacher, /เกณฑ์การประเมิน \(Scoring Rubric\)/);
  assert.match(teacher, /เกณฑ์การตัดสินระดับคุณภาพรวม/);
  assert.match(teacher, /window\.print\(\)/);
  assert.match(teacher, /downloadWord\(\)/);
  assert.match(teacher, /application\/msword/);
  assert.match(teacher, /แบบประเมินทักษะ-4-ด้าน-รายบุคคล\.doc/);
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
