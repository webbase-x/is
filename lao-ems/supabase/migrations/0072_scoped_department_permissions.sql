-- 0072_scoped_department_permissions.sql
-- Enforce scoped edit/approve rights for school-owned academic/personnel work.
-- School Admin remains the local owner; other users must be explicitly delegated.

begin;

-- Harden delegated access: an authority is effective only while the user still
-- has active access to the same school.
create or replace function public.lao_has_work_permission(
  p_school_id uuid,
  p_scope_code text,
  p_permission text default 'view'
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
begin
  if v_uid is null or p_school_id is null or nullif(btrim(p_scope_code),'') is null then
    return false;
  end if;
  if p_permission not in ('view','edit','approve','delegate') then
    return false;
  end if;

  if public.lao_is_local_school_admin(p_school_id) then
    return true;
  end if;

  if not exists(
    select 1
    from public.lao_memberships m
    where m.user_id=v_uid
      and m.school_id=p_school_id
      and m.status='active'
  ) then
    return false;
  end if;

  return exists(
    select 1
    from public.lao_work_authorities a
    where a.school_id=p_school_id
      and a.user_id=v_uid
      and a.is_active
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
      and (
        p_scope_code=a.scope_code
        or p_scope_code like a.scope_code||'.%'
      )
      and case p_permission
        when 'view' then a.can_view
        when 'edit' then a.can_edit
        when 'approve' then a.can_approve
        when 'delegate' then a.can_delegate
        else false
      end
  );
end;
$function$;

revoke all on function public.lao_has_work_permission(uuid,text,text) from public,anon;
grant execute on function public.lao_has_work_permission(uuid,text,text) to authenticated;

-- Validate that a delegated target is still an active school user before saving.
alter function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) rename to lao_save_work_authority_base_v01914;

revoke all on function public.lao_save_work_authority_base_v01914(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) from public,anon,authenticated;

create function public.lao_save_work_authority(
  p_school_id uuid,
  p_personnel_id uuid,
  p_scope_code text,
  p_authority_role text default 'delegate',
  p_can_view boolean default true,
  p_can_edit boolean default false,
  p_can_approve boolean default false,
  p_can_delegate boolean default false,
  p_starts_on date default null,
  p_ends_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_target_user uuid;
begin
  select pa.user_id into v_target_user
  from public.lao_personnel p
  join public.lao_personnel_accounts pa
    on pa.personnel_id=p.id and pa.school_id=p_school_id
  where p.id=p_personnel_id
    and p.school_id=p_school_id
    and p.employment_status='active';

  if v_target_user is null then
    raise exception 'บุคลากรต้องเชื่อมบัญชีผู้ใช้ก่อนจึงจะมอบหมายสิทธิ์ได้';
  end if;

  if not exists(
    select 1 from public.lao_memberships m
    where m.user_id=v_target_user
      and m.school_id=p_school_id
      and m.status='active'
  ) then
    raise exception 'บัญชีของบุคลากรยังไม่มีสิทธิ์ใช้งานโรงเรียนนี้ กรุณาอนุมัติการเข้าร่วมก่อน';
  end if;

  return public.lao_save_work_authority_base_v01914(
    p_school_id,p_personnel_id,p_scope_code,p_authority_role,
    p_can_view,p_can_edit,p_can_approve,p_can_delegate,p_starts_on,p_ends_on
  );
end;
$function$;

revoke all on function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) from public,anon;
grant execute on function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) to authenticated;

-- ---------------------------------------------------------------------------
-- Academic work: School Admin owns the data; delegated users edit only scope.
-- ---------------------------------------------------------------------------

create or replace function public.lao_can_manage_academic(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_scope text:=nullif(current_setting('app.lao_scoped_scope',true),'');
  v_school text:=nullif(current_setting('app.lao_scoped_school_id',true),'');
  v_permission text:=coalesce(nullif(current_setting('app.lao_scoped_permission',true),''),'edit');
begin
  if (select auth.uid()) is null then return false; end if;
  if public.lao_is_local_school_admin(p_school_id) then return true; end if;
  if v_school is distinct from p_school_id::text then return false; end if;
  if v_scope is null or v_scope not like 'academics%' then return false; end if;
  if v_permission not in ('edit','approve') then return false; end if;
  return public.lao_has_work_permission(p_school_id,v_scope,v_permission);
end;
$function$;

revoke all on function public.lao_can_manage_academic(uuid) from public,anon;
grant execute on function public.lao_can_manage_academic(uuid) to authenticated;

-- Wrap the existing edit RPCs. The original function bodies remain intact,
-- but their internal lao_can_manage_academic() checks are satisfied only after
-- this trusted wrapper verifies the exact delegated scope.
do $wrap$
declare
  r record;
  v_base_name text;
  v_call_args text;
  v_sql text;
begin
  for r in
    with scope_map(function_name,scope_code) as (
      values
        ('lao_save_academic_program','academics.programs'),
        ('lao_assign_class_program','academics.classes'),
        ('lao_add_curriculum_library_item','academics.subjects'),
        ('lao_adopt_subject_catalog_item','academics.subjects'),
        ('lao_copy_curriculum_group_from_year','academics.subjects'),
        ('lao_create_curriculum_parallel_group','academics.subjects'),
        ('lao_create_school_subject_and_add','academics.subjects'),
        ('lao_delete_curriculum_parallel_group','academics.subjects'),
        ('lao_move_curriculum_course','academics.subjects'),
        ('lao_quick_add_curriculum_subject','academics.subjects'),
        ('lao_remove_curriculum_item','academics.subjects'),
        ('lao_reset_course_time_to_standard','academics.subjects'),
        ('lao_save_curriculum_course','academics.subjects'),
        ('lao_save_subject','academics.subjects'),
        ('lao_set_subject_requirement_decision','academics.subjects'),
        ('lao_update_course_time_override','academics.subjects')
    )
    select
      p.proname,
      m.scope_code,
      p.pronargs,
      pg_get_function_identity_arguments(p.oid) as identity_args,
      pg_get_function_arguments(p.oid) as full_args
    from scope_map m
    join pg_proc p on p.proname=m.function_name
    join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
  loop
    v_base_name:=r.proname||'_scope_base_v01914';

    select string_agg('$'||g::text,',' order by g)
      into v_call_args
    from generate_series(1,r.pronargs) g;

    execute format(
      'alter function public.%I(%s) rename to %I',
      r.proname,r.identity_args,v_base_name
    );
    execute format(
      'revoke all on function public.%I(%s) from public,anon,authenticated',
      v_base_name,r.identity_args
    );

    v_sql:=format(
      'create function public.%I(%s)
       returns jsonb
       language plpgsql
       security definer
       set search_path=public
       as $fn$
       begin
         if (select auth.uid()) is null then raise exception ''Authentication required''; end if;
         if not public.lao_has_work_permission($1,%L,''edit'') then
           raise exception ''ไม่มีสิทธิ์แก้ไขส่วนงานนี้ กรุณาติดต่อหัวหน้างานหรือ School Admin'';
         end if;
         perform set_config(''app.lao_scoped_school_id'',$1::text,true);
         perform set_config(''app.lao_scoped_scope'',%L,true);
         perform set_config(''app.lao_scoped_permission'',''edit'',true);
         return public.%I(%s);
       end;
       $fn$',
      r.proname,r.full_args,r.scope_code,r.scope_code,v_base_name,v_call_args
    );
    execute v_sql;

    execute format(
      'revoke all on function public.%I(%s) from public,anon',
      r.proname,r.identity_args
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated',
      r.proname,r.identity_args
    );
  end loop;
end;
$wrap$;

-- Confirmation is an approval action, not a general edit action.
alter function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text)
  rename to lao_confirm_curriculum_group_scope_base_v01914;
revoke all on function public.lao_confirm_curriculum_group_scope_base_v01914(uuid,uuid,uuid,text)
  from public,anon,authenticated;

create function public.lao_confirm_curriculum_group(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','approve') then
    raise exception 'ไม่มีสิทธิ์ยืนยันโครงสร้างหลักสูตร';
  end if;
  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.subjects',true);
  perform set_config('app.lao_scoped_permission','approve',true);
  return public.lao_confirm_curriculum_group_scope_base_v01914(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
end;
$function$;

revoke all on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) to authenticated;

-- Timeline actions follow the work section represented by the step.
alter function public.lao_update_academic_year_setup_step(uuid,uuid,text,text)
  rename to lao_update_academic_year_setup_step_scope_base_v01914;
revoke all on function public.lao_update_academic_year_setup_step_scope_base_v01914(uuid,uuid,text,text)
  from public,anon,authenticated;

create function public.lao_update_academic_year_setup_step(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_step_code text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_scope text;
begin
  v_scope:=case p_step_code
    when 'periods' then 'academics.basic_settings'
    when 'programs' then 'academics.programs'
    when 'classes' then 'academics.classes'
    when 'subjects' then 'academics.subjects'
    when 'workload' then 'academics.workload'
    else null
  end;
  if v_scope is null then raise exception 'ไม่พบขั้นตอนงานวิชาการ'; end if;
  if not public.lao_has_work_permission(p_school_id,v_scope,'edit') then
    raise exception 'ไม่มีสิทธิ์เปลี่ยนสถานะขั้นตอนนี้';
  end if;
  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope',v_scope,true);
  perform set_config('app.lao_scoped_permission','edit',true);
  return public.lao_update_academic_year_setup_step_scope_base_v01914(
    p_school_id,p_academic_year_id,p_step_code,p_action
  );
end;
$function$;

revoke all on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text) from public,anon;
grant execute on function public.lao_update_academic_year_setup_step(uuid,uuid,text,text) to authenticated;

-- Destructive annual cleanup remains School Admin only.
alter function public.lao_delete_academic_year_safe(uuid,uuid,text)
  rename to lao_delete_academic_year_safe_scope_base_v01914;
alter function public.lao_delete_term_safe(uuid,uuid,text)
  rename to lao_delete_term_safe_scope_base_v01914;
alter function public.lao_clear_academic_year_linked_settings_safe(uuid,uuid,text[],text)
  rename to lao_clear_academic_year_linked_settings_safe_scope_base_v01914;

revoke all on function public.lao_delete_academic_year_safe_scope_base_v01914(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.lao_delete_term_safe_scope_base_v01914(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.lao_clear_academic_year_linked_settings_safe_scope_base_v01914(uuid,uuid,text[],text)
  from public,anon,authenticated;

create function public.lao_delete_academic_year_safe(
  p_school_id uuid,p_academic_year_id uuid,p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'การลบปีการศึกษาให้ดำเนินการโดย School Admin เท่านั้น';
  end if;
  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.basic_settings',true);
  perform set_config('app.lao_scoped_permission','edit',true);
  return public.lao_delete_academic_year_safe_scope_base_v01914(
    p_school_id,p_academic_year_id,p_confirmation
  );
end;
$function$;

create function public.lao_delete_term_safe(
  p_school_id uuid,p_term_id uuid,p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'การลบภาคเรียนให้ดำเนินการโดย School Admin เท่านั้น';
  end if;
  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.basic_settings',true);
  perform set_config('app.lao_scoped_permission','edit',true);
  return public.lao_delete_term_safe_scope_base_v01914(
    p_school_id,p_term_id,p_confirmation
  );
end;
$function$;

create function public.lao_clear_academic_year_linked_settings_safe(
  p_school_id uuid,p_academic_year_id uuid,p_categories text[],p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_is_local_school_admin(p_school_id) then
    raise exception 'การล้างข้อมูลเชื่อมโยงให้ดำเนินการโดย School Admin เท่านั้น';
  end if;
  perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.basic_settings',true);
  perform set_config('app.lao_scoped_permission','edit',true);
  return public.lao_clear_academic_year_linked_settings_safe_scope_base_v01914(
    p_school_id,p_academic_year_id,p_categories,p_confirmation
  );
end;
$function$;

revoke all on function public.lao_delete_academic_year_safe(uuid,uuid,text) from public,anon;
grant execute on function public.lao_delete_academic_year_safe(uuid,uuid,text) to authenticated;
revoke all on function public.lao_delete_term_safe(uuid,uuid,text) from public,anon;
grant execute on function public.lao_delete_term_safe(uuid,uuid,text) to authenticated;
revoke all on function public.lao_clear_academic_year_linked_settings_safe(uuid,uuid,text[],text) from public,anon;
grant execute on function public.lao_clear_academic_year_linked_settings_safe(uuid,uuid,text[],text) to authenticated;

-- ---------------------------------------------------------------------------
-- Teaching workload: teachers may still propose their own load. Managing other
-- staff requires edit delegation; approving/returning requires approve.
-- ---------------------------------------------------------------------------

create or replace function public.lao_can_view_all_teaching_workload(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.workload','view')
    or public.lao_has_work_permission(p_school_id,'academics.workload','edit')
    or public.lao_has_work_permission(p_school_id,'academics.workload','approve');
$$;

revoke all on function public.lao_can_view_all_teaching_workload(uuid) from public,anon;
grant execute on function public.lao_can_view_all_teaching_workload(uuid) to authenticated;

create or replace function public.lao_academic_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_can_edit boolean:=false;
  v_can_approve boolean:=false;
  v_own uuid;
  v_pending integer:=0;
  v_returned integer:=0;
begin
  if v_uid is null or p_school_id is null or not public.lao_can_view_academic(p_school_id) then
    return jsonb_build_object(
      'can_manage',false,'can_approve',false,
      'pending_teaching_workloads',0,'my_returned_workloads',0,'attention_count',0
    );
  end if;

  v_can_edit:=public.lao_has_work_permission(p_school_id,'academics.workload','edit');
  v_can_approve:=public.lao_has_work_permission(p_school_id,'academics.workload','approve');
  v_own:=public.lao_my_personnel_id(p_school_id);

  if v_can_approve then
    select count(*) into v_pending
    from public.lao_teaching_workloads
    where school_id=p_school_id and status='submitted';
  end if;

  if v_own is not null then
    select count(*) into v_returned
    from public.lao_teaching_workloads
    where school_id=p_school_id and personnel_id=v_own and status='returned';
  end if;

  return jsonb_build_object(
    'can_manage',v_can_edit,
    'can_approve',v_can_approve,
    'pending_teaching_workloads',v_pending,
    'my_returned_workloads',v_returned,
    'attention_count',v_pending+v_returned
  );
end;
$function$;

revoke all on function public.lao_academic_work_counts(uuid) from public,anon;
grant execute on function public.lao_academic_work_counts(uuid) to authenticated;

alter function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid)
  rename to lao_teaching_workload_page_scope_base_v01914;
revoke all on function public.lao_teaching_workload_page_scope_base_v01914(uuid,uuid,uuid,text,uuid)
  from public,anon,authenticated;

create function public.lao_teaching_workload_page(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_term_id uuid default null,
  p_status text default null,
  p_personnel_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_can_edit boolean;
  v_can_approve boolean;
  v_can_view_all boolean;
  v_result jsonb;
begin
  v_can_edit:=public.lao_has_work_permission(p_school_id,'academics.workload','edit');
  v_can_approve:=public.lao_has_work_permission(p_school_id,'academics.workload','approve');
  v_can_view_all:=public.lao_can_view_all_teaching_workload(p_school_id);

  if v_can_edit then
    perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
    perform set_config('app.lao_scoped_scope','academics.workload',true);
    perform set_config('app.lao_scoped_permission','edit',true);
  end if;

  v_result:=public.lao_teaching_workload_page_scope_base_v01914(
    p_school_id,p_academic_year_id,p_term_id,p_status,p_personnel_id
  );

  return v_result||jsonb_build_object(
    'can_manage',v_can_edit,
    'can_approve',v_can_approve,
    'can_view_all',v_can_view_all
  );
end;
$function$;

revoke all on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) to authenticated;

alter function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text)
  rename to lao_save_teaching_workload_scope_base_v01914;
revoke all on function public.lao_save_teaching_workload_scope_base_v01914(uuid,uuid,uuid,uuid,text,jsonb,text)
  from public,anon,authenticated;

create function public.lao_save_teaching_workload(
  p_school_id uuid,
  p_workload_id uuid default null,
  p_personnel_id uuid default null,
  p_term_id uuid default null,
  p_note text default null,
  p_items jsonb default '[]'::jsonb,
  p_action text default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $function$
declare
  v_own uuid;
  v_can_edit boolean;
  v_can_approve boolean;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  v_own:=public.lao_my_personnel_id(p_school_id);
  v_can_edit:=public.lao_has_work_permission(p_school_id,'academics.workload','edit');
  v_can_approve:=public.lao_has_work_permission(p_school_id,'academics.workload','approve');

  if p_action='approve' then
    if not v_can_approve then raise exception 'ไม่มีสิทธิ์อนุมัติภาระงานสอน'; end if;
    perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
    perform set_config('app.lao_scoped_scope','academics.workload',true);
    perform set_config('app.lao_scoped_permission','approve',true);
  elsif v_can_edit then
    perform set_config('app.lao_scoped_school_id',p_school_id::text,true);
    perform set_config('app.lao_scoped_scope','academics.workload',true);
    perform set_config('app.lao_scoped_permission','edit',true);
  elsif p_personnel_id is not null and p_personnel_id is distinct from v_own then
    raise exception 'ไม่มีสิทธิ์จัดภาระงานให้บุคลากรอื่น';
  end if;

  return public.lao_save_teaching_workload_scope_base_v01914(
    p_school_id,p_workload_id,p_personnel_id,p_term_id,p_note,p_items,p_action
  );
end;
$function$;

revoke all on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon;
grant execute on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) to authenticated;

alter function public.lao_review_teaching_workload(uuid,text,text)
  rename to lao_review_teaching_workload_scope_base_v01914;
revoke all on function public.lao_review_teaching_workload_scope_base_v01914(uuid,text,text)
  from public,anon,authenticated;

create function public.lao_review_teaching_workload(
  p_workload_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id
  from public.lao_teaching_workloads
  where id=p_workload_id;
  if v_school_id is null then raise exception 'ไม่พบรายการภาระงานสอน'; end if;
  if not public.lao_has_work_permission(v_school_id,'academics.workload','approve') then
    raise exception 'ไม่มีสิทธิ์ตรวจอนุมัติภาระงานสอน';
  end if;

  perform set_config('app.lao_scoped_school_id',v_school_id::text,true);
  perform set_config('app.lao_scoped_scope','academics.workload',true);
  perform set_config('app.lao_scoped_permission','approve',true);

  return public.lao_review_teaching_workload_scope_base_v01914(
    p_workload_id,p_decision,p_review_note
  );
end;
$function$;

revoke all on function public.lao_review_teaching_workload(uuid,text,text) from public,anon;
grant execute on function public.lao_review_teaching_workload(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Personnel work uses the same generic scoped delegation model.
-- ---------------------------------------------------------------------------

create or replace function public.lao_can_manage_personnel(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'personnel.registry','edit');
$$;

create or replace function public.lao_can_manage_personnel_intake(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'personnel.intake','edit');
$$;

create or replace function public.lao_can_review_personnel_join(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'personnel.requests','approve');
$$;

revoke all on function public.lao_can_manage_personnel(uuid) from public,anon;
grant execute on function public.lao_can_manage_personnel(uuid) to authenticated;
revoke all on function public.lao_can_manage_personnel_intake(uuid) from public,anon;
grant execute on function public.lao_can_manage_personnel_intake(uuid) to authenticated;
revoke all on function public.lao_can_review_personnel_join(uuid) from public,anon;
grant execute on function public.lao_can_review_personnel_join(uuid) to authenticated;

commit;
