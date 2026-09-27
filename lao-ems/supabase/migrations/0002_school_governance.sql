-- LAO-EMS school governance and change approval workflow
-- Applied to ISSQL as migration: lao_school_governance_workflow

create table if not exists public.lao_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.lao_organizations(id) on delete cascade,
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  request_kind text not null default 'school_profile_update' check (request_kind in ('school_profile_update')),
  entity_type text not null default 'school',
  entity_id text not null,
  before_data jsonb not null,
  proposed_data jsonb not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lao_change_requests_school_status_idx on public.lao_change_requests(school_id,status,created_at desc);
create index if not exists lao_change_requests_requester_idx on public.lao_change_requests(requested_by,created_at desc);

create table if not exists public.lao_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.lao_organizations(id) on delete cascade,
  school_id uuid references public.lao_schools(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists lao_notifications_user_created_idx on public.lao_notifications(user_id,created_at desc);
create index if not exists lao_notifications_user_unread_idx on public.lao_notifications(user_id,created_at desc) where read_at is null;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='lao_change_requests_touch') then
    create trigger lao_change_requests_touch before update on public.lao_change_requests
    for each row execute function public.lao_touch_updated_at();
  end if;
end $$;

create or replace function public.lao_is_local_school_admin(p_school_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid()) and m.status='active'
      and m.school_id=p_school_id and r.code='school_admin'
  );
$$;

create or replace function public.lao_school_has_admin(p_school_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.status='active' and m.school_id=p_school_id and r.code='school_admin'
  );
$$;

create or replace function public.lao_notify_platform_admins(
  p_title text,p_body text,p_entity_type text default null,p_entity_id text default null,
  p_organization_id uuid default null,p_school_id uuid default null
)
returns void language sql security definer set search_path=public as $$
  insert into public.lao_notifications(user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id)
  select pa.user_id,p_organization_id,p_school_id,'platform_action',p_title,p_body,p_entity_type,p_entity_id
  from public.lao_platform_admins pa;
$$;

create or replace function public.lao_notify_school_admins(
  p_school_id uuid,p_notification_type text,p_title text,p_body text,
  p_entity_type text default null,p_entity_id text default null
)
returns void language sql security definer set search_path=public as $$
  insert into public.lao_notifications(user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id)
  select distinct m.user_id,s.organization_id,s.id,p_notification_type,p_title,p_body,p_entity_type,p_entity_id
  from public.lao_schools s
  join public.lao_memberships m on m.school_id=s.id and m.status='active'
  join public.lao_membership_roles mr on mr.membership_id=m.id
  join public.lao_roles r on r.id=mr.role_id and r.code='school_admin'
  where s.id=p_school_id;
$$;

create or replace function public.lao_school_snapshot(p_school_id uuid,p_patch jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_s public.lao_schools; v_bad_key text; v_name_th text;
begin
  select * into v_s from public.lao_schools where id=p_school_id;
  if not found then raise exception 'School not found'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid school update payload'; end if;
  select k into v_bad_key from jsonb_object_keys(p_patch) as k
  where k not in ('code','name_th','name_en','short_name','phone','email','website_url','address_text') limit 1;
  if v_bad_key is not null then raise exception 'Field is not editable through this workflow: %',v_bad_key; end if;
  v_name_th:=case when p_patch ? 'name_th' then nullif(btrim(p_patch->>'name_th'),'') else v_s.name_th end;
  if v_name_th is null then raise exception 'School Thai name is required'; end if;
  return jsonb_build_object(
    'code',case when p_patch ? 'code' then nullif(btrim(p_patch->>'code'),'') else v_s.code end,
    'name_th',v_name_th,
    'name_en',case when p_patch ? 'name_en' then nullif(btrim(p_patch->>'name_en'),'') else v_s.name_en end,
    'short_name',case when p_patch ? 'short_name' then nullif(btrim(p_patch->>'short_name'),'') else v_s.short_name end,
    'phone',case when p_patch ? 'phone' then nullif(btrim(p_patch->>'phone'),'') else v_s.phone end,
    'email',case when p_patch ? 'email' then nullif(btrim(p_patch->>'email'),'') else v_s.email end,
    'website_url',case when p_patch ? 'website_url' then nullif(btrim(p_patch->>'website_url'),'') else v_s.website_url end,
    'address_text',case when p_patch ? 'address_text' then nullif(btrim(p_patch->>'address_text'),'') else v_s.address_text end
  );
end;
$$;

create or replace function public.lao_apply_school_snapshot(p_school_id uuid,p_snapshot jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.lao_schools set
    code=p_snapshot->>'code',name_th=p_snapshot->>'name_th',name_en=p_snapshot->>'name_en',
    short_name=p_snapshot->>'short_name',phone=p_snapshot->>'phone',email=p_snapshot->>'email',
    website_url=p_snapshot->>'website_url',address_text=p_snapshot->>'address_text'
  where id=p_school_id;
  if not found then raise exception 'School not found'; end if;
end;
$$;

create or replace function public.lao_membership_review_mode(p_membership_id uuid)
returns text language plpgsql stable security definer set search_path=public as $$
declare v_m public.lao_memberships; v_has_admin boolean;
begin
  select * into v_m from public.lao_memberships where id=p_membership_id;
  if not found or v_m.school_id is null then return 'none'; end if;
  v_has_admin:=public.lao_school_has_admin(v_m.school_id);
  if v_m.requested_role_code='school_admin' and not v_has_admin then
    if public.lao_is_platform_admin() then return 'platform_first_admin'; end if;
    return 'view_only';
  end if;
  if public.lao_is_local_school_admin(v_m.school_id) then return 'school_admin'; end if;
  return 'view_only';
end;
$$;

create or replace function public.lao_request_membership(
  p_organization_id uuid,p_school_id uuid,p_requested_role_code text,p_request_note text default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid()); v_id uuid;
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
  v_school_name text; v_has_admin boolean;
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  if not exists(select 1 from public.lao_profiles where user_id=v_uid and status='active') then raise exception 'Profile is required'; end if;
  if not exists(select 1 from public.lao_organizations where id=p_organization_id and is_active) then raise exception 'Invalid organization'; end if;
  select name_th into v_school_name from public.lao_schools
    where id=p_school_id and organization_id=p_organization_id and is_active;
  if v_school_name is null then raise exception 'Invalid school'; end if;
  if p_requested_role_code not in ('school_admin','school_executive','registrar','academic_officer','teacher','staff','student','guardian')
    then raise exception 'Invalid requested role'; end if;
  if exists(select 1 from public.lao_memberships
    where user_id=v_uid and school_id=p_school_id and status in ('pending','active','suspended'))
    then raise exception 'You already have an active or pending membership for this school'; end if;

  insert into public.lao_memberships(user_id,organization_id,school_id,requested_role_code,request_note,status)
  values(v_uid,p_organization_id,p_school_id,p_requested_role_code,nullif(trim(p_request_note),''),'pending')
  returning id into v_id;

  v_has_admin:=public.lao_school_has_admin(p_school_id);
  if p_requested_role_code='school_admin' and not v_has_admin then
    perform public.lao_notify_platform_admins(
      'มีคำขอผู้ดูแลสถานศึกษาคนแรก',
      'มีผู้ใช้ขอเป็นผู้ดูแลคนแรกของ '||v_school_name||' กรุณาตรวจสอบและอนุมัติ',
      'membership',v_id::text,p_organization_id,p_school_id
    );
  elsif v_has_admin then
    perform public.lao_notify_school_admins(
      p_school_id,'membership_request','มีคำขอเข้าใช้งานสถานศึกษา',
      'มีผู้ใช้ส่งคำขอเข้าใช้งาน '||v_school_name,'membership',v_id::text
    );
  end if;

  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(p_organization_id,p_school_id,v_uid,'membership_requested','membership',v_id::text,
    jsonb_build_object('requested_role_code',p_requested_role_code));
  return v_id;
end;
$$;

create or replace function public.lao_review_membership(p_membership_id uuid,p_decision text,p_role_codes text[] default '{}')
returns void language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid()); v_m public.lao_memberships;
  v_platform boolean; v_local_admin boolean; v_has_admin boolean; v_role text;
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
  v_first_admin boolean;
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  select * into v_m from public.lao_memberships where id=p_membership_id;
  if not found then raise exception 'Membership not found'; end if;
  if v_m.school_id is null then raise exception 'School membership required'; end if;
  if p_decision not in ('active','rejected','suspended') then raise exception 'Invalid decision'; end if;

  v_platform:=public.lao_is_platform_admin();
  v_local_admin:=public.lao_is_local_school_admin(v_m.school_id);
  v_has_admin:=public.lao_school_has_admin(v_m.school_id);
  v_first_admin:=(v_m.requested_role_code='school_admin' and not v_has_admin);

  if v_first_admin then
    if not v_platform then raise exception 'Only Platform Admin can approve the first school administrator'; end if;
    if p_decision='active' and not (coalesce(array_length(p_role_codes,1),0)=1 and p_role_codes[1]='school_admin')
      then raise exception 'The first school administrator must receive only the school_admin role'; end if;
  else
    if not v_local_admin then raise exception 'School administrators are responsible for this request'; end if;
  end if;

  if p_decision='active' and coalesce(array_length(p_role_codes,1),0)=0 then raise exception 'At least one role is required'; end if;
  foreach v_role in array coalesce(p_role_codes,'{}'::text[]) loop
    if v_role not in ('school_admin','school_executive','registrar','academic_officer','teacher','staff','student','guardian')
      then raise exception 'Role cannot be granted by the school workflow: %',v_role; end if;
  end loop;

  update public.lao_memberships set status=p_decision,reviewed_at=now(),reviewed_by=v_uid,
    ended_at=case when p_decision='rejected' then now() else null end
  where id=p_membership_id;
  delete from public.lao_membership_roles where membership_id=p_membership_id;
  if p_decision='active' then
    insert into public.lao_membership_roles(membership_id,role_id,granted_by)
    select p_membership_id,id,v_uid from public.lao_roles where code=any(p_role_codes);
  end if;

  if v_first_admin and p_decision='active' then
    insert into public.lao_notifications(user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id)
    values(v_m.user_id,v_m.organization_id,v_m.school_id,'admin_activated','คุณได้รับสิทธิ์ผู้ดูแลสถานศึกษา',
      'คุณเป็นผู้ดูแลสถานศึกษาคนแรก และรับผิดชอบอนุมัติผู้ใช้และผู้ดูแลร่วมของโรงเรียนนี้',
      'membership',p_membership_id::text);

    insert into public.lao_notifications(user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id)
    select distinct v_m.user_id,m.organization_id,m.school_id,'pending_memberships','มีคำขอเข้าใช้งานรอตรวจสอบ',
      'มีคำขอเข้าใช้งานที่ส่งไว้ก่อนแต่งตั้งผู้ดูแล กรุณาตรวจสอบในเมนูผู้ใช้และสิทธิ์',
      'membership',m.id::text
    from public.lao_memberships m
    where m.school_id=v_m.school_id and m.status='pending' and m.id<>p_membership_id;
  end if;

  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(v_m.organization_id,v_m.school_id,v_uid,'membership_reviewed','membership',p_membership_id::text,
    jsonb_build_object('decision',p_decision,'roles',p_role_codes,
      'review_mode',case when v_first_admin then 'platform_first_admin' else 'school_admin' end));
end;
$$;

create or replace function public.lao_propose_school_change(p_school_id uuid,p_patch jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid()); v_s public.lao_schools;
  v_before jsonb; v_after jsonb; v_id uuid;
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if v_uid is null or v_anon or not public.lao_is_platform_admin() then raise exception 'Access denied'; end if;
  select * into v_s from public.lao_schools where id=p_school_id;
  if not found then raise exception 'School not found'; end if;
  if not public.lao_school_has_admin(p_school_id) then
    raise exception 'This school has no School Admin yet. Appoint the first School Admin before submitting change requests';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Reason is required'; end if;
  v_before:=public.lao_school_snapshot(p_school_id,'{}'::jsonb);
  v_after:=public.lao_school_snapshot(p_school_id,p_patch);
  if v_before=v_after then raise exception 'No changes detected'; end if;

  insert into public.lao_change_requests(organization_id,school_id,entity_type,entity_id,before_data,proposed_data,reason,requested_by)
  values(v_s.organization_id,p_school_id,'school',p_school_id::text,v_before,v_after,btrim(p_reason),v_uid)
  returning id into v_id;

  perform public.lao_notify_school_admins(
    p_school_id,'change_request','มีข้อเสนอแก้ไขข้อมูลสถานศึกษา',
    'Platform Admin เสนอแก้ไขข้อมูลของ '||v_s.name_th||' กรุณาตรวจสอบและเลือกรับหรือปฏิเสธ',
    'change_request',v_id::text
  );

  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context)
  values(v_s.organization_id,p_school_id,v_uid,'school_change_proposed','change_request',v_id::text,
    v_before,v_after,jsonb_build_object('reason',btrim(p_reason)));
  return v_id;
end;
$$;

create or replace function public.lao_review_school_change(p_change_request_id uuid,p_decision text,p_review_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid()); v_cr public.lao_change_requests; v_school_name text;
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  select * into v_cr from public.lao_change_requests where id=p_change_request_id for update;
  if not found then raise exception 'Change request not found'; end if;
  if v_cr.status<>'pending' then raise exception 'Change request is no longer pending'; end if;
  if not public.lao_is_local_school_admin(v_cr.school_id) then raise exception 'Only this school''s administrators can review the change'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;

  if p_decision='approved' then perform public.lao_apply_school_snapshot(v_cr.school_id,v_cr.proposed_data); end if;
  update public.lao_change_requests set status=p_decision,reviewed_by=v_uid,reviewed_at=now(),
    review_note=nullif(btrim(p_review_note),''),applied_at=case when p_decision='approved' then now() else null end
  where id=p_change_request_id;

  select name_th into v_school_name from public.lao_schools where id=v_cr.school_id;
  insert into public.lao_notifications(user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id)
  values(v_cr.requested_by,v_cr.organization_id,v_cr.school_id,'change_reviewed',
    case when p_decision='approved' then 'สถานศึกษาอนุมัติการแก้ไข' else 'สถานศึกษาปฏิเสธการแก้ไข' end,
    coalesce(v_school_name,'สถานศึกษา')||' ตรวจสอบข้อเสนอแก้ไขแล้ว','change_request',p_change_request_id::text);

  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context)
  values(v_cr.organization_id,v_cr.school_id,v_uid,'school_change_reviewed','change_request',p_change_request_id::text,
    v_cr.before_data,case when p_decision='approved' then v_cr.proposed_data else v_cr.before_data end,
    jsonb_build_object('decision',p_decision,'review_note',nullif(btrim(p_review_note),'')));
end;
$$;

create or replace function public.lao_emergency_update_school(p_school_id uuid,p_patch jsonb,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid()); v_s public.lao_schools; v_before jsonb; v_after jsonb;
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if v_uid is null or v_anon or not public.lao_is_platform_admin() then raise exception 'Access denied'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Emergency reason is required'; end if;
  select * into v_s from public.lao_schools where id=p_school_id;
  if not found then raise exception 'School not found'; end if;
  v_before:=public.lao_school_snapshot(p_school_id,'{}'::jsonb);
  v_after:=public.lao_school_snapshot(p_school_id,p_patch);
  if v_before=v_after then raise exception 'No changes detected'; end if;
  perform public.lao_apply_school_snapshot(p_school_id,v_after);
  perform public.lao_notify_school_admins(p_school_id,'emergency_change','Platform Admin แก้ไขข้อมูลฉุกเฉิน',
    'มีการแก้ไขข้อมูลของ '||v_s.name_th||' โดยผู้ดูแลแพลตฟอร์ม เหตุผล: '||btrim(p_reason),
    'school',p_school_id::text);
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context)
  values(v_s.organization_id,p_school_id,v_uid,'platform_emergency_school_update','school',p_school_id::text,
    v_before,v_after,jsonb_build_object('reason',btrim(p_reason),'emergency',true));
end;
$$;

create or replace function public.lao_school_admin_update_school(p_school_id uuid,p_patch jsonb,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid()); v_s public.lao_schools; v_before jsonb; v_after jsonb;
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if v_uid is null or v_anon or not public.lao_is_local_school_admin(p_school_id) then raise exception 'Access denied'; end if;
  select * into v_s from public.lao_schools where id=p_school_id;
  if not found then raise exception 'School not found'; end if;
  v_before:=public.lao_school_snapshot(p_school_id,'{}'::jsonb);
  v_after:=public.lao_school_snapshot(p_school_id,p_patch);
  if v_before=v_after then raise exception 'No changes detected'; end if;
  perform public.lao_apply_school_snapshot(p_school_id,v_after);
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,context)
  values(v_s.organization_id,p_school_id,v_uid,'school_admin_school_update','school',p_school_id::text,
    v_before,v_after,jsonb_build_object('reason',nullif(btrim(p_reason),'')));
end;
$$;

drop index if exists public.lao_memberships_user_school_uq;
create unique index lao_memberships_user_school_uq on public.lao_memberships(user_id,school_id)
  where school_id is not null and status in ('pending','active','suspended');

alter table public.lao_change_requests enable row level security;
alter table public.lao_notifications enable row level security;

grant select,insert,update,delete on public.lao_organizations,public.lao_schools to authenticated;
grant select on public.lao_change_requests to authenticated;
grant select on public.lao_notifications to authenticated;
grant update(read_at) on public.lao_notifications to authenticated;

revoke all on function public.lao_is_local_school_admin(uuid) from public,anon;
revoke all on function public.lao_school_has_admin(uuid) from public,anon;
revoke all on function public.lao_membership_review_mode(uuid) from public,anon;
revoke all on function public.lao_propose_school_change(uuid,jsonb,text) from public,anon;
revoke all on function public.lao_review_school_change(uuid,text,text) from public,anon;
revoke all on function public.lao_emergency_update_school(uuid,jsonb,text) from public,anon;
revoke all on function public.lao_school_admin_update_school(uuid,jsonb,text) from public,anon;

grant execute on function public.lao_is_local_school_admin(uuid) to authenticated;
grant execute on function public.lao_school_has_admin(uuid) to authenticated;
grant execute on function public.lao_membership_review_mode(uuid) to authenticated;
grant execute on function public.lao_propose_school_change(uuid,jsonb,text) to authenticated;
grant execute on function public.lao_review_school_change(uuid,text,text) to authenticated;
grant execute on function public.lao_emergency_update_school(uuid,jsonb,text) to authenticated;
grant execute on function public.lao_school_admin_update_school(uuid,jsonb,text) to authenticated;

revoke all on function public.lao_notify_platform_admins(text,text,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.lao_notify_school_admins(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.lao_school_snapshot(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.lao_apply_school_snapshot(uuid,jsonb) from public,anon,authenticated;

drop policy if exists "lao schools school admin update" on public.lao_schools;
create policy "lao schools local admin update" on public.lao_schools
for update to authenticated
using(public.lao_is_local_school_admin(id))
with check(public.lao_is_local_school_admin(id));

drop policy if exists "lao change requests read" on public.lao_change_requests;
create policy "lao change requests read" on public.lao_change_requests
for select to authenticated
using(public.lao_is_platform_admin() or public.lao_is_local_school_admin(school_id));

drop policy if exists "lao notifications own read" on public.lao_notifications;
drop policy if exists "lao notifications own update" on public.lao_notifications;
create policy "lao notifications own read" on public.lao_notifications
for select to authenticated
using(user_id=(select auth.uid()) and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false);
create policy "lao notifications own update" on public.lao_notifications
for update to authenticated
using(user_id=(select auth.uid()) and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false)
with check(user_id=(select auth.uid()) and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false);
