import test from "node:test";
import assert from "node:assert/strict";

import { SATISFACTION_SCALE, satisfactionLevel } from "../js/satisfaction-survey.js";

test("satisfaction scale matches the approved three-point questionnaire", () => {
  assert.deepEqual(SATISFACTION_SCALE.map(item => [item.value, item.label]), [
    [3, "มาก"],
    [2, "ปานกลาง"],
    [1, "น้อย"],
  ]);
});

test("satisfaction averages receive the expected Thai interpretation", () => {
  assert.equal(satisfactionLevel(2.5).label, "พึงพอใจมาก");
  assert.equal(satisfactionLevel(1.5).label, "พึงพอใจปานกลาง");
  assert.equal(satisfactionLevel(1.49).label, "พึงพอใจน้อย");
  assert.equal(satisfactionLevel(null).label, "ยังไม่มีข้อมูล");
  assert.equal(satisfactionLevel(undefined).label, "ยังไม่มีข้อมูล");
});
