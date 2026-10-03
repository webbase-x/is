-- 0069_academic_time_frame_step1.sql
-- Move the school-wide annual learning-time frame into academic setup step 1.
-- Step 1 is complete only when the year/terms and timetable capacity are configured.
-- Subject completeness still uses the same schedule settings as its real 100% gate.

begin;

alter function public.lao_academic_structure(uuid,uuid)
  rename to lao_academic_structure_base_v01912;
revoke all on function public.lao_academic_structure_base_v01912(uuid,uuid)
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
  v_settings jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_base:=public.lao_academic_structure_base_v01912(
    p_school_id,p_academic_year_id
  );
  v_year_id:=nullif(v_base->>'selected_year_id','')::uuid;

  if v_year_id is not null then
    select jsonb_build_object(
      'configured',true,
      'school_days_per_week',s.school_days_per_week,
      'periods_per_day',s.periods_per_day,
      'periods_per_week',s.school_days_per_week*s.periods_per_day,
      'minutes_per_period',s.minutes_per_period,
      'instructional_weeks_per_year',s.instructional_weeks_per_year,
      'capacity_hours_per_year',
        round(
          s.school_days_per_week::numeric
          * s.periods_per_day
          * s.minutes_per_period::numeric
          / 60
          * s.instructional_weeks_per_year,
          2
        )
    )
    into v_settings
    from public.lao_academic_schedule_settings s
    where s.school_id=p_school_id
      and s.academic_year_id=v_year_id;
  end if;

  if v_settings is null then
    v_settings:=jsonb_build_object('configured',false);
  end if;

  return v_base||jsonb_build_object('schedule_settings',v_settings);
end;
$function$;

revoke all on function public.lao_academic_structure(uuid,uuid)
  from public,anon;
grant execute on function public.lao_academic_structure(uuid,uuid)
  to authenticated;


alter function public.lao_academic_year_setup_timeline(uuid,uuid)
  rename to lao_academic_year_setup_timeline_base_v01912;
revoke all on function public.lao_academic_year_setup_timeline_base_v01912(uuid,uuid)
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
  v_uid uuid:=(select auth.uid());
  v_base jsonb;
  v_year_id uuid;
  v_schedule jsonb;
  v_schedule_configured boolean:=false;
  v_term_count int:=0;
  v_raw_steps jsonb:='[]'::jsonb;
  v_steps jsonb:='[]'::jsonb;
  v_step jsonb;
  v_status text;
  v_first_unresolved int;
  v_applicable int:=0;
  v_completed int:=0;
  v_skipped int:=0;
  v_not_applicable int:=0;
  v_pct int:=0;
  v_step_pct int:=0;
  v_next jsonb:=null;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.lao_can_view_academic(p_school_id) then raise exception 'Access denied'; end if;

  v_base:=public.lao_academic_year_setup_timeline_base_v01912(
    p_school_id,p_academic_year_id
  );
  v_year_id:=nullif(v_base->>'academic_year_id','')::uuid;
  if v_year_id is null then return v_base; end if;

  select count(*)::int
  into v_term_count
  from public.lao_terms
  where academic_year_id=v_year_id;

  select jsonb_build_object(
    'configured',true,
    'school_days_per_week',s.school_days_per_week,
    'periods_per_day',s.periods_per_day,
    'periods_per_week',s.school_days_per_week*s.periods_per_day,
    'minutes_per_period',s.minutes_per_period,
    'instructional_weeks_per_year',s.instructional_weeks_per_year,
    'capacity_hours_per_year',
      round(
        s.school_days_per_week::numeric
        * s.periods_per_day
        * s.minutes_per_period::numeric
        / 60
        * s.instructional_weeks_per_year,
        2
      )
  )
  into v_schedule
  from public.lao_academic_schedule_settings s
  where s.school_id=p_school_id
    and s.academic_year_id=v_year_id;

  if v_schedule is null then
    v_schedule:=jsonb_build_object('configured',false);
  end if;
  v_schedule_configured:=coalesce((v_schedule->>'configured')::boolean,false);

  -- Normalize the previous wrapper statuses back to resolved/unresolved states,
  -- then apply the new step-1 dependency.
  for v_step in
    select value
    from jsonb_array_elements(coalesce(v_base->'steps','[]'::jsonb))
  loop
    v_status:=coalesce(v_step->>'status','queued');
    if v_status in ('current','queued') then
      v_status:='pending';
    end if;

    if v_step->>'step_code'='periods' then
      v_step_pct:=
        33
        + case when v_term_count>0 then 33 else 0 end
        + case when v_schedule_configured then 34 else 0 end;
      v_status:=case
        when v_term_count>0 and v_schedule_configured then 'completed'
        else 'pending'
      end;
      v_step:=v_step
        ||jsonb_build_object(
          'description','กำหนดปีการศึกษา ภาคเรียน และกรอบเวลาเรียนของปีนี้',
          'detail',
            coalesce(v_step->'detail','{}'::jsonb)
            ||jsonb_build_object(
              'term_count',v_term_count,
              'schedule_settings',v_schedule
            ),
          'step_progress_percent',v_step_pct,
          'step_progress_label',case
            when v_term_count=0 then 'ยังไม่มีภาคเรียน'
            when not v_schedule_configured then 'ปี/ภาคเรียนพร้อมแล้ว · รอกำหนดกรอบเวลาเรียน'
            else 'ปี/ภาคเรียนและกรอบเวลาเรียนพร้อมแล้ว'
          end
        );
    elsif v_step->>'step_code'='subjects' and not v_schedule_configured then
      v_status:='pending';
      v_step:=v_step||jsonb_build_object(
        'description','ตรวจรายวิชาหลังจากกำหนดกรอบเวลาเรียนของปีในขั้นที่ 1',
        'step_progress_label','รอกำหนดกรอบเวลาเรียนในขั้นที่ 1 ก่อนตรวจรายวิชา 100%'
      );
    end if;

    v_raw_steps:=v_raw_steps||jsonb_build_array(
      v_step||jsonb_build_object('_normalized_status',v_status)
    );
  end loop;

  select min((x->>'sequence_no')::int)
  into v_first_unresolved
  from jsonb_array_elements(v_raw_steps) x
  where x->>'_normalized_status'='pending';

  for v_step in
    select value
    from jsonb_array_elements(v_raw_steps)
    order by (value->>'sequence_no')::int
  loop
    v_status:=v_step->>'_normalized_status';

    if v_status='pending' then
      if (v_step->>'sequence_no')::int=v_first_unresolved then
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
        'is_required',(v_step->>'is_required')::boolean
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
      -'next_step'
      -'schedule_settings')
    ||jsonb_build_object(
      'steps',v_steps,
      'schedule_settings',v_schedule,
      'is_complete',(v_completed=v_applicable),
      'completed_count',v_completed,
      'skipped_count',v_skipped,
      'not_applicable_count',v_not_applicable,
      'resolved_count',v_completed+v_skipped+v_not_applicable,
      'applicable_count',v_applicable,
      'progress_percent',v_pct,
      'next_step',v_next
    );
end;
$function$;

revoke all on function public.lao_academic_year_setup_timeline(uuid,uuid)
  from public,anon;
grant execute on function public.lao_academic_year_setup_timeline(uuid,uuid)
  to authenticated;


create or replace function public.lao_department_setup_step_is_done(
  p_school_id uuid,
  p_department_code text,
  p_step_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_year_id uuid;
  v_curriculum_readiness jsonb;
  v_subject_readiness jsonb;
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
    select ay.id into v_year_id
    from public.lao_academic_years ay
    where ay.school_id=p_school_id
    order by ay.is_current desc,ay.year_be desc
    limit 1;

    if v_year_id is not null and p_step_code='subjects' then
      v_subject_readiness:=public.lao_subject_readiness(p_school_id,v_year_id);
    end if;

    if v_year_id is not null and p_step_code='curriculum' then
      v_curriculum_readiness:=public.lao_curriculum_readiness(p_school_id,v_year_id);
    end if;

    case p_step_code
      when 'periods' then return v_year_id is not null
        and exists(select 1 from public.lao_terms where academic_year_id=v_year_id)
        and exists(
          select 1
          from public.lao_academic_schedule_settings s
          where s.school_id=p_school_id and s.academic_year_id=v_year_id
        );
      when 'programs' then return exists(
        select 1 from public.lao_academic_programs where school_id=p_school_id and is_active
      );
      when 'classes' then return v_year_id is not null and exists(
        select 1 from public.lao_class_sections
        where school_id=p_school_id and academic_year_id=v_year_id
          and is_active and source_type='lec'
      );
      when 'subjects' then return v_year_id is not null
        and coalesce((v_subject_readiness->>'is_complete')::boolean,false);
      when 'curriculum' then return v_year_id is not null
        and coalesce((v_curriculum_readiness->>'is_complete')::boolean,false);
      when 'workload' then return v_year_id is not null and exists(
        select 1 from public.lao_teaching_workloads
        where school_id=p_school_id and academic_year_id=v_year_id and status<>'cancelled'
      );
      when 'workload_review' then return v_year_id is null or not exists(
        select 1 from public.lao_teaching_workloads
        where school_id=p_school_id and academic_year_id=v_year_id and status='submitted'
      );
      else return false;
    end case;
  end if;

  return false;
end;
$function$;

revoke all on function public.lao_department_setup_step_is_done(uuid,text,text)
  from public,anon;
grant execute on function public.lao_department_setup_step_is_done(uuid,text,text)
  to authenticated;

commit;
