"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { FileDraft } from "../lib/supabase/types";

const ACCEPT = ".pdf,.xlsx,.xls,.csv";
const MAX_SIZE = 25 * 1024 * 1024;

export default function FileImportDialog({
  open, busy, onClose, onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (draft: FileDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FileDraft | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (draft?.objectUrl) URL.revokeObjectURL(draft.objectUrl); }, [draft]);
  if (!open) return null;

  async function readFile(file?: File) {
    setError("");
    if (!file) return;
    if (file.size > MAX_SIZE) { setError("ไฟล์มีขนาดเกิน 25 MB"); return; }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "pdf") {
      setDraft({ file, kind: "pdf", objectUrl: URL.createObjectURL(file), columns: [], rows: [] });
      return;
    }
    if (!["xlsx", "xls", "csv"].includes(extension ?? "")) { setError("รองรับเฉพาะ PDF, Excel และ CSV"); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.SheetNames[0];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: "", raw: false });
      const width = Math.max(0, ...raw.map((row) => row.length));
      const first = raw[0] ?? [];
      const columns = Array.from({ length: width }, (_, index) => String(first[index] || `คอลัมน์ ${index + 1}`));
      const rows = raw.slice(1, 101).map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ""));
      setDraft({ file, kind: "spreadsheet", sheet, columns, rows });
    } catch { setError("ไม่สามารถอ่านไฟล์นี้ได้ กรุณาตรวจสอบรูปแบบไฟล์"); }
  }

  return <div className="modal-backdrop" role="presentation"><section className="import-modal" role="dialog" aria-modal="true" aria-label="นำเข้าข้อมูล">
    <header><div><span className="step-label">ตรวจสอบก่อนบันทึก</span><h2>นำเข้าไฟล์ข้อมูล</h2><p>ไฟล์จะยังไม่ถูกบันทึกจนกว่าคุณจะกดยืนยัน</p></div><button className="close-button" onClick={onClose} aria-label="ปิด">×</button></header>
    {!draft ? <button className="dropzone" onClick={() => inputRef.current?.click()}><span className="upload-symbol">⇧</span><b>เลือกไฟล์จากเครื่อง</b><small>PDF, XLSX, XLS หรือ CSV · สูงสุด 25 MB</small><input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => readFile(e.target.files?.[0])}/></button> : <>
      <div className="file-summary"><div className={`file-type ${draft.kind}`}>{draft.kind === "pdf" ? "PDF" : "XLS"}</div><div><b>{draft.file.name}</b><span>{(draft.file.size / 1024).toFixed(1)} KB{draft.sheet ? ` · ชีต ${draft.sheet}` : ""}</span></div><button onClick={() => { setDraft(null); if (inputRef.current) inputRef.current.value = ""; }}>เปลี่ยนไฟล์</button></div>
      <div className="preview-frame">{draft.kind === "pdf" ? <iframe title="ตัวอย่าง PDF" src={draft.objectUrl}/> : <SpreadsheetPreview columns={draft.columns} rows={draft.rows}/>}</div>
      {draft.kind === "spreadsheet" && <div className="preview-info">แสดงตัวอย่างสูงสุด 100 แถว · พบ {draft.columns.length} คอลัมน์ และ {draft.rows.length} แถวในตัวอย่าง</div>}
    </>}
    {error && <div className="import-error">{error}</div>}
    <footer><button className="secondary-action" onClick={onClose}>ยกเลิก</button><button className="primary-action" disabled={!draft || busy} onClick={() => draft && onConfirm(draft)}>{busy ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}</button></footer>
  </section></div>;
}

function SpreadsheetPreview({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return <div className="sheet-preview"><table><thead><tr><th>#</th>{columns.map((column, i) => <th key={i}>{column}</th>)}</tr></thead><tbody>{rows.slice(0, 30).map((row, ri) => <tr key={ri}><td>{ri + 1}</td>{columns.map((_, ci) => <td key={ci}>{String(row[ci] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}

