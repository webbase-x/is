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
  oneSampleWilcoxon,
  pairedTTest,
  parseMatrix,
  parseNumbers,
  sampleStandardDeviation,
} from "../lib/statistics";

type View =
  | "home"
  | "ioc"
  | "descriptive"
  | "quality"
  | "item"
  | "reliability"
  | "paired"
  | "wilcoxon"
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
  { id: "home", label: "เธ เธฒเธเธฃเธงเธก", icon: "โ" },
  {
    id: "ioc",
    label: "เธเธงเธฒเธกเธ•เธฃเธเน€เธเธดเธเน€เธเธทเนเธญเธซเธฒ (IOC)",
    icon: "โ“",
    group: "เธ•เธฃเธงเธเธชเธญเธเน€เธเธฃเธทเนเธญเธเธกเธทเธญ",
  },
  {
    id: "descriptive",
    label: "เธเนเธฒเน€เธเธฅเธตเนเธขเนเธฅเธฐ S.D.",
    icon: "xฬ",
    group: "เธชเธ–เธดเธ•เธดเธเธฃเธฃเธ“เธเธฒ",
  },
  { id: "quality", label: "เธฃเธฐเธ”เธฑเธเธเธธเธ“เธ เธฒเธ 5 เธฃเธฐเธ”เธฑเธ", icon: "โ…" },
  {
    id: "item",
    label: "เธเธงเธฒเธกเธขเธฒเธโ€“เธญเธณเธเธฒเธเธเธณเนเธเธ",
    icon: "P",
    group: "เธเธธเธ“เธ เธฒเธเนเธเธเธ—เธ”เธชเธญเธ",
  },
  { id: "reliability", label: "เธเธงเธฒเธกเน€เธเธทเนเธญเธกเธฑเนเธ", icon: "ฮฑ" },
  {
    id: "paired",
    label: "เธเนเธญเธเน€เธฃเธตเธขเธโ€“เธซเธฅเธฑเธเน€เธฃเธตเธขเธ",
    icon: "t",
    group: "เธ—เธ”เธชเธญเธเธชเธกเธกเธ•เธดเธเธฒเธ",
  },
  { id: "wilcoxon", label: "Wilcoxon 1 เธเธฅเธธเนเธก", icon: "W" },
  { id: "efficiency", label: "เธเธฃเธฐเธชเธดเธ—เธเธดเธ เธฒเธ E1/E2", icon: "%" },
  {
    id: "references",
    label: "เธชเธนเธ•เธฃเนเธฅเธฐเน€เธญเธเธชเธฒเธฃเธญเนเธฒเธเธญเธดเธ",
    icon: "ยง",
    group: "เน€เธญเธเธชเธฒเธฃ",
  },
];

const fmt = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "โ€”"
    : value.toFixed(digits);

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
      <small>เนเธเธงเธ—เธฒเธเธญเนเธฒเธเธญเธดเธ: {source}</small>
    </div>
  );
}

const THAI_DIGITS: Record<string, string> = {
  "เน": "0",
  "เน‘": "1",
  "เน’": "2",
  "เน“": "3",
  "เน”": "4",
  "เน•": "5",
  "เน–": "6",
  "เน—": "7",
  "เน": "8",
  "เน": "9",
};

function normalizeDigits(value: string) {
  return value.replace(/[เน-เน]/g, (digit) => THAI_DIGITS[digit]);
}

function inferIocItemCount(rows: unknown[][]) {
  const text = normalizeDigits(
    rows
      .flat()
      .map((cell) => String(cell ?? ""))
      .join(" "),
  );
  const explicitCounts = [
    ...text.matchAll(/(?:เธเธณเธเธงเธ|เธฃเธงเธก|เนเธเธเธ—เธ”เธชเธญเธ)?\s*(\d{1,3})\s*เธเนเธญ/g),
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
        (_, index) => `เธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธ ${index + 1}`,
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
    setExperts((x) => [...x, `เธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธ ${x.length + 1}`]);
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
    ["เธเนเธญ", ...experts, "โ‘R", "IOC", "เธเธฅ"],
    ...rows.map((row, index) => [
      index + 1,
      ...row.map((value) => value ?? ""),
      results[index].sum,
      results[index].ioc?.toFixed(2) ?? "",
      results[index].ioc === null
        ? "เธฃเธญเธเธฐเนเธเธ"
        : results[index].passed
          ? "เนเธเนเนเธ”เน"
          : "เธเธฃเธฑเธเธเธฃเธธเธ",
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
                  text: "เธ•เธฒเธฃเธฒเธเธชเธฃเธธเธเธเธฅเธเธฒเธฃเธ•เธฃเธงเธเธชเธญเธเธเธงเธฒเธกเธ•เธฃเธเน€เธเธดเธเน€เธเธทเนเธญเธซเธฒ (IOC)",
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
      title="เธเธงเธฒเธกเธ•เธฃเธเน€เธเธดเธเน€เธเธทเนเธญเธซเธฒ (IOC)"
      subtitle="เธเธฃเธฐเน€เธกเธดเธเธเธงเธฒเธกเธชเธญเธ”เธเธฅเนเธญเธเธฃเธฒเธขเธเนเธญเธเธฒเธเธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธเธเธณเธเธงเธเน€เธ—เนเธฒเนเธ”เธเนเนเธ”เน"
      badge="เนเธเธฐเธเธณ โฅ 3 เธเธ"
    >
      {needsOcrVerification && (
        <div className="import-warning ioc-verification">
          <b>
            {detectedRatings.length
              ? `เธญเนเธฒเธเธ•เธณเนเธซเธเนเธเน€เธเธฃเธทเนเธญเธเธซเธกเธฒเธขเนเธ”เน ${detectedRatings.length} เธเนเธญ`
              : "เธขเธฑเธเนเธกเนเธเธเน€เธเธฃเธทเนเธญเธเธซเธกเธฒเธขเนเธเธเนเธญเธเธเธฐเนเธเธ"}
          </b>
          <span>
            {detectedRatings.length
              ? "เธฃเธฐเธเธเธเธฑเธเธเธนเนเธฃเธญเธขเธเธฒเธเธเธฒเธเธฑเธเธเนเธญเธ +1, 0 เธซเธฃเธทเธญ -1 เนเธฅเธฐเน€เธฅเธเธเนเธญเธเธฒเธเธ•เธฒเธฃเธฒเธเนเธฅเนเธง เธเธฃเธธเธ“เธฒเน€เธ—เธตเธขเธเธเธฑเธเธ เธฒเธเธ•เนเธเธเธเธฑเธเนเธฅเธฐเนเธเนเนเธเธเนเธญเธเธ—เธตเนเธเธฅเธฒเธ”เน€เธเธฅเธทเนเธญเธเธเนเธญเธเนเธเนเธเธฅ"
              : "OCR เธญเนเธฒเธเธเนเธญเธเธงเธฒเธกเนเธ”เน เนเธ•เนเธขเธฑเธเธขเธทเธเธขเธฑเธเธ•เธณเนเธซเธเนเธเธฃเธญเธขเธเธฒเธเธเธฒเนเธเธ•เธฒเธฃเธฒเธเนเธกเนเนเธ”เน เธฃเธฐเธเธเธเธถเธเธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธเธงเนเธฒเธเนเธงเนเนเธซเนเธเธฃเธญเธเธ•เธฒเธกเน€เธญเธเธชเธฒเธฃ เน€เธเธทเนเธญเธเนเธญเธเธเธฑเธเธเนเธฒ IOC เธเธดเธ”เธเธฅเธฒเธ”"}
          </span>
        </div>
      )}
      <div className="metrics">
        <Metric label="เธเธณเธเธงเธเธเนเธญ" value={`${rows.length}`} />
        <Metric
          label="เธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธ"
          value={`${experts.length}`}
          tone="violet"
        />
        <Metric label="IOC เน€เธเธฅเธตเนเธข" value={fmt(average, 2)} tone="green" />
        <Metric
          label="เธเนเธฒเธเน€เธเธ“เธ‘เน"
          value={`${results.filter((r) => r.passed).length}/${rows.length}`}
          tone="amber"
        />
      </div>
      <section className="panel">
        <div className="panel-head ioc-panel-head">
          <div className="ioc-panel-title">
            <h3>เธ•เธฒเธฃเธฒเธเนเธซเนเธเธฐเนเธเธ</h3>
            <p>+1 เธชเธญเธ”เธเธฅเนเธญเธ ยท 0 เนเธกเนเนเธเนเนเธ ยท -1 เนเธกเนเธชเธญเธ”เธเธฅเนเธญเธ</p>
          </div>
          <div className="ioc-toolbar">
            <div className="actions ioc-actions" aria-label="เธ•เธฑเนเธเธเนเธฒเธ•เธฒเธฃเธฒเธ IOC">
              <label className="ioc-item-count">
                เธเธณเธเธงเธเธเนเธญ
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
                + เธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธ
              </button>
              <button disabled={!editable} onClick={addItem}>
                + เน€เธเธดเนเธกเธเนเธญ
              </button>
            </div>
            <div className="ioc-export-group">
              <span className="ioc-group-label">เธชเนเธเธญเธญเธเธเธฅ</span>
              <div className="export-icons" aria-label="เธชเนเธเธญเธญเธเธเธฅ IOC">
                <button
                  className="export-icon csv"
                  onClick={exportCsv}
                  title="เธชเนเธเธญเธญเธ CSV"
                  aria-label="เธชเนเธเธญเธญเธ CSV"
                >
                  <ExportIcon format="C" />
                  <span>CSV</span>
                </button>
                <button
                  className="export-icon xlsx"
                  onClick={() => void exportXlsx()}
                  title="เธชเนเธเธญเธญเธ XLSX"
                  aria-label="เธชเนเธเธญเธญเธ XLSX"
                >
                  <ExportIcon format="X" />
                  <span>XLSX</span>
                </button>
                <button
                  className="export-icon docx"
                  onClick={() => void exportDocx()}
                  title="เธชเนเธเธญเธญเธ DOCX"
                  aria-label="เธชเนเธเธญเธญเธ DOCX"
                >
                  <ExportIcon format="W" />
                  <span>DOCX</span>
                </button>
                <button
                  className="export-icon pdf"
                  onClick={() => void exportPdf()}
                  title="เธชเนเธเธญเธญเธ PDF"
                  aria-label="เธชเนเธเธญเธญเธ PDF"
                >
                  <ExportIcon format="PDF" />
                  <span>PDF</span>
                </button>
                <button
                  className="export-icon image"
                  onClick={exportPng}
                  title="เธเธฑเธเธ—เธถเธเน€เธเนเธเธฃเธนเธ PNG"
                  aria-label="เธเธฑเธเธ—เธถเธเน€เธเนเธเธฃเธนเธ PNG"
                >
                  <ExportIcon format="โ–ง" />
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
                <th>เธเนเธญ</th>
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
                <th>โ‘R</th>
                <th>IOC</th>
                <th>เธเธฅ</th>
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
                        aria-label={`เธเนเธญ ${ri + 1} ${experts[ci]}`}
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
                        <option value="">โ€”</option>
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
                        ? "เธฃเธญเธเธฐเนเธเธ"
                        : results[ri].passed
                          ? "เนเธเนเนเธ”เน"
                          : "เธเธฃเธฑเธเธเธฃเธธเธ"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Formula source="Rovinelli & Hambleton; เนเธเธงเธ—เธฒเธเธเธฒเธฃเธชเธฃเนเธฒเธเน€เธเธฃเธทเนเธญเธเธกเธทเธญเธงเธดเธเธฑเธขเธ—เธฒเธเธเธฒเธฃเธจเธถเธเธฉเธฒ">
        IOC = ฮฃR / N เนเธ”เธขเธเธณเธเธงเธ“เธเธฒเธเธเธฐเนเธเธเธ—เธตเนเธกเธตเธเนเธญเธกเธนเธฅเธเธฃเธดเธเนเธเนเธ•เนเธฅเธฐเธเนเธญ เนเธฅเธฐเนเธชเธ”เธ N
        เธฃเธฒเธขเธเนเธญเน€เธเธทเนเธญเธเธฒเธฃเธ•เธฃเธงเธเธชเธญเธ
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
      title={quality ? "เธเธฒเธฃเนเธเธฅเธเธฅเธฃเธฐเธ”เธฑเธเธเธธเธ“เธ เธฒเธ" : "เธชเธ–เธดเธ•เธดเธเธฃเธฃเธ“เธเธฒ"}
      subtitle={
        quality
          ? "เธเธณเธเธงเธ“เธเนเธฒเน€เธเธฅเธตเนเธขเนเธฅเธฐเนเธเธฅเธเธฅเธกเธฒเธ•เธฃเธฒเธชเนเธงเธเธเธฃเธฐเธกเธฒเธ“เธเนเธฒ 5 เธฃเธฐเธ”เธฑเธ"
          : "เธเนเธฒเน€เธเธฅเธตเนเธข เธกเธฑเธเธขเธเธฒเธ เนเธฅเธฐเธชเนเธงเธเน€เธเธตเนเธขเธเน€เธเธเธกเธฒเธ•เธฃเธเธฒเธเธเธญเธเธเธฅเธธเนเธกเธ•เธฑเธงเธญเธขเนเธฒเธ"
      }
      badge="เธ•เธฃเธงเธเธชเธญเธเธเนเธญเธกเธนเธฅเธ”เธดเธเนเธ”เน"
    >
      <section className="split">
        <div className="panel">
          <h3>เธงเธฒเธเธเธฐเนเธเธ</h3>
          <p>เธเธฑเนเธเธ”เนเธงเธขเธเนเธญเธเธงเนเธฒเธ เน€เธเธฃเธทเนเธญเธเธซเธกเธฒเธขเธเธธเธฅเธ เธฒเธ เธซเธฃเธทเธญเธเธถเนเธเธเธฃเธฃเธ—เธฑเธ”เนเธซเธกเน</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
          />
          <div className="data-note">เธญเนเธฒเธเนเธ”เน {values.length} เธเนเธฒ</div>
        </div>
        <div>
          <div className="metrics compact">
            <Metric label="เธเธณเธเธงเธ (n)" value={`${values.length}`} />
            <Metric label="เธเนเธฒเน€เธเธฅเธตเนเธข (xฬ)" value={fmt(avg)} tone="green" />
            <Metric label="S.D. (เธ•เธฑเธงเธญเธขเนเธฒเธ)" value={fmt(sd)} tone="violet" />
            <Metric
              label={quality ? "เธฃเธฐเธ”เธฑเธเธเธธเธ“เธ เธฒเธ" : "เธกเธฑเธเธขเธเธฒเธ"}
              value={quality ? interpretQuality(avg) : fmt(median(values))}
              tone="amber"
            />
          </div>
          {quality && (
            <section className="panel bands">
              <h3>เน€เธเธ“เธ‘เนเนเธเธฅเธเธฅเธ—เธตเนเนเธเน</h3>
              {defaultFiveLevelBands.map((b) => (
                <div key={b.label}>
                  <span>
                    {b.min.toFixed(2)}โ€“{b.max.toFixed(2)}
                  </span>
                  <b>{b.label}</b>
                </div>
              ))}
            </section>
          )}
        </div>
      </section>
      <Formula source="เธเธธเธเธเธก เธจเธฃเธตเธชเธฐเธญเธฒเธ” เนเธฅเธฐเธ•เธณเธฃเธฒเธชเธ–เธดเธ•เธดเธ—เธฒเธเธเธฒเธฃเธจเธถเธเธฉเธฒ; เนเธเธฃเธ”เธฃเธฐเธเธธเธเธเธฑเธเธ—เธตเนเนเธเนเธญเนเธฒเธเธญเธดเธเนเธเธเธฒเธเธงเธดเธเธฑเธข">
        xฬ = ฮฃx / n เนเธฅเธฐ S.D. เธ•เธฑเธงเธญเธขเนเธฒเธ = โ[ฮฃ(x-xฬ)ยฒ/(n-1)]
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
      title="เธเธงเธฒเธกเธขเธฒเธเนเธฅเธฐเธญเธณเธเธฒเธเธเธณเนเธเธ"
      subtitle="เธงเธดเน€เธเธฃเธฒเธฐเธซเนเธเนเธญเธชเธญเธเธ”เนเธงเธขเน€เธ—เธเธเธดเธเธเธฅเธธเนเธกเธชเธนเธโ€“เธเธฅเธธเนเธกเธ•เนเธณ"
      badge="Classical Test Theory"
    >
      <section className="split">
        <div className="panel form-grid">
          <label>
            เธเธฅเธธเนเธกเธชเธนเธเธ•เธญเธเธ–เธนเธ
            <input
              type="number"
              value={upper}
              onChange={(e) => setUpper(+e.target.value)}
            />
          </label>
          <label>
            เธเธฅเธธเนเธกเธ•เนเธณเธ•เธญเธเธ–เธนเธ
            <input
              type="number"
              value={lower}
              onChange={(e) => setLower(+e.target.value)}
            />
          </label>
          <label>
            เธเธณเธเธงเธเธเธเธ•เนเธญเธเธฅเธธเนเธก
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(+e.target.value)}
            />
          </label>
        </div>
        <div className="metrics compact">
          <Metric
            label="เธเนเธฒเธเธงเธฒเธกเธขเธฒเธ (p)"
            value={fmt(result.difficulty)}
            note={result.difficultyLabel}
          />
          <Metric
            label="เธญเธณเธเธฒเธเธเธณเนเธเธ (r)"
            value={fmt(result.discrimination)}
            note={result.discriminationLabel}
            tone="green"
          />
        </div>
      </section>
      <Formula source="เนเธเธงเธเธดเธ”เธเธฒเธฃเธงเธดเน€เธเธฃเธฒเธฐเธซเนเธเนเธญเธชเธญเธเนเธเธเธญเธดเธเธเธฅเธธเนเธก; เธเธดเธเธดเธ• เธคเธ—เธเธดเนเธเธฃเธนเธ เนเธฅเธฐเธ•เธณเธฃเธฒเธเธฒเธฃเธงเธฑเธ”เธเธฅเธเธฒเธฃเธจเธถเธเธฉเธฒ">
        p = (RU+RL)/(2n) เนเธฅเธฐ r = (RU-RL)/n
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
      title="เธเธงเธฒเธกเน€เธเธทเนเธญเธกเธฑเนเธเธเธญเธเน€เธเธฃเธทเนเธญเธเธกเธทเธญ"
      subtitle="เธฃเธญเธเธฃเธฑเธ Cronbachโ€s alpha เนเธฅเธฐ KR-20"
      badge="เธงเธฒเธเธเนเธญเธกเธนเธฅเธฃเธฒเธขเธเธ ร— เธฃเธฒเธขเธเนเธญ"
    >
      <section className="split">
        <div className="panel">
          <h3>เน€เธกเธ—เธฃเธดเธเธเนเธเธฐเนเธเธ</h3>
          <p>1 เธเธฃเธฃเธ—เธฑเธ” = เธเธนเนเธ•เธญเธ 1 เธเธ ยท เนเธ•เนเธฅเธฐเธเธญเธฅเธฑเธกเธเน = เธเนเธญเธเธณเธ–เธฒเธก</p>
          <textarea
            rows={11}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="data-note">
            {matrix.length} เธเธ ร— {matrix[0]?.length ?? 0} เธเนเธญ
          </div>
        </div>
        <div className="metrics compact">
          <Metric
            label="Cronbachโ€s ฮฑ"
            value={fmt(alpha)}
            note="เนเธเธเธกเธฒเธ•เธฃเธเธฃเธฐเธกเธฒเธ“เธเนเธฒ/เธซเธฅเธฒเธขเธฃเธฐเธ”เธฑเธ"
            tone="violet"
          />
          <Metric
            label="KR-20"
            value={binary ? fmt(kr) : "เธ•เนเธญเธเน€เธเนเธ 0/1"}
            note="เนเธเธเธ—เธ”เธชเธญเธเนเธซเนเธเธฐเนเธเธเธ–เธนเธโ€“เธเธดเธ”"
            tone="green"
          />
        </div>
      </section>
      <Formula source="Kuder & Richardson (1937); Cronbach (1951); เธ•เธณเธฃเธฒเธเธฒเธฃเธงเธฑเธ”เธเธฅเธ—เธฒเธเธเธฒเธฃเธจเธถเธเธฉเธฒ">
        เธฃเธฐเธเธเนเธเนเธเธงเธฒเธกเนเธเธฃเธเธฃเธงเธเธฃเธฒเธขเธเนเธญเนเธฅเธฐเธเธงเธฒเธกเนเธเธฃเธเธฃเธงเธเธเธญเธเธเธฐเนเธเธเธฃเธงเธก
        เธเธฃเนเธญเธกเธ•เธฃเธงเธเธฃเธนเธเนเธเธเธเนเธญเธกเธนเธฅเธเนเธญเธเธเธณเธเธงเธ“
      </Formula>
    </Page>
  );
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
  const importedPairs =
    imported?.rows
      .map((row) => row.map(Number).filter(Number.isFinite))
      .filter((row) => row.length >= 2) ?? [];
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
          : "16, 17, 15, 18, 14, 17, 16, 15",
    );
  const result = pairedTTest(parseNumbers(pre), parseNumbers(post));
  useEffect(() => {
    onChange({ pre, post }, (result ?? {}) as WorkspaceData);
  }, [pre, post]);
  return (
    <Page
      title="เน€เธเธฃเธตเธขเธเน€เธ—เธตเธขเธเธเนเธญเธโ€“เธซเธฅเธฑเธเน€เธฃเธตเธขเธ"
      subtitle="Paired-samples t-test เนเธฅเธฐเธเธเธฒเธ”เธญเธดเธ—เธเธดเธเธฅ Cohenโ€s dz"
      badge="เธเนเธญเธกเธนเธฅเน€เธเนเธเธเธนเน"
    >
      <section className="panel two-text">
        <label>
          เธเธฐเนเธเธเธเนเธญเธเน€เธฃเธตเธขเธ
          <textarea
            rows={7}
            value={pre}
            onChange={(e) => setPre(e.target.value)}
          />
        </label>
        <label>
          เธเธฐเนเธเธเธซเธฅเธฑเธเน€เธฃเธตเธขเธ
          <textarea
            rows={7}
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
        </label>
      </section>
      <div className="metrics">
        <Metric label="n" value={`${result?.n ?? 0}`} />
        <Metric label="เธเนเธญเธเน€เธฃเธตเธขเธ xฬ" value={fmt(result?.preMean)} />
        <Metric
          label="เธซเธฅเธฑเธเน€เธฃเธตเธขเธ xฬ"
          value={fmt(result?.postMean)}
          tone="green"
        />
        <Metric
          label="เธเธฅเธ•เนเธฒเธเน€เธเธฅเธตเนเธข"
          value={fmt(result?.meanDifference)}
          tone="amber"
        />
        <Metric
          label="t (df)"
          value={result ? `${fmt(result.t)} (${result.df})` : "โ€”"}
          tone="violet"
        />
        <Metric label="Cohenโ€s dz" value={fmt(result?.cohenDz)} tone="green" />
      </div>
      <Formula source="Studentโ€s t distribution; Cohen (1988) เธชเธณเธซเธฃเธฑเธเนเธเธงเธเธดเธ”เธเธเธฒเธ”เธญเธดเธ—เธเธดเธเธฅ">
        t = dฬ / (Sแต/โn) เธฃเธฐเธเธเนเธกเนเธฃเธฒเธขเธเธฒเธเธเธฑเธขเธชเธณเธเธฑเธเธเธเธเธงเนเธฒเธเธฐเธขเธทเธเธขเธฑเธเน€เธเธทเนเธญเธเนเธเนเธฅเธฐเธฃเธฐเธ”เธฑเธ ฮฑ
      </Formula>
    </Page>
  );
}

function OneSampleWilcoxonView({
  imported,
  initial,
  onChange,
}: {
  imported?: ImportedProjectData | null;
  initial?: WorkspaceData;
  onChange: (data: WorkspaceData, result: WorkspaceData) => void;
}) {
  const importedScores =
    imported?.rows.flatMap((row) => row.map(Number).filter(Number.isFinite)) ?? [];
  const [scores, setScores] = useState(
    typeof initial?.scores === "string"
      ? initial.scores
      : importedScores.length
        ? importedScores.join(", ")
        : "12, 14, 15, 11, 16, 13, 17, 14, 12, 15",
  );
  const [hypothesizedMedian, setHypothesizedMedian] = useState(
    Number(initial?.hypothesizedMedian ?? 10),
  );
  const result = oneSampleWilcoxon(
    parseNumbers(scores),
    hypothesizedMedian,
  );
  useEffect(() => {
    onChange(
      { scores, hypothesizedMedian },
      (result ?? {}) as WorkspaceData,
    );
  }, [scores, hypothesizedMedian]);

  const conclusion = !result
    ? "เธเธฃเธญเธเธเธฐเนเธเธเธญเธขเนเธฒเธเธเนเธญเธข 2 เธเนเธฒ เนเธฅเธฐเธ•เนเธญเธเธกเธตเธเนเธฒเธ—เธตเนเธ•เนเธฒเธเธเธฒเธเธกเธฑเธเธขเธเธฒเธเธชเธกเธกเธ•เธดเธเธฒเธเธญเธขเนเธฒเธเธเนเธญเธข 2 เธเนเธฒ"
    : result.pValue < 0.05
      ? "เธเธฅเนเธ•เธเธ•เนเธฒเธเธเธฒเธเธกเธฑเธเธขเธเธฒเธเธชเธกเธกเธ•เธดเธเธฒเธเธญเธขเนเธฒเธเธกเธตเธเธฑเธขเธชเธณเธเธฑเธเธ—เธตเนเธฃเธฐเธ”เธฑเธ .05"
      : "เธขเธฑเธเนเธกเนเธเธเธเธงเธฒเธกเนเธ•เธเธ•เนเธฒเธเธเธฒเธเธกเธฑเธเธขเธเธฒเธเธชเธกเธกเธ•เธดเธเธฒเธเธญเธขเนเธฒเธเธกเธตเธเธฑเธขเธชเธณเธเธฑเธเธ—เธตเนเธฃเธฐเธ”เธฑเธ .05";

  return (
    <Page
      title="One-Sample Wilcoxon"
      subtitle="เธ—เธ”เธชเธญเธเธกเธฑเธเธขเธเธฒเธเธเธญเธเธเธฅเธธเนเธกเธ•เธฑเธงเธญเธขเนเธฒเธเธซเธเธถเนเธเธเธฅเธธเนเธกเธ”เนเธงเธข Wilcoxon signed-rank test เนเธเธเธชเธญเธเธ—เธฒเธ"
      badge="เธเนเธญเธกเธนเธฅเธญเธขเนเธฒเธเธเนเธญเธขเธฃเธฐเธ”เธฑเธเธญเธฑเธเธ”เธฑเธ"
    >
      <section className="panel two-text">
        <label>
          เธเธฐเนเธเธเธเธญเธเธเธฅเธธเนเธกเธ•เธฑเธงเธญเธขเนเธฒเธ
          <textarea
            rows={7}
            value={scores}
            onChange={(event) => setScores(event.target.value)}
            placeholder="เธเธฑเนเธเธ”เนเธงเธขเธเธธเธฅเธ เธฒเธ เธเนเธญเธเธงเนเธฒเธ เธซเธฃเธทเธญเธเธถเนเธเธเธฃเธฃเธ—เธฑเธ”เนเธซเธกเน"
          />
          <span>เธเธฑเนเธเธ•เธฑเธงเน€เธฅเธเธ”เนเธงเธขเธเธธเธฅเธ เธฒเธ เธเนเธญเธเธงเนเธฒเธ เธซเธฃเธทเธญเธเธถเนเธเธเธฃเธฃเธ—เธฑเธ”เนเธซเธกเน</span>
        </label>
        <label>
          เธกเธฑเธเธขเธเธฒเธเธชเธกเธกเธ•เธดเธเธฒเธ (Mโ€)
          <input
            type="number"
            step="any"
            value={hypothesizedMedian}
            onChange={(event) => setHypothesizedMedian(Number(event.target.value))}
          />
          <span>เธฃเธฐเธเธเธ—เธ”เธชเธญเธ Hโ€: median = Mโ€ เนเธเธเธชเธญเธเธ—เธฒเธ</span>
        </label>
      </section>
      <div className="metrics">
        <Metric label="n เธ—เธตเนเนเธเนเธ—เธ”เธชเธญเธ" value={`${result?.n ?? 0}`} />
        <Metric
          label="เธกเธฑเธเธขเธเธฒเธเธ•เธฑเธงเธญเธขเนเธฒเธ"
          value={fmt(result?.sampleMedian)}
          tone="green"
        />
        <Metric label="W+ / Wโ’" value={result ? `${fmt(result.wPlus, 1)} / ${fmt(result.wMinus, 1)}` : "โ€”"} tone="violet" />
        <Metric label="W" value={fmt(result?.w, 1)} tone="amber" />
        <Metric
          label="p-value (เธชเธญเธเธ—เธฒเธ)"
          value={fmt(result?.pValue, 4)}
          note={result ? result.method : undefined}
          tone="blue"
        />
        <Metric
          label="Rank-biserial r"
          value={fmt(result?.rankBiserial)}
          tone="green"
        />
      </div>
      <section className="panel">
        <h3>เธชเธฃเธธเธเธเธฅ</h3>
        <p>{conclusion}</p>
        {result && (
          <p className="data-note">
            เธ•เธฑเธ”เธเนเธฒเธ—เธตเนเธ•เนเธฒเธเธเธฒเธ Mโ€ เน€เธ—เนเธฒเธเธฑเธ 0 เธญเธญเธ {result.excludedZeros} เธเนเธฒ; 
            median เธเธญเธเธเธฅเธ•เนเธฒเธ = {fmt(result.medianDifference)}
            {result.z !== null ? `; z = ${fmt(result.z)}` : ""}
          </p>
        )}
      </section>
      <Formula source="Wilcoxon (1945); เนเธเนเธเธฒเธฃเธเธฑเธ”เธญเธฑเธเธ”เธฑเธเธเนเธฒเธชเธฑเธกเธเธนเธฃเธ“เนเธเธญเธเธเธฅเธ•เนเธฒเธ เนเธฅเธฐเธฃเธฒเธขเธเธฒเธเธเนเธฒ p เนเธเธเธชเธญเธเธ—เธฒเธ">
        W = min(W+, Wโ’) เนเธ”เธขเธเธฑเธ”เธญเธฑเธเธ”เธฑเธ |X โ’ Mโ€| เนเธฅเธฐเธ•เธฑเธ”เธเธฅเธ•เนเธฒเธเธ—เธตเนเน€เธ—เนเธฒเธเธฑเธ 0 เธญเธญเธ
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
      title="เธเธฃเธฐเธชเธดเธ—เธเธดเธ เธฒเธเธเธงเธฑเธ•เธเธฃเธฃเธก E1/E2"
      subtitle="เธเธณเธเธงเธ“เธเธฃเธฐเธชเธดเธ—เธเธดเธ เธฒเธเธเธฃเธฐเธเธงเธเธเธฒเธฃเนเธฅเธฐเธเธฅเธฅเธฑเธเธเน"
      badge="เธเธณเธซเธเธ”เน€เธเธ“เธ‘เนเนเธ”เน"
    >
      <section className="panel two-text">
        <label>
          เธเธฐเนเธเธเธฃเธฐเธซเธงเนเธฒเธเน€เธฃเธตเธขเธเธเธญเธเนเธ•เนเธฅเธฐเธเธ
          <textarea
            rows={6}
            value={process}
            onChange={(e) => setProcess(e.target.value)}
          />
          <span>
            เธเธฐเนเธเธเน€เธ•เนเธก{" "}
            <input
              type="number"
              value={pmax}
              onChange={(e) => setPmax(+e.target.value)}
            />
          </span>
        </label>
        <label>
          เธเธฐเนเธเธเธซเธฅเธฑเธเน€เธฃเธตเธขเธเธเธญเธเนเธ•เนเธฅเธฐเธเธ
          <textarea
            rows={6}
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
          <span>
            เธเธฐเนเธเธเน€เธ•เนเธก{" "}
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
          label="เธฃเธฒเธขเธเธฒเธเธเธฅ"
          value={result ? `${fmt(result.e1, 2)}/${fmt(result.e2, 2)}` : "โ€”"}
          tone="violet"
        />
      </div>
      <Formula source="เธเธฑเธขเธขเธเธเน เธเธฃเธซเธกเธงเธเธจเน: เนเธเธงเธเธดเธ”เธเธฒเธฃเธ—เธ”เธชเธญเธเธเธฃเธฐเธชเธดเธ—เธเธดเธ เธฒเธเธชเธทเนเธญเธซเธฃเธทเธญเธเธธเธ”เธเธฒเธฃเธชเธญเธ">
        E1 = (ฮฃX/N)/A ร— 100 เนเธฅเธฐ E2 = (ฮฃF/N)/B ร— 100
      </Formula>
    </Page>
  );
}

function ReferencesView() {
  const refs = [
    [
      "IOC",
      "Rovinelli & Hambleton",
      "เธเธงเธฒเธกเธชเธญเธ”เธเธฅเนเธญเธเธฃเธฐเธซเธงเนเธฒเธเธเนเธญเธเธณเธ–เธฒเธกเธเธฑเธเธงเธฑเธ•เธ–เธธเธเธฃเธฐเธชเธเธเน",
    ],
    [
      "เธชเธ–เธดเธ•เธดเธเธฃเธฃเธ“เธเธฒ",
      "เธเธธเธเธเธก เธจเธฃเธตเธชเธฐเธญเธฒเธ”",
      "เธเนเธฒเน€เธเธฅเธตเนเธข เธชเนเธงเธเน€เธเธตเนเธขเธเน€เธเธเธกเธฒเธ•เธฃเธเธฒเธ เนเธฅเธฐเธเธฒเธฃเนเธเนเธชเธ–เธดเธ•เธดเนเธเธเธฒเธฃเธงเธดเธเธฑเธข",
    ],
    [
      "เธเธธเธ“เธ เธฒเธเน€เธเธฃเธทเนเธญเธเธกเธทเธญ",
      "เธเธดเธเธดเธ• เธคเธ—เธเธดเนเธเธฃเธนเธ",
      "เธเธฒเธฃเธชเธฃเนเธฒเธเนเธฅเธฐเธ•เธฃเธงเธเธชเธญเธเน€เธเธฃเธทเนเธญเธเธกเธทเธญเธงเธฑเธ”เนเธฅเธฐเธเธฃเธฐเน€เธกเธดเธเธเธฅ",
    ],
    ["KR-20", "Kuder & Richardson (1937)", "เธเธงเธฒเธกเน€เธเธทเนเธญเธกเธฑเนเธเธเธญเธเนเธเธเธ—เธ”เธชเธญเธเธชเธญเธเธเนเธฒ"],
    ["Cronbachโ€s alpha", "Cronbach (1951)", "เธเธงเธฒเธกเธชเธญเธ”เธเธฅเนเธญเธเธ เธฒเธขเนเธเธเธญเธเธกเธฒเธ•เธฃเธงเธฑเธ”"],
    ["Effect size", "Cohen (1988)", "เธเธเธฒเธ”เธญเธดเธ—เธเธดเธเธฅเธเธญเธเธเธงเธฒเธกเนเธ•เธเธ•เนเธฒเธ"],
    ["E1/E2", "เธเธฑเธขเธขเธเธเน เธเธฃเธซเธกเธงเธเธจเน", "เธเธฃเธฐเธชเธดเธ—เธเธดเธ เธฒเธเธเธฃเธฐเธเธงเธเธเธฒเธฃเนเธฅเธฐเธเธฅเธฅเธฑเธเธเนเธเธญเธเธชเธทเนเธญ"],
  ];
  return (
    <Page
      title="เธชเธนเธ•เธฃเนเธฅเธฐเน€เธญเธเธชเธฒเธฃเธญเนเธฒเธเธญเธดเธ"
      subtitle="เนเธชเธ”เธเธ—เธตเนเธกเธฒเธเธญเธเธงเธดเธเธตเธเธณเธเธงเธ“เน€เธเธทเนเธญเนเธซเนเธ•เธฃเธงเธเธชเธญเธเนเธฅเธฐเน€เธเธตเธขเธเธฃเธฒเธขเธเธฒเธเนเธ”เนเธ–เธนเธเธ•เนเธญเธ"
      badge="เนเธเธฃเนเธเนเธช เธ•เธฃเธงเธเธชเธญเธเนเธ”เน"
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
        <b>เธเนเธญเธเธงเธฃเธฃเธฐเธงเธฑเธเธ—เธฒเธเธงเธดเธเธฒเธเธฒเธฃ</b>
        <p>
          เธเธทเนเธญเธเธนเนเนเธ•เนเธเนเธกเนเนเธ”เนเธซเธกเธฒเธขเธเธงเธฒเธกเธงเนเธฒเธชเธนเธ•เธฃเธกเธฒเธ•เธฃเธเธฒเธเน€เธเนเธเธเธฃเธฃเธกเธชเธดเธ—เธเธดเนเธเธญเธเธเธนเนเนเธ•เนเธเธฃเธฒเธขเธเธฑเนเธ
          เธเธงเธฃเธญเนเธฒเธเธญเธดเธเธซเธเธฑเธเธชเธทเธญ เธเธเธฑเธเธเธดเธกเธเน เนเธฅเธฐเน€เธฅเธเธซเธเนเธฒเธ—เธตเนเธเธนเนเธงเธดเธเธฑเธขเนเธเนเธเธฃเธดเธ เนเธญเธเธเธฐเธเธฑเธ”เธ—เธณ
          โ€เธเธฑเธเธ—เธถเธเธงเธดเธเธตเธงเธดเน€เธเธฃเธฒเธฐเธซเนโ€ เนเธซเนเนเธเธเนเธเธ เธฒเธเธเธเธงเธเนเธ”เนเนเธเธฃเธธเนเธเธชเนเธเธญเธญเธเธฃเธฒเธขเธเธฒเธ
        </p>
      </div>
    </Page>
  );
}

function HomeView({ open }: { open: (view: View) => void }) {
  const cards = NAV.filter((n) => !["home", "references"].includes(n.id));
  return (
    <Page
      title="เน€เธฅเธทเธญเธเธเธฒเธฃเธงเธดเน€เธเธฃเธฒเธฐเธซเน"
      subtitle="เน€เธเธฃเธทเนเธญเธเธกเธทเธญเธชเธ–เธดเธ•เธดเธชเธณเธซเธฃเธฑเธเธเธฒเธเธงเธดเธเธฑเธขเธ—เธฒเธเธเธฒเธฃเธจเธถเธเธฉเธฒ เธเธฃเนเธญเธกเธชเธนเธ•เธฃ เน€เธเธ“เธ‘เน เนเธฅเธฐเธเนเธญเธกเธนเธฅเธ•เธฃเธงเธเธชเธญเธ"
      badge="Research Toolkit"
    >
      <section className="hero-card">
        <div>
          <span className="eyebrow">เนเธเธฃเธเธเธฒเธฃเธเธฑเธเธเธธเธเธฑเธ</span>
          <h2>เธกเธฒเธ•เธฃเธฒเธ•เธฑเธงเธชเธฐเธเธ” เธเธฑเนเธเธเธฃเธฐเธ–เธกเธจเธถเธเธฉเธฒเธเธตเธ—เธตเน 2</h2>
          <p>
            เน€เธฃเธดเนเธกเธเธฒเธเน€เธฅเธทเธญเธเธเธฃเธฐเน€เธ เธ—เธเธฒเธฃเธงเธดเน€เธเธฃเธฒเธฐเธซเน
            เธฃเธฐเธเธเธเธฐเนเธชเธ”เธเธเธฅเธเธฃเนเธญเธกเธชเธนเธ•เธฃเนเธฅเธฐเธเนเธญเธกเธนเธฅเธชเธณเธซเธฃเธฑเธเธ•เธฃเธงเธเธชเธญเธเธขเนเธญเธเธเธฅเธฑเธ
          </p>
        </div>
        <div className="hero-stat">
          <strong>8</strong>
          <span>เน€เธเธฃเธทเนเธญเธเธกเธทเธญเธเธฃเนเธญเธกเนเธเน</span>
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
              <small>เน€เธเธดเธ”เน€เธเธฃเธทเนเธญเธเธกเธทเธญ โ’</small>
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
        ioc: "เธ•เธฃเธงเธเธเธงเธฒเธกเธชเธญเธ”เธเธฅเนเธญเธเธฃเธฒเธขเธเนเธญเธเธฒเธเธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธ",
        descriptive: "เธชเธฃเธธเธเนเธเธงเนเธเนเธกเนเธฅเธฐเธเธฒเธฃเธเธฃเธฐเธเธฒเธขเธเธญเธเธเนเธญเธกเธนเธฅ",
        quality: "เนเธเธฅเธเธฅเนเธเธเธเธฃเธฐเน€เธกเธดเธเธกเธฒเธ•เธฃเธฒเธชเนเธงเธ 5 เธฃเธฐเธ”เธฑเธ",
        item: "เธงเธดเน€เธเธฃเธฒเธฐเธซเนเธเธธเธ“เธ เธฒเธเธเนเธญเธชเธญเธเธฃเธฒเธขเธเนเธญ",
        reliability: "เธเธณเธเธงเธ“ ฮฑ เนเธฅเธฐ KR-20",
        paired: "เธ—เธ”เธชเธญเธเธเธฐเนเธเธเธเธญเธเธเธฅเธธเนเธกเน€เธ”เธตเธขเธงเธเธฑเธเธชเธญเธเธเธฃเธฑเนเธ",
        wilcoxon: "เธ—เธ”เธชเธญเธเธกเธฑเธเธขเธเธฒเธเธเธญเธเธเนเธญเธกเธนเธฅเธซเธเธถเนเธเธเธฅเธธเนเธกเนเธเธเนเธกเนเธญเธดเธเธเธฒเธฃเนเธเธเนเธเธเธเธเธ•เธด",
        efficiency: "เธเธฃเธฐเน€เธกเธดเธเธเธฃเธฐเธชเธดเธ—เธเธดเธ เธฒเธเธเธงเธฑเธ•เธเธฃเธฃเธก",
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
            เธฃเธฐเธเธเธงเธดเน€เธเธฃเธฒเธฐเธซเน <span>/</span> {title}
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
  const columns = ["เธเนเธญ", ...experts, "โ‘R", "IOC", "เธเธฅ"];
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
  context.fillText("เธ•เธฒเธฃเธฒเธเธชเธฃเธธเธเธเธฅเธเธฒเธฃเธ•เธฃเธงเธเธชเธญเธเธเธงเธฒเธกเธ•เธฃเธเน€เธเธดเธเน€เธเธทเนเธญเธซเธฒ (IOC)", 40, 48);
  context.font = "18px Tahoma, sans-serif";
  context.fillText(title, 40, 82);
  context.font = "14px Tahoma, sans-serif";
  context.fillStyle = "#65708a";
  context.fillText(
    `เธเธณเธเธงเธ ${rows.length} เธเนเธญ ยท เธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธ ${experts.length} เธเธ ยท เธชเธฃเนเธฒเธเนเธ”เธข ResearchStat`,
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
        value === null ? "โ€”" : value === 1 ? "+1" : String(value),
      ),
      results[rowIndex].sum,
      results[rowIndex].ioc?.toFixed(2) ?? "โ€”",
      results[rowIndex].ioc === null
        ? "เธฃเธญเธเธฐเนเธเธ"
        : results[rowIndex].passed
          ? "เนเธเนเนเธ”เน"
          : "เธเธฃเธฑเธเธเธฃเธธเธ",
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
    (item) => item.numberStatus !== "เนเธกเนเธเธเน€เธฅเธเธเนเธญ",
  );
  const uniqueItems = [...new Set(foundItems.map((item) => item.item))].sort(
    (a, b) => a - b,
  );
  const missing = items
    .filter((item) => item.numberStatus === "เนเธกเนเธเธเน€เธฅเธเธเนเธญ")
    .map((item) => item.item);
  const range = data.sourceRange
    ? `${data.sourceRange.unit} ${data.sourceRange.from}โ€“${data.sourceRange.to}`
    : data.rangeLabel;
  return (
    <section className="panel imported-data">
      <div className="panel-head">
        <div>
          <span className="step-label">เธเธฅเธ•เธฃเธงเธเธชเธญเธเธเธฒเธฃเธเธณเน€เธเนเธฒ</span>
          <h3>{data.workTitle}</h3>
          <p>
            {data.sourceName} ยท {range} ยท เธเธณเธซเธเธ”เนเธงเน{" "}
            {data.expectedItemCount ?? items.length} เธเนเธญ
          </p>
        </div>
      </div>
      {data.warning && <div className="import-warning">{data.warning}</div>}
      {items.length ? (
        <>
          <div className="ocr-summary">
            <article>
              <span>เธเนเธงเธเธ—เธตเนเธเนเธเธซเธฒ</span>
              <b>{range}</b>
            </article>
            <article>
              <span>เธเธณเธเธงเธเธเนเธญเธ—เธตเนเธเธณเธซเธเธ”</span>
              <b>{data.expectedItemCount ?? items.length} เธเนเธญ</b>
            </article>
            <article>
              <span>เธเธ/เธเธฑเธเนเธ–เธงเธเนเธญ</span>
              <b>
                {uniqueItems.length}/{data.expectedItemCount ?? items.length}
              </b>
            </article>
            <article>
              <span>เธญเนเธฒเธเธเธฐเนเธเธเนเธ”เน</span>
              <b>
                {items.filter((item) => item.rating !== null).length}/
                {data.expectedItemCount ?? items.length}
              </b>
            </article>
          </div>
          {missing.length > 0 && (
            <div className="import-error">
              เนเธกเนเธเธเน€เธฅเธเธเนเธญ: {missing.join(", ")}
            </div>
          )}
          <div className="table-wrap ocr-item-table">
            <table>
              <thead>
                <tr>
                  <th>เธเนเธญ</th>
                  <th>{data.sourceRange?.unit === "เนเธ–เธง" ? "เนเธ–เธง" : "เธซเธเนเธฒ"}</th>
                  <th>เธเธฅเธเนเธเธซเธฒเน€เธฅเธเธเนเธญ</th>
                  <th>เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ—เธตเน OCR เธญเนเธฒเธเนเธ”เน</th>
                  <th>เธเธฐเนเธเธ</th>
                </tr>
              </thead>
              <tbody>
                {[...items]
                  .sort((a, b) => a.item - b.item)
                  .map((item, index) => (
                    <tr
                      key={`${item.item}-${index}`}
                      className={
                        item.numberStatus === "เนเธกเนเธเธเน€เธฅเธเธเนเธญ"
                          ? "ocr-missing-row"
                          : ""
                      }
                    >
                      <td>
                        <b>{item.item}</b>
                      </td>
                      <td>{item.page ?? "โ€”"}</td>
                      <td>
                        <span
                          className={
                            item.numberStatus === "เนเธกเนเธเธเน€เธฅเธเธเนเธญ"
                              ? "ocr-number missing"
                              : "ocr-number found"
                          }
                        >
                          {item.numberStatus ?? "เธเธเน€เธฅเธเธเนเธญ"}
                        </span>
                      </td>
                      <td>{item.details || "โ€” เธญเนเธฒเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เนเธกเนเธเธฑเธ” โ€”"}</td>
                      <td>
                        <span
                          className={
                            item.rating === null
                              ? "ocr-score pending"
                              : "ocr-score found"
                          }
                        >
                          {item.rating === null
                            ? "เนเธกเนเธเธ"
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
          ? `เธฃเธฐเธเธเธ•เธฃเธงเธเธ—เธตเธฅเธฐเธซเธเนเธฒ เนเธ”เธขเนเธเนเธเธญเธฅเธฑเธกเธเนเนเธฃเธเน€เธเนเธเน€เธฅเธเธเนเธญเนเธฅเธฐเธ•เธฃเธงเธเธ•เธณเนเธซเธเนเธเธฃเธญเธขเธเธฒเธเธเธฒเนเธเธเนเธญเธ +1, 0 เนเธฅเธฐ -1 เธเธฃเธธเธ“เธฒเธ•เธฃเธงเธเธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเธฃเธฐเธเธธเธงเนเธฒ โ€เธเธฑเธเธเธฒเธเนเธ–เธงเธ•เธฒเธฃเธฒเธโ€ เธซเธฃเธทเธญ โ€เนเธกเนเธเธเน€เธฅเธเธเนเธญโ€`
          : `เธเธณเน€เธเนเธฒเธเธฒเธ ${range} เธเธณเธเธงเธ ${data.rows.length} เธฃเธฒเธขเธเธฒเธฃ เธเธธเธ“เธชเธฒเธกเธฒเธฃเธ–เธ•เธฃเธงเธเนเธฅเธฐเนเธเนเนเธเธเนเธญเธเธเธณเธเธงเธ“เนเธ”เน`}
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
          setSaveStatus("เน€เธเธดเธ”เธเธฒเธเน€เธ”เธดเธกเนเธฅเนเธง");
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
        NAV.find((item) => item.id === nextView)?.label ?? "เธเธฒเธเธงเธดเน€เธเธฃเธฒเธฐเธซเน";
      setActiveAnalysis(null);
      setAnalysisTitle(`${label} โ€“ เธเธฒเธเนเธซเธกเน`);
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
    setSaveStatus("เน€เธเธดเธ”เธเธฒเธเน€เธ”เธดเธกเนเธฅเนเธง");
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
      setSaveStatus("เนเธกเนเธเธเธเธฒเธฃเน€เธเธทเนเธญเธกเธ•เนเธญ Supabase");
      return;
    }
    setSaveStatus("เธเธณเธฅเธฑเธเธเธฑเธเธ—เธถเธโ€ฆ");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaveStatus("เธเธฃเธธเธ“เธฒเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธซเธกเน");
      return;
    }
    const payload = {
      project_id: project.id,
      owner_id: auth.user.id,
      analysis_type: view,
      title:
        analysisTitle.trim() ||
        `${NAV.find((item) => item.id === view)?.label} โ€“ เธเธฒเธเธงเธดเน€เธเธฃเธฒเธฐเธซเน`,
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
        setSaveStatus(error?.message || "เธเธฑเธเธ—เธถเธเนเธกเนเธชเธณเน€เธฃเนเธ");
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
        setSaveStatus(error?.message || "เธเธฑเธเธ—เธถเธเนเธกเนเธชเธณเน€เธฃเนเธ");
        return;
      }
      const saved = data as AnalysisRecord;
      setActiveAnalysis(saved);
      setAnalyses((items) => [saved, ...items]);
    }
    setSaveStatus("เธเธฑเธเธ—เธถเธเนเธฅเนเธง");
    setEditingSaved(false);
  };
  const dataKey = `${revision}-${imported?.id ?? 0}`;
  const currentTool =
    NAV.find((item) => item.id === view)?.label ?? "เธเธฒเธเธงเธดเน€เธเธฃเธฒเธฐเธซเน";
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
      wilcoxon: (
        <OneSampleWilcoxonView
          key={`wilcoxon-${dataKey}`}
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
    "เธขเธฑเธเนเธกเนเธกเธตเธเธทเนเธญเธเธฒเธเธเธฒเธฃเธ–เธญเธ”เธเธงเธฒเธก";
  const displayedFileLabel =
    activeAnalysis || latestSavedAnalysis
      ? "เนเธเธฅเนเธฅเนเธฒเธชเธธเธ”เธ—เธตเนเธเธฑเธเธ—เธถเธ"
      : "เธเธทเนเธญเธเธฒเธเธเธฒเธฃเธ–เธญเธ”เธเธงเธฒเธก";
  return (
    <div className="app-shell" lang="th">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <b>
              Research<span>Stat</span>
            </b>
            <small>เธชเธ–เธดเธ•เธดเธเธฒเธเธงเธดเธเธฑเธขเธเธฒเธฃเธจเธถเธเธฉเธฒ</small>
          </div>
        </div>
        {onBack && (
          <button className="back-project" onClick={onBack}>
            โ เธเธฅเธฑเธเนเธเธ—เธตเนเนเธเธฃเธเธเธฒเธฃ
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
          <b>เธเนเธญเธกเธนเธฅเธเธญเธเธเธธเธ“เน€เธเนเธเธชเนเธงเธเธ•เธฑเธง</b>
          <p>เธฃเธธเนเธเธเธตเนเธเธฃเธฐเธกเธงเธฅเธเธฅเธเธฐเนเธเธเนเธเธญเธธเธเธเธฃเธ“เน เนเธกเนเธชเนเธเธเนเธญเธกเธนเธฅเธ”เธดเธเธญเธญเธเนเธ</p>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setMenu(!menu)}>
            โฐ
          </button>
          <div className="project">
            <span>เนเธเธฃเธเธเธฒเธฃ</span>
            <b>{project.title}</b>
          </div>
          <div className="top-actions">
            {isTool && (
              <>
                <button
                  className="import-project-button"
                  onClick={() => startNew()}
                >
                  ๏ผ เธชเธฃเนเธฒเธเนเธเธฅเนเนเธซเธกเน
                </button>
                <button
                  className="import-project-button"
                  onClick={() => setShowLibrary(true)}
                >
                  โ–ค เน€เธเธดเธ”เธฃเธฒเธขเธเธฒเธฃเน€เธ”เธดเธก
                </button>
                <button
                  className="import-project-button"
                  onClick={() => setShowImporter(true)}
                >
                  โฅ เธเธณเน€เธเนเธฒเธเธฒเธเนเธเธฅเน
                </button>
              </>
            )}
            <span className="version-chip">เธฃเธธเนเธเธเธณเธเธงเธ“ 2.3</span>
            <span className="avatar">เธ</span>
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
                placeholder="เธเธทเนเธญเธเธฒเธเธงเธดเน€เธเธฃเธฒเธฐเธซเน"
              />
              <button disabled={iocLocked} onClick={() => void saveAnalysis()}>
                เธเธฑเธเธ—เธถเธเธเธฒเธ
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
                          ? "เน€เธเธดเธ”เนเธซเนเนเธเนเนเธเนเธฅเนเธง"
                          : "เธฅเนเธญเธเธเธฒเธฃเนเธเนเนเธเนเธฅเนเธง",
                      );
                    }}
                  />
                  <span aria-hidden="true" />
                  <b>{editingSaved ? "เธเธณเธฅเธฑเธเนเธเนเนเธ" : "เน€เธเธดเธ”เน€เธเธทเนเธญเนเธเนเนเธ"}</b>
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
            ResearchStat ยท เน€เธเธฃเธทเนเธญเธเธกเธทเธญเธเนเธงเธขเธเธณเธเธงเธ“
            เนเธกเนเนเธ—เธเธเธฒเธฃเธเธดเธเธฒเธฃเธ“เธฒเธเธญเธเธเธฑเธเธงเธดเธเธฑเธขเนเธฅเธฐเธญเธฒเธเธฒเธฃเธขเนเธ—เธตเนเธเธฃเธถเธเธฉเธฒ
          </span>
          <b>เธเธนเนเธเธฑเธ”เธ—เธณเธฃเธฐเธเธ: เธเธฃเธนเนเธเธฃเธฑเธ เธญเธดเธเธเธงเธฃเธเธธเธก</b>
          <span>เนเธฃเธเน€เธฃเธตเธขเธเน€เธ—เธจเธเธฒเธฅ 1 เธ–เธเธเธเธเธฃเธเธญเธ ยท เน€เธ—เธจเธเธฒเธฅเธเธเธฃเธชเธเธเธฅเธฒ</span>
        </footer>
      </main>
      {showLibrary && isTool && (
        <div className="modal-backdrop">
          <section className="small-modal analysis-library">
            <header>
              <div>
                <span className="step-label">ANALYSIS FILES</span>
                <h2>{currentTool}</h2>
                <p>เน€เธฃเธดเนเธกเธเธฒเธเนเธซเธกเนเธซเธฃเธทเธญเน€เธเธดเธ”เธเธฒเธเน€เธ”เธดเธกเน€เธเธทเนเธญเนเธเนเนเธเธ•เนเธญ</p>
              </div>
              <button
                className="close-button"
                onClick={() => setShowLibrary(false)}
              >
                ร—
              </button>
            </header>
            <button className="new-analysis-card" onClick={() => startNew()}>
              ๏ผ
              <span>
                <b>เธชเธฃเนเธฒเธเนเธเธฅเนเนเธซเธกเน</b>
                <small>
                  เน€เธฃเธดเนเธกเนเธเธเธเธญเธฃเนเธกเนเธซเธกเน เนเธ”เธข IOC เน€เธฃเธดเนเธกเธ•เนเธเธเธนเนเน€เธเธตเนเธขเธงเธเธฒเธ 3 เธเธ
                </small>
              </span>
            </button>
            <h3>เธฃเธฒเธขเธเธฒเธฃเน€เธ”เธดเธก ({toolAnalyses.length})</h3>
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
                    <i>เน€เธเธดเธ” โ’</i>
                  </button>
                ))
              ) : (
                <div className="source-empty">
                  เธขเธฑเธเนเธกเนเธกเธตเธเธฒเธเน€เธ”เธดเธกเนเธเน€เธเธฃเธทเนเธญเธเธกเธทเธญเธเธตเน
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {menu && (
        <button
          className="overlay"
          aria-label="เธเธดเธ”เน€เธกเธเธน"
          onClick={() => setMenu(false)}
        />
      )}
      <ProjectDataImporter
        project={project}
        analysisType={view}
        suggestedTitle={analysisTitle || `${currentTool} โ€“ เธเธฒเธเธ—เธตเน 1`}
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

