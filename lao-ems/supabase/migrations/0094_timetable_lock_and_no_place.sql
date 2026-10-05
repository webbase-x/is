alter table public.lao_timetable_entries
  add column if not exists is_locked boolean not null default false;

create table if not exists public.lao_timetable_slot_constraints (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.lao_timetable_versions(id) on delete cascade,
  class_section_id uuid references public.lao_class_sections(id) on delete cascade,
  personnel_id uuid references public.lao_personnel(id) on delete cascade,
  day_no smallint not null check (day_no between 1 and 7),
  period_no smallint not null check (period_no between 1 and 30),
  constraint_type text not null default 'no_place' check (constraint_type in ('no_place')),
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lao_timetable_slot_constraints_one_resource_ck
    check ((class_section_id is not null)::int + (personnel_id is not null)::int = 1)
);

create unique index if not exists lao_timetable_slot_constraints_class_uq
  on public.lao_timetable_slot_constraints(version_id,class_section_id,day_no,period_no,constraint_type)
  where class_section_id is not null;

create unique index if not exists lao_timetable_slot_constraints_personnel_uq
  on public.lao_timetable_slot_constraints(version_id,personnel_id,day_no,period_no,constraint_type)
  where personnel_id is not null;

create index if not exists lao_timetable_slot_constraints_version_idx
  on public.lao_timetable_slot_constraints(version_id);

alter table public.lao_timetable_slot_constraints enable row level security;

create or replace function public.lao_timetable_page_v2(
  p_school_id uuid,
  p_academic_year_id uuid default null::uuid,
  p_term_id uuid default null::uuid,
  p_version_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  v_page jsonb;
  v_version uuid;
  v_entries jsonb := '[]'::jsonb;
  v_constraints jsonb := '[]'::jsonb;
begin
  v_page := public.lao_timetable_page(p_school_id,p_academic_year_id,p_term_id,p_version_id);
  v_version := nullif(v_page->>'selected_version_id','')::uuid;

  if v_version is null then
    return v_page || jsonb_build_object('blocked_slots','[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    e || jsonb_build_object('is_locked',coalesce(te.is_locked,false))
    order by (e->>'day_no')::int,(e->>'period_no')::int,e->>'grade_label',e->>'section_label'
  ),'[]'::jsonb)
  into v_entries
  from jsonb_array_elements(coalesce(v_page->'entries','[]'::jsonb)) e
  left join public.lao_timetable_entries te on te.id=(e->>'id')::uuid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'version_id',c.version_id,
    'class_section_id',c.class_section_id,
    'personnel_id',c.personnel_id,
    'day_no',c.day_no,
    'period_no',c.period_no,
    'constraint_type',c.constraint_type,
    'note',c.note
  ) order by c.day_no,c.period_no,c.created_at),'[]'::jsonb)
  into v_constraints
  from public.lao_timetable_slot_constraints c
  where c.version_id=v_version and c.constraint_type='no_place';

  return jsonb_set(
    jsonb_set(v_page,'{entries}',v_entries,true),
    '{blocked_slots}',v_constraints,true
  );
end;
$function$;

create or replace function public.lao_save_timetable_version_v3(
  p_school_id uuid,
  p_term_id uuid,
  p_version_id uuid default null::uuid,
  p_version_date date default current_date,
  p_title text default null::text,
  p_note text default null::text,
  p_entries jsonb default '[]'::jsonb,
  p_activate boolean default false,
  p_grade_codes text[] default null::text[],
  p_blocked_slots jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_result jsonb;
  v_version uuid;
  v_year uuid;
  v_slot jsonb;
  v_class uuid;
  v_personnel uuid;
  v_day smallint;
  v_period smallint;
begin
  if p_blocked_slots is null or jsonb_typeof(p_blocked_slots)<>'array' then
    raise exception 'ข้อมูลช่องห้ามวางไม่ถูกต้อง';
  end if;

  v_result := public.lao_save_timetable_version_v2(
    p_school_id,p_term_id,p_version_id,p_version_date,p_title,p_note,p_entries,p_activate,p_grade_codes
  );
  v_version := (v_result->>'id')::uuid;

  select ay.id into v_year
  from public.lao_terms t
  join public.lao_academic_years ay on ay.id=t.academic_year_id
  where t.id=p_term_id and ay.school_id=p_school_id;

  update public.lao_timetable_entries te
  set is_locked=false,updated_by=v_uid,updated_at=now()
  where te.version_id=v_version;

  update public.lao_timetable_entries te
  set is_locked=true,updated_by=v_uid,updated_at=now()
  from jsonb_array_elements(p_entries) e
  where te.version_id=v_version
    and te.class_section_id=(e->>'class_section_id')::uuid
    and te.day_no=(e->>'day_no')::smallint
    and te.period_no=(e->>'period_no')::smallint
    and coalesce(nullif(e->>'is_locked','')::boolean,false);

  delete from public.lao_timetable_slot_constraints where version_id=v_version;

  for v_slot in select * from jsonb_array_elements(p_blocked_slots)
  loop
    begin
      v_class:=nullif(v_slot->>'class_section_id','')::uuid;
      v_personnel:=nullif(v_slot->>'personnel_id','')::uuid;
      v_day:=(v_slot->>'day_no')::smallint;
      v_period:=(v_slot->>'period_no')::smallint;
    exception when others then
      raise exception 'ข้อมูลช่องห้ามวางไม่ครบหรือรูปแบบไม่ถูกต้อง';
    end;

    if ((v_class is not null)::int + (v_personnel is not null)::int) <> 1 then
      raise exception 'ช่องห้ามวางต้องระบุห้องหรือครูอย่างใดอย่างหนึ่ง';
    end if;
    if v_day<1 or v_day>7 or v_period<1 or v_period>30 then
      raise exception 'วันหรือคาบของช่องห้ามวางไม่ถูกต้อง';
    end if;

    if v_class is not null then
      if not exists(
        select 1 from public.lao_class_sections cls
        where cls.id=v_class and cls.school_id=p_school_id
          and cls.academic_year_id=v_year and cls.is_active
      ) then raise exception 'พบช่องห้ามวางของห้องที่ไม่อยู่ในปีการศึกษานี้'; end if;

      if exists(
        select 1 from public.lao_timetable_entries te
        where te.version_id=v_version and te.class_section_id=v_class
          and te.day_no=v_day and te.period_no=v_period
      ) then raise exception 'ไม่สามารถกำหนดห้ามวางในช่องที่มีคาบเรียนอยู่แล้ว'; end if;
    else
      if not exists(
        select 1 from public.lao_personnel p
        where p.id=v_personnel and p.school_id=p_school_id and p.employment_status='active'
      ) then raise exception 'พบช่องห้ามวางของครูที่ไม่อยู่ในโรงเรียนนี้'; end if;

      if exists(
        select 1 from public.lao_timetable_entries te
        where te.version_id=v_version and te.personnel_id=v_personnel
          and te.day_no=v_day and te.period_no=v_period
      ) then raise exception 'ไม่สามารถกำหนดห้ามวางในช่วงเวลาที่ครูมีคาบอยู่แล้ว'; end if;
    end if;

    insert into public.lao_timetable_slot_constraints(
      version_id,class_section_id,personnel_id,day_no,period_no,constraint_type,note,created_by,updated_by
    ) values(
      v_version,v_class,v_personnel,v_day,v_period,'no_place',
      nullif(btrim(coalesce(v_slot->>'note','')),''),v_uid,v_uid
    );
  end loop;

  return v_result || jsonb_build_object(
    'blocked_slot_count',(select count(*) from public.lao_timetable_slot_constraints c where c.version_id=v_version),
    'locked_entry_count',(select count(*) from public.lao_timetable_entries e where e.version_id=v_version and e.is_locked)
  );
end;
$function$;

revoke all on function public.lao_timetable_page_v2(uuid,uuid,uuid,uuid) from public;
grant execute on function public.lao_timetable_page_v2(uuid,uuid,uuid,uuid) to authenticated;

revoke all on function public.lao_save_timetable_version_v3(uuid,uuid,uuid,date,text,text,jsonb,boolean,text[],jsonb) from public;
grant execute on function public.lao_save_timetable_version_v3(uuid,uuid,uuid,date,text,text,jsonb,boolean,text[],jsonb) to authenticated;
