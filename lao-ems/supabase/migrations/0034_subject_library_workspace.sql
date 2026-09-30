begin;

create table if not exists public.lao_curriculum_default_initializations(
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  grade_code text not null,
  initialized_at timestamptz not null default now(),
  initialized_by uuid,
  primary key(school_id,academic_year_id,grade_code)
);
alter table public.lao_curriculum_default_initializations enable row level security;
revoke all on table public.lao_curriculum_default_initializations from public,anon,authenticated;

drop index if exists public.lao_subjects_school_code_uq;
create unique index if not exists lao_subjects_school_code_nonactivity_uq
  on public.lao_subjects(school_id,lower(subject_code))
  where subject_code is not null and btrim(subject_code)<>'' and subject_type<>'activity';
create unique index if not exists lao_subjects_school_code_activity_name_uq
  on public.lao_subjects(school_id,lower(subject_code),lower(name_th))
  where subject_code is not null and btrim(subject_code)<>'' and subject_type='activity';

CREATE OR REPLACE FUNCTION public.lao_add_catalog_item_to_curriculum(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_catalog_sort_order integer, p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_row record;
  v_subject_id uuid;
  v_course_id uuid;
  v_term record;
  v_reactivated boolean := false;
  v_created_subject boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  select * into v_row
  from public.lao_curriculum_preset_items
  where preset_code='normal_primary_example'
    and grade_code=p_grade_code
    and sort_order=p_catalog_sort_order
  limit 1;
  if v_row.subject_name is null then raise exception 'ไม่พบรายการในฐานกลาง'; end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  if nullif(btrim(v_row.subject_code),'') is not null then
    if v_row.subject_type='activity' then
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(v_row.subject_code)
        and lower(btrim(name_th))=lower(btrim(v_row.subject_name))
      limit 1;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(v_row.subject_code)
      limit 1;
    end if;
  else
    select id into v_subject_id
    from public.lao_subjects
    where school_id=p_school_id
      and lower(btrim(name_th))=lower(btrim(v_row.subject_name))
      and subject_type=v_row.subject_type
    order by is_active desc,created_at
    limit 1;
  end if;

  if v_subject_id is null then
    insert into public.lao_subjects(
      school_id,subject_code,name_th,learning_area,subject_type,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,v_row.subject_code,v_row.subject_name,v_row.learning_area,v_row.subject_type,
      true,v_row.sort_order,v_uid,v_uid
    ) returning id into v_subject_id;
    v_created_subject:=true;
  end if;

  select id,is_active into v_course_id,v_reactivated
  from public.lao_curriculum_courses
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and grade_code=p_grade_code
    and program_id is not distinct from p_program_id
    and subject_id=v_subject_id
  limit 1;

  if v_course_id is null then
    insert into public.lao_curriculum_courses(
      school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
      annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_row.grade_label,v_subject_id,
      v_row.annual_hours,null,'เพิ่มจากคลังรายวิชากลาง',true,v_row.sort_order,v_uid,v_uid
    ) returning id into v_course_id;
    v_reactivated:=false;
  else
    update public.lao_curriculum_courses
    set is_active=true,
        updated_by=v_uid,
        updated_at=now()
    where id=v_course_id;
    v_reactivated:=not v_reactivated;
  end if;

  if v_row.weekly_periods is not null then
    for v_term in select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
    loop
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,notes,created_by,updated_by
      ) values(
        v_course_id,v_term.id,v_row.weekly_periods,null,'ค่าเริ่มต้นจากคลังรายวิชา',v_uid,v_uid
      ) on conflict (course_id,term_id) do nothing;
    end loop;
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_catalog_item_added','curriculum_course',v_course_id::text,
    jsonb_build_object(
      'grade_code',p_grade_code,'program_id',p_program_id,'subject_id',v_subject_id,
      'subject_code',v_row.subject_code,'subject_name',v_row.subject_name,
      'created_subject',v_created_subject,'reactivated',v_reactivated
    )
  );

  return jsonb_build_object(
    'course_id',v_course_id,'subject_id',v_subject_id,
    'subject_code',v_row.subject_code,'subject_name',v_row.subject_name
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_add_school_subject_to_curriculum(p_school_id uuid, p_academic_year_id uuid, p_grade_code text, p_subject_id uuid, p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_subject record;
  v_course_id uuid;
  v_grade_label text;
  v_sort integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  select * into v_subject
  from public.lao_subjects
  where id=p_subject_id and school_id=p_school_id and is_active;
  if v_subject.id is null then raise exception 'Subject not found'; end if;

  v_grade_label:=case p_grade_code
    when 'P1' then 'ประถมศึกษาปีที่ 1' when 'P2' then 'ประถมศึกษาปีที่ 2'
    when 'P3' then 'ประถมศึกษาปีที่ 3' when 'P4' then 'ประถมศึกษาปีที่ 4'
    when 'P5' then 'ประถมศึกษาปีที่ 5' when 'P6' then 'ประถมศึกษาปีที่ 6'
    when 'M1' then 'มัธยมศึกษาปีที่ 1' when 'M2' then 'มัธยมศึกษาปีที่ 2'
    when 'M3' then 'มัธยมศึกษาปีที่ 3' when 'M4' then 'มัธยมศึกษาปีที่ 4'
    when 'M5' then 'มัธยมศึกษาปีที่ 5' when 'M6' then 'มัธยมศึกษาปีที่ 6'
    else null end;
  if v_grade_label is null then raise exception 'ระดับชั้นไม่ถูกต้อง'; end if;

  select id into v_course_id
  from public.lao_curriculum_courses
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and grade_code=p_grade_code
    and program_id is not distinct from p_program_id
    and subject_id=p_subject_id
  limit 1;

  if v_course_id is not null then
    update public.lao_curriculum_courses
    set is_active=true,updated_by=v_uid,updated_at=now()
    where id=v_course_id;
  else
    select coalesce(max(sort_order),0)+1 into v_sort
    from public.lao_curriculum_courses
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and grade_code=p_grade_code
      and program_id is not distinct from p_program_id;

    insert into public.lao_curriculum_courses(
      school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
      annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,p_grade_code,v_grade_label,p_subject_id,
      null,null,'เพิ่มจากคลังรายวิชาของสถานศึกษา',true,v_sort,v_uid,v_uid
    ) returning id into v_course_id;
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'school_subject_added_to_curriculum','curriculum_course',v_course_id::text,
    jsonb_build_object('grade_code',p_grade_code,'program_id',p_program_id,'subject_id',p_subject_id)
  );

  return jsonb_build_object('course_id',v_course_id,'subject_id',p_subject_id);
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
  v_grade_count integer := 0;
  v_initialized integer := 0;
  v_added_subjects integer := 0;
  v_added_courses integer := 0;
  v_added_term_plans integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;

  for v_grade in
    select distinct grade_code
    from public.lao_class_sections
    where school_id=p_school_id
      and academic_year_id=p_academic_year_id
      and is_active
      and source_type='lec'
      and grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
    order by grade_code
  loop
    v_grade_count:=v_grade_count+1;

    if not exists(
      select 1 from public.lao_curriculum_default_initializations
      where school_id=p_school_id
        and academic_year_id=p_academic_year_id
        and grade_code=v_grade.grade_code
    ) then
      v_core:=public.lao_import_curriculum_catalog(
        p_school_id,p_academic_year_id,v_grade.grade_code,'core',null
      );
      v_activity:=public.lao_import_curriculum_catalog(
        p_school_id,p_academic_year_id,v_grade.grade_code,'activity',null
      );

      insert into public.lao_curriculum_default_initializations(
        school_id,academic_year_id,grade_code,initialized_by
      ) values(p_school_id,p_academic_year_id,v_grade.grade_code,v_uid)
      on conflict do nothing;

      v_initialized:=v_initialized+1;
      v_added_subjects:=v_added_subjects
        +coalesce((v_core->>'added_subjects')::integer,0)
        +coalesce((v_activity->>'added_subjects')::integer,0);
      v_added_courses:=v_added_courses
        +coalesce((v_core->>'added_courses')::integer,0)
        +coalesce((v_activity->>'added_courses')::integer,0);
      v_added_term_plans:=v_added_term_plans
        +coalesce((v_core->>'added_term_plans')::integer,0)
        +coalesce((v_activity->>'added_term_plans')::integer,0);
    end if;
  end loop;

  return jsonb_build_object(
    'grade_count',v_grade_count,
    'initialized_grades',v_initialized,
    'added_subjects',v_added_subjects,
    'added_courses',v_added_courses,
    'added_activity_courses',0,
    'added_term_plans',v_added_term_plans
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_quick_add_curriculum_subject(p_school_id uuid, p_academic_year_id uuid, p_program_id uuid DEFAULT NULL::uuid, p_grade_label text DEFAULT NULL::text, p_subject_code text DEFAULT NULL::text, p_subject_name text DEFAULT NULL::text, p_learning_area text DEFAULT NULL::text, p_subject_type text DEFAULT 'basic'::text, p_weekly_periods numeric DEFAULT NULL::numeric, p_annual_hours numeric DEFAULT NULL::numeric, p_sort_order integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_subject_id uuid;
  v_course_id uuid;
  v_term record;
  v_grade_code text;
  v_sort integer;
  v_subject_created boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;
  if nullif(btrim(p_grade_label),'') is null then raise exception 'กรุณาเลือกระดับชั้น'; end if;
  if nullif(btrim(p_subject_name),'') is null then raise exception 'กรุณาระบุชื่อรายวิชา'; end if;
  if p_subject_type not in ('basic','additional','activity','other') then raise exception 'ประเภทรายวิชาไม่ถูกต้อง'; end if;
  if p_weekly_periods is not null and p_weekly_periods<=0 then raise exception 'ชั่วโมง/สัปดาห์ต้องมากกว่า 0'; end if;
  if p_annual_hours is not null and p_annual_hours<=0 then raise exception 'ชั่วโมง/ปีต้องมากกว่า 0'; end if;
  if not exists(select 1 from public.lao_academic_years where id=p_academic_year_id and school_id=p_school_id) then
    raise exception 'Academic year not found';
  end if;
  if p_program_id is not null and not exists(select 1 from public.lao_academic_programs where id=p_program_id and school_id=p_school_id) then
    raise exception 'Program not found';
  end if;

  select organization_id into v_org from public.lao_schools where id=p_school_id;

  v_grade_code:=case
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*1$' then 'P1'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*2$' then 'P2'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*3$' then 'P3'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*4$' then 'P4'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*5$' then 'P5'
    when btrim(p_grade_label) ~ '^ประถมศึกษาปีที่[[:space:]]*6$' then 'P6'
    when btrim(p_grade_label) ~ '^อนุบาล[[:space:]]*1$' then 'K1'
    when btrim(p_grade_label) ~ '^อนุบาล[[:space:]]*2$' then 'K2'
    when btrim(p_grade_label) ~ '^อนุบาล[[:space:]]*3$' then 'K3'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*1$' then 'M1'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*2$' then 'M2'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*3$' then 'M3'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*4$' then 'M4'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*5$' then 'M5'
    when btrim(p_grade_label) ~ '^มัธยมศึกษาปีที่[[:space:]]*6$' then 'M6'
    else null
  end;

  if nullif(btrim(p_subject_code),'') is not null then
    if p_subject_type='activity' then
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
        and lower(coalesce(subject_code,''))=lower(btrim(p_subject_code))
        and lower(btrim(name_th))=lower(btrim(p_subject_name))
      limit 1;
    else
      select id into v_subject_id
      from public.lao_subjects
      where school_id=p_school_id
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
      nullif(btrim(p_learning_area),''),p_subject_type,true,coalesce(p_sort_order,0),v_uid,v_uid
    ) returning id into v_subject_id;
    v_subject_created:=true;
  end if;

  select id into v_course_id
  from public.lao_curriculum_courses
  where school_id=p_school_id
    and academic_year_id=p_academic_year_id
    and program_id is not distinct from p_program_id
    and grade_code is not distinct from v_grade_code
    and subject_id=v_subject_id
  limit 1;

  if v_course_id is not null then
    update public.lao_curriculum_courses
    set is_active=true,
        annual_hours=coalesce(annual_hours,p_annual_hours),
        updated_by=v_uid,
        updated_at=now()
    where id=v_course_id;
  else
    if p_sort_order is null then
      select coalesce(max(sort_order),0)+1 into v_sort
      from public.lao_curriculum_courses
      where school_id=p_school_id
        and academic_year_id=p_academic_year_id
        and program_id is not distinct from p_program_id
        and grade_code is not distinct from v_grade_code;
    else
      v_sort:=p_sort_order;
    end if;

    insert into public.lao_curriculum_courses(
      school_id,academic_year_id,program_id,grade_code,grade_label,subject_id,
      annual_hours,credits,notes,is_active,sort_order,created_by,updated_by
    ) values(
      p_school_id,p_academic_year_id,p_program_id,v_grade_code,btrim(p_grade_label),v_subject_id,
      p_annual_hours,null,'รายวิชาที่สถานศึกษากำหนด',true,v_sort,v_uid,v_uid
    ) returning id into v_course_id;
  end if;

  if p_weekly_periods is not null then
    for v_term in
      select id from public.lao_terms where academic_year_id=p_academic_year_id order by term_no
    loop
      insert into public.lao_course_term_plans(
        course_id,term_id,weekly_periods,term_hours,created_by,updated_by
      ) values(v_course_id,v_term.id,p_weekly_periods,null,v_uid,v_uid)
      on conflict (course_id,term_id) do update
        set weekly_periods=coalesce(public.lao_course_term_plans.weekly_periods,excluded.weekly_periods),
            updated_by=v_uid,
            updated_at=now();
    end loop;
  end if;

  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,'curriculum_subject_quick_added','curriculum_course',v_course_id::text,
    jsonb_build_object(
      'subject_id',v_subject_id,'subject_created',v_subject_created,
      'subject_code',upper(nullif(btrim(p_subject_code),'')),
      'subject_name',btrim(p_subject_name),'grade_label',btrim(p_grade_label),
      'program_id',p_program_id,'weekly_periods',p_weekly_periods,
      'annual_hours',p_annual_hours
    )
  );

  return jsonb_build_object(
    'subject_id',v_subject_id,'course_id',v_course_id,
    'subject_created',v_subject_created
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
  v_sort integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select sort_order into v_sort
  from public.lao_curriculum_preset_items
  where preset_code='normal_primary_example'
    and grade_code=p_grade_code
    and choice_group='student_activity'
    and choice_key=p_choice_key
  limit 1;
  if v_sort is null then raise exception 'ไม่พบตัวเลือกกิจกรรมนักเรียน'; end if;

  return public.lao_add_catalog_item_to_curriculum(
    p_school_id,p_academic_year_id,p_grade_code,v_sort,null
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lao_set_curriculum_course_active(p_school_id uuid, p_course_id uuid, p_is_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_course record;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_manage_academic(p_school_id) then raise exception 'Access denied'; end if;

  select * into v_course
  from public.lao_curriculum_courses
  where id=p_course_id and school_id=p_school_id;
  if v_course.id is null then raise exception 'Course not found'; end if;

  update public.lao_curriculum_courses
  set is_active=p_is_active,updated_by=v_uid,updated_at=now()
  where id=p_course_id;

  select organization_id into v_org from public.lao_schools where id=p_school_id;
  insert into public.lao_audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values(
    v_org,p_school_id,v_uid,
    case when p_is_active then 'curriculum_course_restored' else 'curriculum_course_removed' end,
    'curriculum_course',p_course_id::text,
    jsonb_build_object(
      'academic_year_id',v_course.academic_year_id,
      'grade_code',v_course.grade_code,
      'program_id',v_course.program_id,
      'subject_id',v_course.subject_id,
      'is_active',p_is_active
    )
  );

  return jsonb_build_object('course_id',p_course_id,'is_active',p_is_active);
end;
$function$;
revoke all on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) from public,anon;
grant execute on function public.lao_quick_add_curriculum_subject(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer) to authenticated;
revoke all on function public.lao_add_catalog_item_to_curriculum(uuid,uuid,text,integer,uuid) from public,anon;
grant execute on function public.lao_add_catalog_item_to_curriculum(uuid,uuid,text,integer,uuid) to authenticated;
revoke all on function public.lao_add_school_subject_to_curriculum(uuid,uuid,text,uuid,uuid) from public,anon;
grant execute on function public.lao_add_school_subject_to_curriculum(uuid,uuid,text,uuid,uuid) to authenticated;
revoke all on function public.lao_set_curriculum_course_active(uuid,uuid,boolean) from public,anon;
grant execute on function public.lao_set_curriculum_course_active(uuid,uuid,boolean) to authenticated;
revoke all on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) from public,anon;
grant execute on function public.lao_ensure_required_curriculum_defaults(uuid,uuid) to authenticated;
revoke all on function public.lao_select_student_activity(uuid,uuid,text,text) from public,anon;
grant execute on function public.lao_select_student_activity(uuid,uuid,text,text) to authenticated;
revoke all on function public.lao_curriculum_preset(uuid,uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_preset(uuid,uuid,uuid) to authenticated;

commit;
