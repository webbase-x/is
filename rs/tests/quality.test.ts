import assert from "node:assert/strict";
import test from "node:test";
import {
  customFiveLevelBands,
  equalWidthFiveLevelBands,
  interpretQuality,
  traditionalFiveLevelBands,
} from "../lib/statistics/quality";

test("quality interpretation supports both documented five-level criteria", () => {
  assert.equal(interpretQuality(4.35, traditionalFiveLevelBands), "มาก");
  assert.equal(interpretQuality(4.35, equalWidthFiveLevelBands), "มากที่สุด");
});

test("traditional criteria interpret means at two reported decimals", () => {
  assert.equal(interpretQuality(4.505, traditionalFiveLevelBands), "มากที่สุด");
  assert.equal(interpretQuality(3.505, traditionalFiveLevelBands), "มาก");
});

test("custom criteria require four ordered cut points", () => {
  const bands = customFiveLevelBands([4.3, 3.5, 2.7, 1.9]);
  assert.ok(bands);
  assert.equal(interpretQuality(3.8, bands), "มาก");
  assert.equal(customFiveLevelBands([4, 4, 2, 1.5]), null);
});
