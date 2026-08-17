import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EXIT_TICKET_QUESTIONS, EXIT_TICKET_SKILLS } from "../js/exit-ticket-bank.js";

test("all eight plans use twelve Exit Ticket items with equal skill weights", () => {
  assert.equal(EXIT_TICKET_SKILLS.length, 4);
  for (let planId = 1; planId <= 8; planId += 1) {
    const questions = EXIT_TICKET_QUESTIONS[planId];
    assert.equal(questions.length, 12, `plan ${planId}`);
    for (const skill of EXIT_TICKET_SKILLS) {
      assert.equal(questions.filter(question => question.skill_code === skill.code).length, 3, `plan ${planId} ${skill.code}`);
    }
    assert.equal(new Set(questions.map(question => question.id)).size, 12, `plan ${planId} unique ids`);
    questions.forEach(question => assert.ok(question.options.includes(question.answer), question.id));
  }
});

test("student answers persist skill and instrument metadata", () => {
  const student = readFileSync(new URL("../js/student.js", import.meta.url), "utf8");
  assert.match(student, /skill_code: question\.skill_code/);
  assert.match(student, /instrument_version: question\.instrument_version/);
  assert.match(student, /exitTicketForPlan\(planId\)/);
  assert.match(student, /อย่างน้อย 8 จาก/);
});

test("database report reads only real versioned Exit Ticket answers", () => {
  const migration = readFileSync(new URL("../supabase/score-report-sql-backup.sql", import.meta.url), "utf8");
  assert.match(migration, /get_p2_score_report/);
  assert.match(migration, /jsonb_array_elements/);
  assert.match(migration, /teacher_can_access_class/);
  assert.doesNotMatch(migration, /game_skill_map/);
});

test("SQL backup import is constrained to the P2 backup schema", () => {
  const migration = readFileSync(new URL("../supabase/score-report-sql-backup.sql", import.meta.url), "utf8");
  assert.match(migration, /p2_score_backup_v1/);
  assert.match(migration, /record_count > 5000/);
  assert.match(migration, /game_activity_assessment_map allowed/);
  assert.match(migration, /revoke all on function public\.import_p2_score_backup/);
});
