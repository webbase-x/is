-- 0053_safe_academic_linked_cleanup.sql
-- Explicit cleanup of low-risk academic-year configuration blockers.
-- High-risk operational data (students, LEC, classes, courses, workloads, activities)
-- is intentionally not deletable through this function.

begin;

create or replace function public.lao_clear_academic_year_linked_settings_safe(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_categories text[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_year integer;
  v_expected text;
  v_allowed text[] := array[
    'schedule_settings',
    'default_initializations',
    'grade_initializations',
    'program_exclusions',
    'structure_confirmations',
    'parallel_groups'
  ]::text[];
  v_category text;
  v_removed jsonb := '{}'::jsonb;
  v_count integer;
  v_before jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can clear linked academic settings';
  end if;

  select ay.year_be,s.organization_id
  into v_year,v_org
  from public.lao_academic_years ay
  join public.lao_schools s on s.id=ay.school_id
  where ay.id=p_academic_year_id and ay.school_id=p_school_id;

  if v_year is null then raise exception 'Academic year not found'; end if;

  if p_categories is null or cardinality(p_categories)=0 then
    raise exception 'กรุณาเลือกข้อมูลที่ต้องการลบ';
  end if;

  foreach v_category in array p_categories loop
    if not (v_category=any(v_allowed)) then
      raise exception 'ไม่อนุญาตให้ลบข้อมูลประเภท % จากขั้นตอนนี้',v_category;
    end if;
  end loop;

  v_expected := 'ลบข้อมูลเชื่อมโยงปี '||v_year::text;
  if coalesce(btrim(p_confirmation),'')<>v_expected then
    raise exception 'ข้อความยืนยันไม่ถูกต้อง';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_school_id::text),v_year);

  v_before:=public.lao_academic_year_delete_preview(p_school_id,p_academic_year_id);

  if 'schedule_settings'=any(p_categories) then
    delete from public.lao_academic_schedule_settings
    where school_id=p_school_id and academic_year_id=p_academic_year_id;
    get diagnostics v_count=row_count;
    v_removed:=v_removed||jsonb_build_object('schedule_settings',v_count);
  end if;

  if 'default_initializations'=any(p_categories) then
    delete from public.lao_curriculum_default_initializations
    where school_id=p_school_id and academic_year_id=p_academic_year_id;
    get diagnostics v_count=row_count;
    v_removed:=v_removed||jsonb_build_object('default_initializations',v_count);
  end if;

  if 'grade_initializations'=any(p_categories) then
    delete from public.lao_curriculum_grade_initializations
    where school_id=p_school_id and academic_year_id=p_academic_year_id;
    get diagnostics v_count=row_count;
    v_removed:=v_removed||jsonb_build_object('grade_initializations',v_count);
  end if;

  if 'program_exclusions'=any(p_categories) then
    delete from public.lao_curriculum_program_exclusions
    where school_id=p_school_id and academic_year_id=p_academic_year_id;
    get diagnostics v_count=row_count;
    v_removed:=v_removed||jsonb_build_object('program_exclusions',v_count);
  end if;

  if 'structure_confirmations'=any(p_categories) then
    delete from public.lao_curriculum_structure_confirmations
    where school_id=p_school_id and academic_year_id=p_academic_year_id;
    get diagnostics v_count=row_count;
    v_removed:=v_removed||jsonb_build_object('structure_confirmations',v_count);
  end if;

  if 'parallel_groups'=any(p_categories) then
    delete from public.lao_curriculum_parallel_groups
    where school_id=p_school_id and academic_year_id=p_academic_year_id;
    get diagnostics v_count=row_count;
    v_removed:=v_removed||jsonb_build_object('parallel_groups',v_count);
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context
  ) values(
    v_org,p_school_id,v_uid,
    'academic_year_linked_settings_cleared','academic_year',p_academic_year_id::text,
    v_before,
    jsonb_build_object(
      'year_be',v_year,
      'removed',v_removed,
      'remaining_preview',public.lao_academic_year_delete_preview(p_school_id,p_academic_year_id)
    ),
    jsonb_build_object(
      'safety_mode','selected_low_risk_linked_cleanup',
      'allowed_categories',to_jsonb(v_allowed)
    )
  );

  return jsonb_build_object(
    'ok',true,
    'year_be',v_year,
    'removed',v_removed,
    'preview',public.lao_academic_year_delete_preview(p_school_id,p_academic_year_id)
  );
end;
$function$;

revoke all on function public.lao_clear_academic_year_linked_settings_safe(uuid,uuid,text[],text) from public,anon;
grant execute on function public.lao_clear_academic_year_linked_settings_safe(uuid,uuid,text[],text) to authenticated;

commit;
