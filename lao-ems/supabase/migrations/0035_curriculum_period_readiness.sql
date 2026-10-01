begin;

create table if not exists public.lao_academic_schedule_settings(
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  academic_year_id uuid not null references public.lao_academic_years(id) on delete cascade,
  school_days_per_week smallint not null,
  periods_per_day numeric(5,2) not null,
  minutes_per_period smallint not null,
  instructional_weeks_per_year numeric(6,2) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(school_id,academic_year_id),
  constraint lao_schedule_days_check check(school_days_per_week between 1 and 7),
  constraint lao_schedule_periods_check check(periods_per_day>0 and periods_per_day<=20),
  constraint lao_schedule_minutes_check check(minutes_per_period between 20 and 120),
  constraint lao_schedule_weeks_check check(instructional_weeks_per_year>0 and instructional_weeks_per_year<=60)
);
alter table public.lao_academic_schedule_settings enable row level security;
revoke all on table public.lao_academic_schedule_settings from public,anon,authenticated;

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
  if v_schedule_configured then
    v_capacity:=v_days*v_periods_day;
  end if;

  with eligible as (
    select
      c.id,c.subject_id,c.program_id,c.annual_hours,c.sort_order,c.updated_at as course_updated_at,
      s.subject_code,s.name_th as subject_name,s.subject_type,s.updated_at as subject_updated_at,
      case
        when s.subject_type='activity' and nullif(btrim(s.subject_code),'') is not null
          then 'activity|'||lower(btrim(s.subject_code))||'|'||lower(btrim(s.name_th))
        when nullif(btrim(s.subject_code),'') is not null
          then 'code|'||lower(btrim(s.subject_code))
        else 'name|'||s.subject_type||'|'||lower(btrim(s.name_th))
      end as subject_key,
      case
        when s.subject_type='activity' and nullif(btrim(s.subject_code),'') is not null
          then 'activity-code|'||lower(btrim(s.subject_code))
        else
          case
            when nullif(btrim(s.subject_code),'') is not null then 'code|'||lower(btrim(s.subject_code))
            else 'name|'||s.subject_type||'|'||lower(btrim(s.name_th))
          end
      end as schedule_key,
      case when p_program_id is not null and c.program_id=p_program_id then 2 else 1 end as priority
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
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
    select e.*,row_number() over(partition by e.subject_key order by e.priority desc,e.course_updated_at desc,e.id) as rn
    from eligible e
  ),
  eff0 as (
    select * from ranked where rn=1
  ),
  eff as (
    select e.*,
      (select max(tp.weekly_periods) from public.lao_course_term_plans tp where tp.course_id=e.id) as weekly_periods,
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
  slots as (
    select
      schedule_key,
      max(weekly_periods) as weekly_periods,
      max(effective_annual_hours) as annual_hours,
      count(*)::int as variant_count,
      count(*) filter(where weekly_periods is null and not has_term_time and annual_hours is null)::int as missing_variants,
      count(distinct weekly_periods) filter(where weekly_periods is not null)::int as distinct_weekly_values,
      bool_or(weekly_periods is null) and bool_or(weekly_periods is not null) as partial_weekly
    from eff
    group by schedule_key
  ),
  stats as (
    select
      (select count(*)::int from eff) as course_count,
      (select count(*) filter(where subject_type='basic')::int from eff) as basic_count,
      (select count(*) filter(where subject_type='activity')::int from eff) as activity_count,
      (select count(*) filter(where subject_type='additional')::int from eff) as additional_count,
      (select count(*) filter(where subject_type='other')::int from eff) as other_count,
      (select count(*)::int from slots) as schedule_slot_count,
      (select coalesce(sum(greatest(variant_count-1,0)),0)::int from slots) as parallel_variant_count,
      (select count(*)::int from slots where distinct_weekly_values>1 or partial_weekly) as parallel_mismatch_count,
      (select count(*)::int from slots where weekly_periods is null and coalesce(annual_hours,0)=0) as missing_time_count,
      (select coalesce(sum(weekly_periods),0) from slots) as weekly_periods_total,
      (select coalesce(sum(annual_hours),0) from slots) as annual_hours_total,
      md5(coalesce((select string_agg(
        concat_ws('|',
          subject_key,subject_id::text,id::text,coalesce(subject_code,''),coalesce(subject_name,''),
          coalesce(subject_type,''),coalesce(annual_hours::text,''),coalesce(weekly_periods::text,''),
          course_updated_at::text,subject_updated_at::text
        ),
        '||' order by subject_key
      ) from eff),'')||
      concat_ws('|','schedule',coalesce(v_days::text,''),coalesce(v_periods_day::text,''),coalesce(v_minutes::text,''),coalesce(v_weeks::text,''))) as fingerprint
  )
  select course_count,basic_count,activity_count,additional_count,other_count,
         schedule_slot_count,parallel_variant_count,parallel_mismatch_count,
         missing_time_count,weekly_periods_total,annual_hours_total,fingerprint
  into v_course_count,v_basic_count,v_activity_count,v_additional_count,v_other_count,
       v_schedule_slot_count,v_parallel_variant_count,v_parallel_mismatch_count,
       v_missing_time,v_weekly_periods,v_total_hours,v_fingerprint
  from stats;

  if v_schedule_configured then
    v_period_gap:=v_capacity-v_weekly_periods;
  end if;

  with effective_subjects as (
    select distinct s.subject_code,s.name_th,s.subject_type
    from public.lao_curriculum_courses c
    join public.lao_subjects s on s.id=c.subject_id
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
          where (p.subject_code is not null and lower(coalesce(e.subject_code,''))=lower(p.subject_code))
             or (p.subject_code is null and lower(btrim(e.name_th))=lower(btrim(p.subject_name)) and e.subject_type='activity')
        )
    )::int
  into v_core_missing,v_activity_missing
  from public.lao_curriculum_preset_items p
  where p.preset_code='normal_primary_example' and p.grade_code=p_grade_code;

  select c.confirmed_at
  into v_confirmed_at
  from public.lao_curriculum_structure_confirmations c
  where c.school_id=p_school_id
    and c.academic_year_id=p_academic_year_id
    and c.program_id is not distinct from p_program_id
    and c.grade_code=p_grade_code
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
      v_course_count>0
      and v_schedule_configured
      and v_missing_time=0
      and v_parallel_mismatch_count=0
      and abs(v_period_gap)<0.001
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
  if not exists(
    select 1 from public.lao_academic_years
    where id=p_academic_year_id and school_id=p_school_id
  ) then raise exception 'Academic year not found'; end if;

  select jsonb_build_object(
    'configured',true,
    'school_days_per_week',s.school_days_per_week,
    'periods_per_day',s.periods_per_day,
    'periods_per_week',s.school_days_per_week*s.periods_per_day,
    'minutes_per_period',s.minutes_per_period,
    'instructional_weeks_per_year',s.instructional_weeks_per_year
  )
  into v_settings
  from public.lao_academic_schedule_settings s
  where s.school_id=p_school_id and s.academic_year_id=p_academic_year_id;

  if v_settings is null then
    v_settings:=jsonb_build_object('configured',false);
  end if;

  for v_group in
    select
      c.grade_code,
      min(c.grade_label) as grade_label,
      c.program_id,
      count(*)::int as room_count
    from public.lao_class_sections c
    where c.school_id=p_school_id
      and c.academic_year_id=p_academic_year_id
      and c.is_active
      and c.source_type='lec'
      and c.grade_code in ('P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6')
    group by c.grade_code,c.program_id
    order by min(c.sort_order),c.grade_code,c.program_id nulls first
  loop
    v_total:=v_total+1;
    v_status:=public.lao_curriculum_group_status(
      p_school_id,p_academic_year_id,v_group.program_id,v_group.grade_code
    );

    if coalesce((v_status->>'course_count')::int,0)>0 then v_with_courses:=v_with_courses+1; end if;
    if coalesce((v_status->>'is_confirmed')::boolean,false) then v_confirmed:=v_confirmed+1; end if;
    if coalesce(v_status->>'status','') not in ('confirmed','ready_to_confirm') then v_issue:=v_issue+1; end if;

    select p.name_th into v_program_name
    from public.lao_academic_programs p
    where p.id=v_group.program_id;

    v_groups:=v_groups||jsonb_build_array(
      v_status||jsonb_build_object(
        'grade_code',v_group.grade_code,
        'grade_label',v_group.grade_label,
        'program_id',v_group.program_id,
        'program_name',v_program_name,
        'room_count',v_group.room_count
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
        'program_id',x.program_id,
        'grade_code',x.grade_code,
        'subject_id',x.subject_id
      ))
      from public.lao_curriculum_program_exclusions x
      where x.school_id=p_school_id and x.academic_year_id=p_academic_year_id
    ),'[]'::jsonb)
  );
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

update public.lao_department_setup_steps
set title_th='จัดรายวิชาแต่ละระดับชั้น',
    description_th='เลือกรายวิชาที่สถานศึกษาใช้จริงจากคลังกลางหรือเพิ่มรายวิชาของโรงเรียนให้ครบทุกระดับและโปรแกรม'
where department_code='academics' and step_code='subjects';

update public.lao_department_setup_steps
set title_th='ตรวจโครงสร้างเวลาเรียน',
    description_th='กำหนดวันเรียน คาบต่อวัน นาทีต่อคาบ และตรวจคาบ/สัปดาห์ของแต่ละระดับชั้นก่อนยืนยันโครงสร้าง'
where department_code='academics' and step_code='curriculum';

revoke all on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) from public,anon;
grant execute on function public.lao_save_academic_schedule_settings(uuid,uuid,smallint,numeric,smallint,numeric) to authenticated;
revoke all on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_curriculum_group_status(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_confirm_curriculum_structure(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.lao_confirm_curriculum_structure(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.lao_curriculum_readiness(uuid,uuid) from public,anon;
grant execute on function public.lao_curriculum_readiness(uuid,uuid) to authenticated;
revoke all on function public.lao_department_setup_step_is_done(uuid,text,text) from public,anon;
grant execute on function public.lao_department_setup_step_is_done(uuid,text,text) to authenticated;

commit;
