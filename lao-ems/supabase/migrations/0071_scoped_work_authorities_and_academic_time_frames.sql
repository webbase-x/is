-- 0071_scoped_work_authorities_and_academic_time_frames.sql
-- Scoped work delegation + multiple annual academic time frames.
-- School-level shared settings are editable only by the local School Admin
-- or users explicitly delegated for the relevant work scope.

begin;

-- ---------------------------------------------------------------------------
-- 1) Generic department / work / section delegation
-- ---------------------------------------------------------------------------

create table if not exists public.lao_work_scopes (
  scope_code text primary key,
  department_code text not null,
  work_code text,
  section_code text,
  title_th text not null,
  parent_scope_code text references public.lao_work_scopes(scope_code) on delete restrict,
  route text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lao_work_authorities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  personnel_id uuid not null references public.lao_personnel(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_code text not null references public.lao_work_scopes(scope_code) on delete restrict,
  authority_role text not null default 'delegate'
    check(authority_role in ('department_head','work_head','delegate')),
  can_view boolean not null default true,
  can_edit boolean not null default false,
  can_approve boolean not null default false,
  can_delegate boolean not null default false,
  is_active boolean not null default true,
  starts_on date,
  ends_on date,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,user_id,scope_code)
);

create index if not exists lao_work_authorities_school_scope_idx
  on public.lao_work_authorities(school_id,scope_code,is_active);
create index if not exists lao_work_authorities_user_idx
  on public.lao_work_authorities(user_id,school_id,is_active);

drop trigger if exists lao_work_scopes_touch on public.lao_work_scopes;
create trigger lao_work_scopes_touch
before update on public.lao_work_scopes
for each row execute function public.lao_touch_updated_at();

drop trigger if exists lao_work_authorities_touch on public.lao_work_authorities;
create trigger lao_work_authorities_touch
before update on public.lao_work_authorities
for each row execute function public.lao_touch_updated_at();

alter table public.lao_work_scopes enable row level security;
alter table public.lao_work_authorities enable row level security;
revoke all on public.lao_work_scopes from public,anon,authenticated;
revoke all on public.lao_work_authorities from public,anon,authenticated;

insert into public.lao_work_scopes(
  scope_code,department_code,work_code,section_code,title_th,parent_scope_code,route,sort_order,is_active
) values
  ('academics','academics',null,null,'ฝ่ายวิชาการ',null,'#/academics',100,true),
  ('academics.basic_settings','academics','basic_settings',null,'ตั้งค่าพื้นฐานงานวิชาการประจำปี','academics','#/academics/periods',110,true),
  ('academics.programs','academics','programs',null,'หลักสูตร / โปรแกรมพิเศษ','academics','#/academics/programs',120,true),
  ('academics.classes','academics','classes',null,'ระดับชั้นและห้องเรียน','academics','#/academics/classes',130,true),
  ('academics.subjects','academics','subjects',null,'โครงสร้างหลักสูตรและเวลาเรียน','academics','#/academics/subjects',140,true),
  ('academics.workload','academics','workload',null,'ภาระงานสอน','academics','#/academics/workload',150,true),
  ('personnel','personnel',null,null,'ฝ่าย / งานบุคลากร',null,'#/personnel',200,true),
  ('personnel.registry','personnel','registry',null,'ทะเบียนบุคลากร','personnel','#/personnel/registry',210,true),
  ('personnel.authorities','personnel','authorities',null,'ผู้รับผิดชอบและการมอบหมายงาน','personnel','#/work-authorities',220,true),
  ('personnel.intake','personnel','intake',null,'รับบุคลากรเข้าระบบ','personnel','#/personnel/intake',230,true),
  ('personnel.requests','personnel','requests',null,'ตรวจคำขอเข้าร่วม','personnel','#/personnel/requests',240,true)
on conflict(scope_code) do update set
  department_code=excluded.department_code,
  work_code=excluded.work_code,
  section_code=excluded.section_code,
  title_th=excluded.title_th,
  parent_scope_code=excluded.parent_scope_code,
  route=excluded.route,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active,
  updated_at=now();

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

  -- School shared data belongs to the school. Platform / organization admin
  -- does not automatically inherit local-school edit authority.
  if public.lao_is_local_school_admin(p_school_id) then
    return true;
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
  v_has_authority boolean:=false;
  v_can_delegate boolean:=false;
begin
  if v_uid is null or p_school_id is null then
    return jsonb_build_object('can_view',false,'can_delegate_any',false,'is_school_admin',false);
  end if;

  v_local_admin:=public.lao_is_local_school_admin(p_school_id);
  select exists(
    select 1 from public.lao_work_authorities a
    where a.school_id=p_school_id and a.user_id=v_uid and a.is_active
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
  ) into v_has_authority;

  select exists(
    select 1 from public.lao_work_authorities a
    where a.school_id=p_school_id and a.user_id=v_uid and a.is_active and a.can_delegate
      and (a.starts_on is null or a.starts_on<=current_date)
      and (a.ends_on is null or a.ends_on>=current_date)
  ) into v_can_delegate;

  return jsonb_build_object(
    'can_view',v_local_admin or v_has_authority,
    'can_delegate_any',v_local_admin or v_can_delegate,
    'is_school_admin',v_local_admin
  );
end;
$function$;

revoke all on function public.lao_my_work_authority_access(uuid) from public,anon;
grant execute on function public.lao_my_work_authority_access(uuid) to authenticated;

create or replace function public.lao_work_authority_matrix(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_local_admin boolean:=false;
  v_can_view boolean:=false;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_local_admin:=public.lao_is_local_school_admin(p_school_id);
  v_can_view:=coalesce((public.lao_my_work_authority_access(p_school_id)->>'can_view')::boolean,false);
  if not v_can_view then raise exception 'Access denied'; end if;

  select jsonb_build_object(
    'can_manage_any',coalesce((public.lao_my_work_authority_access(p_school_id)->>'can_delegate_any')::boolean,false),
    'is_school_admin',v_local_admin,
    'scopes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'scope_code',s.scope_code,
        'department_code',s.department_code,
        'work_code',s.work_code,
        'section_code',s.section_code,
        'title',s.title_th,
        'parent_scope_code',s.parent_scope_code,
        'route',s.route,
        'sort_order',s.sort_order,
        'can_delegate',public.lao_has_work_permission(p_school_id,s.scope_code,'delegate'),
        'can_edit',public.lao_has_work_permission(p_school_id,s.scope_code,'edit'),
        'can_approve',public.lao_has_work_permission(p_school_id,s.scope_code,'approve')
      ) order by s.sort_order,s.scope_code)
      from public.lao_work_scopes s
      where s.is_active
        and (
          v_local_admin
          or public.lao_has_work_permission(p_school_id,s.scope_code,'view')
          or public.lao_has_work_permission(p_school_id,s.scope_code,'delegate')
        )
    ),'[]'::jsonb),
    'authorities',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,
        'scope_code',a.scope_code,
        'scope_title',s.title_th,
        'department_code',s.department_code,
        'authority_role',a.authority_role,
        'can_view',a.can_view,
        'can_edit',a.can_edit,
        'can_approve',a.can_approve,
        'can_delegate',a.can_delegate,
        'is_active',a.is_active,
        'starts_on',a.starts_on,
        'ends_on',a.ends_on,
        'personnel_id',a.personnel_id,
        'user_id',a.user_id,
        'full_name',concat_ws('',p.prefix,p.first_name_th,' ',p.last_name_th),
        'position_title',p.position_title,
        'assigned_by',a.assigned_by,
        'updated_at',a.updated_at
      ) order by s.sort_order,concat_ws(' ',p.first_name_th,p.last_name_th))
      from public.lao_work_authorities a
      join public.lao_work_scopes s on s.scope_code=a.scope_code
      join public.lao_personnel p on p.id=a.personnel_id
      where a.school_id=p_school_id
        and (
          v_local_admin
          or a.user_id=v_uid
          or public.lao_has_work_permission(p_school_id,a.scope_code,'delegate')
        )
    ),'[]'::jsonb),
    'personnel',case when
      v_local_admin or exists(
        select 1 from public.lao_work_authorities x
        where x.school_id=p_school_id and x.user_id=v_uid and x.is_active and x.can_delegate
          and (x.starts_on is null or x.starts_on<=current_date)
          and (x.ends_on is null or x.ends_on>=current_date)
      )
      then coalesce((
        select jsonb_agg(jsonb_build_object(
          'personnel_id',p.id,
          'user_id',pa.user_id,
          'full_name',concat_ws('',p.prefix,p.first_name_th,' ',p.last_name_th),
          'position_title',p.position_title,
          'personnel_type',p.personnel_type
        ) order by coalesce(p.sort_order,999999),p.first_name_th,p.last_name_th)
        from public.lao_personnel p
        join public.lao_personnel_accounts pa on pa.personnel_id=p.id and pa.school_id=p_school_id
        where p.school_id=p_school_id and p.employment_status='active'
      ),'[]'::jsonb)
      else '[]'::jsonb end
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.lao_work_authority_matrix(uuid) from public,anon;
grant execute on function public.lao_work_authority_matrix(uuid) to authenticated;

create or replace function public.lao_save_work_authority(
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
  v_uid uuid:=(select auth.uid());
  v_target_user uuid;
  v_org uuid;
  v_local_admin boolean:=false;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_authority_role not in ('department_head','work_head','delegate') then
    raise exception 'รูปแบบผู้รับผิดชอบไม่ถูกต้อง';
  end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;
  if not exists(select 1 from public.lao_work_scopes where scope_code=p_scope_code and is_active) then
    raise exception 'ไม่พบส่วนงานที่เลือก';
  end if;

  select pa.user_id into v_target_user
  from public.lao_personnel p
  join public.lao_personnel_accounts pa on pa.personnel_id=p.id and pa.school_id=p_school_id
  where p.id=p_personnel_id and p.school_id=p_school_id and p.employment_status='active';
  if v_target_user is null then
    raise exception 'บุคลากรต้องเชื่อมบัญชีผู้ใช้ก่อนจึงจะมอบหมายสิทธิ์ได้';
  end if;

  v_local_admin:=public.lao_is_local_school_admin(p_school_id);
  if not v_local_admin then
    if not public.lao_has_work_permission(p_school_id,p_scope_code,'delegate') then
      raise exception 'ไม่มีสิทธิ์มอบหมายส่วนงานนี้';
    end if;
    if p_authority_role='department_head' then
      raise exception 'หัวหน้าฝ่ายต้องแต่งตั้งโดย School Admin';
    end if;
    if coalesce(p_can_edit,false) and not public.lao_has_work_permission(p_school_id,p_scope_code,'edit') then
      raise exception 'ไม่สามารถมอบสิทธิ์แก้ไขเกินกว่าสิทธิ์ของตนเอง';
    end if;
    if coalesce(p_can_approve,false) and not public.lao_has_work_permission(p_school_id,p_scope_code,'approve') then
      raise exception 'ไม่สามารถมอบสิทธิ์อนุมัติเกินกว่าสิทธิ์ของตนเอง';
    end if;
    if coalesce(p_can_delegate,false) and not public.lao_has_work_permission(p_school_id,p_scope_code,'delegate') then
      raise exception 'ไม่สามารถมอบสิทธิ์มอบหมายต่อเกินกว่าสิทธิ์ของตนเอง';
    end if;
  end if;

  insert into public.lao_work_authorities(
    school_id,personnel_id,user_id,scope_code,authority_role,
    can_view,can_edit,can_approve,can_delegate,is_active,
    starts_on,ends_on,assigned_by
  ) values(
    p_school_id,p_personnel_id,v_target_user,p_scope_code,p_authority_role,
    coalesce(p_can_view,true),coalesce(p_can_edit,false),coalesce(p_can_approve,false),coalesce(p_can_delegate,false),true,
    p_starts_on,p_ends_on,v_uid
  )
  on conflict(school_id,user_id,scope_code) do update set
    personnel_id=excluded.personnel_id,
    authority_role=excluded.authority_role,
    can_view=excluded.can_view,
    can_edit=excluded.can_edit,
    can_approve=excluded.can_approve,
    can_delegate=excluded.can_delegate,
    is_active=true,
    starts_on=excluded.starts_on,
    ends_on=excluded.ends_on,
    assigned_by=v_uid,
    updated_at=now()
  returning id into v_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'work_authority_saved','work_authority',v_id::text,
    jsonb_build_object(
      'personnel_id',p_personnel_id,'user_id',v_target_user,'scope_code',p_scope_code,
      'authority_role',p_authority_role,'can_view',p_can_view,'can_edit',p_can_edit,
      'can_approve',p_can_approve,'can_delegate',p_can_delegate,
      'starts_on',p_starts_on,'ends_on',p_ends_on
    )
  );

  return jsonb_build_object('id',v_id,'scope_code',p_scope_code,'user_id',v_target_user);
end;
$function$;

revoke all on function public.lao_save_work_authority(uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date) from public,anon;
grant execute on function public.lao_save_work_authority(uuid,uuid,text,text,boolean,boolean,boolean,boolean,date,date) to authenticated;

create or replace function public.lao_deactivate_work_authority(
  p_school_id uuid,
  p_authority_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_row public.lao_work_authorities%rowtype;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_row
  from public.lao_work_authorities
  where id=p_authority_id and school_id=p_school_id
  for update;
  if not found then raise exception 'ไม่พบสิทธิ์ที่เลือก'; end if;

  if not public.lao_is_local_school_admin(p_school_id)
     and not public.lao_has_work_permission(p_school_id,v_row.scope_code,'delegate') then
    raise exception 'ไม่มีสิทธิ์ยกเลิกการมอบหมายนี้';
  end if;

  update public.lao_work_authorities
  set is_active=false,ends_on=coalesce(ends_on,current_date),updated_at=now()
  where id=p_authority_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  ) values(
    v_org,p_school_id,v_uid,'work_authority_deactivated','work_authority',p_authority_id::text,
    to_jsonb(v_row),jsonb_build_object('is_active',false,'ends_on',coalesce(v_row.ends_on,current_date))
  );
end;
$function$;

revoke all on function public.lao_deactivate_work_authority(uuid,uuid) from public,anon;
grant execute on function public.lao_deactivate_work_authority(uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1.1) Academic mutation RPCs are wrapped by delegated work scope.
-- A School Admin always has local authority. Everyone else must have an
-- explicit scoped assignment for the section being changed.
-- ---------------------------------------------------------------------------

create or replace function public.lao_can_manage_academic(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_scope text:=nullif(current_setting('app.lao_authorized_academic_scope',true),'');
begin
  if (select auth.uid()) is null then return false; end if;
  if public.lao_is_local_school_admin(p_school_id) then return true; end if;
  if v_scope is null or v_scope not like 'academics%' then return false; end if;
  return public.lao_has_work_permission(p_school_id,v_scope,'edit');
end;
$function$;

revoke all on function public.lao_can_manage_academic(uuid) from public,anon;
grant execute on function public.lao_can_manage_academic(uuid) to authenticated;

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
        ('lao_confirm_curriculum_group','academics.subjects'),
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
      p.oid,
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

    select string_agg('
create table if not exists public.lao_academic_time_frames (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete set null,
  code text not null,
  name_th text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  school_days_per_week smallint not null check(school_days_per_week between 1 and 7),
  periods_per_day numeric(5,2) not null check(periods_per_day>0 and periods_per_day<=20),
  minutes_per_period smallint not null check(minutes_per_period between 20 and 120),
  instructional_weeks_per_year numeric(6,2) not null check(instructional_weeks_per_year>0 and instructional_weeks_per_year<=60),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lao_academic_time_frames_default_program_ck
    check((is_default and program_id is null) or not is_default)
);

create unique index if not exists lao_academic_time_frames_default_uq
  on public.lao_academic_time_frames(school_id,academic_year_id)
  where is_active and is_default;
create unique index if not exists lao_academic_time_frames_program_uq
  on public.lao_academic_time_frames(school_id,academic_year_id,program_id)
  where is_active and program_id is not null;
create unique index if not exists lao_academic_time_frames_code_uq
  on public.lao_academic_time_frames(school_id,academic_year_id,lower(code))
  where is_active;
create index if not exists lao_academic_time_frames_year_idx
  on public.lao_academic_time_frames(school_id,academic_year_id,is_active);

drop trigger if exists lao_academic_time_frames_touch on public.lao_academic_time_frames;
create trigger lao_academic_time_frames_touch
before update on public.lao_academic_time_frames
for each row execute function public.lao_touch_updated_at();

alter table public.lao_academic_time_frames enable row level security;
revoke all on public.lao_academic_time_frames from public,anon,authenticated;

-- Preserve existing one-frame settings as the school's default frame.
insert into public.lao_academic_time_frames(
  school_id,academic_year_id,program_id,code,name_th,is_default,is_active,
  school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year,
  created_by,updated_by,created_at,updated_at
)
select
  s.school_id,s.academic_year_id,null,'NORMAL','ห้องเรียนปกติ',true,true,
  s.school_days_per_week,s.periods_per_day,s.minutes_per_period,s.instructional_weeks_per_year,
  s.created_by,s.updated_by,s.created_at,s.updated_at
from public.lao_academic_schedule_settings s
where not exists(
  select 1 from public.lao_academic_time_frames f
  where f.school_id=s.school_id and f.academic_year_id=s.academic_year_id
    and f.is_default and f.is_active
);

create or replace function public.lao_effective_academic_time_frame(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_row public.lao_academic_time_frames%rowtype;
  v_source text;
begin
  if p_program_id is not null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.school_id=p_school_id
      and f.academic_year_id=p_academic_year_id
      and f.program_id=p_program_id
      and f.is_active
    order by f.updated_at desc
    limit 1;
    if found then v_source:='program'; end if;
  end if;

  if v_row.id is null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.school_id=p_school_id
      and f.academic_year_id=p_academic_year_id
      and f.is_default
      and f.is_active
    order by f.updated_at desc
    limit 1;
    if found then v_source:='default'; end if;
  end if;

  if v_row.id is null then
    return jsonb_build_object('configured',false);
  end if;

  return jsonb_build_object(
    'configured',true,
    'id',v_row.id,
    'code',v_row.code,
    'name_th',v_row.name_th,
    'program_id',v_row.program_id,
    'is_default',v_row.is_default,
    'source',v_source,
    'school_days_per_week',v_row.school_days_per_week,
    'periods_per_day',v_row.periods_per_day,
    'periods_per_week',v_row.school_days_per_week*v_row.periods_per_day,
    'minutes_per_period',v_row.minutes_per_period,
    'instructional_weeks_per_year',v_row.instructional_weeks_per_year,
    'capacity_hours_per_year',
      round(
        v_row.school_days_per_week::numeric
        * v_row.periods_per_day
        * v_row.minutes_per_period::numeric / 60
        * v_row.instructional_weeks_per_year,
        2
      )
  );
end;
$function$;

revoke all on function public.lao_effective_academic_time_frame(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.lao_save_academic_time_frame(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_time_frame_id uuid default null,
  p_name_th text default null,
  p_code text default null,
  p_program_id uuid default null,
  p_is_default boolean default false,
  p_school_days_per_week smallint default 5,
  p_periods_per_day numeric default 6,
  p_minutes_per_period smallint default 60,
  p_instructional_weeks_per_year numeric default 40
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_id uuid;
  v_org uuid;
  v_name text:=nullif(btrim(p_name_th),'');
  v_code text:=upper(regexp_replace(coalesce(nullif(btrim(p_code),''),'FRAME'),'[^A-Za-z0-9_-]+','_','g'));
  v_before jsonb;
  v_row public.lao_academic_time_frames%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_school_days_per_week is null or p_school_days_per_week<1 or p_school_days_per_week>7 then
    raise exception 'จำนวนวันเรียนต่อสัปดาห์ต้องอยู่ระหว่าง 1–7 วัน';
  end if;
  if p_periods_per_day is null or p_periods_per_day<=0 or p_periods_per_day>20 then
    raise exception 'จำนวนคาบเรียนต่อวันไม่ถูกต้อง';
  end if;
  if p_minutes_per_period is null or p_minutes_per_period<20 or p_minutes_per_period>120 then
    raise exception 'จำนวนนาทีต่อคาบต้องอยู่ระหว่าง 20–120 นาที';
  end if;
  if p_instructional_weeks_per_year is null or p_instructional_weeks_per_year<=0 or p_instructional_weeks_per_year>60 then
    raise exception 'จำนวนสัปดาห์เรียนต่อปีไม่ถูกต้อง';
  end if;

  if coalesce(p_is_default,false) then
    if p_program_id is not null then raise exception 'กรอบเริ่มต้นไม่ผูกกับโปรแกรมพิเศษ'; end if;
    if exists(
      select 1 from public.lao_academic_time_frames f
      where f.school_id=p_school_id and f.academic_year_id=p_academic_year_id
        and f.is_active and f.is_default
        and (p_time_frame_id is null or f.id<>p_time_frame_id)
    ) then
      raise exception 'มีกรอบเวลาเริ่มต้นแล้ว กรุณาแก้ไขกรอบเดิม';
    end if;
    v_name:=coalesce(v_name,'ห้องเรียนปกติ');
    v_code:=case when v_code='FRAME' then 'NORMAL' else v_code end;
  else
    if p_program_id is null then
      raise exception 'กรอบเวลาเพิ่มเติมต้องเลือกโปรแกรม / กลุ่มห้องที่ใช้กรอบนี้';
    end if;
    if not exists(
      select 1 from public.lao_academic_programs
      where id=p_program_id and school_id=p_school_id and is_active
    ) then raise exception 'ไม่พบโปรแกรมที่เลือก'; end if;
    if v_name is null then
      select name_th into v_name from public.lao_academic_programs where id=p_program_id;
    end if;
    if v_code='FRAME' then
      select upper(coalesce(nullif(btrim(code),''),'SPECIAL'))
      into v_code from public.lao_academic_programs where id=p_program_id;
    end if;
  end if;
  if v_name is null then raise exception 'กรุณาระบุชื่อกรอบเวลาเรียน'; end if;

  if p_time_frame_id is not null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.id=p_time_frame_id and f.school_id=p_school_id and f.academic_year_id=p_academic_year_id
    for update;
    if v_row.id is null then raise exception 'ไม่พบกรอบเวลาเรียนที่เลือก'; end if;
    v_before:=to_jsonb(v_row);

    update public.lao_academic_time_frames
    set program_id=case when coalesce(p_is_default,false) then null else p_program_id end,
        code=v_code,
        name_th=v_name,
        is_default=coalesce(p_is_default,false),
        is_active=true,
        school_days_per_week=p_school_days_per_week,
        periods_per_day=p_periods_per_day,
        minutes_per_period=p_minutes_per_period,
        instructional_weeks_per_year=p_instructional_weeks_per_year,
        updated_by=v_uid,
        updated_at=now()
    where id=p_time_frame_id
    returning id into v_id;
  else
    insert into public.lao_academic_time_frames(
      school_id,academic_year_id,program_id,code,name_th,is_default,is_active,
      school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year,
      created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,
      case when coalesce(p_is_default,false) then null else p_program_id end,
      v_code,v_name,coalesce(p_is_default,false),true,
      p_school_days_per_week,p_periods_per_day,p_minutes_per_period,p_instructional_weeks_per_year,
      v_uid,v_uid
    ) returning id into v_id;
  end if;

  -- Keep the legacy single-row table synchronized with the default frame.
  if coalesce(p_is_default,false) then
    insert into public.lao_academic_schedule_settings(
      school_id,academic_year_id,school_days_per_week,periods_per_day,
      minutes_per_period,instructional_weeks_per_year,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_school_days_per_week,p_periods_per_day,
      p_minutes_per_period,p_instructional_weeks_per_year,v_uid,v_uid
    )
    on conflict(school_id,academic_year_id) do update set
      school_days_per_week=excluded.school_days_per_week,
      periods_per_day=excluded.periods_per_day,
      minutes_per_period=excluded.minutes_per_period,
      instructional_weeks_per_year=excluded.instructional_weeks_per_year,
      updated_by=v_uid,
      updated_at=now();
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  )
  select
    v_org,p_school_id,v_uid,
    case when p_time_frame_id is null then 'academic_time_frame_created' else 'academic_time_frame_updated' end,
    'academic_time_frame',v_id::text,v_before,to_jsonb(f)
  from public.lao_academic_time_frames f where f.id=v_id;

  return public.lao_effective_academic_time_frame(
    p_school_id,p_academic_year_id,
    case when coalesce(p_is_default,false) then null else p_program_id end
  );
exception
  when unique_violation then
    raise exception 'โปรแกรมหรือรหัสกรอบเวลานี้ถูกกำหนดไว้แล้วในปีการศึกษานี้';
end;
$function$;

revoke all on function public.lao_save_academic_time_frame(uuid,uuid,uuid,text,text,uuid,boolean,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_time_frame(uuid,uuid,uuid,text,text,uuid,boolean,smallint,numeric,smallint,numeric) to authenticated;

create or replace function public.lao_set_academic_time_frame_active(
  p_school_id uuid,
  p_time_frame_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_row public.lao_academic_time_frames%rowtype;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'Access denied';
  end if;

  select * into v_row from public.lao_academic_time_frames
  where id=p_time_frame_id and school_id=p_school_id
  for update;
  if not found then raise exception 'ไม่พบกรอบเวลาเรียนที่เลือก'; end if;
  if v_row.is_default and not coalesce(p_is_active,false) then
    raise exception 'ไม่สามารถปิดกรอบเวลาเริ่มต้นได้ กรุณาแก้ไขค่าแทน';
  end if;

  update public.lao_academic_time_frames
  set is_active=coalesce(p_is_active,false),updated_by=v_uid,updated_at=now()
  where id=p_time_frame_id;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=v_row.academic_year_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  ) values(
    v_org,p_school_id,v_uid,'academic_time_frame_status_changed','academic_time_frame',p_time_frame_id::text,
    to_jsonb(v_row),jsonb_build_object('is_active',coalesce(p_is_active,false))
  );
exception
  when unique_violation then
    raise exception 'โปรแกรมนี้มีกรอบเวลาเรียนที่ใช้งานอยู่แล้ว';
end;
$function$;

revoke all on function public.lao_set_academic_time_frame_active(uuid,uuid,boolean) from public,anon;
grant execute on function public.lao_set_academic_time_frame_active(uuid,uuid,boolean) to authenticated;

-- Compatibility for old clients: saving the legacy settings now writes the default frame too.
create or replace function public.lao_save_academic_schedule_settings(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_school_days_per_week smallint,
  p_periods_per_day numeric,
  p_minutes_per_period smallint,
  p_instructional_weeks_per_year numeric
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_id uuid;
  v_name text;
  v_code text;
begin
  select id,name_th,code into v_id,v_name,v_code
  from public.lao_academic_time_frames
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and is_default and is_active
  order by updated_at desc
  limit 1;

  return public.lao_save_academic_time_frame(
    p_school_id,p_academic_year_id,v_id,
    coalesce(v_name,'ห้องเรียนปกติ'),coalesce(v_code,'NORMAL'),
    null,true,p_school_days_per_week,p_periods_per_day,p_minutes_per_period,p_instructional_weeks_per_year
  );
end;
$function$;

revoke all on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Shared annual academic settings: local School Admin or delegated scope only
-- ---------------------------------------------------------------------------

create or replace function public.lao_save_academic_year(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_year_be integer default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if p_year_be is null or p_year_be<2400 or p_year_be>2800 then raise exception 'ปีการศึกษาไม่ถูกต้อง'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  if v_org is null then raise exception 'School not found'; end if;

  if p_is_current then
    update public.lao_academic_years set is_current=false,updated_at=now()
    where school_id=p_school_id and (p_academic_year_id is null or id<>p_academic_year_id) and is_current;
  end if;

  if p_academic_year_id is null then
    insert into public.lao_academic_years(school_id,year_be,starts_on,ends_on,is_current)
    values(p_school_id,p_year_be,p_starts_on,p_ends_on,p_is_current)
    returning id into v_id;

    insert into public.lao_terms(academic_year_id,term_no,name,is_current)
    values
      (v_id,1,'ภาคเรียนที่ 1',false),
      (v_id,2,'ภาคเรียนที่ 2',false)
    on conflict(academic_year_id,term_no) do nothing;

    v_action:='academic_year_created';
  else
    update public.lao_academic_years
    set year_be=p_year_be,starts_on=p_starts_on,ends_on=p_ends_on,is_current=p_is_current,updated_at=now()
    where id=p_academic_year_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Academic year not found'; end if;
    v_action:='academic_year_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'academic_year',v_id::text,
    jsonb_build_object('year_be',p_year_be,'starts_on',p_starts_on,'ends_on',p_ends_on,'is_current',p_is_current)
  );

  return jsonb_build_object('id',v_id,'year_be',p_year_be);
exception
  when unique_violation then
    raise exception 'มีปีการศึกษา % อยู่แล้ว',p_year_be;
end;
$function$;

create or replace function public.lao_save_term(
  p_school_id uuid,
  p_term_id uuid default null,
  p_academic_year_id uuid default null,
  p_term_no smallint default null,
  p_name text default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_year integer;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if p_term_no is null or p_term_no<1 or p_term_no>4 then raise exception 'ภาคเรียนต้องอยู่ระหว่าง 1–4'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select ay.year_be,s.organization_id into v_year,v_org
  from public.lao_academic_years ay
  join public.lao_schools s on s.id=ay.school_id
  where ay.id=p_academic_year_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'Academic year not found'; end if;

  if p_is_current then
    update public.lao_terms t
    set is_current=false,updated_at=now()
    from public.lao_academic_years ay
    where t.academic_year_id=ay.id and ay.school_id=p_school_id
      and (p_term_id is null or t.id<>p_term_id) and t.is_current;
  end if;

  if p_term_id is null then
    insert into public.lao_terms(academic_year_id,term_no,name,starts_on,ends_on,is_current)
    values(p_academic_year_id,p_term_no,coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),p_starts_on,p_ends_on,p_is_current)
    returning id into v_id;
    v_action:='term_created';
  else
    update public.lao_terms t
    set term_no=p_term_no,
        name=coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),
        starts_on=p_starts_on,
        ends_on=p_ends_on,
        is_current=p_is_current,
        updated_at=now()
    from public.lao_academic_years ay
    where t.id=p_term_id and t.academic_year_id=ay.id and ay.school_id=p_school_id
    returning t.id into v_id;
    if v_id is null then raise exception 'Term not found'; end if;
    v_action:='term_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'term',v_id::text,
    jsonb_build_object('year_be',v_year,'term_no',p_term_no,'name',coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),'is_current',p_is_current)
  );

  return jsonb_build_object('id',v_id,'term_no',p_term_no);
exception
  when unique_violation then
    raise exception 'ปีการศึกษานี้มีภาคเรียนที่ % อยู่แล้ว',p_term_no;
end;
$function$;

revoke all on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) from public,anon;
grant execute on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) to authenticated;
revoke all on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) from public,anon;
grant execute on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) to authenticated;

-- Generic academic mutation gates remain strict. Scoped wrappers below temporarily
-- expose only the delegated section to legacy functions that still call this helper.
create or replace function public.lao_can_manage_academic(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_scope text:=nullif(current_setting('lao.work_scope_override',true),'');
begin
  if public.lao_is_local_school_admin(p_school_id) then
    return true;
  end if;
  if v_scope is null or v_scope<>'academics' and v_scope not like 'academics.%' then
    return false;
  end if;
  return public.lao_has_work_permission(p_school_id,v_scope,'edit')
    or public.lao_has_work_permission(p_school_id,v_scope,'approve');
end;
$function$;

revoke all on function public.lao_can_manage_academic(uuid) from public,anon;
grant execute on function public.lao_can_manage_academic(uuid) to authenticated;

-- Program scope
alter function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer)
  rename to lao_save_academic_program_base_v01914;
revoke all on function public.lao_save_academic_program_base_v01914(uuid,uuid,text,text,text,text,boolean,integer)
  from public,anon,authenticated;

create function public.lao_save_academic_program(
  p_school_id uuid,
  p_program_id uuid default null,
  p_code text default null,
  p_name_th text default null,
  p_name_en text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.programs','edit') then
    raise exception 'ไม่มีสิทธิ์แก้ไขโปรแกรมพิเศษ';
  end if;
  perform set_config('lao.work_scope_override','academics.programs',true);
  return public.lao_save_academic_program_base_v01914(
    p_school_id,p_program_id,p_code,p_name_th,p_name_en,p_description,p_is_active,p_sort_order
  );
end;
$function$;
revoke all on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) from public,anon;
grant execute on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) to authenticated;

-- Class / room scope
alter function public.lao_assign_class_program(uuid,uuid,uuid)
  rename to lao_assign_class_program_base_v01914;
revoke all on function public.lao_assign_class_program_base_v01914(uuid,uuid,uuid)
  from public,anon,authenticated;

create function public.lao_assign_class_program(
  p_school_id uuid,
  p_class_section_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.classes','edit') then
    raise exception 'ไม่มีสิทธิ์แก้ไขระดับชั้นและห้องเรียน';
  end if;
  perform set_config('lao.work_scope_override','academics.classes',true);
  return public.lao_assign_class_program_base_v01914(p_school_id,p_class_section_id,p_program_id);
end;
$function$;
revoke all on function public.lao_assign_class_program(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_assign_class_program(uuid,uuid,uuid) to authenticated;

-- Subject / curriculum scope. Each public mutator keeps its original API but is
-- allowed to enter the legacy implementation only after the exact scope is checked.
alter function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer)
  rename to lao_save_subject_base_v01914;
alter function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb)
  rename to lao_save_curriculum_course_base_v01914;
alter function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text)
  rename to lao_copy_curriculum_group_from_year_base_v01914;
alter function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[])
  rename to lao_create_curriculum_parallel_group_base_v01914;
alter function public.lao_delete_curriculum_parallel_group(uuid,uuid)
  rename to lao_delete_curriculum_parallel_group_base_v01914;
alter function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text)
  rename to lao_update_course_time_override_base_v01914;
alter function public.lao_reset_course_time_to_standard(uuid,uuid)
  rename to lao_reset_course_time_to_standard_base_v01914;
alter function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid)
  rename to lao_adopt_subject_catalog_item_base_v01914;
alter function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid)
  rename to lao_add_curriculum_library_item_base_v01914_delegate;
alter function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid)
  rename to lao_remove_curriculum_item_base_v01914;
alter function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text)
  rename to lao_create_school_subject_and_add_base_v01914;
alter function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer)
  rename to lao_quick_add_curriculum_subject_base_v01914;
alter function public.lao_move_curriculum_course(uuid,uuid,text)
  rename to lao_move_curriculum_course_base_v01914;
alter function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text)
  rename to lao_set_subject_requirement_decision_base_v01914;
alter function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text)
  rename to lao_confirm_curriculum_group_base_v01914;

revoke all on function public.lao_save_subject_base_v01914(uuid,uuid,text,text,text,text,text,boolean,integer) from public,anon,authenticated;
revoke all on function public.lao_save_curriculum_course_base_v01914(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) from public,anon,authenticated;
revoke all on function public.lao_copy_curriculum_group_from_year_base_v01914(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_create_curriculum_parallel_group_base_v01914(uuid,uuid,uuid,text,text,numeric,uuid[]) from public,anon,authenticated;
revoke all on function public.lao_delete_curriculum_parallel_group_base_v01914(uuid,uuid) from public,anon,authenticated;
revoke all on function public.lao_update_course_time_override_base_v01914(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.lao_reset_course_time_to_standard_base_v01914(uuid,uuid) from public,anon,authenticated;
revoke all on function public.lao_adopt_subject_catalog_item_base_v01914(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_add_curriculum_library_item_base_v01914_delegate(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_remove_curriculum_item_base_v01914(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_create_school_subject_and_add_base_v01914(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) from public,anon,authenticated;
revoke all on function public.lao_quick_add_curriculum_subject_base_v01914(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon,authenticated;
revoke all on function public.lao_move_curriculum_course_base_v01914(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_set_subject_requirement_decision_base_v01914(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_confirm_curriculum_group_base_v01914(uuid,uuid,uuid,text) from public,anon,authenticated;

create function public.lao_save_subject(
  p_school_id uuid,p_subject_id uuid default null,p_subject_code text default null,p_name_th text default null,
  p_name_en text default null,p_learning_area text default null,p_subject_type text default 'basic',
  p_is_active boolean default true,p_sort_order integer default 0
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_save_subject_base_v01914(p_school_id,p_subject_id,p_subject_code,p_name_th,p_name_en,p_learning_area,p_subject_type,p_is_active,p_sort_order);
end;$function$;

create function public.lao_save_curriculum_course(
  p_school_id uuid,p_course_id uuid default null,p_academic_year_id uuid default null,p_program_id uuid default null,
  p_grade_code text default null,p_grade_label text default null,p_subject_id uuid default null,p_annual_hours numeric default null,
  p_credits numeric default null,p_notes text default null,p_is_active boolean default true,p_sort_order integer default 0,
  p_term_plans jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขโครงสร้างหลักสูตร'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_save_curriculum_course_base_v01914(p_school_id,p_course_id,p_academic_year_id,p_program_id,p_grade_code,p_grade_label,p_subject_id,p_annual_hours,p_credits,p_notes,p_is_active,p_sort_order,p_term_plans);
end;$function$;

create function public.lao_copy_curriculum_group_from_year(
  p_school_id uuid,p_source_academic_year_id uuid,p_target_academic_year_id uuid,p_program_id uuid,p_grade_code text
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์คัดลอกโครงสร้างรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_copy_curriculum_group_from_year_base_v01914(p_school_id,p_source_academic_year_id,p_target_academic_year_id,p_program_id,p_grade_code);
end;$function$;

create function public.lao_create_curriculum_parallel_group(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_name text,p_weekly_periods numeric,p_course_ids uuid[]
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์จัดกลุ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_create_curriculum_parallel_group_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_name,p_weekly_periods,p_course_ids);
end;$function$;

create function public.lao_delete_curriculum_parallel_group(p_school_id uuid,p_group_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์ยกเลิกกลุ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_delete_curriculum_parallel_group_base_v01914(p_school_id,p_group_id);
end;$function$;

create function public.lao_update_course_time_override(
  p_school_id uuid,p_course_id uuid,p_annual_hours numeric default null,p_term_hours numeric default null,
  p_weekly_periods numeric default null,p_credits numeric default null,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขเวลาเรียนรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_update_course_time_override_base_v01914(p_school_id,p_course_id,p_annual_hours,p_term_hours,p_weekly_periods,p_credits,p_note);
end;$function$;

create function public.lao_reset_course_time_to_standard(p_school_id uuid,p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์คืนค่าเวลาเรียน'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_reset_course_time_to_standard_base_v01914(p_school_id,p_course_id);
end;$function$;

create function public.lao_adopt_subject_catalog_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชาจากคลัง'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_adopt_subject_catalog_item_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_source_kind,p_source_id);
end;$function$;

create function public.lao_add_curriculum_library_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_add_curriculum_library_item_base_v01914_delegate(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_source_kind,p_source_id);
end;$function$;

create function public.lao_remove_curriculum_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_course_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์นำรายวิชาออก'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_remove_curriculum_item_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_course_id);
end;$function$;

create function public.lao_create_school_subject_and_add(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_subject_code text,p_subject_name text,
  p_learning_area text,p_subject_type text,p_subject_subtype text default null,p_aliases text[] default '{}'::text[],
  p_share_to_catalog boolean default true,p_curriculum_version text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์สร้างรายวิชาของโรงเรียน'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_create_school_subject_and_add_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_subject_code,p_subject_name,p_learning_area,p_subject_type,p_subject_subtype,p_aliases,p_share_to_catalog,p_curriculum_version);
end;$function$;

create function public.lao_quick_add_curriculum_subject(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid default null,p_grade_label text default null,
  p_subject_code text default null,p_subject_name text default null,p_learning_area text default null,p_subject_type text default 'basic',
  p_weekly_periods numeric default null,p_annual_hours numeric default null,p_sort_order integer default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_quick_add_curriculum_subject_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_label,p_subject_code,p_subject_name,p_learning_area,p_subject_type,p_weekly_periods,p_annual_hours,p_sort_order);
end;$function$;

create function public.lao_move_curriculum_course(p_school_id uuid,p_course_id uuid,p_direction text)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์จัดลำดับรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_move_curriculum_course_base_v01914(p_school_id,p_course_id,p_direction);
end;$function$;

create function public.lao_set_subject_requirement_decision(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_requirement_key text,p_decision text,
  p_replacement_subject_id uuid default null,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์กำหนดการใช้รายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_set_subject_requirement_decision_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_requirement_key,p_decision,p_replacement_subject_id,p_note);
end;$function$;

create function public.lao_confirm_curriculum_group(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','approve')
     and not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์ยืนยันโครงสร้างหลักสูตร';
  end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_confirm_curriculum_group_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code);
end;$function$;

revoke all on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) from public,anon;
revoke all on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) from public,anon;
revoke all on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) from public,anon;
revoke all on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) from public,anon;
revoke all on function public.lao_delete_curriculum_parallel_group(uuid,uuid) from public,anon;
revoke all on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.lao_reset_course_time_to_standard(uuid,uuid) from public,anon;
revoke all on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) from public,anon;
revoke all on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) from public,anon;
revoke all on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon;
revoke all on function public.lao_move_curriculum_course(uuid,uuid,text) from public,anon;
revoke all on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon;
revoke all on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) from public,anon;

grant execute on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) to authenticated;
grant execute on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) to authenticated;
grant execute on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) to authenticated;
grant execute on function public.lao_delete_curriculum_parallel_group(uuid,uuid) to authenticated;
grant execute on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.lao_reset_course_time_to_standard(uuid,uuid) to authenticated;
grant execute on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) to authenticated;
grant execute on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) to authenticated;
grant execute on function public.lao_move_curriculum_course(uuid,uuid,text) to authenticated;
grant execute on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) to authenticated;
grant execute on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Use the effective frame in curriculum calculations
-- ---------------------------------------------------------------------------

create or replace function public.lao_curriculum_hours_breakdown(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_frame jsonb;
  v_minutes numeric;
  v_weeks numeric;
  v_basic numeric:=0;
  v_activity numeric:=0;
  v_additional numeric:=0;
  v_other numeric:=0;
  v_integrated numeric:=0;
  v_scheduled numeric:=0;
  v_curriculum numeric:=0;
  v_history numeric:=0;
  v_framework public.lao_curriculum_time_frameworks%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_frame:=public.lao_effective_academic_time_frame(p_school_id,p_academic_year_id,p_program_id);
  if coalesce((v_frame->>'configured')::boolean,false) then
    v_minutes:=(v_frame->>'minutes_per_period')::numeric;
    v_weeks:=(v_frame->>'instructional_weeks_per_year')::numeric;
  end if;

  select * into v_framework
  from public.lao_curriculum_time_frameworks
  where curriculum_version='core_2551_2560' and grade_code=p_grade_code;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,
      pg.id as parallel_group_id,
      case
        when c.standard_time_snapshot ? 'time_mode' then coalesce(nullif(c.standard_time_snapshot->>'time_mode',''),'weekly')
        when ct.time_mode is not null then ct.time_mode
        else 'weekly'
      end as time_mode,
      case
        when c.standard_time_snapshot ? 'counts_toward_schedule_total'
          then coalesce((c.standard_time_snapshot->>'counts_toward_schedule_total')::boolean,true)
        when ct.id is not null then ct.counts_toward_schedule_total
        when coalesce(c.standard_time_snapshot->>'time_mode',ct.time_mode,'weekly')='integrated' then false
        else true
      end as counts_schedule,
      case
        when s.subject_type='activity' and nullif(btrim(s.subject_code),'') is not null
          then 'activity|'||lower(btrim(s.subject_code))||'|'||lower(btrim(s.name_th))
        when nullif(btrim(s.subject_code),'') is not null
          then 'code|'||lower(btrim(s.subject_code))
        else 'name|'||s.subject_type||'|'||lower(btrim(s.name_th))
      end as subject_key,
      case when p_program_id is not null and c.program_id=p_program_id then 2 else 1 end as priority
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    left join public.lao_central_subject_time_templates ct on ct.id=c.standard_time_template_id and ct.is_active
    left join public.lao_curriculum_parallel_group_courses pgc on pgc.course_id=c.id
    left join public.lao_curriculum_parallel_groups pg on pg.id=pgc.group_id
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code
      and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null
            and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id
                and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id
                and x.grade_code=p_grade_code
                and x.subject_id=c.subject_id
            )
          )
        ))
      )
  ),
  ranked as (
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.updated_at desc,e.id) as rn
    from eligible e
  ),
  eff0 as (
    select * from ranked where rn=1
  ),
  eff as (
    select e.*,
      coalesce(
        e.annual_hours,
        (select sum(tp.term_hours) from public.lao_course_term_plans tp where tp.course_id=e.id and tp.term_hours is not null),
        case when v_minutes is not null and v_weeks is not null then
          (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id)
          * v_minutes/60*v_weeks
        end,
        0
      ) as course_hours
    from eff0 e
  ),
  slots as (
    select
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end as schedule_key,
      max(course_hours) as slot_hours,
      bool_or(subject_type='basic') as is_basic,
      bool_or(subject_type='activity') as is_activity,
      bool_or(subject_type='additional') as is_additional,
      bool_or(subject_type='other') as is_other,
      bool_and(counts_schedule) as counts_schedule,
      bool_or(time_mode='integrated') as is_integrated,
      bool_or(subject_type='basic' and position('ประวัติศาสตร์' in subject_name)>0) as is_history
    from eff
    group by
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end
  )
  select
    coalesce(sum(slot_hours) filter(where is_basic),0),
    coalesce(sum(slot_hours) filter(where is_activity),0),
    coalesce(sum(slot_hours) filter(where is_additional),0),
    coalesce(sum(slot_hours) filter(where is_other),0),
    coalesce(sum(slot_hours) filter(where is_activity and (is_integrated or not counts_schedule)),0),
    coalesce(sum(slot_hours) filter(where counts_schedule),0),
    coalesce(sum(slot_hours),0),
    coalesce(sum(slot_hours) filter(where is_history),0)
  into v_basic,v_activity,v_additional,v_other,v_integrated,v_scheduled,v_curriculum,v_history
  from slots;

  return jsonb_build_object(
    'basic_hours_total',v_basic,
    'learner_activity_hours_total',v_activity,
    'additional_hours_total',v_additional,
    'other_hours_total',v_other,
    'integrated_activity_hours',v_integrated,
    'scheduled_hours_total',v_scheduled,
    'curriculum_hours_total',v_curriculum,
    'history_hours_total',v_history,
    'time_frame',v_frame,
    'time_framework',case when v_framework.grade_code is null then null else jsonb_build_object(
      'curriculum_version',v_framework.curriculum_version,
      'grade_code',v_framework.grade_code,
      'grade_scope',v_framework.grade_scope,
      'band_code',v_framework.band_code,
      'basic_hours',v_framework.basic_hours,
      'learner_activity_hours',v_framework.learner_activity_hours,
      'history_hours',v_framework.history_hours,
      'overall_max_hours',v_framework.overall_max_hours,
      'overall_rule',v_framework.overall_rule,
      'source_label',v_framework.source_label,
      'source_url',v_framework.source_url,
      'note',v_framework.note,
      'basic_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_basic-v_framework.basic_hours)<0.001 then 'match'
        when v_basic<v_framework.basic_hours then 'below'
        else 'above'
      end,
      'activity_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_activity-v_framework.learner_activity_hours)<0.001 then 'match'
        when v_activity<v_framework.learner_activity_hours then 'below'
        else 'above'
      end,
      'history_status',case
        when v_framework.history_hours is null then 'not_applicable'
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_history-v_framework.history_hours)<0.001 then 'match'
        when v_history<v_framework.history_hours then 'below'
        else 'above'
      end
    ) end
  );
end;
$function$;

create or replace function public.lao_curriculum_group_status(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_hours jsonb;
  v_frame jsonb;
  v_fp text;
  v_weekly numeric:=0;
  v_capacity numeric:=0;
  v_gap numeric:=0;
  v_configured boolean:=false;
  v_confirmed_at timestamptz;
  v_confirmed boolean:=false;
  v_course_count int:=0;
  v_missing int:=0;
  v_mismatch int:=0;
begin
  v_base:=public.lao_curriculum_group_status_base_v0196(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_hours:=public.lao_curriculum_hours_breakdown(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_frame:=public.lao_effective_academic_time_frame(
    p_school_id,p_academic_year_id,p_program_id
  );

  v_configured:=coalesce((v_frame->>'configured')::boolean,false);
  v_weekly:=coalesce((v_base->>'weekly_periods_total')::numeric,0);
  if v_configured then
    v_capacity:=coalesce((v_frame->>'periods_per_week')::numeric,0);
    v_gap:=v_capacity-v_weekly;
  end if;

  v_fp:=md5(
    coalesce(v_base->>'fingerprint','')||'|'||
    coalesce(v_hours::text,'')||'|'||
    coalesce(v_frame::text,'')
  );

  select c.confirmed_at into v_confirmed_at
  from public.lao_curriculum_structure_confirmations c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.program_id is not distinct from p_program_id
    and c.grade_code=p_grade_code
    and c.fingerprint=v_fp
  order by c.confirmed_at desc
  limit 1;
  v_confirmed:=v_confirmed_at is not null;

  v_course_count:=coalesce((v_base->>'course_count')::int,0);
  v_missing:=coalesce((v_base->>'missing_time_count')::int,0);
  v_mismatch:=coalesce((v_base->>'parallel_mismatch_count')::int,0);

  return v_base
    || v_hours
    || jsonb_build_object(
      'annual_hours_total',coalesce((v_hours->>'scheduled_hours_total')::numeric,0),
      'curriculum_recorded_hours_total',coalesce((v_hours->>'curriculum_hours_total')::numeric,0),
      'schedule_configured',v_configured,
      'school_days_per_week',case when v_configured then (v_frame->>'school_days_per_week')::numeric else null end,
      'periods_per_day',case when v_configured then (v_frame->>'periods_per_day')::numeric else null end,
      'minutes_per_period',case when v_configured then (v_frame->>'minutes_per_period')::numeric else null end,
      'instructional_weeks_per_year',case when v_configured then (v_frame->>'instructional_weeks_per_year')::numeric else null end,
      'periods_per_week_capacity',case when v_configured then v_capacity else null end,
      'periods_per_week_gap',case when v_configured then v_gap else null end,
      'time_frame_id',case when v_configured then v_frame->'id' else null end,
      'time_frame_code',case when v_configured then v_frame->'code' else null end,
      'time_frame_name',case when v_configured then v_frame->'name_th' else null end,
      'time_frame_source',case when v_configured then v_frame->'source' else null end,
      'fingerprint',v_fp,
      'is_confirmed',v_confirmed,
      'confirmed_at',v_confirmed_at,
      'is_ready_to_confirm',(
        v_course_count>0 and v_configured and v_missing=0 and v_mismatch=0 and abs(v_gap)<0.001
      ),
      'status',case
        when v_confirmed then 'confirmed'
        when v_course_count=0 then 'empty'
        when not v_configured then 'needs_schedule_settings'
        when v_missing>0 then 'needs_time'
        when v_mismatch>0 then 'parallel_time_mismatch'
        when v_gap>0.001 then 'needs_periods'
        when v_gap< -0.001 then 'over_periods'
        else 'ready_to_confirm'
      end
    );
end;
$function$;

revoke all on function public.lao_curriculum_hours_breakdown(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_hours_breakdown(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Academic structure / annual timeline expose the new settings
-- ---------------------------------------------------------------------------

alter function public.lao_academic_structure(uuid,uuid)
  rename to lao_academic_structure_base_v01914;
revoke all on function public.lao_academic_structure_base_v01914(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_structure(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_base jsonb;
  v_year_id uuid;
  v_frames jsonb:='[]'::jsonb;
  v_default jsonb:=jsonb_build_object('configured',false);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_base:=public.lao_academic_structure_base_v01914(p_school_id,p_academic_year_id);
  v_year_id:=nullif(v_base->>'selected_year_id','')::uuid;

  if v_year_id is not null then
    v_default:=public.lao_effective_academic_time_frame(p_school_id,v_year_id,null);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,
      'code',f.code,
      'name_th',f.name_th,
      'program_id',f.program_id,
      'program_name',p.name_th,
      'is_default',f.is_default,
      'is_active',f.is_active,
      'school_days_per_week',f.school_days_per_week,
      'periods_per_day',f.periods_per_day,
      'periods_per_week',f.school_days_per_week*f.periods_per_day,
      'minutes_per_period',f.minutes_per_period,
      'instructional_weeks_per_year',f.instructional_weeks_per_year,
      'capacity_hours_per_year',round(
        f.school_days_per_week::numeric*f.periods_per_day*f.minutes_per_period::numeric/60*f.instructional_weeks_per_year,2
      ),
      'room_count',case
        when f.is_default then (
          select count(*)::int
          from public.lao_class_sections c
          where c.school_id=p_school_id and c.academic_year_id=v_year_id
            and c.is_active and c.source_type='lec'
            and (
              c.program_id is null
              or not exists(
                select 1 from public.lao_academic_time_frames sf
                where sf.school_id=p_school_id and sf.academic_year_id=v_year_id
                  and sf.program_id=c.program_id and sf.is_active
              )
            )
        )
        else (
          select count(*)::int
          from public.lao_class_sections c
          where c.school_id=p_school_id and c.academic_year_id=v_year_id
            and c.is_active and c.source_type='lec' and c.program_id=f.program_id
        )
      end,
      'updated_at',f.updated_at
    ) order by f.is_default desc,coalesce(p.sort_order,999999),f.name_th),'[]'::jsonb)
    into v_frames
    from public.lao_academic_time_frames f
    left join public.lao_academic_programs p on p.id=f.program_id
    where f.school_id=p_school_id and f.academic_year_id=v_year_id and f.is_active;
  end if;

  return v_base
    ||jsonb_build_object(
      'schedule_settings',v_default,
      'time_frames',v_frames,
      'can_manage_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit'),
      'can_delegate_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','delegate'),
      'can_manage_programs',public.lao_has_work_permission(p_school_id,'academics.programs','edit'),
      'can_manage_classes',public.lao_has_work_permission(p_school_id,'academics.classes','edit'),
      'can_manage_subjects',public.lao_has_work_permission(p_school_id,'academics.subjects','edit'),
      'can_approve_subjects',public.lao_has_work_permission(p_school_id,'academics.subjects','approve'),
      'can_manage_workload',public.lao_has_work_permission(p_school_id,'academics.workload','edit'),
      'can_approve_workload',public.lao_has_work_permission(p_school_id,'academics.workload','approve'),
      'can_manage_any_academic',(
        public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit')
        or public.lao_has_work_permission(p_school_id,'academics.programs','edit')
        or public.lao_has_work_permission(p_school_id,'academics.classes','edit')
        or public.lao_has_work_permission(p_school_id,'academics.subjects','edit')
        or public.lao_has_work_permission(p_school_id,'academics.workload','edit')
      )
    );
end;
$function$;

revoke all on function public.lao_academic_structure(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid) to authenticated;

alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01914;
revoke all on function public.lao_academic_year_setup_timeline_base_v01914(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_year_setup_timeline(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v01914(p_school_id,p_academic_year_id);

  for v_step in
    select value from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
    order by (value->>'sequence_no')::int
  loop
    if v_step->>'step_code'='periods' then
      v_step:=v_step||jsonb_build_object(
        'title','ตั้งค่าพื้นฐานงานวิชาการประจำปี',
        'description','กำหนดปี/ภาคเรียน และกรอบเวลาเรียนเริ่มต้น รวมทั้งกรอบเฉพาะโปรแกรมหรือห้องพิเศษที่ใช้เวลาต่างกัน',
        'route','#/academics/periods'
      );
    end if;
    v_steps:=v_steps||jsonb_build_array(v_step);
  end loop;

  return (v_base-'steps')
    ||jsonb_build_object(
      'steps',v_steps,
      'can_manage_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit')
    );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;

commit;
||g::text,',' order by g)
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
         perform set_config(''app.lao_authorized_academic_scope'',%L,true);
         return public.%I(%s);
       end;
       $fn
create table if not exists public.lao_academic_time_frames (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete set null,
  code text not null,
  name_th text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  school_days_per_week smallint not null check(school_days_per_week between 1 and 7),
  periods_per_day numeric(5,2) not null check(periods_per_day>0 and periods_per_day<=20),
  minutes_per_period smallint not null check(minutes_per_period between 20 and 120),
  instructional_weeks_per_year numeric(6,2) not null check(instructional_weeks_per_year>0 and instructional_weeks_per_year<=60),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lao_academic_time_frames_default_program_ck
    check((is_default and program_id is null) or not is_default)
);

create unique index if not exists lao_academic_time_frames_default_uq
  on public.lao_academic_time_frames(school_id,academic_year_id)
  where is_active and is_default;
create unique index if not exists lao_academic_time_frames_program_uq
  on public.lao_academic_time_frames(school_id,academic_year_id,program_id)
  where is_active and program_id is not null;
create unique index if not exists lao_academic_time_frames_code_uq
  on public.lao_academic_time_frames(school_id,academic_year_id,lower(code))
  where is_active;
create index if not exists lao_academic_time_frames_year_idx
  on public.lao_academic_time_frames(school_id,academic_year_id,is_active);

drop trigger if exists lao_academic_time_frames_touch on public.lao_academic_time_frames;
create trigger lao_academic_time_frames_touch
before update on public.lao_academic_time_frames
for each row execute function public.lao_touch_updated_at();

alter table public.lao_academic_time_frames enable row level security;
revoke all on public.lao_academic_time_frames from public,anon,authenticated;

-- Preserve existing one-frame settings as the school's default frame.
insert into public.lao_academic_time_frames(
  school_id,academic_year_id,program_id,code,name_th,is_default,is_active,
  school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year,
  created_by,updated_by,created_at,updated_at
)
select
  s.school_id,s.academic_year_id,null,'NORMAL','ห้องเรียนปกติ',true,true,
  s.school_days_per_week,s.periods_per_day,s.minutes_per_period,s.instructional_weeks_per_year,
  s.created_by,s.updated_by,s.created_at,s.updated_at
from public.lao_academic_schedule_settings s
where not exists(
  select 1 from public.lao_academic_time_frames f
  where f.school_id=s.school_id and f.academic_year_id=s.academic_year_id
    and f.is_default and f.is_active
);

create or replace function public.lao_effective_academic_time_frame(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_row public.lao_academic_time_frames%rowtype;
  v_source text;
begin
  if p_program_id is not null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.school_id=p_school_id
      and f.academic_year_id=p_academic_year_id
      and f.program_id=p_program_id
      and f.is_active
    order by f.updated_at desc
    limit 1;
    if found then v_source:='program'; end if;
  end if;

  if v_row.id is null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.school_id=p_school_id
      and f.academic_year_id=p_academic_year_id
      and f.is_default
      and f.is_active
    order by f.updated_at desc
    limit 1;
    if found then v_source:='default'; end if;
  end if;

  if v_row.id is null then
    return jsonb_build_object('configured',false);
  end if;

  return jsonb_build_object(
    'configured',true,
    'id',v_row.id,
    'code',v_row.code,
    'name_th',v_row.name_th,
    'program_id',v_row.program_id,
    'is_default',v_row.is_default,
    'source',v_source,
    'school_days_per_week',v_row.school_days_per_week,
    'periods_per_day',v_row.periods_per_day,
    'periods_per_week',v_row.school_days_per_week*v_row.periods_per_day,
    'minutes_per_period',v_row.minutes_per_period,
    'instructional_weeks_per_year',v_row.instructional_weeks_per_year,
    'capacity_hours_per_year',
      round(
        v_row.school_days_per_week::numeric
        * v_row.periods_per_day
        * v_row.minutes_per_period::numeric / 60
        * v_row.instructional_weeks_per_year,
        2
      )
  );
end;
$function$;

revoke all on function public.lao_effective_academic_time_frame(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.lao_save_academic_time_frame(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_time_frame_id uuid default null,
  p_name_th text default null,
  p_code text default null,
  p_program_id uuid default null,
  p_is_default boolean default false,
  p_school_days_per_week smallint default 5,
  p_periods_per_day numeric default 6,
  p_minutes_per_period smallint default 60,
  p_instructional_weeks_per_year numeric default 40
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_id uuid;
  v_org uuid;
  v_name text:=nullif(btrim(p_name_th),'');
  v_code text:=upper(regexp_replace(coalesce(nullif(btrim(p_code),''),'FRAME'),'[^A-Za-z0-9_-]+','_','g'));
  v_before jsonb;
  v_row public.lao_academic_time_frames%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_school_days_per_week is null or p_school_days_per_week<1 or p_school_days_per_week>7 then
    raise exception 'จำนวนวันเรียนต่อสัปดาห์ต้องอยู่ระหว่าง 1–7 วัน';
  end if;
  if p_periods_per_day is null or p_periods_per_day<=0 or p_periods_per_day>20 then
    raise exception 'จำนวนคาบเรียนต่อวันไม่ถูกต้อง';
  end if;
  if p_minutes_per_period is null or p_minutes_per_period<20 or p_minutes_per_period>120 then
    raise exception 'จำนวนนาทีต่อคาบต้องอยู่ระหว่าง 20–120 นาที';
  end if;
  if p_instructional_weeks_per_year is null or p_instructional_weeks_per_year<=0 or p_instructional_weeks_per_year>60 then
    raise exception 'จำนวนสัปดาห์เรียนต่อปีไม่ถูกต้อง';
  end if;

  if coalesce(p_is_default,false) then
    if p_program_id is not null then raise exception 'กรอบเริ่มต้นไม่ผูกกับโปรแกรมพิเศษ'; end if;
    if exists(
      select 1 from public.lao_academic_time_frames f
      where f.school_id=p_school_id and f.academic_year_id=p_academic_year_id
        and f.is_active and f.is_default
        and (p_time_frame_id is null or f.id<>p_time_frame_id)
    ) then
      raise exception 'มีกรอบเวลาเริ่มต้นแล้ว กรุณาแก้ไขกรอบเดิม';
    end if;
    v_name:=coalesce(v_name,'ห้องเรียนปกติ');
    v_code:=case when v_code='FRAME' then 'NORMAL' else v_code end;
  else
    if p_program_id is null then
      raise exception 'กรอบเวลาเพิ่มเติมต้องเลือกโปรแกรม / กลุ่มห้องที่ใช้กรอบนี้';
    end if;
    if not exists(
      select 1 from public.lao_academic_programs
      where id=p_program_id and school_id=p_school_id and is_active
    ) then raise exception 'ไม่พบโปรแกรมที่เลือก'; end if;
    if v_name is null then
      select name_th into v_name from public.lao_academic_programs where id=p_program_id;
    end if;
    if v_code='FRAME' then
      select upper(coalesce(nullif(btrim(code),''),'SPECIAL'))
      into v_code from public.lao_academic_programs where id=p_program_id;
    end if;
  end if;
  if v_name is null then raise exception 'กรุณาระบุชื่อกรอบเวลาเรียน'; end if;

  if p_time_frame_id is not null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.id=p_time_frame_id and f.school_id=p_school_id and f.academic_year_id=p_academic_year_id
    for update;
    if v_row.id is null then raise exception 'ไม่พบกรอบเวลาเรียนที่เลือก'; end if;
    v_before:=to_jsonb(v_row);

    update public.lao_academic_time_frames
    set program_id=case when coalesce(p_is_default,false) then null else p_program_id end,
        code=v_code,
        name_th=v_name,
        is_default=coalesce(p_is_default,false),
        is_active=true,
        school_days_per_week=p_school_days_per_week,
        periods_per_day=p_periods_per_day,
        minutes_per_period=p_minutes_per_period,
        instructional_weeks_per_year=p_instructional_weeks_per_year,
        updated_by=v_uid,
        updated_at=now()
    where id=p_time_frame_id
    returning id into v_id;
  else
    insert into public.lao_academic_time_frames(
      school_id,academic_year_id,program_id,code,name_th,is_default,is_active,
      school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year,
      created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,
      case when coalesce(p_is_default,false) then null else p_program_id end,
      v_code,v_name,coalesce(p_is_default,false),true,
      p_school_days_per_week,p_periods_per_day,p_minutes_per_period,p_instructional_weeks_per_year,
      v_uid,v_uid
    ) returning id into v_id;
  end if;

  -- Keep the legacy single-row table synchronized with the default frame.
  if coalesce(p_is_default,false) then
    insert into public.lao_academic_schedule_settings(
      school_id,academic_year_id,school_days_per_week,periods_per_day,
      minutes_per_period,instructional_weeks_per_year,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_school_days_per_week,p_periods_per_day,
      p_minutes_per_period,p_instructional_weeks_per_year,v_uid,v_uid
    )
    on conflict(school_id,academic_year_id) do update set
      school_days_per_week=excluded.school_days_per_week,
      periods_per_day=excluded.periods_per_day,
      minutes_per_period=excluded.minutes_per_period,
      instructional_weeks_per_year=excluded.instructional_weeks_per_year,
      updated_by=v_uid,
      updated_at=now();
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  )
  select
    v_org,p_school_id,v_uid,
    case when p_time_frame_id is null then 'academic_time_frame_created' else 'academic_time_frame_updated' end,
    'academic_time_frame',v_id::text,v_before,to_jsonb(f)
  from public.lao_academic_time_frames f where f.id=v_id;

  return public.lao_effective_academic_time_frame(
    p_school_id,p_academic_year_id,
    case when coalesce(p_is_default,false) then null else p_program_id end
  );
exception
  when unique_violation then
    raise exception 'โปรแกรมหรือรหัสกรอบเวลานี้ถูกกำหนดไว้แล้วในปีการศึกษานี้';
end;
$function$;

revoke all on function public.lao_save_academic_time_frame(uuid,uuid,uuid,text,text,uuid,boolean,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_time_frame(uuid,uuid,uuid,text,text,uuid,boolean,smallint,numeric,smallint,numeric) to authenticated;

create or replace function public.lao_set_academic_time_frame_active(
  p_school_id uuid,
  p_time_frame_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_row public.lao_academic_time_frames%rowtype;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'Access denied';
  end if;

  select * into v_row from public.lao_academic_time_frames
  where id=p_time_frame_id and school_id=p_school_id
  for update;
  if not found then raise exception 'ไม่พบกรอบเวลาเรียนที่เลือก'; end if;
  if v_row.is_default and not coalesce(p_is_active,false) then
    raise exception 'ไม่สามารถปิดกรอบเวลาเริ่มต้นได้ กรุณาแก้ไขค่าแทน';
  end if;

  update public.lao_academic_time_frames
  set is_active=coalesce(p_is_active,false),updated_by=v_uid,updated_at=now()
  where id=p_time_frame_id;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=v_row.academic_year_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  ) values(
    v_org,p_school_id,v_uid,'academic_time_frame_status_changed','academic_time_frame',p_time_frame_id::text,
    to_jsonb(v_row),jsonb_build_object('is_active',coalesce(p_is_active,false))
  );
exception
  when unique_violation then
    raise exception 'โปรแกรมนี้มีกรอบเวลาเรียนที่ใช้งานอยู่แล้ว';
end;
$function$;

revoke all on function public.lao_set_academic_time_frame_active(uuid,uuid,boolean) from public,anon;
grant execute on function public.lao_set_academic_time_frame_active(uuid,uuid,boolean) to authenticated;

-- Compatibility for old clients: saving the legacy settings now writes the default frame too.
create or replace function public.lao_save_academic_schedule_settings(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_school_days_per_week smallint,
  p_periods_per_day numeric,
  p_minutes_per_period smallint,
  p_instructional_weeks_per_year numeric
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_id uuid;
  v_name text;
  v_code text;
begin
  select id,name_th,code into v_id,v_name,v_code
  from public.lao_academic_time_frames
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and is_default and is_active
  order by updated_at desc
  limit 1;

  return public.lao_save_academic_time_frame(
    p_school_id,p_academic_year_id,v_id,
    coalesce(v_name,'ห้องเรียนปกติ'),coalesce(v_code,'NORMAL'),
    null,true,p_school_days_per_week,p_periods_per_day,p_minutes_per_period,p_instructional_weeks_per_year
  );
end;
$function$;

revoke all on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Shared annual academic settings: local School Admin or delegated scope only
-- ---------------------------------------------------------------------------

create or replace function public.lao_save_academic_year(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_year_be integer default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if p_year_be is null or p_year_be<2400 or p_year_be>2800 then raise exception 'ปีการศึกษาไม่ถูกต้อง'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  if v_org is null then raise exception 'School not found'; end if;

  if p_is_current then
    update public.lao_academic_years set is_current=false,updated_at=now()
    where school_id=p_school_id and (p_academic_year_id is null or id<>p_academic_year_id) and is_current;
  end if;

  if p_academic_year_id is null then
    insert into public.lao_academic_years(school_id,year_be,starts_on,ends_on,is_current)
    values(p_school_id,p_year_be,p_starts_on,p_ends_on,p_is_current)
    returning id into v_id;

    insert into public.lao_terms(academic_year_id,term_no,name,is_current)
    values
      (v_id,1,'ภาคเรียนที่ 1',false),
      (v_id,2,'ภาคเรียนที่ 2',false)
    on conflict(academic_year_id,term_no) do nothing;

    v_action:='academic_year_created';
  else
    update public.lao_academic_years
    set year_be=p_year_be,starts_on=p_starts_on,ends_on=p_ends_on,is_current=p_is_current,updated_at=now()
    where id=p_academic_year_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Academic year not found'; end if;
    v_action:='academic_year_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'academic_year',v_id::text,
    jsonb_build_object('year_be',p_year_be,'starts_on',p_starts_on,'ends_on',p_ends_on,'is_current',p_is_current)
  );

  return jsonb_build_object('id',v_id,'year_be',p_year_be);
exception
  when unique_violation then
    raise exception 'มีปีการศึกษา % อยู่แล้ว',p_year_be;
end;
$function$;

create or replace function public.lao_save_term(
  p_school_id uuid,
  p_term_id uuid default null,
  p_academic_year_id uuid default null,
  p_term_no smallint default null,
  p_name text default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_year integer;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if p_term_no is null or p_term_no<1 or p_term_no>4 then raise exception 'ภาคเรียนต้องอยู่ระหว่าง 1–4'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select ay.year_be,s.organization_id into v_year,v_org
  from public.lao_academic_years ay
  join public.lao_schools s on s.id=ay.school_id
  where ay.id=p_academic_year_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'Academic year not found'; end if;

  if p_is_current then
    update public.lao_terms t
    set is_current=false,updated_at=now()
    from public.lao_academic_years ay
    where t.academic_year_id=ay.id and ay.school_id=p_school_id
      and (p_term_id is null or t.id<>p_term_id) and t.is_current;
  end if;

  if p_term_id is null then
    insert into public.lao_terms(academic_year_id,term_no,name,starts_on,ends_on,is_current)
    values(p_academic_year_id,p_term_no,coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),p_starts_on,p_ends_on,p_is_current)
    returning id into v_id;
    v_action:='term_created';
  else
    update public.lao_terms t
    set term_no=p_term_no,
        name=coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),
        starts_on=p_starts_on,
        ends_on=p_ends_on,
        is_current=p_is_current,
        updated_at=now()
    from public.lao_academic_years ay
    where t.id=p_term_id and t.academic_year_id=ay.id and ay.school_id=p_school_id
    returning t.id into v_id;
    if v_id is null then raise exception 'Term not found'; end if;
    v_action:='term_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'term',v_id::text,
    jsonb_build_object('year_be',v_year,'term_no',p_term_no,'name',coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),'is_current',p_is_current)
  );

  return jsonb_build_object('id',v_id,'term_no',p_term_no);
exception
  when unique_violation then
    raise exception 'ปีการศึกษานี้มีภาคเรียนที่ % อยู่แล้ว',p_term_no;
end;
$function$;

revoke all on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) from public,anon;
grant execute on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) to authenticated;
revoke all on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) from public,anon;
grant execute on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) to authenticated;

-- Generic academic mutation gates remain strict. Scoped wrappers below temporarily
-- expose only the delegated section to legacy functions that still call this helper.
create or replace function public.lao_can_manage_academic(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_scope text:=nullif(current_setting('lao.work_scope_override',true),'');
begin
  if public.lao_is_local_school_admin(p_school_id) then
    return true;
  end if;
  if v_scope is null or v_scope<>'academics' and v_scope not like 'academics.%' then
    return false;
  end if;
  return public.lao_has_work_permission(p_school_id,v_scope,'edit')
    or public.lao_has_work_permission(p_school_id,v_scope,'approve');
end;
$function$;

revoke all on function public.lao_can_manage_academic(uuid) from public,anon;
grant execute on function public.lao_can_manage_academic(uuid) to authenticated;

-- Program scope
alter function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer)
  rename to lao_save_academic_program_base_v01914;
revoke all on function public.lao_save_academic_program_base_v01914(uuid,uuid,text,text,text,text,boolean,integer)
  from public,anon,authenticated;

create function public.lao_save_academic_program(
  p_school_id uuid,
  p_program_id uuid default null,
  p_code text default null,
  p_name_th text default null,
  p_name_en text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.programs','edit') then
    raise exception 'ไม่มีสิทธิ์แก้ไขโปรแกรมพิเศษ';
  end if;
  perform set_config('lao.work_scope_override','academics.programs',true);
  return public.lao_save_academic_program_base_v01914(
    p_school_id,p_program_id,p_code,p_name_th,p_name_en,p_description,p_is_active,p_sort_order
  );
end;
$function$;
revoke all on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) from public,anon;
grant execute on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) to authenticated;

-- Class / room scope
alter function public.lao_assign_class_program(uuid,uuid,uuid)
  rename to lao_assign_class_program_base_v01914;
revoke all on function public.lao_assign_class_program_base_v01914(uuid,uuid,uuid)
  from public,anon,authenticated;

create function public.lao_assign_class_program(
  p_school_id uuid,
  p_class_section_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.classes','edit') then
    raise exception 'ไม่มีสิทธิ์แก้ไขระดับชั้นและห้องเรียน';
  end if;
  perform set_config('lao.work_scope_override','academics.classes',true);
  return public.lao_assign_class_program_base_v01914(p_school_id,p_class_section_id,p_program_id);
end;
$function$;
revoke all on function public.lao_assign_class_program(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_assign_class_program(uuid,uuid,uuid) to authenticated;

-- Subject / curriculum scope. Each public mutator keeps its original API but is
-- allowed to enter the legacy implementation only after the exact scope is checked.
alter function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer)
  rename to lao_save_subject_base_v01914;
alter function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb)
  rename to lao_save_curriculum_course_base_v01914;
alter function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text)
  rename to lao_copy_curriculum_group_from_year_base_v01914;
alter function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[])
  rename to lao_create_curriculum_parallel_group_base_v01914;
alter function public.lao_delete_curriculum_parallel_group(uuid,uuid)
  rename to lao_delete_curriculum_parallel_group_base_v01914;
alter function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text)
  rename to lao_update_course_time_override_base_v01914;
alter function public.lao_reset_course_time_to_standard(uuid,uuid)
  rename to lao_reset_course_time_to_standard_base_v01914;
alter function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid)
  rename to lao_adopt_subject_catalog_item_base_v01914;
alter function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid)
  rename to lao_add_curriculum_library_item_base_v01914_delegate;
alter function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid)
  rename to lao_remove_curriculum_item_base_v01914;
alter function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text)
  rename to lao_create_school_subject_and_add_base_v01914;
alter function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer)
  rename to lao_quick_add_curriculum_subject_base_v01914;
alter function public.lao_move_curriculum_course(uuid,uuid,text)
  rename to lao_move_curriculum_course_base_v01914;
alter function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text)
  rename to lao_set_subject_requirement_decision_base_v01914;
alter function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text)
  rename to lao_confirm_curriculum_group_base_v01914;

revoke all on function public.lao_save_subject_base_v01914(uuid,uuid,text,text,text,text,text,boolean,integer) from public,anon,authenticated;
revoke all on function public.lao_save_curriculum_course_base_v01914(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) from public,anon,authenticated;
revoke all on function public.lao_copy_curriculum_group_from_year_base_v01914(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_create_curriculum_parallel_group_base_v01914(uuid,uuid,uuid,text,text,numeric,uuid[]) from public,anon,authenticated;
revoke all on function public.lao_delete_curriculum_parallel_group_base_v01914(uuid,uuid) from public,anon,authenticated;
revoke all on function public.lao_update_course_time_override_base_v01914(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.lao_reset_course_time_to_standard_base_v01914(uuid,uuid) from public,anon,authenticated;
revoke all on function public.lao_adopt_subject_catalog_item_base_v01914(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_add_curriculum_library_item_base_v01914_delegate(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_remove_curriculum_item_base_v01914(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_create_school_subject_and_add_base_v01914(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) from public,anon,authenticated;
revoke all on function public.lao_quick_add_curriculum_subject_base_v01914(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon,authenticated;
revoke all on function public.lao_move_curriculum_course_base_v01914(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_set_subject_requirement_decision_base_v01914(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_confirm_curriculum_group_base_v01914(uuid,uuid,uuid,text) from public,anon,authenticated;

create function public.lao_save_subject(
  p_school_id uuid,p_subject_id uuid default null,p_subject_code text default null,p_name_th text default null,
  p_name_en text default null,p_learning_area text default null,p_subject_type text default 'basic',
  p_is_active boolean default true,p_sort_order integer default 0
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_save_subject_base_v01914(p_school_id,p_subject_id,p_subject_code,p_name_th,p_name_en,p_learning_area,p_subject_type,p_is_active,p_sort_order);
end;$function$;

create function public.lao_save_curriculum_course(
  p_school_id uuid,p_course_id uuid default null,p_academic_year_id uuid default null,p_program_id uuid default null,
  p_grade_code text default null,p_grade_label text default null,p_subject_id uuid default null,p_annual_hours numeric default null,
  p_credits numeric default null,p_notes text default null,p_is_active boolean default true,p_sort_order integer default 0,
  p_term_plans jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขโครงสร้างหลักสูตร'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_save_curriculum_course_base_v01914(p_school_id,p_course_id,p_academic_year_id,p_program_id,p_grade_code,p_grade_label,p_subject_id,p_annual_hours,p_credits,p_notes,p_is_active,p_sort_order,p_term_plans);
end;$function$;

create function public.lao_copy_curriculum_group_from_year(
  p_school_id uuid,p_source_academic_year_id uuid,p_target_academic_year_id uuid,p_program_id uuid,p_grade_code text
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์คัดลอกโครงสร้างรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_copy_curriculum_group_from_year_base_v01914(p_school_id,p_source_academic_year_id,p_target_academic_year_id,p_program_id,p_grade_code);
end;$function$;

create function public.lao_create_curriculum_parallel_group(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_name text,p_weekly_periods numeric,p_course_ids uuid[]
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์จัดกลุ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_create_curriculum_parallel_group_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_name,p_weekly_periods,p_course_ids);
end;$function$;

create function public.lao_delete_curriculum_parallel_group(p_school_id uuid,p_group_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์ยกเลิกกลุ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_delete_curriculum_parallel_group_base_v01914(p_school_id,p_group_id);
end;$function$;

create function public.lao_update_course_time_override(
  p_school_id uuid,p_course_id uuid,p_annual_hours numeric default null,p_term_hours numeric default null,
  p_weekly_periods numeric default null,p_credits numeric default null,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขเวลาเรียนรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_update_course_time_override_base_v01914(p_school_id,p_course_id,p_annual_hours,p_term_hours,p_weekly_periods,p_credits,p_note);
end;$function$;

create function public.lao_reset_course_time_to_standard(p_school_id uuid,p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์คืนค่าเวลาเรียน'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_reset_course_time_to_standard_base_v01914(p_school_id,p_course_id);
end;$function$;

create function public.lao_adopt_subject_catalog_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชาจากคลัง'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_adopt_subject_catalog_item_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_source_kind,p_source_id);
end;$function$;

create function public.lao_add_curriculum_library_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_add_curriculum_library_item_base_v01914_delegate(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_source_kind,p_source_id);
end;$function$;

create function public.lao_remove_curriculum_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_course_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์นำรายวิชาออก'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_remove_curriculum_item_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_course_id);
end;$function$;

create function public.lao_create_school_subject_and_add(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_subject_code text,p_subject_name text,
  p_learning_area text,p_subject_type text,p_subject_subtype text default null,p_aliases text[] default '{}'::text[],
  p_share_to_catalog boolean default true,p_curriculum_version text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์สร้างรายวิชาของโรงเรียน'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_create_school_subject_and_add_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_subject_code,p_subject_name,p_learning_area,p_subject_type,p_subject_subtype,p_aliases,p_share_to_catalog,p_curriculum_version);
end;$function$;

create function public.lao_quick_add_curriculum_subject(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid default null,p_grade_label text default null,
  p_subject_code text default null,p_subject_name text default null,p_learning_area text default null,p_subject_type text default 'basic',
  p_weekly_periods numeric default null,p_annual_hours numeric default null,p_sort_order integer default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_quick_add_curriculum_subject_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_label,p_subject_code,p_subject_name,p_learning_area,p_subject_type,p_weekly_periods,p_annual_hours,p_sort_order);
end;$function$;

create function public.lao_move_curriculum_course(p_school_id uuid,p_course_id uuid,p_direction text)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์จัดลำดับรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_move_curriculum_course_base_v01914(p_school_id,p_course_id,p_direction);
end;$function$;

create function public.lao_set_subject_requirement_decision(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_requirement_key text,p_decision text,
  p_replacement_subject_id uuid default null,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์กำหนดการใช้รายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_set_subject_requirement_decision_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_requirement_key,p_decision,p_replacement_subject_id,p_note);
end;$function$;

create function public.lao_confirm_curriculum_group(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','approve')
     and not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์ยืนยันโครงสร้างหลักสูตร';
  end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_confirm_curriculum_group_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code);
end;$function$;

revoke all on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) from public,anon;
revoke all on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) from public,anon;
revoke all on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) from public,anon;
revoke all on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) from public,anon;
revoke all on function public.lao_delete_curriculum_parallel_group(uuid,uuid) from public,anon;
revoke all on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.lao_reset_course_time_to_standard(uuid,uuid) from public,anon;
revoke all on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) from public,anon;
revoke all on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) from public,anon;
revoke all on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon;
revoke all on function public.lao_move_curriculum_course(uuid,uuid,text) from public,anon;
revoke all on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon;
revoke all on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) from public,anon;

grant execute on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) to authenticated;
grant execute on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) to authenticated;
grant execute on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) to authenticated;
grant execute on function public.lao_delete_curriculum_parallel_group(uuid,uuid) to authenticated;
grant execute on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.lao_reset_course_time_to_standard(uuid,uuid) to authenticated;
grant execute on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) to authenticated;
grant execute on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) to authenticated;
grant execute on function public.lao_move_curriculum_course(uuid,uuid,text) to authenticated;
grant execute on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) to authenticated;
grant execute on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Use the effective frame in curriculum calculations
-- ---------------------------------------------------------------------------

create or replace function public.lao_curriculum_hours_breakdown(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_frame jsonb;
  v_minutes numeric;
  v_weeks numeric;
  v_basic numeric:=0;
  v_activity numeric:=0;
  v_additional numeric:=0;
  v_other numeric:=0;
  v_integrated numeric:=0;
  v_scheduled numeric:=0;
  v_curriculum numeric:=0;
  v_history numeric:=0;
  v_framework public.lao_curriculum_time_frameworks%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_frame:=public.lao_effective_academic_time_frame(p_school_id,p_academic_year_id,p_program_id);
  if coalesce((v_frame->>'configured')::boolean,false) then
    v_minutes:=(v_frame->>'minutes_per_period')::numeric;
    v_weeks:=(v_frame->>'instructional_weeks_per_year')::numeric;
  end if;

  select * into v_framework
  from public.lao_curriculum_time_frameworks
  where curriculum_version='core_2551_2560' and grade_code=p_grade_code;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,
      pg.id as parallel_group_id,
      case
        when c.standard_time_snapshot ? 'time_mode' then coalesce(nullif(c.standard_time_snapshot->>'time_mode',''),'weekly')
        when ct.time_mode is not null then ct.time_mode
        else 'weekly'
      end as time_mode,
      case
        when c.standard_time_snapshot ? 'counts_toward_schedule_total'
          then coalesce((c.standard_time_snapshot->>'counts_toward_schedule_total')::boolean,true)
        when ct.id is not null then ct.counts_toward_schedule_total
        when coalesce(c.standard_time_snapshot->>'time_mode',ct.time_mode,'weekly')='integrated' then false
        else true
      end as counts_schedule,
      case
        when s.subject_type='activity' and nullif(btrim(s.subject_code),'') is not null
          then 'activity|'||lower(btrim(s.subject_code))||'|'||lower(btrim(s.name_th))
        when nullif(btrim(s.subject_code),'') is not null
          then 'code|'||lower(btrim(s.subject_code))
        else 'name|'||s.subject_type||'|'||lower(btrim(s.name_th))
      end as subject_key,
      case when p_program_id is not null and c.program_id=p_program_id then 2 else 1 end as priority
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    left join public.lao_central_subject_time_templates ct on ct.id=c.standard_time_template_id and ct.is_active
    left join public.lao_curriculum_parallel_group_courses pgc on pgc.course_id=c.id
    left join public.lao_curriculum_parallel_groups pg on pg.id=pgc.group_id
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code
      and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null
            and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id
                and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id
                and x.grade_code=p_grade_code
                and x.subject_id=c.subject_id
            )
          )
        ))
      )
  ),
  ranked as (
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.updated_at desc,e.id) as rn
    from eligible e
  ),
  eff0 as (
    select * from ranked where rn=1
  ),
  eff as (
    select e.*,
      coalesce(
        e.annual_hours,
        (select sum(tp.term_hours) from public.lao_course_term_plans tp where tp.course_id=e.id and tp.term_hours is not null),
        case when v_minutes is not null and v_weeks is not null then
          (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id)
          * v_minutes/60*v_weeks
        end,
        0
      ) as course_hours
    from eff0 e
  ),
  slots as (
    select
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end as schedule_key,
      max(course_hours) as slot_hours,
      bool_or(subject_type='basic') as is_basic,
      bool_or(subject_type='activity') as is_activity,
      bool_or(subject_type='additional') as is_additional,
      bool_or(subject_type='other') as is_other,
      bool_and(counts_schedule) as counts_schedule,
      bool_or(time_mode='integrated') as is_integrated,
      bool_or(subject_type='basic' and position('ประวัติศาสตร์' in subject_name)>0) as is_history
    from eff
    group by
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end
  )
  select
    coalesce(sum(slot_hours) filter(where is_basic),0),
    coalesce(sum(slot_hours) filter(where is_activity),0),
    coalesce(sum(slot_hours) filter(where is_additional),0),
    coalesce(sum(slot_hours) filter(where is_other),0),
    coalesce(sum(slot_hours) filter(where is_activity and (is_integrated or not counts_schedule)),0),
    coalesce(sum(slot_hours) filter(where counts_schedule),0),
    coalesce(sum(slot_hours),0),
    coalesce(sum(slot_hours) filter(where is_history),0)
  into v_basic,v_activity,v_additional,v_other,v_integrated,v_scheduled,v_curriculum,v_history
  from slots;

  return jsonb_build_object(
    'basic_hours_total',v_basic,
    'learner_activity_hours_total',v_activity,
    'additional_hours_total',v_additional,
    'other_hours_total',v_other,
    'integrated_activity_hours',v_integrated,
    'scheduled_hours_total',v_scheduled,
    'curriculum_hours_total',v_curriculum,
    'history_hours_total',v_history,
    'time_frame',v_frame,
    'time_framework',case when v_framework.grade_code is null then null else jsonb_build_object(
      'curriculum_version',v_framework.curriculum_version,
      'grade_code',v_framework.grade_code,
      'grade_scope',v_framework.grade_scope,
      'band_code',v_framework.band_code,
      'basic_hours',v_framework.basic_hours,
      'learner_activity_hours',v_framework.learner_activity_hours,
      'history_hours',v_framework.history_hours,
      'overall_max_hours',v_framework.overall_max_hours,
      'overall_rule',v_framework.overall_rule,
      'source_label',v_framework.source_label,
      'source_url',v_framework.source_url,
      'note',v_framework.note,
      'basic_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_basic-v_framework.basic_hours)<0.001 then 'match'
        when v_basic<v_framework.basic_hours then 'below'
        else 'above'
      end,
      'activity_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_activity-v_framework.learner_activity_hours)<0.001 then 'match'
        when v_activity<v_framework.learner_activity_hours then 'below'
        else 'above'
      end,
      'history_status',case
        when v_framework.history_hours is null then 'not_applicable'
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_history-v_framework.history_hours)<0.001 then 'match'
        when v_history<v_framework.history_hours then 'below'
        else 'above'
      end
    ) end
  );
end;
$function$;

create or replace function public.lao_curriculum_group_status(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_hours jsonb;
  v_frame jsonb;
  v_fp text;
  v_weekly numeric:=0;
  v_capacity numeric:=0;
  v_gap numeric:=0;
  v_configured boolean:=false;
  v_confirmed_at timestamptz;
  v_confirmed boolean:=false;
  v_course_count int:=0;
  v_missing int:=0;
  v_mismatch int:=0;
begin
  v_base:=public.lao_curriculum_group_status_base_v0196(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_hours:=public.lao_curriculum_hours_breakdown(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_frame:=public.lao_effective_academic_time_frame(
    p_school_id,p_academic_year_id,p_program_id
  );

  v_configured:=coalesce((v_frame->>'configured')::boolean,false);
  v_weekly:=coalesce((v_base->>'weekly_periods_total')::numeric,0);
  if v_configured then
    v_capacity:=coalesce((v_frame->>'periods_per_week')::numeric,0);
    v_gap:=v_capacity-v_weekly;
  end if;

  v_fp:=md5(
    coalesce(v_base->>'fingerprint','')||'|'||
    coalesce(v_hours::text,'')||'|'||
    coalesce(v_frame::text,'')
  );

  select c.confirmed_at into v_confirmed_at
  from public.lao_curriculum_structure_confirmations c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.program_id is not distinct from p_program_id
    and c.grade_code=p_grade_code
    and c.fingerprint=v_fp
  order by c.confirmed_at desc
  limit 1;
  v_confirmed:=v_confirmed_at is not null;

  v_course_count:=coalesce((v_base->>'course_count')::int,0);
  v_missing:=coalesce((v_base->>'missing_time_count')::int,0);
  v_mismatch:=coalesce((v_base->>'parallel_mismatch_count')::int,0);

  return v_base
    || v_hours
    || jsonb_build_object(
      'annual_hours_total',coalesce((v_hours->>'scheduled_hours_total')::numeric,0),
      'curriculum_recorded_hours_total',coalesce((v_hours->>'curriculum_hours_total')::numeric,0),
      'schedule_configured',v_configured,
      'school_days_per_week',case when v_configured then (v_frame->>'school_days_per_week')::numeric else null end,
      'periods_per_day',case when v_configured then (v_frame->>'periods_per_day')::numeric else null end,
      'minutes_per_period',case when v_configured then (v_frame->>'minutes_per_period')::numeric else null end,
      'instructional_weeks_per_year',case when v_configured then (v_frame->>'instructional_weeks_per_year')::numeric else null end,
      'periods_per_week_capacity',case when v_configured then v_capacity else null end,
      'periods_per_week_gap',case when v_configured then v_gap else null end,
      'time_frame_id',case when v_configured then v_frame->'id' else null end,
      'time_frame_code',case when v_configured then v_frame->'code' else null end,
      'time_frame_name',case when v_configured then v_frame->'name_th' else null end,
      'time_frame_source',case when v_configured then v_frame->'source' else null end,
      'fingerprint',v_fp,
      'is_confirmed',v_confirmed,
      'confirmed_at',v_confirmed_at,
      'is_ready_to_confirm',(
        v_course_count>0 and v_configured and v_missing=0 and v_mismatch=0 and abs(v_gap)<0.001
      ),
      'status',case
        when v_confirmed then 'confirmed'
        when v_course_count=0 then 'empty'
        when not v_configured then 'needs_schedule_settings'
        when v_missing>0 then 'needs_time'
        when v_mismatch>0 then 'parallel_time_mismatch'
        when v_gap>0.001 then 'needs_periods'
        when v_gap< -0.001 then 'over_periods'
        else 'ready_to_confirm'
      end
    );
end;
$function$;

revoke all on function public.lao_curriculum_hours_breakdown(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_hours_breakdown(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Academic structure / annual timeline expose the new settings
-- ---------------------------------------------------------------------------

alter function public.lao_academic_structure(uuid,uuid)
  rename to lao_academic_structure_base_v01914;
revoke all on function public.lao_academic_structure_base_v01914(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_structure(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_base jsonb;
  v_year_id uuid;
  v_frames jsonb:='[]'::jsonb;
  v_default jsonb:=jsonb_build_object('configured',false);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_base:=public.lao_academic_structure_base_v01914(p_school_id,p_academic_year_id);
  v_year_id:=nullif(v_base->>'selected_year_id','')::uuid;

  if v_year_id is not null then
    v_default:=public.lao_effective_academic_time_frame(p_school_id,v_year_id,null);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,
      'code',f.code,
      'name_th',f.name_th,
      'program_id',f.program_id,
      'program_name',p.name_th,
      'is_default',f.is_default,
      'is_active',f.is_active,
      'school_days_per_week',f.school_days_per_week,
      'periods_per_day',f.periods_per_day,
      'periods_per_week',f.school_days_per_week*f.periods_per_day,
      'minutes_per_period',f.minutes_per_period,
      'instructional_weeks_per_year',f.instructional_weeks_per_year,
      'capacity_hours_per_year',round(
        f.school_days_per_week::numeric*f.periods_per_day*f.minutes_per_period::numeric/60*f.instructional_weeks_per_year,2
      ),
      'room_count',case
        when f.is_default then (
          select count(*)::int
          from public.lao_class_sections c
          where c.school_id=p_school_id and c.academic_year_id=v_year_id
            and c.is_active and c.source_type='lec'
            and (
              c.program_id is null
              or not exists(
                select 1 from public.lao_academic_time_frames sf
                where sf.school_id=p_school_id and sf.academic_year_id=v_year_id
                  and sf.program_id=c.program_id and sf.is_active
              )
            )
        )
        else (
          select count(*)::int
          from public.lao_class_sections c
          where c.school_id=p_school_id and c.academic_year_id=v_year_id
            and c.is_active and c.source_type='lec' and c.program_id=f.program_id
        )
      end,
      'updated_at',f.updated_at
    ) order by f.is_default desc,coalesce(p.sort_order,999999),f.name_th),'[]'::jsonb)
    into v_frames
    from public.lao_academic_time_frames f
    left join public.lao_academic_programs p on p.id=f.program_id
    where f.school_id=p_school_id and f.academic_year_id=v_year_id and f.is_active;
  end if;

  return v_base
    ||jsonb_build_object(
      'schedule_settings',v_default,
      'time_frames',v_frames,
      'can_manage_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit'),
      'can_delegate_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','delegate'),
      'can_manage_programs',public.lao_has_work_permission(p_school_id,'academics.programs','edit'),
      'can_manage_classes',public.lao_has_work_permission(p_school_id,'academics.classes','edit'),
      'can_manage_subjects',public.lao_has_work_permission(p_school_id,'academics.subjects','edit'),
      'can_approve_subjects',public.lao_has_work_permission(p_school_id,'academics.subjects','approve'),
      'can_manage_any_academic',(
        public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit')
        or public.lao_has_work_permission(p_school_id,'academics.programs','edit')
        or public.lao_has_work_permission(p_school_id,'academics.classes','edit')
        or public.lao_has_work_permission(p_school_id,'academics.subjects','edit')
        or public.lao_has_work_permission(p_school_id,'academics.workload','edit')
      )
    );
end;
$function$;

revoke all on function public.lao_academic_structure(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid) to authenticated;

alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01914;
revoke all on function public.lao_academic_year_setup_timeline_base_v01914(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_year_setup_timeline(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v01914(p_school_id,p_academic_year_id);

  for v_step in
    select value from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
    order by (value->>'sequence_no')::int
  loop
    if v_step->>'step_code'='periods' then
      v_step:=v_step||jsonb_build_object(
        'title','ตั้งค่าพื้นฐานงานวิชาการประจำปี',
        'description','กำหนดปี/ภาคเรียน และกรอบเวลาเรียนเริ่มต้น รวมทั้งกรอบเฉพาะโปรแกรมหรือห้องพิเศษที่ใช้เวลาต่างกัน',
        'route','#/academics/periods'
      );
    end if;
    v_steps:=v_steps||jsonb_build_array(v_step);
  end loop;

  return (v_base-'steps')
    ||jsonb_build_object(
      'steps',v_steps,
      'can_manage_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit')
    );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;

commit;
,
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

-- ---------------------------------------------------------------------------
-- 2) Annual academic time frames: default + program-specific overrides
-- ---------------------------------------------------------------------------

create table if not exists public.lao_academic_time_frames (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete set null,
  code text not null,
  name_th text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  school_days_per_week smallint not null check(school_days_per_week between 1 and 7),
  periods_per_day numeric(5,2) not null check(periods_per_day>0 and periods_per_day<=20),
  minutes_per_period smallint not null check(minutes_per_period between 20 and 120),
  instructional_weeks_per_year numeric(6,2) not null check(instructional_weeks_per_year>0 and instructional_weeks_per_year<=60),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lao_academic_time_frames_default_program_ck
    check((is_default and program_id is null) or not is_default)
);

create unique index if not exists lao_academic_time_frames_default_uq
  on public.lao_academic_time_frames(school_id,academic_year_id)
  where is_active and is_default;
create unique index if not exists lao_academic_time_frames_program_uq
  on public.lao_academic_time_frames(school_id,academic_year_id,program_id)
  where is_active and program_id is not null;
create unique index if not exists lao_academic_time_frames_code_uq
  on public.lao_academic_time_frames(school_id,academic_year_id,lower(code))
  where is_active;
create index if not exists lao_academic_time_frames_year_idx
  on public.lao_academic_time_frames(school_id,academic_year_id,is_active);

drop trigger if exists lao_academic_time_frames_touch on public.lao_academic_time_frames;
create trigger lao_academic_time_frames_touch
before update on public.lao_academic_time_frames
for each row execute function public.lao_touch_updated_at();

alter table public.lao_academic_time_frames enable row level security;
revoke all on public.lao_academic_time_frames from public,anon,authenticated;

-- Preserve existing one-frame settings as the school's default frame.
insert into public.lao_academic_time_frames(
  school_id,academic_year_id,program_id,code,name_th,is_default,is_active,
  school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year,
  created_by,updated_by,created_at,updated_at
)
select
  s.school_id,s.academic_year_id,null,'NORMAL','ห้องเรียนปกติ',true,true,
  s.school_days_per_week,s.periods_per_day,s.minutes_per_period,s.instructional_weeks_per_year,
  s.created_by,s.updated_by,s.created_at,s.updated_at
from public.lao_academic_schedule_settings s
where not exists(
  select 1 from public.lao_academic_time_frames f
  where f.school_id=s.school_id and f.academic_year_id=s.academic_year_id
    and f.is_default and f.is_active
);

create or replace function public.lao_effective_academic_time_frame(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_row public.lao_academic_time_frames%rowtype;
  v_source text;
begin
  if p_program_id is not null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.school_id=p_school_id
      and f.academic_year_id=p_academic_year_id
      and f.program_id=p_program_id
      and f.is_active
    order by f.updated_at desc
    limit 1;
    if found then v_source:='program'; end if;
  end if;

  if v_row.id is null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.school_id=p_school_id
      and f.academic_year_id=p_academic_year_id
      and f.is_default
      and f.is_active
    order by f.updated_at desc
    limit 1;
    if found then v_source:='default'; end if;
  end if;

  if v_row.id is null then
    return jsonb_build_object('configured',false);
  end if;

  return jsonb_build_object(
    'configured',true,
    'id',v_row.id,
    'code',v_row.code,
    'name_th',v_row.name_th,
    'program_id',v_row.program_id,
    'is_default',v_row.is_default,
    'source',v_source,
    'school_days_per_week',v_row.school_days_per_week,
    'periods_per_day',v_row.periods_per_day,
    'periods_per_week',v_row.school_days_per_week*v_row.periods_per_day,
    'minutes_per_period',v_row.minutes_per_period,
    'instructional_weeks_per_year',v_row.instructional_weeks_per_year,
    'capacity_hours_per_year',
      round(
        v_row.school_days_per_week::numeric
        * v_row.periods_per_day
        * v_row.minutes_per_period::numeric / 60
        * v_row.instructional_weeks_per_year,
        2
      )
  );
end;
$function$;

revoke all on function public.lao_effective_academic_time_frame(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.lao_save_academic_time_frame(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_time_frame_id uuid default null,
  p_name_th text default null,
  p_code text default null,
  p_program_id uuid default null,
  p_is_default boolean default false,
  p_school_days_per_week smallint default 5,
  p_periods_per_day numeric default 6,
  p_minutes_per_period smallint default 60,
  p_instructional_weeks_per_year numeric default 40
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_id uuid;
  v_org uuid;
  v_name text:=nullif(btrim(p_name_th),'');
  v_code text:=upper(regexp_replace(coalesce(nullif(btrim(p_code),''),'FRAME'),'[^A-Za-z0-9_-]+','_','g'));
  v_before jsonb;
  v_row public.lao_academic_time_frames%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_school_days_per_week is null or p_school_days_per_week<1 or p_school_days_per_week>7 then
    raise exception 'จำนวนวันเรียนต่อสัปดาห์ต้องอยู่ระหว่าง 1–7 วัน';
  end if;
  if p_periods_per_day is null or p_periods_per_day<=0 or p_periods_per_day>20 then
    raise exception 'จำนวนคาบเรียนต่อวันไม่ถูกต้อง';
  end if;
  if p_minutes_per_period is null or p_minutes_per_period<20 or p_minutes_per_period>120 then
    raise exception 'จำนวนนาทีต่อคาบต้องอยู่ระหว่าง 20–120 นาที';
  end if;
  if p_instructional_weeks_per_year is null or p_instructional_weeks_per_year<=0 or p_instructional_weeks_per_year>60 then
    raise exception 'จำนวนสัปดาห์เรียนต่อปีไม่ถูกต้อง';
  end if;

  if coalesce(p_is_default,false) then
    if p_program_id is not null then raise exception 'กรอบเริ่มต้นไม่ผูกกับโปรแกรมพิเศษ'; end if;
    if exists(
      select 1 from public.lao_academic_time_frames f
      where f.school_id=p_school_id and f.academic_year_id=p_academic_year_id
        and f.is_active and f.is_default
        and (p_time_frame_id is null or f.id<>p_time_frame_id)
    ) then
      raise exception 'มีกรอบเวลาเริ่มต้นแล้ว กรุณาแก้ไขกรอบเดิม';
    end if;
    v_name:=coalesce(v_name,'ห้องเรียนปกติ');
    v_code:=case when v_code='FRAME' then 'NORMAL' else v_code end;
  else
    if p_program_id is null then
      raise exception 'กรอบเวลาเพิ่มเติมต้องเลือกโปรแกรม / กลุ่มห้องที่ใช้กรอบนี้';
    end if;
    if not exists(
      select 1 from public.lao_academic_programs
      where id=p_program_id and school_id=p_school_id and is_active
    ) then raise exception 'ไม่พบโปรแกรมที่เลือก'; end if;
    if v_name is null then
      select name_th into v_name from public.lao_academic_programs where id=p_program_id;
    end if;
    if v_code='FRAME' then
      select upper(coalesce(nullif(btrim(code),''),'SPECIAL'))
      into v_code from public.lao_academic_programs where id=p_program_id;
    end if;
  end if;
  if v_name is null then raise exception 'กรุณาระบุชื่อกรอบเวลาเรียน'; end if;

  if p_time_frame_id is not null then
    select * into v_row
    from public.lao_academic_time_frames f
    where f.id=p_time_frame_id and f.school_id=p_school_id and f.academic_year_id=p_academic_year_id
    for update;
    if v_row.id is null then raise exception 'ไม่พบกรอบเวลาเรียนที่เลือก'; end if;
    v_before:=to_jsonb(v_row);

    update public.lao_academic_time_frames
    set program_id=case when coalesce(p_is_default,false) then null else p_program_id end,
        code=v_code,
        name_th=v_name,
        is_default=coalesce(p_is_default,false),
        is_active=true,
        school_days_per_week=p_school_days_per_week,
        periods_per_day=p_periods_per_day,
        minutes_per_period=p_minutes_per_period,
        instructional_weeks_per_year=p_instructional_weeks_per_year,
        updated_by=v_uid,
        updated_at=now()
    where id=p_time_frame_id
    returning id into v_id;
  else
    insert into public.lao_academic_time_frames(
      school_id,academic_year_id,program_id,code,name_th,is_default,is_active,
      school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year,
      created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,
      case when coalesce(p_is_default,false) then null else p_program_id end,
      v_code,v_name,coalesce(p_is_default,false),true,
      p_school_days_per_week,p_periods_per_day,p_minutes_per_period,p_instructional_weeks_per_year,
      v_uid,v_uid
    ) returning id into v_id;
  end if;

  -- Keep the legacy single-row table synchronized with the default frame.
  if coalesce(p_is_default,false) then
    insert into public.lao_academic_schedule_settings(
      school_id,academic_year_id,school_days_per_week,periods_per_day,
      minutes_per_period,instructional_weeks_per_year,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_school_days_per_week,p_periods_per_day,
      p_minutes_per_period,p_instructional_weeks_per_year,v_uid,v_uid
    )
    on conflict(school_id,academic_year_id) do update set
      school_days_per_week=excluded.school_days_per_week,
      periods_per_day=excluded.periods_per_day,
      minutes_per_period=excluded.minutes_per_period,
      instructional_weeks_per_year=excluded.instructional_weeks_per_year,
      updated_by=v_uid,
      updated_at=now();
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  )
  select
    v_org,p_school_id,v_uid,
    case when p_time_frame_id is null then 'academic_time_frame_created' else 'academic_time_frame_updated' end,
    'academic_time_frame',v_id::text,v_before,to_jsonb(f)
  from public.lao_academic_time_frames f where f.id=v_id;

  return public.lao_effective_academic_time_frame(
    p_school_id,p_academic_year_id,
    case when coalesce(p_is_default,false) then null else p_program_id end
  );
exception
  when unique_violation then
    raise exception 'โปรแกรมหรือรหัสกรอบเวลานี้ถูกกำหนดไว้แล้วในปีการศึกษานี้';
end;
$function$;

revoke all on function public.lao_save_academic_time_frame(uuid,uuid,uuid,text,text,uuid,boolean,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_time_frame(uuid,uuid,uuid,text,text,uuid,boolean,smallint,numeric,smallint,numeric) to authenticated;

create or replace function public.lao_set_academic_time_frame_active(
  p_school_id uuid,
  p_time_frame_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_row public.lao_academic_time_frames%rowtype;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'Access denied';
  end if;

  select * into v_row from public.lao_academic_time_frames
  where id=p_time_frame_id and school_id=p_school_id
  for update;
  if not found then raise exception 'ไม่พบกรอบเวลาเรียนที่เลือก'; end if;
  if v_row.is_default and not coalesce(p_is_active,false) then
    raise exception 'ไม่สามารถปิดกรอบเวลาเริ่มต้นได้ กรุณาแก้ไขค่าแทน';
  end if;

  update public.lao_academic_time_frames
  set is_active=coalesce(p_is_active,false),updated_by=v_uid,updated_at=now()
  where id=p_time_frame_id;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=v_row.academic_year_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  ) values(
    v_org,p_school_id,v_uid,'academic_time_frame_status_changed','academic_time_frame',p_time_frame_id::text,
    to_jsonb(v_row),jsonb_build_object('is_active',coalesce(p_is_active,false))
  );
exception
  when unique_violation then
    raise exception 'โปรแกรมนี้มีกรอบเวลาเรียนที่ใช้งานอยู่แล้ว';
end;
$function$;

revoke all on function public.lao_set_academic_time_frame_active(uuid,uuid,boolean) from public,anon;
grant execute on function public.lao_set_academic_time_frame_active(uuid,uuid,boolean) to authenticated;

-- Compatibility for old clients: saving the legacy settings now writes the default frame too.
create or replace function public.lao_save_academic_schedule_settings(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_school_days_per_week smallint,
  p_periods_per_day numeric,
  p_minutes_per_period smallint,
  p_instructional_weeks_per_year numeric
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_id uuid;
  v_name text;
  v_code text;
begin
  select id,name_th,code into v_id,v_name,v_code
  from public.lao_academic_time_frames
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and is_default and is_active
  order by updated_at desc
  limit 1;

  return public.lao_save_academic_time_frame(
    p_school_id,p_academic_year_id,v_id,
    coalesce(v_name,'ห้องเรียนปกติ'),coalesce(v_code,'NORMAL'),
    null,true,p_school_days_per_week,p_periods_per_day,p_minutes_per_period,p_instructional_weeks_per_year
  );
end;
$function$;

revoke all on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Shared annual academic settings: local School Admin or delegated scope only
-- ---------------------------------------------------------------------------

create or replace function public.lao_save_academic_year(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_year_be integer default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if p_year_be is null or p_year_be<2400 or p_year_be>2800 then raise exception 'ปีการศึกษาไม่ถูกต้อง'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  if v_org is null then raise exception 'School not found'; end if;

  if p_is_current then
    update public.lao_academic_years set is_current=false,updated_at=now()
    where school_id=p_school_id and (p_academic_year_id is null or id<>p_academic_year_id) and is_current;
  end if;

  if p_academic_year_id is null then
    insert into public.lao_academic_years(school_id,year_be,starts_on,ends_on,is_current)
    values(p_school_id,p_year_be,p_starts_on,p_ends_on,p_is_current)
    returning id into v_id;

    insert into public.lao_terms(academic_year_id,term_no,name,is_current)
    values
      (v_id,1,'ภาคเรียนที่ 1',false),
      (v_id,2,'ภาคเรียนที่ 2',false)
    on conflict(academic_year_id,term_no) do nothing;

    v_action:='academic_year_created';
  else
    update public.lao_academic_years
    set year_be=p_year_be,starts_on=p_starts_on,ends_on=p_ends_on,is_current=p_is_current,updated_at=now()
    where id=p_academic_year_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Academic year not found'; end if;
    v_action:='academic_year_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'academic_year',v_id::text,
    jsonb_build_object('year_be',p_year_be,'starts_on',p_starts_on,'ends_on',p_ends_on,'is_current',p_is_current)
  );

  return jsonb_build_object('id',v_id,'year_be',p_year_be);
exception
  when unique_violation then
    raise exception 'มีปีการศึกษา % อยู่แล้ว',p_year_be;
end;
$function$;

create or replace function public.lao_save_term(
  p_school_id uuid,
  p_term_id uuid default null,
  p_academic_year_id uuid default null,
  p_term_no smallint default null,
  p_name text default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_is_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_year integer;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit') then
    raise exception 'แก้ไขได้เฉพาะ School Admin หรือผู้ได้รับมอบหมายส่วนตั้งค่าพื้นฐานงานวิชาการ';
  end if;
  if p_term_no is null or p_term_no<1 or p_term_no>4 then raise exception 'ภาคเรียนต้องอยู่ระหว่าง 1–4'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then
    raise exception 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  end if;

  select ay.year_be,s.organization_id into v_year,v_org
  from public.lao_academic_years ay
  join public.lao_schools s on s.id=ay.school_id
  where ay.id=p_academic_year_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'Academic year not found'; end if;

  if p_is_current then
    update public.lao_terms t
    set is_current=false,updated_at=now()
    from public.lao_academic_years ay
    where t.academic_year_id=ay.id and ay.school_id=p_school_id
      and (p_term_id is null or t.id<>p_term_id) and t.is_current;
  end if;

  if p_term_id is null then
    insert into public.lao_terms(academic_year_id,term_no,name,starts_on,ends_on,is_current)
    values(p_academic_year_id,p_term_no,coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),p_starts_on,p_ends_on,p_is_current)
    returning id into v_id;
    v_action:='term_created';
  else
    update public.lao_terms t
    set term_no=p_term_no,
        name=coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),
        starts_on=p_starts_on,
        ends_on=p_ends_on,
        is_current=p_is_current,
        updated_at=now()
    from public.lao_academic_years ay
    where t.id=p_term_id and t.academic_year_id=ay.id and ay.school_id=p_school_id
    returning t.id into v_id;
    if v_id is null then raise exception 'Term not found'; end if;
    v_action:='term_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'term',v_id::text,
    jsonb_build_object('year_be',v_year,'term_no',p_term_no,'name',coalesce(nullif(btrim(p_name),''),'ภาคเรียนที่ '||p_term_no),'is_current',p_is_current)
  );

  return jsonb_build_object('id',v_id,'term_no',p_term_no);
exception
  when unique_violation then
    raise exception 'ปีการศึกษานี้มีภาคเรียนที่ % อยู่แล้ว',p_term_no;
end;
$function$;

revoke all on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) from public,anon;
grant execute on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) to authenticated;
revoke all on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) from public,anon;
grant execute on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) to authenticated;

-- Generic academic mutation gates remain strict. Scoped wrappers below temporarily
-- expose only the delegated section to legacy functions that still call this helper.
create or replace function public.lao_can_manage_academic(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_scope text:=nullif(current_setting('lao.work_scope_override',true),'');
begin
  if public.lao_is_local_school_admin(p_school_id) then
    return true;
  end if;
  if v_scope is null or v_scope<>'academics' and v_scope not like 'academics.%' then
    return false;
  end if;
  return public.lao_has_work_permission(p_school_id,v_scope,'edit')
    or public.lao_has_work_permission(p_school_id,v_scope,'approve');
end;
$function$;

revoke all on function public.lao_can_manage_academic(uuid) from public,anon;
grant execute on function public.lao_can_manage_academic(uuid) to authenticated;

-- Program scope
alter function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer)
  rename to lao_save_academic_program_base_v01914;
revoke all on function public.lao_save_academic_program_base_v01914(uuid,uuid,text,text,text,text,boolean,integer)
  from public,anon,authenticated;

create function public.lao_save_academic_program(
  p_school_id uuid,
  p_program_id uuid default null,
  p_code text default null,
  p_name_th text default null,
  p_name_en text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.programs','edit') then
    raise exception 'ไม่มีสิทธิ์แก้ไขโปรแกรมพิเศษ';
  end if;
  perform set_config('lao.work_scope_override','academics.programs',true);
  return public.lao_save_academic_program_base_v01914(
    p_school_id,p_program_id,p_code,p_name_th,p_name_en,p_description,p_is_active,p_sort_order
  );
end;
$function$;
revoke all on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) from public,anon;
grant execute on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) to authenticated;

-- Class / room scope
alter function public.lao_assign_class_program(uuid,uuid,uuid)
  rename to lao_assign_class_program_base_v01914;
revoke all on function public.lao_assign_class_program_base_v01914(uuid,uuid,uuid)
  from public,anon,authenticated;

create function public.lao_assign_class_program(
  p_school_id uuid,
  p_class_section_id uuid,
  p_program_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.classes','edit') then
    raise exception 'ไม่มีสิทธิ์แก้ไขระดับชั้นและห้องเรียน';
  end if;
  perform set_config('lao.work_scope_override','academics.classes',true);
  return public.lao_assign_class_program_base_v01914(p_school_id,p_class_section_id,p_program_id);
end;
$function$;
revoke all on function public.lao_assign_class_program(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_assign_class_program(uuid,uuid,uuid) to authenticated;

-- Subject / curriculum scope. Each public mutator keeps its original API but is
-- allowed to enter the legacy implementation only after the exact scope is checked.
alter function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer)
  rename to lao_save_subject_base_v01914;
alter function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb)
  rename to lao_save_curriculum_course_base_v01914;
alter function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text)
  rename to lao_copy_curriculum_group_from_year_base_v01914;
alter function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[])
  rename to lao_create_curriculum_parallel_group_base_v01914;
alter function public.lao_delete_curriculum_parallel_group(uuid,uuid)
  rename to lao_delete_curriculum_parallel_group_base_v01914;
alter function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text)
  rename to lao_update_course_time_override_base_v01914;
alter function public.lao_reset_course_time_to_standard(uuid,uuid)
  rename to lao_reset_course_time_to_standard_base_v01914;
alter function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid)
  rename to lao_adopt_subject_catalog_item_base_v01914;
alter function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid)
  rename to lao_add_curriculum_library_item_base_v01914_delegate;
alter function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid)
  rename to lao_remove_curriculum_item_base_v01914;
alter function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text)
  rename to lao_create_school_subject_and_add_base_v01914;
alter function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer)
  rename to lao_quick_add_curriculum_subject_base_v01914;
alter function public.lao_move_curriculum_course(uuid,uuid,text)
  rename to lao_move_curriculum_course_base_v01914;
alter function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text)
  rename to lao_set_subject_requirement_decision_base_v01914;
alter function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text)
  rename to lao_confirm_curriculum_group_base_v01914;

revoke all on function public.lao_save_subject_base_v01914(uuid,uuid,text,text,text,text,text,boolean,integer) from public,anon,authenticated;
revoke all on function public.lao_save_curriculum_course_base_v01914(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) from public,anon,authenticated;
revoke all on function public.lao_copy_curriculum_group_from_year_base_v01914(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_create_curriculum_parallel_group_base_v01914(uuid,uuid,uuid,text,text,numeric,uuid[]) from public,anon,authenticated;
revoke all on function public.lao_delete_curriculum_parallel_group_base_v01914(uuid,uuid) from public,anon,authenticated;
revoke all on function public.lao_update_course_time_override_base_v01914(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.lao_reset_course_time_to_standard_base_v01914(uuid,uuid) from public,anon,authenticated;
revoke all on function public.lao_adopt_subject_catalog_item_base_v01914(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_add_curriculum_library_item_base_v01914_delegate(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_remove_curriculum_item_base_v01914(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.lao_create_school_subject_and_add_base_v01914(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) from public,anon,authenticated;
revoke all on function public.lao_quick_add_curriculum_subject_base_v01914(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon,authenticated;
revoke all on function public.lao_move_curriculum_course_base_v01914(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_set_subject_requirement_decision_base_v01914(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.lao_confirm_curriculum_group_base_v01914(uuid,uuid,uuid,text) from public,anon,authenticated;

create function public.lao_save_subject(
  p_school_id uuid,p_subject_id uuid default null,p_subject_code text default null,p_name_th text default null,
  p_name_en text default null,p_learning_area text default null,p_subject_type text default 'basic',
  p_is_active boolean default true,p_sort_order integer default 0
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_save_subject_base_v01914(p_school_id,p_subject_id,p_subject_code,p_name_th,p_name_en,p_learning_area,p_subject_type,p_is_active,p_sort_order);
end;$function$;

create function public.lao_save_curriculum_course(
  p_school_id uuid,p_course_id uuid default null,p_academic_year_id uuid default null,p_program_id uuid default null,
  p_grade_code text default null,p_grade_label text default null,p_subject_id uuid default null,p_annual_hours numeric default null,
  p_credits numeric default null,p_notes text default null,p_is_active boolean default true,p_sort_order integer default 0,
  p_term_plans jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขโครงสร้างหลักสูตร'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_save_curriculum_course_base_v01914(p_school_id,p_course_id,p_academic_year_id,p_program_id,p_grade_code,p_grade_label,p_subject_id,p_annual_hours,p_credits,p_notes,p_is_active,p_sort_order,p_term_plans);
end;$function$;

create function public.lao_copy_curriculum_group_from_year(
  p_school_id uuid,p_source_academic_year_id uuid,p_target_academic_year_id uuid,p_program_id uuid,p_grade_code text
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์คัดลอกโครงสร้างรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_copy_curriculum_group_from_year_base_v01914(p_school_id,p_source_academic_year_id,p_target_academic_year_id,p_program_id,p_grade_code);
end;$function$;

create function public.lao_create_curriculum_parallel_group(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_name text,p_weekly_periods numeric,p_course_ids uuid[]
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์จัดกลุ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_create_curriculum_parallel_group_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_name,p_weekly_periods,p_course_ids);
end;$function$;

create function public.lao_delete_curriculum_parallel_group(p_school_id uuid,p_group_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์ยกเลิกกลุ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_delete_curriculum_parallel_group_base_v01914(p_school_id,p_group_id);
end;$function$;

create function public.lao_update_course_time_override(
  p_school_id uuid,p_course_id uuid,p_annual_hours numeric default null,p_term_hours numeric default null,
  p_weekly_periods numeric default null,p_credits numeric default null,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์แก้ไขเวลาเรียนรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_update_course_time_override_base_v01914(p_school_id,p_course_id,p_annual_hours,p_term_hours,p_weekly_periods,p_credits,p_note);
end;$function$;

create function public.lao_reset_course_time_to_standard(p_school_id uuid,p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์คืนค่าเวลาเรียน'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_reset_course_time_to_standard_base_v01914(p_school_id,p_course_id);
end;$function$;

create function public.lao_adopt_subject_catalog_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชาจากคลัง'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_adopt_subject_catalog_item_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_source_kind,p_source_id);
end;$function$;

create function public.lao_add_curriculum_library_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_source_kind text,p_source_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_add_curriculum_library_item_base_v01914_delegate(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_source_kind,p_source_id);
end;$function$;

create function public.lao_remove_curriculum_item(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_course_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์นำรายวิชาออก'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_remove_curriculum_item_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_course_id);
end;$function$;

create function public.lao_create_school_subject_and_add(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_subject_code text,p_subject_name text,
  p_learning_area text,p_subject_type text,p_subject_subtype text default null,p_aliases text[] default '{}'::text[],
  p_share_to_catalog boolean default true,p_curriculum_version text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์สร้างรายวิชาของโรงเรียน'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_create_school_subject_and_add_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_subject_code,p_subject_name,p_learning_area,p_subject_type,p_subject_subtype,p_aliases,p_share_to_catalog,p_curriculum_version);
end;$function$;

create function public.lao_quick_add_curriculum_subject(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid default null,p_grade_label text default null,
  p_subject_code text default null,p_subject_name text default null,p_learning_area text default null,p_subject_type text default 'basic',
  p_weekly_periods numeric default null,p_annual_hours numeric default null,p_sort_order integer default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์เพิ่มรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_quick_add_curriculum_subject_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_label,p_subject_code,p_subject_name,p_learning_area,p_subject_type,p_weekly_periods,p_annual_hours,p_sort_order);
end;$function$;

create function public.lao_move_curriculum_course(p_school_id uuid,p_course_id uuid,p_direction text)
returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์จัดลำดับรายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_move_curriculum_course_base_v01914(p_school_id,p_course_id,p_direction);
end;$function$;

create function public.lao_set_subject_requirement_decision(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text,p_requirement_key text,p_decision text,
  p_replacement_subject_id uuid default null,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then raise exception 'ไม่มีสิทธิ์กำหนดการใช้รายวิชา'; end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_set_subject_requirement_decision_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code,p_requirement_key,p_decision,p_replacement_subject_id,p_note);
end;$function$;

create function public.lao_confirm_curriculum_group(
  p_school_id uuid,p_academic_year_id uuid,p_program_id uuid,p_grade_code text
) returns jsonb language plpgsql security definer set search_path=public as $function$
begin
  if not public.lao_has_work_permission(p_school_id,'academics.subjects','approve')
     and not public.lao_has_work_permission(p_school_id,'academics.subjects','edit') then
    raise exception 'ไม่มีสิทธิ์ยืนยันโครงสร้างหลักสูตร';
  end if;
  perform set_config('lao.work_scope_override','academics.subjects',true);
  return public.lao_confirm_curriculum_group_base_v01914(p_school_id,p_academic_year_id,p_program_id,p_grade_code);
end;$function$;

revoke all on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) from public,anon;
revoke all on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) from public,anon;
revoke all on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) from public,anon;
revoke all on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) from public,anon;
revoke all on function public.lao_delete_curriculum_parallel_group(uuid,uuid) from public,anon;
revoke all on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.lao_reset_course_time_to_standard(uuid,uuid) from public,anon;
revoke all on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) from public,anon;
revoke all on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) from public,anon;
revoke all on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon;
revoke all on function public.lao_move_curriculum_course(uuid,uuid,text) from public,anon;
revoke all on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon;
revoke all on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) from public,anon;

grant execute on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) to authenticated;
grant execute on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) to authenticated;
grant execute on function public.lao_copy_curriculum_group_from_year(uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) to authenticated;
grant execute on function public.lao_delete_curriculum_parallel_group(uuid,uuid) to authenticated;
grant execute on function public.lao_update_course_time_override(uuid,uuid,numeric,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.lao_reset_course_time_to_standard(uuid,uuid) to authenticated;
grant execute on function public.lao_adopt_subject_catalog_item(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.lao_create_school_subject_and_add(uuid,uuid,uuid,text,text,text,text,text,text,text[],boolean,text) to authenticated;
grant execute on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) to authenticated;
grant execute on function public.lao_move_curriculum_course(uuid,uuid,text) to authenticated;
grant execute on function public.lao_set_subject_requirement_decision(uuid,uuid,uuid,text,text,text,uuid,text) to authenticated;
grant execute on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Use the effective frame in curriculum calculations
-- ---------------------------------------------------------------------------

create or replace function public.lao_curriculum_hours_breakdown(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_frame jsonb;
  v_minutes numeric;
  v_weeks numeric;
  v_basic numeric:=0;
  v_activity numeric:=0;
  v_additional numeric:=0;
  v_other numeric:=0;
  v_integrated numeric:=0;
  v_scheduled numeric:=0;
  v_curriculum numeric:=0;
  v_history numeric:=0;
  v_framework public.lao_curriculum_time_frameworks%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_frame:=public.lao_effective_academic_time_frame(p_school_id,p_academic_year_id,p_program_id);
  if coalesce((v_frame->>'configured')::boolean,false) then
    v_minutes:=(v_frame->>'minutes_per_period')::numeric;
    v_weeks:=(v_frame->>'instructional_weeks_per_year')::numeric;
  end if;

  select * into v_framework
  from public.lao_curriculum_time_frameworks
  where curriculum_version='core_2551_2560' and grade_code=p_grade_code;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,
      pg.id as parallel_group_id,
      case
        when c.standard_time_snapshot ? 'time_mode' then coalesce(nullif(c.standard_time_snapshot->>'time_mode',''),'weekly')
        when ct.time_mode is not null then ct.time_mode
        else 'weekly'
      end as time_mode,
      case
        when c.standard_time_snapshot ? 'counts_toward_schedule_total'
          then coalesce((c.standard_time_snapshot->>'counts_toward_schedule_total')::boolean,true)
        when ct.id is not null then ct.counts_toward_schedule_total
        when coalesce(c.standard_time_snapshot->>'time_mode',ct.time_mode,'weekly')='integrated' then false
        else true
      end as counts_schedule,
      case
        when s.subject_type='activity' and nullif(btrim(s.subject_code),'') is not null
          then 'activity|'||lower(btrim(s.subject_code))||'|'||lower(btrim(s.name_th))
        when nullif(btrim(s.subject_code),'') is not null
          then 'code|'||lower(btrim(s.subject_code))
        else 'name|'||s.subject_type||'|'||lower(btrim(s.name_th))
      end as subject_key,
      case when p_program_id is not null and c.program_id=p_program_id then 2 else 1 end as priority
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    left join public.lao_central_subject_time_templates ct on ct.id=c.standard_time_template_id and ct.is_active
    left join public.lao_curriculum_parallel_group_courses pgc on pgc.course_id=c.id
    left join public.lao_curriculum_parallel_groups pg on pg.id=pgc.group_id
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code
      and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null
            and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id
                and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id
                and x.grade_code=p_grade_code
                and x.subject_id=c.subject_id
            )
          )
        ))
      )
  ),
  ranked as (
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.updated_at desc,e.id) as rn
    from eligible e
  ),
  eff0 as (
    select * from ranked where rn=1
  ),
  eff as (
    select e.*,
      coalesce(
        e.annual_hours,
        (select sum(tp.term_hours) from public.lao_course_term_plans tp where tp.course_id=e.id and tp.term_hours is not null),
        case when v_minutes is not null and v_weeks is not null then
          (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id)
          * v_minutes/60*v_weeks
        end,
        0
      ) as course_hours
    from eff0 e
  ),
  slots as (
    select
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end as schedule_key,
      max(course_hours) as slot_hours,
      bool_or(subject_type='basic') as is_basic,
      bool_or(subject_type='activity') as is_activity,
      bool_or(subject_type='additional') as is_additional,
      bool_or(subject_type='other') as is_other,
      bool_and(counts_schedule) as counts_schedule,
      bool_or(time_mode='integrated') as is_integrated,
      bool_or(subject_type='basic' and position('ประวัติศาสตร์' in subject_name)>0) as is_history
    from eff
    group by
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end
  )
  select
    coalesce(sum(slot_hours) filter(where is_basic),0),
    coalesce(sum(slot_hours) filter(where is_activity),0),
    coalesce(sum(slot_hours) filter(where is_additional),0),
    coalesce(sum(slot_hours) filter(where is_other),0),
    coalesce(sum(slot_hours) filter(where is_activity and (is_integrated or not counts_schedule)),0),
    coalesce(sum(slot_hours) filter(where counts_schedule),0),
    coalesce(sum(slot_hours),0),
    coalesce(sum(slot_hours) filter(where is_history),0)
  into v_basic,v_activity,v_additional,v_other,v_integrated,v_scheduled,v_curriculum,v_history
  from slots;

  return jsonb_build_object(
    'basic_hours_total',v_basic,
    'learner_activity_hours_total',v_activity,
    'additional_hours_total',v_additional,
    'other_hours_total',v_other,
    'integrated_activity_hours',v_integrated,
    'scheduled_hours_total',v_scheduled,
    'curriculum_hours_total',v_curriculum,
    'history_hours_total',v_history,
    'time_frame',v_frame,
    'time_framework',case when v_framework.grade_code is null then null else jsonb_build_object(
      'curriculum_version',v_framework.curriculum_version,
      'grade_code',v_framework.grade_code,
      'grade_scope',v_framework.grade_scope,
      'band_code',v_framework.band_code,
      'basic_hours',v_framework.basic_hours,
      'learner_activity_hours',v_framework.learner_activity_hours,
      'history_hours',v_framework.history_hours,
      'overall_max_hours',v_framework.overall_max_hours,
      'overall_rule',v_framework.overall_rule,
      'source_label',v_framework.source_label,
      'source_url',v_framework.source_url,
      'note',v_framework.note,
      'basic_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_basic-v_framework.basic_hours)<0.001 then 'match'
        when v_basic<v_framework.basic_hours then 'below'
        else 'above'
      end,
      'activity_status',case
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_activity-v_framework.learner_activity_hours)<0.001 then 'match'
        when v_activity<v_framework.learner_activity_hours then 'below'
        else 'above'
      end,
      'history_status',case
        when v_framework.history_hours is null then 'not_applicable'
        when v_framework.grade_scope<>'annual' then 'check_band'
        when abs(v_history-v_framework.history_hours)<0.001 then 'match'
        when v_history<v_framework.history_hours then 'below'
        else 'above'
      end
    ) end
  );
end;
$function$;

create or replace function public.lao_curriculum_group_status(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_grade_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_hours jsonb;
  v_frame jsonb;
  v_fp text;
  v_weekly numeric:=0;
  v_capacity numeric:=0;
  v_gap numeric:=0;
  v_configured boolean:=false;
  v_confirmed_at timestamptz;
  v_confirmed boolean:=false;
  v_course_count int:=0;
  v_missing int:=0;
  v_mismatch int:=0;
begin
  v_base:=public.lao_curriculum_group_status_base_v0196(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_hours:=public.lao_curriculum_hours_breakdown(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
  v_frame:=public.lao_effective_academic_time_frame(
    p_school_id,p_academic_year_id,p_program_id
  );

  v_configured:=coalesce((v_frame->>'configured')::boolean,false);
  v_weekly:=coalesce((v_base->>'weekly_periods_total')::numeric,0);
  if v_configured then
    v_capacity:=coalesce((v_frame->>'periods_per_week')::numeric,0);
    v_gap:=v_capacity-v_weekly;
  end if;

  v_fp:=md5(
    coalesce(v_base->>'fingerprint','')||'|'||
    coalesce(v_hours::text,'')||'|'||
    coalesce(v_frame::text,'')
  );

  select c.confirmed_at into v_confirmed_at
  from public.lao_curriculum_structure_confirmations c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.program_id is not distinct from p_program_id
    and c.grade_code=p_grade_code
    and c.fingerprint=v_fp
  order by c.confirmed_at desc
  limit 1;
  v_confirmed:=v_confirmed_at is not null;

  v_course_count:=coalesce((v_base->>'course_count')::int,0);
  v_missing:=coalesce((v_base->>'missing_time_count')::int,0);
  v_mismatch:=coalesce((v_base->>'parallel_mismatch_count')::int,0);

  return v_base
    || v_hours
    || jsonb_build_object(
      'annual_hours_total',coalesce((v_hours->>'scheduled_hours_total')::numeric,0),
      'curriculum_recorded_hours_total',coalesce((v_hours->>'curriculum_hours_total')::numeric,0),
      'schedule_configured',v_configured,
      'school_days_per_week',case when v_configured then (v_frame->>'school_days_per_week')::numeric else null end,
      'periods_per_day',case when v_configured then (v_frame->>'periods_per_day')::numeric else null end,
      'minutes_per_period',case when v_configured then (v_frame->>'minutes_per_period')::numeric else null end,
      'instructional_weeks_per_year',case when v_configured then (v_frame->>'instructional_weeks_per_year')::numeric else null end,
      'periods_per_week_capacity',case when v_configured then v_capacity else null end,
      'periods_per_week_gap',case when v_configured then v_gap else null end,
      'time_frame_id',case when v_configured then v_frame->'id' else null end,
      'time_frame_code',case when v_configured then v_frame->'code' else null end,
      'time_frame_name',case when v_configured then v_frame->'name_th' else null end,
      'time_frame_source',case when v_configured then v_frame->'source' else null end,
      'fingerprint',v_fp,
      'is_confirmed',v_confirmed,
      'confirmed_at',v_confirmed_at,
      'is_ready_to_confirm',(
        v_course_count>0 and v_configured and v_missing=0 and v_mismatch=0 and abs(v_gap)<0.001
      ),
      'status',case
        when v_confirmed then 'confirmed'
        when v_course_count=0 then 'empty'
        when not v_configured then 'needs_schedule_settings'
        when v_missing>0 then 'needs_time'
        when v_mismatch>0 then 'parallel_time_mismatch'
        when v_gap>0.001 then 'needs_periods'
        when v_gap< -0.001 then 'over_periods'
        else 'ready_to_confirm'
      end
    );
end;
$function$;

revoke all on function public.lao_curriculum_hours_breakdown(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_hours_breakdown(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Academic structure / annual timeline expose the new settings
-- ---------------------------------------------------------------------------

alter function public.lao_academic_structure(uuid,uuid)
  rename to lao_academic_structure_base_v01914;
revoke all on function public.lao_academic_structure_base_v01914(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_structure(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_base jsonb;
  v_year_id uuid;
  v_frames jsonb:='[]'::jsonb;
  v_default jsonb:=jsonb_build_object('configured',false);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_base:=public.lao_academic_structure_base_v01914(p_school_id,p_academic_year_id);
  v_year_id:=nullif(v_base->>'selected_year_id','')::uuid;

  if v_year_id is not null then
    v_default:=public.lao_effective_academic_time_frame(p_school_id,v_year_id,null);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,
      'code',f.code,
      'name_th',f.name_th,
      'program_id',f.program_id,
      'program_name',p.name_th,
      'is_default',f.is_default,
      'is_active',f.is_active,
      'school_days_per_week',f.school_days_per_week,
      'periods_per_day',f.periods_per_day,
      'periods_per_week',f.school_days_per_week*f.periods_per_day,
      'minutes_per_period',f.minutes_per_period,
      'instructional_weeks_per_year',f.instructional_weeks_per_year,
      'capacity_hours_per_year',round(
        f.school_days_per_week::numeric*f.periods_per_day*f.minutes_per_period::numeric/60*f.instructional_weeks_per_year,2
      ),
      'room_count',case
        when f.is_default then (
          select count(*)::int
          from public.lao_class_sections c
          where c.school_id=p_school_id and c.academic_year_id=v_year_id
            and c.is_active and c.source_type='lec'
            and (
              c.program_id is null
              or not exists(
                select 1 from public.lao_academic_time_frames sf
                where sf.school_id=p_school_id and sf.academic_year_id=v_year_id
                  and sf.program_id=c.program_id and sf.is_active
              )
            )
        )
        else (
          select count(*)::int
          from public.lao_class_sections c
          where c.school_id=p_school_id and c.academic_year_id=v_year_id
            and c.is_active and c.source_type='lec' and c.program_id=f.program_id
        )
      end,
      'updated_at',f.updated_at
    ) order by f.is_default desc,coalesce(p.sort_order,999999),f.name_th),'[]'::jsonb)
    into v_frames
    from public.lao_academic_time_frames f
    left join public.lao_academic_programs p on p.id=f.program_id
    where f.school_id=p_school_id and f.academic_year_id=v_year_id and f.is_active;
  end if;

  return v_base
    ||jsonb_build_object(
      'schedule_settings',v_default,
      'time_frames',v_frames,
      'can_manage_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit'),
      'can_delegate_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','delegate'),
      'can_manage_programs',public.lao_has_work_permission(p_school_id,'academics.programs','edit'),
      'can_manage_classes',public.lao_has_work_permission(p_school_id,'academics.classes','edit'),
      'can_manage_subjects',public.lao_has_work_permission(p_school_id,'academics.subjects','edit'),
      'can_approve_subjects',public.lao_has_work_permission(p_school_id,'academics.subjects','approve'),
      'can_manage_any_academic',(
        public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit')
        or public.lao_has_work_permission(p_school_id,'academics.programs','edit')
        or public.lao_has_work_permission(p_school_id,'academics.classes','edit')
        or public.lao_has_work_permission(p_school_id,'academics.subjects','edit')
        or public.lao_has_work_permission(p_school_id,'academics.workload','edit')
      )
    );
end;
$function$;

revoke all on function public.lao_academic_structure(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid) to authenticated;

alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01914;
revoke all on function public.lao_academic_year_setup_timeline_base_v01914(uuid,uuid)
  from public,anon,authenticated;

create function public.lao_academic_year_setup_timeline(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_base jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v01914(p_school_id,p_academic_year_id);

  for v_step in
    select value from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
    order by (value->>'sequence_no')::int
  loop
    if v_step->>'step_code'='periods' then
      v_step:=v_step||jsonb_build_object(
        'title','ตั้งค่าพื้นฐานงานวิชาการประจำปี',
        'description','กำหนดปี/ภาคเรียน และกรอบเวลาเรียนเริ่มต้น รวมทั้งกรอบเฉพาะโปรแกรมหรือห้องพิเศษที่ใช้เวลาต่างกัน',
        'route','#/academics/periods'
      );
    end if;
    v_steps:=v_steps||jsonb_build_array(v_step);
  end loop;

  return (v_base-'steps')
    ||jsonb_build_object(
      'steps',v_steps,
      'can_manage_basic_settings',public.lao_has_work_permission(p_school_id,'academics.basic_settings','edit')
    );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid) to authenticated;

commit;
