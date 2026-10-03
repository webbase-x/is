-- 0076_work_authority_membership_hardening.sql
-- Delegated authority is effective only while both delegator context and target
-- account still belong to the same school as active members.

begin;

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

create or replace function public.lao_my_work_authority_access(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_local_admin boolean:=false;
  v_active_member boolean:=false;
  v_has_authority boolean:=false;
  v_can_delegate boolean:=false;
begin
  if v_uid is null or p_school_id is null then
    return jsonb_build_object(
      'can_view',false,'can_delegate_any',false,'is_school_admin',false
    );
  end if;

  v_local_admin:=public.lao_is_local_school_admin(p_school_id);
  select exists(
    select 1 from public.lao_memberships m
    where m.user_id=v_uid and m.school_id=p_school_id and m.status='active'
  ) into v_active_member;

  if v_active_member then
    select exists(
      select 1 from public.lao_work_authorities a
      where a.school_id=p_school_id and a.user_id=v_uid and a.is_active
        and (a.starts_on is null or a.starts_on<=current_date)
        and (a.ends_on is null or a.ends_on>=current_date)
    ) into v_has_authority;

    select exists(
      select 1 from public.lao_work_authorities a
      where a.school_id=p_school_id and a.user_id=v_uid and a.is_active
        and a.can_delegate
        and (a.starts_on is null or a.starts_on<=current_date)
        and (a.ends_on is null or a.ends_on>=current_date)
    ) into v_can_delegate;
  end if;

  return jsonb_build_object(
    'can_view',v_local_admin or (v_active_member and v_has_authority),
    'can_delegate_any',v_local_admin or (v_active_member and v_can_delegate),
    'is_school_admin',v_local_admin
  );
end;
$function$;

alter function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) rename to lao_save_work_authority_base_v01914_membership_gate;

revoke all on function public.lao_save_work_authority_base_v01914_membership_gate(
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
    on pa.personnel_id=p.id
   and pa.school_id=p_school_id
  where p.id=p_personnel_id
    and p.school_id=p_school_id
    and p.employment_status='active';

  if v_target_user is null then
    raise exception 'บุคลากรต้องเชื่อมบัญชีผู้ใช้ก่อนจึงจะมอบหมายสิทธิ์ได้';
  end if;

  if not exists(
    select 1
    from public.lao_memberships m
    where m.user_id=v_target_user
      and m.school_id=p_school_id
      and m.status='active'
  ) then
    raise exception 'บัญชีของบุคลากรยังไม่มีสิทธิ์ใช้งานโรงเรียนนี้ กรุณาอนุมัติการเข้าร่วมก่อน';
  end if;

  return public.lao_save_work_authority_base_v01914_membership_gate(
    p_school_id,p_personnel_id,p_scope_code,p_authority_role,
    p_can_view,p_can_edit,p_can_approve,p_can_delegate,
    p_starts_on,p_ends_on
  );
end;
$function$;

revoke all on function public.lao_has_work_permission(uuid,text,text) from public,anon;
grant execute on function public.lao_has_work_permission(uuid,text,text) to authenticated;
revoke all on function public.lao_my_work_authority_access(uuid) from public,anon;
grant execute on function public.lao_my_work_authority_access(uuid) to authenticated;
revoke all on function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) from public,anon;
grant execute on function public.lao_save_work_authority(
  uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date
) to authenticated;

commit;
