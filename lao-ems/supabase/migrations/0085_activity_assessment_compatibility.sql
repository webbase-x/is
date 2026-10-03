-- 0085_activity_assessment_compatibility.sql
-- Keep learner-activity pass/fail assessment usable without forcing a subject-style course curriculum.

begin;

alter function public.lao_ensure_assessment_book(uuid,uuid)
  rename to lao_ensure_assessment_book_curriculum_v01938;

revoke all on function public.lao_ensure_assessment_book_curriculum_v01938(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_ensure_assessment_book(
  p_school_id uuid,
  p_workload_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_subject_type text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select s.subject_type
  into v_subject_type
  from public.lao_teaching_workload_items wi
  join public.lao_teaching_workloads w on w.id=wi.workload_id
  join public.lao_curriculum_courses c on c.id=wi.course_id
  join public.lao_subjects s on s.id=c.subject_id
  where wi.id=p_workload_item_id and w.school_id=p_school_id;

  if v_subject_type is null then
    raise exception 'ไม่พบภาระงานสอนที่เลือก';
  end if;

  if v_subject_type='activity' then
    return public.lao_ensure_assessment_book_base_v01938(p_school_id,p_workload_item_id);
  end if;

  return public.lao_ensure_assessment_book_curriculum_v01938(p_school_id,p_workload_item_id);
end;
$function$;

revoke all on function public.lao_ensure_assessment_book(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_assessment_book(uuid,uuid) to authenticated;

commit;
