-- 0078_annual_program_selection_and_timeframe_flow.sql
-- Separate school program master data from annual program selection,
-- and expose time frames as their own annual academic workflow step.

begin;

create table if not exists public.lao_academic_year_programs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid not null references public.lao_academic_programs(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_year_id,program_id)
);

create index if not exists lao_academic_year_programs_school_year_idx
  on public.lao_academic_year_programs(school_id,academic_year_id,is_active,program_id);

drop trigger if exists lao_academic_year_programs_touch on public.lao_academic_year_programs;
create trigger lao_academic_year_programs_touch
before update on public.lao_academic_year_programs
for each row execute function public.lao_touch_updated_at();

alter table public.lao_academic_year_programs enable row level security;
revoke all on public.lao_academic_year_programs from public,anon,authenticated;

-- Preserve the current behavior for the active academic year, and infer
-- historical annual use from real references.
insert into public.lao_academic_year_programs(
  school_id,academic_year_id,program_id,is_active,created_by,updated_by
)
select distinct x.school_id,x.academic_year_id,x.program_id,true,null::uuid,null::uuid
from (
  select c.school_id,c.academic_year_id,c.program_id
  from public.lao_class_sections c
  where c.program_id is not null
  union
  select c.school_id,c.academic_year_id,c.program_id
  from public.lao_curriculum_courses c
  where c.program_id is not null
  union
  select f.school_id,f.academic_year_id,f.program_id
  from public.lao_academic_time_frames f
  where f.program_id is not null
  union
  select ay.school_id,ay.id,p.id
  from public.lao_academic_years ay
  join public.lao_academic_programs p
    on p.school_id=ay.school_id and p.is_active
  where ay.is_current
) x
join public.lao_academic_programs p
  on p.id=x.program_id and p.school_id=x.school_id
join public.lao_academic_years ay
  on ay.id=x.academic_year_id and ay.school_id=x.school_id
on conflict(academic_year_id,program_id) do update set
  is_active=true,
  updated_at=now();

create or replace function public.lao_academic_year_program_enabled(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select p_program_id is null
  or exists(
    select 1
    from public.lao_academic_year_programs yp
    join public.lao_academic_programs p on p.id=yp.program_id
    where yp.school_id=p_school_id
      and yp.academic_year_id=p_academic_year_id
      and yp.program_id=p_program_id
      and yp.is_active
      and p.school_id=p_school_id
      and p.is_active
  );
$$;

revoke all on function public.lao_academic_year_program_enabled(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.lao_set_academic_year_program(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_program_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_org uuid;
  v_year integer;
  v_program_name text;
  v_class_count int:=0;
  v_course_count int:=0;
  v_frame_count int:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.programs','edit') then
    raise exception 'ไม่มีสิทธิ์กำหนดโปรแกรมที่ใช้ในปีการศึกษา';
  end if;

  select ay.year_be,s.organization_id
  into v_year,v_org
  from public.lao_academic_years ay
  join public.lao_schools s on s.id=ay.school_id
  where ay.id=p_academic_year_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'Academic year not found'; end if;

  select name_th into v_program_name
  from public.lao_academic_programs
  where id=p_program_id and school_id=p_school_id and is_active;
  if v_program_name is null then
    raise exception 'ไม่พบโปรแกรมของโรงเรียนที่เลือก หรือโปรแกรมถูกปิดใช้งาน';
  end if;

  if coalesce(p_enabled,false) then
    insert into public.lao_academic_year_programs(
      school_id,academic_year_id,program_id,is_active,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,true,v_uid,v_uid
    )
    on conflict(academic_year_id,program_id) do update set
      school_id=excluded.school_id,
      is_active=true,
      updated_by=v_uid,
      updated_at=now();
  else
    select count(*)::int into v_class_count
    from public.lao_class_sections
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id=p_program_id and is_active;

    select count(*)::int into v_course_count
    from public.lao_curriculum_courses
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id=p_program_id and is_active;

    select count(*)::int into v_frame_count
    from public.lao_academic_time_frames
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id=p_program_id and is_active;

    if v_class_count>0 or v_course_count>0 or v_frame_count>0 then
      raise exception
        'ยังยกเลิกโปรแกรม % จากปี % ไม่ได้ เพราะมีข้อมูลเชื่อมโยง: ห้อง % รายการ · รายวิชา % รายการ · กรอบเวลา % รายการ',
        v_program_name,v_year,v_class_count,v_course_count,v_frame_count;
    end if;

    update public.lao_academic_year_programs
    set is_active=false,updated_by=v_uid,updated_at=now()
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id=p_program_id;
  end if;

  -- Any selection change requires a fresh annual confirmation.
  delete from public.lao_academic_year_setup_progress
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and step_code='programs';

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case when coalesce(p_enabled,false)
      then 'academic_year_program_enabled'
      else 'academic_year_program_disabled'
    end,
    'academic_year_program',
    p_academic_year_id::text||':'||p_program_id::text,
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,
      'year_be',v_year,
      'program_id',p_program_id,
      'program_name',v_program_name,
      'enabled',coalesce(p_enabled,false)
    )
  );

  return jsonb_build_object(
    'academic_year_id',p_academic_year_id,
    'program_id',p_program_id,
    'enabled',coalesce(p_enabled,false)
  );
end;
$function$;

revoke all on function public.lao_set_academic_year_program(uuid,uuid,uuid,boolean)
  from public,anon;
grant execute on function public.lao_set_academic_year_program(uuid,uuid,uuid,boolean)
  to authenticated;

create or replace function public.lao_confirm_academic_year_programs(
  p_school_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_org uuid;
  v_year integer;
  v_count int:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_has_work_permission(p_school_id,'academics.programs','edit') then
    raise exception 'ไม่มีสิทธิ์ยืนยันโปรแกรมที่ใช้ในปีการศึกษา';
  end if;

  select ay.year_be,s.organization_id into v_year,v_org
  from public.lao_academic_years ay
  join public.lao_schools s on s.id=ay.school_id
  where ay.id=p_academic_year_id and ay.school_id=p_school_id;
  if v_year is null then raise exception 'Academic year not found'; end if;

  select count(*)::int into v_count
  from public.lao_academic_year_programs
  where school_id=p_school_id and academic_year_id=p_academic_year_id and is_active;

  insert into public.lao_academic_year_setup_progress(
    school_id,academic_year_id,step_code,status,updated_by,updated_at
  ) values(
    p_school_id,p_academic_year_id,'programs','confirmed',v_uid,now()
  )
  on conflict(school_id,academic_year_id,step_code) do update set
    status='confirmed',
    updated_by=v_uid,
    updated_at=now();

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    'academic_year_programs_confirmed',
    'academic_year_programs',
    p_academic_year_id::text,
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,
      'year_be',v_year,
      'selected_program_count',v_count
    )
  );

  return jsonb_build_object(
    'academic_year_id',p_academic_year_id,
    'selected_program_count',v_count,
    'confirmed',true
  );
end;
$function$;

revoke all on function public.lao_confirm_academic_year_programs(uuid,uuid)
  from public,anon;
grant execute on function public.lao_confirm_academic_year_programs(uuid,uuid)
  to authenticated;

create or replace function public.lao_school_program_library(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  return jsonb_build_object(
    'can_manage',public.lao_has_work_permission(p_school_id,'academics.programs','edit'),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'code',p.code,
        'name_th',p.name_th,
        'name_en',p.name_en,
        'description',p.description,
        'is_active',p.is_active,
        'sort_order',p.sort_order,
        'annual_use_count',(
          select count(*)::int
          from public.lao_academic_year_programs yp
          where yp.school_id=p_school_id and yp.program_id=p.id and yp.is_active
        )
      ) order by p.sort_order,p.name_th)
      from public.lao_academic_programs p
      where p.school_id=p_school_id
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.lao_school_program_library(uuid) from public,anon;
grant execute on function public.lao_school_program_library(uuid) to authenticated;

-- Block disabling a master program while it is selected by any academic year.
alter function public.lao_save_academic_program(
  uuid,uuid,text,text,text,text,boolean,integer
) rename to lao_save_academic_program_base_v01916_year_guard;

revoke all on function public.lao_save_academic_program_base_v01916_year_guard(
  uuid,uuid,text,text,text,text,boolean,integer
) from public,anon,authenticated;

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
  if p_program_id is not null and not coalesce(p_is_active,true) and exists(
    select 1
    from public.lao_academic_year_programs yp
    where yp.school_id=p_school_id and yp.program_id=p_program_id and yp.is_active
  ) then
    raise exception 'ยังปิดโปรแกรมนี้ไม่ได้ เพราะมีปีการศึกษาที่เลือกใช้งานอยู่ กรุณายกเลิกจาก “โปรแกรมที่ใช้ในปีนี้” ก่อน';
  end if;

  return public.lao_save_academic_program_base_v01916_year_guard(
    p_school_id,p_program_id,p_code,p_name_th,p_name_en,p_description,p_is_active,p_sort_order
  );
end;
$function$;

revoke all on function public.lao_save_academic_program(
  uuid,uuid,text,text,text,text,boolean,integer
) from public,anon;
grant execute on function public.lao_save_academic_program(
  uuid,uuid,text,text,text,text,boolean,integer
) to authenticated;

-- Integrity guard: annual data cannot reference a program that was not selected
-- for that academic year.
create or replace function public.lao_guard_annual_program_reference()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  if new.program_id is null then return new; end if;
  if not public.lao_academic_year_program_enabled(
    new.school_id,new.academic_year_id,new.program_id
  ) then
    raise exception 'โปรแกรมนี้ยังไม่ได้ถูกเลือกใช้ในปีการศึกษานี้';
  end if;
  return new;
end;
$function$;

drop trigger if exists lao_class_sections_program_year_guard on public.lao_class_sections;
create trigger lao_class_sections_program_year_guard
before insert or update of school_id,academic_year_id,program_id
on public.lao_class_sections
for each row execute function public.lao_guard_annual_program_reference();

drop trigger if exists lao_curriculum_courses_program_year_guard on public.lao_curriculum_courses;
create trigger lao_curriculum_courses_program_year_guard
before insert or update of school_id,academic_year_id,program_id
on public.lao_curriculum_courses
for each row execute function public.lao_guard_annual_program_reference();

drop trigger if exists lao_academic_time_frames_program_year_guard on public.lao_academic_time_frames;
create trigger lao_academic_time_frames_program_year_guard
before insert or update of school_id,academic_year_id,program_id
on public.lao_academic_time_frames
for each row execute function public.lao_guard_annual_program_reference();

-- Annual academic structure now returns the school master program library and
-- the subset selected for the chosen year separately.
alter function public.lao_academic_structure(uuid,uuid)
  rename to lao_academic_structure_base_v01916_annual_programs;

revoke all on function public.lao_academic_structure_base_v01916_annual_programs(uuid,uuid)
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
  v_base jsonb;
  v_year_id uuid;
  v_programs jsonb:='[]'::jsonb;
  v_year_programs jsonb:='[]'::jsonb;
  v_selected_count int:=0;
  v_confirmed boolean:=false;
begin
  v_base:=public.lao_academic_structure_base_v01916_annual_programs(
    p_school_id,p_academic_year_id
  );
  v_year_id:=nullif(v_base->>'selected_year_id','')::uuid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'code',p.code,
    'name_th',p.name_th,
    'name_en',p.name_en,
    'description',p.description,
    'is_active',p.is_active,
    'sort_order',p.sort_order,
    'selected_for_year',case when v_year_id is null then false else exists(
      select 1
      from public.lao_academic_year_programs yp
      where yp.school_id=p_school_id
        and yp.academic_year_id=v_year_id
        and yp.program_id=p.id
        and yp.is_active
    ) end
  ) order by p.sort_order,p.name_th),'[]'::jsonb)
  into v_programs
  from public.lao_academic_programs p
  where p.school_id=p_school_id;

  if v_year_id is not null then
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'id',p.id,
        'code',p.code,
        'name_th',p.name_th,
        'name_en',p.name_en,
        'description',p.description,
        'is_active',p.is_active,
        'sort_order',p.sort_order,
        'selected_for_year',true
      ) order by p.sort_order,p.name_th),'[]'::jsonb),
      count(*)::int
    into v_year_programs,v_selected_count
    from public.lao_academic_year_programs yp
    join public.lao_academic_programs p
      on p.id=yp.program_id and p.school_id=yp.school_id
    where yp.school_id=p_school_id
      and yp.academic_year_id=v_year_id
      and yp.is_active
      and p.is_active;

    select exists(
      select 1
      from public.lao_academic_year_setup_progress sp
      where sp.school_id=p_school_id
        and sp.academic_year_id=v_year_id
        and sp.step_code='programs'
        and sp.status='confirmed'
    ) into v_confirmed;
  end if;

  v_base:=jsonb_set(v_base,'{programs}',v_programs,true);
  v_base:=v_base||jsonb_build_object(
    'year_programs',v_year_programs,
    'annual_programs_confirmed',v_confirmed,
    'annual_program_count',v_selected_count
  );

  if v_base ? 'stats' then
    v_base:=jsonb_set(
      v_base,'{stats,programs}',to_jsonb(v_selected_count),true
    );
  end if;

  return v_base;
end;
$function$;

revoke all on function public.lao_academic_structure(uuid,uuid) from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid) to authenticated;

-- Rebuild the yearly timeline as:
-- basic settings -> annual programs -> time frames -> classes -> subjects -> workload.
alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01916_annual_programs;

revoke all on function public.lao_academic_year_setup_timeline_base_v01916_annual_programs(uuid,uuid)
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
  v_year_id uuid;
  v_year_starts date;
  v_year_ends date;
  v_term_count int:=0;
  v_dated_term_count int:=0;
  v_master_program_count int:=0;
  v_selected_program_count int:=0;
  v_programs_confirmed boolean:=false;
  v_default_frame boolean:=false;
  v_special_frame_count int:=0;
  v_raw jsonb:='[]'::jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
  v_code text;
  v_status text;
  v_first_pending int;
  v_completed int:=0;
  v_skipped int:=0;
  v_not_applicable int:=0;
  v_applicable int:=0;
  v_pct int:=0;
  v_next jsonb:=null;
  v_period_pct int:=0;
begin
  v_base:=public.lao_academic_year_setup_timeline_base_v01916_annual_programs(
    p_school_id,p_academic_year_id
  );
  v_year_id:=nullif(v_base->>'academic_year_id','')::uuid;
  if v_year_id is null then return v_base; end if;

  select starts_on,ends_on into v_year_starts,v_year_ends
  from public.lao_academic_years
  where id=v_year_id and school_id=p_school_id;

  select
    count(*)::int,
    count(*) filter(where starts_on is not null and ends_on is not null)::int
  into v_term_count,v_dated_term_count
  from public.lao_terms
  where academic_year_id=v_year_id;

  select count(*)::int into v_master_program_count
  from public.lao_academic_programs
  where school_id=p_school_id and is_active;

  select count(*)::int into v_selected_program_count
  from public.lao_academic_year_programs
  where school_id=p_school_id and academic_year_id=v_year_id and is_active;

  select exists(
    select 1 from public.lao_academic_year_setup_progress
    where school_id=p_school_id and academic_year_id=v_year_id
      and step_code='programs' and status='confirmed'
  ) into v_programs_confirmed;

  select exists(
    select 1 from public.lao_academic_time_frames
    where school_id=p_school_id and academic_year_id=v_year_id
      and is_active and is_default
  ) into v_default_frame;

  select count(*)::int into v_special_frame_count
  from public.lao_academic_time_frames
  where school_id=p_school_id and academic_year_id=v_year_id
    and is_active and not is_default;

  v_period_pct:=
    25
    +case when v_year_starts is not null and v_year_ends is not null then 25 else 0 end
    +case when v_term_count>0 then 25 else 0 end
    +case when v_term_count>0 and v_dated_term_count=v_term_count then 25 else 0 end;

  for v_step in
    select value
    from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
    order by (value->>'sequence_no')::int
  loop
    v_code:=v_step->>'step_code';
    if v_code not in ('periods','programs','classes','subjects','workload') then
      continue;
    end if;

    v_status:=coalesce(v_step->>'status','queued');
    if v_status in ('current','queued') then v_status:='pending'; end if;

    if v_code='periods' then
      v_status:=case
        when v_term_count>0
          and v_year_starts is not null and v_year_ends is not null
          and v_dated_term_count=v_term_count
          then 'completed'
        else 'pending'
      end;
      v_step:=v_step||jsonb_build_object(
        'sequence_no',1,
        'title','ปีการศึกษา / ภาคเรียน / ปฏิทิน',
        'description','กำหนดช่วงวันของปีการศึกษาและภาคเรียนให้เรียบร้อยก่อนเลือกโปรแกรมและกรอบเวลา',
        'route','#/academics/periods',
        'step_progress_percent',v_period_pct,
        'step_progress_label',case
          when v_status='completed' then 'ปีการศึกษา ภาคเรียน และช่วงปฏิทินพร้อมแล้ว'
          when v_term_count=0 then 'ยังไม่มีภาคเรียน'
          when v_year_starts is null or v_year_ends is null then 'รอกำหนดช่วงวันของปีการศึกษา'
          else 'รอกำหนดช่วงวันของทุกภาคเรียน'
        end
      );
    elsif v_code='programs' then
      v_status:=case
        when v_master_program_count=0 then 'not_applicable'
        when v_programs_confirmed then 'completed'
        else 'pending'
      end;
      v_step:=v_step||jsonb_build_object(
        'sequence_no',2,
        'title','โปรแกรมที่ใช้ในปีนี้',
        'description','เลือกจากคลังโปรแกรมของโรงเรียนว่าปีการศึกษานี้ใช้โปรแกรมใดบ้าง',
        'route','#/academics/programs',
        'step_progress_percent',case
          when v_master_program_count=0 or v_programs_confirmed then 100
          when v_selected_program_count>0 then 75
          else 25
        end,
        'step_progress_label',case
          when v_master_program_count=0 then 'โรงเรียนยังไม่มีโปรแกรมพิเศษ'
          when v_programs_confirmed and v_selected_program_count=0 then 'ยืนยันแล้วว่าไม่ใช้โปรแกรมพิเศษในปีนี้'
          when v_programs_confirmed then 'ยืนยันโปรแกรมที่ใช้ในปีนี้แล้ว '||v_selected_program_count||' โปรแกรม'
          when v_selected_program_count>0 then 'เลือกไว้แล้ว '||v_selected_program_count||' โปรแกรม · รอยืนยัน'
          else 'รอเลือกและยืนยันโปรแกรมที่ใช้ในปีนี้'
        end
      );
    elsif v_code='classes' then
      v_step:=v_step||jsonb_build_object(
        'sequence_no',4,
        'title','ชั้น/ห้องและการผูกโปรแกรม',
        'route','#/academics/classes'
      );
    elsif v_code='subjects' then
      v_step:=v_step||jsonb_build_object(
        'sequence_no',5,
        'title','โครงสร้างหลักสูตรและเวลาเรียน',
        'route','#/academics/subjects'
      );
    elsif v_code='workload' then
      v_step:=v_step||jsonb_build_object(
        'sequence_no',6,
        'route','#/academics/workload'
      );
    end if;

    v_raw:=v_raw||jsonb_build_array(
      v_step||jsonb_build_object('_normalized_status',v_status)
    );

    if v_code='programs' then
      v_raw:=v_raw||jsonb_build_array(jsonb_build_object(
        'step_code','time_frames',
        'sequence_no',3,
        'title','กรอบเวลาเรียนของปีนี้',
        'description','กำหนดกรอบปกติเป็นค่าเริ่มต้น และเพิ่มกรอบเฉพาะเฉพาะโปรแกรมที่ใช้เวลาแตกต่าง',
        'route','#/academics/time-frames',
        'is_required',true,
        'is_skippable',false,
        'scope_code','academics.basic_settings',
        'can_manage_step',public.lao_has_work_permission(
          p_school_id,'academics.basic_settings','edit'
        ),
        'step_progress_percent',case when v_default_frame then 100 else 0 end,
        'step_progress_label',case
          when v_default_frame
            then 'มีกรอบเริ่มต้นแล้ว · กรอบเฉพาะโปรแกรม '||v_special_frame_count||' รายการ'
          else 'รอกำหนดกรอบเวลาเรียนเริ่มต้น'
        end,
        'detail',jsonb_build_object(
          'default_frame_configured',v_default_frame,
          'selected_program_count',v_selected_program_count,
          'special_frame_count',v_special_frame_count
        ),
        '_normalized_status',case when v_default_frame then 'completed' else 'pending' end
      ));
    end if;
  end loop;

  select min((x->>'sequence_no')::int)
  into v_first_pending
  from jsonb_array_elements(v_raw) x
  where x->>'_normalized_status'='pending';

  for v_step in
    select value
    from jsonb_array_elements(v_raw)
    order by (value->>'sequence_no')::int
  loop
    v_status:=v_step->>'_normalized_status';
    if v_status='pending' then
      if (v_step->>'sequence_no')::int=v_first_pending then
        v_status:='current';
      else
        v_status:='queued';
      end if;
    end if;

    if v_status='skipped' then
      v_skipped:=v_skipped+1;
    elsif v_status='not_applicable' then
      v_not_applicable:=v_not_applicable+1;
    else
      v_applicable:=v_applicable+1;
      if v_status in ('completed','reused') then
        v_completed:=v_completed+1;
      end if;
    end if;

    if v_next is null and v_status='current' then
      v_next:=jsonb_build_object(
        'step_code',v_step->>'step_code',
        'sequence_no',(v_step->>'sequence_no')::int,
        'title',v_step->>'title',
        'description',v_step->>'description',
        'route',v_step->>'route',
        'is_required',coalesce((v_step->>'is_required')::boolean,true)
      );
    end if;

    v_steps:=v_steps||jsonb_build_array(
      (v_step-'_normalized_status')||jsonb_build_object('status',v_status)
    );
  end loop;

  v_pct:=case
    when v_applicable=0 then 100
    else round(v_completed*100.0/v_applicable)::int
  end;

  return
    (v_base
      -'steps'
      -'is_complete'
      -'completed_count'
      -'skipped_count'
      -'not_applicable_count'
      -'resolved_count'
      -'applicable_count'
      -'progress_percent'
      -'next_step')
    ||jsonb_build_object(
      'steps',v_steps,
      'is_complete',(v_applicable>0 and v_completed=v_applicable),
      'completed_count',v_completed,
      'skipped_count',v_skipped,
      'not_applicable_count',v_not_applicable,
      'resolved_count',v_completed+v_skipped+v_not_applicable,
      'applicable_count',v_applicable,
      'progress_percent',v_pct,
      'next_step',v_next,
      'annual_program_count',v_selected_program_count,
      'annual_programs_confirmed',v_programs_confirmed,
      'time_frame_ready',v_default_frame
    );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid)
  from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid)
  to authenticated;

update public.lao_work_scopes
set title_th='โปรแกรมที่ใช้ในปีการศึกษา',
    route='#/academics/programs',
    updated_at=now()
where scope_code='academics.programs';

commit;
