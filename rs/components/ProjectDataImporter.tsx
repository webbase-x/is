"use client";

import { useEffect, useMemo, useState } from "react";
import FileImportDialog from "./FileImportDialog";
import { getSupabaseClient } from "../lib/supabase/client";
import type { FileDraft, ResearchFile, ResearchProject } from "../lib/supabase/types";

const PDF_JS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.mjs";
const PDF_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
}

type LoadedSource = {
  file: ResearchFile;
  buffer: ArrayBuffer;
  unit: "หน้า" | "แถว";
  total: number;
};

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
    setSelectedId(""); setSource(null); setError(""); setProgress(""); setMode("all"); setWorkTitle("");
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
        await pdf.destroy();
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
        let lastPageError = "";
        try {
          for (let pageNumber = from; pageNumber <= to; pageNumber += 1) {
            setProgress(`กำลังอ่านข้อความหน้า ${pageNumber} จาก ${to}`);
            try {
              const page = await pdf.getPage(pageNumber);
              const text = await page.getTextContent();
              const positioned = text.items.flatMap((item) => {
                if (!("str" in item) || !("transform" in item)) return [];
                const value = String(item.str ?? "").trim();
                if (!value || !item.transform || typeof item.transform[4] !== "number") return [];
                return [{ text: value, x: Number(item.transform[4]) || 0, y: Number(item.transform[5]) || 0 }];
              }).sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
              const lines: Array<{ y: number; cells: string[] }> = [];
              positioned.forEach((item) => {
                const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
                if (line) line.cells.push(item.text); else lines.push({ y: item.y, cells: [item.text] });
              });
              rows.push(...lines.map((line) => line.cells));
              page.cleanup();
            } catch (pageError) {
              failedPages.push(pageNumber);
              lastPageError = pageError instanceof Error ? pageError.message : String(pageError);
              console.error("[ResearchStat] PDF page extraction failed", { pageNumber, error: pageError });
            }
          }
        } finally {
          await pdf.destroy();
        }
        if (!rows.length && failedPages.length) throw new Error(`อ่านหน้า ${failedPages.join(", ")} ไม่สำเร็จ${lastPageError ? `: ${lastPageError}` : ""}`);
        if (failedPages.length) extractionWarning = `ข้ามหน้าที่อ่านไม่ได้: ${failedPages.join(", ")}`;
      }
      if (!rows.length) { setError("ไม่พบข้อความหรือตารางในช่วงที่เลือก หากเป็น PDF สแกนภาพจะต้องใช้ OCR ก่อน"); return; }
      const title = workTitle.trim() || suggestedTitle;
      const rangeLabel = mode === "all" ? `${source.unit}ทั้งหมด` : `${source.unit} ${from}–${to}`;
      const supabase = getSupabaseClient();
      if (!supabase) { setError("ไม่พบการเชื่อมต่อ Supabase"); return; }
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { setError("กรุณาเข้าสู่ระบบใหม่ก่อนบันทึกงานย่อย"); return; }
      const { data: analysis, error: saveError } = await supabase.from("research_analyses").insert({
        project_id: project.id,
        owner_id: authData.user.id,
        analysis_type: analysisType,
        title,
        input_json: { source_file_id: source.file.id, source_name: source.file.original_name, range_label: rangeLabel, row_count: rows.length },
        result_json: {},
      }).select("id").single();
      if (saveError || !analysis) { setError(saveError?.message || "บันทึกชื่องานย่อยไม่สำเร็จ"); return; }
      onImport({ id: Date.now(), workTitle: title, sourceName: source.file.original_name, rangeLabel, rows, warning: extractionWarning });
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
    <div className="source-file-head"><b>ไฟล์ข้อมูล</b><button type="button" onClick={() => setShowUpload(true)}>+ เพิ่มไฟล์ใหม่</button></div>
    {files.length === 0 ? <div className="source-empty">โครงการนี้ยังไม่มีไฟล์ กด “เพิ่มไฟล์ใหม่” เพื่อเริ่มต้น</div> : <>
      <label><span className="sr-only">เลือกไฟล์ข้อมูล</span><select value={selectedId} onChange={(event) => { const file = files.find((item) => item.id === event.target.value); if (file) void loadSource(file); }}><option value="">— เลือกไฟล์ —</option>{files.map((file) => <option key={file.id} value={file.id}>{file.original_name}</option>)}</select></label>
      {selectedFile && !source && busy && <div className="source-status">กำลังอ่าน {selectedFile.original_name}…</div>}
      {source && <div className="source-range"><b>พบ {source.total} {source.unit}</b><label className="radio-row"><input type="radio" checked={mode === "all"} onChange={() => setMode("all")}/> ใช้{source.unit}ทั้งหมด</label><label className="radio-row"><input type="radio" checked={mode === "range"} onChange={() => setMode("range")}/> กำหนดช่วง{source.unit}</label>{mode === "range" && <div className="range-inputs"><label>จาก{source.unit}<input type="number" min={1} max={source.total} value={start} onChange={(e) => setStart(Number(e.target.value))}/></label><label>ถึง{source.unit}<input type="number" min={1} max={source.total} value={end} onChange={(e) => setEnd(Number(e.target.value))}/></label></div>}</div>}
    </>}
    {(error || progress) && <div className={error ? "import-error" : "source-status"}>{error || progress}</div>}
    <footer><button className="secondary-action" onClick={closeDialog}>ยกเลิก</button><button className="primary-action" disabled={!source || busy} onClick={() => void extractRows()}>{busy ? "กำลังอ่าน…" : "นำข้อมูลเข้าเครื่องมือ"}</button></footer>
  </section><FileImportDialog open={showUpload} busy={busy} onClose={() => setShowUpload(false)} onConfirm={uploadNewFile}/></div>;
}
