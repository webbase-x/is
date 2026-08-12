"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getSupabaseClient } from "../lib/supabase/client";
import type { ResearchFile, ResearchProject } from "../lib/supabase/types";

const PDF_JS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.mjs";
const PDF_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";

async function loadPdfJs() {
  const pdfjs = await import(/* @vite-ignore */ PDF_JS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  return pdfjs;
}

export interface ImportedProjectData {
  id: number;
  sourceName: string;
  rangeLabel: string;
  rows: unknown[][];
}

type LoadedSource = {
  file: ResearchFile;
  buffer: ArrayBuffer;
  unit: "หน้า" | "แถว";
  total: number;
};

export default function ProjectDataImporter({ project, open, onClose, onImport }: {
  project: ResearchProject;
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
    setSelectedId(""); setSource(null); setError(""); setProgress(""); setMode("all");
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

  async function extractRows() {
    if (!source) return;
    const from = mode === "all" ? 1 : Math.max(1, Math.min(start, source.total));
    const to = mode === "all" ? source.total : Math.max(from, Math.min(end, source.total));
    setBusy(true); setError("");
    try {
      let rows: unknown[][] = [];
      if (source.unit === "แถว") {
        const workbook = XLSX.read(source.buffer, { type: "array", cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
        rows = raw.slice(from - 1, to);
      } else {
        const { getDocument } = await loadPdfJs();
        const pdf = await getDocument({ data: source.buffer.slice(0) }).promise;
        for (let pageNumber = from; pageNumber <= to; pageNumber += 1) {
          setProgress(`กำลังอ่านข้อความหน้า ${pageNumber} จาก ${to}`);
          const page = await pdf.getPage(pageNumber);
          const text = await page.getTextContent();
          const positioned = text.items.flatMap((item) => {
            if (!("str" in item) || !("transform" in item) || !item.str.trim()) return [];
            return [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }];
          }).sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
          const lines: Array<{ y: number; cells: string[] }> = [];
          positioned.forEach((item) => {
            const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
            if (line) line.cells.push(item.text); else lines.push({ y: item.y, cells: [item.text] });
          });
          rows.push(...lines.map((line) => line.cells));
        }
        await pdf.destroy();
      }
      if (!rows.length) { setError("ไม่พบข้อความหรือตารางในช่วงที่เลือก หากเป็น PDF สแกนภาพจะต้องใช้ OCR ก่อน"); return; }
      onImport({ id: Date.now(), sourceName: source.file.original_name, rangeLabel: mode === "all" ? `${source.unit}ทั้งหมด` : `${source.unit} ${from}–${to}`, rows });
      closeDialog();
    } catch {
      setError("ดึงข้อมูลจากไฟล์ไม่สำเร็จ กรุณาลองเลือกช่วงที่สั้นลงหรือตรวจสอบรูปแบบไฟล์");
    } finally { setBusy(false); setProgress(""); }
  }

  return <div className="modal-backdrop"><section className="small-modal source-modal" role="dialog" aria-modal="true" aria-label="นำข้อมูลจากไฟล์โครงการ">
    <header><div><span className="step-label">PROJECT DATA</span><h2>นำข้อมูลจากไฟล์โครงการ</h2><p>เลือกไฟล์และช่วงข้อมูลที่จะเพิ่มในเครื่องมือปัจจุบัน</p></div><button className="close-button" onClick={closeDialog}>×</button></header>
    {files.length === 0 ? <div className="source-empty">โครงการนี้ยังไม่มีไฟล์ กรุณากลับไปเพิ่มไฟล์ก่อน</div> : <>
      <label>ไฟล์ข้อมูล<select value={selectedId} onChange={(event) => { const file = files.find((item) => item.id === event.target.value); if (file) void loadSource(file); }}><option value="">— เลือกไฟล์ —</option>{files.map((file) => <option key={file.id} value={file.id}>{file.original_name}</option>)}</select></label>
      {selectedFile && !source && busy && <div className="source-status">กำลังอ่าน {selectedFile.original_name}…</div>}
      {source && <div className="source-range"><b>พบ {source.total} {source.unit}</b><label className="radio-row"><input type="radio" checked={mode === "all"} onChange={() => setMode("all")}/> ใช้{source.unit}ทั้งหมด</label><label className="radio-row"><input type="radio" checked={mode === "range"} onChange={() => setMode("range")}/> กำหนดช่วง{source.unit}</label>{mode === "range" && <div className="range-inputs"><label>จาก{source.unit}<input type="number" min={1} max={source.total} value={start} onChange={(e) => setStart(Number(e.target.value))}/></label><label>ถึง{source.unit}<input type="number" min={1} max={source.total} value={end} onChange={(e) => setEnd(Number(e.target.value))}/></label></div>}</div>}
    </>}
    {(error || progress) && <div className={error ? "import-error" : "source-status"}>{error || progress}</div>}
    <footer><button className="secondary-action" onClick={closeDialog}>ยกเลิก</button><button className="primary-action" disabled={!source || busy} onClick={() => void extractRows()}>{busy ? "กำลังอ่าน…" : "นำข้อมูลเข้าเครื่องมือ"}</button></footer>
  </section></div>;
}
