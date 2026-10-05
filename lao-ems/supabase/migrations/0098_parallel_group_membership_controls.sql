-- 0098_parallel_group_membership_controls.sql
-- Allow adding a course to an existing parallel/choice group and removing a
-- single course from a group. A group is dissolved automatically if fewer than
-- two members would remain.

begin;

create or replace function public.lao_add_curriculum_parallel_group_course(
  p_school_id uuid,
  p_group_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_group public.lao_curriculum_parallel_groups%rowtype;
  v_course public.lao_curriculum_courses%rowtype;
  v_existing_group uuid;
  v_term record;
  v_marker text;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์ดำเนินการในส่วนงานนี้';
  end if;

  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.subjects',true);
  perform set_config('app.lao_scoped_permission','edit',true);

  select * into v_group
  from public.lao_curriculum_parallel_groups
  where id=p_group_id and school_id=p_school_id;

  if v_group.id is null then raise exception 'ไม่พบกลุ่มรายวิชา'; end if;

  select * into v_course
  from public.lao_curriculum_courses
  where id=p_course_id and school_id=p_school_id and is_active;

  if v_course.id is null then raise exception 'ไม่พบรายวิชา'; end if;
  if v_course.academic_year_id is distinct from v_group.academic_year_id
     or v_course.grade_code is distinct from v_group.grade_code
     or v_course.program_id is distinct from v_group.program_id then
    raise exception 'รายวิชาไม่ได้อยู่ในปี/ระดับชั้น/โปรแกรมเดียวกับกลุ่มนี้';
  end if;

  select gc.group_id into v_existing_group
  from public.lao_curriculum_parallel_group_courses gc
  where gc.course_id=p_course_id
  limit 1;

  if v_existing_group=p_group_id then
    return jsonb_build_object('added',false,'already_member',true,'group_id',p_group_id,'course_id',p_course_id);
  elsif v_existing_group is not null then
    raise exception 'รายวิชานี้อยู่ในกลุ่มเวลาเดียวกันอื่นแล้ว กรุณานำออกจากกลุ่มเดิมก่อน';
  end if;

  insert into public.lao_curriculum_parallel_group_courses(group_id,course_id)
  values(p_group_id,p_course_id);

  v_marker:='อยู่ในกลุ่มรายวิชาทางเลือก/เวลาเดียวกัน: '||v_group.name;
  for v_term in
    select id from public.lao_terms
    where academic_year_id=v_group.academic_year_id
    order by term_no
  loop
    insert into public.lao_course_term_plans(
      course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
    ) values(
      p_course_id,v_term.id,v_group.weekly_periods,null,v_marker,v_uid,v_uid
    )
    on conflict(course_id,term_id) do update set
      weekly_periods=excluded.weekly_periods,
      notes=case
        when public.lao_course_term_plans.notes is null
          or btrim(public.lao_course_term_plans.notes)=''
          or public.lao_course_term_plans.notes like 'อยู่ในกลุ่มรายวิชาทางเลือก/เวลาเดียวกัน:%'
        then excluded.notes
        else public.lao_course_term_plans.notes||' · '||excluded.notes
      end,
      updated_by=v_uid;
  end loop;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=v_group.academic_year_id
    and program_id is not distinct from v_group.program_id
    and grade_code=v_group.grade_code;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_parallel_group_course_added',
    'curriculum_parallel_group',p_group_id::text,
    jsonb_build_object('course_id',p_course_id,'group_name',v_group.name,'weekly_periods',v_group.weekly_periods)
  );

  return jsonb_build_object('added',true,'group_id',p_group_id,'course_id',p_course_id);
end;
$function$;

create or replace function public.lao_remove_curriculum_parallel_group_course(
  p_school_id uuid,
  p_group_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_group public.lao_curriculum_parallel_groups%rowtype;
  v_member_count integer:=0;
  v_group_deleted boolean:=false;
  v_marker text;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์ดำเนินการในส่วนงานนี้';
  end if;

  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.subjects',true);
  perform set_config('app.lao_scoped_permission','edit',true);

  select * into v_group
  from public.lao_curriculum_parallel_groups
  where id=p_group_id and school_id=p_school_id;

  if v_group.id is null then raise exception 'ไม่พบกลุ่มรายวิชา'; end if;
  if not exists(
    select 1 from public.lao_curriculum_parallel_group_courses
    where group_id=p_group_id and course_id=p_course_id
  ) then
    raise exception 'รายวิชานี้ไม่ได้อยู่ในกลุ่ม';
  end if;

  select count(*)::integer into v_member_count
  from public.lao_curriculum_parallel_group_courses
  where group_id=p_group_id;

  v_marker:='อยู่ในกลุ่มรายวิชาทางเลือก/เวลาเดียวกัน: '||v_group.name;

  if v_member_count<=2 then
    update public.lao_course_term_plans tp
    set notes=null,updated_by=v_uid
    where tp.course_id in (
      select gc.course_id
      from public.lao_curriculum_parallel_group_courses gc
      where gc.group_id=p_group_id
    )
      and tp.notes=v_marker;

    delete from public.lao_curriculum_parallel_groups
    where id=p_group_id;
    v_group_deleted:=true;
  else
    delete from public.lao_curriculum_parallel_group_courses
    where group_id=p_group_id and course_id=p_course_id;

    update public.lao_course_term_plans
    set notes=null,updated_by=v_uid
    where course_id=p_course_id and notes=v_marker;
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=v_group.academic_year_id
    and program_id is not distinct from v_group.program_id
    and grade_code=v_group.grade_code;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case when v_group_deleted then 'curriculum_parallel_group_dissolved' else 'curriculum_parallel_group_course_removed' end,
    'curriculum_parallel_group',p_group_id::text,
    jsonb_build_object(
      'course_id',p_course_id,
      'group_name',v_group.name,
      'previous_member_count',v_member_count,
      'group_deleted',v_group_deleted
    )
  );

  return jsonb_build_object(
    'removed',true,
    'group_id',p_group_id,
    'course_id',p_course_id,
    'group_deleted',v_group_deleted
  );
end;
$function$;

-- Replace whole-group deletion with cleanup of the group marker in term-plan notes.
create or replace function public.lao_delete_curriculum_parallel_group(
  p_school_id uuid,
  p_group_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_group public.lao_curriculum_parallel_groups%rowtype;
  v_marker text;
  v_member_count integer:=0;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์ดำเนินการในส่วนงานนี้';
  end if;

  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.subjects',true);
  perform set_config('app.lao_scoped_permission','edit',true);

  select * into v_group
  from public.lao_curriculum_parallel_groups
  where id=p_group_id and school_id=p_school_id;

  if v_group.id is null then raise exception 'ไม่พบกลุ่มรายวิชา'; end if;

  select count(*)::integer into v_member_count
  from public.lao_curriculum_parallel_group_courses
  where group_id=p_group_id;

  v_marker:='อยู่ในกลุ่มรายวิชาทางเลือก/เวลาเดียวกัน: '||v_group.name;
  update public.lao_course_term_plans tp
  set notes=null,updated_by=v_uid
  where tp.course_id in (
    select gc.course_id
    from public.lao_curriculum_parallel_group_courses gc
    where gc.group_id=p_group_id
  )
    and tp.notes=v_marker;

  delete from public.lao_curriculum_parallel_groups
  where id=p_group_id;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=v_group.academic_year_id
    and program_id is not distinct from v_group.program_id
    and grade_code=v_group.grade_code;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_parallel_group_deleted',
    'curriculum_parallel_group',p_group_id::text,
    jsonb_build_object('group_name',v_group.name,'member_count',v_member_count)
  );

  return jsonb_build_object('deleted',true,'id',p_group_id,'member_count',v_member_count);
end;
$function$;

revoke all on function public.lao_add_curriculum_parallel_group_course(uuid,uuid,uuid)
  from public,anon;
grant execute on function public.lao_add_curriculum_parallel_group_course(uuid,uuid,uuid)
  to authenticated;

revoke all on function public.lao_remove_curriculum_parallel_group_course(uuid,uuid,uuid)
  from public,anon;
grant execute on function public.lao_remove_curriculum_parallel_group_course(uuid,uuid,uuid)
  to authenticated;

revoke all on function public.lao_delete_curriculum_parallel_group(uuid,uuid)
  from public,anon;
grant execute on function public.lao_delete_curriculum_parallel_group(uuid,uuid)
  to authenticated;

commit;
