-- 0051_safe_academic_period_delete.sql
-- Safe deletion for academic years and terms.
-- Deletion is blocked whenever linked operational/academic data exists.
-- Only local school administrators may delete, and exact confirmation text is required.

begin;

create or replace function public.lao_academic_year_delete_preview(
  p_school_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year integer;
  v_current boolean;
  v_terms integer;
  v_students integer;
  v_lec_batches integer;
  v_activities integer;
  v_classes integer;
  v_courses integer;
  v_workloads integer;
  v_schedule integer;
  v_default_inits integer;
  v_grade_inits integer;
  v_exclusions integer;
  v_confirmations integer;
  v_parallel_groups integer;
  v_blockers integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can delete academic periods';
  end if;

  select ay.year_be,ay.is_current
  into v_year,v_current
  from public.lao_academic_years ay
  where ay.id=p_academic_year_id and ay.school_id=p_school_id;

  if v_year is null then raise exception 'Academic year not found'; end if;

  select count(*) into v_terms
  from public.lao_terms t
  where t.academic_year_id=p_academic_year_id;

  select count(*) into v_students
  from public.lao_student_term_enrollments e
  where e.school_id=p_school_id and e.academic_year_id=p_academic_year_id;

  select count(*) into v_lec_batches
  from public.lao_lec_import_batches b
  where b.school_id=p_school_id and b.academic_year_id=p_academic_year_id;

  select count(*) into v_activities
  from public.lao_student_activity_enrollments e
  where e.school_id=p_school_id and e.academic_year_id=p_academic_year_id;

  select count(*) into v_classes
  from public.lao_class_sections c
  where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id;

  select count(*) into v_courses
  from public.lao_curriculum_courses c
  where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id;

  select count(*) into v_workloads
  from public.lao_teaching_workloads w
  where w.school_id=p_school_id and w.academic_year_id=p_academic_year_id;

  select count(*) into v_schedule
  from public.lao_academic_schedule_settings s
  where s.school_id=p_school_id and s.academic_year_id=p_academic_year_id;

  select count(*) into v_default_inits
  from public.lao_curriculum_default_initializations x
  where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;

  select count(*) into v_grade_inits
  from public.lao_curriculum_grade_initializations x
  where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;

  select count(*) into v_exclusions
  from public.lao_curriculum_program_exclusions x
  where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;

  select count(*) into v_confirmations
  from public.lao_curriculum_structure_confirmations x
  where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;

  select count(*) into v_parallel_groups
  from public.lao_curriculum_parallel_groups x
  where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id;

  v_blockers :=
    v_students + v_lec_batches + v_activities + v_classes + v_courses + v_workloads +
    v_schedule + v_default_inits + v_grade_inits + v_exclusions + v_confirmations + v_parallel_groups;

  return jsonb_build_object(
    'academic_year_id',p_academic_year_id,
    'year_be',v_year,
    'is_current',coalesce(v_current,false),
    'confirmation_text','ลบปีการศึกษา '||v_year::text,
    'can_delete',v_blockers=0,
    'term_count',v_terms,
    'blocker_count',v_blockers,
    'blockers',jsonb_build_object(
      'student_enrollments',v_students,
      'lec_batches',v_lec_batches,
      'student_activities',v_activities,
      'class_sections',v_classes,
      'curriculum_courses',v_courses,
      'teaching_workloads',v_workloads,
      'schedule_settings',v_schedule,
      'default_initializations',v_default_inits,
      'grade_initializations',v_grade_inits,
      'program_exclusions',v_exclusions,
      'structure_confirmations',v_confirmations,
      'parallel_groups',v_parallel_groups
    ),
    'safe_message',case
      when v_blockers=0 then 'ปีการศึกษานี้ไม่มีข้อมูลเชื่อมโยงที่ระบบต้องป้องกัน สามารถลบได้'
      else 'ยังมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบปีการศึกษา'
    end
  );
end;
$function$;

create or replace function public.lao_delete_academic_year_safe(
  p_school_id uuid,
  p_academic_year_id uuid,
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
  v_preview jsonb;
  v_year integer;
  v_expected text;
  v_terms integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can delete academic periods';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_school_id::text),coalesce((select year_be from public.lao_academic_years where id=p_academic_year_id),0));

  v_preview:=public.lao_academic_year_delete_preview(p_school_id,p_academic_year_id);
  v_year:=(v_preview->>'year_be')::integer;
  v_expected:=v_preview->>'confirmation_text';
  v_terms:=coalesce((v_preview->>'term_count')::integer,0);

  if coalesce((v_preview->>'can_delete')::boolean,false)=false then
    raise exception 'ไม่สามารถลบปีการศึกษา % ได้ เนื่องจากยังมีข้อมูลเชื่อมโยง',v_year;
  end if;

  if coalesce(btrim(p_confirmation),'')<>v_expected then
    raise exception 'ข้อความยืนยันไม่ถูกต้อง';
  end if;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  delete from public.lao_academic_years
  where id=p_academic_year_id and school_id=p_school_id;

  if not found then raise exception 'Academic year not found'; end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context
  ) values(
    v_org,p_school_id,v_uid,
    'academic_year_deleted_safe','academic_year',p_academic_year_id::text,
    v_preview,
    jsonb_build_object('deleted',true,'year_be',v_year,'term_count_deleted',v_terms),
    jsonb_build_object('safety_mode','blocked_if_linked_data')
  );

  return jsonb_build_object(
    'ok',true,
    'deleted_year_be',v_year,
    'deleted_term_count',v_terms
  );
end;
$function$;

create or replace function public.lao_term_delete_preview(
  p_school_id uuid,
  p_term_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_year_id uuid;
  v_year integer;
  v_term_no smallint;
  v_name text;
  v_current boolean;
  v_students integer;
  v_lec_batches integer;
  v_activities integer;
  v_plans integer;
  v_workloads integer;
  v_blockers integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can delete academic periods';
  end if;

  select ay.id,ay.year_be,t.term_no,t.name,t.is_current
  into v_year_id,v_year,v_term_no,v_name,v_current
  from public.lao_terms t
  join public.lao_academic_years ay on ay.id=t.academic_year_id
  where t.id=p_term_id and ay.school_id=p_school_id;

  if v_term_no is null then raise exception 'Term not found'; end if;

  select count(*) into v_students
  from public.lao_student_term_enrollments e
  where e.school_id=p_school_id and e.term_id=p_term_id;

  select count(*) into v_lec_batches
  from public.lao_lec_import_batches b
  where b.school_id=p_school_id and b.term_id=p_term_id;

  select count(*) into v_activities
  from public.lao_student_activity_enrollments e
  where e.school_id=p_school_id and e.term_id=p_term_id;

  select count(*) into v_plans
  from public.lao_course_term_plans p
  where p.term_id=p_term_id;

  select count(*) into v_workloads
  from public.lao_teaching_workloads w
  where w.school_id=p_school_id and w.term_id=p_term_id;

  v_blockers:=v_students+v_lec_batches+v_activities+v_plans+v_workloads;

  return jsonb_build_object(
    'term_id',p_term_id,
    'academic_year_id',v_year_id,
    'year_be',v_year,
    'term_no',v_term_no,
    'name',coalesce(v_name,'ภาคเรียนที่ '||v_term_no::text),
    'is_current',coalesce(v_current,false),
    'confirmation_text','ลบภาคเรียนที่ '||v_term_no::text||' ปีการศึกษา '||v_year::text,
    'can_delete',v_blockers=0,
    'blocker_count',v_blockers,
    'blockers',jsonb_build_object(
      'student_enrollments',v_students,
      'lec_batches',v_lec_batches,
      'student_activities',v_activities,
      'course_term_plans',v_plans,
      'teaching_workloads',v_workloads
    ),
    'safe_message',case
      when v_blockers=0 then 'ภาคเรียนนี้ไม่มีข้อมูลเชื่อมโยงที่ระบบต้องป้องกัน สามารถลบได้'
      else 'ยังมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบภาคเรียน'
    end
  );
end;
$function$;

create or replace function public.lao_delete_term_safe(
  p_school_id uuid,
  p_term_id uuid,
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
  v_preview jsonb;
  v_year integer;
  v_term_no integer;
  v_expected text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'Only this school administrator can delete academic periods';
  end if;

  v_preview:=public.lao_term_delete_preview(p_school_id,p_term_id);
  v_year:=(v_preview->>'year_be')::integer;
  v_term_no:=(v_preview->>'term_no')::integer;
  v_expected:=v_preview->>'confirmation_text';

  perform pg_advisory_xact_lock(hashtext(p_school_id::text),v_year*10+v_term_no);

  v_preview:=public.lao_term_delete_preview(p_school_id,p_term_id);
  if coalesce((v_preview->>'can_delete')::boolean,false)=false then
    raise exception 'ไม่สามารถลบภาคเรียนที่ % ปีการศึกษา % ได้ เนื่องจากยังมีข้อมูลเชื่อมโยง',v_term_no,v_year;
  end if;

  if coalesce(btrim(p_confirmation),'')<>v_expected then
    raise exception 'ข้อความยืนยันไม่ถูกต้อง';
  end if;

  select organization_id into v_org
  from public.lao_schools
  where id=p_school_id;

  delete from public.lao_terms t
  using public.lao_academic_years ay
  where t.id=p_term_id
    and t.academic_year_id=ay.id
    and ay.school_id=p_school_id;

  if not found then raise exception 'Term not found'; end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context
  ) values(
    v_org,p_school_id,v_uid,
    'term_deleted_safe','term',p_term_id::text,
    v_preview,
    jsonb_build_object('deleted',true,'year_be',v_year,'term_no',v_term_no),
    jsonb_build_object('safety_mode','blocked_if_linked_data')
  );

  return jsonb_build_object(
    'ok',true,
    'deleted_year_be',v_year,
    'deleted_term_no',v_term_no
  );
end;
$function$;

revoke all on function public.lao_academic_year_delete_preview(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_delete_preview(uuid,uuid) to authenticated;

revoke all on function public.lao_delete_academic_year_safe(uuid,uuid,text) from public,anon;
grant execute on function public.lao_delete_academic_year_safe(uuid,uuid,text) to authenticated;

revoke all on function public.lao_term_delete_preview(uuid,uuid) from public,anon;
grant execute on function public.lao_term_delete_preview(uuid,uuid) to authenticated;

revoke all on function public.lao_delete_term_safe(uuid,uuid,text) from public,anon;
grant execute on function public.lao_delete_term_safe(uuid,uuid,text) to authenticated;

commit;
