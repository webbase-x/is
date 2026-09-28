-- Academic annual structure: programs, class sections, subject catalogue and curriculum plans.

create table if not exists public.lao_academic_programs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  code text,
  name_th text not null,
  name_en text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lao_academic_programs_school_code_uq
  on public.lao_academic_programs(school_id,lower(code))
  where code is not null and btrim(code)<>'';

create unique index if not exists lao_academic_programs_school_name_uq
  on public.lao_academic_programs(school_id,lower(name_th))
  where btrim(name_th)<>'';

create index if not exists lao_academic_programs_school_idx
  on public.lao_academic_programs(school_id,is_active,sort_order);

drop trigger if exists lao_academic_programs_touch on public.lao_academic_programs;
create trigger lao_academic_programs_touch
before update on public.lao_academic_programs
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_class_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete set null,
  grade_code text,
  grade_label text not null,
  section_label text not null,
  room_name text,
  source_type text not null default 'manual' check(source_type in ('manual','lec','import')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lao_class_sections_year_grade_section_uq
  on public.lao_class_sections(
    academic_year_id,
    lower(grade_label),
    lower(section_label),
    coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists lao_class_sections_school_year_idx
  on public.lao_class_sections(school_id,academic_year_id,is_active,sort_order);

drop trigger if exists lao_class_sections_touch on public.lao_class_sections;
create trigger lao_class_sections_touch
before update on public.lao_class_sections
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  subject_code text,
  name_th text not null,
  name_en text,
  learning_area text,
  subject_type text not null default 'basic'
    check(subject_type in ('basic','additional','activity','other')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lao_subjects_school_code_uq
  on public.lao_subjects(school_id,lower(subject_code))
  where subject_code is not null and btrim(subject_code)<>'';

create index if not exists lao_subjects_school_idx
  on public.lao_subjects(school_id,is_active,sort_order,name_th);

drop trigger if exists lao_subjects_touch on public.lao_subjects;
create trigger lao_subjects_touch
before update on public.lao_subjects
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_curriculum_courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete set null,
  grade_code text,
  grade_label text not null,
  subject_id uuid not null references public.lao_subjects(id) on delete restrict,
  annual_hours numeric(8,2),
  credits numeric(5,2),
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lao_curriculum_courses_year_grade_subject_uq
  on public.lao_curriculum_courses(
    academic_year_id,
    lower(grade_label),
    subject_id,
    coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists lao_curriculum_courses_school_year_idx
  on public.lao_curriculum_courses(school_id,academic_year_id,is_active,sort_order);

drop trigger if exists lao_curriculum_courses_touch on public.lao_curriculum_courses;
create trigger lao_curriculum_courses_touch
before update on public.lao_curriculum_courses
for each row execute function public.lao_touch_updated_at();

create table if not exists public.lao_course_term_plans (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.lao_curriculum_courses(id) on delete cascade,
  term_id uuid not null references public.lao_terms(id) on delete cascade,
  weekly_periods numeric(5,2),
  term_hours numeric(8,2),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,term_id)
);

create index if not exists lao_course_term_plans_term_idx
  on public.lao_course_term_plans(term_id);

drop trigger if exists lao_course_term_plans_touch on public.lao_course_term_plans;
create trigger lao_course_term_plans_touch
before update on public.lao_course_term_plans
for each row execute function public.lao_touch_updated_at();

alter table public.lao_academic_programs enable row level security;
alter table public.lao_class_sections enable row level security;
alter table public.lao_subjects enable row level security;
alter table public.lao_curriculum_courses enable row level security;
alter table public.lao_course_term_plans enable row level security;

revoke all on public.lao_academic_programs from anon,authenticated;
revoke all on public.lao_class_sections from anon,authenticated;
revoke all on public.lao_subjects from anon,authenticated;
revoke all on public.lao_curriculum_courses from anon,authenticated;
revoke all on public.lao_course_term_plans from anon,authenticated;

create or replace function public.lao_can_view_academic(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_platform_admin()
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id=p_school_id
      and r.code in (
        'school_admin','school_executive','registrar',
        'academic_officer','teacher','staff'
      )
  )
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    join public.lao_schools s on s.organization_id=m.organization_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id is null
      and s.id=p_school_id
      and r.code in ('organization_admin','organization_viewer')
  );
$$;

revoke all on function public.lao_can_view_academic(uuid) from public,anon;
grant execute on function public.lao_can_view_academic(uuid) to authenticated;

create or replace function public.lao_can_manage_academic(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.lao_is_platform_admin()
  or exists(
    select 1
    from public.lao_memberships m
    join public.lao_membership_roles mr on mr.membership_id=m.id
    join public.lao_roles r on r.id=mr.role_id
    where m.user_id=(select auth.uid())
      and m.status='active'
      and m.school_id=p_school_id
      and r.code in ('school_admin','academic_officer')
  );
$$;

revoke all on function public.lao_can_manage_academic(uuid) from public,anon;
grant execute on function public.lao_can_manage_academic(uuid) to authenticated;

create or replace function public.lao_academic_structure(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_year_id uuid;
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  select ay.id into v_year_id
  from public.lao_academic_years ay
  where ay.school_id=p_school_id
    and (p_academic_year_id is null or ay.id=p_academic_year_id)
  order by
    case when p_academic_year_id is not null and ay.id=p_academic_year_id then 0 else 1 end,
    ay.is_current desc,
    ay.year_be desc
  limit 1;

  select jsonb_build_object(
    'can_manage',public.lao_can_manage_academic(p_school_id),
    'selected_year_id',v_year_id,
    'years',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',ay.id,
          'year_be',ay.year_be,
          'starts_on',ay.starts_on,
          'ends_on',ay.ends_on,
          'is_current',ay.is_current,
          'terms',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id',t.id,
                'term_no',t.term_no,
                'name',coalesce(t.name,'ภาคเรียนที่ '||t.term_no),
                'starts_on',t.starts_on,
                'ends_on',t.ends_on,
                'is_current',t.is_current
              ) order by t.term_no
            )
            from public.lao_terms t
            where t.academic_year_id=ay.id
          ),'[]'::jsonb)
        ) order by ay.year_be desc
      )
      from public.lao_academic_years ay
      where ay.school_id=p_school_id
    ),'[]'::jsonb),
    'programs',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,
          'code',p.code,
          'name_th',p.name_th,
          'name_en',p.name_en,
          'description',p.description,
          'is_active',p.is_active,
          'sort_order',p.sort_order
        ) order by p.sort_order,p.name_th
      )
      from public.lao_academic_programs p
      where p.school_id=p_school_id
    ),'[]'::jsonb),
    'classes',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',c.id,
          'academic_year_id',c.academic_year_id,
          'program_id',c.program_id,
          'program_name',p.name_th,
          'grade_code',c.grade_code,
          'grade_label',c.grade_label,
          'section_label',c.section_label,
          'room_name',c.room_name,
          'source_type',c.source_type,
          'is_active',c.is_active,
          'sort_order',c.sort_order
        ) order by c.sort_order,c.grade_label,c.section_label
      )
      from public.lao_class_sections c
      left join public.lao_academic_programs p on p.id=c.program_id
      where c.school_id=p_school_id
        and c.academic_year_id=v_year_id
    ),'[]'::jsonb),
    'subjects',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',s.id,
          'subject_code',s.subject_code,
          'name_th',s.name_th,
          'name_en',s.name_en,
          'learning_area',s.learning_area,
          'subject_type',s.subject_type,
          'is_active',s.is_active,
          'sort_order',s.sort_order
        ) order by s.sort_order,coalesce(s.subject_code,''),s.name_th
      )
      from public.lao_subjects s
      where s.school_id=p_school_id
    ),'[]'::jsonb),
    'courses',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',c.id,
          'academic_year_id',c.academic_year_id,
          'program_id',c.program_id,
          'program_name',p.name_th,
          'grade_code',c.grade_code,
          'grade_label',c.grade_label,
          'subject_id',c.subject_id,
          'subject_code',s.subject_code,
          'subject_name',s.name_th,
          'learning_area',s.learning_area,
          'subject_type',s.subject_type,
          'annual_hours',c.annual_hours,
          'credits',c.credits,
          'notes',c.notes,
          'is_active',c.is_active,
          'sort_order',c.sort_order,
          'term_plans',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id',ctp.id,
                'term_id',ctp.term_id,
                'term_no',t.term_no,
                'term_name',coalesce(t.name,'ภาคเรียนที่ '||t.term_no),
                'weekly_periods',ctp.weekly_periods,
                'term_hours',ctp.term_hours,
                'notes',ctp.notes
              ) order by t.term_no
            )
            from public.lao_course_term_plans ctp
            join public.lao_terms t on t.id=ctp.term_id
            where ctp.course_id=c.id
          ),'[]'::jsonb)
        ) order by c.sort_order,c.grade_label,coalesce(s.subject_code,''),s.name_th
      )
      from public.lao_curriculum_courses c
      join public.lao_subjects s on s.id=c.subject_id
      left join public.lao_academic_programs p on p.id=c.program_id
      where c.school_id=p_school_id
        and c.academic_year_id=v_year_id
    ),'[]'::jsonb),
    'stats',jsonb_build_object(
      'years',(select count(*) from public.lao_academic_years where school_id=p_school_id),
      'terms',(select count(*) from public.lao_terms t join public.lao_academic_years ay on ay.id=t.academic_year_id where ay.school_id=p_school_id),
      'programs',(select count(*) from public.lao_academic_programs where school_id=p_school_id and is_active),
      'classes',(select count(*) from public.lao_class_sections where school_id=p_school_id and academic_year_id=v_year_id and is_active),
      'subjects',(select count(*) from public.lao_subjects where school_id=p_school_id and is_active),
      'courses',(select count(*) from public.lao_curriculum_courses where school_id=p_school_id and academic_year_id=v_year_id and is_active)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.lao_academic_structure(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid) to authenticated;

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
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
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
$$;

revoke all on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) from public,anon;
grant execute on function public.lao_save_academic_year(uuid,uuid,integer,date,date,boolean) to authenticated;

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
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_year integer;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
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
$$;

revoke all on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) from public,anon;
grant execute on function public.lao_save_term(uuid,uuid,uuid,smallint,text,date,date,boolean) to authenticated;

create or replace function public.lao_save_academic_program(
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
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if nullif(btrim(p_name_th),'') is null then raise exception 'กรุณาระบุชื่อหลักสูตร/โปรแกรม'; end if;
  select organization_id into v_org from public.lao_schools where id=p_school_id;

  if p_program_id is null then
    insert into public.lao_academic_programs(
      school_id,code,name_th,name_en,description,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,upper(nullif(btrim(p_code),'')),btrim(p_name_th),nullif(btrim(p_name_en),''),
      nullif(btrim(p_description),''),p_is_active,coalesce(p_sort_order,0),v_uid,v_uid
    ) returning id into v_id;
    v_action:='academic_program_created';
  else
    update public.lao_academic_programs
    set code=upper(nullif(btrim(p_code),'')),
        name_th=btrim(p_name_th),
        name_en=nullif(btrim(p_name_en),''),
        description=nullif(btrim(p_description),''),
        is_active=p_is_active,
        sort_order=coalesce(p_sort_order,0),
        updated_by=v_uid
    where id=p_program_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Program not found'; end if;
    v_action:='academic_program_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'academic_program',v_id::text,
    jsonb_build_object('code',upper(nullif(btrim(p_code),'')),'name_th',btrim(p_name_th),'is_active',p_is_active)
  );

  return jsonb_build_object('id',v_id);
exception
  when unique_violation then
    raise exception 'รหัสหรือชื่อหลักสูตร/โปรแกรมซ้ำกับข้อมูลที่มีอยู่';
end;
$$;

revoke all on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) from public,anon;
grant execute on function public.lao_save_academic_program(uuid,uuid,text,text,text,text,boolean,integer) to authenticated;

create or replace function public.lao_save_class_section(
  p_school_id uuid,
  p_class_section_id uuid default null,
  p_academic_year_id uuid default null,
  p_program_id uuid default null,
  p_grade_code text default null,
  p_grade_label text default null,
  p_section_label text default null,
  p_room_name text default null,
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if nullif(btrim(p_grade_label),'') is null then raise exception 'กรุณาระบุระดับชั้น'; end if;
  if nullif(btrim(p_section_label),'') is null then raise exception 'กรุณาระบุห้อง'; end if;

  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;
  select organization_id into v_org from public.lao_schools where id=p_school_id;

  if p_class_section_id is null then
    insert into public.lao_class_sections(
      school_id,academic_year_id,program_id,grade_code,grade_label,section_label,room_name,
      source_type,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,upper(nullif(btrim(p_grade_code),'')),
      btrim(p_grade_label),btrim(p_section_label),nullif(btrim(p_room_name),''),
      'manual',p_is_active,coalesce(p_sort_order,0),v_uid,v_uid
    ) returning id into v_id;
    v_action:='class_section_created';
  else
    update public.lao_class_sections
    set academic_year_id=p_academic_year_id,
        program_id=p_program_id,
        grade_code=upper(nullif(btrim(p_grade_code),'')),
        grade_label=btrim(p_grade_label),
        section_label=btrim(p_section_label),
        room_name=nullif(btrim(p_room_name),''),
        is_active=p_is_active,
        sort_order=coalesce(p_sort_order,0),
        updated_by=v_uid
    where id=p_class_section_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Class section not found'; end if;
    v_action:='class_section_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'class_section',v_id::text,
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,'program_id',p_program_id,
      'grade_code',upper(nullif(btrim(p_grade_code),'')),
      'grade_label',btrim(p_grade_label),'section_label',btrim(p_section_label),'is_active',p_is_active
    )
  );

  return jsonb_build_object('id',v_id);
exception
  when unique_violation then
    raise exception 'มีระดับชั้น/ห้องนี้อยู่แล้วในปีการศึกษาและโปรแกรมที่เลือก';
end;
$$;

revoke all on function public.lao_save_class_section(uuid,uuid,uuid,uuid,text,text,text,text,boolean,integer) from public,anon;
grant execute on function public.lao_save_class_section(uuid,uuid,uuid,uuid,text,text,text,text,boolean,integer) to authenticated;

create or replace function public.lao_save_subject(
  p_school_id uuid,
  p_subject_id uuid default null,
  p_subject_code text default null,
  p_name_th text default null,
  p_name_en text default null,
  p_learning_area text default null,
  p_subject_type text default 'basic',
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if nullif(btrim(p_name_th),'') is null then raise exception 'กรุณาระบุชื่อรายวิชา'; end if;
  if p_subject_type not in ('basic','additional','activity','other') then raise exception 'ประเภทรายวิชาไม่ถูกต้อง'; end if;
  select organization_id into v_org from public.lao_schools where id=p_school_id;

  if p_subject_id is null then
    insert into public.lao_subjects(
      school_id,subject_code,name_th,name_en,learning_area,subject_type,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,upper(nullif(btrim(p_subject_code),'')),btrim(p_name_th),nullif(btrim(p_name_en),''),
      nullif(btrim(p_learning_area),''),p_subject_type,p_is_active,coalesce(p_sort_order,0),v_uid,v_uid
    ) returning id into v_id;
    v_action:='subject_created';
  else
    update public.lao_subjects
    set subject_code=upper(nullif(btrim(p_subject_code),'')),
        name_th=btrim(p_name_th),
        name_en=nullif(btrim(p_name_en),''),
        learning_area=nullif(btrim(p_learning_area),''),
        subject_type=p_subject_type,
        is_active=p_is_active,
        sort_order=coalesce(p_sort_order,0),
        updated_by=v_uid
    where id=p_subject_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Subject not found'; end if;
    v_action:='subject_updated';
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'subject',v_id::text,
    jsonb_build_object('subject_code',upper(nullif(btrim(p_subject_code),'')),'name_th',btrim(p_name_th),'subject_type',p_subject_type,'is_active',p_is_active)
  );

  return jsonb_build_object('id',v_id);
exception
  when unique_violation then
    raise exception 'รหัสรายวิชาซ้ำกับข้อมูลที่มีอยู่';
end;
$$;

revoke all on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) from public,anon;
grant execute on function public.lao_save_subject(uuid,uuid,text,text,text,text,text,boolean,integer) to authenticated;

create or replace function public.lao_save_curriculum_course(
  p_school_id uuid,
  p_course_id uuid default null,
  p_academic_year_id uuid default null,
  p_program_id uuid default null,
  p_grade_code text default null,
  p_grade_label text default null,
  p_subject_id uuid default null,
  p_annual_hours numeric default null,
  p_credits numeric default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_sort_order integer default 0,
  p_term_plans jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_org uuid;
  v_action text;
  v_plan jsonb;
  v_term_id uuid;
  v_weekly numeric;
  v_term_hours numeric;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if nullif(btrim(p_grade_label),'') is null then raise exception 'กรุณาระบุระดับชั้น'; end if;
  if p_annual_hours is not null and p_annual_hours<0 then raise exception 'ชั่วโมงต่อปีต้องไม่ติดลบ'; end if;
  if p_credits is not null and p_credits<0 then raise exception 'หน่วยกิตต้องไม่ติดลบ'; end if;

  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;
  if not exists(select 1 from public.lao_subjects where id=p_subject_id and school_id=p_school_id) then
    raise exception 'Subject not found';
  end if;
  select organization_id into v_org from public.lao_schools where id=p_school_id;

  if p_course_id is null then
    insert into public.lao_curriculum_courses(
      school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
      annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,upper(nullif(btrim(p_grade_code),'')),
      btrim(p_grade_label),p_subject_id,p_annual_hours,p_credits,nullif(btrim(p_notes),''),
      p_is_active,coalesce(p_sort_order,0),v_uid,v_uid
    ) returning id into v_id;
    v_action:='curriculum_course_created';
  else
    update public.lao_curriculum_courses
    set academic_year_id=p_academic_year_id,
        program_id=p_program_id,
        grade_code=upper(nullif(btrim(p_grade_code),'')),
        grade_label=btrim(p_grade_label),
        subject_id=p_subject_id,
        annual_hours=p_annual_hours,
        credits=p_credits,
        notes=nullif(btrim(p_notes),''),
        is_active=p_is_active,
        sort_order=coalesce(p_sort_order,0),
        updated_by=v_uid
    where id=p_course_id and school_id=p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'Course not found'; end if;
    v_action:='curriculum_course_updated';
  end if;

  delete from public.lao_course_term_plans where course_id=v_id;

  if jsonb_typeof(coalesce(p_term_plans,'[]'::jsonb))<>'array' then
    raise exception 'Term plans must be an array';
  end if;

  for v_plan in select * from jsonb_array_elements(coalesce(p_term_plans,'[]'::jsonb))
  loop
    v_term_id:=nullif(v_plan->>'term_id','')::uuid;
    v_weekly:=nullif(v_plan->>'weekly_periods','')::numeric;
    v_term_hours:=nullif(v_plan->>'term_hours','')::numeric;

    if v_weekly is not null and v_weekly<0 then raise exception 'คาบต่อสัปดาห์ต้องไม่ติดลบ'; end if;
    if v_term_hours is not null and v_term_hours<0 then raise exception 'ชั่วโมงต่อภาคเรียนต้องไม่ติดลบ'; end if;

    if v_term_id is not null then
      if not exists(
        select 1
        from public.lao_terms t
        where t.id=v_term_id and t.academic_year_id=p_academic_year_id
      ) then
        raise exception 'Term does not belong to selected academic year';
      end if;

      if v_weekly is not null or v_term_hours is not null or nullif(btrim(v_plan->>'notes'),'') is not null then
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        ) values(
          v_id,v_term_id,v_weekly,v_term_hours,nullif(btrim(v_plan->>'notes'),''),v_uid,v_uid
        );
      end if;
    end if;
  end loop;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'curriculum_course',v_id::text,
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,'program_id',p_program_id,'grade_label',btrim(p_grade_label),
      'subject_id',p_subject_id,'annual_hours',p_annual_hours,'credits',p_credits,'term_plans',coalesce(p_term_plans,'[]'::jsonb),'is_active',p_is_active
    )
  );

  return jsonb_build_object('id',v_id);
exception
  when unique_violation then
    raise exception 'รายวิชานี้ถูกกำหนดไว้แล้วในระดับชั้น/โปรแกรมที่เลือก';
end;
$$;

revoke all on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) from public,anon;
grant execute on function public.lao_save_curriculum_course(uuid,uuid,uuid,uuid,text,text,uuid,numeric,numeric,text,boolean,integer,jsonb) to authenticated;

-- Backfill annual class sections from existing LEC enrollments. This does not invent program information.
insert into public.lao_class_sections(
  school_id,academic_year_id,program_id,grade_code,grade_label,section_label,room_name,
  source_type,is_active,sort_order
)
select distinct
  e.school_id,
  e.academic_year_id,
  null,
  case
    when e.grade_level ~ '^อนุบาล[[:space:]]*1$' then 'K1'
    when e.grade_level ~ '^อนุบาล[[:space:]]*2$' then 'K2'
    when e.grade_level ~ '^อนุบาล[[:space:]]*3$' then 'K3'
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*1$' then 'P1'
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*2$' then 'P2'
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*3$' then 'P3'
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*4$' then 'P4'
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*5$' then 'P5'
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*6$' then 'P6'
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*1$' then 'M1'
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*2$' then 'M2'
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*3$' then 'M3'
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*4$' then 'M4'
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*5$' then 'M5'
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*6$' then 'M6'
    else null
  end,
  btrim(e.grade_level),
  btrim(e.classroom),
  null,
  'lec',
  true,
  case
    when e.grade_level ~ '^อนุบาล[[:space:]]*1$' then 10
    when e.grade_level ~ '^อนุบาล[[:space:]]*2$' then 20
    when e.grade_level ~ '^อนุบาล[[:space:]]*3$' then 30
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*1$' then 40
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*2$' then 50
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*3$' then 60
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*4$' then 70
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*5$' then 80
    when e.grade_level ~ '^ประถมศึกษาปีที่[[:space:]]*6$' then 90
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*1$' then 100
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*2$' then 110
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*3$' then 120
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*4$' then 130
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*5$' then 140
    when e.grade_level ~ '^มัธยมศึกษาปีที่[[:space:]]*6$' then 150
    else 900
  end
from public.lao_student_term_enrollments e
where nullif(btrim(e.grade_level),'') is not null
  and nullif(btrim(e.classroom),'') is not null
on conflict do nothing;
