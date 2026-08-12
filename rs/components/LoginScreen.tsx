"use client";

import { useState } from "react";
import { getSupabaseClient } from "../lib/supabase/client";

export default function LoginScreen({ onDemo }: { onDemo: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loginWithGoogle() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage("ยังไม่ได้เชื่อมต่อฐานข้อมูล กรุณาใช้โหมดตัวอย่างก่อน");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setMessage(error.message); setLoading(false); }
  }

  return <main className="login-page">
    <section className="login-visual">
      <div className="login-brand"><div className="brand-mark">R</div><b>Research<span>Stat</span></b></div>
      <div className="login-copy"><span>RESEARCH WORKSPACE</span><h1>วิเคราะห์งานวิจัย<br/>อย่างเป็นระบบ</h1><p>รวมโครงการ เครื่องมือสถิติ และเอกสารของคุณไว้ในพื้นที่เดียว พร้อมตรวจสอบย้อนกลับได้ทุกขั้นตอน</p></div>
      <div className="login-points"><div><b>7+</b><span>เครื่องมือสถิติ</span></div><div><b>Private</b><span>ไฟล์ส่วนตัว</span></div><div><b>Anytime</b><span>เรียกดูได้ทุกเมื่อ</span></div></div>
    </section>
    <section className="login-panel"><div className="login-box"><span className="secure-label">พื้นที่ทำงานส่วนตัว</span><h2>ยินดีต้อนรับ</h2><p>เข้าสู่ระบบเพื่อสร้างโครงการ อัปโหลดข้อมูล และบันทึกผลวิเคราะห์</p>
      <button className="google-button" onClick={loginWithGoogle} disabled={loading}><span className="google-g">G</span>{loading ? "กำลังเชื่อมต่อ…" : "เข้าสู่ระบบด้วย Google"}</button>
      <button className="demo-button" onClick={onDemo}>ทดลองดูหน้าระบบ</button>
      {message && <div className="login-message">{message}</div>}
      <div className="login-note">การเข้าสู่ระบบหมายถึงคุณยอมรับการใช้ข้อมูลบัญชีพื้นฐาน ได้แก่ ชื่อ อีเมล และรูปโปรไฟล์ เพื่อระบุตัวตนเท่านั้น</div>
    </div></section>
  </main>;
}
