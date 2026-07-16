import { supabase, isMissingSchema } from "./supabase.js";
import { $, updateConnectionBadge } from "./common.js";

async function checkSystem() {
  const badge = $("#systemStatus");
  if (!navigator.onLine) {
    updateConnectionBadge(badge, false, "ไม่มีอินเทอร์เน็ต");
    return;
  }

  try {
    const { error } = await supabase.from("schools").select("id", { head: true, count: "exact" });
    if (error && !isMissingSchema(error)) throw error;
    updateConnectionBadge(badge, !error, error ? "รอติดตั้งฐานข้อมูล" : "ระบบพร้อมใช้งาน");
  } catch {
    updateConnectionBadge(badge, false, "เชื่อมต่อไม่ได้");
  }
}

window.addEventListener("online", checkSystem);
window.addEventListener("offline", checkSystem);
checkSystem();
