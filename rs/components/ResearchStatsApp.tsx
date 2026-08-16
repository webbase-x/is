"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProjectDataImporter, {
  type ImportedProjectData,
} from "./ProjectDataImporter";
import { getSupabaseClient } from "../lib/supabase/client";
import type { ResearchProject } from "../lib/supabase/types";
import {
  analyzeItem,
  assessNormality,
  calculateE1E2,
  calculateIoc,
  cronbachAlpha,
  customFiveLevelBands,
  equalWidthFiveLevelBands,
  interpretQuality,
  kr20,
  mean,
  median,
  oneSampleSignTest,
  oneSampleTTest,
  oneSampleWilcoxonTest,
  pairedSignTest,
  pairedTTest,
  pairedWilcoxonTest,
  parseMatrix,
  parseNumbers,
  sampleStandardDeviation,
  standardNormalQuantile,
  threeLevelSatisfactionBands,
  traditionalFiveLevelBands,
  type AlternativeHypothesis,
  type ComparisonTest,
  type NormalityAssessment,
  type OneSampleTResult,
  type PairedResult,
  type SignTestResult,
  type WilcoxonResult,
} from "../lib/statistics";

type View =
  | "home"
  | "ioc"
  | "descriptive"
  | "quality"
  | "item"
  | "reliability"
  | "paired"
  | "efficiency"
  | "references";
type WorkspaceData = Record<string, unknown>;
type AnalysisRecord = {
  id: string;
  analysis_type: View;
  title: string;
  input_json: { workspace?: WorkspaceData; source?: ImportedProjectData };
  result_json: WorkspaceData;
  created_at: string;
};

const NAV: Array<{ id: View; label: string; icon: string; group?: string }> = [
  { id: "home", label: "ภาพรวม", icon: "⌂" },
  {
    id: "ioc",
    label: "ความตรงเชิงเนื้อหา (IOC)",
    icon: "✓",
    group: "ตรวจสอบเครื่องมือ",
  },
  {
    id: "descriptive",
    label: "ค่าเฉลี่ยและ S.D.",
    icon: "x̄",
    group: "สถิติพรรณนา",
  },
  { id: "quality", label: "ระดับความพึงพอใจ 3/5 ระดับ", icon: "★" },
  {
    id: "item",
    label: "ความยาก–อำนาจจำแนก",
    icon: "P",
    group: "คุณภาพแบบทดสอบ",
  },
  { id: "reliability", label: "ความเชื่อมั่น", icon: "α" },
  {
    id: "paired",
    label: "ก่อนเรียน–หลังเรียน",
    icon: "t",
    group: "ทดสอบสมมติฐาน",
  },
  { id: "efficiency", label: "ประสิทธิภาพ E1/E2", icon: "%" },
  {
    id: "references",
    label: "สูตรและเอกสารอ้างอิง",
    icon: "§",
    group: "เอกสาร",
  },
];

const fmt = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);

const fmtP = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value < 0.001
      ? "< .001"
      : value.toFixed(3).replace(/^0/, "");

function Metric({
  label,
  value,
  note,
  tone = "blue",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function Formula({
  children,
  source,
}: {
  children: React.ReactNode;
  source: string;
}) {
  return (
    <div className="formula">
      <div>{children}</div>
      <small>แนวทางอ้างอิง: {source}</small>
    </div>
  );
}

const THAI_DIGITS: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

function normalizeDigits(value: string) {
  return value.replace(/[๐-๙]/g, (digit) => THAI_DIGITS[digit]);
}

function inferIocItemCount(rows: unknown[][]) {
  const text = normalizeDigits(
    rows
      .flat()
      .map((cell) => String(cell ?? ""))
      .join(" "),
  );
  const explicitCounts = [
    ...text.matchAll(/(?:จำนวน|รวม|แบบทดสอบ)?\s*(\d{1,3})\s*ข้อ/g),
  ]
    .map((match) => Number(match[1]))
    .filter((count) => count >= 3 && count <= 200);
  if (explicitCounts.length) return Math.max(...explicitCounts);

  const leadingNumbers = rows.flatMap((row) => {
    const first = normalizeDigits(
      String(row.find((cell) => String(cell ?? "").trim()) ?? "").trim(),
    );
    const match = first.match(/^(\d{1,3})(?:[.)]|\s|$)/);
    return match ? [Number(match[1])] : [];
  });
  let best = 0;
  leadingNumbers.forEach((number, start) => {
    if (number !== 1) return;
    let expected = 1;
    for (let index = start; index < leadingNumbers.length; index += 1) {
      if (leadingNumbers[index] === expected) expected += 1;
    }
    best = Math.max(best, expected - 1);
  });
  return best >= 3 ? Math.min(best, 200) : 5;
}

function IocView({
  imported,
  initial,
  onChange,
  title,
  editable,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  title: string;
  editable: boolean;
}) {
  const needsOcrVerification = Boolean(
    imported?.warning?.includes("OCR") ||
    imported?.ocrItems?.length ||
    imported?.iocRatings?.length,
  );
  const detectedRatings = imported?.iocRatings ?? [];
  const detectedItems = imported?.ocrItems ?? [];
  const importedRows = needsOcrVerification
    ? []
    : (imported?.rows
        .map((row) =>
          row
            .map((cell) => Number(cell))
            .filter((value) => [-1, 0, 1].includes(value)),
        )
        .filter((row) => row.length) ?? []);
  const requestedExpert = imported?.targetExpert ?? 1;
  const initialExperts = Array.isArray(initial?.experts)
    ? initial.experts.map(String)
    : null;
  const initialRows = Array.isArray(initial?.rows)
    ? (initial.rows as Array<Array<number | null>>)
    : null;
  const importedWidth = Math.max(
    3,
    requestedExpert,
    initialExperts?.length ?? 0,
    importedRows.length
      ? Math.max(...importedRows.map((row) => row.length))
      : 0,
  );
  const importedItemCount =
    imported && needsOcrVerification
      ? Math.max(
          imported.expectedItemCount ?? 0,
          ...detectedItems.map((entry) => entry.item),
          ...detectedRatings.map((entry) => entry.item),
          initialRows?.length ?? 0,
          5,
        )
      : (initialRows?.length ?? 5);
  const [experts, setExperts] = useState(
    initialExperts ??
      Array.from(
        { length: importedWidth },
        (_, index) => `ผู้เชี่ยวชาญ ${index + 1}`,
      ),
  );
  const [rows, setRows] = useState<Array<Array<number | null>>>(() => {
    if (initialRows?.length) {
      const merged = Array.from({ length: importedItemCount }, (_, rowIndex) =>
        Array.from(
          { length: importedWidth },
          (_, index) => initialRows[rowIndex]?.[index] ?? null,
        ),
      );
      detectedRatings.forEach(({ item, rating }) => {
        if (merged[item - 1]) merged[item - 1][requestedExpert - 1] = rating;
      });
      return merged;
    }
    if (importedRows.length)
      return importedRows.map((row) =>
        Array.from({ length: importedWidth }, (_, index) => row[index] ?? null),
      );
    const initial = Array.from({ length: importedItemCount }, () =>
      Array<number | null>(importedWidth).fill(null),
    );
    detectedRatings.forEach(({ item, rating }) => {
      if (initial[item - 1]) initial[item - 1][requestedExpert - 1] = rating;
    });
    return initial;
  });
  const results = calculateIoc(rows);
  const average = mean(results.flatMap((r) => (r.ioc === null ? [] : [r.ioc])));
  const setRating = (row: number, col: number, value: number | null) =>
    setRows((current) =>
      current.map((r, ri) =>
        ri === row ? r.map((v, ci) => (ci === col ? value : v)) : r,
      ),
    );
  const addExpert = () => {
    setExperts((x) => [...x, `ผู้เชี่ยวชาญ ${x.length + 1}`]);
    setRows((x) => x.map((r) => [...r, null]));
  };
  const addItem = () =>
    setRows((x) => [...x, Array(experts.length).fill(null)]);
  const resizeItems = (count: number) =>
    setRows((current) =>
      Array.from(
        { length: Math.max(1, Math.min(300, count)) },
        (_, index) => current[index] ?? Array(experts.length).fill(null),
      ),
    );
  useEffect(() => {
    onChange(
      { experts, rows },
      {
        average,
        passed: results.filter((result) => result.passed).length,
        itemCount: rows.length,
        results,
      },
    );
  }, [experts, rows]);
  const exportRows = () => [
    ["ข้อ", ...experts, "∑R", "IOC", "ผล"],
    ...rows.map((row, index) => [
      index + 1,
      ...row.map((value) => value ?? ""),
      results[index].sum,
      results[index].ioc?.toFixed(2) ?? "",
      results[index].ioc === null
        ? "รอคะแนน"
        : results[index].passed
          ? "ใช้ได้"
          : "ปรับปรุง",
    ]),
  ];
  const exportCsv = () => {
    const lines = exportRows()
      .map((line) =>
        line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    downloadFile(
      new Blob(["\ufeff", lines], { type: "text/csv;charset=utf-8" }),
      `${safeFilename(title)}.csv`,
    );
  };
  const exportXlsx = async () => {
    const xlsx = await import("xlsx");
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet(exportRows());
    xlsx.utils.book_append_sheet(workbook, sheet, "IOC");
    xlsx.writeFile(workbook, `${safeFilename(title)}.xlsx`);
  };
  const exportDocx = async () => {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } =
      await import(/* @vite-ignore */ DOCX_JS_URL);
    const table = new Table({
      rows: exportRows().map(
        (row, rowIndex) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: String(cell),
                          bold: rowIndex === 0,
                          noProof: true,
                          font: "TH Sarabun New",
                        }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
      ),
    });
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ตารางสรุปผลการตรวจสอบความตรงเชิงเนื้อหา (IOC)",
                  bold: true,
                  noProof: true,
                  font: "TH Sarabun New",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  noProof: true,
                  font: "TH Sarabun New",
                }),
              ],
            }),
            table,
          ],
        },
      ],
    });
    downloadFile(await Packer.toBlob(document), `${safeFilename(title)}.docx`);
  };
  const exportPdf = async () => {
    const canvas = createIocCanvas(title, experts, rows, results);
    if (!canvas) return;
    const { jsPDF } = await import(/* @vite-ignore */ JSPDF_JS_URL);
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
      hotfixes: ["px_scaling"],
    });
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      canvas.width,
      canvas.height,
    );
    pdf.save(`${safeFilename(title)}.pdf`);
  };
  const exportPng = () => exportIocPng(title, experts, rows, results);
  return (
    <Page
      title="ความตรงเชิงเนื้อหา (IOC)"
      subtitle="ประเมินความสอดคล้องรายข้อจากผู้เชี่ยวชาญจำนวนเท่าใดก็ได้"
      badge="แนะนำ ≥ 3 คน"
    >
      {needsOcrVerification && (
        <div className="import-warning ioc-verification">
          <b>
            {detectedRatings.length
              ? `อ่านตำแหน่งเครื่องหมายได้ ${detectedRatings.length} ข้อ`
              : "ยังไม่พบเครื่องหมายในช่องคะแนน"}
          </b>
          <span>
            {detectedRatings.length
              ? "ระบบจับคู่รอยปากกากับช่อง +1, 0 หรือ -1 และเลขข้อจากตารางแล้ว กรุณาเทียบกับภาพต้นฉบับและแก้ไขช่องที่คลาดเคลื่อนก่อนใช้ผล"
              : "OCR อ่านข้อความได้ แต่ยังยืนยันตำแหน่งรอยปากกาในตารางไม่ได้ ระบบจึงสร้างตารางว่างไว้ให้กรอกตามเอกสาร เพื่อป้องกันค่า IOC ผิดพลาด"}
          </span>
        </div>
      )}
      <div className="metrics">
        <Metric label="จำนวนข้อ" value={`${rows.length}`} />
        <Metric
          label="ผู้เชี่ยวชาญ"
          value={`${experts.length}`}
          tone="violet"
        />
        <Metric label="IOC เฉลี่ย" value={fmt(average, 2)} tone="green" />
        <Metric
          label="ผ่านเกณฑ์"
          value={`${results.filter((r) => r.passed).length}/${rows.length}`}
          tone="amber"
        />
      </div>
      <section className="panel">
        <div className="panel-head ioc-panel-head">
          <div className="ioc-panel-title">
            <h3>ตารางให้คะแนน</h3>
            <p>+1 สอดคล้อง · 0 ไม่แน่ใจ · -1 ไม่สอดคล้อง</p>
          </div>
          <div className="ioc-toolbar">
            <div className="actions ioc-actions" aria-label="ตั้งค่าตาราง IOC">
              <label className="ioc-item-count">
                จำนวนข้อ
                <input
                  disabled={!editable}
                  type="number"
                  min={1}
                  max={300}
                  value={rows.length}
                  onChange={(event) =>
                    resizeItems(Number(event.target.value) || 1)
                  }
                />
              </label>
              <button
                className="secondary"
                disabled={!editable}
                onClick={addExpert}
              >
                + ผู้เชี่ยวชาญ
              </button>
              <button disabled={!editable} onClick={addItem}>
                + เพิ่มข้อ
              </button>
            </div>
            <div className="ioc-export-group">
              <span className="ioc-group-label">ส่งออกผล</span>
              <div className="export-icons" aria-label="ส่งออกผล IOC">
                <button
                  className="export-icon csv"
                  onClick={exportCsv}
                  title="ส่งออก CSV"
                  aria-label="ส่งออก CSV"
                >
                  <ExportIcon format="C" />
                  <span>CSV</span>
                </button>
                <button
                  className="export-icon xlsx"
                  onClick={() => void exportXlsx()}
                  title="ส่งออก XLSX"
                  aria-label="ส่งออก XLSX"
                >
                  <ExportIcon format="X" />
                  <span>XLSX</span>
                </button>
                <button
                  className="export-icon docx"
                  onClick={() => void exportDocx()}
                  title="ส่งออก DOCX"
                  aria-label="ส่งออก DOCX"
                >
                  <ExportIcon format="W" />
                  <span>DOCX</span>
                </button>
                <button
                  className="export-icon pdf"
                  onClick={() => void exportPdf()}
                  title="ส่งออก PDF"
                  aria-label="ส่งออก PDF"
                >
                  <ExportIcon format="PDF" />
                  <span>PDF</span>
                </button>
                <button
                  className="export-icon image"
                  onClick={exportPng}
                  title="บันทึกเป็นรูป PNG"
                  aria-label="บันทึกเป็นรูป PNG"
                >
                  <ExportIcon format="▧" />
                  <span>PNG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ข้อ</th>
                {experts.map((e, i) => (
                  <th key={i}>
                    <input
                      disabled={!editable}
                      className="head-input"
                      value={e}
                      onChange={(ev) =>
                        setExperts(
                          experts.map((x, j) =>
                            j === i ? ev.target.value : x,
                          ),
                        )
                      }
                    />
                  </th>
                ))}
                <th>∑R</th>
                <th>IOC</th>
                <th>ผล</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td>{ri + 1}</td>
                  {row.map((value, ci) => (
                    <td key={ci}>
                      <select
                        disabled={!editable}
                        aria-label={`ข้อ ${ri + 1} ${experts[ci]}`}
                        value={value ?? ""}
                        onChange={(e) =>
                          setRating(
                            ri,
                            ci,
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      >
                        <option value="">—</option>
                        <option value="1">+1</option>
                        <option value="0">0</option>
                        <option value="-1">-1</option>
                      </select>
                    </td>
                  ))}
                  <td>
                    <b>{results[ri].sum}</b>
                  </td>
                  <td>
                    <b>{fmt(results[ri].ioc, 2)}</b>
                  </td>
                  <td>
                    <span
                      className={
                        results[ri].ioc === null
                          ? "pill revise"
                          : results[ri].passed
                            ? "pill pass"
                            : "pill revise"
                      }
                    >
                      {results[ri].ioc === null
                        ? "รอคะแนน"
                        : results[ri].passed
                          ? "ใช้ได้"
                          : "ปรับปรุง"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Formula source="Rovinelli & Hambleton; แนวทางการสร้างเครื่องมือวิจัยทางการศึกษา">
        IOC = ΣR / N โดยคำนวณจากคะแนนที่มีข้อมูลจริงในแต่ละข้อ และแสดง N
        รายข้อเพื่อการตรวจสอบ
      </Formula>
    </Page>
  );
}

function DescriptiveView({
  quality = false,
  imported,
  initial,
  onChange,
  editable,
}: {
  quality?: boolean;
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  editable: boolean;
}) {
  const [text, setText] = useState(
    typeof initial?.text === "string"
      ? initial.text
      : imported
        ? flattenRows(imported.rows)
        : "5, 5, 4, 4, 5, 4, 5, 3, 4, 5",
  );
  const values = parseNumbers(text);
  const avg = mean(values);
  const sd = sampleStandardDeviation(values);
  const medianValue = median(values);
  const [bandScheme, setBandScheme] = useState<"traditional" | "equal-width" | "custom">(
    initial?.bandScheme === "equal-width" || initial?.bandScheme === "custom"
      ? initial.bandScheme
      : "traditional",
  );
  const [scaleLevels, setScaleLevels] = useState<3 | 5>(
    Number(initial?.scaleLevels) === 3 ? 3 : 5,
  );
  const [customCuts, setCustomCuts] = useState<number[]>(
    Array.isArray(initial?.customCuts) && initial.customCuts.length === 4
      ? initial.customCuts.map(Number)
      : [4.21, 3.41, 2.61, 1.81],
  );
  const [criterionSource, setCriterionSource] = useState(
    typeof initial?.criterionSource === "string" ? initial.criterionSource : "",
  );
  const [copiedQualityReport, setCopiedQualityReport] = useState<"short" | "detailed" | null>(null);
  const customBands = customFiveLevelBands(customCuts);
  const selectedBands = scaleLevels === 3
    ? threeLevelSatisfactionBands
    : bandScheme === "traditional"
      ? traditionalFiveLevelBands
      : bandScheme === "equal-width"
        ? equalWidthFiveLevelBands
        : customBands ?? equalWidthFiveLevelBands;
  const interpretation = interpretQuality(avg, selectedBands);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q1 === null || q3 === null ? null : q3 - q1;
  const schemeDescription = scaleLevels === 3
    ? "เกณฑ์ 3 ระดับ (2.34–3.00 = มาก)"
    : bandScheme === "traditional"
      ? "เกณฑ์ 4.51–5.00"
      : bandScheme === "equal-width"
        ? "เกณฑ์ช่วงกว้างเท่ากัน 0.80"
        : "เกณฑ์ที่ผู้ใช้กำหนด";
  const qualityReports = {
    short: `นักเรียนมีความพึงพอใจโดยรวมอยู่ในระดับ${interpretation} (x̄ = ${fmt(avg)}, S.D. = ${fmt(sd)}, n = ${values.length})`,
    detailed: `ผลการวิเคราะห์ความพึงพอใจของนักเรียนจำนวน ${values.length} คนด้วยสถิติเชิงพรรณนา พบว่า มีค่าเฉลี่ยเท่ากับ ${fmt(avg)} ส่วนเบี่ยงเบนมาตรฐานเท่ากับ ${fmt(sd)} มัธยฐานเท่ากับ ${fmt(medianValue)} และ IQR เท่ากับ ${fmt(iqr)} เมื่อแปลผลด้วย${schemeDescription} นักเรียนมีความพึงพอใจโดยรวมอยู่ในระดับ${interpretation}${criterionSource.trim() ? ` โดยอ้างอิงเกณฑ์จาก ${criterionSource.trim()}` : ""}`,
  };
  useEffect(() => {
    onChange(
      { text, scaleLevels, bandScheme, customCuts, criterionSource },
      {
        n: values.length,
        mean: avg,
        sd,
        median: medianValue,
        q1,
        q3,
        iqr,
        interpretation: quality ? interpretation : undefined,
        scaleLevels: quality ? scaleLevels : undefined,
        bandScheme: quality ? bandScheme : undefined,
      },
    );
  }, [text, scaleLevels, bandScheme, customCuts, criterionSource, quality, avg, sd, medianValue, q1, q3, iqr, interpretation, onChange, values.length]);

  const copyQualityReport = async (kind: "short" | "detailed") => {
    try {
      await navigator.clipboard.writeText(qualityReports[kind]);
      setCopiedQualityReport(kind);
      window.setTimeout(() => setCopiedQualityReport(null), 1800);
    } catch {
      setCopiedQualityReport(null);
    }
  };
  return (
    <Page
      title={quality ? "การแปลผลระดับคุณภาพ" : "สถิติพรรณนา"}
      subtitle={
        quality
          ? "คำนวณค่าเฉลี่ยและแปลผลมาตราส่วนประมาณค่า 3 หรือ 5 ระดับ"
          : "ค่าเฉลี่ย มัธยฐาน และส่วนเบี่ยงเบนมาตรฐานของกลุ่มตัวอย่าง"
      }
      badge="ตรวจสอบข้อมูลดิบได้"
    >
      {quality && (
        <section className="panel quality-settings">
          <div className="panel-head">
            <div>
              <span className="eyebrow">กำหนดไว้ก่อนแปลผล</span>
              <h3>เกณฑ์แปลผลความพึงพอใจ</h3>
              <p>เลือกเกณฑ์ให้ตรงกับตำราที่อ้างอิง และใช้ชุดเดียวกันตลอดบทที่ 3–5</p>
            </div>
          </div>
          <div className="quality-setting-grid">
            <label>
              จำนวนระดับของแบบประเมิน
              <select
                disabled={!editable}
                value={scaleLevels}
                onChange={(event) => setScaleLevels(Number(event.target.value) as 3 | 5)}
              >
                <option value={3}>3 ระดับ: มาก / ปานกลาง / น้อย</option>
                <option value={5}>5 ระดับ</option>
              </select>
            </label>
            {scaleLevels === 5 && (
            <label>
              รูปแบบเกณฑ์
              <select disabled={!editable} value={bandScheme} onChange={(event) => setBandScheme(event.target.value as typeof bandScheme)}>
                <option value="traditional">4.51–5.00 / 3.51–4.50</option>
                <option value="equal-width">ช่วงกว้างเท่ากัน 0.80</option>
                <option value="custom">กำหนดจุดตัดเอง</option>
              </select>
            </label>
            )}
            <label>
              แหล่งอ้างอิงเกณฑ์
              <input disabled={!editable} value={criterionSource} placeholder="ระบุตำรา ฉบับพิมพ์ และเลขหน้า" onChange={(event) => setCriterionSource(event.target.value)} />
            </label>
          </div>
          {scaleLevels === 3 && (
            <div className="notice analysis-recommendation">
              เกณฑ์ที่ใช้: 2.34–3.00 = มาก · 1.67–2.33 = ปานกลาง · 1.00–1.66 = น้อย
            </div>
          )}
          {scaleLevels === 5 && bandScheme === "custom" && (
            <div className="custom-cut-grid">
              {[
                ["มากที่สุด เริ่มที่", 0],
                ["มาก เริ่มที่", 1],
                ["ปานกลาง เริ่มที่", 2],
                ["น้อย เริ่มที่", 3],
              ].map(([label, index]) => (
                <label key={String(label)}>
                  {label}
                  <input
                    disabled={!editable}
                    type="number"
                    min="1.01"
                    max="5"
                    step="0.01"
                    value={customCuts[Number(index)]}
                    onChange={(event) => setCustomCuts((current) => current.map((cut, cutIndex) => cutIndex === Number(index) ? Number(event.target.value) : cut))}
                  />
                </label>
              ))}
            </div>
          )}
          {scaleLevels === 5 && bandScheme === "custom" && !customBands && (
            <div className="notice analysis-warning">
              จุดตัดต้องเรียงจากมากไปน้อย อยู่ระหว่าง 1–5 และไม่ซ้ำกัน ระบบจะแสดงเกณฑ์ช่วงกว้าง 0.80 ชั่วคราวจนกว่าจะแก้ครบ
            </div>
          )}
        </section>
      )}
      <section className="split">
        <div className="panel">
          <h3>วางคะแนน</h3>
          <p>คั่นด้วยช่องว่าง เครื่องหมายจุลภาค หรือขึ้นบรรทัดใหม่</p>
          <textarea
            disabled={!editable}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
          />
          <div className="data-note">อ่านได้ {values.length} ค่า</div>
        </div>
        <div>
          <div className="metrics compact">
            <Metric label="จำนวน (n)" value={`${values.length}`} />
            <Metric label="ค่าเฉลี่ย (x̄)" value={fmt(avg)} tone="green" />
            <Metric label="S.D. (ตัวอย่าง)" value={fmt(sd)} tone="violet" />
            <Metric
              label={quality ? "ระดับคุณภาพ" : "มัธยฐาน"}
              value={quality ? interpretation : fmt(medianValue)}
              tone="amber"
            />
            {quality && <Metric label="มัธยฐาน" value={fmt(medianValue)} />}
            {quality && <Metric label="IQR" value={fmt(iqr)} />}
          </div>
          {quality && (
            <section className="panel bands">
              <h3>เกณฑ์แปลผลที่ใช้</h3>
              {selectedBands.map((b) => (
                <div key={b.label}>
                  <span>
                    {b.min.toFixed(2)}–{b.max.toFixed(2)}
                  </span>
                  <b>{b.label}</b>
                </div>
              ))}
            </section>
          )}
        </div>
      </section>
      <Formula source="บุญชม ศรีสะอาด และตำราสถิติทางการศึกษา; โปรดระบุฉบับที่ใช้อ้างอิงในงานวิจัย">
        x̄ = Σx / n และ S.D. ตัวอย่าง = √[Σ(x-x̄)²/(n-1)]
      </Formula>
      {quality && (
        <>
          <div className="notice analysis-recommendation">
            <b>วัตถุประสงค์ข้อที่ 3 ใช้สถิติเชิงพรรณนา</b>
            <p>หากต้องการเพียงศึกษาระดับความพึงพอใจ ให้รายงานค่าเฉลี่ย S.D. และระดับ ไม่ต้องเติมคำว่า “อย่างมีนัยสำคัญทางสถิติ”</p>
          </div>
          <section className="panel automatic-report" aria-labelledby="quality-report-title">
            <div className="panel-head">
              <div>
                <span className="eyebrow">พร้อมใช้ในบทที่ 4</span>
                <h3 id="quality-report-title">รายงานความพึงพอใจอัตโนมัติ</h3>
              </div>
            </div>
            <div className="report-grid">
              {(["short", "detailed"] as const).map((kind) => (
                <article key={kind}>
                  <div className="report-head">
                    <b>{kind === "short" ? "แบบย่อ" : "แบบละเอียด"}</b>
                    <button type="button" onClick={() => copyQualityReport(kind)}>{copiedQualityReport === kind ? "คัดลอกแล้ว" : "คัดลอก"}</button>
                  </div>
                  <p>{qualityReports[kind]}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

function ItemView({
  imported,
  initial,
  onChange,
  editable,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  editable: boolean;
}) {
  const importedValues = imported
    ? parseNumbers(flattenRows(imported.rows))
    : [];
  const [upper, setUpper] = useState(
      Number(initial?.upper ?? importedValues[0] ?? 22),
    ),
    [lower, setLower] = useState(
      Number(initial?.lower ?? importedValues[1] ?? 12),
    ),
    [size, setSize] = useState(
      Number(initial?.size ?? importedValues[2] ?? 25),
    );
  const result = analyzeItem(upper, lower, size);
  useEffect(() => {
    onChange({ upper, lower, size }, result as unknown as WorkspaceData);
  }, [upper, lower, size]);
  return (
    <Page
      title="ความยากและอำนาจจำแนก"
      subtitle="วิเคราะห์ข้อสอบด้วยเทคนิคกลุ่มสูง–กลุ่มต่ำ"
      badge="Classical Test Theory"
    >
      <section className="split">
        <div className="panel form-grid">
          <label>
            กลุ่มสูงตอบถูก
            <input
              disabled={!editable}
              type="number"
              value={upper}
              onChange={(e) => setUpper(+e.target.value)}
            />
          </label>
          <label>
            กลุ่มต่ำตอบถูก
            <input
              disabled={!editable}
              type="number"
              value={lower}
              onChange={(e) => setLower(+e.target.value)}
            />
          </label>
          <label>
            จำนวนคนต่อกลุ่ม
            <input
              disabled={!editable}
              type="number"
              value={size}
              onChange={(e) => setSize(+e.target.value)}
            />
          </label>
        </div>
        <div className="metrics compact">
          <Metric
            label="ค่าความยาก (p)"
            value={fmt(result.difficulty)}
            note={result.difficultyLabel}
          />
          <Metric
            label="อำนาจจำแนก (r)"
            value={fmt(result.discrimination)}
            note={result.discriminationLabel}
            tone="green"
          />
        </div>
      </section>
      <Formula source="แนวคิดการวิเคราะห์ข้อสอบแบบอิงกลุ่ม; พิชิต ฤทธิ์จรูญ และตำราการวัดผลการศึกษา">
        p = (RU+RL)/(2n) และ r = (RU-RL)/n
      </Formula>
    </Page>
  );
}

function ReliabilityView({
  imported,
  initial,
  onChange,
  editable,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  editable: boolean;
}) {
  const [text, setText] = useState(
    typeof initial?.text === "string"
      ? initial.text
      : imported
        ? imported.rows.map((row) => row.join(",")).join("\n")
        : "1,1,1,0,1\n1,0,1,1,1\n1,1,1,1,1\n0,0,1,0,1\n1,1,0,1,1\n0,1,0,0,1",
  );
  const matrix = parseMatrix(text);
  const alpha = cronbachAlpha(matrix);
  const binary =
    matrix.length > 0 &&
    matrix.every((r) => r.every((v) => v === 0 || v === 1));
  const kr = binary ? kr20(matrix) : null;
  useEffect(() => {
    onChange(
      { text },
      {
        respondents: matrix.length,
        items: matrix[0]?.length ?? 0,
        alpha,
        kr20: kr,
        binary,
      },
    );
  }, [text]);
  return (
    <Page
      title="ความเชื่อมั่นของเครื่องมือ"
      subtitle="รองรับ Cronbach’s alpha และ KR-20"
      badge="วางข้อมูลรายคน × รายข้อ"
    >
      <section className="split">
        <div className="panel">
          <h3>เมทริกซ์คะแนน</h3>
          <p>1 บรรทัด = ผู้ตอบ 1 คน · แต่ละคอลัมน์ = ข้อคำถาม</p>
          <textarea
            disabled={!editable}
            rows={11}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="data-note">
            {matrix.length} คน × {matrix[0]?.length ?? 0} ข้อ
          </div>
        </div>
        <div className="metrics compact">
          <Metric
            label="Cronbach’s α"
            value={fmt(alpha)}
            note="แบบมาตรประมาณค่า/หลายระดับ"
            tone="violet"
          />
          <Metric
            label="KR-20"
            value={binary ? fmt(kr) : "ต้องเป็น 0/1"}
            note="แบบทดสอบให้คะแนนถูก–ผิด"
            tone="green"
          />
        </div>
      </section>
      <Formula source="Kuder & Richardson (1937); Cronbach (1951); ตำราการวัดผลทางการศึกษา">
        ระบบใช้ความแปรปรวนรายข้อและความแปรปรวนของคะแนนรวม
        พร้อมตรวจรูปแบบข้อมูลก่อนคำนวณ
      </Formula>
    </Page>
  );
}

type ComparisonMode = "paired" | "criterion";
type TestResult = PairedResult | OneSampleTResult | WilcoxonResult | SignTestResult;

function isAlternative(value: unknown): value is AlternativeHypothesis {
  return ["greater", "less", "two-sided"].includes(String(value));
}

function isTestMethod(value: unknown): value is ComparisonTest {
  return value === "t-test" || value === "wilcoxon" || value === "sign-test";
}

const METHOD_HELP: Record<ComparisonMode, Array<{
  value: ComparisonTest;
  label: string;
  description: string;
}>> = {
  paired: [
    {
      value: "t-test",
      label: "Paired-samples t-test",
      description: "ใช้เปรียบเทียบค่าเฉลี่ยคะแนนก่อน–หลังของคนกลุ่มเดิม เมื่อผลต่างใกล้เคียงปกติและไม่มีค่าผิดปกติรุนแรง",
    },
    {
      value: "wilcoxon",
      label: "Wilcoxon signed-rank test",
      description: "ใช้เปรียบเทียบอันดับของผลต่างคะแนนคู่ เมื่อข้อมูลไม่ปกติแต่ผลต่างยังค่อนข้างสมมาตร",
    },
    {
      value: "sign-test",
      label: "Paired Sign Test",
      description: "ใช้เปรียบเทียบจำนวนผลต่างบวกและลบ เหมาะเมื่อผลต่างเบ้หรือไม่สมมาตร โดยไม่ใช้ขนาดของผลต่าง",
    },
  ],
  criterion: [
    {
      value: "t-test",
      label: "One-sample t-test",
      description: "ใช้ทดสอบว่าค่าเฉลี่ยคะแนนหลังเรียนต่างจากเกณฑ์หรือไม่ เมื่อผลต่างจากเกณฑ์ใกล้เคียงปกติ",
    },
    {
      value: "wilcoxon",
      label: "One-sample Wilcoxon signed-rank test",
      description: "ใช้ทดสอบอันดับของผลต่างระหว่างคะแนนกับเกณฑ์ เมื่อข้อมูลไม่ปกติแต่ผลต่างยังค่อนข้างสมมาตร",
    },
    {
      value: "sign-test",
      label: "One-sample Sign Test",
      description: "ใช้ทดสอบจำนวนคะแนนที่สูงหรือต่ำกว่าเกณฑ์ เหมาะเมื่อข้อมูลเบ้หรือไม่สมมาตร โดยไม่ใช้ระยะห่างจากเกณฑ์",
    },
  ],
};

function TestMethodSelect({
  mode,
  value,
  onChange,
  editable,
}: {
  mode: ComparisonMode;
  value: ComparisonTest;
  onChange: (value: ComparisonTest) => void;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const methods = METHOD_HELP[mode];
  const selected = methods.find((method) => method.value === value) ?? methods[0];

  return (
    <div
      className="method-select-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id="test-method-label">วิธีทดสอบ</span>
      <button
        disabled={!editable}
        type="button"
        className="method-select-trigger"
        role="combobox"
        aria-labelledby="test-method-label"
        aria-controls="test-method-options"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <i aria-hidden="true">⌄</i>
      </button>
      {open && (
        <div id="test-method-options" className="method-options" role="listbox" aria-label="วิธีทดสอบ">
          {methods.map((method) => (
            <button
              disabled={!editable}
              key={method.value}
              type="button"
              role="option"
              aria-selected={method.value === value}
              aria-describedby={`method-help-${mode}-${method.value}`}
              className={`method-option${method.value === value ? " selected" : ""}`}
              title={method.description}
              onClick={() => {
                onChange(method.value);
                setOpen(false);
              }}
            >
              <span className="method-option-title">
                <b>{method.label}</b>
                <i aria-hidden="true">ⓘ</i>
              </span>
              <span id={`method-help-${mode}-${method.value}`} className="method-option-help">
                {method.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HypothesisSelect({
  value,
  onChange,
  mode,
  editable,
}: {
  value: AlternativeHypothesis | "";
  onChange: (value: AlternativeHypothesis | "") => void;
  mode: ComparisonMode;
  editable: boolean;
}) {
  const target = mode === "paired" ? "ก่อนเรียน" : "เกณฑ์";
  return (
    <label>
      สมมติฐานทางสถิติ
      <select
        disabled={!editable}
        value={value}
        className={!value ? "selection-required" : ""}
        onChange={(event) => onChange(event.target.value as AlternativeHypothesis | "")}
      >
        <option value="">— โปรดเลือกก่อนคำนวณ —</option>
        <option value="greater">ทางเดียว: หลังเรียนสูงกว่า{target}</option>
        <option value="less">ทางเดียว: หลังเรียนต่ำกว่า{target}</option>
        <option value="two-sided">สองทาง: คะแนนแตกต่างกัน</option>
      </select>
    </label>
  );
}

function normalityRecommendation(normality?: NormalityAssessment) {
  if (!normality) return "กรอกข้อมูลให้ครบเพื่อรับคำแนะนำ";
  const method = normality.recommendedTest === "t-test"
    ? "t-test"
    : normality.recommendedTest === "wilcoxon"
      ? "Wilcoxon signed-rank test"
      : "Sign Test";
  const testResult =
    normality.pValue === null
      ? normality.note
      : `${normality.note} (Shapiro–Wilk W = ${fmt(normality.statistic)}, ${reportP(normality.pValue)})`;
  return `ระบบแนะนำ ${method}: ${testResult}`;
}

function quantile(values: number[], probability: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper
    ? sorted[lower]
    : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

const chartScale = (value: number, minimum: number, maximum: number, start: number, end: number) =>
  maximum - minimum <= 1e-12
    ? (start + end) / 2
    : start + ((value - minimum) / (maximum - minimum)) * (end - start);

function DistributionDiagnostics({ values, label }: { values: number[]; label: string }) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length < 3) {
    return (
      <section className="panel distribution-panel">
        <h3>กราฟตรวจการแจกแจง</h3>
        <p>ต้องมีข้อมูลอย่างน้อย 3 ค่าเพื่อสร้างกราฟวินิจฉัย</p>
      </section>
    );
  }
  const minimum = clean[0];
  const maximum = clean[clean.length - 1];
  const range = maximum - minimum || 1;
  const binsCount = Math.max(4, Math.min(8, Math.ceil(Math.log2(clean.length) + 1)));
  const binWidth = range / binsCount;
  const bins = Array.from({ length: binsCount }, () => 0);
  clean.forEach((value) => {
    const index = Math.min(binsCount - 1, Math.floor((value - minimum) / binWidth));
    bins[index] += 1;
  });
  const maxBin = Math.max(...bins, 1);
  const qq = clean.map((value, index) => ({
    expected: standardNormalQuantile((index + 1 - 0.375) / (clean.length + 0.25)),
    observed: value,
  }));
  const expectedMin = qq[0].expected;
  const expectedMax = qq[qq.length - 1].expected;
  const average = mean(clean) ?? 0;
  const standardDeviation = sampleStandardDeviation(clean) ?? 0;
  const q1 = quantile(clean, 0.25) ?? minimum;
  const q2 = median(clean) ?? minimum;
  const q3 = quantile(clean, 0.75) ?? maximum;
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const lowerWhisker = clean.find((value) => value >= lowerFence) ?? minimum;
  const upperWhisker = [...clean].reverse().find((value) => value <= upperFence) ?? maximum;
  const outliers = clean.filter((value) => value < lowerWhisker || value > upperWhisker);
  const dotStacks = new Map<string, number>();
  const dots = clean.map((value) => {
    const key = value.toFixed(8);
    const stack = dotStacks.get(key) ?? 0;
    dotStacks.set(key, stack + 1);
    return { value, stack };
  });
  const plotMin = minimum - range * 0.05;
  const plotMax = maximum + range * 0.05;

  return (
    <section className="panel distribution-panel" aria-labelledby="distribution-title">
      <div className="panel-head">
        <div>
          <span className="eyebrow">ตรวจหลายหลักฐานร่วมกัน</span>
          <h3 id="distribution-title">กราฟตรวจการแจกแจงของ{label}</h3>
          <p>กราฟช่วยตรวจความสมมาตร ค่าผิดปกติ คะแนนซ้ำ และรูปทรงที่การทดสอบเพียงค่า p อาจมองไม่เห็น</p>
        </div>
      </div>
      <div className="diagnostic-chart-grid">
        <figure>
          <figcaption>Histogram</figcaption>
          <svg viewBox="0 0 300 170" role="img" aria-label={`ฮิสโตแกรมของ${label}`}>
            <line x1="30" y1="140" x2="285" y2="140" className="chart-axis" />
            {bins.map((count, index) => {
              const width = 250 / binsCount;
              const height = (count / maxBin) * 105;
              return <rect key={index} x={32 + index * width} y={140 - height} width={Math.max(3, width - 4)} height={height} rx="3" className="chart-bar" />;
            })}
            <text x="30" y="160" className="chart-label">{fmt(minimum, 1)}</text>
            <text x="265" y="160" className="chart-label">{fmt(maximum, 1)}</text>
          </svg>
        </figure>
        <figure>
          <figcaption>Normal Q–Q Plot</figcaption>
          <svg viewBox="0 0 300 170" role="img" aria-label={`กราฟคิวคิวของ${label}`}>
            <line x1="35" y1="140" x2="285" y2="140" className="chart-axis" />
            <line x1="35" y1="20" x2="35" y2="140" className="chart-axis" />
            <line
              x1={chartScale(expectedMin, expectedMin, expectedMax, 40, 280)}
              y1={chartScale(average + standardDeviation * expectedMin, plotMin, plotMax, 135, 25)}
              x2={chartScale(expectedMax, expectedMin, expectedMax, 40, 280)}
              y2={chartScale(average + standardDeviation * expectedMax, plotMin, plotMax, 135, 25)}
              className="chart-reference"
            />
            {qq.map((point, index) => (
              <circle key={index} cx={chartScale(point.expected, expectedMin, expectedMax, 40, 280)} cy={chartScale(point.observed, plotMin, plotMax, 135, 25)} r="4" className="chart-point" />
            ))}
          </svg>
        </figure>
        <figure>
          <figcaption>Boxplot</figcaption>
          <svg viewBox="0 0 300 130" role="img" aria-label={`บ็อกซ์พลอตของ${label}`}>
            <line x1={chartScale(lowerWhisker, plotMin, plotMax, 30, 285)} y1="65" x2={chartScale(upperWhisker, plotMin, plotMax, 30, 285)} y2="65" className="chart-reference" />
            <line x1={chartScale(lowerWhisker, plotMin, plotMax, 30, 285)} y1="48" x2={chartScale(lowerWhisker, plotMin, plotMax, 30, 285)} y2="82" className="chart-axis" />
            <line x1={chartScale(upperWhisker, plotMin, plotMax, 30, 285)} y1="48" x2={chartScale(upperWhisker, plotMin, plotMax, 30, 285)} y2="82" className="chart-axis" />
            <rect x={chartScale(q1, plotMin, plotMax, 30, 285)} y="35" width={Math.max(2, chartScale(q3, plotMin, plotMax, 30, 285) - chartScale(q1, plotMin, plotMax, 30, 285))} height="60" className="chart-box" />
            <line x1={chartScale(q2, plotMin, plotMax, 30, 285)} y1="35" x2={chartScale(q2, plotMin, plotMax, 30, 285)} y2="95" className="chart-median" />
            {outliers.map((value, index) => <circle key={`${value}-${index}`} cx={chartScale(value, plotMin, plotMax, 30, 285)} cy="65" r="5" className="chart-outlier" />)}
          </svg>
        </figure>
        <figure>
          <figcaption>กราฟจุดรายคน</figcaption>
          <svg viewBox="0 0 300 130" role="img" aria-label={`กราฟจุดของ${label}`}>
            <line x1="30" y1="100" x2="285" y2="100" className="chart-axis" />
            {dots.map((dot, index) => <circle key={index} cx={chartScale(dot.value, plotMin, plotMax, 30, 285)} cy={92 - dot.stack * 11} r="4.5" className="chart-point" />)}
            <text x="30" y="120" className="chart-label">{fmt(minimum, 1)}</text>
            <text x="265" y="120" className="chart-label">{fmt(maximum, 1)}</text>
          </svg>
        </figure>
      </div>
    </section>
  );
}

function reportP(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "p = —";
  if (value < 0.001) return "p < .001";
  return `p = ${value.toFixed(3).replace(/^0/, "")}`;
}

function tailLabel(alternative: AlternativeHypothesis) {
  return alternative === "two-sided" ? "two-tailed" : "one-tailed";
}

function effectLevel(value: number | null | undefined, family: "d" | "r") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "ไม่สามารถแปลผลได้";
  const absolute = Math.abs(value);
  if (family === "d") {
    if (absolute >= 0.8) return "มาก";
    if (absolute >= 0.5) return "ปานกลาง";
    if (absolute >= 0.2) return "น้อย";
    return "ต่ำมาก";
  }
  if (absolute >= 0.5) return "มาก";
  if (absolute >= 0.3) return "ปานกลาง";
  if (absolute >= 0.1) return "น้อย";
  return "ต่ำมาก";
}

function resultDirection(
  result: TestResult,
  mode: ComparisonMode,
  method: ComparisonTest,
) {
  const subject = method === "t-test" ? "ค่าเฉลี่ยคะแนนหลังเรียน" : method === "sign-test" ? "ค่ามัธยฐานคะแนนหลังเรียน" : "ตำแหน่งกึ่งกลางของคะแนนหลังเรียน";
  const target = mode === "paired" ? "คะแนนก่อนเรียน" : "เกณฑ์ที่กำหนด";
  const relation = result.alternative === "greater"
    ? `สูงกว่า${target}`
    : result.alternative === "less"
      ? `ต่ำกว่า${target}`
      : `แตกต่างจาก${target}`;
  return result.significant
    ? `${subject}${relation}อย่างมีนัยสำคัญทางสถิติ`
    : `ยังไม่มีหลักฐานเพียงพอที่จะสรุปว่า${subject}${relation}อย่างมีนัยสำคัญทางสถิติ`;
}

type SampleSizeBand = "very-small" | "small" | "large";

function sampleSizeBand(n: number): SampleSizeBand {
  if (n < 8) return "very-small";
  if (n < 30) return "small";
  return "large";
}

function currentSampleGuidance(n: number, mode: ComparisonMode) {
  const distributionTarget =
    mode === "paired" ? "ผลต่างคะแนนหลังเรียน − ก่อนเรียน" : "คะแนนหลังเรียน";
  if (n < 3) {
    return `มีข้อมูลเพียง ${n} ${mode === "paired" ? "คู่" : "คน"} ยังไม่เพียงพอสำหรับการทดสอบสมมติฐานอย่างเหมาะสม`;
  }
  if (n < 8) {
    return `กลุ่มตัวอย่างเล็กมาก (n = ${n}) การตรวจการแจกแจงมีพลังต่ำ ต้องพิจารณา${distributionTarget} ความสมมาตร และค่าผิดปกติ หากไม่สมมาตรให้พิจารณา Sign Test`;
  }
  if (n < 30) {
    return `กลุ่มตัวอย่างขนาดเล็ก (n = ${n}) เลือก t-test เมื่อ${distributionTarget}ใกล้เคียงปกติ ใช้ Wilcoxon เมื่อไม่ปกติแต่สมมาตร และใช้ Sign Test เมื่อเบ้หรือไม่สมมาตร`;
  }
  return `กลุ่มตัวอย่างตั้งแต่ 30 ขึ้นไป (n = ${n}) t-test มักทนต่อการเบี่ยงเบนจากปกติระดับเล็กน้อยได้ แต่ยังต้องตรวจค่าผิดปกติและความเบ้รุนแรง`;
}

function hypothesisConclusion(
  result: TestResult | null,
  mode: ComparisonMode,
) {
  if (!result || result.significant === null) {
    return "ยังสรุปผลไม่ได้ โปรดตรวจจำนวนข้อมูลและความแปรปรวน";
  }
  const target = mode === "paired" ? "คะแนนก่อนเรียน" : "เกณฑ์ที่กำหนด";
  const direction =
    result.alternative === "greater"
      ? `คะแนนหลังเรียนสูงกว่า${target}`
      : result.alternative === "less"
        ? `คะแนนหลังเรียนต่ำกว่า${target}`
        : `คะแนนหลังเรียนแตกต่างจาก${target}`;
  return result.significant
    ? `${direction}อย่างมีนัยสำคัญทางสถิติที่ระดับ ${result.alpha}`
    : `ยังไม่พบว่า${direction}อย่างมีนัยสำคัญทางสถิติที่ระดับ ${result.alpha}`;
}

function PairedView({
  imported,
  initial,
  onChange,
  editable,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  editable: boolean;
}) {
  const importedRows =
    imported?.rows
      .map((row) => row.map(Number).filter(Number.isFinite))
      .filter((row) => row.length) ?? [];
  const importedPairs = importedRows.filter((row) => row.length >= 2);
  const [pre, setPre] = useState(
      typeof initial?.pre === "string"
        ? initial.pre
        : importedPairs.length
          ? importedPairs.map((row) => row[0]).join(", ")
          : "10, 12, 11, 14, 9, 13, 12, 10",
    ),
    [post, setPost] = useState(
      typeof initial?.post === "string"
        ? initial.post
        : importedPairs.length
          ? importedPairs.map((row) => row[1]).join(", ")
          : importedRows.length
            ? importedRows.map((row) => row.at(-1)).join(", ")
            : "16, 17, 15, 18, 14, 17, 16, 15",
    ),
    [mode, setMode] = useState<ComparisonMode>(
      initial?.mode === "criterion" ? "criterion" : "paired",
    ),
    [pairedMethod, setPairedMethod] = useState<ComparisonTest>(
      isTestMethod(initial?.pairedMethod) ? initial.pairedMethod : "t-test",
    ),
    [criterionMethod, setCriterionMethod] = useState<ComparisonTest>(
      isTestMethod(initial?.criterionMethod)
        ? initial.criterionMethod
        : "t-test",
    ),
    [pairedAlternative, setPairedAlternative] =
      useState<AlternativeHypothesis | "">(
        isAlternative(initial?.pairedAlternative)
          ? initial.pairedAlternative
          : "",
      ),
    [criterionAlternative, setCriterionAlternative] =
      useState<AlternativeHypothesis | "">(
        isAlternative(initial?.criterionAlternative)
          ? initial.criterionAlternative
          : "",
      ),
    [alpha, setAlpha] = useState(Number(initial?.alpha ?? 0.05)),
    [criterionMode, setCriterionMode] = useState<"percent" | "raw">(
      initial?.criterionMode === "raw" ? "raw" : "percent",
    ),
    [maximumScore, setMaximumScore] = useState(
      Number(initial?.maximumScore ?? 30),
    ),
    [criterionPercent, setCriterionPercent] = useState(
      Number(initial?.criterionPercent ?? 80),
    ),
    [criterionRaw, setCriterionRaw] = useState(
      Number(initial?.criterionRaw ?? 24),
    ),
    [copiedReport, setCopiedReport] = useState<"short" | "detailed" | null>(null),
    [copiedResearchText, setCopiedResearchText] = useState<"method" | "limitations" | null>(null);

  const preValues = useMemo(() => parseNumbers(pre), [pre]);
  const postValues = useMemo(() => parseNumbers(post), [post]);
  const criterionScore =
    criterionMode === "percent"
      ? (criterionPercent / 100) * maximumScore
      : criterionRaw;
  const pairedDifferences = useMemo(
    () => preValues.length === postValues.length
      ? postValues.map((value, index) => value - preValues[index])
      : [],
    [preValues, postValues],
  );
  const criterionDifferences = useMemo(
    () => postValues.map((value) => value - criterionScore),
    [postValues, criterionScore],
  );
  const activeDifferences = mode === "paired" ? pairedDifferences : criterionDifferences;
  const activeDiagnostics = useMemo(
    () => assessNormality(activeDifferences),
    [activeDifferences],
  );
  const pairedResult = useMemo(
    () => {
      if (!pairedAlternative) return null;
      if (pairedMethod === "t-test") return pairedTTest(preValues, postValues, pairedAlternative, alpha);
      if (pairedMethod === "wilcoxon") return pairedWilcoxonTest(preValues, postValues, pairedAlternative, alpha);
      return pairedSignTest(preValues, postValues, pairedAlternative, alpha);
    },
    [preValues, postValues, pairedMethod, pairedAlternative, alpha],
  );
  const criterionResult = useMemo(
    () => {
      if (!criterionAlternative) return null;
      if (criterionMethod === "t-test") return oneSampleTTest(postValues, criterionScore, criterionAlternative, alpha);
      if (criterionMethod === "wilcoxon") return oneSampleWilcoxonTest(postValues, criterionScore, criterionAlternative, alpha);
      return oneSampleSignTest(postValues, criterionScore, criterionAlternative, alpha);
    },
    [postValues, criterionScore, criterionMethod, criterionAlternative, alpha],
  );
  const activeResult = mode === "paired" ? pairedResult : criterionResult;
  const activeMethod = mode === "paired" ? pairedMethod : criterionMethod;
  const activeAlternative = mode === "paired" ? pairedAlternative : criterionAlternative;
  const pairedLengthMismatch =
    mode === "paired" && preValues.length !== postValues.length;
  const activeSampleSize =
    mode === "paired"
      ? Math.min(preValues.length, postValues.length)
      : postValues.length;
  const activeSampleBand = sampleSizeBand(activeSampleSize);

  useEffect(() => {
    onChange(
      {
        pre,
        post,
        mode,
        pairedMethod,
        criterionMethod,
        pairedAlternative,
        criterionAlternative,
        alpha,
        criterionMode,
        maximumScore,
        criterionPercent,
        criterionRaw,
      },
      {
        mode,
        criterionScore,
        ...(activeResult ?? {}),
      } as WorkspaceData,
    );
  }, [
    pre,
    post,
    mode,
    pairedMethod,
    criterionMethod,
    pairedAlternative,
    criterionAlternative,
    alpha,
    criterionMode,
    maximumScore,
    criterionPercent,
    criterionRaw,
    criterionScore,
    activeResult,
    onChange,
  ]);

  const isTTest = activeMethod === "t-test";
  const isWilcoxon = activeMethod === "wilcoxon";
  const isSignTest = activeMethod === "sign-test";
  const wilcoxonResult = isWilcoxon
    ? (activeResult as WilcoxonResult | null)
    : null;
  const signResult = isSignTest
    ? (activeResult as SignTestResult | null)
    : null;
  const tResult = isTTest
    ? (activeResult as PairedResult | OneSampleTResult | null)
    : null;
  const pairedTResult = mode === "paired" && isTTest
    ? (tResult as PairedResult | null)
    : null;
  const oneSampleResult = mode === "criterion" && isTTest
    ? (tResult as OneSampleTResult | null)
    : null;
  const activeMedian = median(mode === "paired" ? pairedDifferences : postValues);
  const activeQ1 = quantile(mode === "paired" ? pairedDifferences : postValues, 0.25);
  const activeQ3 = quantile(mode === "paired" ? pairedDifferences : postValues, 0.75);
  const activeIqr = activeQ1 === null || activeQ3 === null ? null : activeQ3 - activeQ1;
  const zeroRatio = activeDifferences.length
    ? activeDifferences.filter((value) => Math.abs(value) <= 1e-12).length / activeDifferences.length
    : 0;
  const duplicateDifferenceCount = activeDifferences.length - new Set(activeDifferences.map((value) => value.toFixed(10))).size;
  const ceilingCount = mode === "criterion" && maximumScore > 0
    ? postValues.filter((value) => value >= maximumScore - 1e-12).length
    : 0;
  const analysisWarnings = Array.from(new Set([
    ...activeDiagnostics.warnings,
    ...(zeroRatio >= 0.2 ? [`พบคะแนนเท่ากับ${mode === "paired" ? "กัน" : "เกณฑ์"}ร้อยละ ${(zeroRatio * 100).toFixed(0)} ทำให้ n ที่ใช้จริงและกำลังการทดสอบลดลง`] : []),
    ...(duplicateDifferenceCount >= Math.max(2, Math.ceil(activeDifferences.length * 0.25)) ? [`พบผลต่างซ้ำ ${duplicateDifferenceCount} ค่า ซึ่งพบได้บ่อยในคะแนนจำนวนเต็ม ควรดูกราฟจุดและวิธีจัดการอันดับซ้ำประกอบ`] : []),
    ...(wilcoxonResult && wilcoxonResult.tiedDifferences >= Math.max(2, Math.ceil(wilcoxonResult.n * 0.25)) ? [`พบอันดับซ้ำ ${wilcoxonResult.tiedDifferences} ค่า โปรแกรมอื่นอาจรายงาน p-value ต่างกันเล็กน้อยตามวิธีจัดการ ties`] : []),
    ...(mode === "criterion" && postValues.length && ceilingCount / postValues.length >= 0.2 ? [`พบคะแนนเต็ม ${ceilingCount} คน (${((ceilingCount / postValues.length) * 100).toFixed(0)}%) อาจเกิด ceiling effect`] : []),
  ]));
  const reports = useMemo(() => {
    if (!activeResult || !activeAlternative) {
      const waiting = "โปรดเลือกสมมติฐานทางเดียวหรือสองทางก่อน ระบบจึงจะสร้างรายงานผล";
      return { short: waiting, detailed: waiting };
    }
    const conclusion = resultDirection(activeResult, mode, activeMethod);
    const direction = tailLabel(activeAlternative);
    const alphaText = activeResult.alpha.toString().replace(/^0/, "");
    const recommendationMatches = activeDiagnostics.recommendedTest === activeMethod;
    const selectionNote = recommendationMatches
      ? "หลังพิจารณาผล Shapiro–Wilk กราฟการแจกแจง ความสมมาตร และค่าผิดปกติ"
      : `ผู้วิจัยเลือกวิธีนี้ต่างจากคำแนะนำอัตโนมัติ (${normalityRecommendation(activeDiagnostics)}) จึงควรระบุเหตุผลทางวิชาการเพิ่มเติม`;
    if (activeMethod === "t-test") {
      const result = activeResult as PairedResult | OneSampleTResult;
      const paired = mode === "paired" ? result as PairedResult : null;
      const oneSample = mode === "criterion" ? result as OneSampleTResult : null;
      const effect = paired?.cohenDz ?? oneSample?.cohenD ?? null;
      const testName = mode === "paired" ? "การทดสอบ t แบบกลุ่มตัวอย่างสัมพันธ์" : "การทดสอบ t สำหรับกลุ่มตัวอย่างเดียว";
      const descriptives = mode === "paired"
        ? `ค่าเฉลี่ยก่อนเรียนเท่ากับ ${fmt(paired?.preMean)} และหลังเรียนเท่ากับ ${fmt(paired?.postMean)}`
        : `คะแนนหลังเรียนมีค่าเฉลี่ย ${fmt(oneSample?.mean)} ส่วนเบี่ยงเบนมาตรฐาน ${fmt(oneSample?.standardDeviation)} เทียบกับเกณฑ์ ${fmt(criterionScore)} คะแนน`;
      const statistics = `t(${result.df}) = ${fmt(result.t)}, ${reportP(result.pValue)}, ${direction}, ${mode === "paired" ? "Cohen’s dz" : "Cohen’s d"} = ${fmt(effect)}`;
      return {
        short: `ผล${testName}พบว่า ${conclusion}ที่ระดับ ${alphaText} (${statistics})`,
        detailed: `${descriptives} ${selectionNote} ผู้วิจัยจึงใช้${testName}ตามสมมติฐานที่กำหนดไว้ล่วงหน้า ผลการวิเคราะห์พบว่า ${conclusion}ที่ระดับ ${alphaText} (${statistics}) โดยมีขนาดอิทธิพลระดับ${effectLevel(effect, "d")}`,
      };
    }
    if (activeMethod === "wilcoxon") {
      const result = activeResult as WilcoxonResult;
      const testName = mode === "paired" ? "การทดสอบอันดับเครื่องหมายของวิลคอกซันสำหรับข้อมูลคู่" : "การทดสอบอันดับเครื่องหมายของวิลคอกซันสำหรับกลุ่มตัวอย่างเดียว";
      const methodText = result.probabilityMethod === "exact-conditional" ? "Exact conditional" : "Normal approximation พร้อม tie/continuity correction";
      const statistics = `W+ = ${fmt(result.wPlus, 1)}, W− = ${fmt(result.wMinus, 1)}, T = ${fmt(result.statistic, 1)}, Zโดยประมาณ = ${fmt(result.z)}, ${reportP(result.pValue)}, ${direction}, r = ${fmt(result.effectR)}`;
      const descriptives = mode === "paired"
        ? `ผลต่างหลังเรียน–ก่อนเรียนมีมัธยฐาน ${fmt(activeMedian)} และ IQR ${fmt(activeIqr)}`
        : `คะแนนหลังเรียนมีมัธยฐาน ${fmt(median(postValues))} และ IQR ${fmt(activeIqr)} เทียบกับเกณฑ์ ${fmt(criterionScore)} คะแนน`;
      return {
        short: `ผล${testName}พบว่า ${conclusion}ที่ระดับ ${alphaText} (${statistics}; ${methodText})`,
        detailed: `${descriptives} ${selectionNote} ผู้วิจัยใช้${testName} โดยมีข้อมูลทั้งหมด ${result.totalN} ค่า ผลต่างบวก ${result.positiveCount} ค่า ผลต่างลบ ${result.negativeCount} ค่า ตัดผลต่างศูนย์ ${result.zeroDifferences} ค่า และใช้วิเคราะห์จริง ${result.n} ค่า ผลพบว่า ${conclusion}ที่ระดับ ${alphaText} (${statistics}; ${methodText}) ค่า Z และ r เป็นค่าประมาณสำหรับสรุปขนาดอิทธิพล ซึ่งอยู่ในระดับ${effectLevel(result.effectR, "r")} และ rank-biserial r = ${fmt(result.rankBiserial)}`,
      };
    }
    const result = activeResult as SignTestResult;
    const testName = mode === "paired" ? "การทดสอบเครื่องหมายสำหรับข้อมูลคู่" : "การทดสอบเครื่องหมายสำหรับกลุ่มตัวอย่างเดียว";
    const statistics = `R+ = ${result.positiveCount}, R− = ${result.negativeCount}, สัดส่วนเครื่องหมายบวก = ${fmt(result.positiveProportion)}, ${reportP(result.pValue)}, ${direction}, B = ${fmt(result.signEffect)}`;
    const descriptives = mode === "paired"
      ? `ผลต่างหลังเรียน–ก่อนเรียนมีมัธยฐาน ${fmt(activeMedian)}`
      : `คะแนนหลังเรียนมีมัธยฐาน ${fmt(median(postValues))} เทียบกับเกณฑ์ ${fmt(criterionScore)} คะแนน`;
    return {
      short: `ผล${testName}แบบ Exact binomial พบว่า ${conclusion}ที่ระดับ ${alphaText} (${statistics})`,
      detailed: `${descriptives} ${selectionNote} ผู้วิจัยใช้${testName}แบบ Exact binomial โดยมีข้อมูลทั้งหมด ${result.totalN} ค่า ตัด${mode === "paired" ? "ผลต่างที่เท่ากับศูนย์ (คะแนนก่อนและหลังเท่ากัน)" : "คะแนนที่เท่ากับเกณฑ์"} ${result.zeroDifferences} ค่า และใช้วิเคราะห์จริง ${result.n} ค่า ผลพบว่า ${conclusion}ที่ระดับ ${alphaText} (${statistics}) โดย B เป็นดัชนีสมดุลเครื่องหมายช่วง −1 ถึง 1 ไม่ใช่ Cohen’s r`,
    };
  }, [
    activeResult,
    activeAlternative,
    activeMethod,
    mode,
    criterionScore,
    activeMedian,
    activeIqr,
    postValues,
    activeDiagnostics,
  ]);

  const copyReport = async (kind: "short" | "detailed") => {
    try {
      await navigator.clipboard.writeText(reports[kind]);
      setCopiedReport(kind);
      window.setTimeout(() => setCopiedReport(null), 1800);
    } catch {
      setCopiedReport(null);
    }
  };

  const methodologyText = `1. เปรียบเทียบผลสัมฤทธิ์ทางการเรียนก่อนเรียนและหลังเรียน โดยตรวจสอบการแจกแจงของผลต่างคะแนนหลังเรียน − ก่อนเรียนด้วย Shapiro–Wilk ร่วมกับ Q–Q plot, Histogram, Boxplot ความสมมาตร และค่าผิดปกติ หากผลต่างใกล้เคียงปกติใช้ Paired-Samples t-test หากไม่ปกติแต่สมมาตรใช้ Wilcoxon Signed-Rank Test สำหรับข้อมูลคู่ และหากเบ้มากหรือไม่สมมาตรใช้ Paired Sign Test\n2. เปรียบเทียบคะแนนหลังเรียนกับเกณฑ์${criterionMode === "percent" ? `ร้อยละ ${fmt(criterionPercent, 1)} ของคะแนนเต็ม ${fmt(maximumScore, 1)} คะแนน คิดเป็น ${fmt(criterionScore, 2)} คะแนน` : `คะแนนดิบ ${fmt(criterionScore, 2)} คะแนน`} โดยตรวจผลต่างคะแนนหลังเรียน − เกณฑ์ด้วยหลักฐานชุดเดียวกัน หากใกล้เคียงปกติใช้ One-Sample t-test หากไม่ปกติแต่สมมาตรใช้ One-Sample Wilcoxon Signed-Rank Test และหากเบ้มากหรือไม่สมมาตรใช้ One-Sample Sign Test\n3. วิเคราะห์ความพึงพอใจด้วยค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน มัธยฐาน และ IQR ประกอบ แล้วแปลผลตามเกณฑ์ที่กำหนดและอ้างอิงไว้ล่วงหน้า การทดสอบข้อ 1–2 กำหนดทางเดียวด้านสูงกว่าที่ระดับนัยสำคัญ ${alpha.toString().replace(/^0/, "")} ก่อนดูผลการวิเคราะห์`;
  const limitationsText = `งานวิจัยนี้ใช้กลุ่มตัวอย่างนักเรียนจำนวน ${activeSampleSize} คน ซึ่งได้มาโดยการเลือกแบบเจาะจงและไม่มีกลุ่มควบคุม จึงควรระมัดระวังการสรุปว่าเกมมิฟิเคชันร่วมกับการจัดการเรียนรู้เชิงรุกเป็นสาเหตุเพียงอย่างเดียวที่ทำให้คะแนนสูงขึ้น เพราะอาจมีผลจากการทำแบบทดสอบก่อนเรียน พัฒนาการตามวัย กิจกรรมการเรียนรู้อื่น และความคุ้นเคยกับผู้สอนหรือแบบทดสอบ ผลที่พบจึงควรสรุปให้อยู่ในขอบเขตของนักเรียนกลุ่มตัวอย่างในการวิจัยครั้งนี้ และไม่ขยายผลโดยตรงไปยังนักเรียนชั้นประถมศึกษาปีที่ 2 ทั้งหมดโดยไม่มีการวิจัยเพิ่มเติม`;
  const copyResearchText = async (kind: "method" | "limitations") => {
    try {
      await navigator.clipboard.writeText(kind === "method" ? methodologyText : limitationsText);
      setCopiedResearchText(kind);
      window.setTimeout(() => setCopiedResearchText(null), 1800);
    } catch {
      setCopiedResearchText(null);
    }
  };

  return (
    <Page
      title="ทดสอบก่อนเรียน–หลังเรียน"
      subtitle="เลือกสถิติพาราเมตริกหรือไม่อิงพารามิเตอร์ และเปรียบเทียบคะแนนหลังเรียนกับเกณฑ์"
      badge="เลือกวิธีทดสอบได้"
    >
      <div className="analysis-tabs" role="tablist" aria-label="ประเภทการเปรียบเทียบ">
        <button
          disabled={!editable}
          type="button"
          role="tab"
          aria-selected={mode === "paired"}
          className={mode === "paired" ? "active" : ""}
          onClick={() => setMode("paired")}
        >
          ก่อนเรียน–หลังเรียน
        </button>
        <button
          disabled={!editable}
          type="button"
          role="tab"
          aria-selected={mode === "criterion"}
          className={mode === "criterion" ? "active" : ""}
          onClick={() => setMode("criterion")}
        >
          หลังเรียนเทียบเกณฑ์
        </button>
      </div>

      <section className="panel analysis-controls">
        <TestMethodSelect
          mode={mode}
          value={activeMethod}
          editable={editable}
          onChange={(selected) => {
            if (mode === "paired") setPairedMethod(selected);
            else setCriterionMethod(selected);
          }}
        />
        <HypothesisSelect
          mode={mode}
          value={mode === "paired" ? pairedAlternative : criterionAlternative}
          editable={editable}
          onChange={
            mode === "paired" ? setPairedAlternative : setCriterionAlternative
          }
        />
        <label>
          ระดับนัยสำคัญ (α)
          <select
            disabled={!editable}
            value={alpha}
            onChange={(event) => setAlpha(Number(event.target.value))}
          >
            <option value={0.05}>.05</option>
            <option value={0.01}>.01</option>
            <option value={0.1}>.10</option>
          </select>
        </label>
      </section>

      {!activeAlternative && (
        <div className="notice hypothesis-required" role="alert">
          <b>ต้องเลือกสมมติฐานก่อนคำนวณ</b>
          <p>เลือกทางเดียว: สูงกว่า/ต่ำกว่า หรือสองทางทุกครั้ง โดยควรกำหนดก่อนดูผลการทดสอบ</p>
        </div>
      )}

      {mode === "criterion" && (
        <section className="panel criterion-controls">
          <label>
            รูปแบบเกณฑ์
            <select
              disabled={!editable}
              value={criterionMode}
              onChange={(event) =>
                setCriterionMode(event.target.value as "percent" | "raw")
              }
            >
              <option value="percent">ร้อยละของคะแนนเต็ม</option>
              <option value="raw">คะแนนดิบ</option>
            </select>
          </label>
          {criterionMode === "percent" ? (
            <>
              <label>
                เกณฑ์ (ร้อยละ)
                <input
                  disabled={!editable}
                  type="number"
                  min="0"
                  max="100"
                  value={criterionPercent}
                  onChange={(event) => setCriterionPercent(Number(event.target.value))}
                />
              </label>
              <label>
                คะแนนเต็ม
                <input
                  disabled={!editable}
                  type="number"
                  min="0.01"
                  value={maximumScore}
                  onChange={(event) => setMaximumScore(Number(event.target.value))}
                />
              </label>
            </>
          ) : (
            <label>
              เกณฑ์คะแนนดิบ
              <input
                disabled={!editable}
                type="number"
                value={criterionRaw}
                onChange={(event) => setCriterionRaw(Number(event.target.value))}
              />
            </label>
          )}
          <div className="criterion-value">
            <span>เกณฑ์ที่ใช้คำนวณ</span>
            <strong>{fmt(criterionScore, 2)} คะแนน</strong>
          </div>
        </section>
      )}

      <section className={`panel two-text ${mode === "criterion" ? "single-score" : ""}`}>
        {mode === "paired" && (
          <label>
            คะแนนก่อนเรียน
            <textarea
              disabled={!editable}
              rows={7}
              value={pre}
              onChange={(event) => setPre(event.target.value)}
            />
          </label>
        )}
        <label>
          คะแนนหลังเรียน
          <textarea
            disabled={!editable}
            rows={7}
            value={post}
            onChange={(event) => setPost(event.target.value)}
          />
        </label>
      </section>

      {pairedLengthMismatch && (
        <div className="notice analysis-warning">
          <b>จำนวนข้อมูลไม่เท่ากัน</b>
          <p>
            คะแนนก่อนเรียนมี {preValues.length} ค่า แต่คะแนนหลังเรียนมี {postValues.length} ค่า
            ต้องมีข้อมูลของนักเรียนคนเดียวกันครบทั้งสองครั้ง
          </p>
        </div>
      )}

      <div className="notice analysis-recommendation">
        <b>คำแนะนำเบื้องต้นจากการกระจายข้อมูล</b>
        <p>{normalityRecommendation(activeDiagnostics)}</p>
        {activeDiagnostics.recommendedTest !== activeMethod && (
          <small>
            ขณะนี้ผู้ใช้เลือก {isTTest ? "t-test" : isWilcoxon ? "Wilcoxon" : "Sign Test"} ซึ่งต่างจากคำแนะนำ
            ระบบยังคงคำนวณตามวิธีที่ผู้ใช้เลือก
          </small>
        )}
      </div>

      {analysisWarnings.length > 0 && (
        <section className="panel analysis-diagnostics">
          <div className="panel-head">
            <div>
              <h3>สิ่งที่ควรตรวจสอบก่อนแปลผล</h3>
              <p>ระบบตรวจรูปทรงข้อมูล ค่าผิดปกติ คะแนนซ้ำ และจำนวนข้อมูลที่ใช้จริง</p>
            </div>
            <span className="diagnostic-count">{analysisWarnings.length} ข้อ</span>
          </div>
          <ul>
            {analysisWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      )}

      <section className="panel normality-summary">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Shapiro–Wilk และรูปทรงข้อมูล</span>
            <h3>ผลตรวจการแจกแจง</h3>
            <p>ทดสอบ{mode === "paired" ? "ผลต่างหลังเรียน − ก่อนเรียน" : "ผลต่างคะแนนหลังเรียน − เกณฑ์"} ไม่ใช่เลือกวิธีจากจำนวนตัวอย่างเพียงอย่างเดียว</p>
          </div>
        </div>
        <div className="metrics compact diagnostic-metrics">
          <Metric label="Shapiro–Wilk W" value={fmt(activeDiagnostics.statistic)} tone="violet" />
          <Metric label="p-value" value={fmtP(activeDiagnostics.pValue)} />
          <Metric label="Skewness" value={fmt(activeDiagnostics.skewness)} />
          <Metric label="Bowley skewness" value={fmt(activeDiagnostics.bowleySkewness)} />
          <Metric label="Outlier (1.5×IQR)" value={`${activeDiagnostics.outlierCount}`} tone={activeDiagnostics.outlierCount ? "amber" : "green"} />
        </div>
        <small>ค่า p &gt; .05 หมายถึงยังไม่มีหลักฐานว่าผิดปกติ ไม่ได้พิสูจน์ว่าข้อมูลเป็นปกติ จึงต้องดู Q–Q plot ความสมมาตร และค่าผิดปกติร่วมกัน</small>
      </section>

      <DistributionDiagnostics
        values={activeDifferences}
        label={mode === "paired" ? "ผลต่างหลังเรียน − ก่อนเรียน" : "ผลต่างคะแนนหลังเรียน − เกณฑ์"}
      />

      <section className="panel sample-size-guide" aria-labelledby="sample-size-guide-title">
        <div className="sample-size-guide-head">
          <div>
            <span className="eyebrow">แนวทางเลือกสถิติ</span>
            <h3 id="sample-size-guide-title">กลุ่มตัวอย่างเท่าไรจึงเลือกใช้สถิติใด?</h3>
          </div>
          <span className="sample-size-current">
            ข้อมูลปัจจุบัน n = {activeSampleSize}{mode === "paired" ? " คู่" : " คน"}
          </span>
        </div>
        <p className="sample-size-summary">{currentSampleGuidance(activeSampleSize, mode)}</p>
        <div className="sample-size-grid">
          <article className={activeSampleBand === "very-small" ? "active" : ""}>
            <b>n น้อยกว่า 8</b>
            <strong>กลุ่มเล็กมาก</strong>
            <p>
              ยังตัดสินการแจกแจงได้ไม่มั่นคง ใช้ t-test ได้เมื่อข้อมูลเชิงปริมาณ
              ผลต่างค่อนข้างสมมาตรและไม่มีค่าผิดปกติชัดเจน หากเป็นข้อมูลอันดับ
              หรือสมมติฐานของ t-test ไม่ผ่าน ให้พิจารณา Wilcoxon
              แต่ถ้าผลต่างไม่สมมาตรให้ใช้ Sign Test และแปลผลอย่างระมัดระวัง
            </p>
          </article>
          <article className={activeSampleBand === "small" ? "active" : ""}>
            <b>n = 8–29</b>
            <strong>กลุ่มขนาดเล็ก</strong>
            <p>
              เลือก t-test เมื่อผลต่างใกล้เคียงการแจกแจงปกติและไม่มี outlier รุนแรง
              เลือก Wilcoxon เมื่อข้อมูลเป็นอันดับ ไม่ปกติแต่ยังค่อนข้างสมมาตร หรือมีค่าผิดปกติ
              โดยผลต่างควรมีรูปทรงใกล้เคียงสมมาตร หากไม่สมมาตรให้เลือก Sign Test
            </p>
          </article>
          <article className={activeSampleBand === "large" ? "active" : ""}>
            <b>n ตั้งแต่ 30 ขึ้นไป</b>
            <strong>กลุ่มขนาดกลาง–ใหญ่</strong>
            <p>
              t-test มักเป็นตัวเลือกหลักเมื่อต้องการทดสอบค่าเฉลี่ยและไม่มี outlier รุนแรง
              แม้ข้อมูลเบี่ยงเบนจากปกติเล็กน้อย ส่วน Wilcoxon เหมาะเมื่อเป็นข้อมูลอันดับ
              และผลต่างสมมาตร ส่วน Sign Test เหมาะเมื่อผลต่างยังเบ้หรือไม่สมมาตรรุนแรง
            </p>
          </article>
        </div>
        <div className="sample-size-caution">
          <b>สำคัญ:</b> ไม่มีกฎว่า n &lt; 30 ต้องใช้ Wilcoxon และ n ≥ 30 ต้องใช้ t-test เสมอ
          ต้องพิจารณาระดับการวัด การแจกแจงของ{mode === "paired" ? "ผลต่างรายคู่" : "คะแนนหลังเรียน"}
          ค่าผิดปกติ และสมมติฐานการวิจัยร่วมกัน และควรกำหนดทางเดียวหรือสองทางก่อนดูผลการทดสอบ
        </div>
      </section>

      <div className="metrics analysis-metrics">
        <Metric
          label={isTTest ? "n" : "n ที่ใช้ / ทั้งหมด"}
          value={isTTest ? `${activeResult?.n ?? 0}` : activeResult ? `${activeResult.n} / ${(activeResult as WilcoxonResult | SignTestResult).totalN}` : "—"}
        />
        {mode === "paired" ? (
          <>
            <Metric label="ก่อนเรียน x̄" value={fmt(pairedTResult?.preMean ?? mean(preValues))} />
            <Metric label="หลังเรียน x̄" value={fmt(pairedTResult?.postMean ?? mean(postValues))} tone="green" />
            <Metric label="ผลต่างเฉลี่ย" value={fmt(pairedTResult?.meanDifference ?? (mean(postValues) ?? 0) - (mean(preValues) ?? 0))} tone="amber" />
          </>
        ) : (
          <>
            <Metric label="หลังเรียน x̄" value={fmt(oneSampleResult?.mean ?? mean(postValues))} tone="green" />
            <Metric label="มัธยฐาน" value={fmt(oneSampleResult?.median ?? median(postValues))} />
            <Metric label="เกณฑ์" value={fmt(criterionScore)} tone="amber" />
          </>
        )}
        {isTTest ? (
          <>
            <Metric
              label="t (df)"
              value={tResult ? `${fmt(tResult.t)} (${tResult.df})` : "—"}
              tone="violet"
            />
            <Metric
              label={mode === "paired" ? "Cohen’s dz" : "Cohen’s d"}
              value={fmt(mode === "paired" ? pairedTResult?.cohenDz : oneSampleResult?.cohenD)}
              tone="green"
            />
          </>
        ) : isWilcoxon ? (
          <>
            <Metric label="W+ / W−" value={wilcoxonResult ? `${fmt(wilcoxonResult.wPlus, 1)} / ${fmt(wilcoxonResult.wMinus, 1)}` : "—"} tone="violet" />
            <Metric label="ผลต่าง + / −" value={wilcoxonResult ? `${wilcoxonResult.positiveCount} / ${wilcoxonResult.negativeCount}` : "—"} />
            <Metric label="T = min(W+, W−)" value={fmt(wilcoxonResult?.statistic, 1)} />
            <Metric label="Z โดยประมาณ / effect r" value={wilcoxonResult ? `${fmt(wilcoxonResult.z)} / ${fmt(wilcoxonResult.effectR)}` : "—"} />
            <Metric label="Rank-biserial r" value={fmt(wilcoxonResult?.rankBiserial)} tone="green" />
            <Metric label="ศูนย์ / อันดับซ้ำ" value={wilcoxonResult ? `${wilcoxonResult.zeroDifferences} / ${wilcoxonResult.tiedDifferences}` : "—"} tone="amber" />
            <Metric label="วิธีหา p" value={wilcoxonResult?.probabilityMethod === "exact-conditional" ? "Exact conditional" : wilcoxonResult ? "Normal approx." : "—"} />
          </>
        ) : (
          <>
            <Metric label="R+ / R−" value={signResult ? `${signResult.positiveCount} / ${signResult.negativeCount}` : "—"} tone="violet" />
            <Metric label="มัธยฐานผลต่าง" value={fmt(signResult?.medianDifference)} />
            <Metric label="สัดส่วนเครื่องหมายบวก" value={fmt(signResult?.positiveProportion)} tone="green" />
            <Metric label="ดัชนีสมดุล B" value={fmt(signResult?.signEffect)} note="ช่วง −1 ถึง 1; ไม่ใช่ Cohen’s r" />
            <Metric label="ค่าที่ตัดออก (= 0)" value={`${signResult?.zeroDifferences ?? 0}`} tone="amber" />
            <Metric label="วิธีหา p" value={signResult ? "Exact binomial" : "—"} />
          </>
        )}
        <Metric label="p-value" value={fmtP(activeResult?.pValue)} tone="violet" />
        <Metric
          label="ผลการทดสอบ"
          value={activeResult?.significant ? "มีนัยสำคัญ" : activeResult?.significant === false ? "ไม่มีนัยสำคัญ" : "—"}
          tone={activeResult?.significant ? "green" : "amber"}
          note={hypothesisConclusion(activeResult, mode)}
        />
      </div>

      <Formula source="Student’s t distribution; Shapiro & Wilk (1965); Royston AS R94; Wilcoxon (1945); Exact binomial Sign Test; Cohen (1988)">
        {mode === "paired" && isTTest && "Paired t-test: t = d̄ / (Sᵈ/√n) โดย d = คะแนนหลังเรียน − คะแนนก่อนเรียน"}
        {mode === "criterion" && isTTest && "One-sample t-test: t = (x̄ − μ₀) / (S/√n) โดย μ₀ คือคะแนนเกณฑ์"}
        {isWilcoxon && "Wilcoxon signed-rank: จัดอันดับค่าสัมบูรณ์ของผลต่าง แล้วเปรียบเทียบผลรวมอันดับด้านบวกและด้านลบ"}
        {isWilcoxon && (
          <small>
            Wilcoxon signed-rank ควรใช้เมื่อการแจกแจงของผลต่างมีความสมมาตร
            ระบบใช้ Exact conditional จากการแจกแจงเครื่องหมายที่เป็นไปได้ทั้งหมดเมื่อ n ที่ใช้จริง ≤ 30 ซึ่งรองรับอันดับซ้ำหลังตัดผลต่างศูนย์ และใช้ Normal approximation พร้อม tie/continuity correction เมื่อ n มากกว่า 30 ค่า Z ที่แสดงเป็นค่าประมาณ
          </small>
        )}
        {isSignTest && "Sign Test: ตัดผลต่างที่เท่ากับศูนย์ แล้วทดสอบจำนวนเครื่องหมายบวกด้วย Binomial(n, .5) แบบ Exact"}
        {isSignTest && <small>Sign Test เหมาะเมื่อผลต่างเบ้หรือไม่สมมาตร แต่กำลังการทดสอบมักต่ำกว่า t-test และ Wilcoxon</small>}
      </Formula>

      <section className="panel automatic-report" aria-labelledby="automatic-report-title">
        <div className="panel-head">
          <div>
            <span className="eyebrow">พร้อมใช้ในบทที่ 4</span>
            <h3 id="automatic-report-title">รายงานผลอัตโนมัติ</h3>
            <p>ข้อความปรับตามวิธีทดสอบ ทิศทางสมมติฐาน เกณฑ์ และผลที่คำนวณได้</p>
          </div>
        </div>
        <div className="report-grid">
          <article>
            <div className="report-head">
              <b>แบบย่อ</b>
              <button type="button" onClick={() => copyReport("short")}>{copiedReport === "short" ? "คัดลอกแล้ว" : "คัดลอก"}</button>
            </div>
            <p>{reports.short}</p>
          </article>
          <article>
            <div className="report-head">
              <b>แบบละเอียด</b>
              <button type="button" onClick={() => copyReport("detailed")}>{copiedReport === "detailed" ? "คัดลอกแล้ว" : "คัดลอก"}</button>
            </div>
            <p>{reports.detailed}</p>
          </article>
        </div>
      </section>

      <section className="panel research-writing" aria-labelledby="research-writing-title">
        <div className="panel-head">
          <div>
            <span className="eyebrow">นำไปปรับใช้ในรายงานวิจัย</span>
            <h3 id="research-writing-title">ข้อความบทที่ 3 และข้อจำกัด</h3>
            <p>ตรวจชื่อกลุ่มตัวอย่าง แบบแผนวิจัย และแหล่งอ้างอิงให้ตรงกับฉบับจริงก่อนนำไปใช้</p>
          </div>
        </div>
        <div className="report-grid">
          <article>
            <div className="report-head">
              <b>การวิเคราะห์ข้อมูลสำหรับบทที่ 3</b>
              <button type="button" onClick={() => copyResearchText("method")}>{copiedResearchText === "method" ? "คัดลอกแล้ว" : "คัดลอก"}</button>
            </div>
            <p className="pre-line-report">{methodologyText}</p>
          </article>
          <article>
            <div className="report-head">
              <b>ข้อจำกัดของงานวิจัย</b>
              <button type="button" onClick={() => copyResearchText("limitations")}>{copiedResearchText === "limitations" ? "คัดลอกแล้ว" : "คัดลอก"}</button>
            </div>
            <p>{limitationsText}</p>
          </article>
        </div>
      </section>

      <details className="panel method-guide">
        <summary>คำอธิบายวิธีเลือก t-test, Wilcoxon และ Sign Test</summary>
        <div className="method-guide-grid">
          <article>
            <b>t-test</b>
            <p>ทดสอบค่าเฉลี่ย เหมาะกับข้อมูลเชิงปริมาณที่ผลต่างใกล้ปกติและไม่มีค่าผิดปกติรุนแรง</p>
          </article>
          <article>
            <b>Wilcoxon signed-rank</b>
            <p>ทดสอบตำแหน่งกึ่งกลางด้วยอันดับ เหมาะเมื่อไม่ปกติแต่ผลต่างยังค่อนข้างสมมาตร</p>
          </article>
          <article>
            <b>Sign Test</b>
            <p>ทดสอบมัธยฐานด้วยจำนวนค่าที่สูงกว่า/ต่ำกว่าเกณฑ์ เหมาะเมื่อผลต่างเบ้มากหรือไม่สมมาตร</p>
          </article>
        </div>
      </details>
    </Page>
  );
}

function EfficiencyView({
  imported,
  initial,
  onChange,
  editable,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  editable: boolean;
}) {
  const importedPairs =
    imported?.rows
      .map((row) => row.map(Number).filter(Number.isFinite))
      .filter((row) => row.length >= 2) ?? [];
  const [process, setProcess] = useState(
      typeof initial?.process === "string"
        ? initial.process
        : importedPairs.length
          ? importedPairs.map((row) => row[0]).join(", ")
          : "72, 68, 75, 70, 74",
    ),
    [post, setPost] = useState(
      typeof initial?.post === "string"
        ? initial.post
        : importedPairs.length
          ? importedPairs.map((row) => row[1]).join(", ")
          : "25, 26, 24, 27, 28",
    ),
    [pmax, setPmax] = useState(Number(initial?.pmax ?? 80)),
    [tmax, setTmax] = useState(Number(initial?.tmax ?? 30));
  const result = calculateE1E2(
    parseNumbers(process),
    pmax,
    parseNumbers(post),
    tmax,
  );
  useEffect(() => {
    onChange({ process, post, pmax, tmax }, (result ?? {}) as WorkspaceData);
  }, [process, post, pmax, tmax]);
  return (
    <Page
      title="ประสิทธิภาพนวัตกรรม E1/E2"
      subtitle="คำนวณประสิทธิภาพกระบวนการและผลลัพธ์"
      badge="กำหนดเกณฑ์ได้"
    >
      <section className="panel two-text">
        <label>
          คะแนนระหว่างเรียนของแต่ละคน
          <textarea
            disabled={!editable}
            rows={6}
            value={process}
            onChange={(e) => setProcess(e.target.value)}
          />
          <span>
            คะแนนเต็ม{" "}
            <input
              disabled={!editable}
              type="number"
              value={pmax}
              onChange={(e) => setPmax(+e.target.value)}
            />
          </span>
        </label>
        <label>
          คะแนนหลังเรียนของแต่ละคน
          <textarea
            disabled={!editable}
            rows={6}
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
          <span>
            คะแนนเต็ม{" "}
            <input
              disabled={!editable}
              type="number"
              value={tmax}
              onChange={(e) => setTmax(+e.target.value)}
            />
          </span>
        </label>
      </section>
      <div className="metrics">
        <Metric label="E1" value={`${fmt(result?.e1, 2)}%`} tone="blue" />
        <Metric label="E2" value={`${fmt(result?.e2, 2)}%`} tone="green" />
        <Metric
          label="รายงานผล"
          value={result ? `${fmt(result.e1, 2)}/${fmt(result.e2, 2)}` : "—"}
          tone="violet"
        />
      </div>
      <Formula source="ชัยยงค์ พรหมวงศ์: แนวคิดการทดสอบประสิทธิภาพสื่อหรือชุดการสอน">
        E1 = (ΣX/N)/A × 100 และ E2 = (ΣF/N)/B × 100
      </Formula>
    </Page>
  );
}

function ReferencesView() {
  const refs = [
    [
      "IOC",
      "Rovinelli & Hambleton",
      "ความสอดคล้องระหว่างข้อคำถามกับวัตถุประสงค์",
    ],
    [
      "สถิติพรรณนา",
      "บุญชม ศรีสะอาด",
      "ค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน และการใช้สถิติในการวิจัย",
    ],
    [
      "คุณภาพเครื่องมือ",
      "พิชิต ฤทธิ์จรูญ",
      "การสร้างและตรวจสอบเครื่องมือวัดและประเมินผล",
    ],
    ["KR-20", "Kuder & Richardson (1937)", "ความเชื่อมั่นของแบบทดสอบสองค่า"],
    ["Cronbach’s alpha", "Cronbach (1951)", "ความสอดคล้องภายในของมาตรวัด"],
    [
      "Wilcoxon signed-rank",
      "Wilcoxon (1945)",
      "เปรียบเทียบข้อมูลเป็นคู่หรือค่ามัธยฐานกับเกณฑ์โดยใช้อันดับของผลต่าง",
    ],
    [
      "Shapiro–Wilk",
      "Shapiro & Wilk (1965); Royston AS R94",
      "ตรวจการแจกแจงปกติของผลต่าง โดยใช้ร่วมกับ Q–Q plot ความสมมาตร และค่าผิดปกติ",
    ],
    [
      "Sign Test",
      "Exact binomial test (p = .50)",
      "ทดสอบมัธยฐานจากจำนวนผลต่างด้านบวกและด้านลบ โดยไม่สมมติความสมมาตร",
    ],
    [
      "Exact signed-rank",
      "Conditional sign permutation",
      "คำนวณการแจกแจงผลรวมอันดับจากเครื่องหมายที่เป็นไปได้ทั้งหมด รองรับอันดับซ้ำหลังตัดผลต่างศูนย์",
    ],
    ["Effect size", "Cohen (1988)", "ขนาดอิทธิพลของความแตกต่าง"],
    ["E1/E2", "ชัยยงค์ พรหมวงศ์", "ประสิทธิภาพกระบวนการและผลลัพธ์ของสื่อ"],
  ];
  return (
    <Page
      title="สูตรและเอกสารอ้างอิง"
      subtitle="แสดงที่มาของวิธีคำนวณเพื่อให้ตรวจสอบและเขียนรายงานได้ถูกต้อง"
      badge="โปร่งใส ตรวจสอบได้"
    >
      <section className="panel ref-list">
        {refs.map(([name, author, desc]) => (
          <article key={name}>
            <div className="ref-mark">{name.slice(0, 2)}</div>
            <div>
              <h3>{name}</h3>
              <b>{author}</b>
              <p>{desc}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="panel verification-record">
        <div className="panel-head">
          <div>
            <span className="eyebrow">บันทึกการตรวจสอบรุ่นคำนวณ 3.0</span>
            <h3>ตรวจเทียบผลกับชุดคำนวณอ้างอิง</h3>
            <p>ตรวจเมื่อ 15 สิงหาคม 2569 การผ่านการทดสอบยืนยันความสอดคล้องของสูตรในกรณีที่ตรวจ แต่ไม่แทนการพิจารณาข้อตกลงทางสถิติของผู้วิจัย</p>
          </div>
        </div>
        <div className="metrics compact">
          <Metric label="Unit tests" value="13 / 13 ผ่าน" tone="green" />
          <Metric label="Shapiro–Wilk เทียบ SciPy" value="180 ชุด" />
          <Metric label="t / Wilcoxon / Sign" value="270 ชุด" />
          <Metric label="ผลต่าง Wilcoxon สูงสุด" value="0" tone="green" />
        </div>
        <p className="verification-note">Shapiro–Wilk: คลาดเคลื่อน W สูงสุด 5.40×10⁻¹⁰ และ p สูงสุด 7.36×10⁻⁸ · t-test: p สูงสุด 1.89×10⁻¹⁵ · Sign Test: p สูงสุด 5.11×10⁻¹⁵ · Wilcoxon ที่มี ties/zeros ตรวจเทียบกับ exact permutation และตรวจ Normal approximation เพิ่มอีก 90 ชุด</p>
      </section>
      <div className="notice">
        <b>ข้อควรระวังทางวิชาการ</b>
        <p>
          ชื่อผู้แต่งไม่ได้หมายความว่าสูตรมาตรฐานเป็นกรรมสิทธิ์ของผู้แต่งรายนั้น
          ควรอ้างอิงหนังสือ ฉบับพิมพ์ และเลขหน้าที่ผู้วิจัยใช้จริง แอปจะจัดทำ
          “บันทึกวิธีวิเคราะห์” ให้แนบในภาคผนวกได้ในรุ่นส่งออกรายงาน
        </p>
      </div>
    </Page>
  );
}

function HomeView({ open }: { open: (view: View) => void }) {
  const cards = NAV.filter((n) => !["home", "references"].includes(n.id));
  return (
    <Page
      title="เลือกการวิเคราะห์"
      subtitle="เครื่องมือสถิติสำหรับงานวิจัยทางการศึกษา พร้อมสูตร เกณฑ์ และข้อมูลตรวจสอบ"
      badge="Research Toolkit"
    >
      <section className="hero-card">
        <div>
          <span className="eyebrow">โครงการปัจจุบัน</span>
          <h2>มาตราตัวสะกด ชั้นประถมศึกษาปีที่ 2</h2>
          <p>
            เริ่มจากเลือกประเภทการวิเคราะห์
            ระบบจะแสดงผลพร้อมสูตรและข้อมูลสำหรับตรวจสอบย้อนกลับ
          </p>
        </div>
        <div className="hero-stat">
          <strong>7</strong>
          <span>เครื่องมือพร้อมใช้</span>
        </div>
      </section>
      <div className="tool-grid">
        {cards.map((card, i) => (
          <button
            className="tool-card"
            key={card.id}
            onClick={() => open(card.id)}
          >
            <span className={`tool-icon c${i % 4}`}>{card.icon}</span>
            <div>
              <h3>{card.label}</h3>
              <p>{toolDescription(card.id)}</p>
              <small>เปิดเครื่องมือ →</small>
            </div>
          </button>
        ))}
      </div>
    </Page>
  );
}

function toolDescription(id: View) {
  return (
    (
      {
        ioc: "ตรวจความสอดคล้องรายข้อจากผู้เชี่ยวชาญ",
        descriptive: "สรุปแนวโน้มและการกระจายของข้อมูล",
        quality: "แปลผลแบบประเมินมาตราส่วน 5 ระดับ",
        item: "วิเคราะห์คุณภาพข้อสอบรายข้อ",
        reliability: "คำนวณ α และ KR-20",
        paired: "เปรียบเทียบก่อน–หลังเรียนและหลังเรียนกับเกณฑ์",
        efficiency: "ประเมินประสิทธิภาพนวัตกรรม",
      } as Partial<Record<View, string>>
    )[id] ?? ""
  );
}

function Page({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="breadcrumb">
            ระบบวิเคราะห์ <span>/</span> {title}
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <span className="status-badge">
          <i />
          {badge}
        </span>
      </header>
      {children}
    </>
  );
}

function flattenRows(rows: unknown[][]) {
  return rows
    .flatMap((row) =>
      row.map((cell) => String(cell ?? "").trim()).filter(Boolean),
    )
    .join(", ");
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "ResearchStat";
}
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const DOCX_JS_URL = "https://cdn.jsdelivr.net/npm/docx@9.5.1/+esm";
const JSPDF_JS_URL = "https://cdn.jsdelivr.net/npm/jspdf@3.0.3/+esm";

function createIocCanvas(
  title: string,
  experts: string[],
  rows: Array<Array<number | null>>,
  results: ReturnType<typeof calculateIoc>,
) {
  const columns = ["ข้อ", ...experts, "∑R", "IOC", "ผล"];
  const widths = [70, ...experts.map(() => 145), 80, 90, 120];
  const width = widths.reduce((sum, value) => sum + value, 0);
  const rowHeight = 48;
  const top = 150;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(900, width + 80);
  canvas.height = top + (rows.length + 1) * rowHeight + 80;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#17213a";
  context.font = "bold 26px Tahoma, sans-serif";
  context.fillText("ตารางสรุปผลการตรวจสอบความตรงเชิงเนื้อหา (IOC)", 40, 48);
  context.font = "18px Tahoma, sans-serif";
  context.fillText(title, 40, 82);
  context.font = "14px Tahoma, sans-serif";
  context.fillStyle = "#65708a";
  context.fillText(
    `จำนวน ${rows.length} ข้อ · ผู้เชี่ยวชาญ ${experts.length} คน · สร้างโดย ResearchStat`,
    40,
    112,
  );
  let x = 40;
  context.textAlign = "center";
  context.textBaseline = "middle";
  columns.forEach((label, index) => {
    context.fillStyle = "#eaf0ff";
    context.fillRect(x, top, widths[index], rowHeight);
    context.strokeStyle = "#72809f";
    context.strokeRect(x, top, widths[index], rowHeight);
    context.fillStyle = "#24314f";
    context.font = "bold 14px Tahoma, sans-serif";
    context.fillText(label, x + widths[index] / 2, top + rowHeight / 2);
    x += widths[index];
  });
  rows.forEach((row, rowIndex) => {
    let cellX = 40;
    const values = [
      rowIndex + 1,
      ...row.map((value) =>
        value === null ? "—" : value === 1 ? "+1" : String(value),
      ),
      results[rowIndex].sum,
      results[rowIndex].ioc?.toFixed(2) ?? "—",
      results[rowIndex].ioc === null
        ? "รอคะแนน"
        : results[rowIndex].passed
          ? "ใช้ได้"
          : "ปรับปรุง",
    ];
    values.forEach((value, index) => {
      const y = top + (rowIndex + 1) * rowHeight;
      context.fillStyle = rowIndex % 2 ? "#f8faff" : "white";
      context.fillRect(cellX, y, widths[index], rowHeight);
      context.strokeStyle = "#aab3c7";
      context.strokeRect(cellX, y, widths[index], rowHeight);
      context.fillStyle = "#17213a";
      context.font = "14px Tahoma, sans-serif";
      context.fillText(
        String(value),
        cellX + widths[index] / 2,
        y + rowHeight / 2,
      );
      cellX += widths[index];
    });
  });
  return canvas;
}
function exportIocPng(
  title: string,
  experts: string[],
  rows: Array<Array<number | null>>,
  results: ReturnType<typeof calculateIoc>,
) {
  const canvas = createIocCanvas(title, experts, rows, results);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (blob) downloadFile(blob, `${safeFilename(title)}.png`);
  }, "image/png");
}

function ExportIcon({ format }: { format: string }) {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path d="M8 3h14l7 7v23H8z" />
      <path className="fold" d="M22 3v8h7" />
      <text x="18" y="25" textAnchor="middle">
        {format}
      </text>
    </svg>
  );
}

function ImportedDataPanel({
  data,
  view,
}: {
  data: ImportedProjectData;
  view: View;
}) {
  const needsIocVerification =
    view === "ioc" &&
    Boolean(
      data.warning?.includes("OCR") ||
      data.ocrItems?.length ||
      data.iocRatings?.length,
    );
  const items = data.ocrItems ?? [];
  const foundItems = items.filter(
    (item) => item.numberStatus !== "ไม่พบเลขข้อ",
  );
  const uniqueItems = [...new Set(foundItems.map((item) => item.item))].sort(
    (a, b) => a - b,
  );
  const missing = items
    .filter((item) => item.numberStatus === "ไม่พบเลขข้อ")
    .map((item) => item.item);
  const range = data.sourceRange
    ? `${data.sourceRange.unit} ${data.sourceRange.from}–${data.sourceRange.to}`
    : data.rangeLabel;
  return (
    <section className="panel imported-data">
      <div className="panel-head">
        <div>
          <span className="step-label">ผลตรวจสอบการนำเข้า</span>
          <h3>{data.workTitle}</h3>
          <p>
            {data.sourceName} · {range} · กำหนดไว้{" "}
            {data.expectedItemCount ?? items.length} ข้อ
          </p>
        </div>
      </div>
      {data.warning && <div className="import-warning">{data.warning}</div>}
      {items.length ? (
        <>
          <div className="ocr-summary">
            <article>
              <span>ช่วงที่ค้นหา</span>
              <b>{range}</b>
            </article>
            <article>
              <span>จำนวนข้อที่กำหนด</span>
              <b>{data.expectedItemCount ?? items.length} ข้อ</b>
            </article>
            <article>
              <span>พบ/นับแถวข้อ</span>
              <b>
                {uniqueItems.length}/{data.expectedItemCount ?? items.length}
              </b>
            </article>
            <article>
              <span>อ่านคะแนนได้</span>
              <b>
                {items.filter((item) => item.rating !== null).length}/
                {data.expectedItemCount ?? items.length}
              </b>
            </article>
          </div>
          {missing.length > 0 && (
            <div className="import-error">
              ไม่พบเลขข้อ: {missing.join(", ")}
            </div>
          )}
          <div className="table-wrap ocr-item-table">
            <table>
              <thead>
                <tr>
                  <th>ข้อ</th>
                  <th>{data.sourceRange?.unit === "แถว" ? "แถว" : "หน้า"}</th>
                  <th>ผลค้นหาเลขข้อ</th>
                  <th>รายละเอียดที่ OCR อ่านได้</th>
                  <th>คะแนน</th>
                </tr>
              </thead>
              <tbody>
                {[...items]
                  .sort((a, b) => a.item - b.item)
                  .map((item, index) => (
                    <tr
                      key={`${item.item}-${index}`}
                      className={
                        item.numberStatus === "ไม่พบเลขข้อ"
                          ? "ocr-missing-row"
                          : ""
                      }
                    >
                      <td>
                        <b>{item.item}</b>
                      </td>
                      <td>{item.page ?? "—"}</td>
                      <td>
                        <span
                          className={
                            item.numberStatus === "ไม่พบเลขข้อ"
                              ? "ocr-number missing"
                              : "ocr-number found"
                          }
                        >
                          {item.numberStatus ?? "พบเลขข้อ"}
                        </span>
                      </td>
                      <td>{item.details || "— อ่านรายละเอียดไม่ชัด —"}</td>
                      <td>
                        <span
                          className={
                            item.rating === null
                              ? "ocr-score pending"
                              : "ocr-score found"
                          }
                        >
                          {item.rating === null
                            ? "ไม่พบ"
                            : item.rating === 1
                              ? "+1"
                              : item.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="table-wrap">
          <table>
            <tbody>
              {data.rows.slice(0, 20).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>{rowIndex + 1}</td>
                  {row.slice(0, 12).map((cell, cellIndex) => (
                    <td key={cellIndex}>{String(cell ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="data-note">
        {needsIocVerification
          ? `ระบบตรวจทีละหน้า โดยใช้คอลัมน์แรกเป็นเลขข้อและตรวจตำแหน่งรอยปากกาในช่อง +1, 0 และ -1 กรุณาตรวจรายการที่ระบุว่า “นับจากแถวตาราง” หรือ “ไม่พบเลขข้อ”`
          : `นำเข้าจาก ${range} จำนวน ${data.rows.length} รายการ คุณสามารถตรวจและแก้ไขก่อนคำนวณได้`}
      </p>
    </section>
  );
}

export default function ResearchStatsApp({
  project,
  initialAnalysisId,
  onBack,
}: {
  project: ResearchProject;
  initialAnalysisId?: string | null;
  onBack?: () => void;
}) {
  const [view, setView] = useState<View>("home");
  const [menu, setMenu] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [imported, setImported] = useState<ImportedProjectData | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisRecord | null>(
    null,
  );
  const [analysisTitle, setAnalysisTitle] = useState("");
  const [workspaceInitial, setWorkspaceInitial] = useState<WorkspaceData>({});
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceData>({});
  const [workspaceResult, setWorkspaceResult] = useState<WorkspaceData>({});
  const [revision, setRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [editingSaved, setEditingSaved] = useState(false);
  const isTool = !["home", "references"].includes(view);
  const analysisLocked = Boolean(activeAnalysis) && !editingSaved;
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase
      .from("research_analyses")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const loaded = (data ?? []) as AnalysisRecord[];
        setAnalyses(loaded);
        const requested = loaded.find(
          (analysis) => analysis.id === initialAnalysisId,
        );
        if (requested) {
          setView(requested.analysis_type);
          setActiveAnalysis(requested);
          setAnalysisTitle(requested.title);
          setWorkspaceInitial(requested.input_json?.workspace ?? {});
          setWorkspaceDraft(requested.input_json?.workspace ?? {});
          setWorkspaceResult(requested.result_json ?? {});
          setImported(requested.input_json?.source ?? null);
          setRevision((value) => value + 1);
          setSaveStatus("เปิดงานเดิมแล้ว · ล็อกการแก้ไข");
          setEditingSaved(false);
        }
      });
  }, [project.id, initialAnalysisId]);
  const handleDraft = useCallback(
    (data: WorkspaceData, result: WorkspaceData) => {
      if (analysisLocked) return;
      setWorkspaceDraft(data);
      setWorkspaceResult(result);
      setSaveStatus("");
    },
    [analysisLocked],
  );
  const startNew = useCallback(
    (nextView = view) => {
      const label =
        NAV.find((item) => item.id === nextView)?.label ?? "งานวิเคราะห์";
      setActiveAnalysis(null);
      setAnalysisTitle(`${label} – งานใหม่`);
      setWorkspaceInitial({});
      setWorkspaceDraft({});
      setWorkspaceResult({});
      setImported(null);
      setRevision((value) => value + 1);
      setShowLibrary(false);
      setSaveStatus("");
      setEditingSaved(true);
    },
    [view],
  );
  const openAnalysis = (analysis: AnalysisRecord) => {
    setActiveAnalysis(analysis);
    setAnalysisTitle(analysis.title);
    setWorkspaceInitial(analysis.input_json?.workspace ?? {});
    setWorkspaceDraft(analysis.input_json?.workspace ?? {});
    setWorkspaceResult(analysis.result_json ?? {});
    setImported(analysis.input_json?.source ?? null);
    setRevision((value) => value + 1);
    setShowLibrary(false);
    setSaveStatus("เปิดงานเดิมแล้ว · ล็อกการแก้ไข");
    setEditingSaved(false);
  };
  const chooseView = (nextView: View) => {
    setView(nextView);
    setMenu(false);
    if (!["home", "references"].includes(nextView)) {
      setShowLibrary(true);
      setActiveAnalysis(null);
      setEditingSaved(true);
      setWorkspaceInitial({});
      setImported(null);
    }
  };
  const saveAnalysis = async () => {
    if (analysisLocked) {
      setSaveStatus("เปิดสวิตช์แก้ไขก่อนบันทึก");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSaveStatus("ไม่พบการเชื่อมต่อ Supabase");
      return;
    }
    setSaveStatus("กำลังบันทึก…");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaveStatus("กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    const payload = {
      project_id: project.id,
      owner_id: auth.user.id,
      analysis_type: view,
      title:
        analysisTitle.trim() ||
        `${NAV.find((item) => item.id === view)?.label} – งานวิเคราะห์`,
      input_json: { workspace: workspaceDraft, source: imported },
      result_json: workspaceResult,
    };
    if (activeAnalysis) {
      const { data, error } = await supabase
        .from("research_analyses")
        .update(payload)
        .eq("id", activeAnalysis.id)
        .select()
        .single();
      if (error || !data) {
        setSaveStatus(error?.message || "บันทึกไม่สำเร็จ");
        return;
      }
      const saved = data as AnalysisRecord;
      setActiveAnalysis(saved);
      setAnalyses((items) =>
        items.map((item) => (item.id === saved.id ? saved : item)),
      );
    } else {
      const { data, error } = await supabase
        .from("research_analyses")
        .insert(payload)
        .select()
        .single();
      if (error || !data) {
        setSaveStatus(error?.message || "บันทึกไม่สำเร็จ");
        return;
      }
      const saved = data as AnalysisRecord;
      setActiveAnalysis(saved);
      setAnalyses((items) => [saved, ...items]);
    }
    setWorkspaceInitial(workspaceDraft);
    setSaveStatus("บันทึกแล้ว · ล็อกการแก้ไข");
    setEditingSaved(false);
  };
  const dataKey = `${revision}-${imported?.id ?? 0}`;
  const currentTool =
    NAV.find((item) => item.id === view)?.label ?? "งานวิเคราะห์";
  const toolContent = (
    {
      ioc: (
        <IocView
          key={`ioc-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          title={analysisTitle}
          editable={!analysisLocked}
        />
      ),
      descriptive: (
        <DescriptiveView
          key={`descriptive-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          editable={!analysisLocked}
        />
      ),
      quality: (
        <DescriptiveView
          key={`quality-${dataKey}`}
          quality
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          editable={!analysisLocked}
        />
      ),
      item: (
        <ItemView
          key={`item-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          editable={!analysisLocked}
        />
      ),
      reliability: (
        <ReliabilityView
          key={`reliability-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          editable={!analysisLocked}
        />
      ),
      paired: (
        <PairedView
          key={`paired-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          editable={!analysisLocked}
        />
      ),
      efficiency: (
        <EfficiencyView
          key={`efficiency-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          editable={!analysisLocked}
        />
      ),
    } as Partial<Record<View, React.ReactNode>>
  )[view];
  const content =
    view === "home" ? (
      <HomeView open={chooseView} />
    ) : view === "references" ? (
      <ReferencesView />
    ) : (
      toolContent
    );
  const toolAnalyses = analyses.filter(
    (analysis) => analysis.analysis_type === view,
  );
  const latestSavedAnalysis = toolAnalyses[0] ?? null;
  const displayedFileName =
    activeAnalysis?.title ||
    latestSavedAnalysis?.title ||
    imported?.workTitle ||
    imported?.sourceName ||
    "ยังไม่มีชื่อจากการถอดความ";
  const displayedFileLabel =
    activeAnalysis || latestSavedAnalysis
      ? "ไฟล์ล่าสุดที่บันทึก"
      : "ชื่อจากการถอดความ";
  return (
    <div className="app-shell" lang="th">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <b>
              Research<span>Stat</span>
            </b>
            <small>สถิติงานวิจัยการศึกษา</small>
          </div>
        </div>
        {onBack && (
          <button className="back-project" onClick={onBack}>
            ← กลับไปที่โครงการ
          </button>
        )}
        <nav>
          {NAV.map((item) => (
            <div key={item.id}>
              {item.group && <div className="nav-group">{item.group}</div>}
              <button
                className={view === item.id ? "active" : ""}
                onClick={() => chooseView(item.id)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </nav>
        <div className="privacy">
          <b>ข้อมูลของคุณเป็นส่วนตัว</b>
          <p>รุ่นนี้ประมวลผลคะแนนในอุปกรณ์ ไม่ส่งข้อมูลดิบออกไป</p>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setMenu(!menu)}>
            ☰
          </button>
          <div className="project">
            <span>โครงการ</span>
            <b>{project.title}</b>
          </div>
          <div className="top-actions">
            {isTool && (
              <>
                <button
                  className="import-project-button"
                  onClick={() => startNew()}
                >
                  ＋ สร้างไฟล์ใหม่
                </button>
                <button
                  className="import-project-button"
                  onClick={() => setShowLibrary(true)}
                >
                  ▤ เปิดรายการเดิม
                </button>
                <button
                  className="import-project-button"
                  disabled={analysisLocked}
                  onClick={() => setShowImporter(true)}
                  title={analysisLocked ? "เปิดสวิตช์แก้ไขก่อนนำเข้าข้อมูลใหม่" : undefined}
                >
                  ↥ นำเข้าจากไฟล์
                </button>
              </>
            )}
              <span className="version-chip">รุ่นคำนวณ 3.0</span>
            <span className="avatar">พ</span>
          </div>
        </div>
        <div className="content">
          {isTool && (
            <section className="analysis-filebar">
              <input
                disabled={analysisLocked}
                value={analysisTitle}
                onChange={(event) => {
                  setAnalysisTitle(event.target.value);
                  setSaveStatus("");
                }}
                placeholder="ชื่องานวิเคราะห์"
              />
              <button disabled={analysisLocked} onClick={() => void saveAnalysis()}>
                บันทึกงาน
              </button>
              {activeAnalysis && (
                <label className="edit-switch">
                  <input
                    type="checkbox"
                    checked={editingSaved}
                    onChange={(event) => {
                      setEditingSaved(event.target.checked);
                      setSaveStatus(
                        event.target.checked
                          ? "เปิดให้แก้ไขแล้ว"
                          : "ล็อกการแก้ไขแล้ว",
                      );
                    }}
                  />
                  <span aria-hidden="true" />
                  <b>{editingSaved ? "กำลังแก้ไข" : "เปิดสวิตช์เพื่อแก้ไข"}</b>
                </label>
              )}
              {analysisLocked && (
                <span className="analysis-lock-status">🔒 บันทึกแล้วและล็อกอยู่</span>
              )}
              <span className="filebar-current">
                {displayedFileLabel}: <b>{displayedFileName}</b>
              </span>
              {saveStatus && <span>{saveStatus}</span>}
            </section>
          )}
          {imported && isTool && (
            <ImportedDataPanel data={imported} view={view} />
          )}{" "}
          {content}
        </div>
        <footer>
          <span>
            ResearchStat · เครื่องมือช่วยคำนวณ
            ไม่แทนการพิจารณาของนักวิจัยและอาจารย์ที่ปรึกษา
          </span>
          <b>ผู้จัดทำระบบ: ครูไพรัช อินควรชุม</b>
          <span>โรงเรียนเทศบาล 1 ถนนนครนอก · เทศบาลนครสงขลา</span>
        </footer>
      </main>
      {showLibrary && isTool && (
        <div className="modal-backdrop">
          <section className="small-modal analysis-library">
            <header>
              <div>
                <span className="step-label">ANALYSIS FILES</span>
                <h2>{currentTool}</h2>
                <p>เริ่มงานใหม่หรือเปิดงานเดิมเพื่อแก้ไขต่อ</p>
              </div>
              <button
                className="close-button"
                onClick={() => setShowLibrary(false)}
              >
                ×
              </button>
            </header>
            <button className="new-analysis-card" onClick={() => startNew()}>
              ＋
              <span>
                <b>สร้างไฟล์ใหม่</b>
                <small>
                  เริ่มแบบฟอร์มใหม่ โดย IOC เริ่มต้นผู้เชี่ยวชาญ 3 คน
                </small>
              </span>
            </button>
            <h3>รายการเดิม ({toolAnalyses.length})</h3>
            <div className="analysis-list">
              {toolAnalyses.length ? (
                toolAnalyses.map((analysis) => (
                  <button
                    key={analysis.id}
                    onClick={() => openAnalysis(analysis)}
                  >
                    <span>
                      <b>{analysis.title}</b>
                      <small>
                        {new Date(analysis.created_at).toLocaleString("th-TH")}
                      </small>
                    </span>
                    <i>เปิด →</i>
                  </button>
                ))
              ) : (
                <div className="source-empty">
                  ยังไม่มีงานเดิมในเครื่องมือนี้
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {menu && (
        <button
          className="overlay"
          aria-label="ปิดเมนู"
          onClick={() => setMenu(false)}
        />
      )}
      <ProjectDataImporter
        project={project}
        analysisType={view}
        suggestedTitle={analysisTitle || `${currentTool} – งานที่ 1`}
        open={showImporter}
        onClose={() => setShowImporter(false)}
        onImport={(data) => {
          if (analysisLocked) return;
          setWorkspaceInitial(view === "ioc" ? workspaceDraft : {});
          setImported(data);
          setAnalysisTitle(data.workTitle);
          setRevision((value) => value + 1);
          setShowImporter(false);
        }}
      />
    </div>
  );
}
