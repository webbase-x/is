import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("IOC workspace shows sum, IOC, and result columns", async () => {
  const source = await readFile(
    new URL("../components/ResearchStatsApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<th>∑R<\/th>\s*<th>IOC<\/th>\s*<th>ผล<\/th>/);
  assert.match(source, /ไฟล์ล่าสุดที่บันทึก/);
  assert.match(source, /const analysisLocked = Boolean\(activeAnalysis\) && !editingSaved/);
  assert.match(source, /บันทึกแล้ว · ล็อกการแก้ไข/);
  assert.match(source, /เปิดสวิตช์เพื่อแก้ไข/);
  assert.doesNotMatch(source, /view === "ioc" && activeAnalysis/);
  assert.ok(
    (source.match(/editable=\{!analysisLocked\}/g) ?? []).length >= 7,
    "every editable analysis tool must receive the shared saved-record lock",
  );
  const comparisonTabs =
    source.match(/<div className="analysis-tabs"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.ok(comparisonTabs, "the paired and criterion comparison tabs must exist");
  assert.doesNotMatch(
    comparisonTabs,
    /disabled=\{!editable\}/,
    "saved analyses must still allow switching between comparison result views",
  );
  assert.match(comparisonTabs, /ก่อนเรียน–หลังเรียน/);
  assert.match(comparisonTabs, /หลังเรียนเทียบเกณฑ์/);
  assert.ok(
    (source.match(/<ResultExportToolbar/g) ?? []).length >= 6,
    "all seven tools, including the shared descriptive/quality view, must expose the common export toolbar",
  );
  assert.ok(
    (source.match(/title=\{analysisTitle\}/g) ?? []).length >= 7,
    "every analysis tool must export with the current analysis title",
  );
  assert.match(source, /aria-label="คัดลอกผล"/);
  for (const sheetName of [
    "IOC",
    "สถิติพรรณนา",
    "ระดับคุณภาพ",
    "ความยาก-อำนาจจำแนก",
    "ความเชื่อมั่น",
    "ก่อน-หลัง",
    "ประสิทธิภาพ E1-E2",
  ]) {
    assert.match(source, new RegExp(sheetName));
  }
  assert.match(source, /ชื่อจากการถอดความ/);
  for (const format of ["CSV", "XLSX", "DOCX", "PDF", "PNG"]) {
    assert.match(source, new RegExp(`aria-label="[^"]*${format}`));
  }
  assert.match(source, /className="app-shell" lang="th"/);
  assert.doesNotMatch(source, /spellCheck=\{false\}/);
  assert.ok(
    (source.match(/noProof: true/g) ?? []).length >= 3,
    "DOCX title, subtitle, and table cells must suppress false proofing marks",
  );
  assert.match(source, /ผู้จัดทำระบบ: ครูไพรัช อินควรชุม/);
  assert.match(source, /โรงเรียนเทศบาล 1 ถนนนครนอก · เทศบาลนครสงขลา/);
});

test("every analysis tool uses configurable spreadsheet import and merge mode", async () => {
  const importer = await readFile(
    new URL("../components/ProjectDataImporter.tsx", import.meta.url),
    "utf8",
  );
  const app = await readFile(
    new URL("../components/ResearchStatsApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(importer, /เลือกชีตและคอลัมน์คะแนน/);
  assert.match(importer, /กำหนดช่วง\{source\.unit\}/);
  assert.match(importer, /แทนที่ทั้งหมด/);
  assert.match(importer, /ต่อรายการเดิม/);
  assert.match(importer, /selectedColumns/);
  assert.match(importer, /selectedSheet/);
  assert.match(importer, /importMode/);
  assert.match(app, /function mergeImportedWorkspace/);
  for (const view of ["ioc", "descriptive", "quality", "item", "reliability", "paired", "efficiency", "individual"]) {
    assert.match(app, new RegExp(`view === "${view}"`));
  }
});

test("individual report combines outcomes with selectable privacy, matching, and charts", async () => {
  const source = await readFile(
    new URL("../components/ResearchStatsApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /รายบุคคลและแผนภูมิพัฒนาการ/);
  assert.match(source, /function IndividualProgressView/);
  assert.match(source, /ข้อมูลรายบุคคลแบบบูรณาการ/);
  for (const key of ["studentId", "studentNumber", "name", "row"]) {
    assert.match(source, new RegExp(`<option value="${key}">`));
  }
  assert.match(source, /จอครูแสดงชื่อจริง/);
  assert.match(source, /ไฟล์บทที่ 4 ใช้ “คนที่ 1–n”/);
  assert.match(source, /แสดงชื่อจริงบนจอครู/);
  assert.match(source, /คนที่ \$\{index \+ 1\}/);
  assert.match(source, /Dumbbell Chart/);
  assert.match(source, /Slope Chart/);
  assert.match(source, /เฉพาะผู้ควรติดตาม/);
  assert.match(source, /คอลัมน์คะแนนความพึงพอใจ/);
  assert.match(source, /ResultExportToolbar title=\{title \|\| "รายงานผลรายบุคคล"\}/);
});
