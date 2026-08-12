"use client";

import { useEffect, useMemo, useState } from "react";
import FileImportDialog from "./FileImportDialog";
import { getSupabaseClient } from "../lib/supabase/client";
import type { FileDraft, ResearchFile, ResearchProject } from "../lib/supabase/types";

const PDF_JS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.mjs";
const PDF_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function ocrTextToRows(text: string) {
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean));
}

async function loadPdfJs() {
  const pdfjs = await import(/* @vite-ignore */ PDF_JS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  return pdfjs;
}

export interface ImportedProjectData {
  id: number;
  workTitle: string;
  sourceName: string;
  rangeLabel: string;
  rows: unknown[][];
  warning?: string;
  iocRatings?: Array<{ item: number; rating: -1 | 0 | 1 }>;
  ocrItems?: Array<{ item: number; page: number | null; details: string; rating: -1 | 0 | 1 | null; numberStatus?: "พบเลขข้อ" | "นับจากแถวตาราง" | "อนุมานลำดับ" | "ไม่พบเลขข้อ" }>;
  targetExpert?: number;
  expectedItemCount?: number;
  sourceRange?: { from: number; to: number; unit: "หน้า" | "แถว" };
}

type LoadedSource = {
  file: ResearchFile;
  buffer: ArrayBuffer;
  kind: "pdf" | "image" | "spreadsheet";
  unit: "หน้า" | "แถว";
  total: number;
};

type VisualMapKey = "item" | "detail" | "plus" | "zero" | "minus";
type VisualPoint = { x: number; y: number };
type VisualMap = Partial<Record<VisualMapKey, VisualPoint>>;

const VISUAL_MAP_LABELS: Record<VisualMapKey, string> = {
  item: "เลขข้อแรก",
  detail: "รายละเอียด",
  plus: "+1",
  zero: "0",
  minus: "-1",
};

async function sourcePageToCanvas(source: LoadedSource, pageNumber: number, scale = 2) {
  const canvas = document.createElement("canvas");
  if (source.kind === "image") {
    const bitmap = await createImageBitmap(new Blob([source.buffer], { type: source.file.mime_type || "image/png" }));
    const ratio = Math.min(1, 1800 / bitmap.width);
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("เบราว์เซอร์ไม่รองรับการแสดงรูปภาพ");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  }
  const { getDocument } = await loadPdfJs();
  const pdf = await getDocument({ data: source.buffer.slice(0) }).promise;
  try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("เบราว์เซอร์ไม่รองรับการแสดง PDF");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    if (typeof page.cleanup === "function") page.cleanup();
    return canvas;
  } finally {
    if (typeof pdf.destroy === "function") await pdf.destroy();
  }
}

type OcrItem = {
  item: number | null;
  page: number;
  details: string;
  rating: -1 | 0 | 1 | null;
  numberStatus: "พบเลขข้อ" | "นับจากแถวตาราง";
  rowTop: number;
  rowBottom: number;
  itemLeft: number;
  itemRight: number;
};

function normalizeOcrDigits(value: string) {
  return value.replace(/[๐-๙]/g, (digit) =>
    "๐๑๒๓๔๕๖๗๘๙".indexOf(digit).toString(),
  );
}

function columnLabelToIndex(value: string) {
  const label = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!label) return -1;
  return [...label].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function indexToColumnLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function titleFromRows(rows: unknown[][]) {
  return rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" – ")
    .slice(0, 240);
}

function inferSpreadsheetMapping(rows: unknown[][]) {
  const normalizedRows = rows.slice(0, 40).map((row) => row.map((cell) => normalizeOcrDigits(String(cell ?? "")).replace(/\s+/g, "").toLowerCase()));
  let headerRow = -1;
  let plus = -1;
  let zero = -1;
  let minus = -1;
  normalizedRows.forEach((row, rowIndex) => {
    if (headerRow >= 0) return;
    const nextPlus = row.findIndex((cell) => /^\+?1$/.test(cell));
    const nextZero = row.findIndex((cell) => cell === "0");
    const nextMinus = row.findIndex((cell) => /^-1$/.test(cell));
    if (nextPlus >= 0 && nextZero >= 0 && nextMinus >= 0) {
      headerRow = rowIndex;
      plus = nextPlus;
      zero = nextZero;
      minus = nextMinus;
    }
  });
  const startRowIndex = headerRow >= 0 ? headerRow + 1 : 2;
  const firstDataRow = rows.slice(startRowIndex, startRowIndex + 10).find((row) => row.some((cell) => /^\s*[0-9๐-๙]{1,3}\s*$/.test(String(cell ?? ""))));
  const item = firstDataRow?.findIndex((cell) => /^\s*[0-9๐-๙]{1,3}\s*$/.test(String(cell ?? ""))) ?? 0;
  return {
    startRow: startRowIndex + 1,
    firstItem: firstDataRow && item >= 0 ? Number(normalizeOcrDigits(String(firstDataRow[item]))) || 1 : 1,
    itemColumn: indexToColumnLabel(Math.max(0, item)),
    detailColumn: indexToColumnLabel(Math.max(0, item + 1)),
    plusColumn: indexToColumnLabel(plus >= 0 ? plus : 3),
    zeroColumn: indexToColumnLabel(zero >= 0 ? zero : 4),
    minusColumn: indexToColumnLabel(minus >= 0 ? minus : 5),
  };
}

function hasSpreadsheetMark(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  return Boolean(text) && !["-", "—", "ไม่มี", "none", "false"].includes(text);
}

function parseTsvWords(tsv: string | null) {
  if (!tsv) return [];
  return tsv.split("\n").slice(1).flatMap((line) => {
    const fields = line.split("\t");
    if (fields.length < 12) return [];
    return [{ left: Number(fields[6]), top: Number(fields[7]), width: Number(fields[8]), height: Number(fields[9]), text: fields.slice(11).join("\t").trim() }];
  });
}

function detectIocItems(canvas: HTMLCanvasElement, tsv: string | null, page: number, visualMap?: VisualMap): OcrItem[] {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const neutralDark = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
    return (r * 299 + g * 587 + b * 114) / 1000 < 220 && Math.max(r, g, b) - Math.min(r, g, b) < 55;
  };
  const blueInk = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
    return b > 80 && b - r > 30 && b - g > 12;
  };
  const clusterPeaks = (values: Array<{ at: number; score: number }>) => {
    const groups: Array<Array<{ at: number; score: number }>> = [];
    values.forEach((value) => {
      const group = groups.at(-1);
      if (!group || value.at - group.at(-1)!.at > 3) groups.push([value]); else group.push(value);
    });
    return groups.map((group) => group.reduce((best, value) => value.score > best.score ? value : best).at);
  };
  const horizontalScores: Array<{ at: number; score: number }> = [];
  for (let y = 0; y < height; y += 1) {
    let run = 0, best = 0, last = -10;
    for (let x = 0; x < width; x += 1) if (neutralDark(x, y)) {
      run = x - last <= 3 ? run + (x - last) : 1;
      best = Math.max(best, run); last = x;
    }
    if (best > width * 0.38) horizontalScores.push({ at: y, score: best });
  }
  const verticalScores: Array<{ at: number; score: number }> = [];
  for (let x = 0; x < width; x += 1) {
    let run = 0, best = 0, last = -10;
    for (let y = 0; y < height; y += 1) if (neutralDark(x, y)) {
      run = y - last <= 3 ? run + (y - last) : 1;
      best = Math.max(best, run); last = y;
    }
    if (best > height * 0.14) verticalScores.push({ at: x, score: best });
  }
  const horizontalRules = clusterPeaks(horizontalScores).sort((a, b) => a - b);
  const verticalRules = clusterPeaks(verticalScores).sort((a, b) => a - b);
  const leftRules = verticalRules.filter((rule) => rule < width * 0.25);
  let itemLeft = 0;
  let itemRight = width * 0.14;
  for (let index = 0; index < leftRules.length - 1; index += 1) {
    const gap = leftRules[index + 1] - leftRules[index];
    if (leftRules[index] < width * 0.08 && gap > width * 0.025 && gap < width * 0.16) {
      itemLeft = leftRules[index];
      itemRight = leftRules[index + 1];
      break;
    }
  }
  let ratingRules: number[] = [];
  const mappedCenters = visualMap?.plus && visualMap.zero && visualMap.minus
    ? [visualMap.plus.x * width, visualMap.zero.x * width, visualMap.minus.x * width]
    : [];
  if (mappedCenters.length === 3 && mappedCenters[0] < mappedCenters[1] && mappedCenters[1] < mappedCenters[2]) {
    ratingRules = [
      Math.max(0, mappedCenters[0] - (mappedCenters[1] - mappedCenters[0]) / 2),
      (mappedCenters[0] + mappedCenters[1]) / 2,
      (mappedCenters[1] + mappedCenters[2]) / 2,
      Math.min(width, mappedCenters[2] + (mappedCenters[2] - mappedCenters[1]) / 2),
    ];
  }
  let bestSpan = Number.POSITIVE_INFINITY;
  for (let index = 0; ratingRules.length !== 4 && index <= verticalRules.length - 4; index += 1) {
    const group = verticalRules.slice(index, index + 4);
    const gaps = group.slice(1).map((value, gapIndex) => value - group[gapIndex]);
    const valid = group[0] > width * 0.5 && gaps.every((gap) => gap > width * 0.018 && gap < width * 0.12);
    const span = group[3] - group[0];
    if (valid && span < bestSpan) { ratingRules = group; bestSpan = span; }
  }
  if (visualMap?.item && visualMap.detail) {
    const itemCenter = visualMap.item.x * width;
    const detailCenter = visualMap.detail.x * width;
    const halfGap = Math.abs(detailCenter - itemCenter) / 2;
    itemLeft = Math.max(0, itemCenter - halfGap);
    itemRight = Math.min(width, itemCenter + halfGap);
  }
  if (ratingRules.length !== 4 || horizontalRules.length < 2) return [];

  const words = parseTsvWords(tsv);
  const detected: OcrItem[] = [];
  for (let index = 0; index < horizontalRules.length - 1; index += 1) {
    const top = horizontalRules[index], bottom = horizontalRules[index + 1];
    if (bottom - top < height * 0.035) continue;
    if (visualMap?.item && bottom < visualMap.item.y * height) continue;
    const rowWords = words.filter((word) =>
      word.text && word.top + word.height / 2 > top && word.top + word.height / 2 < bottom,
    );
    const rowText = rowWords.map((word) => word.text).join(" ");
    const scoreHeaderCells = rowWords.filter((word) => {
      const center = word.left + word.width / 2;
      const normalized = normalizeOcrDigits(word.text).replace(/\s+/g, "");
      return center > ratingRules[0] && center < ratingRules[3] && /^(?:\+1|0|-1)$/.test(normalized);
    }).length;
    if (scoreHeaderCells >= 2 || (/ความคิดเห็น/.test(rowText) && /ผู้เชี่ยวชาญ/.test(rowText))) continue;
    const evidence = [0, 1, 2].map((column) => {
      let blue = 0, dark = 0;
      for (let y = top + 3; y < bottom - 3; y += 1) for (let x = ratingRules[column] + 3; x < ratingRules[column + 1] - 3; x += 1) {
        if (blueInk(x, y)) blue += 1;
        else if (neutralDark(x, y)) dark += 1;
      }
      return { score: blue * 4 + dark, blue, dark };
    });
    const ranked = evidence.map((value, column) => ({ ...value, column })).sort((a, b) => b.score - a.score);
    const winner = ranked[0];
    const hasConfidentMark = (winner.blue >= 5 || winner.dark >= Math.max(12, (bottom - top) * 0.08)) && winner.score >= ranked[1].score * 1.2;
    const itemWord = words.find((word) => {
      const normalized = normalizeOcrDigits(word.text);
      const center = word.left + word.width / 2;
      return center > itemLeft && center < itemRight && word.top + word.height / 2 > top && word.top + word.height / 2 < bottom && /^\D*\d{1,3}\D*$/.test(normalized);
    });
    const itemMatch = itemWord ? normalizeOcrDigits(itemWord.text).match(/\d{1,3}/) : null;
    const details = rowWords
      .filter((word) => word !== itemWord && word.left < ratingRules[0])
      .sort((a, b) => Math.abs(a.top - b.top) > 5 ? a.top - b.top : a.left - b.left)
      .map((word) => word.text).join(" ").replace(/\s+/g, " ").trim();
    detected.push({
      item: itemMatch ? Number(itemMatch[0]) : null,
      page,
      details,
      rating: hasConfidentMark ? ([1, 0, -1] as const)[winner.column] : null,
      numberStatus: itemMatch ? "พบเลขข้อ" : "นับจากแถวตาราง",
      rowTop: top,
      rowBottom: bottom,
      itemLeft,
      itemRight,
    });
  }
  return detected;
}

function reconcileIocItems(detected: OcrItem[], expectedItemCount: number, firstItem = 1) {
  const rows = detected.map((entry) => ({ ...entry }));
  const pages = [...new Set(rows.map((entry) => entry.page))].sort((a, b) => a - b);
  let nextItem = firstItem;

  pages.forEach((page) => {
    const pageRows = rows.filter((entry) => entry.page === page);
    const anchors = pageRows.flatMap((entry, index) =>
      entry.item !== null && entry.item >= 1 && entry.item <= expectedItemCount
        ? [{ index, item: entry.item }]
        : [],
    );

    pageRows.forEach((entry, index) => {
      if (entry.item !== null) return;
      let numberedItem = nextItem + index;
      if (anchors.length) {
        const nearest = anchors.reduce((best, anchor) =>
          Math.abs(anchor.index - index) < Math.abs(best.index - index) ? anchor : best,
        );
        numberedItem = nearest.item + (index - nearest.index);
      }
      if (numberedItem >= 1 && numberedItem <= expectedItemCount) {
        entry.item = numberedItem;
        entry.numberStatus = "นับจากแถวตาราง";
      }
    });

    const validItems = pageRows.flatMap((entry) =>
      entry.item !== null && entry.item >= 1 && entry.item <= expectedItemCount
        ? [entry.item]
        : [],
    );
    if (validItems.length) nextItem = Math.max(...validItems) + 1;
  });

  const byNumber = new Map<number, OcrItem>();
  rows.forEach((entry) => {
    if (entry.item === null || entry.item < 1 || entry.item > expectedItemCount) return;
    const current = byNumber.get(entry.item);
    if (!current || (current.numberStatus !== "พบเลขข้อ" && entry.numberStatus === "พบเลขข้อ")) {
      byNumber.set(entry.item, entry);
    }
  });

  return Array.from({ length: expectedItemCount }, (_, index) => {
    const item = index + 1;
    const found = byNumber.get(item);
    return found
      ? { ...found, item, rowTop: undefined, rowBottom: undefined, itemLeft: undefined, itemRight: undefined }
      : { item, page: null, details: "ไม่พบเลขข้อนี้ในช่วงหน้าที่เลือก", rating: null, numberStatus: "ไม่พบเลขข้อ" as const };
  });
}

export default function ProjectDataImporter({ project, analysisType, suggestedTitle, open, onClose, onImport }: {
  project: ResearchProject;
  analysisType: string;
  suggestedTitle: string;
  open: boolean;
  onClose: () => void;
  onImport: (data: ImportedProjectData) => void;
}) {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [mode, setMode] = useState<"all" | "range">("all");
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [workTitle, setWorkTitle] = useState("");
  const [targetExpert, setTargetExpert] = useState(1);
  const [expectedItemCount, setExpectedItemCount] = useState(30);
  const [tableStartRow, setTableStartRow] = useState(3);
  const [firstItemNumber, setFirstItemNumber] = useState(1);
  const [itemColumn, setItemColumn] = useState("A");
  const [detailColumn, setDetailColumn] = useState("B");
  const [plusColumn, setPlusColumn] = useState("D");
  const [zeroColumn, setZeroColumn] = useState("E");
  const [minusColumn, setMinusColumn] = useState("F");
  const [mappingPage, setMappingPage] = useState(1);
  const [mappingPreview, setMappingPreview] = useState("");
  const [visualMap, setVisualMap] = useState<VisualMap>({});
  const [activeMapKey, setActiveMapKey] = useState<VisualMapKey>("item");

  useEffect(() => {
    if (!open) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase.from("research_files").select("*").eq("project_id", project.id).eq("import_status", "confirmed").order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message);
        setFiles(data ?? []);
      });
  }, [open, project.id]);

  const selectedFile = useMemo(() => files.find((file) => file.id === selectedId), [files, selectedId]);
  const visualMapComplete = (Object.keys(VISUAL_MAP_LABELS) as VisualMapKey[]).every((key) => Boolean(visualMap[key]));
  if (!open) return null;

  function closeDialog() {
    setSelectedId(""); setSource(null); setError(""); setProgress(""); setMode("all"); setWorkTitle(""); setTargetExpert(1); setExpectedItemCount(30); setTableStartRow(3); setFirstItemNumber(1); setItemColumn("A"); setDetailColumn("B"); setPlusColumn("D"); setZeroColumn("E"); setMinusColumn("F"); setMappingPage(1); setMappingPreview(""); setVisualMap({}); setActiveMapKey("item");
    onClose();
  }

  async function showMappingPage(nextSource: LoadedSource, pageNumber: number) {
    if (nextSource.kind === "spreadsheet") return;
    setProgress(`กำลังแสดง${nextSource.kind === "image" ? "รูปภาพ" : `หน้า ${pageNumber}`}…`);
    const canvas = await sourcePageToCanvas(nextSource, pageNumber, 1.5);
    setMappingPreview(canvas.toDataURL("image/jpeg", 0.9));
    canvas.width = 1;
    canvas.height = 1;
    setProgress("");
  }

  async function loadSource(file: ResearchFile) {
    setSelectedId(file.id); setSource(null); setBusy(true); setError(""); setProgress("กำลังเปิดไฟล์…");
    const supabase = getSupabaseClient();
    if (!supabase) { setError("ไม่พบการเชื่อมต่อ Supabase"); setBusy(false); return; }
    const { data, error: downloadError } = await supabase.storage.from("research-documents").download(file.storage_path);
    if (downloadError || !data) { setError(downloadError?.message || "ดาวน์โหลดไฟล์ไม่สำเร็จ"); setBusy(false); return; }
    try {
      const buffer = await data.arrayBuffer();
      if (file.mime_type === "application/pdf" || file.original_name.toLowerCase().endsWith(".pdf")) {
        const { getDocument } = await loadPdfJs();
        const pdf = await getDocument({ data: buffer.slice(0) }).promise;
        const firstPage = await pdf.getPage(1);
        const firstText = await firstPage.getTextContent();
        const positionedHeader: Array<{ text: string; x: number; y: number }> = firstText.items.flatMap((item: unknown): Array<{ text: string; x: number; y: number }> => {
          if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return [];
          const pdfItem = item as { str?: unknown; transform?: unknown[] };
          if (!pdfItem.transform || typeof pdfItem.transform[4] !== "number" || typeof pdfItem.transform[5] !== "number") return [];
          return [{ text: String(pdfItem.str ?? "").trim(), x: Number(pdfItem.transform[4]), y: Number(pdfItem.transform[5]) }];
        }).filter((item: { text: string; x: number; y: number }) => item.text).sort((a: { text: string; x: number; y: number }, b: { text: string; x: number; y: number }) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
        const firstLines: Array<{ y: number; cells: string[] }> = [];
        positionedHeader.forEach((item) => {
          const line = firstLines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
          if (line) line.cells.push(item.text); else firstLines.push({ y: item.y, cells: [item.text] });
        });
        let suggestedFromHeader = titleFromRows(firstLines.map((line) => line.cells));
        if (!suggestedFromHeader) {
          setProgress("กำลังอ่านหัวกระดาษ 2 บรรทัดแรก…");
          const viewport = firstPage.getViewport({ scale: 2 });
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = Math.ceil(viewport.width);
          pageCanvas.height = Math.ceil(viewport.height);
          const pageContext = pageCanvas.getContext("2d", { alpha: false });
          if (pageContext) {
            await firstPage.render({ canvas: pageCanvas, canvasContext: pageContext, viewport }).promise;
            const headerCanvas = document.createElement("canvas");
            headerCanvas.width = pageCanvas.width;
            headerCanvas.height = Math.ceil(pageCanvas.height * 0.35);
            const headerContext = headerCanvas.getContext("2d", { alpha: false });
            if (headerContext) {
              headerContext.drawImage(pageCanvas, 0, 0, headerCanvas.width, headerCanvas.height, 0, 0, headerCanvas.width, headerCanvas.height);
              const { createWorker } = await import("tesseract.js");
              const titleWorker = await createWorker(["tha", "eng"]);
              try {
                const titleResult = await titleWorker.recognize(headerCanvas, {}, { text: true });
                suggestedFromHeader = titleFromRows(ocrTextToRows(titleResult.data.text));
              } finally {
                await titleWorker.terminate();
              }
            }
            headerCanvas.width = 1;
          }
          pageCanvas.width = 1;
        }
        if (!workTitle.trim() && suggestedFromHeader) setWorkTitle(suggestedFromHeader);
        if (typeof firstPage.cleanup === "function") firstPage.cleanup();
        const nextSource: LoadedSource = { file, buffer, kind: "pdf", unit: "หน้า", total: pdf.numPages };
        setSource(nextSource);
        setEnd(pdf.numPages);
        if (typeof pdf.destroy === "function") await pdf.destroy();
        await showMappingPage(nextSource, 1);
      } else if (file.mime_type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.original_name)) {
        const nextSource: LoadedSource = { file, buffer, kind: "image", unit: "หน้า", total: 1 };
        setSource(nextSource);
        setEnd(1);
        await showMappingPage(nextSource, 1);
        if (!workTitle.trim()) {
          setProgress("กำลังอ่านหัวกระดาษ 2 บรรทัดแรก…");
          const imageCanvas = await sourcePageToCanvas(nextSource, 1, 1.5);
          const headerCanvas = document.createElement("canvas");
          headerCanvas.width = imageCanvas.width;
          headerCanvas.height = Math.ceil(imageCanvas.height * 0.35);
          const headerContext = headerCanvas.getContext("2d", { alpha: false });
          if (headerContext) {
            headerContext.drawImage(imageCanvas, 0, 0, headerCanvas.width, headerCanvas.height, 0, 0, headerCanvas.width, headerCanvas.height);
            const { createWorker } = await import("tesseract.js");
            const titleWorker = await createWorker(["tha", "eng"]);
            try {
              const titleResult = await titleWorker.recognize(headerCanvas, {}, { text: true });
              const suggestedFromHeader = titleFromRows(ocrTextToRows(titleResult.data.text));
              if (suggestedFromHeader) setWorkTitle(suggestedFromHeader);
            } finally {
              await titleWorker.terminate();
            }
          }
          imageCanvas.width = 1;
          headerCanvas.width = 1;
        }
      } else {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
        const mapping = inferSpreadsheetMapping(raw);
        setTableStartRow(mapping.startRow);
        setFirstItemNumber(mapping.firstItem);
        setItemColumn(mapping.itemColumn);
        setDetailColumn(mapping.detailColumn);
        setPlusColumn(mapping.plusColumn);
        setZeroColumn(mapping.zeroColumn);
        setMinusColumn(mapping.minusColumn);
        const suggestedFromHeader = titleFromRows(raw);
        if (!workTitle.trim() && suggestedFromHeader) setWorkTitle(suggestedFromHeader);
        setSource({ file, buffer, kind: "spreadsheet", unit: "แถว", total: Math.max(raw.length, 1) });
        setEnd(Math.max(raw.length, 1));
      }
    } catch {
      setError("ไม่สามารถอ่านเนื้อหาไฟล์นี้ได้ อาจเป็น PDF แบบสแกนภาพหรือไฟล์เสียหาย");
    } finally { setBusy(false); setProgress(""); }
  }

  function setVisualPosition(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
    setVisualMap((current) => ({ ...current, [activeMapKey]: point }));
    const order: VisualMapKey[] = ["item", "detail", "plus", "zero", "minus"];
    const nextIndex = order.indexOf(activeMapKey) + 1;
    if (nextIndex < order.length) setActiveMapKey(order[nextIndex]);
  }

  async function uploadNewFile(draft: FileDraft) {
    const supabase = getSupabaseClient();
    if (!supabase) { setError("ไม่พบการเชื่อมต่อ Supabase"); return; }
    setBusy(true); setError("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;
    if (authError || !user) { setError("กรุณาเข้าสู่ระบบใหม่ก่อนเพิ่มไฟล์"); setBusy(false); return; }
    const safeName = draft.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${user.id}/${project.id}/${newId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("research-documents").upload(path, draft.file, { upsert: false, contentType: draft.file.type });
    if (uploadError) { setError(uploadError.message); setBusy(false); return; }
    const previewJson = draft.kind === "spreadsheet" ? { columns: draft.columns, rows: draft.rows, sheet: draft.sheet } : null;
    const { data: savedFile, error: fileError } = await supabase.from("research_files").insert({ project_id: project.id, owner_id: user.id, storage_path: path, original_name: draft.file.name, mime_type: draft.file.type || "application/octet-stream", size_bytes: draft.file.size, preview_json: previewJson }).select().single();
    if (fileError || !savedFile) {
      await supabase.storage.from("research-documents").remove([path]);
      setError(fileError?.message || "บันทึกข้อมูลไฟล์ไม่สำเร็จ"); setBusy(false); return;
    }
    if (draft.kind === "spreadsheet") {
      const { error: datasetError } = await supabase.from("research_datasets").insert({ project_id: project.id, owner_id: user.id, source_file_id: savedFile.id, name: draft.file.name, columns_json: draft.columns, rows_json: draft.rows });
      if (datasetError) setError(`เพิ่มไฟล์แล้ว แต่สร้างชุดตารางไม่สำเร็จ: ${datasetError.message}`);
    }
    setFiles((items) => [savedFile, ...items]);
    setShowUpload(false); setBusy(false); setProgress("เพิ่มไฟล์ลงในโครงการแล้ว กำลังเปิดไฟล์…");
    await loadSource(savedFile);
  }

  async function extractRows() {
    if (!source) return;
    const from = mode === "all" ? 1 : Math.max(1, Math.min(start, source.total));
    const to = mode === "all" ? source.total : Math.max(from, Math.min(end, source.total));
    setBusy(true); setError("");
    try {
      if (analysisType === "ioc" && source.kind !== "spreadsheet") {
        const missingPoints = (Object.keys(VISUAL_MAP_LABELS) as VisualMapKey[]).filter((key) => !visualMap[key]);
        if (missingPoints.length) throw new Error(`กรุณาคลิกกำหนดตำแหน่งให้ครบ: ${missingPoints.map((key) => VISUAL_MAP_LABELS[key]).join(", ")}`);
      }
      let rows: unknown[][] = [];
      let extractionWarning: string | undefined;
      const detectedIocItems: OcrItem[] = [];
      if (source.unit === "แถว") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(source.buffer, { type: "array", cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
        rows = raw.slice(from - 1, to);
        if (analysisType === "ioc") {
          const itemIndex = columnLabelToIndex(itemColumn);
          const detailIndex = columnLabelToIndex(detailColumn);
          const scoreIndexes = [plusColumn, zeroColumn, minusColumn].map(columnLabelToIndex);
          if ([itemIndex, detailIndex, ...scoreIndexes].some((index) => index < 0)) {
            throw new Error("กรุณาระบุคอลัมน์ Excel เป็นตัวอักษร เช่น A, B, D, E, F");
          }
          const startIndex = Math.max(0, tableStartRow - 1);
          const spreadsheetItems = raw.slice(startIndex).flatMap((row, offset) => {
            const fallbackItem = firstItemNumber + offset;
            if (fallbackItem > expectedItemCount) return [];
            const readItem = Number(normalizeOcrDigits(String(row[itemIndex] ?? "")).match(/\d{1,3}/)?.[0] ?? "");
            const item = readItem >= 1 && readItem <= expectedItemCount ? readItem : fallbackItem;
            const marked = scoreIndexes.map((index) => hasSpreadsheetMark(row[index]));
            const markedCount = marked.filter(Boolean).length;
            const rating = markedCount === 1 ? ([1, 0, -1] as const)[marked.findIndex(Boolean)] : null;
            return [{
              item,
              page: tableStartRow + offset,
              details: String(row[detailIndex] ?? "").trim(),
              rating,
              numberStatus: readItem === item ? "พบเลขข้อ" as const : "นับจากแถวตาราง" as const,
              rowTop: 0,
              rowBottom: 0,
              itemLeft: 0,
              itemRight: 0,
            }];
          });
          detectedIocItems.push(...spreadsheetItems);
          const conflicts = spreadsheetItems.filter((item) => item.rating === null).length;
          extractionWarning = `อ่านตาราง Excel จากแถว ${tableStartRow}: เลขข้อ ${itemColumn} · รายละเอียด ${detailColumn} · +1 ${plusColumn} · 0 ${zeroColumn} · -1 ${minusColumn} · ต้องตรวจคะแนน ${conflicts} ข้อ`;
        }
      } else if (source.kind === "image") {
        const canvas = await sourcePageToCanvas(source, 1, 2);
        const { createWorker } = await import("tesseract.js");
        const ocrWorker = await createWorker(["tha", "eng"], 1, {
          logger: (message) => {
            if (message.status === "recognizing text") setProgress(`กำลัง OCR รูปภาพ — ${Math.round((message.progress || 0) * 100)}%`);
          },
        });
        try {
          const result = await ocrWorker.recognize(canvas, {}, { text: true, tsv: analysisType === "ioc" });
          rows = ocrTextToRows(result.data.text);
          if (analysisType === "ioc") {
            const pageItems = detectIocItems(canvas, result.data.tsv, 1, visualMap);
            const unreadNumbers = pageItems.filter((entry) => entry.item === null);
            await ocrWorker.setParameters({ tessedit_char_whitelist: "0123456789๐๑๒๓๔๕๖๗๘๙", tessedit_pageseg_mode: "11" as never });
            for (const entry of unreadNumbers) {
              const padding = 4;
              const sourceX = Math.max(0, Math.floor(entry.itemLeft + padding));
              const sourceY = Math.max(0, Math.floor(entry.rowTop + padding));
              const sourceWidth = Math.max(12, Math.floor(entry.itemRight - entry.itemLeft - padding * 2));
              const sourceHeight = Math.max(12, Math.floor(entry.rowBottom - entry.rowTop - padding * 2));
              const numberCanvas = document.createElement("canvas");
              numberCanvas.width = sourceWidth * 3;
              numberCanvas.height = sourceHeight * 3;
              const numberContext = numberCanvas.getContext("2d", { alpha: false });
              if (!numberContext) continue;
              numberContext.fillStyle = "white";
              numberContext.fillRect(0, 0, numberCanvas.width, numberCanvas.height);
              numberContext.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, numberCanvas.width, numberCanvas.height);
              const numberResult = await ocrWorker.recognize(numberCanvas, {}, { text: true });
              const numberMatch = normalizeOcrDigits(numberResult.data.text).match(/\d{1,3}/);
              const detectedNumber = numberMatch ? Number(numberMatch[0]) : null;
              if (detectedNumber !== null && detectedNumber >= 1 && detectedNumber <= expectedItemCount) {
                entry.item = detectedNumber;
                entry.numberStatus = "พบเลขข้อ";
              }
              numberCanvas.width = 1;
            }
            detectedIocItems.push(...pageItems);
          }
        } finally {
          await ocrWorker.terminate();
          canvas.width = 1;
        }
        const reconciledItems = reconcileIocItems(detectedIocItems, expectedItemCount, firstItemNumber);
        const ratedCount = reconciledItems.filter((item) => item.rating !== null).length;
        extractionWarning = `ใช้ตำแหน่งที่ผู้ใช้กำหนดบนรูปภาพ และพบรอยปากกาในช่อง +1/0/-1 จำนวน ${ratedCount} ข้อ กรุณาตรวจยืนยัน`;
      } else {
        const { getDocument } = await loadPdfJs();
        const pdf = await getDocument({ data: source.buffer.slice(0) }).promise;
        const failedPages: number[] = [];
        const ocrPages: number[] = [];
        let lastPageError = "";
        let ocrWorker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
        try {
          for (let pageNumber = from; pageNumber <= to; pageNumber += 1) {
            setProgress(`กำลังอ่านข้อความหน้า ${pageNumber} จาก ${to}`);
            let page: Awaited<ReturnType<typeof pdf.getPage>> | null = null;
            try {
              page = await pdf.getPage(pageNumber);
              const text = await page.getTextContent();
              const positioned: Array<{ text: string; x: number; y: number }> = text.items.flatMap((item: unknown) => {
                if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return [];
                const pdfItem = item as { str?: unknown; transform?: unknown[] };
                const value = String(pdfItem.str ?? "").trim();
                if (!value || !pdfItem.transform || typeof pdfItem.transform[4] !== "number") return [];
                return [{ text: value, x: Number(pdfItem.transform[4]) || 0, y: Number(pdfItem.transform[5]) || 0 }];
              }).sort((a: { text: string; x: number; y: number }, b: { text: string; x: number; y: number }) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
              const lines: Array<{ y: number; cells: string[] }> = [];
              positioned.forEach((item) => {
                const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
                if (line) line.cells.push(item.text); else lines.push({ y: item.y, cells: [item.text] });
              });
              if (lines.length && analysisType !== "ioc") {
                rows.push(...lines.map((line) => line.cells));
              } else {
                setProgress(`กำลังเตรียม OCR ไทย–อังกฤษ หน้า ${pageNumber} จาก ${to}`);
                if (!ocrWorker) {
                  const { createWorker } = await import("tesseract.js");
                  ocrWorker = await createWorker(["tha", "eng"], 1, {
                    logger: (message) => {
                      if (message.status !== "recognizing text") return;
                      const percent = Math.round((message.progress || 0) * 100);
                      setProgress(`กำลัง OCR หน้า ${pageNumber} จาก ${to} — ${percent}%`);
                    },
                  });
                }
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement("canvas");
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                const context = canvas.getContext("2d", { alpha: false });
                if (!context) throw new Error("เบราว์เซอร์ไม่รองรับการสร้างภาพสำหรับ OCR");
                await page.render({ canvas, canvasContext: context, viewport }).promise;
                const result = await ocrWorker.recognize(canvas, {}, { text: true, tsv: analysisType === "ioc" });
                const ocrRows = ocrTextToRows(result.data.text);
                if (analysisType === "ioc") {
                  const pageItems = detectIocItems(canvas, result.data.tsv, pageNumber, visualMap);
                  const unreadNumbers = pageItems.filter((entry) => entry.item === null);
                  await ocrWorker.setParameters({ tessedit_char_whitelist: "0123456789๐๑๒๓๔๕๖๗๘๙", tessedit_pageseg_mode: "11" as never });
                  for (let rowIndex = 0; rowIndex < unreadNumbers.length; rowIndex += 1) {
                    const entry = unreadNumbers[rowIndex];
                    setProgress(`กำลังอ่านเลขข้อหน้า ${pageNumber} แถว ${rowIndex + 1}/${unreadNumbers.length}`);
                    const padding = 4;
                    const sourceX = Math.max(0, Math.floor(entry.itemLeft + padding));
                    const sourceY = Math.max(0, Math.floor(entry.rowTop + padding));
                    const sourceWidth = Math.max(12, Math.floor(entry.itemRight - entry.itemLeft - padding * 2));
                    const sourceHeight = Math.max(12, Math.floor(entry.rowBottom - entry.rowTop - padding * 2));
                    const numberCanvas = document.createElement("canvas");
                    numberCanvas.width = sourceWidth * 3;
                    numberCanvas.height = sourceHeight * 3;
                    const numberContext = numberCanvas.getContext("2d", { alpha: false });
                    if (!numberContext) continue;
                    numberContext.fillStyle = "white";
                    numberContext.fillRect(0, 0, numberCanvas.width, numberCanvas.height);
                    numberContext.imageSmoothingEnabled = false;
                    numberContext.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, numberCanvas.width, numberCanvas.height);
                    const numberResult = await ocrWorker.recognize(numberCanvas, {}, { text: true });
                    const numberMatch = normalizeOcrDigits(numberResult.data.text).match(/\d{1,3}/);
                    const detectedNumber = numberMatch ? Number(numberMatch[0]) : null;
                    if (detectedNumber !== null && detectedNumber >= 1 && detectedNumber <= expectedItemCount) {
                      entry.item = detectedNumber;
                      entry.numberStatus = "พบเลขข้อ";
                    }
                    numberCanvas.width = 1;
                    numberCanvas.height = 1;
                  }
                  await ocrWorker.setParameters({ tessedit_char_whitelist: "", tessedit_pageseg_mode: "3" as never });
                  detectedIocItems.push(...pageItems);
                }
                canvas.width = 1;
                canvas.height = 1;
                if (ocrRows.length) {
                  rows.push(...ocrRows);
                  ocrPages.push(pageNumber);
                }
              }
            } catch (pageError) {
              failedPages.push(pageNumber);
              lastPageError = pageError instanceof Error ? pageError.message : String(pageError);
              console.error("[ResearchStat] PDF page extraction failed", { pageNumber, error: pageError });
            } finally {
              if (page && typeof page.cleanup === "function") page.cleanup();
            }
          }
        } finally {
          if (ocrWorker && typeof ocrWorker.terminate === "function") await ocrWorker.terminate();
          if (typeof pdf.destroy === "function") await pdf.destroy();
        }
        if (!rows.length && failedPages.length) throw new Error(`อ่านหน้า ${failedPages.join(", ")} ไม่สำเร็จ${lastPageError ? `: ${lastPageError}` : ""}`);
        const warnings: string[] = [];
        if (ocrPages.length) warnings.push(`ใช้ OCR กับหน้า: ${ocrPages.join(", ")}`);
        const reconciledItems = reconcileIocItems(detectedIocItems, expectedItemCount, firstItemNumber);
        const foundItems = reconciledItems.filter((item) => item.numberStatus !== "ไม่พบเลขข้อ");
        const exactCount = foundItems.filter((item) => item.numberStatus === "พบเลขข้อ").length;
        const inferredCount = foundItems.filter((item) => item.numberStatus === "นับจากแถวตาราง").length;
        const ratedCount = foundItems.filter((item) => item.rating !== null).length;
        warnings.push(`ตรวจทีละหน้า: อ่านเลขจากคอลัมน์ข้อได้ ${exactCount} ข้อ นับจากแถวตาราง ${inferredCount} ข้อ และพบรอยปากกาในช่อง +1/0/-1 จำนวน ${ratedCount} ข้อ กรุณาตรวจยืนยัน`);
        if (failedPages.length) warnings.push(`ข้ามหน้าที่อ่านไม่ได้: ${failedPages.join(", ")}`);
        extractionWarning = warnings.length ? warnings.join(" · ") : undefined;
      }
      if (!rows.length) { setError("ไม่พบข้อความหรือตารางในช่วงที่เลือก แม้ลอง OCR แล้ว กรุณาตรวจสอบว่าภาพคมชัดหรือเลือกช่วงหน้าอื่น"); return; }
      const title = workTitle.trim() || titleFromRows(rows) || suggestedTitle;
      const rangeLabel = mode === "all" ? `${source.unit} ${from}–${to} (ทั้งหมด)` : `${source.unit} ${from}–${to}`;
      const ocrItems = analysisType === "ioc" ? reconcileIocItems(detectedIocItems, expectedItemCount, firstItemNumber) : [];
      const iocRatings = ocrItems.flatMap((entry) => entry.rating === null ? [] : [{ item: entry.item, rating: entry.rating }]);
      onImport({ id: Date.now(), workTitle: title, sourceName: source.file.original_name, rangeLabel, rows, warning: extractionWarning, iocRatings: iocRatings.length ? iocRatings : undefined, ocrItems: ocrItems.length ? ocrItems : undefined, targetExpert: analysisType === "ioc" ? targetExpert : undefined, expectedItemCount: analysisType === "ioc" ? expectedItemCount : undefined, sourceRange: { from, to, unit: source.unit } });
      closeDialog();
    } catch (extractError) {
      const detail = extractError instanceof Error ? extractError.message : String(extractError);
      console.error("[ResearchStat] Project data extraction failed", extractError);
      setError(`ดึงข้อมูลจากไฟล์ไม่สำเร็จ: ${detail || "กรุณาตรวจสอบรูปแบบไฟล์"}`);
    } finally { setBusy(false); setProgress(""); }
  }

  return <div className="modal-backdrop"><section className="small-modal source-modal" role="dialog" aria-modal="true" aria-label="นำข้อมูลจากไฟล์โครงการ">
    <header><div><span className="step-label">PROJECT DATA</span><h2>นำข้อมูลจากไฟล์โครงการ</h2><p>เลือกไฟล์และช่วงข้อมูลที่จะเพิ่มในเครื่องมือปัจจุบัน</p></div><button className="close-button" onClick={closeDialog}>×</button></header>
    <label className="work-title-field">ชื่องานย่อยในโครงการ<input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} placeholder={suggestedTitle}/><small>ระบบนำข้อความ 2 บรรทัดแรกจากหัวกระดาษมาตั้งชื่อให้อัตโนมัติ และคุณแก้ไขได้</small></label>
    {analysisType === "ioc" && <label className="work-title-field">นำเข้าคะแนนสำหรับผู้เชี่ยวชาญคนที่<input type="number" min={1} max={30} value={targetExpert} onChange={(event) => setTargetExpert(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}/><small>คะแนนที่ตรวจพบจะถูกใส่ในคอลัมน์ของผู้เชี่ยวชาญคนนี้</small></label>}
    {analysisType === "ioc" && <label className="work-title-field required-count">แบบประเมินนี้มีทั้งหมดกี่ข้อ<input type="number" min={1} max={300} value={expectedItemCount} onChange={(event) => setExpectedItemCount(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}/><small>ระบบตรวจทีละหน้า: อ่านเลขจากคอลัมน์ข้อ แล้วตรวจรอยปากกาในคอลัมน์ +1, 0 และ -1 ของแต่ละแถว</small></label>}
    <div className="source-file-head"><b>ไฟล์ข้อมูล</b><button type="button" onClick={() => setShowUpload(true)}>+ เพิ่มไฟล์ใหม่</button></div>
    {files.length === 0 ? <div className="source-empty">โครงการนี้ยังไม่มีไฟล์ กด “เพิ่มไฟล์ใหม่” เพื่อเริ่มต้น</div> : <>
      <label><span className="sr-only">เลือกไฟล์ข้อมูล</span><select value={selectedId} onChange={(event) => { const file = files.find((item) => item.id === event.target.value); if (file) void loadSource(file); }}><option value="">— เลือกไฟล์ —</option>{files.map((file) => <option key={file.id} value={file.id}>{file.original_name}</option>)}</select></label>
      {selectedFile && !source && busy && <div className="source-status">กำลังอ่าน {selectedFile.original_name}…</div>}
      {source && <div className="source-range"><b>พบ {source.total} {source.unit}</b>{source.unit === "หน้า" && <small>คลิกกำหนดคอลัมน์บนภาพด้านล่าง ระบบจะใช้ตำแหน่งนั้นอ่านเลขข้อและรอยปากกา</small>}<label className="radio-row"><input type="radio" checked={mode === "all"} onChange={() => setMode("all")}/> ใช้{source.unit}ทั้งหมด</label><label className="radio-row"><input type="radio" checked={mode === "range"} onChange={() => setMode("range")}/> กำหนดช่วง{source.unit}</label>{mode === "range" && <div className="range-inputs"><label>จาก{source.unit}<input type="number" min={1} max={source.total} value={start} onChange={(e) => setStart(Number(e.target.value))}/></label><label>ถึง{source.unit}<input type="number" min={1} max={source.total} value={end} onChange={(e) => setEnd(Number(e.target.value))}/></label></div>}</div>}
      {source && source.unit === "หน้า" && analysisType === "ioc" && <section className="visual-ioc-map"><div className="visual-map-head"><div><b>กำหนดตำแหน่งบน {source.kind === "image" ? "รูปภาพ" : "PDF"}</b><small>เลือกหัวข้อแล้วคลิกตรงกลางเซลล์บนภาพ เริ่มจากช่องเลขข้อแรก</small></div><button type="button" onClick={() => { setVisualMap({}); setActiveMapKey("item"); }}>ล้างตำแหน่ง</button></div><div className="visual-map-settings"><label>เลขข้อแรกในช่วง<input type="number" min={1} max={expectedItemCount} value={firstItemNumber} onChange={(event) => setFirstItemNumber(Math.max(1, Number(event.target.value) || 1))}/></label>{source.kind === "pdf" && <label>หน้าตัวอย่าง<input type="number" min={1} max={source.total} value={mappingPage} onChange={(event) => { const page = Math.max(1, Math.min(source.total, Number(event.target.value) || 1)); setMappingPage(page); void showMappingPage(source, page); }}/></label>}</div><div className="visual-map-buttons">{(Object.keys(VISUAL_MAP_LABELS) as VisualMapKey[]).map((key) => <button type="button" key={key} className={`${activeMapKey === key ? "active" : ""} ${visualMap[key] ? "done" : ""}`} onClick={() => setActiveMapKey(key)}><span>{visualMap[key] ? "✓" : "○"}</span>{VISUAL_MAP_LABELS[key]}</button>)}</div>{mappingPreview ? <div className="visual-map-image" onClick={setVisualPosition} role="button" tabIndex={0} aria-label={`คลิกกำหนดตำแหน่ง ${VISUAL_MAP_LABELS[activeMapKey]}`}><img src={mappingPreview} alt={`หน้าตัวอย่างสำหรับกำหนดตำแหน่ง ${VISUAL_MAP_LABELS[activeMapKey]}`}/>{(Object.entries(visualMap) as Array<[VisualMapKey, VisualPoint]>).map(([key, point]) => <span key={key} className={`visual-marker marker-${key}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>{VISUAL_MAP_LABELS[key]}</span>)}</div> : <div className="source-status">กำลังเตรียมภาพตัวอย่าง…</div>}<p className={visualMapComplete ? "map-ready" : "map-pending"}>{visualMapComplete ? `กำหนดครบแล้ว ระบบจะใช้ตำแหน่งนี้ตรวจช่วงหน้า ${mode === "all" ? `1–${source.total}` : `${start}–${end}`}` : `ตำแหน่งที่กำลังรอ: ${VISUAL_MAP_LABELS[activeMapKey]}`}</p></section>}
      {source && source.unit === "แถว" && analysisType === "ioc" && <section className="excel-ioc-map"><div><b>กำหนดตำแหน่งตาราง IOC ใน Excel</b><small>ตรวจค่าที่ระบบเสนอและแก้ไขให้ตรงกับไฟล์จริงก่อนนำเข้า</small></div><div className="excel-map-grid"><label>เลขข้อแรก<input type="number" min={1} max={expectedItemCount} value={firstItemNumber} onChange={(event) => setFirstItemNumber(Math.max(1, Number(event.target.value) || 1))}/></label><label>เริ่มที่แถว<input type="number" min={1} max={source.total} value={tableStartRow} onChange={(event) => setTableStartRow(Math.max(1, Number(event.target.value) || 1))}/></label><label>คอลัมน์เลขข้อ<input value={itemColumn} onChange={(event) => setItemColumn(event.target.value.toUpperCase())}/></label><label>คอลัมน์รายละเอียด<input value={detailColumn} onChange={(event) => setDetailColumn(event.target.value.toUpperCase())}/></label><label>คอลัมน์ +1<input value={plusColumn} onChange={(event) => setPlusColumn(event.target.value.toUpperCase())}/></label><label>คอลัมน์ 0<input value={zeroColumn} onChange={(event) => setZeroColumn(event.target.value.toUpperCase())}/></label><label>คอลัมน์ -1<input value={minusColumn} onChange={(event) => setMinusColumn(event.target.value.toUpperCase())}/></label></div><p>ตัวอย่าง: ข้อ {firstItemNumber} เริ่มแถว {tableStartRow} · เลขข้อ {itemColumn || "—"} · รายละเอียด {detailColumn || "—"} · คะแนน +1={plusColumn || "—"}, 0={zeroColumn || "—"}, -1={minusColumn || "—"}</p></section>}
    </>}
    {(error || progress) && <div className={error ? "import-error" : "source-status"}>{error || progress}</div>}
    <footer><button className="secondary-action" onClick={closeDialog}>ยกเลิก</button><button className="primary-action" disabled={!source || busy || (analysisType === "ioc" && source.unit === "หน้า" && !visualMapComplete)} onClick={() => void extractRows()}>{busy ? "กำลังอ่าน…" : "นำข้อมูลเข้าเครื่องมือ"}</button></footer>
  </section><FileImportDialog open={showUpload} busy={busy} onClose={() => setShowUpload(false)} onConfirm={uploadNewFile}/></div>;
}
