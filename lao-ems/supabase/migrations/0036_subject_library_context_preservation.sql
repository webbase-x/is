create or replace function public.lao_remove_curriculum_item(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_course record;
  v_action text;
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select c.*,s.subject_type,s.subject_code,s.name_th
  into v_course
  from public.lao_curriculum_courses c
  join public.lao_subjects s on s.id=c.subject_id
  where c.id=p_course_id
    and c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.grade_code=p_grade_code;

  if v_course.id is null then raise exception 'ไม่พบรายวิชาในโครงสร้างนี้'; end if;

  if p_program_id is not null
     and v_course.program_id is null
     and v_course.subject_type in ('basic','activity') then
    insert into public.lao_curriculum_program_exclusions(
      school_id,academic_year_id,program_id,grade_code,subject_id,created_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_course.subject_id,v_uid
    )
    on conflict do nothing;
    v_action:='curriculum_subject_excluded';
  else
    if v_course.program_id is distinct from p_program_id then
      raise exception 'รายวิชานี้ไม่อยู่ในกลุ่มห้องที่เลือก';
    end if;

    select group_id into v_group_id
    from public.lao_curriculum_parallel_group_courses
    where course_id=v_course.id
    limit 1;

    if v_group_id is not null then
      delete from public.lao_curriculum_parallel_group_courses
      where group_id=v_group_id and course_id=v_course.id;

      if (select count(*) from public.lao_curriculum_parallel_group_courses where group_id=v_group_id)<2 then
        delete from public.lao_curriculum_parallel_groups where id=v_group_id;
      end if;
    end if;

    update public.lao_curriculum_courses
    set is_active=false,
        updated_by=v_uid,
        updated_at=now()
    where id=v_course.id;

    v_action:='curriculum_subject_removed';
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id
    and grade_code=p_grade_code;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'curriculum_course',p_course_id::text,
    jsonb_build_object(
      'grade_code',p_grade_code,
      'program_id',p_program_id,
      'subject_id',v_course.subject_id,
      'subject_code',v_course.subject_code,
      'subject_name',v_course.name_th,
      'kept_in_school_library',true
    )
  );

  return jsonb_build_object(
    'action',v_action,
    'subject_id',v_course.subject_id,
    'course_id',v_course.id,
    'kept_in_school_library',true
  );
end;
$function$;

revoke all on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) to authenticated;
