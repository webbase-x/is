-- 0092_smart_timetable_scope_guard.sql
-- Enforce timetable grade scopes against the school's class, curriculum and approved workload data.

begin;

create or replace function public.lao_guard_timetable_grade_scope()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_code text;
begin
  if coalesce(array_length(new.selected_grade_codes,1),0)=0 then
    return new;
  end if;

  foreach v_code in array new.selected_grade_codes
  loop
    if not exists(
      select 1 from public.lao_class_sections cls
      where cls.school_id=new.school_id and cls.academic_year_id=new.academic_year_id
        and cls.source_type='lec' and cls.is_active and upper(cls.grade_code)=upper(v_code)
    ) then
      raise exception 'ระดับชั้น % ไม่อยู่ในโครงสร้างชั้นเรียนของปีการศึกษานี้',v_code;
    end if;

    if not exists(
      select 1 from public.lao_curriculum_courses cc
      join public.lao_class_sections cls
        on cls.school_id=cc.school_id and cls.academic_year_id=cc.academic_year_id
       and (cc.grade_code=cls.grade_code or (cc.grade_code is null and cc.grade_label=cls.grade_label))
      where cc.school_id=new.school_id and cc.academic_year_id=new.academic_year_id and cc.is_active
        and cls.source_type='lec' and cls.is_active and upper(cls.grade_code)=upper(v_code)
    ) then
      raise exception 'ระดับชั้น % ยังไม่มีโครงสร้างหลักสูตรที่พร้อมใช้',v_code;
    end if;

    if not exists(
      select 1
      from public.lao_teaching_workloads w
      join public.lao_teaching_workload_items wi on wi.workload_id=w.id
      join public.lao_class_sections cls on cls.id=wi.class_section_id
      where w.school_id=new.school_id and w.academic_year_id=new.academic_year_id
        and w.term_id=new.term_id and w.status='approved'
        and cls.is_active and upper(cls.grade_code)=upper(v_code)
    ) then
      raise exception 'ระดับชั้น % ยังไม่มีภาระงานสอนที่อนุมัติ',v_code;
    end if;
  end loop;

  if exists(
    select 1
    from public.lao_timetable_entries e
    join public.lao_class_sections cls on cls.id=e.class_section_id
    where e.version_id=new.id and not (upper(cls.grade_code)=any(
      select upper(x) from unnest(new.selected_grade_codes) x
    ))
  ) then
    raise exception 'ยังมีคาบของระดับชั้นที่อยู่นอกขอบเขตตารางสอน';
  end if;

  return new;
end;
$function$;

revoke all on function public.lao_guard_timetable_grade_scope() from public,anon,authenticated;

drop trigger if exists lao_timetable_grade_scope_guard on public.lao_timetable_versions;
create trigger lao_timetable_grade_scope_guard
before insert or update of selected_grade_codes on public.lao_timetable_versions
for each row execute function public.lao_guard_timetable_grade_scope();

commit;
