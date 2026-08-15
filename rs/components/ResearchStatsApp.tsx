"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProjectDataImporter, {
  type ImportedProjectData,
} from "./ProjectDataImporter";
import { getSupabaseClient } from "../lib/supabase/client";
import type { ResearchProject } from "../lib/supabase/types";
import {
  analyzeItem,
  calculateE1E2,
  calculateIoc,
  cronbachAlpha,
  defaultFiveLevelBands,
  interpretQuality,
  kr20,
  mean,
  median,
  oneSampleTTest,
  oneSampleWilcoxonTest,
  pairedTTest,
  pairedWilcoxonTest,
  parseMatrix,
  parseNumbers,
  sampleStandardDeviation,
  type AlternativeHypothesis,
  type ComparisonTest,
  type NormalityAssessment,
  type OneSampleTResult,
  type PairedResult,
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
  { id: "quality", label: "ระดับคุณภาพ 5 ระดับ", icon: "★" },
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
}: {
  quality?: boolean;
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
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
  useEffect(() => {
    onChange(
      { text },
      {
        n: values.length,
        mean: avg,
        sd,
        median: median(values),
        interpretation: quality ? interpretQuality(avg) : undefined,
      },
    );
  }, [text]);
  return (
    <Page
      title={quality ? "การแปลผลระดับคุณภาพ" : "สถิติพรรณนา"}
      subtitle={
        quality
          ? "คำนวณค่าเฉลี่ยและแปลผลมาตราส่วนประมาณค่า 5 ระดับ"
          : "ค่าเฉลี่ย มัธยฐาน และส่วนเบี่ยงเบนมาตรฐานของกลุ่มตัวอย่าง"
      }
      badge="ตรวจสอบข้อมูลดิบได้"
    >
      <section className="split">
        <div className="panel">
          <h3>วางคะแนน</h3>
          <p>คั่นด้วยช่องว่าง เครื่องหมายจุลภาค หรือขึ้นบรรทัดใหม่</p>
          <textarea
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
              value={quality ? interpretQuality(avg) : fmt(median(values))}
              tone="amber"
            />
          </div>
          {quality && (
            <section className="panel bands">
              <h3>เกณฑ์แปลผลที่ใช้</h3>
              {defaultFiveLevelBands.map((b) => (
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
    </Page>
  );
}

function ItemView({
  imported,
  initial,
  onChange,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
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
              type="number"
              value={upper}
              onChange={(e) => setUpper(+e.target.value)}
            />
          </label>
          <label>
            กลุ่มต่ำตอบถูก
            <input
              type="number"
              value={lower}
              onChange={(e) => setLower(+e.target.value)}
            />
          </label>
          <label>
            จำนวนคนต่อกลุ่ม
            <input
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
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
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
type TestResult = PairedResult | OneSampleTResult | WilcoxonResult;

function isAlternative(value: unknown): value is AlternativeHypothesis {
  return ["greater", "less", "two-sided"].includes(String(value));
}

function isTestMethod(value: unknown): value is ComparisonTest {
  return value === "t-test" || value === "wilcoxon";
}

function HypothesisSelect({
  value,
  onChange,
  mode,
}: {
  value: AlternativeHypothesis;
  onChange: (value: AlternativeHypothesis) => void;
  mode: ComparisonMode;
}) {
  const target = mode === "paired" ? "ก่อนเรียน" : "เกณฑ์";
  return (
    <label>
      สมมติฐานทางสถิติ
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as AlternativeHypothesis)}
      >
        <option value="greater">ทางเดียว: หลังเรียนสูงกว่า{target}</option>
        <option value="less">ทางเดียว: หลังเรียนต่ำกว่า{target}</option>
        <option value="two-sided">สองทาง: คะแนนแตกต่างกัน</option>
      </select>
    </label>
  );
}

function normalityRecommendation(normality?: NormalityAssessment) {
  if (!normality) return "กรอกข้อมูลให้ครบเพื่อรับคำแนะนำ";
  const method =
    normality.recommendedTest === "t-test"
      ? "t-test"
      : "Wilcoxon signed-rank test";
  const testResult =
    normality.pValue === null
      ? normality.note
      : `${normality.note} (Jarque–Bera p = ${fmtP(normality.pValue)})`;
  return `ระบบแนะนำ ${method}: ${testResult}`;
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
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
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
      useState<AlternativeHypothesis>(
        isAlternative(initial?.pairedAlternative)
          ? initial.pairedAlternative
          : "greater",
      ),
    [criterionAlternative, setCriterionAlternative] =
      useState<AlternativeHypothesis>(
        isAlternative(initial?.criterionAlternative)
          ? initial.criterionAlternative
          : "greater",
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
    );

  const preValues = useMemo(() => parseNumbers(pre), [pre]);
  const postValues = useMemo(() => parseNumbers(post), [post]);
  const criterionScore =
    criterionMode === "percent"
      ? (criterionPercent / 100) * maximumScore
      : criterionRaw;
  const pairedResult = useMemo(
    () =>
      pairedMethod === "t-test"
        ? pairedTTest(preValues, postValues, pairedAlternative, alpha)
        : pairedWilcoxonTest(preValues, postValues, pairedAlternative, alpha),
    [preValues, postValues, pairedMethod, pairedAlternative, alpha],
  );
  const criterionResult = useMemo(
    () =>
      criterionMethod === "t-test"
        ? oneSampleTTest(
            postValues,
            criterionScore,
            criterionAlternative,
            alpha,
          )
        : oneSampleWilcoxonTest(
            postValues,
            criterionScore,
            criterionAlternative,
            alpha,
          ),
    [postValues, criterionScore, criterionMethod, criterionAlternative, alpha],
  );
  const activeResult = mode === "paired" ? pairedResult : criterionResult;
  const activeMethod = mode === "paired" ? pairedMethod : criterionMethod;
  const pairedLengthMismatch =
    mode === "paired" && preValues.length !== postValues.length;

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
  const wilcoxonResult = !isTTest
    ? (activeResult as WilcoxonResult | null)
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
          aria-selected={mode === "paired"}
          className={mode === "paired" ? "active" : ""}
          onClick={() => setMode("paired")}
        >
          ก่อนเรียน–หลังเรียน
        </button>
        <button
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
        <label>
          วิธีทดสอบ
          <select
            value={activeMethod}
            onChange={(event) => {
              const selected = event.target.value as ComparisonTest;
              if (mode === "paired") setPairedMethod(selected);
              else setCriterionMethod(selected);
            }}
          >
            <option value="t-test">
              {mode === "paired" ? "Paired-samples t-test" : "One-sample t-test"}
            </option>
            <option value="wilcoxon">
              {mode === "paired"
                ? "Wilcoxon signed-rank test"
                : "One-sample Wilcoxon signed-rank test"}
            </option>
          </select>
        </label>
        <HypothesisSelect
          mode={mode}
          value={mode === "paired" ? pairedAlternative : criterionAlternative}
          onChange={
            mode === "paired" ? setPairedAlternative : setCriterionAlternative
          }
        />
        <label>
          ระดับนัยสำคัญ (α)
          <select
            value={alpha}
            onChange={(event) => setAlpha(Number(event.target.value))}
          >
            <option value={0.05}>.05</option>
            <option value={0.01}>.01</option>
            <option value={0.1}>.10</option>
          </select>
        </label>
      </section>

      {mode === "criterion" && (
        <section className="panel criterion-controls">
          <label>
            รูปแบบเกณฑ์
            <select
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
              rows={7}
              value={pre}
              onChange={(event) => setPre(event.target.value)}
            />
          </label>
        )}
        <label>
          คะแนนหลังเรียน
          <textarea
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
        <b>คำแนะนำจากการกระจายข้อมูล</b>
        <p>{normalityRecommendation(activeResult?.normality)}</p>
        {activeResult?.normality.recommendedTest !== activeMethod && (
          <small>
            ขณะนี้ผู้ใช้เลือก {isTTest ? "t-test" : "Wilcoxon"} ซึ่งต่างจากคำแนะนำ
            ระบบยังคงคำนวณตามวิธีที่ผู้ใช้เลือก
          </small>
        )}
      </div>

      <div className="metrics analysis-metrics">
        <Metric label="n" value={`${activeResult?.n ?? 0}`} />
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
        ) : (
          <>
            <Metric label="W+ / W−" value={wilcoxonResult ? `${fmt(wilcoxonResult.wPlus, 1)} / ${fmt(wilcoxonResult.wMinus, 1)}` : "—"} tone="violet" />
            <Metric label="Rank-biserial r" value={fmt(wilcoxonResult?.rankBiserial)} tone="green" />
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

      <Formula source="Student’s t distribution; Wilcoxon (1945); Cohen (1988); Jarque & Bera (1987)">
        {mode === "paired" && isTTest && "Paired t-test: t = d̄ / (Sᵈ/√n) โดย d = คะแนนหลังเรียน − คะแนนก่อนเรียน"}
        {mode === "criterion" && isTTest && "One-sample t-test: t = (x̄ − μ₀) / (S/√n) โดย μ₀ คือคะแนนเกณฑ์"}
        {!isTTest && "Wilcoxon signed-rank: จัดอันดับค่าสัมบูรณ์ของผลต่าง แล้วเปรียบเทียบผลรวมอันดับด้านบวกและด้านลบ"}
        {!isTTest && (
          <small>
            Wilcoxon signed-rank ควรใช้เมื่อการแจกแจงของผลต่างมีความสมมาตร
            ระบบใช้ exact probability เมื่อ n ≤ 30 และ normal approximation เมื่อ n มากกว่า 30
          </small>
        )}
      </Formula>
    </Page>
  );
}

function EfficiencyView({
  imported,
  initial,
  onChange,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
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
            rows={6}
            value={process}
            onChange={(e) => setProcess(e.target.value)}
          />
          <span>
            คะแนนเต็ม{" "}
            <input
              type="number"
              value={pmax}
              onChange={(e) => setPmax(+e.target.value)}
            />
          </span>
        </label>
        <label>
          คะแนนหลังเรียนของแต่ละคน
          <textarea
            rows={6}
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
          <span>
            คะแนนเต็ม{" "}
            <input
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
      "Jarque–Bera",
      "Jarque & Bera (1987)",
      "ประเมินการแจกแจงปกติจากความเบ้และความโด่งเพื่อช่วยแนะนำวิธีทดสอบ",
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
  const iocLocked = view === "ioc" && Boolean(activeAnalysis) && !editingSaved;
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
          setSaveStatus("เปิดงานเดิมแล้ว");
          setEditingSaved(false);
        }
      });
  }, [project.id, initialAnalysisId]);
  const handleDraft = useCallback(
    (data: WorkspaceData, result: WorkspaceData) => {
      setWorkspaceDraft(data);
      setWorkspaceResult(result);
      setSaveStatus("");
    },
    [],
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
    setSaveStatus("เปิดงานเดิมแล้ว");
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
    setSaveStatus("บันทึกแล้ว");
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
          editable={!activeAnalysis || editingSaved}
        />
      ),
      descriptive: (
        <DescriptiveView
          key={`descriptive-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
        />
      ),
      quality: (
        <DescriptiveView
          key={`quality-${dataKey}`}
          quality
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
        />
      ),
      item: (
        <ItemView
          key={`item-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
        />
      ),
      reliability: (
        <ReliabilityView
          key={`reliability-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
        />
      ),
      paired: (
        <PairedView
          key={`paired-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
        />
      ),
      efficiency: (
        <EfficiencyView
          key={`efficiency-${dataKey}`}
          imported={imported}
          initial={workspaceInitial}
          onChange={handleDraft}
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
                  onClick={() => setShowImporter(true)}
                >
                  ↥ นำเข้าจากไฟล์
                </button>
              </>
            )}
              <span className="version-chip">รุ่นคำนวณ 2.4</span>
            <span className="avatar">พ</span>
          </div>
        </div>
        <div className="content">
          {isTool && (
            <section className="analysis-filebar">
              <input
                disabled={iocLocked}
                value={analysisTitle}
                onChange={(event) => {
                  setAnalysisTitle(event.target.value);
                  setSaveStatus("");
                }}
                placeholder="ชื่องานวิเคราะห์"
              />
              <button disabled={iocLocked} onClick={() => void saveAnalysis()}>
                บันทึกงาน
              </button>
              {view === "ioc" && activeAnalysis && (
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
                  <b>{editingSaved ? "กำลังแก้ไข" : "เปิดเพื่อแก้ไข"}</b>
                </label>
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
