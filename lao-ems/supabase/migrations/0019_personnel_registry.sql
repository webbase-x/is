-- Personnel registry: school master data for administrators, teachers and support staff.

create table if not exists public.lao_personnel (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  prefix text,
  first_name_th text not null,
  last_name_th text not null,
  personnel_type text not null default 'other'
    check (personnel_type in ('executive','teacher','educational_staff','support_staff','contract_employee','general_employee','other')),
  position_title text,
  academic_standing text,
  employee_no text,
  email text,
  phone text,
  employment_status text not null default 'active'
    check (employment_status in ('active','leave','transferred','retired','resigned','ended','other')),
  employment_start_date date,
  employment_end_date date,
  source_type text not null default 'manual'
    check (source_type in ('manual','account','import')),
  notes text,
  sort_order integer,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lao_personnel_school_employee_no_uq
  on public.lao_personnel(school_id,employee_no)
  where employee_no is not null and btrim(employee_no)<>'';

create unique index if not exists lao_personnel_school_email_uq
  on public.lao_personnel(school_id,lower(email))
  where email is not null and btrim(email)<>'';

create index if not exists lao_personnel_school_status_idx
  on public.lao_personnel(school_id,employment_status);

create index if not exists lao_personnel_school_type_idx
  on public.lao_personnel(school_id,personnel_type);

create table if not exists public.lao_personnel_accounts (
  personnel_id uuid primary key references public.lao_personnel(id) on delete cascade,
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  unique(school_id,user_id)
);

create index if not exists lao_personnel_accounts_user_idx
  on public.lao_personnel_accounts(user_id);

drop trigger if exists lao_personnel_touch on public.lao_personnel;
create trigger lao_personnel_touch
before update on public.lao_personnel
for each row execute function public.lao_touch_updated_at();

alter table public.lao_personnel enable row level security;
alter table public.lao_personnel_accounts enable row level security;

revoke all on public.lao_personnel from anon, authenticated;
revoke all on public.lao_personnel_accounts from anon, authenticated;

create or replace function public.lao_can_view_personnel(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_platform_admin()
  or exists(
    select 1
    from public.lao_schools s
    join public.lao_memberships m
      on m.organization_id=s.organization_id
      and (m.school_id is null or m.school_id=s.id)
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where s.id=p_school_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and r.code in (
        'organization_admin','organization_viewer',
        'school_admin','school_executive','registrar','academic_officer','teacher','staff'
      )
  );
$$;

create or replace function public.lao_can_manage_personnel(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_platform_admin()
  or exists(
    select 1
    from public.lao_schools s
    where s.id=p_school_id and public.lao_is_org_admin(s.organization_id)
  )
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id=p_school_id
      and r.code='school_admin'
  );
$$;

revoke all on function public.lao_can_view_personnel(uuid) from public,anon;
revoke all on function public.lao_can_manage_personnel(uuid) from public,anon;
grant execute on function public.lao_can_view_personnel(uuid) to authenticated;
grant execute on function public.lao_can_manage_personnel(uuid) to authenticated;

create or replace function public.lao_personnel_directory(
  p_school_id uuid,
  p_search text default null,
  p_personnel_type text default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_search text := nullif(btrim(p_search),'');
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_can_view_personnel(p_school_id) then
    raise exception 'Access denied';
  end if;

  with filtered as (
    select
      p.id,
      p.prefix,
      p.first_name_th,
      p.last_name_th,
      concat_ws('',p.prefix,p.first_name_th,' ',p.last_name_th) as full_name,
      p.personnel_type,
      p.position_title,
      p.academic_standing,
      p.employee_no,
      p.email,
      p.phone,
      p.employment_status,
      p.employment_start_date,
      p.employment_end_date,
      p.source_type,
      p.sort_order,
      (pa.user_id is not null) as account_linked,
      case
        when pa.user_id is null then null
        else coalesce(
          u.raw_user_meta_data->>'avatar_url',
          u.raw_user_meta_data->>'picture'
        )
      end as avatar_url
    from public.lao_personnel p
    left join public.lao_personnel_accounts pa on pa.personnel_id=p.id
    left join auth.users u on u.id=pa.user_id
    where p.school_id=p_school_id
      and (p_personnel_type is null or p_personnel_type='' or p.personnel_type=p_personnel_type)
      and (p_status is null or p_status='' or p.employment_status=p_status)
      and (
        v_search is null
        or concat_ws(' ',p.prefix,p.first_name_th,p.last_name_th) ilike '%'||v_search||'%'
        or coalesce(p.employee_no,'') ilike '%'||v_search||'%'
        or coalesce(p.position_title,'') ilike '%'||v_search||'%'
        or coalesce(p.academic_standing,'') ilike '%'||v_search||'%'
        or coalesce(p.email,'') ilike '%'||v_search||'%'
        or coalesce(p.phone,'') ilike '%'||v_search||'%'
      )
  )
  select jsonb_build_object(
    'can_manage',public.lao_can_manage_personnel(p_school_id),
    'stats',jsonb_build_object(
      'total',(select count(*) from public.lao_personnel p where p.school_id=p_school_id),
      'active',(select count(*) from public.lao_personnel p where p.school_id=p_school_id and p.employment_status='active'),
      'teachers',(select count(*) from public.lao_personnel p where p.school_id=p_school_id and p.personnel_type='teacher' and p.employment_status='active'),
      'linked_accounts',(select count(*) from public.lao_personnel_accounts pa where pa.school_id=p_school_id)
    ),
    'filters',jsonb_build_object(
      'types',coalesce((
        select jsonb_agg(x.personnel_type order by x.personnel_type)
        from (select distinct personnel_type from public.lao_personnel where school_id=p_school_id) x
      ),'[]'::jsonb),
      'statuses',coalesce((
        select jsonb_agg(x.employment_status order by x.employment_status)
        from (select distinct employment_status from public.lao_personnel where school_id=p_school_id) x
      ),'[]'::jsonb)
    ),
    'total',(select count(*) from filtered),
    'items',coalesce((
      select jsonb_agg(to_jsonb(f) order by
        f.sort_order nulls last,
        case f.personnel_type
          when 'executive' then 1
          when 'teacher' then 2
          when 'educational_staff' then 3
          when 'support_staff' then 4
          when 'contract_employee' then 5
          when 'general_employee' then 6
          else 9
        end,
        f.first_name_th,f.last_name_th
      )
      from filtered f
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.lao_personnel_directory(uuid,text,text,text) from public,anon;
grant execute on function public.lao_personnel_directory(uuid,text,text,text) to authenticated;

create or replace function public.lao_personnel_detail(
  p_school_id uuid,
  p_personnel_id uuid
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
  if p_school_id is null or not public.lao_can_view_personnel(p_school_id) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'id',p.id,
    'school_id',p.school_id,
    'prefix',p.prefix,
    'first_name_th',p.first_name_th,
    'last_name_th',p.last_name_th,
    'full_name',concat_ws('',p.prefix,p.first_name_th,' ',p.last_name_th),
    'personnel_type',p.personnel_type,
    'position_title',p.position_title,
    'academic_standing',p.academic_standing,
    'employee_no',p.employee_no,
    'email',p.email,
    'phone',p.phone,
    'employment_status',p.employment_status,
    'employment_start_date',p.employment_start_date,
    'employment_end_date',p.employment_end_date,
    'source_type',p.source_type,
    'notes',p.notes,
    'sort_order',p.sort_order,
    'account_linked',(pa.user_id is not null),
    'linked_account_email',u.email,
    'avatar_url',case when pa.user_id is null then null else coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture') end,
    'can_manage',public.lao_can_manage_personnel(p_school_id),
    'created_at',p.created_at,
    'updated_at',p.updated_at
  )
  into v_result
  from public.lao_personnel p
  left join public.lao_personnel_accounts pa on pa.personnel_id=p.id
  left join auth.users u on u.id=pa.user_id
  where p.id=p_personnel_id and p.school_id=p_school_id;

  if v_result is null then raise exception 'Personnel not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.lao_personnel_detail(uuid,uuid) from public,anon;
grant execute on function public.lao_personnel_detail(uuid,uuid) to authenticated;

create or replace function public.lao_save_personnel(
  p_school_id uuid,
  p_personnel_id uuid default null,
  p_prefix text default null,
  p_first_name_th text default null,
  p_last_name_th text default null,
  p_personnel_type text default 'other',
  p_position_title text default null,
  p_academic_standing text default null,
  p_employee_no text default null,
  p_email text default null,
  p_phone text default null,
  p_employment_status text default 'active',
  p_employment_start_date date default null,
  p_employment_end_date date default null,
  p_notes text default null,
  p_sort_order integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_email text := nullif(lower(btrim(p_email)),'');
  v_link_user uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_school_id is null or not public.lao_can_manage_personnel(p_school_id) then
    raise exception 'Access denied';
  end if;
  if nullif(btrim(p_first_name_th),'') is null or nullif(btrim(p_last_name_th),'') is null then
    raise exception 'First name and last name are required';
  end if;
  if p_personnel_type not in ('executive','teacher','educational_staff','support_staff','contract_employee','general_employee','other') then
    raise exception 'Invalid personnel type';
  end if;
  if p_employment_status not in ('active','leave','transferred','retired','resigned','ended','other') then
    raise exception 'Invalid employment status';
  end if;
  if p_employment_end_date is not null and p_employment_start_date is not null and p_employment_end_date<p_employment_start_date then
    raise exception 'Employment end date must not be before start date';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  if v_org is null then raise exception 'School not found'; end if;

  if p_personnel_id is null then
    insert into public.lao_personnel(
      school_id,prefix,first_name_th,last_name_th,personnel_type,
      position_title,academic_standing,employee_no,email,phone,
      employment_status,employment_start_date,employment_end_date,
      source_type,notes,sort_order,created_by,updated_by
    )
    values(
      p_school_id,nullif(btrim(p_prefix),''),btrim(p_first_name_th),btrim(p_last_name_th),p_personnel_type,
      nullif(btrim(p_position_title),''),nullif(btrim(p_academic_standing),''),nullif(btrim(p_employee_no),''),
      v_email,nullif(btrim(p_phone),''),
      p_employment_status,p_employment_start_date,p_employment_end_date,
      'manual',nullif(btrim(p_notes),''),p_sort_order,v_uid,v_uid
    )
    returning id into v_id;
    v_before:=null;
  else
    select to_jsonb(p) into v_before
    from public.lao_personnel p
    where p.id=p_personnel_id and p.school_id=p_school_id
    for update;
    if v_before is null then raise exception 'Personnel not found'; end if;

    update public.lao_personnel
    set
      prefix=nullif(btrim(p_prefix),''),
      first_name_th=btrim(p_first_name_th),
      last_name_th=btrim(p_last_name_th),
      personnel_type=p_personnel_type,
      position_title=nullif(btrim(p_position_title),''),
      academic_standing=nullif(btrim(p_academic_standing),''),
      employee_no=nullif(btrim(p_employee_no),''),
      email=v_email,
      phone=nullif(btrim(p_phone),''),
      employment_status=p_employment_status,
      employment_start_date=p_employment_start_date,
      employment_end_date=p_employment_end_date,
      notes=nullif(btrim(p_notes),''),
      sort_order=p_sort_order,
      updated_by=v_uid
    where id=p_personnel_id and school_id=p_school_id
    returning id into v_id;
  end if;

  if v_email is not null then
    select u.id into v_link_user
    from auth.users u
    where lower(u.email)=v_email
      and exists(
        select 1 from public.lao_memberships m
        where m.user_id=u.id and m.school_id=p_school_id and m.status='active'
      )
    limit 1;

    if v_link_user is not null then
      insert into public.lao_personnel_accounts(personnel_id,school_id,user_id,linked_by)
      values(v_id,p_school_id,v_link_user,v_uid)
      on conflict(personnel_id) do update
      set school_id=excluded.school_id,user_id=excluded.user_id,linked_by=excluded.linked_by,linked_at=now();
    end if;
  end if;

  select to_jsonb(p) into v_after from public.lao_personnel p where p.id=v_id;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  )
  values(
    v_org,p_school_id,v_uid,
    case when p_personnel_id is null then 'personnel_created' else 'personnel_updated' end,
    'personnel',v_id::text,v_before,v_after
  );

  return public.lao_personnel_detail(p_school_id,v_id);
exception
  when unique_violation then
    raise exception 'เลขประจำตัวบุคลากรหรืออีเมลนี้มีอยู่ในทะเบียนของโรงเรียนแล้ว';
end;
$$;

revoke all on function public.lao_save_personnel(uuid,uuid,text,text,text,text,text,text,text,text,text,text,date,date,text,integer) from public,anon;
grant execute on function public.lao_save_personnel(uuid,uuid,text,text,text,text,text,text,text,text,text,text,date,date,text,integer) to authenticated;

-- Backfill active school users as starter personnel records without guessing official positions.
insert into public.lao_personnel(
  school_id,prefix,first_name_th,last_name_th,personnel_type,email,phone,
  employment_status,source_type,created_by,updated_by
)
select
  m.school_id,
  p.prefix,
  coalesce(nullif(p.first_name_th,''),split_part(coalesce(u.email,'ผู้ใช้งาน'),'@',1)),
  coalesce(nullif(p.last_name_th,''),'-'),
  case
    when exists(
      select 1 from public.lao_membership_roles mr
      join public.lao_roles r on r.id=mr.role_id
      where mr.membership_id=m.id and r.code='school_executive'
    ) then 'executive'
    when exists(
      select 1 from public.lao_membership_roles mr
      join public.lao_roles r on r.id=mr.role_id
      where mr.membership_id=m.id and r.code='teacher'
    ) then 'teacher'
    when exists(
      select 1 from public.lao_membership_roles mr
      join public.lao_roles r on r.id=mr.role_id
      where mr.membership_id=m.id and r.code='staff'
    ) then 'support_staff'
    else 'other'
  end,
  lower(u.email),
  p.phone,
  'active',
  'account',
  m.user_id,
  m.user_id
from public.lao_memberships m
join auth.users u on u.id=m.user_id
left join public.lao_profiles p on p.user_id=m.user_id
where m.school_id is not null
  and m.status='active'
  and not exists(
    select 1 from public.lao_personnel x
    where x.school_id=m.school_id
      and (
        (x.email is not null and lower(x.email)=lower(u.email))
        or (x.created_by=m.user_id and x.source_type='account')
      )
  );

insert into public.lao_personnel_accounts(personnel_id,school_id,user_id,linked_by)
select p.id,p.school_id,m.user_id,m.user_id
from public.lao_personnel p
join auth.users u on p.email is not null and lower(u.email)=lower(p.email)
join public.lao_memberships m on m.user_id=u.id and m.school_id=p.school_id and m.status='active'
where not exists(select 1 from public.lao_personnel_accounts pa where pa.personnel_id=p.id)
on conflict do nothing;
