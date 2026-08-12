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
  ocrItems?: Array<{ item: number; page: number | null; details: string; rating: -1 | 0 | 1 | null; numberStatus?: "พบเลขข้อ" | "อนุมานลำดับ" | "ไม่พบเลขข้อ" }>;
  targetExpert?: number;
  expectedItemCount?: number;
  sourceRange?: { from: number; to: number; unit: "หน้า" | "แถว" };
}

type LoadedSource = {
  file: ResearchFile;
  buffer: ArrayBuffer;
  unit: "หน้า" | "แถว";
  total: number;
};

type OcrItem = { item: number | null; page: number; details: string; rating: -1 | 0 | 1 | null; numberStatus: "พบเลขข้อ" | "อนุมานลำดับ" };

function parseTsvWords(tsv: string | null) {
  if (!tsv) return [];
  return tsv.split("\n").slice(1).flatMap((line) => {
    const fields = line.split("\t");
    if (fields.length < 12) return [];
    return [{ left: Number(fields[6]), top: Number(fields[7]), width: Number(fields[8]), height: Number(fields[9]), text: fields.slice(11).join("\t").trim() }];
  });
}

function detectIocItems(canvas: HTMLCanvasElement, tsv: string | null, page: number, numberTsv: string | null): OcrItem[] {
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
  for (let x = Math.floor(width * 0.45); x < width; x += 1) {
    let run = 0, best = 0, last = -10;
    for (let y = 0; y < height; y += 1) if (neutralDark(x, y)) {
      run = y - last <= 3 ? run + (y - last) : 1;
      best = Math.max(best, run); last = y;
    }
    if (best > height * 0.14) verticalScores.push({ at: x, score: best });
  }
  const horizontalRules = clusterPeaks(horizontalScores).sort((a, b) => a - b);
  const verticalRules = clusterPeaks(verticalScores).sort((a, b) => a - b);
  let ratingRules: number[] = [];
  let bestSpan = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= verticalRules.length - 4; index += 1) {
    const group = verticalRules.slice(index, index + 4);
    const gaps = group.slice(1).map((value, gapIndex) => value - group[gapIndex]);
    const valid = group[0] > width * 0.5 && gaps.every((gap) => gap > width * 0.018 && gap < width * 0.12);
    const span = group[3] - group[0];
    if (valid && span < bestSpan) { ratingRules = group; bestSpan = span; }
  }
  if (ratingRules.length !== 4 || horizontalRules.length < 2) return [];

  const numberWords = parseTsvWords(numberTsv).filter((word) => /^\D*[0-9๐-๙]{1,3}\D*$/.test(word.text));
  const words = [...parseTsvWords(tsv), ...numberWords];
  const detected: OcrItem[] = [];
  for (let index = 0; index < horizontalRules.length - 1; index += 1) {
    const top = horizontalRules[index], bottom = horizontalRules[index + 1];
    if (bottom - top < height * 0.035) continue;
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
      const normalized = word.text.replace(/[๐-๙]/g, (digit) => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit).toString());
      return word.left < width * 0.14 && word.top + word.height / 2 > top && word.top + word.height / 2 < bottom && /^\D*\d{1,3}\D*$/.test(normalized);
    });
    const itemMatch = itemWord?.text.replace(/[๐-๙]/g, (digit) => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit).toString()).match(/\d{1,3}/);
    if (!itemWord && !hasConfidentMark) continue;
    const details = words
      .filter((word) => word !== itemWord && word.text && word.left < ratingRules[0] && word.top + word.height / 2 > top && word.top + word.height / 2 < bottom)
      .sort((a, b) => Math.abs(a.top - b.top) > 5 ? a.top - b.top : a.left - b.left)
      .map((word) => word.text).join(" ").replace(/\s+/g, " ").trim();
    detected.push({ item: itemMatch ? Number(itemMatch[0]) : null, page, details, rating: hasConfidentMark ? ([1, 0, -1] as const)[winner.column] : null, numberStatus: itemMatch ? "พบเลขข้อ" : "อนุมานลำดับ" });
  }
  return detected;
}

function reconcileIocItems(detected: OcrItem[], expectedItemCount: number) {
  const rows = detected.map((entry) => ({ ...entry }));
  const anchors = rows.flatMap((entry, index) =>
    entry.item !== null && entry.item >= 1 && entry.item <= expectedItemCount
      ? [{ index, item: entry.item }]
      : [],
  );

  rows.forEach((entry, index) => {
    if (entry.item !== null) return;
    if (!anchors.length) {
      const sequentialItem = index + 1;
      if (sequentialItem <= expectedItemCount) {
        entry.item = sequentialItem;
        entry.numberStatus = "อนุมานลำดับ";
      }
      return;
    }

    const nearest = anchors.reduce((best, anchor) =>
      Math.abs(anchor.index - index) < Math.abs(best.index - index) ? anchor : best,
    );
    const sequentialItem = nearest.item + (index - nearest.index);
    if (sequentialItem >= 1 && sequentialItem <= expectedItemCount) {
      entry.item = sequentialItem;
      entry.numberStatus = "อนุมานลำดับ";
    }
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
      ? { ...found, item }
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
  if (!open) return null;

  function closeDialog() {
    setSelectedId(""); setSource(null); setError(""); setProgress(""); setMode("all"); setWorkTitle(""); setTargetExpert(1); setExpectedItemCount(30);
    onClose();
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
        setSource({ file, buffer, unit: "หน้า", total: pdf.numPages });
        setEnd(pdf.numPages);
        if (typeof pdf.destroy === "function") await pdf.destroy();
      } else {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
        setSource({ file, buffer, unit: "แถว", total: Math.max(raw.length, 1) });
        setEnd(Math.max(raw.length, 1));
      }
    } catch {
      setError("ไม่สามารถอ่านเนื้อหาไฟล์นี้ได้ อาจเป็น PDF แบบสแกนภาพหรือไฟล์เสียหาย");
    } finally { setBusy(false); setProgress(""); }
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
      let rows: unknown[][] = [];
      let extractionWarning: string | undefined;
      const detectedIocItems: OcrItem[] = [];
      if (source.unit === "แถว") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(source.buffer, { type: "array", cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
        rows = raw.slice(from - 1, to);
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
              if (lines.length) {
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
                  setProgress(`กำลังค้นหาเลขข้อหน้า ${pageNumber} จาก ${to}`);
                  const numberCanvas = document.createElement("canvas");
                  numberCanvas.width = Math.ceil(canvas.width * 0.16); numberCanvas.height = canvas.height;
                  const numberContext = numberCanvas.getContext("2d", { alpha: false });
                  if (numberContext) numberContext.drawImage(canvas, 0, 0, numberCanvas.width, canvas.height, 0, 0, numberCanvas.width, canvas.height);
                  await ocrWorker.setParameters({ tessedit_char_whitelist: "0123456789๐๑๒๓๔๕๖๗๘๙", tessedit_pageseg_mode: "11" as never });
                  const numberResult = await ocrWorker.recognize(numberCanvas, {}, { text: true, tsv: true });
                  await ocrWorker.setParameters({ tessedit_char_whitelist: "", tessedit_pageseg_mode: "3" as never });
                  detectedIocItems.push(...detectIocItems(canvas, result.data.tsv, pageNumber, numberResult.data.tsv));
                  numberCanvas.width = 1; numberCanvas.height = 1;
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
        const reconciledItems = reconcileIocItems(detectedIocItems, expectedItemCount);
        const foundItems = reconciledItems.filter((item) => item.numberStatus !== "ไม่พบเลขข้อ");
        const exactCount = foundItems.filter((item) => item.numberStatus === "พบเลขข้อ").length;
        const inferredCount = foundItems.filter((item) => item.numberStatus === "อนุมานลำดับ").length;
        const ratedCount = foundItems.filter((item) => item.rating !== null).length;
        warnings.push(`ค้นหาเลขข้อ 1–${expectedItemCount}: พบเลขโดยตรง ${exactCount} ข้อ จับคู่จากลำดับแถวตาราง ${inferredCount} ข้อ และอ่านคะแนนได้ ${ratedCount} ข้อ กรุณาตรวจยืนยัน`);
        if (failedPages.length) warnings.push(`ข้ามหน้าที่อ่านไม่ได้: ${failedPages.join(", ")}`);
        extractionWarning = warnings.length ? warnings.join(" · ") : undefined;
      }
      if (!rows.length) { setError("ไม่พบข้อความหรือตารางในช่วงที่เลือก แม้ลอง OCR แล้ว กรุณาตรวจสอบว่าภาพคมชัดหรือเลือกช่วงหน้าอื่น"); return; }
      const title = workTitle.trim() || suggestedTitle;
      const rangeLabel = mode === "all" ? `${source.unit} ${from}–${to} (ทั้งหมด)` : `${source.unit} ${from}–${to}`;
      const ocrItems = analysisType === "ioc" ? reconcileIocItems(detectedIocItems, expectedItemCount) : [];
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
    <label className="work-title-field">ชื่องานย่อยในโครงการ<input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} placeholder={suggestedTitle}/><small>ตัวอย่าง: IOC แบบทดสอบผลสัมฤทธิ์ – ผู้เชี่ยวชาญ 1</small></label>
    {analysisType === "ioc" && <label className="work-title-field">นำเข้าคะแนนสำหรับผู้เชี่ยวชาญคนที่<input type="number" min={1} max={30} value={targetExpert} onChange={(event) => setTargetExpert(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}/><small>คะแนนที่ตรวจพบจะถูกใส่ในคอลัมน์ของผู้เชี่ยวชาญคนนี้</small></label>}
    {analysisType === "ioc" && <label className="work-title-field required-count">แบบประเมินนี้มีทั้งหมดกี่ข้อ<input type="number" min={1} max={300} value={expectedItemCount} onChange={(event) => setExpectedItemCount(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}/><small>ระบบจะค้นหาเลขข้อ 1–{expectedItemCount} และใช้ลำดับแถวในตารางช่วยจับคู่เมื่อ OCR อ่านเลขไม่ชัด โดยแสดงสถานะให้ตรวจสอบ</small></label>}
    <div className="source-file-head"><b>ไฟล์ข้อมูล</b><button type="button" onClick={() => setShowUpload(true)}>+ เพิ่มไฟล์ใหม่</button></div>
    {files.length === 0 ? <div className="source-empty">โครงการนี้ยังไม่มีไฟล์ กด “เพิ่มไฟล์ใหม่” เพื่อเริ่มต้น</div> : <>
      <label><span className="sr-only">เลือกไฟล์ข้อมูล</span><select value={selectedId} onChange={(event) => { const file = files.find((item) => item.id === event.target.value); if (file) void loadSource(file); }}><option value="">— เลือกไฟล์ —</option>{files.map((file) => <option key={file.id} value={file.id}>{file.original_name}</option>)}</select></label>
      {selectedFile && !source && busy && <div className="source-status">กำลังอ่าน {selectedFile.original_name}…</div>}
      {source && <div className="source-range"><b>พบ {source.total} {source.unit}</b>{source.unit === "หน้า" && <small>PDF สแกนภาพจะใช้ OCR ภาษาไทย–อังกฤษอัตโนมัติ</small>}<label className="radio-row"><input type="radio" checked={mode === "all"} onChange={() => setMode("all")}/> ใช้{source.unit}ทั้งหมด</label><label className="radio-row"><input type="radio" checked={mode === "range"} onChange={() => setMode("range")}/> กำหนดช่วง{source.unit}</label>{mode === "range" && <div className="range-inputs"><label>จาก{source.unit}<input type="number" min={1} max={source.total} value={start} onChange={(e) => setStart(Number(e.target.value))}/></label><label>ถึง{source.unit}<input type="number" min={1} max={source.total} value={end} onChange={(e) => setEnd(Number(e.target.value))}/></label></div>}</div>}
    </>}
    {(error || progress) && <div className={error ? "import-error" : "source-status"}>{error || progress}</div>}
    <footer><button className="secondary-action" onClick={closeDialog}>ยกเลิก</button><button className="primary-action" disabled={!source || busy} onClick={() => void extractRows()}>{busy ? "กำลังอ่าน…" : "นำข้อมูลเข้าเครื่องมือ"}</button></footer>
  </section><FileImportDialog open={showUpload} busy={busy} onClose={() => setShowUpload(false)} onConfirm={uploadNewFile}/></div>;
}
