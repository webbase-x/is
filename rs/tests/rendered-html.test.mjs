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

test("item analysis supports the complete try-out workflow", async () => {
  const source = await readFile(
    new URL("../components/ResearchStatsApp.tsx", import.meta.url),
    "utf8",
  );
  const statistics = await readFile(
    new URL("../lib/statistics/item-analysis.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /คะแนนจากการทดลองใช้/);
  assert.match(source, /templateItemCount/);
  assert.match(source, /templateRespondentCount/);
  assert.match(source, /recommendTryoutGroups/);
  assert.match(source, /กลุ่มเก่ง \(High\)/);
  assert.match(source, /กลุ่มกลาง/);
  assert.match(source, /กลุ่มอ่อน \(Low\)/);
  assert.match(source, /แม่แบบ Excel\/CSV \{templateRespondentCount\} คน × \{templateItemCount\} ข้อ/);
  assert.match(source, /อันดับคะแนนรวมและสมาชิกกลุ่มสูง–ต่ำ/);
  assert.match(source, /ข้อความพร้อมใช้ในรายงานการวิจัย/);
  for (const percentage of ["0.25", "0.27", "0.33", "0.5"]) {
    assert.match(source, new RegExp(`<option value=\\{${percentage}\\}>`));
  }
  assert.match(statistics, /Math\.round\(matrix\.length \* groupPercentage\)/);
  assert.match(statistics, /Math\.floor\(matrix\.length \/ 2\)/);
  assert.match(statistics, /difficulty >= 0\.2/);
  assert.match(statistics, /difficulty <= 0\.8/);
  assert.match(statistics, /discrimination >= 0\.2/);
  assert.match(statistics, /ติดลบ · ตรวจสอบข้อสอบ\/เฉลย/);
});

test("normality diagnostics compare both difference-score sets", async () => {
  const source = await readFile(
    new URL("../components/ResearchStatsApp.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /ผลตรวจการแจกแจงของคะแนนผลต่างทั้งสองชุด/);
  assert.match(source, /\["หลังเรียน − ก่อนเรียน", pairedDiagnostics\]/);
  assert.match(source, /\["หลังเรียน − เกณฑ์", criterionDiagnostics\]/);
  assert.match(source, /<DistributionDiagnostics values=\{pairedDifferences\}/);
  assert.match(source, /<DistributionDiagnostics values=\{criterionDifferences\}/);
  assert.match(source, /Normal Q–Q Plot/);
  assert.match(source, /Outlier \(1\.5×IQR\)/);
  assert.match(source, /function CopySvgImageButton/);
  assert.match(source, /async function copySvgAsPng/);
  assert.match(source, /คัดลอกภาพ/);
  assert.match(styles, /\.normality-comparison-grid/);
  assert.match(styles, /\.copy-chart-button/);
});

test("individual report combines outcomes with selectable privacy, matching, and charts", async () => {
  const source = await readFile(
    new URL("../components/ResearchStatsApp.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
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
  assert.match(source, /ป้ายชื่อรายบุคคล/);
  assert.match(source, /คนที่ \$\{index \+ 1\}/);
  assert.match(source, /Dumbbell Chart/);
  assert.match(source, /Slope Chart/);
  assert.match(source, /เฉพาะผู้ควรติดตาม/);
  assert.match(source, /คอลัมน์คะแนนความพึงพอใจ/);
  assert.match(source, /ResultExportToolbar title=\{title \|\| "รายงานผลรายบุคคล"\}/);
  assert.match(source, /ตั้งค่ารายละเอียดกราฟ/);
  for (const labelMode of ["name", "sequence", "studentNumber", "studentId"]) {
    assert.match(source, new RegExp(`<option value="${labelMode}">`));
  }
  for (const titleMode of ["standard", "analysis", "custom"]) {
    assert.match(source, new RegExp(`<option value="${titleMode}">`));
  }
  for (const legendPosition of ["inside", "below", "hidden"]) {
    assert.match(source, new RegExp(`<option value="${legendPosition}">`));
  }
  assert.match(source, /chart-legend chart-legend-horizontal/);
  assert.match(source, /translate\(\$\{width \/ 2\} \$\{height - 31\}\)/);
  assert.match(source, /<rect x=\{showCriterion \? -320 : -170\} y="-23" width=\{showCriterion \? 640 : 340\} height="46"/);
  assert.match(source, /<circle cx=\{showCriterion \? -110 : 50\} cy="0"/);
  assert.match(source, /<line x1="65" x2="100" y1="0" y2="0"/);
  assert.match(source, /แสดงตัวเลขคะแนนข้างจุด/);
  assert.match(source, /ช่วงแกนคะแนน/);
  assert.match(source, /คะแนนผลสัมฤทธิ์ทางการเรียน \(คะแนนเต็ม/);
  assert.match(source, /data-person-number/);
  assert.match(source, /ผลต่าง:/);
  assert.match(source, /ผลเกณฑ์:/);
  assert.match(styles, /\.chart-settings-grid/);
  assert.match(styles, /width: max\(820px, 100%\)/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) max-content/);
  assert.match(styles, /\.individual-saved-source select[\s\S]*text-overflow: ellipsis/);
});
