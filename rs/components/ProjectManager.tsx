"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import FileImportDialog from "./FileImportDialog";
import type { FileDraft, ResearchFile, ResearchProject } from "../lib/supabase/types";
import { getSupabaseClient } from "../lib/supabase/client";

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
type ResearchSubwork = { id: string; title: string; analysis_type: string; created_at: string };

export default function ProjectManager({ user, demo, onAnalyze, onSignOut }: {
  user: User | null;
  demo: boolean;
  onAnalyze: (project: ResearchProject) => void;
  onSignOut: () => void;
}) {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [current, setCurrent] = useState<ResearchProject | null>(null);
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [subworks, setSubworks] = useState<ResearchSubwork[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ file: ResearchFile; url?: string } | null>(null);

  const loadProjects = useCallback(async () => {
    if (demo) {
      const sample: ResearchProject = { id: "demo-project", owner_id: "demo", title: "มาตราตัวสะกด ป.2", description: "เกมมิฟิเคชันร่วมกับการเรียนรู้เชิงรุก", status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setProjects([sample]); setCurrent(sample); return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("research_projects").select("*").eq("status", "active").order("updated_at", { ascending: false });
    if (error) { setNotice("ระบบฐานข้อมูลยังอยู่ระหว่างการตั้งค่า"); return; }
    setProjects(data ?? []); if (data?.length) setCurrent((value) => value ?? data[0]);
  }, [demo]);

  const loadFiles = useCallback(async () => {
    if (!current || demo) return;
    const supabase = getSupabaseClient(); if (!supabase) return;
    const [fileResult, analysisResult] = await Promise.all([
      supabase.from("research_files").select("*").eq("project_id", current.id).order("created_at", { ascending: false }),
      supabase.from("research_analyses").select("id,title,analysis_type,created_at").eq("project_id", current.id).order("created_at", { ascending: false }),
    ]);
    setFiles(fileResult.data ?? []); setSubworks(analysisResult.data ?? []);
  }, [current, demo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProjects(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadFiles(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFiles]);

  async function createProject(title: string, description: string) {
    if (!title.trim()) return;
    setBusy(true); setNotice("");
    if (demo) {
      const project: ResearchProject = { id: newId(), owner_id: "demo", title: title.trim(), description: description.trim(), status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setProjects((items) => [project, ...items]); setCurrent(project); setShowNew(false); setBusy(false); return;
    }
    const supabase = getSupabaseClient();
    if (!supabase || !user) return;
    const { data, error } = await supabase.from("research_projects").insert({ owner_id: user.id, title: title.trim(), description: description.trim() }).select().single();
    if (error) setNotice(error.message); else { setProjects((items) => [data, ...items]); setCurrent(data); setShowNew(false); }
    setBusy(false);
  }

  async function confirmFile(draft: FileDraft) {
    if (!current) return;
    setBusy(true); setNotice("");
    if (demo) {
      const file: ResearchFile = { id: newId(), project_id: current.id, owner_id: "demo", storage_path: "demo", original_name: draft.file.name, mime_type: draft.file.type || "application/octet-stream", size_bytes: draft.file.size, preview_json: draft.kind === "spreadsheet" ? { columns: draft.columns, rows: draft.rows, sheet: draft.sheet } : null, import_status: "confirmed", created_at: new Date().toISOString() };
      setFiles((items) => [file, ...items]); setShowImport(false); setNotice("บันทึกในโหมดตัวอย่างแล้ว ข้อมูลจะหายเมื่อปิดหน้านี้"); setBusy(false); return;
    }
    const supabase = getSupabaseClient(); if (!supabase || !user) return;
    const safeName = draft.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${user.id}/${current.id}/${newId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("research-documents").upload(path, draft.file, { upsert: false, contentType: draft.file.type });
    if (uploadError) { setNotice(uploadError.message); setBusy(false); return; }
    const previewJson = draft.kind === "spreadsheet" ? { columns: draft.columns, rows: draft.rows, sheet: draft.sheet } : null;
    const { data: savedFile, error: fileError } = await supabase.from("research_files").insert({ project_id: current.id, owner_id: user.id, storage_path: path, original_name: draft.file.name, mime_type: draft.file.type || "application/octet-stream", size_bytes: draft.file.size, preview_json: previewJson }).select().single();
    if (fileError) { setNotice(fileError.message); setBusy(false); return; }
    if (draft.kind === "spreadsheet") await supabase.from("research_datasets").insert({ project_id: current.id, owner_id: user.id, source_file_id: savedFile.id, name: draft.file.name, columns_json: draft.columns, rows_json: draft.rows });
    setFiles((items) => [savedFile, ...items]); setShowImport(false); setNotice("บันทึกไฟล์และข้อมูลเรียบร้อยแล้ว"); setBusy(false);
  }

  async function openPreview(file: ResearchFile) {
    if (file.preview_json) { setPreview({ file }); return; }
    const supabase = getSupabaseClient(); if (!supabase) return;
    const { data, error } = await supabase.storage.from("research-documents").createSignedUrl(file.storage_path, 300);
    if (error) setNotice(error.message); else setPreview({ file, url: data.signedUrl });
  }

  async function deleteFile(file: ResearchFile) {
    if (!window.confirm(`ลบไฟล์ “${file.original_name}” และชุดข้อมูลที่สร้างจากไฟล์นี้หรือไม่?`)) return;
    setBusy(true); setNotice("");
    if (demo) { setFiles((items) => items.filter((item) => item.id !== file.id)); setBusy(false); return; }
    const supabase = getSupabaseClient(); if (!supabase) return;
    const { error: storageError } = await supabase.storage.from("research-documents").remove([file.storage_path]);
    if (storageError) { setNotice(storageError.message); setBusy(false); return; }
    const { error } = await supabase.from("research_files").delete().eq("id", file.id);
    if (error) setNotice(error.message); else { setFiles((items) => items.filter((item) => item.id !== file.id)); setNotice("ลบไฟล์เรียบร้อยแล้ว"); }
    setBusy(false);
  }

  async function deleteProject() {
    if (!current || !window.confirm(`ลบโครงการ “${current.title}” พร้อมไฟล์ ชุดข้อมูล และผลวิเคราะห์ทั้งหมดหรือไม่?`)) return;
    setBusy(true); setNotice("");
    if (demo) {
      const next = projects.filter((item) => item.id !== current.id); setProjects(next); setCurrent(next[0] ?? null); setFiles([]); setBusy(false); return;
    }
    const supabase = getSupabaseClient(); if (!supabase || !user) return;
    const { data: storedFiles } = await supabase.from("research_files").select("storage_path").eq("project_id", current.id);
    const paths = (storedFiles ?? []).map((file) => file.storage_path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("research-documents").remove(paths);
      if (storageError) { setNotice(storageError.message); setBusy(false); return; }
    }
    const deletedId = current.id;
    const { error } = await supabase.from("research_projects").delete().eq("id", deletedId);
    if (error) setNotice(error.message); else {
      const next = projects.filter((item) => item.id !== deletedId); setProjects(next); setCurrent(next[0] ?? null); setFiles([]); setNotice("ลบโครงการเรียบร้อยแล้ว");
    }
    setBusy(false);
  }

  async function deleteSubwork(subwork: ResearchSubwork) {
    if (!window.confirm(`ลบงานย่อย “${subwork.title}” หรือไม่?`)) return;
    const supabase = getSupabaseClient(); if (!supabase) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.from("research_analyses").delete().eq("id", subwork.id);
    if (error) setNotice(error.message); else { setSubworks((items) => items.filter((item) => item.id !== subwork.id)); setNotice("ลบงานย่อยเรียบร้อยแล้ว"); }
    setBusy(false);
  }

  return <div className="workspace-page"><header className="workspace-bar"><div className="login-brand"><div className="brand-mark">R</div><b>Research<span>Stat</span></b></div><div className="workspace-user"><div><b>{demo ? "ผู้ใช้ตัวอย่าง" : user?.user_metadata?.full_name || user?.email}</b><span>{demo ? "โหมดทดลอง" : user?.email}</span></div><button onClick={onSignOut}>ออกจากระบบ</button></div></header>
    <main className="workspace-main"><section className="workspace-title"><div><span>MY RESEARCH</span><h1>โครงการของฉัน</h1><p>สร้างโครงการ แยกชุดข้อมูล และเรียกดูเอกสารย้อนหลังได้จากที่เดียว</p></div><button className="primary-action" onClick={() => setShowNew(true)}>+ เพิ่มโครงการ</button></section>
    {notice && <div className="workspace-notice">{notice}</div>}
    <section className="project-layout"><aside className="project-list"><div className="section-heading"><h2>โครงการทั้งหมด</h2><span>{projects.length}</span></div>{projects.length === 0 ? <div className="empty-small">ยังไม่มีโครงการ<br/><button onClick={() => setShowNew(true)}>สร้างโครงการแรก</button></div> : projects.map((project) => <button key={project.id} className={current?.id === project.id ? "project-row active" : "project-row"} onClick={() => setCurrent(project)}><span className="project-letter">{project.title.charAt(0)}</span><div><b>{project.title}</b><small>{project.description || "ไม่มีคำอธิบาย"}</small></div><i>›</i></button>)}</aside>
      <section className="project-detail">{current ? <><header><div><span>โครงการที่เลือก</span><h2>{current.title}</h2><p>{current.description || "ยังไม่มีคำอธิบายโครงการ"}</p></div><div className="project-actions"><button className="danger-action" disabled={busy} onClick={() => void deleteProject()}>ลบโครงการ</button><button onClick={() => onAnalyze(current)}>เปิดเครื่องมือวิเคราะห์ →</button></div></header><div className="detail-stats"><div><b>{files.length}</b><span>ไฟล์ข้อมูล</span></div><div><b>{files.filter(f => f.preview_json).length}</b><span>ชุดตาราง</span></div><div><b>{subworks.length}</b><span>งานย่อย</span></div><div><b>{new Date(current.updated_at).toLocaleDateString("th-TH")}</b><span>แก้ไขล่าสุด</span></div></div><div className="subwork-section"><div className="section-heading"><div><h2>งานย่อยในโครงการ</h2><p>ชื่องานวิเคราะห์ที่บันทึกจาก PROJECT DATA</p></div></div>{subworks.length === 0 ? <p className="subwork-empty">ยังไม่มีงานย่อย</p> : <div className="subwork-list">{subworks.map((subwork) => <article key={subwork.id}><div><b>{subwork.title}</b><span>{subwork.analysis_type.toUpperCase()} · {new Date(subwork.created_at).toLocaleString("th-TH")}</span></div><button className="danger-action" disabled={busy} onClick={() => void deleteSubwork(subwork)}>ลบ</button></article>)}</div>}</div><div className="file-section"><div className="section-heading"><div><h2>ไฟล์และชุดข้อมูล</h2><p>PDF, Excel และ CSV ที่ยืนยันแล้ว</p></div><button onClick={() => setShowImport(true)}>+ เพิ่มไฟล์</button></div>{files.length === 0 ? <div className="empty-files"><span>⇧</span><b>ยังไม่มีไฟล์ในโครงการนี้</b><p>เพิ่ม PDF, Excel หรือ CSV แล้วตรวจสอบตัวอย่างก่อนยืนยัน</p><button onClick={() => setShowImport(true)}>เลือกไฟล์</button></div> : <div className="file-list">{files.map(file => <article key={file.id}><div className={file.preview_json ? "doc-icon sheet" : "doc-icon pdf"}>{file.preview_json ? "XLS" : "PDF"}</div><div><b>{file.original_name}</b><span>{(file.size_bytes / 1024).toFixed(1)} KB · {new Date(file.created_at).toLocaleString("th-TH")}</span></div><div className="file-actions"><button onClick={() => openPreview(file)}>ดูข้อมูล</button><button className="danger-action" disabled={busy} onClick={() => void deleteFile(file)}>ลบ</button></div></article>)}</div>}</div></> : <div className="empty-files"><b>เลือกหรือสร้างโครงการเพื่อเริ่มต้น</b></div>}</section></section></main>
    {showNew && <NewProjectDialog busy={busy} onClose={() => setShowNew(false)} onSave={createProject}/>}<FileImportDialog open={showImport} busy={busy} onClose={() => setShowImport(false)} onConfirm={confirmFile}/>{preview && <SavedPreview preview={preview} onClose={() => setPreview(null)}/>}</div>;
}

function NewProjectDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (title: string, description: string) => void }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  return <div className="modal-backdrop"><section className="small-modal"><header><div><span className="step-label">NEW PROJECT</span><h2>เพิ่มโครงการวิจัย</h2></div><button className="close-button" onClick={onClose}>×</button></header><label>ชื่อโครงการ<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น มาตราตัวสะกด ป.2"/></label><label>คำอธิบาย<textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="หัวข้อหรือนวัตกรรมที่ใช้ในการวิจัย"/></label><footer><button className="secondary-action" onClick={onClose}>ยกเลิก</button><button className="primary-action" disabled={!title.trim() || busy} onClick={() => onSave(title, description)}>{busy ? "กำลังบันทึก…" : "สร้างโครงการ"}</button></footer></section></div>;
}

function SavedPreview({ preview, onClose }: { preview: { file: ResearchFile; url?: string }; onClose: () => void }) {
  const data = preview.file.preview_json;
  return <div className="modal-backdrop"><section className="import-modal saved-preview"><header><div><span className="step-label">SAVED FILE</span><h2>{preview.file.original_name}</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="preview-frame">{preview.url ? <iframe title="PDF ที่บันทึก" src={preview.url}/> : data ? <div className="sheet-preview"><table><thead><tr><th>#</th>{data.columns?.map((c,i)=><th key={i}>{c}</th>)}</tr></thead><tbody>{data.rows?.slice(0,30).map((row,ri)=><tr key={ri}><td>{ri+1}</td>{data.columns?.map((_,ci)=><td key={ci}>{String(row[ci]??"")}</td>)}</tr>)}</tbody></table></div> : null}</div><footer><button className="primary-action" onClick={onClose}>ปิด</button></footer></section></div>;
}
