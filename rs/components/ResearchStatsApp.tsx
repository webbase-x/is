"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectDataImporter, {
  type ImportedProjectData,
} from "./ProjectDataImporter";
import { getSupabaseClient } from "../lib/supabase/client";
import type { ResearchProject } from "../lib/supabase/types";
import {
  analyzeTestMatrix,
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
  testGroupPercentages,
  threeLevelSatisfactionBands,
  traditionalFiveLevelBands,
  type AlternativeHypothesis,
  type ComparisonTest,
  type NormalityAssessment,
  type OneSampleTResult,
  type PairedResult,
  type SignTestResult,
  type TestGroupPercentage,
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
  | "individual"
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
    label: "คุณภาพแบบทดสอบ (p, r, KR-20)",
    icon: "Pα",
    group: "คุณภาพแบบทดสอบ",
  },
  {
    id: "reliability",
    label: "ความเชื่อมั่นแบบสอบถาม (α)",
    icon: "α",
    group: "คุณภาพแบบสอบถาม",
  },
  {
    id: "paired",
    label: "ก่อนเรียน–หลังเรียน",
    icon: "t",
    group: "ทดสอบสมมติฐาน",
  },
  { id: "efficiency", label: "ประสิทธิภาพ E1/E2", icon: "%" },
  {
    id: "individual",
    label: "รายบุคคลและแผนภูมิพัฒนาการ",
    icon: "↗",
    group: "รายงานผล",
  },
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

type ExportCell = string | number | null | undefined;

function ResultExportToolbar({
  title,
  sheetName,
  rows,
}: {
  title: string;
  sheetName: string;
  rows: ExportCell[][];
}) {
  const [copied, setCopied] = useState(false);
  const filename = safeFilename(title);
  const copyResults = async () => {
    const text = [
      title,
      ...rows.map((row) => row.map((cell) => String(cell ?? "")).join("\t")),
    ].join("\n");
    const success = await copyToClipboard(text);
    setCopied(success);
    if (success) window.setTimeout(() => setCopied(false), 1800);
  };
  const exportCsv = () => {
    const lines = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    downloadFile(
      new Blob(["\ufeff", lines], { type: "text/csv;charset=utf-8" }),
      `${filename}.csv`,
    );
  };
  const exportXlsx = async () => {
    const xlsx = await import("xlsx");
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
    xlsx.writeFile(workbook, `${filename}.xlsx`);
  };
  const exportDocx = async () => {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } =
      await import(/* @vite-ignore */ DOCX_JS_URL);
    const table = new Table({
      rows: rows.map(
        (row, rowIndex) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: String(cell ?? ""),
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
                  text: title,
                  bold: true,
                  noProof: true,
                  font: "TH Sarabun New",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `ตารางผลวิเคราะห์: ${sheetName}`,
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
    downloadFile(await Packer.toBlob(document), `${filename}.docx`);
  };
  const exportPdf = async () => {
    const canvas = createResultCanvas(title, rows);
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
    pdf.save(`${filename}.pdf`);
  };
  const exportPng = () => {
    const canvas = createResultCanvas(title, rows);
    canvas?.toBlob((blob) => {
      if (blob) downloadFile(blob, `${filename}.png`);
    }, "image/png");
  };
  return (
    <div className="ioc-export-group result-export-toolbar">
      <span className="ioc-group-label">ส่งออกและคัดลอกผล</span>
      <div className="export-icons" aria-label={`ส่งออกผล ${sheetName}`}>
        <button className="export-icon copy" onClick={() => void copyResults()} title="คัดลอกผลไปยังคลิปบอร์ด" aria-label="คัดลอกผล">
          <CopyIcon />
          <span>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
        </button>
        <button className="export-icon csv" onClick={exportCsv} title="ส่งออก CSV" aria-label="ส่งออก CSV">
          <ExportIcon format="C" />
          <span>CSV</span>
        </button>
        <button className="export-icon xlsx" onClick={() => void exportXlsx()} title="ส่งออก XLSX" aria-label="ส่งออก XLSX">
          <ExportIcon format="X" />
          <span>XLSX</span>
        </button>
        <button className="export-icon docx" onClick={() => void exportDocx()} title="ส่งออก DOCX" aria-label="ส่งออก DOCX">
          <ExportIcon format="W" />
          <span>DOCX</span>
        </button>
        <button className="export-icon pdf" onClick={() => void exportPdf()} title="ส่งออก PDF" aria-label="ส่งออก PDF">
          <ExportIcon format="PDF" />
          <span>PDF</span>
        </button>
        <button className="export-icon image" onClick={exportPng} title="บันทึกเป็นรูป PNG" aria-label="บันทึกเป็นรูป PNG">
          <ExportIcon format="▧" />
          <span>PNG</span>
        </button>
      </div>
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
            <ResultExportToolbar
              title={title || "ผลการวิเคราะห์ IOC"}
              sheetName="IOC"
              rows={exportRows()}
            />
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

function parseRatingMatrix(text: string, scaleLevels: 3 | 5) {
  const rawRows = text
    .split(/\r?\n/)
    .map((line) => parseNumbers(line))
    .filter((row) => row.length > 0);
  const hasRowNumbers =
    rawRows.length > 1 &&
    rawRows.every((row, index) => row.length > 1 && row[0] === index + 1);
  const ratingRows = rawRows
    .map((row) => (hasRowNumbers ? row.slice(1) : row))
    .map((row) => {
      let scores: number[] = [];
      let current: number[] = [];
      for (const value of row) {
        if (Number.isInteger(value) && value >= 1 && value <= scaleLevels) {
          current.push(value);
          if (current.length > scores.length) scores = [...current];
        } else {
          current = [];
        }
      }
      return scores;
    })
    .filter((row) => row.length > 0);
  const widthCounts = new Map<number, number>();
  ratingRows.forEach((row) =>
    widthCounts.set(row.length, (widthCounts.get(row.length) ?? 0) + 1),
  );
  const itemCount = [...widthCounts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0],
  )[0]?.[0] ?? 0;
  return {
    matrix: ratingRows
      .filter((row) => row.length >= itemCount)
      .map((row) => row.slice(row.length - itemCount)),
    sourceRowCount: rawRows.length,
    invalidRowCount: rawRows.length - ratingRows.filter((row) => row.length >= itemCount).length,
    removedRowNumbers: hasRowNumbers,
  };
}

function DescriptiveView({
  quality = false,
  imported,
  initial,
  onChange,
  title,
  editable,
  respondentLabel = "นักเรียน",
  measureLabel = "ความพึงพอใจ",
  qualityControls,
}: {
  quality?: boolean;
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  title: string;
  editable: boolean;
  respondentLabel?: string;
  measureLabel?: string;
  qualityControls?: React.ReactNode;
}) {
  const [text, setText] = useState(
    typeof initial?.text === "string"
      ? initial.text
      : imported
        ? flattenRows(imported.rows)
        : quality
          ? "3,3,3,2,3\n3,3,3,3,3\n3,2,3,2,3\n2,2,2,2,2\n3,3,3,3,3"
          : "5, 5, 4, 4, 5, 4, 5, 3, 4, 5",
  );
  const [bandScheme, setBandScheme] = useState<"traditional" | "equal-width" | "custom">(
    initial?.bandScheme === "equal-width" || initial?.bandScheme === "custom"
      ? initial.bandScheme
      : "traditional",
  );
  const [scaleLevels, setScaleLevels] = useState<3 | 5>(
    Number(initial?.scaleLevels) === 3
      ? 3
      : Number(initial?.scaleLevels) === 5
        ? 5
        : quality
          ? 3
          : 5,
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
  const parsedRatings = parseRatingMatrix(text, scaleLevels);
  const ratingMatrix = quality ? parsedRatings.matrix : [];
  const values = quality ? ratingMatrix.flat() : parseNumbers(text);
  const respondentCount = quality ? ratingMatrix.length : values.length;
  const itemCount = quality ? (ratingMatrix[0]?.length ?? 0) : 1;
  const cronbach = quality && itemCount >= 2 ? cronbachAlpha(ratingMatrix) : null;
  const cronbachLevel =
    cronbach === null
      ? "คำนวณไม่ได้"
      : cronbach >= 0.9
        ? "สูงมาก"
        : cronbach >= 0.8
          ? "สูง"
          : cronbach >= 0.7
            ? "ยอมรับได้"
            : cronbach >= 0.6
              ? "ค่อนข้างต่ำ"
              : "ควรปรับปรุง";
  const avg = mean(values);
  const sd = sampleStandardDeviation(values);
  const medianValue = median(values);
  const interpretation = interpretQuality(avg, selectedBands);
  const itemResults = quality
    ? Array.from({ length: itemCount }, (_, itemIndex) => {
        const itemValues = ratingMatrix.map((row) => row[itemIndex]);
        const itemMean = mean(itemValues);
        return {
          item: itemIndex + 1,
          values: itemValues,
          mean: itemMean,
          sd: sampleStandardDeviation(itemValues),
          interpretation: interpretQuality(itemMean, selectedBands),
        };
      })
    : [];
  const respondentResults = quality
    ? ratingMatrix.map((row, index) => {
        const personMean = mean(row);
        return {
          respondent: index + 1,
          scores: row,
          total: row.reduce((sum, value) => sum + value, 0),
          mean: personMean,
          interpretation: interpretQuality(personMean, selectedBands),
        };
      })
    : [];
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
    short: `ผลการประเมิน${measureLabel}โดย${respondentLabel}อยู่ในระดับ${interpretation} (x̄ = ${fmt(avg)}, S.D. = ${fmt(sd)}, n = ${respondentCount})${cronbach === null ? "" : ` และมีค่าสัมประสิทธิ์แอลฟาของครอนบาคเท่ากับ ${fmt(cronbach, 2)} อยู่ในระดับ${cronbachLevel}`}`,
    detailed: `ผลการวิเคราะห์${measureLabel}จาก${respondentLabel}จำนวน ${respondentCount} คน จำนวน ${itemCount} ข้อ ด้วยสถิติเชิงพรรณนา พบว่า มีค่าเฉลี่ยเท่ากับ ${fmt(avg)} ส่วนเบี่ยงเบนมาตรฐานเท่ากับ ${fmt(sd)} มัธยฐานเท่ากับ ${fmt(medianValue)} และ IQR เท่ากับ ${fmt(iqr)} เมื่อแปลผลด้วย${schemeDescription} ผลการประเมินโดยรวมอยู่ในระดับ${interpretation}${criterionSource.trim() ? ` โดยอ้างอิงเกณฑ์จาก ${criterionSource.trim()}` : ""}${cronbach === null ? "" : ` แบบสอบถามมีค่าสัมประสิทธิ์แอลฟาของครอนบาคเท่ากับ ${fmt(cronbach, 2)} อยู่ในระดับ${cronbachLevel}`}`,
  };
  const exportRows: ExportCell[][] = quality
    ? [
        ["สรุปภาพรวม", "ผล"],
        ["จำนวนผู้ตอบ (n)", respondentCount],
        ["จำนวนข้อ", itemCount],
        ["สัมประสิทธิ์แอลฟาของครอนบาค (α)", fmt(cronbach, 2)],
        ["ระดับความเชื่อมั่น", cronbachLevel],
        ["จำนวนระดับ", scaleLevels],
        ["ค่าเฉลี่ย (x̄)", fmt(avg)],
        ["S.D. (ตัวอย่าง)", fmt(sd)],
        ["มัธยฐาน", fmt(medianValue)],
        ["Q1", fmt(q1)],
        ["Q3", fmt(q3)],
        ["IQR", fmt(iqr)],
        ["เกณฑ์แปลผล", schemeDescription],
        ["ระดับความพึงพอใจ", interpretation],
        ["", ""],
        [
          "ผู้ตอบ",
          ...Array.from({ length: itemCount }, (_, index) => `ข้อ ${index + 1}`),
          "รวม",
          "เฉลี่ย",
          "ระดับ",
        ],
        ...respondentResults.map((result) => [
          result.respondent,
          ...result.scores,
          result.total,
          fmt(result.mean, 2),
          result.interpretation,
        ]),
        [""],
        ["ผลรายข้อ", "x̄", "S.D.", "ระดับ"],
        ...itemResults.map((result) => [
          `ข้อ ${result.item}`,
          fmt(result.mean, 2),
          fmt(result.sd, 2),
          result.interpretation,
        ]),
      ]
    : [
        ["สถิติ", "ผล"],
        ["จำนวน (n)", values.length],
        ["ค่าเฉลี่ย (x̄)", fmt(avg)],
        ["S.D. (ตัวอย่าง)", fmt(sd)],
        ["มัธยฐาน", fmt(medianValue)],
        ["Q1", fmt(q1)],
        ["Q3", fmt(q3)],
        ["IQR", fmt(iqr)],
        ["", ""],
        ["ลำดับ", "คะแนน"],
        ...values.map((value, index) => [index + 1, value]),
      ];
  useEffect(() => {
    onChange(
      { text, scaleLevels, bandScheme, customCuts, criterionSource },
      {
        n: quality ? respondentCount : values.length,
        respondentCount: quality ? respondentCount : undefined,
        itemCount: quality ? itemCount : undefined,
        cronbachAlpha: quality ? cronbach : undefined,
        cronbachLevel: quality ? cronbachLevel : undefined,
        ratingMatrix: quality ? ratingMatrix : undefined,
        itemResults: quality ? itemResults : undefined,
        respondentResults: quality ? respondentResults : undefined,
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
  }, [text, scaleLevels, bandScheme, customCuts, criterionSource, quality, avg, sd, medianValue, q1, q3, iqr, interpretation, cronbach, cronbachLevel, onChange, values.length, respondentCount, itemCount]);

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
      title={quality ? `การแปลผล${measureLabel}` : "สถิติพรรณนา"}
      subtitle={
        quality
          ? `คำนวณค่าเฉลี่ยและแปลผลมาตราส่วนประมาณค่า 3 หรือ 5 ระดับสำหรับ${respondentLabel}`
          : "ค่าเฉลี่ย มัธยฐาน และส่วนเบี่ยงเบนมาตรฐานของกลุ่มตัวอย่าง"
      }
      badge="ตรวจสอบข้อมูลดิบได้"
    >
      {quality && qualityControls}
      <section className="panel result-export-panel">
        <ResultExportToolbar
          title={title || (quality ? `ผลการแปล${measureLabel}` : "ผลสถิติพรรณนา")}
          sheetName={quality ? "ระดับคุณภาพ" : "สถิติพรรณนา"}
          rows={exportRows}
        />
      </section>
      {quality && (
        <section className="panel quality-settings">
          <div className="panel-head">
            <div>
              <span className="eyebrow">กำหนดไว้ก่อนแปลผล</span>
              <h3>เกณฑ์แปลผล{measureLabel}</h3>
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
          <h3>{quality ? "วางคะแนนรายคน" : "วางคะแนน"}</h3>
          <p>
            {quality
              ? "1 บรรทัด = ผู้ตอบ 1 คน · 1 คอลัมน์ = ข้อประเมิน 1 ข้อ · คั่นด้วยช่องว่าง จุลภาค หรือแท็บ"
              : "คั่นด้วยช่องว่าง เครื่องหมายจุลภาค หรือขึ้นบรรทัดใหม่"}
          </p>
          <textarea
            disabled={!editable}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
          />
          <div className="data-note">
            {quality
              ? `อ่านได้ ${respondentCount} คน × ${itemCount} ข้อ · ${values.length} คะแนน${parsedRatings.removedRowNumbers ? " · ตัดเลขลำดับหน้าบรรทัดแล้ว" : ""}`
              : `อ่านได้ ${values.length} ค่า`}
          </div>
          {quality && parsedRatings.invalidRowCount > 0 && (
            <div className="notice analysis-warning">
              มี {parsedRatings.invalidRowCount} บรรทัดที่จำนวนคะแนนไม่ตรงกับแถวส่วนใหญ่ ระบบยังไม่นำบรรทัดนั้นมาคำนวณ
            </div>
          )}
        </div>
        <div>
          <div className="metrics compact">
            <Metric
              label={quality ? "ผู้ตอบ (n)" : "จำนวน (n)"}
              value={`${quality ? respondentCount : values.length}`}
            />
            {quality && <Metric label="จำนวนข้อ" value={`${itemCount}`} />}
            {quality && (
              <Metric
                label="Cronbach’s α"
                value={fmt(cronbach, 2)}
                note={cronbach === null ? "ต้องมีข้อมูลอย่างน้อย 2 คน และ 2 ข้อ" : `ความเชื่อมั่น${cronbachLevel}`}
                tone="violet"
              />
            )}
            <Metric label="ค่าเฉลี่ย (x̄)" value={fmt(avg)} tone="green" />
            <Metric label="S.D. (ตัวอย่าง)" value={fmt(sd)} tone="violet" />
            <Metric
              label={quality ? `ระดับ${measureLabel}` : "มัธยฐาน"}
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
      {quality && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ตรวจสอบก่อนบันทึก</span>
              <h3>ตารางคะแนนรายคน</h3>
              <p>ระบบคำนวณคะแนนรวม ค่าเฉลี่ย และระดับของผู้ตอบแต่ละคนอัตโนมัติ</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ผู้ตอบ</th>
                  {Array.from({ length: itemCount }, (_, index) => (
                    <th key={`rating-head-${index}`}>ข้อ {index + 1}</th>
                  ))}
                  <th>รวม</th>
                  <th>เฉลี่ย</th>
                  <th>ระดับ</th>
                </tr>
              </thead>
              <tbody>
                {respondentResults.map((result) => (
                  <tr key={`rating-person-${result.respondent}`}>
                    <td><b>{result.respondent}</b></td>
                    {result.scores.map((score, index) => (
                      <td key={`rating-${result.respondent}-${index}`}>{score}</td>
                    ))}
                    <td>{result.total}</td>
                    <td>{fmt(result.mean, 2)}</td>
                    <td>{result.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {quality && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ผลรายข้อ</span>
              <h3>ค่าเฉลี่ยและ S.D. รายข้อ</h3>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ข้อ</th><th>x̄</th><th>S.D.</th><th>ระดับ</th></tr>
              </thead>
              <tbody>
                {itemResults.map((result) => (
                  <tr key={`rating-item-${result.item}`}>
                    <td><b>{result.item}</b></td>
                    <td>{fmt(result.mean, 2)}</td>
                    <td>{fmt(result.sd, 2)}</td>
                    <td>{result.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <Formula source="บุญชม ศรีสะอาด และตำราสถิติทางการศึกษา; โปรดระบุฉบับที่ใช้อ้างอิงในงานวิจัย">
        x̄ = Σx / n และ S.D. ตัวอย่าง = √[Σ(x-x̄)²/(n-1)]{quality && " · Cronbach’s α = [k/(k−1)] [1−ΣS²ข้อ/S²รวม]"}
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


type QualityRespondentType =
  | "students"
  | "experts"
  | "teachers"
  | "parents"
  | "staff"
  | "custom";

const QUALITY_RESPONDENT_LABELS: Record<Exclude<QualityRespondentType, "custom">, string> = {
  students: "นักเรียน",
  experts: "ผู้เชี่ยวชาญ",
  teachers: "ครูผู้สอน",
  parents: "ผู้ปกครอง",
  staff: "บุคลากรทางการศึกษา",
};

type MediaQualityDomain = {
  id: number;
  title: string;
  start: number;
  end: number;
};

const MEDIA_QUALITY_DOMAINS: MediaQualityDomain[] = [
  { id: 1, title: "เนื้อหาและความสอดคล้องกับหลักสูตร", start: 1, end: 6 },
  { id: 2, title: "การออกแบบกิจกรรมการเรียนรู้", start: 7, end: 12 },
  { id: 3, title: "องค์ประกอบเกมมิฟิเคชัน (Gamification Elements)", start: 13, end: 20 },
  { id: 4, title: "การออกแบบหน้าจอและการใช้งาน (UI/UX Design)", start: 21, end: 26 },
  { id: 5, title: "ประสิทธิภาพของระบบ (System Performance)", start: 27, end: 32 },
  { id: 6, title: "ระบบ Teacher Dashboard (สำหรับครูผู้สอน)", start: 33, end: 38 },
  { id: 7, title: "คุณค่าและการนำไปใช้ประโยชน์", start: 39, end: 43 },
];

const MEDIA_QUALITY_ITEM_LABELS = [
  "เนื้อหาสอดคล้องกับมาตรฐานและตัวชี้วัดภาษาไทย ป.2",
  "เนื้อหาสอดคล้องกับจุดประสงค์การเรียนรู้ด้าน K-P-A",
  "เนื้อหาเกี่ยวกับมาตราตัวสะกดถูกต้องตามหลักภาษาไทย",
  "คำ ตัวอย่าง และประโยคเหมาะสมกับระดับพัฒนาการ",
  "เนื้อหามีลำดับจากง่ายไปยากและเชื่อมโยงกัน",
  "สื่อครอบคลุมเนื้อหาตามแผนการจัดการเรียนรู้ทั้ง 8 แผน",
  "กิจกรรมมีขั้นตอนและคำชี้แจงชัดเจน เข้าใจง่าย",
  "กิจกรรมส่งเสริมการอ่าน การจำแนก และการสะกดคำอย่างมีประสิทธิภาพ",
  "กิจกรรมส่งเสริมการเรียงคำเป็นประโยคได้ตรงตามเจตนาการสื่อสาร",
  "ระดับความท้าทายและความยากของกิจกรรมเหมาะสมกับผู้เรียน",
  "ระยะเวลาของการทำแต่ละกิจกรรมเหมาะสมกับคาบเรียน 1 ชั่วโมง",
  "กิจกรรมเปิดโอกาสให้นักเรียนมีส่วนร่วม (Active Learning) อย่างต่อเนื่อง",
  "ภารกิจและด่านของเกมมีความชัดเจนและน่าสนใจ",
  "ระบบคะแนนช่วยกระตุ้นให้นักเรียนเข้าร่วมกิจกรรม",
  "เหรียญ ดาว และรางวัลสะสม เหมาะสมกับความสนใจตามวัยของผู้เรียน",
  "กระดานคะแนน (Leaderboard) ช่วยสร้างแรงจูงใจอย่างเหมาะสม",
  "ระบบแสดงผลป้อนกลับ (Feedback) ทันทีเมื่อผู้เรียนตอบคำถาม",
  "เกมแสดงคำตอบที่ถูกและผิดพร้อมเหตุผลอย่างชัดเจน",
  "เกมส่งเสริมการแข่งขันอย่างสร้างสรรค์และเป็นธรรม",
  "องค์ประกอบเกมช่วยให้ผู้เรียนสนุกและมีความต้องการเรียนรู้ต่อ",
  "รูปแบบหน้าจอสวยงาม ดึงดูดความสนใจ และเหมาะสมกับนักเรียน ป.2",
  "ตัวอักษรมีขนาดใหญ่ ชัดเจน และอ่านง่าย",
  "สี ภาพ เสียงประกอบ และภาพเคลื่อนไหวมีความเหมาะสม ไม่รบกวนสมาธิ",
  "ปุ่มและเมนูต่าง ๆ ใช้งานง่าย ตรงไปตรงมา ไม่ซับซ้อน",
  "การจัดวางองค์ประกอบมีความสมดุลและไม่บดบังเนื้อหาสำคัญ",
  "หน้าจอแสดงผลได้เหมาะสมทั้งคอมพิวเตอร์ แท็บเล็ต และสมาร์ตโฟน",
  "ระบบทำงานรวดเร็วและตอบสนองต่อคำสั่งได้ดี ไม่หน่วง",
  "เกมและสื่อสามารถทำงานได้อย่างต่อเนื่อง ไม่เกิดข้อผิดพลาด (Bug)",
  "การเชื่อมต่อข้อมูลระหว่างจอครูและจอนักเรียนมีความถูกต้องและเสถียร",
  "คะแนนและผลการแข่งขันอัปเดตแบบเรียลไทม์ (Real-time)",
  "ระบบรองรับนักเรียนหลายคนเข้าใช้งานพร้อมกันได้อย่างราบรื่น",
  "ระบบมีการจัดการข้อมูลและสิทธิ์ผู้ใช้งานได้อย่างเหมาะสมและปลอดภัย",
  "ครูสามารถสร้างห้องและแสดงรหัส (Room Code) หรือ QR Code ได้สะดวก",
  "ครูสามารถตรวจสอบรายชื่อและอนุมัตินักเรียนเข้าห้องได้อย่างรวดเร็ว",
  "ครูสามารถควบคุมลำดับกิจกรรมและบริหารเวลาในชั้นเรียนได้อย่างเหมาะสม",
  "ครูสามารถสลับการแสดงผลสื่อบนจอโปรเจกเตอร์และจอนักเรียนได้ง่าย",
  "ครูสามารถติดตามความก้าวหน้าและคะแนนของนักเรียนเป็นรายบุคคลได้",
  "ครูสามารถดูผลสรุปการแข่งขันและประกาศผลท้ายคาบได้ชัดเจน",
  "สื่อช่วยให้ผู้เรียนเข้าใจเรื่องมาตราตัวสะกดได้ดีขึ้นอย่างเป็นรูปธรรม",
  "สื่อช่วยลดภาระและเพิ่มความสะดวกในการจัดการเรียนรู้ของครู",
  "สื่อมีความเหมาะสมและเป็นไปได้ในการนำไปใช้ในชั้นเรียนจริง",
  "สื่อมีความน่าเชื่อถือและเหมาะสมสำหรับใช้เป็นนวัตกรรมในการทำวิจัย",
  "ระบบมีความยืดหยุ่น สามารถนำไปพัฒนาเพิ่มเนื้อหาในอนาคตได้",
];

const DEFAULT_MEDIA_QUALITY_SCORES = [
  [5, 5, 5], [5, 5, 5], [5, 5, 5], [5, 5, 5], [5, 5, 5], [5, 5, 5],
  [5, 5, 5], [5, 5, 5], [4, 5, 5], [5, 5, 5], [4, 5, 4], [5, 5, 5],
  [5, 5, 5], [5, 4, 5], [5, 4, 4], [5, 5, 5], [5, 5, 5], [4, 5, 5],
  [5, 5, 4], [5, 4, 5], [5, 4, 5], [4, 5, 5], [5, 5, 5], [4, 4, 4],
  [5, 5, 5], [4, 5, 4], [5, 4, 5], [4, 5, 5], [5, 4, 4], [5, 5, 5],
  [5, 4, 5], [5, 5, 4], [5, 4, 5], [5, 5, 5], [5, 4, 5], [5, 5, 4],
  [5, 5, 5], [5, 5, 5], [5, 5, 5], [5, 4, 4], [4, 5, 5], [5, 5, 5],
  [5, 5, 5],
];

function qualityDomainForItem(itemNumber: number) {
  return MEDIA_QUALITY_DOMAINS.find(
    (domain) => itemNumber >= domain.start && itemNumber <= domain.end,
  )!;
}

function normalizeRespondents(value: unknown) {
  if (!Array.isArray(value)) return ["นางสาวไลลา", "นางสุภรณ์", "นางมาริยา"];
  const respondents = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return respondents.length ? respondents : ["นางสาวไลลา", "นางสุภรณ์", "นางมาริยา"];
}

function normalizeMediaScores(value: unknown, respondentCount: number) {
  const source = Array.isArray(value) ? value : DEFAULT_MEDIA_QUALITY_SCORES;
  return MEDIA_QUALITY_ITEM_LABELS.map((_, itemIndex) => {
    const sourceRow = Array.isArray(source[itemIndex])
      ? (source[itemIndex] as unknown[])
      : DEFAULT_MEDIA_QUALITY_SCORES[itemIndex];
    return Array.from({ length: respondentCount }, (_, respondentIndex) => {
      const fallback = DEFAULT_MEDIA_QUALITY_SCORES[itemIndex]?.[respondentIndex] ?? 5;
      const numeric = Number(sourceRow?.[respondentIndex] ?? fallback);
      return Number.isFinite(numeric) && numeric >= 1 && numeric <= 5
        ? Math.round(numeric)
        : fallback;
    });
  });
}

function QualityView({
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
  const [qualityMode, setQualityMode] = useState<"summary" | "media-expert">(
    initial?.qualityMode === "media-expert" ? "media-expert" : "summary",
  );
  const [respondentType, setRespondentType] = useState<QualityRespondentType>(
    ["students", "experts", "teachers", "parents", "staff", "custom"].includes(
      String(initial?.respondentType ?? ""),
    )
      ? (String(initial?.respondentType) as QualityRespondentType)
      : initial?.qualityMode === "media-expert"
        ? "experts"
        : "students",
  );
  const [customRespondentLabel, setCustomRespondentLabel] = useState(
    typeof initial?.customRespondentLabel === "string"
      ? initial.customRespondentLabel
      : "",
  );
  const respondentLabel =
    respondentType === "custom"
      ? customRespondentLabel.trim() || "ผู้ตอบแบบประเมิน"
      : QUALITY_RESPONDENT_LABELS[respondentType];
  const measureLabel =
    qualityMode === "media-expert" ? "คุณภาพสื่อนวัตกรรม" : "ความพึงพอใจ";

  const handleChildChange = useCallback(
    (workspace: WorkspaceData, result: WorkspaceData) => {
      onChange(
        {
          ...workspace,
          qualityMode,
          respondentType,
          customRespondentLabel,
        },
        {
          ...result,
          qualityMode,
          respondentType,
          respondentLabel,
        },
      );
    },
    [
      customRespondentLabel,
      onChange,
      qualityMode,
      respondentLabel,
      respondentType,
    ],
  );

  const qualityControls = (
    <section className="panel quality-settings">
      <div className="panel-head">
        <div>
          <span className="eyebrow">รูปแบบการประเมินและผู้ตอบ</span>
          <h3>เลือกบริบทก่อนคำนวณ</h3>
          <p>ระบบจะปรับหัวตาราง คำแปลผล และข้อความรายงานให้ตรงกับผู้ตอบ</p>
        </div>
      </div>
      <div className="quality-setting-grid">
        <label>
          รูปแบบการวิเคราะห์
          <select
            disabled={!editable}
            value={qualityMode}
            onChange={(event) =>
              setQualityMode(event.target.value as "summary" | "media-expert")
            }
          >
            <option value="summary">ความพึงพอใจ 3/5 ระดับ · วางคะแนนรายคน</option>
            <option value="media-expert">ประเมินคุณภาพสื่อรายข้อและรายด้าน</option>
          </select>
        </label>
        <label>
          ประเภทผู้ตอบ
          <select
            disabled={!editable}
            value={respondentType}
            onChange={(event) =>
              setRespondentType(event.target.value as QualityRespondentType)
            }
          >
            <option value="students">นักเรียน</option>
            <option value="experts">ผู้เชี่ยวชาญ</option>
            <option value="teachers">ครูผู้สอน</option>
            <option value="parents">ผู้ปกครอง</option>
            <option value="staff">บุคลากรทางการศึกษา</option>
            <option value="custom">กำหนดเอง</option>
          </select>
        </label>
        {respondentType === "custom" && (
          <label>
            ชื่อกลุ่มผู้ตอบ
            <input
              disabled={!editable}
              value={customRespondentLabel}
              placeholder="เช่น คณะกรรมการประเมิน"
              onChange={(event) => setCustomRespondentLabel(event.target.value)}
            />
          </label>
        )}
      </div>
    </section>
  );

  return qualityMode === "media-expert" ? (
    <ExpertMediaQualityView
      imported={imported}
      initial={initial}
      onChange={handleChildChange}
      title={title}
      editable={editable}
      respondentLabel={respondentLabel}
      qualityControls={qualityControls}
    />
  ) : (
    <DescriptiveView
      quality
      imported={imported}
      initial={initial}
      onChange={handleChildChange}
      title={title}
      editable={editable}
      respondentLabel={respondentLabel}
      measureLabel={measureLabel}
      qualityControls={qualityControls}
    />
  );
}

function ExpertMediaQualityView({
  initial,
  onChange,
  title,
  editable,
  respondentLabel,
  qualityControls,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  title: string;
  editable: boolean;
  respondentLabel: string;
  qualityControls: React.ReactNode;
}) {
  const savedRespondents = normalizeRespondents(initial?.respondents);
  const [respondents, setRespondents] = useState<string[]>(savedRespondents);
  const [scores, setScores] = useState<number[][]>(() =>
    normalizeMediaScores(initial?.mediaScores, savedRespondents.length),
  );
  const [passMean, setPassMean] = useState(
    Number.isFinite(Number(initial?.passMean)) ? Number(initial?.passMean) : 3.51,
  );
  const [criterionSource, setCriterionSource] = useState(
    typeof initial?.criterionSource === "string"
      ? initial.criterionSource
      : "เกณฑ์แปลผล 4.51–5.00 ตามเอกสารอ้างอิงที่ผู้วิจัยกำหนด",
  );
  const [qualitativeComments, setQualitativeComments] = useState(
    typeof initial?.qualitativeComments === "string"
      ? initial.qualitativeComments
      : "",
  );
  const [improvementActions, setImprovementActions] = useState(
    typeof initial?.improvementActions === "string"
      ? initial.improvementActions
      : "",
  );
  const [copiedReport, setCopiedReport] = useState(false);

  const itemResults = useMemo(
    () =>
      MEDIA_QUALITY_ITEM_LABELS.map((label, itemIndex) => {
        const values = (scores[itemIndex] ?? []).filter(
          (value) => Number.isFinite(value) && value >= 1 && value <= 5,
        );
        const meanValue = mean(values);
        const sdValue = sampleStandardDeviation(values);
        return {
          item: itemIndex + 1,
          label,
          domainId: qualityDomainForItem(itemIndex + 1).id,
          values,
          sum: values.reduce((total, value) => total + value, 0),
          mean: meanValue,
          sd: sdValue,
          interpretation: interpretQuality(meanValue, traditionalFiveLevelBands),
          passed: meanValue !== null && meanValue >= passMean,
        };
      }),
    [passMean, scores],
  );

  const domainResults = useMemo(
    () =>
      MEDIA_QUALITY_DOMAINS.map((domain) => {
        const values = scores
          .slice(domain.start - 1, domain.end)
          .flat()
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
        const meanValue = mean(values);
        const sdValue = sampleStandardDeviation(values);
        return {
          ...domain,
          itemCount: domain.end - domain.start + 1,
          responseCount: values.length,
          mean: meanValue,
          sd: sdValue,
          interpretation: interpretQuality(meanValue, traditionalFiveLevelBands),
          passed: meanValue !== null && meanValue >= passMean,
        };
      }),
    [passMean, scores],
  );

  const overallResult = useMemo(() => {
    const values = scores
      .flat()
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
    const meanValue = mean(values);
    const sdValue = sampleStandardDeviation(values);
    return {
      responseCount: values.length,
      totalScore: values.reduce((total, value) => total + value, 0),
      maximumTotalScore: MEDIA_QUALITY_ITEM_LABELS.length * respondents.length * 5,
      mean: meanValue,
      sd: sdValue,
      median: median(values),
      q1: quantile(values, 0.25),
      q3: quantile(values, 0.75),
      interpretation: interpretQuality(meanValue, traditionalFiveLevelBands),
      passed: meanValue !== null && meanValue >= passMean,
    };
  }, [passMean, respondents.length, scores]);

  const shortReport = `ผลการประเมินคุณภาพสื่อนวัตกรรม Web Application เรื่อง มาตราตัวสะกด โดย${respondentLabel}จำนวน ${respondents.length} คน พบว่า โดยภาพรวมมีคุณภาพอยู่ในระดับ${overallResult.interpretation} (x̄ = ${fmt(overallResult.mean)}, S.D. = ${fmt(overallResult.sd)}) และ${overallResult.passed ? "ผ่าน" : "ไม่ผ่าน"}เกณฑ์ค่าเฉลี่ย ${fmt(passMean, 2)}`;
  const domainNarrative = domainResults
    .map(
      (domain) =>
        `ด้านที่ ${domain.id} ${domain.title} อยู่ในระดับ${domain.interpretation} (x̄ = ${fmt(domain.mean)}, S.D. = ${fmt(domain.sd)})`,
    )
    .join("; ");
  const detailedReport = `${shortReport} เมื่อพิจารณารายด้าน พบว่า ${domainNarrative}${qualitativeComments.trim() ? ` ข้อเสนอแนะของผู้ประเมินสรุปได้ว่า ${qualitativeComments.trim()}` : ""}${improvementActions.trim() ? ` ผู้วิจัยดำเนินการปรับปรุงดังนี้ ${improvementActions.trim()}` : ""}`;

  const exportRows: ExportCell[][] = [
    ["ข้อ", "รายการประเมิน", ...respondents, "รวม", "x̄", "S.D.", "ระดับ", "ผล"],
    ...itemResults.map((result) => [
      result.item,
      result.label,
      ...result.values,
      result.sum,
      fmt(result.mean, 2),
      fmt(result.sd, 2),
      result.interpretation,
      result.passed ? "ผ่าน" : "ควรปรับปรุง",
    ]),
    [""],
    ["สรุปรายด้าน", "ชื่อด้าน", "จำนวนข้อ", "x̄", "S.D.", "ระดับ", "ผล"],
    ...domainResults.map((domain) => [
      `ด้านที่ ${domain.id}`,
      domain.title,
      domain.itemCount,
      fmt(domain.mean, 2),
      fmt(domain.sd, 2),
      domain.interpretation,
      domain.passed ? "ผ่าน" : "ควรปรับปรุง",
    ]),
    [
      "ภาพรวม",
      `${MEDIA_QUALITY_ITEM_LABELS.length} ข้อ`,
      "",
      fmt(overallResult.mean, 2),
      fmt(overallResult.sd, 2),
      overallResult.interpretation,
      overallResult.passed ? "ผ่าน" : "ควรปรับปรุง",
    ],
    [""],
    ["ข้อเสนอแนะเชิงคุณภาพ", qualitativeComments],
    ["การปรับปรุงที่ดำเนินการ", improvementActions],
  ];

  useEffect(() => {
    onChange(
      {
        qualityMode: "media-expert",
        scaleLevels: 5,
        bandScheme: "traditional",
        respondents,
        mediaScores: scores,
        passMean,
        criterionSource,
        qualitativeComments,
        improvementActions,
        itemCount: MEDIA_QUALITY_ITEM_LABELS.length,
        domainCount: MEDIA_QUALITY_DOMAINS.length,
      },
      {
        respondentCount: respondents.length,
        itemCount: MEDIA_QUALITY_ITEM_LABELS.length,
        domainCount: MEDIA_QUALITY_DOMAINS.length,
        itemResults,
        domainResults,
        overall: overallResult,
        criterion: {
          passMean,
          scaleLevels: 5,
          bandScheme: "traditional",
          source: criterionSource,
        },
        shortReport,
        detailedReport,
      },
    );
  }, [
    criterionSource,
    detailedReport,
    domainResults,
    improvementActions,
    itemResults,
    onChange,
    overallResult,
    passMean,
    qualitativeComments,
    respondents,
    scores,
    shortReport,
  ]);

  const updateScore = (itemIndex: number, respondentIndex: number, value: number) => {
    setScores((current) =>
      current.map((row, rowIndex) =>
        rowIndex === itemIndex
          ? row.map((score, columnIndex) =>
              columnIndex === respondentIndex ? value : score,
            )
          : row,
      ),
    );
  };

  const updateRespondentName = (respondentIndex: number, value: string) => {
    setRespondents((current) =>
      current.map((name, index) => (index === respondentIndex ? value : name)),
    );
  };

  const addRespondent = () => {
    if (respondents.length >= 10) return;
    setRespondents((current) => [
      ...current,
      `ผู้ประเมินคนที่ ${current.length + 1}`,
    ]);
    setScores((current) => current.map((row) => [...row, 5]));
  };

  const removeRespondent = () => {
    if (respondents.length <= 1) return;
    setRespondents((current) => current.slice(0, -1));
    setScores((current) => current.map((row) => row.slice(0, -1)));
  };

  const copyReport = async () => {
    const copied = await copyToClipboard(detailedReport);
    setCopiedReport(copied);
    if (copied) window.setTimeout(() => setCopiedReport(false), 1800);
  };

  return (
    <Page
      title="การประเมินคุณภาพสื่อนวัตกรรม"
      subtitle={`วิเคราะห์คะแนนรายข้อ รายด้าน และภาพรวมจาก${respondentLabel}`}
      badge="43 ข้อ · 7 ด้าน · ตรวจสอบย้อนกลับได้"
    >
      {qualityControls}
      <section className="panel result-export-panel">
        <ResultExportToolbar
          title={title || "ผลการประเมินคุณภาพสื่อนวัตกรรม"}
          sheetName="คุณภาพสื่อ"
          rows={exportRows}
        />
      </section>

      <section className="panel quality-settings">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ผู้ประเมินและเกณฑ์ที่กำหนดไว้ล่วงหน้า</span>
            <h3>ตั้งค่าการประเมิน</h3>
            <p>เพิ่มหรือลดผู้ประเมินได้ และระบุชื่อเพื่อแสดงในตารางส่งออก</p>
          </div>
        </div>
        <div className="quality-setting-grid">
          {respondents.map((respondent, index) => (
            <label key={`respondent-${index}`}>
              ผู้ประเมินคนที่ {index + 1}
              <input
                disabled={!editable}
                value={respondent}
                onChange={(event) => updateRespondentName(index, event.target.value)}
              />
            </label>
          ))}
          <label>
            เกณฑ์ผ่านขั้นต่ำ
            <input
              disabled={!editable}
              type="number"
              min="1"
              max="5"
              step="0.01"
              value={passMean}
              onChange={(event) => setPassMean(Number(event.target.value))}
            />
          </label>
          <label>
            แหล่งอ้างอิงเกณฑ์
            <input
              disabled={!editable}
              value={criterionSource}
              onChange={(event) => setCriterionSource(event.target.value)}
              placeholder="ผู้แต่ง ปี ฉบับพิมพ์ และเลขหน้า"
            />
          </label>
        </div>
        <div className="copy-report-actions">
          <button type="button" disabled={!editable || respondents.length >= 10} onClick={addRespondent}>
            ＋ เพิ่มผู้ประเมิน
          </button>
          <button type="button" disabled={!editable || respondents.length <= 1} onClick={removeRespondent}>
            − ลดผู้ประเมินคนสุดท้าย
          </button>
        </div>
      </section>

      <section className="metric-grid">
        <Metric label="ผู้ประเมิน" value={`${respondents.length} คน`} tone="blue" />
        <Metric label="จำนวนข้อ" value={`${MEDIA_QUALITY_ITEM_LABELS.length} ข้อ`} tone="violet" />
        <Metric label="ค่าเฉลี่ยรวม" value={fmt(overallResult.mean)} tone="green" />
        <Metric label="S.D." value={fmt(overallResult.sd)} tone="amber" />
        <Metric
          label="ระดับคุณภาพ"
          value={overallResult.interpretation}
          note={overallResult.passed ? "ผ่านเกณฑ์" : "ควรปรับปรุง"}
          tone={overallResult.passed ? "green" : "amber"}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ข้อมูลดิบและผลรายข้อ</span>
            <h3>ตารางคะแนน 43 ข้อ</h3>
            <p>คะแนน 1–5 · x̄ และ S.D. คำนวณจากผู้ประเมินในแต่ละข้อ</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="media-quality-table">
            <thead>
              <tr>
                <th>ข้อ</th>
                <th>รายการประเมิน</th>
                {respondents.map((respondent, index) => (
                  <th key={`head-${index}`}>{respondent || `คนที่ ${index + 1}`}</th>
                ))}
                <th>รวม</th>
                <th>x̄</th>
                <th>S.D.</th>
                <th>ระดับ</th>
                <th>ผล</th>
              </tr>
            </thead>
            <tbody>
              {MEDIA_QUALITY_DOMAINS.flatMap((domain) => [
                <tr className="section-row" key={`domain-${domain.id}`}>
                  <td colSpan={respondents.length + 7}>
                    <b>ด้านที่ {domain.id} {domain.title}</b>
                  </td>
                </tr>,
                ...itemResults
                  .filter((result) => result.domainId === domain.id)
                  .map((result) => (
                    <tr key={`item-${result.item}`}>
                      <td><b>{result.item}</b></td>
                      <td>{result.label}</td>
                      {respondents.map((_, respondentIndex) => (
                        <td key={`score-${result.item}-${respondentIndex}`}>
                          <select
                            disabled={!editable}
                            value={scores[result.item - 1]?.[respondentIndex] ?? 5}
                            onChange={(event) =>
                              updateScore(
                                result.item - 1,
                                respondentIndex,
                                Number(event.target.value),
                              )
                            }
                            aria-label={`ข้อ ${result.item} ผู้ประเมินคนที่ ${respondentIndex + 1}`}
                          >
                            {[5, 4, 3, 2, 1].map((score) => (
                              <option value={score} key={score}>{score}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td>{result.sum}</td>
                      <td>{fmt(result.mean, 2)}</td>
                      <td>{fmt(result.sd, 2)}</td>
                      <td>{result.interpretation}</td>
                      <td>
                        <span className={result.passed ? "pill pass" : "pill revise"}>
                          {result.passed ? "ผ่าน" : "ปรับปรุง"}
                        </span>
                      </td>
                    </tr>
                  )),
              ])}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ผลสำหรับบทที่ 4</span>
            <h3>สรุปรายด้านและภาพรวม</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ด้าน</th>
                <th>จำนวนข้อ</th>
                <th>x̄</th>
                <th>S.D.</th>
                <th>ระดับคุณภาพ</th>
                <th>ผล</th>
              </tr>
            </thead>
            <tbody>
              {domainResults.map((domain) => (
                <tr key={`summary-${domain.id}`}>
                  <td>ด้านที่ {domain.id} {domain.title}</td>
                  <td>{domain.itemCount}</td>
                  <td>{fmt(domain.mean, 2)}</td>
                  <td>{fmt(domain.sd, 2)}</td>
                  <td>{domain.interpretation}</td>
                  <td>{domain.passed ? "ผ่าน" : "ควรปรับปรุง"}</td>
                </tr>
              ))}
              <tr>
                <td><b>ภาพรวม</b></td>
                <td><b>{MEDIA_QUALITY_ITEM_LABELS.length}</b></td>
                <td><b>{fmt(overallResult.mean, 2)}</b></td>
                <td><b>{fmt(overallResult.sd, 2)}</b></td>
                <td><b>{overallResult.interpretation}</b></td>
                <td><b>{overallResult.passed ? "ผ่าน" : "ควรปรับปรุง"}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="data-note">
          S.D. รายด้านคำนวณจากคะแนนดิบทุกข้อในด้านนั้น และใช้ S.D. แบบตัวอย่าง (n−1)
        </p>
      </section>

      <section className="split">
        <div className="panel">
          <h3>ข้อเสนอแนะเชิงคุณภาพ</h3>
          <textarea
            disabled={!editable}
            rows={7}
            value={qualitativeComments}
            placeholder="สรุปความคิดเห็นหรือข้อเสนอแนะจากผู้ประเมิน"
            onChange={(event) => setQualitativeComments(event.target.value)}
          />
        </div>
        <div className="panel">
          <h3>การปรับปรุงที่ผู้วิจัยดำเนินการ</h3>
          <textarea
            disabled={!editable}
            rows={7}
            value={improvementActions}
            placeholder="ระบุสิ่งที่ปรับปรุงก่อนนำสื่อไปใช้จริง"
            onChange={(event) => setImprovementActions(event.target.value)}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">รายงานอัตโนมัติ</span>
            <h3>ข้อความพร้อมใช้ในบทที่ 4</h3>
          </div>
          <button type="button" onClick={copyReport}>
            {copiedReport ? "คัดลอกแล้ว" : "คัดลอกรายงาน"}
          </button>
        </div>
        <div className="report-grid">
          <article>
            <div className="report-head"><b>แบบย่อ</b></div>
            <p>{shortReport}</p>
          </article>
          <article>
            <div className="report-head"><b>แบบละเอียด</b></div>
            <p>{detailedReport}</p>
          </article>
        </div>
      </section>

      <Formula source="สถิติเชิงพรรณนา; เกณฑ์แปลผลมาตราส่วนประมาณค่า 5 ระดับที่ผู้วิจัยกำหนด">
        x̄ = ΣX / n และ S.D. = √[Σ(X − x̄)² / (n − 1)] · รายงานผลรายข้อ รายด้าน และภาพรวม
      </Formula>
    </Page>
  );
}

function selectedTestMatrix(matrix: number[][], selectedItems: number[]) {
  return matrix.map((row) =>
    selectedItems.map((itemNumber) => row[itemNumber - 1]),
  );
}

const DEFAULT_SHARED_TEST_TEXT = "";

function parseSharedTestMatrix(text: string) {
  const tokenRows = text
    .trim()
    .split(/\r?\n+/)
    .map((line) => line.trim().split(/[\s,;\t]+/).filter(Boolean))
    .filter((tokens) =>
      tokens.some((token) =>
        ["0", "1"].includes(
          normalizeDigits(token).replace(/^['"]|['"]$/g, ""),
        ),
      ),
    );
  if (!tokenRows.length) return [];
  const rowsWithSequenceNumber = tokenRows.filter(
    (row, index) => Number(normalizeDigits(row[0] ?? "")) === index + 1,
  ).length;
  const hasSequenceNumber =
    tokenRows.length > 1 &&
    rowsWithSequenceNumber >= Math.ceil(tokenRows.length * 0.8);
  const candidates = tokenRows.map((row) =>
    hasSequenceNumber ? row.slice(1) : row,
  );
  const binaryRuns = candidates.map((row) => {
    const runs: number[][] = [];
    let current: number[] = [];
    row.forEach((token) => {
      const normalized = normalizeDigits(token).replace(/^['"]|['"]$/g, "");
      if (normalized === "0" || normalized === "1") {
        current.push(Number(normalized));
      } else if (current.length) {
        runs.push(current);
        current = [];
      }
    });
    if (current.length) runs.push(current);
    return runs.sort((a, b) => b.length - a.length).at(0) ?? [];
  });
  const widthCounts = new Map<number, number>();
  binaryRuns.forEach((run) => {
    const width = run.length;
    if (width > 0) widthCounts.set(width, (widthCounts.get(width) ?? 0) + 1);
  });
  const targetWidth = [...widthCounts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
  if (!targetWidth) return [];
  return binaryRuns
    .filter((run) => run.length >= targetWidth)
    .map((run) => run.slice(-targetWidth));
}

function sharedTestTextFromWorkspace(workspace?: WorkspaceData | null) {
  if (typeof workspace?.testMatrix === "string") {
    return workspace.testMatrix;
  }
  if (typeof workspace?.text === "string") {
    const matrix = parseSharedTestMatrix(workspace.text);
    const binary =
      matrix.length > 0 &&
      matrix.every((row) =>
        row.every((value) => value === 0 || value === 1),
      );
    if (binary) return workspace.text;
  }
  return "";
}

function isTestGroupPercentage(value: number): value is TestGroupPercentage {
  return testGroupPercentages.some((percentage) => percentage === value);
}

function downloadTryoutTemplate(itemCount: number, respondentCount: number) {
  const header = [
    "ลำดับ",
    ...Array.from({ length: itemCount }, (_, index) => `ข้อ${index + 1}`),
  ];
  const rows = Array.from({ length: respondentCount }, (_, index) => [
    index + 1,
    ...Array.from({ length: itemCount }, () => ""),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell)}"`).join(","))
    .join("\n");
  downloadFile(
    new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    `แม่แบบ-Try-out-${itemCount}-ข้อ-${respondentCount}-คน.csv`,
  );
}

function recommendTryoutGroups(
  respondentCount: number,
  groupPercentage: TestGroupPercentage,
) {
  const groupSize = Math.min(
    Math.floor(respondentCount / 2),
    Math.max(1, Math.round(respondentCount * groupPercentage)),
  );
  return {
    upper: groupSize,
    middle: respondentCount - groupSize * 2,
    lower: groupSize,
  };
}

function ItemView({
  initial,
  onChange,
  title,
  editable,
  sharedTestText,
  onSharedTestTextChange,
}: {
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  title: string;
  editable: boolean;
  sharedTestText: string;
  onSharedTestTextChange: (value: string) => void;
}) {
  const initialGroupPercentage = Number(initial?.groupPercentage ?? 0.27);
  const [groupPercentage, setGroupPercentage] = useState<TestGroupPercentage>(
    isTestGroupPercentage(initialGroupPercentage)
      ? initialGroupPercentage
      : 0.27,
  );
  const [templateItemCount, setTemplateItemCount] = useState(() => {
    const value = Number(initial?.templateItemCount ?? 20);
    return Number.isFinite(value) ? Math.max(1, Math.min(300, Math.round(value))) : 20;
  });
  const [templateRespondentCount, setTemplateRespondentCount] = useState(() => {
    const value = Number(initial?.templateRespondentCount ?? 40);
    return Number.isFinite(value) ? Math.max(2, Math.min(500, Math.round(value))) : 40;
  });
  const recommendedTemplateGroups = recommendTryoutGroups(
    templateRespondentCount,
    groupPercentage,
  );
  const matrix = useMemo(
    () => parseSharedTestMatrix(sharedTestText),
    [sharedTestText],
  );
  const analysis = useMemo(
    () => analyzeTestMatrix(matrix, groupPercentage),
    [matrix, groupPercentage],
  );
  const selectedMatrix = useMemo(
    () =>
      analysis.valid
        ? selectedTestMatrix(matrix, analysis.selectedItems)
        : [],
    [analysis, matrix],
  );
  const reliability = selectedMatrix[0]?.length ? kr20(selectedMatrix) : null;
  const reliabilityLevel =
    reliability === null
      ? "ยังคำนวณไม่ได้"
      : reliability >= 0.9
        ? "สูงมาก"
        : reliability >= 0.8
          ? "สูง"
          : reliability >= 0.7
            ? "ยอมรับได้"
            : reliability >= 0.6
              ? "ค่อนข้างต่ำ"
              : "ควรปรับปรุง";
  const reliabilityReport =
    reliability === null
      ? "ยังไม่สามารถคำนวณความเชื่อมั่นได้ กรุณาตรวจ Matrix และข้อที่ผ่านเกณฑ์"
      : "แบบทดสอบที่คัดเลือกจำนวน " +
        analysis.selectedItems.length +
        " ข้อ มีค่าความเชื่อมั่น KR-20 เท่ากับ " +
        fmt(reliability, 2) +
        " อยู่ในระดับ" +
        reliabilityLevel;
  const groupPercentLabel = `${Math.round(groupPercentage * 100)}%`;
  const rejectedByDifficulty = analysis.items.filter(
    (item) =>
      item.difficulty === null ||
      item.difficulty < 0.2 ||
      item.difficulty > 0.8,
  ).length;
  const rejectedByDiscrimination = analysis.items.filter(
    (item) => item.discrimination === null || item.discrimination < 0.2,
  ).length;
  const tryoutReport = analysis.valid
    ? `นำแบบทดสอบฉบับร่างจำนวน ${analysis.itemCount} ข้อไปทดลองใช้กับนักเรียนจำนวน ${analysis.respondentCount} คน ตรวจให้คะแนนแบบตอบถูก 1 คะแนนและตอบผิด 0 คะแนน จากนั้นเรียงคะแนนรวมจากสูงไปต่ำและแบ่งกลุ่มสูงกับกลุ่มต่ำด้วยเทคนิค ${groupPercentLabel} ได้กลุ่มละ ${analysis.groupSize} คน ผลการวิเคราะห์รายข้อพบว่ามีข้อสอบผ่านเกณฑ์ p = 0.20–0.80 และ r ≥ 0.20 จำนวน ${analysis.selectedItems.length} ข้อ ได้แก่ ข้อ ${analysis.selectedItems.join(", ") || "—"}`
    : analysis.error ?? "กรุณาป้อนข้อมูลคะแนน Try-out";
  const exportRows: ExportCell[][] = [
    ["ข้อ", "R_H", "R_L", "p", "แปลผล p", "r", "แปลผล r", "สถานะ"],
    ...analysis.items.map((item) => [
      item.item,
      item.upperCorrect,
      item.lowerCorrect,
      fmt(item.difficulty, 4),
      item.difficultyLabel,
      fmt(item.discrimination, 3),
      item.discriminationLabel,
      item.selected ? "คัดเลือก" : "ไม่คัดเลือก",
    ]),
    [""],
    ["จำนวนผู้สอบ", analysis.respondentCount],
    ["จำนวนข้อฉบับร่าง", analysis.itemCount],
    ["เทคนิคแบ่งกลุ่ม", groupPercentLabel],
    ["จำนวนคนต่อกลุ่ม", analysis.groupSize],
    ["จำนวนคนกลุ่มกลางที่ไม่นำมาคำนวณ", analysis.middleCount],
    ["จำนวนข้อที่ผ่าน", analysis.selectedItems.length],
    ["จำนวนข้อไม่ผ่านเกณฑ์ p", rejectedByDifficulty],
    ["จำนวนข้อไม่ผ่านเกณฑ์ r", rejectedByDiscrimination],
    ["ข้อที่คัดเลือก", analysis.selectedItems.join(", ")],
    ["KR-20 ของข้อที่คัดเลือก", fmt(reliability, 2)],
    ["ระดับความเชื่อมั่น", reliabilityLevel],
    ["รายงานอัตโนมัติ", reliabilityReport],
    ["ข้อความสรุป Try-out", tryoutReport],
    [""],
    ["อันดับ", "แถวข้อมูลเดิม", "คะแนนรวม", "กลุ่ม"],
    ...analysis.rankedRespondents.map((respondent) => [
      respondent.rank,
      respondent.sourceIndex + 1,
      respondent.total,
      respondent.group === "upper"
        ? "กลุ่มสูง"
        : respondent.group === "lower"
          ? "กลุ่มต่ำ"
          : "กลุ่มกลาง (ไม่นำมาคำนวณ)",
    ]),
  ];
  useEffect(() => {
    onChange(
      {
        testMatrix: sharedTestText,
        groupPercentage,
        templateItemCount,
        templateRespondentCount,
        selectedItems: analysis.selectedItems,
      },
      {
        valid: analysis.valid,
        respondentCount: analysis.respondentCount,
        itemCount: analysis.itemCount,
        groupSize: analysis.groupSize,
        middleCount: analysis.middleCount,
        upperRespondents: analysis.upperIndexes.map((index) => index + 1),
        lowerRespondents: analysis.lowerIndexes.map((index) => index + 1),
        rankedRespondents: analysis.rankedRespondents,
        items: analysis.items,
        selectedItems: analysis.selectedItems,
        selectedItemCount: analysis.selectedItems.length,
        kr20: reliability,
        report: tryoutReport,
      },
    );
  }, [analysis, groupPercentage, onChange, reliability, sharedTestText, templateItemCount, templateRespondentCount, tryoutReport]);
  return (
    <Page
      title="วิเคราะห์ความยาก (p) และอำนาจจำแนก (r)"
      subtitle="คำนวณจากคะแนน Try-out 0/1 รายคน จัดอันดับ แบ่งกลุ่มสูง–ต่ำ และคัดเลือกข้อสอบโดยอัตโนมัติ"
      badge="กำหนดจำนวนข้อและคนได้"
    >
      <section className="panel result-export-panel">
        <ResultExportToolbar
          title={title || "ผลความยากและอำนาจจำแนก"}
          sheetName="ความยาก-อำนาจจำแนก"
          rows={exportRows}
        />
      </section>
      <section className="split">
        <div className="panel">
          <span className="eyebrow">ขั้นที่ 1 · คะแนนจากการทดลองใช้</span>
          <h3>ป้อน Matrix คะแนนดิบ 0/1</h3>
          <p>คัดลอกจาก Excel ได้ทันที: 1 แถว = ผู้สอบ 1 คน · 1 คอลัมน์ = 1 ข้อ · ถูก = 1 · ผิด = 0</p>
          <div className="item-analysis-controls">
            <label>
              เทคนิคแบ่งกลุ่มสูง–ต่ำ
              <select
                disabled={!editable}
                value={groupPercentage}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (isTestGroupPercentage(value)) setGroupPercentage(value);
                }}
              >
                <option value={0.25}>25%</option>
                <option value={0.27}>27% (นิยมใช้)</option>
                <option value={0.33}>33%</option>
                <option value={0.5}>50% (กลุ่มตัวอย่างน้อย)</option>
              </select>
            </label>
            <div className="item-template-size" aria-label="กำหนดขนาดแม่แบบ">
              <label>
                จำนวนข้อในแม่แบบ
                <input
                  disabled={!editable}
                  type="number"
                  min={1}
                  max={300}
                  value={templateItemCount}
                  onChange={(event) => setTemplateItemCount(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
                />
              </label>
              <label>
                จำนวนผู้เข้าสอบในแม่แบบ
                <input
                  disabled={!editable}
                  type="number"
                  min={2}
                  max={500}
                  value={templateRespondentCount}
                  onChange={(event) => setTemplateRespondentCount(Math.max(2, Math.min(500, Number(event.target.value) || 2)))}
                />
              </label>
            </div>
            <div className="item-input-actions">
              <button type="button" onClick={() => downloadTryoutTemplate(templateItemCount, templateRespondentCount)}>
                ↓ แม่แบบ Excel/CSV {templateRespondentCount} คน × {templateItemCount} ข้อ
              </button>
              <button
                type="button"
                disabled={!editable || !sharedTestText.trim()}
                onClick={() => onSharedTestTextChange("")}
              >
                ล้างคะแนน
              </button>
            </div>
          </div>
          <section className="item-template-grouping" aria-label="คำแนะนำการแบ่งกลุ่ม Try-out">
            <div className="item-template-grouping-head">
              <b>แนะนำการแบ่งกลุ่มสำหรับแม่แบบ {templateItemCount} ข้อ · ผู้เข้าสอบ {templateRespondentCount} คน</b>
              <small>อิงเทคนิค {groupPercentLabel} ที่เลือก</small>
            </div>
            <div className="item-template-group-cards">
              <div className="item-template-group-high"><span>กลุ่มเก่ง (High)</span><b>{recommendedTemplateGroups.upper} คน</b></div>
              <div className="item-template-group-middle"><span>กลุ่มกลาง</span><b>{recommendedTemplateGroups.middle} คน</b></div>
              <div className="item-template-group-low"><span>กลุ่มอ่อน (Low)</span><b>{recommendedTemplateGroups.lower} คน</b></div>
            </div>
            <small className="item-template-group-note">ระบบอัปเดตทันทีเมื่อเปลี่ยนจำนวนข้อ จำนวนผู้เข้าสอบ หรือวิธีแบ่งกลุ่ม โดยจำนวนผู้เข้าสอบและเปอร์เซ็นต์ที่เลือกเป็นตัวกำหนดจำนวนสมาชิกของแต่ละกลุ่ม</small>
          </section>
          <textarea
            disabled={!editable}
            rows={11}
            value={sharedTestText}
            placeholder={"1\t0\t1\t… จนครบทุกข้อ\n0\t1\t1\t… จนครบทุกข้อ\nวางต่อจนครบผู้สอบทุกคน"}
            onChange={(event) => onSharedTestTextChange(event.target.value)}
          />
          <div className={analysis.valid ? "data-note item-valid-note" : "data-note item-error-note"}>
            {analysis.valid
              ? analysis.respondentCount +
                " คน × " +
                analysis.itemCount +
                " ข้อ · ใช้เทคนิค " +
                groupPercentLabel +
                " กลุ่มละ " +
                analysis.groupSize +
                " คน · ตัดกลุ่มกลาง " +
                analysis.middleCount +
                " คน"
              : analysis.error ?? "ข้อมูลต้องเป็น Matrix 0/1 ที่ทุกแถวมีจำนวนข้อเท่ากัน"}
          </div>
        </div>
        <div className="metrics compact">
          <Metric
            label="ผู้เข้าสอบ Try-out"
            value={analysis.respondentCount + " คน"}
            note={analysis.respondentCount >= 30 && analysis.respondentCount <= 50 ? "อยู่ในช่วงที่นิยมใช้ 30–50 คน" : "โดยทั่วไปนิยมประมาณ 30–50 คน"}
          />
          <Metric
            label="ข้อฉบับร่าง"
            value={analysis.itemCount + " ข้อ"}
            note={analysis.itemCount ? "คำนวณตามจำนวนคอลัมน์ที่นำเข้า" : `แม่แบบตั้งไว้ ${templateItemCount} ข้อ`}
            tone="green"
          />
          <Metric
            label={`กลุ่มสูง / ต่ำ (${groupPercentLabel})`}
            value={`${analysis.groupSize} / ${analysis.groupSize} คน`}
            note={`กลุ่มกลาง ${analysis.middleCount} คนไม่นำมาคำนวณ`}
            tone="violet"
          />
          <Metric
            label="ข้อที่ผ่าน p และ r"
            value={analysis.selectedItems.length + " ข้อ"}
            note={analysis.selectedItems.length ? "ข้อ " + analysis.selectedItems.join(", ") : "ยังไม่มีข้อผ่านเกณฑ์"}
            tone="green"
          />
        </div>
      </section>
      <section className="panel item-analysis-guide">
        <div><b>1</b><span><strong>ตรวจให้คะแนน</strong><small>ตอบถูก = 1 · ตอบผิด = 0</small></span></div>
        <div><b>2</b><span><strong>เรียงคะแนนรวม</strong><small>จากคะแนนสูงสุดไปต่ำสุด</small></span></div>
        <div><b>3</b><span><strong>แบ่งกลุ่ม</strong><small>สูง–กลาง–ต่ำตาม {groupPercentLabel}</small></span></div>
        <div><b>4</b><span><strong>คำนวณรายข้อ</strong><small>R_H, R_L, p และ r</small></span></div>
      </section>
      {analysis.valid && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ขั้นที่ 2 · ตรวจการจัดกลุ่ม</span>
              <h3>อันดับคะแนนรวมและสมาชิกกลุ่มสูง–ต่ำ</h3>
              <p>ระบบเรียงคะแนนรวมอัตโนมัติ กลุ่มกลางแสดงไว้เพื่อตรวจสอบแต่ไม่นำไปคำนวณ p และ r</p>
            </div>
          </div>
          {(analysis.upperBoundaryTie || analysis.lowerBoundaryTie) && (
            <div className="item-boundary-warning">
              มีคะแนนเท่ากันตรงจุดตัดกลุ่ม ระบบคงจำนวนกลุ่มให้เท่ากันโดยใช้ลำดับแถวเดิมเป็นตัวตัดสิน กรุณาตรวจสอบรายชื่อก่อนใช้ผล
            </div>
          )}
          <div className="table-wrap item-ranking-table">
            <table>
              <thead>
                <tr><th>อันดับ</th><th>แถวข้อมูลเดิม</th><th>คะแนนรวม / {analysis.itemCount}</th><th>กลุ่ม</th></tr>
              </thead>
              <tbody>
                {analysis.rankedRespondents.map((respondent) => (
                  <tr key={respondent.sourceIndex}>
                    <td><b>{respondent.rank}</b></td>
                    <td>คนที่ {respondent.sourceIndex + 1}</td>
                    <td>{respondent.total}</td>
                    <td>
                      <span className={`pill item-group-${respondent.group}`}>
                        {respondent.group === "upper" ? "กลุ่มสูง (High)" : respondent.group === "lower" ? "กลุ่มต่ำ (Low)" : "กลุ่มกลาง · ไม่นำมาคำนวณ"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ขั้นที่ 3 · วิเคราะห์และคัดเลือกข้อ</span>
            <h3>ผลค่า p และ r รายข้อ</h3>
            <p>ผ่านเมื่อ p อยู่ระหว่าง 0.20–0.80 และ r ≥ 0.20 · ค่า r ติดลบควรตรวจโจทย์ ตัวเลือก เฉลย และการให้คะแนน</p>
          </div>
        </div>
        {analysis.valid ? <div className="table-wrap item-result-table">
          <table>
            <thead>
              <tr>
                <th>ข้อ</th><th>R<sub>H</sub></th><th>R<sub>L</sub></th><th>p</th><th>ระดับ p</th>
                <th>r</th><th>ระดับ r</th><th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {analysis.items.map((item) => (
                <tr key={item.item} className={item.selected ? "" : "item-row-rejected"}>
                  <td><b>{item.item}</b></td>
                  <td>{item.upperCorrect}</td>
                  <td>{item.lowerCorrect}</td>
                  <td>{fmt(item.difficulty, 3)}</td>
                  <td>{item.difficultyLabel}</td>
                  <td>{fmt(item.discrimination, 3)}</td>
                  <td>{item.discriminationLabel}</td>
                  <td>
                    <span className={item.selected ? "pill pass" : "pill revise"}>
                      {item.selected ? "คัดเลือก" : "ปรับปรุง/ตัดออก"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <div className="source-empty item-empty-result">ป้อนคะแนน Try-out ที่ถูกต้องเพื่อดูผลรายข้อ</div>}
        {analysis.valid && <div className="item-selection-summary">ผ่านทั้งสองเกณฑ์ {analysis.selectedItems.length} ข้อ · ไม่ผ่านเกณฑ์ p {rejectedByDifficulty} ข้อ · ไม่ผ่านเกณฑ์ r {rejectedByDiscrimination} ข้อ</div>}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ขั้นที่ 4 · ส่งต่อข้อที่ผ่าน</span>
            <h3>KR-20 ของแบบทดสอบที่คัดเลือก</h3>
            <p>
              ระบบนำเฉพาะข้อที่ผ่านเกณฑ์ p = 0.20–0.80 และ r ≥ 0.20
              จาก Matrix เดิมมาคำนวณโดยอัตโนมัติ
            </p>
          </div>
        </div>
        <div className="metric-grid">
          <Metric
            label="ข้อที่ใช้คำนวณ"
            value={analysis.selectedItems.length + " ข้อ"}
            note={
              analysis.selectedItems.length
                ? "ข้อ " + analysis.selectedItems.join(", ")
                : "ยังไม่มีข้อผ่านเกณฑ์"
            }
            tone="blue"
          />
          <Metric
            label="KR-20"
            value={fmt(reliability, 2)}
            note="ใช้ความแปรปรวนคะแนนรวมแบบตัวอย่าง (n−1)"
            tone="violet"
          />
          <Metric
            label="ระดับความเชื่อมั่น"
            value={reliabilityLevel}
            tone={reliability !== null && reliability >= 0.7 ? "green" : "amber"}
          />
        </div>
        <div className="data-note">{reliabilityReport}</div>
      </section>
      <section className="panel item-auto-report">
        <span className="eyebrow">ข้อความพร้อมใช้ในรายงานการวิจัย</span>
        <h3>สรุปวิธี Try-out และผลคัดเลือกข้อสอบ</h3>
        <p>{tryoutReport}</p>
      </section>
      <Formula source="แนวคิดการวิเคราะห์ข้อสอบแบบอิงกลุ่ม; พิชิต ฤทธิ์จรูญ และตำราการวัดผลการศึกษา">
        p = (R_H+R_L)/(2n), r = (R_H-R_L)/n และ KR-20 = [k/(k-1)]
        [1-Σpq/S²คะแนนรวม] โดย S² เป็นความแปรปรวนแบบตัวอย่าง (หารด้วย n−1)
      </Formula>
    </Page>
  );
}

function ReliabilityView({
  imported,
  initial,
  onChange,
  title,
  editable,
  sharedTestText,
  onSharedTestTextChange,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  title: string;
  editable: boolean;
  sharedTestText: string;
  onSharedTestTextChange: (value: string) => void;
}) {
  const legacyMatrix =
    typeof initial?.text === "string" ? parseMatrix(initial.text) : [];
  const legacyIsScale =
    legacyMatrix.length > 0 &&
    legacyMatrix.some((row) =>
      row.some((value) => value !== 0 && value !== 1),
    );
  const [scaleText, setScaleText] = useState(
    typeof initial?.scaleText === "string"
      ? initial.scaleText
      : legacyIsScale && typeof initial?.text === "string"
        ? initial.text
        : "3,3,3,2,3\n3,2,3,2,3\n3,3,2,3,3\n2,2,2,2,2\n3,3,3,3,3",
  );
  const scaleMatrix = parseMatrix(scaleText);
  const alpha = scaleMatrix[0]?.length ? cronbachAlpha(scaleMatrix) : null;
  const reliabilityRows: ExportCell[][] = [
    ["รายการ", "ผล"],
    ["ประเภทข้อมูล", "แบบสอบถามหลายระดับ"],
    ["จำนวนผู้ตอบ", scaleMatrix.length],
    ["จำนวนข้อ", scaleMatrix[0]?.length ?? 0],
    ["Cronbach’s alpha", fmt(alpha)],
    ["", ""],
    [
      "ผู้ตอบ",
      ...Array.from(
        { length: scaleMatrix[0]?.length ?? 0 },
        (_, index) => "ข้อ " + (index + 1),
      ),
    ],
    ...scaleMatrix.map((row, index) => [index + 1, ...row]),
  ];
  useEffect(() => {
    onChange(
      {
        reliabilityMode: "scale",
        scaleText,
      },
      {
        reliabilityMode: "scale",
        respondents: scaleMatrix.length,
        items: scaleMatrix[0]?.length ?? 0,
        alpha,
      },
    );
  }, [scaleText]);
  return (
    <Page
      title="ความเชื่อมั่นแบบสอบถาม"
      subtitle="คำนวณ Cronbach’s alpha จากข้อมูลมาตราส่วนหลายระดับ"
      badge="สำหรับแบบสอบถาม"
    >
      <section className="panel result-export-panel">
        <ResultExportToolbar
          title={title || "ผลความเชื่อมั่นของเครื่องมือ"}
          sheetName="ความเชื่อมั่น"
          rows={reliabilityRows}
        />
      </section>
      <section className="split">
        <div className="panel">
          <h3>เมทริกซ์คะแนนแบบสอบถาม</h3>
          <p>1 บรรทัด = ผู้ตอบ 1 คน · แต่ละคอลัมน์ = ข้อคำถาม · รองรับคะแนนหลายระดับ</p>
          <textarea
            disabled={!editable}
            rows={11}
            value={scaleText}
            onChange={(event) => setScaleText(event.target.value)}
          />
          <div className="data-note">
            {scaleMatrix.length + " คน × " + (scaleMatrix[0]?.length ?? 0) + " ข้อ"}
          </div>
        </div>
        <div className="metrics compact">
          <Metric
            label="Cronbach’s α"
            value={fmt(alpha)}
            note="ความสอดคล้องภายในของแบบสอบถาม"
            tone="violet"
          />
          <Metric
            label="ประเภทข้อมูล"
            value="มาตราส่วน"
            note="KR-20 ของแบบทดสอบอยู่ในเมนูคุณภาพแบบทดสอบ"
            tone="green"
          />
        </div>
      </section>
      <Formula source="Cronbach (1951); ตำราการวัดผลทางการศึกษา">
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
  title,
  editable,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  title: string;
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
  const comparisonRows: ExportCell[][] = [
    ["รายการ", "ผล"],
    ["มุมมอง", mode === "paired" ? "ก่อนเรียน–หลังเรียน" : "หลังเรียนเทียบเกณฑ์"],
    ["วิธีทดสอบ", METHOD_HELP[mode].find((method) => method.value === activeMethod)?.label ?? activeMethod],
    ["สมมติฐาน", activeAlternative || "ยังไม่ได้เลือก"],
    ["ระดับนัยสำคัญ (α)", alpha],
    ["จำนวนตัวอย่าง", activeSampleSize],
    ...(mode === "criterion" ? [["เกณฑ์", fmt(criterionScore)]] : []),
    ["p-value", fmtP(activeResult?.pValue)],
    ["ผลการทดสอบ", activeResult?.significant === true ? "มีนัยสำคัญ" : activeResult?.significant === false ? "ไม่มีนัยสำคัญ" : "ยังสรุปไม่ได้"],
    ...Object.entries(activeResult ?? {}).
      filter(([key, value]) => !["pValue", "significant"].includes(key) && typeof value !== "object")
      .map(([key, value]) => [`ผลลัพธ์: ${key}`, String(value ?? "")]),
    ["รายงานผลแบบย่อ", reports.short],
    ["", ""],
    mode === "paired"
      ? ["ลำดับ", "ก่อนเรียน", "หลังเรียน", "ผลต่าง (หลัง−ก่อน)"]
      : ["ลำดับ", "หลังเรียน", "เกณฑ์", "ผลต่าง (หลัง−เกณฑ์)"],
    ...(mode === "paired"
      ? Array.from(
          { length: Math.max(preValues.length, postValues.length) },
          (_, index) => [
            index + 1,
            preValues[index] ?? "",
            postValues[index] ?? "",
            preValues[index] === undefined || postValues[index] === undefined
              ? ""
              : postValues[index] - preValues[index],
          ],
        )
      : postValues.map((value, index) => [index + 1, value, criterionScore, value - criterionScore])),
  ];

  return (
    <Page
      title="ทดสอบก่อนเรียน–หลังเรียน"
      subtitle="เลือกสถิติพาราเมตริกหรือไม่อิงพารามิเตอร์ และเปรียบเทียบคะแนนหลังเรียนกับเกณฑ์"
      badge="เลือกวิธีทดสอบได้"
    >
      <div className="analysis-tabs" role="tablist" aria-label="ประเภทการเปรียบเทียบ">
        <button
          type="button"
          role="tab"
          title="ดูผลก่อนเรียน–หลังเรียน"
          aria-selected={mode === "paired"}
          className={mode === "paired" ? "active" : ""}
          onClick={() => setMode("paired")}
        >
          ก่อนเรียน–หลังเรียน
        </button>
        <button
          type="button"
          role="tab"
          title="ดูผลหลังเรียนเทียบเกณฑ์"
          aria-selected={mode === "criterion"}
          className={mode === "criterion" ? "active" : ""}
          onClick={() => setMode("criterion")}
        >
          หลังเรียนเทียบเกณฑ์
        </button>
      </div>

      <section className="panel result-export-panel">
        <ResultExportToolbar
          title={title || "ผลทดสอบก่อนเรียน-หลังเรียน"}
          sheetName={mode === "paired" ? "ก่อน-หลัง" : "หลังเทียบเกณฑ์"}
          rows={comparisonRows}
        />
      </section>

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

type IndividualColumnKey = "sequence" | "studentId" | "studentNumber" | "name" | "sex" | "pre" | "post" | "gain" | "criterion" | "passed" | "satisfaction" | "satisfactionLevel" | "followUp";

function splitImportedTable(text: string) {
  return text.split(/\r?\n/).map((line) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    return line.split(delimiter).map((cell) => cell.trim());
  }).filter((row) => row.some(Boolean));
}

function cleanImportedColumnLabel(label: string) {
  return label.replace(/^[A-Z]+\s*·\s*/i, "").trim();
}

function inferIndividualColumn(labels: string[], patterns: RegExp[], fallback = -1) {
  const found = labels.findIndex((label) => patterns.some((pattern) => pattern.test(label.toLowerCase())));
  return found >= 0 ? found : fallback;
}

function IndividualProgressView({ imported, initial, onChange, title, editable, analyses }: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
  title: string;
  editable: boolean;
  analyses: AnalysisRecord[];
}) {
  const importedLabels = imported?.selectedColumns?.map((column) => cleanImportedColumnLabel(column.label)) ?? [];
  const importedText = imported ? imported.rows.map((row) => row.join(",")).join("\n") : "";
  const defaultLabels = importedLabels.length ? importedLabels : ["รหัสนักเรียน", "เลขที่", "ชื่อ–สกุล", "เพศ", "ก่อนเรียน", "หลังเรียน", "ความพึงพอใจเฉลี่ย"];
  const [columnLabels, setColumnLabels] = useState<string[]>(
    Array.isArray(initial?.columnLabels) ? initial.columnLabels.map(String) : defaultLabels,
  );
  const [tableText, setTableText] = useState(
    typeof initial?.tableText === "string" ? initial.tableText : importedText,
  );
  const inferredPre = inferIndividualColumn(defaultLabels, [/ก่อน/, /pre/], Math.max(0, defaultLabels.length - 3));
  const inferredPost = inferIndividualColumn(defaultLabels, [/หลัง/, /post/], Math.max(0, defaultLabels.length - 2));
  const [studentIdColumn, setStudentIdColumn] = useState(Number(initial?.studentIdColumn ?? inferIndividualColumn(defaultLabels, [/รหัส/, /student.?id/, /^id$/], 0)));
  const [studentNumberColumn, setStudentNumberColumn] = useState(Number(initial?.studentNumberColumn ?? inferIndividualColumn(defaultLabels, [/เลขที่/, /number/, /ลำดับ/], 1)));
  const [nameColumn, setNameColumn] = useState(Number(initial?.nameColumn ?? inferIndividualColumn(defaultLabels, [/ชื่อ/, /name/], 2)));
  const [sexColumn, setSexColumn] = useState(Number(initial?.sexColumn ?? inferIndividualColumn(defaultLabels, [/เพศ/, /sex/, /gender/], 3)));
  const [preColumn, setPreColumn] = useState(Number(initial?.preColumn ?? inferredPre));
  const [postColumn, setPostColumn] = useState(Number(initial?.postColumn ?? inferredPost));
  const defaultSatisfaction = defaultLabels.map((label, index) => /พึง|satisfaction|ข้อ\s*\d+/i.test(label) ? index : -1).filter((index) => index >= 0);
  const [satisfactionColumns, setSatisfactionColumns] = useState<number[]>(
    Array.isArray(initial?.satisfactionColumns) ? initial.satisfactionColumns.map(Number) : defaultSatisfaction,
  );
  const [matchKey, setMatchKey] = useState<"studentId" | "studentNumber" | "name" | "row">(
    ["studentId", "studentNumber", "name", "row"].includes(String(initial?.matchKey)) ? initial?.matchKey as "studentId" | "studentNumber" | "name" | "row" : "studentId",
  );
  const [maximumScore, setMaximumScore] = useState(Number(initial?.maximumScore ?? 20));
  const [criterionMode, setCriterionMode] = useState<"percent" | "raw">(initial?.criterionMode === "raw" ? "raw" : "percent");
  const [criterionPercent, setCriterionPercent] = useState(Number(initial?.criterionPercent ?? 80));
  const [criterionRaw, setCriterionRaw] = useState(Number(initial?.criterionRaw ?? 16));
  const [scaleLevels, setScaleLevels] = useState<3 | 5>(Number(initial?.scaleLevels) === 5 ? 5 : 3);
  const [satisfactionThreshold, setSatisfactionThreshold] = useState(Number(initial?.satisfactionThreshold ?? 2.34));
  const [chartType, setChartType] = useState<"dumbbell" | "slope">(initial?.chartType === "slope" ? "slope" : "dumbbell");
  const [sortMode, setSortMode] = useState<"sequence" | "studentNumber" | "pre" | "post" | "gain">(
    ["studentNumber", "pre", "post", "gain"].includes(String(initial?.sortMode)) ? initial?.sortMode as "studentNumber" | "pre" | "post" | "gain" : "sequence",
  );
  const [anonymizeReport, setAnonymizeReport] = useState(initial?.anonymizeReport !== false);
  const [chartLabelMode, setChartLabelMode] = useState<"name" | "sequence" | "studentNumber" | "studentId">(
    ["name", "sequence", "studentNumber", "studentId"].includes(String(initial?.chartLabelMode))
      ? initial?.chartLabelMode as "name" | "sequence" | "studentNumber" | "studentId"
      : initial?.showTeacherNames === false ? "sequence" : "name",
  );
  const [showScoreLabels, setShowScoreLabels] = useState(Boolean(initial?.showScoreLabels));
  const [chartTitleMode, setChartTitleMode] = useState<"standard" | "analysis" | "custom">(
    ["analysis", "custom"].includes(String(initial?.chartTitleMode)) ? initial?.chartTitleMode as "analysis" | "custom" : "standard",
  );
  const [customChartTitle, setCustomChartTitle] = useState(String(initial?.customChartTitle ?? ""));
  const [showChartSubtitle, setShowChartSubtitle] = useState(initial?.showChartSubtitle !== false);
  const [customChartSubtitle, setCustomChartSubtitle] = useState(String(initial?.customChartSubtitle ?? ""));
  const [legendPosition, setLegendPosition] = useState<"inside" | "below" | "hidden">(
    ["below", "hidden"].includes(String(initial?.legendPosition)) ? initial?.legendPosition as "below" | "hidden" : "inside",
  );
  const [axisMode, setAxisMode] = useState<"auto" | "manual">(initial?.axisMode === "manual" ? "manual" : "auto");
  const [axisMinimum, setAxisMinimum] = useState(Number(initial?.axisMinimum ?? 0));
  const [axisMaximum, setAxisMaximum] = useState(Number(initial?.axisMaximum ?? 20));
  const [axisTickInterval, setAxisTickInterval] = useState(Number(initial?.axisTickInterval ?? 2.5));
  const [showCriterionLine, setShowCriterionLine] = useState(initial?.showCriterionLine !== false);
  const [onlyFollowUp, setOnlyFollowUp] = useState(Boolean(initial?.onlyFollowUp));
  const [followRules, setFollowRules] = useState({
    failed: initial?.followRules && typeof initial.followRules === "object" ? (initial.followRules as Record<string, boolean>).failed !== false : true,
    noGain: initial?.followRules && typeof initial.followRules === "object" ? Boolean((initial.followRules as Record<string, boolean>).noGain) : false,
    lowGain: initial?.followRules && typeof initial.followRules === "object" ? Boolean((initial.followRules as Record<string, boolean>).lowGain) : false,
    lowSatisfaction: initial?.followRules && typeof initial.followRules === "object" ? (initial.followRules as Record<string, boolean>).lowSatisfaction !== false : true,
    incomplete: initial?.followRules && typeof initial.followRules === "object" ? (initial.followRules as Record<string, boolean>).incomplete !== false : true,
  });
  const [minimumGain, setMinimumGain] = useState(Number(initial?.minimumGain ?? 1));
  const defaultVisible: Record<IndividualColumnKey, boolean> = { sequence: true, studentId: true, studentNumber: true, name: true, sex: false, pre: true, post: true, gain: true, criterion: true, passed: true, satisfaction: true, satisfactionLevel: true, followUp: true };
  const [visibleColumns, setVisibleColumns] = useState<Record<IndividualColumnKey, boolean>>(
    initial?.visibleColumns && typeof initial.visibleColumns === "object" ? { ...defaultVisible, ...(initial.visibleColumns as Partial<Record<IndividualColumnKey, boolean>>) } : defaultVisible,
  );
  const [pairedAnalysisId, setPairedAnalysisId] = useState("");
  const [qualityAnalysisId, setQualityAnalysisId] = useState("");
  const [sourceNotice, setSourceNotice] = useState("");
  const chartRef = useRef<SVGSVGElement>(null);
  const rows = useMemo(() => splitImportedTable(tableText), [tableText]);
  const criterionScore = criterionMode === "percent" ? maximumScore * criterionPercent / 100 : criterionRaw;
  const bands = scaleLevels === 3 ? threeLevelSatisfactionBands : traditionalFiveLevelBands;

  const records = useMemo(() => rows.map((row, index) => {
    const numeric = (column: number) => column >= 0 && String(row[column] ?? "").trim() !== "" && Number.isFinite(Number(row[column])) ? Number(row[column]) : null;
    const pre = numeric(preColumn);
    const post = numeric(postColumn);
    const satisfactionValues = satisfactionColumns.flatMap((column) => {
      const value = numeric(column);
      return value !== null && value >= 1 && value <= scaleLevels ? [value] : [];
    });
    const satisfactionMean = mean(satisfactionValues);
    const complete = pre !== null && post !== null && satisfactionValues.length === satisfactionColumns.length && satisfactionColumns.length > 0;
    const gain = pre !== null && post !== null ? post - pre : null;
    const passed = post !== null ? post >= criterionScore : null;
    const reasons = [
      followRules.failed && passed === false ? "ไม่ผ่านเกณฑ์" : "",
      followRules.noGain && gain !== null && gain <= 0 ? "คะแนนไม่เพิ่ม" : "",
      followRules.lowGain && gain !== null && gain < minimumGain ? `Gain ต่ำกว่า ${minimumGain}` : "",
      followRules.lowSatisfaction && satisfactionMean !== null && satisfactionMean < satisfactionThreshold ? "ความพึงพอใจต่ำกว่าเกณฑ์" : "",
      followRules.incomplete && !complete ? "ข้อมูลไม่ครบ" : "",
    ].filter(Boolean);
    return {
      sequence: index + 1,
      studentId: String(row[studentIdColumn] ?? "").trim(),
      studentNumber: String(row[studentNumberColumn] ?? "").trim(),
      name: String(row[nameColumn] ?? "").trim(),
      sex: String(row[sexColumn] ?? "").trim(),
      pre, post, gain, passed, satisfactionMean,
      satisfactionLevel: interpretQuality(satisfactionMean, bands),
      followUp: reasons.length > 0,
      reasons,
    };
  }), [rows, preColumn, postColumn, studentIdColumn, studentNumberColumn, nameColumn, sexColumn, satisfactionColumns, scaleLevels, criterionScore, followRules, minimumGain, satisfactionThreshold, bands]);

  const duplicateKeys = useMemo(() => {
    if (matchKey === "row") return [];
    const column = matchKey === "studentId" ? studentIdColumn : matchKey === "studentNumber" ? studentNumberColumn : nameColumn;
    const values = rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean);
    return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  }, [matchKey, rows, studentIdColumn, studentNumberColumn, nameColumn]);
  const sortedRecords = useMemo(() => [...records].sort((a, b) => {
    if (sortMode === "sequence") return a.sequence - b.sequence;
    if (sortMode === "studentNumber") return Number(a.studentNumber || Infinity) - Number(b.studentNumber || Infinity);
    return Number(a[sortMode] ?? -Infinity) - Number(b[sortMode] ?? -Infinity);
  }), [records, sortMode]);
  const chartRecords = onlyFollowUp ? sortedRecords.filter((record) => record.followUp) : sortedRecords;
  const teacherRecords = records.map((record, index) => ({ ...record, displayName: record.name || record.studentId || `คนที่ ${index + 1}` }));
  const exportRecords = records.map((record, index) => ({ ...record, displayName: anonymizeReport ? `คนที่ ${index + 1}` : record.name || record.studentId || `คนที่ ${index + 1}` }));
  const columnDefinitions: Array<{ key: IndividualColumnKey; label: string; value: (record: typeof exportRecords[number]) => ExportCell }> = [
    { key: "sequence", label: "ลำดับ", value: (record) => record.sequence },
    { key: "studentId", label: "รหัสนักเรียน", value: (record) => record.studentId },
    { key: "studentNumber", label: "เลขที่", value: (record) => record.studentNumber },
    { key: "name", label: "นักเรียน", value: (record) => record.displayName },
    { key: "sex", label: "เพศ", value: (record) => record.sex },
    { key: "pre", label: "ก่อนเรียน", value: (record) => record.pre ?? "" },
    { key: "post", label: "หลังเรียน", value: (record) => record.post ?? "" },
    { key: "gain", label: "Gain", value: (record) => record.gain ?? "" },
    { key: "criterion", label: "เกณฑ์", value: () => fmt(criterionScore, 2) },
    { key: "passed", label: "ผลเกณฑ์", value: (record) => record.passed === null ? "ข้อมูลไม่ครบ" : record.passed ? "ผ่าน" : "ไม่ผ่าน" },
    { key: "satisfaction", label: "ความพึงพอใจเฉลี่ย", value: (record) => fmt(record.satisfactionMean, 2) },
    { key: "satisfactionLevel", label: "ระดับความพึงพอใจ", value: (record) => record.satisfactionLevel },
    { key: "followUp", label: "สถานะติดตาม", value: (record) => record.followUp ? record.reasons.join("; ") : "ปกติ" },
  ];
  const activeColumns = columnDefinitions.filter((column) => visibleColumns[column.key]);
  const exportRows: ExportCell[][] = [
    activeColumns.map((column) => column.label),
    ...exportRecords.map((record) => activeColumns.map((column) => anonymizeReport && (column.key === "studentId" || column.key === "studentNumber") ? "—" : column.value(record))),
    [],
    ["สรุป", `n = ${records.length}`, `ผ่าน ${records.filter((record) => record.passed).length} คน`, `ควรติดตาม ${records.filter((record) => record.followUp).length} คน`, `Gain เฉลี่ย ${fmt(mean(records.flatMap((record) => record.gain === null ? [] : [record.gain])), 2)}`, `ความพึงพอใจเฉลี่ย ${fmt(mean(records.flatMap((record) => record.satisfactionMean === null ? [] : [record.satisfactionMean])), 2)}`],
  ];
  const reportText = `นักเรียนจำนวน ${records.length} คน มีคะแนนก่อนเรียนเฉลี่ย ${fmt(mean(records.flatMap((record) => record.pre === null ? [] : [record.pre])), 2)} คะแนน และคะแนนหลังเรียนเฉลี่ย ${fmt(mean(records.flatMap((record) => record.post === null ? [] : [record.post])), 2)} คะแนน โดยมี Gain เฉลี่ย ${fmt(mean(records.flatMap((record) => record.gain === null ? [] : [record.gain])), 2)} คะแนน ผ่านเกณฑ์ ${fmt(criterionScore, 2)} คะแนน จำนวน ${records.filter((record) => record.passed).length} คน และมีความพึงพอใจเฉลี่ย ${fmt(mean(records.flatMap((record) => record.satisfactionMean === null ? [] : [record.satisfactionMean])), 2)} จาก ${scaleLevels} ระดับ ทั้งนี้พบผู้ที่เข้าเงื่อนไขควรติดตาม ${records.filter((record) => record.followUp).length} คน`;
  const resolvedChartTitle = chartTitleMode === "analysis"
    ? title || "แผนภูมิเปรียบเทียบคะแนนก่อนเรียน–หลังเรียนรายบุคคล"
    : chartTitleMode === "custom"
      ? customChartTitle.trim() || "แผนภูมิเปรียบเทียบคะแนนก่อนเรียน–หลังเรียนรายบุคคล"
      : "แผนภูมิเปรียบเทียบคะแนนก่อนเรียน–หลังเรียนรายบุคคล";
  const automaticChartSubtitle = showCriterionLine
    ? criterionMode === "percent"
      ? `พร้อมเส้นเกณฑ์ร้อยละ ${fmt(criterionPercent, 0)} (${fmt(criterionScore, 2)} คะแนน)`
      : `พร้อมเส้นเกณฑ์ ${fmt(criterionScore, 2)} คะแนน`
    : `คะแนนเต็ม ${fmt(maximumScore, 0)} คะแนน`;
  const resolvedChartSubtitle = showChartSubtitle ? customChartSubtitle.trim() || automaticChartSubtitle : "";

  useEffect(() => {
    onChange({ columnLabels, tableText, studentIdColumn, studentNumberColumn, nameColumn, sexColumn, preColumn, postColumn, satisfactionColumns, matchKey, maximumScore, criterionMode, criterionPercent, criterionRaw, scaleLevels, satisfactionThreshold, chartType, sortMode, anonymizeReport, chartLabelMode, showScoreLabels, chartTitleMode, customChartTitle, showChartSubtitle, customChartSubtitle, legendPosition, axisMode, axisMinimum, axisMaximum, axisTickInterval, showCriterionLine, onlyFollowUp, followRules, minimumGain, visibleColumns }, { respondentCount: records.length, criterionScore, passedCount: records.filter((record) => record.passed).length, followUpCount: records.filter((record) => record.followUp).length, duplicateKeys, records });
  }, [columnLabels, tableText, studentIdColumn, studentNumberColumn, nameColumn, sexColumn, preColumn, postColumn, satisfactionColumns, matchKey, maximumScore, criterionMode, criterionPercent, criterionRaw, scaleLevels, satisfactionThreshold, chartType, sortMode, anonymizeReport, chartLabelMode, showScoreLabels, chartTitleMode, customChartTitle, showChartSubtitle, customChartSubtitle, legendPosition, axisMode, axisMinimum, axisMaximum, axisTickInterval, showCriterionLine, onlyFollowUp, followRules, minimumGain, visibleColumns, records, criterionScore, duplicateKeys, onChange]);

  function loadSavedAnalyses() {
    const paired = analyses.find((analysis) => analysis.id === pairedAnalysisId);
    const quality = analyses.find((analysis) => analysis.id === qualityAnalysisId);
    if (!paired || !quality) { setSourceNotice("กรุณาเลือกงานก่อน–หลังและงานความพึงพอใจให้ครบ"); return; }
    const pre = parseNumbers(String(paired.input_json?.workspace?.pre ?? ""));
    const post = parseNumbers(String(paired.input_json?.workspace?.post ?? ""));
    const qualityText = String(quality.input_json?.workspace?.text ?? quality.input_json?.workspace?.scaleText ?? "");
    const qualityMatrix = parseMatrix(qualityText);
    const count = Math.max(pre.length, post.length, qualityMatrix.length);
    const nextRows = Array.from({ length: count }, (_, index) => [index + 1, pre[index] ?? "", post[index] ?? "", mean(qualityMatrix[index] ?? []) ?? ""]);
    const labels = ["ลำดับ", "ก่อนเรียน", "หลังเรียน", "ความพึงพอใจเฉลี่ย"];
    setColumnLabels(labels); setTableText(nextRows.map((row) => row.join(",")).join("\n"));
    setStudentIdColumn(-1); setStudentNumberColumn(0); setNameColumn(-1); setSexColumn(-1); setPreColumn(1); setPostColumn(2); setSatisfactionColumns([3]); setMatchKey("row");
    setScaleLevels(Number(quality.input_json?.workspace?.scaleLevels) === 5 ? 5 : 3);
    setSourceNotice("นำข้อมูลจากงานเดิมแล้ว · งานเดิมไม่มีรหัสร่วม จึงจับคู่ตามลำดับแถว กรุณาตรวจสอบรายคนก่อนใช้ผล");
  }

  async function exportChart(copy: boolean) {
    if (!chartRef.current) return;
    const exportNode = chartRef.current.cloneNode(true) as SVGSVGElement;
    if (anonymizeReport) exportNode.querySelectorAll<SVGTextElement>("[data-person-number]").forEach((node) => {
      node.textContent = `คนที่ ${Number(node.dataset.personNumber)}`;
    });
    const svg = new XMLSerializer().serializeToString(exportNode);
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 1400; canvas.height = Math.max(700, chartRef.current?.viewBox.baseVal.height ? chartRef.current.viewBox.baseVal.height * 1.5 : 700);
      const context = canvas.getContext("2d"); if (!context) return;
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (copy && navigator.clipboard && typeof ClipboardItem !== "undefined") await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        else downloadFile(blob, `${safeFilename(title || "แผนภูมิพัฒนาการ")}.png`);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  const fieldOptions = <>{columnLabels.map((label, index) => <option key={index} value={index}>{index + 1}. {label}</option>)}</>;
  const pairedAnalyses = analyses.filter((analysis) => analysis.analysis_type === "paired");
  const qualityAnalyses = analyses.filter((analysis) => analysis.analysis_type === "quality" || analysis.analysis_type === "descriptive" || analysis.analysis_type === "reliability");
  return <Page title="รายบุคคลและแผนภูมิพัฒนาการ" subtitle="รวมคะแนนก่อน–หลัง การผ่านเกณฑ์ และความพึงพอใจในมุมมองเดียว" badge="ปกปิดชื่อในรายงานได้">
    <section className="panel individual-source-panel"><div className="panel-head"><div><span className="eyebrow">แหล่งข้อมูล</span><h3>เลือกงานเดิมหรือนำเข้าไฟล์ตารางรวม</h3><p>หากข้อมูลมีรหัสร่วม แนะนำให้ใช้รหัสนักเรียนเป็นกุญแจจับคู่</p></div></div><div className="individual-saved-source"><label>งานก่อนเรียน–หลังเรียน<select disabled={!editable} value={pairedAnalysisId} onChange={(event) => setPairedAnalysisId(event.target.value)}><option value="">— เลือกงาน —</option>{pairedAnalyses.map((analysis) => <option key={analysis.id} value={analysis.id}>{analysis.title}</option>)}</select></label><label>งานความพึงพอใจ<select disabled={!editable} value={qualityAnalysisId} onChange={(event) => setQualityAnalysisId(event.target.value)}><option value="">— เลือกงาน —</option>{qualityAnalyses.map((analysis) => <option key={analysis.id} value={analysis.id}>{analysis.title}</option>)}</select></label><button disabled={!editable} onClick={loadSavedAnalyses}>รวมงานที่เลือก</button></div>{sourceNotice && <div className="data-note">{sourceNotice}</div>}</section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">กำหนดคอลัมน์</span><h3>จับคู่ข้อมูลรายบุคคล</h3><p>เลือกคอลัมน์ตามหัวข้อจริงในไฟล์ ระบบจะไม่ใช้ชื่อหรือรหัสเป็นคะแนนคำนวณ</p></div></div><div className="individual-map-grid"><label>กุญแจจับคู่<select disabled={!editable} value={matchKey} onChange={(event) => setMatchKey(event.target.value as typeof matchKey)}><option value="studentId">รหัสนักเรียน</option><option value="studentNumber">เลขที่</option><option value="name">ชื่อ–สกุล</option><option value="row">ลำดับแถว</option></select></label>{[["รหัสนักเรียน", studentIdColumn, setStudentIdColumn], ["เลขที่", studentNumberColumn, setStudentNumberColumn], ["ชื่อ–สกุล", nameColumn, setNameColumn], ["เพศ", sexColumn, setSexColumn], ["คะแนนก่อนเรียน", preColumn, setPreColumn], ["คะแนนหลังเรียน", postColumn, setPostColumn]].map(([label, value, setter]) => <label key={String(label)}>{String(label)}<select disabled={!editable} value={Number(value)} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(event.target.value))}><option value={-1}>— ไม่ใช้ —</option>{fieldOptions}</select></label>)}</div><div className="satisfaction-column-picker"><b>คอลัมน์คะแนนความพึงพอใจ</b><small>เลือกได้ทั้งคอลัมน์ค่าเฉลี่ย หรือหลายข้อเพื่อให้ระบบเฉลี่ยรายคน</small><div>{columnLabels.map((label, index) => <label key={index}><input disabled={!editable} type="checkbox" checked={satisfactionColumns.includes(index)} onChange={(event) => setSatisfactionColumns((current) => event.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter((value) => value !== index))}/>{index + 1}. {label}</label>)}</div></div><textarea disabled={!editable} rows={9} value={tableText} onChange={(event) => setTableText(event.target.value)} placeholder="หนึ่งบรรทัดต่อนักเรียนหนึ่งคน"/>{duplicateKeys.length > 0 && <div className="import-error">พบกุญแจซ้ำ: {duplicateKeys.join(", ")}</div>}<div className="data-note">พบข้อมูล {records.length} คน · คอลัมน์ {columnLabels.length} ช่อง · จับคู่ด้วย {matchKey === "studentId" ? "รหัสนักเรียน" : matchKey === "studentNumber" ? "เลขที่" : matchKey === "name" ? "ชื่อ–สกุล" : "ลำดับแถว"}</div></section>
    <section className="panel individual-settings"><div className="panel-head"><div><span className="eyebrow">เกณฑ์และการติดตาม</span><h3>กำหนดเงื่อนไขได้ทุกข้อ</h3></div></div><div className="individual-setting-grid"><label>คะแนนเต็ม<input disabled={!editable} type="number" min={1} value={maximumScore} onChange={(event) => setMaximumScore(Number(event.target.value) || 1)}/></label><label>รูปแบบเกณฑ์<select disabled={!editable} value={criterionMode} onChange={(event) => setCriterionMode(event.target.value as "percent" | "raw")}><option value="percent">ร้อยละ</option><option value="raw">คะแนนดิบ</option></select></label>{criterionMode === "percent" ? <label>เกณฑ์ร้อยละ<input disabled={!editable} type="number" min={0} max={100} value={criterionPercent} onChange={(event) => setCriterionPercent(Number(event.target.value))}/></label> : <label>คะแนนเกณฑ์<input disabled={!editable} type="number" value={criterionRaw} onChange={(event) => setCriterionRaw(Number(event.target.value))}/></label>}<label>มาตราส่วนความพึงพอใจ<select disabled={!editable} value={scaleLevels} onChange={(event) => { const level = Number(event.target.value) as 3 | 5; setScaleLevels(level); setSatisfactionThreshold(level === 3 ? 2.34 : 3.51); }}><option value={3}>3 ระดับ</option><option value={5}>5 ระดับ</option></select></label><label>เกณฑ์ติดตามความพึงพอใจ<input disabled={!editable} type="number" min={1} max={scaleLevels} step="0.01" value={satisfactionThreshold} onChange={(event) => setSatisfactionThreshold(Number(event.target.value))}/></label><label>Gain ขั้นต่ำ<input disabled={!editable} type="number" value={minimumGain} onChange={(event) => setMinimumGain(Number(event.target.value))}/></label></div><div className="follow-rule-grid">{[["failed", "ไม่ผ่านเกณฑ์"], ["noGain", "คะแนนไม่เพิ่ม"], ["lowGain", "Gain ต่ำกว่าที่กำหนด"], ["lowSatisfaction", "ความพึงพอใจต่ำกว่าเกณฑ์"], ["incomplete", "ข้อมูลไม่ครบ"]].map(([key, label]) => <label key={key}><input disabled={!editable} type="checkbox" checked={followRules[key as keyof typeof followRules]} onChange={(event) => setFollowRules((current) => ({ ...current, [key]: event.target.checked }))}/>{label}</label>)}</div></section>
    <div className="metrics"><Metric label="นักเรียน" value={`${records.length} คน`}/><Metric label="ผ่านเกณฑ์" value={`${records.filter((record) => record.passed).length} คน`} tone="green"/><Metric label="Gain เฉลี่ย" value={fmt(mean(records.flatMap((record) => record.gain === null ? [] : [record.gain])), 2)} tone="amber"/><Metric label="ควรติดตาม" value={`${records.filter((record) => record.followUp).length} คน`} tone="violet"/></div>
    <section className="panel"><div className="panel-head individual-report-head"><div><span className="eyebrow">ตารางสำหรับครูและบทที่ 4</span><h3>ข้อมูลรายบุคคลแบบบูรณาการ</h3><p>จอครูแสดงชื่อจริง ส่วนไฟล์ส่งออกปกปิดตัวตนตามตัวเลือก</p></div><div className="individual-privacy-actions"><label><input type="checkbox" checked={anonymizeReport} onChange={(event) => setAnonymizeReport(event.target.checked)}/> ไฟล์บทที่ 4 ใช้ “คนที่ 1–n”</label><ResultExportToolbar title={title || "รายงานผลรายบุคคล"} sheetName="รายบุคคล" rows={exportRows}/></div></div><details className="column-visibility"><summary>เลือกคอลัมน์ที่แสดงและส่งออก</summary><div>{columnDefinitions.map((column) => <label key={column.key}><input type="checkbox" checked={visibleColumns[column.key]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [column.key]: event.target.checked }))}/>{column.label}</label>)}</div></details><div className="table-wrap"><table className="individual-integrated-table"><thead><tr>{activeColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{teacherRecords.map((record) => <tr key={record.sequence} className={record.followUp ? "follow-up-row" : ""}>{activeColumns.map((column) => <td key={column.key}>{column.value(record)}</td>)}</tr>)}</tbody></table></div></section>
    <section className="panel individual-chart-panel">
      <div className="panel-head individual-chart-head">
        <div><span className="eyebrow">แผนภูมิรายบุคคล</span><h3>{chartType === "dumbbell" ? "Dumbbell Chart" : "Slope Chart"}</h3></div>
        <div className="chart-actions"><button className={chartType === "dumbbell" ? "active" : ""} onClick={() => setChartType("dumbbell")}>Dumbbell</button><button className={chartType === "slope" ? "active" : ""} onClick={() => setChartType("slope")}>Slope</button><button onClick={() => void exportChart(true)}>คัดลอกภาพ</button><button onClick={() => void exportChart(false)}>PNG</button></div>
      </div>
      <details className="chart-config-panel" open>
        <summary>ตั้งค่ารายละเอียดกราฟ</summary>
        <div className="chart-settings-grid">
          <label>เรียงตาม<select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}><option value="sequence">ลำดับข้อมูล</option><option value="studentNumber">เลขที่นักเรียน</option><option value="pre">คะแนนก่อนเรียน</option><option value="post">คะแนนหลังเรียน</option><option value="gain">ผลต่างคะแนน</option></select></label>
          <label>ป้ายชื่อรายบุคคล<select value={chartLabelMode} onChange={(event) => setChartLabelMode(event.target.value as typeof chartLabelMode)}><option value="name">ชื่อจริง</option><option value="sequence">คนที่ 1–n</option><option value="studentNumber">เลขที่นักเรียน</option><option value="studentId">รหัสนักเรียน</option></select></label>
          <label>ชื่อกราฟ<select value={chartTitleMode} onChange={(event) => setChartTitleMode(event.target.value as typeof chartTitleMode)}><option value="standard">ชื่อมาตรฐาน</option><option value="analysis">ชื่องานวิเคราะห์</option><option value="custom">ป้อนเอง</option></select></label>
          <label>ตำแหน่งคำอธิบายสี<select value={legendPosition} onChange={(event) => setLegendPosition(event.target.value as typeof legendPosition)}><option value="inside">ภายในกราฟ</option><option value="below">ด้านล่างกราฟ</option><option value="hidden">ซ่อน</option></select></label>
          <label>ช่วงแกนคะแนน<select value={axisMode} onChange={(event) => setAxisMode(event.target.value as "auto" | "manual")}><option value="auto">อัตโนมัติตามคะแนนเต็ม</option><option value="manual">กำหนดเอง</option></select></label>
          {chartTitleMode === "custom" && <label className="chart-wide-setting">ข้อความชื่อกราฟ<input value={customChartTitle} onChange={(event) => setCustomChartTitle(event.target.value)} placeholder="แผนภูมิเปรียบเทียบคะแนนก่อนเรียน–หลังเรียนรายบุคคล"/></label>}
          <label className="chart-wide-setting">คำบรรยายใต้ชื่อกราฟ<input disabled={!showChartSubtitle} value={customChartSubtitle} onChange={(event) => setCustomChartSubtitle(event.target.value)} placeholder={automaticChartSubtitle}/></label>
          {axisMode === "manual" && <><label>ค่าเริ่มต้นแกน<input type="number" value={axisMinimum} onChange={(event) => setAxisMinimum(Number(event.target.value))}/></label><label>ค่าสูงสุดแกน<input type="number" value={axisMaximum} onChange={(event) => setAxisMaximum(Number(event.target.value))}/></label><label>ช่วงเส้นแบ่ง<input type="number" min="0.01" step="0.5" value={axisTickInterval} onChange={(event) => setAxisTickInterval(Number(event.target.value))}/></label></>}
        </div>
        {axisMode === "manual" && (axisMaximum <= axisMinimum || axisTickInterval <= 0) && <div className="import-error">ช่วงแกนไม่ถูกต้อง: ค่าสูงสุดต้องมากกว่าค่าเริ่มต้น และช่วงเส้นแบ่งต้องมากกว่า 0</div>}
        <div className="individual-chart-options">
          <label><input type="checkbox" checked={showScoreLabels} onChange={(event) => setShowScoreLabels(event.target.checked)}/> แสดงตัวเลขคะแนนข้างจุด</label>
          <label><input type="checkbox" checked={showChartSubtitle} onChange={(event) => setShowChartSubtitle(event.target.checked)}/> แสดงคำบรรยายใต้ชื่อ</label>
          <label><input type="checkbox" checked={showCriterionLine} onChange={(event) => setShowCriterionLine(event.target.checked)}/> แสดงเส้นเกณฑ์</label>
          <label><input type="checkbox" checked={onlyFollowUp} onChange={(event) => setOnlyFollowUp(event.target.checked)}/> เฉพาะผู้ควรติดตาม</label>
        </div>
      </details>
      <div className="chart-hover-note">ชี้เมาส์หรือแตะจุดเพื่อดูชื่อ คะแนนก่อน–หลัง ผลต่าง และผลผ่านเกณฑ์</div>
      <div className="individual-chart-scroll"><IndividualProgressChart ref={chartRef} records={chartRecords} type={chartType} maximumScore={maximumScore} criterion={criterionScore} showCriterion={showCriterionLine} anonymize={false} labelMode={chartLabelMode} showScoreLabels={showScoreLabels} chartTitle={resolvedChartTitle} chartSubtitle={resolvedChartSubtitle} legendPosition={legendPosition} axisMinimum={axisMode === "auto" ? 0 : axisMinimum} axisMaximum={axisMode === "auto" ? maximumScore : axisMaximum} tickInterval={axisMode === "auto" ? maximumScore / 8 : axisTickInterval} criterionLabel={criterionMode === "percent" ? `เกณฑ์ร้อยละ ${fmt(criterionPercent, 0)} (${fmt(criterionScore, 2)} คะแนน)` : `เกณฑ์ ${fmt(criterionScore, 2)} คะแนน`}/></div>
    </section>
    <section className="panel automatic-report"><div className="panel-head"><div><span className="eyebrow">พร้อมใช้ในบทที่ 4</span><h3>รายงานผลอัตโนมัติ</h3></div><button onClick={() => void copyToClipboard(reportText)}>คัดลอกข้อความ</button></div><p>{reportText}</p></section>
    <Formula source="การวิเคราะห์รายบุคคลเชิงพรรณนา; คะแนนพัฒนาการและเกณฑ์ที่ผู้วิจัยกำหนด">Gain = คะแนนหลังเรียน − คะแนนก่อนเรียน · ผ่านเมื่อคะแนนหลังเรียน ≥ คะแนนเกณฑ์ · ความพึงพอใจรายคน = ผลรวมคะแนนข้อประเมิน ÷ จำนวนข้อที่ตอบจริง</Formula>
  </Page>;
}

type IndividualChartRecord = {
  sequence: number;
  studentId: string;
  studentNumber: string;
  name: string;
  pre: number | null;
  post: number | null;
  gain: number | null;
  passed: boolean | null;
  followUp: boolean;
};

const IndividualProgressChart = forwardRef<SVGSVGElement, {
  records: IndividualChartRecord[];
  type: "dumbbell" | "slope";
  maximumScore: number;
  criterion: number;
  showCriterion: boolean;
  anonymize: boolean;
  labelMode: "name" | "sequence" | "studentNumber" | "studentId";
  showScoreLabels: boolean;
  chartTitle: string;
  chartSubtitle: string;
  legendPosition: "inside" | "below" | "hidden";
  axisMinimum: number;
  axisMaximum: number;
  tickInterval: number;
  criterionLabel: string;
}>(function IndividualProgressChart({
  records,
  type,
  maximumScore,
  criterion,
  showCriterion,
  anonymize,
  labelMode,
  showScoreLabels,
  chartTitle,
  chartSubtitle,
  legendPosition,
  axisMinimum,
  axisMaximum,
  tickInterval,
  criterionLabel,
}, ref) {
  const width = 1000;
  const safeMinimum = Number.isFinite(axisMinimum) ? axisMinimum : 0;
  const safeMaximum = Number.isFinite(axisMaximum) && axisMaximum > safeMinimum ? axisMaximum : Math.max(maximumScore, safeMinimum + 1);
  const safeTick = Number.isFinite(tickInterval) && tickInterval > 0 ? tickInterval : (safeMaximum - safeMinimum) / 8;
  const tickCount = Math.min(20, Math.max(1, Math.floor((safeMaximum - safeMinimum) / safeTick)));
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => safeMinimum + safeTick * index)
    .filter((value) => value <= safeMaximum + Number.EPSILON);
  if (ticks.at(-1) !== safeMaximum) ticks.push(safeMaximum);
  const top = chartSubtitle ? 92 : 70;
  const legendBelow = legendPosition === "below";
  const bottom = legendBelow ? 132 : 72;
  const height = type === "dumbbell" ? Math.max(430, top + records.length * 46 + bottom) : 650 + (legendBelow ? 55 : 0);
  const left = type === "dumbbell" ? 178 : 225;
  const right = type === "dumbbell" ? 58 : 225;
  const scoreRange = safeMaximum - safeMinimum;
  const clampScore = (value: number) => Math.max(safeMinimum, Math.min(safeMaximum, value));
  const xScore = (value: number) => left + ((clampScore(value) - safeMinimum) / scoreRange) * (width - left - right);
  const yScore = (value: number) => top + (1 - (clampScore(value) - safeMinimum) / scoreRange) * (height - top - bottom);
  const labelFor = (record: IndividualChartRecord) => {
    if (anonymize || labelMode === "sequence") return `คนที่ ${record.sequence}`;
    if (labelMode === "studentNumber") return record.studentNumber ? `เลขที่ ${record.studentNumber}` : `คนที่ ${record.sequence}`;
    if (labelMode === "studentId") return record.studentId || `คนที่ ${record.sequence}`;
    return record.name || record.studentId || `คนที่ ${record.sequence}`;
  };
  const tooltipFor = (record: IndividualChartRecord) => [
    record.name || `คนที่ ${record.sequence}`,
    `ก่อนเรียน: ${record.pre ?? "—"} คะแนน`,
    `หลังเรียน: ${record.post ?? "—"} คะแนน`,
    `ผลต่าง: ${record.gain === null ? "—" : record.gain >= 0 ? `+${record.gain}` : record.gain} คะแนน`,
    `ผลเกณฑ์: ${record.passed === null ? "ข้อมูลไม่ครบ" : record.passed ? "ผ่าน" : "ไม่ผ่าน"}`,
  ].join("\n");
  const titleFontSize = chartTitle.length > 75 ? 15 : chartTitle.length > 55 ? 17 : 20;
  const legend = legendPosition === "hidden" ? null : legendBelow ? (
    <g className="chart-legend chart-legend-horizontal" transform={`translate(${width / 2} ${height - 31})`}>
      <rect x={showCriterion ? -320 : -170} y="-23" width={showCriterion ? 640 : 340} height="46" rx="10" fill="white" fillOpacity="0.96" stroke="#cbd5e1"/>
      <circle cx={showCriterion ? -285 : -125} cy="0" r="8" fill="#ef6c00"/><text x={showCriterion ? -265 : -105} y="5" fontSize="15" fill="#1f2937">ก่อนเรียน</text>
      <circle cx={showCriterion ? -110 : 50} cy="0" r="8" fill="#1565c0"/><text x={showCriterion ? -90 : 70} y="5" fontSize="15" fill="#1f2937">หลังเรียน</text>
      {showCriterion && <><line x1="65" x2="100" y1="0" y2="0" stroke="#d32f2f" strokeWidth="3" strokeDasharray="9 6"/><text x="112" y="5" fontSize="15" fill="#1f2937">{criterionLabel}</text></>}
    </g>
  ) : (
    <g className="chart-legend" transform={`translate(${width - 286} ${height - bottom - 92})`}>
      <rect x="-18" y="-22" width="272" height={showCriterion ? 91 : 67} rx="8" fill="white" fillOpacity="0.9" stroke="#cbd5e1"/>
      <circle cx="0" cy="0" r="8" fill="#ef6c00"/><text x="28" y="5" fontSize="15" fill="#1f2937">ก่อนเรียน</text>
      <circle cx="0" cy="28" r="8" fill="#1565c0"/><text x="28" y="33" fontSize="15" fill="#1f2937">หลังเรียน</text>
      {showCriterion && <><line x1="-8" x2="18" y1="56" y2="56" stroke="#d32f2f" strokeWidth="3" strokeDasharray="9 6"/><text x="28" y="61" fontSize="15" fill="#1f2937">{criterionLabel}</text></>}
    </g>
  );
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${type === "dumbbell" ? "Dumbbell" : "Slope"} chart คะแนนก่อนเรียนและหลังเรียน`}>
      <rect width={width} height={height} fill="white"/>
      <text x={width / 2} y="31" textAnchor="middle" fontSize={titleFontSize} fontWeight="700" fill="#111827">{chartTitle}</text>
      {chartSubtitle && <text x={width / 2} y="56" textAnchor="middle" fontSize="16" fill="#334155">{chartSubtitle}</text>}
      {type === "dumbbell" ? (
        <>
          {ticks.map((tick) => <g key={tick}><line x1={xScore(tick)} x2={xScore(tick)} y1={top - 8} y2={height - bottom} stroke="#d7dde3" strokeDasharray="5 4"/><text x={xScore(tick)} y={height - bottom + 27} textAnchor="middle" fontSize="13" fill="#475569">{fmt(tick, Number.isInteger(tick) ? 0 : 1)}</text></g>)}
          <line x1={left} x2={left} y1={top - 8} y2={height - bottom} stroke="#111827" strokeWidth="1.5"/>
          <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#111827" strokeWidth="1.5"/>
          {showCriterion && <line x1={xScore(criterion)} x2={xScore(criterion)} y1={top - 8} y2={height - bottom} stroke="#d32f2f" strokeWidth="3" strokeDasharray="10 6"/>}
          {records.map((record, index) => {
            if (record.pre === null || record.post === null) return null;
            const y = top + 22 + index * 46;
            const preX = xScore(record.pre);
            const postX = xScore(record.post);
            const preAnchor = preX <= postX ? "end" : "start";
            const postAnchor = postX >= preX ? "start" : "end";
            return <g key={record.sequence} className="chart-person-row"><title>{tooltipFor(record)}</title><text data-person-number={record.sequence} x={left - 14} y={y + 5} textAnchor="end" fontSize="14" fill={record.followUp ? "#b45309" : "#1f2937"}>{labelFor(record)}</text><line x1={preX} x2={postX} y1={y} y2={y} stroke="#b0bec5" strokeWidth="4"/><circle cx={preX} cy={y} r="8" fill="#ef6c00"/><circle cx={postX} cy={y} r="8" fill="#1565c0"/>{showScoreLabels && <><text x={preX + (preX <= postX ? -12 : 12)} y={y + 5} textAnchor={preAnchor} fontSize="12" fontWeight="700" fill="#b45309">{fmt(record.pre, 1)}</text><text x={postX + (postX >= preX ? 12 : -12)} y={y + 5} textAnchor={postAnchor} fontSize="12" fontWeight="700" fill="#1d4ed8">{fmt(record.post, 1)}</text></>}</g>;
          })}
          <text x={(left + width - right) / 2} y={height - bottom + 57} textAnchor="middle" fontSize="15" fontWeight="700" fill="#1f2937">คะแนนผลสัมฤทธิ์ทางการเรียน (คะแนนเต็ม {fmt(maximumScore, 0)})</text>
          {legend}
        </>
      ) : (
        <>
          {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={yScore(tick)} y2={yScore(tick)} stroke="#d7dde3" strokeDasharray="5 4"/><text x={left - 14} y={yScore(tick) + 5} textAnchor="end" fontSize="13" fill="#475569">{fmt(tick, Number.isInteger(tick) ? 0 : 1)}</text></g>)}
          <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="#94a3b8" strokeWidth="2"/>
          <line x1={width - right} x2={width - right} y1={top} y2={height - bottom} stroke="#94a3b8" strokeWidth="2"/>
          {showCriterion && <line x1={left} x2={width - right} y1={yScore(criterion)} y2={yScore(criterion)} stroke="#d32f2f" strokeWidth="3" strokeDasharray="10 6"/>}
          <text x={left} y={height - bottom + 34} textAnchor="middle" fontSize="15" fontWeight="700" fill="#b45309">ก่อนเรียน</text>
          <text x={width - right} y={height - bottom + 34} textAnchor="middle" fontSize="15" fontWeight="700" fill="#1d4ed8">หลังเรียน</text>
          {records.map((record) => {
            if (record.pre === null || record.post === null) return null;
            const preY = yScore(record.pre);
            const postY = yScore(record.post);
            return <g key={record.sequence} className="chart-person-row"><title>{tooltipFor(record)}</title><line x1={left} x2={width - right} y1={preY} y2={postY} stroke={record.followUp ? "#d97706" : "#b0bec5"} strokeWidth="3" opacity="0.84"/><circle cx={left} cy={preY} r="7" fill="#ef6c00"/><circle cx={width - right} cy={postY} r="7" fill="#1565c0"/><text data-person-number={record.sequence} x={left - 15} y={preY - 11} textAnchor="end" fontSize="11" fill="#334155">{labelFor(record)}</text><text data-person-number={record.sequence} x={width - right + 15} y={postY - 11} fontSize="11" fill="#334155">{labelFor(record)}</text>{showScoreLabels && <><text x={left - 14} y={preY + 17} textAnchor="end" fontSize="12" fontWeight="700" fill="#b45309">{fmt(record.pre, 1)}</text><text x={width - right + 14} y={postY + 17} fontSize="12" fontWeight="700" fill="#1d4ed8">{fmt(record.post, 1)}</text></>}</g>;
          })}
          {legend}
        </>
      )}
    </svg>
  );
});

function EfficiencyView({
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
  const processValues = parseNumbers(process);
  const postValues = parseNumbers(post);
  const efficiencyRows: ExportCell[][] = [
    ["รายการ", "ผล"],
    ["จำนวนผู้เรียน", Math.max(processValues.length, postValues.length)],
    ["คะแนนเต็มระหว่างเรียน", pmax],
    ["คะแนนเต็มหลังเรียน", tmax],
    ["E1", result ? `${fmt(result.e1, 2)}%` : "—"],
    ["E2", result ? `${fmt(result.e2, 2)}%` : "—"],
    ["รายงาน E1/E2", result ? `${fmt(result.e1, 2)}/${fmt(result.e2, 2)}` : "—"],
    ["", ""],
    ["ลำดับ", "คะแนนระหว่างเรียน", "คะแนนหลังเรียน"],
    ...Array.from(
      { length: Math.max(processValues.length, postValues.length) },
      (_, index) => [index + 1, processValues[index] ?? "", postValues[index] ?? ""],
    ),
  ];
  useEffect(() => {
    onChange({ process, post, pmax, tmax }, (result ?? {}) as WorkspaceData);
  }, [process, post, pmax, tmax]);
  return (
    <Page
      title="ประสิทธิภาพนวัตกรรม E1/E2"
      subtitle="คำนวณประสิทธิภาพกระบวนการและผลลัพธ์"
      badge="กำหนดเกณฑ์ได้"
    >
      <section className="panel result-export-panel">
        <ResultExportToolbar
          title={title || "ผลประสิทธิภาพ E1-E2"}
          sheetName="ประสิทธิภาพ E1-E2"
          rows={efficiencyRows}
        />
      </section>
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
          <Metric label="Unit tests" value="14 / 14 ผ่าน" tone="green" />
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
        quality: "ประเมินความพึงพอใจหรือคุณภาพสื่อจากผู้ตอบที่กำหนด",
        item: "ใช้ Matrix เดียววิเคราะห์ p, r คัดเลือกข้อ และคำนวณ KR-20",
        reliability: "คำนวณ Cronbach’s alpha ของแบบสอบถามหลายระดับ",
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
    .map((row) => row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(","))
    .filter(Boolean)
    .join("\n");
}

function appendImportedText(existing: unknown, incoming: string, append: boolean) {
  const previous = typeof existing === "string" ? existing.trim() : "";
  return append && previous ? `${previous}\n${incoming}` : incoming;
}

function importedNumericMatrix(rows: unknown[][]) {
  return rows
    .map((row) => row.map((cell) => Number(cell)).filter(Number.isFinite))
    .filter((row) => row.length > 0);
}

function mergeImportedWorkspace(view: View, current: WorkspaceData, data: ImportedProjectData) {
  const append = data.importMode === "append";
  const text = flattenRows(data.rows);
  const matrix = importedNumericMatrix(data.rows);
  if (view === "ioc") return append ? current : {};
  if (view === "descriptive") return { ...current, text: appendImportedText(current.text, text, append) };
  if (view === "quality") {
    if (current.qualityMode === "media-expert") {
      const incoming = Array.from({ length: Math.max(0, ...matrix.map((row) => row.length)) }, (_, itemIndex) =>
        matrix.flatMap((row) => typeof row[itemIndex] === "number" && Number.isFinite(row[itemIndex]) ? [row[itemIndex]] : []),
      );
      const previous = Array.isArray(current.mediaScores) ? current.mediaScores as number[][] : [];
      const mediaScores = append
        ? Array.from({ length: Math.max(previous.length, incoming.length) }, (_, index) => [
            ...(previous[index] ?? []),
            ...(incoming[index] ?? []),
          ])
        : incoming;
      const priorRespondents = append && Array.isArray(current.respondents) ? current.respondents.map(String) : [];
      const respondents = [...priorRespondents, ...matrix.map((_, index) => `ผู้ตอบ ${priorRespondents.length + index + 1}`)];
      return { ...current, mediaScores, respondents };
    }
    return { ...current, text: appendImportedText(current.text, text, append) };
  }
  if (view === "item") return { ...current, testMatrix: appendImportedText(current.testMatrix, text, append) };
  if (view === "reliability") return { ...current, scaleText: appendImportedText(current.scaleText, text, append) };
  if (view === "paired") {
    const pairs = matrix.filter((row) => row.length >= 2);
    const nextPre = pairs.map((row) => row[0]).join(", ");
    const nextPost = (pairs.length ? pairs.map((row) => row[1]) : matrix.map((row) => row.at(-1))).join(", ");
    return { ...current, pre: appendImportedText(current.pre, nextPre, append).replaceAll("\n", ", "), post: appendImportedText(current.post, nextPost, append).replaceAll("\n", ", ") };
  }
  if (view === "efficiency") {
    const pairs = matrix.filter((row) => row.length >= 2);
    const nextProcess = pairs.map((row) => row[0]).join(", ");
    const nextPost = pairs.map((row) => row[1]).join(", ");
    return { ...current, process: appendImportedText(current.process, nextProcess, append).replaceAll("\n", ", "), post: appendImportedText(current.post, nextPost, append).replaceAll("\n", ", ") };
  }
  if (view === "individual") {
    const columnLabels = data.selectedColumns?.map((column) => cleanImportedColumnLabel(column.label)) ?? [];
    return {
      ...current,
      columnLabels: append && Array.isArray(current.columnLabels) ? current.columnLabels : columnLabels,
      tableText: appendImportedText(current.tableText, text, append),
    };
  }
  return append ? current : {};
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

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function fitCanvasText(
  context: CanvasRenderingContext2D,
  value: ExportCell,
  maxWidth: number,
) {
  const text = String(value ?? "");
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
}

function createResultCanvas(title: string, sourceRows: ExportCell[][]) {
  const rows = sourceRows.length ? sourceRows : [["ผล", "ยังไม่มีข้อมูล"]];
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const widths = Array.from({ length: columnCount }, (_, columnIndex) => {
    const longest = Math.max(
      ...rows.map((row) => String(row[columnIndex] ?? "").length),
      8,
    );
    return Math.max(110, Math.min(260, longest * 9 + 32));
  });
  const width = widths.reduce((sum, value) => sum + value, 0);
  const rowHeight = 48;
  const top = 120;
  const visibleRows = rows.slice(0, Math.floor((16000 - top - 60) / rowHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(900, width + 80);
  canvas.height = top + visibleRows.length * rowHeight + 60;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#17213a";
  context.font = "bold 26px Tahoma, sans-serif";
  context.fillText(fitCanvasText(context, title, canvas.width - 80), 40, 48);
  context.font = "14px Tahoma, sans-serif";
  context.fillStyle = "#65708a";
  context.fillText(`ผลวิเคราะห์ ${rows.length} แถว · สร้างโดย ResearchStat`, 40, 82);
  context.textAlign = "center";
  context.textBaseline = "middle";
  visibleRows.forEach((row, rowIndex) => {
    let cellX = 40;
    Array.from({ length: columnCount }, (_, index) => row[index] ?? "").forEach((value, index) => {
      const y = top + rowIndex * rowHeight;
      context.fillStyle = rowIndex === 0 ? "#eaf0ff" : rowIndex % 2 ? "#f8faff" : "white";
      context.fillRect(cellX, y, widths[index], rowHeight);
      context.strokeStyle = rowIndex === 0 ? "#72809f" : "#aab3c7";
      context.strokeRect(cellX, y, widths[index], rowHeight);
      context.fillStyle = "#17213a";
      context.font = `${rowIndex === 0 ? "bold " : ""}14px Tahoma, sans-serif`;
      context.fillText(
        fitCanvasText(context, value, widths[index] - 18),
        cellX + widths[index] / 2,
        y + rowHeight / 2,
      );
      cellX += widths[index];
    });
  });
  return canvas;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <rect x="12" y="10" width="17" height="20" rx="2" />
      <path className="fold" d="M8 25H6V6h16v2" />
    </svg>
  );
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
  const [sharedTestText, setSharedTestText] = useState(
    DEFAULT_SHARED_TEST_TEXT,
  );
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
        const latestSharedTest = loaded.find(
          (analysis) =>
            (analysis.analysis_type === "item" ||
              analysis.analysis_type === "reliability") &&
            Boolean(
              sharedTestTextFromWorkspace(analysis.input_json?.workspace),
            ),
        );
        if (latestSharedTest) {
          setSharedTestText(
            sharedTestTextFromWorkspace(
              latestSharedTest.input_json?.workspace,
            ),
          );
        }
        const requested = loaded.find(
          (analysis) => analysis.id === initialAnalysisId,
        );
        if (requested) {
          const requestedSharedText = sharedTestTextFromWorkspace(
            requested.input_json?.workspace,
          );
          if (requested.analysis_type === "item") {
            setSharedTestText(requestedSharedText);
          }
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
      if (nextView === "item") {
        setSharedTestText(DEFAULT_SHARED_TEST_TEXT);
      }
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
    const openedSharedText = sharedTestTextFromWorkspace(
      analysis.input_json?.workspace,
    );
    if (analysis.analysis_type === "item") {
      setSharedTestText(openedSharedText);
    }
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
          title={analysisTitle}
          editable={!analysisLocked}
        />
      ),
      quality: (
        <QualityView
          key={`quality-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          title={analysisTitle}
          editable={!analysisLocked}
        />
      ),
      item: (
        <ItemView
          key={`item-${dataKey}`}
          initial={workspaceInitial}
          onChange={handleDraft}
          title={analysisTitle}
          editable={!analysisLocked}
          sharedTestText={sharedTestText}
          onSharedTestTextChange={setSharedTestText}
        />
      ),
      reliability: (
        <ReliabilityView
          key={`reliability-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          title={analysisTitle}
          editable={!analysisLocked}
          sharedTestText={sharedTestText}
          onSharedTestTextChange={setSharedTestText}
        />
      ),
      paired: (
        <PairedView
          key={`paired-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          title={analysisTitle}
          editable={!analysisLocked}
        />
      ),
      efficiency: (
        <EfficiencyView
          key={`efficiency-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          title={analysisTitle}
          editable={!analysisLocked}
        />
      ),
      individual: (
        <IndividualProgressView
          key={`individual-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
          title={analysisTitle}
          editable={!analysisLocked}
          analyses={analyses}
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
              <span className="version-chip">รุ่นคำนวณ 3.3</span>
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
          const importedText = flattenRows(data.rows);
          if (view === "item") {
            setSharedTestText((current) =>
              appendImportedText(current, importedText, data.importMode === "append"),
            );
          }
          const nextWorkspace = mergeImportedWorkspace(view, workspaceDraft, data);
          setWorkspaceInitial(nextWorkspace);
          setWorkspaceDraft(nextWorkspace);
          setImported(data);
          setAnalysisTitle(data.workTitle);
          setRevision((value) => value + 1);
          setShowImporter(false);
        }}
      />
    </div>
  );
}
