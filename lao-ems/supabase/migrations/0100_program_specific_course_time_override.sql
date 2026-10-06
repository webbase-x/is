-- 0100_program_specific_course_time_override.sql
-- Allow special programs to start from the normal-room curriculum time and
-- then keep an independent program-specific time allocation.

begin;

create or replace function public.lao_create_program_course_override(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text,
  p_source_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_source public.lao_curriculum_courses%rowtype;
  v_course_id uuid;
  v_existing boolean := false;
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์แก้ไขโครงสร้างหลักสูตร';
  end if;

  if p_program_id is null then
    raise exception 'กรุณาเลือกโปรแกรมพิเศษ';
  end if;

  if not public.lao_academic_year_program_enabled(
    p_school_id,p_academic_year_id,p_program_id
  ) then
    raise exception 'โปรแกรมนี้ยังไม่ได้ถูกเลือกใช้ในปีการศึกษานี้';
  end if;

  select c.*
  into v_source
  from public.lao_curriculum_courses c
  where c.id=p_source_course_id
    and c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.program_id is null
    and c.grade_code=upper(nullif(btrim(p_grade_code),''))
    and c.is_active;

  if v_source.id is null then
    raise exception 'ไม่พบรายวิชาห้องปกติที่ใช้เป็นต้นแบบ';
  end if;

  select c.id
  into v_course_id
  from public.lao_curriculum_courses c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.program_id=p_program_id
    and c.grade_code=v_source.grade_code
    and c.subject_id=v_source.subject_id
  limit 1;

  if v_course_id is not null then
    v_existing := true;

    update public.lao_curriculum_courses
    set grade_label=v_source.grade_label,
        annual_hours=v_source.annual_hours,
        credits=v_source.credits,
        notes=v_source.notes,
        is_active=true,
        sort_order=v_source.sort_order,
        standard_time_template_id=v_source.standard_time_template_id,
        standard_time_snapshot=v_source.standard_time_snapshot,
        time_customized=v_source.time_customized,
        time_customized_at=v_source.time_customized_at,
        time_customized_by=v_source.time_customized_by,
        time_override_note=v_source.time_override_note,
        display_name=v_source.display_name,
        updated_by=v_uid,
        updated_at=now()
    where id=v_course_id;

    delete from public.lao_course_term_plans
    where course_id=v_course_id;
  else
    insert into public.lao_curriculum_courses(
      school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
      annual_hours,credits,notes,is_active,sort_order,
      standard_time_template_id,standard_time_snapshot,
      time_customized,time_customized_at,time_customized_by,time_override_note,
      display_name,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,v_source.grade_code,
      v_source.grade_label,v_source.subject_id,
      v_source.annual_hours,v_source.credits,v_source.notes,true,v_source.sort_order,
      v_source.standard_time_template_id,v_source.standard_time_snapshot,
      v_source.time_customized,v_source.time_customized_at,v_source.time_customized_by,
      v_source.time_override_note,v_source.display_name,v_uid,v_uid
    )
    returning id into v_course_id;
  end if;

  insert into public.lao_course_term_plans(
    course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
  )
  select
    v_course_id,p.term_id,p.weekly_periods,p.term_hours,p.notes,v_uid,v_uid
  from public.lao_course_term_plans p
  where p.course_id=v_source.id;

  delete from public.lao_curriculum_program_exclusions
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and program_id=p_program_id
    and grade_code=v_source.grade_code
    and subject_id=v_source.subject_id;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id
    and grade_code=v_source.grade_code;

  select organization_id
  into v_org
  from public.lao_schools
  where id=p_school_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case when v_existing
      then 'curriculum_program_time_override_reactivated'
      else 'curriculum_program_time_override_created'
    end,
    'curriculum_course',
    v_course_id::text,
    jsonb_build_object(
      'source_course_id',v_source.id,
      'program_id',p_program_id,
      'grade_code',v_source.grade_code,
      'subject_id',v_source.subject_id,
      'annual_hours',v_source.annual_hours
    )
  );

  return jsonb_build_object(
    'course_id',v_course_id,
    'source_course_id',v_source.id,
    'program_id',p_program_id,
    'grade_code',v_source.grade_code,
    'subject_id',v_source.subject_id,
    'reactivated',v_existing
  );
end;
$function$;

revoke all on function public.lao_create_program_course_override(uuid,uuid,uuid,text,uuid)
  from public,anon;
grant execute on function public.lao_create_program_course_override(uuid,uuid,uuid,text,uuid)
  to authenticated;

commit;
