-- 0072_scoped_personnel_and_workload_permissions.sql
-- Connect the generic work-scope authority model to Personnel and Teaching Workload.

begin;

-- ---------------------------------------------------------------------------
-- 1) Preserve existing Personnel authority assignments in the new scope model
-- ---------------------------------------------------------------------------

insert into public.lao_work_authorities(
  school_id,personnel_id,user_id,scope_code,authority_role,
  can_view,can_edit,can_approve,can_delegate,is_active,
  starts_on,ends_on,assigned_by,created_at,updated_at
)
select
  a.school_id,a.personnel_id,a.user_id,'personnel.registry',
  case when a.authority_code='personnel_head' then 'work_head' else 'delegate' end,
  true,a.can_edit_personnel,false,false,a.is_active,
  a.starts_on,a.ends_on,a.assigned_by,a.created_at,a.updated_at
from public.lao_personnel_authorities a
where a.can_edit_personnel
on conflict(school_id,user_id,scope_code) do update set
  personnel_id=excluded.personnel_id,
  authority_role=excluded.authority_role,
  can_view=true,
  can_edit=excluded.can_edit,
  is_active=excluded.is_active,
  starts_on=excluded.starts_on,
  ends_on=excluded.ends_on,
  updated_at=greatest(public.lao_work_authorities.updated_at,excluded.updated_at);

insert into public.lao_work_authorities(
  school_id,personnel_id,user_id,scope_code,authority_role,
  can_view,can_edit,can_approve,can_delegate,is_active,
  starts_on,ends_on,assigned_by,created_at,updated_at
)
select
  a.school_id,a.personnel_id,a.user_id,'personnel.requests',
  case when a.authority_code='personnel_head' then 'work_head' else 'delegate' end,
  true,false,a.can_review_join,false,a.is_active,
  a.starts_on,a.ends_on,a.assigned_by,a.created_at,a.updated_at
from public.lao_personnel_authorities a
where a.can_review_join
on conflict(school_id,user_id,scope_code) do update set
  personnel_id=excluded.personnel_id,
  authority_role=excluded.authority_role,
  can_view=true,
  can_approve=excluded.can_approve,
  is_active=excluded.is_active,
  starts_on=excluded.starts_on,
  ends_on=excluded.ends_on,
  updated_at=greatest(public.lao_work_authorities.updated_at,excluded.updated_at);

insert into public.lao_work_authorities(
  school_id,personnel_id,user_id,scope_code,authority_role,
  can_view,can_edit,can_approve,can_delegate,is_active,
  starts_on,ends_on,assigned_by,created_at,updated_at
)
select
  a.school_id,a.personnel_id,a.user_id,'personnel.intake','work_head',
  true,true,false,false,a.is_active,
  a.starts_on,a.ends_on,a.assigned_by,a.created_at,a.updated_at
from public.lao_personnel_authorities a
where a.authority_code='personnel_head'
on conflict(school_id,user_id,scope_code) do update set
  personnel_id=excluded.personnel_id,
  authority_role=excluded.authority_role,
  can_view=true,
  can_edit=true,
  is_active=excluded.is_active,
  starts_on=excluded.starts_on,
  ends_on=excluded.ends_on,
  updated_at=greatest(public.lao_work_authorities.updated_at,excluded.updated_at);

-- ---------------------------------------------------------------------------
-- 2) Personnel edit/review/intake checks use local School Admin or scoped grants
-- ---------------------------------------------------------------------------

create or replace function public.lao_is_personnel_authority(
  p_school_id uuid,
  p_need_review boolean default false,
  p_need_edit boolean default false
)
returns boolean
language sql
stable
security definer
set search_path=public
as $function$
  select public.lao_is_local_school_admin(p_school_id)
  or (
    p_need_review
    and (
      public.lao_has_work_permission(p_school_id,'personnel.requests','approve')
      or public.lao_has_work_permission(p_school_id,'personnel.requests','edit')
    )
  )
  or (
    p_need_edit
    and public.lao_has_work_permission(p_school_id,'personnel.registry','edit')
  )
  or (
    not p_need_review and not p_need_edit
    and (
      public.lao_has_work_permission(p_school_id,'personnel.registry','view')
      or public.lao_has_work_permission(p_school_id,'personnel.requests','view')
      or public.lao_has_work_permission(p_school_id,'personnel.intake','view')
    )
  )
  or exists(
    select 1
    from public.lao_personnel_authorities a
    where a.school_id=p_school_id
      and a.user_id=(select auth.uid())
      and a.is_active
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
      and (not p_need_review or a.can_review_join)
      and (not p_need_edit or a.can_edit_personnel)
  );
$function$;

create or replace function public.lao_can_manage_personnel(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $function$
  select public.lao_is_local_school_admin(p_school_id)
  or public.lao_has_work_permission(p_school_id,'personnel.registry','edit')
  or exists(
    select 1
    from public.lao_personnel_authorities a
    where a.school_id=p_school_id
      and a.user_id=(select auth.uid())
      and a.is_active and a.can_edit_personnel
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
  );
$function$;

create or replace function public.lao_can_review_personnel_join(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $function$
  select public.lao_is_local_school_admin(p_school_id)
  or public.lao_has_work_permission(p_school_id,'personnel.requests','approve')
  or public.lao_has_work_permission(p_school_id,'personnel.requests','edit')
  or exists(
    select 1
    from public.lao_personnel_authorities a
    where a.school_id=p_school_id
      and a.user_id=(select auth.uid())
      and a.is_active and a.can_review_join
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
  );
$function$;

create or replace function public.lao_can_manage_personnel_intake(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $function$
  select public.lao_is_local_school_admin(p_school_id)
  or public.lao_has_work_permission(p_school_id,'personnel.intake','edit')
  or exists(
    select 1
    from public.lao_personnel_authorities a
    where a.school_id=p_school_id
      and a.user_id=(select auth.uid())
      and a.authority_code='personnel_head'
      and a.is_active
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
  );
$function$;

create or replace function public.lao_personnel_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_can_review boolean:=false;
  v_can_manage_intake boolean:=false;
  v_can_assign boolean:=false;
  v_pending integer:=0;
begin
  if (select auth.uid()) is null or p_school_id is null then
    return jsonb_build_object(
      'can_review',false,'can_manage_intake',false,'can_assign_authority',false,'pending_join_requests',0
    );
  end if;

  v_can_review:=public.lao_can_review_personnel_join(p_school_id);
  v_can_manage_intake:=public.lao_can_manage_personnel_intake(p_school_id);
  v_can_assign:=public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'personnel.authorities','delegate');

  if v_can_review then
    select count(*) into v_pending
    from public.lao_personnel_join_requests
    where school_id=p_school_id and status='pending_review';
  end if;

  return jsonb_build_object(
    'can_review',v_can_review,
    'can_manage_intake',v_can_manage_intake,
    'can_assign_authority',v_can_assign,
    'pending_join_requests',v_pending
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3) Teaching workload manager rights come from academics.workload
-- Teachers keep their existing right to draft/submit their own workload.
-- ---------------------------------------------------------------------------

create or replace function public.lao_can_view_all_teaching_workload(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $function$
  select public.lao_is_local_school_admin(p_school_id)
  or public.lao_has_work_permission(p_school_id,'academics.workload','view')
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id=p_school_id
      and r.code in ('school_executive','registrar')
  );
$function$;

create or replace function public.lao_academic_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_manage boolean:=false;
  v_own uuid;
  v_pending integer:=0;
  v_returned integer:=0;
begin
  if v_uid is null or p_school_id is null or not public.lao_can_view_academic(p_school_id) then
    return jsonb_build_object(
      'can_manage',false,
      'pending_teaching_workloads',0,
      'my_returned_workloads',0,
      'attention_count',0
    );
  end if;

  v_manage:=public.lao_is_local_school_admin(p_school_id)
    or public.lao_has_work_permission(p_school_id,'academics.workload','edit')
    or public.lao_has_work_permission(p_school_id,'academics.workload','approve');
  v_own:=public.lao_my_personnel_id(p_school_id);

  if v_manage then
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
    'can_manage',v_manage,
    'pending_teaching_workloads',v_pending,
    'my_returned_workloads',v_returned,
    'attention_count',v_pending+v_returned
  );
end;
$function$;

alter function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid)
  rename to lao_teaching_workload_page_base_v01915;
revoke all on function public.lao_teaching_workload_page_base_v01915(uuid,uuid,uuid,text,uuid)
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
set search_path=public
as $function$
begin
  if public.lao_has_work_permission(p_school_id,'academics.workload','edit')
     or public.lao_has_work_permission(p_school_id,'academics.workload','approve') then
    perform set_config('lao.work_scope_override','academics.workload',true);
  end if;
  return public.lao_teaching_workload_page_base_v01915(
    p_school_id,p_academic_year_id,p_term_id,p_status,p_personnel_id
  );
end;
$function$;

alter function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text)
  rename to lao_save_teaching_workload_base_v01915;
revoke all on function public.lao_save_teaching_workload_base_v01915(uuid,uuid,uuid,uuid,text,jsonb,text)
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
set search_path=public
as $function$
declare
  v_result jsonb;
  v_id uuid;
  v_org uuid;
begin
  if public.lao_has_work_permission(p_school_id,'academics.workload','edit')
     or public.lao_has_work_permission(p_school_id,'academics.workload','approve') then
    perform set_config('lao.work_scope_override','academics.workload',true);
  end if;

  v_result:=public.lao_save_teaching_workload_base_v01915(
    p_school_id,p_workload_id,p_personnel_id,p_term_id,p_note,p_items,p_action
  );

  -- Notify scoped reviewers as well. Avoid duplicate notifications to the actor
  -- and to users already notified by the legacy School Admin/academic-officer path.
  if p_action='submit' then
    v_id:=nullif(v_result->>'id','')::uuid;
    select organization_id into v_org from public.lao_schools where id=p_school_id;

    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    select distinct a.user_id,v_org,p_school_id,'teaching_workload_submitted',
      'มีภาระงานสอนรอตรวจสอบ',
      'มีภาระงานสอนส่งเข้าระบบและรอการตรวจสอบ',
      'teaching_workload',v_id::text
    from public.lao_work_authorities a
    where a.school_id=p_school_id
      and a.is_active
      and a.user_id<>(select auth.uid())
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
      and a.can_approve
      and (
        a.scope_code='academics'
        or a.scope_code='academics.workload'
      )
      and not exists(
        select 1 from public.lao_notifications n
        where n.user_id=a.user_id
          and n.notification_type='teaching_workload_submitted'
          and n.entity_type='teaching_workload'
          and n.entity_id=v_id::text
      );
  end if;

  return v_result;
end;
$function$;

alter function public.lao_review_teaching_workload(uuid,text,text)
  rename to lao_review_teaching_workload_base_v01915;
revoke all on function public.lao_review_teaching_workload_base_v01915(uuid,text,text)
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

  if v_school_id is null then raise exception 'ไม่พบภาระงานสอน'; end if;
  if not public.lao_is_local_school_admin(v_school_id)
     and not public.lao_has_work_permission(v_school_id,'academics.workload','approve') then
    raise exception 'ไม่มีสิทธิ์อนุมัติ/ส่งกลับภาระงานสอน';
  end if;

  perform set_config('lao.work_scope_override','academics.workload',true);
  return public.lao_review_teaching_workload_base_v01915(p_workload_id,p_decision,p_review_note);
end;
$function$;

revoke all on function public.lao_is_personnel_authority(uuid,boolean,boolean) from public,anon;
revoke all on function public.lao_can_manage_personnel(uuid) from public,anon;
revoke all on function public.lao_can_review_personnel_join(uuid) from public,anon;
revoke all on function public.lao_can_manage_personnel_intake(uuid) from public,anon;
revoke all on function public.lao_personnel_work_counts(uuid) from public,anon;
revoke all on function public.lao_can_view_all_teaching_workload(uuid) from public,anon;
revoke all on function public.lao_academic_work_counts(uuid) from public,anon;
revoke all on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) from public,anon;
revoke all on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon;
revoke all on function public.lao_review_teaching_workload(uuid,text,text) from public,anon;

grant execute on function public.lao_is_personnel_authority(uuid,boolean,boolean) to authenticated;
grant execute on function public.lao_can_manage_personnel(uuid) to authenticated;
grant execute on function public.lao_can_review_personnel_join(uuid) to authenticated;
grant execute on function public.lao_can_manage_personnel_intake(uuid) to authenticated;
grant execute on function public.lao_personnel_work_counts(uuid) to authenticated;
grant execute on function public.lao_can_view_all_teaching_workload(uuid) to authenticated;
grant execute on function public.lao_academic_work_counts(uuid) to authenticated;
grant execute on function public.lao_teaching_workload_page(uuid,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.lao_save_teaching_workload(uuid,uuid,uuid,uuid,text,jsonb,text) to authenticated;
grant execute on function public.lao_review_teaching_workload(uuid,text,text) to authenticated;

commit;
