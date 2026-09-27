-- LAO-EMS consolidated foundation schema
-- Target project: ISSQL
-- All LAO-EMS database objects must use the lao_ prefix.
-- This file intentionally avoids changing existing P1/P2/ResearchStat tables.

create extension if not exists pgcrypto;

create table if not exists public.lao_organizations (
  id uuid primary key default gen_random_uuid(),
  code text,
  name_th text not null,
  name_en text,
  organization_type text not null default 'local_government'
    check (organization_type in ('municipality','pao','sao','special_local_government','local_government')),
  phone text,
  email text,
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lao_organizations_code_uq on public.lao_organizations(code) where code is not null;

create table if not exists public.lao_schools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.lao_organizations(id) on delete restrict,
  code text,
  name_th text not null,
  name_en text,
  short_name text,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  education_levels text[] not null default '{}',
  phone text,
  email text,
  website_url text,
  address_text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(slug)
);
create unique index if not exists lao_schools_org_code_uq on public.lao_schools(organization_id,code) where code is not null;
create index if not exists lao_schools_org_idx on public.lao_schools(organization_id);

create table if not exists public.lao_academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  year_be integer not null check (year_be between 2400 and 2800),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,year_be)
);
create index if not exists lao_academic_years_school_idx on public.lao_academic_years(school_id);

create table if not exists public.lao_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  term_no smallint not null check(term_no between 1 and 4),
  name text,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_year_id,term_no)
);
create index if not exists lao_terms_year_idx on public.lao_terms(academic_year_id);

create table if not exists public.lao_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefix text,
  first_name_th text,
  last_name_th text,
  display_name text,
  phone text,
  avatar_drive_file_id text,
  status text not null default 'active' check(status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lao_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_th text not null,
  description text,
  system_role boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.lao_roles(code,name_th,description) values
 ('platform_admin','ผู้ดูแลแพลตฟอร์ม','ดูแลระบบ LAO-EMS ส่วนกลาง'),
 ('organization_admin','ผู้ดูแล อปท.','ดูแลสถานศึกษาและผู้ใช้ในสังกัด'),
 ('organization_viewer','ผู้ดูข้อมูลระดับ อปท.','ดูรายงานและข้อมูลที่ได้รับอนุญาต'),
 ('school_admin','ผู้ดูแลสถานศึกษา','จัดการข้อมูลพื้นฐานและผู้ใช้ของสถานศึกษา'),
 ('school_executive','ผู้บริหารสถานศึกษา','ดูข้อมูลและอนุมัติงานตามสิทธิ์'),
 ('registrar','งานทะเบียน','ดูแลงานทะเบียนและเอกสารการศึกษา'),
 ('academic_officer','งานวิชาการ','ดูแลโครงสร้างวิชาการและการจัดการเรียนรู้'),
 ('teacher','ครู','ใช้งานตามภาระงานและนักเรียนในความรับผิดชอบ'),
 ('staff','บุคลากร','ใช้งานตามงานที่ได้รับมอบหมาย'),
 ('student','นักเรียน','เข้าถึงข้อมูลของตนตามสิทธิ์'),
 ('guardian','ผู้ปกครอง','เข้าถึงข้อมูลบุตรหลานตามสิทธิ์')
on conflict(code) do nothing;

create table if not exists public.lao_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.lao_organizations(id) on delete cascade,
  school_id uuid references public.lao_schools(id) on delete cascade,
  requested_role_code text references public.lao_roles(code),
  request_note text,
  status text not null default 'pending' check(status in ('pending','active','suspended','rejected','ended')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lao_memberships_user_school_uq on public.lao_memberships(user_id,school_id) where school_id is not null and status <> 'ended';
create unique index if not exists lao_memberships_user_org_uq on public.lao_memberships(user_id,organization_id) where school_id is null and status <> 'ended';
create index if not exists lao_memberships_user_idx on public.lao_memberships(user_id);
create index if not exists lao_memberships_org_idx on public.lao_memberships(organization_id);
create index if not exists lao_memberships_school_idx on public.lao_memberships(school_id);
create index if not exists lao_memberships_status_idx on public.lao_memberships(status);

create table if not exists public.lao_membership_roles (
  membership_id uuid not null references public.lao_memberships(id) on delete cascade,
  role_id uuid not null references public.lao_roles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key(membership_id,role_id)
);
create index if not exists lao_membership_roles_role_idx on public.lao_membership_roles(role_id);

create table if not exists public.lao_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.lao_drive_connections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.lao_schools(id) on delete cascade,
  provider text not null default 'google_drive' check(provider='google_drive'),
  google_account_email text,
  root_folder_id text,
  connection_ref text,
  status text not null default 'not_connected' check(status in ('not_connected','pending','connected','error','revoked')),
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lao_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.lao_organizations(id) on delete cascade,
  school_id uuid references public.lao_schools(id) on delete cascade,
  module text not null,
  record_type text,
  record_id text,
  drive_file_id text not null unique,
  drive_parent_id text,
  original_filename text not null,
  mime_type text,
  size_bytes bigint check(size_bytes is null or size_bytes>=0),
  visibility text not null default 'private' check(visibility in ('private','internal','public')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists lao_files_school_module_idx on public.lao_files(school_id,module);
create index if not exists lao_files_record_idx on public.lao_files(record_type,record_id);
create index if not exists lao_files_visibility_idx on public.lao_files(visibility);

create table if not exists public.lao_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.lao_organizations(id) on delete set null,
  school_id uuid references public.lao_schools(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  context jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lao_audit_logs_entity_idx on public.lao_audit_logs(entity_type,entity_id);
create index if not exists lao_audit_logs_school_created_idx on public.lao_audit_logs(school_id,created_at desc);
create index if not exists lao_audit_logs_actor_created_idx on public.lao_audit_logs(actor_user_id,created_at desc);

create or replace function public.lao_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end;
$$;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='lao_organizations_touch') then create trigger lao_organizations_touch before update on public.lao_organizations for each row execute function public.lao_touch_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='lao_schools_touch') then create trigger lao_schools_touch before update on public.lao_schools for each row execute function public.lao_touch_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='lao_academic_years_touch') then create trigger lao_academic_years_touch before update on public.lao_academic_years for each row execute function public.lao_touch_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='lao_terms_touch') then create trigger lao_terms_touch before update on public.lao_terms for each row execute function public.lao_touch_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='lao_profiles_touch') then create trigger lao_profiles_touch before update on public.lao_profiles for each row execute function public.lao_touch_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='lao_memberships_touch') then create trigger lao_memberships_touch before update on public.lao_memberships for each row execute function public.lao_touch_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='lao_drive_connections_touch') then create trigger lao_drive_connections_touch before update on public.lao_drive_connections for each row execute function public.lao_touch_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='lao_files_touch') then create trigger lao_files_touch before update on public.lao_files for each row execute function public.lao_touch_updated_at(); end if;
end $$;

create or replace function public.lao_is_platform_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.lao_platform_admins where user_id=(select auth.uid()))
  or exists(
    select 1 from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid()) and m.status='active' and r.code='platform_admin'
  );
$$;

create or replace function public.lao_is_org_admin(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.lao_is_platform_admin() or exists(
    select 1 from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid()) and m.status='active'
      and m.organization_id=p_organization_id and r.code='organization_admin'
  );
$$;

create or replace function public.lao_can_access_school(p_school_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.lao_is_platform_admin() or exists(
    select 1 from public.lao_schools s
    join public.lao_memberships m on m.organization_id=s.organization_id and (m.school_id is null or m.school_id=s.id)
    where s.id=p_school_id and m.user_id=(select auth.uid()) and m.status='active'
  );
$$;

create or replace function public.lao_is_school_admin(p_school_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.lao_is_platform_admin()
  or exists(select 1 from public.lao_schools s where s.id=p_school_id and public.lao_is_org_admin(s.organization_id))
  or exists(
    select 1 from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid()) and m.status='active' and m.school_id=p_school_id and r.code='school_admin'
  );
$$;

create or replace function public.lao_can_view_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select (select auth.uid())=p_user_id
  or public.lao_is_platform_admin()
  or exists(
    select 1 from public.lao_memberships m
    where m.user_id=p_user_id and m.status<>'ended'
      and (public.lao_is_org_admin(m.organization_id) or (m.school_id is not null and public.lao_is_school_admin(m.school_id)))
  );
$$;

create or replace function public.lao_ensure_profile(
  p_prefix text default null,p_first_name_th text default null,p_last_name_th text default null,
  p_display_name text default null,p_phone text default null
)
returns public.lao_profiles language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=(select auth.uid()); v_row public.lao_profiles; v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  insert into public.lao_profiles(user_id,prefix,first_name_th,last_name_th,display_name,phone)
  values(v_uid,nullif(trim(p_prefix),''),nullif(trim(p_first_name_th),''),nullif(trim(p_last_name_th),''),nullif(trim(p_display_name),''),nullif(trim(p_phone),''))
  on conflict(user_id) do update set
    prefix=coalesce(excluded.prefix,public.lao_profiles.prefix),
    first_name_th=coalesce(excluded.first_name_th,public.lao_profiles.first_name_th),
    last_name_th=coalesce(excluded.last_name_th,public.lao_profiles.last_name_th),
    display_name=coalesce(excluded.display_name,public.lao_profiles.display_name),
    phone=coalesce(excluded.phone,public.lao_profiles.phone),updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.lao_request_membership(
  p_organization_id uuid,p_school_id uuid,p_requested_role_code text,p_request_note text default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=(select auth.uid()); v_id uuid; v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  if not exists(select 1 from public.lao_profiles where user_id=v_uid and status='active') then raise exception 'Profile is required'; end if;
  if not exists(select 1 from public.lao_organizations where id=p_organization_id and is_active) then raise exception 'Invalid organization'; end if;
  if p_school_id is null or not exists(select 1 from public.lao_schools where id=p_school_id and organization_id=p_organization_id and is_active) then raise exception 'Invalid school'; end if;
  if p_requested_role_code not in ('school_executive','registrar','academic_officer','teacher','staff','student','guardian') then raise exception 'Invalid requested role'; end if;
  insert into public.lao_memberships(user_id,organization_id,school_id,requested_role_code,request_note,status)
  values(v_uid,p_organization_id,p_school_id,p_requested_role_code,nullif(trim(p_request_note),''),'pending') returning id into v_id;
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(p_organization_id,p_school_id,v_uid,'membership_requested','membership',v_id::text,jsonb_build_object('requested_role_code',p_requested_role_code));
  return v_id;
end;
$$;

create or replace function public.lao_review_membership(p_membership_id uuid,p_decision text,p_role_codes text[] default '{}')
returns void language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=(select auth.uid()); v_m public.lao_memberships; v_platform boolean; v_org boolean; v_school boolean; v_role text;
  v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if v_uid is null or v_anon then raise exception 'Permanent authentication required'; end if;
  select * into v_m from public.lao_memberships where id=p_membership_id; if not found then raise exception 'Membership not found'; end if;
  v_platform:=public.lao_is_platform_admin(); v_org:=public.lao_is_org_admin(v_m.organization_id); v_school:=v_m.school_id is not null and public.lao_is_school_admin(v_m.school_id);
  if not(v_platform or v_org or v_school) then raise exception 'Access denied'; end if;
  if p_decision not in ('active','rejected','suspended') then raise exception 'Invalid decision'; end if;
  if p_decision='active' and coalesce(array_length(p_role_codes,1),0)=0 then raise exception 'At least one role is required'; end if;
  foreach v_role in array coalesce(p_role_codes,'{}'::text[]) loop
    if not exists(select 1 from public.lao_roles where code=v_role) then raise exception 'Unknown role: %',v_role; end if;
    if v_role='platform_admin' then raise exception 'Platform admin is not a school membership role'; end if;
    if not v_platform and v_role='organization_admin' then raise exception 'Cannot grant elevated role'; end if;
    if not(v_platform or v_org) and v_role='organization_viewer' then raise exception 'Cannot grant organization role'; end if;
  end loop;
  update public.lao_memberships set status=p_decision,reviewed_at=now(),reviewed_by=v_uid,ended_at=case when p_decision='rejected' then now() else null end where id=p_membership_id;
  delete from public.lao_membership_roles where membership_id=p_membership_id;
  if p_decision='active' then
    insert into public.lao_membership_roles(membership_id,role_id,granted_by)
    select p_membership_id,id,v_uid from public.lao_roles where code=any(p_role_codes);
  end if;
  insert into public.lao_audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data)
  values(v_m.organization_id,v_m.school_id,v_uid,'membership_reviewed','membership',p_membership_id::text,jsonb_build_object('decision',p_decision,'roles',p_role_codes));
end;
$$;

create or replace function public.lao_grant_platform_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_anon boolean:=coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false);
begin
  if (select auth.uid()) is null or v_anon or not public.lao_is_platform_admin() then raise exception 'Access denied'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
  insert into public.lao_platform_admins(user_id,granted_by) values(p_user_id,(select auth.uid())) on conflict(user_id) do nothing;
  insert into public.lao_audit_logs(actor_user_id,action,entity_type,entity_id,after_data)
  values((select auth.uid()),'platform_admin_granted','user',p_user_id::text,jsonb_build_object('platform_admin',true));
end;
$$;

alter table public.lao_organizations enable row level security;
alter table public.lao_schools enable row level security;
alter table public.lao_academic_years enable row level security;
alter table public.lao_terms enable row level security;
alter table public.lao_profiles enable row level security;
alter table public.lao_roles enable row level security;
alter table public.lao_memberships enable row level security;
alter table public.lao_membership_roles enable row level security;
alter table public.lao_platform_admins enable row level security;
alter table public.lao_drive_connections enable row level security;
alter table public.lao_files enable row level security;
alter table public.lao_audit_logs enable row level security;

grant select on public.lao_organizations,public.lao_schools to anon,authenticated;
grant select,insert,update,delete on public.lao_academic_years,public.lao_terms to authenticated;
grant select on public.lao_profiles to authenticated;
grant select on public.lao_roles to authenticated;
grant select on public.lao_memberships,public.lao_membership_roles to authenticated;
grant select,insert,update,delete on public.lao_drive_connections,public.lao_files to authenticated;
grant select on public.lao_audit_logs to authenticated;
revoke all on public.lao_platform_admins from anon,authenticated;

revoke all on function public.lao_touch_updated_at() from public,anon,authenticated;
revoke all on function public.lao_is_platform_admin() from public,anon;
revoke all on function public.lao_is_org_admin(uuid) from public,anon;
revoke all on function public.lao_can_access_school(uuid) from public,anon;
revoke all on function public.lao_is_school_admin(uuid) from public,anon;
revoke all on function public.lao_can_view_profile(uuid) from public,anon;
revoke all on function public.lao_ensure_profile(text,text,text,text,text) from public,anon;
revoke all on function public.lao_request_membership(uuid,uuid,text,text) from public,anon;
revoke all on function public.lao_review_membership(uuid,text,text[]) from public,anon;
revoke all on function public.lao_grant_platform_admin(uuid) from public,anon;

grant execute on function public.lao_is_platform_admin() to authenticated;
grant execute on function public.lao_is_org_admin(uuid) to authenticated;
grant execute on function public.lao_can_access_school(uuid) to authenticated;
grant execute on function public.lao_is_school_admin(uuid) to authenticated;
grant execute on function public.lao_can_view_profile(uuid) to authenticated;
grant execute on function public.lao_ensure_profile(text,text,text,text,text) to authenticated;
grant execute on function public.lao_request_membership(uuid,uuid,text,text) to authenticated;
grant execute on function public.lao_review_membership(uuid,text,text[]) to authenticated;
grant execute on function public.lao_grant_platform_admin(uuid) to authenticated;

drop policy if exists "lao organizations anon active read" on public.lao_organizations;
drop policy if exists "lao organizations authenticated read" on public.lao_organizations;
drop policy if exists "lao organizations platform insert" on public.lao_organizations;
drop policy if exists "lao organizations admin update" on public.lao_organizations;
drop policy if exists "lao organizations platform delete" on public.lao_organizations;
create policy "lao organizations anon active read" on public.lao_organizations for select to anon using(is_active);
create policy "lao organizations authenticated read" on public.lao_organizations for select to authenticated using(is_active or public.lao_is_org_admin(id));
create policy "lao organizations platform insert" on public.lao_organizations for insert to authenticated with check(public.lao_is_platform_admin());
create policy "lao organizations admin update" on public.lao_organizations for update to authenticated using(public.lao_is_org_admin(id)) with check(public.lao_is_org_admin(id));
create policy "lao organizations platform delete" on public.lao_organizations for delete to authenticated using(public.lao_is_platform_admin());

drop policy if exists "lao schools anon active read" on public.lao_schools;
drop policy if exists "lao schools authenticated read" on public.lao_schools;
drop policy if exists "lao schools org admin insert" on public.lao_schools;
drop policy if exists "lao schools school admin update" on public.lao_schools;
drop policy if exists "lao schools org admin delete" on public.lao_schools;
create policy "lao schools anon active read" on public.lao_schools for select to anon using(is_active);
create policy "lao schools authenticated read" on public.lao_schools for select to authenticated using(is_active or public.lao_is_org_admin(organization_id));
create policy "lao schools org admin insert" on public.lao_schools for insert to authenticated with check(public.lao_is_org_admin(organization_id));
create policy "lao schools school admin update" on public.lao_schools for update to authenticated using(public.lao_is_school_admin(id)) with check(public.lao_is_org_admin(organization_id) or public.lao_is_school_admin(id));
create policy "lao schools org admin delete" on public.lao_schools for delete to authenticated using(public.lao_is_org_admin(organization_id));

drop policy if exists "lao academic years read" on public.lao_academic_years;
drop policy if exists "lao academic years insert" on public.lao_academic_years;
drop policy if exists "lao academic years update" on public.lao_academic_years;
drop policy if exists "lao academic years delete" on public.lao_academic_years;
create policy "lao academic years read" on public.lao_academic_years for select to authenticated using(public.lao_can_access_school(school_id));
create policy "lao academic years insert" on public.lao_academic_years for insert to authenticated with check(public.lao_is_school_admin(school_id));
create policy "lao academic years update" on public.lao_academic_years for update to authenticated using(public.lao_is_school_admin(school_id)) with check(public.lao_is_school_admin(school_id));
create policy "lao academic years delete" on public.lao_academic_years for delete to authenticated using(public.lao_is_school_admin(school_id));

drop policy if exists "lao terms read" on public.lao_terms;
drop policy if exists "lao terms insert" on public.lao_terms;
drop policy if exists "lao terms update" on public.lao_terms;
drop policy if exists "lao terms delete" on public.lao_terms;
create policy "lao terms read" on public.lao_terms for select to authenticated using(exists(select 1 from public.lao_academic_years y where y.id=academic_year_id and public.lao_can_access_school(y.school_id)));
create policy "lao terms insert" on public.lao_terms for insert to authenticated with check(exists(select 1 from public.lao_academic_years y where y.id=academic_year_id and public.lao_is_school_admin(y.school_id)));
create policy "lao terms update" on public.lao_terms for update to authenticated using(exists(select 1 from public.lao_academic_years y where y.id=academic_year_id and public.lao_is_school_admin(y.school_id))) with check(exists(select 1 from public.lao_academic_years y where y.id=academic_year_id and public.lao_is_school_admin(y.school_id)));
create policy "lao terms delete" on public.lao_terms for delete to authenticated using(exists(select 1 from public.lao_academic_years y where y.id=academic_year_id and public.lao_is_school_admin(y.school_id)));

drop policy if exists "lao profiles read" on public.lao_profiles;
create policy "lao profiles read" on public.lao_profiles for select to authenticated using(public.lao_can_view_profile(user_id));

drop policy if exists "lao roles authenticated read" on public.lao_roles;
create policy "lao roles authenticated read" on public.lao_roles for select to authenticated using(true);

drop policy if exists "lao memberships read" on public.lao_memberships;
create policy "lao memberships read" on public.lao_memberships for select to authenticated using((select auth.uid())=user_id or public.lao_is_org_admin(organization_id) or (school_id is not null and public.lao_is_school_admin(school_id)));

drop policy if exists "lao membership roles read" on public.lao_membership_roles;
create policy "lao membership roles read" on public.lao_membership_roles for select to authenticated using(exists(select 1 from public.lao_memberships m where m.id=membership_id and (m.user_id=(select auth.uid()) or public.lao_is_org_admin(m.organization_id) or (m.school_id is not null and public.lao_is_school_admin(m.school_id)))));

drop policy if exists "lao platform admins self policy" on public.lao_platform_admins;
create policy "lao platform admins self policy" on public.lao_platform_admins for select to authenticated using((select auth.uid())=user_id and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false);

drop policy if exists "lao drive connections read" on public.lao_drive_connections;
drop policy if exists "lao drive connections insert" on public.lao_drive_connections;
drop policy if exists "lao drive connections update" on public.lao_drive_connections;
drop policy if exists "lao drive connections delete" on public.lao_drive_connections;
create policy "lao drive connections read" on public.lao_drive_connections for select to authenticated using(public.lao_is_school_admin(school_id));
create policy "lao drive connections insert" on public.lao_drive_connections for insert to authenticated with check(public.lao_is_school_admin(school_id));
create policy "lao drive connections update" on public.lao_drive_connections for update to authenticated using(public.lao_is_school_admin(school_id)) with check(public.lao_is_school_admin(school_id));
create policy "lao drive connections delete" on public.lao_drive_connections for delete to authenticated using(public.lao_is_school_admin(school_id));

drop policy if exists "lao files public read" on public.lao_files;
drop policy if exists "lao files authenticated read" on public.lao_files;
drop policy if exists "lao files insert" on public.lao_files;
drop policy if exists "lao files update" on public.lao_files;
drop policy if exists "lao files delete" on public.lao_files;
create policy "lao files public read" on public.lao_files for select to anon using(visibility='public' and archived_at is null);
create policy "lao files authenticated read" on public.lao_files for select to authenticated using(archived_at is null and (visibility='public' or (school_id is not null and public.lao_can_access_school(school_id)) or (school_id is null and public.lao_is_org_admin(organization_id))));
create policy "lao files insert" on public.lao_files for insert to authenticated with check(uploaded_by=(select auth.uid()) and ((school_id is not null and public.lao_can_access_school(school_id)) or (school_id is null and public.lao_is_org_admin(organization_id))));
create policy "lao files update" on public.lao_files for update to authenticated using(uploaded_by=(select auth.uid()) or (school_id is not null and public.lao_is_school_admin(school_id)) or (school_id is null and public.lao_is_org_admin(organization_id))) with check((school_id is not null and public.lao_can_access_school(school_id)) or (school_id is null and public.lao_is_org_admin(organization_id)));
create policy "lao files delete" on public.lao_files for delete to authenticated using((school_id is not null and public.lao_is_school_admin(school_id)) or (school_id is null and public.lao_is_org_admin(organization_id)));

drop policy if exists "lao audit admin read" on public.lao_audit_logs;
create policy "lao audit admin read" on public.lao_audit_logs for select to authenticated using(public.lao_is_platform_admin() or (organization_id is not null and public.lao_is_org_admin(organization_id)) or (school_id is not null and public.lao_is_school_admin(school_id)));
