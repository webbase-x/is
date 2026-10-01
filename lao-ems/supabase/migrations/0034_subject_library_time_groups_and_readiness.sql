-- Subject library, curriculum time readiness, and parallel elective groups.
-- Keeps central/school catalog items reusable while allowing per-year curriculum add/remove.

drop index if exists public.lao_subjects_school_code_uq;
create unique index if not exists lao_subjects_school_code_nonactivity_uq
  on public.lao_subjects(school_id,lower(subject_code))
  where subject_code is not null and btrim(subject_code)<>'' and subject_type<>'activity';
create unique index if not exists lao_subjects_school_code_activity_name_uq
  on public.lao_subjects(school_id,lower(subject_code),lower(name_th))
  where subject_code is not null and btrim(subject_code)<>'' and subject_type='activity';

create table if not exists public.lao_academic_schedule_settings(
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  school_days_per_week smallint not null check(school_days_per_week between 1 and 7),
  periods_per_day numeric not null check(periods_per_day>0 and periods_per_day<=20),
  minutes_per_period smallint not null check(minutes_per_period between 20 and 120),
  instructional_weeks_per_year numeric not null check(instructional_weeks_per_year>0 and instructional_weeks_per_year<=60),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(school_id,academic_year_id)
);
create table if not exists public.lao_curriculum_program_exclusions(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid not null references public.lao_academic_programs(id) on delete cascade,
  grade_code text not null,
  subject_id uuid not null references public.lao_subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create unique index if not exists lao_curriculum_program_exclusions_uq
  on public.lao_curriculum_program_exclusions(school_id,academic_year_id,program_id,grade_code,subject_id);
create table if not exists public.lao_curriculum_structure_confirmations(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete cascade,
  grade_code text not null,
  fingerprint text not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete set null
);
create unique index if not exists lao_curriculum_structure_confirmations_uq
  on public.lao_curriculum_structure_confirmations(
    school_id,academic_year_id,coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid),grade_code,fingerprint
  );
create table if not exists public.lao_curriculum_grade_initializations(
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  grade_code text not null,
  initialized_at timestamptz not null default now(),
  initialized_by uuid references auth.users(id) on delete set null,
  primary key(school_id,academic_year_id,grade_code)
);
create table if not exists public.lao_curriculum_parallel_groups(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  program_id uuid references public.lao_academic_programs(id) on delete cascade,
  grade_code text not null,
  name text not null,
  weekly_periods numeric not null check(weekly_periods>0 and weekly_periods<=20),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lao_curriculum_parallel_groups_lookup_idx
  on public.lao_curriculum_parallel_groups(school_id,academic_year_id,grade_code,program_id);
create table if not exists public.lao_curriculum_parallel_group_courses(
  group_id uuid not null references public.lao_curriculum_parallel_groups(id) on delete cascade,
  course_id uuid not null references public.lao_curriculum_courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(group_id,course_id),
  unique(course_id)
);

alter table public.lao_academic_schedule_settings enable row level security;
alter table public.lao_curriculum_program_exclusions enable row level security;
alter table public.lao_curriculum_structure_confirmations enable row level security;
alter table public.lao_curriculum_grade_initializations enable row level security;
alter table public.lao_curriculum_parallel_groups enable row level security;
alter table public.lao_curriculum_parallel_group_courses enable row level security;
revoke all on public.lao_academic_schedule_settings from public,anon,authenticated;
revoke all on public.lao_curriculum_program_exclusions from public,anon,authenticated;
revoke all on public.lao_curriculum_structure_confirmations from public,anon,authenticated;
revoke all on public.lao_curriculum_grade_initializations from public,anon,authenticated;
revoke all on public.lao_curriculum_parallel_groups from public,anon,authenticated;
revoke all on public.lao_curriculum_parallel_group_courses from public,anon,authenticated;

insert into public.lao_curriculum_grade_initializations(school_id,academic_year_id,grade_code,initialized_at)
select distinct c.school_id,c.academic_year_id,c.grade_code,now()
from public.lao_class_sections c
where c.source_type='lec' and c.is_active
  and c.grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
  and exists(
    select 1 from public.lao_curriculum_courses cc
    where cc.school_id=c.school_id and cc.academic_year_id=c.academic_year_id and cc.grade_code=c.grade_code
  )
on conflict do nothing;

CREATE OR REPLACE FUNCTION public.lao_add_curriculum_library_item(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text, p_source_kind text, p_source_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_grade_label text;
  v_subject_id uuid;
  v_subject_type text;
  v_subject_code text;
  v_subject_name text;
  v_learning_area text;
  v_weekly numeric;
  v_annual numeric;
  v_sort integer:=0;
  v_course_id uuid;
  v_term record;
  v_item record;
  v_restored boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_source_kind not in ('preset','school') then raise exception 'แหล่งรายวิชาไม่ถูกต้อง'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
    raise exception 'ระดับชั้นไม่ถูกต้อง';
  end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  select min(grade_label) into v_grade_label
  from public.lao_class_sections
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and grade_code=p_grade_code and source_type='lec' and is_active
    and program_id is not distinct from p_program_id;

  if v_grade_label is null and p_program_id is not null then
    raise exception 'ไม่พบระดับชั้นนี้ในโปรแกรมที่เลือก';
  end if;
  if v_grade_label is null then
    select min(grade_label) into v_grade_label
    from public.lao_class_sections
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and grade_code=p_grade_code and source_type='lec' and is_active;
  end if;
  if v_grade_label is null then raise exception 'ไม่พบระดับชั้นนี้จาก LEC'; end if;

  if p_source_kind='preset' then
    select * into v_item
    from public.lao_curriculum_preset_items
    where id=p_source_id and preset_code='normal_primary_example' and grade_code=p_grade_code
    limit 1;
    if v_item.id is null then raise exception 'ไม่พบรายวิชาในฐานกลาง'; end if;

    v_subject_type:=v_item.subject_type;
    v_subject_code:=nullif(btrim(v_item.subject_code),'');
    v_subject_name:=btrim(v_item.subject_name);
    v_learning_area:=v_item.learning_area;
    v_weekly:=v_item.weekly_periods;
    v_annual:=v_item.annual_hours;
    v_sort:=coalesce(v_item.sort_order,0);

    if v_subject_type='activity' and v_subject_code is not null then
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(v_subject_code)
        and lower(btrim(name_th))=lower(v_subject_name)
        and subject_type='activity'
      limit 1;
    elsif v_subject_code is not null then
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(v_subject_code)
        and subject_type<>'activity'
      limit 1;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(btrim(name_th))=lower(v_subject_name)
        and subject_type=v_subject_type
      order by is_active desc,created_at
      limit 1;
    end if;

    if v_subject_id is null then
      insert into public.lao_subjects(
        school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,v_subject_code,v_subject_name,v_learning_area,v_subject_type,true,v_sort,v_uid,v_uid
      ) returning id into v_subject_id;
    end if;
  else
    select id,subject_code,name_th,learning_area,subject_type,sort_order
    into v_subject_id,v_subject_code,v_subject_name,v_learning_area,v_subject_type,v_sort
    from public.lao_subjects
    where id=p_source_id and school_id=p_school_id and is_active;
    if v_subject_id is null then raise exception 'ไม่พบรายวิชาของสถานศึกษา'; end if;
    v_weekly:=null;
    v_annual:=null;
  end if;

  if p_program_id is not null and v_subject_type in ('basic','activity') and exists(
    select 1 from public.lao_curriculum_courses c
    where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
      and c.program_id is null and c.grade_code=p_grade_code and c.subject_id=v_subject_id and c.is_active
  ) then
    delete from public.lao_curriculum_program_exclusions
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id=p_program_id and grade_code=p_grade_code and subject_id=v_subject_id;
    v_restored:=true;
    select id into v_course_id from public.lao_curriculum_courses
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id is null and grade_code=p_grade_code and subject_id=v_subject_id and is_active
    limit 1;
  else
    select id into v_course_id
    from public.lao_curriculum_courses
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and program_id is not distinct from p_program_id
      and grade_code=p_grade_code and subject_id=v_subject_id
    limit 1;

    if v_course_id is null then
      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
        annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_grade_label,v_subject_id,
        v_annual,null,
        case when p_source_kind='preset' then 'เพิ่มจากคลังรายวิชากลาง' else 'เพิ่มจากคลังรายวิชาของสถานศึกษา' end,
        true,v_sort,v_uid,v_uid
      ) returning id into v_course_id;

      if v_weekly is not null then
        for v_term in select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
        loop
          insert into public.lao_course_term_plans(
            course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
          ) values(
            v_course_id,v_term.id,v_weekly,null,'ค่าเริ่มต้นจากคลังรายวิชา · ปรับได้ตามหลักสูตรสถานศึกษา',v_uid,v_uid
          )
          on conflict(course_id,term_id) do nothing;
        end loop;
      end if;
    end if;
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id and grade_code=p_grade_code;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case when v_restored then 'curriculum_subject_restored' else 'curriculum_subject_added' end,
    'curriculum_course',v_course_id::text,
    jsonb_build_object(
      'grade_code',p_grade_code,'program_id',p_program_id,'subject_id',v_subject_id,
      'subject_code',v_subject_code,'subject_name',v_subject_name,'source_kind',p_source_kind
    )
  );

  return jsonb_build_object(
    'course_id',v_course_id,'subject_id',v_subject_id,'restored',v_restored,
    'subject_code',v_subject_code,'subject_name',v_subject_name
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_add_subject_to_curriculum(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text, p_subject_id uuid DEFAULT NULL::uuid, p_subject_code text DEFAULT NULL::text, p_subject_name text DEFAULT NULL::text, p_learning_area text DEFAULT NULL::text, p_subject_type text DEFAULT 'basic'::text, p_weekly_periods numeric DEFAULT NULL::numeric, p_annual_hours numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_grade_label text;
  v_subject_id uuid:=p_subject_id;
  v_course_id uuid;
  v_term record;
  v_sort integer;
  v_inherited boolean:=false;
  v_subject_created boolean:=false;
  v_subject_type text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if p_grade_code not in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6') then
    raise exception 'ระดับชั้นไม่ถูกต้อง';
  end if;
  if p_subject_type not in ('basic','additional','activity','other') then
    raise exception 'ประเภทรายวิชาไม่ถูกต้อง';
  end if;
  if p_weekly_periods is not null and p_weekly_periods<=0 then raise exception 'ชั่วโมง/สัปดาห์ต้องมากกว่า 0'; end if;
  if p_annual_hours is not null and p_annual_hours<=0 then raise exception 'ชั่วโมง/ปีต้องมากกว่า 0'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id and is_active
  ) then raise exception 'Program not found'; end if;

  select min(c.grade_label) into v_grade_label
  from public.lao_class_sections c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.grade_code=p_grade_code
    and c.is_active
    and c.source_type='lec';

  if v_grade_label is null then raise exception 'ไม่พบระดับชั้นนี้จาก LEC'; end if;

  if v_subject_id is not null then
    select subject_type into v_subject_type
    from public.lao_subjects
    where id=v_subject_id and school_id=p_school_id;
    if v_subject_type is null then raise exception 'Subject not found'; end if;
  else
    if nullif(btrim(p_subject_name),'') is null then raise exception 'กรุณาระบุชื่อรายวิชา'; end if;

    if nullif(btrim(p_subject_code),'') is not null then
      if p_subject_type='activity' then
        select id into v_subject_id
        from public.lao_subjects
        where school_id=p_school_id
          and subject_type='activity'
          and lower(coalesce(subject_code,''))=lower(btrim(p_subject_code))
          and lower(btrim(name_th))=lower(btrim(p_subject_name))
        limit 1;
      else
        select id into v_subject_id
        from public.lao_subjects
        where school_id=p_school_id
          and subject_type<>'activity'
          and lower(coalesce(subject_code,''))=lower(btrim(p_subject_code))
        limit 1;
      end if;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(btrim(name_th))=lower(btrim(p_subject_name))
        and subject_type=p_subject_type
      order by is_active desc,created_at
      limit 1;
    end if;

    if v_subject_id is null then
      insert into public.lao_subjects(
        school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,upper(nullif(btrim(p_subject_code),'')),btrim(p_subject_name),
        nullif(btrim(p_learning_area),''),p_subject_type,true,0,v_uid,v_uid
      ) returning id into v_subject_id;
      v_subject_created:=true;
    end if;

    select subject_type into v_subject_type
    from public.lao_subjects where id=v_subject_id;
  end if;

  if p_program_id is not null then
    delete from public.lao_curriculum_program_exclusions
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id=p_program_id
      and grade_code=p_grade_code
      and subject_id=v_subject_id;

    if v_subject_type in ('basic','activity') and exists(
      select 1 from public.lao_curriculum_courses c
      where c.school_id=p_school_id
        and c.academic_year_id=p_academic_year_id
        and c.program_id is null
        and c.grade_code=p_grade_code
        and c.subject_id=v_subject_id
        and c.is_active
    ) then
      v_inherited:=true;
      select c.id into v_course_id
      from public.lao_curriculum_courses c
      where c.school_id=p_school_id
        and c.academic_year_id=p_academic_year_id
        and c.program_id is null
        and c.grade_code=p_grade_code
        and c.subject_id=v_subject_id
        and c.is_active
      limit 1;
    end if;
  end if;

  if not v_inherited then
    select id into v_course_id
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and program_id is not distinct from p_program_id
      and grade_code=p_grade_code
      and subject_id=v_subject_id
    limit 1;

    if v_course_id is null then
      select coalesce(max(sort_order),0)+1 into v_sort
      from public.lao_curriculum_courses
      where school_id=p_school_id
        and academic_year_id=p_academic_year_id
        and program_id is not distinct from p_program_id
        and grade_code=p_grade_code;

      insert into public.lao_curriculum_courses(
        school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
        annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
      ) values(
        p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_grade_label,v_subject_id,
        p_annual_hours,null,'เพิ่มจากคลังรายวิชา',true,v_sort,v_uid,v_uid
      ) returning id into v_course_id;
    else
      update public.lao_curriculum_courses
      set is_active=true,
          annual_hours=coalesce(annual_hours,p_annual_hours),
          updated_by=v_uid,
          updated_at=now()
      where id=v_course_id;
    end if;

    if p_weekly_periods is not null then
      for v_term in
        select id from public.lao_terms
        where academic_year_id=p_academic_year_id
        order by term_no
      loop
        insert into public.lao_course_term_plans(
          course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
        ) values(
          v_course_id,v_term.id,p_weekly_periods,null,'เพิ่มจากคลังรายวิชา',v_uid,v_uid
        )
        on conflict(course_id,term_id) do update
          set weekly_periods=coalesce(public.lao_course_term_plans.weekly_periods,excluded.weekly_periods),
              updated_by=v_uid,
              updated_at=now();
      end loop;
    end if;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_subject_added','curriculum_course',coalesce(v_course_id::text,v_subject_id::text),
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,'program_id',p_program_id,'grade_code',p_grade_code,
      'subject_id',v_subject_id,'subject_created',v_subject_created,'inherited',v_inherited
    )
  );

  return jsonb_build_object(
    'subject_id',v_subject_id,'course_id',v_course_id,
    'subject_created',v_subject_created,'inherited',v_inherited
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_confirm_curriculum_group(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_status jsonb;
  v_fingerprint text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  v_status:=public.lao_curriculum_group_status(p_school_id,p_academic_year_id,p_program_id,p_grade_code);
  if not coalesce((v_status->>'is_ready_to_confirm')::boolean,false) and not coalesce((v_status->>'is_confirmed')::boolean,false) then
    raise exception 'โครงสร้างเวลาเรียนยังไม่ครบหรือยังมีรายการที่ต้องแก้ไข';
  end if;
  v_fingerprint:=v_status->>'fingerprint';

  insert into public.lao_curriculum_structure_confirmations(
    school_id,academic_year_id,program_id,grade_code,fingerprint,confirmed_by
  ) values(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_fingerprint,v_uid
  )
  on conflict do nothing;

  return public.lao_curriculum_group_status(p_school_id,p_academic_year_id,p_program_id,p_grade_code);
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_confirm_curriculum_structure(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_status jsonb;
  v_fp text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_status:=public.lao_curriculum_group_status(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );

  if coalesce((v_status->>'course_count')::int,0)=0 then
    raise exception 'ยังไม่มีรายวิชาในโครงสร้างนี้';
  end if;
  if not coalesce((v_status->>'schedule_configured')::boolean,false) then
    raise exception 'กรุณากำหนดวันเรียน คาบต่อวัน นาทีต่อคาบ และสัปดาห์เรียนต่อปีก่อน';
  end if;
  if coalesce((v_status->>'missing_time_count')::int,0)>0 then
    raise exception 'ยังมีรายวิชา/กลุ่มวิชาที่ไม่ได้กำหนดคาบเรียน';
  end if;
  if coalesce((v_status->>'parallel_mismatch_count')::int,0)>0 then
    raise exception 'รายวิชาทางเลือกที่ใช้รหัสเดียวกันมีจำนวนคาบไม่เท่ากัน กรุณาตรวจเวลาเรียน';
  end if;
  if abs(coalesce((v_status->>'periods_per_week_gap')::numeric,999))>=0.001 then
    raise exception 'จำนวนคาบต่อสัปดาห์ยังไม่ตรงกับโครงสร้างเวลาของสถานศึกษา';
  end if;

  v_fp:=v_status->>'fingerprint';

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id
    and grade_code=p_grade_code;

  insert into public.lao_curriculum_structure_confirmations(
    school_id,academic_year_id,program_id,grade_code,fingerprint,confirmed_by
  ) values(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_fp,v_uid
  );

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_structure_confirmed','academic_year',p_academic_year_id::text,
    jsonb_build_object(
      'program_id',p_program_id,'grade_code',p_grade_code,'fingerprint',v_fp,
      'weekly_periods_total',v_status->'weekly_periods_total',
      'periods_per_week_capacity',v_status->'periods_per_week_capacity'
    )
  );

  return public.lao_curriculum_group_status(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_create_curriculum_parallel_group(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text, p_name text, p_weekly_periods numeric, p_course_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_group_id uuid;
  v_count integer;
  v_term record;
  v_course_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'กรุณาระบุชื่อกลุ่มรายวิชาทางเลือก'; end if;
  if p_weekly_periods is null or p_weekly_periods<=0 or p_weekly_periods>20 then
    raise exception 'จำนวนคาบ/สัปดาห์ไม่ถูกต้อง';
  end if;
  if coalesce(array_length(p_course_ids,1),0)<2 then
    raise exception 'กรุณาเลือกอย่างน้อย 2 รายวิชา';
  end if;

  select count(distinct c.id) into v_count
  from public.lao_curriculum_courses c
  where c.id=any(p_course_ids)
    and c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.grade_code=p_grade_code
    and c.program_id is not distinct from p_program_id
    and c.is_active;

  if v_count<>array_length(p_course_ids,1) then
    raise exception 'มีรายวิชาบางรายการไม่อยู่ในกลุ่มห้อง/ระดับชั้นที่เลือก';
  end if;

  if exists(
    select 1 from public.lao_curriculum_parallel_group_courses gc
    where gc.course_id=any(p_course_ids)
  ) then
    raise exception 'มีรายวิชาบางรายการอยู่ในกลุ่มเวลาเดียวกันแล้ว';
  end if;

  insert into public.lao_curriculum_parallel_groups(
    school_id,academic_year_id,program_id,grade_code,name,weekly_periods,created_by,updated_by
  ) values(
    p_school_id,p_academic_year_id,p_program_id,p_grade_code,btrim(p_name),p_weekly_periods,v_uid,v_uid
  ) returning id into v_group_id;

  foreach v_course_id in array p_course_ids loop
    insert into public.lao_curriculum_parallel_group_courses(group_id,course_id)
    values(v_group_id,v_course_id);

    for v_term in select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
    loop
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
      ) values(
        v_course_id,v_term.id,p_weekly_periods,null,
        'อยู่ในกลุ่มรายวิชาทางเลือก/เวลาเดียวกัน: '||btrim(p_name),v_uid,v_uid
      )
      on conflict(course_id,term_id) do update set
        weekly_periods=excluded.weekly_periods,
        notes=excluded.notes,
        updated_by=v_uid;
    end loop;
  end loop;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id and grade_code=p_grade_code;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_parallel_group_created','curriculum_parallel_group',v_group_id::text,
    jsonb_build_object('grade_code',p_grade_code,'program_id',p_program_id,'name',btrim(p_name),
      'weekly_periods',p_weekly_periods,'course_ids',to_jsonb(p_course_ids))
  );

  return jsonb_build_object('id',v_group_id,'name',btrim(p_name),'weekly_periods',p_weekly_periods);
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_curriculum_group_status(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_course_count integer:=0;
  v_basic_count integer:=0;
  v_activity_count integer:=0;
  v_additional_count integer:=0;
  v_other_count integer:=0;
  v_missing_time integer:=0;
  v_core_missing integer:=0;
  v_activity_missing integer:=0;
  v_total_hours numeric:=0;
  v_weekly_periods numeric:=0;
  v_schedule_slot_count integer:=0;
  v_parallel_variant_count integer:=0;
  v_parallel_group_count integer:=0;
  v_parallel_mismatch_count integer:=0;
  v_days smallint;
  v_periods_day numeric;
  v_minutes smallint;
  v_weeks numeric;
  v_capacity numeric:=0;
  v_period_gap numeric:=0;
  v_schedule_configured boolean:=false;
  v_fingerprint text:='';
  v_confirmed_at timestamptz;
  v_confirmed boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  select school_days_per_week,periods_per_day,minutes_per_period,instructional_weeks_per_year
  into v_days,v_periods_day,v_minutes,v_weeks
  from public.lao_academic_schedule_settings
  where school_id=p_school_id and academic_year_id=p_academic_year_id;

  v_schedule_configured:=v_days is not null and v_periods_day is not null and v_minutes is not null and v_weeks is not null;
  if v_schedule_configured then v_capacity:=v_days*v_periods_day; end if;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.sort_order,c.updated_at as course_updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,s.updated_at as subject_updated_at,
      pg.id as parallel_group_id,pg.name as parallel_group_name,pg.weekly_periods as parallel_weekly_periods,
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
              where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id and x.grade_code=p_grade_code and x.subject_id=c.subject_id
            )
          )
        ))
      )
  ),
  ranked as (
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.course_updated_at desc,e.id) as rn
    from eligible e
  ),
  eff0 as (
    select * from ranked where rn=1
  ),
  eff as (
    select e.*,
      (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id) as course_weekly_periods,
      exists(
        select 1 from public.lao_course_term_plans tp
        where tp.course_id=e.id and (tp.weekly_periods is not null or tp.term_hours is not null)
      ) as has_term_time,
      coalesce(
        e.annual_hours,
        case when v_schedule_configured then
          (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id)
          * v_minutes::numeric / 60 * v_weeks
        end
      ) as effective_annual_hours
    from eff0 e
  ),
  slots0 as (
    select
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end as schedule_key,
      max(parallel_group_id) as parallel_group_id,
      max(parallel_weekly_periods) as parallel_weekly_periods,
      max(course_weekly_periods) as course_weekly_periods,
      max(effective_annual_hours) as annual_hours,
      count(*)::int as variant_count,
      count(*) filter(where course_weekly_periods is null and not has_term_time and annual_hours is null)::int as missing_variants,
      count(distinct course_weekly_periods) filter(where course_weekly_periods is not null)::int as distinct_weekly_values,
      bool_or(course_weekly_periods is null) and bool_or(course_weekly_periods is not null) as partial_weekly,
      bool_or(
        parallel_group_id is not null and course_weekly_periods is not null
        and abs(course_weekly_periods-parallel_weekly_periods)>0.001
      ) as group_time_mismatch
    from eff
    group by
      case
        when parallel_group_id is not null then 'parallel|'||parallel_group_id::text
        when subject_type='activity' and nullif(btrim(subject_code),'') is not null
          then 'activity-code|'||lower(btrim(subject_code))
        else subject_key
      end
  ),
  slots as (
    select *,
      coalesce(parallel_weekly_periods,course_weekly_periods) as weekly_periods,
      case
        when parallel_weekly_periods is not null and v_schedule_configured
          then parallel_weekly_periods*v_minutes::numeric/60*v_weeks
        else annual_hours
      end as effective_slot_annual_hours
    from slots0
  ),
  stats as (
    select
      (select count(*)::int from eff) as course_count,
      (select count(*) filter(where subject_type='basic')::int from eff) as basic_count,
      (select count(*) filter(where subject_type='activity')::int from eff) as activity_count,
      (select count(*) filter(where subject_type='additional')::int from eff) as additional_count,
      (select count(*) filter(where subject_type='other')::int from eff) as other_count,
      (select count(*)::int from slots) as schedule_slot_count,
      (select count(distinct parallel_group_id)::int from slots where parallel_group_id is not null) as parallel_group_count,
      (select coalesce(sum(greatest(variant_count-1,0)),0)::int from slots) as parallel_variant_count,
      (select count(*)::int from slots
        where group_time_mismatch or
          (parallel_group_id is null and (distinct_weekly_values>1 or partial_weekly))
      ) as parallel_mismatch_count,
      (select count(*)::int from slots where weekly_periods is null and coalesce(effective_slot_annual_hours,0)=0) as missing_time_count,
      (select coalesce(sum(weekly_periods),0) from slots) as weekly_periods_total,
      (select coalesce(sum(effective_slot_annual_hours),0) from slots) as annual_hours_total,
      md5(
        coalesce((select string_agg(
          concat_ws('|',subject_key,subject_id::text,id::text,coalesce(subject_code,''),coalesce(subject_name,''),
            coalesce(subject_type,''),coalesce(annual_hours::text,''),coalesce(course_weekly_periods::text,''),
            coalesce(parallel_group_id::text,''),coalesce(parallel_weekly_periods::text,''),
            course_updated_at::text,subject_updated_at::text
          ),
          '||' order by subject_key
        ) from eff),'')||
        concat_ws('|','schedule',coalesce(v_days::text,''),coalesce(v_periods_day::text,''),coalesce(v_minutes::text,''),coalesce(v_weeks::text,''))
      ) as fingerprint
  )
  select course_count,basic_count,activity_count,additional_count,other_count,
         schedule_slot_count,parallel_group_count,parallel_variant_count,parallel_mismatch_count,
         missing_time_count,weekly_periods_total,annual_hours_total,fingerprint
  into v_course_count,v_basic_count,v_activity_count,v_additional_count,v_other_count,
       v_schedule_slot_count,v_parallel_group_count,v_parallel_variant_count,v_parallel_mismatch_count,
       v_missing_time,v_weekly_periods,v_total_hours,v_fingerprint
  from stats;

  if v_schedule_configured then v_period_gap:=v_capacity-v_weekly_periods; end if;

  with effective_subjects as (
    select distinct s.subject_code,s.name_th,s.subject_type
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
    where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
      and c.grade_code=p_grade_code and c.is_active
      and (
        (p_program_id is null and c.program_id is null)
        or
        (p_program_id is not null and (
          c.program_id=p_program_id
          or (
            c.program_id is null and s.subject_type in ('basic','activity')
            and not exists(
              select 1 from public.lao_curriculum_program_exclusions x
              where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id
                and x.program_id=p_program_id and x.grade_code=p_grade_code and x.subject_id=c.subject_id
            )
          )
        ))
      )
  )
  select
    count(*) filter(
      where coalesce(p.is_national_core,false)
        and not exists(
          select 1 from effective_subjects e
          where (p.subject_code is not null and lower(coalesce(e.subject_code,''))=lower(p.subject_code))
             or (p.subject_code is null and lower(btrim(e.name_th))=lower(btrim(p.subject_name)) and e.subject_type=p.subject_type)
        )
    )::int,
    count(*) filter(
      where p.subject_type='activity' and coalesce(p.auto_apply,true)
        and not exists(
          select 1 from effective_subjects e
          where (
            p.subject_code is not null
            and lower(coalesce(e.subject_code,''))=lower(p.subject_code)
            and (p.choice_group is null or lower(btrim(e.name_th))=lower(btrim(p.subject_name)))
          )
          or (
            p.subject_code is null and lower(btrim(e.name_th))=lower(btrim(p.subject_name)) and e.subject_type='activity'
          )
        )
    )::int
  into v_core_missing,v_activity_missing
  from public.lao_curriculum_preset_items p
  where p.preset_code='normal_primary_example' and p.grade_code=p_grade_code;

  select c.confirmed_at
  into v_confirmed_at
  from public.lao_curriculum_structure_confirmations c
  where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
    and c.program_id is not distinct from p_program_id and c.grade_code=p_grade_code
    and c.fingerprint=v_fingerprint
  order by c.confirmed_at desc
  limit 1;

  v_confirmed:=v_confirmed_at is not null;

  return jsonb_build_object(
    'course_count',v_course_count,
    'basic_count',v_basic_count,
    'activity_count',v_activity_count,
    'additional_count',v_additional_count,
    'other_count',v_other_count,
    'schedule_slot_count',v_schedule_slot_count,
    'parallel_group_count',v_parallel_group_count,
    'parallel_variant_count',v_parallel_variant_count,
    'parallel_mismatch_count',v_parallel_mismatch_count,
    'missing_time_count',v_missing_time,
    'central_core_missing_count',v_core_missing,
    'default_activity_missing_count',v_activity_missing,
    'weekly_periods_total',v_weekly_periods,
    'periods_per_week_capacity',case when v_schedule_configured then v_capacity else null end,
    'periods_per_week_gap',case when v_schedule_configured then v_period_gap else null end,
    'annual_hours_total',v_total_hours,
    'schedule_configured',v_schedule_configured,
    'school_days_per_week',v_days,
    'periods_per_day',v_periods_day,
    'minutes_per_period',v_minutes,
    'instructional_weeks_per_year',v_weeks,
    'fingerprint',v_fingerprint,
    'is_confirmed',v_confirmed,
    'confirmed_at',v_confirmed_at,
    'is_ready_to_confirm',(
      v_course_count>0 and v_schedule_configured and v_missing_time=0
      and v_parallel_mismatch_count=0 and abs(v_period_gap)<0.001
    ),
    'status',case
      when v_confirmed then 'confirmed'
      when v_course_count=0 then 'empty'
      when not v_schedule_configured then 'needs_schedule_settings'
      when v_missing_time>0 then 'needs_time'
      when v_parallel_mismatch_count>0 then 'parallel_time_mismatch'
      when v_period_gap>0.001 then 'needs_periods'
      when v_period_gap< -0.001 then 'over_periods'
      else 'ready_to_confirm'
    end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_curriculum_preset(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;
  if p_program_id is not null and not exists(
    select 1 from public.lao_academic_programs
    where id=p_program_id and school_id=p_school_id
  ) then raise exception 'Program not found'; end if;

  select jsonb_build_object(
    'preset_code','normal_primary_example',
    'preset_name','ฐานรายวิชากลาง ป.1–ม.6',
    'supported_grades',coalesce((
      with logical_items as (
        select p.*
        from public.lao_curriculum_preset_items p
        where p.preset_code='normal_primary_example'
          and p.choice_group is null
        union all
        select distinct on (p.grade_code,p.choice_group) p.*
        from public.lao_curriculum_preset_items p
        where p.preset_code='normal_primary_example'
          and p.choice_group is not null
        order by grade_code,choice_group,sort_order
      )
      select jsonb_agg(jsonb_build_object(
        'grade_code',x.grade_code,
        'grade_label',x.grade_label,
        'subject_count',x.subject_count,
        'weekly_total',x.weekly_total,
        'annual_total',x.annual_total,
        'hour_defined_count',x.hour_defined_count,
        'present_count',x.present_count
      ) order by x.grade_order)
      from (
        select
          p.grade_code,
          min(p.grade_label) as grade_label,
          case p.grade_code
            when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4
            when 'P5' then 5 when 'P6' then 6
            when 'M1' then 11 when 'M2' then 12 when 'M3' then 13
            when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
            else 99 end as grade_order,
          count(*) as subject_count,
          sum(p.weekly_periods) as weekly_total,
          sum(p.annual_hours) as annual_total,
          count(p.annual_hours) as hour_defined_count,
          count(*) filter(where exists(
            select 1
            from public.lao_curriculum_courses c
            join public.lao_subjects s on s.id=c.subject_id
            where c.school_id=p_school_id
              and c.academic_year_id=p_academic_year_id
              and c.is_active
              and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
              and (
                c.program_id is not distinct from p_program_id
                or (
                  p_program_id is not null
                  and c.program_id is null
                  and p.subject_type in ('basic','activity')
                )
              )
              and (
                (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
                or
                (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
              )
          )) as present_count
        from logical_items p
        group by p.grade_code
      ) x
    ),'[]'::jsonb),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'grade_code',p.grade_code,
        'grade_label',p.grade_label,
        'program_label',p.program_label,
        'sort_order',p.sort_order,
        'subject_code',p.subject_code,
        'subject_name',p.subject_name,
        'learning_area',p.learning_area,
        'weekly_periods',p.weekly_periods,
        'annual_hours',p.annual_hours,
        'subject_type',p.subject_type,
        'is_national_core',p.is_national_core,
        'choice_group',p.choice_group,
        'choice_key',p.choice_key,
        'auto_apply',p.auto_apply,
        'present',exists(
          select 1
          from public.lao_curriculum_courses c
          join public.lao_subjects s on s.id=c.subject_id
          where c.school_id=p_school_id
            and c.academic_year_id=p_academic_year_id
            and c.is_active
            and lower(btrim(c.grade_label))=lower(btrim(p.grade_label))
            and (
              c.program_id is not distinct from p_program_id
              or (
                p_program_id is not null
                and c.program_id is null
                and p.subject_type in ('basic','activity')
              )
            )
            and (
              (
                p.subject_type='activity'
                and p.subject_code is not null
                and lower(coalesce(s.subject_code,''))=lower(p.subject_code)
                and lower(btrim(s.name_th))=lower(btrim(p.subject_name))
              )
              or
              (
                p.subject_type<>'activity'
                and (
                  (p.subject_code is not null and lower(coalesce(s.subject_code,''))=lower(p.subject_code))
                  or
                  (p.subject_code is null and lower(btrim(s.name_th))=lower(btrim(p.subject_name)) and s.subject_type=p.subject_type)
                )
              )
            )
        )
      ) order by
        case p.grade_code
          when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 when 'P4' then 4
          when 'P5' then 5 when 'P6' then 6
          when 'M1' then 11 when 'M2' then 12 when 'M3' then 13
          when 'M4' then 14 when 'M5' then 15 when 'M6' then 16
          else 99 end,
        p.sort_order)
      from public.lao_curriculum_preset_items p
      where p.preset_code='normal_primary_example'
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_curriculum_readiness(p_school_id uuid, p_academic_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_groups jsonb:='[]'::jsonb;
  v_group record;
  v_status jsonb;
  v_total integer:=0;
  v_confirmed integer:=0;
  v_with_courses integer:=0;
  v_issue integer:=0;
  v_program_name text;
  v_settings jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;

  select jsonb_build_object(
    'configured',true,
    'school_days_per_week',s.school_days_per_week,
    'periods_per_day',s.periods_per_day,
    'periods_per_week',s.school_days_per_week*s.periods_per_day,
    'minutes_per_period',s.minutes_per_period,
    'instructional_weeks_per_year',s.instructional_weeks_per_year
  ) into v_settings
  from public.lao_academic_schedule_settings s
  where s.school_id=p_school_id and s.academic_year_id=p_academic_year_id;

  if v_settings is null then v_settings:=jsonb_build_object('configured',false); end if;

  for v_group in
    select c.grade_code,min(c.grade_label) as grade_label,c.program_id,count(*)::int as room_count
    from public.lao_class_sections c
    where c.school_id=p_school_id and c.academic_year_id=p_academic_year_id
      and c.is_active and c.source_type='lec'
      and c.grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
    group by c.grade_code,c.program_id
    order by min(c.sort_order),c.grade_code,c.program_id nulls first
  loop
    v_total:=v_total+1;
    v_status:=public.lao_curriculum_group_status(p_school_id,p_academic_year_id,v_group.program_id,v_group.grade_code);
    if coalesce((v_status->>'course_count')::int,0)>0 then v_with_courses:=v_with_courses+1; end if;
    if coalesce((v_status->>'is_confirmed')::boolean,false) then v_confirmed:=v_confirmed+1; end if;
    if coalesce(v_status->>'status','') not in ('confirmed','ready_to_confirm') then v_issue:=v_issue+1; end if;

    select p.name_th into v_program_name from public.lao_academic_programs p where p.id=v_group.program_id;
    v_groups:=v_groups||jsonb_build_array(
      v_status||jsonb_build_object(
        'grade_code',v_group.grade_code,'grade_label',v_group.grade_label,
        'program_id',v_group.program_id,'program_name',v_program_name,'room_count',v_group.room_count
      )
    );
  end loop;

  return jsonb_build_object(
    'total_groups',v_total,
    'groups_with_courses',v_with_courses,
    'confirmed_groups',v_confirmed,
    'issue_groups',v_issue,
    'is_complete',(v_total>0 and v_confirmed=v_total),
    'schedule_settings',v_settings,
    'groups',v_groups,
    'exclusions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'program_id',x.program_id,'grade_code',x.grade_code,'subject_id',x.subject_id
      ))
      from public.lao_curriculum_program_exclusions x
      where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id
    ),'[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_delete_curriculum_parallel_group(p_school_id uuid, p_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_group record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  select * into v_group from public.lao_curriculum_parallel_groups
  where id=p_group_id and school_id=p_school_id;
  if v_group.id is null then raise exception 'ไม่พบกลุ่มรายวิชา'; end if;

  delete from public.lao_curriculum_parallel_groups where id=p_group_id;
  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=v_group.academic_year_id
    and program_id is not distinct from v_group.program_id and grade_code=v_group.grade_code;

  return jsonb_build_object('deleted',true,'id',p_group_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_department_setup_step_is_done(p_school_id uuid, p_department_code text, p_step_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_year_id uuid;
  v_readiness jsonb;
begin
  if p_department_code='personnel' then
    case p_step_code
      when 'registry' then return exists(select 1 from public.lao_personnel where school_id=p_school_id and employment_status='active');
      when 'authorities' then return exists(select 1 from public.lao_personnel_authorities where school_id=p_school_id and is_active and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date));
      when 'intake' then return exists(select 1 from public.lao_personnel_join_links where school_id=p_school_id);
      when 'requests' then return not exists(select 1 from public.lao_personnel_join_requests where school_id=p_school_id and status='pending_review');
      else return false;
    end case;
  end if;

  if p_department_code='academics' then
    select ay.id into v_year_id from public.lao_academic_years ay
    where ay.school_id=p_school_id order by ay.is_current desc,ay.year_be desc limit 1;

    if v_year_id is not null and p_step_code in ('subjects','curriculum') then
      v_readiness:=public.lao_curriculum_readiness(p_school_id,v_year_id);
    end if;

    case p_step_code
      when 'periods' then return v_year_id is not null and exists(select 1 from public.lao_terms where academic_year_id=v_year_id);
      when 'programs' then return exists(select 1 from public.lao_academic_programs where school_id=p_school_id and is_active);
      when 'classes' then return v_year_id is not null and exists(select 1 from public.lao_class_sections where school_id=p_school_id and academic_year_id=v_year_id and is_active and source_type='lec');
      when 'subjects' then return v_year_id is not null
        and coalesce((v_readiness->>'total_groups')::int,0)>0
        and coalesce((v_readiness->>'groups_with_courses')::int,0)=coalesce((v_readiness->>'total_groups')::int,0);
      when 'curriculum' then return v_year_id is not null and coalesce((v_readiness->>'is_complete')::boolean,false);
      when 'workload' then return v_year_id is not null and exists(select 1 from public.lao_teaching_workloads where school_id=p_school_id and academic_year_id=v_year_id and status<>'cancelled');
      when 'workload_review' then return v_year_id is null or not exists(select 1 from public.lao_teaching_workloads where school_id=p_school_id and academic_year_id=v_year_id and status='submitted');
      else return false;
    end case;
  end if;
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_ensure_required_curriculum_defaults(p_school_id uuid, p_academic_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_grade record;
  v_core jsonb;
  v_activity jsonb;
  v_grade_count integer:=0;
  v_initialized integer:=0;
  v_added_subjects integer:=0;
  v_added_courses integer:=0;
  v_added_term_plans integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  for v_grade in
    select distinct grade_code
    from public.lao_class_sections
    where school_id=p_school_id and academic_year_id=p_academic_year_id
      and is_active and source_type='lec'
      and grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
    order by grade_code
  loop
    v_grade_count:=v_grade_count+1;
    if exists(
      select 1 from public.lao_curriculum_grade_initializations
      where school_id=p_school_id and academic_year_id=p_academic_year_id and grade_code=v_grade.grade_code
    ) then
      continue;
    end if;

    v_core:=public.lao_import_curriculum_catalog(p_school_id,p_academic_year_id,v_grade.grade_code,'core',null);
    v_activity:=public.lao_import_curriculum_catalog(p_school_id,p_academic_year_id,v_grade.grade_code,'activity',null);

    insert into public.lao_curriculum_grade_initializations(
      school_id,academic_year_id,grade_code,initialized_by
    ) values(p_school_id,p_academic_year_id,v_grade.grade_code,v_uid)
    on conflict do nothing;

    v_initialized:=v_initialized+1;
    v_added_subjects:=v_added_subjects
      +coalesce((v_core->>'added_subjects')::integer,0)+coalesce((v_activity->>'added_subjects')::integer,0);
    v_added_courses:=v_added_courses
      +coalesce((v_core->>'added_courses')::integer,0)+coalesce((v_activity->>'added_courses')::integer,0);
    v_added_term_plans:=v_added_term_plans
      +coalesce((v_core->>'added_term_plans')::integer,0)+coalesce((v_activity->>'added_term_plans')::integer,0);
  end loop;

  return jsonb_build_object(
    'grade_count',v_grade_count,'initialized_grades',v_initialized,
    'added_subjects',v_added_subjects,'added_courses',v_added_courses,
    'added_term_plans',v_added_term_plans
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_remove_curriculum_item(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text, p_course_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_course record;
  v_action text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select c.*,s.subject_type,s.subject_code,s.name_th
  into v_course
  from public.lao_curriculum_courses c
  join public.lao_subjects s on s.id=c.subject_id
  where c.id=p_course_id and c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id and c.grade_code=p_grade_code;

  if v_course.id is null then raise exception 'ไม่พบรายวิชาในโครงสร้างนี้'; end if;

  if p_program_id is not null and v_course.program_id is null and v_course.subject_type in ('basic','activity') then
    insert into public.lao_curriculum_program_exclusions(
      school_id,academic_year_id,program_id,grade_code,subject_id,created_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_course.subject_id,v_uid
    )
    on conflict do nothing;
    v_action:='curriculum_subject_excluded';
  else
    if v_course.program_id is distinct from p_program_id then
      raise exception 'รายวิชานี้ไม่อยู่ในกลุ่มห้องที่เลือก';
    end if;
    delete from public.lao_curriculum_courses where id=v_course.id;
    v_action:='curriculum_subject_removed';
  end if;

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id and grade_code=p_grade_code;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,v_action,'curriculum_course',p_course_id::text,
    jsonb_build_object(
      'grade_code',p_grade_code,'program_id',p_program_id,'subject_id',v_course.subject_id,
      'subject_code',v_course.subject_code,'subject_name',v_course.name_th
    )
  );

  return jsonb_build_object('action',v_action,'subject_id',v_course.subject_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_remove_subject_from_curriculum(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text, p_subject_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_subject record;
  v_removed_count integer:=0;
  v_excluded_count integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select * into v_subject
  from public.lao_subjects
  where id=p_subject_id and school_id=p_school_id;
  if v_subject.id is null then raise exception 'Subject not found'; end if;

  if p_program_id is null then
    with matching_subjects as (
      select s.id
      from public.lao_subjects s
      where s.school_id=p_school_id
        and (
          (
            v_subject.subject_type='activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
          or (
            v_subject.subject_type<>'activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
          )
          or (
            nullif(btrim(v_subject.subject_code),'') is null
            and s.subject_type=v_subject.subject_type
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
        )
    )
    update public.lao_curriculum_courses c
    set is_active=false,updated_by=v_uid,updated_at=now()
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.program_id is null
      and c.grade_code=p_grade_code
      and c.is_active
      and c.subject_id in (select id from matching_subjects);
    get diagnostics v_removed_count=row_count;
  else
    with matching_subjects as (
      select s.id
      from public.lao_subjects s
      where s.school_id=p_school_id
        and (
          (
            v_subject.subject_type='activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
          or (
            v_subject.subject_type<>'activity'
            and nullif(btrim(v_subject.subject_code),'') is not null
            and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
          )
          or (
            nullif(btrim(v_subject.subject_code),'') is null
            and s.subject_type=v_subject.subject_type
            and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
          )
        )
    )
    update public.lao_curriculum_courses c
    set is_active=false,updated_by=v_uid,updated_at=now()
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.program_id=p_program_id
      and c.grade_code=p_grade_code
      and c.is_active
      and c.subject_id in (select id from matching_subjects);
    get diagnostics v_removed_count=row_count;

    if v_subject.subject_type in ('basic','activity') then
      with matching_subjects as (
        select s.id
        from public.lao_subjects s
        where s.school_id=p_school_id
          and (
            (
              v_subject.subject_type='activity'
              and nullif(btrim(v_subject.subject_code),'') is not null
              and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
              and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
            )
            or (
              v_subject.subject_type<>'activity'
              and nullif(btrim(v_subject.subject_code),'') is not null
              and lower(coalesce(s.subject_code,''))=lower(v_subject.subject_code)
            )
            or (
              nullif(btrim(v_subject.subject_code),'') is null
              and s.subject_type=v_subject.subject_type
              and lower(btrim(s.name_th))=lower(btrim(v_subject.name_th))
            )
          )
      ),
      ins as (
        insert into public.lao_curriculum_program_exclusions(
          school_id,academic_year_id,program_id,grade_code,subject_id,created_by
        )
        select p_school_id,p_academic_year_id,p_program_id,p_grade_code,c.subject_id,v_uid
        from public.lao_curriculum_courses c
        where c.school_id=p_school_id
          and c.academic_year_id=p_academic_year_id
          and c.program_id is null
          and c.grade_code=p_grade_code
          and c.is_active
          and c.subject_id in (select id from matching_subjects)
        on conflict do nothing
        returning 1
      )
      select count(*) into v_excluded_count from ins;
    end if;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_subject_removed','subject',p_subject_id::text,
    jsonb_build_object(
      'academic_year_id',p_academic_year_id,'program_id',p_program_id,'grade_code',p_grade_code,
      'subject_id',p_subject_id,'course_deactivated_count',v_removed_count,'program_exclusion_count',v_excluded_count
    )
  );

  return jsonb_build_object(
    'subject_id',p_subject_id,'course_deactivated_count',v_removed_count,'program_exclusion_count',v_excluded_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_save_academic_schedule_settings(p_school_id uuid, p_academic_year_id uuid, p_school_days_per_week smallint, p_periods_per_day numeric, p_minutes_per_period smallint, p_instructional_weeks_per_year numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
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

  delete from public.lao_curriculum_structure_confirmations
  where school_id=p_school_id and academic_year_id=p_academic_year_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'academic_schedule_settings_saved','academic_year',p_academic_year_id::text,
    jsonb_build_object(
      'school_days_per_week',p_school_days_per_week,
      'periods_per_day',p_periods_per_day,
      'periods_per_week',p_school_days_per_week*p_periods_per_day,
      'minutes_per_period',p_minutes_per_period,
      'instructional_weeks_per_year',p_instructional_weeks_per_year
    )
  );

  return jsonb_build_object(
    'school_days_per_week',p_school_days_per_week,
    'periods_per_day',p_periods_per_day,
    'periods_per_week',p_school_days_per_week*p_periods_per_day,
    'minutes_per_period',p_minutes_per_period,
    'instructional_weeks_per_year',p_instructional_weeks_per_year
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_select_student_activity(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_choice_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select id into v_item_id
  from public.lao_curriculum_preset_items
  where preset_code='normal_primary_example'
    and grade_code=p_grade_code
    and subject_type='activity'
    and choice_group='student_activity'
    and choice_key=p_choice_key
  limit 1;

  if v_item_id is null then raise exception 'ไม่พบตัวเลือกกิจกรรมนักเรียน'; end if;

  return public.lao_add_curriculum_library_item(
    p_school_id,p_academic_year_id,null,p_grade_code,'preset',v_item_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_subject_workspace(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid, p_grade_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_status jsonb;
  v_groups jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;
  v_status:=public.lao_curriculum_group_status(p_school_id,p_academic_year_id,p_program_id,p_grade_code);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,
    'name',g.name,
    'weekly_periods',g.weekly_periods,
    'members',coalesce((
      select jsonb_agg(jsonb_build_object(
        'course_id',c.id,
        'subject_id',s.id,
        'subject_code',s.subject_code,
        'subject_name',s.name_th,
        'subject_type',s.subject_type
      ) order by c.sort_order,s.name_th)
      from public.lao_curriculum_parallel_group_courses gc
      join public.lao_curriculum_courses c on c.id=gc.course_id
      join public.lao_subjects s on s.id=c.subject_id
      where gc.group_id=g.id
    ),'[]'::jsonb)
  ) order by g.created_at),'[]'::jsonb)
  into v_groups
  from public.lao_curriculum_parallel_groups g
  where g.school_id=p_school_id and g.academic_year_id=p_academic_year_id
    and g.program_id is not distinct from p_program_id and g.grade_code=p_grade_code;

  return jsonb_build_object('status',v_status,'parallel_groups',v_groups);
end;
$function$;

revoke all on function public.lao_curriculum_preset(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_preset(uuid,uuid,uuid) to authenticated;
revoke all on function public.lao_add_subject_to_curriculum(uuid,uuid,uuid,text,uuid,text,text,text,text,numeric,numeric) from public,anon;
grant execute on function public.lao_add_subject_to_curriculum(uuid,uuid,uuid,text,uuid,text,text,text,text,numeric,numeric) to authenticated;
revoke all on function public.lao_remove_subject_from_curriculum(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_remove_subject_from_curriculum(uuid,uuid,uuid,text,uuid) to authenticated;
revoke all on function public.lao_confirm_curriculum_structure(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_confirm_curriculum_structure(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) to authenticated;
revoke all on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.lao_add_curriculum_library_item(uuid,uuid,uuid,text,text,uuid) to authenticated;
revoke all on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.lao_remove_curriculum_item(uuid,uuid,uuid,text,uuid) to authenticated;
revoke all on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) from public,anon;
grant execute on function public.lao_create_curriculum_parallel_group(uuid,uuid,uuid,text,text,numeric,uuid[]) to authenticated;
revoke all on function public.lao_delete_curriculum_parallel_group(uuid,uuid) from public,anon;
grant execute on function public.lao_delete_curriculum_parallel_group(uuid,uuid) to authenticated;
revoke all on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_subject_workspace(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_subject_workspace(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_confirm_curriculum_group(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_curriculum_readiness(uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_readiness(uuid,uuid) to authenticated;
revoke all on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) to authenticated;
revoke all on function public.lao_select_student_activity(uuid,uuid,text,text) from public,anon;
grant execute on function public.lao_select_student_activity(uuid,uuid,text,text) to authenticated;
revoke all on function public.lao_department_setup_step_is_done(uuid,text,text) from public,anon;
grant execute on function public.lao_department_setup_step_is_done(uuid,text,text) to authenticated;
