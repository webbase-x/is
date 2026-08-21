import assert from "node:assert/strict";
import test from "node:test";
import {
  classTeamGoal,
  collectAchievementBadges,
  earnedBadgesForAttempt,
  isExitTicketActivityKey,
  isNonCompetitiveAssessmentKey,
  masteryLevelForPercent,
  scoredAnswerForAttempt,
} from "../js/gamification.js";

test("mastery levels progress from explorer to perfect", () => {
  assert.equal(masteryLevelForPercent(20).key, "explorer");
  assert.equal(masteryLevelForPercent(65).key, "practitioner");
  assert.equal(masteryLevelForPercent(85).key, "master");
  assert.equal(masteryLevelForPercent(100).key, "perfect");
});

test("attempt badges reward mastery, accuracy, and persistence", () => {
  const badges = earnedBadgesForAttempt({
    percent: 100,
    passed: true,
    attempt_no: 2,
    answers: [{ correct: true, tries: 1 }],
  }).map(item => item.key);
  assert.deepEqual(badges, ["completed", "passed", "perfect", "persistent"]);
});

test("badge collection excludes research assessments", () => {
  const badges = collectAchievementBadges([
    { activity_key: "pretest", percent: 100, attempt_no: 1 },
    { activity_key: "satisfaction", percent: 100, attempt_no: 1 },
    { activity_key: "exit", percent: 100, attempt_no: 1 },
    { activity_key: "mae-kong-exit", percent: 100, attempt_no: 1 },
    { activity_key: "yw-sort", percent: 60, attempt_no: 1 },
    { activity_key: "yw-sort", percent: 90, attempt_no: 2 },
  ], 80);
  assert.deepEqual(badges.sort(), ["completed:yw-sort", "passed:yw-sort", "persistent:yw-sort"].sort());
});

test("Exit Tickets are private gamified assessments", () => {
  assert.equal(isExitTicketActivityKey("exit"), true);
  assert.equal(isExitTicketActivityKey("mae-kong-exit"), true);
  assert.equal(isExitTicketActivityKey("train"), false);
  assert.equal(isNonCompetitiveAssessmentKey("posttest"), true);
  assert.equal(isNonCompetitiveAssessmentKey("mae-kom-exit"), true);
  assert.equal(isNonCompetitiveAssessmentKey("picture-word"), false);
});

test("Exit Ticket feedback can correct learning without inflating the measured score", () => {
  const corrected = scoredAnswerForAttempt({
    firstChosen: "ก",
    finalChosen: "ง",
    correctAnswer: "ง",
    tries: 2,
    scoreFirstAttemptOnly: true,
  });
  assert.equal(corrected.correct, false);
  assert.equal(corrected.corrected, true);
  assert.equal(corrected.awardPoint, false);
  assert.equal(corrected.chosen, "ก");
  assert.equal(corrected.correction_chosen, "ง");
});

test("team goal unlocks when eighty percent reach mastery", () => {
  const goal = classTeamGoal([
    { percent: 100 },
    { percent: 90 },
    { percent: 85 },
    { percent: 80 },
    { percent: null },
  ], 80);
  assert.equal(goal.required, 4);
  assert.equal(goal.mastered, 4);
  assert.equal(goal.submitted, 4);
  assert.equal(goal.unlocked, true);
  assert.equal(goal.progress, 100);
});
