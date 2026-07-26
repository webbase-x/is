-- ทำให้หน้าครูรุ่นเก่าที่ยังค้างอยู่ในเบราว์เซอร์อ่านรายชื่อได้
-- โดยคงความสามารถให้นักเรียนหนึ่งคนอยู่ได้หลายห้องตามเดิม
-- รันไฟล์นี้หนึ่งครั้งหลัง shared-teachers-multi-class-students.sql

begin;

alter table public.student_class_assignments
  add column if not exists id uuid;

update public.student_class_assignments
set id = gen_random_uuid()
where id is null;

alter table public.student_class_assignments
  alter column id set default gen_random_uuid(),
  alter column id set not null;

-- PostgREST จะมองตารางเชื่อมเป็นความสัมพันธ์ many-to-many เมื่อคีย์หลัก
-- ประกอบด้วย foreign key ทั้งสองคอลัมน์ ซึ่งทำให้คำขอของหน้าครูรุ่นเก่า
-- ไม่รู้ว่าควรใช้ความสัมพันธ์ใด เปลี่ยนเป็นคีย์หลักเดี่ยวและคง unique คู่เดิมไว้
alter table public.student_class_assignments
  drop constraint if exists student_class_assignments_pkey,
  drop constraint if exists student_class_assignments_student_class_key;

alter table public.student_class_assignments
  add constraint student_class_assignments_pkey primary key (id),
  add constraint student_class_assignments_student_class_key unique (student_id, class_id);

commit;

notify pgrst, 'reload schema';
