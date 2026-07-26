-- ปิดสิทธิ์เรียกฟังก์ชัน SECURITY DEFINER จากผู้ที่ยังไม่เข้าสู่ระบบ
-- ผู้ใช้แบบ anonymous sign-in ของห้องเรียนมี role เป็น authenticated จึงยังใช้งานได้ตามปกติ

begin;

revoke all on function public.is_teacher(uuid) from public, anon;
grant execute on function public.is_teacher(uuid) to authenticated;

revoke all on function public.teacher_can_access_class(uuid) from public, anon;
grant execute on function public.teacher_can_access_class(uuid) to authenticated;

revoke all on function public.teacher_can_access_session(uuid) from public, anon;
grant execute on function public.teacher_can_access_session(uuid) to authenticated;

revoke all on function public.get_session_leaderboard(uuid) from public, anon;
grant execute on function public.get_session_leaderboard(uuid) to authenticated;

revoke all on function public.get_display_snapshot(text) from public, anon;
grant execute on function public.get_display_snapshot(text) to authenticated;

revoke all on function public.get_display_leaderboard(text) from public, anon;
grant execute on function public.get_display_leaderboard(text) to authenticated;

commit;
