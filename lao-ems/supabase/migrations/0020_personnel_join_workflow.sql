-- Personnel self-join workflow: school link, verified applicant request, scoped review and notifications.

create table if not exists public.lao_personnel_authorities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  personnel_id uuid not null references public.lao_personnel(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  authority_code text not null check (authority_code in ('personnel_head','personnel_officer')),
  can_edit_personnel boolean not null default true,
  can_review_join boolean not null default false,
  is_active boolean not null default true,
  starts_on date,
  ends_on date,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,user_id,authority_code)
);

create index if not exists lao_personnel_authorities_school_idx
  on public.lao_personnel_authorities(school_id,is_active);

drop trigger if exists lao_personnel_authorities_touch on public.lao_personnel_authorities;
create trigger lao_personnel_authorities_touch
before update on public.lao_personnel_authorities
for each row execute function public.lao_touch_updated_at();

alter table public.lao_personnel_authorities enable row level security;
revoke all on public.lao_personnel_authorities from anon,authenticated;

create table if not exists public.lao_personnel_join_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.lao_schools(id) on delete cascade,
  public_token text not null unique,
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists lao_personnel_join_links_touch on public.lao_personnel_join_links;
create trigger lao_personnel_join_links_touch
before update on public.lao_personnel_join_links
for each row execute function public.lao_touch_updated_at();

alter table public.lao_personnel_join_links enable row level security;
revoke all on public.lao_personnel_join_links from anon,authenticated;

create table if not exists public.lao_personnel_join_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  link_id uuid not null references public.lao_personnel_join_links(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  prefix text,
  first_name_th text not null,
  last_name_th text not null,
  phone text,
  applicant_personnel_type text not null
    check (applicant_personnel_type in ('executive','teacher','educational_staff','support_staff','contract_employee','general_employee','other')),
  applicant_position_title text,
  applicant_academic_standing text,
  applicant_note text,
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  review_data jsonb,
  personnel_id uuid references public.lao_personnel(id) on delete set null,
  membership_id uuid references public.lao_memberships(id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lao_personnel_join_requests_pending_user_uq
  on public.lao_personnel_join_requests(school_id,user_id)
  where status='pending_review';

create index if not exists lao_personnel_join_requests_school_status_idx
  on public.lao_personnel_join_requests(school_id,status,submitted_at desc);

drop trigger if exists lao_personnel_join_requests_touch on public.lao_personnel_join_requests;
create trigger lao_personnel_join_requests_touch
before update on public.lao_personnel_join_requests
for each row execute function public.lao_touch_updated_at();

alter table public.lao_personnel_join_requests enable row level security;
revoke all on public.lao_personnel_join_requests from anon,authenticated;

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
as $$
  select public.lao_is_platform_admin()
  or public.lao_is_school_admin(p_school_id)
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
$$;

revoke all on function public.lao_is_personnel_authority(uuid,boolean,boolean) from public,anon;
grant execute on function public.lao_is_personnel_authority(uuid,boolean,boolean) to authenticated;

create or replace function public.lao_can_manage_personnel(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_personnel_authority(p_school_id,false,true);
$$;

revoke all on function public.lao_can_manage_personnel(uuid) from public,anon;
grant execute on function public.lao_can_manage_personnel(uuid) to authenticated;

create or replace function public.lao_can_review_personnel_join(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_personnel_authority(p_school_id,true,false);
$$;

revoke all on function public.lao_can_review_personnel_join(uuid) from public,anon;
grant execute on function public.lao_can_review_personnel_join(uuid) to authenticated;

create or replace function public.lao_can_manage_personnel_intake(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_platform_admin()
  or public.lao_is_school_admin(p_school_id)
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
$$;

revoke all on function public.lao_can_manage_personnel_intake(uuid) from public,anon;
grant execute on function public.lao_can_manage_personnel_intake(uuid) to authenticated;

create or replace function public.lao_public_personnel_join_link(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_link public.lao_personnel_join_links;
  v_school public.lao_schools;
begin
  select * into v_link
  from public.lao_personnel_join_links
  where public_token=nullif(btrim(p_token),'')
  limit 1;

  if not found then
    return jsonb_build_object('valid',false,'reason','not_found');
  end if;

  select * into v_school from public.lao_schools where id=v_link.school_id;

  if not coalesce(v_school.is_active,false) then
    return jsonb_build_object('valid',false,'reason','school_inactive');
  end if;

  return jsonb_build_object(
    'valid',v_link.is_active,
    'reason',case when v_link.is_active then null else 'closed' end,
    'school_id',v_school.id,
    'school_name',v_school.name_th,
    'school_short_name',v_school.short_name
  );
end;
$$;

revoke all on function public.lao_public_personnel_join_link(text) from public;
grant execute on function public.lao_public_personnel_join_link(text) to anon,authenticated;

create or replace function public.lao_personnel_join_settings(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_link public.lao_personnel_join_links;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_personnel_intake(p_school_id) then raise exception 'Access denied'; end if;

  select * into v_link from public.lao_personnel_join_links where school_id=p_school_id;
  if not found then
    return jsonb_build_object(
      'is_active',false,
      'token',null,
      'opened_at',null,
      'closed_at',null,
      'pending_count',(select count(*) from public.lao_personnel_join_requests r where r.school_id=p_school_id and r.status='pending_review')
    );
  end if;

  return jsonb_build_object(
    'is_active',v_link.is_active,
    'token',v_link.public_token,
    'opened_at',v_link.opened_at,
    'closed_at',v_link.closed_at,
    'pending_count',(select count(*) from public.lao_personnel_join_requests r where r.school_id=p_school_id and r.status='pending_review')
  );
end;
$$;

revoke all on function public.lao_personnel_join_settings(uuid) from public,anon;
grant execute on function public.lao_personnel_join_settings(uuid) to authenticated;

create or replace function public.lao_set_personnel_join_open(
  p_school_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_link public.lao_personnel_join_links;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_personnel_intake(p_school_id) then raise exception 'Access denied'; end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  if v_org is null then raise exception 'School not found'; end if;

  insert into public.lao_personnel_join_links(
    school_id,public_token,is_active,created_by,updated_by,opened_at,closed_at
  )
  values(
    p_school_id,
    replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
    p_is_active,
    v_uid,v_uid,
    case when p_is_active then now() else null end,
    case when p_is_active then null else now() end
  )
  on conflict(school_id) do update
  set
    is_active=excluded.is_active,
    updated_by=v_uid,
    opened_at=case when excluded.is_active then now() else public.lao_personnel_join_links.opened_at end,
    closed_at=case when excluded.is_active then null else now() end
  returning * into v_link;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  )
  values(
    v_org,p_school_id,v_uid,
    case when p_is_active then 'personnel_join_opened' else 'personnel_join_closed' end,
    'personnel_join_link',v_link.id::text,
    jsonb_build_object('is_active',v_link.is_active)
  );

  return public.lao_personnel_join_settings(p_school_id);
end;
$$;

revoke all on function public.lao_set_personnel_join_open(uuid,boolean) from public,anon;
grant execute on function public.lao_set_personnel_join_open(uuid,boolean) to authenticated;

create or replace function public.lao_my_personnel_join_request(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := (select auth.uid());
  v_link public.lao_personnel_join_links;
  v_request public.lao_personnel_join_requests;
begin
  if v_uid is null then return null; end if;
  select * into v_link from public.lao_personnel_join_links where public_token=nullif(btrim(p_token),'') limit 1;
  if not found then return null; end if;

  select * into v_request
  from public.lao_personnel_join_requests
  where school_id=v_link.school_id and user_id=v_uid
  order by submitted_at desc
  limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'id',v_request.id,
    'school_id',v_request.school_id,
    'email',v_request.email,
    'prefix',v_request.prefix,
    'first_name_th',v_request.first_name_th,
    'last_name_th',v_request.last_name_th,
    'phone',v_request.phone,
    'personnel_type',v_request.applicant_personnel_type,
    'position_title',v_request.applicant_position_title,
    'academic_standing',v_request.applicant_academic_standing,
    'status',v_request.status,
    'submitted_at',v_request.submitted_at,
    'reviewed_at',v_request.reviewed_at,
    'rejection_reason',v_request.rejection_reason
  );
end;
$$;

revoke all on function public.lao_my_personnel_join_request(text) from public,anon;
grant execute on function public.lao_my_personnel_join_request(text) to authenticated;

create or replace function public.lao_submit_personnel_join_request(
  p_token text,
  p_prefix text default null,
  p_first_name_th text default null,
  p_last_name_th text default null,
  p_phone text default null,
  p_personnel_type text default 'other',
  p_position_title text default null,
  p_academic_standing text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := (select auth.uid());
  v_link public.lao_personnel_join_links;
  v_school public.lao_schools;
  v_org uuid;
  v_email text;
  v_confirmed timestamptz;
  v_request_id uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select lower(email),email_confirmed_at into v_email,v_confirmed
  from auth.users where id=v_uid;

  if v_email is null or v_confirmed is null then
    raise exception 'Email verification required';
  end if;

  select * into v_link
  from public.lao_personnel_join_links
  where public_token=nullif(btrim(p_token),'')
  limit 1;
  if not found then raise exception 'Join link not found'; end if;
  if not v_link.is_active then raise exception 'โรงเรียนปิดรับคำขอผ่านลิงก์นี้แล้ว'; end if;

  select * into v_school from public.lao_schools where id=v_link.school_id and is_active;
  if not found then raise exception 'School is not active'; end if;
  v_org:=v_school.organization_id;

  if exists(
    select 1 from public.lao_memberships
    where user_id=v_uid and school_id=v_link.school_id and status in ('active','pending','suspended')
  ) then
    raise exception 'บัญชีนี้มีข้อมูลการเข้าใช้งานของโรงเรียนนี้อยู่แล้ว';
  end if;

  if exists(
    select 1 from public.lao_personnel_join_requests
    where school_id=v_link.school_id and user_id=v_uid and status='pending_review'
  ) then
    raise exception 'มีคำขอของบัญชีนี้รอตรวจสอบอยู่แล้ว';
  end if;

  if nullif(btrim(p_first_name_th),'') is null or nullif(btrim(p_last_name_th),'') is null then
    raise exception 'กรุณากรอกชื่อและนามสกุล';
  end if;

  if p_personnel_type not in ('executive','teacher','educational_staff','support_staff','contract_employee','general_employee','other') then
    raise exception 'ประเภทบุคลากรไม่ถูกต้อง';
  end if;

  insert into public.lao_profiles(user_id,prefix,first_name_th,last_name_th,display_name,phone,status)
  values(
    v_uid,nullif(btrim(p_prefix),''),btrim(p_first_name_th),btrim(p_last_name_th),
    concat_ws(' ',nullif(btrim(p_prefix),''),btrim(p_first_name_th),btrim(p_last_name_th)),
    nullif(btrim(p_phone),''),'active'
  )
  on conflict(user_id) do update set
    prefix=excluded.prefix,
    first_name_th=excluded.first_name_th,
    last_name_th=excluded.last_name_th,
    display_name=excluded.display_name,
    phone=excluded.phone,
    updated_at=now();

  insert into public.lao_personnel_join_requests(
    school_id,link_id,user_id,email,prefix,first_name_th,last_name_th,phone,
    applicant_personnel_type,applicant_position_title,applicant_academic_standing,applicant_note
  )
  values(
    v_link.school_id,v_link.id,v_uid,v_email,
    nullif(btrim(p_prefix),''),btrim(p_first_name_th),btrim(p_last_name_th),nullif(btrim(p_phone),''),
    p_personnel_type,nullif(btrim(p_position_title),''),nullif(btrim(p_academic_standing),''),nullif(btrim(p_note),'')
  )
  returning id into v_request_id;

  v_name:=concat_ws(' ',nullif(btrim(p_prefix),''),btrim(p_first_name_th),btrim(p_last_name_th));

  insert into public.lao_notifications(
    user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
  )
  select distinct recipient,v_org,v_link.school_id,'personnel_join_request',
    'มีคำขอเข้าร่วมโรงเรียนใหม่',
    v_name||' ส่งคำขอเข้าร่วมทะเบียนบุคลากร กรุณาตรวจสอบข้อมูลก่อนอนุมัติ',
    'personnel_join_request',v_request_id::text
  from (
    select m.user_id as recipient
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.school_id=v_link.school_id and m.status='active' and r.code='school_admin'
    union
    select a.user_id
    from public.lao_personnel_authorities a
    where a.school_id=v_link.school_id and a.is_active and a.can_review_join
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
  ) recipients;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  )
  values(
    v_org,v_link.school_id,v_uid,'personnel_join_requested','personnel_join_request',v_request_id::text,
    jsonb_build_object('email',v_email,'personnel_type',p_personnel_type)
  );

  return jsonb_build_object('id',v_request_id,'status','pending_review','school_name',v_school.name_th);
end;
$$;

revoke all on function public.lao_submit_personnel_join_request(text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.lao_submit_personnel_join_request(text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.lao_personnel_join_requests(
  p_school_id uuid,
  p_status text default 'pending_review'
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_review_personnel_join(p_school_id) then raise exception 'Access denied'; end if;

  select jsonb_build_object(
    'pending_count',(select count(*) from public.lao_personnel_join_requests where school_id=p_school_id and status='pending_review'),
    'items',coalesce(jsonb_agg(item order by (item->>'submitted_at')::timestamptz desc),'[]'::jsonb)
  )
  into v_result
  from (
    select jsonb_build_object(
      'id',r.id,
      'email',r.email,
      'prefix',r.prefix,
      'first_name_th',r.first_name_th,
      'last_name_th',r.last_name_th,
      'full_name',concat_ws(' ',r.prefix,r.first_name_th,r.last_name_th),
      'phone',r.phone,
      'personnel_type',r.applicant_personnel_type,
      'position_title',r.applicant_position_title,
      'academic_standing',r.applicant_academic_standing,
      'applicant_note',r.applicant_note,
      'status',r.status,
      'submitted_at',r.submitted_at,
      'reviewed_at',r.reviewed_at,
      'rejection_reason',r.rejection_reason,
      'possible_matches',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,
          'full_name',concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th),
          'email',p.email,
          'position_title',p.position_title,
          'academic_standing',p.academic_standing
        ) order by
          case when lower(coalesce(p.email,''))=lower(r.email) then 0 else 1 end,
          p.first_name_th,p.last_name_th
        )
        from public.lao_personnel p
        where p.school_id=r.school_id and (
          lower(coalesce(p.email,''))=lower(r.email)
          or (
            lower(btrim(p.first_name_th))=lower(btrim(r.first_name_th))
            and lower(btrim(p.last_name_th))=lower(btrim(r.last_name_th))
          )
        )
      ),'[]'::jsonb)
    ) as item
    from public.lao_personnel_join_requests r
    where r.school_id=p_school_id
      and (p_status is null or p_status='' or r.status=p_status)
  ) q;

  return coalesce(v_result,jsonb_build_object('pending_count',0,'items','[]'::jsonb));
end;
$$;

revoke all on function public.lao_personnel_join_requests(uuid,text) from public,anon;
grant execute on function public.lao_personnel_join_requests(uuid,text) to authenticated;

create or replace function public.lao_personnel_work_counts(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_can_review boolean := false;
  v_can_manage_intake boolean := false;
  v_pending integer := 0;
begin
  if (select auth.uid()) is null or p_school_id is null then
    return jsonb_build_object('can_review',false,'can_manage_intake',false,'pending_join_requests',0);
  end if;

  v_can_review:=public.lao_can_review_personnel_join(p_school_id);
  v_can_manage_intake:=public.lao_can_manage_personnel_intake(p_school_id);

  if v_can_review then
    select count(*) into v_pending
    from public.lao_personnel_join_requests
    where school_id=p_school_id and status='pending_review';
  end if;

  return jsonb_build_object(
    'can_review',v_can_review,
    'can_manage_intake',v_can_manage_intake,
    'pending_join_requests',v_pending
  );
end;
$$;

revoke all on function public.lao_personnel_work_counts(uuid) from public,anon;
grant execute on function public.lao_personnel_work_counts(uuid) to authenticated;

create or replace function public.lao_review_personnel_join_request(
  p_request_id uuid,
  p_decision text,
  p_existing_personnel_id uuid default null,
  p_prefix text default null,
  p_first_name_th text default null,
  p_last_name_th text default null,
  p_phone text default null,
  p_personnel_type text default 'other',
  p_position_title text default null,
  p_academic_standing text default null,
  p_employee_no text default null,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.lao_personnel_join_requests;
  v_org uuid;
  v_personnel_id uuid;
  v_membership_id uuid;
  v_role_code text;
  v_existing_user uuid;
  v_final jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_req from public.lao_personnel_join_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status<>'pending_review' then raise exception 'คำขอนี้ถูกดำเนินการแล้ว'; end if;
  if not public.lao_can_review_personnel_join(v_req.school_id) then raise exception 'Access denied'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;

  select organization_id into v_org from public.lao_schools where id=v_req.school_id;

  if p_decision='rejected' then
    if nullif(btrim(p_rejection_reason),'') is null then
      raise exception 'กรุณาระบุเหตุผลที่ไม่อนุมัติ';
    end if;

    update public.lao_personnel_join_requests
    set status='rejected',reviewed_by=v_uid,reviewed_at=now(),rejection_reason=btrim(p_rejection_reason)
    where id=v_req.id;

    insert into public.lao_notifications(
      user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
    )
    values(
      v_req.user_id,v_org,v_req.school_id,'personnel_join_rejected',
      'คำขอเข้าร่วมโรงเรียนยังไม่ได้รับอนุมัติ',
      btrim(p_rejection_reason),'personnel_join_request',v_req.id::text
    );

    insert into public.lao_audit_logs(
      organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
    )
    values(
      v_org,v_req.school_id,v_uid,'personnel_join_rejected','personnel_join_request',v_req.id::text,
      jsonb_build_object('reason',btrim(p_rejection_reason))
    );

    return jsonb_build_object('id',v_req.id,'status','rejected');
  end if;

  if nullif(btrim(p_first_name_th),'') is null or nullif(btrim(p_last_name_th),'') is null then
    raise exception 'กรุณาตรวจสอบชื่อและนามสกุลก่อนอนุมัติ';
  end if;
  if p_personnel_type not in ('executive','teacher','educational_staff','support_staff','contract_employee','general_employee','other') then
    raise exception 'ประเภทบุคลากรไม่ถูกต้อง';
  end if;

  if p_existing_personnel_id is not null then
    select id into v_personnel_id
    from public.lao_personnel
    where id=p_existing_personnel_id and school_id=v_req.school_id
    for update;
    if v_personnel_id is null then raise exception 'ไม่พบบุคลากรเดิมที่เลือก'; end if;
  else
    select id into v_personnel_id
    from public.lao_personnel
    where school_id=v_req.school_id and email is not null and lower(email)=lower(v_req.email)
    limit 1
    for update;
  end if;

  if v_personnel_id is null then
    insert into public.lao_personnel(
      school_id,prefix,first_name_th,last_name_th,personnel_type,position_title,academic_standing,
      employee_no,email,phone,employment_status,source_type,created_by,updated_by
    )
    values(
      v_req.school_id,nullif(btrim(p_prefix),''),btrim(p_first_name_th),btrim(p_last_name_th),
      p_personnel_type,nullif(btrim(p_position_title),''),nullif(btrim(p_academic_standing),''),
      nullif(btrim(p_employee_no),''),lower(v_req.email),nullif(btrim(p_phone),''),
      'active','account',v_uid,v_uid
    )
    returning id into v_personnel_id;
  else
    update public.lao_personnel
    set
      prefix=nullif(btrim(p_prefix),''),
      first_name_th=btrim(p_first_name_th),
      last_name_th=btrim(p_last_name_th),
      personnel_type=p_personnel_type,
      position_title=nullif(btrim(p_position_title),''),
      academic_standing=nullif(btrim(p_academic_standing),''),
      employee_no=coalesce(nullif(btrim(p_employee_no),''),employee_no),
      email=lower(v_req.email),
      phone=coalesce(nullif(btrim(p_phone),''),phone),
      employment_status='active',
      updated_by=v_uid
    where id=v_personnel_id;
  end if;

  select pa.user_id into v_existing_user
  from public.lao_personnel_accounts pa
  where pa.personnel_id=v_personnel_id;
  if v_existing_user is not null and v_existing_user<>v_req.user_id then
    raise exception 'บุคลากรรายการนี้เชื่อมกับบัญชีอื่นแล้ว';
  end if;

  if exists(
    select 1 from public.lao_personnel_accounts pa
    where pa.school_id=v_req.school_id and pa.user_id=v_req.user_id and pa.personnel_id<>v_personnel_id
  ) then
    raise exception 'บัญชีนี้เชื่อมกับบุคลากรรายการอื่นแล้ว';
  end if;

  insert into public.lao_personnel_accounts(personnel_id,school_id,user_id,linked_by)
  values(v_personnel_id,v_req.school_id,v_req.user_id,v_uid)
  on conflict(personnel_id) do update
  set school_id=excluded.school_id,user_id=excluded.user_id,linked_by=excluded.linked_by,linked_at=now();

  v_role_code:=case p_personnel_type
    when 'executive' then 'school_executive'
    when 'teacher' then 'teacher'
    else 'staff'
  end;

  select id into v_membership_id
  from public.lao_memberships
  where user_id=v_req.user_id and school_id=v_req.school_id
    and status in ('pending','active','suspended')
  order by case status when 'active' then 0 when 'pending' then 1 else 2 end
  limit 1
  for update;

  if v_membership_id is null then
    insert into public.lao_memberships(
      user_id,organization_id,school_id,requested_role_code,status,requested_at,reviewed_at,reviewed_by
    )
    values(
      v_req.user_id,v_org,v_req.school_id,v_role_code,'active',v_req.submitted_at,now(),v_uid
    )
    returning id into v_membership_id;
  else
    update public.lao_memberships
    set requested_role_code=v_role_code,status='active',reviewed_at=now(),reviewed_by=v_uid,ended_at=null
    where id=v_membership_id;
  end if;

  delete from public.lao_membership_roles where membership_id=v_membership_id;
  insert into public.lao_membership_roles(membership_id,role_id,granted_by)
  select v_membership_id,id,v_uid from public.lao_roles where code=v_role_code;

  update public.lao_profiles
  set
    prefix=nullif(btrim(p_prefix),''),
    first_name_th=btrim(p_first_name_th),
    last_name_th=btrim(p_last_name_th),
    display_name=concat_ws(' ',nullif(btrim(p_prefix),''),btrim(p_first_name_th),btrim(p_last_name_th)),
    phone=coalesce(nullif(btrim(p_phone),''),phone),
    status='active',
    updated_at=now()
  where user_id=v_req.user_id;

  v_final:=jsonb_build_object(
    'prefix',nullif(btrim(p_prefix),''),
    'first_name_th',btrim(p_first_name_th),
    'last_name_th',btrim(p_last_name_th),
    'personnel_type',p_personnel_type,
    'position_title',nullif(btrim(p_position_title),''),
    'academic_standing',nullif(btrim(p_academic_standing),''),
    'employee_no',nullif(btrim(p_employee_no),''),
    'role_code',v_role_code
  );

  update public.lao_personnel_join_requests
  set
    status='approved',
    reviewed_by=v_uid,
    reviewed_at=now(),
    rejection_reason=null,
    review_data=v_final,
    personnel_id=v_personnel_id,
    membership_id=v_membership_id
  where id=v_req.id;

  insert into public.lao_notifications(
    user_id,organization_id,school_id,notification_type,title,body,entity_type,entity_id
  )
  values(
    v_req.user_id,v_org,v_req.school_id,'personnel_join_approved',
    'อนุมัติการเข้าร่วมโรงเรียนแล้ว',
    'บัญชีของคุณได้รับอนุมัติและเชื่อมกับทะเบียนบุคลากรแล้ว',
    'personnel_join_request',v_req.id::text
  );

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  )
  values(
    v_org,v_req.school_id,v_uid,'personnel_join_approved','personnel_join_request',v_req.id::text,
    v_final||jsonb_build_object('personnel_id',v_personnel_id,'membership_id',v_membership_id)
  );

  return jsonb_build_object(
    'id',v_req.id,'status','approved',
    'personnel_id',v_personnel_id,'membership_id',v_membership_id
  );
exception
  when unique_violation then
    raise exception 'ข้อมูลอีเมลหรือเลขประจำตัวบุคลากรซ้ำกับทะเบียนที่มีอยู่ กรุณาเลือกเชื่อมกับบุคลากรเดิมหรือตรวจข้อมูลอีกครั้ง';
end;
$$;

revoke all on function public.lao_review_personnel_join_request(uuid,text,uuid,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.lao_review_personnel_join_request(uuid,text,uuid,text,text,text,text,text,text,text,text,text) to authenticated;
