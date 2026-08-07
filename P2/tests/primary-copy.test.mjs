import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const p2Root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  ...readdirSync(p2Root)
    .filter(name => extname(name) === ".html")
    .map(name => join(p2Root, name)),
  ...readdirSync(join(p2Root, "js"))
    .filter(name => extname(name) === ".js")
    .map(name => join(p2Root, "js", name)),
];
const visibleSource = sourceFiles.map(path => readFileSync(path, "utf8")).join("\n");

test("game copy avoids unclear translated-style actions", () => {
  const unclearPhrases = [
    "ส่งคำนี้ผ่าน",
    "ส่งคำนี้ต่อ",
    "คำอื่นให้ส่งต่อ",
    "ปล่อยผ่าน",
    "สแกนเลือกรูปเขียน",
    "ปลดล็อกตราพลัง",
    "ช่วยเติมพลังเป้าหมาย",
  ];

  unclearPhrases.forEach(phrase => {
    assert.equal(visibleSource.includes(phrase), false, `พบถ้อยคำที่ไม่เหมาะกับเด็กประถมต้น: ${phrase}`);
  });
});

test("classification games use direct yes-or-no Thai labels", () => {
  ["เป็นคำแม่กง", "ไม่ใช่คำแม่กง", "เป็นคำแม่กด", "ไม่ใช่คำแม่กด", "เป็นคำแม่กบ", "ไม่ใช่คำแม่กบ", "เป็นคำแม่กน", "ไม่ใช่คำแม่กน"]
    .forEach(phrase => assert.equal(visibleSource.includes(phrase), true, `ไม่พบคำสั่งที่ชัดเจน: ${phrase}`));
});
