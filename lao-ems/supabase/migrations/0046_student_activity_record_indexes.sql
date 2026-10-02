-- 0046_student_activity_record_indexes.sql
-- Cover foreign keys used by student activity record maintenance/reporting.

begin;

create index if not exists lao_student_activity_enrollments_year_idx
  on public.lao_student_activity_enrollments(academic_year_id);

create index if not exists lao_student_activity_enrollments_term_idx
  on public.lao_student_activity_enrollments(term_id)
  where term_id is not null;

create index if not exists lao_student_activity_enrollments_course_idx
  on public.lao_student_activity_enrollments(course_id);

create index if not exists lao_student_activity_enrollments_created_by_idx
  on public.lao_student_activity_enrollments(created_by)
  where created_by is not null;

create index if not exists lao_student_activity_enrollments_updated_by_idx
  on public.lao_student_activity_enrollments(updated_by)
  where updated_by is not null;

commit;
