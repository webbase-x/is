"use client";

import { useMemo, useState } from "react";
import ProjectDataImporter, { type ImportedProjectData } from "./ProjectDataImporter";
import type { ResearchProject } from "../lib/supabase/types";
import {
  analyzeItem, calculateE1E2, calculateIoc, cronbachAlpha, defaultFiveLevelBands,
  interpretQuality, kr20, mean, median, pairedTTest, parseMatrix, parseNumbers,
  sampleStandardDeviation,
} from "../lib/statistics";

type View = "home" | "ioc" | "descriptive" | "quality" | "item" | "reliability" | "paired" | "efficiency" | "references";

const NAV: Array<{ id: View; label: string; icon: string; group?: string }> = [
  { id: "home", label: "ภาพรวม", icon: "⌂" },
  { id: "ioc", label: "ความตรงเชิงเนื้อหา (IOC)", icon: "✓", group: "ตรวจสอบเครื่องมือ" },
  { id: "descriptive", label: "ค่าเฉลี่ยและ S.D.", icon: "x̄", group: "สถิติพรรณนา" },
  { id: "quality", label: "ระดับคุณภาพ 5 ระดับ", icon: "★" },
  { id: "item", label: "ความยาก–อำนาจจำแนก", icon: "P", group: "คุณภาพแบบทดสอบ" },
  { id: "reliability", label: "ความเชื่อมั่น", icon: "α" },
  { id: "paired", label: "ก่อนเรียน–หลังเรียน", icon: "t", group: "ทดสอบสมมติฐาน" },
  { id: "efficiency", label: "ประสิทธิภาพ E1/E2", icon: "%" },
  { id: "references", label: "สูตรและเอกสารอ้างอิง", icon: "§", group: "เอกสาร" },
];

const fmt = (value: number | null | undefined, digits = 3) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);

function Metric({ label, value, note, tone = "blue" }: { label: string; value: string; note?: string; tone?: string }) {
  return <article className={`metric metric-${tone}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function Formula({ children, source }: { children: React.ReactNode; source: string }) {
  return <div className="formula"><div>{children}</div><small>แนวทางอ้างอิง: {source}</small></div>;
}

const THAI_DIGITS: Record<string, string> = { "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4", "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9" };

function normalizeDigits(value: string) {
  return value.replace(/[๐-๙]/g, (digit) => THAI_DIGITS[digit]);
}

function inferIocItemCount(rows: unknown[][]) {
  const text = normalizeDigits(rows.flat().map((cell) => String(cell ?? "")).join(" "));
  const explicitCounts = [...text.matchAll(/(?:จำนวน|รวม|แบบทดสอบ)?\s*(\d{1,3})\s*ข้อ/g)]
    .map((match) => Number(match[1]))
    .filter((count) => count >= 3 && count <= 200);
  if (explicitCounts.length) return Math.max(...explicitCounts);

  const leadingNumbers = rows.flatMap((row) => {
    const first = normalizeDigits(String(row.find((cell) => String(cell ?? "").trim()) ?? "").trim());
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

function IocView({ imported }: { imported?: ImportedProjectData | null }) {
  const needsOcrVerification = Boolean(imported?.warning?.includes("OCR"));
  const detectedRatings = imported?.iocRatings ?? [];
  const importedRows = needsOcrVerification ? [] : imported?.rows.map((row) => row.map((cell) => Number(cell)).filter((value) => [-1, 0, 1].includes(value))).filter((row) => row.length) ?? [];
  const importedWidth = importedRows.length ? Math.max(...importedRows.map((row) => row.length)) : imported ? 1 : 3;
  const importedItemCount = imported && needsOcrVerification ? Math.max(inferIocItemCount(imported.rows), ...detectedRatings.map((entry) => entry.item), 5) : 5;
  const [experts, setExperts] = useState(Array.from({ length: importedWidth }, (_, index) => `ผู้เชี่ยวชาญ ${index + 1}`));
  const [rows, setRows] = useState<Array<Array<number | null>>>(() => {
    if (importedRows.length) return importedRows.map((row) => Array.from({ length: importedWidth }, (_, index) => row[index] ?? null));
    const initial = Array.from({ length: importedItemCount }, () => imported ? Array<number | null>(importedWidth).fill(null) : [1, 1, 1]);
    detectedRatings.forEach(({ item, rating }) => { if (initial[item - 1]) initial[item - 1][0] = rating; });
    return initial;
  });
  const results = calculateIoc(rows);
  const average = mean(results.flatMap((r) => r.ioc === null ? [] : [r.ioc]));
  const setRating = (row: number, col: number, value: number | null) => setRows((current) => current.map((r, ri) => ri === row ? r.map((v, ci) => ci === col ? value : v) : r));
  const addExpert = () => { setExperts((x) => [...x, `ผู้เชี่ยวชาญ ${x.length + 1}`]); setRows((x) => x.map((r) => [...r, null])); };
  const addItem = () => setRows((x) => [...x, Array(experts.length).fill(null)]);
  const resizeItems = (count: number) => setRows((current) => Array.from({ length: Math.max(1, Math.min(300, count)) }, (_, index) => current[index] ?? Array(experts.length).fill(null)));
  return <Page title="ความตรงเชิงเนื้อหา (IOC)" subtitle="ประเมินความสอดคล้องรายข้อจากผู้เชี่ยวชาญจำนวนเท่าใดก็ได้" badge="แนะนำ ≥ 3 คน">
    {needsOcrVerification && <div className="import-warning ioc-verification"><b>{detectedRatings.length ? `อ่านตำแหน่งเครื่องหมายได้ ${detectedRatings.length} ข้อ` : "ยังไม่พบเครื่องหมายในช่องคะแนน"}</b><span>{detectedRatings.length ? "ระบบจับคู่รอยปากกากับช่อง +1, 0 หรือ -1 และเลขข้อจากตารางแล้ว กรุณาเทียบกับภาพต้นฉบับและแก้ไขช่องที่คลาดเคลื่อนก่อนใช้ผล" : "OCR อ่านข้อความได้ แต่ยังยืนยันตำแหน่งรอยปากกาในตารางไม่ได้ ระบบจึงสร้างตารางว่างไว้ให้กรอกตามเอกสาร เพื่อป้องกันค่า IOC ผิดพลาด"}</span></div>}
    <div className="metrics"><Metric label="จำนวนข้อ" value={`${rows.length}`} /><Metric label="ผู้เชี่ยวชาญ" value={`${experts.length}`} tone="violet" /><Metric label="IOC เฉลี่ย" value={fmt(average, 2)} tone="green" /><Metric label="ผ่านเกณฑ์" value={`${results.filter(r => r.passed).length}/${rows.length}`} tone="amber" /></div>
    <section className="panel"><div className="panel-head"><div><h3>ตารางให้คะแนน</h3><p>+1 สอดคล้อง · 0 ไม่แน่ใจ · -1 ไม่สอดคล้อง</p></div><div className="actions ioc-actions"><label>จำนวนข้อ<input type="number" min={1} max={300} value={rows.length} onChange={(event) => resizeItems(Number(event.target.value) || 1)} /></label><button className="secondary" onClick={addExpert}>+ ผู้เชี่ยวชาญ</button><button onClick={addItem}>+ เพิ่มข้อ</button></div></div>
      <div className="table-wrap"><table><thead><tr><th>ข้อ</th>{experts.map((e, i) => <th key={i}><input className="head-input" value={e} onChange={(ev) => setExperts(experts.map((x, j) => j === i ? ev.target.value : x))} /></th>)}<th>IOC</th><th>ผล</th></tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}><td>{ri + 1}</td>{row.map((value, ci) => <td key={ci}><select aria-label={`ข้อ ${ri + 1} ${experts[ci]}`} value={value ?? ""} onChange={(e) => setRating(ri, ci, e.target.value === "" ? null : Number(e.target.value))}><option value="">—</option><option value="1">+1</option><option value="0">0</option><option value="-1">-1</option></select></td>)}<td><b>{fmt(results[ri].ioc, 2)}</b></td><td><span className={results[ri].ioc === null ? "pill revise" : results[ri].passed ? "pill pass" : "pill revise"}>{results[ri].ioc === null ? "รอคะแนน" : results[ri].passed ? "ใช้ได้" : "ปรับปรุง"}</span></td></tr>)}</tbody></table></div>
    </section><Formula source="Rovinelli & Hambleton; แนวทางการสร้างเครื่องมือวิจัยทางการศึกษา">IOC = ΣR / N โดยคำนวณจากคะแนนที่มีข้อมูลจริงในแต่ละข้อ และแสดง N รายข้อเพื่อการตรวจสอบ</Formula>
  </Page>;
}

function DescriptiveView({ quality = false, imported }: { quality?: boolean; imported?: ImportedProjectData | null }) {
  const [text, setText] = useState(imported ? flattenRows(imported.rows) : "5, 5, 4, 4, 5, 4, 5, 3, 4, 5");
  const values = parseNumbers(text); const avg = mean(values); const sd = sampleStandardDeviation(values);
  return <Page title={quality ? "การแปลผลระดับคุณภาพ" : "สถิติพรรณนา"} subtitle={quality ? "คำนวณค่าเฉลี่ยและแปลผลมาตราส่วนประมาณค่า 5 ระดับ" : "ค่าเฉลี่ย มัธยฐาน และส่วนเบี่ยงเบนมาตรฐานของกลุ่มตัวอย่าง"} badge="ตรวจสอบข้อมูลดิบได้">
    <section className="split"><div className="panel"><h3>วางคะแนน</h3><p>คั่นด้วยช่องว่าง เครื่องหมายจุลภาค หรือขึ้นบรรทัดใหม่</p><textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} /><div className="data-note">อ่านได้ {values.length} ค่า</div></div>
      <div><div className="metrics compact"><Metric label="จำนวน (n)" value={`${values.length}`} /><Metric label="ค่าเฉลี่ย (x̄)" value={fmt(avg)} tone="green" /><Metric label="S.D. (ตัวอย่าง)" value={fmt(sd)} tone="violet" /><Metric label={quality ? "ระดับคุณภาพ" : "มัธยฐาน"} value={quality ? interpretQuality(avg) : fmt(median(values))} tone="amber" /></div>{quality && <section className="panel bands"><h3>เกณฑ์แปลผลที่ใช้</h3>{defaultFiveLevelBands.map((b) => <div key={b.label}><span>{b.min.toFixed(2)}–{b.max.toFixed(2)}</span><b>{b.label}</b></div>)}</section>}</div>
    </section><Formula source="บุญชม ศรีสะอาด และตำราสถิติทางการศึกษา; โปรดระบุฉบับที่ใช้อ้างอิงในงานวิจัย">x̄ = Σx / n และ S.D. ตัวอย่าง = √[Σ(x-x̄)²/(n-1)]</Formula>
  </Page>;
}

function ItemView({ imported }: { imported?: ImportedProjectData | null }) {
  const importedValues = imported ? parseNumbers(flattenRows(imported.rows)) : [];
  const [upper, setUpper] = useState(importedValues[0] ?? 22), [lower, setLower] = useState(importedValues[1] ?? 12), [size, setSize] = useState(importedValues[2] ?? 25);
  const result = analyzeItem(upper, lower, size);
  return <Page title="ความยากและอำนาจจำแนก" subtitle="วิเคราะห์ข้อสอบด้วยเทคนิคกลุ่มสูง–กลุ่มต่ำ" badge="Classical Test Theory"><section className="split"><div className="panel form-grid"><label>กลุ่มสูงตอบถูก<input type="number" value={upper} onChange={e => setUpper(+e.target.value)} /></label><label>กลุ่มต่ำตอบถูก<input type="number" value={lower} onChange={e => setLower(+e.target.value)} /></label><label>จำนวนคนต่อกลุ่ม<input type="number" value={size} onChange={e => setSize(+e.target.value)} /></label></div><div className="metrics compact"><Metric label="ค่าความยาก (p)" value={fmt(result.difficulty)} note={result.difficultyLabel} /><Metric label="อำนาจจำแนก (r)" value={fmt(result.discrimination)} note={result.discriminationLabel} tone="green" /></div></section><Formula source="แนวคิดการวิเคราะห์ข้อสอบแบบอิงกลุ่ม; พิชิต ฤทธิ์จรูญ และตำราการวัดผลการศึกษา">p = (RU+RL)/(2n) และ r = (RU-RL)/n</Formula></Page>;
}

function ReliabilityView({ imported }: { imported?: ImportedProjectData | null }) {
  const [text, setText] = useState(imported ? imported.rows.map((row) => row.join(",")).join("\n") : "1,1,1,0,1\n1,0,1,1,1\n1,1,1,1,1\n0,0,1,0,1\n1,1,0,1,1\n0,1,0,0,1");
  const matrix = parseMatrix(text); const alpha = cronbachAlpha(matrix); const binary = matrix.length > 0 && matrix.every(r => r.every(v => v === 0 || v === 1)); const kr = binary ? kr20(matrix) : null;
  return <Page title="ความเชื่อมั่นของเครื่องมือ" subtitle="รองรับ Cronbach’s alpha และ KR-20" badge="วางข้อมูลรายคน × รายข้อ"><section className="split"><div className="panel"><h3>เมทริกซ์คะแนน</h3><p>1 บรรทัด = ผู้ตอบ 1 คน · แต่ละคอลัมน์ = ข้อคำถาม</p><textarea rows={11} value={text} onChange={e => setText(e.target.value)} /><div className="data-note">{matrix.length} คน × {matrix[0]?.length ?? 0} ข้อ</div></div><div className="metrics compact"><Metric label="Cronbach’s α" value={fmt(alpha)} note="แบบมาตรประมาณค่า/หลายระดับ" tone="violet" /><Metric label="KR-20" value={binary ? fmt(kr) : "ต้องเป็น 0/1"} note="แบบทดสอบให้คะแนนถูก–ผิด" tone="green" /></div></section><Formula source="Kuder & Richardson (1937); Cronbach (1951); ตำราการวัดผลทางการศึกษา">ระบบใช้ความแปรปรวนรายข้อและความแปรปรวนของคะแนนรวม พร้อมตรวจรูปแบบข้อมูลก่อนคำนวณ</Formula></Page>;
}

function PairedView({ imported }: { imported?: ImportedProjectData | null }) {
  const importedPairs = imported?.rows.map((row) => row.map(Number).filter(Number.isFinite)).filter((row) => row.length >= 2) ?? [];
  const [pre, setPre] = useState(importedPairs.length ? importedPairs.map((row) => row[0]).join(", ") : "10, 12, 11, 14, 9, 13, 12, 10"), [post, setPost] = useState(importedPairs.length ? importedPairs.map((row) => row[1]).join(", ") : "16, 17, 15, 18, 14, 17, 16, 15");
  const result = pairedTTest(parseNumbers(pre), parseNumbers(post));
  return <Page title="เปรียบเทียบก่อน–หลังเรียน" subtitle="Paired-samples t-test และขนาดอิทธิพล Cohen’s dz" badge="ข้อมูลเป็นคู่"><section className="panel two-text"><label>คะแนนก่อนเรียน<textarea rows={7} value={pre} onChange={e => setPre(e.target.value)} /></label><label>คะแนนหลังเรียน<textarea rows={7} value={post} onChange={e => setPost(e.target.value)} /></label></section><div className="metrics"><Metric label="n" value={`${result?.n ?? 0}`} /><Metric label="ก่อนเรียน x̄" value={fmt(result?.preMean)} /><Metric label="หลังเรียน x̄" value={fmt(result?.postMean)} tone="green" /><Metric label="ผลต่างเฉลี่ย" value={fmt(result?.meanDifference)} tone="amber" /><Metric label="t (df)" value={result ? `${fmt(result.t)} (${result.df})` : "—"} tone="violet" /><Metric label="Cohen’s dz" value={fmt(result?.cohenDz)} tone="green" /></div><Formula source="Student’s t distribution; Cohen (1988) สำหรับแนวคิดขนาดอิทธิพล">t = d̄ / (Sᵈ/√n) ระบบไม่รายงานนัยสำคัญจนกว่าจะยืนยันเงื่อนไขและระดับ α</Formula></Page>;
}

function EfficiencyView({ imported }: { imported?: ImportedProjectData | null }) {
  const importedPairs = imported?.rows.map((row) => row.map(Number).filter(Number.isFinite)).filter((row) => row.length >= 2) ?? [];
  const [process, setProcess] = useState(importedPairs.length ? importedPairs.map((row) => row[0]).join(", ") : "72, 68, 75, 70, 74"), [post, setPost] = useState(importedPairs.length ? importedPairs.map((row) => row[1]).join(", ") : "25, 26, 24, 27, 28"), [pmax, setPmax] = useState(80), [tmax, setTmax] = useState(30);
  const result = calculateE1E2(parseNumbers(process), pmax, parseNumbers(post), tmax);
  return <Page title="ประสิทธิภาพนวัตกรรม E1/E2" subtitle="คำนวณประสิทธิภาพกระบวนการและผลลัพธ์" badge="กำหนดเกณฑ์ได้"><section className="panel two-text"><label>คะแนนระหว่างเรียนของแต่ละคน<textarea rows={6} value={process} onChange={e => setProcess(e.target.value)} /><span>คะแนนเต็ม <input type="number" value={pmax} onChange={e => setPmax(+e.target.value)} /></span></label><label>คะแนนหลังเรียนของแต่ละคน<textarea rows={6} value={post} onChange={e => setPost(e.target.value)} /><span>คะแนนเต็ม <input type="number" value={tmax} onChange={e => setTmax(+e.target.value)} /></span></label></section><div className="metrics"><Metric label="E1" value={`${fmt(result?.e1, 2)}%`} tone="blue" /><Metric label="E2" value={`${fmt(result?.e2, 2)}%`} tone="green" /><Metric label="รายงานผล" value={result ? `${fmt(result.e1, 2)}/${fmt(result.e2, 2)}` : "—"} tone="violet" /></div><Formula source="ชัยยงค์ พรหมวงศ์: แนวคิดการทดสอบประสิทธิภาพสื่อหรือชุดการสอน">E1 = (ΣX/N)/A × 100 และ E2 = (ΣF/N)/B × 100</Formula></Page>;
}

function ReferencesView() {
  const refs = [
    ["IOC", "Rovinelli & Hambleton", "ความสอดคล้องระหว่างข้อคำถามกับวัตถุประสงค์"],
    ["สถิติพรรณนา", "บุญชม ศรีสะอาด", "ค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน และการใช้สถิติในการวิจัย"],
    ["คุณภาพเครื่องมือ", "พิชิต ฤทธิ์จรูญ", "การสร้างและตรวจสอบเครื่องมือวัดและประเมินผล"],
    ["KR-20", "Kuder & Richardson (1937)", "ความเชื่อมั่นของแบบทดสอบสองค่า"],
    ["Cronbach’s alpha", "Cronbach (1951)", "ความสอดคล้องภายในของมาตรวัด"],
    ["Effect size", "Cohen (1988)", "ขนาดอิทธิพลของความแตกต่าง"],
    ["E1/E2", "ชัยยงค์ พรหมวงศ์", "ประสิทธิภาพกระบวนการและผลลัพธ์ของสื่อ"],
  ];
  return <Page title="สูตรและเอกสารอ้างอิง" subtitle="แสดงที่มาของวิธีคำนวณเพื่อให้ตรวจสอบและเขียนรายงานได้ถูกต้อง" badge="โปร่งใส ตรวจสอบได้"><section className="panel ref-list">{refs.map(([name, author, desc]) => <article key={name}><div className="ref-mark">{name.slice(0, 2)}</div><div><h3>{name}</h3><b>{author}</b><p>{desc}</p></div></article>)}</section><div className="notice"><b>ข้อควรระวังทางวิชาการ</b><p>ชื่อผู้แต่งไม่ได้หมายความว่าสูตรมาตรฐานเป็นกรรมสิทธิ์ของผู้แต่งรายนั้น ควรอ้างอิงหนังสือ ฉบับพิมพ์ และเลขหน้าที่ผู้วิจัยใช้จริง แอปจะจัดทำ “บันทึกวิธีวิเคราะห์” ให้แนบในภาคผนวกได้ในรุ่นส่งออกรายงาน</p></div></Page>;
}

function HomeView({ open }: { open: (view: View) => void }) {
  const cards = NAV.filter(n => !["home", "references"].includes(n.id));
  return <Page title="เลือกการวิเคราะห์" subtitle="เครื่องมือสถิติสำหรับงานวิจัยทางการศึกษา พร้อมสูตร เกณฑ์ และข้อมูลตรวจสอบ" badge="Research Toolkit"><section className="hero-card"><div><span className="eyebrow">โครงการปัจจุบัน</span><h2>มาตราตัวสะกด ชั้นประถมศึกษาปีที่ 2</h2><p>เริ่มจากเลือกประเภทการวิเคราะห์ ระบบจะแสดงผลพร้อมสูตรและข้อมูลสำหรับตรวจสอบย้อนกลับ</p></div><div className="hero-stat"><strong>7</strong><span>เครื่องมือพร้อมใช้</span></div></section><div className="tool-grid">{cards.map((card, i) => <button className="tool-card" key={card.id} onClick={() => open(card.id)}><span className={`tool-icon c${i % 4}`}>{card.icon}</span><div><h3>{card.label}</h3><p>{toolDescription(card.id)}</p><small>เปิดเครื่องมือ →</small></div></button>)}</div></Page>;
}

function toolDescription(id: View) { return ({ ioc: "ตรวจความสอดคล้องรายข้อจากผู้เชี่ยวชาญ", descriptive: "สรุปแนวโน้มและการกระจายของข้อมูล", quality: "แปลผลแบบประเมินมาตราส่วน 5 ระดับ", item: "วิเคราะห์คุณภาพข้อสอบรายข้อ", reliability: "คำนวณ α และ KR-20", paired: "ทดสอบคะแนนของกลุ่มเดียวกันสองครั้ง", efficiency: "ประเมินประสิทธิภาพนวัตกรรม" } as Partial<Record<View, string>>)[id] ?? ""; }

function Page({ title, subtitle, badge, children }: { title: string; subtitle: string; badge: string; children: React.ReactNode }) { return <><header className="page-head"><div><div className="breadcrumb">ระบบวิเคราะห์ <span>/</span> {title}</div><h1>{title}</h1><p>{subtitle}</p></div><span className="status-badge"><i />{badge}</span></header>{children}</>; }

function flattenRows(rows: unknown[][]) {
  return rows.flatMap((row) => row.map((cell) => String(cell ?? "").trim()).filter(Boolean)).join(", ");
}

function ImportedDataPanel({ data, view }: { data: ImportedProjectData; view: View }) {
  const needsIocVerification = view === "ioc" && Boolean(data.warning?.includes("OCR"));
  return <section className="panel imported-data"><div className="panel-head"><div><span className="step-label">งานย่อย</span><h3>{data.workTitle}</h3><p>{data.sourceName} · {data.rangeLabel} · {data.rows.length} แถว</p></div></div>{data.warning && <div className="import-warning">{data.warning}</div>}<div className="table-wrap"><table><tbody>{data.rows.slice(0, 20).map((row, rowIndex) => <tr key={rowIndex}><td>{rowIndex + 1}</td>{row.slice(0, 12).map((cell, cellIndex) => <td key={cellIndex}>{String(cell ?? "")}</td>)}</tr>)}</tbody></table></div><p className="data-note">{needsIocVerification ? data.iocRatings?.length ? `ระบบใส่คะแนนจากตำแหน่งเครื่องหมายแล้ว ${data.iocRatings.length} ข้อ กรุณาตรวจเทียบภาพต้นฉบับก่อนใช้ผล` : "ข้อความ OCR ใช้เป็นข้อมูลอ้างอิงเท่านั้น ยังไม่พบเครื่องหมายคะแนนที่ยืนยันตำแหน่งได้" : "ข้อมูลตัวเลขถูกเพิ่มลงในช่องของเครื่องมือแล้ว คุณสามารถตรวจและแก้ไขก่อนคำนวณได้"}</p></section>;
}

export default function ResearchStatsApp({ project, onBack }: { project: ResearchProject; onBack?: () => void }) {
  const [view, setView] = useState<View>("home"); const [menu, setMenu] = useState(false); const [showImporter, setShowImporter] = useState(false); const [imported, setImported] = useState<ImportedProjectData | null>(null);
  const dataKey = imported?.id ?? 0;
  const content = useMemo(() => ({ home: <HomeView open={setView} />, ioc: <IocView key={`ioc-${dataKey}`} imported={imported} />, descriptive: <DescriptiveView key={`descriptive-${dataKey}`} imported={imported} />, quality: <DescriptiveView key={`quality-${dataKey}`} quality imported={imported} />, item: <ItemView key={`item-${dataKey}`} imported={imported} />, reliability: <ReliabilityView key={`reliability-${dataKey}`} imported={imported} />, paired: <PairedView key={`paired-${dataKey}`} imported={imported} />, efficiency: <EfficiencyView key={`efficiency-${dataKey}`} imported={imported} />, references: <ReferencesView /> }[view]), [view, imported, dataKey]);
  const currentTool = NAV.find((item) => item.id === view)?.label ?? "งานวิเคราะห์";
  return <div className="app-shell"><aside className={menu ? "sidebar open" : "sidebar"}><div className="brand"><div className="brand-mark">R</div><div><b>Research<span>Stat</span></b><small>สถิติงานวิจัยการศึกษา</small></div></div>{onBack && <button className="back-project" onClick={onBack}>← กลับไปที่โครงการ</button>}<nav>{NAV.map(item => <div key={item.id}>{item.group && <div className="nav-group">{item.group}</div>}<button className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMenu(false); }}><span>{item.icon}</span>{item.label}</button></div>)}</nav><div className="privacy"><b>ข้อมูลของคุณเป็นส่วนตัว</b><p>รุ่นนี้ประมวลผลคะแนนในอุปกรณ์ ไม่ส่งข้อมูลดิบออกไป</p></div></aside><main className="main"><div className="topbar"><button className="menu-btn" onClick={() => setMenu(!menu)}>☰</button><div className="project"><span>โครงการ</span><b>{project.title}</b></div><div className="top-actions">{view !== "home" && view !== "references" && <button className="import-project-button" onClick={() => setShowImporter(true)}>↥ นำเข้าจากไฟล์โครงการ</button>}<span className="version-chip">รุ่นคำนวณ 1.5</span><span className="avatar">พ</span></div></div><div className="content">{imported && view !== "home" && view !== "references" && <ImportedDataPanel data={imported} view={view}/>} {content}</div><footer>ResearchStat · เครื่องมือช่วยคำนวณ ไม่แทนการพิจารณาของนักวิจัยและอาจารย์ที่ปรึกษา</footer></main>{menu && <button className="overlay" aria-label="ปิดเมนู" onClick={() => setMenu(false)} />}<ProjectDataImporter project={project} analysisType={view} suggestedTitle={`${currentTool} – งานที่ 1`} open={showImporter} onClose={() => setShowImporter(false)} onImport={setImported}/></div>;
}
