import { supabase } from "./supabase.js";
import { $, hide, show, toast } from "./common.js";

const requestForm = $("#requestResetForm");
const updateForm = $("#updatePasswordForm");
const sentView = $("#resetSentView");

function recoveryRedirectUrl() {
  return new URL("reset-password.html", window.location.href).href.split("#")[0].split("?")[0];
}

function showUpdateForm() {
  hide(requestForm);
  hide(sentView);
  show(updateForm);
  $("#newPassword")?.focus();
}

async function requestReset(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "กำลังส่งลิงก์...";

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      $("#resetEmail").value.trim(),
      { redirectTo: recoveryRedirectUrl() },
    );
    if (error) throw error;
    hide(requestForm);
    show(sentView);
  } catch (error) {
    toast(error.message || "ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่", "error");
  } finally {
    button.disabled = false;
    button.textContent = "ส่งลิงก์ตั้งรหัสใหม่";
  }
}

async function updatePassword(event) {
  event.preventDefault();
  const password = $("#newPassword").value;
  const confirmation = $("#confirmPassword").value;

  if (password.length < 8) return toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "error");
  if (password !== confirmation) return toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน", "error");

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "กำลังบันทึก...";

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    toast("ตั้งรหัสผ่านใหม่เรียบร้อย กำลังกลับหน้าเข้าสู่ระบบ", "success");
    window.setTimeout(() => window.location.replace("teacher.html"), 1400);
  } catch (error) {
    toast(error.message || "ตั้งรหัสผ่านไม่สำเร็จ กรุณาขอลิงก์ใหม่", "error");
    button.disabled = false;
    button.textContent = "บันทึกรหัสผ่านใหม่";
  }
}

async function bootstrap() {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") showUpdateForm();
  });

  const { data } = await supabase.auth.getSession();
  const permanentSession = data.session && !data.session.user.is_anonymous;
  if (permanentSession) showUpdateForm();

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const authError = query.get("error_description") || hash.get("error_description");
  if (authError) toast("ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่", "error");
}

requestForm.addEventListener("submit", requestReset);
updateForm.addEventListener("submit", updatePassword);
bootstrap();
