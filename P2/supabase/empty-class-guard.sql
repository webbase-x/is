-- ป้องกันการสร้างรหัสและ QR สำหรับห้องที่ยังไม่มีรายชื่อนักเรียน
-- รันไฟล์นี้หนึ่งครั้งใน Supabase SQL Editor

create or replace function public.ensure_session_class_has_students()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.students
    where class_id = new.class_id and active
  ) then
    raise exception 'ห้องเรียนนี้ยังไม่มีรายชื่อนักเรียนที่เปิดใช้งาน';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_session_class_has_students_trigger on public.class_sessions;
create trigger ensure_session_class_has_students_trigger
before insert on public.class_sessions
for each row execute function public.ensure_session_class_has_students();

notify pgrst, 'reload schema';
