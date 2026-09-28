-- Keep academic class sections synchronized when future LEC enrollments are imported.

create or replace function public.lao_sync_class_section_from_enrollment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_grade_code text;
  v_sort integer;
begin
  if nullif(btrim(new.grade_level),'') is null or nullif(btrim(new.classroom),'') is null then
    return new;
  end if;

  v_grade_code:=case
    when new.grade_level ~ '^อนุบาล[[:space:]]*1$' then 'K1'
    when new.grade_level ~ '^อนุบาล[[:space:]]*2$' then 'K2'
    when new.grade_level ~ '^อนุบาล[[:space:]]*3$' then 'K3'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*1$' then 'P1'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*2$' then 'P2'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*3$' then 'P3'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*4$' then 'P4'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*5$' then 'P5'
    when new.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*6$' then 'P6'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*1$' then 'M1'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*2$' then 'M2'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*3$' then 'M3'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*4$' then 'M4'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*5$' then 'M5'
    when new.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*6$' then 'M6'
    else null
  end;

  v_sort:=case
    when v_grade_code='K1' then 10
    when v_grade_code='K2' then 20
    when v_grade_code='K3' then 30
    when v_grade_code='P1' then 40
    when v_grade_code='P2' then 50
    when v_grade_code='P3' then 60
    when v_grade_code='P4' then 70
    when v_grade_code='P5' then 80
    when v_grade_code='P6' then 90
    when v_grade_code='M1' then 100
    when v_grade_code='M2' then 110
    when v_grade_code='M3' then 120
    when v_grade_code='M4' then 130
    when v_grade_code='M5' then 140
    when v_grade_code='M6' then 150
    else 900
  end;

  insert into public.lao_class_sections(
    school_id,academic_year_id,program_id,grade_code,grade_label,section_label,
    source_type,is_active,sort_order
  )
  values(
    new.school_id,new.academic_year_id,null,v_grade_code,btrim(new.grade_level),btrim(new.classroom),
    'lec',true,v_sort
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists lao_student_enrollment_sync_class_section on public.lao_student_term_enrollments;
create trigger lao_student_enrollment_sync_class_section
after insert or update of school_id,academic_year_id,grade_level,classroom
on public.lao_student_term_enrollments
for each row execute function public.lao_sync_class_section_from_enrollment();
